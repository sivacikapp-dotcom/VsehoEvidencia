/**
 * Codebook (číselník) helpers for the registry module.
 * Values are stored in the database so admins can add/rename entries without a deploy.
 * If the table is empty for a given type the defaults below are inserted automatically
 * on first read (lazy seed), so the app works out of the box on a fresh database.
 */
import { prisma } from "./prisma"

export type CislonikTyp =
  | "SPOSOB_DORUCENIA"
  | "STAV_ZAZNAMU"
  | "STAV_SPISU"
  | "SPOSOB_VYBAVENIA"

export type CislonikItem = { id: number; kod: string; popis: string; poradie: number; aktivne: boolean }

const DEFAULTS: Record<CislonikTyp, Omit<CislonikItem, "id">[]> = {
  SPOSOB_DORUCENIA: [
    { kod: "SpDor1", popis: "E-mail",  poradie: 0, aktivne: true },
    { kod: "SpDor2", popis: "Poštou",  poradie: 1, aktivne: true },
    { kod: "SpDor3", popis: "ÚPVS",    poradie: 2, aktivne: true },
    { kod: "SpDor4", popis: "Osobne",  poradie: 3, aktivne: true },
  ],
  STAV_ZAZNAMU: [
    { kod: "StZaz1", popis: "Pridelený", poradie: 0, aktivne: true },
    { kod: "StZaz2", popis: "Vytvorený", poradie: 1, aktivne: true },
    { kod: "StZaz3", popis: "V spise",   poradie: 2, aktivne: true },
    { kod: "StZaz4", popis: "Vybavený",  poradie: 3, aktivne: true },
  ],
  STAV_SPISU: [
    { kod: "StSpis1", popis: "Otvorený", poradie: 0, aktivne: true },
    { kod: "StSpis2", popis: "Odložený", poradie: 1, aktivne: true },
    { kod: "StSpis3", popis: "Vybavený", poradie: 2, aktivne: true },
  ],
  SPOSOB_VYBAVENIA: [
    { kod: "StVyZa1", popis: "Vzal na vedomie", poradie: 0, aktivne: true },
    { kod: "StVyZa2", popis: "Odpoveďou",        poradie: 1, aktivne: true },
    { kod: "StVyZa3", popis: "Založený",          poradie: 2, aktivne: true },
    { kod: "StVyZa4", popis: "Odoslaný",          poradie: 3, aktivne: true },
  ],
}

async function ensureSeeded(typ: CislonikTyp): Promise<void> {
  const count = await prisma.regCislonik.count({ where: { typ } })
  if (count > 0) return
  await prisma.regCislonik.createMany({
    data: DEFAULTS[typ].map(d => ({ ...d, typ })),
    skipDuplicates: true,
  })
}

export async function getCislonik(typ: CislonikTyp): Promise<CislonikItem[]> {
  await ensureSeeded(typ)
  return prisma.regCislonik.findMany({
    where: { typ, aktivne: true },
    orderBy: { poradie: "asc" },
  })
}

export async function getAllCislonik(typ: CislonikTyp): Promise<CislonikItem[]> {
  await ensureSeeded(typ)
  return prisma.regCislonik.findMany({
    where: { typ },
    orderBy: { poradie: "asc" },
  })
}

export { DEFAULTS }
