"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, ChevronDown, ChevronUp, ChevronRight, ArrowUpDown, Loader2, X, Users, Pencil, RotateCcw } from "lucide-react"
import { createRoom, deleteRoom, setRoomAccess } from "./actions"
import { returnAsset } from "../assets/actions"
import { assetTypeLabels, functionStatusLabels, functionStatusColors } from "@/lib/labels"
import type { AssetType, FunctionStatus } from "@/generated/prisma/enums"
import { useTablePrefs, type ColDef } from "@/lib/useTablePrefs"
import { useColResize } from "@/lib/useColResize"
import ColumnManager from "@/components/ColumnManager"

type RoomAccess = { userId: number; userName: string }

type Room = {
  id: number
  name: string
  activeAssetCount: number
  assets: {
    id: number
    type: string
    name: string
    serialNumber: string | null
    functionStatus: FunctionStatus
    assignedAt: string
  }[]
  accesses: RoomAccess[]
}

type AllUser = { id: number; firstName: string; lastName: string }

const ASSET_COLS: ColDef[] = [
  { key: "id", label: "ID", fixed: true, defaultWidth: 60 },
  { key: "type", label: "Typ", fixed: true, defaultWidth: 110, sortable: true },
  { key: "name", label: "Názov", fixed: true, defaultWidth: 200, sortable: true },
  { key: "serialNumber", label: "Výrobné číslo", defaultWidth: 150, sortable: true },
  { key: "functionStatus", label: "Stav", defaultWidth: 120, sortable: true },
  { key: "assignedAt", label: "Priradené od", defaultWidth: 120, sortable: true },
  { key: "return", label: "Akcia", fixed: true, defaultWidth: 90 },
]

type AssetSortCol = "type" | "name" | "serialNumber" | "functionStatus" | "assignedAt"

function NewRoomModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true); setError("")
    const result = await createRoom(name)
    setPending(false)
    if (result.error) setError(result.error)
    else { router.refresh(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nová miestnosť</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Názov miestnosti <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="napr. Kancelária 101, Sklad B" className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
            {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Zrušiť</button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />}{pending ? "Ukladám..." : "Vytvoriť"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RoomAccessModal({ room, allUsers, onClose }: { room: Room; allUsers: AllUser[]; onClose: () => void }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set(room.accesses.map(a => a.userId)))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  function toggle(id: number) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true); setError("")
    const result = await setRoomAccess(room.id, Array.from(selected))
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Prístup do miestnosti</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{room.name}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 max-h-80 overflow-y-auto">
            {allUsers.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Žiadni používatelia v systéme.</p>
            ) : (
              <div className="space-y-1">
                {allUsers.map(u => {
                  const checked = selected.has(u.id)
                  return (
                    <label key={u.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${checked ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(u.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className={`text-sm font-medium ${checked ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>{u.lastName} {u.firstName}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">Vybraní: <span className="font-medium text-gray-600 dark:text-gray-300">{selected.size}</span></p>
            <div className="flex gap-2">
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Zrušiť</button>
              <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {pending && <Loader2 size={14} className="animate-spin" />}{pending ? "Ukladám..." : "Uložiť"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReturnAssetModal({
  assetId,
  assetName,
  assetType,
  userName,
  onClose,
}: {
  assetId: number
  assetName: string
  assetType: string
  userName: string
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
    const result = await returnAsset(assetId, userName, note)
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Vybrať z miestnosti</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">
              {assetTypeLabels[assetType as AssetType] ?? assetType} · {assetName}
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
                Majetok bude vybraný z miestnosti a označený ako voľný.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Poznámka <span className="text-gray-400 font-normal">(voliteľné)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder="napr. presunuté do inej miestnosti..."
                maxLength={500}
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
              {pending ? "Vyberám..." : "Vybrať z miestnosti"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RoomsClient({ rooms, allUsers, userId, userName }: { rooms: Room[]; allUsers: AllUser[]; userId: number; userName: string }) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [accessRoom, setAccessRoom] = useState<Room | null>(null)
  const [returnModal, setReturnModal] = useState<{ assetId: number; assetName: string; assetType: string } | null>(null)
  const [sortCol, setSortCol] = useState<AssetSortCol>("assignedAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const { prefs, visibleCols, movableCols, toggleHidden, reorderCols, setWidth, reset, getWidth } =
    useTablePrefs(`ve_t_rooms_${userId}`, ASSET_COLS)
  const { onResizeMouseDown } = useColResize(getWidth, setWidth)

  function handleSort(col: AssetSortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("asc") }
  }

  function sortAssets(assets: Room["assets"]) {
    return [...assets].sort((a, b) => {
      let aVal = ""
      let bVal = ""
      switch (sortCol) {
        case "type": aVal = assetTypeLabels[a.type as AssetType] ?? a.type; bVal = assetTypeLabels[b.type as AssetType] ?? b.type; break
        case "name": aVal = a.name; bVal = b.name; break
        case "serialNumber": aVal = a.serialNumber ?? ""; bVal = b.serialNumber ?? ""; break
        case "functionStatus": aVal = functionStatusLabels[a.functionStatus]; bVal = functionStatusLabels[b.functionStatus]; break
        case "assignedAt": aVal = a.assignedAt; bVal = b.assignedAt; break
      }
      const cmp = aVal.localeCompare(bVal, "sk")
      return sortDir === "asc" ? cmp : -cmp
    })
  }

  function renderCell(key: string, a: Room["assets"][number]): React.ReactNode {
    switch (key) {
      case "id": return <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">{a.id}</span>
      case "type": return <span className="text-gray-600 dark:text-gray-400">{assetTypeLabels[a.type as AssetType] ?? a.type}</span>
      case "name": return <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">{a.name}</span>
      case "serialNumber": return a.serialNumber ? <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{a.serialNumber}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "functionStatus": return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${functionStatusColors[a.functionStatus]}`}>
          {functionStatusLabels[a.functionStatus]}
        </span>
      )
      case "assignedAt": return <span className="text-gray-500 dark:text-gray-400">{a.assignedAt}</span>
      case "return": return (
        <button
          onClick={() => setReturnModal({ assetId: a.id, assetName: a.name, assetType: a.type })}
          className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium w-fit transition-colors"
        >
          <RotateCcw size={12} />Vybrať
        </button>
      )
      default: return null
    }
  }

  async function handleDelete(room: Room) {
    if (!confirm(`Naozaj zmazať miestnosť „${room.name}"?`)) return
    const result = await deleteRoom(room.id)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  const totalWidth = visibleCols.reduce((sum, col) => sum + (getWidth(col.key) ?? 100), 0)

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Miestnosti</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{rooms.length} miestností</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={15} />Nová miestnosť
        </button>
      </div>

      <div className="space-y-2">
        {rooms.map(room => {
          const isOpen = expanded === room.id
          return (
            <div key={room.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setExpanded(isOpen ? null : room.id)} className="flex items-center gap-2 flex-1 text-left">
                  {isOpen ? <ChevronDown size={16} className="text-gray-400 dark:text-gray-500 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{room.name}</span>
                </button>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${room.activeAssetCount > 0 ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                  {room.activeAssetCount} {room.activeAssetCount === 1 ? "kus" : "kusov"}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${room.accesses.length > 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"}`}>
                  <Users size={11} />{room.accesses.length}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{room.id}</span>
                <button onClick={() => handleDelete(room)} className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Zmazať miestnosť">
                  <Trash2 size={14} />
                </button>
              </div>

              {isOpen && (
                <>
                  {room.assets.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between px-4 pt-3 pb-1">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Majetok v miestnosti</p>
                        <ColumnManager cols={movableCols} hidden={prefs.hidden} order={prefs.order} onToggle={toggleHidden} onReorder={reorderCols} onReset={reset} />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}>
                          <colgroup>{visibleCols.map(col => <col key={col.key} style={{ width: getWidth(col.key) }} />)}</colgroup>
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              {visibleCols.map(col => {
                                const active = sortCol === col.key
                                return (
                                  <th
                                    key={col.key}
                                    style={{ width: getWidth(col.key) }}
                                    onClick={() => col.sortable && handleSort(col.key as AssetSortCol)}
                                    className={`relative group px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap overflow-hidden ${col.sortable ? "cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" : ""}`}
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
                            {sortAssets(room.assets).map(a => (
                              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                {visibleCols.map(col => (
                                  <td key={col.key} className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 overflow-hidden">
                                    {renderCell(col.key, a)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Osoby s prístupom</p>
                      <button onClick={() => setAccessRoom(room)} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                        <Pencil size={11} />Upraviť
                      </button>
                    </div>
                    {room.accesses.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 italic">Žiadna osoba nemá prístup do tejto miestnosti.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {room.accesses.map(a => (
                          <span key={a.userId} className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">{a.userName}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {showNew && <NewRoomModal onClose={() => setShowNew(false)} />}
      {accessRoom && <RoomAccessModal room={accessRoom} allUsers={allUsers} onClose={() => setAccessRoom(null)} />}
      {returnModal && (
        <ReturnAssetModal
          assetId={returnModal.assetId}
          assetName={returnModal.assetName}
          assetType={returnModal.assetType}
          userName={userName}
          onClose={() => setReturnModal(null)}
        />
      )}
    </div>
  )
}
