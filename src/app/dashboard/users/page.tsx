import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import UsersClient from "./UsersClient"

const userInclude = {
  supervisor: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { assetAssignments: true } },
} as const

function mapUser(u: {
  id: number; firstName: string; lastName: string; email: string
  roles: string[]; supervisorId: number | null
  supervisor: { firstName: string; lastName: string } | null
  _count: { assetAssignments: number }
}) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    roles: u.roles as import("@/generated/prisma/enums").Role[],
    supervisorId: u.supervisorId,
    supervisorName: u.supervisor
      ? `${u.supervisor.firstName} ${u.supervisor.lastName}`
      : null,
    totalAssignments: u._count.assetAssignments,
  }
}

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const sessionUserId = parseInt(session.user.id)
  const roles = (session.user as { roles: string[] }).roles

  const isRoleManager = roles.includes("SPRAVCA_APLIKACIE")
  const isAppAdmin = roles.includes("SPRAVCA_APLIKACIE")
  const canViewAll =
    isRoleManager ||
    isAppAdmin ||
    roles.includes("SPRAVCA_MAJETKU") ||
    roles.includes("SPRAVCA_PRACOVNYCH_CIEST") ||
    roles.includes("BEZPECNOSTNY_PRACOVNIK")

  let rawUsers
  if (canViewAll) {
    rawUsers = await prisma.user.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: userInclude,
    })
  } else {
    // Regular users: see only themselves + their supervisor + their subordinates
    const me = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { supervisorId: true },
    })
    const subordinateIds = (
      await prisma.user.findMany({
        where: { supervisorId: sessionUserId },
        select: { id: true },
      })
    ).map((s) => s.id)

    const relatedIds = [sessionUserId, ...subordinateIds]
    if (me?.supervisorId) relatedIds.push(me.supervisorId)

    rawUsers = await prisma.user.findMany({
      where: { id: { in: relatedIds } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: userInclude,
    })
  }

  const users = rawUsers.map(mapUser)

  return (
    <div className="flex-1 overflow-auto p-8">
      <UsersClient users={users} canManage={isRoleManager || isAppAdmin} />
    </div>
  )
}
