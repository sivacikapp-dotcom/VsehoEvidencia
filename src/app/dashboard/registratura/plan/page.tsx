import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import PlanClient from "./PlanClient"

export default async function PlanPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const roles = session.user.roles as string[]

  const isAdmin = roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
  if (!isAdmin) redirect("/dashboard")

  const plans = await prisma.registraturnyPlan.findMany({
    orderBy: { znacka: "asc" },
    include: { _count: { select: { zaznamy: true, spisy: true } } },
  })

  return (
    <div className="flex-1 overflow-auto">
      <PlanClient
        plans={plans.map(p => ({
          id: p.id,
          znacka: p.znacka,
          nazov: p.nazov,
          lehota: p.lehota,
          maArchivnu: p.maArchivnu,
          pocetZaznamov: p._count.zaznamy,
          pocetSpisov: p._count.spisy,
        }))}
      />
    </div>
  )
}
