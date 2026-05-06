import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import DocumentDetailClient from "./DocumentDetailClient"

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ agendaId: string; documentId: string }>
}) {
  const { agendaId: agendaIdStr, documentId: documentIdStr } = await params
  const agendaId = parseInt(agendaIdStr)
  const documentId = parseInt(documentIdStr)
  if (isNaN(agendaId) || isNaN(documentId)) notFound()

  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const userId = parseInt(session.user.id)

  const [doc, userDoc, allUsers] = await Promise.all([
    prisma.document.findUnique({
      where: { id: documentId },
      include: {
        agenda: true,
        gestors: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        accesses: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        // All attachment versions for this document version
        attachments: {
          orderBy: [{ parentId: "asc" }, { version: "asc" }],
          include: {
            accesses: {
              select: {
                userId: true,
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        docRole: true,
        agendaGestors: { select: { agendaId: true } },
        documentGestors: { select: { documentId: true } },
        documentAccesses: { select: { documentId: true } },
        attachmentAccesses: { select: { attachmentId: true } },
      },
    }),
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { lastName: "asc" },
    }),
  ])

  if (!doc || doc.agendaId !== agendaId) notFound()

  const isAdmin = userDoc?.docRole === "SPRAVCA_DOKUMENTOV"
  const isAgendaGestor = userDoc?.agendaGestors.some((g) => g.agendaId === agendaId) ?? false
  const isDocGestor = userDoc?.documentGestors.some((g) => g.documentId === documentId) ?? false
  const hasExplicitAccess = userDoc?.documentAccesses.some((g) => g.documentId === documentId) ?? false

  if (doc.confidentiality === "DOVERNI") {
    const canAccess = isAdmin || isAgendaGestor || isDocGestor || hasExplicitAccess
    if (!canAccess) redirect(`/dashboard/dokumenty/${agendaId}`)
  }

  const canEdit = isAdmin || isAgendaGestor || isDocGestor
  const canManageAccess = isAdmin || isAgendaGestor || isDocGestor
  const canManageGestors = isAdmin || isAgendaGestor

  // Version history
  const rootId = doc.parentId ?? doc.id
  const allVersions = await prisma.document.findMany({
    where: { OR: [{ id: rootId }, { parentId: rootId }] },
    orderBy: { version: "asc" },
    select: { id: true, version: true, znacka: true, datumSchvalenia: true, isLatest: true, nazov: true },
  })
  const latestDocId = allVersions.find((v) => v.isLatest)?.id ?? documentId

  const accessUserIds = new Set(doc.accesses.map((a) => a.userId))
  const myAttachmentAccessIds = new Set(userDoc?.attachmentAccesses.map((a) => a.attachmentId) ?? [])
  const nextAttachmentN = doc.attachments.filter((a) => a.isLatest).length + 1
  const nextZnacka = `${doc.znacka}-P${nextAttachmentN}`

  // Base znacka for new version suggestion (strip _vN suffix)
  const baseZnacka = doc.znacka.replace(/_v\d+$/, "")
  const nextDocVersion = doc.version + 1

  const otherUsers = allUsers
    .filter((u) => u.id !== userId)
    .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email }))

  return (
    <DocumentDetailClient
      document={{
        id: doc.id,
        znacka: doc.znacka,
        nazov: doc.nazov,
        datumSchvalenia: doc.datumSchvalenia.toISOString().split("T")[0],
        datumPrvehoSchvalenia: doc.datumPrvehoSchvalenia?.toISOString().split("T")[0] ?? null,
        confidentiality: doc.confidentiality,
        prilohaPath: doc.prilohaPath,
        prilohaName: doc.prilohaName,
        agendaId: doc.agendaId,
        agendaName: doc.agenda.name,
        version: doc.version,
        isLatest: doc.isLatest,
        gestors: doc.gestors.map((g) => ({
          id: g.user.id,
          name: `${g.user.firstName} ${g.user.lastName}`,
        })),
        accesses: doc.accesses.map((a) => ({
          id: a.userId,
          name: `${a.user.firstName} ${a.user.lastName}`,
          email: a.user.email,
        })),
        attachments: doc.attachments.map((a) => ({
          id: a.id,
          znacka: a.znacka,
          nazov: a.nazov,
          datumSchvalenia: a.datumSchvalenia.toISOString().split("T")[0],
          datumPrvehoSchvalenia: a.datumPrvehoSchvalenia?.toISOString().split("T")[0] ?? null,
          version: a.version,
          parentId: a.parentId,
          isLatest: a.isLatest,
          confidentiality: a.confidentiality,
          filePath: a.filePath,
          fileName: a.fileName,
          canDownload: canEdit || a.confidentiality !== "DOVERNI" || myAttachmentAccessIds.has(a.id),
          accessUserIds: canEdit ? a.accesses.map((ac) => ac.userId) : [],
          accessUsers: canEdit
            ? a.accesses.map((ac) => ({
                id: ac.user.id,
                name: `${ac.user.firstName} ${ac.user.lastName}`,
                email: ac.user.email,
              }))
            : [],
        })),
      }}
      versionHistory={allVersions.map((v) => ({
        id: v.id,
        version: v.version,
        znacka: v.znacka,
        nazov: v.nazov,
        datumSchvalenia: v.datumSchvalenia.toISOString().split("T")[0],
        isLatest: v.isLatest,
      }))}
      latestDocId={latestDocId}
      nextDocVersionZnacka={`${baseZnacka}_v${nextDocVersion}`}
      nextZnacka={nextZnacka}
      canEdit={canEdit}
      canManageAccess={canManageAccess}
      canManageGestors={canManageGestors}
      isAdmin={isAdmin}
      allUsers={otherUsers.map((u) => ({ ...u, hasAccess: accessUserIds.has(u.id) }))}
      allUsersForAttachment={otherUsers}
    />
  )
}
