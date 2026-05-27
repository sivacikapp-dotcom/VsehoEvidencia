"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, X, ArrowUpDown, ChevronUp, ChevronDown, FileText, ExternalLink } from "lucide-react"
import { regZaznamStatusLabels, regZaznamStatusColors, regZaznamTypeLabels } from "@/lib/regLabels"
import type { RegZaznamStatus, RegZaznamType } from "@/generated/prisma/enums"
import { createZaznam } from "./actions"

type ZaznamRow = {
  id: number
  cisloZaznamu: string
  planZnacka: string
  planNazov: string
  spracovatel: string
  typZaznamu: RegZaznamType
  status: RegZaznamStatus
  hasFile: boolean
  originalName: string | null
  fileSize: number | null
  postaRef: string | null
  pocetSpisov: number
  createdAt: string
}

interface Props {
  zaznamy: ZaznamRow[]
  plans: { id: number; znacka: string; nazov: string }[]
  isAdmin: boolean
  canCreate: boolean
}

type SortKey = "cislo" | "plan" | "typ" | "status" | "datum"

const thBase = "text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"

function Th({ label, colKey, sortKey, sortDir, onSort }: {
  label: string; colKey: SortKey
  sortKey: SortKey | null; sortDir: "asc" | "desc"
  onSort: (k: SortKey) => void
}) {
  const active = sortKey === colKey
  return (
    <th className={thBase}>
      <button type="button" onClick={() => onSort(colKey)}
        className={`flex items-center gap-1 transition-colors ${active ? "text-blue-600 dark:text-blue-400" : "hover:text-gray-700 dark:hover:text-gray-200"}`}>
        {label}
        {active ? (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ArrowUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  )
}

export default function ZaznamyClient({ zaznamy, plans, isAdmin, canCreate }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<RegZaznamStatus | "">("")
  const [filterTyp, setFilterTyp] = useState<RegZaznamType | "">("")
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir("asc") }
  }

  const filtered = useMemo(() => {
    let rows = zaznamy
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.cisloZaznamu.toLowerCase().includes(q) || r.planNazov.toLowerCase().includes(q) || r.planZnacka.toLowerCase().includes(q))
    }
    if (filterStatus) rows = rows.filter(r => r.status === filterStatus)
    if (filterTyp) rows = rows.filter(r => r.typZaznamu === filterTyp)
    return rows
  }, [zaznamy, search, filterStatus, filterTyp])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = sortKey === "cislo" ? a.cisloZaznamu : sortKey === "plan" ? a.planZnacka : sortKey === "typ" ? a.typZaznamu : sortKey === "status" ? a.status : a.createdAt
      const bv = sortKey === "cislo" ? b.cisloZaznamu : sortKey === "plan" ? b.planZnacka : sortKey === "typ" ? b.typZaznamu : sortKey === "status" ? b.status : b.createdAt
      return sortDir === "asc" ? av.localeCompare(bv, "sk") : bv.localeCompare(av, "sk")
    })
  }, [filtered, sortKey, sortDir])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError("")
    const result = await createZaznam(new FormData(e.currentTarget))
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setShowNew(false)
    startTransition(() => router.refresh())
    if (result.id) router.push(`/dashboard/registratura/zaznamy/${result.id}`)
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Registratúrne záznamy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {isAdmin ? "Všetky záznamy registratúry" : "Moje záznamy"}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => { setShowNew(true); setError("") }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={15} /> Nový záznam
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hľadať..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as RegZaznamStatus | "")}
          className="py-1.5 px-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Stav: všetky</option>
          {(Object.entries(regZaznamStatusLabels) as [RegZaznamStatus, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterTyp} onChange={e => setFilterTyp(e.target.value as RegZaznamType | "")}
          className="py-1.5 px-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Typ: všetky</option>
          <option value="ELEKTRONICKY">Elektronický</option>
          <option value="NEELEKTRONICKY">Neelektronický</option>
        </select>
        {(search || filterStatus || filterTyp) && (
          <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterTyp("") }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-500 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-300 transition-colors">
            <X size={12} /> Zrušiť
          </button>
        )}
        {sortKey && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg">
            {sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>{{ cislo: "Číslo záznamu", plan: "Plán", typ: "Typ", status: "Stav", datum: "Dátum" }[sortKey]}</span>
            <button type="button" onClick={() => setSortKey(null)}><X size={11} /></button>
          </div>
        )}
        <span className="text-xs text-gray-400 ml-auto">{sorted.length} / {zaznamy.length}</span>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <Th label="Číslo záznamu" colKey="cislo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Reg. plán" colKey="plan" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Typ" colKey="typ" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              {isAdmin && <th className={thBase}>Spracovateľ</th>}
              <Th label="Stav" colKey="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className={thBase}>Súbor</th>
              <Th label="Vytvorený" colKey="datum" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-10 text-center text-gray-400">Žiadne záznamy</td></tr>
            )}
            {sorted.map(row => (
              <tr key={row.id} onClick={() => router.push(`/dashboard/registratura/zaznamy/${row.id}`)}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.cisloZaznamu}</td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-medium text-gray-900 dark:text-white">{row.planZnacka}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{row.planNazov}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {regZaznamTypeLabels[row.typZaznamu]}
                </td>
                {isAdmin && <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.spracovatel}</td>}
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${regZaznamStatusColors[row.status]}`}>
                    {regZaznamStatusLabels[row.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.hasFile && row.originalName ? (
                    <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                      <FileText size={12} className="shrink-0" />
                      <span className="truncate max-w-[120px]">{row.originalName}</span>
                    </span>
                  ) : row.typZaznamu === "ELEKTRONICKY" ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400">Bez súboru</span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.createdAt}</td>
                <td className="px-4 py-3"><ExternalLink size={14} className="text-gray-400" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Záznam Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Nový registratúrny záznam</h2>
              <button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Registratúrny plán *</label>
                <select name="planId" required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Vyberte —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.znacka} – {p.nazov}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Typ záznamu *</label>
                <select name="typZaznamu" required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="ELEKTRONICKY">Elektronický</option>
                  <option value="NEELEKTRONICKY">Neelektronický</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Umiestnenie fyzického originálu</label>
                <input type="text" name="umiestnenie"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="napr. Šanón 2026/A, Regál 3" />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNew(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Zrušiť
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? "Vytvárám…" : "Vytvoriť záznam"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
