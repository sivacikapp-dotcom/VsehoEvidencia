"use client"

import { useState, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, X, Loader2, Search, User, Building2 } from "lucide-react"
import { createSubjekt, updateSubjekt, deleteSubjekt } from "./actions"

export type SubjektItem = {
  id: number
  meno: string | null
  priezvisko: string | null
  nazov: string | null
  oddelenie: string | null
  ulica: string | null
  mesto: string | null
  psc: string | null
  identifikator: string | null
}

const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelCls = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"

function displayName(s: SubjektItem) {
  const osobne = [s.meno, s.priezvisko].filter(Boolean).join(" ")
  return osobne || s.nazov || "—"
}

function SubjektFields({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>Meno</label>
        <input type="text" name="meno" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Priezvisko</label>
        <input type="text" name="priezvisko" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Názov organizácie</label>
        <input type="text" name="nazov" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Oddelenie</label>
        <input type="text" name="oddelenie" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Ulica</label>
        <input type="text" name="ulica" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Mesto</label>
        <input type="text" name="mesto" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>PSČ</label>
        <input type="text" name="psc" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Identifikátor (IČO, IČ DPH…)</label>
        <input type="text" name="identifikator" className={inputCls} />
      </div>
    </div>
  )
}

function SubjektModal({ subjekt, onClose }: { subjekt?: SubjektItem; onClose: () => void }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setPending(true); setError("")
    const fd = new FormData(formRef.current)
    const result = subjekt ? await updateSubjekt(subjekt.id, fd) : await createSubjekt(fd)
    setPending(false)
    if (result.error) { setError(result.error); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto py-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {subjekt ? "Upraviť subjekt" : "Nový subjekt"}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-1">
            {subjekt ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Meno</label>
                  <input type="text" name="meno" defaultValue={subjekt.meno ?? ""} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Priezvisko</label>
                  <input type="text" name="priezvisko" defaultValue={subjekt.priezvisko ?? ""} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Názov organizácie</label>
                  <input type="text" name="nazov" defaultValue={subjekt.nazov ?? ""} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Oddelenie</label>
                  <input type="text" name="oddelenie" defaultValue={subjekt.oddelenie ?? ""} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Ulica</label>
                  <input type="text" name="ulica" defaultValue={subjekt.ulica ?? ""} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Mesto</label>
                  <input type="text" name="mesto" defaultValue={subjekt.mesto ?? ""} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>PSČ</label>
                  <input type="text" name="psc" defaultValue={subjekt.psc ?? ""} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Identifikátor (IČO, IČ DPH…)</label>
                  <input type="text" name="identifikator" defaultValue={subjekt.identifikator ?? ""} className={inputCls} />
                </div>
              </div>
            ) : (
              <SubjektFields formRef={formRef} />
            )}
            {error && <p className="text-sm text-red-600 dark:text-red-400 pt-1">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Zrušiť
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Ukladám..." : subjekt ? "Uložiť" : "Vytvoriť"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdresarClient({ subjekty, canManage }: { subjekty: SubjektItem[]; canManage: boolean }) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [editSubjekt, setEditSubjekt] = useState<SubjektItem | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search.trim()) return subjekty
    const q = search.toLowerCase()
    return subjekty.filter(s =>
      [s.meno, s.priezvisko, s.nazov, s.oddelenie, s.identifikator, s.mesto]
        .filter(Boolean).some(v => v!.toLowerCase().includes(q))
    )
  }, [subjekty, search])

  async function handleDelete(s: SubjektItem) {
    if (!confirm(`Naozaj chcete zmazať subjekt „${displayName(s)}"?`)) return
    setDeletingId(s.id)
    const res = await deleteSubjekt(s.id)
    setDeletingId(null)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Adresár subjektov</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Adresáti a odosielatelia pre záznamy registratúry ({subjekty.length})
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus size={15} />Nový subjekt
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hľadať…"
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-72" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
            {subjekty.length === 0 ? "Adresár je prázdny." : "Žiadne výsledky."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Meno / Názov</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Adresa</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden lg:table-cell">Identifikátor</th>
                {canManage && <th className="w-28" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.nazov && !(s.meno || s.priezvisko)
                        ? <Building2 size={14} className="text-gray-400 shrink-0" />
                        : <User size={14} className="text-gray-400 shrink-0" />
                      }
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{displayName(s)}</p>
                        {(s.meno || s.priezvisko) && s.nazov && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{s.nazov}</p>
                        )}
                        {s.oddelenie && <p className="text-xs text-gray-400 dark:text-gray-500">{s.oddelenie}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">
                    {[s.ulica, s.mesto, s.psc].filter(Boolean).join(", ") || <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                    {s.identifikator || <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setEditSubjekt(s)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium">
                          <Pencil size={11} />Upraviť
                        </button>
                        <button onClick={() => handleDelete(s)} disabled={deletingId === s.id}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium disabled:opacity-50">
                          {deletingId === s.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          Zmazať
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <SubjektModal onClose={() => setShowNew(false)} />}
      {editSubjekt && <SubjektModal subjekt={editSubjekt} onClose={() => setEditSubjekt(null)} />}
    </div>
  )
}
