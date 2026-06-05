import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import AgendasClient from "./AgendasClient"

export default async function DokumentyPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const userId = parseInt(session.user.id)

  const [userDoc, agendas] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        roles: true,
        agendaGestors: { select: { agendaId: true } },
      },
    }),
    prisma.agenda.findMany({
      orderBy: { name: "asc" },
      include: {
        documents: { where: { isLatest: true }, select: { id: true } },
        gestors: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    }),
  ])

  const roles = (session.user as { roles?: string[] }).roles ?? []
  const isAdmin = userDoc?.roles.includes("SPRAVCA_DOKUMENTOV") ?? false
  const managedAgendaIds = new Set(userDoc?.agendaGestors.map((g) => g.agendaId) ?? [])
  const isAgendaGestor = managedAgendaIds.size > 0
  const isAppAdmin = roles.includes("SPRAVCA_APLIKACIE") && !isAdmin && !isAgendaGestor

  return (
    <div className="flex-1 overflow-auto p-8">
      <AgendasClient
        agendas={agendas.map((a) => ({
        id: a.id,
        name: a.name,
        skratka: a.skratka ?? null,
        documentCount: a.documents.length,
        gestors: a.gestors.map((g) => ({
          id: g.user.id,
          name: `${g.user.firstName} ${g.user.lastName}`,
        })),
        isMyAgenda: managedAgendaIds.has(a.id),
      }))}
      isAdmin={isAdmin}
      isAppAdmin={isAppAdmin}
    />
    </div>
  )
}
