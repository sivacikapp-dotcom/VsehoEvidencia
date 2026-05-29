"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma"
import { writeFile, unlink, mkdir } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { extractDocText } from "@/lib/extractText"
import { notifyDocumentAdded, notifyDocumentDeleted } from "@/lib/notificationHelpers"
import { createAuditLog } from "@/lib/auditLog"

async function getSession(_opts: { mutation?: boolean } = {}) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("Neautorizovaný")
  return session
}

async function getUserDocContext(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roles: true,
      agendaGestors: { select: { agendaId: true } },
      documentGestors: { select: { documentId: true } },
    },
  })
  return user
}

export async function createAgenda(formData: FormData) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)
  if (!user?.roles.includes("SPRAVCA_DOKUMENTOV")) throw new Error("Len správca dokumentov môže vytvárať agendy")

  const name = (formData.get("name") as string)?.trim()
  if (!name) return { error: "Názov agendy je povinný" }

  try {
    const created = await prisma.agenda.create({ data: { name } })
    await createAuditLog({
      userId, userEmail: session.user.email, userName: session.user.name,
      action: "CREATE", entityType: "AGENDA", entityId: created.id, entityLabel: created.name,
      newData: { name: created.name },
    })
    revalidatePath("/dashboard/dokumenty")
    return { success: true }
  } catch {
    return { error: "Agenda s týmto názvom už existuje" }
  }
}

export async function deleteAgenda(agendaId: number) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)
  if (!user?.roles.includes("SPRAVCA_DOKUMENTOV")) throw new Error("Len správca dokumentov môže mazať agendy")

  const agenda = await prisma.agenda.findUnique({ where: { id: agendaId }, select: { name: true } })
  await prisma.agenda.delete({ where: { id: agendaId } })
  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "DELETE", entityType: "AGENDA", entityId: agendaId, entityLabel: agenda?.name ?? null,
    oldData: agenda ? { name: agenda.name } : null,
  })
  revalidatePath("/dashboard/dokumenty")
  return { success: true }
}

export async function createDocument(formData: FormData) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const agendaId = parseInt(formData.get("agendaId") as string)
  const isAdmin = user?.roles.includes("SPRAVCA_DOKUMENTOV")
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === agendaId)
  if (!isAdmin && !isAgendaGestor) throw new Error("Nemáte oprávnenie vytvárať dokumenty v tejto agende")

  const znacka = (formData.get("znacka") as string)?.trim()
  const nazov = (formData.get("nazov") as string)?.trim()
  const datumRaw = formData.get("datumSchvalenia") as string
  const confidentiality = formData.get("confidentiality") as string
  const file = formData.get("priloha") as File | null

  if (!znacka) return { error: "Značka je povinná" }
  if (!nazov) return { error: "Názov je povinný" }
  if (!datumRaw) return { error: "Dátum schválenia je povinný" }

  let prilohaPath: string | undefined
  let prilohaName: string | undefined

  let textContent: string | undefined
  if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    prilohaPath = storedName
    prilohaName = file.name
    textContent = (await extractDocText(storedName)) ?? undefined
  }

  const newDoc = await prisma.document.create({
    data: {
      znacka,
      nazov,
      datumSchvalenia: new Date(datumRaw),
      confidentiality: (confidentiality as "VEREJNY" | "INTERNI" | "DOVERNI") || "INTERNI",
      agendaId,
      prilohaPath,
      prilohaName,
      textContent,
    },
    include: { agenda: { select: { name: true } } },
  })

  await notifyDocumentAdded(
    newDoc.id,
    znacka,
    nazov,
    newDoc.agenda.name,
    newDoc.confidentiality,
    agendaId,
    userId
  )
  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "CREATE", entityType: "DOCUMENT", entityId: newDoc.id, entityLabel: `${znacka} – ${nazov}`,
    newData: { znacka, nazov, confidentiality: newDoc.confidentiality, agendaId },
  })
  revalidatePath(`/dashboard/dokumenty/${agendaId}`)
  return { success: true }
}

export async function updateDocument(formData: FormData) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const documentId = parseInt(formData.get("documentId") as string)
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.roles.includes("SPRAVCA_DOKUMENTOV")
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId)
  const isDocGestor = user?.documentGestors.some((g) => g.documentId === documentId)
  if (!isAdmin && !isAgendaGestor && !isDocGestor) throw new Error("Nemáte oprávnenie editovať tento dokument")

  const znacka = (formData.get("znacka") as string)?.trim()
  const nazov = (formData.get("nazov") as string)?.trim()
  const datumRaw = formData.get("datumSchvalenia") as string
  const confidentiality = formData.get("confidentiality") as string
  const file = formData.get("priloha") as File | null
  const removePriloha = formData.get("removePriloha") === "true"

  if (!znacka) return { error: "Značka je povinná" }
  if (!nazov) return { error: "Názov je povinný" }
  if (!datumRaw) return { error: "Dátum schválenia je povinný" }

  let prilohaPath = doc.prilohaPath
  let prilohaName = doc.prilohaName
  let textContent = doc.textContent

  if (removePriloha) {
    prilohaPath = null
    prilohaName = null
    textContent = null
  } else if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    prilohaPath = storedName
    prilohaName = file.name
    textContent = await extractDocText(storedName)
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      znacka,
      nazov,
      datumSchvalenia: new Date(datumRaw),
      confidentiality: (confidentiality as "VEREJNY" | "INTERNI" | "DOVERNI") || "INTERNI",
      prilohaPath,
      prilohaName,
      textContent,
    },
  })
  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "UPDATE", entityType: "DOCUMENT", entityId: documentId, entityLabel: `${znacka} – ${nazov}`,
    oldData: { znacka: doc.znacka, nazov: doc.nazov, confidentiality: doc.confidentiality },
    newData: { znacka, nazov, confidentiality },
  })
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${documentId}`)
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}`)
  return { success: true }
}

export async function deleteDocument(documentId: number) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { agenda: { select: { name: true } } },
  })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.roles.includes("SPRAVCA_DOKUMENTOV")
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId)
  if (!isAdmin && !isAgendaGestor) throw new Error("Nemáte oprávnenie mazať tento dokument")

  // Notify before deletion (document won't exist after)
  if (doc.isLatest) {
    await notifyDocumentDeleted(
      doc.znacka,
      doc.nazov,
      doc.agenda.name,
      doc.confidentiality,
      doc.agendaId,
      userId
    )
  }

  if (doc.parentId) {
    // Non-root version: delete only this version and restore previous as latest
    const prevVersion = await prisma.document.findFirst({
      where: {
        OR: [
          { id: doc.parentId },
          { parentId: doc.parentId, version: { lt: doc.version } },
        ],
      },
      orderBy: { version: "desc" },
    })
    await prisma.$transaction(async (tx) => {
      await tx.document.delete({ where: { id: documentId } })
      if (prevVersion) {
        await tx.document.update({ where: { id: prevVersion.id }, data: { isLatest: true } })
      }
    })
  } else {
    // Root: cascade deletes all versions
    await prisma.document.delete({ where: { id: documentId } })
  }

  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "DELETE", entityType: "DOCUMENT", entityId: documentId,
    entityLabel: `${doc.znacka} – ${doc.nazov}`,
    oldData: { znacka: doc.znacka, nazov: doc.nazov, agendaId: doc.agendaId },
  })
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}`)
  return { success: true }
}

export async function createDocumentVersion(formData: FormData) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const sourceId = parseInt(formData.get("sourceDocumentId") as string)
  const source = await prisma.document.findUnique({
    where: { id: sourceId },
    include: {
      gestors: true,
      accesses: true,
      attachments: { where: { isLatest: true }, include: { accesses: true } },
    },
  })
  if (!source) return { error: "Dokument neexistuje" }
  if (!source.isLatest) return { error: "Novú verziu možno vytvoriť iba z aktuálnej verzie" }

  const isAdmin = user?.roles.includes("SPRAVCA_DOKUMENTOV")
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === source.agendaId)
  const isDocGestor = user?.documentGestors.some((g) => g.documentId === sourceId)
  if (!isAdmin && !isAgendaGestor && !isDocGestor) throw new Error("Nemáte oprávnenie vytvárať novú verziu")

  const znacka = (formData.get("znacka") as string)?.trim()
  const nazov = (formData.get("nazov") as string)?.trim()
  const datumRaw = formData.get("datumSchvalenia") as string
  const confidentiality = formData.get("confidentiality") as string
  const file = formData.get("priloha") as File | null
  const keepPriloha = formData.get("keepPriloha") === "true"

  if (!znacka) return { error: "Značka je povinná" }
  if (!nazov) return { error: "Názov je povinný" }
  if (!datumRaw) return { error: "Dátum schválenia je povinný" }

  const rootId = source.parentId ?? source.id
  const nextVersion = source.version + 1
  const datumPrvehoSchvalenia = source.datumPrvehoSchvalenia ?? source.datumSchvalenia

  let prilohaPath: string | null = keepPriloha ? source.prilohaPath : null
  let prilohaName: string | null = keepPriloha ? source.prilohaName : null
  let textContent: string | null = keepPriloha ? (source.textContent ?? null) : null

  if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    prilohaPath = storedName
    prilohaName = file.name
    textContent = await extractDocText(storedName)
  }

  const newDoc = await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: sourceId }, data: { isLatest: false } })

    const doc = await tx.document.create({
      data: {
        znacka,
        nazov,
        datumSchvalenia: new Date(datumRaw),
        datumPrvehoSchvalenia,
        confidentiality: (confidentiality as "VEREJNY" | "INTERNI" | "DOVERNI") || source.confidentiality,
        agendaId: source.agendaId,
        prilohaPath,
        prilohaName,
        textContent,
        version: nextVersion,
        parentId: rootId,
        isLatest: true,
      },
    })

    if (source.gestors.length > 0) {
      await tx.documentGestor.createMany({
        data: source.gestors.map((g) => ({ userId: g.userId, documentId: doc.id })),
      })
    }
    if (source.accesses.length > 0) {
      await tx.documentAccess.createMany({
        data: source.accesses.map((a) => ({ userId: a.userId, documentId: doc.id, grantedById: a.grantedById })),
      })
    }
    // Copy latest attachments to new document version
    for (const att of source.attachments) {
      const newAtt = await tx.documentAttachment.create({
        data: {
          documentId: doc.id,
          znacka: att.znacka,
          nazov: att.nazov,
          datumSchvalenia: att.datumSchvalenia,
          confidentiality: att.confidentiality,
          filePath: att.filePath,
          fileName: att.fileName,
          version: 1,
          parentId: null,
          isLatest: true,
        },
      })
      if (att.accesses.length > 0) {
        await tx.documentAttachmentAccess.createMany({
          data: att.accesses.map((a) => ({ userId: a.userId, attachmentId: newAtt.id, grantedById: a.grantedById })),
        })
      }
    }

    return doc
  })

  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "CREATE", entityType: "DOCUMENT", entityId: newDoc.id,
    entityLabel: `${znacka} – ${nazov} (v${nextVersion})`,
    newData: { znacka, nazov, version: nextVersion, parentId: rootId, agendaId: source.agendaId },
  })
  revalidatePath(`/dashboard/dokumenty/${source.agendaId}`)
  return { success: true, newDocumentId: newDoc.id }
}

export async function createAttachmentVersion(formData: FormData) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)

  const sourceId = parseInt(formData.get("sourceAttachmentId") as string)
  const source = await prisma.documentAttachment.findUnique({
    where: { id: sourceId },
    include: { accesses: true },
  })
  if (!source) return { error: "Príloha neexistuje" }
  if (!source.isLatest) return { error: "Novú verziu možno vytvoriť iba z aktuálnej verzie" }

  const doc = await canEditDoc(userId, source.documentId)
  if (!doc) throw new Error("Nemáte oprávnenie vytvárať novú verziu prílohy")

  const znacka = (formData.get("znacka") as string)?.trim()
  const nazov = (formData.get("nazov") as string)?.trim()
  const datumRaw = formData.get("datumSchvalenia") as string
  const confidentiality = formData.get("confidentiality") as string
  const file = formData.get("file") as File | null
  const keepFile = formData.get("keepFile") === "true"

  if (!znacka) return { error: "Značka je povinná" }
  if (!nazov) return { error: "Názov je povinný" }
  if (!datumRaw) return { error: "Dátum schválenia je povinný" }

  const rootId = source.parentId ?? source.id
  const nextVersion = source.version + 1
  const datumPrvehoSchvalenia = source.datumPrvehoSchvalenia ?? source.datumSchvalenia

  let filePath: string | null = keepFile ? source.filePath : null
  let fileName: string | null = keepFile ? source.fileName : null
  let textContent: string | null = keepFile ? (source.textContent ?? null) : null

  if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    filePath = storedName
    fileName = file.name
    textContent = await extractDocText(storedName)
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentAttachment.update({ where: { id: sourceId }, data: { isLatest: false } })

    const newAtt = await tx.documentAttachment.create({
      data: {
        documentId: source.documentId,
        znacka,
        nazov,
        datumSchvalenia: new Date(datumRaw),
        datumPrvehoSchvalenia,
        confidentiality: (confidentiality as "VEREJNY" | "INTERNI" | "DOVERNI") || source.confidentiality,
        filePath,
        fileName,
        textContent,
        version: nextVersion,
        parentId: rootId,
        isLatest: true,
      },
    })

    if (source.accesses.length > 0) {
      await tx.documentAttachmentAccess.createMany({
        data: source.accesses.map((a) => ({ userId: a.userId, attachmentId: newAtt.id, grantedById: a.grantedById })),
      })
    }
  })

  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "CREATE", entityType: "DOCUMENT_ATTACHMENT", entityId: source.documentId,
    entityLabel: `${znacka} (v${nextVersion})`,
    newData: { znacka, nazov, version: nextVersion, documentId: source.documentId },
  })
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${source.documentId}`)
  return { success: true }
}

export async function grantDocumentAccess(documentId: number, targetUserId: number) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.roles.includes("SPRAVCA_DOKUMENTOV")
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId)
  const isDocGestor = user?.documentGestors.some((g) => g.documentId === documentId)
  if (!isAdmin && !isAgendaGestor && !isDocGestor) throw new Error("Nemáte oprávnenie udeľovať prístup")

  await prisma.documentAccess.upsert({
    where: { userId_documentId: { userId: targetUserId, documentId } },
    create: { userId: targetUserId, documentId, grantedById: userId },
    update: {},
  })
  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "CREATE", entityType: "DOCUMENT_ACCESS", entityId: documentId, entityLabel: null,
    newData: { documentId, targetUserId },
  })
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${documentId}`)
  return { success: true }
}

export async function revokeDocumentAccess(documentId: number, targetUserId: number) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.roles.includes("SPRAVCA_DOKUMENTOV")
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId)
  const isDocGestor = user?.documentGestors.some((g) => g.documentId === documentId)
  if (!isAdmin && !isAgendaGestor && !isDocGestor) throw new Error("Nemáte oprávnenie odoberať prístup")

  await prisma.documentAccess.deleteMany({
    where: { userId: targetUserId, documentId },
  })
  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "DELETE", entityType: "DOCUMENT_ACCESS", entityId: documentId, entityLabel: null,
    oldData: { documentId, targetUserId },
  })
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${documentId}`)
  return { success: true }
}

export async function setAgendaGestor(agendaId: number, targetUserId: number, add: boolean) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)
  if (!user?.roles.includes("SPRAVCA_DOKUMENTOV")) throw new Error("Len správca dokumentov môže prideľovať gestorov agend")

  if (add) {
    await prisma.agendaGestor.upsert({
      where: { userId_agendaId: { userId: targetUserId, agendaId } },
      create: { userId: targetUserId, agendaId },
      update: {},
    })
  } else {
    await prisma.agendaGestor.deleteMany({ where: { userId: targetUserId, agendaId } })
  }

  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: add ? "CREATE" : "DELETE", entityType: "AGENDA_GESTOR", entityId: agendaId, entityLabel: null,
    newData: { agendaId, targetUserId, add },
  })
  revalidatePath(`/dashboard/dokumenty/${agendaId}`)
  return { success: true }
}


export async function setDocumentGestor(documentId: number, targetUserId: number | null) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.roles.includes("SPRAVCA_DOKUMENTOV")
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId)
  if (!isAdmin && !isAgendaGestor) throw new Error("Nemáte oprávnenie prideľovať gestora dokumentu")

  // Enforce single gestor: remove all existing, then add new one if specified
  await prisma.documentGestor.deleteMany({ where: { documentId } })
  if (targetUserId !== null) {
    await prisma.documentGestor.create({ data: { userId: targetUserId, documentId } })
  }

  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: targetUserId ? "CREATE" : "DELETE", entityType: "DOCUMENT_GESTOR", entityId: documentId, entityLabel: null,
    newData: { documentId, targetUserId },
  })
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${documentId}`)
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}`)
  return { success: true }
}

async function canEditDoc(userId: number, documentId: number) {
  const [user, doc] = await Promise.all([
    getUserDocContext(userId),
    prisma.document.findUnique({ where: { id: documentId } }),
  ])
  if (!doc) return null
  const isAdmin = user?.roles.includes("SPRAVCA_DOKUMENTOV") ?? false
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId) ?? false
  const isDocGestor = user?.documentGestors.some((g) => g.documentId === documentId) ?? false
  if (!isAdmin && !isAgendaGestor && !isDocGestor) return null
  return doc
}

export async function createDocumentAttachment(formData: FormData) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)

  const documentId = parseInt(formData.get("documentId") as string)
  const doc = await canEditDoc(userId, documentId)
  if (!doc) throw new Error("Nemáte oprávnenie pridávať prílohy k tomuto dokumentu")

  const znacka = (formData.get("znacka") as string)?.trim()
  const nazov = (formData.get("nazov") as string)?.trim()
  const datumRaw = formData.get("datumSchvalenia") as string
  const confidentiality = formData.get("confidentiality") as string
  const file = formData.get("file") as File | null

  if (!znacka) return { error: "Značka je povinná" }
  if (!nazov) return { error: "Názov je povinný" }
  if (!datumRaw) return { error: "Dátum schválenia je povinný" }

  let filePath: string | undefined
  let fileName: string | undefined
  let textContent: string | undefined

  if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    filePath = storedName
    fileName = file.name
    textContent = (await extractDocText(storedName)) ?? undefined
  }

  await prisma.documentAttachment.create({
    data: {
      documentId,
      znacka,
      nazov,
      datumSchvalenia: new Date(datumRaw),
      confidentiality: (confidentiality as "VEREJNY" | "INTERNI" | "DOVERNI") || doc.confidentiality,
      filePath,
      fileName,
      textContent,
    },
  })

  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "CREATE", entityType: "DOCUMENT_ATTACHMENT", entityId: documentId,
    entityLabel: `${znacka} – ${nazov}`,
    newData: { znacka, nazov, confidentiality, documentId },
  })
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${documentId}`)
  return { success: true }
}

export async function updateDocumentAttachment(formData: FormData) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)

  const attachmentId = parseInt(formData.get("attachmentId") as string)
  const attachment = await prisma.documentAttachment.findUnique({ where: { id: attachmentId } })
  if (!attachment) return { error: "Príloha neexistuje" }

  const doc = await canEditDoc(userId, attachment.documentId)
  if (!doc) throw new Error("Nemáte oprávnenie editovať túto prílohu")

  const znacka = (formData.get("znacka") as string)?.trim()
  const nazov = (formData.get("nazov") as string)?.trim()
  const confidentiality = formData.get("confidentiality") as string
  const file = formData.get("file") as File | null
  const removeFile = formData.get("removeFile") === "true"

  if (!znacka) return { error: "Značka je povinná" }
  if (!nazov) return { error: "Názov je povinný" }

  let filePath = attachment.filePath
  let fileName = attachment.fileName
  let textContent = attachment.textContent

  if (removeFile) {
    if (filePath) {
      const fullPath = path.join(process.cwd(), "uploads", "docs", filePath)
      await unlink(fullPath).catch(() => {})
    }
    filePath = null
    fileName = null
    textContent = null
  } else if (file && file.size > 0) {
    if (filePath) {
      const fullPath = path.join(process.cwd(), "uploads", "docs", filePath)
      await unlink(fullPath).catch(() => {})
    }
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    filePath = storedName
    fileName = file.name
    textContent = await extractDocText(storedName)
  }

  await prisma.documentAttachment.update({
    where: { id: attachmentId },
    data: {
      znacka,
      nazov,
      confidentiality: confidentiality as "VEREJNY" | "INTERNI" | "DOVERNI",
      filePath,
      fileName,
      textContent,
    },
  })

  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "UPDATE", entityType: "DOCUMENT_ATTACHMENT", entityId: attachmentId,
    entityLabel: `${znacka} – ${nazov}`,
    oldData: { znacka: attachment.znacka, nazov: attachment.nazov, confidentiality: attachment.confidentiality },
    newData: { znacka, nazov, confidentiality },
  })
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${attachment.documentId}`)
  return { success: true }
}

export async function grantAttachmentAccess(attachmentId: number, targetUserId: number) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)

  const attachment = await prisma.documentAttachment.findUnique({ where: { id: attachmentId } })
  if (!attachment) return { error: "Príloha neexistuje" }

  const doc = await canEditDoc(userId, attachment.documentId)
  if (!doc) throw new Error("Nemáte oprávnenie udeľovať prístup k tejto prílohe")

  await prisma.documentAttachmentAccess.upsert({
    where: { userId_attachmentId: { userId: targetUserId, attachmentId } },
    create: { userId: targetUserId, attachmentId, grantedById: userId },
    update: {},
  })

  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${attachment.documentId}`)
  return { success: true }
}

export async function revokeAttachmentAccess(attachmentId: number, targetUserId: number) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)

  const attachment = await prisma.documentAttachment.findUnique({ where: { id: attachmentId } })
  if (!attachment) return { error: "Príloha neexistuje" }

  const doc = await canEditDoc(userId, attachment.documentId)
  if (!doc) throw new Error("Nemáte oprávnenie odoberať prístup k tejto prílohe")

  await prisma.documentAttachmentAccess.deleteMany({
    where: { userId: targetUserId, attachmentId },
  })

  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${attachment.documentId}`)
  return { success: true }
}

export async function deleteDocumentAttachment(attachmentId: number) {
  const session = await getSession({ mutation: true })
  const userId = parseInt(session.user.id)

  const attachment = await prisma.documentAttachment.findUnique({ where: { id: attachmentId } })
  if (!attachment) return { error: "Príloha neexistuje" }

  const doc = await canEditDoc(userId, attachment.documentId)
  if (!doc) throw new Error("Nemáte oprávnenie mazať túto prílohu")

  if (attachment.filePath) {
    const fullPath = path.join(process.cwd(), "uploads", "docs", attachment.filePath)
    await unlink(fullPath).catch(() => {})
  }

  await prisma.documentAttachment.delete({ where: { id: attachmentId } })
  await createAuditLog({
    userId, userEmail: session.user.email, userName: session.user.name,
    action: "DELETE", entityType: "DOCUMENT_ATTACHMENT", entityId: attachmentId,
    entityLabel: `${attachment.znacka} – ${attachment.nazov}`,
    oldData: { znacka: attachment.znacka, nazov: attachment.nazov, documentId: attachment.documentId },
  })
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${attachment.documentId}`)
  return { success: true }
}

export type DocSearchResult = {
  type: "document" | "attachment"
  documentId: number
  agendaId: number
  agendaName: string
  znacka: string
  nazov: string
  confidentiality: string
  version: number
  attachmentId?: number
  attachmentZnacka?: string
  attachmentNazov?: string
  docSnippet?: string
  attSnippet?: string
  matchedDocFile?: string
  matchedAttFile?: string
}

function extractSnippet(text: string, query: string, contextLen = 120): string {
  const lText = text.toLowerCase()
  const lQuery = query.toLowerCase()
  const idx = lText.indexOf(lQuery)
  if (idx === -1) return ""
  const start = Math.max(0, idx - contextLen)
  const end = Math.min(text.length, idx + query.length + contextLen)
  let snippet = text.slice(start, end).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim()
  if (start > 0) snippet = "…" + snippet
  if (end < text.length) snippet += "…"
  return snippet
}

export async function searchDocuments(
  query: string,
  opts: { nazovDok: boolean; nazovPrilohy: boolean; textDok: boolean; textPrilohy: boolean; nazovSuboru: boolean; agendaId?: number }
): Promise<{ results: DocSearchResult[] }> {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const q = query.trim()
  if (!q || q.length < 2) return { results: [] }

  const userCtx = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roles: true,
      agendaGestors: { select: { agendaId: true } },
      documentGestors: { select: { documentId: true } },
      documentAccesses: { select: { documentId: true } },
    },
  })

  const isAdmin = userCtx?.roles.includes("SPRAVCA_DOKUMENTOV") ?? false
  const managedAgendaIds = userCtx?.agendaGestors.map((g) => g.agendaId) ?? []
  const managedDocIds = userCtx?.documentGestors.map((g) => g.documentId) ?? []
  const accessDocIds = userCtx?.documentAccesses.map((g) => g.documentId) ?? []

  const canAccessDoc = (doc: { confidentiality: string; agendaId: number; id: number }) => {
    if (doc.confidentiality !== "DOVERNI") return true
    if (isAdmin) return true
    if (managedAgendaIds.includes(doc.agendaId)) return true
    if (managedDocIds.includes(doc.id)) return true
    if (accessDocIds.includes(doc.id)) return true
    return false
  }

  const results: DocSearchResult[] = []

  if (opts.nazovDok || opts.textDok || opts.nazovSuboru) {
    const orClauses: Prisma.DocumentWhereInput[] = []
    if (opts.nazovDok) {
      orClauses.push(
        { nazov: { contains: q, mode: "insensitive" } },
        { znacka: { contains: q, mode: "insensitive" } },
      )
    }
    if (opts.textDok) {
      orClauses.push({ textContent: { contains: q, mode: "insensitive" } })
    }
    if (opts.nazovSuboru) {
      orClauses.push({ prilohaName: { contains: q, mode: "insensitive" } })
    }

    const docs = await prisma.document.findMany({
      where: { isLatest: true, OR: orClauses, ...(opts.agendaId ? { agendaId: opts.agendaId } : {}) },
      include: { agenda: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    })

    for (const doc of docs) {
      if (!canAccessDoc(doc)) continue
      const docSnippet = opts.textDok && doc.textContent
        ? extractSnippet(doc.textContent, q) || undefined
        : undefined
      const matchedDocFile = opts.nazovSuboru && doc.prilohaName?.toLowerCase().includes(q.toLowerCase())
        ? doc.prilohaName
        : undefined
      results.push({
        type: "document",
        documentId: doc.id,
        agendaId: doc.agendaId,
        agendaName: doc.agenda.name,
        znacka: doc.znacka,
        nazov: doc.nazov,
        confidentiality: doc.confidentiality,
        version: doc.version,
        docSnippet,
        matchedDocFile,
      })
    }
  }

  if (opts.nazovPrilohy || opts.textPrilohy || opts.nazovSuboru) {
    const orClauses: Prisma.DocumentAttachmentWhereInput[] = []
    if (opts.nazovPrilohy) {
      orClauses.push(
        { nazov: { contains: q, mode: "insensitive" } },
        { znacka: { contains: q, mode: "insensitive" } },
      )
    }
    if (opts.textPrilohy) {
      orClauses.push({ textContent: { contains: q, mode: "insensitive" } })
    }
    if (opts.nazovSuboru) {
      orClauses.push({ fileName: { contains: q, mode: "insensitive" } })
    }

    const attachments = await prisma.documentAttachment.findMany({
      where: {
        isLatest: true,
        OR: orClauses,
        ...(opts.agendaId ? { document: { agendaId: opts.agendaId } } : {}),
      },
      include: {
        document: { include: { agenda: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    const seenDocIds = new Set(results.map((r) => r.documentId))
    for (const att of attachments) {
      const doc = att.document
      if (!doc.isLatest) continue
      if (!canAccessDoc({ confidentiality: doc.confidentiality, agendaId: doc.agendaId, id: doc.id })) continue
      const attSnippet = opts.textPrilohy && att.textContent
        ? extractSnippet(att.textContent, q) || undefined
        : undefined
      const matchedAttFile = opts.nazovSuboru && att.fileName?.toLowerCase().includes(q.toLowerCase())
        ? att.fileName
        : undefined
      if (seenDocIds.has(doc.id)) {
        const existing = results.find((r) => r.documentId === doc.id && r.type === "document")
        if (existing && !existing.attachmentId) {
          existing.attachmentId = att.id
          existing.attachmentZnacka = att.znacka
          existing.attachmentNazov = att.nazov
          existing.attSnippet = attSnippet
          existing.matchedAttFile = matchedAttFile
        }
        continue
      }
      seenDocIds.add(doc.id)
      results.push({
        type: "attachment",
        documentId: doc.id,
        agendaId: doc.agendaId,
        agendaName: doc.agenda.name,
        znacka: doc.znacka,
        nazov: doc.nazov,
        confidentiality: doc.confidentiality,
        version: doc.version,
        attachmentId: att.id,
        attachmentZnacka: att.znacka,
        attachmentNazov: att.nazov,
        attSnippet,
        matchedAttFile,
      })
    }
  }

  return { results: results.slice(0, 80) }
}
