import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth'
import { AuthRequest } from '../types'

const router = Router()

const STALE_PRINT_JOB_MS = 30 * 60 * 1000

/**
 * GET /api/print-jobs — file d'impression récente (admin / POS).
 * ?device=1 : expire les PENDING > 30 min (évite réimpression au redeploy).
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const forDevice = req.query.device === '1' || req.query.device === 'true'
    const businessId = req.user!.businessId

    if (forDevice && status === 'PENDING') {
      const staleBefore = new Date(Date.now() - STALE_PRINT_JOB_MS)
      await prisma.printJob.updateMany({
        where: {
          businessId,
          status: 'PENDING',
          createdAt: { lt: staleBefore },
        },
        data: {
          status: 'FAILED',
          error: 'expired_backlog',
        },
      })
    }

    const sinceRaw = typeof req.query.since === 'string' ? req.query.since : undefined
    const since = sinceRaw ? new Date(sinceRaw) : undefined

    const jobs = await prisma.printJob.findMany({
      where: {
        businessId,
        ...(status ? { status } : {}),
        ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gte: since } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: { select: { orderNumber: true, status: true } },
      },
    })

    res.json(jobs)
  } catch (err) {
    console.error('List print jobs error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PATCH /api/print-jobs/:id
 * Met à jour le statut d'une impression (POS SUNMI après print réel).
 */
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { status, error } = req.body as { status?: string; error?: string }

    if (!status || !['PRINTED', 'FAILED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'status must be PRINTED, FAILED or PENDING' })
    }

    const existing = await prisma.printJob.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Print job not found' })

    const printJob = await prisma.printJob.update({
      where: { id: existing.id },
      data: {
        status,
        error: error ?? null,
        printedAt: status === 'PRINTED' ? new Date() : existing.printedAt,
      },
    })

    res.json(printJob)
  } catch (err) {
    console.error('Update print job error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
