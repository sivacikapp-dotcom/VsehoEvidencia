import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import {
  assetTypeLabels,
  brandLabels,
  usagePlaceLabels,
  functionStatusLabels,
  assetKindLabels,
} from "@/lib/labels"
import type { AssetType, Brand, UsagePlace, FunctionStatus, AssetKind, Role } from "@/generated/prisma/enums"
import UserProtocolPrint from "./UserProtocolPrint"

export default async function UserProtocolPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) notFound()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      assetAssignments: {
        where: { returnedAt: null },
        include: {
          asset: {
            select: {
              id: true,
              type: true,
              name: true,
              brand: true,
              serialNumber: true,
              yearOfManufacture: true,
              kind: true,
              usagePlace: true,
              functionStatus: true,
              acquisitionDate: true,
              publicNote: true,
            },
          },
        },
        orderBy: { assignedAt: "asc" },
      },
    },
  })

  if (!user) notFound()

  const assets = user.assetAssignments.map((a) => ({
    id: a.asset.id,
    type: assetTypeLabels[a.asset.type as AssetType] ?? a.asset.type,
    name: a.asset.name,
    brand: brandLabels[a.asset.brand as Brand] ?? a.asset.brand,
    serialNumber: a.asset.serialNumber,
    yearOfManufacture: a.asset.yearOfManufacture,
    kind: assetKindLabels[a.asset.kind as AssetKind] ?? a.asset.kind,
    usagePlace: usagePlaceLabels[a.asset.usagePlace as UsagePlace] ?? a.asset.usagePlace,
    functionStatus: functionStatusLabels[a.asset.functionStatus as FunctionStatus] ?? a.asset.functionStatus,
    acquisitionDate: a.asset.acquisitionDate ? a.asset.acquisitionDate.toISOString().split("T")[0] : null,
    publicNote: a.asset.publicNote,
    assignedAt: a.assignedAt.toISOString().split("T")[0],
    assignedBy: a.assignedBy,
  }))

  return (
    <UserProtocolPrint
      user={{
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.roles as Role[],
      }}
      assets={assets}
      generatedAt={new Date().toISOString().split("T")[0]}
    />
  )
}
