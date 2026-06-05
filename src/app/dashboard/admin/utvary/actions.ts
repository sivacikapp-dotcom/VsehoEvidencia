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

async function getUtvarDepth(id: number): Promise<number> {
  const utvar = await prisma.utvar.findUnique({ where: { id }, select: { parentId: true } })
  if (!utvar || !utvar.parentId) return 1
  return 1 + (await getUtvarDepth(utvar.parentId))
}

export async function createUtvar(
  nazov: string,
  parentId: number | null,
  vedouciId: number | null
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  const err = requireAdmin(callerRoles)
  if (!session || err) return { error: err ?? "Prístup zamietnutý." }

  const name = nazov.trim()
  if (!name) return { error: "Názov útvaru je povinný." }
  if (name.length > 200) return { error: "Názov je príliš dlhý (max 200 znakov)." }

  if (parentId) {
    const parentDepth = await getUtvarDepth(parentId)
    if (parentDepth >= 3) return { error: "Nie je možné pridať útvar hlbšie ako 3 úrovne." }
  }

  const existing = await prisma.utvar.findUnique({ where: { nazov: name } })
  if (existing) return { error: `Útvar „${name}" už existuje.` }

  try {
    const utvar = await prisma.utvar.create({
      data: {
        nazov: name,
        parentId: parentId || null,
        vedouciId: vedouciId || null,
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "UTVAR", entityId: utvar.id, entityLabel: utvar.nazov,
      newData: { nazov: name, parentId, vedouciId },
    })
    revalidatePath("/dashboard/admin/utvary")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function updateUtvar(
  id: number,
  nazov: string,
  parentId: number | null,
  vedouciId: number | null
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  const err = requireAdmin(callerRoles)
  if (!session || err) return { error: err ?? "Prístup zamietnutý." }

  const name = nazov.trim()
  if (!name) return { error: "Názov útvaru je povinný." }
  if (name.length > 200) return { error: "Názov je príliš dlhý (max 200 znakov)." }

  const old = await prisma.utvar.findUnique({ where: { id } })
  if (!old) return { error: "Útvar neexistuje." }

  if (parentId) {
    if (parentId === id) return { error: "Útvar nemôže byť rodičom samého seba." }
    const parentDepth = await getUtvarDepth(parentId)
    if (parentDepth >= 3) return { error: "Nie je možné umiestniť útvar hlbšie ako 3 úrovne." }

    // Check that parentId is not a descendant of id (would create cycle)
    let cur: number | null = parentId
    while (cur !== null) {
      if (cur === id) return { error: "Nie je možné nastaviť potomka ako rodiča (vznikol by cyklus)." }
      const p: { parentId: number | null } | null = await prisma.utvar.findUnique({ where: { id: cur }, select: { parentId: true } })
      cur = p?.parentId ?? null
    }
  }

  const conflict = await prisma.utvar.findUnique({ where: { nazov: name } })
  if (conflict && conflict.id !== id) return { error: `Útvar „${name}" už existuje.` }

  try {
    await prisma.utvar.update({
      where: { id },
      data: {
        nazov: name,
        parentId: parentId || null,
        vedouciId: vedouciId || null,
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id), userEmail: session.user.email, userName: session.user.name,
      action: "UPDATE", entityType: "UTVAR", entityId: id, entityLabel: name,
      oldData: { nazov: old.nazov, parentId: old.parentId, vedouciId: old.vedouciId },
      newData: { nazov: name, parentId, vedouciId },
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

  const utvar = await prisma.utvar.findUnique({
    where: { id },
    include: { _count: { select: { users: true, children: true } } },
  })
  if (!utvar) return { error: "Útvar neexistuje." }
  if (utvar._count.children > 0) return { error: `Útvar má ${utvar._count.children} pododdelení. Najprv ich odstráňte alebo presuňte.` }
  if (utvar._count.users > 0) return { error: `Útvar má priradených ${utvar._count.users} používateľov. Najprv ich presuňte do iného útvaru.` }

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
