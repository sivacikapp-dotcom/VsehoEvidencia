import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function canEditNote(noteAuthorRole: string, noteCreatedById: number | null, userRoles: string[], userId: number): boolean {
  if (noteAuthorRole === "BEZPECNOSTNY_PRACOVNIK") return userRoles.includes("BEZPECNOSTNY_PRACOVNIK")
  if (noteAuthorRole === "SPRAVCA_MAJETKU") return userRoles.includes("SPRAVCA_MAJETKU")
  if (noteAuthorRole === "PRIJEMCA") return noteCreatedById === userId
  return false
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Nemáte oprávnenie." }, { status: 403 })

  const roles: string[] = session.user.roles ?? []
  const userId = parseInt(session.user.id)
  const { noteId: noteIdStr } = await params
  const noteId = parseInt(noteIdStr)
  if (isNaN(noteId)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Neplatný JSON." }, { status: 400 })
  }

  const { content } = body as { content: unknown }
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Obsah poznámky je povinný." }, { status: 422 })
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Poznámka je príliš dlhá (max 2000 znakov)." }, { status: 422 })
  }

  const note = await prisma.assetNote.findUnique({ where: { id: noteId } })
  if (!note) return NextResponse.json({ error: "Poznámka nebola nájdená." }, { status: 404 })

  if (!canEditNote(note.authorRole, note.createdById, roles, userId)) {
    return NextResponse.json({ error: "Nemáte oprávnenie upraviť túto poznámku." }, { status: 403 })
  }

  const updated = await prisma.assetNote.update({
    where: { id: noteId },
    data: { content: content.trim() },
  })

  return NextResponse.json({ success: true, note: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Nemáte oprávnenie." }, { status: 403 })

  const roles: string[] = session.user.roles ?? []
  const userId = parseInt(session.user.id)
  const { noteId: noteIdStr } = await params
  const noteId = parseInt(noteIdStr)
  if (isNaN(noteId)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 })

  const note = await prisma.assetNote.findUnique({ where: { id: noteId } })
  if (!note) return NextResponse.json({ error: "Poznámka nebola nájdená." }, { status: 404 })

  if (!canEditNote(note.authorRole, note.createdById, roles, userId)) {
    return NextResponse.json({ error: "Nemáte oprávnenie zmazať túto poznámku." }, { status: 403 })
  }

  await prisma.assetNote.delete({ where: { id: noteId } })
  return NextResponse.json({ success: true })
}
