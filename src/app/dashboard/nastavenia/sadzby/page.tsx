import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import RateConfigClient from "./RateConfigClient"
import { DEFAULT_TRAVEL_RATES } from "@/lib/travelUtils"

export default async function RateSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")
  const user = session.user as { id: string; roles: string[] }
  const isAppAdmin = user.roles.includes("SPRAVCA_APLIKACIE") && !user.roles.includes("SPRAVCA_PRACOVNYCH_CIEST")
  if (!user.roles.includes("SPRAVCA_PRACOVNYCH_CIEST") && !isAppAdmin) notFound()

  const configs = await prisma.travelRateConfig.findMany({
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: { validFrom: "desc" },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const serialized = configs.map(c => ({
    id: c.id,
    validFrom: c.validFrom.toISOString().slice(0, 10),
    diet5to12: Number(c.diet5to12),
    diet12to18: Number(c.diet12to18),
    dietOver18: Number(c.dietOver18),
    breakfastPct: Number(c.breakfastPct),
    lunchPct: Number(c.lunchPct),
    dinnerPct: Number(c.dinnerPct),
    kmJednostopove: Number(c.kmJednostopove),
    kmOsobneDoLimit: Number(c.kmOsobneDoLimit),
    kmOsobneNadLimit: Number(c.kmOsobneNadLimit),
    kmEngineLimit: c.kmEngineLimit,
    createdAt: c.createdAt.toISOString(),
    createdBy: c.createdBy ? `${c.createdBy.firstName} ${c.createdBy.lastName}` : null,
  }))

  return (
    <div className="flex-1 overflow-auto p-8">
      <RateConfigClient configs={serialized} defaultRates={DEFAULT_TRAVEL_RATES} isAppAdmin={isAppAdmin} />
    </div>
  )
}
