import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import path from "path"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return new NextResponse("Invalid filename", { status: 400 })
  }

  // Look up the file in Document.prilohaPath or DocumentAttachment.filePath
  const [doc, attachment] = await Promise.all([
    prisma.document.findFirst({ where: { prilohaPath: filename } }),
    prisma.documentAttachment.findFirst({
      where: { filePath: filename },
      include: { document: true },
    }),
  ])

  const parentDoc = doc ?? attachment?.document ?? null
  if (!parentDoc) return new NextResponse("Not found", { status: 404 })

  // Effective confidentiality: for attachments use their own level, for document files use document level
  const effectiveConfidentiality = attachment ? attachment.confidentiality : parentDoc.confidentiality

  if (effectiveConfidentiality !== "VEREJNY") {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    if (effectiveConfidentiality === "DOVERNI") {
      const userId = parseInt(session.user.id)
      const userDoc = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          docRole: true,
          agendaGestors: { select: { agendaId: true } },
          documentGestors: { select: { documentId: true } },
          attachmentAccesses: { select: { attachmentId: true } },
        },
      })
      const isAdmin = userDoc?.docRole === "SPRAVCA_DOKUMENTOV"
      const isAgendaGestor = userDoc?.agendaGestors.some((g) => g.agendaId === parentDoc.agendaId)
      const isDocGestor = userDoc?.documentGestors.some((g) => g.documentId === parentDoc.id)

      // For attachment files: check attachment-level access; for document files: check document access
      const hasAccess = attachment
        ? userDoc?.attachmentAccesses.some((a) => a.attachmentId === attachment.id)
        : await prisma.documentAccess.findFirst({ where: { userId, documentId: parentDoc.id } }).then(Boolean)

      if (!isAdmin && !isAgendaGestor && !isDocGestor && !hasAccess) {
        return new NextResponse("Forbidden", { status: 403 })
      }
    }
  }

  const ALLOWED_EXTENSIONS: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain",
  }

  const ext = path.extname(filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS[ext]) {
    return new NextResponse("Nepodporovaný formát súboru", { status: 415 })
  }

  // Absolútna cesta overená path.resolve — zabráni path traversal
  const uploadsRoot = path.resolve(process.cwd(), "uploads", "docs")
  const filePath = path.resolve(uploadsRoot, filename)
  if (!filePath.startsWith(uploadsRoot + path.sep)) {
    return new NextResponse("Invalid filename", { status: 400 })
  }

  try {
    const buffer = await readFile(filePath)
    const rawName = req.nextUrl.searchParams.get("name") ?? filename
    // Sanitizácia: ponechaj len bezpečné znaky v názve súboru
    const originalName = rawName.replace(/[^\w.\-\s]/g, "_")
    const contentType = ALLOWED_EXTENSIONS[ext]

    // Súbory sa vždy sťahujú (attachment), nie vykonávajú inline v prehliadači
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(originalName)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new NextResponse("File not found", { status: 404 })
  }
}
