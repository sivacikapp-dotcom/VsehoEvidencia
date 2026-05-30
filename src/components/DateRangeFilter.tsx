"use client"

import { useState, useRef, useEffect } from "react"
import { Calendar, ChevronDown, X } from "lucide-react"

function fmtDate(iso: string) {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export function DateRangeFilter({ od, do: dateDo, onOd, onDo }: {
  od: string; do: string; onOd: (v: string) => void; onDo: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const isActive = od !== "" || dateDo !== ""
  const label = !isActive ? "Dátum"
    : od && dateDo ? `${fmtDate(od)} – ${fmtDate(dateDo)}`
    : od ? `od ${fmtDate(od)}`
    : `do ${fmtDate(dateDo)}`

  const inputCls = "w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-sm rounded-lg border transition-colors ${
          isActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        {!isActive && <Calendar size={13} className="opacity-50 shrink-0" />}
        <span className="whitespace-nowrap">{label}</span>
        {isActive && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onOd(""); onDo(""); setOpen(false) }}
            className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors shrink-0"
          >
            <X size={11} />
          </span>
        )}
        <ChevronDown size={13} className={`opacity-60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 space-y-2.5 min-w-[210px]">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Od</label>
            <input type="date" value={od} onChange={e => onOd(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Do</label>
            <input type="date" value={dateDo} onChange={e => onDo(e.target.value)} className={inputCls} />
          </div>
          {isActive && (
            <button
              type="button"
              onClick={() => { onOd(""); onDo("") }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={11} /> Zrušiť dátum
            </button>
          )}
        </div>
      )}
    </div>
  )
}
