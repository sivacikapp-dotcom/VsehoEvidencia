import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import TravelOrderDetailClient from "./TravelOrderDetailClient"
import { getCurrentTravelRates } from "@/lib/travelRateHelpers"

export default async function TravelOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const user = session.user as { id: string; roles: string[] }
  const userId = parseInt(user.id)
  const roles = user.roles as string[]

  const order = await prisma.travelOrder.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      supervisor: { select: { id: true, firstName: true, lastName: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      expenseReport: {
        include: {
          attachments: {
            include: { uploadedBy: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  })
  if (!order) notFound()

  const isSpravcaPC = roles.includes("SPRAVCA_PRACOVNYCH_CIEST")
  const isOwner = order.userId === userId
  const isSupervisor = order.supervisorId === userId
  const isAppAdmin = roles.includes("SPRAVCA_APLIKACIE") && !isSpravcaPC && !isOwner && !isSupervisor

  // Prístup: vlastník, nadriadený príkazu, SPRAVCA_PRACOVNYCH_CIEST alebo SPRAVCA_APLIKACIE
  if (!isOwner && !isSupervisor && !isSpravcaPC && !isAppAdmin) notFound()

  const rates = await getCurrentTravelRates()

  const supervisors = await prisma.user.findMany({
    where: { roles: { has: "NADRIADENY" } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const er = order.expenseReport

  const serialized = {
    ...order,
    advanceEUR: isAppAdmin ? null : (order.advanceEUR ? Number(order.advanceEUR) : null),
    advanceForeign: isAppAdmin ? null : (order.advanceForeign ? Number(order.advanceForeign) : null),
    pocketMoney: isAppAdmin ? null : (order.pocketMoney ? Number(order.pocketMoney) : null),
    departureAt: order.departureAt.toISOString(),
    returnAt: order.returnAt.toISOString(),
    supervisorApprovedAt: order.supervisorApprovedAt?.toISOString() ?? null,
    supervisorRejectedAt: order.supervisorRejectedAt?.toISOString() ?? null,
    managerApprovedAt: order.managerApprovedAt?.toISOString() ?? null,
    managerRejectedAt: order.managerRejectedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    expenseReport: er
      ? {
          ...er,
          dietAmount: isAppAdmin ? 0 : Number(er.dietAmount),
          actualTransport: er.actualTransport ?? null,
          actualVehicleCategory: er.actualVehicleCategory ?? null,
          actualVehicleRegPlate: er.actualVehicleRegPlate ?? null,
          actualEngineVolume: er.actualEngineVolume ?? null,
          kmDriven: isAppAdmin ? null : (er.kmDriven ? Number(er.kmDriven) : null),
          kmBasicRate: isAppAdmin ? null : (er.kmBasicRate ? Number(er.kmBasicRate) : null),
          fuelConsumption: isAppAdmin ? null : (er.fuelConsumption ? Number(er.fuelConsumption) : null),
          fuelPricePerL: isAppAdmin ? null : (er.fuelPricePerL ? Number(er.fuelPricePerL) : null),
          kmCompensation: isAppAdmin ? null : (er.kmCompensation ? Number(er.kmCompensation) : null),
          publicTransportCost: isAppAdmin ? null : (er.publicTransportCost ? Number(er.publicTransportCost) : null),
          publicTransportItems: isAppAdmin ? null : (er.publicTransportItems ?? null),
          taxiCost: isAppAdmin ? null : (er.taxiCost ? Number(er.taxiCost) : null),
          accommodation: isAppAdmin ? null : (er.accommodation ? Number(er.accommodation) : null),
          parking: isAppAdmin ? null : (er.parking ? Number(er.parking) : null),
          otherExpenses: isAppAdmin ? null : (er.otherExpenses ? Number(er.otherExpenses) : null),
          otherExpenseItems: isAppAdmin ? null : (er.otherExpenseItems ?? null),
          accommodationItems: isAppAdmin ? null : (er.accommodationItems ?? null),
          foreignDiet: isAppAdmin ? null : (er.foreignDiet ? Number(er.foreignDiet) : null),
          pocketMoneyPaid: isAppAdmin ? null : (er.pocketMoneyPaid ? Number(er.pocketMoneyPaid) : null),
          exchangeRate: isAppAdmin ? null : (er.exchangeRate ? Number(er.exchangeRate) : null),
          totalExpenses: isAppAdmin ? 0 : Number(er.totalExpenses),
          advanceReceived: isAppAdmin ? 0 : Number(er.advanceReceived),
          actualDepartureAt: er.actualDepartureAt.toISOString(),
          actualReturnAt: er.actualReturnAt.toISOString(),
          supervisorApprovedAt: er.supervisorApprovedAt?.toISOString() ?? null,
          supervisorRejectedAt: er.supervisorRejectedAt?.toISOString() ?? null,
          managerApprovedAt: er.managerApprovedAt?.toISOString() ?? null,
          managerRejectedAt: er.managerRejectedAt?.toISOString() ?? null,
          rejectedSnapshot: isAppAdmin ? null : (er.rejectedSnapshot ?? null),
          createdAt: er.createdAt.toISOString(),
          updatedAt: er.updatedAt.toISOString(),
          attachments: isAppAdmin ? [] : er.attachments.map((a) => ({
            id: a.id,
            storedName: a.storedName,
            originalName: a.originalName,
            mimeType: a.mimeType,
            size: a.size,
            createdAt: a.createdAt.toISOString(),
            uploadedBy: a.uploadedBy,
          })),
        }
      : null,
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      <TravelOrderDetailClient
        order={serialized}
        currentUserId={userId}
        userRoles={roles}
        supervisors={supervisors}
        rates={isAppAdmin ? null : rates}
        isAppAdmin={isAppAdmin}
      />
    </div>
  )
}
