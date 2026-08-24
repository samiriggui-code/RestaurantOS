import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../types';
import { createOnlineOrder, type OnlineOrderBody } from '../lib/online-order';
import { getBusinessId } from '../lib/business';
import { createGuestCheckoutDraft, completeGuestCheckout } from '../lib/guest-checkout-draft';
import { INTERNAL_MENU_CATEGORY_FILTER } from '../lib/sync-lazpizza-catalog';
import { computeDeliveryQuote } from '../lib/delivery-quote';
import { centsToEuros } from '../lib/money';
import { parseBusinessSettings, getOpenStatus } from '../lib/business-settings';
import { computeAvailableTimeSlots } from '../lib/time-slots';
import { getFormulesFromSettings } from '../lib/sync-menu-formules';
import { enqueueConfirmedOrderPrints } from '../lib/enqueue-order-prints';
import { allocateOrderNumber } from '../lib/order-number';
import { randomBytes } from 'crypto';

const router = Router();

/**
 * GET /api/public/menu
 * Catalogue en ligne (catégories actives + articles disponibles).
 */
router.get('/menu', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = (req.query.businessId as string) || getBusinessId();

    const categories = await prisma.menuCategory.findMany({
      where: { businessId, isActive: true, ...INTERNAL_MENU_CATEGORY_FILTER },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isActive: true, isAvailable: true, slug: { not: '__snapshot__' } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const payload = categories
      .map(cat => ({
        id: cat.slug ?? cat.id,
        name: cat.name,
        shortLabel: cat.slug ?? cat.name,
        description: cat.description,
        items: cat.items.map(item => ({
          slug: item.slug ?? item.id,
          name: item.name,
          description: item.description ?? '',
          price: centsToEuros(item.price),
          image: item.image ?? '',
        })),
      }))
      .filter(c => c.items.length > 0);

    if (payload.length === 0) {
      return res.status(503).json({
        success: false,
        error: 'Catalogue indisponible — synchronisez le menu depuis l’administration',
      });
    }

    return res.json({ success: true, categories: payload });
  } catch (error) {
    console.error('[public/menu]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/public/delivery/quote?postalCode=&city=&pizzaSubtotal=
 */
router.get('/delivery/quote', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const postalCode = String(req.query.postalCode ?? '');
    const city = String(req.query.city ?? '');
    const pizzaSubtotal =
      parseFloat(String(req.query.pizzaSubtotal ?? req.query.subtotal ?? '0')) || 0;
    const businessId = (req.query.businessId as string) || getBusinessId();
    const quote = await computeDeliveryQuote(prisma, businessId, postalCode, city, pizzaSubtotal);
    return res.json({ success: true, ...quote });
  } catch (error) {
    console.error('[public/delivery/quote]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/public/hours — statut ouvert/fermé + fermetures exceptionnelles
 */
router.get('/hours', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = (req.query.businessId as string) || getBusinessId();
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    const settings = parseBusinessSettings(business?.settings);
    const openStatus = getOpenStatus(settings);
    return res.json({
      success: true,
      ...openStatus,
      hours: settings.hours ?? { open: 18, close: 22, daysOpen: 7 },
      exceptionalClosures: settings.exceptionalClosures ?? [],
    });
  } catch (error) {
    console.error('[public/hours]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/public/time-slots — créneaux click & collect disponibles
 */
router.get('/time-slots', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = (req.query.businessId as string) || getBusinessId();
    const result = await computeAvailableTimeSlots(prisma, businessId);
    return res.json({
      success: true,
      isOpen: result.isOpen,
      closedReason: result.closedReason,
      openStatus: result.openStatus,
      slots: result.slots,
      capacity: result.capacity,
    });
  } catch (error) {
    console.error('[public/time-slots]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/public/formules — menus pizza+boisson / dessert (Business.settings)
 */
router.get('/formules', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = (req.query.businessId as string) || getBusinessId();
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    const formules = getFormulesFromSettings(business?.settings);
    if (!formules) {
      return res
        .status(404)
        .json({ success: false, error: 'Formules non configurées — sync catalogue admin' });
    }
    return res.json({ success: true, formules });
  } catch (error) {
    console.error('[public/formules]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/public/orders
 * Commande invité — uniquement paiement au comptoir (pas de CB abandonnée en BDD).
 */
router.post('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const body = req.body as OnlineOrderBody;
    if (!body.checkout?.payAtCounter) {
      return res.status(400).json({
        success: false,
        error: 'Pour payer par carte, utilisez le paiement en ligne.',
      });
    }

    const result = await createOnlineOrder(prisma, body);

    if ('error' in result && result.error) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    const { order, trackingToken, orderNumber } = result;
    if (!order) {
      return res.status(500).json({ success: false, error: 'Commande non créée' });
    }

    const io: SocketIOServer = req.app.get('io');
    const full = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { menuItem: true } }, table: true },
    });
    if (full) {
      io.to(`business:${full.businessId}`).emit('order:onlinePending', full);
    }

    return res.status(201).json({
      success: true,
      token: trackingToken,
      orderId: order.id,
      orderNumber,
      status: order.status,
    });
  } catch (error) {
    console.error('[public/orders]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/public/kiosk-order — totem self-service (paiement comptoir)
 */
router.post('/kiosk-order', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const businessId = getBusinessId();
    const body = req.body as {
      mode?: 'emporter' | 'surplace';
      items?: { menuItemId?: string; slug?: string; quantity: number }[];
    };

    if (!body.items?.length) {
      return res.status(400).json({ success: false, error: 'Panier vide' });
    }

    let subtotal = 0;
    const orderItemsData: {
      menuItemId: string;
      quantity: number;
      price: number;
      notes: string | null;
      selectedModifiers: object;
      sortOrder: number;
    }[] = [];

    for (let i = 0; i < body.items.length; i++) {
      const line = body.items[i];
      const menuItem = line.menuItemId
        ? await prisma.menuItem.findUnique({ where: { id: line.menuItemId } })
        : line.slug
          ? await prisma.menuItem.findFirst({
              where: { slug: line.slug, category: { businessId } },
            })
          : null;
      if (!menuItem || !menuItem.isAvailable || !menuItem.isActive) {
        return res.status(400).json({ success: false, error: 'Article indisponible' });
      }
      const price = menuItem.discountPrice ?? menuItem.price;
      subtotal += price * line.quantity;
      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity: line.quantity,
        price,
        notes: null,
        selectedModifiers: {},
        sortOrder: i,
      });
    }

    const trackingToken = randomBytes(6).toString('hex');
    const orderType = body.mode === 'emporter' ? 'TAKEAWAY' : 'DINE_IN';

    const order = await prisma.$transaction(async tx => {
      const orderNumber = await allocateOrderNumber(tx, businessId);
      return tx.order.create({
        data: {
          businessId,
          orderNumber,
          customerName: 'Client totem',
          customerPhone: 'kiosk',
          type: orderType,
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          paymentMethod: 'COUNTER',
          subtotal,
          tax: 0,
          serviceCharge: 0,
          total: subtotal,
          notes: 'Commande totem kiosque',
          isOnlineOrder: false,
          channel: 'KIOSK',
          trackingToken,
          items: { create: orderItemsData },
        },
        include: { items: { include: { menuItem: true } }, table: true },
      });
    });

    io.to(`business:${businessId}`).emit('order:new', order);
    void enqueueConfirmedOrderPrints(prisma, io, businessId, order.id);

    return res.status(201).json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    console.error('[public/kiosk-order]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/public/orders/track-token/:token
 */
router.get('/orders/track-token/:token', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const order = await prisma.order.findFirst({
      where: { trackingToken: req.params.token, businessId: getBusinessId() },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        createdAt: true,
        customerName: true,
        type: true,
        driverLat: true,
        driverLng: true,
        driverLocationAt: true,
        deliveryHandoverCode: true,
        deliveryIssueReason: true,
        deliveryIssueNote: true,
        deliveryRating: true,
      },
    });
    if (!order) return res.status(404).json({ success: false, error: 'Commande introuvable' });

    if (
      order.type === 'DELIVERY' &&
      !order.deliveryHandoverCode &&
      order.paymentStatus === 'PAID' &&
      !['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(order.status)
    ) {
      const { generateDeliveryHandoverCode } = await import('../lib/delivery-handover');
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { deliveryHandoverCode: generateDeliveryHandoverCode() },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
          customerName: true,
          type: true,
          driverLat: true,
          driverLng: true,
          driverLocationAt: true,
          deliveryHandoverCode: true,
          deliveryIssueReason: true,
          deliveryIssueNote: true,
          deliveryRating: true,
        },
      });
      return res.json({ success: true, order: updated });
    }

    return res.json({ success: true, order });
  } catch (error) {
    console.error('[public/track-token]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/** POST /api/public/orders/track-token/:token/driver-location — position livreur (navigateur) */
router.post(
  '/orders/track-token/:token/driver-location',
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const businessId = getBusinessId();
      const { lat, lng } = req.body as { lat?: number; lng?: number };
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ success: false, error: 'lat/lng invalides' });
      }

      const existing = await prisma.order.findFirst({
        where: {
          trackingToken: req.params.token,
          businessId,
          type: 'DELIVERY',
          status: { in: ['READY', 'OUT_FOR_DELIVERY'] },
        },
      });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Livraison introuvable ou clôturée' });
      }

      const { resolveDriverUserId } = await import('../lib/driver-access');
      const { appendDriverTrail } = await import('../lib/driver-trail');
      const driverUserId = await resolveDriverUserId(req, prisma, businessId);

      if (existing.driverId && driverUserId && existing.driverId !== driverUserId) {
        return res.status(409).json({
          success: false,
          error: 'Cette livraison est déjà prise en charge par un autre livreur',
        });
      }

      const now = new Date();
      const trail = appendDriverTrail(existing.driverTrail, lat!, lng!, now);

      const order = await prisma.order.update({
        where: { id: existing.id },
        data: {
          driverLat: lat,
          driverLng: lng,
          driverLocationAt: now,
          driverTrail: trail,
          ...(driverUserId && !existing.driverId ? { driverId: driverUserId } : {}),
          ...(existing.status === 'READY' ? { status: 'OUT_FOR_DELIVERY' } : {}),
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          driver: { select: { id: true, name: true } },
        },
      });

      io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
      const { emitOrderTrackUpdate } = await import('../lib/order-track-events');
      emitOrderTrackUpdate(io, order);

      return res.json({
        success: true,
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          driverLat: order.driverLat,
          driverLng: order.driverLng,
          driverLocationAt: order.driverLocationAt,
          driverId: order.driverId,
          driverName: order.driver?.name ?? null,
        },
      });
    } catch (error) {
      console.error('[public/driver-location]', error);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  }
);

/** GET /api/public/orders/track-token/:token/driver — infos livreur (sans le code client) */
router.get('/orders/track-token/:token/driver', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const order = await prisma.order.findFirst({
      where: {
        trackingToken: req.params.token,
        businessId: getBusinessId(),
        type: 'DELIVERY',
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerName: true,
        customerPhone: true,
        deliveryAddress: true,
        deliveryPostalCode: true,
        deliveryCity: true,
        deliveryLat: true,
        deliveryLng: true,
        notes: true,
        total: true,
        driverLat: true,
        driverLng: true,
      },
    });
    if (!order) return res.status(404).json({ success: false, error: 'Livraison introuvable' });
    return res.json({ success: true, order });
  } catch (error) {
    console.error('[public/driver]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/** POST /api/public/orders/track-token/:token/driver-confirm — code client → livrée */
router.post(
  '/orders/track-token/:token/driver-confirm',
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const { code } = req.body as { code?: string };
      if (!code?.trim()) {
        return res.status(400).json({ success: false, error: 'Code requis' });
      }

      const { isValidHandoverCode } = await import('../lib/delivery-handover');
      const { resolveDriverUserId } = await import('../lib/driver-access');
      const existing = await prisma.order.findFirst({
        where: {
          trackingToken: req.params.token,
          businessId: getBusinessId(),
          type: 'DELIVERY',
          status: 'OUT_FOR_DELIVERY',
        },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: 'Livraison introuvable ou déjà clôturée' });
      }
      if (!isValidHandoverCode(code, existing.deliveryHandoverCode)) {
        return res
          .status(400)
          .json({ success: false, error: 'Code incorrect — demandez le code au client' });
      }

      const driverUserId = await resolveDriverUserId(req, prisma, getBusinessId());

      const order = await prisma.order.update({
        where: { id: existing.id },
        data: {
          status: 'DELIVERED',
          ...(driverUserId && !existing.driverId ? { driverId: driverUserId } : {}),
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          driver: { select: { id: true, name: true } },
        },
      });

      const { notifyOrderStatusChange } = await import('../lib/notifications');
      void notifyOrderStatusChange(order).catch(err =>
        console.error('[notifications] delivered:', err)
      );

      io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
      const { emitOrderTrackUpdate } = await import('../lib/order-track-events');
      emitOrderTrackUpdate(io, order);

      return res.json({
        success: true,
        order: { orderNumber: order.orderNumber, status: order.status },
      });
    } catch (error) {
      console.error('[public/driver-confirm]', error);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  }
);

/** POST /api/public/orders/track-token/:token/driver-issue — retour pizzeria avec problème */
router.post('/orders/track-token/:token/driver-issue', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const { reason, note } = req.body as { reason?: string; note?: string };
    const { DELIVERY_ISSUE_REASONS } = await import('../lib/delivery-handover');
    const validReasons = DELIVERY_ISSUE_REASONS.map(r => r.value);
    if (!reason || !validReasons.includes(reason as (typeof validReasons)[number])) {
      return res.status(400).json({ success: false, error: 'Motif requis' });
    }

    const existing = await prisma.order.findFirst({
      where: {
        trackingToken: req.params.token,
        businessId: getBusinessId(),
        type: 'DELIVERY',
        status: 'OUT_FOR_DELIVERY',
      },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: 'Livraison introuvable ou déjà clôturée' });
    }

    const order = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: 'DELIVERY_ISSUE',
        deliveryIssueReason: reason,
        deliveryIssueNote: note?.trim() || null,
        deliveryIssueAt: new Date(),
        driverLat: null,
        driverLng: null,
        driverLocationAt: null,
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    });

    io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
    const { emitOrderTrackUpdate } = await import('../lib/order-track-events');
    emitOrderTrackUpdate(io, order);

    return res.json({
      success: true,
      order: { orderNumber: order.orderNumber, status: order.status },
    });
  } catch (error) {
    console.error('[public/driver-issue]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/** POST /api/public/orders/track-token/:token/feedback — avis client après livraison */
router.post('/orders/track-token/:token/feedback', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { rating, feedback } = req.body as { rating?: number; feedback?: string };
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return res.status(400).json({ success: false, error: 'Note 1 à 5 requise' });
    }

    const existing = await prisma.order.findFirst({
      where: {
        trackingToken: req.params.token,
        businessId: getBusinessId(),
        status: { in: ['DELIVERED', 'COMPLETED'] },
      },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Commande non éligible au feedback' });
    }

    await prisma.order.update({
      where: { id: existing.id },
      data: {
        deliveryRating: r,
        deliveryFeedback: feedback?.trim()?.slice(0, 500) || null,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[public/feedback]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/public/payments/prepare
 * Valide le panier + crée un checkout SumUp — aucune commande en BDD.
 */
router.post('/payments/prepare', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const result = await createGuestCheckoutDraft(prisma, req.body as OnlineOrderBody);
    if ('error' in result) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      draftId: result.draftId,
      checkoutId: result.checkoutId,
    });
  } catch (error) {
    console.error('[public/payments/prepare]', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur préparation paiement',
    });
  }
});

/**
 * POST /api/public/payments/complete
 * Après paiement SumUp réussi (re-vérifié via l'API) — crée la commande et renvoie le token suivi.
 */
router.post('/payments/complete', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const { draftId, checkoutId } = req.body as {
      draftId?: string;
      checkoutId?: string;
    };
    if (!draftId?.trim()) {
      return res.status(400).json({ success: false, error: 'Session paiement manquante' });
    }

    const result = await completeGuestCheckout(prisma, io, draftId.trim(), checkoutId?.trim());
    if ('error' in result && result.error) {
      const status = result.status ?? 400;
      return res.status(status).json({
        success: false,
        error: result.error,
        pending: 'pending' in result ? result.pending : undefined,
      });
    }

    return res.json({
      success: true,
      token: result.token,
      orderNumber: result.orderNumber,
      status: 'CONFIRMED',
    });
  } catch (error) {
    console.error('[public/payments/complete]', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur confirmation paiement',
    });
  }
});

/** GET /api/public/delivery/stops — tournée livreur optimisée */
router.get('/delivery/stops', async (req: AuthRequest, res: Response) => {
  try {
    const { isDriverAccessAuthorized } = await import('../lib/driver-access');
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = getBusinessId();
    if (!(await isDriverAccessAuthorized(req, prisma, businessId))) {
      return res.status(401).json({ success: false, error: 'Accès livreur refusé' });
    }

    const driverLat = parseFloat(String(req.query.driverLat ?? ''));
    const driverLng = parseFloat(String(req.query.driverLng ?? ''));

    const { fetchActiveDeliveryStops, PIZZERIA_DEPOT, sumRouteKm } =
      await import('../lib/delivery-stops');
    const { resolveDriverUserId } = await import('../lib/driver-access');
    const driverUserId = await resolveDriverUserId(req, prisma, businessId);

    const origin =
      Number.isFinite(driverLat) && Number.isFinite(driverLng)
        ? { lat: driverLat, lng: driverLng }
        : PIZZERIA_DEPOT;

    const stops = await fetchActiveDeliveryStops(prisma, businessId, origin, driverUserId);

    return res.json({
      success: true,
      depot: PIZZERIA_DEPOT,
      origin,
      originFromGps: Number.isFinite(driverLat) && Number.isFinite(driverLng),
      routeTotalKm: sumRouteKm(stops),
      stops,
      totalStops: stops.length,
      enRoute: stops.filter(s => s.status === 'OUT_FOR_DELIVERY').length,
      ready: stops.filter(s => s.status === 'READY').length,
    });
  } catch (error) {
    console.error('[public/delivery/stops]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/** GET /api/public/delivery/day-recap — livraisons du jour (livreur) */
router.get('/delivery/day-recap', async (req: AuthRequest, res: Response) => {
  try {
    const { isDriverAccessAuthorized } = await import('../lib/driver-access');
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = getBusinessId();
    if (!(await isDriverAccessAuthorized(req, prisma, businessId))) {
      return res.status(401).json({ success: false, error: 'Accès livreur refusé' });
    }
    const { fetchDriverDayRecap } = await import('../lib/delivery-day-recap');
    const recap = await fetchDriverDayRecap(prisma, getBusinessId());
    return res.json({ success: true, recap });
  } catch (error) {
    console.error('[public/delivery/day-recap]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/** GET /api/public/delivery/drivers — livreurs du jour (sélection identité) */
router.get('/delivery/drivers', async (req: AuthRequest, res: Response) => {
  try {
    const { isDriverAccessAuthorized, fetchDriversOnDuty } = await import('../lib/driver-access');
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = getBusinessId();
    if (!(await isDriverAccessAuthorized(req, prisma, businessId))) {
      return res.status(401).json({ success: false, error: 'Accès livreur refusé' });
    }
    const drivers = await fetchDriversOnDuty(prisma, businessId);
    return res.json({ success: true, drivers });
  } catch (error) {
    console.error('[public/delivery/drivers]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/** POST /api/public/delivery/verify-pin */
router.post('/delivery/verify-pin', async (req: AuthRequest, res: Response) => {
  try {
    const { pin } = req.body as { pin?: string };
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = getBusinessId();
    const { resolveDriverFromPin } = await import('../lib/driver-access');
    const check = await resolveDriverFromPin(prisma, businessId, pin ?? '');
    if (!check.ok) {
      return res.status(401).json({ success: false, error: 'PIN incorrect' });
    }
    return res.json({
      success: true,
      driverUserId: check.driverUserId ?? null,
    });
  } catch (error) {
    console.error('[public/delivery/verify-pin]', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
