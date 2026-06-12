"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import { nextSpisNumber, currentYear } from "@/lib/regCounter"

type Result = { error?: string; success?: boolean; id?: number }

function canManageSpis(roles: string[], spis: { spracovatelId: number | null }, userId: number) {
  if (roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")) return true
  return roles.includes("SPRACOVATEL_REGISTRATURY") && spis.spracovatelId === userId
}

const CLOSED_STATUSES = ["StSpis3", "UZATVORENY"] // UZATVORENY = old data compat

export async function createSpis(formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }
  const roles = session.user.roles as string[]
  if (!roles.includes("SPRACOVATEL_REGISTRATURY") && !roles.includes("SPRAVCA_REGISTRATURY") && !roles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie." }
  }

  const nazov = (formData.get("nazov") as string)?.trim()
  if (!nazov) return { error: "Zadajte Vec spisu." }
  const planId = parseInt(formData.get("planId") as string)
  if (isNaN(planId)) return { error: "Vyberte registratúrnu značku." }

  const popis = (formData.get("popis") as string)?.trim() || null
  const utvarIdRaw = formData.get("utvarId") as string
  const utvarId = utvarIdRaw ? parseInt(utvarIdRaw) : null

  const rok = currentYear()
  const cisloSpisu = await nextSpisNumber(rok)

  try {
    const created = await prisma.spis.create({
      data: {
        cisloSpisu,
        nazov,
        rok,
        popis,
        utvarId: utvarId && !isNaN(utvarId) ? utvarId : null,
        planId,
        spracovatelId: parseInt(session.user.id),
        createdById: parseInt(session.user.id),
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "SPIS", entityId: created.id,
      entityLabel: `${cisloSpisu} – ${nazov}`,
      newData: { cisloSpisu, nazov, planId },
    })
    revalidatePath("/dashboard/registratura/spisy")
    return { success: true, id: created.id }
  } catch (e) {
    console.error("[createSpis]", e)
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function updateSpis(spisId: number, formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const spis = await prisma.spis.findUnique({ where: { id: spisId } })
  if (!spis) return { error: "Spis nenájdený." }
  if (!canManageSpis(session.user.roles as string[], spis, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }
  if (CLOSED_STATUSES.includes(spis.status)) return { error: "Vybavený spis nie je možné upravovať." }

  const nazov = (formData.get("nazov") as string)?.trim()
  if (!nazov) return { error: "Zadajte Vec spisu." }

  const popis = (formData.get("popis") as string)?.trim() || null
  const planIdRaw = formData.get("planId") as string
  const planId = planIdRaw ? parseInt(planIdRaw) : spis.planId
  const rokRaw = formData.get("rok") as string
  const rok = rokRaw ? parseInt(rokRaw) : spis.rok
  const utvarIdRaw = formData.get("utvarId") as string
  const utvarId = utvarIdRaw ? parseInt(utvarIdRaw) : null
  const stavRaw = formData.get("status") as string
  const status = stavRaw || spis.status
  const spracovatelIdRaw = formData.get("spracovatelId") as string
  const spracovatelId = spracovatelIdRaw ? parseInt(spracovatelIdRaw) : spis.spracovatelId

  // When moving to Vybavený (StSpis3), check that all records are processed
  if (status === "StSpis3" && spis.status !== "StSpis3") {
    const zaznamy = await prisma.spisZaznam.findMany({
      where: { spisId },
      include: { zaznam: { select: { stav: true, cisloZaznamu: true } } },
    })
    const open = zaznamy.filter(sz => !["StZaz4", "VYBAVENY"].includes(sz.zaznam.stav))
    if (open.length > 0) {
      const nums = open.map(sz => sz.zaznam.cisloZaznamu).join(", ")
      return { error: `Nie je možné vybaviť spis – tieto záznamy nie sú vybavené: ${nums}` }
    }
  }

  const datumUzatvorenia = CLOSED_STATUSES.includes(status) && !CLOSED_STATUSES.includes(spis.status)
    ? new Date()
    : spis.datumUzatvorenia

  try {
    await prisma.spis.update({
      where: { id: spisId },
      data: {
        nazov,
        popis,
        planId: !isNaN(planId) ? planId : spis.planId,
        rok: !isNaN(rok) ? rok : spis.rok,
        utvarId: utvarId && !isNaN(utvarId) ? utvarId : null,
        status,
        spracovatelId: !isNaN(spracovatelId) ? spracovatelId : spis.spracovatelId,
        datumUzatvorenia,
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "SPIS", entityId: spisId,
      entityLabel: spis.cisloSpisu,
      oldData: { nazov: spis.nazov, status: spis.status },
      newData: { nazov, status },
    })
    revalidatePath(`/dashboard/registratura/spisy/${spisId}`)
    revalidatePath("/dashboard/registratura/spisy")
    return { success: true }
  } catch (e) {
    console.error("[updateSpis]", e)
    return { error: "Nastala chyba." }
  }
}

export async function addZaznamToSpis(spisId: number, zaznamId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const [spis, zaznam] = await Promise.all([
    prisma.spis.findUnique({ where: { id: spisId } }),
    prisma.regZaznam.findUnique({ where: { id: zaznamId } }),
  ])
  if (!spis) return { error: "Spis nenájdený." }
  if (!zaznam) return { error: "Záznam nenájdený." }
  if (!canManageSpis(session.user.roles as string[], spis, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie na úpravu tohto spisu." }
  }
  if (CLOSED_STATUSES.includes(spis.status)) return { error: "Vybavený spis nie je možné upravovať." }
  if (zaznam.stav === "StZaz4") return { error: "Vybavený záznam nie je možné vložiť do spisu." }

  const exists = await prisma.spisZaznam.findUnique({
    where: { spisId_zaznamId: { spisId, zaznamId } },
  })
  if (exists) return { error: "Záznam je už v tomto spise." }

  try {
    await prisma.spisZaznam.create({
      data: { spisId, zaznamId, addedById: parseInt(session.user.id) },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "SPIS", entityId: spisId,
      entityLabel: spis.cisloSpisu,
      newData: { addedZaznam: zaznam.cisloZaznamu },
    })
    revalidatePath(`/dashboard/registratura/spisy/${spisId}`)
    return { success: true }
  } catch (e) {
    console.error("[addZaznamToSpis]", e)
    return { error: "Nastala chyba." }
  }
}

export async function removeZaznamFromSpis(spisId: number, zaznamId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const spis = await prisma.spis.findUnique({ where: { id: spisId } })
  if (!spis) return { error: "Spis nenájdený." }
  if (!canManageSpis(session.user.roles as string[], spis, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }
  if (CLOSED_STATUSES.includes(spis.status)) return { error: "Vybavený spis nie je možné upravovať." }

  try {
    await prisma.spisZaznam.delete({
      where: { spisId_zaznamId: { spisId, zaznamId } },
    })
    revalidatePath(`/dashboard/registratura/spisy/${spisId}`)
    return { success: true }
  } catch (e) {
    console.error("[removeZaznamFromSpis]", e)
    return { error: "Nastala chyba." }
  }
}

// kept for backward compatibility — no longer called from new UI
export async function uzatvoritSpis(spisId: number): Promise<Result> {
  const fd = new FormData()
  fd.append("status", "StSpis3")
  return { error: "Použite pole Stav v editačnom formulári." }
}
