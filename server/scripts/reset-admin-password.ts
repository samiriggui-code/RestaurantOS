/** Réinitialise le mot de passe admin La Z Pizza → admin123 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { lazPizzaStaffEmail } from '../src/lib/laz-pizza-identity'

const prisma = new PrismaClient()

async function main() {
  const email = lazPizzaStaffEmail('atmane', 'chennit')
  const password = await bcrypt.hash('admin123', 12)
  const user = await prisma.user.update({
    where: { email },
    data: { password, isActive: true, role: 'ADMIN' },
  })
  console.log(`Mot de passe réinitialisé pour ${user.email}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
