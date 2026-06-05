"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Package, Clock, FileText, Building2, Pencil, Loader2, X, ChevronUp, ChevronDown, ArrowUpDown, RotateCcw, ClipboardList, CheckSquare, Square, Layers, Shield, ShieldCheck, Check, Link2, Link2Off, User as UserIcon } from "lucide-react"
import { assetTypeLabels, brandLabels, functionStatusLabels, functionStatusColors } from "@/lib/labels"
import type { Role, AssetType, Brand, FunctionStatus } from "@/generated/prisma/enums"
import { setUserRoomAccess, setUserUtvary, updateUser, updateUserIdentity, setLinkedUser } from "../actions"
import { returnAsset } from "../../assets/actions"
import { useRouter } from "next/navigation"
import { useTablePrefs, type ColDef } from "@/lib/useTablePrefs"
import { useColResize } from "@/lib/useColResize"
import ColumnManager from "@/components/ColumnManager"

const roleBadge: Record<Role, string> = {
  PRIJEMCA: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  NADRIADENY: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  BEZPECNOSTNY_PRACOVNIK: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  SPRAVCA_MAJETKU: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  SPRAVCA_PRACOVNYCH_CIEST: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  SPRAVCA_APLIKACIE: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  SPRAVCA_REGISTRATURY: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
  PRACOVNIK_PODATELNE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  SPRACOVATEL_REGISTRATURY: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  SPRAVCA_DOKUMENTOV: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  GESTOR_AGENDY: "bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300",
  GESTOR_DOKUMENTU: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
}
const roleLabel: Record<Role, string> = {
  PRIJEMCA: "Príjemca",
  NADRIADENY: "Nadriadený",
  BEZPECNOSTNY_PRACOVNIK: "Bezp. pracovník",
  SPRAVCA_MAJETKU: "Správca majetku",
  SPRAVCA_PRACOVNYCH_CIEST: "Správca PC",
  SPRAVCA_APLIKACIE: "Správca aplikácie",
  SPRAVCA_REGISTRATURY: "Správca registratúry",
  PRACOVNIK_PODATELNE: "Prac. podateľne",
  SPRACOVATEL_REGISTRATURY: "Spracovateľ",
  SPRAVCA_DOKUMENTOV: "Správca dokumentov",
  GESTOR_AGENDY: "Gestor agendy",
  GESTOR_DOKUMENTU: "Gestor dokumentu",
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
type UserUtvar = { utvarId: number; utvarNazov: string }
type AllUtvar = { id: number; nazov: string }
type AllUser = { id: number; firstName: string; lastName: string }

const ROLE_GROUPS: { label: string; roles: { value: Role; label: string }[] }[] = [
  { label: "Aplikácia", roles: [{ value: "SPRAVCA_APLIKACIE", label: "Správca aplikácie" }] },
  { label: "Registratúra", roles: [
    { value: "SPRAVCA_REGISTRATURY", label: "Správca registratúry" },
    { value: "PRACOVNIK_PODATELNE", label: "Prac. podateľne" },
    { value: "SPRACOVATEL_REGISTRATURY", label: "Spracovateľ registratúry" },
  ]},
  { label: "Pracovné cesty", roles: [{ value: "SPRAVCA_PRACOVNYCH_CIEST", label: "Správca pracovných ciest" }] },
  { label: "Dokumenty", roles: [
    { value: "SPRAVCA_DOKUMENTOV", label: "Správca dokumentov" },
    { value: "GESTOR_AGENDY", label: "Gestor agendy" },
    { value: "GESTOR_DOKUMENTU", label: "Gestor dokumentu" },
  ]},
  { label: "Majetok", roles: [
    { value: "SPRAVCA_MAJETKU", label: "Správca majetku" },
    { value: "PRIJEMCA", label: "Príjemca" },
  ]},
  { label: "Ostatné", roles: [
    { value: "BEZPECNOSTNY_PRACOVNIK", label: "Bezpečnostný pracovník" },
    { value: "NADRIADENY", label: "Nadriadený" },
  ]},
]

const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

interface Props {
  user: {
    id: number
    username: string
    firstName: string
    lastName: string
    email: string
    roles: Role[]
    isAdminAccount: boolean
    linkedUser: { id: number; username: string } | null
    adminAccounts: { id: number; username: string }[]
    supervisorId: number | null
    supervisorName: string | null
  }
  assignments: Assignment[]
  roomAccesses: RoomAccess[]
  allRooms: AllRoom[]
  utvary: UserUtvar[]
  allUtvary: AllUtvar[]
  allUsers: AllUser[]
  isAdmin: boolean
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

function RoleCheckboxes({ selected, onChange }: { selected: Role[]; onChange: (r: Role[]) => void }) {
  function toggle(value: Role) {
    onChange(selected.includes(value) ? selected.filter(r => r !== value) : [...selected, value])
  }
  return (
    <div className="space-y-3">
      {ROLE_GROUPS.map((group, gi) => (
        <div key={group.label}>
          {gi > 0 && <div className="border-t border-gray-100 dark:border-gray-700/60 mb-3" />}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.roles.map(({ value, label }) => {
              const checked = selected.includes(value)
              return (
                <label key={value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${checked ? "border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300"}`}>
                  <input type="checkbox" className="hidden" checked={checked} onChange={() => toggle(value)} />
                  {label}
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function RolyTab({ user, allUsers, isAdmin }: { user: Props["user"]; allUsers: AllUser[]; isAdmin: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [roles, setRoles] = useState<Role[]>(user.roles)
  const [supervisorId, setSupervisorId] = useState<string>(user.supervisorId ? String(user.supervisorId) : "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true); setError("")
    const result = await updateUser(user.id, roles, supervisorId ? parseInt(supervisorId) : null)
    setPending(false)
    if (result.error) { setError(result.error); return }
    router.refresh()
    setEditing(false)
  }

  function handleCancel() {
    setRoles(user.roles)
    setSupervisorId(user.supervisorId ? String(user.supervisorId) : "")
    setError("")
    setEditing(false)
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Roly a nadriadený</h3>
        {isAdmin && !editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
            <Pencil size={13} />Upraviť
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Roly</p>
            <div className="flex flex-wrap gap-1.5">
              {user.roles.map(r => (
                <span key={r} className={`text-sm px-2.5 py-1 rounded-full font-medium ${roleBadge[r]}`}>{roleLabel[r]}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nadriadený</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">
              {user.supervisorName ?? <span className="text-gray-400 dark:text-gray-500">— bez nadriadeného —</span>}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Roly <span className="text-red-500">*</span></p>
            <RoleCheckboxes selected={roles} onChange={setRoles} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nadriadený</label>
            <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)} className={inputCls}>
              <option value="">— bez nadriadeného —</option>
              {allUsers.filter(u => u.id !== user.id).map(u => (
                <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Zrušiť
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Ukladám..." : "Uložiť zmeny"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function UtvarModal({ userId, allUtvary, currentUtvarIds, onClose }: { userId: number; allUtvary: AllUtvar[]; currentUtvarIds: number[]; onClose: () => void }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set(currentUtvarIds))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  function toggle(id: number) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true); setError("")
    const result = await setUserUtvary(userId, Array.from(selected))
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Zaradenie do útvarov</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Používateľ môže byť zaradený vo viacerých útvaroch</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 max-h-80 overflow-y-auto">
            {allUtvary.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Žiadne útvary v systéme. Najprv ich vytvorte v sekcii Útvary.</p>
            ) : (
              <div className="space-y-1">
                {allUtvary.map(utvar => {
                  const checked = selected.has(utvar.id)
                  return (
                    <label key={utvar.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${checked ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(utvar.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className={`text-sm font-medium ${checked ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>{utvar.nazov}</span>
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

function LinkPersonModal({
  adminUserId,
  allUsers,
  onClose,
  onLinked,
}: {
  adminUserId: number
  allUsers: AllUser[]
  onClose: () => void
  onLinked: () => void
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setPending(true); setError("")
    const result = await setLinkedUser(adminUserId, selectedId)
    setPending(false)
    if (result.error) setError(result.error)
    else onLinked()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Prepojiť s osobou</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Vyberte bežný účet, ktorý patrí tej istej osobe</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-3 mb-4">
              <p className="text-xs text-orange-700 dark:text-orange-300">
                Po prepojení sa meno, priezvisko a e-mail tohto admin účtu synchronizujú z vybranej osoby.
              </p>
            </div>
            <select
              className={inputCls}
              value={selectedId ?? ""}
              onChange={e => setSelectedId(e.target.value ? parseInt(e.target.value) : null)}
              required
            >
              <option value="">— vyberte osobu —</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>
              ))}
            </select>
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Zrušiť</button>
            <button type="submit" disabled={pending || !selectedId} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Ukladám..." : <><Link2 size={14} />Prepojiť</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UserCardClient({ user, assignments, roomAccesses, allRooms, utvary, allUtvary, allUsers, isAdmin, viewerUserId, viewerName, isManager = true, backUrl = "/dashboard/users" }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"current" | "history" | "rooms" | "utvary" | "roly">("current")
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [showUtvarModal, setShowUtvarModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)

  // Inline edit identity
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [idUsername, setIdUsername] = useState(user.username)
  const [idEmail, setIdEmail] = useState(user.email)
  const [idFirstName, setIdFirstName] = useState(user.firstName)
  const [idLastName, setIdLastName] = useState(user.lastName)
  const [idPending, setIdPending] = useState(false)
  const [idError, setIdError] = useState("")

  async function handleIdentitySubmit(e: React.FormEvent) {
    e.preventDefault()
    setIdPending(true); setIdError("")
    const res = await updateUserIdentity(user.id, idUsername, idEmail, idFirstName, idLastName)
    setIdPending(false)
    if (res.error) { setIdError(res.error); return }
    router.refresh()
    setEditingIdentity(false)
  }

  function handleIdentityCancel() {
    setIdUsername(user.username)
    setIdEmail(user.email)
    setIdFirstName(user.firstName)
    setIdLastName(user.lastName)
    setIdError("")
    setEditingIdentity(false)
  }

  const current = assignments.filter(a => a.isCurrent)
  const history = assignments.filter(a => !a.isCurrent)

  return (
    <div>
      <Link href={backUrl} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6">
        <ArrowLeft size={14} />Späť na zoznam používateľov
      </Link>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-6">
            <div className="flex items-center gap-2 mb-0.5">
              {user.isAdminAccount && <ShieldCheck size={16} className="text-orange-500 shrink-0" />}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user.lastName} {user.firstName}</h1>
            </div>

            {editingIdentity ? (
              <form onSubmit={handleIdentitySubmit} className="mt-3 space-y-2 max-w-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Meno</label>
                    <input
                      type="text"
                      value={idFirstName}
                      onChange={e => setIdFirstName(e.target.value)}
                      required
                      className={inputCls}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Priezvisko</label>
                    <input
                      type="text"
                      value={idLastName}
                      onChange={e => setIdLastName(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Používateľské meno</label>
                  <input
                    type="text"
                    value={idUsername}
                    onChange={e => setIdUsername(e.target.value.toLowerCase())}
                    required
                    pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{1,49}"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={idEmail}
                    onChange={e => setIdEmail(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
                {idError && <p className="text-xs text-red-600 dark:text-red-400">{idError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={idPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60"
                  >
                    {idPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {idPending ? "Ukladám..." : "Uložiť"}
                  </button>
                  <button type="button" onClick={handleIdentityCancel} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    Zrušiť
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-mono ${user.isAdminAccount ? "text-orange-600 dark:text-orange-400" : "text-gray-400 dark:text-gray-500"}`}>
                    @{user.username}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{user.email}</span>
                  {isAdmin && (
                    <button
                      onClick={() => setEditingIdentity(true)}
                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                      title="Upraviť meno a e-mail"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>

                {/* Prepojené účty */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {user.linkedUser && (
                    <Link
                      href={`/dashboard/users/${user.linkedUser.id}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                      title="Bežný účet tejto osoby"
                    >
                      <UserIcon size={11} />
                      Bežný účet: @{user.linkedUser.username}
                    </Link>
                  )}
                  {user.adminAccounts.map(a => (
                    <Link
                      key={a.id}
                      href={`/dashboard/users/${a.id}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                      title="Administrátorský účet tejto osoby"
                    >
                      <ShieldCheck size={11} />
                      Admin účet: @{a.username}
                    </Link>
                  ))}
                  {/* Tlačidlo prepojenia — len pre admin účty bez existujúceho linku */}
                  {isAdmin && user.isAdminAccount && !user.linkedUser && (
                    <button
                      onClick={() => setShowLinkModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 text-xs hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                      title="Prepojiť s bežným účtom osoby"
                    >
                      <Link2 size={11} />
                      Prepojiť s osobou
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {user.roles.map(r => <span key={r} className={`text-sm px-2.5 py-1 rounded-full font-medium ${roleBadge[r]}`}>{roleLabel[r]}</span>)}
                </div>
                {user.supervisorName && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Nadriadený: <span className="text-gray-700 dark:text-gray-200">{user.supervisorName}</span></p>}
              </>
            )}
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
              <div className="bg-teal-50 dark:bg-teal-900/30 rounded-xl px-5 py-3">
                <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{utvary.length}</p>
                <p className="text-xs text-teal-500 dark:text-teal-400 mt-0.5">Útvary</p>
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
            { key: "utvary", label: "Útvary", icon: Layers, count: utvary.length, countCls: "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300" },
            { key: "roly", label: "Roly a nadriadený", icon: Shield, count: 0, countCls: "" },
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
        {tab === "utvary" && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {utvary.length === 0 ? "Používateľ nie je zaradený v žiadnom útvare." : `Zaradený v ${utvary.length} ${utvary.length === 1 ? "útvare" : "útvaroch"}.`}
              </p>
              {isAdmin && (
                <button onClick={() => setShowUtvarModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                  <Pencil size={13} />Upraviť zaradenie
                </button>
              )}
            </div>
            {utvary.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <Layers size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Žiadne zaradenie do útvarov</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {utvary.map(u => (
                  <span key={u.utvarId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-sm font-medium">
                    <Layers size={13} />{u.utvarNazov}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === "roly" && <RolyTab user={user} allUsers={allUsers} isAdmin={isAdmin} />}
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
      {showUtvarModal && (
        <UtvarModal userId={user.id} allUtvary={allUtvary} currentUtvarIds={utvary.map(u => u.utvarId)} onClose={() => setShowUtvarModal(false)} />
      )}
      {showLinkModal && (
        <LinkPersonModal
          adminUserId={user.id}
          allUsers={allUsers}
          onClose={() => setShowLinkModal(false)}
          onLinked={() => { router.refresh(); setShowLinkModal(false) }}
        />
      )}
    </div>
  )
}
