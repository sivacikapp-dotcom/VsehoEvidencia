"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Package, Clock, FileText, Building2, Pencil, Loader2, X, ChevronUp, ChevronDown, ArrowUpDown, RotateCcw, ClipboardList, CheckSquare, Square } from "lucide-react"
import { assetTypeLabels, brandLabels, functionStatusLabels, functionStatusColors } from "@/lib/labels"
import type { Role, AssetType, Brand, FunctionStatus } from "@/generated/prisma/enums"
import { setUserRoomAccess } from "../actions"
import { returnAsset } from "../../assets/actions"
import { useRouter } from "next/navigation"
import { useTablePrefs, type ColDef } from "@/lib/useTablePrefs"
import { useColResize } from "@/lib/useColResize"
import ColumnManager from "@/components/ColumnManager"

const roleBadge: Record<Role, string> = {
  PRIJEMCA: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  NADRIADENY: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  BEZPECNOSTNY_PRACOVNIK: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  SPRAVCA_KARIET: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  SPRAVCA_PC: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
}
const roleLabel: Record<Role, string> = {
  PRIJEMCA: "Príjemca",
  NADRIADENY: "Nadriadený",
  BEZPECNOSTNY_PRACOVNIK: "Bezp. pracovník",
  SPRAVCA_KARIET: "Správca kariet",
  SPRAVCA_PC: "Správca PC",
}

type Assignment = {
  id: number
  assetId: number
  assetType: string
  assetName: string
  assetBrand: string
  serialNumber: string | null
  functionStatus: FunctionStatus
  assignedAt: string
  assignedBy: string
  assignmentNote: string | null
  returnedAt: string | null
  returnedTo: string | null
  returnNote: string | null
  isCurrent: boolean
}

type RoomAccess = { roomId: number; roomName: string }
type AllRoom = { id: number; name: string }

interface Props {
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
    roles: Role[]
    supervisorName: string | null
  }
  assignments: Assignment[]
  roomAccesses: RoomAccess[]
  allRooms: AllRoom[]
  viewerUserId: number
  viewerName: string
  isManager: boolean
  backUrl?: string
}

const thBase = "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
const tdBase = "px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 overflow-hidden"

const CURRENT_COLS_BASE: ColDef[] = [
  { key: "id", label: "ID", fixed: true, defaultWidth: 60 },
  { key: "type", label: "Typ", fixed: true, defaultWidth: 110, sortable: true },
  { key: "name", label: "Majetok", fixed: true, defaultWidth: 200, sortable: true },
  { key: "serialNumber", label: "Výrobné číslo", defaultWidth: 150, sortable: true },
  { key: "functionStatus", label: "Stav", defaultWidth: 120, sortable: true },
  { key: "assignedAt", label: "Pridelené dňa", defaultWidth: 120, sortable: true },
  { key: "assignedBy", label: "Pridelil", defaultWidth: 130 },
  { key: "note", label: "Poznámka", defaultWidth: 170 },
  { key: "protocol", label: "PDF", defaultWidth: 70 },
]
const CURRENT_COLS_MANAGER: ColDef[] = [
  ...CURRENT_COLS_BASE,
  { key: "return", label: "Akcia", fixed: true, defaultWidth: 90 },
]

const HISTORY_COLS: ColDef[] = [
  { key: "id", label: "ID", fixed: true, defaultWidth: 60 },
  { key: "type", label: "Typ", fixed: true, defaultWidth: 110 },
  { key: "name", label: "Majetok", fixed: true, defaultWidth: 200 },
  { key: "serialNumber", label: "Výrobné číslo", defaultWidth: 150 },
  { key: "assignedAt", label: "Pridelené dňa", defaultWidth: 120 },
  { key: "assignedBy", label: "Pridelil", defaultWidth: 130 },
  { key: "note", label: "Poznámka", defaultWidth: 170 },
  { key: "returnedAt", label: "Vrátené dňa", defaultWidth: 120 },
  { key: "returnedTo", label: "Vrátené komu", defaultWidth: 130 },
  { key: "returnNote", label: "Pozn. k vráteniu", defaultWidth: 160 },
]

type CurrentSortKey = "type" | "name" | "serialNumber" | "functionStatus" | "assignedAt"

function ReturnAssetModal({
  assignment,
  viewerName,
  onClose,
}: {
  assignment: Assignment
  viewerName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [note, setNote] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError("")
    const result = await returnAsset(assignment.assetId, viewerName, note)
    setPending(false)
    if (result.error) setError(result.error)
    else { router.refresh(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Vrátiť majetok</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">
              {assetTypeLabels[assignment.assetType as AssetType] ?? assignment.assetType} · {assignment.assetName}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Majetok bude odovzdaný späť do skladu a označený ako voľný.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Poznámka k vráteniu <span className="text-gray-400 font-normal">(voliteľné)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder="napr. vrátené v poriadku, drobné škrabance..."
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Zrušiť
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Vraciam..." : "Vrátiť majetok"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function HandoverSelectModal({
  userId,
  items,
  onClose,
}: {
  userId: number
  items: Assignment[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(items.map(a => a.assetId)))

  function toggle(assetId: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(assetId) ? next.delete(assetId) : next.add(assetId)
      return next
    })
  }

  function selectAll() { setSelected(new Set(items.map(a => a.assetId))) }
  function deselectAll() { setSelected(new Set()) }

  function handleGenerate() {
    if (selected.size === 0) return
    const ids = Array.from(selected).join(",")
    window.open(`/protocol/users/${userId}/odovzdanie?ids=${ids}`, "_blank", "noopener,noreferrer")
  }

  const allSelected = selected.size === items.length
  const noneSelected = selected.size === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Odovzdávací protokol</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Vyberte majetok, ktorý chcete zahrnúť do protokolu</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Vytlačením protokolu sa stav majetku v evidencii <strong>nemení</strong>. Vrátenie je potrebné potvrdiť manuálne v systéme.
            </p>
          </div>
        </div>

        <div className="px-6 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Vybrané: <span className="font-semibold text-gray-700 dark:text-gray-200">{selected.size}</span> z {items.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              disabled={allSelected}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              <CheckSquare size={12} />Vybrať všetko
            </button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <button
              type="button"
              onClick={deselectAll}
              disabled={noneSelected}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              <Square size={12} />Odznačiť všetko
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-2 py-2">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Žiadny aktuálny majetok.</p>
          ) : (
            <div className="space-y-0.5">
              {items.map(a => {
                const checked = selected.has(a.assetId)
                return (
                  <label
                    key={a.assetId}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-colors select-none ${checked ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(a.assetId)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${checked ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"}`}>
                        {a.assetName}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
                        <span>{assetTypeLabels[a.assetType as AssetType] ?? a.assetType}</span>
                        {a.serialNumber && <><span>·</span><span className="font-mono">{a.serialNumber}</span></>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">od {a.assignedAt}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Zavrieť
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={noneSelected}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardList size={14} />
            Generovať protokol ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}

function CurrentTable({ items, viewerUserId, isManager, viewerName }: { items: Assignment[]; viewerUserId: number; isManager: boolean; viewerName: string }) {
  const [sortKey, setSortKey] = useState<CurrentSortKey>("assignedAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [returnModal, setReturnModal] = useState<Assignment | null>(null)

  const cols = isManager ? CURRENT_COLS_MANAGER : CURRENT_COLS_BASE
  const prefsKey = `ve_t_uc_curr_${viewerUserId}${isManager ? "_m" : ""}`

  const { prefs, visibleCols, movableCols, toggleHidden, reorderCols, setWidth, reset, getWidth } =
    useTablePrefs(prefsKey, cols)
  const { onResizeMouseDown } = useColResize(getWidth, setWidth)

  function handleSort(key: CurrentSortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const sorted = [...items].sort((a, b) => {
    let aVal: string
    let bVal: string
    switch (sortKey) {
      case "type": aVal = assetTypeLabels[a.assetType as AssetType] ?? a.assetType; bVal = assetTypeLabels[b.assetType as AssetType] ?? b.assetType; break
      case "name": aVal = a.assetName; bVal = b.assetName; break
      case "serialNumber": aVal = a.serialNumber ?? ""; bVal = b.serialNumber ?? ""; break
      case "functionStatus": aVal = functionStatusLabels[a.functionStatus]; bVal = functionStatusLabels[b.functionStatus]; break
      case "assignedAt": aVal = a.assignedAt; bVal = b.assignedAt; break
      default: aVal = ""; bVal = ""
    }
    const cmp = aVal.localeCompare(bVal, "sk")
    return sortDir === "asc" ? cmp : -cmp
  })

  function renderCell(key: string, a: Assignment): React.ReactNode {
    switch (key) {
      case "id": return <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">{a.assetId}</span>
      case "type": return assetTypeLabels[a.assetType as AssetType] ?? a.assetType
      case "name": return (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.assetName}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{brandLabels[a.assetBrand as Brand] ?? a.assetBrand}</div>
        </div>
      )
      case "serialNumber": return a.serialNumber ? <span className="font-mono text-xs">{a.serialNumber}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "functionStatus": return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${functionStatusColors[a.functionStatus]}`}>
          {functionStatusLabels[a.functionStatus]}
        </span>
      )
      case "assignedAt": return <span className="whitespace-nowrap">{a.assignedAt}</span>
      case "assignedBy": return a.assignedBy
      case "note": return a.assignmentNote ? <span className="truncate block" title={a.assignmentNote}>{a.assignmentNote}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "protocol": return (
        <a href={`/protocol/assets/${a.assetId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium w-fit">
          <FileText size={12} />PDF
        </a>
      )
      case "return": return isManager ? (
        <button
          onClick={() => setReturnModal(a)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium w-fit transition-colors"
        >
          <RotateCcw size={12} />Vrátiť
        </button>
      ) : null
      default: return null
    }
  }

  const totalWidth = visibleCols.reduce((sum, col) => sum + (getWidth(col.key) ?? 100), 0)

  return (
    <div>
      <div className="flex justify-end px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <ColumnManager cols={movableCols} hidden={prefs.hidden} order={prefs.order} onToggle={toggleHidden} onReorder={reorderCols} onReset={reset} />
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}>
          <colgroup>{visibleCols.map(col => <col key={col.key} style={{ width: getWidth(col.key) }} />)}</colgroup>
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {visibleCols.map(col => {
                const active = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    style={{ width: getWidth(col.key) }}
                    onClick={() => col.sortable && handleSort(col.key as CurrentSortKey)}
                    className={`relative group ${thBase} ${col.sortable ? "cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" : ""}`}
                  >
                    <div className="flex items-center gap-1 pr-2">
                      {col.label}
                      {col.sortable && (active
                        ? sortDir === "asc" ? <ChevronUp size={12} className="text-blue-500 shrink-0" /> : <ChevronDown size={12} className="text-blue-500 shrink-0" />
                        : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                      )}
                    </div>
                    <div onMouseDown={e => onResizeMouseDown(col.key, e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-gray-200/60 dark:group-hover:bg-gray-600/40 hover:!bg-blue-400/60 z-10" />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sorted.length === 0
              ? <tr><td colSpan={visibleCols.length} className="px-3 py-8 text-center text-sm text-gray-400">Žiadne záznamy.</td></tr>
              : sorted.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {visibleCols.map(col => <td key={col.key} className={tdBase}>{renderCell(col.key, a)}</td>)}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      {returnModal && (
        <ReturnAssetModal
          assignment={returnModal}
          viewerName={viewerName}
          onClose={() => setReturnModal(null)}
        />
      )}
    </div>
  )
}

function HistoryTable({ items, viewerUserId }: { items: Assignment[]; viewerUserId: number }) {
  const { prefs, visibleCols, movableCols, toggleHidden, reorderCols, setWidth, reset, getWidth } =
    useTablePrefs(`ve_t_uc_hist_${viewerUserId}`, HISTORY_COLS)
  const { onResizeMouseDown } = useColResize(getWidth, setWidth)

  function renderCell(key: string, a: Assignment): React.ReactNode {
    switch (key) {
      case "id": return <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">{a.assetId}</span>
      case "type": return assetTypeLabels[a.assetType as AssetType] ?? a.assetType
      case "name": return (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.assetName}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{brandLabels[a.assetBrand as Brand] ?? a.assetBrand}</div>
        </div>
      )
      case "serialNumber": return a.serialNumber ? <span className="font-mono text-xs">{a.serialNumber}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "assignedAt": return <span className="whitespace-nowrap">{a.assignedAt}</span>
      case "assignedBy": return a.assignedBy
      case "note": return a.assignmentNote ? <span className="truncate block" title={a.assignmentNote}>{a.assignmentNote}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "returnedAt": return a.returnedAt ? <span className="whitespace-nowrap">{a.returnedAt}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "returnedTo": return a.returnedTo ?? <span className="text-gray-300 dark:text-gray-600">—</span>
      case "returnNote": return a.returnNote ? <span className="truncate block" title={a.returnNote}>{a.returnNote}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      default: return null
    }
  }

  const totalWidth = visibleCols.reduce((sum, col) => sum + (getWidth(col.key) ?? 100), 0)

  return (
    <div>
      <div className="flex justify-end px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <ColumnManager cols={movableCols} hidden={prefs.hidden} order={prefs.order} onToggle={toggleHidden} onReorder={reorderCols} onReset={reset} />
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}>
          <colgroup>{visibleCols.map(col => <col key={col.key} style={{ width: getWidth(col.key) }} />)}</colgroup>
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {visibleCols.map(col => (
                <th key={col.key} style={{ width: getWidth(col.key) }} className={`relative group ${thBase}`}>
                  <div className="flex items-center gap-1 pr-2">{col.label}</div>
                  <div onMouseDown={e => onResizeMouseDown(col.key, e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-gray-200/60 dark:group-hover:bg-gray-600/40 hover:!bg-blue-400/60 z-10" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.length === 0
              ? <tr><td colSpan={visibleCols.length} className="px-3 py-8 text-center text-sm text-gray-400">Žiadne záznamy.</td></tr>
              : items.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {visibleCols.map(col => <td key={col.key} className={tdBase}>{renderCell(col.key, a)}</td>)}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoomAccessModal({ userId, allRooms, currentRoomIds, onClose }: { userId: number; allRooms: AllRoom[]; currentRoomIds: number[]; onClose: () => void }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set(currentRoomIds))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  function toggle(id: number) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true); setError("")
    const result = await setUserRoomAccess(userId, Array.from(selected))
    setPending(false)
    if (result.error) setError(result.error)
    else { router.refresh(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Prístupy do miestností</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Vyberte miestnosti, do ktorých má používateľ prístup</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 max-h-80 overflow-y-auto">
            {allRooms.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Žiadne miestnosti v systéme.</p>
            ) : (
              <div className="space-y-1">
                {allRooms.map(room => {
                  const checked = selected.has(room.id)
                  return (
                    <label key={room.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${checked ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(room.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className={`text-sm font-medium ${checked ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>{room.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">Vybrané: <span className="font-medium text-gray-600 dark:text-gray-300">{selected.size}</span></p>
            <div className="flex gap-2">
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Zrušiť</button>
              <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {pending && <Loader2 size={14} className="animate-spin" />}
                {pending ? "Ukladám..." : "Uložiť"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UserCardClient({ user, assignments, roomAccesses, allRooms, viewerUserId, viewerName, isManager = true, backUrl = "/dashboard/users" }: Props) {
  const [tab, setTab] = useState<"current" | "history" | "rooms">("current")
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showHandoverModal, setShowHandoverModal] = useState(false)

  const current = assignments.filter(a => a.isCurrent)
  const history = assignments.filter(a => !a.isCurrent)

  return (
    <div>
      <Link href={backUrl} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6">
        <ArrowLeft size={14} />Späť na zoznam používateľov
      </Link>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user.lastName} {user.firstName}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{user.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {user.roles.map(r => <span key={r} className={`text-sm px-2.5 py-1 rounded-full font-medium ${roleBadge[r]}`}>{roleLabel[r]}</span>)}
            </div>
            {user.supervisorName && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Nadriadený: <span className="text-gray-700 dark:text-gray-200">{user.supervisorName}</span></p>}
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-3 text-center">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl px-5 py-3">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{current.length}</p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Aktuálne</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-5 py-3">
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{assignments.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Celkom</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl px-5 py-3">
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{roomAccesses.length}</p>
                <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">Miestnosti</p>
              </div>
            </div>
            {isManager && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHandoverModal(true)}
                  disabled={current.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={current.length === 0 ? "Žiadny aktuálny majetok" : undefined}
                >
                  <ClipboardList size={14} />Odovzdávací protokol
                </button>
                <a
                  href={`/protocol/users/${user.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <FileText size={14} />Preberací protokol
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {([
            { key: "current", label: "Aktuálne pridelené", icon: Package, count: current.length, countCls: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" },
            { key: "history", label: "História vrátení", icon: Clock, count: history.length, countCls: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" },
            { key: "rooms", label: "Prístupy do miestností", icon: Building2, count: roomAccesses.length, countCls: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300" },
          ] as const).map(({ key, label, icon: Icon, count, countCls }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
            >
              <Icon size={15} />
              {label}
              {count > 0 && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${countCls}`}>{count}</span>}
            </button>
          ))}
        </div>

        {tab === "current" && <CurrentTable items={current} viewerUserId={viewerUserId} isManager={isManager} viewerName={viewerName} />}
        {tab === "history" && <HistoryTable items={history} viewerUserId={viewerUserId} />}
        {tab === "rooms" && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {roomAccesses.length === 0 ? "Používateľ nemá prístup do žiadnej miestnosti." : `Prístup do ${roomAccesses.length} ${roomAccesses.length === 1 ? "miestnosti" : "miestností"}.`}
              </p>
              {isManager && (
                <button onClick={() => setShowRoomModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                  <Pencil size={13} />Upraviť prístupy
                </button>
              )}
            </div>
            {roomAccesses.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Žiadne prístupy do miestností</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roomAccesses.map(ra => (
                  <span key={ra.roomId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium">
                    <Building2 size={13} />{ra.roomName}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showRoomModal && (
        <RoomAccessModal userId={user.id} allRooms={allRooms} currentRoomIds={roomAccesses.map(ra => ra.roomId)} onClose={() => setShowRoomModal(false)} />
      )}
      {showHandoverModal && (
        <HandoverSelectModal userId={user.id} items={current} onClose={() => setShowHandoverModal(false)} />
      )}
    </div>
  )
}
