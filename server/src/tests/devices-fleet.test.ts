import express from 'express';
import request from 'supertest';

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', businessId: 'b1', role: 'ADMIN' };
    next();
  },
}));
jest.mock('../lib/permissions', () => ({
  ...jest.requireActual('../lib/permissions'),
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../lib/driver-access', () => ({
  ...jest.requireActual('../lib/driver-access'),
  fetchDriversOnDuty: jest.fn().mockResolvedValue([]),
}));

const prisma = {
  business: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
  order: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
};
const io = { in: () => ({ fetchSockets: async () => [] }) };

async function fleetSurfaceIds(enabledModules: string): Promise<string[]> {
  jest.resetModules();
  process.env.ENABLED_MODULES = enabledModules;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const router = require('../routes/devices').default;
  const app = express();
  app.set('prisma', prisma);
  app.set('io', io);
  app.use('/api/devices', router);
  const res = await request(app).get('/api/devices/fleet');
  expect(res.status).toBe(200);
  return res.body.surfaces.map((s: { id: string }) => s.id);
}

describe('GET /api/devices/fleet — surfaces selon les modules actifs', () => {
  const previous = process.env.ENABLED_MODULES;
  afterAll(() => {
    if (previous === undefined) delete process.env.ENABLED_MODULES;
    else process.env.ENABLED_MODULES = previous;
  });

  it('version une-tablette (sans pos ni kiosk) : uniquement KDS et livreur', async () => {
    const ids = await fleetSurfaceIds('menu,kitchen,orders,reports,users,settings');
    expect(ids).toEqual(['kds', 'livreur']);
    expect(prisma.order.count).not.toHaveBeenCalled();
  });

  it('avec pos et kiosk : les cinq surfaces', async () => {
    const ids = await fleetSurfaceIds('menu,pos,kiosk,kitchen,orders,settings');
    expect(ids).toEqual(['pos-sunmi', 'pos-tablet', 'kds', 'livreur', 'kiosk']);
  });
});
