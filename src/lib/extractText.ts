/**
 * Extracts plain text from uploaded documents for full-text search indexing.
 * Supports plain-text files and PDFs; all other types return null (not indexed).
 * Text is capped at MAX_CHARS to keep database rows manageable.
 *
 * pdf-parse / pdfjs-dist reference DOMMatrix at module-init time, which crashes
 * in Vercel's Lambda environment. We polyfill it here before the dynamic import
 * so the module evaluates cleanly. Text extraction does not need actual rendering,
 * so a stub is sufficient.
 */
import { readFile } from "fs/promises"
import path from "path"

const TEXT_EXTS = new Set([".txt", ".csv", ".md", ".log"])
const MAX_CHARS = 200_000

function polyfillBrowserAPIs() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
      m11 = 1; m12 = 0; m13 = 0; m14 = 0
      m21 = 0; m22 = 1; m23 = 0; m24 = 0
      m31 = 0; m32 = 0; m33 = 1; m34 = 0
      m41 = 0; m42 = 0; m43 = 0; m44 = 1
      is2D = true; isIdentity = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      multiply() { return new (globalThis as any).DOMMatrix() }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      translate() { return new (globalThis as any).DOMMatrix() }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scale() { return new (globalThis as any).DOMMatrix() }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rotate() { return new (globalThis as any).DOMMatrix() }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inverse() { return new (globalThis as any).DOMMatrix() }
      transformPoint(p: { x?: number; y?: number }) { return { x: p?.x ?? 0, y: p?.y ?? 0 } }
    }
  }
}

export async function extractDocText(storedName: string): Promise<string | null> {
  const ext = path.extname(storedName).toLowerCase()
  const fullPath = path.join(process.cwd(), "uploads", "docs", storedName)

  try {
    if (TEXT_EXTS.has(ext)) {
      const content = await readFile(fullPath, "utf-8")
      return content.slice(0, MAX_CHARS)
    }

    if (ext === ".pdf") {
      const buffer = await readFile(fullPath)
      polyfillBrowserAPIs()
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      await parser.destroy()
      return result.text.slice(0, MAX_CHARS)
    }

    return null
  } catch {
    return null
  }
}
