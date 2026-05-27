import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  Package, Users, CheckCircle2, CircleDot,
  Bell, FolderOpen, BookOpen, Plane, Clock,
} from "lucide-react"
import DashboardNotifications from "./DashboardNotifications"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const userId = parseInt(session!.user.id)

  const [
    totalAssets, assignedAssets, freeAssets, totalUsers,
    totalAgendas, totalDocuments,
    dismissibleRaw,
  ] = await Promise.all([
    prisma.asset.count(),
    prisma.asset.count({
      where: { allocationStatus: { in: ["Prideleny_Recipient", "Prideleny_Room"] } },
    }),
    prisma.asset.count({ where: { allocationStatus: "Neprideleny_Volny" } }),
    prisma.user.count(),
    prisma.agenda.count(),
    prisma.document.count({ where: { isLatest: true } }),
    prisma.notification.findMany({
      where: { userId, mustAcknowledge: false, dismissedAt: null },
      include: {
        asset: { select: { id: true } },
        document: { select: { id: true, agendaId: true } },
        travelOrder: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const dismissibleNotifications = dismissibleRaw.map((n) => ({
    id: n.id,
    type: n.type as string,
    title: n.title,
    message: n.message,
    createdAt: n.createdAt.toLocaleDateString("sk-SK", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }),
    assetId: n.asset?.id ?? null,
    documentId: n.document?.id ?? null,
    documentAgendaId: n.document?.agendaId ?? null,
    travelOrderId: n.travelOrder?.id ?? null,
  }))

  const hasNotifications = dismissibleNotifications.length > 0

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Vitajte, {session?.user.name}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Prehľad organizácie</p>
      </div>

      {/* ── Notifikácie ── */}
      {hasNotifications && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={14} className="text-gray-500 dark:text-gray-400" />
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Notifikácie
            </h2>
            <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-semibold">
              {dismissibleNotifications.length}
            </span>
          </div>
          <DashboardNotifications notifications={dismissibleNotifications} />
        </section>
      )}

      {/* ── Evidencia majetku ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Package size={14} className="text-gray-500 dark:text-gray-400" />
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Evidencia majetku
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Evidovaný majetok", value: totalAssets, icon: Package, iconBg: "bg-blue-50 dark:bg-blue-900/40", iconColor: "text-blue-600 dark:text-blue-400" },
            { label: "Pridelené", value: assignedAssets, icon: CheckCircle2, iconBg: "bg-green-50 dark:bg-green-900/40", iconColor: "text-green-600 dark:text-green-400" },
            { label: "Voľné", value: freeAssets, icon: CircleDot, iconBg: "bg-amber-50 dark:bg-amber-900/40", iconColor: "text-amber-600 dark:text-amber-400" },
            { label: "Používatelia", value: totalUsers, icon: Users, iconBg: "bg-purple-50 dark:bg-purple-900/40", iconColor: "text-purple-600 dark:text-purple-400" },
          ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <div
              key={label}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4"
            >
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <Icon size={18} className={iconColor} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interné dokumenty ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen size={14} className="text-gray-500 dark:text-gray-400" />
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Interné dokumenty
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Agendy", value: totalAgendas, icon: FolderOpen, iconBg: "bg-indigo-50 dark:bg-indigo-900/40", iconColor: "text-indigo-600 dark:text-indigo-400" },
            { label: "Dokumenty (aktuálne verzie)", value: totalDocuments, icon: BookOpen, iconBg: "bg-cyan-50 dark:bg-cyan-900/40", iconColor: "text-cyan-600 dark:text-cyan-400" },
          ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <div
              key={label}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4"
            >
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <Icon size={18} className={iconColor} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pracovné cesty ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Plane size={14} className="text-gray-500 dark:text-gray-400" />
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Pracovné cesty
          </h2>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/40">
            <Clock size={18} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Štatistiky cestovných príkazov</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Prehľad bude dostupný čoskoro</p>
          </div>
        </div>
      </section>
    </div>
  )
}
