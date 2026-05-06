"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import type { Role } from "@/generated/prisma/enums"

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
  if (!session || !callerRoles.includes("SPRAVCA_KARIET")) {
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
    await prisma.user.create({
      data: { firstName, lastName, email, password: hash, roles, supervisorId: supervisorId || null },
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
  if (!session || !callerRoles.includes("SPRAVCA_KARIET")) {
    return { error: "Nemáte oprávnenie upravovať používateľov." }
  }
  if (roles.length === 0) return { error: "Vyberte aspoň jednu rolu." }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { roles, supervisorId },
    })
    revalidatePath("/dashboard/users")
    revalidatePath(`/dashboard/users/${userId}`)
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function setUserRoomAccess(
  userId: number,
  roomIds: number[]
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !callerRoles.includes("SPRAVCA_KARIET")) {
    return { error: "Nemáte oprávnenie spravovať prístupy do miestností." }
  }

  try {
    await prisma.userRoomAccess.deleteMany({ where: { userId } })
    if (roomIds.length > 0) {
      await prisma.userRoomAccess.createMany({
        data: roomIds.map((roomId) => ({ userId, roomId })),
      })
    }
    revalidatePath(`/dashboard/users/${userId}`)
    revalidatePath("/dashboard/rooms")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}
