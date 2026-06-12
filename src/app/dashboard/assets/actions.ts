"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import { join } from "path"
import type { AssetType, Brand, UsagePlace, AssetKind, FunctionStatus, Role } from "@/generated/prisma/enums"
import { createAuditLog } from "@/lib/auditLog"
import { notifyAssetAssigned, notifyAssetReturned, notifyAssetChanged, notifyRoomAssetAssigned } from "@/lib/notificationHelpers"
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
  if (!session?.user.roles.includes("SPRAVCA_MAJETKU")) {
    return { error: "Nemáte oprávnenie vytvárať majetok." }
  }

  const serialNumber = (formData.get("serialNumber") as string)?.trim() || null

  if (serialNumber) {
    if (/\s/.test(serialNumber)) {
      return { error: "Výrobné číslo nesmie obsahovať medzery." }
    }
    const existing = await prisma.asset.findUnique({ where: { serialNumber } })
    if (existing) {
      return {
        error: `Výrobné číslo „${serialNumber}" je už evidované.`,
      }
    }
  }

  const currentYear = new Date().getFullYear()
  const yearRaw = (formData.get("yearOfManufacture") as string)?.trim()
  const year = yearRaw ? parseInt(yearRaw) : null
  if (year !== null && (isNaN(year) || year < 1900 || year > currentYear)) {
    return { error: `Zadajte platný rok výroby (1900–${currentYear}).` }
  }

  const acquisitionDateRaw = (formData.get("acquisitionDate") as string)?.trim()
  const acquisitionDate = acquisitionDateRaw ? new Date(acquisitionDateRaw) : null
  if (acquisitionDate && acquisitionDate > new Date()) {
    return { error: "Dátum obstarania nemôže byť v budúcnosti." }
  }

  try {
    const created = await prisma.asset.create({
      data: {
        type: formData.get("type") as AssetType,
        name: (formData.get("name") as string).trim(),
        brand: (formData.get("brand") as Brand) || "Neurcena",
        serialNumber,
        usagePlace: formData.get("usagePlace") as UsagePlace,
        yearOfManufacture: year,
        kind: formData.get("kind") as AssetKind,
        acquisitionDate,
        isSecurity: formData.get("isSecurity") === "on",
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "ASSET", entityId: created.id, entityLabel: created.name,
      newData: { type: created.type, name: created.name, serialNumber: created.serialNumber },
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
  note: string,
  updateUsagePlace?: boolean
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_MAJETKU")) {
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
        data: { allocationStatus: "V_procese" },
      })
      // Notify new recipient (blocking)
      await notifyAssetAssigned(assetId, asset.type, asset.name, asset.serialNumber, targetId, parseInt(session.user.id))
      // Notify previous recipients whose asset was taken (blocking)
      await Promise.all(
        prevRecipients
          .filter(r => r.userId !== null && r.userId !== targetId)
          .map(r => notifyAssetReturned(assetId, asset.type, asset.name, asset.serialNumber, r.userId!, parseInt(session.user.id)))
      )
    } else {
      await prisma.assetRoomAssignment.create({
        data: { assetId, roomId: targetId, assignedBy, assignmentNote: note.trim() || null },
      })
      // Send approval requests to all room users except the assigner
      const notifiedCount = await notifyRoomAssetAssigned(
        assetId, asset.type, asset.name, asset.serialNumber, targetId, parseInt(session.user.id)
      )
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          allocationStatus: notifiedCount > 0 ? "V_procese" : "Prideleny_Room",
          ...(updateUsagePlace ? { usagePlace: "Office" } : {}),
        },
      })
      // Notify previous recipients whose asset was moved to room (blocking)
      await Promise.all(
        prevRecipients
          .filter(r => r.userId !== null)
          .map(r => notifyAssetReturned(assetId, asset.type, asset.name, asset.serialNumber, r.userId!, parseInt(session.user.id)))
      )
    }

    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "ASSET", entityId: assetId, entityLabel: asset.name,
      newData: { allocationStatus: type === "recipient" ? "Prideleny_Recipient" : "Prideleny_Room", targetId },
    })
    revalidatePath("/dashboard/assets")
    return { success: true }
  } catch (e) {
    console.error("[assignAsset]", e)
    return { error: "Nastala chyba pri prideľovaní. Skúste znova." }
  }
}

export async function updateAsset(
  assetId: number,
  formData: FormData
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_MAJETKU")) {
    return { error: "Nemáte oprávnenie upravovať majetok." }
  }

  const serialNumber = (formData.get("serialNumber") as string)?.trim() || null

  if (serialNumber) {
    if (/\s/.test(serialNumber)) {
      return { error: "Výrobné číslo nesmie obsahovať medzery." }
    }
    const existing = await prisma.asset.findFirst({
      where: { serialNumber, NOT: { id: assetId } },
    })
    if (existing) {
      return {
        error: `Výrobné číslo „${serialNumber}" je už evidované.`,
      }
    }
  }

  const currentYear = new Date().getFullYear()
  const yearRaw = (formData.get("yearOfManufacture") as string)?.trim()
  const year = yearRaw ? parseInt(yearRaw) : null
  if (year !== null && (isNaN(year) || year < 1900 || year > currentYear)) {
    return { error: `Zadajte platný rok výroby (1900–${currentYear}).` }
  }

  const acquisitionDateRaw = (formData.get("acquisitionDate") as string)?.trim()
  const acquisitionDate = acquisitionDateRaw ? new Date(acquisitionDateRaw) : null
  if (acquisitionDate && acquisitionDate > new Date()) {
    return { error: "Dátum obstarania nemôže byť v budúcnosti." }
  }

  try {
    const oldAsset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        type: true, name: true, brand: true, serialNumber: true,
        usagePlace: true, yearOfManufacture: true, kind: true,
        acquisitionDate: true, functionStatus: true, isSecurity: true,
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
        isSecurity: formData.get("isSecurity") === "on",
      },
    })

    const actorId = parseInt(session.user.id)
    const changes = buildAssetChangeDiff(oldAsset, updated)
    await notifyAssetChanged(assetId, updated.type, updated.name, updated.serialNumber, [actorId], changes)
    await createAuditLog({
      userId: actorId, userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "ASSET", entityId: assetId, entityLabel: updated.name,
      oldData: oldAsset as Record<string, unknown>,
      newData: { type: updated.type, name: updated.name, brand: updated.brand, serialNumber: updated.serialNumber, usagePlace: updated.usagePlace, yearOfManufacture: updated.yearOfManufacture, kind: updated.kind, functionStatus: updated.functionStatus, isSecurity: updated.isSecurity },
    })
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
  if (!session?.user.roles.includes("SPRAVCA_MAJETKU")) {
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
    const hadRoomAssignment = await prisma.assetRoomAssignment.count({
      where: { assetId, removedAt: null },
    }) > 0

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

    // Close any pending approval notifications (e.g. room users who haven't approved yet)
    await prisma.notification.updateMany({
      where: { assetId, type: { in: ["ASSET_ASSIGNED", "ASSET_RETURNED"] }, mustAcknowledge: true, acknowledgedAt: null },
      data: { acknowledgedAt: now },
    })

    // If there are recipients to notify, stay in V_procese until they acknowledge; otherwise finalize immediately
    const finalStatus = prevRecipients.length > 0 ? "V_procese" : "Neprideleny_Volny"
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        allocationStatus: finalStatus,
        ...(hadRoomAssignment ? { usagePlace: "Nezadane" } : {}),
      },
    })

    // Notify recipients that their asset was returned (blocking)
    await Promise.all(
      prevRecipients
        .filter(r => r.userId !== null)
        .map(r => notifyAssetReturned(assetId, asset.type, asset.name, asset.serialNumber, r.userId!, parseInt(session.user.id)))
    )
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "ASSET", entityId: assetId, entityLabel: asset.name,
      oldData: { allocationStatus: "Prideleny" }, newData: { allocationStatus: "Neprideleny_Volny" },
    })
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
      const imei1 = (formData.get("bpImei1") as string)?.trim() || null
      const imei2 = (formData.get("bpImei2") as string)?.trim() || null

      if (imei1) {
        if (!/^\d+$/.test(imei1)) return { error: "IMEI 1 môže obsahovať iba číslice a nesmie obsahovať medzery." }
        const existing = await prisma.asset.findFirst({ where: { bpImei1: imei1, NOT: { id: assetId } } })
        if (existing) return { error: `IMEI 1 „${imei1}" je už evidovaný.` }
      }
      if (imei2) {
        if (!/^\d+$/.test(imei2)) return { error: "IMEI 2 môže obsahovať iba číslice a nesmie obsahovať medzery." }
        const existing = await prisma.asset.findFirst({ where: { bpImei2: imei2, NOT: { id: assetId } } })
        if (existing) return { error: `IMEI 2 „${imei2}" je už evidovaný.` }
      }

      await prisma.asset.update({
        where: { id: assetId },
        data: {
          bpEset: formData.get("bpEset") === "on",
          bpImei1: imei1,
          bpImei2: imei2,
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

    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "ASSET", entityId: assetId, entityLabel: null,
      newData: { bpType: asset.type },
    })
    revalidatePath(`/dashboard/assets/${assetId}`)
    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[updateBpFields]", e)
    return { error: `Chyba: ${msg}` }
  }
}

export async function updateAttachmentVisibility(
  attachmentId: number,
  visibility: "Everyone" | "ManagersAndSecurity" | "OwnRoleOnly",
  visibilityRoles?: string[]
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Neautorizovaný." }
  const roles = session.user.roles as Role[]
  if (!roles.includes("SPRAVCA_MAJETKU") && !roles.includes("BEZPECNOSTNY_PRACOVNIK")) {
    return { error: "Nemáte oprávnenie upravovať prílohy." }
  }

  const VALID = ["Everyone", "ManagersAndSecurity", "OwnRoleOnly"]
  if (!VALID.includes(visibility)) return { error: "Neplatná viditeľnosť." }

  const attachment = await prisma.assetAttachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, assetId: true, uploaderRoles: true, originalName: true, visibility: true },
  })
  if (!attachment) return { error: "Príloha nebola nájdená." }

  const ROLE_WHITELIST = ["SPRAVCA_MAJETKU", "BEZPECNOSTNY_PRACOVNIK"]
  let newUploaderRoles = attachment.uploaderRoles as string[]
  if (visibility === "OwnRoleOnly" && visibilityRoles && visibilityRoles.length > 0) {
    const filtered = visibilityRoles.filter((r) => ROLE_WHITELIST.includes(r))
    if (filtered.length > 0) newUploaderRoles = filtered
  }

  await prisma.assetAttachment.update({
    where: { id: attachmentId },
    data: { visibility, uploaderRoles: newUploaderRoles as Role[] },
  })
  await createAuditLog({
    userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
    action: "UPDATE", entityType: "ASSET_ATTACHMENT", entityId: attachmentId,
    entityLabel: attachment.originalName,
    oldData: { visibility: attachment.visibility },
    newData: { visibility, uploaderRoles: newUploaderRoles },
  })
  revalidatePath(`/dashboard/assets/${attachment.assetId}`)
  return { success: true }
}

export async function deleteAssetAttachment(attachmentId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Neautorizovaný." }

  const roles = session.user.roles as Role[]
  if (!roles.includes("SPRAVCA_MAJETKU") && !roles.includes("BEZPECNOSTNY_PRACOVNIK")) {
    return { error: "Nemáte oprávnenie mazať prílohy." }
  }

  const attachment = await prisma.assetAttachment.findFirst({
    where: { id: attachmentId },
    select: { id: true, assetId: true, storedName: true },
  })
  if (!attachment) return { error: "Príloha nebola nájdená." }

  try {
    await unlink(join(process.cwd(), "uploads", "assets", attachment.storedName))
  } catch {
    // Súbor už nemusí existovať na disku
  }

  await prisma.assetAttachment.delete({ where: { id: attachmentId } })
  await createAuditLog({
    userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
    action: "DELETE", entityType: "ASSET_ATTACHMENT", entityId: attachmentId,
    entityLabel: attachment.storedName,
    oldData: { assetId: attachment.assetId, storedName: attachment.storedName },
  })
  revalidatePath(`/dashboard/assets/${attachment.assetId}`)
  return { success: true }
}
