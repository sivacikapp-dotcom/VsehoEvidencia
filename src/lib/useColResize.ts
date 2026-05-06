"use client"

import { useCallback, useRef } from "react"

export function useColResize(
  getWidth: (key: string) => number | undefined,
  setWidth: (key: string, w: number) => void,
  minWidth = 50,
) {
  const state = useRef<{ key: string; startX: number; startW: number } | null>(null)

  const onResizeMouseDown = useCallback(
    (key: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startW = getWidth(key) ?? 120
      state.current = { key, startX: e.clientX, startW }

      function onMove(ev: MouseEvent) {
        if (!state.current) return
        const { key: k, startX, startW: sw } = state.current
        setWidth(k, Math.max(minWidth, sw + ev.clientX - startX))
      }
      function onUp() {
        state.current = null
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
      }
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setWidth, minWidth],
  )

  return { onResizeMouseDown }
}
