"use client"

import { useState } from "react"
import { ChevronDown, X } from "lucide-react"

export function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const isActive = value !== ""
  const selectedLabel = options.find(o => o.value === value)?.label

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-sm rounded-lg border transition-colors ${
          isActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        <span className="whitespace-nowrap">
          {isActive ? `${label}: ${selectedLabel}` : label}
        </span>
        {isActive && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange(""); setOpen(false) }}
            className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors shrink-0"
          >
            <X size={11} />
          </span>
        )}
        <ChevronDown
          size={13}
          className={`opacity-60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg min-w-[160px] py-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false) }}
              className={`flex items-center w-full px-3 py-2 text-sm transition-colors ${
                !isActive
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Všetky
            </button>
            <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`flex items-center w-full px-3 py-2 text-sm transition-colors ${
                  value === opt.value
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
