"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, unlink, mkdir } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { notifyDocumentAdded, notifyDocumentDeleted } from "@/lib/notificationHelpers"

async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error("Neautorizovaný")
  return session
}

async function getUserDocContext(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      docRole: true,
      agendaGestors: { select: { agendaId: true } },
      documentGestors: { select: { documentId: true } },
    },
  })
  return user
}

export async function createAgenda(formData: FormData) {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)
  if (user?.docRole !== "SPRAVCA_DOKUMENTOV") throw new Error("Len správca dokumentov môže vytvárať agendy")

  const name = (formData.get("name") as string)?.trim()
  if (!name) return { error: "Názov agendy je povinný" }

  try {
    await prisma.agenda.create({ data: { name } })
    revalidatePath("/dashboard/dokumenty")
    return { success: true }
  } catch {
    return { error: "Agenda s týmto názvom už existuje" }
  }
}

export async function deleteAgenda(agendaId: number) {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)
  if (user?.docRole !== "SPRAVCA_DOKUMENTOV") throw new Error("Len správca dokumentov môže mazať agendy")

  await prisma.agenda.delete({ where: { id: agendaId } })
  revalidatePath("/dashboard/dokumenty")
  return { success: true }
}

export async function createDocument(formData: FormData) {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const agendaId = parseInt(formData.get("agendaId") as string)
  const isAdmin = user?.docRole === "SPRAVCA_DOKUMENTOV"
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

  if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    prilohaPath = storedName
    prilohaName = file.name
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

  revalidatePath(`/dashboard/dokumenty/${agendaId}`)
  return { success: true }
}

export async function updateDocument(formData: FormData) {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const documentId = parseInt(formData.get("documentId") as string)
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.docRole === "SPRAVCA_DOKUMENTOV"
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

  if (removePriloha) {
    prilohaPath = null
    prilohaName = null
  } else if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    prilohaPath = storedName
    prilohaName = file.name
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
    },
  })

  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${documentId}`)
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}`)
  return { success: true }
}

export async function deleteDocument(documentId: number) {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { agenda: { select: { name: true } } },
  })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.docRole === "SPRAVCA_DOKUMENTOV"
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

  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}`)
  return { success: true }
}

export async function createDocumentVersion(formData: FormData) {
  const session = await getSession()
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

  const isAdmin = user?.docRole === "SPRAVCA_DOKUMENTOV"
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

  if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    prilohaPath = storedName
    prilohaName = file.name
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

  revalidatePath(`/dashboard/dokumenty/${source.agendaId}`)
  return { success: true, newDocumentId: newDoc.id }
}

export async function createAttachmentVersion(formData: FormData) {
  const session = await getSession()
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

  if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    filePath = storedName
    fileName = file.name
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

  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${source.documentId}`)
  return { success: true }
}

export async function grantDocumentAccess(documentId: number, targetUserId: number) {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.docRole === "SPRAVCA_DOKUMENTOV"
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId)
  const isDocGestor = user?.documentGestors.some((g) => g.documentId === documentId)
  if (!isAdmin && !isAgendaGestor && !isDocGestor) throw new Error("Nemáte oprávnenie udeľovať prístup")

  await prisma.documentAccess.upsert({
    where: { userId_documentId: { userId: targetUserId, documentId } },
    create: { userId: targetUserId, documentId, grantedById: userId },
    update: {},
  })

  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${documentId}`)
  return { success: true }
}

export async function revokeDocumentAccess(documentId: number, targetUserId: number) {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.docRole === "SPRAVCA_DOKUMENTOV"
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId)
  const isDocGestor = user?.documentGestors.some((g) => g.documentId === documentId)
  if (!isAdmin && !isAgendaGestor && !isDocGestor) throw new Error("Nemáte oprávnenie odoberať prístup")

  await prisma.documentAccess.deleteMany({
    where: { userId: targetUserId, documentId },
  })

  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${documentId}`)
  return { success: true }
}

export async function setAgendaGestor(agendaId: number, targetUserId: number, add: boolean) {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)
  if (user?.docRole !== "SPRAVCA_DOKUMENTOV") throw new Error("Len správca dokumentov môže prideľovať gestorov agend")

  if (add) {
    await prisma.agendaGestor.upsert({
      where: { userId_agendaId: { userId: targetUserId, agendaId } },
      create: { userId: targetUserId, agendaId },
      update: {},
    })
  } else {
    await prisma.agendaGestor.deleteMany({ where: { userId: targetUserId, agendaId } })
  }

  revalidatePath(`/dashboard/dokumenty/${agendaId}`)
  return { success: true }
}

export async function setUserDocRole(targetUserId: number, role: "SPRAVCA_DOKUMENTOV" | "CITATEL") {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)
  if (user?.docRole !== "SPRAVCA_DOKUMENTOV") throw new Error("Len správca dokumentov môže meniť roly")
  if (targetUserId === userId) return { error: "Nemôžete zmeniť vlastnú rolu" }

  await prisma.user.update({ where: { id: targetUserId }, data: { docRole: role } })
  revalidatePath("/dashboard/dokumenty")
  return { success: true }
}

export async function setDocumentGestor(documentId: number, targetUserId: number | null) {
  const session = await getSession()
  const userId = parseInt(session.user.id)
  const user = await getUserDocContext(userId)

  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return { error: "Dokument neexistuje" }

  const isAdmin = user?.docRole === "SPRAVCA_DOKUMENTOV"
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId)
  if (!isAdmin && !isAgendaGestor) throw new Error("Nemáte oprávnenie prideľovať gestora dokumentu")

  // Enforce single gestor: remove all existing, then add new one if specified
  await prisma.documentGestor.deleteMany({ where: { documentId } })
  if (targetUserId !== null) {
    await prisma.documentGestor.create({ data: { userId: targetUserId, documentId } })
  }

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
  const isAdmin = user?.docRole === "SPRAVCA_DOKUMENTOV"
  const isAgendaGestor = user?.agendaGestors.some((g) => g.agendaId === doc.agendaId)
  const isDocGestor = user?.documentGestors.some((g) => g.documentId === documentId)
  if (!isAdmin && !isAgendaGestor && !isDocGestor) return null
  return doc
}

export async function createDocumentAttachment(formData: FormData) {
  const session = await getSession()
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

  if (file && file.size > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "docs")
    await mkdir(uploadDir, { recursive: true })
    const ext = path.extname(file.name)
    const storedName = `${randomUUID()}${ext}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(uploadDir, storedName), Buffer.from(bytes))
    filePath = storedName
    fileName = file.name
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
    },
  })

  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${documentId}`)
  return { success: true }
}

export async function updateDocumentAttachment(formData: FormData) {
  const session = await getSession()
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

  if (removeFile) {
    if (filePath) {
      const fullPath = path.join(process.cwd(), "uploads", "docs", filePath)
      await unlink(fullPath).catch(() => {})
    }
    filePath = null
    fileName = null
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
  }

  await prisma.documentAttachment.update({
    where: { id: attachmentId },
    data: {
      znacka,
      nazov,
      confidentiality: confidentiality as "VEREJNY" | "INTERNI" | "DOVERNI",
      filePath,
      fileName,
    },
  })

  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${attachment.documentId}`)
  return { success: true }
}

export async function grantAttachmentAccess(attachmentId: number, targetUserId: number) {
  const session = await getSession()
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
  const session = await getSession()
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
  const session = await getSession()
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
  revalidatePath(`/dashboard/dokumenty/${doc.agendaId}/${attachment.documentId}`)
  return { success: true }
}
