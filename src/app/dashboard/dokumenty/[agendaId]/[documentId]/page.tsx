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
  const userRoles = (session.user as { roles?: string[] }).roles ?? []

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
  const isAppAdmin = userRoles.includes("SPRAVCA_APLIKACIE") && !isAdmin && !isAgendaGestor && !isDocGestor && !hasExplicitAccess

  if (doc.confidentiality === "DOVERNI" && !isAppAdmin) {
    const canAccess = isAdmin || isAgendaGestor || isDocGestor || hasExplicitAccess
    if (!canAccess) redirect(`/dashboard/dokumenty/${agendaId}`)
  }

  const canEdit = !isAppAdmin && (isAdmin || isAgendaGestor || isDocGestor)
  const canManageAccess = !isAppAdmin && (isAdmin || isAgendaGestor || isDocGestor)
  const canManageGestors = !isAppAdmin && (isAdmin || isAgendaGestor)

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

  const HIDDEN = "••••••"

  return (
    <div className="flex-1 overflow-auto p-8">
      <DocumentDetailClient
        document={{
          id: doc.id,
        znacka: isAppAdmin ? HIDDEN : doc.znacka,
        nazov: doc.nazov,
        datumSchvalenia: isAppAdmin ? HIDDEN : doc.datumSchvalenia.toISOString().split("T")[0],
        datumPrvehoSchvalenia: isAppAdmin ? null : (doc.datumPrvehoSchvalenia?.toISOString().split("T")[0] ?? null),
        confidentiality: isAppAdmin ? "VEREJNY" : doc.confidentiality,
        prilohaPath: isAppAdmin ? null : doc.prilohaPath,
        prilohaName: isAppAdmin ? null : doc.prilohaName,
        agendaId: doc.agendaId,
        agendaName: doc.agenda.name,
        version: doc.version,
        isLatest: doc.isLatest,
        gestors: isAppAdmin ? [] : doc.gestors.map((g) => ({
          id: g.user.id,
          name: `${g.user.firstName} ${g.user.lastName}`,
        })),
        accesses: isAppAdmin ? [] : doc.accesses.map((a) => ({
          id: a.userId,
          name: `${a.user.firstName} ${a.user.lastName}`,
          email: a.user.email,
        })),
        attachments: isAppAdmin ? [] : doc.attachments.map((a) => ({
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
        znacka: isAppAdmin ? HIDDEN : v.znacka,
        nazov: v.nazov,
        datumSchvalenia: isAppAdmin ? HIDDEN : v.datumSchvalenia.toISOString().split("T")[0],
        isLatest: v.isLatest,
      }))}
      latestDocId={latestDocId}
      nextDocVersionZnacka={`${baseZnacka}_v${nextDocVersion}`}
      nextZnacka={nextZnacka}
      canEdit={canEdit}
      canManageAccess={canManageAccess}
      canManageGestors={canManageGestors}
      isAdmin={!isAppAdmin && isAdmin}
      isAppAdmin={isAppAdmin}
      allUsers={isAppAdmin ? [] : otherUsers.map((u) => ({ ...u, hasAccess: accessUserIds.has(u.id) }))}
      allUsersForAttachment={isAppAdmin ? [] : otherUsers}
      />
    </div>
  )
}
