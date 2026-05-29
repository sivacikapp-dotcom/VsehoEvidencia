"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, X, ArrowUpDown, ChevronUp, ChevronDown, Inbox, Send, ExternalLink, Shuffle } from "lucide-react"
import {
  postaDirectionLabels, postaDirectionColors,
  postaSpusobLabels, postaStatusLabels, postaStatusColors,
} from "@/lib/regLabels"
import type { PostaDirection, PostaSpusob, PostaStatus } from "@/generated/prisma/enums"
import { createPosta, updatePosta, prekloritDoRegistratury } from "./actions"

type PostaRow = {
  id: number
  poradoveCislo: string
  smer: PostaDirection
  datumDoruceOdoslania: string
  sposob: PostaSpusob
  odosielatelPrijemcaNazov: string
  odosielatelPrijemcaAdresa: string | null
  odosielatelPrijemcaIco: string | null
  vec: string
  status: PostaStatus
  attachments: { id: number; originalName: string; size: number }[]
  zaznam: { id: number; cisloZaznamu: string } | null
  createdAt: string
}

interface Props {
  posta: PostaRow[]
  plans: { id: number; znacka: string; nazov: string }[]
  spracovatelia: { id: number; firstName: string; lastName: string }[]
  canWrite: boolean
}

type SortKey = "poradoveCislo" | "smer" | "datum" | "nazov" | "vec" | "status"

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

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type ModalState =
  | { mode: "none" }
  | { mode: "new"; smer: "DOSLA" | "ODOSLANA" }
  | { mode: "edit"; row: PostaRow }
  | { mode: "preklop"; row: PostaRow }

export default function PodatelnaClient({ posta, plans, spracovatelia, canWrite }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [filterSmer, setFilterSmer] = useState<PostaDirection | "">("")
  const [filterStatus, setFilterStatus] = useState<PostaStatus | "">("")
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [modal, setModal] = useState<ModalState>({ mode: "none" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir("asc") }
  }

  const filtered = useMemo(() => {
    let rows = posta
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.poradoveCislo.toLowerCase().includes(q) ||
        r.vec.toLowerCase().includes(q) ||
        r.odosielatelPrijemcaNazov.toLowerCase().includes(q)
      )
    }
    if (filterSmer) rows = rows.filter(r => r.smer === filterSmer)
    if (filterStatus) rows = rows.filter(r => r.status === filterStatus)
    return rows
  }, [posta, search, filterSmer, filterStatus])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = sortKey === "poradoveCislo" ? a.poradoveCislo
        : sortKey === "smer" ? a.smer
        : sortKey === "datum" ? a.datumDoruceOdoslania
        : sortKey === "nazov" ? a.odosielatelPrijemcaNazov
        : sortKey === "vec" ? a.vec
        : a.status
      const bv = sortKey === "poradoveCislo" ? b.poradoveCislo
        : sortKey === "smer" ? b.smer
        : sortKey === "datum" ? b.datumDoruceOdoslania
        : sortKey === "nazov" ? b.odosielatelPrijemcaNazov
        : sortKey === "vec" ? b.vec
        : b.status
      const cmp = av.localeCompare(bv, "sk")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  async function handleSubmitPosta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError("")
    const fd = new FormData(e.currentTarget)
    const result = modal.mode === "new"
      ? await createPosta(fd)
      : modal.mode === "edit" ? await updatePosta(modal.row.id, fd) : { error: "" }
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setModal({ mode: "none" })
    startTransition(() => router.refresh())
  }

  async function handlePreklop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (modal.mode !== "preklop") return
    setSaving(true); setError("")
    const fd = new FormData(e.currentTarget)
    const planId = parseInt(fd.get("planId") as string)
    const spracovatelId = parseInt(fd.get("spracovatelId") as string)
    const typ = fd.get("typZaznamu") as "ELEKTRONICKY" | "NEELEKTRONICKY"
    const umiestnenie = (fd.get("umiestnenie") as string) ?? ""
    const result = await prekloritDoRegistratury(modal.row.id, planId, spracovatelId, typ, umiestnenie)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setModal({ mode: "none" })
    startTransition(() => router.refresh())
  }

  const editRow = modal.mode === "edit" ? modal.row : null
  const preklopRow = modal.mode === "preklop" ? modal.row : null

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Podateľňa</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Došlá a odoslaná pošta</p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setModal({ mode: "new", smer: "DOSLA" }); setError("") }}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
              <Inbox size={15} /> Nová došlá
            </button>
            <button onClick={() => { setModal({ mode: "new", smer: "ODOSLANA" }); setError("") }}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
              <Send size={15} /> Nová odoslaná
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
        <select value={filterSmer} onChange={e => setFilterSmer(e.target.value as PostaDirection | "")}
          className="py-1.5 px-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Smer: všetky</option>
          <option value="DOSLA">Došlá</option>
          <option value="ODOSLANA">Odoslaná</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as PostaStatus | "")}
          className="py-1.5 px-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Stav: všetky</option>
          <option value="ZAREGISTROVANA">Zaregistrovaná</option>
          <option value="PREKLASIFIKOVANA">Preklopená</option>
        </select>
        {(search || filterSmer || filterStatus) && (
          <button onClick={() => { setSearch(""); setFilterSmer(""); setFilterStatus("") }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-500 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-300 transition-colors">
            <X size={12} /> Zrušiť filtre
          </button>
        )}
        {sortKey && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg">
            {sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>{{ poradoveCislo: "Číslo", smer: "Smer", datum: "Dátum", nazov: "Odosielateľ/Príjemca", vec: "Vec", status: "Stav" }[sortKey]}</span>
            <button type="button" onClick={() => setSortKey(null)}><X size={11} /></button>
          </div>
        )}
        <span className="text-xs text-gray-400 ml-auto">{sorted.length} / {posta.length}</span>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <Th label="Číslo" colKey="poradoveCislo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Smer" colKey="smer" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Dátum" colKey="datum" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Odosielateľ / Príjemca" colKey="nazov" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Vec" colKey="vec" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <Th label="Stav" colKey="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className={thBase}>Záznam</th>
              {canWrite && <th className="w-24" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.length === 0 && (
              <tr><td colSpan={canWrite ? 8 : 7} className="px-4 py-10 text-center text-gray-400">Žiadne záznamy</td></tr>
            )}
            {sorted.map(row => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.poradoveCislo}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${postaDirectionColors[row.smer]}`}>
                    {row.smer === "DOSLA" ? <Inbox size={11} /> : <Send size={11} />}
                    {postaDirectionLabels[row.smer]}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{row.datumDoruceOdoslania}</td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{row.odosielatelPrijemcaNazov}</p>
                  {row.odosielatelPrijemcaAdresa && <p className="text-xs text-gray-400 truncate">{row.odosielatelPrijemcaAdresa}</p>}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-gray-900 dark:text-white truncate">{row.vec}</p>
                  {row.attachments.length > 0 && (
                    <p className="text-xs text-gray-400">{row.attachments.length} príloha(y)</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${postaStatusColors[row.status]}`}>
                    {postaStatusLabels[row.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.zaznam ? (
                    <a href={`/dashboard/registratura/zaznamy/${row.zaznam.id}`}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono">
                      {row.zaznam.cisloZaznamu} <ExternalLink size={11} />
                    </a>
                  ) : <span className="text-gray-400 text-xs">—</span>}
                </td>
                {canWrite && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {row.status === "ZAREGISTROVANA" && (
                        <>
                          <button onClick={() => { setModal({ mode: "edit", row }); setError("") }}
                            className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            Upraviť
                          </button>
                          <button onClick={() => { setModal({ mode: "preklop", row }); setError("") }}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 transition-colors">
                            <Shuffle size={11} /> Preklop
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New/Edit Modal */}
      {(modal.mode === "new" || modal.mode === "edit") && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {modal.mode === "new"
                  ? (modal.smer === "DOSLA" ? "Nová došlá pošta" : "Nová odoslaná pošta")
                  : "Upraviť poštu"}
              </h2>
              <button onClick={() => setModal({ mode: "none" })}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmitPosta} className="p-6 space-y-4">
              {/* Direction — fixed for new, read-only for edit */}
              {modal.mode === "new" ? (
                <>
                  <input type="hidden" name="smer" value={modal.smer} />
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg ${modal.smer === "DOSLA" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"}`}>
                      {modal.smer === "DOSLA" ? <Inbox size={14} /> : <Send size={14} />}
                      {modal.smer === "DOSLA" ? "Došlá pošta" : "Odoslaná pošta"}
                    </span>
                  </div>
                </>
              ) : editRow ? (
                <>
                  <input type="hidden" name="smer" value={editRow.smer} />
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg ${editRow.smer === "DOSLA" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"}`}>
                      {editRow.smer === "DOSLA" ? <Inbox size={14} /> : <Send size={14} />}
                      {editRow.smer === "DOSLA" ? "Došlá pošta" : "Odoslaná pošta"}
                    </span>
                  </div>
                </>
              ) : null}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Spôsob doručenia *</label>
                <select name="sposob" defaultValue={editRow?.sposob ?? "POSTA"} required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {(Object.entries(postaSpusobLabels) as [PostaSpusob, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dátum doručenia/odoslania *</label>
                <input type="date" name="datumDoruceOdoslania" defaultValue={editRow?.datumDoruceOdoslania ?? new Date().toISOString().split("T")[0]} required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Odosielateľ / Príjemca *</label>
                <input type="text" name="odosielatelPrijemcaNazov" defaultValue={editRow?.odosielatelPrijemcaNazov ?? ""} required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Názov firmy / Meno" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Adresa</label>
                  <input type="text" name="adresa" defaultValue={editRow?.odosielatelPrijemcaAdresa ?? ""}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">IČO</label>
                  <input type="text" name="ico" defaultValue={editRow?.odosielatelPrijemcaIco ?? ""}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Vec *</label>
                <input type="text" name="vec" defaultValue={editRow?.vec ?? ""} required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Stručný popis" />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal({ mode: "none" })}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Zrušiť
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? "Ukladám…" : "Uložiť"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preklop Modal */}
      {modal.mode === "preklop" && preklopRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Preklopiť do registratúry</h2>
              <button onClick={() => setModal({ mode: "none" })}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handlePreklop} className="p-6 space-y-4">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                <p className="font-medium">{preklopRow.poradoveCislo}</p>
                <p className="text-gray-500 dark:text-gray-400 truncate">{preklopRow.vec}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Registratúrny plán *</label>
                <select name="planId" required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Vyberte —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.znacka} – {p.nazov}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Spracovateľ *</label>
                <select name="spracovatelId" required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Vyberte —</option>
                  {spracovatelia.map(s => <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>)}
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
                <button type="button" onClick={() => setModal({ mode: "none" })}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Zrušiť
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  <Shuffle size={14} /> {saving ? "Prekládam…" : "Preklop do registratúry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
