import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import NastaveniaDokumentyClient from "./NastaveniaDokumentyClient"

export default async function NastaveniaDokumentyPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (!session.user.roles.includes("SPRAVCA_DOKUMENTOV")) redirect("/dashboard")

  const raw = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, roles: true },
    orderBy: { lastName: "asc" },
  })

  const users = raw.map(u => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    hasGestorAgendy:    u.roles.includes("GESTOR_AGENDY"),
    hasGestorDokumentu: u.roles.includes("GESTOR_DOKUMENTU"),
  }))

  return (
    <div className="flex-1 overflow-auto p-8">
      <NastaveniaDokumentyClient users={users} />
    </div>
  )
}
