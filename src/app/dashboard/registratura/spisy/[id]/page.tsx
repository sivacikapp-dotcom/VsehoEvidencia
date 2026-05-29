import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import SpisDetailClient from "./SpisDetailClient"

function computeForma(formy: string[]): "ELEKTRONICKY" | "NEELEKTRONICKY" | "KOMBINOVANY" | null {
  if (formy.length === 0) return null
  const unique = new Set(formy)
  if (unique.size === 1) return formy[0] as "ELEKTRONICKY" | "NEELEKTRONICKY"
  return "KOMBINOVANY"
}

function computeDovernost(doverne: string[]): "VEREJNE" | "INTERNE" | "DOVERNE" | null {
  if (doverne.length === 0) return null
  if (doverne.includes("DOVERNE")) return "DOVERNE"
  if (doverne.includes("INTERNE")) return "INTERNE"
  return "VEREJNE"
}

export default async function SpisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const roles = session.user.roles as string[]
  const userId = parseInt(session.user.id)
  const isAdmin = roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
  const isSpracovatel = roles.includes("SPRACOVATEL_REGISTRATURY")
  if (!isAdmin && !isSpracovatel) redirect("/dashboard")

  const spis = await prisma.spis.findUnique({
    where: { id: parseInt(id) },
    include: {
      plan: true,
      utvar: { select: { id: true, nazov: true } },
      spracovatel: { select: { id: true, firstName: true, lastName: true } },
      zaznamy: {
        include: {
          zaznam: {
            select: {
              id: true, cisloZaznamu: true, formaZaznamu: true, stav: true,
              kategoria: true, dovernost: true,
              plan: { select: { znacka: true, nazov: true } },
            },
          },
        },
        orderBy: { addedAt: "asc" },
      },
    },
  })
  if (!spis) notFound()
  if (!isAdmin && spis.spracovatelId !== userId) redirect("/dashboard/registratura/spisy")

  const [plans, spracovatelov, utvary, availableZaznamy] = await Promise.all([
    prisma.registraturnyPlan.findMany({
      orderBy: { znacka: "asc" },
      select: { id: true, znacka: true, nazov: true, lehota: true, maArchivnu: true },
    }),
    prisma.user.findMany({
      where: { roles: { has: "SPRACOVATEL_REGISTRATURY" } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.utvar.findMany({ orderBy: { nazov: "asc" }, select: { id: true, nazov: true } }),
    prisma.regZaznam.findMany({
      where: isAdmin ? { stav: { not: "VYBAVENY" } } : { spracovatelId: userId, stav: { not: "VYBAVENY" } },
      select: {
        id: true, cisloZaznamu: true, formaZaznamu: true, stav: true, kategoria: true,
        plan: { select: { znacka: true, nazov: true } },
      },
      orderBy: { cisloZaznamu: "asc" },
    }),
  ])

  const zaznamyFormy = spis.zaznamy.map(sz => sz.zaznam.formaZaznamu)
  const zaznamyDoverne = spis.zaznamy.map(sz => sz.zaznam.dovernost)
  const forma = computeForma(zaznamyFormy)
  const dovernost = computeDovernost(zaznamyDoverne)

  const currentZaznamIds = new Set(spis.zaznamy.map(sz => sz.zaznamId))
  const canManage = isAdmin || (isSpracovatel && spis.spracovatelId === userId)

  return (
    <div className="flex-1 overflow-auto">
      <SpisDetailClient
        spis={{
          id: spis.id,
          cisloSpisu: spis.cisloSpisu,
          nazov: spis.nazov,
          rok: spis.rok,
          popis: spis.popis,
          utvar: spis.utvar ? { id: spis.utvar.id, nazov: spis.utvar.nazov } : null,
          plan: { id: spis.plan.id, znacka: spis.plan.znacka, nazov: spis.plan.nazov, lehota: spis.plan.lehota },
          spracovatelId: spis.spracovatelId,
          spracovatel: `${spis.spracovatel.firstName} ${spis.spracovatel.lastName}`,
          status: spis.status,
          datumOtvorenia: spis.datumOtvorenia.toISOString().split("T")[0],
          datumUzatvorenia: spis.datumUzatvorenia ? spis.datumUzatvorenia.toISOString().split("T")[0] : null,
          rokVyradenia: spis.rokVyradenia,
          forma,
          dovernost,
          zaznamy: spis.zaznamy.map(sz => ({
            id: sz.zaznam.id,
            cisloZaznamu: sz.zaznam.cisloZaznamu,
            formaZaznamu: sz.zaznam.formaZaznamu,
            stav: sz.zaznam.stav,
            kategoria: sz.zaznam.kategoria,
            planZnacka: sz.zaznam.plan?.znacka ?? "",
            planNazov: sz.zaznam.plan?.nazov ?? "",
            addedAt: sz.addedAt.toISOString().split("T")[0],
          })),
        }}
        plans={plans.map(p => ({ id: p.id, znacka: p.znacka, nazov: p.nazov }))}
        spracovatelov={spracovatelov}
        utvary={utvary}
        availableZaznamy={availableZaznamy
          .filter(z => !currentZaznamIds.has(z.id))
          .map(z => ({
            id: z.id, cisloZaznamu: z.cisloZaznamu, formaZaznamu: z.formaZaznamu,
            stav: z.stav, kategoria: z.kategoria,
            planZnacka: z.plan?.znacka ?? "", planNazov: z.plan?.nazov ?? "",
          }))}
        canManage={canManage}
        isAdmin={isAdmin}
      />
    </div>
  )
}
