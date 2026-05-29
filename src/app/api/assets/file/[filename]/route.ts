import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import path from "path"
import type { Role } from "@/generated/prisma/enums"

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params

  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return new NextResponse("Invalid filename", { status: 400 })
  }

  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if ((session.user.roles as string[]).includes("SPRAVCA_APLIKACIE")) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const attachment = await prisma.assetAttachment.findFirst({
    where: { storedName: filename },
  })
  if (!attachment) return new NextResponse("Not found", { status: 404 })

  const userRoles = session.user.roles as Role[]
  const isManager = userRoles.includes("SPRAVCA_MAJETKU")
  const isSecurityWorker = userRoles.includes("BEZPECNOSTNY_PRACOVNIK")

  let hasAccess = false
  if (attachment.visibility === "Everyone") {
    hasAccess = true
  } else if (attachment.visibility === "ManagersAndSecurity") {
    hasAccess = isManager || isSecurityWorker
  } else if (attachment.visibility === "OwnRoleOnly") {
    hasAccess = (attachment.uploaderRoles as Role[]).some((r) => userRoles.includes(r))
  }

  if (!hasAccess) return new NextResponse("Forbidden", { status: 403 })

  const ext = path.extname(filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS[ext]) {
    return new NextResponse("Unsupported file type", { status: 415 })
  }

  const uploadsRoot = path.resolve(process.cwd(), "uploads", "assets")
  const filePath = path.resolve(uploadsRoot, filename)
  if (!filePath.startsWith(uploadsRoot + path.sep)) {
    return new NextResponse("Invalid filename", { status: 400 })
  }

  try {
    const buffer = await readFile(filePath)
    const originalName = attachment.originalName.replace(/[^\w.\-\s]/g, "_")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": ALLOWED_EXTENSIONS[ext],
        "Content-Disposition": `attachment; filename="${encodeURIComponent(originalName)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new NextResponse("File not found", { status: 404 })
  }
}
