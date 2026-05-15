import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import MyAssetsClient from "./MyAssetsClient"

export default async function MyAssetsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (!session.user.roles.includes("PRIJEMCA")) redirect("/dashboard")

  const userId = parseInt(session.user.id)

  const rawAssignments = await prisma.assetRecipientAssignment.findMany({
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
          allocationStatus: true,
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
  })

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

  return (
    <MyAssetsClient
      assignments={assignments}
      userName={session.user.name ?? ""}
      userId={userId}
    />
  )
}
