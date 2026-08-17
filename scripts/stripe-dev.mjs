#!/usr/bin/env node
/**
 * Stripe CLI — tunnel webhooks → Express (port 3001)
 *
 * Usage : node scripts/stripe-dev.mjs
 * Prérequis : stripe login (une fois)
 *
 * Copier le whsec_ affiché dans server/.env → STRIPE_WEBHOOK_SECRET
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const forwardUrl = 'localhost:3001/api/payments/webhook'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

console.log('')
console.log('  Stripe — tunnel webhooks local')
console.log('  ─────────────────────────────')
console.log(`  Forward → http://${forwardUrl}`)
console.log('  API Express (3001) — source de vérité webhook')
console.log('')
console.log('  1. Laissez ce terminal ouvert pendant les tests paiement')
console.log('  2. Copiez whsec_… dans server/.env → STRIPE_WEBHOOK_SECRET')
console.log('  3. Redémarrez le serveur API si le secret change')
console.log('')

const child = spawn('stripe', ['listen', '--forward-to', forwardUrl], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
  cwd: root,
})

let secretPrinted = false

function onData(chunk) {
  const text = chunk.toString()
  process.stdout.write(text)
  if (!secretPrinted) {
    const match = text.match(/whsec_[a-zA-Z0-9]+/)
    if (match) {
      secretPrinted = true
      console.log('')
      console.log('  ── Webhook secret (Stripe CLI) ──')
      console.log(`  STRIPE_WEBHOOK_SECRET="${match[0]}"`)
      console.log('  → server/.env')
      console.log('')
    }
  }
}

child.stdout?.on('data', onData)
child.stderr?.on('data', (chunk) => process.stderr.write(chunk))

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('Stripe CLI introuvable. Installez : https://stripe.com/docs/stripe-cli')
    process.exit(1)
  }
  throw err
})

child.on('exit', (code) => process.exit(code ?? 0))

process.on('SIGINT', () => child.kill('SIGINT'))
