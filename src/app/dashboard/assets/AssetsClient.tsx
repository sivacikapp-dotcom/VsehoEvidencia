"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Search, ChevronDown, ChevronUp, ArrowUpDown, Loader2, RotateCcw, UserPlus, ExternalLink, X, Clock as ClockIcon } from "lucide-react"
import NewAssetModal from "./NewAssetModal"
import AssignModal from "./AssignModal"
import { returnAsset } from "./actions"
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
import { AssetType, Brand, UsagePlace, AllocationStatus } from "@/generated/prisma/enums"
import type { FunctionStatus, Role } from "@/generated/prisma/enums"
import { useTablePrefs, type ColDef } from "@/lib/useTablePrefs"
import { useColResize } from "@/lib/useColResize"
import ColumnManager from "@/components/ColumnManager"

type Asset = {
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
  isSecurity: boolean
  currentRecipient: { id: number; name: string } | null
  currentRoom: { id: number; name: string } | null
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

interface Props {
  assets: Asset[]
  users: { id: number; firstName: string; lastName: string; email: string }[]
  rooms: { id: number; name: string }[]
  userRoles: Role[]
  currentUserName: string
  currentUserId: number
  isAppAdmin?: boolean
}

function Badge({ label, colorCls }: { label: string; colorCls: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorCls}`}>
      {label}
    </span>
  )
}

const inputCls =
  "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

function MultiSelect({
  placeholder, options, selected, onChange,
}: {
  placeholder: string
  options: { value: string; label: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  function toggle(value: string) {
    const next = new Set(selected)
    next.has(value) ? next.delete(value) : next.add(value)
    onChange(next)
  }
  const label =
    selected.size === 0
      ? placeholder
      : selected.size === 1
        ? options.find((o) => selected.has(o.value))?.label ?? placeholder
        : `${placeholder} · ${selected.size}`
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-sm rounded-lg border transition-colors ${
          selected.size > 0
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        <span className="whitespace-nowrap">{label}</span>
        {selected.size > 0 && (
          <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold shrink-0">
            {selected.size}
          </span>
        )}
        <ChevronDown size={13} className={`text-current opacity-60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg min-w-[180px] max-h-64 overflow-y-auto py-1">
            {selected.size > 0 && (
              <>
                <button type="button" onClick={() => onChange(new Set())} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <X size={11} />Zrušiť výber
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              </>
            )}
            {options.map(({ value, label: optLabel }) => {
              const checked = selected.has(value)
              return (
                <label key={value} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(value)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0" />
                  <span className={`text-sm ${checked ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-700 dark:text-gray-300"}`}>{optLabel}</span>
                </label>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

const typeOptions = (Object.keys(assetTypeLabels) as AssetType[]).map(k => ({ value: k, label: assetTypeLabels[k] }))
const brandOptions = (Object.keys(brandLabels) as Brand[]).map(k => ({ value: k, label: brandLabels[k] }))
const placeOptions = (Object.keys(usagePlaceLabels) as UsagePlace[]).map(k => ({ value: k, label: usagePlaceLabels[k] }))
const statusOptions = (Object.keys(allocationStatusLabels) as AllocationStatus[]).map(k => ({ value: k, label: allocationStatusLabels[k] }))

const BP_INFO_COL: ColDef = { key: "bpInfo", label: "BP polia", defaultWidth: 220 }

const MANAGER_COLS: ColDef[] = [
  { key: "id", label: "ID", fixed: true, defaultWidth: 54 },
  { key: "actions", label: "", fixed: true, defaultWidth: 90 },
  { key: "type", label: "Typ", fixed: true, defaultWidth: 110, sortable: true },
  { key: "name", label: "Názov", fixed: true, defaultWidth: 220, sortable: true },
  { key: "brand", label: "Značka", defaultWidth: 120, sortable: true },
  { key: "serialNumber", label: "Výrobné číslo", defaultWidth: 150, sortable: true },
  { key: "usagePlace", label: "Miesto", defaultWidth: 120, sortable: true },
  { key: "yearOfManufacture", label: "Rok", defaultWidth: 80, sortable: true },
  { key: "allocationStatus", label: "Pridelenie", defaultWidth: 130, sortable: true },
  { key: "functionStatus", label: "Stav", defaultWidth: 120, sortable: true },
  { key: "kind", label: "Druh", defaultWidth: 120, sortable: true },
  { key: "acquisitionDate", label: "Nadobudnutie", defaultWidth: 120, sortable: true },
  { key: "assigned", label: "Priradené", defaultWidth: 160, sortable: true },
  { key: "isSecurity", label: "Bezpečnostný", defaultWidth: 120 },
]

const MANAGER_COLS_WITH_BP: ColDef[] = [
  { key: "id", label: "ID", fixed: true, defaultWidth: 54 },
  { key: "actions", label: "", fixed: true, defaultWidth: 90 },
  { key: "type", label: "Typ", fixed: true, defaultWidth: 110, sortable: true },
  { key: "name", label: "Názov", fixed: true, defaultWidth: 220, sortable: true },
  { key: "brand", label: "Značka", defaultWidth: 120, sortable: true },
  { key: "serialNumber", label: "Výrobné číslo", defaultWidth: 150, sortable: true },
  { key: "usagePlace", label: "Miesto", defaultWidth: 120, sortable: true },
  { key: "yearOfManufacture", label: "Rok", defaultWidth: 80, sortable: true },
  { key: "allocationStatus", label: "Pridelenie", defaultWidth: 130, sortable: true },
  { key: "functionStatus", label: "Stav", defaultWidth: 120, sortable: true },
  { key: "kind", label: "Druh", defaultWidth: 120, sortable: true },
  { key: "acquisitionDate", label: "Nadobudnutie", defaultWidth: 120, sortable: true },
  { key: "assigned", label: "Priradené", defaultWidth: 160, sortable: true },
  { key: "isSecurity", label: "Bezpečnostný", defaultWidth: 120 },
  BP_INFO_COL,
]

const SECURITY_COLS: ColDef[] = [
  { key: "id", label: "ID", fixed: true, defaultWidth: 54 },
  { key: "actions", label: "", fixed: true, defaultWidth: 48 },
  { key: "type", label: "Typ", fixed: true, defaultWidth: 110 },
  { key: "name", label: "Názov", fixed: true, defaultWidth: 220 },
  { key: "serialNumber", label: "Výrobné číslo", defaultWidth: 150 },
  BP_INFO_COL,
]

type SortKey = "type" | "name" | "brand" | "serialNumber" | "usagePlace" | "yearOfManufacture" | "allocationStatus" | "functionStatus" | "kind" | "acquisitionDate" | "assigned"

export default function AssetsClient({ assets, users, rooms, userRoles, currentUserName, currentUserId, isAppAdmin = false }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const isManager = userRoles.includes("SPRAVCA_KARIET")
  const isSecurity = userRoles.includes("BEZPECNOSTNY_PRACOVNIK")

  const [showNewModal, setShowNewModal] = useState(false)
  const [assignAsset, setAssignAsset] = useState<Asset | null>(null)
  const [search, setSearch] = useState("")
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set())
  const [filterBrands, setFilterBrands] = useState<Set<string>>(new Set())
  const [filterPlaces, setFilterPlaces] = useState<Set<string>>(new Set())
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const cols = !isManager ? SECURITY_COLS : isSecurity ? MANAGER_COLS_WITH_BP : MANAGER_COLS
  const storageKey = !isManager ? `ve_t_assets_sec2_${currentUserId}` : isSecurity ? `ve_t_assets_mgrbp2_${currentUserId}` : `ve_t_assets2_${currentUserId}`
  const { prefs, visibleCols, movableCols, toggleHidden, reorderCols, setWidth, reset, getWidth } = useTablePrefs(storageKey, cols)
  const { onResizeMouseDown } = useColResize(getWidth, setWidth)

  const activeFiltersCount = filterTypes.size + filterBrands.size + filterPlaces.size + filterStatuses.size

  function clearAllFilters() {
    setFilterTypes(new Set()); setFilterBrands(new Set()); setFilterPlaces(new Set()); setFilterStatuses(new Set()); setSearch("")
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const searchFiltered = useMemo(() => {
    if (!search) return assets
    const q = search.toLowerCase()
    return assets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.serialNumber?.toLowerCase().includes(q) ?? false) ||
      a.id.toString().includes(q)
    )
  }, [assets, search])

  const availableTypeOptions = useMemo(() => {
    const vals = new Set(searchFiltered.filter(a =>
      (filterBrands.size === 0 || filterBrands.has(a.brand)) &&
      (filterPlaces.size === 0 || filterPlaces.has(a.usagePlace)) &&
      (filterStatuses.size === 0 || filterStatuses.has(a.allocationStatus))
    ).map(a => a.type))
    return typeOptions.filter(opt => vals.has(opt.value) || filterTypes.has(opt.value))
  }, [searchFiltered, filterBrands, filterPlaces, filterStatuses, filterTypes])

  const availableBrandOptions = useMemo(() => {
    const vals = new Set(searchFiltered.filter(a =>
      (filterTypes.size === 0 || filterTypes.has(a.type)) &&
      (filterPlaces.size === 0 || filterPlaces.has(a.usagePlace)) &&
      (filterStatuses.size === 0 || filterStatuses.has(a.allocationStatus))
    ).map(a => a.brand))
    return brandOptions.filter(opt => vals.has(opt.value) || filterBrands.has(opt.value))
  }, [searchFiltered, filterTypes, filterPlaces, filterStatuses, filterBrands])

  const availablePlaceOptions = useMemo(() => {
    const vals = new Set(searchFiltered.filter(a =>
      (filterTypes.size === 0 || filterTypes.has(a.type)) &&
      (filterBrands.size === 0 || filterBrands.has(a.brand)) &&
      (filterStatuses.size === 0 || filterStatuses.has(a.allocationStatus))
    ).map(a => a.usagePlace))
    return placeOptions.filter(opt => vals.has(opt.value) || filterPlaces.has(opt.value))
  }, [searchFiltered, filterTypes, filterBrands, filterStatuses, filterPlaces])

  const availableStatusOptions = useMemo(() => {
    const vals = new Set(searchFiltered.filter(a =>
      (filterTypes.size === 0 || filterTypes.has(a.type)) &&
      (filterBrands.size === 0 || filterBrands.has(a.brand)) &&
      (filterPlaces.size === 0 || filterPlaces.has(a.usagePlace))
    ).map(a => a.allocationStatus))
    return statusOptions.filter(opt => vals.has(opt.value) || filterStatuses.has(opt.value))
  }, [searchFiltered, filterTypes, filterBrands, filterPlaces, filterStatuses])

  const filtered = useMemo(() => searchFiltered.filter(a => {
    if (filterTypes.size > 0 && !filterTypes.has(a.type)) return false
    if (filterBrands.size > 0 && !filterBrands.has(a.brand)) return false
    if (filterPlaces.size > 0 && !filterPlaces.has(a.usagePlace)) return false
    if (filterStatuses.size > 0 && !filterStatuses.has(a.allocationStatus)) return false
    return true
  }), [searchFiltered, filterTypes, filterBrands, filterPlaces, filterStatuses])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let aVal: string | number = ""
      let bVal: string | number = ""
      switch (sortKey) {
        case "type": aVal = assetTypeLabels[a.type as AssetType] ?? a.type; bVal = assetTypeLabels[b.type as AssetType] ?? b.type; break
        case "name": aVal = a.name; bVal = b.name; break
        case "brand": aVal = brandLabels[a.brand as Brand] ?? a.brand; bVal = brandLabels[b.brand as Brand] ?? b.brand; break
        case "serialNumber": aVal = a.serialNumber ?? ""; bVal = b.serialNumber ?? ""; break
        case "usagePlace": aVal = usagePlaceLabels[a.usagePlace as UsagePlace] ?? a.usagePlace; bVal = usagePlaceLabels[b.usagePlace as UsagePlace] ?? b.usagePlace; break
        case "yearOfManufacture": aVal = a.yearOfManufacture ?? 0; bVal = b.yearOfManufacture ?? 0; break
        case "allocationStatus": aVal = allocationStatusLabels[a.allocationStatus]; bVal = allocationStatusLabels[b.allocationStatus]; break
        case "functionStatus": aVal = functionStatusLabels[a.functionStatus]; bVal = functionStatusLabels[b.functionStatus]; break
        case "kind": aVal = assetKindLabels[a.kind as keyof typeof assetKindLabels] ?? a.kind; bVal = assetKindLabels[b.kind as keyof typeof assetKindLabels] ?? b.kind; break
        case "acquisitionDate": aVal = a.acquisitionDate ?? ""; bVal = b.acquisitionDate ?? ""; break
        case "assigned": aVal = a.currentRecipient?.name ?? a.currentRoom?.name ?? ""; bVal = b.currentRecipient?.name ?? b.currentRoom?.name ?? ""; break
      }
      const cmp = typeof aVal === "number" && typeof bVal === "number" ? aVal - bVal : String(aVal).localeCompare(String(bVal), "sk")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  async function handleReturn(asset: Asset) {
    if (!confirm(`Naozaj chcete vrátiť majetok „${asset.name}" (${asset.serialNumber ?? "—"})?\nPriradenie bude uzavreté.`)) return
    startTransition(async () => {
      const result = await returnAsset(asset.id, currentUserName)
      if (result.error) alert(result.error)
      else router.refresh()
    })
  }

  function renderCell(key: string, a: Asset): React.ReactNode {
    switch (key) {
      case "id": return <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">{a.id}</span>
      case "type": return assetTypeLabels[a.type as AssetType] ?? a.type
      case "name": return <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">{a.name}</span>
      case "brand": return <span className="text-gray-500 dark:text-gray-400">{brandLabels[a.brand as Brand] ?? a.brand}</span>
      case "serialNumber": return a.serialNumber ? <span className="font-mono text-xs">{a.serialNumber}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "usagePlace": return <span className="text-gray-500 dark:text-gray-400">{usagePlaceLabels[a.usagePlace as UsagePlace] ?? a.usagePlace}</span>
      case "yearOfManufacture": return a.yearOfManufacture ? <span className="text-gray-500 dark:text-gray-400">{a.yearOfManufacture}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "allocationStatus": return <Badge label={allocationStatusLabels[a.allocationStatus]} colorCls={allocationStatusColors[a.allocationStatus]} />
      case "functionStatus": return <Badge label={functionStatusLabels[a.functionStatus]} colorCls={functionStatusColors[a.functionStatus]} />
      case "kind": return <span className="text-gray-500 dark:text-gray-400">{assetKindLabels[a.kind as keyof typeof assetKindLabels] ?? a.kind}</span>
      case "acquisitionDate": return a.acquisitionDate ? <span className="text-gray-500 dark:text-gray-400">{a.acquisitionDate}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "assigned": {
        const isPending = a.allocationStatus === "V_procese"
        const name = a.currentRecipient?.name ?? a.currentRoom?.name ?? null
        const color = a.currentRecipient
          ? "text-blue-700 dark:text-blue-400"
          : "text-purple-700 dark:text-purple-400"
        if (!name) return <span className="text-gray-300 dark:text-gray-600">—</span>
        return (
          <span className={`inline-flex items-center gap-1.5 font-medium ${color}`}>
            {name}
            {isPending && (
              <span title="Čaká sa na potvrdenie">
                <ClockIcon size={12} className="text-amber-500 shrink-0" />
              </span>
            )}
          </span>
        )
      }
      case "isSecurity": return a.isSecurity
        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Bezpečnostný</span>
        : <span className="text-gray-300 dark:text-gray-600">—</span>
      case "bpInfo": {
        const dash = <span className="text-gray-300 dark:text-gray-600">—</span>
        if (a.type === "Notebook") {
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              <span className={a.bpVDomene ? "text-green-600 dark:text-green-400 font-medium" : "text-gray-400 dark:text-gray-500"}>
                V doméne: {a.bpVDomene ? "Áno" : "Nie"}
              </span>
              {a.bpNazovVDomene && <span className="text-gray-500 dark:text-gray-400 font-mono truncate">{a.bpNazovVDomene}</span>}
              {a.bpAktualizovanyDna && <span className="text-gray-400 dark:text-gray-500">{a.bpAktualizovanyDna}</span>}
            </div>
          )
        }
        if (a.type === "MobilnyTelefon") {
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              <span className={a.bpEset ? "text-green-600 dark:text-green-400 font-medium" : "text-gray-400 dark:text-gray-500"}>
                ESET: {a.bpEset ? "Áno" : "Nie"}
              </span>
              {a.bpImei1 && <span className="text-gray-500 dark:text-gray-400 font-mono truncate">{a.bpImei1}</span>}
              {a.bpPodporovanyDo && <span className="text-gray-400 dark:text-gray-500">{a.bpPodporovanyDo}</span>}
            </div>
          )
        }
        if (a.type === "SIMKarta") {
          return a.bpTelefonneCislo
            ? <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{a.bpTelefonneCislo}</span>
            : dash
        }
        if (a.type === "USBKluc" || a.type === "ExternyDisk") {
          return (
            <span className={`text-xs font-medium ${a.bpPovolenyVDomene ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"}`}>
              {a.bpPovolenyVDomene ? "Povolený v doméne" : "Nepovolený"}
            </span>
          )
        }
        return dash
      }
      case "actions":
        return (
          <div className="flex items-center gap-0.5">
            <Link href={`/dashboard/assets/${a.id}`} title="Detail"
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
              <ExternalLink size={14} />
            </Link>
            {isManager && !isAppAdmin && a.allocationStatus !== "V_procese" && (
              <button onClick={() => setAssignAsset(a)} title="Priradiť"
                className="p-1.5 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-md">
                <UserPlus size={14} />
              </button>
            )}
            {isManager && !isAppAdmin && (a.allocationStatus === "Prideleny_Recipient" || a.allocationStatus === "Prideleny_Room") && (
              <button onClick={() => handleReturn(a)} title="Vrátiť"
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        )
      default: return null
    }
  }

  const totalWidth = visibleCols.reduce((sum, col) => sum + (getWidth(col.key) ?? 120), 0)

  const stickyLeft = (() => {
    const map: Record<string, number> = {}
    let offset = 0
    for (const col of cols) {
      if (col.fixed) { map[col.key] = offset; offset += getWidth(col.key) ?? col.defaultWidth ?? 100 }
    }
    return map
  })()
  const lastFixedKey = cols.filter(c => c.fixed).at(-1)?.key

  function stickyThStyle(col: ColDef): React.CSSProperties {
    if (!col.fixed) return {}
    return {
      position: "sticky",
      left: stickyLeft[col.key],
      zIndex: 3,
      ...(col.key === lastFixedKey && { boxShadow: "2px 0 4px -1px rgba(0,0,0,0.12)" }),
    }
  }
  function stickyTdStyle(col: ColDef): React.CSSProperties {
    if (!col.fixed) return {}
    return {
      position: "sticky",
      left: stickyLeft[col.key],
      zIndex: 1,
      ...(col.key === lastFixedKey && { boxShadow: "2px 0 4px -1px rgba(0,0,0,0.08)" }),
    }
  }

  function ColHeader({ col }: { col: ColDef }) {
    const active = sortKey === col.key
    return (
      <th
        style={{ width: getWidth(col.key), ...stickyThStyle(col) }}
        onClick={() => col.sortable && handleSort(col.key as SortKey)}
        className={`relative group px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap overflow-hidden bg-gray-50 dark:bg-gray-800 ${col.sortable ? "cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200" : ""}`}
      >
        <div className="flex items-center gap-1 pr-2">
          {col.label}
          {col.sortable && (
            active
              ? sortDir === "asc" ? <ChevronUp size={12} className="text-blue-500 shrink-0" /> : <ChevronDown size={12} className="text-blue-500 shrink-0" />
              : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
          )}
        </div>
        <div
          onMouseDown={e => onResizeMouseDown(col.key, e)}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group-hover:bg-gray-200/60 dark:group-hover:bg-gray-600/40 hover:!bg-blue-400/60 z-10"
        />
      </th>
    )
  }

  // ── Security view ──────────────────────────────────────────────────────────
  if (isSecurity && !isManager) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Majetok</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Zobrazené polia pre bezpečnostného pracovníka</p>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Hľadať podľa ID, názvu, výrobného čísla..." value={search} onChange={e => setSearch(e.target.value)} className={`w-full pl-9 pr-3 py-2 text-sm ${inputCls}`} />
          </div>
          <ColumnManager cols={movableCols} hidden={prefs.hidden} order={prefs.order} onToggle={toggleHidden} onReorder={reorderCols} onReset={reset} />
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}>
              <colgroup>{visibleCols.map(col => <col key={col.key} style={{ width: getWidth(col.key) }} />)}</colgroup>
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>{visibleCols.map(col => <ColHeader key={col.key} col={col} />)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(a => (
                  <tr key={a.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800">
                    {visibleCols.map(col => (
                      <td key={col.key}
                        style={stickyTdStyle(col)}
                        className={`px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 overflow-hidden ${col.fixed ? "bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800" : ""}`}>
                        {renderCell(col.key, a)}
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={visibleCols.length} className="px-3 py-8 text-center text-sm text-gray-400">Žiadny majetok</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Manager view ───────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Majetok</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{assets.length} záznamov · zobrazených {filtered.length}</p>
        </div>
        {!isAppAdmin && (
          <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus size={15} />
            Nový majetok
          </button>
        )}
        {isAppAdmin && (
          <span className="px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
            Režim len na čítanie
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Hľadať (ID, názov, číslo)..." value={search} onChange={e => setSearch(e.target.value)} className={`pl-8 pr-3 py-1.5 text-sm w-56 ${inputCls}`} />
        </div>
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <MultiSelect placeholder="Typ" options={availableTypeOptions} selected={filterTypes} onChange={setFilterTypes} />
        <MultiSelect placeholder="Značka" options={availableBrandOptions} selected={filterBrands} onChange={setFilterBrands} />
        <MultiSelect placeholder="Miesto" options={availablePlaceOptions} selected={filterPlaces} onChange={setFilterPlaces} />
        <MultiSelect placeholder="Pridelenie" options={availableStatusOptions} selected={filterStatuses} onChange={setFilterStatuses} />
        {(activeFiltersCount > 0 || search) && (
          <button type="button" onClick={clearAllFilters} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <X size={12} />Zrušiť filtre
          </button>
        )}
        {isPending && <div className="flex items-center gap-1.5 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" />Aktualizujem...</div>}
        <div className="ml-auto">
          <ColumnManager cols={movableCols} hidden={prefs.hidden} order={prefs.order} onToggle={toggleHidden} onReorder={reorderCols} onReset={reset} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}>
            <colgroup>{visibleCols.map(col => <col key={col.key} style={{ width: getWidth(col.key) }} />)}</colgroup>
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>{visibleCols.map(col => <ColHeader key={col.key} col={col} />)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sorted.map(a => (
                <tr key={a.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800">
                  {visibleCols.map(col => (
                    <td key={col.key}
                      style={stickyTdStyle(col)}
                      className={`px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 overflow-hidden ${col.fixed ? "bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800" : ""}`}>
                      {renderCell(col.key, a)}
                    </td>
                  ))}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={visibleCols.length} className="px-3 py-10 text-center text-sm text-gray-400">{assets.length === 0 ? "Žiadny evidovaný majetok. Kliknite na tlačidlo Nový majetok." : "Žiadne výsledky pre zadané filtre."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && <NewAssetModal onClose={() => setShowNewModal(false)} />}
      {assignAsset && (
        <AssignModal asset={assignAsset} users={users} rooms={rooms} currentUserName={currentUserName} onClose={() => setAssignAsset(null)} />
      )}
    </div>
  )
}
