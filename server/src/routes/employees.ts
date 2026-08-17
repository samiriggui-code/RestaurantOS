import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { authenticate, requireRole } from '../middleware/auth'
import { AuthRequest } from '../types'
import { isValidStaffPin } from '../lib/pin'
import {
  analyzeSchedule,
  buildSmartSchedulePlan,
  datesBetween,
  PLANNING_ROLE_LABEL,
  resolveScheduleGuardrails,
} from '../lib/smart-schedule'
import { parseBusinessSettings } from '../lib/business-settings'
import {
  computeMinutesWorked,
  evaluateClockInWindow,
  serializeAttendance,
  todayDateKey,
  attendanceStatus,
} from '../lib/attendance'
import { substituteScheduleEntry } from '../lib/schedule-substitute'
import { parisTimeOnDay } from '../lib/fiscal/timezone'
import { copyScheduleWeeks } from '../lib/schedule-copy'
import { isPlanningParticipant } from '../lib/seed-pizzeria-staff'
import {
  buildMonthlyHoursSummary,
  monthlyHoursToCsv,
  parseMonthKey,
} from '../lib/attendance-monthly'

const router = Router()

async function punchEmployeeAttendance(
  prisma: PrismaClient,
  input: {
    businessId: string
    userId: string
    source: string
    forceOut?: boolean
  }
): Promise<{ data?: ReturnType<typeof serializeAttendance>; error?: string; status: number }> {
  const date = todayDateKey()
  const now = new Date()
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: input.userId, date } },
  })

  if (input.forceOut) {
    if (!existing || existing.clockOut) {
      return { error: 'Aucun pointage entrée actif aujourd\'hui', status: 404 }
    }
    const clockOut = now
    const minutesWorked = computeMinutesWorked(existing.clockIn, clockOut)
    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: { clockOut, minutesWorked },
    })
    return { data: serializeAttendance(updated), status: 200 }
  }

  if (existing && !existing.clockOut) {
    const clockOut = now
    const minutesWorked = computeMinutesWorked(existing.clockIn, clockOut)
    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: { clockOut, minutesWorked },
    })
    return { data: serializeAttendance(updated), status: 200 }
  }

  if (existing?.clockOut) {
    return { error: 'Journée déjà clôturée', status: 409 }
  }

  const schedule = await prisma.employeeScheduleEntry.findUnique({
    where: { userId_date: { userId: input.userId, date } },
    include: { shift: { select: { id: true, startTime: true } } },
  })

  const scheduled = Boolean(schedule?.shiftId)
  const startTime = schedule?.startTime ?? schedule?.shift?.startTime ?? null
  const window = evaluateClockInWindow(now, date, scheduled, startTime, 'NONE')
  if (!window.canClockIn) {
    return { error: window.blockedReason ?? 'Pointage entrée indisponible', status: 403 }
  }

  const user = await prisma.user.findFirst({
    where: { id: input.userId, businessId: input.businessId },
    select: { shiftId: true },
  })

  const created = await prisma.attendance.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      date,
      clockIn: now,
      source: input.source,
      shiftId: schedule?.shiftId ?? user?.shiftId ?? null,
    },
  })
  return { data: serializeAttendance(created), status: 201 }
}

async function assertUniquePin(
  prisma: PrismaClient,
  businessId: string,
  pin: string | undefined | null,
  excludeUserId?: string
) {
  if (!pin) return
  const normalized = String(pin).trim()
  if (!isValidStaffPin(normalized)) {
    throw Object.assign(new Error('PIN invalide (4 chiffres)'), { status: 400 })
  }
  const clash = await prisma.user.findFirst({
    where: {
      businessId,
      pin: normalized,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
  })
  if (clash) {
    throw Object.assign(new Error('Ce PIN est déjà utilisé par un autre employé'), { status: 400 })
  }
}

function requireOperationalPin(role: string, pin?: string | null) {
  const needsPin = role !== 'ADMIN'
  if (needsPin && !pin) {
    throw Object.assign(new Error('PIN obligatoire pour ce rôle'), { status: 400 })
  }
}

/**
 * GET /api/employees
 * Get all employees for the current business with shift and salary info.
 * @returns {Array<{id, name, email, phone, role, isActive, shiftId, shift, salary, salaryPeriod, createdAt}>}
 */
router.get('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const includeInactive =
      req.query.includeInactive === '1' || req.query.includeInactive === 'true'
    const employees = await prisma.user.findMany({
      where: {
        businessId: req.user!.businessId,
        ...(includeInactive
          ? {}
          : {
              isActive: true,
              NOT: {
                OR: [
                  { email: { endsWith: '@lazpizza.fr' } },
                  { email: 'admin@cafe.com' },
                ],
              },
            }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        shiftId: true,
        shift: true,
        salary: true,
        salaryPeriod: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })
    res.json(employees)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/employees
 * Create a new employee user.
 * @body {name, email, password?, phone, role?, pin?, shiftId?, salary?, salaryPeriod?}
 * @returns 201 {id, name, email, phone, role, isActive}
 * @throws 400 if email already in use
 */
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { name, email, password, phone, role, pin, shiftId, salary, salaryPeriod } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already in use' })

    const roleValue = role || 'WAITER'
    requireOperationalPin(roleValue, pin)
    await assertUniquePin(prisma, req.user!.businessId, pin)

    const hashedPassword = password ? await bcrypt.hash(password, 12) : await bcrypt.hash(Math.random().toString(36), 12)

    const employee = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: roleValue,
        pin: pin ? String(pin).trim() : null,
        shiftId,
        salary: salary || 0,
        salaryPeriod: salaryPeriod || 'MONTHLY',
        businessId: req.user!.businessId,
      },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
    })

    res.status(201).json(employee)
  } catch (error: any) {
    const status = error?.status ?? 500
    res.status(status).json({ error: error?.message ?? 'Internal server error' })
  }
})

/**
 * GET /api/employees/shifts
 * Get all shifts for the current business with user count.
 * @returns {Array<Shift & {_count: {users: number}}>}
 */
router.get('/shifts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const withStaff = req.query.withStaff === '1'

    if (withStaff) {
      const [shifts, unassigned] = await Promise.all([
        prisma.shift.findMany({
          where: { businessId, isActive: true },
          include: {
            _count: { select: { users: true } },
            users: {
              where: { isActive: true },
              select: { id: true, name: true, role: true, email: true },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { startTime: 'asc' },
        }),
        prisma.user.findMany({
          where: { businessId, isActive: true, shiftId: null, role: { not: 'ADMIN' } },
          select: { id: true, name: true, role: true, email: true },
          orderBy: { name: 'asc' },
        }),
      ])
      return res.json({ shifts, unassigned })
    }

    const shifts = await prisma.shift.findMany({
      where: { businessId, isActive: true },
      include: { _count: { select: { users: true } } },
      orderBy: { startTime: 'asc' },
    })
    res.json(shifts)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/employees/shifts/sync
 * Applique les créneaux métier La Z Pizza (Cuisine 16h, Caisse/Livraison 18h, fermeture 22h).
 */
router.post('/shifts/sync', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const { syncPizzeriaShifts, assignRoleDefaultShifts } = await import('../lib/pizzeria-shifts')
    const result = await syncPizzeriaShifts(prisma, businessId)
    const assigned = await assignRoleDefaultShifts(prisma, businessId)
    const shifts = await prisma.shift.findMany({
      where: { businessId, isActive: true },
      orderBy: { startTime: 'asc' },
      select: { name: true, startTime: true, endTime: true },
    })
    res.json({ success: true, ...result, employeesAssigned: assigned, shifts })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/employees/shifts
 * Create a new shift.
 * @body {name, startTime, endTime, days}
 * @returns 201 {Shift}
 */
router.post('/shifts', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const shift = await prisma.shift.create({
      data: { ...req.body, businessId: req.user!.businessId },
    })
    res.status(201).json(shift)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PUT /api/employees/shifts/:id
 * Update a shift.
 * @body {name?, startTime?, endTime?, days?}
 * @returns {Shift}
 */
router.put('/shifts/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const shift = await prisma.shift.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json(shift)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * DELETE /api/employees/shifts/:id
 * Delete a shift by ID.
 * @returns {message: string}
 */
router.delete('/shifts/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    await prisma.shift.delete({ where: { id: req.params.id } })
    res.json({ message: 'Shift deleted' })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PUT /api/employees/:id/salary
 * Update an employee's salary information.
 * @body {salary: number, salaryPeriod: 'MONTHLY'|'WEEKLY'|'DAILY'}
 * @returns {id, name, salary, salaryPeriod}
 */
router.put('/:id/salary', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { salary, salaryPeriod } = req.body
    const employee = await prisma.user.update({
      where: { id: req.params.id },
      data: { salary, salaryPeriod },
      select: { id: true, name: true, salary: true, salaryPeriod: true },
    })
    res.json(employee)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/employees/payroll
 * Get payroll report with salary info and this month's order stats.
 * @returns {Array<{id, name, role, salary, salaryPeriod, thisMonthOrders, thisMonthSales}>}
 */
router.get('/payroll', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId

    const employees = await prisma.user.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        salary: true,
        salaryPeriod: true,
        orders: {
          where: {
            createdAt: { gte: new Date(new Date().setDate(1)) },
          },
          select: { total: true },
        },
      },
    })

    const payrollData = employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      role: emp.role,
      salary: emp.salary,
      salaryPeriod: emp.salaryPeriod,
      thisMonthOrders: emp.orders.length,
      thisMonthSales: emp.orders.reduce((s, o) => s + o.total, 0),
    }))

    res.json(payrollData)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/employees/clock-in
 * Pointage entrée — employé connecté.
 */
router.post('/clock-in', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const result = await punchEmployeeAttendance(prisma, {
      businessId: req.user!.businessId,
      userId: req.user!.userId,
      source: 'SELF',
    })
    if (result.error) return res.status(result.status).json({ error: result.error })
    res.json(result.data)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/employees/clock-out
 * Pointage sortie — employé connecté.
 */
router.post('/clock-out', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const result = await punchEmployeeAttendance(prisma, {
      businessId: req.user!.businessId,
      userId: req.user!.userId,
      source: 'SELF',
      forceOut: true,
    })
    if (result.error) return res.status(result.status).json({ error: result.error })
    res.json(result.data)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** POST /api/employees/attendance/punch — bascule entrée/sortie (PIN employé obligatoire) */
router.post('/attendance/punch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { userId, pin } = req.body as { userId?: string; pin?: string }
    if (!userId) return res.status(400).json({ error: 'userId obligatoire' })
    if (!pin) return res.status(400).json({ error: 'PIN obligatoire pour valider le pointage' })

    const normalizedPin = String(pin).trim()
    if (!isValidStaffPin(normalizedPin)) {
      return res.status(400).json({ error: 'PIN invalide (4 chiffres)' })
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, businessId: req.user!.businessId, isActive: true },
      select: { id: true, pin: true },
    })
    if (!target) return res.status(404).json({ error: 'Employé introuvable' })
    if (!target.pin || target.pin !== normalizedPin) {
      return res.status(403).json({ error: 'PIN incorrect' })
    }

    const result = await punchEmployeeAttendance(prisma, {
      businessId: req.user!.businessId,
      userId,
      source: 'KITCHEN',
    })
    if (result.error) return res.status(result.status).json({ error: result.error })
    res.json(result.data)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** POST /api/employees/planning/substitute — remplace un planifié absent par un disponible (KDS) */
router.post('/planning/substitute', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { absentUserId, substituteUserId, pin, date } = req.body as {
      absentUserId?: string
      substituteUserId?: string
      pin?: string
      date?: string
    }

    if (!absentUserId || !substituteUserId) {
      return res.status(400).json({ error: 'Employé absent et remplaçant obligatoires' })
    }
    if (!pin) return res.status(400).json({ error: 'PIN du remplaçant obligatoire' })

    const normalizedPin = String(pin).trim()
    if (!isValidStaffPin(normalizedPin)) {
      return res.status(400).json({ error: 'PIN invalide (4 chiffres)' })
    }

    const substitute = await prisma.user.findFirst({
      where: { id: substituteUserId, businessId: req.user!.businessId, isActive: true },
      select: { id: true, pin: true, name: true },
    })
    if (!substitute) return res.status(404).json({ error: 'Remplaçant introuvable' })
    if (!substitute.pin || substitute.pin !== normalizedPin) {
      return res.status(403).json({ error: 'PIN incorrect — seul le remplaçant peut confirmer' })
    }

    const day = date?.trim() || todayDateKey()
    const result = await substituteScheduleEntry(prisma, {
      businessId: req.user!.businessId,
      date: day,
      absentUserId,
      substituteUserId,
    })

    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.json({
      success: true,
      message: `${result.substituteName} remplace ${result.absentName}`,
      absentName: result.absentName,
      substituteName: result.substituteName,
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** POST /api/employees/attendance/manual-close — admin clôture une sortie oubliée */
router.post(
  '/attendance/manual-close',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma')
      const { userId, date, clockOutTime, attendanceId } = req.body as {
        userId?: string
        date?: string
        clockOutTime?: string
        attendanceId?: string
      }

      if (!clockOutTime?.trim()) {
        return res.status(400).json({ error: 'Heure de fin obligatoire (HH:mm)' })
      }
      if (!/^\d{1,2}:\d{2}$/.test(clockOutTime.trim())) {
        return res.status(400).json({ error: 'Format heure invalide — utilisez HH:mm' })
      }

      const record = attendanceId
        ? await prisma.attendance.findFirst({
            where: { id: attendanceId, businessId: req.user!.businessId },
          })
        : userId && date
          ? await prisma.attendance.findUnique({
              where: { userId_date: { userId, date: date.trim() } },
            })
          : null

      if (!record || record.businessId !== req.user!.businessId) {
        return res.status(404).json({ error: 'Pointage introuvable' })
      }
      if (!record.clockIn) {
        return res.status(400).json({ error: 'Aucune entrée enregistrée' })
      }
      if (record.clockOut) {
        return res.status(409).json({ error: 'Sortie déjà enregistrée' })
      }

      const today = todayDateKey()
      if (record.date > today) {
        return res.status(400).json({ error: 'Date de pointage invalide' })
      }

      const clockOut = parisTimeOnDay(record.date, clockOutTime.trim())
      if (clockOut.getTime() <= record.clockIn.getTime()) {
        return res.status(400).json({ error: 'Heure de fin antérieure à l\'entrée' })
      }

      const minutesWorked = computeMinutesWorked(record.clockIn, clockOut)
      const updated = await prisma.attendance.update({
        where: { id: record.id },
        data: {
          clockOut,
          minutesWorked,
          source: `${record.source}+ADMIN_CLOSE`,
        },
      })

      res.json(serializeAttendance(updated))
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  },
)

/**
 * GET /api/employees/planning/today-board
 * Mur équipe KDS — qui est planifié / présent aujourd'hui + pointages.
 */
router.get('/planning/today-board', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const date = (req.query.date as string) || todayDateKey()

    const weekFrom = (() => {
      const d = new Date(`${date}T12:00:00`)
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setDate(d.getDate() + diff)
      return d.toISOString().slice(0, 10)
    })()

    const weekTo = (() => {
      const d = new Date(`${weekFrom}T12:00:00`)
      d.setDate(d.getDate() + 6)
      return d.toISOString().slice(0, 10)
    })()

    const [users, todayEntries, weekEntries, attendances, shifts] = await Promise.all([
      prisma.user.findMany({
        where: { businessId, isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          shiftId: true,
          planningMeta: true,
          shift: { select: { id: true, name: true, startTime: true, endTime: true, slug: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.employeeScheduleEntry.findMany({
        where: { businessId, date },
        include: {
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        },
      }),
      prisma.employeeScheduleEntry.findMany({
        where: { businessId, date: { gte: weekFrom, lte: weekTo }, shiftId: { not: null } },
        include: {
          user: { select: { id: true, name: true, role: true, isActive: true } },
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        },
        orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
      }),
      prisma.attendance.findMany({
        where: { businessId, date },
      }),
      prisma.shift.findMany({
        where: { businessId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ])

    const staff = users.filter(isPlanningParticipant)
    const activeUserIds = new Set(staff.map((u) => u.id))
    const entryByUser = new Map(todayEntries.map((e) => [e.userId, e]))
    const attendanceByUser = new Map(
      attendances.filter((a) => activeUserIds.has(a.userId)).map((a) => [a.userId, a])
    )

    const employeesAll = staff.map((u) => {
      const entry = entryByUser.get(u.id)
      const att = attendanceByUser.get(u.id)
      const scheduled = Boolean(entry?.shiftId)
      const startTime = scheduled
        ? entry?.startTime ?? entry?.shift?.startTime ?? null
        : null
      const attStatus = attendanceStatus(att ?? null)
      const punchWindow = evaluateClockInWindow(
        new Date(),
        date,
        scheduled,
        startTime,
        attStatus,
      )
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        defaultShift: u.shift,
        scheduled,
        roleLabel: entry?.roleLabel ?? null,
        shift: scheduled ? entry?.shift ?? null : null,
        startTime,
        endTime: scheduled ? entry?.endTime ?? entry?.shift?.endTime ?? null : null,
        scheduleNotes: entry?.notes ?? null,
        attendance: att ? serializeAttendance(att) : null,
        punch: {
          canClockIn: punchWindow.canClockIn,
          canClockOut: attStatus === 'IN',
          canSubstitute: scheduled && attStatus === 'NONE',
          blockedReason: punchWindow.blockedReason,
          opensAt: punchWindow.opensAt?.toISOString() ?? null,
        },
      }
    })

    const availableSubstitutes = employeesAll
      .filter(
        (e) =>
          !e.scheduled &&
          (e.attendance?.status ?? 'NONE') !== 'IN' &&
          (e.attendance?.status ?? 'NONE') !== 'OUT',
      )
      .map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        defaultShift: e.defaultShift,
      }))

    /** KDS : uniquement planifiés aujourd'hui ou pointés (pas toute la liste staff). */
    const employees = employeesAll.filter((e) => e.scheduled || e.attendance?.status === 'IN')

    const presentCount = employeesAll.filter((e) => e.attendance?.status === 'IN').length
    const finishedCount = employeesAll.filter((e) => e.attendance?.status === 'OUT').length
    const scheduledCount = employeesAll.filter((e) => e.scheduled).length

    res.json({
      date,
      weekFrom,
      weekTo,
      shifts,
      employees,
      weekEntries: weekEntries
        .filter((e) => e.user.isActive)
        .map((e) => ({
          id: e.id,
          date: e.date,
          roleLabel: e.roleLabel,
          user: { id: e.user.id, name: e.user.name, role: e.user.role },
          shift: e.shift,
          startTime: e.startTime,
          endTime: e.endTime,
        })),
      allStaff: employeesAll,
      availableSubstitutes,
      summary: {
        scheduled: scheduledCount,
        present: presentCount,
        finishedToday: finishedCount,
        totalStaff: staff.length,
        onBoard: employees.length,
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/employees/attendance
 * Historique pointages (admin) ou jour courant (staff).
 */
router.get('/attendance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { from, to, userId, date } = req.query
    const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'MANAGER'

    const where: Record<string, unknown> = { businessId: req.user!.businessId }
    if (userId && isAdmin) where.userId = userId as string
    else if (!isAdmin) where.userId = req.user!.userId

    if (date) {
      where.date = date as string
    } else if (from || to) {
      where.date = {}
      if (from) (where.date as Record<string, string>).gte = from as string
      if (to) (where.date as Record<string, string>).lte = to as string
    }

    const records = await prisma.attendance.findMany({
      where,
      include: { user: { select: { id: true, name: true, role: true } }, shift: true },
      orderBy: [{ date: 'desc' }, { clockIn: 'desc' }],
    })
    res.json(records.map((r) => ({ ...r, ...serializeAttendance(r) })))
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** GET /api/employees/attendance/monthly — synthèse heures du mois (comptable / BS) */
router.get(
  '/attendance/monthly',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma')
      const month = parseMonthKey(req.query.month as string | undefined)
      const summary = await buildMonthlyHoursSummary(prisma, req.user!.businessId, month)
      res.json(summary)
    } catch (error) {
      console.error('Monthly hours error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  },
)

/** GET /api/employees/attendance/monthly/export — CSV comptable */
router.get(
  '/attendance/monthly/export',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma')
      const month = parseMonthKey(req.query.month as string | undefined)
      const summary = await buildMonthlyHoursSummary(prisma, req.user!.businessId, month)
      res.type('text/csv; charset=utf-8').send(monthlyHoursToCsv(summary))
    } catch (error) {
      console.error('Monthly hours export error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  },
)

/** GET /api/employees/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD */
router.get('/schedule', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10)
    const toDate = new Date(from)
    toDate.setDate(toDate.getDate() + 6)
    const to = (req.query.to as string) || toDate.toISOString().slice(0, 10)

    const [entries, employees, shifts, business] = await Promise.all([
      prisma.employeeScheduleEntry.findMany({
        where: { businessId, date: { gte: from, lte: to } },
        include: {
          user: { select: { id: true, name: true, role: true } },
          shift: true,
        },
        orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
      }),
      prisma.user.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true, role: true, shiftId: true, shift: true, planningMeta: true },
        orderBy: { name: 'asc' },
      }),
      prisma.shift.findMany({ where: { businessId, isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.business.findUnique({ where: { id: businessId }, select: { settings: true } }),
    ])

    const guardrails = resolveScheduleGuardrails(parseBusinessSettings(business?.settings).planning)

    const staffForPlanning = employees.filter(isPlanningParticipant)

    const existing = entries.map((e) => ({
      userId: e.userId,
      date: e.date,
      shiftId: e.shiftId,
      roleLabel: e.roleLabel,
    }))

    const intelligence = analyzeSchedule({
      from,
      to,
      employees: staffForPlanning.map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        shiftId: e.shiftId,
        planningMeta: e.planningMeta,
      })),
      shifts,
      existing,
      guardrails,
    })

    res.json({
      from,
      to,
      entries,
      employees: staffForPlanning,
      shifts,
      intelligence: {
        score: intelligence.score,
        issues: intelligence.issues,
        suggestions: intelligence.suggestions,
        guardrails,
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** PUT /api/employees/schedule — upsert une affectation journalière */
router.put('/schedule', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const { userId, date, shiftId, startTime, endTime, roleLabel, notes } = req.body

    if (!userId || !date) return res.status(400).json({ error: 'userId et date obligatoires' })

    const user = await prisma.user.findFirst({ where: { id: userId, businessId } })
    if (!user) return res.status(404).json({ error: 'Employé introuvable' })

    const entry = await prisma.employeeScheduleEntry.upsert({
      where: { userId_date: { userId, date } },
      create: {
        businessId,
        userId,
        date,
        shiftId: shiftId || null,
        startTime: startTime || null,
        endTime: endTime || null,
        roleLabel: roleLabel || null,
        notes: notes || null,
      },
      update: {
        shiftId: shiftId || null,
        startTime: startTime || null,
        endTime: endTime || null,
        roleLabel: roleLabel || null,
        notes: notes || null,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        shift: true,
      },
    })

    res.json(entry)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

async function loadSchedulePlanningContext(
  prisma: PrismaClient,
  businessId: string,
  from: string,
  to: string,
  userId?: string
) {
  const [entries, employees, shifts, business] = await Promise.all([
    prisma.employeeScheduleEntry.findMany({
      where: {
        businessId,
        date: { gte: from, lte: to },
        ...(userId ? { userId } : {}),
      },
    }),
    prisma.user.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, role: true, shiftId: true, planningMeta: true },
      orderBy: { name: 'asc' },
    }),
    prisma.shift.findMany({ where: { businessId, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { settings: true } }),
  ])

  const settings = parseBusinessSettings(business?.settings)
  const guardrails = resolveScheduleGuardrails(settings.planning)

  const existing = entries.map((e) => ({
    userId: e.userId,
    date: e.date,
    shiftId: e.shiftId,
    roleLabel: e.roleLabel,
  }))

  return {
    employees: employees.filter(isPlanningParticipant),
    shifts,
    existing,
    guardrails,
    planning: settings.planning,
  }
}

type PlanAssignment = { userId: string; date: string; shiftId: string; roleLabel: string }

/** Écrit le planning : affectations + repos explicites (shiftId null). */
async function applySchedulePlan(
  prisma: PrismaClient,
  businessId: string,
  from: string,
  to: string,
  staffIds: string[],
  proposed: PlanAssignment[],
  options?: { userId?: string; overwrite?: boolean }
): Promise<number> {
  const dates = datesBetween(from, to)
  const ids = options?.userId ? [options.userId] : staffIds
  const byKey = new Map(proposed.map((p) => [`${p.userId}:${p.date}`, p]))
  let upserted = 0

  for (const empId of ids) {
    for (const date of dates) {
      const assignment = byKey.get(`${empId}:${date}`)
      if (!options?.overwrite && !assignment) continue

      await prisma.employeeScheduleEntry.upsert({
        where: { userId_date: { userId: empId, date } },
        create: {
          businessId,
          userId: empId,
          date,
          shiftId: assignment?.shiftId ?? null,
          roleLabel: assignment?.roleLabel ?? null,
        },
        update: {
          shiftId: assignment?.shiftId ?? null,
          roleLabel: assignment?.roleLabel ?? null,
        },
      })
      upserted++
    }
  }

  return upserted
}

/** POST /api/employees/schedule/smart-preview — simulation sans écriture */
router.post('/schedule/smart-preview', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const { from, to, userId } = req.body as { from?: string; to?: string; userId?: string }

    if (!from) return res.status(400).json({ error: 'from obligatoire (YYYY-MM-DD)' })

    const toDate =
      to ||
      (() => {
        const d = new Date(`${from}T12:00:00`)
        d.setDate(d.getDate() + 6)
        return d.toISOString().slice(0, 10)
      })()

    const ctx = await loadSchedulePlanningContext(prisma, businessId, from, toDate, userId)
    const plan = buildSmartSchedulePlan({
      from,
      to: toDate,
      employees: ctx.employees,
      shifts: ctx.shifts,
      existing: [],
      userId,
      guardrails: ctx.guardrails,
    })

    res.json(plan)
  } catch (error) {
    console.error('smart-preview error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** POST /api/employees/schedule/smart-fill — planification intelligente + écriture */
router.post('/schedule/smart-fill', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const { from, to, userId, applySuggestions, overwrite } = req.body as {
      from?: string
      to?: string
      userId?: string
      applySuggestions?: boolean
      overwrite?: boolean
    }

    if (!from) return res.status(400).json({ error: 'from obligatoire (YYYY-MM-DD)' })

    const toDate =
      to ||
      (() => {
        const d = new Date(`${from}T12:00:00`)
        d.setDate(d.getDate() + 6)
        return d.toISOString().slice(0, 10)
      })()

    const ctx = await loadSchedulePlanningContext(prisma, businessId, from, toDate, userId)
    const plan = buildSmartSchedulePlan({
      from,
      to: toDate,
      employees: ctx.employees,
      shifts: ctx.shifts,
      existing: overwrite === true ? [] : ctx.existing,
      userId,
      guardrails: ctx.guardrails,
    })

    let toApply = [...plan.proposed]
    if (applySuggestions) {
      for (const s of plan.suggestions) {
        if (!s.action || s.priority !== 'high') continue
        const key = `${s.action.userId}:${s.action.date}`
        if (ctx.existing.some((e) => `${e.userId}:${e.date}` === key)) continue
        if (toApply.some((p) => `${p.userId}:${p.date}` === key)) continue
        toApply.push({ ...s.action, reason: 'coverage' as const })
      }
    }

    let created = 0
    if (overwrite === true) {
      created = await applySchedulePlan(
        prisma,
        businessId,
        from,
        toDate,
        ctx.employees.map((e) => e.id),
        toApply,
        { userId, overwrite: true }
      )
    } else {
      for (const p of toApply) {
        const existing = await prisma.employeeScheduleEntry.findUnique({
          where: { userId_date: { userId: p.userId, date: p.date } },
        })
        if (existing) continue

        await prisma.employeeScheduleEntry.create({
          data: {
            businessId,
            userId: p.userId,
            date: p.date,
            shiftId: p.shiftId,
            roleLabel: p.roleLabel,
          },
        })
        created++
      }
    }

    res.json({
      created,
      skippedExisting: plan.skippedExisting,
      restDays: plan.restDays.length,
      score: plan.score,
      summary: plan.summary,
      issues: plan.issues,
      suggestions: plan.suggestions,
      from,
      to: toDate,
    })
  } catch (error) {
    console.error('smart-fill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
router.post('/schedule/fill-week', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const { from, to, userId, mode } = req.body as {
      from?: string
      to?: string
      userId?: string
      mode?: 'simple' | 'smart'
    }

    if (!from) return res.status(400).json({ error: 'from obligatoire (YYYY-MM-DD)' })

    const toDate =
      to ||
      (() => {
        const d = new Date(`${from}T12:00:00`)
        d.setDate(d.getDate() + 6)
        return d.toISOString().slice(0, 10)
      })()

    if (mode === 'simple') {
      return res.status(400).json({
        error:
          'Mode simple désactivé — utilisez la planification intelligente (couverture 7j/7, repos, alternance livreurs).',
      })
    }

    const ctx = await loadSchedulePlanningContext(prisma, businessId, from, toDate, userId)
    const plan = buildSmartSchedulePlan({
      from,
      to: toDate,
      employees: ctx.employees,
      shifts: ctx.shifts,
      existing: [],
      userId,
      guardrails: ctx.guardrails,
    })

    const created = await applySchedulePlan(
      prisma,
      businessId,
      from,
      toDate,
      ctx.employees.map((e) => e.id),
      plan.proposed,
      { userId, overwrite: true }
    )

    return res.json({
      created,
      skipped: plan.skippedExisting,
      mode: 'smart',
      score: plan.score,
      summary: plan.summary,
      restDays: plan.restDays.length,
      issues: plan.issues,
      from,
      to: toDate,
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/schedule/copy-week', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const businessId = req.user!.businessId
    const { sourceFrom, targetFrom, weekCount, overwrite } = req.body as {
      sourceFrom?: string
      targetFrom?: string
      weekCount?: number
      overwrite?: boolean
    }

    if (!sourceFrom || !targetFrom) {
      return res.status(400).json({ error: 'sourceFrom et targetFrom obligatoires (YYYY-MM-DD, lundi)' })
    }

    const result = await copyScheduleWeeks(prisma, businessId, {
      sourceFrom,
      targetFrom,
      weekCount: weekCount ?? 1,
      overwrite: overwrite === true,
    })

    res.json({
      ...result,
      sourceFrom,
      targetFrom,
      message:
        result.weeks > 1
          ? `Planning recopié sur ${result.weeks} semaines (${result.created} affectations)`
          : `Semaine recopiée (${result.created} affectations, ${result.skipped} ignorées)`,
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/schedule/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const existing = await prisma.employeeScheduleEntry.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Entrée introuvable' })
    await prisma.employeeScheduleEntry.delete({ where: { id: existing.id } })
    res.json({ message: 'Supprimé' })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PUT /api/employees/:id
 * Update an employee's details.
 * @body {name?, phone?, role?, pin?, shiftId?, isActive?}
 * @returns {id, name, email, phone, role, isActive}
 */
router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { name, phone, role, pin, shiftId, isActive, password } = req.body

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Employé introuvable' })

    if (isActive === false && existing.id === req.user!.userId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone || null
    if (role !== undefined) data.role = role
    if (shiftId !== undefined) data.shiftId = shiftId
    if (isActive !== undefined) data.isActive = isActive
    if (password) data.password = await bcrypt.hash(String(password), 12)

    if (pin !== undefined) await assertUniquePin(prisma, req.user!.businessId, pin, req.params.id)

    const employee = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(pin !== undefined ? { pin: pin ? String(pin).trim() : null } : {}),
      },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
    })
    res.json(employee)
  } catch (error: any) {
    const status = error?.status ?? 500
    res.status(status).json({ error: error?.message ?? 'Internal server error' })
  }
})

/**
 * DELETE /api/employees/:id
 * Soft-delete an employee (sets isActive to false).
 * @returns {message: string}
 */
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    if (req.params.id === req.user!.userId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' })
    }
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Employé introuvable' })

    await prisma.user.update({
      where: { id: existing.id },
      data: { isActive: false },
    })
    res.json({ message: 'Employee deactivated' })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
