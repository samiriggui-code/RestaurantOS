import { checkScheduleWriteGuardrails, SCHEDULE_GUARDRAILS } from '../lib/smart-schedule';

const GUARDRAILS = SCHEDULE_GUARDRAILS; // maxDaysPerWeek/maxConsecutiveDays/minRestDaysPerWeek par défaut La Z Pizza

describe('checkScheduleWriteGuardrails', () => {
  it('never blocks clearing a day (isWorkingDay=false)', () => {
    const violations = checkScheduleWriteGuardrails({
      employee: { role: 'CASHIER' },
      date: '2026-08-10',
      isWorkingDay: false,
      otherWorkedDates: [
        '2026-08-04',
        '2026-08-05',
        '2026-08-06',
        '2026-08-07',
        '2026-08-08',
        '2026-08-09',
      ],
      guardrails: GUARDRAILS,
    });
    expect(violations).toEqual([]);
  });

  it('allows a normal assignment within the weekly cap', () => {
    // Lundi 2026-08-10 : 2 jours déjà posés cette semaine (lun-dim = 10 au 16)
    const violations = checkScheduleWriteGuardrails({
      employee: { role: 'CASHIER' },
      date: '2026-08-10',
      isWorkingDay: true,
      otherWorkedDates: ['2026-08-11', '2026-08-12'],
      guardrails: GUARDRAILS,
    });
    expect(violations).toEqual([]);
  });

  it('rejects when the weekly cap (maxDaysPerWeek) would be exceeded', () => {
    // Semaine du 10 au 16 août : déjà 6 jours posés (max défaut = 6) + celui-ci = 7
    const otherWorkedDates = [
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ];
    const violations = checkScheduleWriteGuardrails({
      employee: { role: 'CASHIER' },
      date: '2026-08-10',
      isWorkingDay: true,
      otherWorkedDates,
      guardrails: GUARDRAILS,
    });
    expect(violations).toContainEqual(expect.objectContaining({ code: 'MAX_DAYS_PER_WEEK' }));
  });

  it('rejects when consecutive days would exceed maxConsecutiveDays, even across a week boundary', () => {
    // maxConsecutiveDays par défaut = 6. On enchaîne 6 jours avant + celui-ci = 7 d'affilée,
    // à cheval sur deux semaines ISO (04-08-2026 dimanche -> 10-08-2026 lundi).
    const otherWorkedDates = [
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ];
    const violations = checkScheduleWriteGuardrails({
      employee: { role: 'CASHIER' },
      date: '2026-08-10',
      isWorkingDay: true,
      otherWorkedDates,
      guardrails: GUARDRAILS,
    });
    expect(violations).toContainEqual(expect.objectContaining({ code: 'MAX_CONSECUTIVE_DAYS' }));
  });

  it('uses the part-time driver cap from planningMeta instead of the generic max', () => {
    const violations = checkScheduleWriteGuardrails({
      employee: {
        role: 'DRIVER',
        planningMeta: { employmentType: 'PART_TIME' },
      },
      date: '2026-08-10',
      isWorkingDay: true,
      // 3 jours déjà + celui-ci = 4, au-delà du plafond livreur mi-temps (3)
      otherWorkedDates: ['2026-08-11', '2026-08-12', '2026-08-13'],
      guardrails: GUARDRAILS,
    });
    expect(violations).toContainEqual(expect.objectContaining({ code: 'MAX_DAYS_PER_WEEK' }));
  });

  it('takes the stricter of maxDaysPerWeek and (7 - minRestDaysPerWeek)', () => {
    const strictGuardrails = { ...GUARDRAILS, maxDaysPerWeek: 6, minRestDaysPerWeek: 3 };
    // Effectif max = min(6, 7-3) = 4. 4 jours déjà posés + celui-ci = 5 > 4.
    const violations = checkScheduleWriteGuardrails({
      employee: { role: 'CASHIER' },
      date: '2026-08-10',
      isWorkingDay: true,
      otherWorkedDates: ['2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14'],
      guardrails: strictGuardrails,
    });
    expect(violations).toContainEqual(expect.objectContaining({ code: 'MAX_DAYS_PER_WEEK' }));
  });
});
