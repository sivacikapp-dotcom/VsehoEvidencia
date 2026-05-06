"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert, Package, RotateCcw, CheckCircle2, Loader2 } from "lucide-react"
import { acknowledgeNotifications } from "@/app/dashboard/notifications/actions"

type BlockingNotification = {
  id: number
  type: "ASSET_ASSIGNED" | "ASSET_RETURNED"
  title: string
  message: string
  createdAt: string
  asset: { id: number; name: string; type: string } | null
}

export default function BlockingNotificationModal({
  notifications,
}: {
  notifications: BlockingNotification[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleAcknowledge() {
    setPending(true)
    setError("")
    const result = await acknowledgeNotifications(notifications.map((n) => n.id))
    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
            <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Potvrdenie zmien
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Pre pokračovanie musíte potvrdiť nasledujúce zmeny
            </p>
          </div>
        </div>

        {/* Notifications list */}
        <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 ${
                n.type === "ASSET_ASSIGNED"
                  ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                  : "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 shrink-0 ${
                    n.type === "ASSET_ASSIGNED"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}
                >
                  {n.type === "ASSET_ASSIGNED" ? (
                    <Package size={16} />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      n.type === "ASSET_ASSIGNED"
                        ? "text-blue-800 dark:text-blue-300"
                        : "text-orange-800 dark:text-orange-300"
                    }`}
                  >
                    {n.title}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{n.createdAt}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {notifications.length === 1 ? "1 zmena vyžaduje potvrdenie" : `${notifications.length} zmeny vyžadujú potvrdenie`}
            </p>
          )}
          <button
            onClick={handleAcknowledge}
            disabled={pending}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CheckCircle2 size={15} />
            )}
            {pending ? "Potvrdzujem..." : "Potvrdiť a pokračovať"}
          </button>
        </div>
      </div>
    </div>
  )
}
