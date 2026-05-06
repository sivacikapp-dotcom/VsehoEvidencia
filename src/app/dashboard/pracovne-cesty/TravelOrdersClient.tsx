"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Search, Plane, Globe, ExternalLink } from "lucide-react"
import {
  travelOrderTypeLabels,
  travelOrderTypeColors,
  travelOrderStatusLabels,
  travelOrderStatusColors,
  transportMeansLabels,
} from "@/lib/labels"
import type { TravelOrderType, TravelOrderStatus, TransportMeans } from "@/generated/prisma/enums"
import NewTravelOrderModal from "./NewTravelOrderModal"

type Order = {
  id: number
  orderNumber: string
  type: TravelOrderType
  status: TravelOrderStatus
  userId: number
  purpose: string
  startLocation: string
  destination: string
  departureAt: string
  returnAt: string
  transport: TransportMeans[]
  countries: string | null
  advanceEUR: number | null
  rejectionNote: string | null
  user: { id: number; firstName: string; lastName: string }
  supervisor: { id: number; firstName: string; lastName: string } | null
  manager: { id: number; firstName: string; lastName: string } | null
  expenseReport: { id: number } | null
  supervisorApprovedAt: string | null
  managerApprovedAt: string | null
}

interface Props {
  orders: Order[]
  currentUserId: number
  userRoles: string[]
  supervisors: { id: number; firstName: string; lastName: string }[]
}

export default function TravelOrdersClient({ orders, currentUserId, userRoles, supervisors }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [showNewModal, setShowNewModal] = useState(false)
  const [newType, setNewType] = useState<TravelOrderType>("TUZEMSKY")
  const [, startTransition] = useTransition()

  const isSpravcaPC = userRoles.includes("SPRAVCA_PC")

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.purpose.toLowerCase().includes(q) ||
      o.destination.toLowerCase().includes(q) ||
      `${o.user.firstName} ${o.user.lastName}`.toLowerCase().includes(q)
    const matchStatus = statusFilter === "ALL" || o.status === statusFilter
    return matchSearch && matchStatus
  })

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  function openNew(type: TravelOrderType) {
    setNewType(type)
    setShowNewModal(true)
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Pracovné cesty</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Cestovné príkazy a vyúčtovania</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openNew("TUZEMSKY")}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plane size={15} />
            Tuzemský príkaz
          </button>
          <button
            onClick={() => openNew("ZAHRANICNY")}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Globe size={15} />
            Zahraničný príkaz
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať..."
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Všetky stavy</option>
          <option value="DRAFT">Rozpracované</option>
          <option value="PENDING_SUPERVISOR">Čaká na nadriadeného</option>
          <option value="PENDING_MANAGER">Čaká na správcu PC</option>
          <option value="APPROVED">Schválené</option>
          <option value="REJECTED">Zamietnuté</option>
        </select>
      </div>

      {/* table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Číslo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Typ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Účel / Cieľ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Termín</th>
              {isSpravcaPC && (
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Zamestnanec</th>
              )}
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Stav</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Vyúčt.</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={isSpravcaPC ? 8 : 7}
                  className="px-4 py-10 text-center text-gray-400 dark:text-gray-500"
                >
                  Žiadne príkazy
                </td>
              </tr>
            )}
            {filtered.map((o) => (
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
                  <p>{formatDate(o.departureAt)}</p>
                  <p className="text-xs text-gray-400">– {formatDate(o.returnAt)}</p>
                </td>
                {isSpravcaPC && (
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {o.user.firstName} {o.user.lastName}
                  </td>
                )}
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${travelOrderStatusColors[o.status]}`}
                  >
                    {travelOrderStatusLabels[o.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {o.expenseReport ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Áno
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ExternalLink size={14} className="text-gray-400" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewModal && (
        <NewTravelOrderModal
          type={newType}
          supervisors={supervisors}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false)
            startTransition(() => router.refresh())
          }}
        />
      )}
    </div>
  )
}
