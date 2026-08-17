import { createHash } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import { appendFiscalEvent } from './events'

function archiveDir(): string {
  return process.env.FISCAL_ARCHIVE_DIR ?? path.join(process.cwd(), 'data', 'fiscal-archives')
}

function yearBounds(fiscalYear: number): { start: Date; end: Date } {
  return {
    start: new Date(`${fiscalYear}-01-01T00:00:00.000Z`),
    end: new Date(`${fiscalYear}-12-31T23:59:59.999Z`),
  }
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

export type FiscalYearExport = {
  schemaVersion: 1
  businessId: string
  fiscalYear: number
  exportedAt: string
  softwareVersion: string
  sequence: {
    nextTicketNo: number
    grandTotalCents: string
    commissionedAt: string
  } | null
  tickets: unknown[]
  events: unknown[]
  closures: unknown[]
  archives: unknown[]
}

/** Export figé d'un exercice — une seule archive par année (immuable). */
export async function exportFiscalYearArchive(
  prisma: PrismaClient,
  businessId: string,
  fiscalYear: number,
  exportedById?: string | null,
) {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
    throw new Error('Exercice fiscal invalide')
  }

  const existing = await prisma.fiscalArchive.findUnique({
    where: { businessId_fiscalYear: { businessId, fiscalYear } },
  })
  if (existing) {
    const err = new Error('Archive déjà exportée pour cet exercice') as Error & { code?: string }
    err.code = 'ARCHIVE_EXISTS'
    throw err
  }

  const { start, end } = yearBounds(fiscalYear)
  const [tickets, events, closures, archives, seq, business] = await Promise.all([
    prisma.fiscalTicket.findMany({
      where: { businessId, issuedAt: { gte: start, lte: end } },
      orderBy: { serialNumber: 'asc' },
    }),
    prisma.fiscalEvent.findMany({
      where: { businessId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.fiscalClosure.findMany({
      where: {
        businessId,
        closedAt: { gte: start, lte: end },
      },
      orderBy: { closedAt: 'asc' },
    }),
    prisma.fiscalArchive.findMany({
      where: { businessId, fiscalYear },
    }),
    prisma.fiscalSequence.findUnique({ where: { businessId } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
  ])

  const payload: FiscalYearExport = {
    schemaVersion: 1,
    businessId,
    fiscalYear,
    exportedAt: new Date().toISOString(),
    softwareVersion: process.env.FISCAL_SOFTWARE_VERSION ?? '1.0.0',
    sequence: seq
      ? {
          nextTicketNo: seq.nextTicketNo,
          grandTotalCents: seq.grandTotalCents.toString(),
          commissionedAt: seq.commissionedAt.toISOString(),
        }
      : null,
    tickets,
    events,
    closures,
    archives,
  }

  const canonical = JSON.stringify(payload)
  const contentHash = sha256(canonical)

  const relPath = path.join(businessId, `${fiscalYear}.json`)
  const absPath = path.join(archiveDir(), relPath)
  await mkdir(path.dirname(absPath), { recursive: true })
  await writeFile(absPath, canonical, 'utf8')

  const record = await prisma.$transaction(async (tx) => {
    const archive = await tx.fiscalArchive.create({
      data: {
        businessId,
        fiscalYear,
        storagePath: relPath.replace(/\\/g, '/'),
        contentHash,
        exportedById: exportedById ?? null,
      },
    })

    await appendFiscalEvent(tx, {
      businessId,
      eventType: 'ARCHIVE_YEARLY',
      operatorId: exportedById,
      entityType: 'FiscalArchive',
      entityId: archive.id,
      payload: { fiscalYear, contentHash, ticketCount: tickets.length },
    })

    return archive
  })

  return { archive: record, businessName: business?.name ?? 'Pizzeria', absolutePath: absPath }
}

export function resolveArchiveAbsolutePath(storagePath: string): string {
  return path.join(archiveDir(), storagePath)
}
