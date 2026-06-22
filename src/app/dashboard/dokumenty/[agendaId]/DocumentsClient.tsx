"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  FileText, Plus, Trash2, Pencil, X, Loader2,
  ChevronRight, ArrowLeft, Paperclip, Eye, EyeOff, Lock,
  UserPlus, UserMinus, Shield, Search, ArrowUpDown, ChevronUp, ChevronDown,
  File, Building2, GitBranch,
} from "lucide-react"
import { createDocument, updateDocument, deleteDocument, setAgendaGestor, searchDocuments, createNewDocumentDraft, type DocSearchResult } from "../actions"
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
  prilohaLink: string | null
  datumUcinnosti: string | null
  status: string
  parentId: number | null
  version: number
  canEdit: boolean
  canDelete: boolean
  canAccess: boolean
  attachmentOnlyAccess?: boolean
  gestors: { id: number; name: string }[]
}

interface Props {
  agenda: { id: number; name: string }
  agendaSkratka: string | null
  documents: Document[]
  canCreate: boolean
  isAdmin: boolean
  isAppAdmin?: boolean
  allUsers: { id: number; name: string; email: string }[]
  agendaGestors: { id: number; name: string }[]
  agendaGestorIds: Set<number>
  gestorUsers: { id: number; name: string }[]
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
type SearchOpts = { nazovDok: boolean; nazovPrilohy: boolean; textDok: boolean; textPrilohy: boolean; nazovSuboru: boolean }

const confLabel: Record<string, { text: string; cls: string }> = {
  VEREJNY: { text: "Verejný",  cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  INTERNI: { text: "Interný",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  DOVERNI: { text: "Dôverný",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  // eslint-disable-next-line security/detect-non-literal-regexp -- input is sanitized by escapeRegex()
  const parts = text.split(new RegExp(`(${escapeRegex(q)})`, "gi"))
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/40 text-inherit rounded-[2px] px-0.5 not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

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
        className={`flex items-center gap-1 transition-colors whitespace-nowrap ${active ? "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300" : "hover:text-gray-700 dark:hover:text-gray-200"}`}>
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
  datumUcinnosti: string
  confidentiality: Confidentiality
  gestorId: number | null
  accessUserIds: Set<string>
  prilohaLink: string
}

function NewDocDraftModal({
  agendaId, allUsers, gestorUsers, onClose, onCreated,
}: {
  agendaId: number
  allUsers: { id: number; name: string; email: string }[]
  gestorUsers: { id: number; name: string }[]
  onClose: () => void
  onCreated: (newId: number) => void
}) {
  const [nazov, setNazov] = useState("")
  const [confidentiality, setConfidentiality] = useState<Confidentiality>("INTERNI")
  const [gestorId, setGestorId] = useState<number | null>(null)
  const [accessUserIds, setAccessUserIds] = useState<Set<string>>(new Set())
  const [prilohaLink, setPrilohaLink] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleSubmit() {
    if (!nazov.trim()) { setError("Názov je povinný"); return }
    setPending(true); setError("")
    const fd = new FormData()
    fd.set("agendaId", String(agendaId))
    fd.set("nazov", nazov.trim())
    fd.set("confidentiality", confidentiality)
    fd.set("prilohaLink", prilohaLink)
    if (gestorId) fd.set("gestorId", String(gestorId))
    if (confidentiality === "DOVERNI") accessUserIds.forEach((id) => fd.append("accessUserIds", id))
    if (fileRef.current?.files?.[0]) fd.set("priloha", fileRef.current.files[0])
    const res = await createNewDocumentDraft(fd)
    setPending(false)
    if (res?.error) { setError(res.error); return }
    if (res?.newDocumentId) onCreated(res.newDocumentId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nový draft dokumentu</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Poradové číslo a dátum schválenia sa vyplnia pred schválením.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Názov <span className="text-red-500">*</span></label>
            <input value={nazov} onChange={(e) => setNazov(e.target.value)} placeholder="napr. Bezpečnostná politika" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Úroveň dôvernosti</label>
            <select value={confidentiality} onChange={(e) => setConfidentiality(e.target.value as Confidentiality)} className={selectCls}>
              <option value="VEREJNY">Verejný</option>
              <option value="INTERNI">Interný</option>
              <option value="DOVERNI">Dôverný</option>
            </select>
          </div>
          {confidentiality === "DOVERNI" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Používatelia s prístupom <span className="text-red-500">*</span></label>
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-40 overflow-y-auto">
                {allUsers.map((u) => {
                  const checked = accessUserIds.has(String(u.id))
                  return (
                    <label key={u.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-red-50 dark:bg-red-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        setAccessUserIds((prev) => { const next = new Set(prev); next.has(String(u.id)) ? next.delete(String(u.id)) : next.add(String(u.id)); return next })
                      }} className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500 shrink-0" />
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${checked ? "font-medium text-red-700 dark:text-red-300" : "text-gray-700 dark:text-gray-300"}`}>{u.name}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{u.email}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Gestor dokumentu</label>
            <select value={gestorId ?? ""} onChange={(e) => setGestorId(e.target.value ? parseInt(e.target.value) : null)} className={selectCls}>
              <option value="">— Žiadny gestor —</option>
              {gestorUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Súbor</label>
            <input ref={fileRef} type="file" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400" />
            {fileName && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{fileName}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Link na súbor</label>
            <input value={prilohaLink} onChange={(e) => setPrilohaLink(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Zrušiť</button>
          <button onClick={handleSubmit} disabled={pending} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {pending && <Loader2 size={14} className="animate-spin" />}
            Vytvoriť draft
          </button>
        </div>
      </div>
    </div>
  )
}

const emptyForm: DocForm = {
  znacka: "",
  nazov: "",
  datumSchvalenia: "",
  datumUcinnosti: "",
  confidentiality: "INTERNI",
  gestorId: null,
  accessUserIds: new Set(),
  prilohaLink: "",
}

export default function DocumentsClient({
  agenda,
  agendaSkratka,
  documents,
  canCreate,
  isAdmin,
  isAppAdmin = false,
  allUsers,
  agendaGestors,
  agendaGestorIds,
  gestorUsers,
}: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<"new" | "edit" | null>(null)
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [showNewDraftModal, setShowNewDraftModal] = useState(false)
  const [form, setForm] = useState<DocForm>(emptyForm)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [removePriloha, setRemovePriloha] = useState(false)
  const [gestorPending, setGestorPending] = useState<number | null>(null)

  // full-text search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpts, setSearchOpts] = useState<SearchOpts>({
    nazovDok: true, nazovPrilohy: true, textDok: false, textPrilohy: false, nazovSuboru: false,
  })
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<DocSearchResult[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSearchActive = searchQuery.trim().length >= 2

  const runSearch = useCallback(async (q: string, opts: SearchOpts) => {
    if (!q.trim() || q.trim().length < 2) { setSearchResults(null); return }
    const anyOpt = opts.nazovDok || opts.nazovPrilohy || opts.textDok || opts.textPrilohy || opts.nazovSuboru
    if (!anyOpt) { setSearchResults(null); return }
    setSearching(true)
    try {
      const { results } = await searchDocuments(q, { ...opts, agendaId: agenda.id })
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }, [agenda.id])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(searchQuery, searchOpts), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, searchOpts, runSearch])

  function toggleOpt(key: keyof SearchOpts) {
    setSearchOpts(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // table filter / sort state
  const [filterConfidentiality, setFilterConfidentiality] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const hasActiveFilters = filterConfidentiality.size > 0

  function clearAllFilters() {
    setFilterConfidentiality(new Set())
  }

  function handleSort(key: string) {
    const k = key as SortKey
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir("asc") }
  }

  const availableConfidentialityOptions = useMemo(() => {
    const vals = new Set(documents.map(d => d.confidentiality))
    return confidentialityOptions.filter(opt => vals.has(opt.value as Confidentiality) || filterConfidentiality.has(opt.value))
  }, [documents, filterConfidentiality])

  const filtered = useMemo(() => documents.filter(d => {
    if (filterConfidentiality.size > 0 && !filterConfidentiality.has(d.confidentiality)) return false
    return true
  }), [documents, filterConfidentiality])

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
      datumUcinnosti: doc.datumUcinnosti ?? doc.datumSchvalenia,
      confidentiality: doc.confidentiality,
      gestorId: null,
      accessUserIds: new Set(),
      prilohaLink: doc.prilohaLink ?? "",
    })
    setEditDoc(doc)
    setFileName(null)
    setRemovePriloha(false)
    setError("")
    setModal("edit")
  }

  async function handleSubmit() {
    setPending(true); setError("")
    const effectiveUcinnosti = form.datumUcinnosti || form.datumSchvalenia
    if (effectiveUcinnosti && form.datumSchvalenia && effectiveUcinnosti < form.datumSchvalenia) {
      setError("Dátum účinnosti nesmie byť skôr ako dátum schválenia.")
      setPending(false); return
    }
    const fd = new FormData()
    fd.set("agendaId", String(agenda.id))
    fd.set("znacka", form.znacka)
    fd.set("nazov", form.nazov)
    fd.set("datumSchvalenia", form.datumSchvalenia)
    fd.set("datumUcinnosti", effectiveUcinnosti)
    fd.set("confidentiality", form.confidentiality)
    fd.set("prilohaLink", form.prilohaLink)
    if (fileRef.current?.files?.[0]) fd.set("priloha", fileRef.current.files[0])
    if (modal === "new" && form.gestorId) fd.set("gestorId", String(form.gestorId))
    if (modal === "new" && form.confidentiality === "DOVERNI") {
      form.accessUserIds.forEach((id) => fd.append("accessUserIds", id))
    }
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewDraftModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg text-sm font-medium transition-colors"
            >
              <GitBranch size={16} /> Nový draft
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Nový dokument
            </button>
          </div>
        )}
      </div>

      {/* Sticky toolbar — search + filter */}
      {documents.length > 0 && (
        <div className="sticky top-0 z-10 -mx-8 px-8 pt-2 pb-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Vyhľadať v tejto agende…"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchResults(null) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5 px-1">
            {([
              ["nazovDok",    "Názvy dokumentov"],
              ["nazovPrilohy","Názvy príloh"],
              ["textDok",     "Texty dokumentov"],
              ["textPrilohy", "Texty príloh"],
              ["nazovSuboru", "Názvy súborov"],
            ] as [keyof SearchOpts, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={searchOpts[key]}
                  onChange={() => toggleOpt(key)}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
              </label>
            ))}
          </div>

          {!isSearchActive && (
            <div className="flex gap-2 flex-wrap items-center mt-3">
              <MultiSelect
                placeholder="Dôvernosť"
                options={availableConfidentialityOptions}
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
              {sortKey && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg">
                  {sortDir === "asc" ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
                  <span>{{ znacka: "Poradové číslo", nazov: "Názov", datumSchvalenia: "Dátum schválenia", confidentiality: "Dôvernosť" }[sortKey]}</span>
                  <button type="button" onClick={() => setSortKey(null)} className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100">
                    <X size={11} />
                  </button>
                </div>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                {sorted.length} / {documents.length}
              </span>
            </div>
          )}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p>Táto agenda nemá žiadne dokumenty.</p>
          {canCreate && <p className="text-sm mt-1">Pridajte prvý dokument tlačidlom vyššie.</p>}
        </div>
      ) : isSearchActive ? (
        <AgendaSearchResults results={searchResults} searching={searching} query={searchQuery} agendaId={agenda.id} />
      ) : (
        <div
          className="mt-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-auto resize-y"
          style={{ height: 359, minHeight: 200 }}
        >
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <Th label="Poradové číslo" colKey="znacka" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <Th label="Názov" colKey="nazov" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <Th label="Dátum schválenia" colKey="datumSchvalenia" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <Th label="Dôvernosť" colKey="confidentiality" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className={thBase}>Gestor dokumentu</th>
                  <th className={thBase}>Súbor</th>
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
                      onClick={doc.canAccess ? () => router.push(`/dashboard/dokumenty/${agenda.id}/${doc.id}`) : undefined}
                      className={`transition-colors group ${doc.canAccess ? "hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer" : "opacity-60 bg-red-50/30 dark:bg-red-900/5"}`}
                    >
                      {(() => {
                        const isNewDocDraft = doc.parentId === null && doc.status === "DRAFT"
                        return (
                          <>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                {agendaSkratka && doc.canAccess && !isNewDocDraft && doc.znacka && (
                                  <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                                    SKNIC-{agendaSkratka}-{doc.znacka}-{doc.version}
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5">
                                  {isNewDocDraft ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
                                      <GitBranch size={11} /> Draft
                                    </span>
                                  ) : (
                                    <span className={`font-mono text-xs font-medium ${doc.canAccess ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}>
                                      {doc.znacka}
                                    </span>
                                  )}
                                  {!isNewDocDraft && doc.version > 1 && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                      v{doc.version}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={doc.canAccess ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}>{doc.nazov}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 tabular-nums">
                              {isNewDocDraft ? <span className="text-gray-300 dark:text-gray-600">—</span> : fmtDate(doc.datumSchvalenia)}
                            </td>
                          </>
                        )
                      })()}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${confidentialityColors[doc.confidentiality]}`}>
                          {doc.confidentiality === "DOVERNI" && <Lock size={11} />}
                          {doc.confidentiality === "INTERNI" && <Eye size={11} />}
                          {doc.confidentiality === "VEREJNY" && <EyeOff size={11} />}
                          {confidentialityLabels[doc.confidentiality]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {doc.canAccess && doc.gestors[0]
                          ? <span className="text-xs text-gray-700 dark:text-gray-300">{doc.gestors[0].name}</span>
                          : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {doc.canAccess && doc.prilohaName ? (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Paperclip size={12} />
                            <span className="truncate max-w-[120px]">{doc.prilohaName}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {doc.canAccess ? (
                          <div className="flex items-center justify-end gap-1">
                            {doc.attachmentOnlyAccess && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                <Paperclip size={11} /> Príloha
                              </span>
                            )}
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
                        ) : (
                          <div className="flex items-center justify-end">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                              <Lock size={11} /> Nemáte prístup
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </div>
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
                  Poradové číslo <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.znacka}
                  onChange={(e) => setForm((f) => ({ ...f, znacka: e.target.value }))}
                  placeholder="napr. 1-2024"
                  className={inputCls}
                />
                {agendaSkratka && form.znacka && (
                  <p className="mt-1 text-[10px] text-gray-400 font-mono">
                    Číslo dokumentu: SKNIC-{agendaSkratka}-{form.znacka}-1
                  </p>
                )}
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
                  onChange={(e) => {
                    const val = e.target.value
                    setForm((f) => ({
                      ...f,
                      datumSchvalenia: val,
                      datumUcinnosti: f.datumUcinnosti === f.datumSchvalenia || f.datumUcinnosti === "" ? val : f.datumUcinnosti,
                    }))
                  }}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dátum účinnosti
                </label>
                <input
                  type="date"
                  value={form.datumUcinnosti || form.datumSchvalenia}
                  min={form.datumSchvalenia || undefined}
                  onChange={(e) => setForm((f) => ({ ...f, datumUcinnosti: e.target.value }))}
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

              {modal === "new" && form.confidentiality === "DOVERNI" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Používatelia s prístupom <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                    {allUsers.map((u) => {
                      const checked = form.accessUserIds.has(String(u.id))
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                            checked ? "bg-red-50 dark:bg-red-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setForm((f) => {
                                const next = new Set(f.accessUserIds)
                                next.has(String(u.id)) ? next.delete(String(u.id)) : next.add(String(u.id))
                                return { ...f, accessUserIds: next }
                              })
                            }}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className={`text-sm truncate ${checked ? "font-medium text-red-700 dark:text-red-300" : "text-gray-700 dark:text-gray-300"}`}>{u.name}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{u.email}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  {form.accessUserIds.size === 0 && (
                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                      Žiadny používateľ s prístupom — dokument bude prístupný len gestorovi a správcom.
                    </p>
                  )}
                </div>
              )}

              {modal === "new" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gestor dokumentu
                  </label>
                  <select
                    value={form.gestorId ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, gestorId: e.target.value ? parseInt(e.target.value) : null }))}
                    className={selectCls}
                  >
                    <option value="">— Žiadny gestor —</option>
                    {gestorUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Súbor
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
                        Súbor bude odstránený.{" "}
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

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link na súbor
                </label>
                <input
                  value={form.prilohaLink}
                  onChange={(e) => setForm((f) => ({ ...f, prilohaLink: e.target.value }))}
                  placeholder="https://..."
                  className={inputCls}
                />
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

      {/* New Document Draft Modal */}
      {showNewDraftModal && (
        <NewDocDraftModal
          agendaId={agenda.id}
          allUsers={allUsers}
          gestorUsers={gestorUsers}
          onClose={() => setShowNewDraftModal(false)}
          onCreated={(id) => { setShowNewDraftModal(false); router.push(`/dashboard/dokumenty/${agenda.id}/${id}`) }}
        />
      )}
    </div>
  )
}

function AgendaSearchResults({
  results,
  searching,
  query,
  agendaId,
}: {
  results: DocSearchResult[] | null
  searching: boolean
  query: string
  agendaId: number
}) {
  if (searching) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-gray-400 dark:text-gray-500">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Vyhľadávam…</span>
      </div>
    )
  }

  if (results === null) return null

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        <Search size={32} className="mb-3 opacity-40" />
        <p className="text-sm">Žiadne výsledky pre „{query}"</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        {results.length} {results.length === 1 ? "výsledok" : results.length < 5 ? "výsledky" : "výsledkov"}
      </p>
      {results.map((r, i) => {
        const isAtt = r.type === "attachment"
        const conf = confLabel[r.confidentiality]
        return (
          <Link
            key={i}
            href={`/dashboard/dokumenty/${agendaId}/${r.documentId}`}
            className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {isAtt
                  ? <Paperclip size={15} className="text-gray-400" />
                  : <FileText size={15} className="text-blue-500" />}
              </div>
              <div className="flex-1 min-w-0">
                {/* document znacka + nazov */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <HighlightText text={r.znacka} query={query} />
                  </span>
                  {r.version > 1 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      v{r.version}
                    </span>
                  )}
                  {conf && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${conf.cls}`}>
                      {conf.text}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                  <HighlightText text={r.nazov} query={query} />
                </p>

                {/* attachment info */}
                {isAtt && r.attachmentZnacka && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Paperclip size={11} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Príloha:{" "}
                      <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                        <HighlightText text={r.attachmentZnacka} query={query} />
                      </span>
                      {r.attachmentNazov && (
                        <> — <HighlightText text={r.attachmentNazov} query={query} /></>
                      )}
                    </span>
                  </div>
                )}

                {/* file names */}
                {r.matchedDocFile && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <File size={11} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Súbor: <HighlightText text={r.matchedDocFile} query={query} />
                    </span>
                  </div>
                )}
                {r.matchedAttFile && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <File size={11} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Súbor prílohy: <HighlightText text={r.matchedAttFile} query={query} />
                    </span>
                  </div>
                )}

                {/* text snippets */}
                {r.docSnippet && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 italic">
                    <HighlightText text={r.docSnippet} query={query} />
                  </p>
                )}
                {r.attSnippet && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 italic">
                    <Building2 size={10} className="inline mr-1 opacity-60" />
                    <HighlightText text={r.attSnippet} query={query} />
                  </p>
                )}
              </div>
              <ChevronRight size={15} className="shrink-0 text-gray-300 dark:text-gray-600 mt-0.5" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
