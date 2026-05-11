"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, ExternalLink, CheckCheck } from "lucide-react"
import {
  travelOrderTypeLabels,
  travelOrderTypeColors,
  travelOrderStatusLabels,
  travelOrderStatusColors,
} from "@/lib/labels"
import type { TravelOrderType, TravelOrderStatus } from "@/generated/prisma/enums"
import { fmtDate } from "@/lib/formatDate"

type SettledOrder = {
  id: number
  orderNumber: string
  type: TravelOrderType
  purpose: string
  startLocation: string
  destination: string
  countries: string | null
  departureAt: string
  returnAt: string
  user: { id: number; firstName: string; lastName: string }
  supervisor: { id: number; firstName: string; lastName: string } | null
  expenseReport: {
    id: number
    status: TravelOrderStatus
    totalExpenses: number | null
    advanceReceived: number | null
    managerApprovedAt: string | null
  } | null
}

interface Props {
  orders: SettledOrder[]
  currentUserId: number
  userRoles: string[]
  isAppAdmin?: boolean
}

function fmtEur(value: number | null): string {
  if (value === null) return "••••••"
  return value.toLocaleString("sk-SK", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })
}

export default function VyuctovaneCestyClient({ orders, userRoles, isAppAdmin = false }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  const isSpravcaPC = userRoles.includes("SPRAVCA_PC")
  const showEmployee = isSpravcaPC || isAppAdmin

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase()
    return (
      !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.purpose.toLowerCase().includes(q) ||
      o.destination.toLowerCase().includes(q) ||
      `${o.user.firstName} ${o.user.lastName}`.toLowerCase().includes(q)
    )
  })

  const colCount = showEmployee ? 9 : 8

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Vyúčtované cesty</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Pracovné cesty s podaným vyúčtovaním</p>
        </div>
        <div className="flex items-center gap-2">
          <CheckCheck size={18} className="text-green-500" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">{orders.length} vyúčtovaných</span>
        </div>
      </div>

      <div className="relative w-64">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hľadať..."
          className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
        />
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Číslo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Typ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Účel / Cieľ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Termín</th>
              {showEmployee && (
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Zamestnanec</th>
              )}
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Stav vyúčtovania</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Náklady celkom</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Preplatok / Nedoplatok</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  Žiadne vyúčtované cesty
                </td>
              </tr>
            )}
            {filtered.map((o) => {
              const er = o.expenseReport
              const diff =
                er && er.totalExpenses !== null && er.advanceReceived !== null
                  ? er.totalExpenses - er.advanceReceived
                  : null
              return (
                <tr
                  key={o.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                  onClick={() => router.push(`/dashboard/pracovne-cesty/${o.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {o.orderNumber}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${travelOrderTypeColors[o.type]}`}>
                      {travelOrderTypeLabels[o.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{o.purpose}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {o.startLocation} → {o.destination}
                      {o.countries ? ` (${o.countries})` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                    <p>{fmtDate(o.departureAt)}</p>
                    <p className="text-xs text-gray-400">– {fmtDate(o.returnAt)}</p>
                  </td>
                  {showEmployee && (
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {o.user.firstName} {o.user.lastName}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {er ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${travelOrderStatusColors[er.status]}`}>
                        {travelOrderStatusLabels[er.status]}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 font-medium whitespace-nowrap">
                    {fmtEur(er?.totalExpenses ?? null)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                    {diff === null ? (
                      <span className="text-gray-400">—</span>
                    ) : diff > 0 ? (
                      <span className="text-orange-600 dark:text-orange-400">+{fmtEur(diff)}</span>
                    ) : diff < 0 ? (
                      <span className="text-green-600 dark:text-green-400">{fmtEur(diff)}</span>
                    ) : (
                      <span className="text-gray-500">{fmtEur(0)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ExternalLink size={14} className="text-gray-400" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
