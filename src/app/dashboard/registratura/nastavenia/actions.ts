"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function updateRegistraturaRoles(
  userId: number,
  hasPodatelna: boolean,
  hasSpracovatel: boolean,
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_REGISTRATURY")) {
    return { error: "Nemáte oprávnenie." }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true },
  })
  if (!user) return { error: "Používateľ neexistuje." }

  const otherRoles = user.roles.filter(
    r => r !== "PRACOVNIK_PODATELNE" && r !== "SPRACOVATEL_REGISTRATURY",
  )
  const newRoles = [
    ...otherRoles,
    ...(hasPodatelna  ? (["PRACOVNIK_PODATELNE"]      as const) : []),
    ...(hasSpracovatel ? (["SPRACOVATEL_REGISTRATURY"] as const) : []),
  ]

  await prisma.user.update({ where: { id: userId }, data: { roles: newRoles } })
  return {}
}
