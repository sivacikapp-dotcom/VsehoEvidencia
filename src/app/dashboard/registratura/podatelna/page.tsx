import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import PodatelnaClient from "./PodatelnaClient"

export default async function PodatelnaPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const roles = session.user.roles as string[]
  if (!roles.includes("PRACOVNIK_PODATELNE") && !roles.includes("SPRAVCA_REGISTRATURY") && !roles.includes("SPRAVCA_APLIKACIE")) {
    redirect("/dashboard")
  }

  const [postaRaw, plans, spracovatelia] = await Promise.all([
    prisma.posta.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        attachments: { select: { id: true, originalName: true, size: true } },
        zaznam: { select: { id: true, cisloZaznamu: true } },
      },
    }),
    prisma.registraturnyPlan.findMany({ orderBy: { znacka: "asc" } }),
    prisma.user.findMany({
      where: { roles: { has: "SPRACOVATEL_REGISTRATURY" } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ])

  const posta = postaRaw.map(p => ({
    id: p.id,
    poradoveCislo: p.poradoveCislo,
    smer: p.smer,
    datumDoruceOdoslania: p.datumDoruceOdoslania.toISOString().split("T")[0],
    sposob: p.sposob,
    odosielatelPrijemcaNazov: p.odosielatelPrijemcaNazov,
    odosielatelPrijemcaAdresa: p.odosielatelPrijemcaAdresa,
    odosielatelPrijemcaIco: p.odosielatelPrijemcaIco,
    vec: p.vec,
    status: p.status,
    attachments: p.attachments,
    zaznam: p.zaznam ? { id: p.zaznam.id, cisloZaznamu: p.zaznam.cisloZaznamu } : null,
    createdAt: p.createdAt.toISOString().split("T")[0],
  }))

  const canWrite = roles.includes("PRACOVNIK_PODATELNE") && !roles.includes("SPRAVCA_APLIKACIE")

  return (
    <div className="flex-1 overflow-auto">
      <PodatelnaClient
        posta={posta}
        plans={plans.map(p => ({ id: p.id, znacka: p.znacka, nazov: p.nazov }))}
        spracovatelia={spracovatelia}
        canWrite={canWrite}
      />
    </div>
  )
}
