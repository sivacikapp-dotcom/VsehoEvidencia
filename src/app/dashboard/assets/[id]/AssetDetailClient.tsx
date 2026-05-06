"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Users,
  Building2,
  FileText,
  Calendar,
  Tag,
  Hash,
  MapPin,
  Layers,
  ShieldAlert,
  Pencil,
  X,
  Loader2,
} from "lucide-react"
import {
  assetTypeLabels,
  brandLabels,
  usagePlaceLabels,
  allocationStatusLabels,
  allocationStatusColors,
  functionStatusLabels,
  functionStatusColors,
  assetKindLabels,
} from "@/lib/labels"
import type {
  AssetType,
  Brand,
  UsagePlace,
  AllocationStatus,
  FunctionStatus,
  AssetKind,
} from "@/generated/prisma/enums"
import { updateAsset, updateSecurityNote, updateBpFields } from "../actions"
import { useTablePrefs, type ColDef } from "@/lib/useTablePrefs"
import { useColResize } from "@/lib/useColResize"
import ColumnManager from "@/components/ColumnManager"

type RecipientEntry = {
  id: number
  userName: string
  userEmail: string
  assignedAt: string
  assignedBy: string
  assignmentNote: string | null
  returnedAt: string | null
  returnedTo: string | null
  returnNote: string | null
  isCurrent: boolean
}

type RoomEntry = {
  id: number
  roomName: string
  assignedAt: string
  assignedBy: string
  assignmentNote: string | null
  removedAt: string | null
  removedBy: string | null
  removalNote: string | null
  isCurrent: boolean
}

interface Props {
  backHref: string
  asset: {
    id: number
    type: string
    name: string
    brand: string
    serialNumber: string | null
    usagePlace: string
    yearOfManufacture: number | null
    allocationStatus: AllocationStatus
    functionStatus: FunctionStatus
    kind: string
    acquisitionDate: string | null
    publicNote: string | null
    recordNote: string | null
    securityNote: string | null
    isSecurity: boolean
    createdAt: string
    bpVDomene: boolean | null
    bpNazovVDomene: string | null
    bpAktualizovanyDna: string | null
    bpEset: boolean | null
    bpImei1: string | null
    bpImei2: string | null
    bpPodporovanyDo: string | null
    bpTelefonneCislo: string | null
    bpPovolenyVDomene: boolean | null
  }
  recipientHistory: RecipientEntry[]
  roomHistory: RoomEntry[]
  isManager: boolean
  isSecurityWorker: boolean
  userId: number
}

const thBase =
  "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
const tdBase = "px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 overflow-hidden"

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  )
}

function NoteCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-0.5 opacity-60">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
      <Icon size={36} className="mb-2 opacity-25" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

// ── Recipient History Table ────────────────────────────────────────────────

const RECIPIENT_COLS: ColDef[] = [
  { key: "name", label: "Príjemca", fixed: true, defaultWidth: 160 },
  { key: "email", label: "Email", defaultWidth: 180 },
  { key: "assignedAt", label: "Pridelené dňa", defaultWidth: 120 },
  { key: "assignedBy", label: "Pridelil", defaultWidth: 130 },
  { key: "assignmentNote", label: "Poznámka pri prevzatí", defaultWidth: 170 },
  { key: "returnedAt", label: "Vrátené dňa", defaultWidth: 120 },
  { key: "returnedTo", label: "Vrátené komu", defaultWidth: 130 },
  { key: "returnNote", label: "Poznámka k vráteniu", defaultWidth: 160 },
  { key: "protocol", label: "Protokol", defaultWidth: 80 },
]

function RecipientTable({ items, userId }: { items: RecipientEntry[]; userId: number }) {
  if (items.length === 0) {
    return <EmptyState icon={Users} text="Majetok nebol nikdy pridelený príjemcovi." />
  }

  const { prefs, visibleCols, movableCols, toggleHidden, reorderCols, setWidth, reset, getWidth } =
    useTablePrefs(`ve_t_ad_rec_${userId}`, RECIPIENT_COLS)
  const { onResizeMouseDown } = useColResize(getWidth, setWidth)

  const totalWidth = visibleCols.reduce((sum, col) => sum + (getWidth(col.key) ?? 100), 0)

  function renderCell(key: string, entry: RecipientEntry): React.ReactNode {
    switch (key) {
      case "name":
        return (
          <div className="flex items-center gap-2">
            {entry.isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{entry.userName}</span>
          </div>
        )
      case "email": return <span className="text-gray-500 dark:text-gray-400">{entry.userEmail}</span>
      case "assignedAt": return <span className="whitespace-nowrap">{entry.assignedAt}</span>
      case "assignedBy": return <span className="text-gray-500 dark:text-gray-400">{entry.assignedBy}</span>
      case "assignmentNote":
        return entry.assignmentNote
          ? <span className="truncate block" title={entry.assignmentNote}>{entry.assignmentNote}</span>
          : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "returnedAt":
        return entry.returnedAt
          ? <span className="whitespace-nowrap">{entry.returnedAt}</span>
          : <span className="text-green-600 dark:text-green-400 font-medium text-xs">Aktuálne</span>
      case "returnedTo":
        return entry.returnedTo ?? <span className="text-gray-300 dark:text-gray-600">—</span>
      case "returnNote":
        return entry.returnNote
          ? <span className="truncate block" title={entry.returnNote}>{entry.returnNote}</span>
          : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "protocol":
        return (
          <a href={`/protocol/assets/${entry.id}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium w-fit">
            <FileText size={12} />PDF
          </a>
        )
      default: return null
    }
  }

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
                  <div className="pr-2">{col.label}</div>
                  <div onMouseDown={e => onResizeMouseDown(col.key, e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-gray-200/60 dark:group-hover:bg-gray-600/40 hover:!bg-blue-400/60 z-10" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map(entry => (
              <tr key={entry.id} className={
                entry.isCurrent
                  ? "bg-blue-50/60 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }>
                {visibleCols.map(col => <td key={col.key} className={tdBase}>{renderCell(col.key, entry)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Room History Table ─────────────────────────────────────────────────────

const ROOM_COLS: ColDef[] = [
  { key: "name", label: "Miestnosť", fixed: true, defaultWidth: 160 },
  { key: "assignedAt", label: "Priradené dňa", defaultWidth: 120 },
  { key: "assignedBy", label: "Pridelil", defaultWidth: 130 },
  { key: "assignmentNote", label: "Poznámka pri priradení", defaultWidth: 180 },
  { key: "removedAt", label: "Odobrané dňa", defaultWidth: 120 },
  { key: "removedBy", label: "Odobral", defaultWidth: 130 },
  { key: "removalNote", label: "Poznámka k odobraniu", defaultWidth: 180 },
]

function RoomTable({ items, userId }: { items: RoomEntry[]; userId: number }) {
  if (items.length === 0) {
    return <EmptyState icon={Building2} text="Majetok nebol nikdy priradený do miestnosti." />
  }

  const { prefs, visibleCols, movableCols, toggleHidden, reorderCols, setWidth, reset, getWidth } =
    useTablePrefs(`ve_t_ad_room_${userId}`, ROOM_COLS)
  const { onResizeMouseDown } = useColResize(getWidth, setWidth)

  const totalWidth = visibleCols.reduce((sum, col) => sum + (getWidth(col.key) ?? 100), 0)

  function renderCell(key: string, entry: RoomEntry): React.ReactNode {
    switch (key) {
      case "name":
        return (
          <div className="flex items-center gap-2">
            {entry.isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />}
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{entry.roomName}</span>
          </div>
        )
      case "assignedAt": return <span className="whitespace-nowrap">{entry.assignedAt}</span>
      case "assignedBy": return <span className="text-gray-500 dark:text-gray-400">{entry.assignedBy}</span>
      case "assignmentNote":
        return entry.assignmentNote
          ? <span className="truncate block" title={entry.assignmentNote}>{entry.assignmentNote}</span>
          : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "removedAt":
        return entry.removedAt
          ? <span className="whitespace-nowrap">{entry.removedAt}</span>
          : <span className="text-purple-600 dark:text-purple-400 font-medium text-xs">Aktuálne</span>
      case "removedBy":
        return entry.removedBy ?? <span className="text-gray-300 dark:text-gray-600">—</span>
      case "removalNote":
        return entry.removalNote
          ? <span className="truncate block" title={entry.removalNote}>{entry.removalNote}</span>
          : <span className="text-gray-300 dark:text-gray-600">—</span>
      default: return null
    }
  }

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
                  <div className="pr-2">{col.label}</div>
                  <div onMouseDown={e => onResizeMouseDown(col.key, e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-gray-200/60 dark:group-hover:bg-gray-600/40 hover:!bg-blue-400/60 z-10" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map(entry => (
              <tr key={entry.id} className={
                entry.isCurrent
                  ? "bg-purple-50/60 dark:bg-purple-900/20 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }>
                {visibleCols.map(col => <td key={col.key} className={tdBase}>{renderCell(col.key, entry)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Edit Asset Modal ───────────────────────────────────────────────────────
const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

type AssetForEdit = {
  id: number
  type: string
  name: string
  brand: string
  serialNumber: string | null
  usagePlace: string
  yearOfManufacture: number | null
  functionStatus: FunctionStatus
  kind: string
  acquisitionDate: string | null
  publicNote: string | null
  recordNote: string | null
  securityNote: string | null
  isSecurity: boolean
}

function EditAssetModal({ asset, onClose }: { asset: AssetForEdit; onClose: () => void }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  const currentYear = new Date().getFullYear()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setPending(true)
    setError("")
    const result = await updateAsset(asset.id, new FormData(formRef.current))
    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Upraviť majetok</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">#{asset.id} · {asset.name}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Identifikácia</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Typ" required>
                  <select name="type" required className={inputCls} defaultValue={asset.type}>
                    {(Object.keys(assetTypeLabels) as AssetType[]).map((k) => (
                      <option key={k} value={k}>{assetTypeLabels[k]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Značka">
                  <select name="brand" className={inputCls} defaultValue={asset.brand}>
                    {(Object.keys(brandLabels) as Brand[]).map((k) => (
                      <option key={k} value={k}>{brandLabels[k]}</option>
                    ))}
                  </select>
                </Field>
                <div className="col-span-2">
                  <Field label="Názov / Popis" required>
                    <input type="text" name="name" required defaultValue={asset.name} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Výrobné číslo (sériové)">
                    <input type="text" name="serialNumber" defaultValue={asset.serialNumber ?? ""} className={inputCls} />
                  </Field>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Klasifikácia & Stav</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Druh majetku" required>
                  <select name="kind" required className={inputCls} defaultValue={asset.kind}>
                    {(Object.keys(assetKindLabels) as AssetKind[]).map((k) => (
                      <option key={k} value={k}>{assetKindLabels[k]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Miesto použitia" required>
                  <select name="usagePlace" required className={inputCls} defaultValue={asset.usagePlace}>
                    {(Object.keys(usagePlaceLabels) as UsagePlace[]).map((k) => (
                      <option key={k} value={k}>{usagePlaceLabels[k]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Funkčný stav" required>
                  <select name="functionStatus" required className={inputCls} defaultValue={asset.functionStatus}>
                    {(Object.keys(functionStatusLabels) as FunctionStatus[]).map((k) => (
                      <option key={k} value={k}>{functionStatusLabels[k]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Rok výroby">
                  <input type="number" name="yearOfManufacture" min={1900} max={currentYear + 1} defaultValue={asset.yearOfManufacture ?? ""} className={inputCls} />
                </Field>
                <div className="col-span-2">
                  <Field label="Dátum nadobudnutia">
                    <input type="date" name="acquisitionDate" defaultValue={asset.acquisitionDate ?? ""} className={inputCls} />
                  </Field>
                </div>

                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input type="checkbox" name="isSecurity" defaultChecked={asset.isSecurity} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bezpečnostný</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Poznámky</p>
              <div className="space-y-3">
                <Field label="Verejná poznámka">
                  <textarea name="publicNote" rows={2} defaultValue={asset.publicNote ?? ""} placeholder="Viditeľná pre všetkých" maxLength={1000} className={inputCls} />
                </Field>
                <Field label="Evidenčná poznámka">
                  <textarea name="recordNote" rows={2} defaultValue={asset.recordNote ?? ""} placeholder="Interná poznámka (nie pre BP)" maxLength={1000} className={inputCls} />
                </Field>
                <Field label="BP Poznámka">
                  <textarea name="securityNote" rows={2} defaultValue={asset.securityNote ?? ""} placeholder="Pre bezpečnostného pracovníka" maxLength={2000} className={inputCls} />
                </Field>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Polia označené <span className="text-red-500">*</span> sú povinné
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                Zrušiť
              </button>
              <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {pending && <Loader2 size={14} className="animate-spin" />}
                {pending ? "Ukladám..." : "Uložiť zmeny"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

const BP_TYPES = ["Notebook", "MobilnyTelefon", "SIMKarta", "USBKluc", "ExternyDisk"] as const

type BpAsset = {
  id: number
  type: string
  bpVDomene: boolean | null
  bpNazovVDomene: string | null
  bpAktualizovanyDna: string | null
  bpEset: boolean | null
  bpImei1: string | null
  bpImei2: string | null
  bpPodporovanyDo: string | null
  bpTelefonneCislo: string | null
  bpPovolenyVDomene: boolean | null
}

function EditBpFieldsModal({ asset, onClose }: { asset: BpAsset; onClose: () => void }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setPending(true); setError("")
    const result = await updateBpFields(asset.id, new FormData(formRef.current))
    setPending(false)
    if (result.error) setError(result.error)
    else { router.refresh(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">BP polia</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {asset.type === "Notebook" && (
              <>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" name="bpVDomene" defaultChecked={asset.bpVDomene ?? false} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">V doméne</span>
                </label>
                <Field label="Názov v doméne">
                  <input type="text" name="bpNazovVDomene" defaultValue={asset.bpNazovVDomene ?? ""} className={inputCls} />
                </Field>
                <Field label="Aktualizovaný dňa">
                  <input type="date" name="bpAktualizovanyDna" defaultValue={asset.bpAktualizovanyDna ?? ""} className={inputCls} />
                </Field>
              </>
            )}
            {asset.type === "MobilnyTelefon" && (
              <>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" name="bpEset" defaultChecked={asset.bpEset ?? false} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ESET</span>
                </label>
                <Field label="IMEI 1">
                  <input type="text" name="bpImei1" defaultValue={asset.bpImei1 ?? ""} className={inputCls} />
                </Field>
                <Field label="IMEI 2">
                  <input type="text" name="bpImei2" defaultValue={asset.bpImei2 ?? ""} className={inputCls} />
                </Field>
                <Field label="Podporovaný do">
                  <input type="date" name="bpPodporovanyDo" defaultValue={asset.bpPodporovanyDo ?? ""} className={inputCls} />
                </Field>
              </>
            )}
            {asset.type === "SIMKarta" && (
              <Field label="Telefónne číslo">
                <input type="tel" name="bpTelefonneCislo" defaultValue={asset.bpTelefonneCislo ?? ""} className={inputCls} />
              </Field>
            )}
            {(asset.type === "USBKluc" || asset.type === "ExternyDisk") && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" name="bpPovolenyVDomene" defaultChecked={asset.bpPovolenyVDomene ?? false} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Povolený v doméne</span>
              </label>
            )}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Zrušiť</button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Ukladám..." : "Uložiť"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditSecurityNoteModal({ assetId, currentNote, onClose }: { assetId: number; currentNote: string | null; onClose: () => void }) {
  const router = useRouter()
  const [note, setNote] = useState(currentNote ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true); setError("")
    const result = await updateSecurityNote(assetId, note)
    setPending(false)
    if (result.error) setError(result.error)
    else { router.refresh(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Bezpečnostná poznámka</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              placeholder="Bezpečnostná poznámka..."
              maxLength={2000}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Zrušiť</button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Ukladám..." : "Uložiť"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AssetDetailClient({
  backHref,
  asset,
  recipientHistory,
  roomHistory,
  isManager,
  isSecurityWorker,
  userId,
}: Props) {
  const [tab, setTab] = useState<"recipients" | "rooms">("recipients")
  const [showEdit, setShowEdit] = useState(false)
  const [showSecurityEdit, setShowSecurityEdit] = useState(false)
  const [showBpEdit, setShowBpEdit] = useState(false)

  const hasBpFields = BP_TYPES.includes(asset.type as typeof BP_TYPES[number])

  const currentRecipient = recipientHistory.find((r) => r.isCurrent)
  const currentRoom = roomHistory.find((r) => r.isCurrent)

  return (
    <div>
      {/* Breadcrumb */}
      <Link
        href={backHref}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft size={14} />
        Späť
      </Link>

      {/* Asset header card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                {assetTypeLabels[asset.type as AssetType] ?? asset.type}
              </span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500">#{asset.id}</span>
              {isManager && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors ml-1"
                >
                  <Pencil size={11} />
                  Upraviť
                </button>
              )}
              {isSecurityWorker && (
                <button
                  onClick={() => setShowSecurityEdit(true)}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors ml-1"
                >
                  <Pencil size={11} />
                  BP Poznámka
                </button>
              )}
              {isSecurityWorker && hasBpFields && (
                <button
                  onClick={() => setShowBpEdit(true)}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-md transition-colors ml-1"
                >
                  <Pencil size={11} />
                  BP polia
                </button>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {asset.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {brandLabels[asset.brand as Brand] ?? asset.brand}
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${functionStatusColors[asset.functionStatus as FunctionStatus]}`}>
                {functionStatusLabels[asset.functionStatus as FunctionStatus]}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${allocationStatusColors[asset.allocationStatus]}`}>
                {allocationStatusLabels[asset.allocationStatus]}
              </span>
              {currentRecipient && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  👤 {currentRecipient.userName}
                </span>
              )}
              {currentRoom && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  🏠 {currentRoom.roomName}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3 text-center shrink-0">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl px-4 py-3">
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{recipientHistory.length}</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Príjemcovia</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl px-4 py-3">
              <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{roomHistory.length}</p>
              <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">Miestnosti</p>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <InfoRow icon={Hash} label="Výrobné / sériové číslo" value={asset.serialNumber} />
          <InfoRow icon={Calendar} label="Rok výroby" value={asset.yearOfManufacture} />
          {!isSecurityWorker && (
            <InfoRow icon={Calendar} label="Dátum nadobudnutia" value={asset.acquisitionDate} />
          )}
          <InfoRow icon={MapPin} label="Miesto použitia" value={usagePlaceLabels[asset.usagePlace as UsagePlace] ?? asset.usagePlace} />
          {!isSecurityWorker && (
            <InfoRow icon={Layers} label="Druh majetku" value={assetKindLabels[asset.kind as AssetKind] ?? asset.kind} />
          )}
          <InfoRow icon={Tag} label="Evidovaný od" value={asset.createdAt} />
          {asset.isSecurity && (
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Klasifikácia</p>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Bezpečnostný</p>
              </div>
            </div>
          )}
        </div>

        {/* BP fields – visible only to security worker */}
        {isSecurityWorker && hasBpFields && (
          <div className="mt-5 pt-5 border-t-2 border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert size={14} className="text-orange-500 dark:text-orange-400" />
              <p className="text-xs font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-wide">BP polia</p>
            </div>
            <div className="bg-orange-50/60 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {asset.type === "Notebook" && (
                  <>
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert size={14} className="text-orange-400 dark:text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-orange-400 dark:text-orange-500">V doméne</p>
                        <p className={`text-sm font-medium ${asset.bpVDomene ? "text-green-700 dark:text-green-400" : asset.bpVDomene === false ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
                          {asset.bpVDomene === null ? "—" : asset.bpVDomene ? "Áno" : "Nie"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Tag size={14} className="text-orange-400 dark:text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-orange-400 dark:text-orange-500">Názov v doméne</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">{asset.bpNazovVDomene ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Calendar size={14} className="text-orange-400 dark:text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-orange-400 dark:text-orange-500">Aktualizovaný dňa</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{asset.bpAktualizovanyDna ?? "—"}</p>
                      </div>
                    </div>
                  </>
                )}
                {asset.type === "MobilnyTelefon" && (
                  <>
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert size={14} className="text-orange-400 dark:text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-orange-400 dark:text-orange-500">ESET</p>
                        <p className={`text-sm font-medium ${asset.bpEset ? "text-green-700 dark:text-green-400" : asset.bpEset === false ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
                          {asset.bpEset === null ? "—" : asset.bpEset ? "Áno" : "Nie"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Hash size={14} className="text-orange-400 dark:text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-orange-400 dark:text-orange-500">IMEI 1</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">{asset.bpImei1 ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Hash size={14} className="text-orange-400 dark:text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-orange-400 dark:text-orange-500">IMEI 2</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">{asset.bpImei2 ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Calendar size={14} className="text-orange-400 dark:text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-orange-400 dark:text-orange-500">Podporovaný do</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{asset.bpPodporovanyDo ?? "—"}</p>
                      </div>
                    </div>
                  </>
                )}
                {asset.type === "SIMKarta" && (
                  <div className="flex items-start gap-2.5">
                    <Hash size={14} className="text-orange-400 dark:text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-orange-400 dark:text-orange-500">Telefónne číslo</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{asset.bpTelefonneCislo ?? "—"}</p>
                    </div>
                  </div>
                )}
                {(asset.type === "USBKluc" || asset.type === "ExternyDisk") && (
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert size={14} className="text-orange-400 dark:text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-orange-400 dark:text-orange-500">Povolený v doméne</p>
                      <p className={`text-sm font-medium ${asset.bpPovolenyVDomene ? "text-green-700 dark:text-green-400" : asset.bpPovolenyVDomene === false ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
                        {asset.bpPovolenyVDomene === null ? "—" : asset.bpPovolenyVDomene ? "Áno" : "Nie"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {(asset.publicNote || asset.recordNote || asset.securityNote) && (
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700 space-y-2">
            {asset.publicNote && (
              <NoteCard
                label="Verejná poznámka"
                value={asset.publicNote}
                accent="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800"
              />
            )}
            {asset.recordNote && isManager && (
              <NoteCard
                label="Evidenčná poznámka"
                value={asset.recordNote}
                accent="border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20"
              />
            )}
            {isSecurityWorker && asset.securityNote && (
              <div className={`rounded-lg border px-3 py-2 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-900/20`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ShieldAlert size={12} className="opacity-60" />
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-60">BP poznámka</p>
                </div>
                <p className="text-sm">{asset.securityNote}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History tabs */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setTab("recipients")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "recipients"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <Users size={15} />
            História príjemcov
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              tab === "recipients"
                ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}>
              {recipientHistory.length}
            </span>
          </button>
          <button
            onClick={() => setTab("rooms")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "rooms"
                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <Building2 size={15} />
            História miestností
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              tab === "rooms"
                ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}>
              {roomHistory.length}
            </span>
          </button>
        </div>

        {tab === "recipients" ? (
          <RecipientTable items={recipientHistory} userId={userId} />
        ) : (
          <RoomTable items={roomHistory} userId={userId} />
        )}
      </div>

      {showEdit && (
        <EditAssetModal asset={asset} onClose={() => setShowEdit(false)} />
      )}
      {showSecurityEdit && (
        <EditSecurityNoteModal assetId={asset.id} currentNote={asset.securityNote} onClose={() => setShowSecurityEdit(false)} />
      )}
      {showBpEdit && (
        <EditBpFieldsModal asset={asset} onClose={() => setShowBpEdit(false)} />
      )}
    </div>
  )
}
