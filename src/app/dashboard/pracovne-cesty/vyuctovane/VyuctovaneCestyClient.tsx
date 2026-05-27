"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, ExternalLink, CheckCheck, ArrowUpDown, ChevronUp, ChevronDown, X } from "lucide-react"
import {
  travelOrderTypeLabels,
  travelOrderTypeColors,
  travelOrderStatusLabels,
  travelOrderStatusColors,
} from "@/lib/labels"
import type { TravelOrderType, TravelOrderStatus } from "@/generated/prisma/enums"
import { fmtDate } from "@/lib/formatDate"
import { MultiSelect } from "@/components/MultiSelect"

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

type SortKey = "orderNumber" | "type" | "purpose" | "departureAt" | "user" | "status" | "totalExpenses" | "diff"

const typeOptions = (Object.keys(travelOrderTypeLabels) as TravelOrderType[]).map(k => ({ value: k, label: travelOrderTypeLabels[k] }))
const statusOptions = (Object.keys(travelOrderStatusLabels) as TravelOrderStatus[]).map(k => ({ value: k, label: travelOrderStatusLabels[k] }))

const thBase = "text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400"

function Th({ label, colKey, sortKey, sortDir, onSort, className }: {
  label: string; colKey: string
  sortKey: string | null; sortDir: "asc" | "desc"
  onSort: (k: string) => void
  className?: string
}) {
  const active = sortKey === colKey
  return (
    <th className={`${thBase} ${className ?? ""}`}>
      <button type="button" onClick={() => onSort(colKey)}
        className={`flex items-center gap-1 transition-colors whitespace-nowrap ${active ? "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300" : "hover:text-gray-700 dark:hover:text-gray-200"}`}>
        {label}
        {active
          ? sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
          : <ArrowUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  )
}

function fmtEur(value: number | null): string {
  if (value === null) return "—"
  return value.toLocaleString("sk-SK", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })
}

export default function VyuctovaneCestyClient({ orders, userRoles, isAppAdmin = false }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set())
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

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

  const searchFiltered = useMemo(() => {
    if (!search) return orders
    const q = search.toLowerCase()
    return orders.filter(o =>
      o.orderNumber.toLowerCase().includes(q) ||
      o.purpose.toLowerCase().includes(q) ||
      o.destination.toLowerCase().includes(q) ||
      `${o.user.firstName} ${o.user.lastName}`.toLowerCase().includes(q)
    )
  }, [orders, search])

  const availableTypeOptions = useMemo(() => {
    const vals = new Set(
      searchFiltered
        .filter(o => filterStatuses.size === 0 || (o.expenseReport != null && filterStatuses.has(o.expenseReport.status)))
        .map(o => o.type)
    )
    return typeOptions.filter(opt => vals.has(opt.value as TravelOrderType) || filterTypes.has(opt.value))
  }, [searchFiltered, filterStatuses, filterTypes])

  const availableStatusOptions = useMemo(() => {
    const vals = new Set(
      searchFiltered
        .filter(o => filterTypes.size === 0 || filterTypes.has(o.type))
        .filter(o => o.expenseReport != null)
        .map(o => o.expenseReport!.status)
    )
    return statusOptions.filter(opt => vals.has(opt.value as TravelOrderStatus) || filterStatuses.has(opt.value))
  }, [searchFiltered, filterTypes, filterStatuses])

  const filtered = useMemo(() => searchFiltered.filter(o => {
    if (filterTypes.size > 0 && !filterTypes.has(o.type)) return false
    if (filterStatuses.size > 0 && o.expenseReport && !filterStatuses.has(o.expenseReport.status)) return false
    return true
  }), [searchFiltered, filterTypes, filterStatuses])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const nullEnd = sortDir === "asc" ? Infinity : -Infinity
    return [...filtered].sort((a, b) => {
      let aVal: string | number = ""
      let bVal: string | number = ""
      const aEr = a.expenseReport
      const bEr = b.expenseReport
      switch (sortKey) {
        case "orderNumber": aVal = a.orderNumber; bVal = b.orderNumber; break
        case "type": aVal = travelOrderTypeLabels[a.type]; bVal = travelOrderTypeLabels[b.type]; break
        case "purpose": aVal = a.purpose; bVal = b.purpose; break
        case "departureAt": aVal = a.departureAt; bVal = b.departureAt; break
        case "user": aVal = `${a.user.lastName} ${a.user.firstName}`; bVal = `${b.user.lastName} ${b.user.firstName}`; break
        case "status":
          aVal = aEr ? travelOrderStatusLabels[aEr.status] : ""
          bVal = bEr ? travelOrderStatusLabels[bEr.status] : ""
          break
        case "totalExpenses":
          aVal = aEr?.totalExpenses ?? nullEnd
          bVal = bEr?.totalExpenses ?? nullEnd
          break
        case "diff": {
          const aDiff = aEr?.totalExpenses != null && aEr?.advanceReceived != null
            ? aEr.totalExpenses - aEr.advanceReceived : null
          const bDiff = bEr?.totalExpenses != null && bEr?.advanceReceived != null
            ? bEr.totalExpenses - bEr.advanceReceived : null
          aVal = aDiff ?? nullEnd
          bVal = bDiff ?? nullEnd
          break
        }
      }
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), "sk")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

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
        <MultiSelect placeholder="Typ" options={availableTypeOptions} selected={filterTypes} onChange={setFilterTypes} />
        <MultiSelect placeholder="Stav vyúčt." options={availableStatusOptions} selected={filterStatuses} onChange={setFilterStatuses} />
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-300 transition-colors"
          >
            <X size={12} /> Zrušiť filtre
          </button>
        )}
        {sortKey && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg">
            {sortDir === "asc" ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
            <span>{{ orderNumber: "Číslo", type: "Typ", purpose: "Účel / Cieľ", departureAt: "Termín", user: "Zamestnanec", status: "Stav vyúčtovania", totalExpenses: "Náklady celkom", diff: "Preplatok / Nedoplatok" }[sortKey]}</span>
            <button type="button" onClick={() => setSortKey(null)} className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100">
              <X size={11} />
            </button>
          </div>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {sorted.length} / {orders.length}
        </span>
      </div>

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
              <Th label="Stav vyúčtovania" colKey="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Náklady celkom" colKey="totalExpenses" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <Th label="Preplatok / Nedoplatok" colKey="diff" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  {hasActiveFilters ? "Žiadne cesty nezodpovedajú filtru" : "Žiadne vyúčtované cesty"}
                </td>
              </tr>
            )}
            {sorted.map((o) => {
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
