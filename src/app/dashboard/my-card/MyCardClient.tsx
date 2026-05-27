"use client"

import { useState } from "react"
import { CreditCard, Package, Building2, FileText, ChevronUp, ChevronDown, ArrowUpDown, ChevronRight, Users } from "lucide-react"
import {
  assetTypeLabels, brandLabels, usagePlaceLabels, functionStatusLabels, functionStatusColors, assetKindLabels,
} from "@/lib/labels"
import type { AssetType, Brand, UsagePlace, FunctionStatus, AssetKind, Role } from "@/generated/prisma/enums"
import { useTablePrefs, type ColDef } from "@/lib/useTablePrefs"
import { useColResize } from "@/lib/useColResize"
import ColumnManager from "@/components/ColumnManager"

type Assignment = {
  id: number
  assetId: number
  assetType: string
  assetName: string
  assetBrand: string
  serialNumber: string | null
  yearOfManufacture: number | null
  usagePlace: string
  functionStatus: string
  publicNotes: { id: number; content: string; createdByName: string }[]
  kind: string
  acquisitionDate: string | null
  assignedAt: string
  assignedBy: string
  assignmentNote: string | null
  returnedAt: string | null
  returnedTo: string | null
  returnNote: string | null
  isCurrent: boolean
}

type RoomAccess = {
  roomId: number
  roomName: string
  assets: {
    id: number
    type: string
    name: string
    brand: string
    serialNumber: string | null
    functionStatus: string
    assignedAt: string
  }[]
}

type Subordinate = { id: number; firstName: string; lastName: string; email: string }

interface Props {
  userName: string
  userEmail: string
  userRoles: Role[]
  assignments: Assignment[]
  roomAccesses: RoomAccess[]
  userId: number
  subordinates: Subordinate[]
}

const roleLabel: Record<Role, string> = {
  PRIJEMCA: "Príjemca",
  NADRIADENY: "Nadriadený",
  BEZPECNOSTNY_PRACOVNIK: "Bezp. pracovník",
  SPRAVCA_KARIET: "Správca kariet",
  SPRAVCA_PC: "Správca PC",
  SPRAVCA_ROLI: "Správca rolí",
  SPRAVCA_APLIKACIE: "Správca aplikácie",
  SPRAVCA_REGISTRATURY: "Správca registratúry",
  PRACOVNIK_PODATELNE: "Prac. podateľne",
  SPRACOVATEL_REGISTRATURY: "Spracovateľ",
}
const roleBadge: Record<Role, string> = {
  PRIJEMCA: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  NADRIADENY: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  BEZPECNOSTNY_PRACOVNIK: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  SPRAVCA_KARIET: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  SPRAVCA_PC: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  SPRAVCA_ROLI: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  SPRAVCA_APLIKACIE: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  SPRAVCA_REGISTRATURY: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
  PRACOVNIK_PODATELNE: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  SPRACOVATEL_REGISTRATURY: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
}

const thBase = "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
const tdBase = "px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 overflow-hidden"

const RECIPIENT_CURRENT_COLS: ColDef[] = [
  { key: "id", label: "ID", fixed: true, defaultWidth: 60 },
  { key: "type", label: "Typ", fixed: true, defaultWidth: 110, sortable: true },
  { key: "name", label: "Majetok", fixed: true, defaultWidth: 200, sortable: true },
  { key: "serialNumber", label: "Výrobné číslo", defaultWidth: 150, sortable: true },
  { key: "functionStatus", label: "Stav", defaultWidth: 120, sortable: true },
  { key: "assignedAt", label: "Pridelené dňa", defaultWidth: 120, sortable: true },
  { key: "usagePlace", label: "Miesto použitia", defaultWidth: 130 },
  { key: "note", label: "Poznámka", defaultWidth: 170 },
  { key: "protocol", label: "PDF", defaultWidth: 70 },
]

const RECIPIENT_HISTORY_COLS: ColDef[] = [
  { key: "id", label: "ID", fixed: true, defaultWidth: 60 },
  { key: "type", label: "Typ", fixed: true, defaultWidth: 110 },
  { key: "name", label: "Majetok", fixed: true, defaultWidth: 200 },
  { key: "serialNumber", label: "Výrobné číslo", defaultWidth: 150 },
  { key: "functionStatus", label: "Stav", defaultWidth: 120 },
  { key: "assignedAt", label: "Pridelené dňa", defaultWidth: 120 },
  { key: "assignedBy", label: "Pridelil", defaultWidth: 130 },
  { key: "note", label: "Poznámka", defaultWidth: 160 },
  { key: "returnedAt", label: "Vrátené dňa", defaultWidth: 120 },
  { key: "returnedTo", label: "Vrátené komu", defaultWidth: 130 },
  { key: "protocol", label: "PDF", defaultWidth: 70 },
]

const ROOM_ASSET_COLS: ColDef[] = [
  { key: "id", label: "ID", fixed: true, defaultWidth: 60 },
  { key: "type", label: "Typ", fixed: true, defaultWidth: 110 },
  { key: "name", label: "Majetok", fixed: true, defaultWidth: 200 },
  { key: "serialNumber", label: "Výrobné číslo", defaultWidth: 150 },
  { key: "functionStatus", label: "Stav", defaultWidth: 120 },
  { key: "assignedAt", label: "Priradené od", defaultWidth: 120 },
]

type RecipientSortKey = "type" | "name" | "serialNumber" | "functionStatus" | "assignedAt"

function RecipientSection({ assignments, userId }: { assignments: Assignment[]; userId: number }) {
  const [tab, setTab] = useState<"current" | "history">("current")
  const [sortKey, setSortKey] = useState<RecipientSortKey>("assignedAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const current = assignments.filter(a => a.isCurrent)
  const history = assignments.filter(a => !a.isCurrent)

  const { prefs: currPrefs, visibleCols: currCols, movableCols: currMovable, toggleHidden: currToggle, reorderCols: currReorder, setWidth: currSetWidth, reset: currReset, getWidth: currGetWidth } =
    useTablePrefs(`ve_t_mc_rc_${userId}`, RECIPIENT_CURRENT_COLS)
  const { onResizeMouseDown: currResize } = useColResize(currGetWidth, currSetWidth)

  const { prefs: histPrefs, visibleCols: histCols, movableCols: histMovable, toggleHidden: histToggle, reorderCols: histReorder, setWidth: histSetWidth, reset: histReset, getWidth: histGetWidth } =
    useTablePrefs(`ve_t_mc_rh_${userId}`, RECIPIENT_HISTORY_COLS)
  const { onResizeMouseDown: histResize } = useColResize(histGetWidth, histSetWidth)

  function handleSort(key: RecipientSortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  function sortItems(items: Assignment[]) {
    return [...items].sort((a, b) => {
      let aVal: string
      let bVal: string
      switch (sortKey) {
        case "type": aVal = assetTypeLabels[a.assetType as AssetType] ?? a.assetType; bVal = assetTypeLabels[b.assetType as AssetType] ?? b.assetType; break
        case "name": aVal = a.assetName; bVal = b.assetName; break
        case "serialNumber": aVal = a.serialNumber ?? ""; bVal = b.serialNumber ?? ""; break
        case "functionStatus": aVal = functionStatusLabels[a.functionStatus as FunctionStatus] ?? a.functionStatus; bVal = functionStatusLabels[b.functionStatus as FunctionStatus] ?? b.functionStatus; break
        case "assignedAt": aVal = a.assignedAt; bVal = b.assignedAt; break
        default: aVal = ""; bVal = ""
      }
      const cmp = aVal.localeCompare(bVal, "sk")
      return sortDir === "asc" ? cmp : -cmp
    })
  }

  function renderCurrentCell(key: string, a: Assignment): React.ReactNode {
    switch (key) {
      case "id": return <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">{a.assetId}</span>
      case "type": return assetTypeLabels[a.assetType as AssetType] ?? a.assetType
      case "name": return (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.assetName}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{brandLabels[a.assetBrand as Brand] ?? a.assetBrand}</div>
        </div>
      )
      case "serialNumber": return a.serialNumber ? <span className="font-mono text-xs whitespace-nowrap">{a.serialNumber}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "functionStatus": return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${functionStatusColors[a.functionStatus as FunctionStatus] ?? ""}`}>
          {functionStatusLabels[a.functionStatus as FunctionStatus] ?? a.functionStatus}
        </span>
      )
      case "assignedAt": return <span className="whitespace-nowrap">{a.assignedAt}</span>
      case "usagePlace": return <span className="text-gray-500 dark:text-gray-400">{usagePlaceLabels[a.usagePlace as UsagePlace] ?? a.usagePlace}</span>
      case "kind": return <span className="text-gray-500 dark:text-gray-400">{assetKindLabels[a.kind as AssetKind] ?? a.kind}</span>
      case "note": return a.assignmentNote ? <span className="truncate block text-gray-500 dark:text-gray-400" title={a.assignmentNote}>{a.assignmentNote}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "protocol": return (
        <a href={`/protocol/assets/${a.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium w-fit">
          <FileText size={12} />PDF
        </a>
      )
      default: return null
    }
  }

  function renderHistoryCell(key: string, a: Assignment): React.ReactNode {
    switch (key) {
      case "id": return <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">{a.assetId}</span>
      case "type": return assetTypeLabels[a.assetType as AssetType] ?? a.assetType
      case "name": return (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.assetName}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{brandLabels[a.assetBrand as Brand] ?? a.assetBrand}</div>
        </div>
      )
      case "serialNumber": return a.serialNumber ? <span className="font-mono text-xs whitespace-nowrap">{a.serialNumber}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "functionStatus": return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${functionStatusColors[a.functionStatus as FunctionStatus] ?? ""}`}>
          {functionStatusLabels[a.functionStatus as FunctionStatus] ?? a.functionStatus}
        </span>
      )
      case "assignedAt": return <span className="whitespace-nowrap">{a.assignedAt}</span>
      case "assignedBy": return a.assignedBy
      case "note": return a.assignmentNote ? <span className="truncate block" title={a.assignmentNote}>{a.assignmentNote}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "returnedAt": return <span className="whitespace-nowrap">{a.returnedAt}</span>
      case "returnedTo": return a.returnedTo ?? <span className="text-gray-300 dark:text-gray-600">—</span>
      case "protocol": return (
        <a href={`/protocol/assets/${a.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium w-fit">
          <FileText size={12} />PDF
        </a>
      )
      default: return null
    }
  }

  const currTotal = currCols.reduce((sum, col) => sum + (currGetWidth(col.key) ?? 100), 0)
  const histTotal = histCols.reduce((sum, col) => sum + (histGetWidth(col.key) ?? 100), 0)

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30"><Package size={16} className="text-blue-600 dark:text-blue-400" /></div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Karta majetku príjemcu</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pracovné prostriedky pridelené na vaše meno</p>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium">{current.length} aktuálnych</span>
          {history.length > 0 && <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">{history.length} vrátených</span>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(["current", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
              {t === "current" ? "Aktuálne pridelené" : "História vrátení"}
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${tab === t ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
                {t === "current" ? current.length : history.length}
              </span>
            </button>
          ))}
        </div>

        {tab === "current" && (
          current.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 dark:text-gray-500">
              <Package size={36} className="mb-2 opacity-20" />
              <p className="text-sm">Momentálne nemáte priradený žiadny majetok.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg">
                  {sortDir === "asc" ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
                  <span>{{ type: "Typ", name: "Majetok", serialNumber: "Výrobné číslo", functionStatus: "Stav", assignedAt: "Pridelené dňa" }[sortKey]}</span>
                </div>
                <ColumnManager cols={currMovable} hidden={currPrefs.hidden} order={currPrefs.order} onToggle={currToggle} onReorder={currReorder} onReset={currReset} />
              </div>
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: currTotal }}>
                  <colgroup>{currCols.map(col => <col key={col.key} style={{ width: currGetWidth(col.key) }} />)}</colgroup>
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      {currCols.map(col => {
                        const active = sortKey === col.key
                        return (
                          <th key={col.key} style={{ width: currGetWidth(col.key) }} onClick={() => col.sortable && handleSort(col.key as RecipientSortKey)} className={`relative group px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${active && col.sortable ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"} ${col.sortable ? "cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" : ""}`}>
                            <div className="flex items-center gap-1 pr-2">
                              {col.label}
                              {col.sortable && (active ? sortDir === "asc" ? <ChevronUp size={12} className="text-blue-500 shrink-0" /> : <ChevronDown size={12} className="text-blue-500 shrink-0" /> : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />)}
                            </div>
                            <div onMouseDown={e => currResize(col.key, e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-gray-200/60 dark:group-hover:bg-gray-600/40 hover:!bg-blue-400/60 z-10" />
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {sortItems(current).map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        {currCols.map(col => <td key={col.key} className={tdBase}>{renderCurrentCell(col.key, a)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}

        {tab === "history" && (
          history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400 dark:text-gray-500">
              <Package size={36} className="mb-2 opacity-20" />
              <p className="text-sm">Žiadna história vrátení.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <ColumnManager cols={histMovable} hidden={histPrefs.hidden} order={histPrefs.order} onToggle={histToggle} onReorder={histReorder} onReset={histReset} />
              </div>
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: histTotal }}>
                  <colgroup>{histCols.map(col => <col key={col.key} style={{ width: histGetWidth(col.key) }} />)}</colgroup>
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      {histCols.map(col => (
                        <th key={col.key} style={{ width: histGetWidth(col.key) }} className={`relative group ${thBase}`}>
                          <div className="pr-2">{col.label}</div>
                          <div onMouseDown={e => histResize(col.key, e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-gray-200/60 dark:group-hover:bg-gray-600/40 hover:!bg-blue-400/60 z-10" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {history.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        {histCols.map(col => <td key={col.key} className={tdBase}>{renderHistoryCell(col.key, a)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>
    </section>
  )
}

function RoomSection({ roomAccesses, userId }: { roomAccesses: RoomAccess[]; userId: number }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set(roomAccesses.map(r => r.roomId)))

  const { prefs, visibleCols, movableCols, toggleHidden, reorderCols, setWidth, reset, getWidth } =
    useTablePrefs(`ve_t_mc_rm_${userId}`, ROOM_ASSET_COLS)
  const { onResizeMouseDown } = useColResize(getWidth, setWidth)

  function toggle(id: number) {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function renderCell(key: string, a: RoomAccess["assets"][number]): React.ReactNode {
    switch (key) {
      case "id": return <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">{a.id}</span>
      case "type": return assetTypeLabels[a.type as AssetType] ?? a.type
      case "name": return (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.name}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{brandLabels[a.brand as Brand] ?? a.brand}</div>
        </div>
      )
      case "serialNumber": return a.serialNumber ? <span className="font-mono text-xs whitespace-nowrap">{a.serialNumber}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "functionStatus": return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${functionStatusColors[a.functionStatus as FunctionStatus] ?? ""}`}>
          {functionStatusLabels[a.functionStatus as FunctionStatus] ?? a.functionStatus}
        </span>
      )
      case "assignedAt": return <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">{a.assignedAt}</span>
      default: return null
    }
  }

  const totalWidth = visibleCols.reduce((sum, col) => sum + (getWidth(col.key) ?? 100), 0)
  const totalAssets = roomAccesses.reduce((sum, r) => sum + r.assets.length, 0)

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30"><Building2 size={16} className="text-purple-600 dark:text-purple-400" /></div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Karta majetku miestností</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pracovné prostriedky v miestnostiach, ku ktorým máte prístup</p>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-medium">{roomAccesses.length} {roomAccesses.length === 1 ? "miestnosť" : "miestností"}</span>
          <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">{totalAssets} kusov</span>
        </div>
      </div>

      {roomAccesses.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center py-14 text-gray-400 dark:text-gray-500">
          <Building2 size={36} className="mb-2 opacity-20" />
          <p className="text-sm">Nemáte prístup do žiadnej miestnosti.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {roomAccesses.map(room => {
            const isOpen = expanded.has(room.roomId)
            return (
              <div key={room.roomId} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button type="button" onClick={() => toggle(room.roomId)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {isOpen ? <ChevronDown size={15} className="text-gray-400 dark:text-gray-500 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 dark:text-gray-500 shrink-0" />}
                  <Building2 size={15} className="text-purple-500 dark:text-purple-400 shrink-0" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{room.roomName}</span>
                  <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-medium ${room.assets.length > 0 ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"}`}>
                    {room.assets.length} {room.assets.length === 1 ? "kus" : "kusov"}
                  </span>
                </button>

                {isOpen && (
                  room.assets.length === 0 ? (
                    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                      V tejto miestnosti nie je evidovaný žiadny majetok.
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end px-3 py-1.5 border-t border-gray-100 dark:border-gray-700">
                        <ColumnManager cols={movableCols} hidden={prefs.hidden} order={prefs.order} onToggle={toggleHidden} onReorder={reorderCols} onReset={reset} />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}>
                          <colgroup>{visibleCols.map(col => <col key={col.key} style={{ width: getWidth(col.key) }} />)}</colgroup>
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              {visibleCols.map(col => (
                                <th key={col.key} style={{ width: getWidth(col.key) }} className={`relative group ${thBase}`}>
                                  <div className="pr-2">{col.label}</div>
                                  <div onMouseDown={e => onResizeMouseDown(col.key, e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-gray-200/60 dark:group-hover:bg-gray-600/40 hover:!bg-blue-400/60 z-10" />
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {room.assets.map(a => (
                              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                {visibleCols.map(col => <td key={col.key} className={tdBase}>{renderCell(col.key, a)}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function SubordinatesSection({ subordinates }: { subordinates: Subordinate[] }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
          <Users size={16} className="text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Podriadení</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Karty pracovných prostriedkov vašich podriadených</p>
        </div>
      </div>
      {subordinates.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
          <p className="text-sm">Nemáte žiadnych podriadených.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {subordinates.map(s => (
            <a key={s.id} href={`/dashboard/users/${s.id}`} className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">{s.firstName[0]}{s.lastName[0]}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.lastName} {s.firstName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.email}</p>
              </div>
              <ChevronRight size={14} className="ml-auto text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 shrink-0" />
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

export default function MyCardClient({ userName, userEmail, userRoles, assignments, roomAccesses, userId, subordinates }: Props) {
  return (
    <div>
      <div className="flex items-start gap-4 mb-8">
        <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0">
          <CreditCard size={22} className="text-gray-600 dark:text-gray-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{userEmail}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {userRoles.map(r => <span key={r} className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadge[r]}`}>{roleLabel[r]}</span>)}
          </div>
        </div>
      </div>
      <div className="space-y-10">
        <RecipientSection assignments={assignments} userId={userId} />
        <RoomSection roomAccesses={roomAccesses} userId={userId} />
        {userRoles.includes("NADRIADENY") && <SubordinatesSection subordinates={subordinates} />}
      </div>
    </div>
  )
}
