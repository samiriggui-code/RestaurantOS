import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, AuthPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}
if (!REFRESH_SECRET) {
  console.error('FATAL: REFRESH_SECRET environment variable is not set');
  process.exit(1);
}

/**
 * Optional JWT — attaches req.user when Bearer token is valid; never blocks the request.
 */
export const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    /* ignore invalid token — public routes may still proceed */
  }
  next();
};

/**
 * Attaches decoded user payload to `req.user` on success.
 * Returns 401 with error message on failure.
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};

/**
 * Middleware factory that restricts access to specified roles.
 * Must be used after `authenticate` middleware.
 * Returns 403 if user role is not in the allowed list.
 */
export const requireRole = (
  ...roles: string[]
): ((req: AuthRequest, res: Response, next: NextFunction) => Response | void) => {
  return (req: AuthRequest, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

/**
 * Generate a JWT access token for the given payload.
 * Token expiry is controlled by JWT_EXPIRES_IN env var (default: 1d).
 */
export const generateToken = (payload: AuthPayload): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
};

/**
 * Generate a JWT refresh token (7-day expiry) for the given payload.
 */
export const generateRefreshToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
};

/**
 * Verify and decode a refresh token string.
 * Throws if the token is invalid or expired.
 */
export const verifyRefreshToken = (token: string): AuthPayload => {
  return jwt.verify(token, REFRESH_SECRET) as AuthPayload;
};
