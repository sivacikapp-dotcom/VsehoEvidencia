import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import TravelOrdersClient from "./TravelOrdersClient"

export default async function PracovneCestyPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const user = session.user as { id: string; roles: string[] }
  const userId = parseInt(user.id)
  const roles = user.roles as string[]

  const isSpravcaPC = roles.includes("SPRAVCA_PRACOVNYCH_CIEST")
  const isNadriadeny = roles.includes("NADRIADENY")
  const isAppAdmin = roles.includes("SPRAVCA_APLIKACIE") && !isSpravcaPC && !isNadriadeny

  // Načítaj príkazy podľa roly — kombinovaný OR aby používateľ s viacerými rolami videl všetko
  // SPRAVCA_APLIKACIE vidí všetky príkazy
  const orClauses: object[] = isAppAdmin ? [{}] : [
    { userId }, // vlastné príkazy (vždy)
  ]
  if (!isAppAdmin && isNadriadeny) {
    orClauses.push({
      supervisorId: userId,
      status: { in: ["PENDING_SUPERVISOR", "PENDING_MANAGER", "APPROVED", "REJECTED"] },
    })
  }
  if (!isAppAdmin && isSpravcaPC) {
    orClauses.push({ status: { in: ["PENDING_MANAGER", "APPROVED", "REJECTED"] } })
  }

  const orders = await prisma.travelOrder.findMany({
    where: isAppAdmin ? {} : { OR: orClauses },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      supervisor: { select: { id: true, firstName: true, lastName: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      expenseReport: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Zoznam nadriadených pre výber v modáli (všetci používatelia s rolou NADRIADENY)
  const supervisors = await prisma.user.findMany({
    where: { roles: { has: "NADRIADENY" } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const serialized = orders.map((o) => ({
    ...o,
    advanceEUR: isAppAdmin ? null : (o.advanceEUR ? Number(o.advanceEUR) : null),
    advanceForeign: isAppAdmin ? null : (o.advanceForeign ? Number(o.advanceForeign) : null),
    pocketMoney: isAppAdmin ? null : (o.pocketMoney ? Number(o.pocketMoney) : null),
    departureAt: o.departureAt.toISOString(),
    returnAt: o.returnAt.toISOString(),
    supervisorApprovedAt: o.supervisorApprovedAt?.toISOString() ?? null,
    supervisorRejectedAt: o.supervisorRejectedAt?.toISOString() ?? null,
    managerApprovedAt: o.managerApprovedAt?.toISOString() ?? null,
    managerRejectedAt: o.managerRejectedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }))

  return (
    <div className="flex-1 overflow-auto p-8">
      <TravelOrdersClient
        orders={serialized}
        currentUserId={userId}
        userRoles={roles}
        supervisors={supervisors}
        isAppAdmin={isAppAdmin}
      />
    </div>
  )
}
