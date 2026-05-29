"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronRight, ChevronDown, Check, Search, X, FolderOpen, FileText, FileCode } from "lucide-react"

type PlanItem = { id: number; znacka: string; nazov: string; lehota: number; maArchivnu: boolean }

interface Props {
  items: PlanItem[]
  value: number | null
  onChange: (id: number) => void
  name: string
  placeholder?: string
  required?: boolean
}

function lvl(znacka: string) { return znacka.split(".").length }
function parentOf(znacka: string) { const p = znacka.split("."); p.pop(); return p.join(".") }
function childrenOf(parent: string, all: PlanItem[], level: number) {
  return all.filter(p => lvl(p.znacka) === level && parentOf(p.znacka) === parent)
}

function LevelIcon({ level }: { level: number }) {
  if (level === 1) return <FolderOpen size={13} className="text-blue-500 shrink-0" />
  if (level === 2) return <FileText size={13} className="text-gray-400 shrink-0" />
  return <FileCode size={12} className="text-gray-300 shrink-0" />
}

export default function PlanTreePicker({ items, value, onChange, name, placeholder = "— Vyberte značku —", required }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [expanded1, setExpanded1] = useState<Set<string>>(new Set())
  const [expanded2, setExpanded2] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  const selected = value !== null ? items.find(p => p.id === value) : null

  // Auto-expand parents of selected value
  useEffect(() => {
    if (selected) {
      const parts = selected.znacka.split(".")
      if (parts.length >= 2) setExpanded1(prev => new Set([...prev, parts[0]]))
      if (parts.length >= 3) setExpanded2(prev => new Set([...prev, parts.slice(0, 2).join(".")]))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const isSearching = search.trim().length > 0
  const filtered = isSearching
    ? items.filter(p =>
        p.znacka.toLowerCase().includes(search.toLowerCase()) ||
        p.nazov.toLowerCase().includes(search.toLowerCase())
      )
    : null

  function toggle1(z: string) {
    setExpanded1(prev => { const s = new Set(prev); s.has(z) ? s.delete(z) : s.add(z); return s })
  }
  function toggle2(z: string) {
    setExpanded2(prev => { const s = new Set(prev); s.has(z) ? s.delete(z) : s.add(z); return s })
  }

  function select(item: PlanItem) {
    onChange(item.id)
    setOpen(false)
    setSearch("")
  }

  const l1 = items.filter(p => lvl(p.znacka) === 1)
  const l2 = items.filter(p => lvl(p.znacka) === 2)
  const l3 = items.filter(p => lvl(p.znacka) === 3)

  return (
    <div ref={ref} className="relative">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value ?? ""} required={required} />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          open
            ? "border-blue-500 dark:border-blue-400"
            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
        }`}
      >
        {selected ? (
          <span className="flex items-center gap-2 truncate">
            <LevelIcon level={lvl(selected.znacka)} />
            <span className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0">{selected.znacka}</span>
            <span className="text-gray-700 dark:text-gray-300 truncate">{selected.nazov}</span>
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}
        <ChevronDown size={14} className={`text-gray-400 transition-transform shrink-0 ml-2 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[320px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Hľadať značku alebo názov…"
                className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">Registratúrny plán je prázdny.</p>
            )}

            {/* Search results — flat list */}
            {isSearching && filtered && (
              filtered.length === 0 ? (
                <p className="px-4 py-4 text-center text-sm text-gray-400">Žiadne výsledky.</p>
              ) : (
                filtered.map(item => (
                  <button key={item.id} type="button" onClick={() => select(item)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${value === item.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                    <LevelIcon level={lvl(item.znacka)} />
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0 w-20">{item.znacka}</span>
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{item.nazov}</span>
                    {value === item.id && <Check size={13} className="text-blue-500 shrink-0 ml-auto" />}
                  </button>
                ))
              )
            )}

            {/* Tree view */}
            {!isSearching && l1.map(item1 => {
              const ch2 = childrenOf(item1.znacka, l2, 2)
              const isExp1 = expanded1.has(item1.znacka)
              return (
                <div key={item1.id} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                  {/* L1 row */}
                  <div className={`flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${value === item1.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                    <button type="button" onClick={() => toggle1(item1.znacka)}
                      className="p-2 text-gray-400 hover:text-gray-600 shrink-0">
                      {ch2.length > 0
                        ? (isExp1 ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
                        : <span className="w-[13px] inline-block" />}
                    </button>
                    <button type="button" onClick={() => select(item1)}
                      className="flex-1 flex items-center gap-2 py-2 pr-3 text-left">
                      <LevelIcon level={1} />
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0 w-16">{item1.znacka}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item1.nazov}</span>
                      <span className="text-xs text-gray-400 shrink-0 ml-auto">{item1.lehota}r.</span>
                      {value === item1.id && <Check size={13} className="text-blue-500 shrink-0" />}
                    </button>
                  </div>

                  {/* L2 rows */}
                  {isExp1 && ch2.map(item2 => {
                    const ch3 = childrenOf(item2.znacka, l3, 3)
                    const isExp2 = expanded2.has(item2.znacka)
                    return (
                      <div key={item2.id}>
                        <div className={`flex items-center gap-1 pl-6 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors bg-gray-50/30 dark:bg-gray-800/10 ${value === item2.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                          <button type="button" onClick={() => toggle2(item2.znacka)}
                            className="p-2 text-gray-400 hover:text-gray-600 shrink-0">
                            {ch3.length > 0
                              ? (isExp2 ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
                              : <span className="w-[12px] inline-block" />}
                          </button>
                          <button type="button" onClick={() => select(item2)}
                            className="flex-1 flex items-center gap-2 py-1.5 pr-3 text-left">
                            <LevelIcon level={2} />
                            <span className="font-mono text-xs text-gray-600 dark:text-gray-300 shrink-0 w-16">{item2.znacka}</span>
                            <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{item2.nazov}</span>
                            <span className="text-xs text-gray-400 shrink-0 ml-auto">{item2.lehota}r.</span>
                            {value === item2.id && <Check size={13} className="text-blue-500 shrink-0" />}
                          </button>
                        </div>

                        {/* L3 rows */}
                        {isExp2 && ch3.map(item3 => (
                          <button key={item3.id} type="button" onClick={() => select(item3)}
                            className={`w-full flex items-center gap-2 pl-16 pr-3 py-1.5 border-t border-gray-100 dark:border-gray-800 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors bg-gray-50/50 dark:bg-gray-800/20 ${value === item3.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                            <LevelIcon level={3} />
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0 w-20">{item3.znacka}</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item3.nazov}</span>
                            <span className="text-xs text-gray-400 shrink-0 ml-auto">{item3.lehota}r.</span>
                            {value === item3.id && <Check size={13} className="text-blue-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Clear button if value selected */}
          {value !== null && (
            <div className="border-t border-gray-100 dark:border-gray-800 p-2">
              <button type="button" onClick={() => { onChange(0); setOpen(false) }}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors">
                <X size={12} /> Zrušiť výber
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
