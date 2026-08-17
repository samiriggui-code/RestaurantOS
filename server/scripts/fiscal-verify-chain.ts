#!/usr/bin/env tsx
/**
 * Vérification intégrité chaînes fiscales ISCA (art. 286 CGI).
 * Usage : npm run fiscal:verify-chain --prefix server [-- businessId]
 */
import dotenv from 'dotenv'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { verifyFiscalChains } from '../src/lib/fiscal'

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const businessId =
  process.argv[2] || process.env.BUSINESS_ID || '00000000-0000-0000-0000-000000000001'

async function main() {
  const prisma = new PrismaClient()
  try {
    const result = await verifyFiscalChains(prisma, businessId)
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.ok ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

void main()
