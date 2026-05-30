import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import NastaveniaRegistraturyClient from "./NastaveniaRegistraturyClient"
import { getAllCislonik, type CislonikTyp } from "@/lib/cislonik"

export default async function NastaveniaRegistraturyPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (!session.user.roles.includes("SPRAVCA_REGISTRATURY")) redirect("/dashboard")

  const TYPY: CislonikTyp[] = ["SPOSOB_DORUCENIA", "STAV_ZAZNAMU", "STAV_SPISU", "SPOSOB_VYBAVENIA"]
  const REG_ROLES = ["SPRAVCA_REGISTRATURY", "PRACOVNIK_PODATELNE", "SPRACOVATEL_REGISTRATURY"]
  const [rawUsers, rawPlan, ...cislonikArrays] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, roles: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.registraturnyPlan.findMany({
      orderBy: { znacka: "asc" },
    }),
    ...TYPY.map(t => getAllCislonik(t)),
  ])
  const cislonik = Object.fromEntries(TYPY.map((t, i) => [t, cislonikArrays[i]])) as Record<CislonikTyp, Awaited<ReturnType<typeof getAllCislonik>>>

  const users = rawUsers.map(u => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    regRoles: (u.roles as string[]).filter(r => REG_ROLES.includes(r)),
  }))

  const plan = rawPlan.map(p => ({
    id: p.id,
    znacka: p.znacka,
    nazov: p.nazov,
    lehota: p.lehota,
    maArchivnu: p.maArchivnu,
  }))

  return (
    <div className="flex-1 overflow-auto p-8">
      <NastaveniaRegistraturyClient users={users} plan={plan} cislonik={cislonik} />
    </div>
  )
}
