import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isPrivateOrReservedIp } from './device-settings'

/**
 * Écrit le middleware Traefik file-provider (IP shop) depuis le CRM.
 * Montage Docker : ./deploy/traefik/dynamic → TRAEFIK_DYNAMIC_DIR (/traefik-dynamic).
 * Traefik externe doit charger ce dossier (--providers.file.directory).
 */
export function syncTraefikShopIp(allowedWanIps: string[]): {
  synced: boolean
  path?: string
  reason?: string
} {
  const dir = process.env.TRAEFIK_DYNAMIC_DIR?.trim()
  if (!dir) {
    return { synced: false, reason: 'TRAEFIK_DYNAMIC_DIR non configuré' }
  }

  const ranges = allowedWanIps
    .map((ip) => ip.trim())
    .filter(Boolean)
    .filter((entry) => !isPrivateOrReservedIp(entry.split('/')[0] ?? entry))
  if (!ranges.length) {
    return { synced: false, reason: 'aucune IP WAN' }
  }

  try {
    mkdirSync(dir, { recursive: true })
    const filePath = join(dir, 'pizzeria-shop-ip.yml')
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
    return { synced: true, path: filePath }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'écriture impossible'
    console.warn('[traefik-ip-sync]', reason)
    return { synced: false, reason }
  }
}
