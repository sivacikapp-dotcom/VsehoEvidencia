import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import SpisDetailClient from "./SpisDetailClient"

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
      spracovatel: { select: { id: true, firstName: true, lastName: true } },
      zaznamy: {
        include: {
          zaznam: {
            select: {
              id: true, cisloZaznamu: true, formaZaznamu: true, stav: true, kategoria: true,
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

  const plans = await prisma.registraturnyPlan.findMany({ orderBy: { znacka: "asc" }, select: { id: true, znacka: true, nazov: true, lehota: true, maArchivnu: true } })

  const availableZaznamy = await prisma.regZaznam.findMany({
    where: isAdmin ? { stav: { not: "VYBAVENY" } } : { spracovatelId: userId, stav: { not: "VYBAVENY" } },
    select: { id: true, cisloZaznamu: true, formaZaznamu: true, stav: true, kategoria: true, plan: { select: { znacka: true, nazov: true } } },
    orderBy: { cisloZaznamu: "asc" },
  })

  const currentZaznamIds = new Set(spis.zaznamy.map(sz => sz.zaznamId))

  const data = {
    id: spis.id,
    cisloSpisu: spis.cisloSpisu,
    nazov: spis.nazov,
    plan: { id: spis.plan.id, znacka: spis.plan.znacka, nazov: spis.plan.nazov, lehota: spis.plan.lehota },
    spracovatel: `${spis.spracovatel.firstName} ${spis.spracovatel.lastName}`,
    status: spis.status,
    datumOtvorenia: spis.datumOtvorenia.toISOString().split("T")[0],
    datumUzatvorenia: spis.datumUzatvorenia ? spis.datumUzatvorenia.toISOString().split("T")[0] : null,
    rokVyradenia: spis.rokVyradenia,
    zaznamy: spis.zaznamy.map(sz => ({
      id: sz.zaznam.id,
      cisloZaznamu: sz.zaznam.cisloZaznamu,
      formaZaznamu: sz.zaznam.formaZaznamu,
      stav: sz.zaznam.stav,
      kategoria: sz.zaznam.kategoria,
      planZnacka: sz.zaznam.plan.znacka,
      planNazov: sz.zaznam.plan.nazov,
      addedAt: sz.addedAt.toISOString().split("T")[0],
    })),
  }

  const canManage = isSpracovatel && spis.spracovatelId === userId

  return (
    <div className="flex-1 overflow-auto">
      <SpisDetailClient
        spis={data}
        plans={plans.map(p => ({ id: p.id, znacka: p.znacka, nazov: p.nazov }))}
        availableZaznamy={availableZaznamy
          .filter(z => !currentZaznamIds.has(z.id))
          .map(z => ({
            id: z.id,
            cisloZaznamu: z.cisloZaznamu,
            formaZaznamu: z.formaZaznamu,
            stav: z.stav,
            kategoria: z.kategoria,
            planZnacka: z.plan.znacka,
            planNazov: z.plan.nazov,
          }))}
        canManage={canManage}
        isAdmin={isAdmin}
      />
    </div>
  )
}
