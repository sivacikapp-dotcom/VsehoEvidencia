"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { TravelOrderType, TransportMeans, VehicleCategory } from "@/generated/prisma/enums"
import { randomUUID } from "crypto"
import { mkdir, writeFile, unlink } from "fs/promises"
import path from "path"
import {
  notifyTravelOrderSubmitted,
  notifyTravelOrderForManager,
  notifyTravelOrderApproved,
  notifyTravelOrderRejected,
  notifyExpenseReportSubmitted,
  notifyExpenseReportForManager,
  notifyExpenseReportApproved,
  notifyExpenseReportRejected,
} from "@/lib/notificationHelpers"

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Nie ste prihlásený.")
  return session.user as { id: string; name: string; roles: string[] }
}

function uid(user: { id: string }) {
  return parseInt(user.id)
}

async function dismissPendingNotification(
  userId: number,
  travelOrderId: number,
  type: string
) {
  await prisma.notification.updateMany({
    where: { userId, travelOrderId, type: type as never, dismissedAt: null },
    data: { dismissedAt: new Date() },
  })
}

async function generateOrderNumber(type: TravelOrderType): Promise<string> {
  const prefix = type === "TUZEMSKY" ? "TUZ" : "ZAH"
  const year = new Date().getFullYear()
  const count = await prisma.travelOrder.count({
    where: { type, orderNumber: { startsWith: `${prefix}-${year}-` } },
  })
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`
}

// ─── create travel order ───────────────────────────────────────────────────────

export type CreateTravelOrderInput = {
  type: TravelOrderType
  purpose: string
  startLocation: string
  destination: string
  departureAt: string
  returnAt: string
  transport: TransportMeans[]
  vehicleCategory?: VehicleCategory
  vehicleRegPlate?: string
  engineVolume?: number
  advanceEUR?: number
  // zahraničná cesta
  countries?: string
  advanceForeign?: number
  foreignCurrency?: string
  pocketMoney?: number
  travelInsurance?: boolean
  supervisorId?: number
}

export async function createTravelOrder(data: CreateTravelOrderInput) {
  const user = await getSession()

  const orderNumber = await generateOrderNumber(data.type)

  const created = await prisma.travelOrder.create({
    data: {
      orderNumber,
      type: data.type,
      status: "DRAFT",
      userId: uid(user),
      purpose: data.purpose,
      startLocation: data.startLocation,
      destination: data.destination,
      departureAt: new Date(data.departureAt),
      returnAt: new Date(data.returnAt),
      transport: data.transport,
      vehicleCategory: data.vehicleCategory ?? null,
      vehicleRegPlate: data.vehicleRegPlate ?? null,
      engineVolume: data.engineVolume ?? null,
      advanceEUR: data.advanceEUR != null ? data.advanceEUR : null,
      countries: data.countries ?? null,
      advanceForeign: data.advanceForeign != null ? data.advanceForeign : null,
      foreignCurrency: data.foreignCurrency ?? null,
      pocketMoney: data.pocketMoney != null ? data.pocketMoney : null,
      travelInsurance: data.travelInsurance ?? false,
      supervisorId: data.supervisorId ?? null,
    },
  })

  revalidatePath("/dashboard/pracovne-cesty")
  return { id: created.id }
}

// ─── update travel order (DRAFT only) ─────────────────────────────────────────

export async function updateTravelOrder(
  id: number,
  data: Omit<CreateTravelOrderInput, "type">
) {
  const user = await getSession()

  const order = await prisma.travelOrder.findUnique({ where: { id } })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.userId !== uid(user)) throw new Error("Nemáte oprávnenie.")
  if (order.status !== "DRAFT") throw new Error("Príkaz nie je v stave Rozpracovaný.")

  await prisma.travelOrder.update({
    where: { id },
    data: {
      purpose: data.purpose,
      startLocation: data.startLocation,
      destination: data.destination,
      departureAt: new Date(data.departureAt),
      returnAt: new Date(data.returnAt),
      transport: data.transport,
      vehicleCategory: data.vehicleCategory ?? null,
      vehicleRegPlate: data.vehicleRegPlate ?? null,
      engineVolume: data.engineVolume ?? null,
      advanceEUR: data.advanceEUR != null ? data.advanceEUR : null,
      countries: data.countries ?? null,
      advanceForeign: data.advanceForeign != null ? data.advanceForeign : null,
      foreignCurrency: data.foreignCurrency ?? null,
      pocketMoney: data.pocketMoney != null ? data.pocketMoney : null,
      travelInsurance: data.travelInsurance ?? false,
      supervisorId: data.supervisorId ?? null,
    },
  })

  revalidatePath("/dashboard/pracovne-cesty")
  revalidatePath(`/dashboard/pracovne-cesty/${id}`)
}

// ─── delete travel order (DRAFT only) ─────────────────────────────────────────

export async function deleteTravelOrder(id: number) {
  const user = await getSession()

  const order = await prisma.travelOrder.findUnique({ where: { id } })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.userId !== uid(user)) throw new Error("Nemáte oprávnenie.")
  if (order.status !== "DRAFT") throw new Error("Príkaz nie je v stave Rozpracovaný.")

  await prisma.travelOrder.delete({ where: { id } })
  revalidatePath("/dashboard/pracovne-cesty")
}

// ─── submit for supervisor approval ───────────────────────────────────────────

export async function submitTravelOrder(id: number) {
  const user = await getSession()

  const order = await prisma.travelOrder.findUnique({
    where: { id },
    include: { user: { select: { firstName: true, lastName: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.userId !== uid(user)) throw new Error("Nemáte oprávnenie.")
  if (order.status !== "DRAFT") throw new Error("Príkaz nie je v stave Rozpracovaný.")
  if (!order.supervisorId) throw new Error("Musíte vybrať nadriadeného.")

  await prisma.travelOrder.update({
    where: { id },
    data: { status: "PENDING_SUPERVISOR", rejectionNote: null },
  })

  await notifyTravelOrderSubmitted(
    id,
    order.orderNumber,
    `${order.user.firstName} ${order.user.lastName}`,
    order.supervisorId
  )

  revalidatePath("/dashboard/pracovne-cesty")
  revalidatePath(`/dashboard/pracovne-cesty/${id}`)
}

// ─── supervisor approve ────────────────────────────────────────────────────────

export async function supervisorApproveTravelOrder(id: number) {
  const user = await getSession()

  const order = await prisma.travelOrder.findUnique({
    where: { id },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.supervisorId !== uid(user)) throw new Error("Nie ste nadriadený tohto príkazu.")
  if (order.status !== "PENDING_SUPERVISOR") throw new Error("Príkaz nečaká na schválenie nadriadeného.")

  await prisma.travelOrder.update({
    where: { id },
    data: {
      status: "APPROVED",
      supervisorApprovedAt: new Date(),
      supervisorRejectedAt: null,
    },
  })

  await dismissPendingNotification(uid(user), id, "TRAVEL_ORDER_SUBMITTED")
  await notifyTravelOrderApproved(id, order.orderNumber, order.user.id)
  await notifyTravelOrderForManager(
    id,
    order.orderNumber,
    `${order.user.firstName} ${order.user.lastName}`,
    uid(user)
  )

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/pracovne-cesty")
  revalidatePath(`/dashboard/pracovne-cesty/${id}`)
}

// ─── supervisor reject ─────────────────────────────────────────────────────────

export async function supervisorRejectTravelOrder(id: number, note: string) {
  const user = await getSession()

  const order = await prisma.travelOrder.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.supervisorId !== uid(user)) throw new Error("Nie ste nadriadený tohto príkazu.")
  if (order.status !== "PENDING_SUPERVISOR") throw new Error("Príkaz nečaká na schválenie nadriadeného.")

  await prisma.travelOrder.update({
    where: { id },
    data: {
      status: "REJECTED",
      supervisorRejectedAt: new Date(),
      rejectionNote: note,
    },
  })

  await dismissPendingNotification(uid(user), id, "TRAVEL_ORDER_SUBMITTED")
  await notifyTravelOrderRejected(id, order.orderNumber, order.user.id, user.name, note)

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/pracovne-cesty")
  revalidatePath(`/dashboard/pracovne-cesty/${id}`)
}

// ─── manager (SPRAVCA_PC) approve ─────────────────────────────────────────────

export async function managerApproveTravelOrder(id: number) {
  const user = await getSession()

  if (!user.roles.includes("SPRAVCA_PC")) throw new Error("Nemáte rolu Správca PC.")

  const order = await prisma.travelOrder.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.status !== "PENDING_MANAGER") throw new Error("Príkaz nečaká na schválenie správcu PC.")

  await prisma.travelOrder.update({
    where: { id },
    data: {
      status: "APPROVED",
      managerId: uid(user),
      managerApprovedAt: new Date(),
      managerRejectedAt: null,
    },
  })

  await notifyTravelOrderApproved(id, order.orderNumber, order.user.id)

  revalidatePath("/dashboard/pracovne-cesty")
  revalidatePath(`/dashboard/pracovne-cesty/${id}`)
}

// ─── manager reject ────────────────────────────────────────────────────────────

export async function managerRejectTravelOrder(id: number, note: string) {
  const user = await getSession()

  if (!user.roles.includes("SPRAVCA_PC")) throw new Error("Nemáte rolu Správca PC.")

  const order = await prisma.travelOrder.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.status !== "PENDING_MANAGER") throw new Error("Príkaz nečaká na schválenie správcu PC.")

  await prisma.travelOrder.update({
    where: { id },
    data: {
      status: "REJECTED",
      managerId: uid(user),
      managerRejectedAt: new Date(),
      rejectionNote: note,
    },
  })

  await notifyTravelOrderRejected(id, order.orderNumber, order.user.id, user.name, note)

  revalidatePath("/dashboard/pracovne-cesty")
  revalidatePath(`/dashboard/pracovne-cesty/${id}`)
}

// ─── reopen rejected order (back to DRAFT) ────────────────────────────────────

export async function reopenTravelOrder(id: number) {
  const user = await getSession()

  const order = await prisma.travelOrder.findUnique({ where: { id } })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.userId !== uid(user)) throw new Error("Nemáte oprávnenie.")
  if (order.status !== "REJECTED") throw new Error("Príkaz nie je zamietnutý.")

  await prisma.travelOrder.update({
    where: { id },
    data: {
      status: "DRAFT",
      supervisorRejectedAt: null,
      managerRejectedAt: null,
      supervisorApprovedAt: null,
      managerApprovedAt: null,
      rejectionNote: null,
    },
  })

  revalidatePath("/dashboard/pracovne-cesty")
  revalidatePath(`/dashboard/pracovne-cesty/${id}`)
}

// ─── expense report ────────────────────────────────────────────────────────────

export type UpsertExpenseReportInput = {
  travelOrderId: number
  actualDepartureAt: string
  actualReturnAt: string
  mealsPerDay: string   // JSON: DayMealEntry[]
  dietAmount: number
  // changed transport (empty array = same as order)
  actualTransport?: TransportMeans[]
  actualVehicleCategory?: VehicleCategory
  actualVehicleRegPlate?: string
  actualEngineVolume?: number
  // vehicle
  kmDriven?: number
  kmBasicRate?: number
  fuelConsumption?: number
  fuelPricePerL?: number
  kmCompensation?: number
  // other transport
  publicTransportCost?: number
  publicTransportItems?: string
  taxiCost?: number
  // other
  accommodation?: number
  accommodationItems?: string
  parking?: number
  otherExpenses?: number
  otherExpensesNote?: string
  otherExpenseItems?: string
  // foreign
  foreignDiet?: number
  pocketMoneyPaid?: number
  exchangeRate?: number
  // summary
  totalExpenses: number
  advanceReceived: number
}

export async function upsertExpenseReport(data: UpsertExpenseReportInput) {
  const user = await getSession()

  const order = await prisma.travelOrder.findUnique({
    where: { id: data.travelOrderId },
  })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.userId !== uid(user)) throw new Error("Nemáte oprávnenie.")

  const payload = {
    actualDepartureAt: new Date(data.actualDepartureAt),
    actualReturnAt: new Date(data.actualReturnAt),
    mealsPerDay: data.mealsPerDay,
    dietAmount: data.dietAmount,
    actualTransport: data.actualTransport ?? [],
    actualVehicleCategory: data.actualVehicleCategory ?? null,
    actualVehicleRegPlate: data.actualVehicleRegPlate ?? null,
    actualEngineVolume: data.actualEngineVolume ?? null,
    kmDriven: data.kmDriven ?? null,
    kmBasicRate: data.kmBasicRate ?? null,
    fuelConsumption: data.fuelConsumption ?? null,
    fuelPricePerL: data.fuelPricePerL ?? null,
    kmCompensation: data.kmCompensation ?? null,
    publicTransportCost: data.publicTransportCost ?? null,
    publicTransportItems: data.publicTransportItems ?? null,
    taxiCost: data.taxiCost ?? null,
    accommodation: data.accommodation ?? null,
    accommodationItems: data.accommodationItems ?? null,
    parking: data.parking ?? null,
    otherExpenses: data.otherExpenses ?? null,
    otherExpensesNote: data.otherExpensesNote ?? null,
    otherExpenseItems: data.otherExpenseItems ?? null,
    foreignDiet: data.foreignDiet ?? null,
    pocketMoneyPaid: data.pocketMoneyPaid ?? null,
    exchangeRate: data.exchangeRate ?? null,
    totalExpenses: data.totalExpenses,
    advanceReceived: data.advanceReceived,
  }

  await prisma.travelExpenseReport.upsert({
    where: { travelOrderId: data.travelOrderId },
    create: { travelOrderId: data.travelOrderId, ...payload },
    update: payload,
  })

  revalidatePath(`/dashboard/pracovne-cesty/${data.travelOrderId}`)
}

// ─── expense report approval workflow ─────────────────────────────────────────

async function getReport(travelOrderId: number) {
  const report = await prisma.travelExpenseReport.findUnique({ where: { travelOrderId } })
  if (!report) throw new Error("Vyúčtovanie neexistuje.")
  return report
}

export async function submitExpenseReport(travelOrderId: number) {
  const user = await getSession()
  const order = await prisma.travelOrder.findUnique({
    where: { id: travelOrderId },
    include: { user: { select: { firstName: true, lastName: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.userId !== uid(user)) throw new Error("Nemáte oprávnenie.")
  if (order.status !== "APPROVED") throw new Error("Príkaz musí byť schválený pred odoslaním vyúčtovania.")
  if (!order.supervisorId) throw new Error("Príkaz nemá nastaveného nadriadeného.")

  const report = await getReport(travelOrderId)
  if (report.status !== "DRAFT") throw new Error("Vyúčtovanie už bolo odoslané.")

  await prisma.travelExpenseReport.update({
    where: { travelOrderId },
    data: { status: "PENDING_SUPERVISOR", rejectionNote: null },
  })

  await notifyExpenseReportSubmitted(
    travelOrderId,
    order.orderNumber,
    `${order.user.firstName} ${order.user.lastName}`,
    order.supervisorId
  )

  revalidatePath(`/dashboard/pracovne-cesty/${travelOrderId}`)
}

export async function supervisorApproveExpenseReport(travelOrderId: number) {
  const user = await getSession()
  const order = await prisma.travelOrder.findUnique({
    where: { id: travelOrderId },
    include: { user: { select: { firstName: true, lastName: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.supervisorId !== uid(user)) throw new Error("Nie ste nadriadený tohto príkazu.")

  const report = await getReport(travelOrderId)
  if (report.status !== "PENDING_SUPERVISOR") throw new Error("Vyúčtovanie nečaká na schválenie nadriadeného.")

  await prisma.travelExpenseReport.update({
    where: { travelOrderId },
    data: { status: "PENDING_MANAGER", supervisorApprovedAt: new Date(), supervisorRejectedAt: null },
  })

  await dismissPendingNotification(uid(user), travelOrderId, "EXPENSE_REPORT_SUBMITTED")
  await notifyExpenseReportForManager(
    travelOrderId,
    order.orderNumber,
    `${order.user.firstName} ${order.user.lastName}`,
    uid(user)
  )

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/pracovne-cesty/${travelOrderId}`)
}

export async function supervisorRejectExpenseReport(travelOrderId: number, note: string) {
  const user = await getSession()
  const order = await prisma.travelOrder.findUnique({
    where: { id: travelOrderId },
    include: { user: { select: { id: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.supervisorId !== uid(user)) throw new Error("Nie ste nadriadený tohto príkazu.")

  const report = await getReport(travelOrderId)
  if (report.status !== "PENDING_SUPERVISOR") throw new Error("Vyúčtovanie nečaká na schválenie nadriadeného.")

  await prisma.travelExpenseReport.update({
    where: { travelOrderId },
    data: { status: "DRAFT", supervisorRejectedAt: new Date(), rejectionNote: note },
  })

  await dismissPendingNotification(uid(user), travelOrderId, "EXPENSE_REPORT_SUBMITTED")
  await notifyExpenseReportRejected(travelOrderId, order.orderNumber, order.user.id, user.name, note)

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/pracovne-cesty/${travelOrderId}`)
}

export async function managerApproveExpenseReport(travelOrderId: number) {
  const user = await getSession()
  if (!user.roles.includes("SPRAVCA_PC")) throw new Error("Nemáte rolu Správca PC.")

  const order = await prisma.travelOrder.findUnique({
    where: { id: travelOrderId },
    include: { user: { select: { id: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")

  const report = await getReport(travelOrderId)
  if (report.status !== "PENDING_MANAGER") throw new Error("Vyúčtovanie nečaká na schválenie správcu PC.")

  await prisma.travelExpenseReport.update({
    where: { travelOrderId },
    data: {
      status: "APPROVED",
      managerId: uid(user),
      managerApprovedAt: new Date(),
      managerRejectedAt: null,
    },
  })

  await dismissPendingNotification(uid(user), travelOrderId, "EXPENSE_REPORT_FOR_MANAGER")
  await notifyExpenseReportApproved(travelOrderId, order.orderNumber, order.user.id)

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/pracovne-cesty/${travelOrderId}`)
}

export async function managerRejectExpenseReport(travelOrderId: number, note: string) {
  const user = await getSession()
  if (!user.roles.includes("SPRAVCA_PC")) throw new Error("Nemáte rolu Správca PC.")

  const order = await prisma.travelOrder.findUnique({
    where: { id: travelOrderId },
    include: { user: { select: { id: true } } },
  })
  if (!order) throw new Error("Príkaz neexistuje.")

  const report = await getReport(travelOrderId)
  if (report.status !== "PENDING_MANAGER") throw new Error("Vyúčtovanie nečaká na schválenie správcu PC.")

  await prisma.travelExpenseReport.update({
    where: { travelOrderId },
    data: {
      status: "DRAFT",
      managerId: uid(user),
      managerRejectedAt: new Date(),
      rejectionNote: note,
    },
  })

  await dismissPendingNotification(uid(user), travelOrderId, "EXPENSE_REPORT_FOR_MANAGER")
  await notifyExpenseReportRejected(travelOrderId, order.orderNumber, order.user.id, user.name, note)

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/pracovne-cesty/${travelOrderId}`)
}

// ─── expense report attachments ────────────────────────────────────────────────

export async function uploadExpenseReportAttachment(formData: FormData) {
  const user = await getSession()
  const travelOrderId = parseInt(formData.get("travelOrderId") as string)
  const file = formData.get("file") as File | null

  if (!file || file.size === 0) throw new Error("Súbor nie je priložený.")
  if (file.size > 20 * 1024 * 1024) throw new Error("Súbor je príliš veľký (max 20 MB).")

  const order = await prisma.travelOrder.findUnique({ where: { id: travelOrderId } })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.userId !== uid(user)) throw new Error("Nemáte oprávnenie.")

  const report = await prisma.travelExpenseReport.findUnique({ where: { travelOrderId } })
  if (!report) throw new Error("Najprv uložte vyúčtovanie.")
  if (report.status !== "DRAFT") throw new Error("Prílohy možno pridávať len k rozpracovanému vyúčtovaniu.")

  const TRAVEL_ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".gif", ".txt", ".csv"])
  const ext = path.extname(file.name).toLowerCase()
  if (!TRAVEL_ALLOWED_EXT.has(ext)) throw new Error("Nepodporovaný formát súboru.")
  const storedName = `${randomUUID()}${ext}`
  const uploadDir = path.join(process.cwd(), "uploads", "travel")
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, storedName), Buffer.from(await file.arrayBuffer()))

  await prisma.expenseReportAttachment.create({
    data: {
      expenseReportId: report.id,
      storedName,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      uploadedById: uid(user),
    },
  })

  revalidatePath(`/dashboard/pracovne-cesty/${travelOrderId}`)
}

export async function deleteExpenseReportAttachment(attachmentId: number, travelOrderId: number) {
  const user = await getSession()

  const order = await prisma.travelOrder.findUnique({ where: { id: travelOrderId } })
  if (!order) throw new Error("Príkaz neexistuje.")
  if (order.userId !== uid(user)) throw new Error("Nemáte oprávnenie.")

  const attachment = await prisma.expenseReportAttachment.findUnique({
    where: { id: attachmentId },
    include: { expenseReport: true },
  })
  if (!attachment) throw new Error("Príloha neexistuje.")
  if (attachment.expenseReport.status !== "DRAFT") throw new Error("Prílohy možno mazať len v stave Rozpracovaný.")

  await unlink(path.join(process.cwd(), "uploads", "travel", attachment.storedName)).catch(() => {})
  await prisma.expenseReportAttachment.delete({ where: { id: attachmentId } })

  revalidatePath(`/dashboard/pracovne-cesty/${travelOrderId}`)
}
