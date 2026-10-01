import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { setupSocketHandlers } from './sockets';
import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import orderRoutes from './routes/orders';
import tableRoutes from './routes/tables';
import wifiRoutes from './routes/wifi';
import employeeRoutes from './routes/employees';
import reportRoutes from './routes/reports';
import reservationRoutes from './routes/reservations';
import settingsRoutes from './routes/settings';
import expenseRoutes from './routes/expenses';
import licenseRoutes from './routes/licenses';
import backupRoutes from './routes/backups';
import invoiceRoutes from './routes/invoices';
import pennylaneRoutes from './routes/pennylane';
import sumupRoutes from './routes/sumup';
import sumupCheckoutRoutes from './routes/sumup-checkout';
import printJobRoutes from './routes/print-jobs';
import posRoutes from './routes/pos';
import publicRoutes from './routes/public';
import marketplaceWebhooks from './routes/marketplace-webhooks';
import deliveryRoutes from './routes/delivery';
import driverRoutes from './routes/driver';
import devicesRoutes from './routes/devices';
import stockRoutes from './routes/stock';
import loyaltyRoutes from './routes/loyalty';
import fiscalRoutes from './routes/fiscal';
import { requireModule } from './lib/modules';
import { apiLimiter, authLimiter, waiterCallLimiter } from './middleware/rateLimiter';
import { initSentry, setupSentryErrorHandler, isSentryEnabled } from './sentry';
import { validateEnv } from './check-env';

dotenv.config();
if (process.env.NODE_ENV !== 'test') {
  validateEnv();
}

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';

const STATIC_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function isLanDevOrigin(origin: string): boolean {
  if (isProduction) return false;
  try {
    const { hostname, port } = new URL(origin);
    const okPort = !port || port === '3000' || port === '5173';
    if (!okPort) return false;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
}

function allowCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (!origin || STATIC_ORIGINS.includes(origin) || isLanDevOrigin(origin)) {
    callback(null, true);
    return;
  }
  if (!isProduction) {
    console.warn(`[cors] Origin refusée : ${origin} — ajoutez-la à FRONTEND_URL si besoin`);
  }
  callback(new Error(`CORS blocked: ${origin}`));
}

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowCorsOrigin,
    methods: ['GET', 'POST'],
  },
});

// Trust proxy uniquement derrière Traefik/Caddy (évite spoof X-Forwarded-For si exposé nu)
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// Compression
app.use(compression());

// Security headers (must be first)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — localhost + IP LAN tablette/SUNMI en dev
app.use(
  cors({
    origin: allowCorsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
);

// Remove Express fingerprint
app.disable('x-powered-by');

// Initialize Sentry error monitoring
initSentry(app);

// Marketplaces — conserve le corps brut pour signature HMAC
const marketplaceWebhookJson = express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
});
app.use('/api/public/webhooks', marketplaceWebhookJson, marketplaceWebhooks);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Parameter pollution protection
app.use(hpp());

// XSS : ne pas muter req.body (casse mdp/emails). Échapper à l'affichage / HTML emails uniquement.

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/pin', authLimiter);
app.use('/api/orders/call-waiter', waiterCallLimiter);

// Serve uploaded images
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
app.use('/api/uploads', express.static(uploadsDir));

// Make prisma and io available to routes
app.set('prisma', prisma);
app.set('io', io);

// Routes publiques (commande invité — toujours actives)
app.use('/api/public', publicRoutes);

// Routes — modules hors périmètre V1 masqués (CDC §6.4)
app.use('/api/auth', authRoutes);
app.use('/api/menu', requireModule('menu'), menuRoutes);
app.use('/api/orders', requireModule('orders'), orderRoutes);
app.use('/api/print-jobs', requireModule('kitchen'), printJobRoutes);
app.use('/api/pos', requireModule('pos'), posRoutes);
app.use('/api/tables', requireModule('tables'), tableRoutes);
app.use('/api/wifi', requireModule('wifi'), wifiRoutes);
app.use('/api/employees', requireModule('users'), employeeRoutes);
app.use('/api/reports', requireModule('reports'), reportRoutes);
app.use('/api/reservations', requireModule('reservations'), reservationRoutes);
app.use('/api/settings', requireModule('settings'), settingsRoutes);
app.use('/api/devices', requireModule('settings'), devicesRoutes);
app.use('/api/delivery', requireModule('settings'), deliveryRoutes);
app.use('/api/driver', requireModule('orders'), driverRoutes);
app.use('/api/stock', requireModule('expenses'), stockRoutes);
app.use('/api/expenses', requireModule('expenses'), expenseRoutes);
app.use('/api/licenses', requireModule('licenses'), licenseRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/pennylane', pennylaneRoutes);
app.use('/api/payments/sumup', sumupRoutes);
app.use('/api/payments/sumup-checkout', sumupCheckoutRoutes);
app.use('/api/loyalty', requireModule('loyalty'), loyaltyRoutes);
app.use('/api/fiscal', fiscalRoutes);

// Swagger documentation
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'RestaurantOS API Docs',
  })
);
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Racine : l'API n'est pas un site web — évite la confusion "Cannot GET /"
app.get('/', (_req, res) => {
  res.json({
    service: 'RestaurantOS API',
    status: 'OK',
    docs: '/api/docs',
    health: '/api/health',
    hint: 'Interface web → http://localhost:3000 (Next.js). Ne pas ouvrir :3001 dans le navigateur pour le site.',
  });
});

// Sentry test endpoint (development only, when SENTRY_DSN is set)
if (!isProduction && isSentryEnabled()) {
  app.get('/api/sentry-test', () => {
    throw new Error('Sentry test error — this is intentional');
  });
}

// 404 handler
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Sentry error handler (must be before generic error handler)
setupSentryErrorHandler(app);

// Secure error handler (no stack traces in production)
app.use(
  (
    err: { status?: number; message?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
      error: isProduction ? 'Internal server error' : err.message,
    });
  }
);

setupSocketHandlers(io, prisma);

const PORT = Number(process.env.PORT || 3001);
httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} déjà utilisé. Lancez : npm run dev:stop`);
    process.exit(1);
  }
  throw err;
});
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Express → http://localhost:${PORT}`);
  console.log(`   (Landing/CRM/KDS/POS → http://localhost:3000)`);
  if (process.env.NODE_ENV !== 'test') {
    void import('./lib/sumup-settings').then(({ loadSumupCredentialsFromDb }) =>
      loadSumupCredentialsFromDb(prisma).catch(err =>
        console.error('[sumup] chargement credentials BDD:', err)
      )
    );
    void import('./lib/fiscal/startup').then(
      ({ ensureFiscalChainHealthy, logFiscalSoftwareStart }) =>
        ensureFiscalChainHealthy(prisma).then(() => logFiscalSoftwareStart(prisma))
    );
    void import('./lib/fiscal/scheduler').then(({ startFiscalScheduler }) =>
      startFiscalScheduler(prisma)
    );
    void import('./lib/reporting-sync-scheduler').then(({ startReportingSyncScheduler }) =>
      startReportingSyncScheduler(prisma)
    );
  }
});

// Filet de sécurité : une promesse de tâche de fond rejetée (impression, email, sync…) ne doit
// jamais arrêter l'API — Node termine le process par défaut sur un rejet non géré.
process.on('unhandledRejection', reason => {
  console.error('[unhandledRejection]', reason);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  httpServer.close();
  process.exit(0);
});
