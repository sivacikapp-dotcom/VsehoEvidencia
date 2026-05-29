"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"

type Result = { error?: string; success?: boolean }

export async function createRoom(name: string): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_MAJETKU")) {
    return { error: "Nemáte oprávnenie." }
  }

  const trimmed = name.trim()
  if (!trimmed) return { error: "Názov miestnosti nesmie byť prázdny." }

  const existing = await prisma.room.findUnique({ where: { name: trimmed } })
  if (existing) return { error: `Miestnosť „${trimmed}" už existuje.` }

  try {
    const created = await prisma.room.create({ data: { name: trimmed } })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "ROOM", entityId: created.id, entityLabel: created.name,
      newData: { name: created.name },
    })
    revalidatePath("/dashboard/rooms")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function deleteRoom(roomId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_MAJETKU")) {
    return { error: "Nemáte oprávnenie." }
  }

  const activeAssets = await prisma.assetRoomAssignment.count({
    where: { roomId, removedAt: null },
  })
  if (activeAssets > 0) {
    return {
      error: `V miestnosti sa nachádza ${activeAssets} aktívnych priradení. Najprv vráťte majetok.`,
    }
  }

  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } })

  try {
    await prisma.room.delete({ where: { id: roomId } })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "DELETE", entityType: "ROOM", entityId: roomId, entityLabel: room?.name ?? null,
      oldData: room ? { name: room.name } : null,
    })
    revalidatePath("/dashboard/rooms")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri mazaní." }
  }
}

export async function setRoomAccess(
  roomId: number,
  userIds: number[]
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_MAJETKU")) {
    return { error: "Nemáte oprávnenie." }
  }

  try {
    await prisma.userRoomAccess.deleteMany({ where: { roomId } })
    if (userIds.length > 0) {
      await prisma.userRoomAccess.createMany({
        data: userIds.map((userId) => ({ roomId, userId })),
      })
    }
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "ROOM_ACCESS", entityId: roomId, entityLabel: null,
      newData: { roomId, userIds },
    })
    revalidatePath("/dashboard/rooms")
    revalidatePath("/dashboard/users")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}
