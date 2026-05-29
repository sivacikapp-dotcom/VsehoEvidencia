"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  FolderOpen, Plus, Trash2, X, Loader2, Users, ChevronRight,
  Search, FileText, Paperclip, Building2, File,
} from "lucide-react"
import { createAgenda, deleteAgenda, searchDocuments, type DocSearchResult } from "./actions"

interface Agenda {
  id: number
  name: string
  documentCount: number
  gestors: { id: number; name: string }[]
  isMyAgenda: boolean
}

interface Props {
  agendas: Agenda[]
  isAdmin: boolean
  isAppAdmin?: boolean
}

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

const confLabel: Record<string, { text: string; cls: string }> = {
  VEREJNY:  { text: "Verejný",  cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  INTERNI:  { text: "Interný",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  DOVERNI:  { text: "Dôverný",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

type SearchOpts = { nazovDok: boolean; nazovPrilohy: boolean; textDok: boolean; textPrilohy: boolean; nazovSuboru: boolean }

export default function AgendasClient({ agendas, isAdmin, isAppAdmin = false }: Props) {
  const router = useRouter()

  // New agenda
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState<number | null>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpts, setSearchOpts] = useState<SearchOpts>({
    nazovDok: true, nazovPrilohy: true, textDok: false, textPrilohy: false, nazovSuboru: false,
  })
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<DocSearchResult[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string, opts: SearchOpts) => {
    if (!q.trim() || q.trim().length < 2) { setSearchResults(null); return }
    const anyOpt = opts.nazovDok || opts.nazovPrilohy || opts.textDok || opts.textPrilohy
    if (!anyOpt) { setSearchResults(null); return }
    setSearching(true)
    try {
      const { results } = await searchDocuments(q, opts)
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(searchQuery, searchOpts), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, searchOpts, runSearch])

  function toggleOpt(key: keyof SearchOpts) {
    setSearchOpts(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const isSearchActive = searchQuery.trim().length >= 2

  async function handleCreate() {
    if (!newName.trim()) { setError("Zadajte názov agendy"); return }
    setPending(true); setError("")
    const fd = new FormData(); fd.set("name", newName.trim())
    const res = await createAgenda(fd)
    setPending(false)
    if (res?.error) { setError(res.error); return }
    setNewName(""); setShowNew(false); router.refresh()
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Naozaj chcete zmazať agendu „${name}" a všetky jej dokumenty?`)) return
    setDeleting(id)
    await deleteAgenda(id)
    setDeleting(null)
    router.refresh()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Interné dokumenty</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {isSearchActive
              ? searchResults === null ? "Vyhľadávanie…" : `Výsledky hľadania (${searchResults.length})`
              : "Zoznam agend"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAppAdmin && (
            <span className="px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              Režim len na čítanie
            </span>
          )}
          {isAdmin && !isAppAdmin && (
            <button
              onClick={() => { setShowNew(true); setError("") }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Nová agenda
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Vyhľadať v dokumentoch…"
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

        {/* Search options */}
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
      </div>

      {/* Content */}
      {isSearchActive ? (
        <SearchResults results={searchResults} searching={searching} query={searchQuery} />
      ) : (
        <>
          {agendas.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
              <p>Zatiaľ žiadne agendy.</p>
              {isAdmin && <p className="text-sm mt-1">Vytvorte prvú agendu tlačidlom vyššie.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {agendas.map((agenda) => (
                <div
                  key={agenda.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-colors group flex items-center"
                >
                  <Link href={`/dashboard/dokumenty/${agenda.id}`} className="flex-1 flex items-center gap-4 px-5 py-4 min-w-0">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg shrink-0">
                      <FolderOpen size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 w-56 shrink-0">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {agenda.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {agenda.documentCount}{" "}
                        {agenda.documentCount === 1 ? "dokument" : agenda.documentCount < 5 ? "dokumenty" : "dokumentov"}
                      </p>
                    </div>
                    <div className="flex-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                      <Users size={13} className="shrink-0" />
                      <span className="truncate">
                        {agenda.gestors.length > 0
                          ? agenda.gestors.map((g) => g.name).join(", ")
                          : <span className="italic">Žiadny gestor</span>
                        }
                      </span>
                    </div>
                    {agenda.isMyAgenda && (
                      <span className="inline-flex items-center text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full shrink-0">
                        Moja agenda
                      </span>
                    )}
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 shrink-0" />
                  </Link>

                  {isAdmin && (
                    <div className="pr-3 shrink-0">
                      <button
                        onClick={(e) => { e.preventDefault(); handleDelete(agenda.id, agenda.name) }}
                        disabled={deleting === agenda.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Zmazať agendu"
                      >
                        {deleting === agenda.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* New Agenda Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNew(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nová agenda</h2>
              <button onClick={() => setShowNew(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Názov agendy <span className="text-red-500">*</span>
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="napr. Bezpečnostné smernice"
              className={inputCls}
              autoFocus
            />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                Zrušiť
              </button>
              <button
                onClick={handleCreate}
                disabled={pending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                Vytvoriť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
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

function SearchResults({
  results, searching, query,
}: {
  results: DocSearchResult[] | null
  searching: boolean
  query: string
}) {
  if (searching) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Vyhľadávam…</span>
      </div>
    )
  }

  if (results === null) return null

  if (results.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <Search size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Žiadne výsledky pre „{query}"</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {results.map((r) => {
        const conf = confLabel[r.confidentiality] ?? confLabel.INTERNI
        const isAtt = r.type === "attachment"
        return (
          <Link
            key={`${r.type}-${r.documentId}-${r.attachmentId ?? ""}`}
            href={`/dashboard/dokumenty/${r.agendaId}/${r.documentId}`}
            className="flex items-start gap-4 px-5 py-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
          >
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isAtt ? "bg-amber-50 dark:bg-amber-900/20" : "bg-blue-50 dark:bg-blue-900/30"}`}>
              {isAtt
                ? <Paperclip size={16} className="text-amber-600 dark:text-amber-400" />
                : <FileText size={16} className="text-blue-600 dark:text-blue-400" />
              }
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <HighlightText text={`${r.znacka} – ${r.nazov}`} query={query} />
                </span>
                {r.version > 1 && (
                  <span className="text-xs text-gray-400">v{r.version}</span>
                )}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${conf.cls}`}>
                  {conf.text}
                </span>
              </div>

              {isAtt && r.attachmentZnacka && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                  <Paperclip size={11} className="shrink-0" />
                  <span>
                    príloha: <HighlightText text={`${r.attachmentZnacka} – ${r.attachmentNazov}`} query={query} />
                  </span>
                </p>
              )}

              {r.docSnippet && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed line-clamp-2">
                  <HighlightText text={r.docSnippet} query={query} />
                </p>
              )}

              {r.attSnippet && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed line-clamp-2">
                  <span className="text-gray-400 dark:text-gray-500 mr-1">príloha:</span>
                  <HighlightText text={r.attSnippet} query={query} />
                </p>
              )}

              {r.matchedDocFile && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <File size={11} className="shrink-0" />
                  <HighlightText text={r.matchedDocFile} query={query} />
                </p>
              )}

              {r.matchedAttFile && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <File size={11} className="shrink-0" />
                  <HighlightText text={r.matchedAttFile} query={query} />
                </p>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                <Building2 size={11} className="shrink-0" />
                {r.agendaName}
              </p>
            </div>

            <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 shrink-0 mt-1" />
          </Link>
        )
      })}
    </div>
  )
}
