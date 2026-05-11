import { prisma } from "../src/lib/prisma"
import bcrypt from "bcryptjs"

async function main() {
  const hash = await bcrypt.hash("Test123456", 12)
  const result = await prisma.user.updateMany({ data: { password: hash } })
  console.log(`Aktualizovaných používateľov: ${result.count}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
