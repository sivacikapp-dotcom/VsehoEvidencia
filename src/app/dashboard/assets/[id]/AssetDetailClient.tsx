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
  Paperclip,
  Trash2,
  Upload,
  AlertTriangle,
  Plus,
  MessageSquare,
  Clock,
} from "lucide-react"
import type { AssetNoteType } from "@/generated/prisma/enums"
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
import { updateBpFields, deleteAssetAttachment, updateAttachmentVisibility } from "../actions"
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

type AttachmentVisibility = "Everyone" | "ManagersAndSecurity" | "OwnRoleOnly"

type AttachmentEntry = {
  id: number
  originalName: string
  storedName: string
  size: number
  visibility: AttachmentVisibility
  uploaderRoles: string[]
  uploaderName: string
  createdAt: string
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

type NoteEntry = {
  id: number
  noteType: AssetNoteType
  content: string
  authorRole: string
  createdById: number
  createdByName: string
  createdAt: string
  updatedAt: string
}

interface PendingConfirmation {
  type: "ASSET_ASSIGNED" | "ASSET_RETURNED"
  userName: string
}

interface Props {
  backHref: string
  pendingConfirmations: PendingConfirmation[]
  asset: {
    id: number
    version: number
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
  attachments: AttachmentEntry[]
  notes: NoteEntry[]
  isManager: boolean
  isSecurityWorker: boolean
  isAppAdmin?: boolean
  isCurrentRecipient: boolean
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
  version: number
  type: string
  name: string
  brand: string
  serialNumber: string | null
  usagePlace: string
  yearOfManufacture: number | null
  functionStatus: FunctionStatus
  kind: string
  acquisitionDate: string | null
  isSecurity: boolean
}

// ── Optimistic-lock helpers ────────────────────────────────────────────────

type AssetEditForm = {
  type: string
  name: string
  brand: string
  serialNumber: string
  usagePlace: string
  yearOfManufacture: string
  kind: string
  acquisitionDate: string
  functionStatus: string
  isSecurity: boolean
}

const ALL_FORM_KEYS = [
  "type", "name", "brand", "serialNumber", "usagePlace",
  "yearOfManufacture", "kind", "acquisitionDate", "functionStatus",
  "isSecurity",
] as const

const EDIT_FIELD_LABELS: Record<string, string> = {
  type: "Typ", name: "Názov", brand: "Značka", serialNumber: "Výrobné číslo",
  usagePlace: "Miesto použitia", yearOfManufacture: "Rok výroby", kind: "Druh majetku",
  acquisitionDate: "Dátum nadobudnutia", functionStatus: "Stav funkčnosti",
  isSecurity: "Bezpečnostný",
}

function assetToForm(a: AssetForEdit): AssetEditForm {
  return {
    type: a.type, name: a.name, brand: a.brand,
    serialNumber: a.serialNumber ?? "",
    usagePlace: a.usagePlace,
    yearOfManufacture: a.yearOfManufacture?.toString() ?? "",
    kind: a.kind,
    acquisitionDate: a.acquisitionDate ?? "",
    functionStatus: a.functionStatus,
    isSecurity: a.isSecurity,
  }
}

function dbToForm(db: Record<string, unknown>): AssetEditForm {
  const rawAcq = db.acquisitionDate
  const acquisitionDate = rawAcq
    ? typeof rawAcq === "string" ? rawAcq.split("T")[0] : ""
    : ""
  return {
    type: String(db.type ?? ""),
    name: String(db.name ?? ""),
    brand: String(db.brand ?? "Neurcena"),
    serialNumber: db.serialNumber ? String(db.serialNumber) : "",
    usagePlace: String(db.usagePlace ?? ""),
    yearOfManufacture: db.yearOfManufacture != null ? String(db.yearOfManufacture) : "",
    kind: String(db.kind ?? ""),
    acquisitionDate,
    functionStatus: String(db.functionStatus ?? ""),
    isSecurity: Boolean(db.isSecurity),
  }
}

function buildPatch(form: AssetEditForm, keys: readonly (keyof AssetEditForm)[]): Record<string, unknown> {
  return Object.fromEntries(keys.map(k => [k, form[k]]))
}

function fmtFieldValue(key: string, val: string | boolean | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—"
  if (typeof val === "boolean") return val ? "Áno" : "Nie"
  const s = String(val)
  switch (key) {
    case "type": return assetTypeLabels[s as AssetType] ?? s
    case "brand": return brandLabels[s as Brand] ?? s
    case "usagePlace": return usagePlaceLabels[s as UsagePlace] ?? s
    case "kind": return assetKindLabels[s as AssetKind] ?? s
    case "functionStatus": return functionStatusLabels[s as FunctionStatus] ?? s
    default: return s
  }
}

type ConflictState = {
  version: number
  dbForm: AssetEditForm
  conflictKeys: string[]
  userPatch: Record<string, unknown>
}

function ConflictResolutionModal({
  conflictKeys, myForm, dbForm, basePatch, onResolve, onCancel,
}: {
  conflictKeys: string[]
  myForm: AssetEditForm
  dbForm: AssetEditForm
  basePatch: Record<string, unknown>
  onResolve: (resolved: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [choices, setChoices] = useState<Record<string, "mine" | "db">>(() =>
    Object.fromEntries(conflictKeys.map(k => [k, "mine" as const]))
  )

  function confirm() {
    const resolved = { ...basePatch }
    for (const key of conflictKeys) {
      if (choices[key] === "db") resolved[key] = dbForm[key as keyof AssetEditForm]
    }
    onResolve(resolved)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={18} className="text-orange-500 shrink-0" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Konflikt zmien</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Iný používateľ zmenil niektoré polia, ktoré ste práve upravili. Pre každé pole vyberte, ktorú hodnotu chcete ponechať.
        </p>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {conflictKeys.map(key => (
            <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {EDIT_FIELD_LABELS[key] ?? key}
                </p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
                <label className={`cursor-pointer p-3 transition-colors ${choices[key] === "mine" ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                  <input type="radio" className="sr-only" checked={choices[key] === "mine"} onChange={() => setChoices(p => ({ ...p, [key]: "mine" }))} />
                  <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${choices[key] === "mine" ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>
                    Moja hodnota
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                    {fmtFieldValue(key, myForm[key as keyof AssetEditForm])}
                  </p>
                </label>
                <label className={`cursor-pointer p-3 transition-colors ${choices[key] === "db" ? "bg-orange-50 dark:bg-orange-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                  <input type="radio" className="sr-only" checked={choices[key] === "db"} onChange={() => setChoices(p => ({ ...p, [key]: "db" }))} />
                  <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${choices[key] === "db" ? "text-orange-600 dark:text-orange-400" : "text-gray-400"}`}>
                    Hodnota z DB
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                    {fmtFieldValue(key, dbForm[key as keyof AssetEditForm])}
                  </p>
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            Zrušiť (bez uloženia)
          </button>
          <button onClick={confirm} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium">
            Potvrdiť a uložiť
          </button>
        </div>
      </div>
    </div>
  )
}

function EditAssetModal({ asset, onClose }: { asset: AssetForEdit; onClose: () => void }) {
  const router = useRouter()
  const original = useRef<AssetEditForm>(assetToForm(asset))
  const [form, setForm] = useState<AssetEditForm>(() => assetToForm(asset))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState<ConflictState | null>(null)

  const currentYear = new Date().getFullYear()

  function upd<K extends keyof AssetEditForm>(k: K, v: AssetEditForm[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  const dirtyKeys = ALL_FORM_KEYS.filter(k => form[k] !== original.current[k])

  async function submitPatch(ver: number, patch: Record<string, unknown>, attempt = 0) {
    setPending(true)
    setError("")
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: ver, patchData: patch }),
      })
      if (res.ok) {
        router.refresh()
        onClose()
        return
      }
      const data = await res.json()
      if (res.status === 409 && attempt < 1) {
        const dbForm = dbToForm(data.currentAsset)
        const patchKeys = Object.keys(patch)
        const dbChangedKeys = ALL_FORM_KEYS.filter(k => dbForm[k] !== original.current[k])
        const conflictKeys = dbChangedKeys.filter(k => patchKeys.includes(k))

        if (conflictKeys.length === 0) {
          // Auto-merge: accept non-conflicting DB changes into form, retry same patch
          const autoMerge = Object.fromEntries(
            dbChangedKeys.filter(k => !patchKeys.includes(k))
              .map(k => [k, dbForm[k as keyof AssetEditForm]])
          ) as Partial<AssetEditForm>
          setForm(prev => ({ ...prev, ...autoMerge }))
          await submitPatch(data.currentAsset.version, patch, attempt + 1)
        } else {
          setConflict({ version: data.currentAsset.version, dbForm, conflictKeys, userPatch: patch })
        }
        return
      }
      setError(data?.error ?? "Nastala chyba pri ukladaní. Skúste znova.")
    } finally {
      setPending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (dirtyKeys.length === 0) { onClose(); return }
    await submitPatch(asset.version, buildPatch(form, dirtyKeys))
  }

  function handleConflictResolved(resolved: Record<string, unknown>) {
    const c = conflict!
    setConflict(null)
    submitPatch(c.version, resolved, 1)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl my-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Upraviť majetok</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">#{asset.id} · {form.name}</p>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Identifikácia</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Typ" required>
                    <select name="type" required className={inputCls} value={form.type} onChange={e => upd("type", e.target.value)}>
                      {(Object.keys(assetTypeLabels) as AssetType[]).map(k => <option key={k} value={k}>{assetTypeLabels[k]}</option>)}
                    </select>
                  </Field>
                  <Field label="Značka">
                    <select name="brand" className={inputCls} value={form.brand} onChange={e => upd("brand", e.target.value)}>
                      {(Object.keys(brandLabels) as Brand[]).map(k => <option key={k} value={k}>{brandLabels[k]}</option>)}
                    </select>
                  </Field>
                  <div className="col-span-2">
                    <Field label="Názov / Popis" required>
                      <input type="text" name="name" required value={form.name} onChange={e => upd("name", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Výrobné číslo (sériové)">
                      <input type="text" name="serialNumber" value={form.serialNumber} onChange={e => upd("serialNumber", e.target.value)} pattern="[^\s]+" className={inputCls} />
                    </Field>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Klasifikácia & Stav</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Druh majetku" required>
                    <select name="kind" required className={inputCls} value={form.kind} onChange={e => upd("kind", e.target.value)}>
                      {(Object.keys(assetKindLabels) as AssetKind[]).map(k => <option key={k} value={k}>{assetKindLabels[k]}</option>)}
                    </select>
                  </Field>
                  <Field label="Miesto použitia" required>
                    <select name="usagePlace" required className={inputCls} value={form.usagePlace} onChange={e => upd("usagePlace", e.target.value)}>
                      {(Object.keys(usagePlaceLabels) as UsagePlace[]).map(k => <option key={k} value={k}>{usagePlaceLabels[k]}</option>)}
                    </select>
                  </Field>
                  <Field label="Funkčný stav" required>
                    <select name="functionStatus" required className={inputCls} value={form.functionStatus} onChange={e => upd("functionStatus", e.target.value)}>
                      {(Object.keys(functionStatusLabels) as FunctionStatus[]).map(k => <option key={k} value={k}>{functionStatusLabels[k]}</option>)}
                    </select>
                  </Field>
                  <Field label="Rok výroby">
                    <input type="number" name="yearOfManufacture" min={1900} max={currentYear + 1} value={form.yearOfManufacture} onChange={e => upd("yearOfManufacture", e.target.value)} className={inputCls} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Dátum nadobudnutia">
                      <input type="date" name="acquisitionDate" value={form.acquisitionDate} onChange={e => upd("acquisitionDate", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input type="checkbox" name="isSecurity" checked={form.isSecurity} onChange={e => upd("isSecurity", e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bezpečnostný</span>
                    </label>
                  </div>
                </div>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</p>
              ) : dirtyKeys.length > 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {dirtyKeys.length} {dirtyKeys.length === 1 ? "pole zmenené" : "polia zmenené"}
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Polia označené <span className="text-red-500">*</span> sú povinné
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  Zrušiť
                </button>
                <button type="submit" disabled={pending || dirtyKeys.length === 0} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {pending && <Loader2 size={14} className="animate-spin" />}
                  {pending ? "Ukladám..." : "Uložiť zmeny"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {conflict && (
        <ConflictResolutionModal
          conflictKeys={conflict.conflictKeys}
          myForm={form}
          dbForm={conflict.dbForm}
          basePatch={conflict.userPatch}
          onResolve={handleConflictResolved}
          onCancel={() => setConflict(null)}
        />
      )}
    </>
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
                  <input type="text" name="bpImei1" defaultValue={asset.bpImei1 ?? ""} pattern="\d*" inputMode="numeric" className={inputCls} />
                </Field>
                <Field label="IMEI 2">
                  <input type="text" name="bpImei2" defaultValue={asset.bpImei2 ?? ""} pattern="\d*" inputMode="numeric" className={inputCls} />
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

// ── Notes Panel ────────────────────────────────────────────────────────────

const NOTE_TYPE_CONFIG: Record<AssetNoteType, { label: string; accent: string; authorRole: string }> = {
  PUBLIC: {
    label: "Verejná poznámka",
    accent: "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300",
    authorRole: "PUBLIC",
  },
  RECORD: {
    label: "Evidenčná poznámka",
    accent: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300",
    authorRole: "SPRAVCA_KARIET",
  },
  SECURITY: {
    label: "BP poznámka",
    accent: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300",
    authorRole: "BEZPECNOSTNY_PRACOVNIK",
  },
}

function fmtNoteDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function NotesSection({
  assetId,
  notes,
  noteType,
  canAdd,
  canEditNote,
}: {
  assetId: number
  notes: NoteEntry[]
  noteType: AssetNoteType
  canAdd: boolean
  canEditNote: (note: NoteEntry) => boolean
}) {
  const router = useRouter()
  const cfg = NOTE_TYPE_CONFIG[noteType]
  const [adding, setAdding] = useState(false)
  const [addText, setAddText] = useState("")
  const [addPending, setAddPending] = useState(false)
  const [addError, setAddError] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [editPending, setEditPending] = useState(false)
  const [editError, setEditError] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleAdd() {
    if (!addText.trim()) return
    setAddPending(true); setAddError("")
    try {
      const res = await fetch(`/api/assets/${assetId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteType, content: addText }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error ?? "Chyba"); return }
      setAddText(""); setAdding(false); router.refresh()
    } catch { setAddError("Nastala chyba.") }
    finally { setAddPending(false) }
  }

  function startEdit(note: NoteEntry) {
    setEditingId(note.id); setEditText(note.content); setEditError("")
  }

  async function handleEdit(noteId: number) {
    if (!editText.trim()) return
    setEditPending(true); setEditError("")
    try {
      const res = await fetch(`/api/assets/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error ?? "Chyba"); return }
      setEditingId(null); router.refresh()
    } catch { setEditError("Nastala chyba.") }
    finally { setEditPending(false) }
  }

  async function handleDelete(noteId: number) {
    setDeletingId(noteId)
    try {
      await fetch(`/api/assets/notes/${noteId}`, { method: "DELETE" })
      router.refresh()
    } catch {}
    finally { setDeletingId(null) }
  }

  return (
    <div className="space-y-2">
      {notes.length === 0 && !adding && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Žiadne poznámky</p>
      )}
      {notes.map((note) => (
        <div key={note.id} className={`rounded-lg border px-3 py-2 ${cfg.accent}`}>
          {editingId === note.id ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={3}
                maxLength={2000}
                autoFocus
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {editError && <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Zrušiť</button>
                <button onClick={() => handleEdit(note.id)} disabled={editPending || !editText.trim()} className="flex items-center gap-1 px-3 py-1 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {editPending && <Loader2 size={11} className="animate-spin" />}
                  {editPending ? "Ukladám..." : "Uložiť"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <p className="text-[11px] opacity-60">
                  {note.createdByName} · {fmtNoteDate(note.createdAt)}
                  {note.updatedAt !== note.createdAt && " (upravené)"}
                </p>
                {canEditNote(note) && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(note)}
                      className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      title="Upraviť"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      disabled={deletingId === note.id}
                      className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
                      title="Zmazať"
                    >
                      {deletingId === note.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ))}

      {adding ? (
        <div className="space-y-2">
          <textarea
            value={addText}
            onChange={e => setAddText(e.target.value)}
            rows={3}
            maxLength={2000}
            autoFocus
            placeholder="Obsah poznámky..."
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {addError && <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setAddText(""); setAddError("") }} className="px-3 py-1 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Zrušiť</button>
            <button onClick={handleAdd} disabled={addPending || !addText.trim()} className="flex items-center gap-1 px-3 py-1 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {addPending && <Loader2 size={11} className="animate-spin" />}
              {addPending ? "Ukladám..." : "Pridať"}
            </button>
          </div>
        </div>
      ) : canAdd && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Plus size={12} />
          Pridať poznámku
        </button>
      )}
    </div>
  )
}

// ── Attachments Panel ──────────────────────────────────────────────────────

const VISIBILITY_LABELS: Record<AttachmentVisibility, string> = {
  Everyone: "Každý s prístupom",
  ManagersAndSecurity: "Správca kariet a BP",
  OwnRoleOnly: "Iba moja rola",
}

const VISIBILITY_COLORS: Record<AttachmentVisibility, string> = {
  Everyone: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  ManagersAndSecurity: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  OwnRoleOnly: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function AttachmentsPanel({
  assetId,
  attachments,
  canUpload,
  isManager,
  isSecurityWorker,
}: {
  assetId: number
  attachments: AttachmentEntry[]
  canUpload: boolean
  isManager: boolean
  isSecurityWorker: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [visibility, setVisibility] = useState<AttachmentVisibility>("Everyone")
  const hasBothRoles = isManager && isSecurityWorker
  const [ownRoleSelection, setOwnRoleSelection] = useState<string[]>(
    isManager && isSecurityWorker ? [] : isManager ? ["SPRAVCA_KARIET"] : ["BEZPECNOSTNY_PRACOVNIK"]
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editVisibility, setEditVisibility] = useState<AttachmentVisibility>("Everyone")
  const [editRoleSelection, setEditRoleSelection] = useState<string[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")

  function startEdit(a: AttachmentEntry) {
    setEditingId(a.id)
    setEditVisibility(a.visibility)
    const editorRoles: string[] = []
    if (isManager) editorRoles.push("SPRAVCA_KARIET")
    if (isSecurityWorker) editorRoles.push("BEZPECNOSTNY_PRACOVNIK")
    setEditRoleSelection(a.uploaderRoles.filter((r) => editorRoles.includes(r)))
    setEditError("")
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError("")
  }

  function toggleEditRole(role: string) {
    setEditRoleSelection((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  async function handleSaveVisibility(attachmentId: number) {
    setEditSaving(true)
    setEditError("")
    const result = await updateAttachmentVisibility(
      attachmentId,
      editVisibility,
      editVisibility === "OwnRoleOnly" ? editRoleSelection : undefined
    )
    setEditSaving(false)
    if (result.error) {
      setEditError(result.error)
    } else {
      setEditingId(null)
      router.refresh()
    }
  }

  function toggleOwnRole(role: string) {
    setOwnRoleSelection(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setUploadError("")
    const fd = new FormData()
    fd.append("file", file)
    fd.append("assetId", String(assetId))
    fd.append("visibility", visibility)
    if (visibility === "OwnRoleOnly") {
      fd.append("visibilityRoles", JSON.stringify(ownRoleSelection))
    }
    try {
      const res = await fetch("/api/attachments", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error ?? "Chyba pri nahrávaní.")
      } else {
        setFile(null)
        if (fileRef.current) fileRef.current.value = ""
        router.refresh()
      }
    } catch {
      setUploadError("Chyba pri nahrávaní. Skúste znova.")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    setDeleteError("")
    const result = await deleteAssetAttachment(id)
    setDeletingId(null)
    if (result.error) setDeleteError(result.error)
    else router.refresh()
  }

  return (
    <div className="p-5 space-y-5">
      {canUpload && (
        <form onSubmit={handleUpload} className="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Nahrať prílohu</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Súbor</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 dark:hover:file:bg-gray-600 cursor-pointer"
              />
            </div>
            <div className="sm:w-56">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kto vidí prílohu</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as AttachmentVisibility)}
                className={inputCls}
              >
                <option value="Everyone">Každý s prístupom k majetku</option>
                <option value="ManagersAndSecurity">Správca kariet a Bezpečnostný pracovník</option>
                <option value="OwnRoleOnly">Iba moja rola</option>
              </select>
            </div>
          </div>
          {visibility === "OwnRoleOnly" && hasBothRoles && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 space-y-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Máte obe role — vyberte, pre ktorú rolu platí toto obmedzenie:
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ownRoleSelection.includes("SPRAVCA_KARIET")}
                    onChange={() => toggleOwnRole("SPRAVCA_KARIET")}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Správca kariet</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ownRoleSelection.includes("BEZPECNOSTNY_PRACOVNIK")}
                    onChange={() => toggleOwnRole("BEZPECNOSTNY_PRACOVNIK")}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Bezpečnostný pracovník</span>
                </label>
              </div>
              {ownRoleSelection.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Vyberte aspoň jednu rolu.</p>
              )}
            </div>
          )}
          {uploadError && <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!file || uploading || (visibility === "OwnRoleOnly" && hasBothRoles && ownRoleSelection.length === 0)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? "Nahrávam..." : "Nahrať"}
            </button>
          </div>
        </form>
      )}

      {deleteError && <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>}

      {attachments.length === 0 ? (
        <EmptyState icon={Paperclip} text="Žiadne prílohy." />
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li key={a.id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                <Paperclip size={15} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{a.originalName}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatSize(a.size)} · {a.uploaderName} · {a.createdAt}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${VISIBILITY_COLORS[a.visibility]}`}>
                  {VISIBILITY_LABELS[a.visibility]}
                </span>
                <a
                  href={`/api/assets/file/${a.storedName}`}
                  download={a.originalName}
                  className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shrink-0"
                  title="Stiahnuť"
                >
                  <FileText size={15} />
                </a>
                {canUpload && (
                  <>
                    <button
                      onClick={() => editingId === a.id ? cancelEdit() : startEdit(a)}
                      className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                        editingId === a.id
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                          : "text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      }`}
                      title="Upraviť prístup"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0 disabled:opacity-40"
                      title="Zmazať prílohu"
                    >
                      {deletingId === a.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </>
                )}
              </div>

              {editingId === a.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Upraviť prístup</p>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-48">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kto vidí prílohu</label>
                      <select
                        value={editVisibility}
                        onChange={(e) => setEditVisibility(e.target.value as AttachmentVisibility)}
                        className={inputCls}
                      >
                        <option value="Everyone">Každý s prístupom k majetku</option>
                        <option value="ManagersAndSecurity">Správca kariet a Bezpečnostný pracovník</option>
                        <option value="OwnRoleOnly">Iba moja rola</option>
                      </select>
                    </div>
                  </div>
                  {editVisibility === "OwnRoleOnly" && hasBothRoles && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 space-y-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Pre ktorú rolu platí obmedzenie?
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editRoleSelection.includes("SPRAVCA_KARIET")}
                            onChange={() => toggleEditRole("SPRAVCA_KARIET")}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Správca kariet</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editRoleSelection.includes("BEZPECNOSTNY_PRACOVNIK")}
                            onChange={() => toggleEditRole("BEZPECNOSTNY_PRACOVNIK")}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Bezpečnostný pracovník</span>
                        </label>
                      </div>
                      {editRoleSelection.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Vyberte aspoň jednu rolu.</p>
                      )}
                    </div>
                  )}
                  {editError && <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Zrušiť
                    </button>
                    <button
                      onClick={() => handleSaveVisibility(a.id)}
                      disabled={editSaving || (editVisibility === "OwnRoleOnly" && hasBothRoles && editRoleSelection.length === 0)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {editSaving && <Loader2 size={12} className="animate-spin" />}
                      {editSaving ? "Ukladám..." : "Uložiť"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AssetDetailClient({
  backHref,
  pendingConfirmations,
  asset,
  recipientHistory,
  roomHistory,
  attachments,
  notes,
  isManager,
  isSecurityWorker,
  isAppAdmin = false,
  isCurrentRecipient,
  userId,
}: Props) {
  const [tab, setTab] = useState<"recipients" | "rooms" | "attachments">("recipients")
  const canUpload = !isAppAdmin && (isManager || isSecurityWorker)
  const [showEdit, setShowEdit] = useState(false)
  const [showBpEdit, setShowBpEdit] = useState(false)

  const publicNotes = notes.filter(n => n.noteType === "PUBLIC")
  const recordNotes = notes.filter(n => n.noteType === "RECORD")
  const securityNotes = notes.filter(n => n.noteType === "SECURITY")

  const hasBpFields = BP_TYPES.includes(asset.type as typeof BP_TYPES[number])

  const currentRecipient = recipientHistory.find((r) => r.isCurrent)
  const currentRoom = roomHistory.find((r) => r.isCurrent)

  return (
    <div>
      {isAppAdmin && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg text-sm text-violet-700 dark:text-violet-300">
          Režim len na čítanie — údaje majetku sú skryté okrem ID.
        </div>
      )}
      {/* V procese banner */}
      {pendingConfirmations.length > 0 && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Clock size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Zmena v procese</p>
              <ul className="mt-1 space-y-0.5">
                {pendingConfirmations.map((pc, i) => (
                  <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                    {pc.type === "ASSET_ASSIGNED"
                      ? `Čaká sa na potvrdenie pridelenia od: ${pc.userName}`
                      : `Čaká sa na potvrdenie odobrania od: ${pc.userName}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
        {!isAppAdmin && (
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Poznámky</p>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Verejná poznámka</p>
                <NotesSection
                  assetId={asset.id}
                  notes={publicNotes}
                  noteType="PUBLIC"
                  canAdd={isManager || isSecurityWorker || isCurrentRecipient}
                  canEditNote={(note) => {
                    if (note.authorRole === "SPRAVCA_KARIET") return isManager
                    if (note.authorRole === "BEZPECNOSTNY_PRACOVNIK") return isSecurityWorker
                    if (note.authorRole === "PRIJEMCA") return note.createdById === userId
                    return false
                  }}
                />
              </div>
              {isManager && (
                <div>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">Evidenčná poznámka</p>
                  <NotesSection
                    assetId={asset.id}
                    notes={recordNotes}
                    noteType="RECORD"
                    canAdd={true}
                    canEditNote={(note) => note.authorRole === "SPRAVCA_KARIET" && isManager}
                  />
                </div>
              )}
              {isSecurityWorker && (
                <div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                    <ShieldAlert size={12} />
                    BP poznámka
                  </p>
                  <NotesSection
                    assetId={asset.id}
                    notes={securityNotes}
                    noteType="SECURITY"
                    canAdd={true}
                    canEditNote={(note) => note.authorRole === "BEZPECNOSTNY_PRACOVNIK" && isSecurityWorker}
                  />
                </div>
              )}
            </div>
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
          <button
            onClick={() => setTab("attachments")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "attachments"
                ? "border-green-600 text-green-600 dark:text-green-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <Paperclip size={15} />
            Prílohy
            {attachments.length > 0 && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                tab === "attachments"
                  ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}>
                {attachments.length}
              </span>
            )}
          </button>
        </div>

        {tab === "recipients" ? (
          <RecipientTable items={recipientHistory} userId={userId} />
        ) : tab === "rooms" ? (
          <RoomTable items={roomHistory} userId={userId} />
        ) : (
          <AttachmentsPanel assetId={asset.id} attachments={attachments} canUpload={canUpload} isManager={isManager} isSecurityWorker={isSecurityWorker} />
        )}
      </div>

      {showEdit && (
        <EditAssetModal asset={asset} onClose={() => setShowEdit(false)} />
      )}
      {showBpEdit && (
        <EditBpFieldsModal asset={asset} onClose={() => setShowBpEdit(false)} />
      )}
    </div>
  )
}
