import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import AssetDetailClient from "./AssetDetailClient"
import type { Role, AttachmentVisibility } from "@/generated/prisma/enums"
import { HIDDEN } from "@/lib/appAdmin"

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
  const isAppAdmin = roles.includes("SPRAVCA_APLIKACIE") && !isManager && !isSecurityWorker
  const backHref = isManager || isSecurityWorker || isAppAdmin ? "/dashboard/assets" : "/dashboard/my-assets"

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

  const userRoles = session.user.roles as Role[]
  const allAttachments = await prisma.assetAttachment.findMany({
    where: { assetId },
    orderBy: { createdAt: "desc" },
  })
  const attachments = allAttachments
    .filter((a) => {
      const vis = a.visibility as AttachmentVisibility
      if (vis === "Everyone") return true
      if (vis === "ManagersAndSecurity") return isManager || isSecurityWorker
      if (vis === "OwnRoleOnly") return (a.uploaderRoles as Role[]).some((r) => userRoles.includes(r))
      return false
    })
    .map((a) => ({
      id: a.id,
      originalName: a.originalName,
      storedName: a.storedName,
      size: a.size,
      visibility: a.visibility as AttachmentVisibility,
      uploaderRoles: a.uploaderRoles as string[],
      uploaderName: a.uploaderName,
      createdAt: a.createdAt.toISOString().split("T")[0],
    }))

  const H = HIDDEN
  return (
    <AssetDetailClient
      backHref={backHref}
      asset={{
        id: asset.id,
        version: asset.version,
        type: isAppAdmin ? (H as typeof asset.type) : asset.type,
        name: isAppAdmin ? H : asset.name,
        brand: isAppAdmin ? (H as typeof asset.brand) : asset.brand,
        serialNumber: isAppAdmin ? H : asset.serialNumber,
        usagePlace: isAppAdmin ? (H as typeof asset.usagePlace) : asset.usagePlace,
        yearOfManufacture: isAppAdmin ? null : asset.yearOfManufacture,
        allocationStatus: isAppAdmin ? (H as typeof asset.allocationStatus) : asset.allocationStatus,
        functionStatus: isAppAdmin ? (H as typeof asset.functionStatus) : asset.functionStatus,
        kind: isAppAdmin ? (H as typeof asset.kind) : asset.kind,
        acquisitionDate: isAppAdmin ? null : (asset.acquisitionDate ? asset.acquisitionDate.toISOString().split("T")[0] : null),
        publicNote: isAppAdmin ? null : asset.publicNote,
        recordNote: !isAppAdmin && isManager ? asset.recordNote : null,
        securityNote: !isAppAdmin && isSecurityWorker ? asset.securityNote : null,
        isSecurity: isAppAdmin ? false : asset.isSecurity,
        createdAt: asset.createdAt.toISOString().split("T")[0],
        bpVDomene: null,
        bpNazovVDomene: null,
        bpAktualizovanyDna: null,
        bpEset: null,
        bpImei1: !isAppAdmin && isSecurityWorker ? asset.bpImei1 : null,
        bpImei2: !isAppAdmin && isSecurityWorker ? asset.bpImei2 : null,
        bpPodporovanyDo: null,
        bpTelefonneCislo: null,
        bpPovolenyVDomene: null,
      }}
      recipientHistory={isAppAdmin ? [] : asset.recipientAssignments.map((a) => ({
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
      roomHistory={isAppAdmin ? [] : asset.roomAssignments.map((a) => ({
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
      isManager={!isAppAdmin && isManager}
      isSecurityWorker={!isAppAdmin && isSecurityWorker}
      isAppAdmin={isAppAdmin}
      userId={parseInt(session.user.id)}
      attachments={isAppAdmin ? [] : attachments}
    />
  )
}
