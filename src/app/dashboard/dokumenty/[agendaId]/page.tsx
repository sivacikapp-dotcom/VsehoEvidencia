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

  const [agenda, userDoc, allUsers] = await Promise.all([
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
        docRole: true,
        agendaGestors: { select: { agendaId: true } },
        documentGestors: { select: { documentId: true } },
        documentAccesses: { select: { documentId: true } },
      },
    }),
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { lastName: "asc" },
    }),
  ])

  if (!agenda) notFound()

  const isAdmin = userDoc?.docRole === "SPRAVCA_DOKUMENTOV"
  const isAgendaGestor = userDoc?.agendaGestors.some((g) => g.agendaId === agendaId) ?? false
  const docGestorIds = new Set(userDoc?.documentGestors.map((g) => g.documentId) ?? [])
  const accessIds = new Set(userDoc?.documentAccesses.map((g) => g.documentId) ?? [])

  const rawDocs = await prisma.document.findMany({
    where: { agendaId, isLatest: true },
    orderBy: [{ znacka: "asc" }, { nazov: "asc" }],
    include: {
      gestors: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  })

  const documents = rawDocs
    .filter((doc) => {
      if (doc.confidentiality === "VEREJNY") return true
      if (doc.confidentiality === "INTERNI") return true // all logged-in users
      // DOVERNI: admin, agenda gestor, doc gestor, or explicit access
      return isAdmin || isAgendaGestor || docGestorIds.has(doc.id) || accessIds.has(doc.id)
    })
    .map((doc) => ({
      id: doc.id,
      znacka: doc.znacka,
      nazov: doc.nazov,
      datumSchvalenia: doc.datumSchvalenia.toISOString().split("T")[0],
      confidentiality: doc.confidentiality,
      prilohaName: doc.prilohaName,
      version: doc.version,
      canEdit: isAdmin || isAgendaGestor || docGestorIds.has(doc.id),
      canDelete: isAdmin || isAgendaGestor,
      gestors: doc.gestors.map((g) => ({
        id: g.user.id,
        name: `${g.user.firstName} ${g.user.lastName}`,
      })),
    }))

  return (
    <DocumentsClient
      agenda={{ id: agenda.id, name: agenda.name }}
      documents={documents}
      canCreate={isAdmin || isAgendaGestor}
      isAdmin={isAdmin}
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
    />
  )
}
