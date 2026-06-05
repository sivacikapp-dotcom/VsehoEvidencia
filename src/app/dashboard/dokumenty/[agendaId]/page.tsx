import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import DocumentsClient from "./DocumentsClient"

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ agendaId: string }>
}) {
  const { agendaId: agendaIdStr } = await params
  const agendaId = parseInt(agendaIdStr)
  if (isNaN(agendaId)) notFound()

  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const userId = parseInt(session.user.id)

  const [agenda, userDoc, allUsers, gestorUsers] = await Promise.all([
    prisma.agenda.findUnique({
      where: { id: agendaId },
      include: {
        gestors: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
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
      where: { roles: { has: "GESTOR_AGENDY" } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.user.findMany({
      where: { isAdminAccount: false, roles: { has: "GESTOR_DOKUMENTU" } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ])

  if (!agenda) notFound()

  const roles = (session.user as { roles?: string[] }).roles ?? []
  const isAdmin = userDoc?.roles.includes("SPRAVCA_DOKUMENTOV") ?? false
  const isAgendaGestor = userDoc?.agendaGestors.some((g) => g.agendaId === agendaId) ?? false
  const isAppAdmin = roles.includes("SPRAVCA_APLIKACIE") && !isAdmin && !isAgendaGestor
  const docGestorIds = new Set(!isAppAdmin ? (userDoc?.documentGestors.map((g) => g.documentId) ?? []) : [])
  const accessIds = new Set(!isAppAdmin ? (userDoc?.documentAccesses.map((g) => g.documentId) ?? []) : [])
  const myAttachmentAccessIds = new Set(!isAppAdmin ? (userDoc?.attachmentAccesses.map((a) => a.attachmentId) ?? []) : [])

  const rawDocs = await prisma.document.findMany({
    where: { agendaId, isLatest: true },
    orderBy: [{ znacka: "asc" }, { nazov: "asc" }],
    include: {
      gestors: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      attachments: { select: { id: true, confidentiality: true } },
    },
  })

  const documents = rawDocs.map((doc) => {
    const hasDirectAccess =
      doc.confidentiality !== "DOVERNI" ||
      isAdmin || isAgendaGestor ||
      docGestorIds.has(doc.id) || accessIds.has(doc.id)
    const hasAnyAttachmentAccess = !isAppAdmin && doc.attachments.some(
      a => a.confidentiality !== "DOVERNI" || myAttachmentAccessIds.has(a.id)
    )
    const attachmentOnlyAccess = !isAppAdmin && !hasDirectAccess && hasAnyAttachmentAccess
    const canAccess = !isAppAdmin && (hasDirectAccess || attachmentOnlyAccess)

    return {
      id: doc.id,
      znacka: isAppAdmin ? "••••••" : doc.znacka,
      nazov: doc.nazov,
      datumSchvalenia: isAppAdmin ? "••••••" : doc.datumSchvalenia.toISOString().split("T")[0],
      confidentiality: isAppAdmin ? ("VEREJNY" as typeof doc.confidentiality) : doc.confidentiality,
      prilohaName: (isAppAdmin || !canAccess || attachmentOnlyAccess) ? null : doc.prilohaName,
      version: doc.version,
      canEdit: false,
      canDelete: canAccess && !attachmentOnlyAccess && (isAdmin || isAgendaGestor) && !isAppAdmin,
      canAccess,
      attachmentOnlyAccess,
      gestors: (isAppAdmin || !canAccess) ? [] : doc.gestors.map((g) => ({
        id: g.user.id,
        name: `${g.user.firstName} ${g.user.lastName}`,
      })),
    }
  })

  return (
    <div className="flex-1 overflow-auto p-8">
      <DocumentsClient
        agenda={{ id: agenda.id, name: agenda.name }}
        agendaSkratka={agenda.skratka ?? null}
        documents={documents}
        canCreate={(isAdmin || isAgendaGestor) && !isAppAdmin}
        isAdmin={isAdmin}
        isAppAdmin={isAppAdmin}
        allUsers={allUsers.map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
        }))}
        agendaGestors={agenda.gestors.map((g) => ({
          id: g.user.id,
          name: `${g.user.firstName} ${g.user.lastName}`,
        }))}
        agendaGestorIds={new Set(agenda.gestors.map((g) => g.user.id))}
        gestorUsers={gestorUsers.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))}
      />
    </div>
  )
}
