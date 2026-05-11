"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  FileText, Plus, Trash2, Pencil, X, Loader2,
  ChevronRight, ArrowLeft, Paperclip, Eye, EyeOff, Lock,
  UserPlus, UserMinus, Shield, Search, ArrowUpDown, ChevronUp, ChevronDown,
} from "lucide-react"
import { createDocument, updateDocument, deleteDocument, setAgendaGestor } from "../actions"
import { fmtDate } from "@/lib/formatDate"
import { MultiSelect } from "@/components/MultiSelect"

type Confidentiality = "VEREJNY" | "INTERNI" | "DOVERNI"

interface Document {
  id: number
  znacka: string
  nazov: string
  datumSchvalenia: string
  confidentiality: Confidentiality
  prilohaName: string | null
  version: number
  canEdit: boolean
  canDelete: boolean
  gestors: { id: number; name: string }[]
}

interface Props {
  agenda: { id: number; name: string }
  documents: Document[]
  canCreate: boolean
  isAdmin: boolean
  isAppAdmin?: boolean
  allUsers: { id: number; name: string; email: string }[]
  agendaGestors: { id: number; name: string }[]
  agendaGestorIds: Set<number>
}

const confidentialityLabels: Record<Confidentiality, string> = {
  VEREJNY: "Verejný",
  INTERNI: "Interný",
  DOVERNI: "Dôverný",
}

const confidentialityColors: Record<Confidentiality, string> = {
  VEREJNY: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  INTERNI: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  DOVERNI: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

const selectCls = inputCls

type SortKey = "znacka" | "nazov" | "datumSchvalenia" | "confidentiality"

const confidentialityOptions = (Object.keys(confidentialityLabels) as Confidentiality[]).map(k => ({
  value: k,
  label: confidentialityLabels[k],
}))

const thBase = "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"

function Th({ label, colKey, sortKey, sortDir, onSort }: {
  label: string; colKey: string
  sortKey: string | null; sortDir: "asc" | "desc"
  onSort: (k: string) => void
}) {
  const active = sortKey === colKey
  return (
    <th className={thBase}>
      <button type="button" onClick={() => onSort(colKey)}
        className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors whitespace-nowrap">
        {label}
        {active
          ? sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ArrowUpDown size={11} className="opacity-40" />}
      </button>
    </th>
  )
}

interface DocForm {
  znacka: string
  nazov: string
  datumSchvalenia: string
  confidentiality: Confidentiality
}

const emptyForm: DocForm = {
  znacka: "",
  nazov: "",
  datumSchvalenia: "",
  confidentiality: "INTERNI",
}

export default function DocumentsClient({
  agenda,
  documents,
  canCreate,
  isAdmin,
  isAppAdmin = false,
  allUsers,
  agendaGestors,
  agendaGestorIds,
}: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<"new" | "edit" | null>(null)
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [form, setForm] = useState<DocForm>(emptyForm)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [removePriloha, setRemovePriloha] = useState(false)
  const [gestorPending, setGestorPending] = useState<number | null>(null)

  // filter / sort state
  const [search, setSearch] = useState("")
  const [filterConfidentiality, setFilterConfidentiality] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const hasActiveFilters = search || filterConfidentiality.size > 0

  function clearAllFilters() {
    setSearch(""); setFilterConfidentiality(new Set())
  }

  function handleSort(key: string) {
    const k = key as SortKey
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir("asc") }
  }

  const filtered = useMemo(() => documents.filter(d => {
    if (filterConfidentiality.size > 0 && !filterConfidentiality.has(d.confidentiality)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!d.znacka.toLowerCase().includes(q) && !d.nazov.toLowerCase().includes(q)) return false
    }
    return true
  }), [documents, filterConfidentiality, search])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let aVal: string = ""
      let bVal: string = ""
      switch (sortKey) {
        case "znacka": aVal = a.znacka; bVal = b.znacka; break
        case "nazov": aVal = a.nazov; bVal = b.nazov; break
        case "datumSchvalenia": aVal = a.datumSchvalenia; bVal = b.datumSchvalenia; break
        case "confidentiality":
          aVal = confidentialityLabels[a.confidentiality]
          bVal = confidentialityLabels[b.confidentiality]
          break
      }
      const cmp = aVal.localeCompare(bVal, "sk")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function openNew() {
    setForm(emptyForm)
    setEditDoc(null)
    setFileName(null)
    setRemovePriloha(false)
    setError("")
    setModal("new")
  }

  function openEdit(doc: Document) {
    setForm({
      znacka: doc.znacka,
      nazov: doc.nazov,
      datumSchvalenia: doc.datumSchvalenia,
      confidentiality: doc.confidentiality,
    })
    setEditDoc(doc)
    setFileName(null)
    setRemovePriloha(false)
    setError("")
    setModal("edit")
  }

  async function handleSubmit() {
    setPending(true); setError("")
    const fd = new FormData()
    fd.set("agendaId", String(agenda.id))
    fd.set("znacka", form.znacka)
    fd.set("nazov", form.nazov)
    fd.set("datumSchvalenia", form.datumSchvalenia)
    fd.set("confidentiality", form.confidentiality)
    if (fileRef.current?.files?.[0]) fd.set("priloha", fileRef.current.files[0])
    if (modal === "edit" && editDoc) {
      fd.set("documentId", String(editDoc.id))
      fd.set("removePriloha", removePriloha ? "true" : "false")
      const res = await updateDocument(fd)
      setPending(false)
      if (res?.error) { setError(res.error); return }
    } else {
      const res = await createDocument(fd)
      setPending(false)
      if (res?.error) { setError(res.error); return }
    }
    setModal(null)
    router.refresh()
  }

  async function handleGestor(userId: number, add: boolean) {
    setGestorPending(userId)
    await setAgendaGestor(agenda.id, userId, add)
    setGestorPending(null)
    router.refresh()
  }

  async function handleDelete(id: number, nazov: string) {
    if (!confirm(`Naozaj chcete zmazať dokument „${nazov}"?`)) return
    setDeleting(id)
    await deleteDocument(id)
    setDeleting(null)
    router.refresh()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link
          href="/dashboard/dokumenty"
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={15} /> Agendy
        </Link>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{agenda.name}</span>
      </div>

      <div className="flex items-center justify-between mt-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{agenda.name}</h1>
          {agendaGestors.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Gestor(i): {agendaGestors.map((g) => g.name).join(", ")}
            </p>
          )}
        </div>
        {isAppAdmin && (
          <span className="px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
            Režim len na čítanie
          </span>
        )}
        {canCreate && !isAppAdmin && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nový dokument
          </button>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p>Táto agenda nemá žiadne dokumenty.</p>
          {canCreate && <p className="text-sm mt-1">Pridajte prvý dokument tlačidlom vyššie.</p>}
        </div>
      ) : (
        <>
          {/* filters */}
          <div className="flex gap-2 flex-wrap items-center mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hľadať..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
              />
            </div>
            <MultiSelect
              placeholder="Dôvernosť"
              options={confidentialityOptions}
              selected={filterConfidentiality}
              onChange={setFilterConfidentiality}
            />
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-300 transition-colors"
              >
                <X size={12} /> Zrušiť filtre
              </button>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
              {sorted.length} / {documents.length}
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <Th label="Značka" colKey="znacka" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <Th label="Názov" colKey="nazov" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <Th label="Dátum schválenia" colKey="datumSchvalenia" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <Th label="Dôvernosť" colKey="confidentiality" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className={thBase}>Gestor</th>
                  <th className={thBase}>Príloha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                      Žiadne dokumenty nezodpovedajú filtru
                    </td>
                  </tr>
                ) : (
                  sorted.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => router.push(`/dashboard/dokumenty/${agenda.id}/${doc.id}`)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                            {doc.znacka}
                          </span>
                          {doc.version > 1 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              v{doc.version}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-900 dark:text-gray-100">{doc.nazov}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 tabular-nums">
                        {fmtDate(doc.datumSchvalenia)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${confidentialityColors[doc.confidentiality]}`}>
                          {doc.confidentiality === "DOVERNI" && <Lock size={11} />}
                          {doc.confidentiality === "INTERNI" && <Eye size={11} />}
                          {doc.confidentiality === "VEREJNY" && <EyeOff size={11} />}
                          {confidentialityLabels[doc.confidentiality]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {doc.gestors[0]
                          ? <span className="text-xs text-gray-700 dark:text-gray-300">{doc.gestors[0].name}</span>
                          : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {doc.prilohaName ? (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Paperclip size={12} />
                            <span className="truncate max-w-[120px]">{doc.prilohaName}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {doc.canEdit && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openEdit(doc) }}
                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Editovať"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {doc.canDelete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.nazov) }}
                                disabled={deleting === doc.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Zmazať"
                              >
                                {deleting === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            )}
                          </div>
                          <ChevronRight size={15} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors shrink-0" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Gestori agendy – only for admin */}
      {isAdmin && (
        <div className="mt-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Shield size={15} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Gestori agendy</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">— môžu editovať všetky dokumenty v tejto agende</span>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {allUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${agendaGestorIds.has(u.id) ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{u.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleGestor(u.id, !agendaGestorIds.has(u.id))}
                  disabled={gestorPending === u.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    agendaGestorIds.has(u.id)
                      ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {gestorPending === u.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : agendaGestorIds.has(u.id) ? (
                    <><UserMinus size={12} /> Odobrať</>
                  ) : (
                    <><UserPlus size={12} /> Priradiť</>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* New / Edit Document Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {modal === "new" ? "Nový dokument" : "Editovať dokument"}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Značka <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.znacka}
                  onChange={(e) => setForm((f) => ({ ...f, znacka: e.target.value }))}
                  placeholder="napr. SM-001"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Názov <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.nazov}
                  onChange={(e) => setForm((f) => ({ ...f, nazov: e.target.value }))}
                  placeholder="napr. Bezpečnostná politika"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dátum schválenia <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.datumSchvalenia}
                  onChange={(e) => setForm((f) => ({ ...f, datumSchvalenia: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Úroveň dôvernosti
                </label>
                <select
                  value={form.confidentiality}
                  onChange={(e) => setForm((f) => ({ ...f, confidentiality: e.target.value as Confidentiality }))}
                  className={selectCls}
                >
                  <option value="VEREJNY">Verejný</option>
                  <option value="INTERNI">Interný</option>
                  <option value="DOVERNI">Dôverný</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Príloha (súbor)
                </label>
                {modal === "edit" && editDoc?.prilohaName && !removePriloha ? (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Paperclip size={14} className="text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{editDoc.prilohaName}</span>
                    <button
                      onClick={() => setRemovePriloha(true)}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      Odstrániť
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {removePriloha && (
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        Príloha bude odstránená.{" "}
                        <button onClick={() => setRemovePriloha(false)} className="underline">
                          Zrušiť
                        </button>
                      </p>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                      className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
                    />
                    {fileName && <p className="text-xs text-gray-500 dark:text-gray-400">{fileName}</p>}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                Zrušiť
              </button>
              <button
                onClick={handleSubmit}
                disabled={pending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {modal === "new" ? "Vytvoriť" : "Uložiť"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
