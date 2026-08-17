/** File d'attente SUNMI — évite d'écraser ticket cuisine + étiquette colis + reçu. */
let chain: Promise<void> = Promise.resolve()

const SUNMI_GAP_MS = 1800

export function enqueueSunmiPrint<T>(task: () => T | Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const result = await task()
    await new Promise((r) => setTimeout(r, SUNMI_GAP_MS))
    return result
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
