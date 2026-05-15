import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import {
  assetTypeLabels,
  brandLabels,
  usagePlaceLabels,
  functionStatusLabels,
  assetKindLabels,
} from "@/lib/labels"
import type { AssetType, Brand, UsagePlace, FunctionStatus, AssetKind } from "@/generated/prisma/enums"
import ProtocolPrint from "./ProtocolPrint"

export default async function ProtocolPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const assetId = parseInt(id)
  if (isNaN(assetId)) notFound()

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      recipientAssignments: {
        where: { returnedAt: null },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { assignedAt: "desc" },
        take: 1,
      },
    },
  })

  if (!asset) notFound()

  const a = asset.recipientAssignments[0] ?? null

  return (
    <ProtocolPrint
      asset={{
        id: asset.id,
        type: assetTypeLabels[asset.type as AssetType] ?? asset.type,
        name: asset.name,
        brand: brandLabels[asset.brand as Brand] ?? asset.brand,
        serialNumber: asset.serialNumber,
        usagePlace: usagePlaceLabels[asset.usagePlace as UsagePlace] ?? asset.usagePlace,
        yearOfManufacture: asset.yearOfManufacture,
        functionStatus: functionStatusLabels[asset.functionStatus as FunctionStatus] ?? asset.functionStatus,
        kind: assetKindLabels[asset.kind as AssetKind] ?? asset.kind,
        acquisitionDate: asset.acquisitionDate ? asset.acquisitionDate.toISOString().split("T")[0] : null,
      }}
      assignment={
        a
          ? {
              recipientName: `${a.user.firstName} ${a.user.lastName}`,
              recipientEmail: a.user.email,
              assignedAt: a.assignedAt.toISOString().split("T")[0],
              assignedBy: a.assignedBy,
              note: a.assignmentNote,
            }
          : null
      }
      generatedAt={new Date().toISOString().split("T")[0]}
    />
  )
}
