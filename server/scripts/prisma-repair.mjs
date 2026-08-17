#!/usr/bin/env node
/**
 * Répare le drift Prisma local (colonnes déjà en BDD mais migration marquée failed).
 * Usage : npm run prisma:repair --prefix server
 */
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(__dirname, '..')

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: serverRoot, ...opts })
}

function tryRun(cmd) {
  try {
    run(cmd)
    return true
  } catch {
    return false
  }
}

/** Migrations connues pour drift Laragon (db push / apply manuel avant migrate). */
const DRIFT_CHECKS = [
  {
    name: '20260709020000_order_driver_trail',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_name = 'Order' AND column_name = 'driverId' LIMIT 1`,
  },
  {
    name: '20260709090000_loyalty_free_pizza',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_name = 'LoyaltyProgram' AND column_name = 'pointsForFreePizza' LIMIT 1`,
  },
  {
    name: '20260709120000_fiscal_isca',
    sql: `SELECT 1 FROM information_schema.tables WHERE table_name = 'FiscalTicket' LIMIT 1`,
  },
]

async function main() {
  const prisma = new PrismaClient()

  try {
    console.log('═══ Prisma repair — drift local Laragon ═══')

    const failed = await prisma.$queryRawUnsafe(
      `SELECT migration_name FROM "_prisma_migrations"
       WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
    )

    if (failed.length > 0) {
      console.log('\nMigrations en échec détectées :')
      for (const row of failed) {
        console.log(`  - ${row.migration_name}`)
      }
    }

    for (const check of DRIFT_CHECKS) {
      const rows = await prisma.$queryRawUnsafe(check.sql)
      if (rows.length === 0) continue

      const pending = await prisma.$queryRawUnsafe(
        `SELECT migration_name FROM "_prisma_migrations"
         WHERE migration_name = '${check.name}' AND finished_at IS NULL`,
      )

      const applied = await prisma.$queryRawUnsafe(
        `SELECT migration_name FROM "_prisma_migrations"
         WHERE migration_name = '${check.name}' AND finished_at IS NOT NULL`,
      )

      if (applied.length > 0) continue

      if (pending.length > 0 || failed.some((f) => f.migration_name === check.name)) {
        console.log(`\n✓ Drift détecté pour ${check.name} — marquage applied`)
        run(`npx prisma migrate resolve --applied ${check.name}`)
      }
    }

    run('npx prisma migrate deploy')

    let generated = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (tryRun('npx prisma generate')) {
        generated = true
        break
      }
      if (attempt < 3) {
        console.log(`\n⚠ generate verrouillé (tentative ${attempt}/3) — nouvel essai dans 2s…`)
        execSync('timeout /t 2 /nobreak >nul', { stdio: 'ignore', shell: true })
      }
    }
    if (!generated) {
      console.log('\n⚠ prisma generate a échoué (fichier verrouillé). Ferme les terminaux dev puis :')
      console.log('   npm run prisma:generate --prefix server')
    }

    console.log('\n✅ Prisma repair terminé. Tu peux lancer : npm run db:seed --prefix server')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('\n❌ Prisma repair échoué :', err.message ?? err)
  process.exit(1)
})
