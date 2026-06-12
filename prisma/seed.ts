import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hashPassword } from "@/lib/password"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_DIRECT_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const seedPassword = process.env.SEED_ADMIN_PASSWORD
  if (!seedPassword || seedPassword.length < 10) {
    throw new Error(
      "Set SEED_ADMIN_PASSWORD in .env (min 10 chars) before running seed. " +
      "See .env.example."
    )
  }

  const hash = await hashPassword(seedPassword)

  const user = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      firstName: "Admin",
      lastName: "Správca",
      email: "admin@test.sk",
      password: hash,
      roles: ["SPRAVCA_MAJETKU"],
    },
  })

  console.log("Testovací používateľ vytvorený:", user.username)

  await prisma.user.update({
    where: { username: "admin" },
    data: { roles: { push: "SPRAVCA_DOKUMENTOV" } },
  })

  const agendaNames = [
    "Všeobecné smernice",
    "Bezpečnostné smernice",
    "HR smernice",
    "Fin smernice",
    "Iné všeobecné dokumenty",
    "Iné BP dokumenty",
    "Iné HR dokumenty",
    "Iné Fin dokumenty",
  ]

  for (const name of agendaNames) {
    await prisma.agenda.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  console.log("Agendy vytvorené:", agendaNames.length)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
