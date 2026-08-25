import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const businessId = process.env.BUSINESS_ID;

async function main(): Promise<void> {
  if (!businessId) throw new Error('BUSINESS_ID manquant dans .env');

  const existing = await prisma.loyaltyProgram.findFirst({ where: { businessId } });
  const data = {
    pointsPerDinar: 1,
    pointsForFreePizza: 10,
    minPointsRedeem: 10,
    enabled: true,
    dinarPerPoint: 0,
  };
  const program = existing
    ? await prisma.loyaltyProgram.update({ where: { id: existing.id }, data })
    : await prisma.loyaltyProgram.create({ data: { businessId, ...data } });

  console.log('Programme fidélité :', JSON.stringify(program, null, 2));
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
