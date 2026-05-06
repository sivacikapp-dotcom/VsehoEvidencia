import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import UsersClient from "./UsersClient"

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  // TODO: obnoviť na SPRAVCA_KARIET po testovaní

  const rawUsers = await prisma.user.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      supervisor: { select: { id: true, firstName: true, lastName: true } },
      _count: {
        select: {
          assetAssignments: true,
        },
      },
    },
  })

  const users = rawUsers.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    roles: u.roles,
    supervisorId: u.supervisorId,
    supervisorName: u.supervisor
      ? `${u.supervisor.firstName} ${u.supervisor.lastName}`
      : null,
    totalAssignments: u._count.assetAssignments,
  }))

  return <UsersClient users={users} />
}
