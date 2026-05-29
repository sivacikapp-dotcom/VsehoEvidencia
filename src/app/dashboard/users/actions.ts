"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import type { Role } from "@/generated/prisma/enums"
import { createAuditLog } from "@/lib/auditLog"

type Result = { error?: string; success?: boolean }

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePassword(password: string): string | null {
  if (!password || password.length < 10) return "Heslo musí mať aspoň 10 znakov."
  if (!PASSWORD_POLICY.test(password))
    return "Heslo musí obsahovať aspoň jedno malé písmeno, jedno veľké písmeno a jednu číslicu."
  return null
}

export async function createUser(formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || (!callerRoles.includes("SPRAVCA_APLIKACIE") && !callerRoles.includes("SPRAVCA_APLIKACIE"))) {
    return { error: "Nemáte oprávnenie vytvárať používateľov." }
  }

  const firstName = (formData.get("firstName") as string)?.trim()
  const lastName = (formData.get("lastName") as string)?.trim()
  if (!firstName) return { error: "Meno je povinné." }
  if (!lastName) return { error: "Priezvisko je povinné." }
  if (firstName.length > 100 || lastName.length > 100)
    return { error: "Meno alebo priezvisko je príliš dlhé." }

  const email = (formData.get("email") as string)?.trim().toLowerCase()
  if (!email || !EMAIL_PATTERN.test(email))
    return { error: "Zadajte platnú e-mailovú adresu." }

  const password = (formData.get("password") as string)?.trim()
  const passwordError = validatePassword(password)
  if (passwordError) return { error: passwordError }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: `Email „${email}" je už registrovaný.` }

  const rolesRaw = formData.getAll("roles") as string[]
  const roles = rolesRaw.filter(Boolean) as Role[]
  if (roles.length === 0) return { error: "Vyberte aspoň jednu rolu." }

  const supervisorIdRaw = formData.get("supervisorId") as string
  const supervisorId = supervisorIdRaw ? parseInt(supervisorIdRaw) : null

  try {
    const hash = await bcrypt.hash(password, 12)
    const created = await prisma.user.create({
      data: { firstName, lastName, email, password: hash, roles, supervisorId: supervisorId || null },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "USER", entityId: created.id, entityLabel: created.email,
      newData: { firstName, lastName, email, roles, supervisorId: supervisorId || null },
    })
    revalidatePath("/dashboard/users")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function updateUser(
  userId: number,
  roles: Role[],
  supervisorId: number | null
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || (!callerRoles.includes("SPRAVCA_APLIKACIE") && !callerRoles.includes("SPRAVCA_APLIKACIE"))) {
    return { error: "Nemáte oprávnenie upravovať používateľov." }
  }
  if (roles.length === 0) return { error: "Vyberte aspoň jednu rolu." }

  const oldUser = await prisma.user.findUnique({ where: { id: userId }, select: { roles: true, supervisorId: true, email: true } })

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { roles, supervisorId },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "USER", entityId: userId, entityLabel: oldUser?.email ?? null,
      oldData: oldUser ? { roles: oldUser.roles, supervisorId: oldUser.supervisorId } : null,
      newData: { roles, supervisorId },
    })
    revalidatePath("/dashboard/users")
    revalidatePath(`/dashboard/users/${userId}`)
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function deleteUser(userId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || (!callerRoles.includes("SPRAVCA_APLIKACIE") && !callerRoles.includes("SPRAVCA_APLIKACIE"))) {
    return { error: "Nemáte oprávnenie mazať používateľov." }
  }
  if (parseInt(session.user.id) === userId) {
    return { error: "Nemôžete vymazať vlastný účet." }
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true } })
  if (!user) return { error: "Používateľ neexistuje." }

  const activeAssets = await prisma.assetRecipientAssignment.count({ where: { userId, returnedAt: null } })
  if (activeAssets > 0) {
    return { error: `Používateľ má ${activeAssets} aktívnych priradení majetku. Najprv vráťte majetok.` }
  }

  try {
    await prisma.user.delete({ where: { id: userId } })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "DELETE", entityType: "USER", entityId: userId, entityLabel: user.email,
      oldData: { email: user.email, firstName: user.firstName, lastName: user.lastName },
    })
    revalidatePath("/dashboard/users")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri mazaní." }
  }
}

export async function setUserRoomAccess(
  userId: number,
  roomIds: number[]
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || (!callerRoles.includes("SPRAVCA_MAJETKU") && !callerRoles.includes("SPRAVCA_APLIKACIE"))) {
    return { error: "Nemáte oprávnenie spravovať prístupy do miestností." }
  }

  try {
    await prisma.userRoomAccess.deleteMany({ where: { userId } })
    if (roomIds.length > 0) {
      await prisma.userRoomAccess.createMany({
        data: roomIds.map((roomId) => ({ userId, roomId })),
      })
    }
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "ROOM_ACCESS", entityId: userId, entityLabel: null,
      newData: { userId, roomIds },
    })
    revalidatePath(`/dashboard/users/${userId}`)
    revalidatePath("/dashboard/rooms")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}
