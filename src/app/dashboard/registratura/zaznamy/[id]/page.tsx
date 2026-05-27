import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import ZaznamDetailClient from "./ZaznamDetailClient"

export default async function ZaznamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const roles = session.user.roles as string[]
  const userId = parseInt(session.user.id)
  const isAdmin = roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
  const isSpracovatel = roles.includes("SPRACOVATEL_REGISTRATURY")
  if (!isAdmin && !isSpracovatel) redirect("/dashboard")

  const zaznam = await prisma.regZaznam.findUnique({
    where: { id: parseInt(id) },
    include: {
      plan: true,
      spracovatel: { select: { id: true, firstName: true, lastName: true } },
      posta: { select: { id: true, poradoveCislo: true, vec: true } },
      spisy: {
        include: { spis: { select: { id: true, cisloSpisu: true, nazov: true, status: true } } },
      },
    },
  })
  if (!zaznam) notFound()

  // RBAC: spracovatel can only see their own records
  if (!isAdmin && zaznam.spracovatelId !== userId) redirect("/dashboard/registratura/zaznamy")

  const plans = await prisma.registraturnyPlan.findMany({ orderBy: { znacka: "asc" } })

  const data = {
    id: zaznam.id,
    cisloZaznamu: zaznam.cisloZaznamu,
    plan: { id: zaznam.plan.id, znacka: zaznam.plan.znacka, nazov: zaznam.plan.nazov, lehota: zaznam.plan.lehota, maArchivnu: zaznam.plan.maArchivnu },
    spracovatel: `${zaznam.spracovatel.firstName} ${zaznam.spracovatel.lastName}`,
    typZaznamu: zaznam.typZaznamu,
    umiestnenieFyzicke: zaznam.umiestnenieFyzicke,
    originalName: zaznam.originalName,
    fileSize: zaznam.fileSize,
    fileHash: zaznam.fileHash,
    status: zaznam.status,
    posta: zaznam.posta ? { id: zaznam.posta.id, poradoveCislo: zaznam.posta.poradoveCislo, vec: zaznam.posta.vec } : null,
    spisy: zaznam.spisy.map(sz => ({
      id: sz.spis.id,
      cisloSpisu: sz.spis.cisloSpisu,
      nazov: sz.spis.nazov,
      status: sz.spis.status,
    })),
    createdAt: zaznam.createdAt.toISOString().split("T")[0],
    updatedAt: zaznam.updatedAt.toISOString().split("T")[0],
  }

  const canEdit = !isAdmin || (isAdmin && !roles.includes("SPRAVCA_APLIKACIE"))
  // SPRAVCA_REGISTRATURY has read-only per spec (no create/edit), but SPRACOVATEL can edit own
  const canManage = isSpracovatel && zaznam.spracovatelId === userId

  return (
    <div className="flex-1 overflow-auto">
      <ZaznamDetailClient
        zaznam={data}
        plans={plans.map(p => ({ id: p.id, znacka: p.znacka, nazov: p.nazov }))}
        canManage={canManage}
        isAdmin={isAdmin}
      />
    </div>
  )
}
