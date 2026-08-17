import type { PrismaClient } from '@prisma/client'
import { isPlanningParticipant } from './seed-pizzeria-staff'

export async function substituteScheduleEntry(
  prisma: PrismaClient,
  input: {
    businessId: string
    date: string
    absentUserId: string
    substituteUserId: string
  },
): Promise<
  | { ok: true; substituteName: string; absentName: string }
  | { ok: false; error: string; status: number }
> {
  if (input.absentUserId === input.substituteUserId) {
    return { ok: false, error: 'Choisissez un autre employé', status: 400 }
  }

  const [absentUser, substituteUser] = await Promise.all([
    prisma.user.findFirst({
      where: { id: input.absentUserId, businessId: input.businessId, isActive: true },
      select: { id: true, name: true, role: true, planningMeta: true },
    }),
    prisma.user.findFirst({
      where: { id: input.substituteUserId, businessId: input.businessId, isActive: true },
      select: { id: true, name: true, role: true, planningMeta: true },
    }),
  ])

  if (!absentUser) return { ok: false, error: 'Employé absent introuvable', status: 404 }
  if (!substituteUser) return { ok: false, error: 'Remplaçant introuvable', status: 404 }
  if (!isPlanningParticipant(substituteUser)) {
    return { ok: false, error: 'Ce profil ne peut pas être affecté au planning', status: 400 }
  }

  const absentEntry = await prisma.employeeScheduleEntry.findUnique({
    where: { userId_date: { userId: input.absentUserId, date: input.date } },
    include: { shift: true },
  })

  if (!absentEntry?.shiftId) {
    return { ok: false, error: 'Aucun créneau planifié à remplacer', status: 400 }
  }

  const absentAttendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId: input.absentUserId, date: input.date } },
  })
  if (absentAttendance?.clockIn && !absentAttendance.clockOut) {
    return { ok: false, error: 'Employé déjà en service — remplacement impossible', status: 409 }
  }
  if (absentAttendance?.clockOut) {
    return { ok: false, error: 'Service déjà terminé pour cet employé', status: 409 }
  }

  const subEntry = await prisma.employeeScheduleEntry.findUnique({
    where: { userId_date: { userId: input.substituteUserId, date: input.date } },
  })
  if (subEntry?.shiftId) {
    return { ok: false, error: `${substituteUser.name} est déjà planifié(e) ce jour`, status: 409 }
  }

  const subAttendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId: input.substituteUserId, date: input.date } },
  })
  if (subAttendance?.clockIn && !subAttendance.clockOut) {
    return { ok: false, error: 'Le remplaçant est déjà en service ailleurs', status: 409 }
  }

  const stamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
  const shiftPayload = {
    shiftId: absentEntry.shiftId,
    startTime: absentEntry.startTime ?? absentEntry.shift?.startTime ?? null,
    endTime: absentEntry.endTime ?? absentEntry.shift?.endTime ?? null,
    roleLabel: absentEntry.roleLabel,
  }

  const attendanceOps = []
  if (absentAttendance) {
    attendanceOps.push(
      prisma.attendance.update({
        where: { id: absentAttendance.id },
        data: {
          clockOut: absentAttendance.clockOut ?? new Date(),
          minutesWorked: 0,
        },
      }),
    )
  }

  await prisma.$transaction([
    ...attendanceOps,
    prisma.employeeScheduleEntry.update({
      where: { id: absentEntry.id },
      data: {
        shiftId: null,
        startTime: null,
        endTime: null,
        roleLabel: null,
        notes: `Absent — remplacé par ${substituteUser.name} (${stamp})`,
      },
    }),
    prisma.employeeScheduleEntry.upsert({
      where: { userId_date: { userId: input.substituteUserId, date: input.date } },
      create: {
        businessId: input.businessId,
        userId: input.substituteUserId,
        date: input.date,
        ...shiftPayload,
        notes: `Remplace ${absentUser.name} (${stamp})`,
      },
      update: {
        ...shiftPayload,
        notes: `Remplace ${absentUser.name} (${stamp})`,
      },
    }),
  ])

  return { ok: true, substituteName: substituteUser.name, absentName: absentUser.name }
}
