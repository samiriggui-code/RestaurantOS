import { evaluateClockInWindow } from '../../lib/attendance'
import { parisTimeOnDay } from '../../lib/fiscal/timezone'

describe('evaluateClockInWindow', () => {
  const date = '2026-07-11'
  const startTime = '18:00'

  it('blocks clock-in more than 10 minutes before slot', () => {
    const opensAt = parisTimeOnDay(date, startTime)
    const tooEarly = new Date(opensAt.getTime() - 11 * 60_000)
    const result = evaluateClockInWindow(tooEarly, date, true, startTime, 'NONE')
    expect(result.canClockIn).toBe(false)
    expect(result.blockedReason).toMatch(/10 min/)
  })

  it('allows clock-in exactly 10 minutes before slot', () => {
    const opensAt = parisTimeOnDay(date, startTime)
    const ok = new Date(opensAt.getTime() - 10 * 60_000)
    const result = evaluateClockInWindow(ok, date, true, startTime, 'NONE')
    expect(result.canClockIn).toBe(true)
  })

  it('blocks unscheduled employee', () => {
    const result = evaluateClockInWindow(new Date(), date, false, null, 'NONE')
    expect(result.canClockIn).toBe(false)
    expect(result.blockedReason).toMatch(/Non planifié/)
  })

  it('blocks when day already closed', () => {
    const result = evaluateClockInWindow(new Date(), date, true, startTime, 'OUT')
    expect(result.canClockIn).toBe(false)
  })
})
