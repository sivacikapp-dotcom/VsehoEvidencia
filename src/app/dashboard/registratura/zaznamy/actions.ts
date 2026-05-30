"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import { nextZaznamNumber, currentYear } from "@/lib/regCounter"
import { writeFile, mkdir, unlink } from "fs/promises"
import { join } from "path"
import { createHash, randomUUID } from "crypto"
import type { ZaznamKategoria, ZaznamDovernost, RegZaznamType } from "@/generated/prisma/enums"

type Result = { error?: string; success?: boolean; id?: number }

function canManageZaznam(roles: string[], zaznam: { spracovatelId: number }, userId: number) {
  if (roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")) return true
  return roles.includes("SPRACOVATEL_REGISTRATURY") && zaznam.spracovatelId === userId
}

const UPLOAD_DIR = join(process.cwd(), "uploads", "registratura")
const ALLOWED_EXT = new Set(["pdf", "doc", "docx", "xls", "xlsx", "odt", "ods", "txt", "png", "jpg", "jpeg", "eml", "msg"])
const MAX_SIZE = 50 * 1024 * 1024

// ─── CREATE ZAZNAM ────────────────────────────────────────────────────────────

export async function createZaznam(formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }
  const roles = session.user.roles as string[]
  if (!roles.includes("SPRACOVATEL_REGISTRATURY") && !roles.includes("SPRAVCA_REGISTRATURY")) {
    return { error: "Nemáte oprávnenie." }
  }

  const kategoria = formData.get("kategoria") as ZaznamKategoria
  if (!["PRIJATY", "VYTVORENY"].includes(kategoria)) return { error: "Neplatná kategória záznamu." }

  const formaZaznamu = (formData.get("formaZaznamu") as RegZaznamType) || "ELEKTRONICKY"
  const vec = (formData.get("vec") as string)?.trim() || null
  const popis = (formData.get("popis") as string)?.trim() || null
  const dovernost = (formData.get("dovernost") as ZaznamDovernost) || "INTERNE"
  const utvarIdRaw = formData.get("utvarId") as string
  const utvarId = utvarIdRaw ? parseInt(utvarIdRaw) : null

  const kontakt = {
    meno:          (formData.get("meno") as string)?.trim() || null,
    priezvisko:    (formData.get("priezvisko") as string)?.trim() || null,
    nazov:         (formData.get("nazov") as string)?.trim() || null,
    oddelenie:     (formData.get("oddelenie") as string)?.trim() || null,
    ulica:         (formData.get("ulica") as string)?.trim() || null,
    mesto:         (formData.get("mesto") as string)?.trim() || null,
    psc:           (formData.get("psc") as string)?.trim() || null,
    identifikator: (formData.get("identifikator") as string)?.trim() || null,
  }
  const hasKontakt = Object.values(kontakt).some(Boolean)

  const rok = currentYear()
  const cisloZaznamu = await nextZaznamNumber(rok)
  const stav = kategoria === "PRIJATY" ? "StZaz1" : "StZaz2"

  try {
    const created = await prisma.regZaznam.create({
      data: {
        cisloZaznamu,
        kategoria,
        rok,
        spracovatelId: parseInt(session.user.id),
        utvarId: utvarId && !isNaN(utvarId) ? utvarId : null,
        formaZaznamu,
        vec,
        popis,
        stav,
        dovernost,
        createdById: parseInt(session.user.id),
      },
    })

    if (hasKontakt) {
      if (kategoria === "PRIJATY") {
        await prisma.zaznamOdosielatel.create({ data: { zaznamId: created.id, ...kontakt } })
      } else {
        await prisma.zaznamAdresat.create({ data: { zaznamId: created.id, poradie: 0, ...kontakt } })
      }
    }

    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "REG_ZAZNAM", entityId: created.id,
      entityLabel: cisloZaznamu,
      newData: { cisloZaznamu, kategoria, formaZaznamu, stav },
    })
    revalidatePath("/dashboard/registratura/zaznamy")
    return { success: true, id: created.id }
  } catch (e) {
    console.error("[createZaznam]", e)
    return { error: "Nastala chyba pri ukladaní." }
  }
}

// ─── UPDATE ZAZNAM ────────────────────────────────────────────────────────────

export async function updateZaznam(zaznamId: number, formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam) return { error: "Záznam nenájdený." }
  if (!canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie na úpravu tohto záznamu." }
  }
  if (zaznam.stav === "StZaz3" || zaznam.stav === "StZaz4") {
    return { error: "Uzavretý alebo vybavený záznam nie je možné upravovať." }
  }

  const formaZaznamu = formData.get("formaZaznamu") as RegZaznamType
  const vec = (formData.get("vec") as string)?.trim() || null
  const popis = (formData.get("popis") as string)?.trim() || null
  const dovernost = formData.get("dovernost") as ZaznamDovernost
  const utvarIdRaw = formData.get("utvarId") as string
  const utvarId = utvarIdRaw ? parseInt(utvarIdRaw) : null
  const rokRaw = formData.get("rok") as string
  const rok = rokRaw ? parseInt(rokRaw) : zaznam.rok
  const stavRaw = formData.get("stav") as string
  const stav = stavRaw || zaznam.stav
  const spracovatelIdRaw = formData.get("spracovatelId") as string
  const spracovatelId = spracovatelIdRaw ? parseInt(spracovatelIdRaw) : zaznam.spracovatelId
  const sposobRaw = formData.get("sposobVybavenia") as string
  const sposobVybavenia: string | null = stav === "StZaz4" && sposobRaw ? sposobRaw : null

  if (stav === "StZaz4" && !sposobVybavenia) {
    return { error: "Pre stav Vybavený je potrebné vybrať spôsob vybavenia." }
  }

  try {
    await prisma.regZaznam.update({
      where: { id: zaznamId },
      data: {
        formaZaznamu,
        vec,
        popis,
        dovernost,
        rok,
        stav,
        spracovatelId: !isNaN(spracovatelId) ? spracovatelId : zaznam.spracovatelId,
        utvarId: utvarId && !isNaN(utvarId) ? utvarId : null,
        sposobVybavenia,
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "REG_ZAZNAM", entityId: zaznamId,
      entityLabel: zaznam.cisloZaznamu,
      newData: { formaZaznamu, vec, dovernost },
    })
    revalidatePath(`/dashboard/registratura/zaznamy/${zaznamId}`)
    revalidatePath("/dashboard/registratura/zaznamy")
    return { success: true }
  } catch (e) {
    console.error("[updateZaznam]", e)
    return { error: "Nastala chyba pri ukladaní." }
  }
}

// ─── CHANGE STAV ──────────────────────────────────────────────────────────────

export async function changeZaznamStav(zaznamId: number, newStav: string, sposobVybavenia?: string): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam) return { error: "Záznam nenájdený." }
  if (!canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }
  if (newStav === "StZaz4" && !sposobVybavenia) {
    return { error: "Pre vybavenie záznamu je potrebné vybrať spôsob vybavenia." }
  }

  try {
    await prisma.regZaznam.update({
      where: { id: zaznamId },
      data: { stav: newStav, sposobVybavenia: sposobVybavenia ?? null },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "REG_ZAZNAM", entityId: zaznamId,
      entityLabel: zaznam.cisloZaznamu,
      oldData: { stav: zaznam.stav },
      newData: { stav: newStav, sposobVybavenia },
    })
    revalidatePath(`/dashboard/registratura/zaznamy/${zaznamId}`)
    revalidatePath("/dashboard/registratura/zaznamy")
    return { success: true }
  } catch (e) {
    console.error("[changeZaznamStav]", e)
    return { error: "Nastala chyba." }
  }
}

// ─── ODOSIELATEĽ ─────────────────────────────────────────────────────────────

export async function saveOdosielatel(zaznamId: number, formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam) return { error: "Záznam nenájdený." }
  if (!canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }
  if (zaznam.kategoria !== "PRIJATY") return { error: "Odosielateľ je len pre prijaté záznamy." }

  const data = {
    meno: (formData.get("meno") as string)?.trim() || null,
    priezvisko: (formData.get("priezvisko") as string)?.trim() || null,
    nazov: (formData.get("nazov") as string)?.trim() || null,
    oddelenie: (formData.get("oddelenie") as string)?.trim() || null,
    ulica: (formData.get("ulica") as string)?.trim() || null,
    mesto: (formData.get("mesto") as string)?.trim() || null,
    psc: (formData.get("psc") as string)?.trim() || null,
    identifikator: (formData.get("identifikator") as string)?.trim() || null,
  }

  await prisma.zaznamOdosielatel.upsert({
    where: { zaznamId },
    create: { zaznamId, ...data },
    update: data,
  })
  revalidatePath(`/dashboard/registratura/zaznamy/${zaznamId}`)
  return { success: true }
}

// ─── ADRESÁTI ─────────────────────────────────────────────────────────────────

export async function addAdresat(zaznamId: number, formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam) return { error: "Záznam nenájdený." }
  if (!canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }
  if (zaznam.kategoria !== "VYTVORENY") return { error: "Adresáti sú len pre vytvorené záznamy." }

  const maxPoradie = await prisma.zaznamAdresat.aggregate({
    where: { zaznamId },
    _max: { poradie: true },
  })
  const poradie = (maxPoradie._max.poradie ?? -1) + 1

  await prisma.zaznamAdresat.create({
    data: {
      zaznamId,
      poradie,
      meno: (formData.get("meno") as string)?.trim() || null,
      priezvisko: (formData.get("priezvisko") as string)?.trim() || null,
      nazov: (formData.get("nazov") as string)?.trim() || null,
      oddelenie: (formData.get("oddelenie") as string)?.trim() || null,
      ulica: (formData.get("ulica") as string)?.trim() || null,
      mesto: (formData.get("mesto") as string)?.trim() || null,
      psc: (formData.get("psc") as string)?.trim() || null,
      identifikator: (formData.get("identifikator") as string)?.trim() || null,
    },
  })
  revalidatePath(`/dashboard/registratura/zaznamy/${zaznamId}`)
  return { success: true }
}

export async function updateAdresat(adresatId: number, formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const adresat = await prisma.zaznamAdresat.findUnique({ where: { id: adresatId } })
  if (!adresat) return { error: "Adresát nenájdený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: adresat.zaznamId } })
  if (!zaznam || !canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }

  await prisma.zaznamAdresat.update({
    where: { id: adresatId },
    data: {
      meno: (formData.get("meno") as string)?.trim() || null,
      priezvisko: (formData.get("priezvisko") as string)?.trim() || null,
      nazov: (formData.get("nazov") as string)?.trim() || null,
      oddelenie: (formData.get("oddelenie") as string)?.trim() || null,
      ulica: (formData.get("ulica") as string)?.trim() || null,
      mesto: (formData.get("mesto") as string)?.trim() || null,
      psc: (formData.get("psc") as string)?.trim() || null,
      identifikator: (formData.get("identifikator") as string)?.trim() || null,
    },
  })
  revalidatePath(`/dashboard/registratura/zaznamy/${adresat.zaznamId}`)
  return { success: true }
}

export async function deleteAdresat(adresatId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const adresat = await prisma.zaznamAdresat.findUnique({ where: { id: adresatId } })
  if (!adresat) return { error: "Adresát nenájdený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: adresat.zaznamId } })
  if (!zaznam || !canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }

  await prisma.zaznamAdresat.delete({ where: { id: adresatId } })
  revalidatePath(`/dashboard/registratura/zaznamy/${adresat.zaznamId}`)
  return { success: true }
}

// ─── PRÍLOHY ─────────────────────────────────────────────────────────────────

export async function addZaznamPriloha(zaznamId: number, formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam) return { error: "Záznam nenájdený." }
  if (!canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }

  const nazov = (formData.get("nazov") as string)?.trim()
  if (!nazov) return { error: "Názov prílohy je povinný." }

  const forma = (formData.get("forma") as RegZaznamType) || zaznam.formaZaznamu
  const file = formData.get("file") as File | null

  // Auto-generate číslo prílohy
  const maxCislo = await prisma.zaznamPriloha.aggregate({
    where: { zaznamId },
    _max: { cislo: true },
  })
  const cislo = (maxCislo._max.cislo ?? 0) + 1

  let storedName: string | null = null
  let originalName: string | null = null
  let mimeType: string | null = null
  let fileSize: number | null = null
  let fileHash: string | null = null

  if (file && file.size > 0) {
    if (file.size > MAX_SIZE) return { error: "Súbor je príliš veľký. Maximum je 50 MB." }
    const parts = file.name.split(".")
    const ext = (parts.length > 1 ? parts.pop()! : "bin").toLowerCase()
    if (!ALLOWED_EXT.has(ext)) return { error: "Nepodporovaný formát súboru." }

    const bytes = await file.arrayBuffer()
    const buffer = new Uint8Array(bytes)
    const hash = createHash("sha256").update(buffer).digest("hex")
    const sn = `${randomUUID()}.${ext}`
    await mkdir(UPLOAD_DIR, { recursive: true })
    await writeFile(join(UPLOAD_DIR, sn), buffer)

    storedName = sn
    originalName = file.name
    mimeType = file.type || "application/octet-stream"
    fileSize = file.size
    fileHash = hash
  }

  await prisma.zaznamPriloha.create({
    data: { zaznamId, cislo, forma, nazov, storedName, originalName, mimeType, fileSize, fileHash },
  })
  revalidatePath(`/dashboard/registratura/zaznamy/${zaznamId}`)
  return { success: true }
}

export async function deleteZaznamPriloha(priolohaId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const priloha = await prisma.zaznamPriloha.findUnique({ where: { id: priolohaId } })
  if (!priloha) return { error: "Príloha nenájdená." }

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: priloha.zaznamId } })
  if (!zaznam || !canManageZaznam(session.user.roles as string[], zaznam, parseInt(session.user.id))) {
    return { error: "Nemáte oprávnenie." }
  }

  if (priloha.storedName) {
    await unlink(join(UPLOAD_DIR, priloha.storedName)).catch(() => {})
  }
  await prisma.zaznamPriloha.delete({ where: { id: priolohaId } })
  revalidatePath(`/dashboard/registratura/zaznamy/${priloha.zaznamId}`)
  return { success: true }
}
