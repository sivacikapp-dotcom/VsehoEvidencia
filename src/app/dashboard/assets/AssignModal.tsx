"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2, User, Building2, AlertCircle } from "lucide-react"
import { assignAsset } from "./actions"
import { allocationStatusLabels } from "@/lib/labels"
import type { AllocationStatus } from "@/generated/prisma/enums"

interface Asset {
  id: number
  name: string
  serialNumber: string | null
  allocationStatus: AllocationStatus
  currentRecipient: { id: number; name: string } | null
  currentRoom: { id: number; name: string } | null
}

interface Props {
  asset: Asset
  users: { id: number; firstName: string; lastName: string; email: string }[]
  rooms: { id: number; name: string }[]
  currentUserName: string
  onClose: () => void
}

type Tab = "recipient" | "room"

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

export default function AssignModal({
  asset,
  users,
  rooms,
  currentUserName,
  onClose,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("recipient")
  const [selectedId, setSelectedId] = useState<string>("")
  const [note, setNote] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  const isAssigned =
    asset.allocationStatus === "Prideleny_Recipient" ||
    asset.allocationStatus === "Prideleny_Room"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) {
      setError(tab === "recipient" ? "Vyberte príjemcu." : "Vyberte miestnosť.")
      return
    }
    setPending(true)
    setError("")

    const result = await assignAsset(
      asset.id,
      tab,
      parseInt(selectedId),
      currentUserName,
      note
    )

    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Priradiť majetok
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {asset.name} · {asset.serialNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current assignment warning */}
        {isAssigned && (
          <div className="mx-6 mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2.5">
            <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Majetok je aktuálne pridelený:{" "}
              <strong>
                {asset.currentRecipient?.name ?? asset.currentRoom?.name ?? allocationStatusLabels[asset.allocationStatus]}
              </strong>
              . Nové priradenie automaticky uzavrie predchádzajúce.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <button
                type="button"
                onClick={() => { setTab("recipient"); setSelectedId("") }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tab === "recipient"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <User size={14} />
                Príjemca
              </button>
              <button
                type="button"
                onClick={() => { setTab("room"); setSelectedId("") }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tab === "room"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <Building2 size={14} />
                Miestnosť
              </button>
            </div>

            {/* Select */}
            {tab === "recipient" ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Príjemca <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— vybrať príjemcu —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.lastName} {u.firstName} ({u.email})
                    </option>
                  ))}
                </select>
                {users.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Žiadni používatelia. Najprv pridajte príjemcov.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Miestnosť <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— vybrať miestnosť —</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {rooms.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Žiadne miestnosti. Najprv pridajte miestnosti.
                  </p>
                )}
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Poznámka k priradeniu
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Voliteľné"
                className={inputCls}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</p>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Zrušiť
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {pending ? "Prideľujem..." : "Priradiť"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
