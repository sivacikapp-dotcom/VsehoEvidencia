"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { DEFAULTS, type CislonikTyp } from "@/lib/cislonik"

type Result = { error?: string; success?: boolean }

function canManage(roles: string[]) {
  return roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
}

export async function updateCislonikItem(
  id: number,
  data: { popis?: string; aktivne?: boolean; poradie?: number }
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !canManage(roles)) return { error: "Nemáte oprávnenie." }

  const popis = data.popis?.trim()
  if (popis !== undefined && !popis) return { error: "Popis nemôže byť prázdny." }

  try {
    await prisma.regCislonik.update({
      where: { id },
      data: {
        ...(popis !== undefined ? { popis } : {}),
        ...(data.aktivne !== undefined ? { aktivne: data.aktivne } : {}),
        ...(data.poradie !== undefined ? { poradie: data.poradie } : {}),
      },
    })
    revalidatePath("/dashboard/registratura/nastavenia")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

const KOD_PREFIX: Record<CislonikTyp, string> = {
  SPOSOB_DORUCENIA:  "SpDor",
  STAV_ZAZNAMU:      "StZaz",
  STAV_SPISU:        "StSpis",
  SPOSOB_VYBAVENIA:  "StVyZa",
}

export async function addCislonikItem(
  typ: CislonikTyp,
  data: { popis: string }
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !canManage(roles)) return { error: "Nemáte oprávnenie." }

  const popis = data.popis.trim()
  if (!popis) return { error: "Popis je povinný." }

  // Auto-generate next code
  const prefix = KOD_PREFIX[typ]
  const existing = await prisma.regCislonik.findMany({ where: { typ } })
  const usedNums = existing
    .map(i => parseInt(i.kod.replace(prefix, ""), 10))
    .filter(n => !isNaN(n))
  const nextNum = usedNums.length > 0 ? Math.max(...usedNums) + 1 : 1
  const kod = `${prefix}${nextNum}`

  const max = await prisma.regCislonik.aggregate({ where: { typ }, _max: { poradie: true } })
  const poradie = (max._max.poradie ?? -1) + 1

  try {
    await prisma.regCislonik.create({ data: { typ, kod, popis, poradie, aktivne: true } })
    revalidatePath("/dashboard/registratura/nastavenia")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function resetCislonik(typ: CislonikTyp): Promise<Result> {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !canManage(roles)) return { error: "Nemáte oprávnenie." }

  const defaults = DEFAULTS[typ]
  if (!defaults) return { error: "Neznámy typ číselníka." }

  try {
    await prisma.regCislonik.deleteMany({ where: { typ } })
    await prisma.regCislonik.createMany({
      data: defaults.map(d => ({ ...d, typ })),
    })
    revalidatePath("/dashboard/registratura/nastavenia")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri resetovaní." }
  }
}
