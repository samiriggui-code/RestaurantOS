#!/usr/bin/env node
/**
 * Démarre le stack dev après libération des ports.
 * À l'arrêt (Ctrl+C), tue les processus restants sur ces ports.
 *
 * Usage : node scripts/dev.mjs [all|dev|legacy|server|web|client|mobile]
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { killDevPorts, DEFAULT_DEV_PORTS } from './kill-dev-ports.mjs'
import { PORTS, DEV_STACK_PORTS, printPortBanner } from './ports.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const concurrentlyBin = join(root, 'node_modules', 'concurrently', 'dist', 'bin', 'concurrently.js')

if (!existsSync(concurrentlyBin)) {
  console.error('[dev] concurrently introuvable — lancez npm install à la racine.')
  process.exit(1)
}

/** Une commande = un script node (pas de guillemets imbriqués — Windows CMD). */
const RUN = {
  server: 'node scripts/dev-server.mjs',
  web: 'node scripts/dev-web.mjs',
  webAfterApi: 'node scripts/dev-web-after-api.mjs',
  webHttpsAfterApi: 'node scripts/dev-web-after-api.mjs --https',
  client: 'node scripts/dev-client.mjs',
}

const PROFILES = {
  all: {
    ports: DEFAULT_DEV_PORTS,
    concurrently: {
      names: 'server,web,legacy',
      colors: 'blue,magenta,green',
      commands: [RUN.server, RUN.webAfterApi, RUN.client],
    },
  },
  dev: {
    ports: DEV_STACK_PORTS,
    concurrently: {
      names: 'server,web',
      colors: 'blue,magenta',
      commands: [RUN.server, RUN.webAfterApi],
    },
  },
  mobile: {
    ports: DEV_STACK_PORTS,
    concurrently: {
      names: 'server,web',
      colors: 'blue,magenta',
      commands: [RUN.server, RUN.webHttpsAfterApi],
    },
  },
  legacy: {
    ports: [PORTS.API, PORTS.LEGACY_VITE, PORTS.LEGACY_VITE_ALT],
    concurrently: {
      names: 'server,client',
      colors: 'blue,green',
      commands: [RUN.server, RUN.client],
    },
  },
  server: { ports: [PORTS.API], command: RUN.server },
  web: { ports: [PORTS.WEB], command: RUN.web },
  client: { ports: [PORTS.LEGACY_VITE, PORTS.LEGACY_VITE_ALT], command: RUN.client },
}

function spawnConcurrently({ names, colors, commands }) {
  const args = [
    concurrentlyBin,
    '--kill-others',
    '-n',
    names,
    '-c',
    colors,
    ...commands,
  ]
  return spawn(process.execPath, args, {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
  })
}

function spawnCommand(command) {
  return spawn(command, {
    stdio: 'inherit',
    shell: true,
    cwd: root,
    env: process.env,
  })
}

const profileName = process.argv[2] || 'dev'
const profile = PROFILES[profileName]

if (!profile) {
  console.error(`Profil inconnu : ${profileName}`)
  console.error(`Profils : ${Object.keys(PROFILES).join(', ')}`)
  process.exit(1)
}

printPortBanner(profileName)
console.log(`[dev] Libération des ports ${profile.ports.join(', ')}…`)
killDevPorts(profile.ports)

const launchLabel = profile.concurrently
  ? `node concurrently → ${profile.concurrently.commands.join(' | ')}`
  : profile.command
console.log(`[dev] ${launchLabel}\n`)

const child = profile.concurrently
  ? spawnConcurrently(profile.concurrently)
  : spawnCommand(profile.command)

let stopping = false

function shutdown(signal) {
  if (stopping) return
  stopping = true
  console.log(`\n[dev] Arrêt (${signal}) — nettoyage des ports…`)
  if (!child.killed) {
    child.kill('SIGTERM')
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL')
    }, 2000).unref()
  }
  setTimeout(() => {
    killDevPorts(profile.ports)
    process.exit(0)
  }, 400).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code, signal) => {
  if (stopping) return
  killDevPorts(profile.ports)
  process.exit(code ?? (signal ? 1 : 0))
})
