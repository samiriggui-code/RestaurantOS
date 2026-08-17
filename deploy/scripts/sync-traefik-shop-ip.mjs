#!/usr/bin/env node
/**
 * Sync IP WAN boutique → Traefik file provider.
 * Usage :
 *   node deploy/scripts/sync-traefik-shop-ip.mjs 203.0.113.42/32
 *   node deploy/scripts/sync-traefik-shop-ip.mjs --from-api  # lit GET /api/devices/public/access-status
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const defaultDir = join(root, 'deploy', 'traefik', 'dynamic')
const outDir = process.env.TRAEFIK_DYNAMIC_DIR || defaultDir

function writeYaml(ranges) {
  mkdirSync(outDir, { recursive: true })
  const filePath = join(outDir, 'pizzeria-shop-ip.yml')
  const yaml = [
    'http:',
    '  middlewares:',
    '    pizzeria-shop-ip:',
    '      ipWhiteList:',
    '        sourceRange:',
    ...ranges.map((r) => `          - "${r}"`),
    '',
  ].join('\n')
  writeFileSync(filePath, yaml, 'utf8')
  console.log(`[traefik-sync] ${filePath}`)
  console.log(`[traefik-sync] IPs: ${ranges.join(', ')}`)
}

async function fromApi() {
  const base = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api'
  const url = `${base.replace(/\/$/, '')}/devices/public/access-status`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  const ranges = data.allowedWanIps?.length ? data.allowedWanIps : []
  if (!ranges.length) {
    console.error('[traefik-sync] Aucune IP en BDD — capturez depuis le CRM sur le Wi-Fi shop.')
    process.exit(1)
  }
  writeYaml(ranges)
}

const args = process.argv.slice(2)
if (args[0] === '--from-api') {
  await fromApi()
} else if (args.length) {
  writeYaml(args)
} else {
  console.error('Usage: sync-traefik-shop-ip.mjs <ip/cidr> [ip2...] | --from-api')
  process.exit(1)
}
