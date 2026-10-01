import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../types';
import { ingestMarketplaceOrder, type MarketplaceOrderPayload } from '../lib/marketplace-order';
import {
  resolveMarketplaceWebhookSecret,
  verifyMarketplaceWebhookAuth,
  type MarketplaceProvider,
} from '../lib/marketplace-integrations';
import { parseBusinessSettings } from '../lib/business-settings';
import { getBusinessId } from '../lib/business';
const router = Router();

async function handleWebhook(
  provider: MarketplaceProvider,
  req: AuthRequest,
  res: Response
): Promise<Response> {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer | undefined = req.app.get('io');
    const rawBody =
      (req as AuthRequest & { rawBody?: string }).rawBody ??
      (typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(req.body ?? {}));

    const settings = parseBusinessSettings(
      (
        await prisma.business.findUnique({
          where: { id: getBusinessId() },
          select: { settings: true },
        })
      )?.settings
    );
    const secret = resolveMarketplaceWebhookSecret(settings, provider);
    const auth = verifyMarketplaceWebhookAuth(provider, rawBody, req.headers, secret);
    if (!auth.ok) {
      return res.status(401).json({ ok: false, error: auth.error });
    }

    const payload = (
      typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBody)
    ) as MarketplaceOrderPayload;

    const result = await ingestMarketplaceOrder(prisma, io, provider, payload);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error(`[webhooks/${provider}]`, error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
}

router.post('/deliveroo', (req, res) => void handleWebhook('deliveroo', req, res));
router.post('/ubereats', (req, res) => void handleWebhook('ubereats', req, res));

export default router;
