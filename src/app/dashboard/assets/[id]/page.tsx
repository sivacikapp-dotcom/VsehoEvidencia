import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import AssetDetailClient from "./AssetDetailClient"

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const roles = session.user.roles
  const isManager = roles.includes("SPRAVCA_KARIET")
  const isSecurityWorker = roles.includes("BEZPECNOSTNY_PRACOVNIK")
  const backHref = isManager || isSecurityWorker ? "/dashboard/assets" : "/dashboard/my-assets"

  const { id } = await params
  const assetId = parseInt(id)
  if (isNaN(assetId)) notFound()

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      recipientAssignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      roomAssignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          room: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!asset) notFound()

  return (
    <AssetDetailClient
      backHref={backHref}
      asset={{
        id: asset.id,
        type: asset.type,
        name: asset.name,
        brand: asset.brand,
        serialNumber: asset.serialNumber,
        usagePlace: asset.usagePlace,
        yearOfManufacture: asset.yearOfManufacture,
        allocationStatus: asset.allocationStatus,
        functionStatus: asset.functionStatus,
        kind: asset.kind,
        acquisitionDate: asset.acquisitionDate ? asset.acquisitionDate.toISOString().split("T")[0] : null,
        publicNote: asset.publicNote,
        recordNote: isManager ? asset.recordNote : null,
        securityNote: isSecurityWorker ? asset.securityNote : null,
        isSecurity: asset.isSecurity,
        createdAt: asset.createdAt.toISOString().split("T")[0],
        bpVDomene: isSecurityWorker ? asset.bpVDomene : null,
        bpNazovVDomene: isSecurityWorker ? asset.bpNazovVDomene : null,
        bpAktualizovanyDna: isSecurityWorker && asset.bpAktualizovanyDna ? asset.bpAktualizovanyDna.toISOString().split("T")[0] : null,
        bpEset: isSecurityWorker ? asset.bpEset : null,
        bpImei1: isSecurityWorker ? asset.bpImei1 : null,
        bpImei2: isSecurityWorker ? asset.bpImei2 : null,
        bpPodporovanyDo: isSecurityWorker && asset.bpPodporovanyDo ? asset.bpPodporovanyDo.toISOString().split("T")[0] : null,
        bpTelefonneCislo: isSecurityWorker ? asset.bpTelefonneCislo : null,
        bpPovolenyVDomene: isSecurityWorker ? asset.bpPovolenyVDomene : null,
      }}
      recipientHistory={asset.recipientAssignments.map((a) => ({
        id: a.id,
        userName: `${a.user.lastName} ${a.user.firstName}`,
        userEmail: a.user.email,
        assignedAt: a.assignedAt.toISOString().split("T")[0],
        assignedBy: a.assignedBy,
        assignmentNote: a.assignmentNote,
        returnedAt: a.returnedAt ? a.returnedAt.toISOString().split("T")[0] : null,
        returnedTo: a.returnedTo,
        returnNote: a.returnNote,
        isCurrent: !a.returnedAt,
      }))}
      roomHistory={asset.roomAssignments.map((a) => ({
        id: a.id,
        roomName: a.room.name,
        assignedAt: a.assignedAt.toISOString().split("T")[0],
        assignedBy: a.assignedBy,
        assignmentNote: a.assignmentNote,
        removedAt: a.removedAt ? a.removedAt.toISOString().split("T")[0] : null,
        removedBy: a.removedBy,
        removalNote: a.removalNote,
        isCurrent: !a.removedAt,
      }))}
      isManager={isManager}
      isSecurityWorker={isSecurityWorker}
      userId={parseInt(session.user.id)}
    />
  )
}
