#!/usr/bin/env node
/** Télécharge les visuels menu (pizza Pexels uniquement) → public/images/menu/{slug}.jpg */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/images/menu')
const src = readFileSync(join(__dirname, '../lib/menu-images.ts'), 'utf8')

const idsBlock = src.match(/PIZZA_PEXELS_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/)
const slugsBlock = src.match(/SLUGS_IN_ORDER\s*=\s*\[([\s\S]*?)\]\s*as const/)
if (!idsBlock || !slugsBlock) throw new Error('PIZZA_PEXELS_IDS / SLUGS_IN_ORDER not found')

const ids = [...idsBlock[1].matchAll(/(\d+)/g)].map((m) => Number(m[1]))
const slugs = [...slugsBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1])

if (ids.length !== slugs.length) {
  throw new Error(`Mismatch: ${ids.length} ids vs ${slugs.length} slugs`)
}

async function download(slug, pexelsId) {
  const url = `https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(join(outDir, `${slug}.jpg`), buf)
}

mkdirSync(outDir, { recursive: true })
let ok = 0
let fail = 0

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i]
  const id = ids[i]
  try {
    await download(slug, id)
    ok++
    process.stdout.write(`✓ ${slug}\n`)
  } catch (e) {
    fail++
    process.stderr.write(`✗ ${slug}: ${e.message}\n`)
  }
}

console.log(`\nDone: ${ok} ok, ${fail} failed / ${slugs.length} total`)
