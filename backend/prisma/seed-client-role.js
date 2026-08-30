import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const role1 = await prisma.role.upsert({
    where: { name: 'client' },
    update: { description: 'Default client role' },
    create: { name: 'client', description: 'Default client role' },
  })
  const role2 = await prisma.role.upsert({
    where: { name: 'Client' },
    update: { description: 'Default Client role' },
    create: { name: 'Client', description: 'Default Client role' },
  })
  console.log('Successfully seeded client roles:', role1.name, role2.name)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
