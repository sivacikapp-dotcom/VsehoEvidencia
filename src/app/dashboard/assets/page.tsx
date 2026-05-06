import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import AssetsClient from "./AssetsClient"

export default async function AssetsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const roles = session.user.roles
  const isManager = roles.includes("SPRAVCA_KARIET")
  const isSecurity = roles.includes("BEZPECNOSTNY_PRACOVNIK")
  if (!isManager && !isSecurity) redirect("/dashboard")
  const securityOnly = isSecurity && !isManager

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

  const assets = rawAssets.map((a) => ({
    id: a.id,
    type: a.type,
    name: a.name,
    brand: a.brand,
    serialNumber: a.serialNumber,
    usagePlace: a.usagePlace,
    yearOfManufacture: a.yearOfManufacture,
    allocationStatus: a.allocationStatus,
    functionStatus: a.functionStatus,
    publicNote: a.publicNote,
    kind: a.kind,
    acquisitionDate: a.acquisitionDate ? a.acquisitionDate.toISOString().split("T")[0] : null,
    recordNote: a.recordNote,
    securityNote: a.securityNote,
    isSecurity: a.isSecurity,
    createdAt: a.createdAt.toISOString(),
    currentRecipient: a.recipientAssignments[0]?.user
      ? {
          id: a.recipientAssignments[0].user.id,
          name: `${a.recipientAssignments[0].user.firstName} ${a.recipientAssignments[0].user.lastName}`,
        }
      : null,
    currentRoom: a.roomAssignments[0]?.room
      ? {
          id: a.roomAssignments[0].room.id,
          name: a.roomAssignments[0].room.name,
        }
      : null,
    bpVDomene: isSecurity ? a.bpVDomene : null,
    bpNazovVDomene: isSecurity ? a.bpNazovVDomene : null,
    bpAktualizovanyDna: isSecurity && a.bpAktualizovanyDna ? a.bpAktualizovanyDna.toISOString().split("T")[0] : null,
    bpEset: isSecurity ? a.bpEset : null,
    bpImei1: isSecurity ? a.bpImei1 : null,
    bpImei2: isSecurity ? a.bpImei2 : null,
    bpPodporovanyDo: isSecurity && a.bpPodporovanyDo ? a.bpPodporovanyDo.toISOString().split("T")[0] : null,
    bpTelefonneCislo: isSecurity ? a.bpTelefonneCislo : null,
    bpPovolenyVDomene: isSecurity ? a.bpPovolenyVDomene : null,
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
    />
  )
}
