import { prisma } from "./prisma"
import { assetTypeLabels } from "./labels"
import type { AssetType, Confidentiality } from "@/generated/prisma/enums"

function assetLabel(type: string, name: string, serialNumber: string | null) {
  const typeLabel = assetTypeLabels[type as AssetType] ?? type
  return `${typeLabel}: ${name}${serialNumber ? ` (SN: ${serialNumber})` : ""}`
}

export async function notifyAcceptance(
  acceptorUserId: number,
  acceptorName: string,
  assetId: number | null,
  assetType: string,
  assetName: string,
  assetSN: string | null,
  isSecurity: boolean
) {
  if (!assetId) return

  const userIds = new Set<number>()

  const user = await prisma.user.findUnique({
    where: { id: acceptorUserId },
    select: { supervisorId: true },
  })
  if (user?.supervisorId) userIds.add(user.supervisorId)

  if (isSecurity) {
    const managers = await prisma.user.findMany({
      where: { roles: { hasSome: ["SPRAVCA_MAJETKU", "BEZPECNOSTNY_PRACOVNIK"] } },
      select: { id: true },
    })
    managers.forEach((m) => { if (m.id !== acceptorUserId) userIds.add(m.id) })
  }

  if (userIds.size === 0) return

  await prisma.notification.createMany({
    data: [...userIds].map((uid) => ({
      userId: uid,
      type: "ASSET_ACCEPTED" as const,
      title: "Potvrdenie prijatia zmeny",
      message: `${acceptorName} potvrdil(a) prijatie zmeny na pracovnom prostriedku ${assetLabel(assetType, assetName, assetSN)}.`,
      assetId,
      mustAcknowledge: false,
    })),
  })
}

export async function notifyAssetAssigned(
  assetId: number,
  assetType: string,
  assetName: string,
  assetSN: string | null,
  recipientUserId: number,
  createdByUserId: number
) {
  await prisma.notification.create({
    data: {
      userId: recipientUserId,
      type: "ASSET_ASSIGNED",
      title: "Pridelenie pracovného prostriedku",
      message: `Bol vám pridelený pracovný prostriedok ${assetLabel(assetType, assetName, assetSN)}.`,
      assetId,
      createdByUserId,
      mustAcknowledge: true,
    },
  })
}

export async function notifyAssetReturned(
  assetId: number,
  assetType: string,
  assetName: string,
  assetSN: string | null,
  recipientUserId: number,
  createdByUserId: number
) {
  await prisma.notification.create({
    data: {
      userId: recipientUserId,
      type: "ASSET_RETURNED",
      title: "Odobratie pracovného prostriedku",
      message: `Pracovný prostriedok ${assetLabel(assetType, assetName, assetSN)} vám bol odobratý.`,
      assetId,
      createdByUserId,
      mustAcknowledge: true,
    },
  })
}

export async function notifyDocumentAdded(
  documentId: number,
  docZnacka: string,
  docNazov: string,
  agendaName: string,
  confidentiality: Confidentiality,
  agendaId: number,
  actorUserId: number
) {
  let userIds: number[]

  if (confidentiality === "DOVERNI") {
    const [admins, agendaGestors] = await Promise.all([
      prisma.user.findMany({ where: { roles: { has: "SPRAVCA_DOKUMENTOV" as const } }, select: { id: true } }),
      prisma.agendaGestor.findMany({ where: { agendaId }, select: { userId: true } }),
    ])
    const ids = new Set<number>([
      ...admins.map((u) => u.id),
      ...agendaGestors.map((g) => g.userId),
    ])
    ids.delete(actorUserId)
    userIds = [...ids]
  } else {
    const allUsers = await prisma.user.findMany({ select: { id: true } })
    userIds = allUsers.map((u) => u.id).filter((id) => id !== actorUserId)
  }

  if (userIds.length === 0) return

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: "DOCUMENT_ADDED" as const,
      title: "Nový dokument",
      message: `Bol pridaný dokument ${docZnacka} – ${docNazov} v agende „${agendaName}".`,
      documentId,
      mustAcknowledge: false,
    })),
  })
}

export async function notifyDocumentDeleted(
  docZnacka: string,
  docNazov: string,
  agendaName: string,
  confidentiality: Confidentiality,
  agendaId: number,
  actorUserId: number
) {
  let userIds: number[]

  if (confidentiality === "DOVERNI") {
    const [admins, agendaGestors] = await Promise.all([
      prisma.user.findMany({ where: { roles: { has: "SPRAVCA_DOKUMENTOV" as const } }, select: { id: true } }),
      prisma.agendaGestor.findMany({ where: { agendaId }, select: { userId: true } }),
    ])
    const ids = new Set<number>([
      ...admins.map((u) => u.id),
      ...agendaGestors.map((g) => g.userId),
    ])
    ids.delete(actorUserId)
    userIds = [...ids]
  } else {
    const allUsers = await prisma.user.findMany({ select: { id: true } })
    userIds = allUsers.map((u) => u.id).filter((id) => id !== actorUserId)
  }

  if (userIds.length === 0) return

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: "DOCUMENT_DELETED" as const,
      title: "Dokument bol odstránený",
      message: `Dokument ${docZnacka} – ${docNazov} z agendy „${agendaName}" bol odstránený.`,
      mustAcknowledge: false,
    })),
  })
}

// ─── Travel order notifications ───────────────────────────────────────────────

export async function notifyTravelOrderSubmitted(
  travelOrderId: number,
  orderNumber: string,
  ownerName: string,
  supervisorId: number
) {
  await prisma.notification.create({
    data: {
      userId: supervisorId,
      type: "TRAVEL_ORDER_SUBMITTED",
      title: "Cestovný príkaz na schválenie",
      message: `${ownerName} odoslal(a) cestovný príkaz ${orderNumber} na vaše schválenie.`,
      travelOrderId,
      mustAcknowledge: false,
    },
  })
}

export async function notifyTravelOrderForManager(
  travelOrderId: number,
  orderNumber: string,
  ownerName: string,
  excludeUserId?: number
) {
  const managers = await prisma.user.findMany({
    where: { roles: { has: "SPRAVCA_PRACOVNYCH_CIEST" as const } },
    select: { id: true },
  })
  const targets = managers.filter((m) => m.id !== excludeUserId)
  if (targets.length === 0) return

  await prisma.notification.createMany({
    data: targets.map((m) => ({
      userId: m.id,
      type: "TRAVEL_ORDER_FOR_MANAGER" as const,
      title: "Cestovný príkaz na finančné schválenie",
      message: `Cestovný príkaz ${orderNumber} (${ownerName}) bol schválený nadriadeným a čaká na finančné schválenie.`,
      travelOrderId,
      mustAcknowledge: false,
    })),
  })
}

export async function notifyTravelOrderApproved(
  travelOrderId: number,
  orderNumber: string,
  ownerId: number
) {
  await prisma.notification.create({
    data: {
      userId: ownerId,
      type: "TRAVEL_ORDER_APPROVED",
      title: "Cestovný príkaz schválený",
      message: `Váš cestovný príkaz ${orderNumber} bol plne schválený. Môžete vyplniť vyúčtovanie.`,
      travelOrderId,
      mustAcknowledge: false,
    },
  })
}

export async function notifyTravelOrderRejected(
  travelOrderId: number,
  orderNumber: string,
  ownerId: number,
  rejectorName: string,
  note: string
) {
  await prisma.notification.create({
    data: {
      userId: ownerId,
      type: "TRAVEL_ORDER_REJECTED",
      title: "Cestovný príkaz zamietnutý",
      message: `Váš cestovný príkaz ${orderNumber} bol zamietnutý používateľom ${rejectorName}.\nDôvod: ${note}`,
      travelOrderId,
      mustAcknowledge: false,
    },
  })
}

export async function notifyExpenseReportSubmitted(
  travelOrderId: number,
  orderNumber: string,
  ownerName: string,
  supervisorId: number
) {
  await prisma.notification.create({
    data: {
      userId: supervisorId,
      type: "EXPENSE_REPORT_SUBMITTED",
      title: "Vyúčtovanie na schválenie",
      message: `${ownerName} odoslal(a) vyúčtovanie k cestnému príkazu ${orderNumber} na vaše schválenie.`,
      travelOrderId,
      mustAcknowledge: false,
    },
  })
}

export async function notifyExpenseReportForManager(
  travelOrderId: number,
  orderNumber: string,
  ownerName: string,
  excludeUserId?: number
) {
  const managers = await prisma.user.findMany({
    where: { roles: { has: "SPRAVCA_PRACOVNYCH_CIEST" as const } },
    select: { id: true },
  })
  const targets = managers.filter((m) => m.id !== excludeUserId)
  if (targets.length === 0) return

  await prisma.notification.createMany({
    data: targets.map((m) => ({
      userId: m.id,
      type: "EXPENSE_REPORT_FOR_MANAGER" as const,
      title: "Vyúčtovanie na finančné schválenie",
      message: `Vyúčtovanie k príkazu ${orderNumber} (${ownerName}) čaká na vaše finančné schválenie.`,
      travelOrderId,
      mustAcknowledge: false,
    })),
  })
}

export async function notifyExpenseReportApproved(
  travelOrderId: number,
  orderNumber: string,
  ownerId: number
) {
  await prisma.notification.create({
    data: {
      userId: ownerId,
      type: "EXPENSE_REPORT_APPROVED",
      title: "Vyúčtovanie schválené",
      message: `Vyúčtovanie k vášmu cestnému príkazu ${orderNumber} bolo plne schválené.`,
      travelOrderId,
      mustAcknowledge: false,
    },
  })
}

export async function notifyExpenseReportRejected(
  travelOrderId: number,
  orderNumber: string,
  ownerId: number,
  rejectorName: string,
  note: string,
  rejectorUserId?: number
) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { supervisorId: true, firstName: true, lastName: true },
  })

  const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : ""

  const notifications: {
    userId: number; type: "EXPENSE_REPORT_REJECTED"; title: string
    message: string; travelOrderId: number; mustAcknowledge: boolean
  }[] = [
    {
      userId: ownerId,
      type: "EXPENSE_REPORT_REJECTED" as const,
      title: "Vyúčtovanie zamietnuté",
      message: `Vyúčtovanie k vášmu cestnému príkazu ${orderNumber} bolo zamietnuté používateľom ${rejectorName}.\nDôvod: ${note}`,
      travelOrderId,
      mustAcknowledge: false,
    },
  ]

  if (owner?.supervisorId && owner.supervisorId !== rejectorUserId) {
    notifications.push({
      userId: owner.supervisorId,
      type: "EXPENSE_REPORT_REJECTED" as const,
      title: "Vyúčtovanie zamietnuté",
      message: `Vyúčtovanie k cestnému príkazu ${orderNumber} (${ownerName}) bolo zamietnuté používateľom ${rejectorName}.\nDôvod: ${note}`,
      travelOrderId,
      mustAcknowledge: false,
    })
  }

  await prisma.notification.createMany({ data: notifications })
}

export async function notifyRoomAssetAssigned(
  assetId: number,
  assetType: string,
  assetName: string,
  assetSN: string | null,
  roomId: number,
  createdByUserId: number
): Promise<number> {
  const roomAccesses = await prisma.userRoomAccess.findMany({
    where: { roomId },
    select: { userId: true },
  })
  const userIds = roomAccesses.map(a => a.userId).filter(id => id !== createdByUserId)
  if (userIds.length === 0) return 0

  await prisma.notification.createMany({
    data: userIds.map(userId => ({
      userId,
      type: "ASSET_ASSIGNED" as const,
      title: "Priradenie majetku do miestnosti",
      message: `Do miestnosti bol priradený pracovný prostriedok ${assetLabel(assetType, assetName, assetSN)}. Potvrďte toto priradenie.`,
      assetId,
      createdByUserId,
      mustAcknowledge: true,
    })),
  })
  return userIds.length
}

export async function notifyAssetChanged(
  assetId: number,
  assetType: string,
  assetName: string,
  assetSN: string | null,
  excludeUserIds: number[] = [],
  changes: string[] = []
) {
  const [recipientAssignment, roomAssignment] = await Promise.all([
    prisma.assetRecipientAssignment.findFirst({
      where: { assetId, returnedAt: null },
      select: { userId: true },
    }),
    prisma.assetRoomAssignment.findFirst({
      where: { assetId, removedAt: null },
      select: { roomId: true },
    }),
  ])

  const userIds = new Set<number>()

  if (recipientAssignment && !excludeUserIds.includes(recipientAssignment.userId)) {
    userIds.add(recipientAssignment.userId)
  }

  if (roomAssignment) {
    const roomUsers = await prisma.userRoomAccess.findMany({
      where: { roomId: roomAssignment.roomId },
      select: { userId: true },
    })
    roomUsers.forEach(({ userId }) => {
      if (!excludeUserIds.includes(userId)) userIds.add(userId)
    })
  }

  if (userIds.size === 0) return

  const baseMsg = `Na pracovnom prostriedku ${assetLabel(assetType, assetName, assetSN)} bola vykonaná zmena.`
  const message =
    changes.length > 0
      ? `${baseMsg}\n${changes.map((c) => `• ${c}`).join("\n")}`
      : baseMsg

  await prisma.notification.createMany({
    data: [...userIds].map((userId) => ({
      userId,
      type: "ASSET_CHANGED" as const,
      title: "Zmena pracovného prostriedku",
      message,
      assetId,
      mustAcknowledge: false,
    })),
  })
}
