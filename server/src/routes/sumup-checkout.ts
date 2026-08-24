import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { reconcileGuestCheckoutFromWebhook } from '../lib/guest-checkout-draft';

const router = Router();

/**
 * POST /api/payments/sumup-checkout/webhook — cible du `return_url` SumUp.
 * Pas de signature à vérifier (SumUp n'en fournit pas) : le payload
 * {event_type, id} n'est qu'un signal pour re-vérifier via GET /checkouts/{id}.
 * Toujours répondre 2xx (sinon SumUp retente à 1min/5min/20min/2h).
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event_type: eventType, id } = req.body as { event_type?: string; id?: string };

    if (eventType !== 'CHECKOUT_STATUS_CHANGED' || !id) {
      return res.status(200).json({ received: true });
    }

    const prisma: PrismaClient = req.app.get('prisma');
    const io = req.app.get('io') as SocketIOServer;
    await reconcileGuestCheckoutFromWebhook(prisma, io, id);

    res.status(200).json({ received: true });
  } catch (error) {
    // reconcileGuestCheckoutFromWebhook renvoie null (pas d'exception) pour les cas normaux
    // (draft introuvable, pas encore payé, déjà traité) — arriver ici veut dire une vraie
    // erreur transitoire (réseau SumUp, DB) : 500 pour que SumUp retente (1min/5min/20min/2h).
    console.error('[sumup-checkout webhook]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
