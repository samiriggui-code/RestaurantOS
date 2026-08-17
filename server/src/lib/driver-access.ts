import type { PrismaClient } from '@prisma/client'
import type { AuthRequest } from '../types'
import jwt from 'jsonwebtoken'
import { getBusinessId } from './business'
import { parseBusinessSettings } from './business-settings'
import { canAccessDriver } from './roles'
import { parsePlanningMeta } from './seed-pizzeria-staff'

const DEFAULT_DRIVER_PIN = '2580'

/** @deprecated Utiliser resolveDriverAccessPin — conservé pour compat tests. */
export function getDriverAccessPin(): string {
  return getDriverAccessPinFromEnv()
}

/**
 * PIN livreur — priorité :
 * 1. `Business.settings.driverAccessPin` (modifiable admin)
 * 2. `DRIVER_ACCESS_PIN` (env / Docker)
 * 3. défaut dev `2580`
 */
export function getDriverAccessPinFromEnv(): string {
  return process.env.DRIVER_ACCESS_PIN?.trim() || DEFAULT_DRIVER_PIN
}

export async function resolveDriverAccessPin(
  prisma: PrismaClient,
  businessId?: string,
): Promise<string> {
  const id = businessId ?? getBusinessId()
  const business = await prisma.business.findUnique({
    where: { id },
    select: { settings: true },
  })
  const fromDb = parseBusinessSettings(business?.settings).driverAccessPin?.trim()
  if (fromDb) return fromDb
  return getDriverAccessPinFromEnv()
}

/** PIN équipe partagé ou PIN personnel d'un livreur actif (ex. 3456 Lucas). */
export async function resolveDriverFromPin(
  prisma: PrismaClient,
  businessId: string,
  pin: string,
): Promise<{ ok: true; driverUserId?: string } | { ok: false }> {
  const trimmed = pin.trim()
  if (!trimmed) return { ok: false }

  const shared = await resolveDriverAccessPin(prisma, businessId)
  if (trimmed === shared) return { ok: true }

  const onDuty = await fetchDriversOnDuty(prisma, businessId)
  for (const d of onDuty) {
    const user = await prisma.user.findFirst({
      where: { id: d.id, businessId, isActive: true, role: 'DRIVER' },
      select: { pin: true },
    })
    if (user?.pin && user.pin === trimmed) {
      return { ok: true, driverUserId: d.id }
    }
  }

  const anyDriver = await prisma.user.findFirst({
    where: { businessId, role: 'DRIVER', isActive: true, pin: trimmed },
    select: { id: true },
  })
  if (anyDriver) return { ok: true, driverUserId: anyDriver.id }

  /** Gérant / manager — PIN personnel (ex. Atmane 2468) pour couvrir la livraison. */
  const opsLeader = await prisma.user.findFirst({
    where: {
      businessId,
      isActive: true,
      pin: trimmed,
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { id: true, role: true, planningMeta: true },
  })
  if (opsLeader && canActAsDriver(opsLeader)) {
    return { ok: true, driverUserId: opsLeader.id }
  }

  return { ok: false }
}

function canActAsDriver(user: { role: string; planningMeta?: unknown }): boolean {
  if (user.role === 'ADMIN') return true
  if (user.role === 'MANAGER') {
    return parsePlanningMeta(user.planningMeta).canSubstitute?.includes('DRIVER') ?? true
  }
  return canAccessDriver(user.role)
}

/** Accès livreur : PIN dédié (BDD ou env) ou session staff (Bearer). */
export async function isDriverAccessAuthorized(
  req: AuthRequest,
  prisma: PrismaClient,
  businessId?: string,
): Promise<boolean> {
  const bid = businessId ?? getBusinessId()
  const pin = req.headers['x-driver-pin']
  if (typeof pin === 'string') {
    const check = await resolveDriverFromPin(prisma, bid, pin)
    return check.ok
  }

  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    try {
      const token = auth.slice(7)
      const secret = process.env.JWT_SECRET
      if (!secret) return false
      jwt.verify(token, secret)
      return true
    } catch {
      return false
    }
  }
  return false
}

/** Identifie le livreur : JWT staff DRIVER/ADMIN ou en-tête x-driver-user-id (PIN partagé). */
export async function resolveDriverUserId(
  req: AuthRequest,
  prisma: PrismaClient,
  businessId?: string,
): Promise<string | null> {
  const bid = businessId ?? getBusinessId()

  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    try {
      const secret = process.env.JWT_SECRET
      if (!secret) return null
      const decoded = jwt.verify(auth.slice(7), secret) as {
        userId?: string
        role?: string
      }
      if (decoded.userId && canAccessDriver(decoded.role ?? '')) {
        const user = await prisma.user.findFirst({
          where: {
            id: decoded.userId,
            businessId: bid,
            isActive: true,
            role: { in: ['DRIVER', 'ADMIN', 'MANAGER'] },
          },
          select: { id: true },
        })
        return user?.id ?? null
      }
    } catch {
      /* ignore */
    }
  }

  const headerId = req.headers['x-driver-user-id']
  if (typeof headerId === 'string' && headerId.trim()) {
    const user = await prisma.user.findFirst({
      where: {
        id: headerId.trim(),
        businessId: bid,
        isActive: true,
        role: { in: ['DRIVER', 'ADMIN', 'MANAGER'] },
      },
      select: { id: true, role: true, planningMeta: true },
    })
    if (user && canActAsDriver(user)) return user.id
  }

  return null
}

/** Livreurs actifs — planifiés aujourd'hui (Paris) ou tous les DRIVER actifs. */
export async function fetchDriversOnDuty(
  prisma: PrismaClient,
  businessId: string,
): Promise<Array<{ id: string; name: string }>> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

  const scheduled = await prisma.employeeScheduleEntry.findMany({
    where: {
      businessId,
      date: today,
      OR: [
        { shift: { slug: 'livraison' } },
        { roleLabel: { contains: 'livre', mode: 'insensitive' } },
        { user: { role: 'DRIVER' } },
      ],
    },
    include: { user: { select: { id: true, name: true, isActive: true, role: true } } },
  })

  const fromSchedule = scheduled
    .map((e) => e.user)
    .filter((u) => u.isActive && u.role === 'DRIVER')
    .map((u) => ({ id: u.id, name: u.name }))

  if (fromSchedule.length > 0) {
    const seen = new Set<string>()
    const drivers = fromSchedule.filter((d) => {
      if (seen.has(d.id)) return false
      seen.add(d.id)
      return true
    })
    return mergeDriverSubstitutes(prisma, businessId, drivers)
  }

  const allDrivers = await prisma.user.findMany({
    where: { businessId, role: 'DRIVER', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return mergeDriverSubstitutes(prisma, businessId, allDrivers)
}

/** Gérants pouvant couvrir la livraison (Atmane, etc.). */
async function mergeDriverSubstitutes(
  prisma: PrismaClient,
  businessId: string,
  drivers: Array<{ id: string; name: string }>,
): Promise<Array<{ id: string; name: string }>> {
  const seen = new Set(drivers.map((d) => d.id))
  const leaders = await prisma.user.findMany({
    where: { businessId, isActive: true, role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true, name: true, role: true, planningMeta: true },
    orderBy: { name: 'asc' },
  })
  for (const leader of leaders) {
    if (seen.has(leader.id) || !canActAsDriver(leader)) continue
    drivers.push({ id: leader.id, name: leader.name })
    seen.add(leader.id)
  }
  return drivers.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}