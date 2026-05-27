import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { createHash } from "crypto"
import { setZaznamFileMetadata } from "@/app/dashboard/registratura/zaznamy/actions"

const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
const ALLOWED_EXT = new Set(["pdf", "doc", "docx", "xls", "xlsx", "odt", "ods", "txt", "png", "jpg", "jpeg", "eml", "msg"])

function canUpload(roles: string[]) {
  return roles.includes("SPRACOVATEL_REGISTRATURY") || roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("PRACOVNIK_PODATELNE")
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Neautorizovaný." }, { status: 401 })
  if (!canUpload(session.user.roles as string[])) {
    return NextResponse.json({ error: "Nemáte oprávnenie nahrávať súbory." }, { status: 403 })
  }

  let formData: FormData
  try { formData = await request.formData() } catch {
    return NextResponse.json({ error: "Neplatný formát požiadavky." }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const zaznamIdRaw = formData.get("zaznamId") as string | null
  if (!file || !zaznamIdRaw) return NextResponse.json({ error: "Chýbajú povinné polia." }, { status: 400 })

  const zaznamId = parseInt(zaznamIdRaw)
  if (isNaN(zaznamId)) return NextResponse.json({ error: "Neplatné ID záznamu." }, { status: 400 })

  const zaznam = await prisma.regZaznam.findUnique({ where: { id: zaznamId } })
  if (!zaznam) return NextResponse.json({ error: "Záznam nenájdený." }, { status: 404 })
  if (zaznam.typZaznamu !== "ELEKTRONICKY") return NextResponse.json({ error: "Záznam nie je elektronický." }, { status: 400 })
  if (zaznam.storedName) return NextResponse.json({ error: "Súbor je už nahratý. Elektronický dokument je po uložení nemenný." }, { status: 409 })

  // RBAC: spracovatel can only upload to their own records
  const roles = session.user.roles as string[]
  if (roles.includes("SPRACOVATEL_REGISTRATURY") && !roles.includes("SPRAVCA_REGISTRATURY")) {
    if (zaznam.spracovatelId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Nemáte oprávnenie na tento záznam." }, { status: 403 })
    }
  }

  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Súbor je príliš veľký. Maximum je 50 MB." }, { status: 413 })
  if (file.size === 0) return NextResponse.json({ error: "Súbor je prázdny." }, { status: 400 })

  const parts = file.name.split(".")
  const ext = (parts.length > 1 ? parts.pop()! : "bin").toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: "Nepodporovaný formát súboru." }, { status: 415 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = new Uint8Array(bytes)
  const hash = createHash("sha256").update(buffer).digest("hex")
  const storedName = `${crypto.randomUUID()}.${ext}`
  const uploadDir = join(process.cwd(), "uploads", "registratura")

  await mkdir(uploadDir, { recursive: true })
  await writeFile(join(uploadDir, storedName), buffer)

  const result = await setZaznamFileMetadata(zaznamId, {
    originalName: file.name,
    storedName,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    fileHash: hash,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, hash })
}
