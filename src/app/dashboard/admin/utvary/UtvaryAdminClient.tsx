"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, X, Loader2, Users } from "lucide-react"
import { createUtvar, updateUtvar, deleteUtvar } from "./actions"

type Utvar = { id: number; nazov: string; pocetPouzivatelov: number }

const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

function UtvarModal({ utvar, onClose }: { utvar?: Utvar; onClose: () => void }) {
  const router = useRouter()
  const [nazov, setNazov] = useState(utvar?.nazov ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError("")
    const result = utvar
      ? await updateUtvar(utvar.id, nazov)
      : await createUtvar(nazov)
    setPending(false)
    if (result.error) { setError(result.error); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {utvar ? "Upraviť útvar" : "Nový útvar"}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Názov útvaru <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nazov}
              onChange={e => setNazov(e.target.value)}
              required
              autoFocus
              maxLength={200}
              className={inputCls}
              placeholder="napr. Ekonomický útvar"
            />
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Zrušiť
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Ukladám..." : utvar ? "Uložiť" : "Vytvoriť"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UtvaryAdminClient({ utvary }: { utvary: Utvar[] }) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [editUtvar, setEditUtvar] = useState<Utvar | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleDelete(u: Utvar) {
    if (u.pocetPouzivatelov > 0) {
      alert(`Útvar má priradených ${u.pocetPouzivatelov} používateľov. Najprv ich odstráňte.`)
      return
    }
    if (!confirm(`Naozaj chcete zmazať útvar „${u.nazov}"?`)) return
    setDeletingId(u.id)
    const res = await deleteUtvar(u.id)
    setDeletingId(null)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Útvary</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Správa organizačných útvarov ({utvary.length})
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus size={15} />Nový útvar
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {utvary.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
            Žiadne útvary. Vytvorte prvý útvar kliknutím na tlačidlo vyššie.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Útvar</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Používatelia</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {utvary.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.nazov}</td>
                  <td className="px-4 py-3">
                    {u.pocetPouzivatelov > 0 ? (
                      <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                        <Users size={13} className="text-gray-400" />
                        {u.pocetPouzivatelov}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditUtvar(u)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium"
                      >
                        <Pencil size={11} />Upraviť
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium disabled:opacity-50"
                      >
                        {deletingId === u.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        Zmazať
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <UtvarModal onClose={() => setShowNew(false)} />}
      {editUtvar && <UtvarModal utvar={editUtvar} onClose={() => setEditUtvar(null)} />}
    </div>
  )
}
