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

  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

  const userId = parseInt(session.user.id)
  const roles = session.user.roles ?? []

  // Nájdi attachment + súvisiaci cestovný príkaz
  const attachment = await prisma.expenseReportAttachment.findFirst({
    where: { storedName: filename },
    include: {
      expenseReport: {
        include: { travelOrder: true },
      },
    },
  })
  if (!attachment) return new NextResponse("Not found", { status: 404 })

  const order = attachment.expenseReport.travelOrder
  const isOwner = order.userId === userId
  const isSupervisor = order.supervisorId === userId
  const isSpravcaPC = roles.includes("SPRAVCA_PRACOVNYCH_CIEST")

  if (!isOwner && !isSupervisor && !isSpravcaPC) {
    return new NextResponse("Forbidden", { status: 403 })
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
    ".gif": "image/gif",
    ".txt": "text/plain",
    ".csv": "text/csv",
  }

  const ext = path.extname(filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS[ext]) {
    return new NextResponse("Nepodporovaný formát súboru", { status: 415 })
  }

  // Path traversal ochrana cez path.resolve
  const uploadsRoot = path.resolve(process.cwd(), "uploads", "travel")
  const filePath = path.resolve(uploadsRoot, filename)
  if (!filePath.startsWith(uploadsRoot + path.sep)) {
    return new NextResponse("Invalid filename", { status: 400 })
  }

  try {
    const buffer = await readFile(filePath)
    const rawName = req.nextUrl.searchParams.get("name") ?? attachment.originalName
    const originalName = rawName.replace(/[^\w.\-\s]/g, "_")
    const contentType = ALLOWED_EXTENSIONS[ext]

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
