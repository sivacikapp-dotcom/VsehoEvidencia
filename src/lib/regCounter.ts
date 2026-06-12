import { prisma } from "./prisma"

export function currentYear(): number {
  return new Date().getFullYear()
}

// Serializable isolation prevents two concurrent requests from receiving the same number.
export async function nextCounter(key: string, digits = 5): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const counter = await tx.regCounter.upsert({
      where: { id: key },
      update: { value: { increment: 1 } },
      create: { id: key, value: 1 },
    })
    return counter.value
  }, { isolationLevel: "Serializable" })

  return String(result).padStart(digits, "0")
}

export async function nextPostaNumber(year: number): Promise<string> {
  const n = await nextCounter(`POSTA-${year}`, 5)
  return `P-${year}/${n}`
}

export async function nextZaznamNumber(year: number): Promise<string> {
  const n = await nextCounter(`REG-${year}`, 5)
  return `REG-${year}/${n}`
}

export async function nextSpisNumber(year: number): Promise<string> {
  const n = await nextCounter(`SPIS-${year}`, 3)
  return `S-${year}/${n}`
}
