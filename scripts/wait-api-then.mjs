#!/usr/bin/env node
/**
 * Attend l'API puis lance la commande passée en argument (ex. Next dev).
 * Usage : node scripts/wait-api-then.mjs "npm run dev-inner-web"
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { waitForApi } from './wait-api.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const command = process.argv.slice(2).join(' ')

if (!command) {
  console.error('Usage: node scripts/wait-api-then.mjs "<commande>"')
  process.exit(1)
}

await waitForApi()

const child = spawn(command, {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env: process.env,
})

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0))
})
