import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import SpisyClient from "./SpisyClient"

export default async function SpisyPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const roles = session.user.roles as string[]
  const userId = parseInt(session.user.id)

  const isAdmin = roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
  const isSpracovatel = roles.includes("SPRACOVATEL_REGISTRATURY")
  if (!isAdmin && !isSpracovatel) redirect("/dashboard")

  const whereClause = isAdmin ? {} : { spracovatelId: userId }

  const [spisyRaw, plans] = await Promise.all([
    prisma.spis.findMany({
      where: whereClause,
      orderBy: { datumOtvorenia: "desc" },
      include: {
        plan: { select: { znacka: true, nazov: true } },
        spracovatel: { select: { firstName: true, lastName: true } },
        _count: { select: { zaznamy: true } },
      },
    }),
    prisma.registraturnyPlan.findMany({ orderBy: { znacka: "asc" } }),
  ])

  const spisy = spisyRaw.map(s => ({
    id: s.id,
    cisloSpisu: s.cisloSpisu,
    nazov: s.nazov,
    planZnacka: s.plan.znacka,
    planNazov: s.plan.nazov,
    spracovatel: `${s.spracovatel.firstName} ${s.spracovatel.lastName}`,
    status: s.status,
    datumOtvorenia: s.datumOtvorenia.toISOString().split("T")[0],
    datumUzatvorenia: s.datumUzatvorenia ? s.datumUzatvorenia.toISOString().split("T")[0] : null,
    rokVyradenia: s.rokVyradenia,
    pocetZaznamov: s._count.zaznamy,
  }))

  return (
    <div className="flex-1 overflow-auto">
      <SpisyClient
        spisy={spisy}
        plans={plans.map(p => ({ id: p.id, znacka: p.znacka, nazov: p.nazov }))}
        isAdmin={isAdmin}
        canCreate={isSpracovatel}
      />
    </div>
  )
}
