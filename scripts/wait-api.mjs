#!/usr/bin/env node
/**
 * Attend que l'API Express réponde sur /api/health (démarrage dev).
 */
import { PORTS } from './ports.mjs'

const HEALTH_URL = `http://127.0.0.1:${PORTS.API}/api/health`
const MAX_MS = 90_000
const INTERVAL_MS = 400

export async function waitForApi() {
  const start = Date.now()
  process.stdout.write('[dev] Attente API Express (port 3001)')

  while (Date.now() - start < MAX_MS) {
    try {
      const res = await fetch(HEALTH_URL)
      if (res.ok) {
        console.log(' — prête.')
        return true
      }
    } catch {
      /* API pas encore démarrée */
    }
    process.stdout.write('.')
    await new Promise((r) => setTimeout(r, INTERVAL_MS))
  }

  console.log(' — timeout (Next démarre quand même).')
  return false
}
