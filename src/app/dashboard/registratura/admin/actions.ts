"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import type { Role } from "@/generated/prisma/enums"

type Result = { error?: string; success?: boolean }

const REG_ROLES: Role[] = ["SPRAVCA_REGISTRATURY", "PRACOVNIK_PODATELNE", "SPRACOVATEL_REGISTRATURY"]

export async function setRegRoles(targetUserId: number, newRoles: Role[]): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }
  if (!session.user.roles.includes("SPRAVCA_REGISTRATURY") && !session.user.roles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie spravovať roly registratúry." }
  }

  const invalid = newRoles.filter(r => !REG_ROLES.includes(r))
  if (invalid.length > 0) return { error: "Neplatná rola." }

  const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, roles: true } })
  if (!user) return { error: "Používateľ nenájdený." }

  const nonRegRoles = (user.roles as Role[]).filter(r => !REG_ROLES.includes(r))
  const updatedRoles = [...nonRegRoles, ...newRoles]

  try {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { roles: updatedRoles },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "USER_REG_ROLES", entityId: targetUserId,
      oldData: { regRoles: (user.roles as Role[]).filter(r => REG_ROLES.includes(r)) },
      newData: { regRoles: newRoles },
    })
    revalidatePath("/dashboard/registratura/admin")
    return { success: true }
  } catch (e) {
    console.error("[setRegRoles]", e)
    return { error: "Nastala chyba." }
  }
}
