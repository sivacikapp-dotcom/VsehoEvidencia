"use client"

/**
 * Persists per-user table preferences (column order, hidden columns, column widths)
 * in localStorage. Each table gets a unique storageKey so preferences are isolated.
 * Fixed columns cannot be hidden or reordered.
 */
import { useState, useEffect, useCallback } from "react"

export type ColDef = {
  key: string
  label: string
  fixed?: boolean
  defaultWidth?: number
  minWidth?: number
  sortable?: boolean
}

type Prefs = {
  order: string[]
  hidden: string[]
  widths: Record<string, number>
}

export function useTablePrefs(storageKey: string, cols: ColDef[]) {
  const movableKeys = cols.filter(c => !c.fixed).map(c => c.key)
  const defaultPrefs: Prefs = { order: movableKeys, hidden: [], widths: {} }

  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const s = JSON.parse(raw) as Partial<Prefs>
        const storedOrder = (s.order ?? []).filter(k => movableKeys.includes(k))
        const missing = movableKeys.filter(k => !storedOrder.includes(k))
        setPrefs({
          order: [...storedOrder, ...missing],
          hidden: (s.hidden ?? []).filter(k => movableKeys.includes(k)),
          widths: s.widths ?? {},
        })
      }
    } catch { /* ignore */ }
    setReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const toggleHidden = useCallback((key: string) => {
    setPrefs(p => {
      const next: Prefs = {
        ...p,
        hidden: p.hidden.includes(key) ? p.hidden.filter(k => k !== key) : [...p.hidden, key],
      }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])

  const reorderCols = useCallback((fromIdx: number, toIdx: number) => {
    setPrefs(p => {
      const order = [...p.order]
      const [item] = order.splice(fromIdx, 1)
      order.splice(toIdx, 0, item)
      const next: Prefs = { ...p, order }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])

  const setWidth = useCallback((key: string, w: number) => {
    setPrefs(p => {
      const next: Prefs = { ...p, widths: { ...p.widths, [key]: Math.round(w) } }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])

  const reset = useCallback(() => {
    setPrefs(defaultPrefs)
    try { localStorage.setItem(storageKey, JSON.stringify(defaultPrefs)) } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const getWidth = useCallback((key: string) =>
    prefs.widths[key] ?? cols.find(c => c.key === key)?.defaultWidth,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [prefs.widths])

  const fixedCols = cols.filter(c => c.fixed)
  const visibleCols: ColDef[] = ready
    ? [
        ...fixedCols,
        ...prefs.order
          .map(k => cols.find(c => c.key === k))
          .filter((c): c is ColDef => !!c && !prefs.hidden.includes(c.key)),
      ]
    : cols

  return {
    prefs,
    visibleCols,
    movableCols: cols.filter(c => !c.fixed),
    toggleHidden,
    reorderCols,
    setWidth,
    reset,
    ready,
    getWidth,
  }
}
