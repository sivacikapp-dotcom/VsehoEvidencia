"use client"

import { useEffect } from "react"
import { CheckCircle2, X } from "lucide-react"

interface Props {
  message: string
  onDone: () => void
  duration?: number
}

export default function Toast({ message, onDone, duration = 3000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
  }, [duration, onDone])

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium max-w-sm">
      <CheckCircle2 size={16} className="text-green-400 dark:text-green-600 shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onDone} className="opacity-60 hover:opacity-100 transition-opacity shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}
