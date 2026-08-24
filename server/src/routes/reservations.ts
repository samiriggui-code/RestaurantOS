import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { date, status } = req.query;
    const where: Record<string, unknown> = { businessId: req.user!.businessId };

    if (date) {
      const d = new Date(date as string);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.dateTime = { gte: start, lte: end };
    }
    if (status) where.status = status as string;

    const reservations = await prisma.reservation.findMany({
      where,
      include: { table: true },
      orderBy: { dateTime: 'asc' },
    });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'WAITER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { customerName, customerPhone, guests, tableId, dateTime, notes } = req.body;

      const reservation = await prisma.reservation.create({
        data: {
          businessId: req.user!.businessId,
          customerName,
          customerPhone,
          guests,
          tableId,
          dateTime: new Date(dateTime),
          notes,
        },
        include: { table: true },
      });

      if (tableId) {
        await prisma.table.update({
          where: { id: tableId },
          data: { status: 'RESERVED' },
        });
      }

      res.status(201).json(reservation);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data: req.body,
      include: { table: true },
    });
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { status } = req.body;
    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data: { status },
    });

    if (status === 'SEATED' || status === 'CANCELLED' || status === 'NO_SHOW') {
      if (reservation.tableId) {
        await prisma.table.update({
          where: { id: reservation.tableId },
          data: { status: status === 'SEATED' ? 'OCCUPIED' : 'AVAILABLE' },
        });
      }
    }

    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
