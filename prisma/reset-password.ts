import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hashPassword } from "@/lib/password"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_DIRECT_URL! }),
})

async function main() {
  const newPassword = "AdminHeslo123"
  const hash = await hashPassword(newPassword)
  const user = await prisma.user.update({
    where: { username: "admin" },
    data: { password: hash, loginAttempts: 0, lockedUntil: null },
    select: { username: true },
  })
  console.log("Heslo resetované pre:", user.username)
  console.log("Nové heslo:", newPassword)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
