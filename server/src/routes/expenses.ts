import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { Server as SocketIOServer } from 'socket.io'
import { authenticate, requireRole } from '../middleware/auth'
import { AuthRequest } from '../types'
import { emitAdminLive } from '../lib/admin-live-events'

const router = Router()

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { from, to } = req.query
    const where: { businessId: string; date?: { gte?: Date; lte?: Date } } = {
      businessId: req.user!.businessId,
    }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(String(from))
      if (to) where.date.lte = new Date(String(to))
    }
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500,
    })
    res.json(expenses)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const expense = await prisma.expense.create({
      data: {
        businessId: req.user!.businessId,
        description: req.body.description,
        amount: req.body.amount,
        category: req.body.category || 'Divers',
        notes: req.body.notes || null,
        date: req.body.date || new Date().toISOString(),
      },
    })
    const io: SocketIOServer = req.app.get('io')
    emitAdminLive(io, req.user!.businessId, {
      domain: 'expenses',
      action: 'create',
      label: 'Dépense',
      detail: expense.description,
    })
    res.status(201).json(expense)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Dépense introuvable' })
    const expense = await prisma.expense.update({
      where: { id: existing.id },
      data: {
        description: req.body.description,
        amount: req.body.amount,
        category: req.body.category,
        notes: req.body.notes,
        date: req.body.date,
      },
    })
    const io: SocketIOServer = req.app.get('io')
    emitAdminLive(io, req.user!.businessId, {
      domain: 'expenses',
      action: 'update',
      label: 'Dépense',
      detail: expense.description,
    })
    res.json(expense)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Dépense introuvable' })
    await prisma.expense.delete({ where: { id: existing.id } })
    const io: SocketIOServer = req.app.get('io')
    emitAdminLive(io, req.user!.businessId, {
      domain: 'expenses',
      action: 'delete',
      label: 'Dépense',
      detail: existing.description,
    })
    res.json({ message: 'Expense deleted' })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
