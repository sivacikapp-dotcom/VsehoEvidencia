import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import { notifyAssetChanged } from "@/lib/notificationHelpers"

const ALLOWED_FIELDS = new Set([
  "type", "name", "brand", "serialNumber", "usagePlace",
  "yearOfManufacture", "kind", "acquisitionDate", "functionStatus",
  "isSecurity",
])

function coerceField(key: string, val: unknown): unknown {
  if (key === "yearOfManufacture") return (val === "" || val == null) ? null : parseInt(String(val), 10)
  if (key === "acquisitionDate") return (val === "" || val == null) ? null : new Date(String(val))
  if (key === "isSecurity") return Boolean(val)
  if (key === "serialNumber") {
    return (val as string)?.trim() || null
  }
  return val
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user.roles.includes("SPRAVCA_KARIET")) {
    return NextResponse.json({ error: "Nemáte oprávnenie." }, { status: 403 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Neplatný JSON." }, { status: 400 })
  }

  const { version, patchData } = body as { version: unknown; patchData: Record<string, unknown> }

  if (typeof version !== "number") {
    return NextResponse.json({ error: "Chýba verzia." }, { status: 400 })
  }
  if (!patchData || typeof patchData !== "object" || Array.isArray(patchData)) {
    return NextResponse.json({ error: "Chýbajú dáta." }, { status: 400 })
  }

  const unknownFields = Object.keys(patchData).filter(k => !ALLOWED_FIELDS.has(k))
  if (unknownFields.length > 0) {
    return NextResponse.json({ error: `Nepovolené polia: ${unknownFields.join(", ")}` }, { status: 400 })
  }
  if (Object.keys(patchData).length === 0) {
    return NextResponse.json({ error: "Žiadne polia na aktualizáciu." }, { status: 400 })
  }

  const current = await prisma.asset.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: "Majetok nebol nájdený." }, { status: 404 })

  // Early version check — returns 409 with DB state the user should merge against
  if (current.version !== version) {
    return NextResponse.json({ conflict: true, currentAsset: current }, { status: 409 })
  }

  // Per-field validation
  if ("serialNumber" in patchData) {
    const sn = (patchData.serialNumber as string)?.trim() || null
    if (sn) {
      if (/\s/.test(sn)) {
        return NextResponse.json({ error: "Výrobné číslo nesmie obsahovať medzery." }, { status: 422 })
      }
      const dup = await prisma.asset.findFirst({ where: { serialNumber: sn, NOT: { id } } })
      if (dup) {
        return NextResponse.json({ error: `Výrobné číslo „${sn}" je už evidované.` }, { status: 422 })
      }
    }
  }
  if ("yearOfManufacture" in patchData && patchData.yearOfManufacture !== "" && patchData.yearOfManufacture != null) {
    const y = parseInt(String(patchData.yearOfManufacture), 10)
    const curYear = new Date().getFullYear()
    if (isNaN(y) || y < 1900 || y > curYear) {
      return NextResponse.json({ error: `Zadajte platný rok výroby (1900–${curYear}).` }, { status: 422 })
    }
  }
  if ("acquisitionDate" in patchData && patchData.acquisitionDate) {
    if (new Date(String(patchData.acquisitionDate)) > new Date()) {
      return NextResponse.json({ error: "Dátum obstarania nemôže byť v budúcnosti." }, { status: 422 })
    }
  }

  const updateData: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patchData)) {
    updateData[k] = coerceField(k, v)
  }

  // Atomic update: WHERE includes version so a race condition yields count=0
  const result = await prisma.asset.updateMany({
    where: { id, version },
    data: { ...updateData, version: { increment: 1 } },
  })

  if (result.count === 0) {
    // Another update slipped in between our check and this write
    const refreshed = await prisma.asset.findUnique({ where: { id } })
    if (!refreshed) return NextResponse.json({ error: "Majetok bol medzičasom zmazaný." }, { status: 404 })
    return NextResponse.json({ conflict: true, currentAsset: refreshed }, { status: 409 })
  }

  const updated = await prisma.asset.findUnique({ where: { id } })
  if (!updated) return NextResponse.json({ error: "Nastala neočakávaná chyba." }, { status: 500 })

  const actorId = parseInt(session.user.id)
  const oldData = Object.fromEntries(Object.keys(patchData).map(k => [k, (current as Record<string, unknown>)[k]]))

  await Promise.all([
    notifyAssetChanged(id, updated.type, updated.name, updated.serialNumber, [actorId], []),
    createAuditLog({
      userId: actorId, userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "ASSET", entityId: id, entityLabel: updated.name,
      oldData: { ...oldData, version: current.version },
      newData: { ...patchData, version: updated.version },
    }),
  ])

  return NextResponse.json({ success: true, version: updated.version })
}
