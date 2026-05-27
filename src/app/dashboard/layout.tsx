import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import Navbar from "@/components/Navbar"
import BlockingNotificationModal from "@/components/BlockingNotificationModal"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const userId = parseInt(session.user.id)

  const [blockingRaw, softRaw] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, mustAcknowledge: true, acknowledgedAt: null },
      include: { asset: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.notification.findMany({
      where: { userId, mustAcknowledge: false, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  const blockingNotifications = blockingRaw.map((n) => ({
    id: n.id,
    type: n.type as "ASSET_ASSIGNED" | "ASSET_RETURNED",
    title: n.title,
    message: n.message,
    createdAt: n.createdAt.toLocaleDateString("sk-SK", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }),
    asset: n.asset ? { id: n.asset.id, name: n.asset.name, type: n.asset.type } : null,
    createdByUserId: n.createdByUserId,
  }))

  const softNotifications = softRaw.map((n) => ({
    id: n.id,
    type: n.type as string,
    title: n.title,
    message: n.message,
    createdAt: n.createdAt.toLocaleString("sk-SK", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }),
    assetId: n.assetId,
    travelOrderId: n.travelOrderId,
    documentId: n.documentId,
  }))

  const user = {
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    roles: session.user.roles,
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {blockingNotifications.length > 0 && (
        <BlockingNotificationModal notifications={blockingNotifications} />
      )}
      <Sidebar user={{ roles: session.user.roles }} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar user={user} notifications={softNotifications} />
        <main className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
