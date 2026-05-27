import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ZaznamyClient from "./ZaznamyClient"

export default async function ZaznamyPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const roles = session.user.roles as string[]
  const userId = parseInt(session.user.id)

  const isAdmin = roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
  const isSpracovatel = roles.includes("SPRACOVATEL_REGISTRATURY")
  if (!isAdmin && !isSpracovatel) redirect("/dashboard")

  const whereClause = isAdmin ? {} : { spracovatelId: userId }

  const [zaznamyRaw, plans] = await Promise.all([
    prisma.regZaznam.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        plan: { select: { znacka: true, nazov: true } },
        spracovatel: { select: { firstName: true, lastName: true } },
        posta: { select: { poradoveCislo: true } },
        _count: { select: { spisy: true } },
      },
    }),
    prisma.registraturnyPlan.findMany({ orderBy: { znacka: "asc" } }),
  ])

  const zaznamy = zaznamyRaw.map(z => ({
    id: z.id,
    cisloZaznamu: z.cisloZaznamu,
    planZnacka: z.plan.znacka,
    planNazov: z.plan.nazov,
    spracovatel: `${z.spracovatel.firstName} ${z.spracovatel.lastName}`,
    typZaznamu: z.typZaznamu,
    status: z.status,
    hasFile: !!z.storedName,
    originalName: z.originalName,
    fileSize: z.fileSize,
    postaRef: z.posta?.poradoveCislo ?? null,
    pocetSpisov: z._count.spisy,
    createdAt: z.createdAt.toISOString().split("T")[0],
  }))

  return (
    <div className="flex-1 overflow-auto">
      <ZaznamyClient
        zaznamy={zaznamy}
        plans={plans.map(p => ({ id: p.id, znacka: p.znacka, nazov: p.nazov }))}
        isAdmin={isAdmin}
        canCreate={isSpracovatel}
      />
    </div>
  )
}
