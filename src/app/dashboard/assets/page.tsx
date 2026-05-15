import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import AssetsClient from "./AssetsClient"
import { HIDDEN } from "@/lib/appAdmin"

export default async function AssetsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const roles = session.user.roles
  const isManager = roles.includes("SPRAVCA_KARIET")
  const isSecurity = roles.includes("BEZPECNOSTNY_PRACOVNIK")
  const isAppAdmin = roles.includes("SPRAVCA_APLIKACIE") && !isManager && !isSecurity
  if (!isManager && !isSecurity && !isAppAdmin) redirect("/dashboard")
  const securityOnly = isSecurity && !isManager && !isAppAdmin

  const rawAssets = await prisma.asset.findMany({
    where: securityOnly ? { isSecurity: true } : undefined,
    orderBy: { id: "asc" },
    include: {
      recipientAssignments: {
        where: { returnedAt: null },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      roomAssignments: {
        where: { removedAt: null },
        include: {
          room: { select: { id: true, name: true } },
        },
      },
    },
  })

  const H = HIDDEN
  const assets = rawAssets.map((a) => ({
    id: a.id,
    type: isAppAdmin ? (H as typeof a.type) : a.type,
    name: isAppAdmin ? H : a.name,
    brand: isAppAdmin ? (H as typeof a.brand) : a.brand,
    serialNumber: isAppAdmin ? H : a.serialNumber,
    usagePlace: isAppAdmin ? (H as typeof a.usagePlace) : a.usagePlace,
    yearOfManufacture: isAppAdmin ? null : a.yearOfManufacture,
    allocationStatus: isAppAdmin ? (H as typeof a.allocationStatus) : a.allocationStatus,
    functionStatus: isAppAdmin ? (H as typeof a.functionStatus) : a.functionStatus,
    kind: isAppAdmin ? (H as typeof a.kind) : a.kind,
    acquisitionDate: isAppAdmin ? null : (a.acquisitionDate ? a.acquisitionDate.toISOString().split("T")[0] : null),
    isSecurity: isAppAdmin ? false : a.isSecurity,
    createdAt: a.createdAt.toISOString(),
    currentRecipient: isAppAdmin ? null : (a.recipientAssignments[0]?.user
      ? {
          id: a.recipientAssignments[0].user.id,
          name: `${a.recipientAssignments[0].user.firstName} ${a.recipientAssignments[0].user.lastName}`,
        }
      : null),
    currentRoom: isAppAdmin ? null : (a.roomAssignments[0]?.room
      ? {
          id: a.roomAssignments[0].room.id,
          name: a.roomAssignments[0].room.name,
        }
      : null),
    bpVDomene: null,
    bpNazovVDomene: null,
    bpAktualizovanyDna: null,
    bpEset: null,
    bpImei1: !isAppAdmin && isSecurity ? a.bpImei1 : null,
    bpImei2: !isAppAdmin && isSecurity ? a.bpImei2 : null,
    bpPodporovanyDo: null,
    bpTelefonneCislo: null,
    bpPovolenyVDomene: null,
  }))

  let users: { id: number; firstName: string; lastName: string; email: string }[] = []
  let rooms: { id: number; name: string }[] = []

  if (isManager) {
    ;[users, rooms] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { lastName: "asc" },
      }),
      prisma.room.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ])
  }

  return (
    <AssetsClient
      assets={assets}
      users={users}
      rooms={rooms}
      userRoles={roles}
      currentUserName={session.user.name ?? ""}
      currentUserId={parseInt(session.user.id)}
      isAppAdmin={isAppAdmin}
    />
  )
}
