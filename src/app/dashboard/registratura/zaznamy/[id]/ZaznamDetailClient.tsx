"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, FileText, Upload, Download, ShieldCheck, ShieldAlert,
  CheckCircle, FolderOpen, Pencil, X, Plus, Trash2, Loader2,
  Inbox, Send, User, Building2, Paperclip, Search,
} from "lucide-react"
import {
  regZaznamTypeLabels,
  zaznamKategoriaLabels, zaznamKategoriaColors,
  zaznamStavLabels, zaznamStavColors,
  zaznamDovernostLabels, zaznamDovernostColors,
  sposobVybaveniаLabels,
  spisStatusColors, spisStatusLabels,
} from "@/lib/regLabels"
import type {
  ZaznamKategoria, ZaznamStav, SposobVybavenia, ZaznamDovernost,
  RegZaznamType, SpisStatus,
} from "@/generated/prisma/enums"
import {
  updateZaznam, changeZaznamStav,
  saveOdosielatel, addAdresat, updateAdresat, deleteAdresat,
  addZaznamPriloha, deleteZaznamPriloha,
} from "../actions"

// ─── Types ────────────────────────────────────────────────────────────────────

type OdosielatelData = {
  id: number; meno: string | null; priezvisko: string | null; nazov: string | null
  oddelenie: string | null; ulica: string | null; mesto: string | null
  psc: string | null; identifikator: string | null
} | null

type AdresatData = {
  id: number; poradie: number; meno: string | null; priezvisko: string | null; nazov: string | null
  oddelenie: string | null; ulica: string | null; mesto: string | null
  psc: string | null; identifikator: string | null
}

type PrilohaData = {
  id: number; cislo: number; forma: RegZaznamType; nazov: string
  originalName: string | null; fileSize: number | null; fileHash: string | null; hasFile: boolean
}

type ZaznamDetail = {
  id: number
  cisloZaznamu: string
  kategoria: ZaznamKategoria
  rok: number
  spracovatel: string
  utvar: { id: number; nazov: string } | null
  formaZaznamu: RegZaznamType
  vec: string | null
  popis: string | null
  stav: ZaznamStav
  sposobVybavenia: SposobVybavenia | null
  dovernost: ZaznamDovernost
  posta: { id: number; poradoveCislo: string; vec: string } | null
  odosielatel: OdosielatelData
  adresati: AdresatData[]
  prilohy: PrilohaData[]
  spisy: { id: number; cisloSpisu: string; nazov: string; status: SpisStatus }[]
  createdAt: string
  updatedAt: string
}

type SubjektItem = {
  id: number
  meno: string | null; priezvisko: string | null; nazov: string | null
  oddelenie: string | null; ulica: string | null; mesto: string | null
  psc: string | null; identifikator: string | null
}

interface Props {
  zaznam: ZaznamDetail
  utvary: { id: number; nazov: string }[]
  subjekty: SubjektItem[]
  canManage: boolean
  isAdmin: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelCls = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{children}</dd>
    </div>
  )
}

// ─── Contact form fields with address book search ────────────────────────────

type ContactValues = {
  meno: string; priezvisko: string; nazov: string; oddelenie: string
  ulica: string; mesto: string; psc: string; identifikator: string
}

function toValues(d?: Record<string, string | null> | null): ContactValues {
  return {
    meno: d?.meno ?? "", priezvisko: d?.priezvisko ?? "", nazov: d?.nazov ?? "",
    oddelenie: d?.oddelenie ?? "", ulica: d?.ulica ?? "", mesto: d?.mesto ?? "",
    psc: d?.psc ?? "", identifikator: d?.identifikator ?? "",
  }
}

function ContactFields({ defaults, subjekty }: {
  defaults?: Record<string, string | null> | null
  subjekty: SubjektItem[]
}) {
  const [vals, setVals] = useState<ContactValues>(() => toValues(defaults))
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const suggestions = query.trim().length > 0
    ? subjekty.filter(s => {
        const q = query.toLowerCase()
        return [s.meno, s.priezvisko, s.nazov, s.identifikator, s.mesto]
          .filter(Boolean).some(v => v!.toLowerCase().includes(q))
      }).slice(0, 8)
    : []

  function fill(s: SubjektItem) {
    setVals({
      meno: s.meno ?? "", priezvisko: s.priezvisko ?? "", nazov: s.nazov ?? "",
      oddelenie: s.oddelenie ?? "", ulica: s.ulica ?? "", mesto: s.mesto ?? "",
      psc: s.psc ?? "", identifikator: s.identifikator ?? "",
    })
    setQuery(""); setOpen(false)
  }

  function set(k: keyof ContactValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setVals(v => ({ ...v, [k]: e.target.value }))
  }

  return (
    <div className="space-y-3">
      {/* Adresár search */}
      <div ref={dropRef} className="relative">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text" value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Hľadať v adresári…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map(s => {
              const osobne = [s.meno, s.priezvisko].filter(Boolean).join(" ")
              return (
                <button key={s.id} type="button" onClick={() => fill(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{osobne || s.nazov || "—"}</p>
                  {osobne && s.nazov && <p className="text-xs text-gray-500 dark:text-gray-400">{s.nazov}</p>}
                  {(s.mesto || s.identifikator) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {[s.mesto, s.identifikator ? `IČO: ${s.identifikator}` : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Meno</label>
          <input type="text" name="meno" value={vals.meno} onChange={set("meno")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Priezvisko</label>
          <input type="text" name="priezvisko" value={vals.priezvisko} onChange={set("priezvisko")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Názov</label>
          <input type="text" name="nazov" value={vals.nazov} onChange={set("nazov")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Oddelenie</label>
          <input type="text" name="oddelenie" value={vals.oddelenie} onChange={set("oddelenie")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Ulica</label>
          <input type="text" name="ulica" value={vals.ulica} onChange={set("ulica")} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Mesto</label>
            <input type="text" name="mesto" value={vals.mesto} onChange={set("mesto")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>PSČ</label>
            <input type="text" name="psc" value={vals.psc} onChange={set("psc")} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Identifikátor (IČO apod.)</label>
          <input type="text" name="identifikator" value={vals.identifikator} onChange={set("identifikator")} className={inputCls} />
        </div>
      </div>
    </div>
  )
}

function contactLabel(c: Record<string, string | null>) {
  const parts = [
    [c.meno, c.priezvisko].filter(Boolean).join(" "),
    c.nazov,
    c.oddelenie,
  ].filter(Boolean)
  return parts.join(", ") || "—"
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ZaznamDetailClient({ zaznam, utvary, subjekty, canManage, isAdmin }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Stav change
  const [showVybavit, setShowVybavit] = useState(false)
  const [selectedSposob, setSelectedSposob] = useState<SposobVybavenia | "">("")

  // Odosielateľ
  const [editingOdos, setEditingOdos] = useState(false)
  const [savingOdos, setSavingOdos] = useState(false)

  // Adresáti
  const [addingAdresat, setAddingAdresat] = useState(false)
  const [editingAdresatId, setEditingAdresatId] = useState<number | null>(null)
  const [savingAdresat, setSavingAdresat] = useState(false)
  const [deletingAdresatId, setDeletingAdresatId] = useState<number | null>(null)

  // Prílohy
  const [addingPriloha, setAddingPriloha] = useState(false)
  const [savingPriloha, setSavingPriloha] = useState(false)
  const [deletingPriolohaId, setDeletingPriolohaId] = useState<number | null>(null)
  const [downloadIntegrity, setDownloadIntegrity] = useState<Record<number, boolean | null>>({})
  const priolohaFileRef = useRef<HTMLInputElement>(null)

  const isEditable = canManage && zaznam.stav !== "V_SPISE" && zaznam.stav !== "VYBAVENY"
  const sposobyVybavenia: SposobVybavenia[] = zaznam.kategoria === "PRIJATY"
    ? ["VZAL_NA_VEDOMIE", "ODPOVEDU"]
    : ["ZALOZENY", "ODOSLANY"]

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError("")
    const result = await updateZaznam(zaznam.id, new FormData(e.currentTarget))
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setEditing(false)
    startTransition(() => router.refresh())
  }

  async function handleVybavit() {
    if (!selectedSposob) return
    setSaving(true); setError("")
    const result = await changeZaznamStav(zaznam.id, "VYBAVENY", selectedSposob as SposobVybavenia)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setShowVybavit(false)
    startTransition(() => router.refresh())
  }

  async function handleSaveOdos(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingOdos(true)
    await saveOdosielatel(zaznam.id, new FormData(e.currentTarget))
    setSavingOdos(false)
    setEditingOdos(false)
    startTransition(() => router.refresh())
  }

  async function handleAddAdresat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingAdresat(true)
    await addAdresat(zaznam.id, new FormData(e.currentTarget))
    setSavingAdresat(false)
    setAddingAdresat(false)
    startTransition(() => router.refresh())
  }

  async function handleUpdateAdresat(e: React.FormEvent<HTMLFormElement>, adresatId: number) {
    e.preventDefault()
    setSavingAdresat(true)
    await updateAdresat(adresatId, new FormData(e.currentTarget))
    setSavingAdresat(false)
    setEditingAdresatId(null)
    startTransition(() => router.refresh())
  }

  async function handleDeleteAdresat(adresatId: number) {
    if (!confirm("Zmazať adresáta?")) return
    setDeletingAdresatId(adresatId)
    await deleteAdresat(adresatId)
    setDeletingAdresatId(null)
    startTransition(() => router.refresh())
  }

  async function handleAddPriloha(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingPriloha(true)
    const result = await addZaznamPriloha(zaznam.id, new FormData(e.currentTarget))
    setSavingPriloha(false)
    if (result.error) { setError(result.error); return }
    setAddingPriloha(false)
    if (priolohaFileRef.current) priolohaFileRef.current.value = ""
    startTransition(() => router.refresh())
  }

  async function handleDeletePriloha(id: number) {
    if (!confirm("Zmazať prílohu?")) return
    setDeletingPriolohaId(id)
    await deleteZaznamPriloha(id)
    setDeletingPriolohaId(null)
    startTransition(() => router.refresh())
  }

  async function handleDownloadPriloha(priloha: PrilohaData) {
    setDownloadIntegrity(prev => ({ ...prev, [priloha.id]: null }))
    const res = await fetch(`/api/registratura/file/${priloha.id}`)
    if (res.status === 409) {
      setDownloadIntegrity(prev => ({ ...prev, [priloha.id]: false }))
      return
    }
    if (!res.ok) { setError("Súbor sa nedá stiahnuť."); return }
    setDownloadIntegrity(prev => ({ ...prev, [priloha.id]: true }))
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = priloha.originalName ?? "priloha"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/dashboard/registratura/zaznamy"
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Späť na záznamy
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{zaznam.cisloZaznamu} · {zaznam.rok}</p>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mt-0.5">
            {zaznam.vec ?? zaznam.cisloZaznamu}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${zaznamKategoriaColors[zaznam.kategoria]}`}>
              {zaznam.kategoria === "PRIJATY" ? <Inbox size={11} /> : <Send size={11} />}
              {zaznamKategoriaLabels[zaznam.kategoria]}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${zaznamStavColors[zaznam.stav]}`}>
              {zaznamStavLabels[zaznam.stav]}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${zaznamDovernostColors[zaznam.dovernost]}`}>
              {zaznamDovernostLabels[zaznam.dovernost]}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{regZaznamTypeLabels[zaznam.formaZaznamu]}</span>
          </div>
        </div>
        {canManage && isEditable && !showVybavit && (
          <button onClick={() => setShowVybavit(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors shrink-0">
            <CheckCircle size={15} /> Vybaviť záznam
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Vybaviť panel */}
      {showVybavit && (
        <div className="border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">Vybaviť záznam</h3>
          <div>
            <label className={labelCls}>Spôsob vybavenia *</label>
            <select value={selectedSposob} onChange={e => setSelectedSposob(e.target.value as SposobVybavenia)}
              className={inputCls}>
              <option value="">— Vyberte —</option>
              {sposobyVybavenia.map(s => (
                <option key={s} value={s}>{sposobVybaveniаLabels[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleVybavit} disabled={!selectedSposob || saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Potvrdiť vybavenie
            </button>
            <button onClick={() => setShowVybavit(false)}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Zrušiť
            </button>
          </div>
        </div>
      )}

      {/* ── Základné informácie ─────────────────────────────────────────────── */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Základné informácie</h2>
          {isEditable && canManage && !editing && (
            <button onClick={() => { setEditing(true); setError("") }}
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              <Pencil size={12} /> Upraviť
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Rok</label>
                <input type="number" name="rok" defaultValue={zaznam.rok} className={inputCls} min={2000} max={2100} />
              </div>
              <div>
                <label className={labelCls}>Forma záznamu</label>
                <select name="formaZaznamu" defaultValue={zaznam.formaZaznamu} className={inputCls}>
                  <option value="ELEKTRONICKY">Elektronický</option>
                  <option value="NEELEKTRONICKY">Neelektronický</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Útvar</label>
                <select name="utvarId" defaultValue={zaznam.utvar?.id ?? ""} className={inputCls}>
                  <option value="">— Bez útvaru —</option>
                  {utvary.map(u => <option key={u.id} value={u.id}>{u.nazov}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Stupeň dôvernosti</label>
                <select name="dovernost" defaultValue={zaznam.dovernost} className={inputCls}>
                  <option value="VEREJNE">Verejné</option>
                  <option value="INTERNE">Interné</option>
                  <option value="DOVERNE">Dôverné</option>
                </select>
              </div>
              {zaznam.stav === "VYBAVENY" && (
                <div>
                  <label className={labelCls}>Spôsob vybavenia</label>
                  <select name="sposobVybavenia" defaultValue={zaznam.sposobVybavenia ?? ""} className={inputCls}>
                    <option value="">—</option>
                    {sposobyVybavenia.map(s => (
                      <option key={s} value={s}>{sposobVybaveniаLabels[s]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Vec</label>
              <input type="text" name="vec" defaultValue={zaznam.vec ?? ""} className={inputCls} placeholder="Stručný popis obsahu záznamu" />
            </div>
            <div>
              <label className={labelCls}>Popis</label>
              <textarea name="popis" defaultValue={zaznam.popis ?? ""} rows={3} className={`${inputCls} resize-none`} />
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                {saving ? "Ukladám…" : "Uložiť"}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                Zrušiť
              </button>
            </div>
          </form>
        ) : (
          <dl className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
            <Field label="Číslo záznamu"><span className="font-mono">{zaznam.cisloZaznamu}</span></Field>
            <Field label="Rok">{zaznam.rok}</Field>
            <Field label="Forma záznamu">{regZaznamTypeLabels[zaznam.formaZaznamu]}</Field>
            <Field label="Spracovateľ">{zaznam.spracovatel}</Field>
            {zaznam.utvar && <Field label="Útvar">{zaznam.utvar.nazov}</Field>}
            {zaznam.sposobVybavenia && (
              <Field label="Spôsob vybavenia">{sposobVybaveniаLabels[zaznam.sposobVybavenia]}</Field>
            )}
            {zaznam.vec && <Field label="Vec" >{zaznam.vec}</Field>}
            {zaznam.popis && <Field label="Popis"><span className="whitespace-pre-wrap">{zaznam.popis}</span></Field>}
            {zaznam.posta && (
              <Field label="Pošta">
                <Link href="/dashboard/registratura/podatelna" className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs">
                  {zaznam.posta.poradoveCislo}
                </Link>
                <span className="text-gray-500 dark:text-gray-400 text-xs"> – {zaznam.posta.vec}</span>
              </Field>
            )}
            <Field label="Vytvorený">{zaznam.createdAt}</Field>
          </dl>
        )}
      </div>

      {/* ── Odosielateľ (len PRIJATY) ────────────────────────────────────────── */}
      {zaznam.kategoria === "PRIJATY" && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <User size={15} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Odosielateľ</h2>
            </div>
            {isEditable && canManage && !editingOdos && (
              <button onClick={() => setEditingOdos(true)}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <Pencil size={12} /> {zaznam.odosielatel ? "Upraviť" : "Pridať"}
              </button>
            )}
          </div>

          {editingOdos ? (
            <form onSubmit={handleSaveOdos} className="p-5 space-y-4">
              <ContactFields defaults={zaznam.odosielatel as unknown as Record<string, string | null> | null} subjekty={subjekty} />
              <div className="flex gap-2">
                <button type="submit" disabled={savingOdos}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {savingOdos ? <Loader2 size={13} className="animate-spin" /> : null}
                  Uložiť
                </button>
                <button type="button" onClick={() => setEditingOdos(false)}
                  className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  Zrušiť
                </button>
              </div>
            </form>
          ) : zaznam.odosielatel ? (
            <dl className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
              {zaznam.odosielatel.meno && <Field label="Meno">{zaznam.odosielatel.meno}</Field>}
              {zaznam.odosielatel.priezvisko && <Field label="Priezvisko">{zaznam.odosielatel.priezvisko}</Field>}
              {zaznam.odosielatel.nazov && <Field label="Názov">{zaznam.odosielatel.nazov}</Field>}
              {zaznam.odosielatel.oddelenie && <Field label="Oddelenie">{zaznam.odosielatel.oddelenie}</Field>}
              {zaznam.odosielatel.ulica && <Field label="Ulica">{zaznam.odosielatel.ulica}</Field>}
              {zaznam.odosielatel.mesto && <Field label="Mesto">{zaznam.odosielatel.mesto}</Field>}
              {zaznam.odosielatel.psc && <Field label="PSČ">{zaznam.odosielatel.psc}</Field>}
              {zaznam.odosielatel.identifikator && <Field label="Identifikátor">{zaznam.odosielatel.identifikator}</Field>}
            </dl>
          ) : (
            <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">Odosielateľ nie je vyplnený.</p>
          )}
        </div>
      )}

      {/* ── Adresáti (len VYTVORENY) ─────────────────────────────────────────── */}
      {zaznam.kategoria === "VYTVORENY" && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Adresáti</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">({zaznam.adresati.length})</span>
            </div>
            {isEditable && canManage && !addingAdresat && (
              <button onClick={() => setAddingAdresat(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus size={12} /> Pridať adresáta
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {zaznam.adresati.map(a => (
              <div key={a.id} className="px-5 py-4">
                {editingAdresatId === a.id ? (
                  <form onSubmit={e => handleUpdateAdresat(e, a.id)} className="space-y-3">
                    <ContactFields defaults={a as unknown as Record<string, string | null>} subjekty={subjekty} />
                    <div className="flex gap-2">
                      <button type="submit" disabled={savingAdresat}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50">
                        {savingAdresat ? <Loader2 size={11} className="animate-spin" /> : null} Uložiť
                      </button>
                      <button type="button" onClick={() => setEditingAdresatId(null)}
                        className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg">Zrušiť</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{contactLabel(a as unknown as Record<string, string | null>)}</p>
                      {(a.ulica || a.mesto || a.psc) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {[a.ulica, a.mesto, a.psc].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {a.identifikator && <p className="text-xs text-gray-400 dark:text-gray-500">IČO: {a.identifikator}</p>}
                    </div>
                    {isEditable && canManage && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setEditingAdresatId(a.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteAdresat(a.id)} disabled={deletingAdresatId === a.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg">
                          {deletingAdresatId === a.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {addingAdresat && (
              <form onSubmit={handleAddAdresat} className="px-5 py-4 space-y-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Nový adresát</p>
                <ContactFields subjekty={subjekty} />
                <div className="flex gap-2">
                  <button type="submit" disabled={savingAdresat}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50">
                    {savingAdresat ? <Loader2 size={11} className="animate-spin" /> : null} Pridať
                  </button>
                  <button type="button" onClick={() => setAddingAdresat(false)}
                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg">Zrušiť</button>
                </div>
              </form>
            )}

            {zaznam.adresati.length === 0 && !addingAdresat && (
              <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">Žiadni adresáti.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Prílohy ─────────────────────────────────────────────────────────── */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Paperclip size={15} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Prílohy</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">({zaznam.prilohy.length})</span>
          </div>
          {canManage && !addingPriloha && (
            <button onClick={() => setAddingPriloha(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus size={12} /> Pridať prílohu
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {zaznam.prilohy.map(p => (
            <div key={p.id} className="px-5 py-3 flex items-start gap-4">
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">P{p.cislo}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{p.nazov}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{regZaznamTypeLabels[p.forma]}</p>
                {p.hasFile && p.originalName && (
                  <div className="mt-1.5 space-y-1">
                    <button onClick={() => handleDownloadPriloha(p)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      <Download size={12} /> {p.originalName}
                      {p.fileSize && <span className="text-gray-400">({fmtSize(p.fileSize)})</span>}
                    </button>
                    {downloadIntegrity[p.id] === true && (
                      <p className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                        <ShieldCheck size={12} /> Integrita overená
                      </p>
                    )}
                    {downloadIntegrity[p.id] === false && (
                      <p className="flex items-center gap-1 text-xs text-red-700 dark:text-red-400 font-semibold">
                        <ShieldAlert size={12} /> INTEGRITA NARUŠENÁ
                      </p>
                    )}
                  </div>
                )}
                {!p.hasFile && p.forma === "ELEKTRONICKY" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Bez súboru</p>
                )}
              </div>
              {canManage && (
                <button onClick={() => handleDeletePriloha(p.id)} disabled={deletingPriolohaId === p.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg shrink-0">
                  {deletingPriolohaId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              )}
            </div>
          ))}

          {addingPriloha && (
            <form onSubmit={handleAddPriloha} className="px-5 py-4 space-y-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Nová príloha</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Názov *</label>
                  <input type="text" name="nazov" required className={inputCls} placeholder="Popis prílohy" />
                </div>
                <div>
                  <label className={labelCls}>Forma</label>
                  <select name="forma" defaultValue={zaznam.formaZaznamu} className={inputCls}>
                    <option value="ELEKTRONICKY">Elektronická</option>
                    <option value="NEELEKTRONICKY">Neelektronická</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Súbor (voliteľný)</label>
                <label className="flex items-center gap-2 w-full justify-center px-3 py-2 text-sm border border-dashed border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-blue-600 dark:text-blue-400 transition-colors">
                  <Upload size={14} /> Nahrať súbor
                  <input ref={priolohaFileRef} type="file" name="file" className="hidden" />
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingPriloha}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50">
                  {savingPriloha ? <Loader2 size={11} className="animate-spin" /> : null} Pridať
                </button>
                <button type="button" onClick={() => setAddingPriloha(false)}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg">Zrušiť</button>
              </div>
            </form>
          )}

          {zaznam.prilohy.length === 0 && !addingPriloha && (
            <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">Žiadne prílohy.</p>
          )}
        </div>
      </div>

      {/* ── Spisy ───────────────────────────────────────────────────────────── */}
      {zaznam.spisy.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-900 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen size={16} className="text-gray-400" /> Zaradený v spisoch
          </h2>
          <div className="space-y-2">
            {zaznam.spisy.map(s => (
              <Link key={s.id} href={`/dashboard/registratura/spisy/${s.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div>
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{s.cisloSpisu}</span>
                  <span className="text-sm text-gray-900 dark:text-white ml-2">{s.nazov}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${spisStatusColors[s.status]}`}>
                  {spisStatusLabels[s.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
