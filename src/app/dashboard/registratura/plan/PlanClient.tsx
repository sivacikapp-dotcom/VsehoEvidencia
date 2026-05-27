"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, X, Check, Archive, Search } from "lucide-react"
import { createPlanEntry, updatePlanEntry, deletePlanEntry } from "./actions"

type PlanRow = {
  id: number
  znacka: string
  nazov: string
  lehota: number
  maArchivnu: boolean
  pocetZaznamov: number
  pocetSpisov: number
}

interface Props {
  plans: PlanRow[]
}

function PlanForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: PlanRow
  onSave: (fd: FormData) => void
  onCancel: () => void
  saving: boolean
  error: string
}) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(new FormData(e.currentTarget)) }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Značka *</label>
          <input type="text" name="znacka" required defaultValue={initial?.znacka ?? ""}
            placeholder="napr. A1"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Lehota (rokov) *</label>
          <input type="number" name="lehota" required min={1} max={100} defaultValue={initial?.lehota ?? 10}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Názov *</label>
        <input type="text" name="nazov" required defaultValue={initial?.nazov ?? ""}
          placeholder="Popis kategórie záznamu"
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" name="maArchivnu" defaultChecked={initial?.maArchivnu ?? false}
          className="rounded border-gray-300 text-blue-600" />
        <span className="text-sm text-gray-700 dark:text-gray-300">Má archívnu hodnotu</span>
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          <Check size={14} /> {saving ? "Ukladám…" : (initial ? "Uložiť zmeny" : "Vytvoriť")}
        </button>
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300">
          <X size={14} /> Zrušiť
        </button>
      </div>
    </form>
  )
}

export default function PlanClient({ plans: initialPlans }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const [deleteSaving, setDeleteSaving] = useState(false)

  const filtered = initialPlans.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.znacka.toLowerCase().includes(q) || p.nazov.toLowerCase().includes(q)
  })

  async function handleCreate(fd: FormData) {
    setSaving(true); setError("")
    const result = await createPlanEntry(fd)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setShowNew(false)
    startTransition(() => router.refresh())
  }

  async function handleUpdate(fd: FormData) {
    if (!editId) return
    setSaving(true); setError("")
    const result = await updatePlanEntry(editId, fd)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setEditId(null)
    startTransition(() => router.refresh())
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleteSaving(true); setDeleteError("")
    const result = await deletePlanEntry(deleteId)
    setDeleteSaving(false)
    if (result.error) { setDeleteError(result.error); return }
    setDeleteId(null)
    startTransition(() => router.refresh())
  }

  const deletePlan = initialPlans.find(p => p.id === deleteId)

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Registratúrny plán</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Správa kategórií registratúrnych záznamov</p>
        </div>
        <button onClick={() => { setShowNew(true); setError(""); setEditId(null) }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Nová položka
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hľadať..."
          className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
      </div>

      {showNew && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
          <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-4">Nová položka registratúrneho plánu</h3>
          <PlanForm onSave={handleCreate} onCancel={() => setShowNew(false)} saving={saving} error={error} />
        </div>
      )}

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-24">Značka</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Názov</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-24">Lehota</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-24">Archívna</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-28">Záznamy / Spisy</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Žiadne položky</td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                {editId === p.id ? (
                  <td colSpan={6} className="px-4 py-4">
                    <PlanForm initial={p} onSave={handleUpdate} onCancel={() => setEditId(null)} saving={saving} error={error} />
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">{p.znacka}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.nazov}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.lehota} r.</td>
                    <td className="px-4 py-3">
                      {p.maArchivnu ? (
                        <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                          <Archive size={12} /> Áno
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Nie</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {p.pocetZaznamov} / {p.pocetSpisov}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditId(p.id); setError(""); setShowNew(false) }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <Pencil size={14} className="text-gray-400" />
                        </button>
                        <button onClick={() => { setDeleteId(p.id); setDeleteError("") }}
                          disabled={p.pocetZaznamov > 0 || p.pocetSpisov > 0}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirm modal */}
      {deleteId && deletePlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Vymazať položku</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Naozaj chcete vymazať položku <strong>{deletePlan.znacka} – {deletePlan.nazov}</strong>?
            </p>
            {deleteError && <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300">
                Zrušiť
              </button>
              <button onClick={handleDelete} disabled={deleteSaving}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleteSaving ? "Mažem…" : "Vymazať"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
