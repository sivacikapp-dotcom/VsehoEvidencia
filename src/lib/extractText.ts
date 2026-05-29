import { readFile } from "fs/promises"
import path from "path"

const TEXT_EXTS = new Set([".txt", ".csv", ".md", ".log"])
const MAX_CHARS = 200_000

export async function extractDocText(storedName: string): Promise<string | null> {
  const ext = path.extname(storedName).toLowerCase()
  const fullPath = path.join(process.cwd(), "uploads", "docs", storedName)

  try {
    if (TEXT_EXTS.has(ext)) {
      const content = await readFile(fullPath, "utf-8")
      return content.slice(0, MAX_CHARS)
    }

    if (ext === ".pdf") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>
      const buffer = await readFile(fullPath)
      const result = await pdfParse(buffer)
      return result.text.slice(0, MAX_CHARS)
    }

    return null
  } catch {
    return null
  }
}
