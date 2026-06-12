import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import { join, resolve, sep } from "path"
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

function canAccess(roles: string[], zaznam: { spracovatelId: number | null }, userId: number) {
  if (roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("PRACOVNIK_PODATELNE") || roles.includes("SPRAVCA_APLIKACIE")) return true
  return roles.includes("SPRACOVATEL_REGISTRATURY") && zaznam.spracovatelId === userId
}

// [id] = ZaznamPriloha.id
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const priolohaId = parseInt(id)
  if (isNaN(priolohaId)) return new NextResponse("Invalid ID", { status: 400 })

  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const priloha = await prisma.zaznamPriloha.findUnique({
    where: { id: priolohaId },
    include: { zaznam: true },
  })
  if (!priloha || !priloha.storedName || !priloha.originalName) return new NextResponse("Not found", { status: 404 })

  const roles = session.user.roles as string[]
  const userId = parseInt(session.user.id)
  if (!canAccess(roles, priloha.zaznam, userId)) return new NextResponse("Forbidden", { status: 403 })

  const ext = priloha.storedName.split(".").pop()?.toLowerCase() ?? ""
  const uploadsDir = resolve(process.cwd(), "uploads", "registratura")
  const filePath = resolve(uploadsDir, priloha.storedName)
  if (!filePath.startsWith(uploadsDir + sep)) return new NextResponse("Forbidden", { status: 403 })

  try {
    const buffer = await readFile(filePath)

    if (priloha.fileHash) {
      const currentHash = createHash("sha256").update(buffer).digest("hex")
      if (currentHash !== priloha.fileHash) {
        await createAuditLog({
          userId, userEmail: session.user.email, userName: session.user.name,
          action: "UPDATE", entityType: "REG_PRILOHA_INTEGRITY_FAIL", entityId: priolohaId,
          entityLabel: priloha.zaznam.cisloZaznamu,
          newData: { storedHash: priloha.fileHash, currentHash },
        })
        return new NextResponse(
          JSON.stringify({ error: "INTEGRITA SÚBORU NARUŠENÁ: hash sa nezhoduje so zaznamenanou hodnotou." }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        )
      }
    }

    await createAuditLog({
      userId, userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "REG_PRILOHA_DOWNLOAD", entityId: priolohaId,
      entityLabel: `${priloha.zaznam.cisloZaznamu} / ${priloha.nazov}`,
      newData: { fileName: priloha.originalName },
    })

    const mimeType = MIME_MAP[ext] ?? "application/octet-stream"
    const safeName = priloha.originalName.replace(/[^\w.\-\s]/g, "_")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}"`,
        "X-Content-Type-Options": "nosniff",
        "X-File-Hash": priloha.fileHash ?? "",
      },
    })
  } catch {
    return new NextResponse("File not found", { status: 404 })
  }
}
