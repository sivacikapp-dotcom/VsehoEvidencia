import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import LogsClient from "./LogsClient"

const PAGE_SIZE = 50

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const callerRoles = (session.user as { roles?: string[] })?.roles ?? []
  if (!callerRoles.includes("SPRAVCA_KARIET") && !callerRoles.includes("SPRAVCA_ROLI") && !callerRoles.includes("SPRAVCA_APLIKACIE")) redirect("/dashboard")

  const sp = await searchParams
  const page = Math.max(1, parseInt((sp.page as string) ?? "1", 10) || 1)
  const entityType = (sp.entityType as string) || ""
  const action = (sp.action as string) || ""
  const search = (sp.search as string) || ""

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(action ? { action } : {}),
    ...(search
      ? {
          OR: [
            { entityLabel: { contains: search, mode: "insensitive" as const } },
            { userName: { contains: search, mode: "insensitive" as const } },
            { userEmail: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  const entityTypes = await prisma.auditLog.findMany({
    select: { entityType: true },
    distinct: ["entityType"],
    orderBy: { entityType: "asc" },
  })

  const serialized = logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    userEmail: l.userEmail,
    userName: l.userName,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    entityLabel: l.entityLabel,
    oldData: l.oldData as Record<string, unknown> | null,
    newData: l.newData as Record<string, unknown> | null,
    createdAt: l.createdAt.toLocaleString("sk-SK", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }),
  }))

  return (
    <div className="flex-1 overflow-auto p-8">
      <LogsClient
        logs={serialized}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        filters={{ entityType, action, search }}
        entityTypes={entityTypes.map((e) => e.entityType)}
      />
    </div>
  )
}
