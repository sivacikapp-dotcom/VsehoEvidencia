"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/auditLog"
import { revalidatePath } from "next/cache"

type Result = { error?: string; success?: boolean }

function requireAdmin(roles: string[]): string | null {
  if (!roles.includes("SPRAVCA_APLIKACIE")) return "Nemáte oprávnenie spravovať útvary."
  return null
}

export async function createUtvar(nazov: string): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  const err = requireAdmin(callerRoles)
  if (!session || err) return { error: err ?? "Prístup zamietnutý." }

  const name = nazov.trim()
  if (!name) return { error: "Názov útvaru je povinný." }
  if (name.length > 200) return { error: "Názov je príliš dlhý (max 200 znakov)." }

  const existing = await prisma.utvar.findUnique({ where: { nazov: name } })
  if (existing) return { error: `Útvar „${name}" už existuje.` }

  try {
    const utvar = await prisma.utvar.create({ data: { nazov: name } })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "UTVAR", entityId: utvar.id, entityLabel: utvar.nazov,
      newData: { nazov: name },
    })
    revalidatePath("/dashboard/admin/utvary")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function updateUtvar(id: number, nazov: string): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  const err = requireAdmin(callerRoles)
  if (!session || err) return { error: err ?? "Prístup zamietnutý." }

  const name = nazov.trim()
  if (!name) return { error: "Názov útvaru je povinný." }
  if (name.length > 200) return { error: "Názov je príliš dlhý (max 200 znakov)." }

  const old = await prisma.utvar.findUnique({ where: { id } })
  if (!old) return { error: "Útvar neexistuje." }

  const conflict = await prisma.utvar.findUnique({ where: { nazov: name } })
  if (conflict && conflict.id !== id) return { error: `Útvar „${name}" už existuje.` }

  try {
    await prisma.utvar.update({ where: { id }, data: { nazov: name } })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "UTVAR", entityId: id, entityLabel: name,
      oldData: { nazov: old.nazov }, newData: { nazov: name },
    })
    revalidatePath("/dashboard/admin/utvary")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function deleteUtvar(id: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  const err = requireAdmin(callerRoles)
  if (!session || err) return { error: err ?? "Prístup zamietnutý." }

  const utvar = await prisma.utvar.findUnique({ where: { id }, include: { _count: { select: { users: true } } } })
  if (!utvar) return { error: "Útvar neexistuje." }
  if (utvar._count.users > 0) return { error: `Útvar má priradených ${utvar._count.users} používateľov. Najprv ich odstráňte.` }

  try {
    await prisma.utvar.delete({ where: { id } })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "DELETE", entityType: "UTVAR", entityId: id, entityLabel: utvar.nazov,
      oldData: { nazov: utvar.nazov },
    })
    revalidatePath("/dashboard/admin/utvary")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri mazaní." }
  }
}
