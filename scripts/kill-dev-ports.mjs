#!/usr/bin/env node
/**
 * Libère les ports de dev (Next, Express, Vite).
 * Usage : node scripts/kill-dev-ports.mjs [3000 3001 ...]
 */
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { ALL_DEV_PORTS } from './ports.mjs'

export const DEFAULT_DEV_PORTS = ALL_DEV_PORTS

function killPortWindows(port) {
  let killed = 0
  try {
    const out = execSync(`netstat -ano | findstr ":${port} " | findstr LISTENING`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const parts = trimmed.split(/\s+/)
      const pid = parts[parts.length - 1]
      if (/^\d+$/.test(pid) && pid !== '0') pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' })
        killed++
        console.log(`[dev:stop] port ${port} → PID ${pid} terminé`)
      } catch {
        /* déjà mort */
      }
    }
  } catch {
    /* aucun listener sur ce port */
  }
  return killed
}

function killPortUnix(port) {
  try {
    execSync(`lsof -ti tcp:${port} -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null`, {
      shell: true,
      stdio: 'ignore',
    })
    console.log(`[dev:stop] port ${port} libéré`)
    return 1
  } catch {
    return 0
  }
}

export function killDevPorts(ports = DEFAULT_DEV_PORTS) {
  const unique = [...new Set(ports.map(Number).filter((p) => p > 0))]
  let total = 0
  for (const port of unique) {
    total += process.platform === 'win32' ? killPortWindows(port) : killPortUnix(port)
  }
  if (total === 0) {
    console.log(`[dev:stop] ports déjà libres (${unique.join(', ')})`)
  }
  return total
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const ports = process.argv.slice(2).map(Number).filter((p) => p > 0)
  killDevPorts(ports.length ? ports : DEFAULT_DEV_PORTS)
}
