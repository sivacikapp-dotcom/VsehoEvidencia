"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import { nextPostaNumber, nextZaznamNumber, currentYear } from "@/lib/regCounter"
import type { PostaDirection } from "@/generated/prisma/enums"

type Result = { error?: string; success?: boolean; id?: number }

function canWrite(roles: string[]) {
  return roles.includes("PRACOVNIK_PODATELNE") || roles.includes("SPRAVCA_APLIKACIE")
}

export async function createPosta(formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }
  if (!canWrite(session.user.roles)) return { error: "Nemáte oprávnenie." }

  const vec = (formData.get("vec") as string)?.trim()
  const nazov = (formData.get("odosielatelPrijemcaNazov") as string)?.trim()
  if (!vec || !nazov) return { error: "Vyplňte povinné polia." }

  const dateRaw = formData.get("datumDoruceOdoslania") as string
  const datum = new Date(dateRaw)
  if (isNaN(datum.getTime())) return { error: "Neplatný dátum." }

  const year = datum.getFullYear()
  const poradoveCislo = await nextPostaNumber(year)

  try {
    const created = await prisma.posta.create({
      data: {
        poradoveCislo,
        smer: formData.get("smer") as PostaDirection,
        datumDoruceOdoslania: datum,
        sposob: formData.get("sposob") as string,
        odosielatelPrijemcaNazov: nazov,
        odosielatelPrijemcaAdresa: (formData.get("adresa") as string)?.trim() || null,
        odosielatelPrijemcaIco: (formData.get("ico") as string)?.trim() || null,
        vec,
        createdById: parseInt(session.user.id),
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "POSTA", entityId: created.id,
      entityLabel: `${poradoveCislo} – ${vec}`,
      newData: { poradoveCislo, smer: created.smer, vec },
    })
    revalidatePath("/dashboard/registratura/podatelna")
    return { success: true, id: created.id }
  } catch (e) {
    console.error("[createPosta]", e)
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function updatePosta(postaId: number, formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }
  if (!canWrite(session.user.roles)) return { error: "Nemáte oprávnenie." }

  const posta = await prisma.posta.findUnique({ where: { id: postaId } })
  if (!posta) return { error: "Záznam nenájdený." }
  if (posta.status === "PREKLASIFIKOVANA") return { error: "Preklopenú poštu nie je možné upravovať." }

  const vec = (formData.get("vec") as string)?.trim()
  const nazov = (formData.get("odosielatelPrijemcaNazov") as string)?.trim()
  if (!vec || !nazov) return { error: "Vyplňte povinné polia." }

  const dateRaw = formData.get("datumDoruceOdoslania") as string
  const datum = new Date(dateRaw)
  if (isNaN(datum.getTime())) return { error: "Neplatný dátum." }

  try {
    const updated = await prisma.posta.update({
      where: { id: postaId },
      data: {
        smer: formData.get("smer") as PostaDirection,
        datumDoruceOdoslania: datum,
        sposob: formData.get("sposob") as string,
        odosielatelPrijemcaNazov: nazov,
        odosielatelPrijemcaAdresa: (formData.get("adresa") as string)?.trim() || null,
        odosielatelPrijemcaIco: (formData.get("ico") as string)?.trim() || null,
        vec,
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "POSTA", entityId: postaId,
      entityLabel: `${posta.poradoveCislo} – ${vec}`,
      oldData: { vec: posta.vec, smer: posta.smer },
      newData: { vec: updated.vec, smer: updated.smer },
    })
    revalidatePath("/dashboard/registratura/podatelna")
    return { success: true }
  } catch (e) {
    console.error("[updatePosta]", e)
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function prekloritDoRegistratury(
  postaId: number,
  planId: number,
  spracovatelId: number,
  typZaznamu: "ELEKTRONICKY" | "NEELEKTRONICKY",
  umiestnenie: string
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }
  if (!canWrite(session.user.roles)) return { error: "Nemáte oprávnenie." }

  const posta = await prisma.posta.findUnique({ where: { id: postaId } })
  if (!posta) return { error: "Pošta nenájdená." }
  if (posta.status === "PREKLASIFIKOVANA") return { error: "Pošta už bola presunutá do registratúry." }

  const plan = await prisma.registraturnyPlan.findUnique({ where: { id: planId } })
  if (!plan) return { error: "Registratúrny plán nenájdený." }

  const year = currentYear()
  const cisloZaznamu = await nextZaznamNumber(year)

  try {
    const zaznam = await prisma.$transaction(async (tx) => {
      const z = await tx.regZaznam.create({
        data: {
          cisloZaznamu,
          postaId,
          planId,
          spracovatelId,
          formaZaznamu: typZaznamu,
          rok: year,
          kategoria: "PRIJATY",
          stav: "PRIDELENY",
          createdById: parseInt(session.user.id),
        },
      })
      await tx.posta.update({
        where: { id: postaId },
        data: { status: "PREKLASIFIKOVANA" },
      })
      return z
    })

    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "REG_ZAZNAM", entityId: zaznam.id,
      entityLabel: cisloZaznamu,
      newData: { cisloZaznamu, postaId, planId, spracovatelId, typZaznamu },
    })
    revalidatePath("/dashboard/registratura/podatelna")
    revalidatePath("/dashboard/registratura/zaznamy")
    return { success: true, id: zaznam.id }
  } catch (e) {
    console.error("[prekloritDoRegistratury]", e)
    return { error: "Nastala chyba pri prekladaní do registratúry." }
  }
}
