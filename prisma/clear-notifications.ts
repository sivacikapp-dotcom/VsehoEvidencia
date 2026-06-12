import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_DIRECT_URL! }),
})

async function main() {
  const deletedNotifs = await prisma.notification.deleteMany({
    where: { type: "SUSPICIOUS_LOGIN" },
  })
  console.log("Zmazané notifikácie:", deletedNotifs.count)

  const deletedLogs = await prisma.auditLog.deleteMany({
    where: {
      action: "LOGIN_FAILURE",
      entityType: "AUTH_SUSPICIOUS",
      entityLabel: "sivak",
    },
  })
  console.log("Zmazané audit záznamy:", deletedLogs.count)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
