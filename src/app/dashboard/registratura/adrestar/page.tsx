import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import AdresarClient from "./AdresarClient"

export default async function AdresarPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const roles = (session.user as { roles?: string[] })?.roles ?? []

  const canView = roles.includes("SPRACOVATEL_REGISTRATURY") || roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
  if (!canView) redirect("/dashboard")

  const canManage = roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")

  const subjekty = await prisma.subjekt.findMany({
    orderBy: [{ priezvisko: "asc" }, { nazov: "asc" }],
  })

  return (
    <div className="flex-1 overflow-auto">
      <AdresarClient
        subjekty={subjekty.map(s => ({
          id: s.id,
          meno: s.meno,
          priezvisko: s.priezvisko,
          nazov: s.nazov,
          oddelenie: s.oddelenie,
          ulica: s.ulica,
          mesto: s.mesto,
          psc: s.psc,
          identifikator: s.identifikator,
        }))}
        canManage={canManage}
      />
    </div>
  )
}
