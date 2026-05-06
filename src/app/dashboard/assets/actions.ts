"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { AssetType, Brand, UsagePlace, AssetKind, FunctionStatus } from "@/generated/prisma/enums"
import { notifyAssetAssigned, notifyAssetReturned, notifyAssetChanged } from "@/lib/notificationHelpers"
import {
  assetTypeLabels,
  brandLabels,
  usagePlaceLabels,
  assetKindLabels,
  functionStatusLabels,
} from "@/lib/labels"

const FIELD_LABELS: Record<string, string> = {
  type: "Typ",
  name: "Názov",
  brand: "Značka",
  serialNumber: "Výrobné číslo",
  usagePlace: "Miesto použitia",
  yearOfManufacture: "Rok výroby",
  kind: "Druh majetku",
  acquisitionDate: "Dátum obstarania",
  functionStatus: "Stav funkčnosti",
  publicNote: "Verejná poznámka",
  isSecurity: "Bezpečnostný majetok",
}

type AssetSnapshot = {
  type: AssetType
  name: string
  brand: Brand
  serialNumber: string | null
  usagePlace: UsagePlace
  yearOfManufacture: number | null
  kind: AssetKind
  acquisitionDate: Date | null
  functionStatus: FunctionStatus
  publicNote: string | null
  isSecurity: boolean
}

function fv(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (value instanceof Date)
    return value.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" })
  if (typeof value === "boolean") return value ? "Áno" : "Nie"
  switch (key) {
    case "type": return assetTypeLabels[value as AssetType] ?? String(value)
    case "brand": return brandLabels[value as Brand] ?? String(value)
    case "usagePlace": return usagePlaceLabels[value as UsagePlace] ?? String(value)
    case "kind": return assetKindLabels[value as AssetKind] ?? String(value)
    case "functionStatus": return functionStatusLabels[value as FunctionStatus] ?? String(value)
    default: return value === "" ? "—" : `„${value}"`
  }
}

function buildAssetChangeDiff(old: AssetSnapshot, updated: AssetSnapshot): string[] {
  const changes: string[] = []
  for (const key of Object.keys(FIELD_LABELS) as (keyof AssetSnapshot)[]) {
    const oldVal = old[key]
    const newVal = updated[key]
    const oldCmp = oldVal instanceof Date ? oldVal.getTime() : oldVal
    const newCmp = newVal instanceof Date ? newVal.getTime() : newVal
    if (oldCmp !== newCmp) {
      changes.push(`${FIELD_LABELS[key]}: ${fv(key, oldVal)} → ${fv(key, newVal)}`)
    }
  }
  return changes
}

type Result = { error?: string; success?: boolean }

export async function createAsset(formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_KARIET")) {
    return { error: "Nemáte oprávnenie vytvárať majetok." }
  }

  const serialNumber = (formData.get("serialNumber") as string)?.trim() || null

  if (serialNumber) {
    const existing = await prisma.asset.findUnique({ where: { serialNumber } })
    if (existing) {
      return {
        error: `Výrobné číslo „${serialNumber}" je už evidované.`,
      }
    }
  }

  const yearRaw = (formData.get("yearOfManufacture") as string)?.trim()
  const year = yearRaw ? parseInt(yearRaw) : null
  if (year !== null && (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
    return { error: "Zadajte platný rok výroby." }
  }

  const acquisitionDateRaw = (formData.get("acquisitionDate") as string)?.trim()
  const acquisitionDate = acquisitionDateRaw ? new Date(acquisitionDateRaw) : null

  try {
    await prisma.asset.create({
      data: {
        type: formData.get("type") as AssetType,
        name: (formData.get("name") as string).trim(),
        brand: (formData.get("brand") as Brand) || "Neurcena",
        serialNumber,
        usagePlace: formData.get("usagePlace") as UsagePlace,
        yearOfManufacture: year,
        kind: formData.get("kind") as AssetKind,
        acquisitionDate,
        publicNote: (formData.get("publicNote") as string)?.trim() || null,
        recordNote: (formData.get("recordNote") as string)?.trim() || null,
        securityNote: null,
        isSecurity: formData.get("isSecurity") === "on",
      },
    })
    revalidatePath("/dashboard/assets")
    return { success: true }
  } catch (e) {
    console.error("[createAsset]", e)
    return { error: "Nastala chyba pri ukladaní. Skúste znova." }
  }
}

export async function assignAsset(
  assetId: number,
  type: "recipient" | "room",
  targetId: number,
  assignedBy: string,
  note: string
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_KARIET")) {
    return { error: "Nemáte oprávnenie prideľovať majetok." }
  }

  try {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { type: true, name: true, serialNumber: true },
    })
    if (!asset) return { error: "Majetok nebol nájdený." }

    const now = new Date()

    // Collect previous recipients for ASSET_RETURNED notifications
    const prevRecipients = await prisma.assetRecipientAssignment.findMany({
      where: { assetId, returnedAt: null },
      select: { userId: true },
    })

    // Close all open assignments
    await prisma.assetRecipientAssignment.updateMany({
      where: { assetId, returnedAt: null },
      data: { returnedAt: now, returnedTo: session.user.name },
    })
    await prisma.assetRoomAssignment.updateMany({
      where: { assetId, removedAt: null },
      data: { removedAt: now, removedBy: session.user.name },
    })

    if (type === "recipient") {
      await prisma.assetRecipientAssignment.create({
        data: { assetId, userId: targetId, assignedBy, assignmentNote: note.trim() || null },
      })
      await prisma.asset.update({
        where: { id: assetId },
        data: { allocationStatus: "Prideleny_Recipient" },
      })
      // Notify new recipient (blocking)
      await notifyAssetAssigned(assetId, asset.type, asset.name, asset.serialNumber, targetId)
      // Notify previous recipients whose asset was taken (blocking)
      await Promise.all(
        prevRecipients
          .filter(r => r.userId !== targetId)
          .map(r => notifyAssetReturned(assetId, asset.type, asset.name, asset.serialNumber, r.userId))
      )
    } else {
      await prisma.assetRoomAssignment.create({
        data: { assetId, roomId: targetId, assignedBy, assignmentNote: note.trim() || null },
      })
      await prisma.asset.update({
        where: { id: assetId },
        data: { allocationStatus: "Prideleny_Room" },
      })
      // Notify previous recipients whose asset was moved to room (blocking)
      await Promise.all(
        prevRecipients.map(r =>
          notifyAssetReturned(assetId, asset.type, asset.name, asset.serialNumber, r.userId)
        )
      )
      // Notify users with access to this room (informational)
      await notifyAssetChanged(assetId, asset.type, asset.name, asset.serialNumber, [parseInt(session.user.id)])
    }

    revalidatePath("/dashboard/assets")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri prideľovaní. Skúste znova." }
  }
}

export async function updateAsset(
  assetId: number,
  formData: FormData
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_KARIET")) {
    return { error: "Nemáte oprávnenie upravovať majetok." }
  }

  const serialNumber = (formData.get("serialNumber") as string)?.trim() || null

  if (serialNumber) {
    const existing = await prisma.asset.findFirst({
      where: { serialNumber, NOT: { id: assetId } },
    })
    if (existing) {
      return {
        error: `Výrobné číslo „${serialNumber}" je už evidované.`,
      }
    }
  }

  const yearRaw = (formData.get("yearOfManufacture") as string)?.trim()
  const year = yearRaw ? parseInt(yearRaw) : null
  if (year !== null && (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
    return { error: "Zadajte platný rok výroby." }
  }

  const acquisitionDateRaw = (formData.get("acquisitionDate") as string)?.trim()
  const acquisitionDate = acquisitionDateRaw ? new Date(acquisitionDateRaw) : null

  try {
    const oldAsset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        type: true, name: true, brand: true, serialNumber: true,
        usagePlace: true, yearOfManufacture: true, kind: true,
        acquisitionDate: true, functionStatus: true, publicNote: true, isSecurity: true,
      },
    })
    if (!oldAsset) return { error: "Majetok nebol nájdený." }

    const updated = await prisma.asset.update({
      where: { id: assetId },
      data: {
        type: formData.get("type") as AssetType,
        name: (formData.get("name") as string).trim(),
        brand: formData.get("brand") as Brand,
        serialNumber,
        usagePlace: formData.get("usagePlace") as UsagePlace,
        yearOfManufacture: year,
        kind: formData.get("kind") as AssetKind,
        acquisitionDate,
        functionStatus: formData.get("functionStatus") as FunctionStatus,
        publicNote: (formData.get("publicNote") as string)?.trim() || null,
        recordNote: (formData.get("recordNote") as string)?.trim() || null,
        securityNote: (formData.get("securityNote") as string)?.trim() || null,
        isSecurity: formData.get("isSecurity") === "on",
      },
    })

    const actorId = parseInt(session.user.id)
    const changes = buildAssetChangeDiff(oldAsset, updated)
    await notifyAssetChanged(assetId, updated.type, updated.name, updated.serialNumber, [actorId], changes)
    revalidatePath(`/dashboard/assets/${assetId}`)
    revalidatePath("/dashboard/assets")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní. Skúste znova." }
  }
}

export async function returnAsset(
  assetId: number,
  returnedBy: string,
  returnNote?: string
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_KARIET")) {
    return { error: "Nemáte oprávnenie." }
  }

  try {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { type: true, name: true, serialNumber: true },
    })
    if (!asset) return { error: "Majetok nebol nájdený." }

    const prevRecipients = await prisma.assetRecipientAssignment.findMany({
      where: { assetId, returnedAt: null },
      select: { userId: true },
    })

    const now = new Date()
    const note = returnNote?.trim() || null
    await prisma.assetRecipientAssignment.updateMany({
      where: { assetId, returnedAt: null },
      data: { returnedAt: now, returnedTo: returnedBy, returnNote: note },
    })
    await prisma.assetRoomAssignment.updateMany({
      where: { assetId, removedAt: null },
      data: { removedAt: now, removedBy: returnedBy, removalNote: note },
    })
    await prisma.asset.update({
      where: { id: assetId },
      data: { allocationStatus: "Neprideleny_Volny" },
    })

    // Notify recipients that their asset was returned (blocking)
    await Promise.all(
      prevRecipients.map(r =>
        notifyAssetReturned(assetId, asset.type, asset.name, asset.serialNumber, r.userId)
      )
    )

    revalidatePath("/dashboard/assets")
    revalidatePath("/dashboard/users")
    revalidatePath("/dashboard/rooms")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri vracaní. Skúste znova." }
  }
}

export async function updateBpFields(
  assetId: number,
  formData: FormData
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("BEZPECNOSTNY_PRACOVNIK")) {
    return { error: "Nemáte oprávnenie upravovať BP polia." }
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { type: true } })
  if (!asset) return { error: "Majetok nebol nájdený." }

  const parseDate = (key: string) => {
    const raw = (formData.get(key) as string)?.trim()
    return raw ? new Date(raw) : null
  }

  try {
    if (asset.type === "Notebook") {
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          bpVDomene: formData.get("bpVDomene") === "on",
          bpNazovVDomene: (formData.get("bpNazovVDomene") as string)?.trim() || null,
          bpAktualizovanyDna: parseDate("bpAktualizovanyDna"),
        },
      })
    } else if (asset.type === "MobilnyTelefon") {
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          bpEset: formData.get("bpEset") === "on",
          bpImei1: (formData.get("bpImei1") as string)?.trim() || null,
          bpImei2: (formData.get("bpImei2") as string)?.trim() || null,
          bpPodporovanyDo: parseDate("bpPodporovanyDo"),
        },
      })
    } else if (asset.type === "SIMKarta") {
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          bpTelefonneCislo: (formData.get("bpTelefonneCislo") as string)?.trim() || null,
        },
      })
    } else if (asset.type === "USBKluc" || asset.type === "ExternyDisk") {
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          bpPovolenyVDomene: formData.get("bpPovolenyVDomene") === "on",
        },
      })
    } else {
      return { error: "Tento typ majetku nemá BP polia." }
    }

    revalidatePath(`/dashboard/assets/${assetId}`)
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[updateBpFields]", e)
    return { error: `Chyba: ${msg}` }
  }
}

export async function updateSecurityNote(
  assetId: number,
  note: string
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("BEZPECNOSTNY_PRACOVNIK")) {
    return { error: "Nemáte oprávnenie." }
  }
  try {
    await prisma.asset.update({
      where: { id: assetId },
      data: { securityNote: note.trim() || null },
    })
    revalidatePath(`/dashboard/assets/${assetId}`)
    revalidatePath("/dashboard/assets")
    return { success: true }
  } catch (e) {
    console.error("[updateSecurityNote]", e)
    return { error: "Nastala chyba pri ukladaní." }
  }
}
