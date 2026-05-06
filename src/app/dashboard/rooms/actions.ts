"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type Result = { error?: string; success?: boolean }

export async function createRoom(name: string): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_KARIET")) {
    return { error: "Nemáte oprávnenie." }
  }

  const trimmed = name.trim()
  if (!trimmed) return { error: "Názov miestnosti nesmie byť prázdny." }

  const existing = await prisma.room.findUnique({ where: { name: trimmed } })
  if (existing) return { error: `Miestnosť „${trimmed}" už existuje.` }

  try {
    await prisma.room.create({ data: { name: trimmed } })
    revalidatePath("/dashboard/rooms")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function deleteRoom(roomId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_KARIET")) {
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

  try {
    await prisma.room.delete({ where: { id: roomId } })
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
  if (!session?.user.roles.includes("SPRAVCA_KARIET")) {
    return { error: "Nemáte oprávnenie." }
  }

  try {
    await prisma.userRoomAccess.deleteMany({ where: { roomId } })
    if (userIds.length > 0) {
      await prisma.userRoomAccess.createMany({
        data: userIds.map((userId) => ({ roomId, userId })),
      })
    }
    revalidatePath("/dashboard/rooms")
    revalidatePath("/dashboard/users")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}
