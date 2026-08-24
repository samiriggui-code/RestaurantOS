const PARIS_TZ = 'Europe/Paris';

type ParisParts = {
  y: number;
  mo: number;
  da: number;
  h: number;
  mi: number;
  s: number;
};

export function parisParts(ms: number): ParisParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PARIS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (t: string): string => parts.find(p => p.type === t)?.value ?? '0';
  return {
    y: Number(get('year')),
    mo: Number(get('month')),
    da: Number(get('day')),
    h: Number(get('hour')),
    mi: Number(get('minute')),
    s: Number(get('second')),
  };
}

/** Jour civil Europe/Paris au format YYYY-MM-DD. */
export function fiscalDayKey(forDate = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: PARIS_TZ }).format(forDate);
}

function localParisToUtc(dayKey: string, h: number, mi: number, s: number, ms: number): Date {
  const [Y, M, D] = dayKey.split('-').map(Number);
  let utc = Date.UTC(Y, M - 1, D, h, mi, s, ms);
  for (let i = 0; i < 4; i++) {
    const p = parisParts(utc);
    const target = Date.UTC(Y, M - 1, D, h, mi, s, ms);
    const actual = Date.UTC(p.y, p.mo - 1, p.da, p.h, p.mi, p.s, 0) + ms;
    utc += target - actual;
  }
  return new Date(utc);
}

/** Bornes UTC inclusives d'une journée civile Europe/Paris. */
export function fiscalDayBoundsParis(dayKey: string): { start: Date; end: Date } {
  return {
    start: localParisToUtc(dayKey, 0, 0, 0, 0),
    end: localParisToUtc(dayKey, 23, 59, 59, 999),
  };
}

/** Heure locale Paris (0–23). */
export function parisHour(forDate = new Date()): number {
  return parisParts(forDate.getTime()).h;
}

/** Ajoute N jours civils Paris à une dayKey YYYY-MM-DD. */
export function addParisDays(dayKey: string, delta: number): string {
  const [Y, M, D] = dayKey.split('-').map(Number);
  const utc = Date.UTC(Y, M - 1, D + delta, 12, 0, 0);
  return fiscalDayKey(new Date(utc));
}

/**
 * Journée à clôturer par défaut : avant 6h Paris → veille (retour tardif après service).
 * Réf. pratique caisse : clôture Z = journée d'activité écoulée, pas minuit civil strict.
 */
export function suggestFiscalCloseDayKey(now = new Date()): string {
  const today = fiscalDayKey(now);
  if (parisHour(now) < 6) return addParisDays(today, -1);
  return today;
}

/** Libellé FR long pour une dayKey. */
export function formatFiscalDayLabel(dayKey: string): string {
  const [Y, M, D] = dayKey.split('-').map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D, 12, 0, 0));
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: PARIS_TZ,
  }).format(d);
}

/** Instant UTC pour une heure HH:mm (ou HH:mm:ss) sur un jour civil Paris. */
export function parisTimeOnDay(dayKey: string, time: string): Date {
  const [hRaw, miRaw] = time.split(':');
  const h = Number(hRaw);
  const mi = Number(miRaw ?? 0);
  return localParisToUtc(dayKey, h, mi, 0, 0);
}

export { PARIS_TZ };
