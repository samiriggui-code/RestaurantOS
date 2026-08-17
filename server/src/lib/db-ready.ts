/** Erreurs transitoires quand PostgreSQL (Laragon/Docker) démarre encore. */
export function isDbStartingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /starting up|se lance|57P03|ECONNREFUSED|connection refused|too many clients/i.test(msg)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; delayMs?: number; label?: string },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 15
  const delayMs = options?.delayMs ?? 2000
  const label = options?.label ?? 'db'
  let last: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (!isDbStartingError(err) || attempt === maxAttempts) throw err
      console.warn(`[${label}] PostgreSQL pas prêt (${attempt}/${maxAttempts}) — nouvel essai dans ${delayMs}ms…`)
      await sleep(delayMs)
    }
  }

  throw last
}
