"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"

type Result = { error?: string; success?: boolean }

function isAdmin(roles: string[]) {
  return roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
}

export async function createPlanEntry(formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.roles)) return { error: "Nemáte oprávnenie." }

  const znacka = (formData.get("znacka") as string)?.trim().toUpperCase()
  const nazov = (formData.get("nazov") as string)?.trim()
  const lehota = parseInt(formData.get("lehota") as string)

  if (!znacka || !nazov) return { error: "Vyplňte povinné polia." }
  if (isNaN(lehota) || lehota < 1 || lehota > 100) return { error: "Lehota musí byť 1–100 rokov." }

  const exists = await prisma.registraturnyPlan.findUnique({ where: { znacka } })
  if (exists) return { error: `Značka „${znacka}" už existuje.` }

  try {
    const created = await prisma.registraturnyPlan.create({
      data: { znacka, nazov, lehota, maArchivnu: formData.get("maArchivnu") === "on" },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "REG_PLAN", entityId: created.id,
      entityLabel: `${znacka} – ${nazov}`,
      newData: { znacka, nazov, lehota, maArchivnu: created.maArchivnu },
    })
    revalidatePath("/dashboard/registratura/plan")
    return { success: true }
  } catch (e) {
    console.error("[createPlanEntry]", e)
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function updatePlanEntry(planId: number, formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.roles)) return { error: "Nemáte oprávnenie." }

  const znacka = (formData.get("znacka") as string)?.trim().toUpperCase()
  const nazov = (formData.get("nazov") as string)?.trim()
  const lehota = parseInt(formData.get("lehota") as string)

  if (!znacka || !nazov) return { error: "Vyplňte povinné polia." }
  if (isNaN(lehota) || lehota < 1 || lehota > 100) return { error: "Lehota musí byť 1–100 rokov." }

  const dup = await prisma.registraturnyPlan.findFirst({ where: { znacka, NOT: { id: planId } } })
  if (dup) return { error: `Značka „${znacka}" je už použitá.` }

  const old = await prisma.registraturnyPlan.findUnique({ where: { id: planId } })
  if (!old) return { error: "Položka nenájdená." }

  try {
    const updated = await prisma.registraturnyPlan.update({
      where: { id: planId },
      data: { znacka, nazov, lehota, maArchivnu: formData.get("maArchivnu") === "on" },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "REG_PLAN", entityId: planId,
      entityLabel: `${znacka} – ${nazov}`,
      oldData: { znacka: old.znacka, nazov: old.nazov, lehota: old.lehota, maArchivnu: old.maArchivnu },
      newData: { znacka: updated.znacka, nazov: updated.nazov, lehota: updated.lehota, maArchivnu: updated.maArchivnu },
    })
    revalidatePath("/dashboard/registratura/plan")
    return { success: true }
  } catch (e) {
    console.error("[updatePlanEntry]", e)
    return { error: "Nastala chyba." }
  }
}

export async function deletePlanEntry(planId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session || !isAdmin(session.user.roles)) return { error: "Nemáte oprávnenie." }

  const entry = await prisma.registraturnyPlan.findUnique({
    where: { id: planId },
    include: { _count: { select: { zaznamy: true, spisy: true } } },
  })
  if (!entry) return { error: "Položka nenájdená." }
  if (entry._count.zaznamy > 0 || entry._count.spisy > 0) {
    return { error: "Položku nie je možné vymazať — sú na ňu naviazané záznamy alebo spisy." }
  }

  try {
    await prisma.registraturnyPlan.delete({ where: { id: planId } })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "DELETE", entityType: "REG_PLAN", entityId: planId,
      entityLabel: `${entry.znacka} – ${entry.nazov}`,
    })
    revalidatePath("/dashboard/registratura/plan")
    return { success: true }
  } catch (e) {
    console.error("[deletePlanEntry]", e)
    return { error: "Nastala chyba." }
  }
}
