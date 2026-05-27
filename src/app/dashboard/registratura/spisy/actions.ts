"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import { nextSpisNumber, currentYear } from "@/lib/regCounter"

type Result = { error?: string; success?: boolean; id?: number }

function canManageSpis(roles: string[], spis: { spracovatelId: number }, userId: number) {
  if (roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")) return true
  return roles.includes("SPRACOVATEL_REGISTRATURY") && spis.spracovatelId === userId
}

export async function createSpis(formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }
  const roles = session.user.roles as string[]
  if (!roles.includes("SPRACOVATEL_REGISTRATURY") && !roles.includes("SPRAVCA_REGISTRATURY") && !roles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie." }
  }

  const nazov = (formData.get("nazov") as string)?.trim()
  if (!nazov) return { error: "Zadajte názov spisu." }
  const planId = parseInt(formData.get("planId") as string)
  if (isNaN(planId)) return { error: "Vyberte registratúrny plán." }

  const year = currentYear()
  const cisloSpisu = await nextSpisNumber(year)

  try {
    const created = await prisma.spis.create({
      data: {
        cisloSpisu,
        nazov,
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
  if (spis.status === "UZATVORENY") return { error: "Uzatvorený spis nie je možné upravovať." }

  const nazov = (formData.get("nazov") as string)?.trim()
  if (!nazov) return { error: "Zadajte názov spisu." }

  try {
    await prisma.spis.update({
      where: { id: spisId },
      data: { nazov, planId: parseInt(formData.get("planId") as string) },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "SPIS", entityId: spisId,
      entityLabel: spis.cisloSpisu,
      oldData: { nazov: spis.nazov }, newData: { nazov },
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
  if (spis.status === "UZATVORENY") return { error: "Uzatvorený spis nie je možné upravovať." }
  if (zaznam.status === "VYRADENY") return { error: "Vyradený záznam nie je možné vložiť do spisu." }

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
  if (spis.status === "UZATVORENY") return { error: "Uzatvorený spis nie je možné upravovať." }

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

export async function uzatvoritSpis(spisId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const spis = await prisma.spis.findUnique({
    where: { id: spisId },
    include: { zaznamy: { include: { zaznam: { select: { status: true, cisloZaznamu: true } } } }, plan: true },
  })
  if (!spis) return { error: "Spis nenájdený." }
  if (!canManageSpis(session.user.roles as string[], spis, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }
  if (spis.status === "UZATVORENY") return { error: "Spis je už uzatvorený." }

  const openZaznamy = spis.zaznamy.filter(
    sz => sz.zaznam.status !== "UZAVRETY" && sz.zaznam.status !== "VYRADENY"
  )
  if (openZaznamy.length > 0) {
    const nums = openZaznamy.map(sz => sz.zaznam.cisloZaznamu).join(", ")
    return { error: `Nie je možné uzatvoriť spis – tieto záznamy nie sú uzavreté: ${nums}` }
  }

  const rok = new Date().getFullYear() + spis.plan.lehota

  try {
    await prisma.spis.update({
      where: { id: spisId },
      data: { status: "UZATVORENY", datumUzatvorenia: new Date(), rokVyradenia: rok },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "SPIS", entityId: spisId,
      entityLabel: spis.cisloSpisu,
      oldData: { status: "OTVORENY" }, newData: { status: "UZATVORENY", rokVyradenia: rok },
    })
    revalidatePath(`/dashboard/registratura/spisy/${spisId}`)
    revalidatePath("/dashboard/registratura/spisy")
    return { success: true }
  } catch (e) {
    console.error("[uzatvoritSpis]", e)
    return { error: "Nastala chyba." }
  }
}
