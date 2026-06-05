"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { createAuditLog } from "@/lib/auditLog"

type Result = { error?: string; success?: boolean }

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: "Nie ste prihlásený." }

  const userId = parseInt(session.user.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorUsername = (session.user as any).username ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdminAccount = (session.user as any).isAdminAccount ?? false

  if (!oldPassword) return { error: "Zadajte aktuálne heslo." }
  if (!newPassword) return { error: "Zadajte nové heslo." }
  if (newPassword.length < 10) return { error: "Nové heslo musí mať aspoň 10 znakov." }
  if (!PASSWORD_POLICY.test(newPassword))
    return { error: "Nové heslo musí obsahovať aspoň jedno malé písmeno, jedno veľké písmeno a jednu číslicu." }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, username: true, email: true },
  })
  if (!user) return { error: "Používateľ neexistuje." }

  const valid = await bcrypt.compare(oldPassword, user.password)
  if (!valid) return { error: "Aktuálne heslo nie je správne." }

  if (oldPassword === newPassword)
    return { error: "Nové heslo musí byť odlišné od aktuálneho." }

  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: userId }, data: { password: hash } })

  await createAuditLog({
    userId,
    userEmail: session.user.email,
    userName: session.user.name,
    actorUsername,
    action: "PASSWORD_CHANGE",
    entityType: "USER",
    entityId: userId,
    entityLabel: user.username ?? user.email,
  })

  // Notifikácia ostatných adminov pri zmene hesla admin účtu (mustAcknowledge)
  if (isAdminAccount) {
    const otherAdmins = await prisma.user.findMany({
      where: {
        roles: { has: "SPRAVCA_APLIKACIE" },
        isAdminAccount: true,
        lockedUntil: null,
        id: { not: userId },
      },
      select: { id: true },
    })
    if (otherAdmins.length > 0) {
      await prisma.notification.createMany({
        data: otherAdmins.map((u) => ({
          userId: u.id,
          type: "ADMIN_PASSWORD_CHANGED" as const,
          title: "Zmena hesla administrátorského účtu",
          message: `Heslo administrátorského účtu „${user.username ?? user.email}" bolo zmenené.`,
          mustAcknowledge: true,
        })),
      })
    }
  }

  return { success: true }
}
