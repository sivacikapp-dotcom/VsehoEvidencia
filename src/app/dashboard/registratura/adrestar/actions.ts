"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import { revalidatePath } from "next/cache"

type Result = { error?: string; success?: boolean; id?: number }

function canManage(roles: string[]) {
  return roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
}

function parseContact(fd: FormData) {
  return {
    meno:          (fd.get("meno") as string)?.trim() || null,
    priezvisko:    (fd.get("priezvisko") as string)?.trim() || null,
    nazov:         (fd.get("nazov") as string)?.trim() || null,
    oddelenie:     (fd.get("oddelenie") as string)?.trim() || null,
    ulica:         (fd.get("ulica") as string)?.trim() || null,
    mesto:         (fd.get("mesto") as string)?.trim() || null,
    psc:           (fd.get("psc") as string)?.trim() || null,
    identifikator: (fd.get("identifikator") as string)?.trim() || null,
  }
}

function label(d: ReturnType<typeof parseContact>) {
  return [d.meno, d.priezvisko, d.nazov].filter(Boolean).join(" ") || null
}

export async function createSubjekt(fd: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !canManage(roles)) return { error: "Nemáte oprávnenie." }

  const data = parseContact(fd)
  if (!data.meno && !data.priezvisko && !data.nazov) {
    return { error: "Zadajte aspoň meno, priezvisko alebo názov." }
  }

  try {
    const s = await prisma.subjekt.create({ data })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "SUBJEKT", entityId: s.id, entityLabel: label(data),
      newData: data,
    })
    revalidatePath("/dashboard/registratura/adrestar")
    return { success: true, id: s.id }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function updateSubjekt(id: number, fd: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !canManage(roles)) return { error: "Nemáte oprávnenie." }

  const data = parseContact(fd)
  if (!data.meno && !data.priezvisko && !data.nazov) {
    return { error: "Zadajte aspoň meno, priezvisko alebo názov." }
  }

  const old = await prisma.subjekt.findUnique({ where: { id } })
  if (!old) return { error: "Subjekt nenájdený." }

  try {
    await prisma.subjekt.update({ where: { id }, data })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "SUBJEKT", entityId: id, entityLabel: label(data),
      oldData: old, newData: data,
    })
    revalidatePath("/dashboard/registratura/adrestar")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function deleteSubjekt(id: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !canManage(roles)) return { error: "Nemáte oprávnenie." }

  const old = await prisma.subjekt.findUnique({ where: { id } })
  if (!old) return { error: "Subjekt nenájdený." }

  try {
    await prisma.subjekt.delete({ where: { id } })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "DELETE", entityType: "SUBJEKT", entityId: id,
      entityLabel: [old.meno, old.priezvisko, old.nazov].filter(Boolean).join(" ") || null,
    })
    revalidatePath("/dashboard/registratura/adrestar")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri mazaní." }
  }
}
