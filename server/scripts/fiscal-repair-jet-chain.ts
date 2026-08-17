#!/usr/bin/env tsx
/**
 * Répare la chaîne JET (recordHash / previousHash) — labo après migrations ou bug horodatage.
 * Usage : npm run fiscal:repair-jet --prefix server [businessId]
 *         Sans businessId : répare tous les établissements.
 */
import dotenv from 'dotenv'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { repairFiscalEventChain } from '../src/lib/fiscal/repair-jet-chain'

dotenv.config({ path: path.join(__dirname, '..', '.env') })

async function main() {
  const prisma = new PrismaClient()
  const singleId = process.argv[2]
  try {
    const businesses = singleId
      ? [{ id: singleId }]
      : await prisma.business.findMany({
          where: { id: { not: '' } },
          select: { id: true },
        })

    let allOk = true
    for (const biz of businesses) {
      const result = await repairFiscalEventChain(prisma, biz.id)
      console.log(JSON.stringify({ businessId: biz.id, ...result }, null, 2))
      if (!result.verifyOk) allOk = false
    }
    process.exit(allOk ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

void main()
