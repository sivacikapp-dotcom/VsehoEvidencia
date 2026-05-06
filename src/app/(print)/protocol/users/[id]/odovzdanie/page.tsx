import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import {
  assetTypeLabels,
  brandLabels,
  functionStatusLabels,
  assetKindLabels,
  usagePlaceLabels,
} from "@/lib/labels"
import type { AssetType, Brand, FunctionStatus, AssetKind, UsagePlace, Role } from "@/generated/prisma/enums"
import OdovzdanieProtocolPrint from "./OdovzdanieProtocolPrint"

export default async function OdovzdanieProtocolPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ids?: string }>
}) {
  const { id } = await params
  const { ids } = await searchParams

  const userId = parseInt(id)
  if (isNaN(userId)) notFound()

  const assetIds = ids
    ? ids.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    : []

  if (assetIds.length === 0) notFound()

  const [user, assignments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, roles: true },
    }),
    prisma.assetRecipientAssignment.findMany({
      where: {
        userId,
        returnedAt: null,
        assetId: { in: assetIds },
      },
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
    }),
  ])

  if (!user) notFound()

  const assets = assignments.map((a) => ({
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
    <OdovzdanieProtocolPrint
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
