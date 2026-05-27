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
              id: true, cisloZaznamu: true, typZaznamu: true, status: true,
              plan: { select: { znacka: true, nazov: true } },
            },
          },
        },
        orderBy: { addedAt: "asc" },
      },
    },
  })
  if (!spis) notFound()

  // RBAC: spracovatel can only see their own spisy
  if (!isAdmin && spis.spracovatelId !== userId) redirect("/dashboard/registratura/spisy")

  const plans = await prisma.registraturnyPlan.findMany({ orderBy: { znacka: "asc" } })

  // For adding zaznamy: load available zaznamy for this user
  const availableZaznamy = await prisma.regZaznam.findMany({
    where: isAdmin ? { status: { not: "VYRADENY" } } : { spracovatelId: userId, status: { not: "VYRADENY" } },
    select: { id: true, cisloZaznamu: true, typZaznamu: true, status: true, plan: { select: { znacka: true, nazov: true } } },
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
      typZaznamu: sz.zaznam.typZaznamu,
      status: sz.zaznam.status,
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
            typZaznamu: z.typZaznamu,
            status: z.status,
            planZnacka: z.plan.znacka,
            planNazov: z.plan.nazov,
          }))}
        canManage={canManage}
        isAdmin={isAdmin}
      />
    </div>
  )
}
