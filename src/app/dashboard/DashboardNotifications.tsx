"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, X, ExternalLink, CheckCircle2, Loader2, FileText, Plane } from "lucide-react"
import { dismissNotification, acceptNotification } from "./notifications/actions"

type DismissibleNotification = {
  id: number
  type: string
  title: string
  message: string
  createdAt: string
  assetId: number | null
  documentId: number | null
  documentAgendaId: number | null
  travelOrderId: number | null
}

const CONFIRM_TYPES = new Set(["ASSET_CHANGED", "DOCUMENT_ADDED", "DOCUMENT_DELETED"])

export default function DashboardNotifications({
  notifications,
}: {
  notifications: DismissibleNotification[]
}) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [confirming, setConfirming] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleDismiss(id: number, type: string) {
    if (CONFIRM_TYPES.has(type)) {
      setConfirming(id)
      setError("")
      return
    }
    setDismissed((prev) => new Set(prev).add(id))
    await dismissNotification(id)
    router.refresh()
  }

  async function handleConfirm() {
    if (confirming === null) return
    setPending(true)
    setError("")
    const result = await acceptNotification(confirming)
    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setDismissed((prev) => new Set(prev).add(confirming))
      setConfirming(null)
      router.refresh()
    }
  }

  const visible = notifications.filter((n) => !dismissed.has(n.id))
  if (visible.length === 0) return null

  const confirmingNotification = confirming !== null ? notifications.find((n) => n.id === confirming) : null

  return (
    <>
      {confirmingNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                <CheckCircle2 size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Potvrdenie zmeny
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Potvrďte, že ste oboznámený so zmenou
                </p>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  {confirmingNotification.title}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-line">
                  {confirmingNotification.message}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {confirmingNotification.createdAt}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              ) : (
                <button
                  onClick={() => { setConfirming(null); setError("") }}
                  disabled={pending}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-60"
                >
                  Zrušiť
                </button>
              )}
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                {pending ? "Potvrdzujem..." : "Potvrdiť zmenu"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((n) => {
          const isDocType = n.type === "DOCUMENT_ADDED" || n.type === "DOCUMENT_DELETED"
          const isTravelType = n.type.startsWith("TRAVEL_ORDER") || n.type.startsWith("EXPENSE_REPORT")
          return (
            <div
              key={n.id}
              className="flex items-start gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3"
            >
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                isDocType ? "bg-purple-50 dark:bg-purple-900/30"
                : isTravelType ? "bg-teal-50 dark:bg-teal-900/30"
                : "bg-blue-50 dark:bg-blue-900/30"
              }`}>
                {isDocType
                  ? <FileText size={13} className="text-purple-600 dark:text-purple-400" />
                  : isTravelType
                  ? <Plane size={13} className="text-teal-600 dark:text-teal-400" />
                  : <Bell size={13} className="text-blue-600 dark:text-blue-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 whitespace-pre-line">{n.message}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{n.createdAt}</span>
                  {n.assetId && (
                    <Link
                      href={`/dashboard/assets/${n.assetId}`}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink size={11} />
                      Zobraziť majetok
                    </Link>
                  )}
                  {n.documentId && n.documentAgendaId && (
                    <Link
                      href={`/dashboard/dokumenty/${n.documentAgendaId}/${n.documentId}`}
                      className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      <ExternalLink size={11} />
                      Zobraziť dokument
                    </Link>
                  )}
                  {n.travelOrderId && (
                    <Link
                      href={`/dashboard/pracovne-cesty/${n.travelOrderId}`}
                      className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      <ExternalLink size={11} />
                      Zobraziť príkaz
                    </Link>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDismiss(n.id, n.type)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md shrink-0"
                title={CONFIRM_TYPES.has(n.type) ? "Potvrdiť a zavrieť" : "Zavrieť"}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
