import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import VyuctovaneCestyClient from "./VyuctovaneCestyClient"

export default async function VyuctovaneCestyPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const user = session.user as { id: string; roles: string[] }
  const userId = parseInt(user.id)
  const roles = user.roles as string[]

  const isSpravcaPC = roles.includes("SPRAVCA_PC")
  const isNadriadeny = roles.includes("NADRIADENY")
  const isAppAdmin = roles.includes("SPRAVCA_APLIKACIE") && !isSpravcaPC && !isNadriadeny

  const orClauses: object[] = isAppAdmin ? [{}] : [
    { userId },
  ]
  if (!isAppAdmin && isNadriadeny) {
    orClauses.push({ supervisorId: userId })
  }
  if (!isAppAdmin && isSpravcaPC) {
    orClauses.push({})
  }

  const orders = await prisma.travelOrder.findMany({
    where: {
      ...(isAppAdmin ? {} : { OR: orClauses }),
      expenseReport: { isNot: null },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      supervisor: { select: { id: true, firstName: true, lastName: true } },
      expenseReport: {
        select: {
          id: true,
          status: true,
          totalExpenses: true,
          advanceReceived: true,
          managerApprovedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const serialized = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    type: o.type,
    purpose: o.purpose,
    startLocation: o.startLocation,
    destination: o.destination,
    countries: o.countries,
    departureAt: o.departureAt.toISOString(),
    returnAt: o.returnAt.toISOString(),
    user: o.user,
    supervisor: o.supervisor,
    expenseReport: o.expenseReport
      ? {
          id: o.expenseReport.id,
          status: o.expenseReport.status,
          totalExpenses: isAppAdmin ? null : Number(o.expenseReport.totalExpenses),
          advanceReceived: isAppAdmin ? null : Number(o.expenseReport.advanceReceived),
          managerApprovedAt: o.expenseReport.managerApprovedAt?.toISOString() ?? null,
        }
      : null,
  }))

  return (
    <div className="flex-1 overflow-auto p-8">
      <VyuctovaneCestyClient
        orders={serialized}
        currentUserId={userId}
        userRoles={roles}
        isAppAdmin={isAppAdmin}
      />
    </div>
  )
}
