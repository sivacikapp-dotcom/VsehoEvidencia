import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import ZaznamDetailClient from "./ZaznamDetailClient"
import { getCislonik } from "@/lib/cislonik"

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
      spracovatel: { select: { id: true, firstName: true, lastName: true } },
      utvar: { select: { id: true, nazov: true } },
      posta: { select: { id: true, poradoveCislo: true, vec: true } },
      odosielatel: true,
      adresati: { orderBy: { poradie: "asc" } },
      prilohy: { orderBy: { cislo: "asc" } },
      spisy: {
        include: { spis: { select: { id: true, cisloSpisu: true, nazov: true, status: true } } },
      },
    },
  })
  if (!zaznam) notFound()

  if (!isAdmin && zaznam.spracovatelId !== userId) redirect("/dashboard/registratura/zaznamy")

  const [utvary, subjekty, spracovatelov, stavOptions, sposobOptions] = await Promise.all([
    prisma.utvar.findMany({ orderBy: { nazov: "asc" } }),
    prisma.subjekt.findMany({ orderBy: [{ priezvisko: "asc" }, { nazov: "asc" }] }),
    prisma.user.findMany({
      where: { roles: { has: "SPRACOVATEL_REGISTRATURY" } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    getCislonik("STAV_ZAZNAMU"),
    getCislonik("SPOSOB_VYBAVENIA"),
  ])

  const canManage = (isSpracovatel && zaznam.spracovatelId === userId) ||
    (isAdmin && !roles.includes("SPRAVCA_APLIKACIE"))

  return (
    <div className="flex-1 overflow-auto">
      <ZaznamDetailClient
        zaznam={{
          id: zaznam.id,
          cisloZaznamu: zaznam.cisloZaznamu,
          kategoria: zaznam.kategoria,
          rok: zaznam.rok,
          spracovatelId: zaznam.spracovatelId,
          spracovatel: `${zaznam.spracovatel.firstName} ${zaznam.spracovatel.lastName}`,
          utvar: zaznam.utvar ? { id: zaznam.utvar.id, nazov: zaznam.utvar.nazov } : null,
          formaZaznamu: zaznam.formaZaznamu,
          vec: zaznam.vec,
          popis: zaznam.popis,
          stav: zaznam.stav,
          sposobVybavenia: zaznam.sposobVybavenia,
          dovernost: zaznam.dovernost,
          posta: zaznam.posta ? { id: zaznam.posta.id, poradoveCislo: zaznam.posta.poradoveCislo, vec: zaznam.posta.vec } : null,
          odosielatel: zaznam.odosielatel,
          adresati: zaznam.adresati,
          prilohy: zaznam.prilohy.map(p => ({
            id: p.id,
            cislo: p.cislo,
            forma: p.forma,
            nazov: p.nazov,
            originalName: p.originalName,
            fileSize: p.fileSize,
            fileHash: p.fileHash,
            hasFile: !!p.storedName,
          })),
          spisy: zaznam.spisy.map(sz => ({
            id: sz.spis.id,
            cisloSpisu: sz.spis.cisloSpisu,
            nazov: sz.spis.nazov,
            status: sz.spis.status,
          })),
          createdAt: zaznam.createdAt.toISOString().split("T")[0],
          updatedAt: zaznam.updatedAt.toISOString().split("T")[0],
        }}
        utvary={utvary.map(u => ({ id: u.id, nazov: u.nazov }))}
        subjekty={subjekty.map(s => ({
          id: s.id, meno: s.meno, priezvisko: s.priezvisko, nazov: s.nazov,
          oddelenie: s.oddelenie, ulica: s.ulica, mesto: s.mesto, psc: s.psc,
          identifikator: s.identifikator,
        }))}
        spracovatelov={spracovatelov}
        stavOptions={stavOptions.map(s => ({ kod: s.kod, popis: s.popis }))}
        sposobOptions={sposobOptions.map(s => ({ kod: s.kod, popis: s.popis }))}
        canManage={canManage}
        isAdmin={isAdmin}
      />
    </div>
  )
}
