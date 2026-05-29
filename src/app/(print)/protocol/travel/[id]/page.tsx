import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import TravelOrderPrint from "./TravelOrderPrint"
import { fmtDate, fmtDateTime } from "@/lib/formatDate"

export default async function TravelOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
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
      user: { select: { firstName: true, lastName: true, email: true } },
      supervisor: { select: { firstName: true, lastName: true } },
      manager: { select: { firstName: true, lastName: true } },
      expenseReport: {
        include: {
          attachments: false,
        },
      },
    },
  })

  if (!order) notFound()

  const er = order.expenseReport
  if (!er || er.status !== "APPROVED") notFound()

  const isOwner = order.userId === userId
  const isSupervisor = order.supervisorId === userId
  const isSpravcaPC = roles.includes("SPRAVCA_PRACOVNYCH_CIEST")
  if (!isOwner && !isSupervisor && !isSpravcaPC) notFound()


  return (
    <TravelOrderPrint
      order={{
        orderNumber: order.orderNumber,
        type: order.type,
        purpose: order.purpose,
        startLocation: order.startLocation,
        destination: order.destination,
        countries: order.countries,
        departureAt: fmtDateTime(order.departureAt),
        returnAt: fmtDateTime(order.returnAt),
        transport: order.transport,
        vehicleCategory: order.vehicleCategory,
        vehicleRegPlate: order.vehicleRegPlate,
        engineVolume: order.engineVolume,
        advanceEUR: order.advanceEUR ? Number(order.advanceEUR) : null,
        advanceForeign: order.advanceForeign ? Number(order.advanceForeign) : null,
        foreignCurrency: order.foreignCurrency,
        pocketMoney: order.pocketMoney ? Number(order.pocketMoney) : null,
        travelInsurance: order.travelInsurance,
        supervisorApprovedAt: order.supervisorApprovedAt ? fmtDate(order.supervisorApprovedAt) : null,
        managerApprovedAt: order.managerApprovedAt ? fmtDate(order.managerApprovedAt) : null,
      }}
      employee={{
        name: `${order.user.firstName} ${order.user.lastName}`,
        email: order.user.email,
      }}
      supervisor={order.supervisor ? `${order.supervisor.firstName} ${order.supervisor.lastName}` : null}
      manager={order.manager ? `${order.manager.firstName} ${order.manager.lastName}` : null}
      expenseReport={{
        actualDepartureAt: fmtDateTime(er.actualDepartureAt),
        actualReturnAt: fmtDateTime(er.actualReturnAt),
        actualTransport: er.actualTransport.length > 0 ? er.actualTransport : null,
        actualVehicleCategory: er.actualVehicleCategory,
        actualVehicleRegPlate: er.actualVehicleRegPlate,
        actualEngineVolume: er.actualEngineVolume,
        mealsPerDay: er.mealsPerDay,
        dietAmount: Number(er.dietAmount),
        kmDriven: er.kmDriven ? Number(er.kmDriven) : null,
        kmBasicRate: er.kmBasicRate ? Number(er.kmBasicRate) : null,
        fuelConsumption: er.fuelConsumption ? Number(er.fuelConsumption) : null,
        fuelPricePerL: er.fuelPricePerL ? Number(er.fuelPricePerL) : null,
        kmCompensation: er.kmCompensation ? Number(er.kmCompensation) : null,
        publicTransportCost: er.publicTransportCost ? Number(er.publicTransportCost) : null,
        publicTransportItems: er.publicTransportItems ?? null,
        taxiCost: er.taxiCost ? Number(er.taxiCost) : null,
        accommodation: er.accommodation ? Number(er.accommodation) : null,
        accommodationItems: er.accommodationItems ?? null,
        parking: er.parking ? Number(er.parking) : null,
        otherExpenses: er.otherExpenses ? Number(er.otherExpenses) : null,
        otherExpenseItems: er.otherExpenseItems,
        foreignDiet: er.foreignDiet ? Number(er.foreignDiet) : null,
        pocketMoneyPaid: er.pocketMoneyPaid ? Number(er.pocketMoneyPaid) : null,
        exchangeRate: er.exchangeRate ? Number(er.exchangeRate) : null,
        totalExpenses: Number(er.totalExpenses),
        advanceReceived: Number(er.advanceReceived),
        supervisorApprovedAt: er.supervisorApprovedAt ? fmtDate(er.supervisorApprovedAt) : null,
        managerApprovedAt: er.managerApprovedAt ? fmtDate(er.managerApprovedAt) : null,
      }}
      generatedAt={fmtDate(new Date())}
    />
  )
}
