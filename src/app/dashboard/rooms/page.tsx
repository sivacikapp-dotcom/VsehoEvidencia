import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import RoomsClient from "./RoomsClient"

export default async function RoomsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (!session.user.roles.includes("SPRAVCA_KARIET")) redirect("/dashboard")

  const [rawRooms, allUsers] = await Promise.all([
    prisma.room.findMany({
      orderBy: { name: "asc" },
      include: {
        assets: {
          where: { removedAt: null },
          include: {
            asset: {
              select: { id: true, type: true, name: true, serialNumber: true, functionStatus: true },
            },
          },
        },
        accesses: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ])

  const rooms = rawRooms.map((r) => ({
    id: r.id,
    name: r.name,
    activeAssetCount: r.assets.length,
    assets: r.assets.map((a) => ({
      id: a.asset.id,
      type: a.asset.type,
      name: a.asset.name,
      serialNumber: a.asset.serialNumber,
      functionStatus: a.asset.functionStatus,
      assignedAt: a.assignedAt.toISOString().split("T")[0],
    })),
    accesses: r.accesses.map((a) => ({
      userId: a.user.id,
      userName: `${a.user.lastName} ${a.user.firstName}`,
    })),
  }))

  return <RoomsClient rooms={rooms} allUsers={allUsers} userId={parseInt(session.user.id)} userName={session.user.name} />
}
