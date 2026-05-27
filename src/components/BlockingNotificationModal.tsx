"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert, Package, RotateCcw, CheckCircle2, Loader2, XCircle, X } from "lucide-react"
import { acknowledgeNotifications, rejectNotification } from "@/app/dashboard/notifications/actions"

type BlockingNotification = {
  id: number
  type: "ASSET_ASSIGNED" | "ASSET_RETURNED"
  title: string
  message: string
  createdAt: string
  asset: { id: number; name: string; type: string } | null
  createdByUserId: number | null
}

export default function BlockingNotificationModal({
  notifications,
}: {
  notifications: BlockingNotification[]
}) {
  const router = useRouter()
  const [confirmPending, setConfirmPending] = useState(false)
  const [confirmError, setConfirmError] = useState("")

  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectPending, setRejectPending] = useState(false)
  const [rejectError, setRejectError] = useState("")

  async function handleConfirmAll() {
    const ids = notifications.filter(n => n.id !== rejectingId).map(n => n.id)
    if (ids.length === 0) return
    setConfirmPending(true)
    setConfirmError("")
    const result = await acknowledgeNotifications(ids)
    setConfirmPending(false)
    if (result.error) setConfirmError(result.error)
    else router.refresh()
  }

  function startRejecting(id: number) {
    setRejectingId(id)
    setRejectReason("")
    setRejectError("")
  }

  function cancelRejecting() {
    setRejectingId(null)
    setRejectReason("")
    setRejectError("")
  }

  async function handleReject() {
    if (!rejectingId) return
    if (!rejectReason.trim()) {
      setRejectError("Dôvod odmietnutia je povinný.")
      return
    }
    setRejectPending(true)
    setRejectError("")
    const result = await rejectNotification(rejectingId, rejectReason)
    setRejectPending(false)
    if (result.error) setRejectError(result.error)
    else {
      setRejectingId(null)
      setRejectReason("")
      router.refresh()
    }
  }

  const confirmableCount = notifications.filter(n => n.id !== rejectingId).length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
            <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Potvrdenie zmien</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Pre pokračovanie potvrďte alebo odmietnite nasledujúce zmeny
            </p>
          </div>
        </div>

        {/* Notification list */}
        <div className="px-6 py-4 space-y-3 max-h-[420px] overflow-y-auto">
          {notifications.map((n) => {
            const isAssigned = n.type === "ASSET_ASSIGNED"
            const isRejecting = rejectingId === n.id

            return (
              <div
                key={n.id}
                className={`rounded-lg border bg-white dark:bg-gray-800 overflow-hidden ${
                  isRejecting
                    ? "border-red-300 dark:border-red-700"
                    : isAssigned
                    ? "border-gray-200 dark:border-gray-700"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {/* Accent bar */}
                <div className={`h-1 w-full ${
                  isRejecting
                    ? "bg-red-500"
                    : isAssigned
                    ? "bg-blue-500"
                    : "bg-orange-500"
                }`} />

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 shrink-0 ${
                      isRejecting
                        ? "text-red-500"
                        : isAssigned
                        ? "text-blue-500"
                        : "text-orange-500"
                    }`}>
                      {isRejecting
                        ? <XCircle size={16} />
                        : isAssigned
                        ? <Package size={16} />
                        : <RotateCcw size={16} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {n.title}
                      </p>
                      {/* Message */}
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-snug">
                        {n.message}
                      </p>
                      {/* Date */}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                        {n.createdAt}
                      </p>

                      {/* Rejection form */}
                      {isRejecting ? (
                        <div className="mt-3 space-y-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            Dôvod odmietnutia <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={rejectReason}
                            onChange={e => { setRejectReason(e.target.value); setRejectError("") }}
                            rows={2}
                            maxLength={500}
                            autoFocus
                            placeholder="Napíšte dôvod odmietnutia zmeny..."
                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
                          />
                          {rejectError && (
                            <p className="text-xs text-red-600 dark:text-red-400">{rejectError}</p>
                          )}
                          <div className="flex gap-2 justify-end pt-0.5">
                            <button
                              onClick={cancelRejecting}
                              disabled={rejectPending}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                            >
                              Zrušiť
                            </button>
                            <button
                              onClick={handleReject}
                              disabled={rejectPending || !rejectReason.trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {rejectPending && <Loader2 size={11} className="animate-spin" />}
                              {rejectPending ? "Odosielam..." : "Potvrdiť odmietnutie"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2.5 flex justify-end">
                          <button
                            onClick={() => startRejecting(n.id)}
                            disabled={rejectingId !== null}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                          >
                            <X size={11} />
                            Odmietnuť
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          {confirmError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{confirmError}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {notifications.length === 1
                ? "1 zmena vyžaduje potvrdenie"
                : `${notifications.length} zmeny vyžadujú potvrdenie`}
            </p>
          )}
          <button
            onClick={handleConfirmAll}
            disabled={confirmPending || confirmableCount === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
          >
            {confirmPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            {confirmPending
              ? "Potvrdzujem..."
              : confirmableCount < notifications.length
              ? `Potvrdiť zostatok (${confirmableCount})`
              : "Potvrdiť a pokračovať"}
          </button>
        </div>
      </div>
    </div>
  )
}
