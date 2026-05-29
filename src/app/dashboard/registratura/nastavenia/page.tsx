import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import NastaveniaRegistraturyClient from "./NastaveniaRegistraturyClient"

export default async function NastaveniaRegistraturyPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (!session.user.roles.includes("SPRAVCA_REGISTRATURY")) redirect("/dashboard")

  const raw = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, roles: true },
    orderBy: { lastName: "asc" },
  })

  const users = raw.map(u => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    hasPodatelna:  u.roles.includes("PRACOVNIK_PODATELNE"),
    hasSpracovatel: u.roles.includes("SPRACOVATEL_REGISTRATURY"),
  }))

  return (
    <div className="flex-1 overflow-auto p-8">
      <NastaveniaRegistraturyClient users={users} />
    </div>
  )
}
