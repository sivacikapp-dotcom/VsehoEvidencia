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

  const [zaznamyRaw, utvary, subjekty] = await Promise.all([
    prisma.regZaznam.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        spracovatel: { select: { firstName: true, lastName: true } },
        utvar: { select: { nazov: true } },
        _count: { select: { spisy: true, prilohy: true } },
      },
    }),
    prisma.utvar.findMany({ orderBy: { nazov: "asc" } }),
    prisma.subjekt.findMany({ orderBy: [{ priezvisko: "asc" }, { nazov: "asc" }] }),
  ])

  const zaznamy = zaznamyRaw.map(z => ({
    id: z.id,
    cisloZaznamu: z.cisloZaznamu,
    kategoria: z.kategoria,
    rok: z.rok,
    spracovatel: `${z.spracovatel.firstName} ${z.spracovatel.lastName}`,
    utvar: z.utvar?.nazov ?? null,
    formaZaznamu: z.formaZaznamu,
    vec: z.vec,
    stav: z.stav,
    dovernost: z.dovernost,
    pocetSpisov: z._count.spisy,
    pocetPriloh: z._count.prilohy,
    createdAt: z.createdAt.toISOString().split("T")[0],
  }))

  const canCreate = isSpracovatel && !roles.includes("SPRAVCA_APLIKACIE")

  return (
    <div className="flex-1 overflow-auto">
      <ZaznamyClient
        zaznamy={zaznamy}
        utvary={utvary.map(u => ({ id: u.id, nazov: u.nazov }))}
        subjekty={subjekty.map(s => ({
          id: s.id, meno: s.meno, priezvisko: s.priezvisko, nazov: s.nazov,
          oddelenie: s.oddelenie, ulica: s.ulica, mesto: s.mesto, psc: s.psc,
          identifikator: s.identifikator,
        }))}
        isAdmin={isAdmin}
        canCreate={canCreate}
      />
    </div>
  )
}
