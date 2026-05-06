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

  const isSpravcaPC = roles.includes("SPRAVCA_PC")
  const isOwner = order.userId === userId
  const isSupervisor = order.supervisorId === userId

  // Prístup: vlastník, nadriadený príkazu, alebo SPRAVCA_PC
  if (!isOwner && !isSupervisor && !isSpravcaPC) notFound()

  const rates = await getCurrentTravelRates()

  const supervisors = await prisma.user.findMany({
    where: { roles: { has: "NADRIADENY" } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const er = order.expenseReport

  const serialized = {
    ...order,
    advanceEUR: order.advanceEUR ? Number(order.advanceEUR) : null,
    advanceForeign: order.advanceForeign ? Number(order.advanceForeign) : null,
    pocketMoney: order.pocketMoney ? Number(order.pocketMoney) : null,
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
          dietAmount: Number(er.dietAmount),
          actualTransport: er.actualTransport ?? null,
          actualVehicleCategory: er.actualVehicleCategory ?? null,
          actualVehicleRegPlate: er.actualVehicleRegPlate ?? null,
          actualEngineVolume: er.actualEngineVolume ?? null,
          kmDriven: er.kmDriven ? Number(er.kmDriven) : null,
          kmBasicRate: er.kmBasicRate ? Number(er.kmBasicRate) : null,
          fuelConsumption: er.fuelConsumption ? Number(er.fuelConsumption) : null,
          fuelPricePerL: er.fuelPricePerL ? Number(er.fuelPricePerL) : null,
          kmCompensation: er.kmCompensation ? Number(er.kmCompensation) : null,
          publicTransportCost: er.publicTransportCost ? Number(er.publicTransportCost) : null,
          publicTransportItems: er.publicTransportItems ?? null,
          taxiCost: er.taxiCost ? Number(er.taxiCost) : null,
          accommodation: er.accommodation ? Number(er.accommodation) : null,
          parking: er.parking ? Number(er.parking) : null,
          otherExpenses: er.otherExpenses ? Number(er.otherExpenses) : null,
          otherExpenseItems: er.otherExpenseItems ?? null,
          accommodationItems: er.accommodationItems ?? null,
          foreignDiet: er.foreignDiet ? Number(er.foreignDiet) : null,
          pocketMoneyPaid: er.pocketMoneyPaid ? Number(er.pocketMoneyPaid) : null,
          exchangeRate: er.exchangeRate ? Number(er.exchangeRate) : null,
          totalExpenses: Number(er.totalExpenses),
          advanceReceived: Number(er.advanceReceived),
          actualDepartureAt: er.actualDepartureAt.toISOString(),
          actualReturnAt: er.actualReturnAt.toISOString(),
          supervisorApprovedAt: er.supervisorApprovedAt?.toISOString() ?? null,
          supervisorRejectedAt: er.supervisorRejectedAt?.toISOString() ?? null,
          managerApprovedAt: er.managerApprovedAt?.toISOString() ?? null,
          managerRejectedAt: er.managerRejectedAt?.toISOString() ?? null,
          createdAt: er.createdAt.toISOString(),
          updatedAt: er.updatedAt.toISOString(),
          attachments: er.attachments.map((a) => ({
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
    <TravelOrderDetailClient
      order={serialized}
      currentUserId={userId}
      userRoles={roles}
      supervisors={supervisors}
      rates={rates}
    />
  )
}
