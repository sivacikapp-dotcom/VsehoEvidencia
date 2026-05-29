"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function updateDokumentyRoles(
  userId: number,
  hasGestorAgendy: boolean,
  hasGestorDokumentu: boolean,
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_DOKUMENTOV")) {
    return { error: "Nemáte oprávnenie." }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true },
  })
  if (!user) return { error: "Používateľ neexistuje." }

  const otherRoles = user.roles.filter(
    r => r !== "GESTOR_AGENDY" && r !== "GESTOR_DOKUMENTU",
  )
  const newRoles = [
    ...otherRoles,
    ...(hasGestorAgendy   ? (["GESTOR_AGENDY"]   as const) : []),
    ...(hasGestorDokumentu ? (["GESTOR_DOKUMENTU"] as const) : []),
  ]

  await prisma.user.update({ where: { id: userId }, data: { roles: newRoles } })
  return {}
}
