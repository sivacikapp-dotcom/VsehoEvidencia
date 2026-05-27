import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"
import { createAuditLog } from "@/lib/auditLog"

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  eml: "message/rfc822",
  msg: "application/vnd.ms-outlook",
}

function canAccess(roles: string[], zaznam: { spracovatelId: number }, userId: number) {
  if (roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("PRACOVNIK_PODATELNE") || roles.includes("SPRAVCA_APLIKACIE")) return true
  return roles.includes("SPRACOVATEL_REGISTRATURY") && zaznam.spracovatelId === userId
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const zaznamId = parseInt(id)
  if (isNaN(zaznamId)) return new NextResponse("Invalid ID", { status: 400 })

  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam || !zaznam.storedName || !zaznam.originalName) return new NextResponse("Not found", { status: 404 })

  const roles = session.user.roles as string[]
  const userId = parseInt(session.user.id)
  if (!canAccess(roles, zaznam, userId)) return new NextResponse("Forbidden", { status: 403 })

  const ext = zaznam.storedName.split(".").pop()?.toLowerCase() ?? ""
  const uploadsRoot = join(process.cwd(), "uploads", "registratura")
  const filePath = join(uploadsRoot, zaznam.storedName)

  try {
    const buffer = await readFile(filePath)

    // Integrity check — compare stored hash with current file hash
    if (zaznam.fileHash) {
      const currentHash = createHash("sha256").update(buffer).digest("hex")
      if (currentHash !== zaznam.fileHash) {
        console.error(`[RegFile] Hash mismatch for zaznam ${zaznamId}: stored=${zaznam.fileHash} current=${currentHash}`)
        await createAuditLog({
          userId, userEmail: session.user.email, userName: session.user.name,
          action: "UPDATE", entityType: "REG_ZAZNAM_INTEGRITY_FAIL", entityId: zaznamId,
          entityLabel: zaznam.cisloZaznamu,
          newData: { storedHash: zaznam.fileHash, currentHash },
        })
        return new NextResponse(
          JSON.stringify({ error: "INTEGRITA SÚBORU NARUŠENÁ: hash sa nezhoduje so zaznamenanou hodnotou." }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        )
      }
    }

    await createAuditLog({
      userId, userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "REG_ZAZNAM_DOWNLOAD", entityId: zaznamId,
      entityLabel: zaznam.cisloZaznamu,
      newData: { fileName: zaznam.originalName },
    })

    const mimeType = MIME_MAP[ext] ?? "application/octet-stream"
    const safeName = zaznam.originalName.replace(/[^\w.\-\s]/g, "_")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}"`,
        "X-Content-Type-Options": "nosniff",
        "X-File-Hash": zaznam.fileHash ?? "",
      },
    })
  } catch {
    return new NextResponse("File not found", { status: 404 })
  }
}
