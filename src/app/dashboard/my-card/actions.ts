"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

type Result = { error?: string; success?: boolean }

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: "Nie ste prihlásený." }

  const userId = parseInt(session.user.id)

  if (!oldPassword) return { error: "Zadajte aktuálne heslo." }
  if (!newPassword) return { error: "Zadajte nové heslo." }
  if (newPassword.length < 10) return { error: "Nové heslo musí mať aspoň 10 znakov." }
  if (!PASSWORD_POLICY.test(newPassword))
    return { error: "Nové heslo musí obsahovať aspoň jedno malé písmeno, jedno veľké písmeno a jednu číslicu." }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })
  if (!user) return { error: "Používateľ neexistuje." }

  const valid = await bcrypt.compare(oldPassword, user.password)
  if (!valid) return { error: "Aktuálne heslo nie je správne." }

  if (oldPassword === newPassword)
    return { error: "Nové heslo musí byť odlišné od aktuálneho." }

  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: userId }, data: { password: hash } })

  return { success: true }
}
