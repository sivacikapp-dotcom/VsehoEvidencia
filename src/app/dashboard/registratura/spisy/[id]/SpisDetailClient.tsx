"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil, X, Check, Trash2, Plus, FolderOpen, Lock, FileText, ExternalLink, AlertTriangle } from "lucide-react"
import { regZaznamTypeLabels, zaznamStavLabels, zaznamStavColors, zaznamKategoriaLabels, spisStatusLabels, spisStatusColors } from "@/lib/regLabels"
import type { RegZaznamType, ZaznamStav, ZaznamKategoria, SpisStatus } from "@/generated/prisma/enums"
import { updateSpis, addZaznamToSpis, removeZaznamFromSpis, uzatvoritSpis } from "../actions"

type ZaznamInSpis = {
  id: number
  cisloZaznamu: string
  formaZaznamu: RegZaznamType
  stav: ZaznamStav
  kategoria: ZaznamKategoria
  planZnacka: string
  planNazov: string
  addedAt: string
}

type AvailableZaznam = {
  id: number
  cisloZaznamu: string
  formaZaznamu: RegZaznamType
  stav: ZaznamStav
  kategoria: ZaznamKategoria
  planZnacka: string
  planNazov: string
}

interface Props {
  spis: {
    id: number
    cisloSpisu: string
    nazov: string
    plan: { id: number; znacka: string; nazov: string; lehota: number }
    spracovatel: string
    status: SpisStatus
    datumOtvorenia: string
    datumUzatvorenia: string | null
    rokVyradenia: number | null
    zaznamy: ZaznamInSpis[]
  }
  plans: { id: number; znacka: string; nazov: string }[]
  availableZaznamy: AvailableZaznam[]
  canManage: boolean
  isAdmin: boolean
}

export default function SpisDetailClient({ spis, plans, availableZaznamy, canManage, isAdmin }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showAddZaznam, setShowAddZaznam] = useState(false)
  const [addSearch, setAddSearch] = useState("")
  const [addError, setAddError] = useState("")
  const [addingSaving, setAddingSaving] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closingError, setClosingError] = useState("")
  const [closingSaving, setClosingSaving] = useState(false)

  const isOpen = spis.status === "OTVORENY"
  const canEdit = canManage && isOpen

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

  async function handleClose() {
    setClosingSaving(true); setClosingError("")
    const result = await uzatvoritSpis(spis.id)
    setClosingSaving(false)
    if (result.error) { setClosingError(result.error); return }
    setShowCloseConfirm(false)
    startTransition(() => router.refresh())
  }

  const filteredAvailable = availableZaznamy.filter(z => {
    if (!addSearch) return true
    const q = addSearch.toLowerCase()
    return z.cisloZaznamu.toLowerCase().includes(q) || z.planZnacka.toLowerCase().includes(q) || z.planNazov.toLowerCase().includes(q)
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">{spis.nazov}</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${spisStatusColors[spis.status]}`}>
              {spisStatusLabels[spis.status]}
            </span>
          </div>
          <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-0.5">{spis.cisloSpisu}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && !editing && (
            <button onClick={() => { setEditing(true); setError("") }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
              <Pencil size={14} /> Upraviť
            </button>
          )}
          {canEdit && (
            <button onClick={() => { setShowCloseConfirm(true); setClosingError("") }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Lock size={14} /> Uzatvoriť spis
            </button>
          )}
        </div>
      </div>

      {/* Meta info / Edit form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Registratúrny plán *</label>
                <select name="planId" required defaultValue={spis.plan.id}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {plans.map(p => <option key={p.id} value={p.id}>{p.znacka} – {p.nazov}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Názov spisu *</label>
                <input type="text" name="nazov" required defaultValue={spis.nazov}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                <Check size={14} /> {saving ? "Ukladám…" : "Uložiť"}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300">
                <X size={14} /> Zrušiť
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Registratúrny plán</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{spis.plan.znacka}</dd>
              <dd className="text-xs text-gray-500">{spis.plan.nazov}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Spracovateľ</dt>
              <dd className="text-gray-900 dark:text-white">{spis.spracovatel}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Dátum otvorenia</dt>
              <dd className="text-gray-900 dark:text-white">{spis.datumOtvorenia}</dd>
            </div>
            {spis.datumUzatvorenia && (
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Dátum uzatvorenia</dt>
                <dd className="text-gray-900 dark:text-white">{spis.datumUzatvorenia}</dd>
              </div>
            )}
            {spis.rokVyradenia && (
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Rok vyradenia</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{spis.rokVyradenia}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Lehota uchovávania</dt>
              <dd className="text-gray-900 dark:text-white">{spis.plan.lehota} {spis.plan.lehota === 1 ? "rok" : "rokov"}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Záznamy in this spis */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <FileText size={16} className="text-gray-400" />
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

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">{error}</p>
      )}

      {/* Add Záznam Modal */}
      {showAddZaznam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Pridať záznam do spisu</h2>
              <button onClick={() => setShowAddZaznam(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="relative">
                <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                  placeholder="Hľadať záznamy..."
                  className="w-full pl-3 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
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

      {/* Close Spis Confirm Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Uzatvoriť spis</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Uzatvorenie spisu je nevratné. Rok vyradenia bude nastavený automaticky podľa registratúrneho plánu.
                  Všetky záznamy musia byť uzavreté alebo vyradené.
                </p>
              </div>
            </div>
            {closingError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{closingError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Zrušiť
              </button>
              <button onClick={handleClose} disabled={closingSaving}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                {closingSaving ? "Uzatváram…" : "Potvrdiť uzatvorenie"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
