import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole } from '../middleware/auth'
import { AuthRequest } from '../types'
import {
  creditLoyaltyForPaidOrder,
  loyaltyFreePizzasAvailable,
  loyaltyPointsForOrder,
  loyaltyPointsUntilNextFree,
  normalizeLoyaltyPhone,
  redeemLoyaltyFreePizza,
} from '../lib/loyalty-order'

const router = Router()

function programPayload(program: {
  id: string
  businessId: string
  name: string
  pointsPerDinar: number
  dinarPerPoint: number
  pointsForFreePizza: number
  minPointsRedeem: number
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}) {
  const pointsForFreePizza =
    program.pointsForFreePizza > 0 ? program.pointsForFreePizza : program.minPointsRedeem
  return {
    ...program,
    pointsForFreePizza,
    minPointsRedeem: pointsForFreePizza,
    rewardLabel: '1 pizza offerte',
  }
}

router.get('/program', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    let program = await prisma.loyaltyProgram.findFirst({
      where: { businessId: req.user!.businessId },
    })
    if (!program) {
      program = await prisma.loyaltyProgram.create({
        data: { businessId: req.user!.businessId },
      })
    }
    res.json(programPayload(program))
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/program', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const { name, pointsPerDinar, pointsForFreePizza, minPointsRedeem, enabled } = req.body

    const pizzaThreshold = Number(pointsForFreePizza ?? minPointsRedeem ?? 100)

    const existing = await prisma.loyaltyProgram.findFirst({ where: { businessId } })
    const data = {
      name,
      pointsPerDinar: Number(pointsPerDinar) || 1,
      dinarPerPoint: 0,
      pointsForFreePizza: Math.max(1, pizzaThreshold),
      minPointsRedeem: Math.max(1, pizzaThreshold),
      enabled: enabled !== false,
    }

    const program = existing
      ? await prisma.loyaltyProgram.update({ where: { id: existing.id }, data })
      : await prisma.loyaltyProgram.create({ data: { businessId, ...data } })
    res.json(programPayload(program))
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/customers/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { phone } = req.query
    if (!phone) return res.status(400).json({ error: 'Phone required' })

    const normalized = normalizeLoyaltyPhone(String(phone))
    const customer = await prisma.loyaltyCustomer.findFirst({
      where: {
        businessId: req.user!.businessId,
        phone: normalized,
      },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        program: { select: { pointsForFreePizza: true, minPointsRedeem: true } },
      },
    })

    if (!customer) {
      res.json(null)
      return
    }

    const threshold =
      customer.program.pointsForFreePizza > 0
        ? customer.program.pointsForFreePizza
        : customer.program.minPointsRedeem

    res.json({
      ...customer,
      freePizzasAvailable: loyaltyFreePizzasAvailable(customer.totalPoints, threshold),
      pointsUntilFreePizza: loyaltyPointsUntilNextFree(customer.totalPoints, threshold),
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/customers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { phone, name } = req.body
    if (!phone?.trim()) return res.status(400).json({ error: 'Téléphone requis' })

    const program = await prisma.loyaltyProgram.findFirst({
      where: { businessId: req.user!.businessId },
    })
    if (!program) return res.status(400).json({ error: 'Loyalty program not configured' })

    const normalized = normalizeLoyaltyPhone(phone)
    let customer = await prisma.loyaltyCustomer.findFirst({
      where: { businessId: req.user!.businessId, phone: normalized },
    })

    if (customer) {
      if (name) await prisma.loyaltyCustomer.update({ where: { id: customer.id }, data: { name } })
    } else {
      customer = await prisma.loyaltyCustomer.create({
        data: {
          businessId: req.user!.businessId,
          programId: program.id,
          phone: normalized,
          name: name?.trim() || null,
        },
      })
    }

    res.json(customer)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/points/add', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { customerId, points, orderId, description } = req.body
    const pts = Number(points)
    if (!customerId || !Number.isFinite(pts) || pts <= 0) {
      return res.status(400).json({ error: 'Client et points positifs requis' })
    }

    const customer = await prisma.loyaltyCustomer.findFirst({
      where: { id: customerId, businessId: req.user!.businessId },
    })
    if (!customer) return res.status(404).json({ error: 'Client introuvable' })

    const transaction = await prisma.loyaltyTransaction.create({
      data: {
        customerId,
        type: 'EARN',
        points: pts,
        referenceType: orderId ? 'ORDER' : 'MANUAL',
        referenceId: orderId || null,
        description: description || 'Points ajoutés (geste commercial)',
      },
    })

    await prisma.loyaltyCustomer.update({
      where: { id: customerId },
      data: {
        totalPoints: { increment: pts },
        lastVisit: new Date(),
      },
    })

    res.json(transaction)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Échange les points contre 1 pizza offerte (pas de réduction €). */
router.post('/points/redeem-pizza', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { customerId, note } = req.body
    if (!customerId) return res.status(400).json({ error: 'Client requis' })

    const result = await redeemLoyaltyFreePizza(
      prisma,
      req.user!.businessId,
      customerId,
      note?.trim() || undefined,
    )
    if (!result.success) return res.status(400).json({ error: result.error })
    res.json({
      success: true,
      remainingPoints: result.remainingPoints,
      message: '1 pizza offerte — ajoutez la pizza au panier POS à 0 €',
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** @deprecated Utiliser POST /points/redeem-pizza */
router.post('/points/redeem', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { customerId, description, note } = req.body
    if (!customerId) return res.status(400).json({ error: 'Client requis' })

    const result = await redeemLoyaltyFreePizza(
      prisma,
      req.user!.businessId,
      customerId,
      (note ?? description)?.trim() || undefined,
    )
    if (!result.success) return res.status(400).json({ error: result.error })
    res.json({
      success: true,
      remainingPoints: result.remainingPoints,
      message: '1 pizza offerte — ajoutez la pizza au panier POS à 0 €',
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/customers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const program = await prisma.loyaltyProgram.findFirst({
      where: { businessId: req.user!.businessId },
    })
    const threshold = program
      ? program.pointsForFreePizza > 0
        ? program.pointsForFreePizza
        : program.minPointsRedeem
      : 100

    const limit = Math.min(parseInt(String(req.query.limit ?? '200'), 10) || 200, 500)

    const customers = await prisma.loyaltyCustomer.findMany({
      where: { businessId: req.user!.businessId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { totalPoints: 'desc' },
      take: limit,
    })

    res.json(
      customers.map((c) => ({
        ...c,
        freePizzasAvailable: loyaltyFreePizzasAvailable(c.totalPoints, threshold),
      })),
    )
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Aperçu points pour un montant (POS / checkout). */
router.get('/preview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const totalCents = parseInt(String(req.query.totalCents ?? '0'), 10)
    const program = await prisma.loyaltyProgram.findFirst({
      where: { businessId: req.user!.businessId, enabled: true },
    })
    if (!program) return res.json({ enabled: false })

    const threshold =
      program.pointsForFreePizza > 0 ? program.pointsForFreePizza : program.minPointsRedeem
    const earned = loyaltyPointsForOrder(totalCents, program.pointsPerDinar)

    res.json({
      enabled: true,
      pointsEarned: earned,
      pointsForFreePizza: threshold,
      rewardLabel: '1 pizza offerte',
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
