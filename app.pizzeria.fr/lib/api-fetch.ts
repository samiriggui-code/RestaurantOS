const DEFAULT_RETRIES = 5
const DEFAULT_DELAY_MS = 400
const DEFAULT_TIMEOUT_MS = 12_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Message affiché quand l'API Express ne répond pas (démarrage ou redémarrage tsx watch). */
export function apiUnreachableMessage(): string {
  return 'API en cours de démarrage ou redémarrage. Attendez quelques secondes puis réessayez. Si le problème persiste, relancez « npm run dev ».'
}

export function networkUnreachableMessage(): string {
  return 'Pas de connexion réseau. Vérifiez le Wi‑Fi du terminal puis réessayez.'
}

async function fetchOnce(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * fetch avec retries — couvre le démarrage parallèle (Next avant Express) et les
 * redémarrages courts de `tsx watch` en dev.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: { retries?: number; delayMs?: number; timeoutMs?: number }
): Promise<Response> {
  const retries = options?.retries ?? DEFAULT_RETRIES
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let lastError: unknown

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetchOnce(url, init, timeoutMs)
      if (res.status === 503 && attempt < retries - 1) {
        await sleep(delayMs * (attempt + 1))
        continue
      }
      return res
    } catch (err) {
      lastError = err
      if (attempt < retries - 1) {
        await sleep(delayMs * (attempt + 1))
      }
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'AbortError') {
    throw new Error(networkUnreachableMessage())
  }

  throw lastError ?? new Error('fetch failed')
}
