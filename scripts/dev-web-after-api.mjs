#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { waitForApi } from './wait-api.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const https = process.argv.includes('--https')
const npmScript = https ? 'dev:https' : 'dev'

await waitForApi()

const child = spawn('npm', ['run', npmScript, '--prefix', 'app.pizzeria.fr'], {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env: process.env,
})

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0))
})
