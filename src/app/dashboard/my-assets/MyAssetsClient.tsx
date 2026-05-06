"use client"

import { useState } from "react"
import { Package, FileText, ChevronDown, ChevronUp } from "lucide-react"
import {
  assetTypeLabels, brandLabels, usagePlaceLabels, functionStatusLabels, functionStatusColors, assetKindLabels,
} from "@/lib/labels"
import type { AssetType, Brand, UsagePlace, FunctionStatus, AssetKind } from "@/generated/prisma/enums"
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
  publicNote: string | null
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

interface Props {
  assignments: Assignment[]
  userName: string
  userId: number
}

function StatusBadge({ status }: { status: string }) {
  const colorCls = functionStatusColors[status as FunctionStatus] ?? "bg-gray-100 text-gray-600"
  const label = functionStatusLabels[status as FunctionStatus] ?? status
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorCls}`}>{label}</span>
}

function InfoPair({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 dark:text-gray-200">{value ?? "—"}</p>
    </div>
  )
}

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
  { key: "protocol", label: "Protokol", defaultWidth: 80 },
]

const thBase = "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
const tdBase = "px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 overflow-hidden"

export default function MyAssetsClient({ assignments, userName, userId }: Props) {
  const current = assignments.filter(a => a.isCurrent)
  const history = assignments.filter(a => !a.isCurrent)
  const [historyOpen, setHistoryOpen] = useState(false)

  const { prefs, visibleCols, movableCols, toggleHidden, reorderCols, setWidth, reset, getWidth } =
    useTablePrefs(`ve_t_ma_hist_${userId}`, HISTORY_COLS)
  const { onResizeMouseDown } = useColResize(getWidth, setWidth)

  function renderCell(key: string, a: Assignment): React.ReactNode {
    switch (key) {
      case "id": return <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">{a.assetId}</span>
      case "type": return assetTypeLabels[a.assetType as AssetType] ?? a.assetType
      case "name": return <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">{a.assetName}</span>
      case "serialNumber": return a.serialNumber ? <span className="font-mono text-xs">{a.serialNumber}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "assignedAt": return <span className="whitespace-nowrap">{a.assignedAt}</span>
      case "assignedBy": return a.assignedBy
      case "note": return a.assignmentNote ? <span className="truncate block" title={a.assignmentNote}>{a.assignmentNote}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "returnedAt": return a.returnedAt ? <span className="whitespace-nowrap">{a.returnedAt}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "returnedTo": return a.returnedTo ?? <span className="text-gray-300 dark:text-gray-600">—</span>
      case "protocol": return (
        <a href={`/protocol/assets/${a.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium w-fit">
          <FileText size={12} />PDF
        </a>
      )
      default: return null
    }
  }

  const totalWidth = visibleCols.reduce((sum, col) => sum + (getWidth(col.key) ?? 100), 0)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Moje priradenia</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Majetok aktuálne pridelený na meno: <span className="font-medium text-gray-700 dark:text-gray-300">{userName}</span>
        </p>
      </div>

      {/* Current assignments – cards */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Aktuálne priradené · {current.length}
        </h2>
        {current.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Package size={40} className="mb-3 opacity-20" />
            <p className="text-sm">Momentálne nemáte priradený žiadny majetok.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {current.map(a => (
              <div key={a.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{assetTypeLabels[a.assetType as AssetType] ?? a.assetType} · #{a.assetId}</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 leading-snug truncate">{a.assetName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{brandLabels[a.assetBrand as Brand] ?? a.assetBrand}</p>
                  </div>
                  <StatusBadge status={a.functionStatus} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoPair label="Výrobné číslo" value={a.serialNumber} />
                  <InfoPair label="Rok výroby" value={a.yearOfManufacture} />
                  <InfoPair label="Miesto použitia" value={usagePlaceLabels[a.usagePlace as UsagePlace] ?? a.usagePlace} />
                  <InfoPair label="Pridelené dňa" value={a.assignedAt} />
                  <InfoPair label="Pridelil" value={a.assignedBy} />
                </div>
                {a.assignmentNote && (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-2">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Poznámka pri prevzatí</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{a.assignmentNote}</p>
                  </div>
                )}
                {a.publicNote && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-3 py-2">
                    <p className="text-xs text-blue-400 dark:text-blue-400 mb-0.5">Verejná poznámka</p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">{a.publicNote}</p>
                  </div>
                )}
                <a href={`/protocol/assets/${a.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 mt-auto px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <FileText size={14} />Protokol o odovzdaní (PDF)
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      {history.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setHistoryOpen(o => !o)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            História vrátení · {history.length}
          </button>

          {historyOpen && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                          <div className="pr-2">{col.label}</div>
                          <div onMouseDown={e => onResizeMouseDown(col.key, e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-gray-200/60 dark:group-hover:bg-gray-600/40 hover:!bg-blue-400/60 z-10" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {history.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        {visibleCols.map(col => <td key={col.key} className={tdBase}>{renderCell(col.key, a)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
