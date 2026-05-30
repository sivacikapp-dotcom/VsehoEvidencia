"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Check, X, ChevronUp, ChevronDown, ChevronRight, Loader2, RotateCcw, Plus } from "lucide-react"
import { updateCislonikItem, resetCislonik, addCislonikItem } from "./cislonik-actions"
import type { CislonikTyp } from "@/lib/cislonik"

type Item = { id: number; kod: string; popis: string; poradie: number; aktivne: boolean }

const SEKCIE: { typ: CislonikTyp; nazov: string; popis: string }[] = [
  { typ: "SPOSOB_DORUCENIA",  nazov: "Spôsob doručenia",          popis: "Používa sa v podateľni pri registrácii doručenej/odoslanej pošty." },
  { typ: "STAV_ZAZNAMU",     nazov: "Stav záznamu",               popis: "Dostupné stavy registratúrneho záznamu." },
  { typ: "STAV_SPISU",       nazov: "Stav spisu",                 popis: "Dostupné stavy spisu." },
  { typ: "SPOSOB_VYBAVENIA", nazov: "Spôsob vybavenia záznamu",  popis: "Prijatý: prvé dve hodnoty. Vytvorený: ďalšie hodnoty." },
]

const inputCls = "px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"

function CislonikSekcia({ typ, nazov, popis, items }: {
  typ: CislonikTyp; nazov: string; popis: string; items: Item[]
}) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editPopis, setEditPopis] = useState("")
  const [savingId, setSavingId] = useState<number | null>(null)
  const [resetting, setResetting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addPopis, setAddPopis] = useState("")
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState("")

  async function save(id: number) {
    setSavingId(id)
    await updateCislonikItem(id, { popis: editPopis })
    setSavingId(null)
    setEditingId(null)
    router.refresh()
  }

  async function toggle(item: Item) {
    setSavingId(item.id)
    await updateCislonikItem(item.id, { aktivne: !item.aktivne })
    setSavingId(null)
    router.refresh()
  }

  async function move(item: Item, dir: -1 | 1) {
    const idx = items.indexOf(item)
    const other = items[idx + dir]
    if (!other) return
    setSavingId(item.id)
    await Promise.all([
      updateCislonikItem(item.id, { poradie: other.poradie }),
      updateCislonikItem(other.id, { poradie: item.poradie }),
    ])
    setSavingId(null)
    router.refresh()
  }

  async function handleReset() {
    if (!confirm(`Naozaj chcete obnoviť predvolené hodnoty číselníka „${nazov}"?`)) return
    setResetting(true)
    await resetCislonik(typ)
    setResetting(false)
    router.refresh()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true); setAddError("")
    const result = await addCislonikItem(typ, { popis: addPopis })
    setAddSaving(false)
    if (result.error) { setAddError(result.error); return }
    setAdding(false); setAddPopis("")
    router.refresh()
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header — klikateľný pre zbalenie */}
      <div className="flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-3 flex-1 text-left min-w-0"
        >
          <span className={`text-gray-400 transition-transform duration-200 shrink-0 ${collapsed ? "-rotate-90" : ""}`}>
            <ChevronDown size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{nazov}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{popis}</p>
          </div>
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {items.filter(i => i.aktivne).length}/{items.length}
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            title="Obnoviť predvolené hodnoty"
          >
            {resetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Predvolené
          </button>
        </div>
      </div>

      {/* Body — schovaný keď collapsed */}
      {!collapsed && (
        <>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {items.map((item, idx) => (
              <div key={item.id} className={`flex items-center gap-3 px-5 py-3 ${!item.aktivne ? "opacity-50" : ""}`}>
                {/* Poradie */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => move(item, -1)} disabled={idx === 0 || savingId !== null}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => move(item, 1)} disabled={idx === items.length - 1 || savingId !== null}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                    <ChevronDown size={13} />
                  </button>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggle(item)}
                  disabled={savingId === item.id}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${item.aktivne ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${item.aktivne ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </button>

                {/* Kod */}
                <span className="font-mono text-xs text-gray-400 dark:text-gray-500 w-40 shrink-0">{item.kod}</span>

                {/* Popis */}
                {editingId === item.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={editPopis}
                      onChange={e => setEditPopis(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") save(item.id); if (e.key === "Escape") setEditingId(null) }}
                      autoFocus
                      className="flex-1 px-2 py-1 text-sm border border-blue-400 dark:border-blue-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => save(item.id)} disabled={savingId === item.id}
                      className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg disabled:opacity-50">
                      {savingId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 group">
                    <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">{item.popis}</span>
                    <button
                      onClick={() => { setEditingId(item.id); setEditPopis(item.popis) }}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {items.length === 0 && !adding && (
              <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">Žiadne položky. Kliknite na „Predvolené" pre inicializáciu.</p>
            )}
          </div>

          {/* Pridať novú hodnotu */}
          {adding ? (
            <form onSubmit={handleAdd} className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/60 bg-blue-50/40 dark:bg-blue-900/10 space-y-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Nová hodnota <span className="text-gray-400 font-normal">(kód vygeneruje systém)</span></p>
              <div className="flex items-center gap-3">
                <input
                  value={addPopis}
                  onChange={e => setAddPopis(e.target.value)}
                  placeholder="Zobrazovaný popis hodnoty"
                  autoFocus
                  className={`${inputCls} flex-1`}
                />
                <button type="submit" disabled={addSaving}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0">
                  {addSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Pridať
                </button>
                <button type="button" onClick={() => { setAdding(false); setAddPopis(""); setAddError("") }}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">
                  Zrušiť
                </button>
              </div>
              {addError && <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>}
            </form>
          ) : (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700/60">
              <button
                onClick={() => { setAdding(true); setCollapsed(false) }}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Plus size={13} /> Pridať hodnotu
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CislonikTab({ cislonik }: { cislonik: Record<CislonikTyp, Item[]> }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Definujte dostupné hodnoty pre vybrané polia registratúry. Deaktivované hodnoty sa nebudú zobrazovať vo formulároch.
      </p>
      {SEKCIE.map(s => (
        <CislonikSekcia key={s.typ} typ={s.typ} nazov={s.nazov} popis={s.popis} items={cislonik[s.typ] ?? []} />
      ))}
    </div>
  )
}
