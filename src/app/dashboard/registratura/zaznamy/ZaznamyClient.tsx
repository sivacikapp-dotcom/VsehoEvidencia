"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, X, ArrowUpDown, ChevronUp, ChevronDown, ExternalLink, Inbox, Send } from "lucide-react"
import { FilterSelect } from "@/components/FilterSelect"
import { MultiSelect } from "@/components/MultiSelect"
import { DateRangeFilter } from "@/components/DateRangeFilter"
import {
  regZaznamTypeLabels,
  zaznamKategoriaLabels, zaznamKategoriaColors,
  zaznamStavLabels, zaznamStavColors,
  zaznamDovernostLabels,
} from "@/lib/regLabels"
import type { ZaznamKategoria, ZaznamDovernost, RegZaznamType } from "@/generated/prisma/enums"
import { createZaznam } from "./actions"
import ContactFields, { type SubjektItem } from "@/components/ContactFields"

type ZaznamRow = {
  id: number
  cisloZaznamu: string
  kategoria: ZaznamKategoria
  rok: number
  spracovatel: string
  utvar: string | null
  formaZaznamu: RegZaznamType
  vec: string | null
  stav: string
  dovernost: ZaznamDovernost
  pocetSpisov: number
  pocetPriloh: number
  createdAt: string
}

interface Props {
  zaznamy: ZaznamRow[]
  utvary: { id: number; nazov: string }[]
  subjekty: SubjektItem[]
  isAdmin: boolean
  canCreate: boolean
}

type SortKey = "cislo" | "kategoria" | "rok" | "vec" | "stav" | "datum"

const thBase = "text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs uppercase tracking-wide"

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

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelCls = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"

export default function ZaznamyClient({ zaznamy, utvary, subjekty, isAdmin, canCreate }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [filterStavy, setFilterStavy] = useState<Set<string>>(new Set())
  const [filterKategoria, setFilterKategoria] = useState<ZaznamKategoria | "">("")
  const [filterYears, setFilterYears] = useState<Set<string>>(new Set())
  const [filterDateOd, setFilterDateOd] = useState("")
  const [filterDateDo, setFilterDateDo] = useState("")

  const yearOptions = useMemo(() => {
    const years = [...new Set(zaznamy.map(r => String(r.rok)))].sort().reverse()
    return years.map(y => ({ value: y, label: y }))
  }, [zaznamy])
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [showNew, setShowNew] = useState(false)
  const [newKategoria, setNewKategoria] = useState<ZaznamKategoria | null>(null)
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
      rows = rows.filter(r =>
        r.cisloZaznamu.toLowerCase().includes(q) ||
        (r.vec ?? "").toLowerCase().includes(q)
      )
    }
    if (filterStavy.size > 0) rows = rows.filter(r => filterStavy.has(r.stav))
    if (filterKategoria) rows = rows.filter(r => r.kategoria === filterKategoria)
    if (filterYears.size > 0) rows = rows.filter(r => filterYears.has(String(r.rok)))
    if (filterDateOd) rows = rows.filter(r => r.createdAt >= filterDateOd)
    if (filterDateDo) rows = rows.filter(r => r.createdAt <= filterDateDo)
    return rows
  }, [zaznamy, search, filterStavy, filterKategoria, filterYears, filterDateOd, filterDateDo])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = sortKey === "cislo" ? a.cisloZaznamu : sortKey === "kategoria" ? a.kategoria : sortKey === "rok" ? String(a.rok) : sortKey === "vec" ? (a.vec ?? "") : sortKey === "stav" ? a.stav : a.createdAt
      const bv = sortKey === "cislo" ? b.cisloZaznamu : sortKey === "kategoria" ? b.kategoria : sortKey === "rok" ? String(b.rok) : sortKey === "vec" ? (b.vec ?? "") : sortKey === "stav" ? b.stav : b.createdAt
      return sortDir === "asc" ? av.localeCompare(bv, "sk") : bv.localeCompare(av, "sk")
    })
  }, [filtered, sortKey, sortDir])

  function openNew(kat: ZaznamKategoria) {
    setNewKategoria(kat)
    setShowNew(true)
    setError("")
  }

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
          <div className="flex items-center gap-2">
            <button onClick={() => openNew("PRIJATY")}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              <Inbox size={15} /> Nový prijatý
            </button>
            <button onClick={() => openNew("VYTVORENY")}
              className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors">
              <Send size={15} /> Nový vytvorený
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hľadať..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
        </div>
        <FilterSelect
          label="Typ"
          value={filterKategoria}
          onChange={v => setFilterKategoria(v as ZaznamKategoria | "")}
          options={[
            { value: "PRIJATY", label: "Prijatý" },
            { value: "VYTVORENY", label: "Vytvorený" },
          ]}
        />
        <MultiSelect
          placeholder="Stav"
          selected={filterStavy}
          onChange={setFilterStavy}
          options={Object.entries(zaznamStavLabels).map(([k, v]) => ({ value: k, label: v }))}
        />
        <MultiSelect
          placeholder="Rok"
          selected={filterYears}
          onChange={setFilterYears}
          options={yearOptions}
        />
        <DateRangeFilter
          od={filterDateOd}
          do={filterDateDo}
          onOd={setFilterDateOd}
          onDo={setFilterDateDo}
        />
        {(search || filterStavy.size > 0 || filterKategoria || filterYears.size > 0 || filterDateOd || filterDateDo) && (
          <button onClick={() => { setSearch(""); setFilterStavy(new Set()); setFilterKategoria(""); setFilterYears(new Set()); setFilterDateOd(""); setFilterDateDo("") }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-500 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-300 transition-colors">
            <X size={12} /> Zrušiť
          </button>
        )}
        {sortKey && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg">
            {sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>{{ cislo: "Číslo", kategoria: "Typ", rok: "Rok", vec: "Vec", stav: "Stav", datum: "Dátum" }[sortKey]}</span>
            <button type="button" onClick={() => setSortKey(null)}><X size={11} /></button>
          </div>
        )}
        <span className="text-xs text-gray-400 ml-auto">{sorted.length} / {zaznamy.length}</span>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <Th label="Číslo" colKey="cislo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Typ" colKey="kategoria" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Rok" colKey="rok" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Vec" colKey="vec" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              {isAdmin && <th className={thBase}>Spracovateľ</th>}
              <Th label="Stav" colKey="stav" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className={thBase}>Dôvernosť</th>
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
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${zaznamKategoriaColors[row.kategoria]}`}>
                    {row.kategoria === "PRIJATY" ? <Inbox size={11} /> : <Send size={11} />}
                    {zaznamKategoriaLabels[row.kategoria]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.rok}</td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-gray-900 dark:text-white truncate">{row.vec ?? <span className="text-gray-400 italic">—</span>}</p>
                </td>
                {isAdmin && <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.spracovatel}</td>}
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${zaznamStavColors[row.stav]}`}>
                    {zaznamStavLabels[row.stav]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                  {zaznamDovernostLabels[row.dovernost]}
                </td>
                <td className="px-4 py-3"><ExternalLink size={14} className="text-gray-400" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Záznam Modal */}
      {showNew && newKategoria && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {newKategoria === "PRIJATY" ? "Nový prijatý záznam" : "Nový vytvorený záznam"}
                </h2>
                <span className={`mt-1 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${zaznamKategoriaColors[newKategoria]}`}>
                  {newKategoria === "PRIJATY" ? <Inbox size={11} /> : <Send size={11} />}
                  {zaznamKategoriaLabels[newKategoria]}
                </span>
              </div>
              <button onClick={() => setShowNew(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <input type="hidden" name="kategoria" value={newKategoria} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Forma záznamu *</label>
                  <select name="formaZaznamu" className={inputCls}>
                    <option value="ELEKTRONICKY">Elektronický</option>
                    <option value="NEELEKTRONICKY">Neelektronický</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Útvar</label>
                  <select name="utvarId" className={inputCls}>
                    <option value="">— Bez útvaru —</option>
                    {utvary.map(u => <option key={u.id} value={u.id}>{u.nazov}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Stupeň dôvernosti</label>
                  <select name="dovernost" className={inputCls}>
                    <option value="VEREJNE">Verejné</option>
                    <option value="INTERNE">Interné</option>
                    <option value="DOVERNE">Dôverné</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Vec</label>
                <input type="text" name="vec" className={inputCls} placeholder="Stručný popis obsahu záznamu" />
              </div>
              <div>
                <label className={labelCls}>Popis</label>
                <textarea name="popis" rows={2} className={`${inputCls} resize-none`} placeholder="Podrobnejší popis..." />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {newKategoria === "PRIJATY" ? "Odosielateľ" : "Adresát"}
                  <span className="ml-1 font-normal normal-case text-gray-400">(voliteľné)</span>
                </p>
                <ContactFields subjekty={subjekty} />
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
