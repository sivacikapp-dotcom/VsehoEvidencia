import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import UserCardClient from "./UserCardClient"

export default async function UserCardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const roles = session.user.roles
  const isManager = roles.includes("SPRAVCA_KARIET")
  const isSupervisorRole = roles.includes("NADRIADENY")
  const canViewAll =
    roles.includes("SPRAVCA_ROLI") ||
    roles.includes("SPRAVCA_APLIKACIE") ||
    roles.includes("SPRAVCA_KARIET") ||
    roles.includes("SPRAVCA_PC") ||
    roles.includes("BEZPECNOSTNY_PRACOVNIK")
  const sessionUserId = parseInt(session.user.id)

  // Access control: privileged roles see all; supervisor sees subordinates only
  if (!canViewAll && !isSupervisorRole) redirect("/dashboard")

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) notFound()

  const [user, allRooms] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        supervisor: { select: { firstName: true, lastName: true } },
        assetAssignments: {
          orderBy: { assignedAt: "desc" },
          include: {
            asset: {
              select: {
                id: true,
                type: true,
                name: true,
                serialNumber: true,
                brand: true,
                functionStatus: true,
                allocationStatus: true,
              },
            },
          },
        },
        roomAccesses: {
          include: {
            room: { select: { id: true, name: true } },
          },
        },
      },
    }),
    isManager
      ? prisma.room.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ])

  if (!user) notFound()

  // Supervisor access check: can only view own subordinates
  if (!canViewAll && isSupervisorRole && user.supervisorId !== sessionUserId) {
    redirect("/dashboard")
  }

  const assignments = user.assetAssignments.map((a) => ({
    id: a.id,
    assetId: a.asset.id,
    assetType: a.asset.type,
    assetName: a.asset.name,
    assetBrand: a.asset.brand,
    serialNumber: a.asset.serialNumber,
    functionStatus: a.asset.functionStatus,
    assignedAt: a.assignedAt.toISOString().split("T")[0],
    assignedBy: a.assignedBy,
    assignmentNote: a.assignmentNote,
    returnedAt: a.returnedAt ? a.returnedAt.toISOString().split("T")[0] : null,
    returnedTo: a.returnedTo,
    returnNote: a.returnNote,
    isCurrent: !a.returnedAt,
  }))

  const roomAccesses = user.roomAccesses.map((ra) => ({
    roomId: ra.room.id,
    roomName: ra.room.name,
  }))

  return (
    <UserCardClient
      user={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.roles,
        supervisorName: user.supervisor
          ? `${user.supervisor.firstName} ${user.supervisor.lastName}`
          : null,
      }}
      assignments={assignments}
      roomAccesses={roomAccesses}
      allRooms={isManager ? allRooms : []}
      viewerUserId={parseInt(session.user.id)}
      viewerName={session.user.name}
      isManager={isManager}
      backUrl={canViewAll ? "/dashboard/users" : "/dashboard/my-card"}
    />
  )
}
