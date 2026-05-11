"use client"

import { useState } from "react"
import { ChevronDown, X } from "lucide-react"

export function MultiSelect({
  placeholder,
  options,
  selected,
  onChange,
}: {
  placeholder: string
  options: { value: string; label: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)

  function toggle(value: string) {
    const next = new Set(selected)
    next.has(value) ? next.delete(value) : next.add(value)
    onChange(next)
  }

  const label =
    selected.size === 0
      ? placeholder
      : selected.size === 1
        ? options.find((o) => selected.has(o.value))?.label ?? placeholder
        : `${placeholder} · ${selected.size}`

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-sm rounded-lg border transition-colors ${
          selected.size > 0
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        <span className="whitespace-nowrap">{label}</span>
        {selected.size > 0 && (
          <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold shrink-0">
            {selected.size}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`text-current opacity-60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg min-w-[180px] max-h-64 overflow-y-auto py-1">
            {selected.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => onChange(new Set())}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <X size={11} /> Zrušiť výber
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              </>
            )}
            {options.map(({ value, label: optLabel }) => {
              const checked = selected.has(value)
              return (
                <label
                  key={value}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                    checked ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(value)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span
                    className={`text-sm ${
                      checked ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {optLabel}
                  </span>
                </label>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
