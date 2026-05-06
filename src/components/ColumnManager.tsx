"use client"

import { useState, useRef } from "react"
import { Settings2, GripVertical, RotateCcw } from "lucide-react"
import type { ColDef } from "@/lib/useTablePrefs"

interface Props {
  cols: ColDef[]
  hidden: string[]
  order: string[]
  onToggle: (key: string) => void
  onReorder: (from: number, to: number) => void
  onReset: () => void
}

const DROPDOWN_W = 208 // w-52

export default function ColumnManager({ cols, hidden, order, onToggle, onReorder, onReset }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dragIdx = useRef<number | null>(null)

  const orderedCols = order.map(k => cols.find(c => c.key === k)).filter(Boolean) as ColDef[]

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const top = rect.bottom + 4
      const left = Math.max(4, rect.right - DROPDOWN_W)
      setPos({ top, left })
    }
    setOpen(o => !o)
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        title="Nastavenie stĺpcov"
        className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
          open
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        <Settings2 size={12} />
        Stĺpce
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="fixed z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg w-52 py-1.5"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Stĺpce</span>
              <button
                type="button"
                onClick={() => { onReset(); setOpen(false) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <RotateCcw size={10} />
                Reset
              </button>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
            {orderedCols.map((col, idx) => {
              const isHidden = hidden.includes(col.key)
              return (
                <div
                  key={col.key}
                  draggable
                  onDragStart={() => { dragIdx.current = idx }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx.current !== null && dragIdx.current !== idx) {
                      onReorder(dragIdx.current, idx)
                      dragIdx.current = null
                    }
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
                >
                  <GripVertical size={13} className="text-gray-300 dark:text-gray-600 shrink-0 cursor-grab" />
                  <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => onToggle(col.key)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 shrink-0 cursor-pointer"
                    />
                    <span className={`text-sm truncate ${isHidden ? "text-gray-300 dark:text-gray-600 line-through" : "text-gray-700 dark:text-gray-200"}`}>
                      {col.label}
                    </span>
                  </label>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
