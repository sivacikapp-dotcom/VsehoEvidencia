// ─── TravelRates type & defaults ──────────────────────────────────────────────

export type TravelRates = {
  diet5to12: number
  diet12to18: number
  dietOver18: number
  breakfastPct: number   // e.g. 25  (stored as %, not fraction)
  lunchPct: number       // e.g. 40
  dinnerPct: number      // e.g. 35
  kmJednostopove: number
  kmOsobneDoLimit: number
  kmOsobneNadLimit: number
  kmEngineLimit: number  // cm³ threshold e.g. 1500
}

export const DEFAULT_TRAVEL_RATES: TravelRates = {
  diet5to12: 7.80,
  diet12to18: 10.90,
  dietOver18: 16.60,
  breakfastPct: 25,
  lunchPct: 40,
  dinnerPct: 35,
  kmJednostopove: 0.119,
  kmOsobneDoLimit: 0.239,
  kmOsobneNadLimit: 0.281,
  kmEngineLimit: 1500,
}

export function computeKmRate(
  vehicleCategory: "OSOBNE_VOZIDLO" | "JEDNOSTOPOVE" | null | undefined,
  engineVolume: number | null | undefined,
  rates: TravelRates = DEFAULT_TRAVEL_RATES
): number {
  if (vehicleCategory === "JEDNOSTOPOVE") return rates.kmJednostopove
  if ((engineVolume ?? 0) > rates.kmEngineLimit) return rates.kmOsobneNadLimit
  return rates.kmOsobneDoLimit
}

export function kmRateLabel(
  vehicleCategory: "OSOBNE_VOZIDLO" | "JEDNOSTOPOVE" | null | undefined,
  engineVolume: number | null | undefined,
  rates: TravelRates = DEFAULT_TRAVEL_RATES
): string {
  if (vehicleCategory === "JEDNOSTOPOVE") return `${rates.kmJednostopove.toFixed(3)} €/km (jednostopové)`
  if ((engineVolume ?? 0) > rates.kmEngineLimit) return `${rates.kmOsobneNadLimit.toFixed(3)} €/km (nad ${rates.kmEngineLimit.toLocaleString("sk-SK")} cm³)`
  return `${rates.kmOsobneDoLimit.toFixed(3)} €/km (do ${rates.kmEngineLimit.toLocaleString("sk-SK")} cm³)`
}

export type DayMealEntry = {
  date: string        // "YYYY-MM-DD"
  breakfast: boolean
  lunch: boolean
  dinner: boolean
}

export type DayInfo = DayMealEntry & {
  hours: number
  dietAmount: number
}

// Parsuje "YYYY-MM-DDTHH:mm" alebo ISO Z string ako lokálny čas
export function parseLocalDT(str: string): Date {
  const s = str.slice(0, 16) // "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = s.split("T")
  const [y, mo, d] = datePart.split("-").map(Number)
  const [h, mi] = (timePart ?? "00:00").split(":").map(Number)
  return new Date(y, mo - 1, d, h, mi)
}

export function calcHoursOnDay(dateStr: string, depStr: string, retStr: string): number {
  const dep = parseLocalDT(depStr)
  const ret = parseLocalDT(retStr)
  const [y, mo, d] = dateStr.split("-").map(Number)
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0)
  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999)
  const start = Math.max(dep.getTime(), dayStart.getTime())
  const end = Math.min(ret.getTime(), dayEnd.getTime())
  return Math.max(0, (end - start) / 3_600_000)
}

export function calcDayDiet(
  hours: number,
  breakfast: boolean,
  lunch: boolean,
  dinner: boolean,
  rates: TravelRates = DEFAULT_TRAVEL_RATES
): number {
  let base = 0
  if (hours >= 5 && hours < 12) base = rates.diet5to12
  else if (hours >= 12 && hours < 18) base = rates.diet12to18
  else if (hours >= 18) base = rates.dietOver18
  if (base === 0) return 0
  let reduction = 0
  if (breakfast) reduction += rates.breakfastPct / 100
  if (lunch) reduction += rates.lunchPct / 100
  if (dinner) reduction += rates.dinnerPct / 100
  return Math.max(0, parseFloat((base * (1 - reduction)).toFixed(2)))
}

export function tierLabel(hours: number, rates: TravelRates = DEFAULT_TRAVEL_RATES): string {
  if (hours < 5) return "< 5 h"
  if (hours < 12) return `5–12 h / ${rates.diet5to12.toFixed(2)} €`
  if (hours < 18) return `12–18 h / ${rates.diet12to18.toFixed(2)} €`
  return `≥ 18 h / ${rates.dietOver18.toFixed(2)} €`
}

function getDatesInRange(startStr: string, endStr: string): string[] {
  const [sy, sm, sd] = startStr.split("-").map(Number)
  const [ey, em, ed] = endStr.split("-").map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  const dates: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, "0")
    const d = String(cur.getDate()).padStart(2, "0")
    dates.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

/**
 * Builds a per-day diet breakdown for the trip.
 * For each calendar day between departure and return, calculates how many hours
 * the traveller was on the road that day, then applies meal deductions to get
 * the net diet allowance (§ 5 zák. 283/2002 Z.z.).
 */
export function buildDayInfos(
  depStr: string,
  retStr: string,
  meals: DayMealEntry[],
  rates: TravelRates = DEFAULT_TRAVEL_RATES
): DayInfo[] {
  if (!depStr || !retStr) return []
  const depDate = depStr.slice(0, 10)
  const retDate = retStr.slice(0, 10)
  if (depDate > retDate) return []
  return getDatesInRange(depDate, retDate).map((date) => {
    const existing = meals.find((m) => m.date === date)
    const b = existing?.breakfast ?? false
    const l = existing?.lunch ?? false
    const d = existing?.dinner ?? false
    const hours = calcHoursOnDay(date, depStr, retStr)
    return { date, breakfast: b, lunch: l, dinner: d, hours, dietAmount: calcDayDiet(hours, b, l, d, rates) }
  })
}

export function formatLocalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-")
  return `${d}.${m}.${y}`
}
