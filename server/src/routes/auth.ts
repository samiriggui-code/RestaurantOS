import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticate,
} from '../middleware/auth';
import { AuthRequest } from '../types';
import { canAccessKitchen, canAccessPos } from '../lib/roles';
import { isValidStaffPin } from '../lib/pin';
import { logFiscalEvent } from '../lib/fiscal/events';

const router = Router();

function issueTokens(user: {
  id: string;
  businessId: string;
  role: string;
  name: string;
  email: string;
  business: {
    id: string;
    name: string;
    nameAr?: string | null;
    currency?: string;
    taxRate?: number;
    serviceChargeRate?: number;
    kitchenDisplayEnabled?: boolean;
  };
}): {
  accessToken: string;
  refreshToken: string;
  token: string;
  user: { id: string; name: string; email: string; role: string; businessId: string };
  business: {
    id: string;
    name: string;
    nameAr: string | null;
    currency: string;
    taxRate: number;
    serviceChargeRate: number;
    kitchenDisplayEnabled: boolean;
  };
} {
  const payload = {
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
    name: user.name,
  };
  const accessToken = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);
  return {
    accessToken,
    refreshToken,
    token: accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    },
    business: {
      id: user.business.id,
      name: user.business.name,
      nameAr: user.business.nameAr ?? null,
      currency: user.business.currency ?? 'EUR',
      taxRate: user.business.taxRate ?? 10,
      serviceChargeRate: user.business.serviceChargeRate ?? 0,
      kitchenDisplayEnabled: user.business.kitchenDisplayEnabled ?? true,
    },
  };
}

/**
 * POST /api/auth/login
 * Authenticate user with email/password or PIN.
 * Returns JWT access token and refresh token on success.
 * @body {email?: string, password?: string, pin?: string}
 * @returns {accessToken, refreshToken, user, business}
 * @throws 400 if email or PIN missing
 * @throws 401 if credentials invalid
 */
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { business: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

    void logFiscalEvent(prisma, {
      businessId: user.businessId,
      eventType: 'OPERATOR_LOGIN',
      operatorId: user.id,
      entityType: 'User',
      entityId: user.id,
      payload: { method: 'email', role: user.role },
    }).catch(err => console.error('[fiscal] OPERATOR_LOGIN:', err));

    res.json(issueTokens(user));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/pin
 * Déverrouillage POS / KDS — PIN employé (pas d'accès CRM).
 */
router.post('/pin', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { pin, businessId, device } = req.body as {
      pin?: string;
      businessId?: string;
      device?: 'pos' | 'kitchen';
    };

    const bid = businessId || process.env.BUSINESS_ID;
    if (!pin || !bid) {
      return res.status(400).json({ error: 'PIN requis' });
    }
    if (device !== 'pos' && device !== 'kitchen') {
      return res.status(400).json({ error: 'Appareil invalide' });
    }

    const normalizedPin = String(pin).trim();
    if (!isValidStaffPin(normalizedPin)) {
      return res.status(400).json({ error: 'PIN invalide (4 chiffres)' });
    }

    const user = await prisma.user.findFirst({
      where: { businessId: bid, pin: normalizedPin, isActive: true },
      select: {
        id: true,
        businessId: true,
        role: true,
        name: true,
        email: true,
        business: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            currency: true,
            taxRate: true,
            serviceChargeRate: true,
            kitchenDisplayEnabled: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'PIN incorrect' });
    }

    if (device === 'pos' && !canAccessPos(user.role)) {
      return res.status(403).json({
        error: 'Ce PIN est réservé à la cuisine — utilisez le PIN caisse (ex. 1234).',
      });
    }
    if (device === 'kitchen' && !canAccessKitchen(user.role)) {
      return res.status(403).json({
        error: 'Ce PIN ne peut pas ouvrir le KDS — utilisez le PIN cuisine (5678) ou admin (2468).',
      });
    }

    void logFiscalEvent(prisma, {
      businessId: user.businessId,
      eventType: 'OPERATOR_LOGIN',
      operatorId: user.id,
      entityType: 'User',
      entityId: user.id,
      payload: { method: 'pin', device, role: user.role },
    }).catch(err => console.error('[fiscal] OPERATOR_LOGIN:', err));

    res.json(issueTokens(user));
  } catch (error) {
    console.error('PIN login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/register
 * Register a new business with an admin user account.
 * @body {name, email, password, phone, businessName?}
 * @returns 201 {token, user, business}
 * @throws 400 if email already in use
 */
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { name, email, password, phone, businessName } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const business = await prisma.business.create({
      data: {
        name: businessName || name + "'s Restaurant",
        nameAr: '',
      },
    });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'ADMIN',
        businessId: business.id,
      },
    });

    const token = generateToken({
      userId: user.id,
      businessId: business.id,
      role: user.role,
      name: user.name,
    });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/refresh
 * Exchange a refresh token for a new access token and refresh token pair.
 * @body {refreshToken: string}
 * @returns {accessToken, refreshToken}
 * @throws 400 if refresh token missing
 * @throws 401 if refresh token invalid or user inactive
 */
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = verifyRefreshToken(refreshToken);
    const prisma: PrismaClient = req.app.get('prisma');

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { business: true },
    });
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found' });

    const payload = {
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
      name: user.name,
    };
    const newAccessToken = generateToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_REFRESH' });
  }
});

/**
 * GET /api/auth/me
 * Get the currently authenticated user's profile.
 * @headers Authorization: Bearer <token>
 * @returns {id, name, email, phone, role, businessId, isActive}
 * @throws 404 if user not found
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        isActive: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/profile
 * Update the authenticated user's name and phone.
 * @body {name?: string, phone?: string}
 * @returns {id, name, email, phone}
 */
router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name, phone },
    });
    res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/change-password
 * Change the authenticated user's password.
 * @body {currentPassword: string, newPassword: string}
 * @returns {message: string}
 * @throws 400 if current password is incorrect
 * @throws 404 if user not found
 */
router.put('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
