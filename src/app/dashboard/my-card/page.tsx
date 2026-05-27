import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import MyCardClient from "./MyCardClient"

export default async function MyCardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const userId = parseInt(session.user.id)
  const isNadriadeny = session.user.roles.includes("NADRIADENY")

  const [rawAssignments, rawRoomAccesses] = await Promise.all([
    prisma.assetRecipientAssignment.findMany({
      where: { userId },
      orderBy: { assignedAt: "desc" },
      include: {
        asset: {
          select: {
            id: true,
            type: true,
            name: true,
            brand: true,
            serialNumber: true,
            yearOfManufacture: true,
            usagePlace: true,
            functionStatus: true,
            kind: true,
            acquisitionDate: true,
            notes: {
              where: { noteType: "PUBLIC" },
              orderBy: { createdAt: "asc" as const },
              select: { id: true, content: true, createdByName: true },
            },
          },
        },
      },
    }),
    prisma.userRoomAccess.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            assets: {
              where: { removedAt: null },
              orderBy: { assignedAt: "asc" },
              include: {
                asset: {
                  select: {
                    id: true,
                    type: true,
                    name: true,
                    brand: true,
                    serialNumber: true,
                    functionStatus: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { roomId: "asc" },
    }),
  ])

  const assignments = rawAssignments.map((a) => ({
    id: a.id,
    assetId: a.asset.id,
    assetType: a.asset.type,
    assetName: a.asset.name,
    assetBrand: a.asset.brand,
    serialNumber: a.asset.serialNumber,
    yearOfManufacture: a.asset.yearOfManufacture,
    usagePlace: a.asset.usagePlace,
    functionStatus: a.asset.functionStatus,
    publicNotes: a.asset.notes,
    kind: a.asset.kind,
    acquisitionDate: a.asset.acquisitionDate ? a.asset.acquisitionDate.toISOString().split("T")[0] : null,
    assignedAt: a.assignedAt.toISOString().split("T")[0],
    assignedBy: a.assignedBy,
    assignmentNote: a.assignmentNote,
    returnedAt: a.returnedAt ? a.returnedAt.toISOString().split("T")[0] : null,
    returnedTo: a.returnedTo,
    returnNote: a.returnNote,
    isCurrent: !a.returnedAt,
  }))

  const roomAccesses = rawRoomAccesses.map((ra) => ({
    roomId: ra.room.id,
    roomName: ra.room.name,
    assets: ra.room.assets.map((a) => ({
      id: a.asset.id,
      type: a.asset.type,
      name: a.asset.name,
      brand: a.asset.brand,
      serialNumber: a.asset.serialNumber,
      functionStatus: a.asset.functionStatus,
      assignedAt: a.assignedAt.toISOString().split("T")[0],
    })),
  }))

  const subordinates = isNadriadeny
    ? await prisma.user.findMany({
        where: { supervisorId: userId },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { lastName: "asc" },
      })
    : []

  return (
    <div className="flex-1 overflow-auto p-8">
      <MyCardClient
        userName={session.user.name}
        userEmail={session.user.email}
        userRoles={session.user.roles}
        assignments={assignments}
        roomAccesses={roomAccesses}
        userId={userId}
        subordinates={subordinates}
      />
    </div>
  )
}
