"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyAcceptance, notifyAssetChanged } from "@/lib/notificationHelpers"
import { assetTypeLabels } from "@/lib/labels"
import type { AssetType } from "@/generated/prisma/enums"

type Result = { error?: string; success?: boolean }

export type SoftNotificationData = {
  id: number
  type: string
  title: string
  message: string
  createdAt: string
  assetId: number | null
  travelOrderId: number | null
  documentId: number | null
  documentAgendaId: number | null
}

export async function fetchSoftNotifications(): Promise<SoftNotificationData[]> {
  const session = await getServerSession(authOptions)
  if (!session) return []
  const userId = parseInt(session.user.id)
  const raw = await prisma.notification.findMany({
    where: { userId, mustAcknowledge: false, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { document: { select: { agendaId: true } } },
  })
  return raw.map((n) => ({
    id: n.id,
    type: n.type as string,
    title: n.title,
    message: n.message,
    createdAt: n.createdAt.toLocaleString("sk-SK", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }),
    assetId: n.assetId,
    travelOrderId: n.travelOrderId,
    documentId: n.documentId,
    documentAgendaId: n.document?.agendaId ?? null,
  }))
}

export async function dismissTravelOrderNotifications(travelOrderId: number): Promise<void> {
  const session = await getServerSession(authOptions)
  if (!session) return
  const userId = parseInt(session.user.id)
  await prisma.notification.updateMany({
    where: { userId, travelOrderId, mustAcknowledge: false, dismissedAt: null },
    data: { dismissedAt: new Date() },
  })
  revalidatePath("/dashboard")
}

export async function dismissNotification(notificationId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const userId = parseInt(session.user.id)
  try {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId, mustAcknowledge: false },
      data: { dismissedAt: new Date() },
    })
    revalidatePath("/dashboard")
    return { success: true }
  } catch {
    return { error: "Nastala chyba." }
  }
}

export async function acceptNotification(notificationId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const userId = parseInt(session.user.id)
  const userName = session.user.name ?? "Neznámy používateľ"

  try {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId, mustAcknowledge: false },
      include: { asset: { select: { name: true, type: true, isSecurity: true, serialNumber: true } } },
    })
    if (!notification) return { error: "Notifikácia nenájdená." }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { dismissedAt: new Date() },
    })

    if (notification.type === "ASSET_CHANGED" && notification.assetId && notification.asset) {
      await notifyAcceptance(
        userId, userName, notification.assetId,
        notification.asset.type, notification.asset.name,
        notification.asset.serialNumber, notification.asset.isSecurity
      )
    }

    revalidatePath("/dashboard")
    return { success: true }
  } catch {
    return { error: "Nastala chyba." }
  }
}

/**
 * Acknowledges one or more mustAcknowledge notifications.
 * After the recipient confirms, the asset's allocationStatus is moved from
 * the transitional "V_procese" state to its final value based on open assignments.
 * For room assignments, all other room-users' pending confirmations are auto-closed
 * since only one confirmation is needed.
 */
export async function acknowledgeNotifications(notificationIds: number[]): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const userId = parseInt(session.user.id)
  const userName = session.user.name ?? "Neznámy používateľ"

  try {
    const notifications = await prisma.notification.findMany({
      where: { id: { in: notificationIds }, userId, mustAcknowledge: true },
      include: { asset: { select: { name: true, type: true, isSecurity: true, serialNumber: true } } },
    })

    await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId, mustAcknowledge: true },
      data: { acknowledgedAt: new Date() },
    })

    // Finalize asset status for each acknowledged notification
    for (const n of notifications) {
      if (!n.assetId) continue

      if (n.type === "ASSET_ASSIGNED") {
        // Determine final status from current open assignments
        const [recipientAssignment, roomAssignment] = await Promise.all([
          prisma.assetRecipientAssignment.findFirst({ where: { assetId: n.assetId, returnedAt: null } }),
          prisma.assetRoomAssignment.findFirst({ where: { assetId: n.assetId, removedAt: null } }),
        ])
        const finalStatus = recipientAssignment
          ? "Prideleny_Recipient"
          : roomAssignment
          ? "Prideleny_Room"
          : "Neprideleny_Volny"

        // Use updateMany to avoid P2025 if asset is already in final state
        await prisma.asset.updateMany({
          where: { id: n.assetId, allocationStatus: "V_procese" },
          data: { allocationStatus: finalStatus },
        })
        // Auto-close related ASSET_RETURNED notifications — change is now resolved
        await prisma.notification.updateMany({
          where: { assetId: n.assetId, type: "ASSET_RETURNED", mustAcknowledge: true, acknowledgedAt: null },
          data: { acknowledgedAt: new Date() },
        })
        // For room assignments: close other room users' pending approval notifications and notify them
        if (roomAssignment && n.asset) {
          await prisma.notification.updateMany({
            where: { assetId: n.assetId, type: "ASSET_ASSIGNED", mustAcknowledge: true, acknowledgedAt: null },
            data: { acknowledgedAt: new Date() },
          })
          await notifyAssetChanged(
            n.assetId, n.asset.type, n.asset.name, n.asset.serialNumber,
            [userId], ["Priradenie do miestnosti bolo potvrdené"]
          )
        }

      } else if (n.type === "ASSET_RETURNED") {
        // Only finalize to Neprideleny_Volny if no new ASSET_ASSIGNED is still pending
        const pendingAssigned = await prisma.notification.findFirst({
          where: { assetId: n.assetId, type: "ASSET_ASSIGNED", mustAcknowledge: true, acknowledgedAt: null },
        })
        if (!pendingAssigned) {
          await prisma.asset.updateMany({
            where: { id: n.assetId, allocationStatus: "V_procese" },
            data: { allocationStatus: "Neprideleny_Volny" },
          })
        }
      }
    }

    await Promise.all(
      notifications
        .filter((n) => n.assetId && n.asset)
        .map((n) =>
          notifyAcceptance(
            userId, userName, n.assetId,
            n.asset!.type, n.asset!.name,
            n.asset!.serialNumber, n.asset!.isSecurity
          )
        )
    )

    revalidatePath("/dashboard")
    return { success: true }
  } catch (e) {
    console.error("[acknowledgeNotifications]", e)
    return { error: "Nastala chyba." }
  }
}

export async function rejectNotification(notificationId: number, reason: string): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const userId = parseInt(session.user.id)
  const userName = session.user.name ?? "Neznámy používateľ"

  if (!reason.trim()) return { error: "Dôvod odmietnutia je povinný." }

  try {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId, mustAcknowledge: true, acknowledgedAt: null },
      include: { asset: { select: { name: true, type: true, serialNumber: true } } },
    })
    if (!notification) return { error: "Notifikácia nenájdená." }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { acknowledgedAt: new Date() },
    })

    if (notification.assetId) {
      if (notification.type === "ASSET_ASSIGNED") {
        // Undo the pending assignment
        await Promise.all([
          prisma.assetRecipientAssignment.updateMany({
            where: { assetId: notification.assetId, returnedAt: null },
            data: { returnedAt: new Date(), returnedTo: userName },
          }),
          prisma.assetRoomAssignment.updateMany({
            where: { assetId: notification.assetId, removedAt: null },
            data: { removedAt: new Date(), removedBy: userName },
          }),
        ])
        await prisma.asset.updateMany({
          where: { id: notification.assetId, allocationStatus: "V_procese" },
          data: { allocationStatus: "Neprideleny_Volny" },
        })
        // Close related ASSET_RETURNED notifications — change was undone
        await prisma.notification.updateMany({
          where: { assetId: notification.assetId, type: "ASSET_RETURNED", mustAcknowledge: true, acknowledgedAt: null },
          data: { acknowledgedAt: new Date() },
        })
        // Close other room users' pending approval notifications — rejection undoes the assignment
        await prisma.notification.updateMany({
          where: { assetId: notification.assetId, type: "ASSET_ASSIGNED", mustAcknowledge: true, acknowledgedAt: null },
          data: { acknowledgedAt: new Date() },
        })

      } else if (notification.type === "ASSET_RETURNED") {
        // Return is final even if rejected — finalize only if no new assignment is pending
        const pendingAssigned = await prisma.notification.findFirst({
          where: { assetId: notification.assetId, type: "ASSET_ASSIGNED", mustAcknowledge: true, acknowledgedAt: null },
        })
        if (!pendingAssigned) {
          await prisma.asset.updateMany({
            where: { id: notification.assetId, allocationStatus: "V_procese" },
            data: { allocationStatus: "Neprideleny_Volny" },
          })
        }
      }
    }

    // Send rejection notification to the person who made the change
    if (notification.createdByUserId) {
      const label = notification.asset
        ? `${assetTypeLabels[notification.asset.type as AssetType] ?? notification.asset.type}: ${notification.asset.name}${notification.asset.serialNumber ? ` (SN: ${notification.asset.serialNumber})` : ""}`
        : "pracovný prostriedok"
      const actionWord = notification.type === "ASSET_ASSIGNED" ? "pridelenie" : "odobratie"

      await prisma.notification.create({
        data: {
          userId: notification.createdByUserId,
          type: "ASSET_CHANGE_REJECTED",
          title: "Zmena odmietnutá",
          message: `${userName} odmietol(a) ${actionWord} pracovného prostriedku ${label}.\nDôvod: ${reason.trim()}`,
          assetId: notification.assetId,
          mustAcknowledge: false,
        },
      })
    }

    revalidatePath("/dashboard")
    return { success: true }
  } catch (e) {
    console.error("[rejectNotification]", e)
    return { error: "Nastala chyba." }
  }
}
