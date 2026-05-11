"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Plane, Globe, ExternalLink, ArrowUpDown, ChevronUp, ChevronDown, X } from "lucide-react"
import {
  travelOrderTypeLabels,
  travelOrderTypeColors,
  travelOrderStatusLabels,
  travelOrderStatusColors,
} from "@/lib/labels"
import type { TravelOrderType, TravelOrderStatus } from "@/generated/prisma/enums"
import NewTravelOrderModal from "./NewTravelOrderModal"
import { fmtDate } from "@/lib/formatDate"
import { MultiSelect } from "@/components/MultiSelect"

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
  isAppAdmin?: boolean
}

type SortKey = "orderNumber" | "type" | "purpose" | "departureAt" | "user" | "status"

const typeOptions = (Object.keys(travelOrderTypeLabels) as TravelOrderType[]).map(k => ({ value: k, label: travelOrderTypeLabels[k] }))
const statusOptions = (Object.keys(travelOrderStatusLabels) as TravelOrderStatus[]).map(k => ({ value: k, label: travelOrderStatusLabels[k] }))

const thBase = "text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400"

function Th({ label, colKey, sortKey, sortDir, onSort }: {
  label: string; colKey: string
  sortKey: string | null; sortDir: "asc" | "desc"
  onSort: (k: string) => void
}) {
  const active = sortKey === colKey
  return (
    <th className={thBase}>
      <button type="button" onClick={() => onSort(colKey)}
        className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors whitespace-nowrap">
        {label}
        {active
          ? sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
          : <ArrowUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  )
}

export default function TravelOrdersClient({ orders, currentUserId, userRoles, supervisors, isAppAdmin = false }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set())
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [showNewModal, setShowNewModal] = useState(false)
  const [newType, setNewType] = useState<TravelOrderType>("TUZEMSKY")
  const [, startTransition] = useTransition()

  const isSpravcaPC = userRoles.includes("SPRAVCA_PC")
  const showEmployee = isSpravcaPC || isAppAdmin
  const hasActiveFilters = search || filterTypes.size > 0 || filterStatuses.size > 0

  function clearAllFilters() {
    setSearch(""); setFilterTypes(new Set()); setFilterStatuses(new Set())
  }

  function handleSort(key: string) {
    const k = key as SortKey
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir("asc") }
  }

  const filtered = useMemo(() => orders.filter(o => {
    if (filterTypes.size > 0 && !filterTypes.has(o.type)) return false
    if (filterStatuses.size > 0 && !filterStatuses.has(o.status)) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !o.orderNumber.toLowerCase().includes(q) &&
        !o.purpose.toLowerCase().includes(q) &&
        !o.destination.toLowerCase().includes(q) &&
        !`${o.user.firstName} ${o.user.lastName}`.toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [orders, filterTypes, filterStatuses, search])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let aVal: string | number = ""
      let bVal: string | number = ""
      switch (sortKey) {
        case "orderNumber": aVal = a.orderNumber; bVal = b.orderNumber; break
        case "type": aVal = travelOrderTypeLabels[a.type]; bVal = travelOrderTypeLabels[b.type]; break
        case "purpose": aVal = a.purpose; bVal = b.purpose; break
        case "departureAt": aVal = a.departureAt; bVal = b.departureAt; break
        case "user": aVal = `${a.user.lastName} ${a.user.firstName}`; bVal = `${b.user.lastName} ${b.user.firstName}`; break
        case "status": aVal = travelOrderStatusLabels[a.status]; bVal = travelOrderStatusLabels[b.status]; break
      }
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), "sk")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

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
          {isAppAdmin ? (
            <span className="px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              Režim len na čítanie
            </span>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>
        <MultiSelect placeholder="Typ" options={typeOptions} selected={filterTypes} onChange={setFilterTypes} />
        <MultiSelect placeholder="Stav" options={statusOptions} selected={filterStatuses} onChange={setFilterStatuses} />
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-300 transition-colors"
          >
            <X size={12} /> Zrušiť filtre
          </button>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {sorted.length} / {orders.length}
        </span>
      </div>

      {/* table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <Th label="Číslo" colKey="orderNumber" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Typ" colKey="type" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Účel / Cieľ" colKey="purpose" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Termín" colKey="departureAt" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              {showEmployee && (
                <Th label="Zamestnanec" colKey="user" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              )}
              <Th label="Stav" colKey="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className={thBase}>Vyúčt.</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={showEmployee ? 8 : 7}
                  className="px-4 py-10 text-center text-gray-400 dark:text-gray-500"
                >
                  {hasActiveFilters ? "Žiadne príkazy nezodpovedajú filtru" : "Žiadne príkazy"}
                </td>
              </tr>
            )}
            {sorted.map((o) => (
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
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${travelOrderStatusColors[o.status]}`}>
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
