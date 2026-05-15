import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { AssetNoteType } from "@/generated/prisma/enums"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Nemáte oprávnenie." }, { status: 403 })

  const roles: string[] = session.user.roles ?? []
  const userId = parseInt(session.user.id)
  const { id: idStr } = await params
  const assetId = parseInt(idStr)
  if (isNaN(assetId)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Neplatný JSON." }, { status: 400 })
  }

  const { noteType, content } = body as { noteType: unknown; content: unknown }

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Obsah poznámky je povinný." }, { status: 422 })
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Poznámka je príliš dlhá (max 2000 znakov)." }, { status: 422 })
  }

  const validTypes: AssetNoteType[] = ["PUBLIC", "RECORD", "SECURITY"]
  if (!validTypes.includes(noteType as AssetNoteType)) {
    return NextResponse.json({ error: "Neplatný typ poznámky." }, { status: 422 })
  }
  const nt = noteType as AssetNoteType

  // Determine permission and authorRole together
  let authorRole: string | null = null
  if (nt === "RECORD") {
    if (roles.includes("SPRAVCA_KARIET")) authorRole = "SPRAVCA_KARIET"
  } else if (nt === "SECURITY") {
    if (roles.includes("BEZPECNOSTNY_PRACOVNIK")) authorRole = "BEZPECNOSTNY_PRACOVNIK"
  } else if (nt === "PUBLIC") {
    if (roles.includes("SPRAVCA_KARIET")) {
      authorRole = "SPRAVCA_KARIET"
    } else if (roles.includes("BEZPECNOSTNY_PRACOVNIK")) {
      authorRole = "BEZPECNOSTNY_PRACOVNIK"
    } else if (roles.includes("PRIJEMCA")) {
      const assignment = await prisma.assetRecipientAssignment.findFirst({
        where: { assetId, userId, returnedAt: null },
        select: { id: true },
      })
      if (assignment) authorRole = "PRIJEMCA"
    }
  }

  if (!authorRole) {
    return NextResponse.json({ error: "Nemáte oprávnenie pridávať tento typ poznámky." }, { status: 403 })
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } })
  if (!asset) return NextResponse.json({ error: "Majetok nebol nájdený." }, { status: 404 })

  const note = await prisma.assetNote.create({
    data: {
      assetId,
      noteType: nt,
      content: content.trim(),
      authorRole,
      createdById: userId,
      createdByName: session.user.name ?? session.user.email ?? "Neznámy",
    },
  })

  return NextResponse.json({ success: true, note })
}
