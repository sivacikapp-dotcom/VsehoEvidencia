"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import type { Role } from "@/generated/prisma/enums"

// ─── Registratúrny plán ───────────────────────────────────────────────────────

function isValidZnacka(znacka: string): boolean {
  // 1–3 levels separated by dots, each level: letters/digits/hyphens, max 2 dots
  return /^[A-Za-z0-9][A-Za-z0-9]*(\.[A-Za-z0-9][A-Za-z0-9]*){0,2}$/.test(znacka.trim())
}

export async function createPlanItem(data: {
  znacka: string; nazov: string; lehota: number; maArchivnu: boolean
}): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_REGISTRATURY")) return { error: "Nemáte oprávnenie." }

  const znacka = data.znacka.trim().toUpperCase()
  if (!isValidZnacka(znacka)) return { error: "Neplatný formát značky. Povolené: A, A.B, A.B.C (max 3 úrovne)." }
  if (!data.nazov.trim()) return { error: "Názov je povinný." }
  if (!Number.isInteger(data.lehota) || data.lehota < 1) return { error: "Lehota musí byť celé číslo ≥ 1." }

  // Validate parent exists
  const parts = znacka.split(".")
  if (parts.length > 1) {
    const parentZnacka = parts.slice(0, -1).join(".")
    const parent = await prisma.registraturnyPlan.findUnique({ where: { znacka: parentZnacka } })
    if (!parent) return { error: `Nadradená položka „${parentZnacka}" neexistuje.` }
  }

  try {
    await prisma.registraturnyPlan.create({
      data: { znacka, nazov: data.nazov.trim(), lehota: data.lehota, maArchivnu: data.maArchivnu },
    })
    revalidatePath("/dashboard/registratura/nastavenia")
    return {}
  } catch {
    return { error: "Značka musí byť jedinečná." }
  }
}

export async function updatePlanItem(id: number, data: {
  nazov: string; lehota: number; maArchivnu: boolean
}): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_REGISTRATURY")) return { error: "Nemáte oprávnenie." }

  if (!data.nazov.trim()) return { error: "Názov je povinný." }
  if (!Number.isInteger(data.lehota) || data.lehota < 1) return { error: "Lehota musí byť celé číslo ≥ 1." }

  try {
    await prisma.registraturnyPlan.update({
      where: { id },
      data: { nazov: data.nazov.trim(), lehota: data.lehota, maArchivnu: data.maArchivnu },
    })
    revalidatePath("/dashboard/registratura/nastavenia")
    return {}
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function deletePlanItem(id: number): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_REGISTRATURY")) return { error: "Nemáte oprávnenie." }

  const item = await prisma.registraturnyPlan.findUnique({ where: { id } })
  if (!item) return { error: "Položka neexistuje." }

  // Check for children (items with znacka starting with this znacka + ".")
  const children = await prisma.registraturnyPlan.findFirst({
    where: { znacka: { startsWith: item.znacka + "." } },
  })
  if (children) return { error: "Nie je možné zmazať položku, ktorá má podpoložky." }

  // Check for references
  const [zaznamCount, spisCount] = await Promise.all([
    prisma.regZaznam.count({ where: { planId: id } }),
    prisma.spis.count({ where: { planId: id } }),
  ])
  if (zaznamCount > 0 || spisCount > 0) {
    return { error: `Položka sa používa v ${zaznamCount} zázname(och) a ${spisCount} spise(och).` }
  }

  await prisma.registraturnyPlan.delete({ where: { id } })
  revalidatePath("/dashboard/registratura/nastavenia")
  return {}
}

const REG_ROLES: Role[] = ["SPRAVCA_REGISTRATURY", "PRACOVNIK_PODATELNE", "SPRACOVATEL_REGISTRATURY"]

export async function setRegRoles(targetUserId: number, newRoles: Role[]): Promise<{ error?: string }> {
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
    await prisma.user.update({ where: { id: targetUserId }, data: { roles: updatedRoles } })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "USER_REG_ROLES", entityId: targetUserId,
      oldData: { regRoles: (user.roles as Role[]).filter(r => REG_ROLES.includes(r)) },
      newData: { regRoles: newRoles },
    })
    revalidatePath("/dashboard/registratura/nastavenia")
    return {}
  } catch (e) {
    console.error("[setRegRoles]", e)
    return { error: "Nastala chyba." }
  }
}
