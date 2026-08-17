#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const child = spawn('npm', ['run', 'dev', '--prefix', 'server'], {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env: process.env,
})

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0))
})
