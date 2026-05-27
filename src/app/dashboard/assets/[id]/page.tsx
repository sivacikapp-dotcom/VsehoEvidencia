import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import AssetDetailClient from "./AssetDetailClient"
import type { Role, AttachmentVisibility, AssetNoteType } from "@/generated/prisma/enums"
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
  const isRecipient = roles.includes("PRIJEMCA")
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
      notes: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!asset) notFound()

  const currentUserId = parseInt(session.user.id)
  const isCurrentRecipient = isRecipient && asset.recipientAssignments.some(
    a => !a.returnedAt && a.user.id === currentUserId
  )

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

  const allNotes = isAppAdmin ? [] : asset.notes.filter((n) => {
    const nt = n.noteType as AssetNoteType
    if (nt === "PUBLIC") return true
    if (nt === "RECORD") return isManager
    if (nt === "SECURITY") return isSecurityWorker
    return false
  })

  const notes = allNotes.map((n) => ({
    id: n.id,
    noteType: n.noteType as AssetNoteType,
    content: n.content,
    authorRole: n.authorRole,
    createdById: n.createdById,
    createdByName: n.createdByName,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }))

  // Pending confirmations for V_procese assets
  const pendingNotificationsRaw = asset.allocationStatus === "V_procese"
    ? await prisma.notification.findMany({
        where: { assetId, mustAcknowledge: true, acknowledgedAt: null },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      })
    : []
  const pendingConfirmations = pendingNotificationsRaw.map((n) => ({
    type: n.type as "ASSET_ASSIGNED" | "ASSET_RETURNED",
    userName: `${n.user.firstName} ${n.user.lastName}`,
  }))

  const H = HIDDEN
  return (
    <AssetDetailClient
      backHref={backHref}
      pendingConfirmations={pendingConfirmations}
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
      isCurrentRecipient={!isAppAdmin && isCurrentRecipient}
      userId={currentUserId}
      attachments={isAppAdmin ? [] : attachments}
      notes={notes}
    />
  )
}
