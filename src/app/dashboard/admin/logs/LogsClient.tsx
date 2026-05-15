"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

type LogEntry = {
  id: number
  userId: number | null
  userEmail: string | null
  userName: string | null
  action: string
  entityType: string
  entityId: string
  entityLabel: string | null
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  createdAt: string
}

type Filters = {
  entityType: string
  action: string
  search: string
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Vytvorenie",
  UPDATE: "Úprava",
  DELETE: "Vymazanie",
  LOGIN_SUCCESS: "Prihlásenie",
  LOGIN_FAILURE: "Neúspešné prihlásenie",
  LOGOUT: "Odhlásenie",
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  LOGIN_SUCCESS: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  LOGIN_FAILURE: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  LOGOUT: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
}

function DiffView({
  oldData,
  newData,
}: {
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
}) {
  const allKeys = Array.from(
    new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])
  )

  if (allKeys.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Žiadne zmeny.</p>
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          <th className="py-1 pr-4 font-medium">Pole</th>
          <th className="py-1 pr-4 font-medium text-red-600 dark:text-red-400">Pred</th>
          <th className="py-1 font-medium text-green-600 dark:text-green-400">Po</th>
        </tr>
      </thead>
      <tbody>
        {allKeys.map((key) => {
          const oldVal = oldData?.[key]
          const newVal = newData?.[key]
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal)
          return (
            <tr
              key={key}
              className={`border-b border-gray-100 dark:border-gray-800 ${changed ? "" : "opacity-50"}`}
            >
              <td className="py-1.5 pr-4 font-mono text-xs text-gray-600 dark:text-gray-400 align-top">
                {key}
              </td>
              <td className="py-1.5 pr-4 align-top">
                {oldVal !== undefined ? (
                  <span className="font-mono text-xs bg-red-50 dark:bg-red-900/20 px-1 rounded break-all">
                    {JSON.stringify(oldVal)}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="py-1.5 align-top">
                {newVal !== undefined ? (
                  <span className="font-mono text-xs bg-green-50 dark:bg-green-900/20 px-1 rounded break-all">
                    {JSON.stringify(newVal)}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function DetailModal({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Detail záznamu #{log.id}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{log.createdAt}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Akcia</span>
              <div className="mt-0.5">
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Entita</span>
              <p className="mt-0.5 font-medium text-gray-900 dark:text-white">
                {log.entityType} #{log.entityId}
              </p>
            </div>
            {log.entityLabel && (
              <div className="col-span-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Označenie</span>
                <p className="mt-0.5 text-gray-900 dark:text-white">{log.entityLabel}</p>
              </div>
            )}
            <div className="col-span-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Používateľ</span>
              <p className="mt-0.5 text-gray-900 dark:text-white">
                {log.userName ?? "—"}
                {log.userEmail && (
                  <span className="text-gray-500 dark:text-gray-400 ml-1">({log.userEmail})</span>
                )}
              </p>
            </div>
          </div>

          {(log.oldData || log.newData) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Zmeny
              </p>
              <DiffView oldData={log.oldData} newData={log.newData} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LogsClient({
  logs,
  total,
  page,
  pageSize,
  filters,
  entityTypes,
}: {
  logs: LogEntry[]
  total: number
  page: number
  pageSize: number
  filters: Filters
  entityTypes: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [selected, setSelected] = useState<LogEntry | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function buildUrl(overrides: Partial<Filters & { page: number }>) {
    const params = new URLSearchParams()
    const merged = { ...filters, page, ...overrides }
    if (merged.entityType) params.set("entityType", merged.entityType)
    if (merged.action) params.set("action", merged.action)
    if (merged.search) params.set("search", merged.search)
    if ((merged as { page: number }).page > 1) params.set("page", String((merged as { page: number }).page))
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  function navigate(overrides: Partial<Filters & { page: number }>) {
    startTransition(() => router.push(buildUrl(overrides)))
  }

  const ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN_SUCCESS", "LOGIN_FAILURE", "LOGOUT"]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          História zmien v systéme — celkovo {total} záznamov
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Hľadaj používateľa alebo entitu…"
          defaultValue={filters.search}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              navigate({ search: (e.target as HTMLInputElement).value, page: 1 })
            }
          }}
          onBlur={(e) => {
            if (e.target.value !== filters.search) {
              navigate({ search: e.target.value, page: 1 })
            }
          }}
          className="flex-1 min-w-48 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={filters.entityType}
          onChange={(e) => navigate({ entityType: e.target.value, page: 1 })}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Všetky entity</option>
          {entityTypes.map((et) => (
            <option key={et} value={et}>{et}</option>
          ))}
        </select>

        <select
          value={filters.action}
          onChange={(e) => navigate({ action: e.target.value, page: 1 })}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Všetky akcie</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Čas
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Používateľ
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Akcia
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Entita
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Označenie
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Žiadne záznamy.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {log.createdAt}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">
                    {log.userName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {log.entityType}
                    <span className="ml-1 text-gray-400">#{log.entityId}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-xs truncate">
                    {log.entityLabel ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Strana {page} z {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => navigate({ page: page - 1 })}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            >
              <ChevronLeft size={14} /> Predchádzajúca
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => navigate({ page: page + 1 })}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            >
              Nasledujúca <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
