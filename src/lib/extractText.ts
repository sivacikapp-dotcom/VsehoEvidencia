import { readFile } from "fs/promises"
import path from "path"
import { PDFParse } from "pdf-parse"

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
      const buffer = await readFile(fullPath)
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
