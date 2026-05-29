"use client"

import { useState, useRef, useEffect } from "react"
import { Search } from "lucide-react"

export type SubjektItem = {
  id: number
  meno: string | null; priezvisko: string | null; nazov: string | null
  oddelenie: string | null; ulica: string | null; mesto: string | null
  psc: string | null; identifikator: string | null
}

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

interface ContactFieldsProps {
  defaults?: Record<string, string | null> | null
  subjekty: SubjektItem[]
  inputCls?: string
  labelCls?: string
}

export default function ContactFields({ defaults, subjekty, inputCls, labelCls }: ContactFieldsProps) {
  const ic = inputCls ?? "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  const lc = labelCls ?? "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"

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
          <label className={lc}>Meno</label>
          <input type="text" name="meno" value={vals.meno} onChange={set("meno")} className={ic} />
        </div>
        <div>
          <label className={lc}>Priezvisko</label>
          <input type="text" name="priezvisko" value={vals.priezvisko} onChange={set("priezvisko")} className={ic} />
        </div>
        <div>
          <label className={lc}>Názov</label>
          <input type="text" name="nazov" value={vals.nazov} onChange={set("nazov")} className={ic} />
        </div>
        <div>
          <label className={lc}>Oddelenie</label>
          <input type="text" name="oddelenie" value={vals.oddelenie} onChange={set("oddelenie")} className={ic} />
        </div>
        <div>
          <label className={lc}>Ulica</label>
          <input type="text" name="ulica" value={vals.ulica} onChange={set("ulica")} className={ic} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lc}>Mesto</label>
            <input type="text" name="mesto" value={vals.mesto} onChange={set("mesto")} className={ic} />
          </div>
          <div>
            <label className={lc}>PSČ</label>
            <input type="text" name="psc" value={vals.psc} onChange={set("psc")} className={ic} />
          </div>
        </div>
        <div>
          <label className={lc}>Identifikátor (IČO apod.)</label>
          <input type="text" name="identifikator" value={vals.identifikator} onChange={set("identifikator")} className={ic} />
        </div>
      </div>
    </div>
  )
}
