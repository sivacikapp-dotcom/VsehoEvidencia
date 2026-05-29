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

  const [doc, userDoc, allUsers, gestorUsers] = await Promise.all([
    prisma.document.findUnique({
      where: { id: documentId },
      include: {
        agenda: true,
        gestors: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        accesses: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        attachments: {
          orderBy: [{ parentId: "asc" }, { version: "asc" }],
          include: {
            accesses: {
              select: {
                userId: true,
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
            auxFiles: { orderBy: { createdAt: "asc" } },
          },
        },
        notes: { orderBy: { createdAt: "asc" } },
        auxFiles: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        roles: true,
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
    prisma.user.findMany({
      where: { roles: { has: "GESTOR_DOKUMENTU" } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { lastName: "asc" },
    }),
  ])

  if (!doc || doc.agendaId !== agendaId) notFound()

  const isAdmin = userDoc?.roles.includes("SPRAVCA_DOKUMENTOV") ?? false
  const isAgendaGestor = userDoc?.agendaGestors.some((g) => g.agendaId === agendaId) ?? false
  const isDocGestor = userDoc?.documentGestors.some((g) => g.documentId === documentId) ?? false
  const hasExplicitAccess = userDoc?.documentAccesses.some((g) => g.documentId === documentId) ?? false
  const isAppAdmin = userRoles.includes("SPRAVCA_APLIKACIE") && !isAdmin && !isAgendaGestor && !isDocGestor && !hasExplicitAccess
  const canManageNotes = !isAppAdmin && (isAdmin || isAgendaGestor || isDocGestor)
  const canSeeAuxFiles = !isAppAdmin && (isAdmin || isAgendaGestor || isDocGestor)

  // Draft documents are only accessible to gestors
  const canSeeDraft = !isAppAdmin && (isAdmin || isAgendaGestor || isDocGestor)
  if (doc.status === "DRAFT" && !canSeeDraft) {
    redirect(`/dashboard/dokumenty/${agendaId}`)
  }

  if (doc.confidentiality === "DOVERNI" && !isAppAdmin) {
    const canAccess = isAdmin || isAgendaGestor || isDocGestor || hasExplicitAccess
    if (!canAccess) redirect(`/dashboard/dokumenty/${agendaId}`)
  }

  const canEdit = !isAppAdmin && (isAdmin || isAgendaGestor || isDocGestor)
  const canManageAccess = !isAppAdmin && (isAdmin || isAgendaGestor || isDocGestor)
  const canManageGestors = !isAppAdmin && (isAdmin || isAgendaGestor)

  // Version history — drafts only visible to gestors
  const rootId = doc.parentId ?? doc.id
  const allVersions = await prisma.document.findMany({
    where: { OR: [{ id: rootId }, { parentId: rootId }] },
    orderBy: { version: "asc" },
    select: { id: true, version: true, znacka: true, datumSchvalenia: true, isLatest: true, nazov: true, status: true },
  })

  const visibleVersions = allVersions.filter((v) =>
    v.status === "PUBLISHED" || canSeeDraft
  )
  const latestDocId = visibleVersions.find((v) => v.isLatest)?.id ?? documentId

  // Check if a draft already exists in this chain (to disable "Create draft" button)
  const hasDraft = allVersions.some((v) => v.status === "DRAFT")
  const draftDocId = allVersions.find((v) => v.status === "DRAFT")?.id ?? null

  const accessUserIds = new Set(doc.accesses.map((a) => a.userId))
  const myAttachmentAccessIds = new Set(userDoc?.attachmentAccesses.map((a) => a.attachmentId) ?? [])
  const nextAttachmentN = doc.attachments.filter((a) => a.isLatest && a.status === "PUBLISHED").length + 1
  const nextZnacka = `${doc.znacka}-P${nextAttachmentN}`

  const baseZnacka = doc.znacka.replace(/_v\d+$/, "")
  const nextDocVersion = doc.version + 1

  const otherUsers = allUsers
    .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email }))

  const HIDDEN = "••••••"

  // Attachment visibility: draft attachments only visible to gestors
  const visibleAttachments = isAppAdmin
    ? []
    : doc.attachments.filter((a) => a.status === "PUBLISHED" || canSeeDraft)

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
          auxFiles: canSeeAuxFiles ? doc.auxFiles.map((f) => ({ id: f.id, storedName: f.storedName, originalName: f.originalName })) : [],
          agendaId: doc.agendaId,
          agendaName: doc.agenda.name,
          version: doc.version,
          isLatest: doc.isLatest,
          status: doc.status,
          gestors: isAppAdmin ? [] : doc.gestors.map((g) => ({
            id: g.user.id,
            name: `${g.user.firstName} ${g.user.lastName}`,
          })),
          accesses: isAppAdmin ? [] : doc.accesses.map((a) => ({
            id: a.userId,
            name: `${a.user.firstName} ${a.user.lastName}`,
            email: a.user.email,
          })),
          attachments: visibleAttachments.map((a) => ({
            id: a.id,
            znacka: a.znacka,
            nazov: a.nazov,
            datumSchvalenia: a.datumSchvalenia.toISOString().split("T")[0],
            datumPrvehoSchvalenia: a.datumPrvehoSchvalenia?.toISOString().split("T")[0] ?? null,
            version: a.version,
            parentId: a.parentId,
            isLatest: a.isLatest,
            status: a.status,
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
            auxFiles: canSeeAuxFiles ? a.auxFiles.map((f) => ({ id: f.id, storedName: f.storedName, originalName: f.originalName })) : [],
          })),
        }}
        versionHistory={visibleVersions.map((v) => ({
          id: v.id,
          version: v.version,
          znacka: isAppAdmin ? HIDDEN : v.znacka,
          nazov: v.nazov,
          datumSchvalenia: isAppAdmin ? HIDDEN : v.datumSchvalenia.toISOString().split("T")[0],
          isLatest: v.isLatest,
          status: v.status,
        }))}
        latestDocId={latestDocId}
        nextDocVersionZnacka={`${baseZnacka}_v${nextDocVersion}`}
        nextZnacka={nextZnacka}
        canEdit={canEdit}
        canManageAccess={canManageAccess}
        canManageGestors={canManageGestors}
        isAdmin={!isAppAdmin && isAdmin}
        isAppAdmin={isAppAdmin}
        hasDraft={hasDraft}
        draftDocId={draftDocId}
        allUsers={isAppAdmin ? [] : otherUsers.map((u) => ({ ...u, hasAccess: accessUserIds.has(u.id) }))}
        allUsersForAttachment={isAppAdmin ? [] : otherUsers}
        gestorUsers={isAppAdmin ? [] : gestorUsers.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email }))}
        notes={canManageNotes ? doc.notes.map((n) => ({
          id: n.id,
          content: n.content,
          createdByName: n.createdByName,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
        })) : []}
        canManageNotes={canManageNotes}
        canSeeAuxFiles={canSeeAuxFiles}
      />
    </div>
  )
}
