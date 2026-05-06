import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import BlockingNotificationModal from "@/components/BlockingNotificationModal"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const userId = parseInt(session.user.id)

  const blockingRaw = await prisma.notification.findMany({
    where: { userId, mustAcknowledge: true, acknowledgedAt: null },
    include: { asset: { select: { id: true, name: true, type: true } } },
    orderBy: { createdAt: "asc" },
  })

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
  }))

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {blockingNotifications.length > 0 && (
        <BlockingNotificationModal notifications={blockingNotifications} />
      )}
      <Sidebar
        user={{
          name: session.user.name ?? "",
          email: session.user.email ?? "",
          roles: session.user.roles,
        }}
      />
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
