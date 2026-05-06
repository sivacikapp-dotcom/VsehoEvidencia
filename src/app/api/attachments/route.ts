import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { NextRequest, NextResponse } from "next/server"
import type { AttachmentVisibility, Role } from "@/generated/prisma/enums"

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const VALID_VISIBILITIES: AttachmentVisibility[] = ["Everyone", "ManagersAndSecurity", "OwnRoleOnly"]

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Neautorizovaný." }, { status: 401 })

  const roles = session.user.roles as Role[]
  const isManager = roles.includes("SPRAVCA_KARIET")
  const isSecurityWorker = roles.includes("BEZPECNOSTNY_PRACOVNIK")
  if (!isManager && !isSecurityWorker) {
    return NextResponse.json({ error: "Nemáte oprávnenie nahrávať prílohy." }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Neplatný formát požiadavky." }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const assetIdRaw = formData.get("assetId") as string | null
  const visibility = formData.get("visibility") as AttachmentVisibility | null

  if (!file || !assetIdRaw || !visibility) {
    return NextResponse.json({ error: "Chýbajúce povinné polia." }, { status: 400 })
  }
  if (!VALID_VISIBILITIES.includes(visibility)) {
    return NextResponse.json({ error: "Neplatná viditeľnosť." }, { status: 400 })
  }

  const assetId = parseInt(assetIdRaw)
  if (isNaN(assetId)) return NextResponse.json({ error: "Neplatné ID majetku." }, { status: 400 })

  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } })
  if (!asset) return NextResponse.json({ error: "Majetok nenájdený." }, { status: 404 })

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Súbor je príliš veľký. Maximum je 20 MB." }, { status: 413 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Súbor je prázdny." }, { status: 400 })
  }

  const ALLOWED_EXTENSIONS = new Set([
    "pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "txt",
  ])
  const nameParts = file.name.split(".")
  const ext = (nameParts.length > 1 ? nameParts.pop()! : "bin").toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: "Nepodporovaný formát súboru. Povolené: pdf, doc, docx, xls, xlsx, png, jpg, jpeg, txt." },
      { status: 415 }
    )
  }
  const storedName = `${crypto.randomUUID()}.${ext}`
  const uploadDir = join(process.cwd(), "uploads", "assets")

  await mkdir(uploadDir, { recursive: true })
  const bytes = await file.arrayBuffer()
  await writeFile(join(uploadDir, storedName), new Uint8Array(bytes))

  const uploaderRoles: Role[] = []
  if (isManager) uploaderRoles.push("SPRAVCA_KARIET")
  if (isSecurityWorker) uploaderRoles.push("BEZPECNOSTNY_PRACOVNIK")

  await prisma.assetAttachment.create({
    data: {
      assetId,
      storedName,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      visibility,
      uploaderRoles,
      uploadedById: parseInt(session.user.id),
      uploaderName: session.user.name ?? "Neznámy",
    },
  })

  return NextResponse.json({ success: true })
}
