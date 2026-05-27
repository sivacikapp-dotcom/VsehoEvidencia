"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import { nextZaznamNumber, currentYear } from "@/lib/regCounter"
import type { RegZaznamType, RegZaznamStatus } from "@/generated/prisma/enums"

type Result = { error?: string; success?: boolean; id?: number }

function canManageZaznam(roles: string[], zaznam: { spracovatelId: number }, userId: number) {
  if (roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")) return true
  return roles.includes("SPRACOVATEL_REGISTRATURY") && zaznam.spracovatelId === userId
}

export async function createZaznam(formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }
  const roles = session.user.roles as string[]
  if (!roles.includes("SPRACOVATEL_REGISTRATURY") && !roles.includes("SPRAVCA_REGISTRATURY") && !roles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie." }
  }

  const planId = parseInt(formData.get("planId") as string)
  if (isNaN(planId)) return { error: "Vyberte registratúrny plán." }

  const plan = await prisma.registraturnyPlan.findUnique({ where: { id: planId } })
  if (!plan) return { error: "Registratúrny plán nenájdený." }

  const year = currentYear()
  const cisloZaznamu = await nextZaznamNumber(year)
  const typZaznamu = formData.get("typZaznamu") as RegZaznamType

  try {
    const created = await prisma.regZaznam.create({
      data: {
        cisloZaznamu,
        planId,
        spracovatelId: parseInt(session.user.id),
        typZaznamu,
        umiestnenieFyzicke: typZaznamu === "NEELEKTRONICKY" ? ((formData.get("umiestnenie") as string)?.trim() || null) : null,
        createdById: parseInt(session.user.id),
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "REG_ZAZNAM", entityId: created.id,
      entityLabel: cisloZaznamu,
      newData: { cisloZaznamu, planId, typZaznamu },
    })
    revalidatePath("/dashboard/registratura/zaznamy")
    return { success: true, id: created.id }
  } catch (e) {
    console.error("[createZaznam]", e)
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function updateZaznam(zaznamId: number, formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam) return { error: "Záznam nenájdený." }
  if (!canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie na úpravu tohto záznamu." }
  }
  if (zaznam.status === "UZAVRETY" || zaznam.status === "VYRADENY") {
    return { error: "Uzavretý alebo vyradený záznam nie je možné upravovať." }
  }

  const planId = parseInt(formData.get("planId") as string)
  if (isNaN(planId)) return { error: "Vyberte registratúrny plán." }

  try {
    await prisma.regZaznam.update({
      where: { id: zaznamId },
      data: {
        planId,
        typZaznamu: formData.get("typZaznamu") as RegZaznamType,
        umiestnenieFyzicke: (formData.get("umiestnenie") as string)?.trim() || null,
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "REG_ZAZNAM", entityId: zaznamId,
      entityLabel: zaznam.cisloZaznamu,
      oldData: { planId: zaznam.planId, typZaznamu: zaznam.typZaznamu },
      newData: { planId, typZaznamu: formData.get("typZaznamu") },
    })
    revalidatePath(`/dashboard/registratura/zaznamy/${zaznamId}`)
    revalidatePath("/dashboard/registratura/zaznamy")
    return { success: true }
  } catch (e) {
    console.error("[updateZaznam]", e)
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function changeZaznamStatus(zaznamId: number, newStatus: RegZaznamStatus): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam) return { error: "Záznam nenájdený." }
  if (!canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }

  const validTransitions: Record<RegZaznamStatus, RegZaznamStatus[]> = {
    ROZPRACOVANY: ["REGISTROVANY"],
    REGISTROVANY: ["UZAVRETY"],
    UZAVRETY: [],
    VYRADENY: [],
  }
  if (!validTransitions[zaznam.status].includes(newStatus)) {
    return { error: `Neplatný prechod stavu z ${zaznam.status} na ${newStatus}.` }
  }

  try {
    await prisma.regZaznam.update({
      where: { id: zaznamId },
      data: { status: newStatus },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "REG_ZAZNAM", entityId: zaznamId,
      entityLabel: zaznam.cisloZaznamu,
      oldData: { status: zaznam.status },
      newData: { status: newStatus },
    })
    revalidatePath(`/dashboard/registratura/zaznamy/${zaznamId}`)
    revalidatePath("/dashboard/registratura/zaznamy")
    return { success: true }
  } catch (e) {
    console.error("[changeZaznamStatus]", e)
    return { error: "Nastala chyba." }
  }
}

export async function setZaznamFileMetadata(
  zaznamId: number,
  meta: { originalName: string; storedName: string; mimeType: string; fileSize: number; fileHash: string }
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam) return { error: "Záznam nenájdený." }
  if (!canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }
  if (zaznam.typZaznamu !== "ELEKTRONICKY") return { error: "Záznam nie je elektronický." }
  if (zaznam.storedName) return { error: "Súbor je už nahratý. Elektronický dokument je po uložení nemenný." }

  try {
    await prisma.regZaznam.update({
      where: { id: zaznamId },
      data: { ...meta, status: "REGISTROVANY" },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "REG_ZAZNAM", entityId: zaznamId,
      entityLabel: zaznam.cisloZaznamu,
      newData: { originalName: meta.originalName, fileSize: meta.fileSize, fileHash: meta.fileHash, status: "REGISTROVANY" },
    })
    revalidatePath(`/dashboard/registratura/zaznamy/${zaznamId}`)
    return { success: true }
  } catch (e) {
    console.error("[setZaznamFileMetadata]", e)
    return { error: "Nastala chyba." }
  }
}
