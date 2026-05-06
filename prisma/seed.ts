import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_DIRECT_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const hash = await bcrypt.hash("heslo123", 12)

  const user = await prisma.user.upsert({
    where: { email: "admin@test.sk" },
    update: {},
    create: {
      firstName: "Admin",
      lastName: "Správca",
      email: "admin@test.sk",
      password: hash,
      roles: ["SPRAVCA_KARIET"],
    },
  })

  console.log("Testovací používateľ vytvorený:", user.email)
  console.log("Heslo: heslo123")

  // Seed admin as document admin
  await prisma.user.update({
    where: { email: "admin@test.sk" },
    data: { docRole: "SPRAVCA_DOKUMENTOV" },
  })

  // Seed initial agendas
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
