"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyAcceptance } from "@/lib/notificationHelpers"

type Result = { error?: string; success?: boolean }

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

    // For asset changes, notify the supervisor/managers of the acceptance
    if (
      notification.type === "ASSET_CHANGED" &&
      notification.assetId &&
      notification.asset
    ) {
      await notifyAcceptance(
        userId,
        userName,
        notification.assetId,
        notification.asset.type,
        notification.asset.name,
        notification.asset.serialNumber,
        notification.asset.isSecurity
      )
    }

    revalidatePath("/dashboard")
    return { success: true }
  } catch {
    return { error: "Nastala chyba." }
  }
}

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

    await Promise.all(
      notifications
        .filter((n) => n.assetId && n.asset)
        .map((n) =>
          notifyAcceptance(
            userId,
            userName,
            n.assetId,
            n.asset!.type,
            n.asset!.name,
            n.asset!.serialNumber,
            n.asset!.isSecurity
          )
        )
    )

    revalidatePath("/dashboard")
    return { success: true }
  } catch {
    return { error: "Nastala chyba." }
  }
}
