"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Pencil, X, Check, Trash2, Plus, FileText,
  ExternalLink, User, Layers,
} from "lucide-react"
import {
  regZaznamTypeLabels, zaznamStavLabels, zaznamStavColors, zaznamKategoriaLabels,
  spisStatusLabels, spisStatusColors, zaznamDovernostLabels, zaznamDovernostColors,
} from "@/lib/regLabels"
import type { RegZaznamType, ZaznamKategoria } from "@/generated/prisma/enums"
import { updateSpis, addZaznamToSpis, removeZaznamFromSpis } from "../actions"

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelCls = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"

type ZaznamInSpis = {
  id: number; cisloZaznamu: string; formaZaznamu: RegZaznamType
  stav: string; kategoria: ZaznamKategoria
  planZnacka: string; planNazov: string; addedAt: string
}

type AvailableZaznam = {
  id: number; cisloZaznamu: string; formaZaznamu: RegZaznamType
  stav: string; kategoria: ZaznamKategoria
  planZnacka: string; planNazov: string
}

interface Props {
  spis: {
    id: number
    cisloSpisu: string
    nazov: string
    rok: number
    popis: string | null
    utvar: { id: number; nazov: string } | null
    plan: { id: number; znacka: string; nazov: string; lehota: number }
    spracovatelId: number
    spracovatel: string
    status: string
    datumOtvorenia: string
    datumUzatvorenia: string | null
    rokVyradenia: number | null
    forma: "ELEKTRONICKY" | "NEELEKTRONICKY" | "KOMBINOVANY" | null
    dovernost: "VEREJNE" | "INTERNE" | "DOVERNE" | null
    zaznamy: ZaznamInSpis[]
  }
  plans: { id: number; znacka: string; nazov: string }[]
  spracovatelov: { id: number; firstName: string; lastName: string }[]
  utvary: { id: number; nazov: string }[]
  availableZaznamy: AvailableZaznam[]
  stavSpisOptions: { kod: string; popis: string }[]
  canManage: boolean
  isAdmin: boolean
}

const FORMA_LABELS: Record<string, string> = {
  ELEKTRONICKY: "Elektronická",
  NEELEKTRONICKY: "Neelektronická",
  KOMBINOVANY: "Kombinovaná",
}

const CLOSED = ["StSpis3", "UZATVORENY"]

function DField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-white">{children}</dd>
    </div>
  )
}

export default function SpisDetailClient({ spis, plans, spracovatelov, utvary, availableZaznamy, stavSpisOptions, canManage, isAdmin }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editStatus, setEditStatus] = useState<string>(spis.status)
  const [showAddZaznam, setShowAddZaznam] = useState(false)
  const [addSearch, setAddSearch] = useState("")
  const [addError, setAddError] = useState("")
  const [addingSaving, setAddingSaving] = useState(false)

  const isClosed = CLOSED.includes(spis.status)
  const canEdit = canManage && !isClosed

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError("")
    const result = await updateSpis(spis.id, new FormData(e.currentTarget))
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setEditing(false)
    startTransition(() => router.refresh())
  }

  async function handleAddZaznam(zaznamId: number) {
    setAddingSaving(true); setAddError("")
    const result = await addZaznamToSpis(spis.id, zaznamId)
    setAddingSaving(false)
    if (result.error) { setAddError(result.error); return }
    setShowAddZaznam(false)
    startTransition(() => router.refresh())
  }

  async function handleRemoveZaznam(zaznamId: number) {
    const result = await removeZaznamFromSpis(spis.id, zaznamId)
    if (result.error) { setError(result.error); return }
    startTransition(() => router.refresh())
  }

  const filteredAvailable = availableZaznamy.filter(z => {
    if (!addSearch) return true
    const q = addSearch.toLowerCase()
    return z.cisloZaznamu.toLowerCase().includes(q) || z.planZnacka.toLowerCase().includes(q) || z.planNazov.toLowerCase().includes(q)
  })

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
            <ArrowLeft size={18} className="text-gray-500" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">{spis.nazov}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${spisStatusColors[spis.status]}`}>
                {spisStatusLabels[spis.status]}
              </span>
            </div>
            <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-0.5">{spis.cisloSpisu}</p>
          </div>
        </div>
        {canEdit && !editing && (
          <button onClick={() => { setEditStatus(spis.status); setEditing(true); setError("") }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300 shrink-0">
            <Pencil size={14} /> Upraviť spis
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">{error}</p>}

      {/* Dvojstĺpcový layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* ── ĽAVÝ STĹPEC (2/3) ─── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Vec + Popis */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Obsah spisu</h2>
            </div>
            {editing ? (
              <form id="spis-edit" onSubmit={handleSave} className="p-5 space-y-4">
                <div>
                  <label className={labelCls}>Vec *</label>
                  <input type="text" name="nazov" required defaultValue={spis.nazov} className={inputCls} placeholder="Stručný predmet spisu" />
                </div>
                <div>
                  <label className={labelCls}>Popis</label>
                  <textarea name="popis" defaultValue={spis.popis ?? ""} rows={4} className={`${inputCls} resize-none`} placeholder="Podrobnejší popis spisu..." />
                </div>
              </form>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Vec</p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{spis.nazov}</p>
                </div>
                {spis.popis && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Popis</p>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{spis.popis}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Záznamy v spise */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-medium text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                <FileText size={15} className="text-gray-400" />
                Záznamy v spise
                <span className="text-xs text-gray-400 font-normal">({spis.zaznamy.length})</span>
              </h2>
              {canEdit && (
                <button onClick={() => { setShowAddZaznam(true); setAddError(""); setAddSearch("") }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus size={12} /> Pridať záznam
                </button>
              )}
            </div>
            {spis.zaznamy.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Spis neobsahuje žiadne záznamy</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">Číslo záznamu</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">Registratúrny plán</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">Typ</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">Stav</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">Pridaný</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {spis.zaznamy.map(z => (
                    <tr key={z.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{z.cisloZaznamu}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900 dark:text-white font-medium">{z.planZnacka}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[150px]">{z.planNazov}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">
                        {zaznamKategoriaLabels[z.kategoria]} · {regZaznamTypeLabels[z.formaZaznamu]}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${zaznamStavColors[z.stav]}`}>
                          {zaznamStavLabels[z.stav]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{z.addedAt}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => router.push(`/dashboard/registratura/zaznamy/${z.id}`)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <ExternalLink size={13} className="text-gray-400" />
                          </button>
                          {canEdit && (
                            <button onClick={() => handleRemoveZaznam(z.id)}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── PRAVÝ STĹPEC – sidebar (1/3) ─── */}
        <div className="space-y-4">

          {/* Metadáta */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Metadáta</h2>
            </div>
            {editing ? (
              <div className="p-4 space-y-3">
                <div>
                  <label className={labelCls}>Stav</label>
                  <select name="status" form="spis-edit" value={editStatus} onChange={e => setEditStatus(e.target.value)} className={inputCls}>
                    {stavSpisOptions.length > 0
                      ? stavSpisOptions.map(s => <option key={s.kod} value={s.kod}>{s.popis}</option>)
                      : <>
                          <option value="StSpis1">Otvorený</option>
                          <option value="StSpis2">Odložený</option>
                          <option value="StSpis3">Vybavený</option>
                        </>
                    }
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Rok</label>
                  <input type="number" name="rok" form="spis-edit" defaultValue={spis.rok} min={2000} max={2100} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Reg. značka *</label>
                  <select name="planId" form="spis-edit" required defaultValue={spis.plan.id} className={inputCls}>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.znacka} – {p.nazov}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Útvar</label>
                  <select name="utvarId" form="spis-edit" defaultValue={spis.utvar?.id ?? ""} className={inputCls}>
                    <option value="">— Bez útvaru —</option>
                    {utvary.map(u => <option key={u.id} value={u.id}>{u.nazov}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Spracovateľ</label>
                  {isAdmin ? (
                    <select name="spracovatelId" form="spis-edit" defaultValue={spis.spracovatelId} className={inputCls}>
                      {spracovatelov.map(u => <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>)}
                    </select>
                  ) : (
                    <>
                      <p className="text-sm text-gray-800 dark:text-gray-200 py-1">{spis.spracovatel}</p>
                      <input type="hidden" name="spracovatelId" form="spis-edit" value={spis.spracovatelId} />
                    </>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" form="spis-edit" disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-1 justify-center">
                    <Check size={14} /> {saving ? "Ukladám…" : "Uložiť"}
                  </button>
                  <button type="button" onClick={() => { setEditing(false); setEditStatus(spis.status) }}
                    className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <dl className="p-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Stav</dt>
                  <dd className="mt-0.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${spisStatusColors[spis.status]}`}>
                      {spisStatusLabels[spis.status]}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Rok</dt>
                  <dd className="text-gray-900 dark:text-white mt-0.5">{spis.rok}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Reg. značka</dt>
                  <dd className="mt-0.5">
                    <span className="font-medium text-gray-900 dark:text-white">{spis.plan.znacka}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">{spis.plan.nazov}</span>
                  </dd>
                </div>
                {spis.utvar && (
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Útvar</dt>
                    <dd className="text-gray-900 dark:text-white mt-0.5">{spis.utvar.nazov}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Spracovateľ</dt>
                  <dd className="text-gray-900 dark:text-white mt-0.5">{spis.spracovatel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Forma</dt>
                  <dd className="text-gray-900 dark:text-white mt-0.5">
                    {spis.forma ? FORMA_LABELS[spis.forma] : <span className="text-gray-400 dark:text-gray-500 italic text-xs">Zo záznamov</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Stupeň dôvernosti</dt>
                  <dd className="mt-0.5">
                    {spis.dovernost
                      ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${zaznamDovernostColors[spis.dovernost]}`}>{zaznamDovernostLabels[spis.dovernost]}</span>
                      : <span className="text-gray-400 dark:text-gray-500 italic text-xs">Zo záznamov</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Lehota uchovávania</dt>
                  <dd className="text-gray-900 dark:text-white mt-0.5">{spis.plan.lehota} {spis.plan.lehota === 1 ? "rok" : "rokov"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Dátum otvorenia</dt>
                  <dd className="text-gray-900 dark:text-white mt-0.5">{spis.datumOtvorenia}</dd>
                </div>
                {spis.datumUzatvorenia && (
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Dátum vybavenia</dt>
                    <dd className="text-gray-900 dark:text-white mt-0.5">{spis.datumUzatvorenia}</dd>
                  </div>
                )}
                {spis.rokVyradenia && (
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Rok vyradenia</dt>
                    <dd className="font-medium text-gray-900 dark:text-white mt-0.5">{spis.rokVyradenia}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* Osoby s prístupom */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <User size={15} className="text-gray-500" />
              <h2 className="font-medium text-gray-900 dark:text-white text-sm">Osoby s prístupom</h2>
            </div>
            <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">Žiadne osoby s prístupom.</p>
          </div>

        </div>
      </div>

      {/* Add Záznam Modal */}
      {showAddZaznam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Pridať záznam do spisu</h2>
              <button onClick={() => setShowAddZaznam(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                placeholder="Hľadať záznamy..."
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {filteredAvailable.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Žiadne dostupné záznamy</p>
              ) : filteredAvailable.map(z => (
                <button key={z.id} disabled={addingSaving}
                  onClick={() => handleAddZaznam(z.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left disabled:opacity-50">
                  <div>
                    <p className="font-mono text-xs text-gray-600 dark:text-gray-300">{z.cisloZaznamu}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{z.planZnacka} – {z.planNazov}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${zaznamStavColors[z.stav]}`}>
                      {zaznamStavLabels[z.stav]}
                    </span>
                    <Plus size={14} className="text-blue-500" />
                  </div>
                </button>
              ))}
            </div>
            {addError && <p className="px-4 pb-3 text-sm text-red-600 dark:text-red-400">{addError}</p>}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button onClick={() => setShowAddZaznam(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Zatvoriť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
