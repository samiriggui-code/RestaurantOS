#!/usr/bin/env node
/** Copie visuels vérifiés → public/images/menu/ + public/images/categories/ */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = readFileSync(join(root, 'lib/menu-images.ts'), 'utf8')

function parseQuotedBlock(name) {
  const block = src.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`))
  if (!block) return null
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

function parseRecord(name) {
  const block = src.match(new RegExp(`${name}:\\s*Record<string, string>\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!block) return {}
  const entries = [...block[1].matchAll(/(?:'([^']+)'|([a-z-]+)):\s*'([^']+)'/g)]
  return Object.fromEntries(entries.map((m) => [m[1] ?? m[2], m[3]]))
}

const stock = parseQuotedBlock('PIZZA_STOCK_IMAGES')
const slugs = parseQuotedBlock('PIZZA_ITEM_SLUGS')
const categorySources = parseRecord('CATEGORY_HERO_SOURCES')

if (!stock || !slugs) throw new Error('PIZZA_STOCK_IMAGES / PIZZA_ITEM_SLUGS not found')

const menuDir = join(root, 'public/images/menu')
const catDir = join(root, 'public/images/categories')
mkdirSync(menuDir, { recursive: true })
mkdirSync(catDir, { recursive: true })

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i]
  const rel = stock[i % stock.length]
  copyFileSync(join(root, 'public', rel.replace(/^\//, '')), join(menuDir, `${slug}.jpg`))
  process.stdout.write(`✓ menu/${slug}.jpg\n`)
}

for (const [id, rel] of Object.entries(categorySources)) {
  copyFileSync(join(root, 'public', rel.replace(/^\//, '')), join(catDir, `${id}.jpg`))
  process.stdout.write(`✓ categories/${id}.jpg ← ${rel}\n`)
}

console.log(`\nDone: ${slugs.length} pizzas + ${Object.keys(categorySources).length} bannières`)
