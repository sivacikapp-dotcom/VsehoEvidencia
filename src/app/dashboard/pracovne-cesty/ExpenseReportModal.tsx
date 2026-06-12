"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { X, Loader2, Plus, Trash2 } from "lucide-react"
import { upsertExpenseReport, submitExpenseReport } from "./actions"
import { toDatetimeLocalInput } from "@/lib/formatDate"
import type { TravelOrderType, TransportMeans, VehicleCategory } from "@/generated/prisma/enums"
import {
  buildDayInfos,
  calcHoursOnDay,
  calcDayDiet,
  tierLabel,
  formatLocalDate,
  computeKmRate,
  kmRateLabel,
  type DayMealEntry,
  type DayInfo,
  type TravelRates,
  DEFAULT_TRAVEL_RATES,
} from "@/lib/travelUtils"
import { transportMeansLabels } from "@/lib/labels"

type TransportItem = { id: string; description: string; amount: string; currForeign: boolean }
type OtherExpenseItem = { id: string; description: string; amount: string; currForeign: boolean }
type AccommodationItem = { id: string; description: string; price: string; companyCard: string; employee: string }

interface Props {
  order: {
    id: number
    type: TravelOrderType
    departureAt: string
    returnAt: string
    transport: TransportMeans[]
    vehicleCategory: VehicleCategory | null
    vehicleRegPlate: string | null
    engineVolume: number | null
    advanceEUR: number | null
    foreignCurrency: string | null
  }
  existing: {
    actualDepartureAt: string
    actualReturnAt: string
    actualTransport: TransportMeans[] | null
    actualVehicleCategory: VehicleCategory | null
    actualVehicleRegPlate: string | null
    actualEngineVolume: number | null
    mealsPerDay: string | null
    dietAmount: number
    kmDriven: number | null
    kmBasicRate: number | null
    fuelConsumption: number | null
    fuelPricePerL: number | null
    kmCompensation: number | null
    publicTransportCost: number | null
    publicTransportItems: string | null
    taxiCost: number | null
    accommodation: number | null
    accommodationItems: string | null
    parking: number | null
    otherExpenses: number | null
    otherExpensesNote: string | null
    otherExpenseItems: string | null
    foreignDiet: number | null
    pocketMoneyPaid: number | null
    exchangeRate: number | null
    totalExpenses: number
    advanceReceived: number
  } | null
  readOnly: boolean
  onClose: () => void
  onSaved: () => void
  rates?: TravelRates
}

const ALL_TRANSPORTS: TransportMeans[] = [
  "VLASTNE_VOZIDLO",
  "VEREJNY_TRANSPORT",
  "SLUZOBNE_VOZIDLO",
  "TAXIK",
  "INE",
]

export default function ExpenseReportModal({ order, existing, readOnly, onClose, onSaved, rates }: Props) {
  const r = rates ?? DEFAULT_TRAVEL_RATES
  const isForeign = order.type === "ZAHRANICNY"

  // Skutočný spôsob dopravy — predvolený z príkazu, používateľ môže zmeniť
  const [actualTransport, setActualTransport] = useState<TransportMeans[]>(() =>
    existing?.actualTransport?.length ? existing.actualTransport : order.transport
  )

  function toggleActualTransport(t: TransportMeans) {
    setActualTransport((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  }

  function sameTransports(a: TransportMeans[], b: TransportMeans[]) {
    if (a.length !== b.length) return false
    const sa = [...a].sort()
    const sb = [...b].sort()
    return sa.every((v, i) => v === sb[i])
  }

  const ownVehicle = actualTransport.includes("VLASTNE_VOZIDLO")
  const transportChanged = !sameTransports(actualTransport, order.transport)

  // Vozidlové polia pre zmenený spôsob dopravy
  const [actualVehicleCategory, setActualVehicleCategory] = useState<VehicleCategory | "">(
    existing?.actualVehicleCategory ?? order.vehicleCategory ?? ""
  )
  const [actualVehicleRegPlate, setActualVehicleRegPlate] = useState(
    existing?.actualVehicleRegPlate ?? order.vehicleRegPlate ?? ""
  )
  const [actualEngineVolume, setActualEngineVolume] = useState(
    existing?.actualEngineVolume != null
      ? String(existing.actualEngineVolume)
      : order.engineVolume ? String(order.engineVolume) : ""
  )

  const effectiveVehicleCategory = ownVehicle ? (actualVehicleCategory || null) as VehicleCategory | null : null
  const effectiveEngineVolume = ownVehicle && actualEngineVolume ? parseInt(actualEngineVolume) : null

  const [actualDep, setActualDep] = useState(
    toDatetimeLocalInput(existing?.actualDepartureAt ?? order.departureAt)
  )
  const [actualRet, setActualRet] = useState(
    toDatetimeLocalInput(existing?.actualReturnAt ?? order.returnAt)
  )

  // Per-day meals
  const [dayMeals, setDayMeals] = useState<DayMealEntry[]>(() => {
    const stored: DayMealEntry[] = existing?.mealsPerDay
      ? (JSON.parse(existing.mealsPerDay) as DayMealEntry[])
      : []
    const dep = toDatetimeLocalInput(existing?.actualDepartureAt ?? order.departureAt)
    const ret = toDatetimeLocalInput(existing?.actualReturnAt ?? order.returnAt)
    return buildDayInfos(dep, ret, stored, r).map(({ date, breakfast, lunch, dinner }) => ({
      date, breakfast, lunch, dinner,
    }))
  })

  useEffect(() => {
    if (!actualDep || !actualRet) return
    setDayMeals((prev) =>
      buildDayInfos(actualDep, actualRet, prev, r).map(({ date, breakfast, lunch, dinner }) => ({
        date, breakfast, lunch, dinner,
      }))
    )
  }, [actualDep, actualRet])

  // Keď sa zmení doprava, resetujeme km sadzbu podľa nového vozidla
  const defaultKmRate = computeKmRate(effectiveVehicleCategory, effectiveEngineVolume, r).toFixed(3)

  const [kmDriven, setKmDriven] = useState(existing?.kmDriven != null ? String(existing.kmDriven) : "")
  const [kmBasicRate, setKmBasicRate] = useState(
    existing?.kmBasicRate != null ? String(existing.kmBasicRate) : defaultKmRate
  )
  const [fuelConsumption, setFuelConsumption] = useState(existing?.fuelConsumption != null ? String(existing.fuelConsumption) : "")
  const [fuelPricePerL, setFuelPricePerL] = useState(existing?.fuelPricePerL != null ? String(existing.fuelPricePerL) : "")

  // Ak používateľ zmení typ vozidla, aktualizujeme km sadzbu
  useEffect(() => {
    if (!existing?.kmBasicRate) {
      setKmBasicRate(computeKmRate(effectiveVehicleCategory, effectiveEngineVolume, r).toFixed(3))
    }
  }, [actualVehicleCategory, actualEngineVolume])

  const [pubTransItems, setPubTransItems] = useState<TransportItem[]>(() => {
    if (existing?.publicTransportItems) {
      try {
        return (JSON.parse(existing.publicTransportItems) as { description: string; amount: number }[])
          .map((item, i) => ({ id: String(i), description: item.description, amount: String(item.amount), currForeign: false }))
      } catch { return [] }
    }
    if (existing?.publicTransportCost != null && existing.publicTransportCost > 0) {
      return [{ id: "0", description: "", amount: String(existing.publicTransportCost), currForeign: false }]
    }
    return []
  })

  const addPubTransItem = useCallback(() => {
    setPubTransItems(prev => [...prev, { id: String(Date.now()), description: "", amount: "", currForeign: false }])
  }, [])
  const removePubTransItem = useCallback((id: string) => {
    setPubTransItems(prev => prev.filter(i => i.id !== id))
  }, [])
  const updatePubTransItem = useCallback((id: string, field: keyof Omit<TransportItem, "id">, value: string | boolean) => {
    setPubTransItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }, [])

  const pubTransTotal = pubTransItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

  const [taxiCost, setTaxiCost] = useState(
    existing?.taxiCost != null ? String(existing.taxiCost) : ""
  )

  const [accommodationMode, setAccommodationMode] = useState<"simple" | "detailed">(() =>
    existing?.accommodationItems ? "detailed" : "simple"
  )
  const [accommodation, setAccommodation] = useState(existing?.accommodation != null ? String(existing.accommodation) : "")
  const [accommodationItems, setAccommodationItems] = useState<AccommodationItem[]>(() => {
    if (existing?.accommodationItems) {
      try {
        return (JSON.parse(existing.accommodationItems) as Omit<AccommodationItem, "id">[]).map((item, i) => ({
          ...item, id: String(i),
          price: String(item.price), companyCard: String(item.companyCard), employee: String(item.employee),
        }))
      } catch { return [] }
    }
    return []
  })

  const accItemsEmployeeTotal = accommodationItems.reduce((s, i) => s + (parseFloat(i.employee) || 0), 0)
  const effectiveAccommodation = accommodationMode === "detailed" ? accItemsEmployeeTotal : (parseFloat(accommodation) || 0)

  function switchAccommodationMode(mode: "simple" | "detailed") {
    if (mode === "detailed" && accommodationMode === "simple") {
      if (accommodation && parseFloat(accommodation) > 0 && accommodationItems.length === 0) {
        setAccommodationItems([{ id: String(Date.now()), description: "", price: accommodation, companyCard: "0", employee: accommodation }])
      }
    } else if (mode === "simple" && accommodationMode === "detailed") {
      setAccommodation(accItemsEmployeeTotal > 0 ? accItemsEmployeeTotal.toFixed(2) : "")
    }
    setAccommodationMode(mode)
  }

  const addAccommodationItem = useCallback(() => {
    setAccommodationItems(prev => [...prev, { id: String(Date.now()), description: "", price: "", companyCard: "0", employee: "" }])
  }, [])
  const removeAccommodationItem = useCallback((id: string) => {
    setAccommodationItems(prev => prev.filter(i => i.id !== id))
  }, [])
  function updateAccommodationItem(id: string, field: keyof Omit<AccommodationItem, "id">, value: string) {
    setAccommodationItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === "price" || field === "companyCard") {
        const p = parseFloat(updated.price) || 0
        const c = parseFloat(updated.companyCard) || 0
        updated.employee = String(Math.max(0, parseFloat((p - c).toFixed(2))))
      }
      return updated
    }))
  }

  const [parking, setParking] = useState(existing?.parking != null ? String(existing.parking) : "")

  const [otherItems, setOtherItems] = useState<OtherExpenseItem[]>(() => {
    if (existing?.otherExpenseItems) {
      try {
        return (JSON.parse(existing.otherExpenseItems) as { description: string; amount: number }[])
          .map((item, i) => ({ id: String(i), description: item.description, amount: String(item.amount), currForeign: false }))
      } catch { return [] }
    }
    // backward compat — ak existuje starý záznam s otherExpenses
    if (existing?.otherExpenses != null && existing.otherExpenses > 0) {
      return [{ id: "0", description: existing.otherExpensesNote ?? "Iné", amount: String(existing.otherExpenses), currForeign: false }]
    }
    return []
  })

  const addOtherItem = useCallback(() => {
    setOtherItems(prev => [...prev, { id: String(Date.now()), description: "", amount: "", currForeign: false }])
  }, [])
  const removeOtherItem = useCallback((id: string) => {
    setOtherItems(prev => prev.filter(i => i.id !== id))
  }, [])
  const updateOtherItem = useCallback((id: string, field: keyof Omit<OtherExpenseItem, "id">, value: string | boolean) => {
    setOtherItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }, [])

  const otherItemsTotal = otherItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

  const [foreignDiet, setForeignDiet] = useState(existing?.foreignDiet != null ? String(existing.foreignDiet) : "")
  const [pocketMoneyPaid, setPocketMoneyPaid] = useState(existing?.pocketMoneyPaid != null ? String(existing.pocketMoneyPaid) : "")
  const [exchangeRate, setExchangeRate] = useState(existing?.exchangeRate != null ? String(existing.exchangeRate) : "")
  const [fuelPriceCurrForeign, setFuelPriceCurrForeign] = useState(false)
  const [taxiCurrForeign, setTaxiCurrForeign] = useState(false)
  const [parkingCurrForeign, setParkingCurrForeign] = useState(false)
  const [accommodationCurrForeign, setAccommodationCurrForeign] = useState(false)

  const dayInfos: DayInfo[] = buildDayInfos(actualDep, actualRet, dayMeals, r)
  const totalDietAmount = isForeign
    ? parseFloat(foreignDiet) || 0
    : dayInfos.reduce((s, d) => s + d.dietAmount, 0)

  function toggleMeal(date: string, field: "breakfast" | "lunch" | "dinner") {
    setDayMeals((prev) =>
      prev.map((d) => d.date === date ? { ...d, [field]: !d[field] } : d)
    )
  }

  const [advanceReceived, setAdvanceReceived] = useState(
    existing?.advanceReceived != null ? String(existing.advanceReceived) : String(order.advanceEUR ?? 0)
  )

  const [error, setError] = useState("")
  const [pendingMode, setPendingMode] = useState<"save" | "saveAndSend" | null>(null)
  const [, startTransition] = useTransition()

  const currCode = order.foreignCurrency ?? "?"
  // 1 jednotka cudzej meny = foreignExRate EUR (len pri zahraničnej ceste)
  const foreignExRate = isForeign ? 1 / (parseFloat(exchangeRate) || 1) : 1
  const applyRate = (amount: number, isF: boolean) => isF ? amount * foreignExRate : amount

  const fuelPricePerLEur = applyRate(parseFloat(fuelPricePerL) || 0, fuelPriceCurrForeign)
  const kmComp = ownVehicle && kmDriven && kmBasicRate
    ? parseFloat(kmDriven) * (parseFloat(kmBasicRate) + ((parseFloat(fuelConsumption) || 0) / 100) * fuelPricePerLEur)
    : 0

  const pubTransForeignRaw = pubTransItems.filter(i => i.currForeign).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const pubTransEurDirect = pubTransItems.filter(i => !i.currForeign).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const pubTransTotalEur = pubTransEurDirect + pubTransForeignRaw * foreignExRate

  const taxiRaw = parseFloat(taxiCost) || 0
  const taxiCostEur = applyRate(taxiRaw, taxiCurrForeign)

  const accommodationEur = applyRate(effectiveAccommodation, accommodationCurrForeign)

  const parkingRaw = parseFloat(parking) || 0
  const parkingEur = applyRate(parkingRaw, parkingCurrForeign)

  const otherForeignRaw = otherItems.filter(i => i.currForeign).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const otherEurDirect = otherItems.filter(i => !i.currForeign).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const otherItemsTotalEur = otherEurDirect + otherForeignRaw * foreignExRate

  const convertibleTotal = pubTransTotalEur + taxiCostEur + accommodationEur + parkingEur + otherItemsTotalEur

  const totalExpenses = totalDietAmount + kmComp + convertibleTotal

  const balance = totalExpenses - (parseFloat(advanceReceived) || 0)

  function buildPayload() {
    return {
      travelOrderId: order.id,
      actualDepartureAt: actualDep,
      actualReturnAt: actualRet,
      mealsPerDay: JSON.stringify(dayMeals),
      dietAmount: parseFloat(totalDietAmount.toFixed(2)),
      actualTransport: transportChanged ? actualTransport : [],
      actualVehicleCategory: (ownVehicle && transportChanged && actualVehicleCategory)
        ? actualVehicleCategory as VehicleCategory
        : undefined,
      actualVehicleRegPlate: (ownVehicle && transportChanged && actualVehicleRegPlate)
        ? actualVehicleRegPlate
        : undefined,
      actualEngineVolume: (ownVehicle && transportChanged && actualEngineVolume)
        ? parseInt(actualEngineVolume)
        : undefined,
      kmDriven: kmDriven ? parseFloat(kmDriven) : undefined,
      kmBasicRate: kmBasicRate ? parseFloat(kmBasicRate) : undefined,
      fuelConsumption: fuelConsumption ? parseFloat(fuelConsumption) : undefined,
      fuelPricePerL: fuelPricePerL ? parseFloat(fuelPricePerLEur.toFixed(4)) : undefined,
      kmCompensation: ownVehicle && kmComp ? parseFloat(kmComp.toFixed(4)) : undefined,
      publicTransportCost: pubTransTotalEur > 0 ? parseFloat(pubTransTotalEur.toFixed(2)) : undefined,
      publicTransportItems: pubTransItems.length > 0
        ? JSON.stringify(pubTransItems.map(i => ({ description: i.description, amount: parseFloat((applyRate(parseFloat(i.amount) || 0, i.currForeign)).toFixed(4)) })))
        : undefined,
      taxiCost: taxiCost ? parseFloat(taxiCostEur.toFixed(2)) : undefined,
      accommodation: accommodationEur > 0 ? parseFloat(accommodationEur.toFixed(2)) : undefined,
      accommodationItems: accommodationMode === "detailed" && accommodationItems.length > 0
        ? JSON.stringify(accommodationItems.map(i => ({
            description: i.description,
            price: parseFloat((applyRate(parseFloat(i.price) || 0, accommodationCurrForeign)).toFixed(4)),
            companyCard: parseFloat((applyRate(parseFloat(i.companyCard) || 0, accommodationCurrForeign)).toFixed(4)),
            employee: parseFloat((applyRate(parseFloat(i.employee) || 0, accommodationCurrForeign)).toFixed(4)),
          })))
        : undefined,
      parking: parking ? parseFloat(parkingEur.toFixed(2)) : undefined,
      otherExpenses: otherItemsTotalEur > 0 ? parseFloat(otherItemsTotalEur.toFixed(2)) : undefined,
      otherExpenseItems: otherItems.length > 0
        ? JSON.stringify(otherItems.map(i => ({ description: i.description, amount: parseFloat((applyRate(parseFloat(i.amount) || 0, i.currForeign)).toFixed(4)) })))
        : undefined,
      foreignDiet: isForeign && foreignDiet ? parseFloat(foreignDiet) : undefined,
      pocketMoneyPaid: isForeign && pocketMoneyPaid ? parseFloat(pocketMoneyPaid) : undefined,
      exchangeRate: isForeign && exchangeRate ? parseFloat(exchangeRate) : undefined,
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      advanceReceived: parseFloat(parseFloat(advanceReceived || "0").toFixed(2)),
    }
  }

  function doSave(submitAfter: boolean) {
    setError("")
    if (!actualDep || !actualRet) return setError("Zadajte skutočný odchod a návrat.")
    if (actualRet < actualDep) return setError("Čas návratu musí byť po odchode.")
    setPendingMode(submitAfter ? "saveAndSend" : "save")
    startTransition(async () => {
      try {
        await upsertExpenseReport(buildPayload())
        if (submitAfter) await submitExpenseReport(order.id)
        onSaved()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Nastala chyba.")
      } finally {
        setPendingMode(null)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Vyúčtovanie pracovnej cesty
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* skutočné časy */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Skutočný priebeh cesty</h3>
            <div className="grid grid-cols-2 gap-4">
              <DTInput label="Skutočný odchod" value={actualDep} onChange={setActualDep} disabled={readOnly} required />
              <DTInput label="Skutočný návrat" value={actualRet} onChange={setActualRet} disabled={readOnly} required />
            </div>
          </section>

          {/* spôsob dopravy — len výber */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Spôsob dopravy</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skutočný spôsob dopravy
                {transportChanged && (
                  <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                    (zmenené oproti príkazu: {order.transport.map((t) => transportMeansLabels[t]).join(", ")})
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_TRANSPORTS.map((t) => (
                  <label key={t} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none transition-colors ${
                    actualTransport.includes(t)
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300"
                  } ${readOnly ? "opacity-60 cursor-default" : ""}`}>
                    <input
                      type="checkbox"
                      checked={actualTransport.includes(t)}
                      onChange={() => !readOnly && toggleActualTransport(t)}
                      className="sr-only"
                    />
                    {transportMeansLabels[t]}
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* náklady na dopravu — všetky typy pohromade */}
          {actualTransport.length > 0 && (
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Náklady na dopravu</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">

                {/* vlastné vozidlo */}
                {ownVehicle && (
                  <div className="px-4 py-4 space-y-4">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Vlastné vozidlo — náhrada za km (§7 zák. 283/2002 Z.z.)
                    </p>
                    {transportChanged && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Druh vozidla</label>
                          <select
                            value={actualVehicleCategory}
                            onChange={(e) => setActualVehicleCategory(e.target.value as VehicleCategory | "")}
                            disabled={readOnly}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                          >
                            <option value="">— vybrať —</option>
                            <option value="OSOBNE_VOZIDLO">Osobné vozidlo</option>
                            <option value="JEDNOSTOPOVE">Jednostopové (motocykel)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">EČV vozidla</label>
                          <input
                            type="text"
                            value={actualVehicleRegPlate}
                            onChange={(e) => setActualVehicleRegPlate(e.target.value)}
                            disabled={readOnly}
                            placeholder="napr. BA123AB"
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                          />
                        </div>
                        <MoneyInput label="Objem motora (cm³)" value={actualEngineVolume} onChange={setActualEngineVolume} step={1} disabled={readOnly} />
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-4">
                      <MoneyInput label="Počet najazdených km" value={kmDriven} onChange={setKmDriven} step={0.1} disabled={readOnly} />
                      <MoneyInput
                        label="Základná náhrada (€/km)"
                        value={kmBasicRate}
                        onChange={setKmBasicRate}
                        step={0.001}
                        disabled={readOnly}
                        hint={`Sadzba podľa §7: ${kmRateLabel(effectiveVehicleCategory, effectiveEngineVolume, r)}`}
                      />
                      <MoneyInput label="Spotreba PHM (l/100 km)" value={fuelConsumption} onChange={setFuelConsumption} step={0.01} disabled={readOnly} />
                      <div>
                        <MoneyInput label={`Cena PHM (${isForeign && fuelPriceCurrForeign ? currCode : "EUR"}/l)`} value={fuelPricePerL} onChange={setFuelPricePerL} step={0.001} disabled={readOnly} />
                        {isForeign && <div className="mt-1"><CurrencyToggle value={fuelPriceCurrForeign} onChange={setFuelPriceCurrForeign} currCode={currCode} disabled={readOnly} /></div>}
                      </div>
                    </div>
                    {kmComp > 0 && (
                      <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-2">
                        <span className="text-sm text-blue-700 dark:text-blue-300">Náhrada za km spolu</span>
                        <span className="font-semibold text-blue-700 dark:text-blue-300">{kmComp.toFixed(2)} €</span>
                      </div>
                    )}
                  </div>
                )}

                {/* verejná doprava */}
                {actualTransport.includes("VEREJNY_TRANSPORT") && (
                  <div className="px-4 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        Verejná doprava (§8 zák. 283/2002 Z.z.)
                      </p>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={addPubTransItem}
                          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          <Plus size={13} />
                          Pridať položku
                        </button>
                      )}
                    </div>

                    {pubTransItems.length === 0 && (
                      <p className="text-xs text-gray-400 italic">
                        {readOnly ? "Žiadne položky dopravy." : "Kliknite \"Pridať položku\" pre pridanie cestovného."}
                      </p>
                    )}

                    {pubTransItems.map((item) => (
                      <div key={item.id} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updatePubTransItem(item.id, "description", e.target.value)}
                          disabled={readOnly}
                          placeholder="Vlak, autobus, MHD..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.amount}
                          onChange={(e) => updatePubTransItem(item.id, "amount", e.target.value)}
                          disabled={readOnly}
                          placeholder="0.00"
                          className="w-28 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                        />
                        {isForeign
                          ? <CurrencyToggle value={item.currForeign} onChange={(v) => updatePubTransItem(item.id, "currForeign", v)} currCode={currCode} disabled={readOnly} />
                          : <span className="text-xs text-gray-400 dark:text-gray-500 self-center shrink-0">EUR</span>
                        }
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => removePubTransItem(item.id)}
                            className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}

                    {pubTransItems.length > 0 && (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                        <span>Verejná doprava spolu</span>
                        <span className="font-medium">
                          {pubTransForeignRaw > 0 && pubTransEurDirect > 0
                            ? <>{pubTransForeignRaw.toFixed(2)} {currCode} + {pubTransEurDirect.toFixed(2)} € <span className="text-gray-400 font-normal">= {pubTransTotalEur.toFixed(2)} €</span></>
                            : pubTransForeignRaw > 0
                            ? <>{pubTransForeignRaw.toFixed(2)} {currCode} <span className="text-gray-400 font-normal">= {pubTransTotalEur.toFixed(2)} €</span></>
                            : `${pubTransTotalEur.toFixed(2)} €`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* taxi */}
                {actualTransport.includes("TAXIK") && (
                  <div className="px-4 py-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Taxi</p>
                    <div className="flex items-end gap-3">
                      <div className="flex-1 max-w-xs">
                        <MoneyInput
                          label={`Náklady na taxi (${isForeign && taxiCurrForeign ? currCode : "EUR"})`}
                          value={taxiCost}
                          onChange={setTaxiCost}
                          disabled={readOnly}
                          hint="Skutočne zaplatená suma za taxi"
                        />
                      </div>
                      {isForeign && <div className="pb-0.5"><CurrencyToggle value={taxiCurrForeign} onChange={setTaxiCurrForeign} currCode={currCode} disabled={readOnly} /></div>}
                    </div>
                  </div>
                )}

                {/* služobné vozidlo */}
                {actualTransport.includes("SLUZOBNE_VOZIDLO") && (
                  <div className="px-4 py-4">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Služobné vozidlo
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Náklady na prevádzku služobného vozidla hradí zamestnávateľ priamo — nevzniká nárok na náhradu.
                    </p>
                  </div>
                )}

              </div>
            </section>
          )}

          {/* diéty per deň */}
          {!isForeign && (
            <section className="space-y-3">
              <div className="flex items-start gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Diéty — per deň (§5 zák. 283/2002 Z.z.)
                </h3>
                <span className="text-xs text-gray-400 mt-0.5 normal-case font-normal tracking-normal">
                  Zaškrtnite stravu bezplatne poskytnutú v každý deň cesty
                </span>
              </div>

              {dayInfos.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Zadajte termín cesty vyššie.</p>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Dátum</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Hodiny / Sadzba</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500" title="Raňajky −25 %">R</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500" title="Obed −40 %">O</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500" title="Večera −35 %">V</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Diéta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {dayInfos.map((day) => (
                        <tr key={day.date} className={day.hours < 5 ? "opacity-50" : ""}>
                          <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                            {formatLocalDate(day.date)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            <span className="text-xs">
                              {day.hours.toFixed(1)} h &nbsp;·&nbsp; {tierLabel(day.hours, r)}
                            </span>
                          </td>
                          <MealCell
                            checked={day.breakfast}
                            onChange={() => toggleMeal(day.date, "breakfast")}
                            disabled={readOnly || day.hours < 5}
                            label="Raňajky −25 %"
                          />
                          <MealCell
                            checked={day.lunch}
                            onChange={() => toggleMeal(day.date, "lunch")}
                            disabled={readOnly || day.hours < 5}
                            label="Obed −40 %"
                          />
                          <MealCell
                            checked={day.dinner}
                            onChange={() => toggleMeal(day.date, "dinner")}
                            disabled={readOnly || day.hours < 5}
                            label="Večera −35 %"
                          />
                          <td className="px-3 py-2.5 text-right font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                            {day.hours < 5
                              ? <span className="text-xs text-gray-400">—</span>
                              : `${day.dietAmount.toFixed(2)} €`
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-blue-50 dark:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700">
                      <tr>
                        <td colSpan={5} className="px-3 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-300">
                          Diéty spolu
                        </td>
                        <td className="px-3 py-2.5 text-right text-base font-bold text-blue-700 dark:text-blue-300">
                          {totalDietAmount.toFixed(2)} €
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* zahraničné diéty */}
          {isForeign && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Zahraničné diéty (§13 zák. 283/2002 Z.z.)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <MoneyInput label={`Zahraničná diéta (${order.foreignCurrency ?? "cudzia mena"})`} value={foreignDiet} onChange={setForeignDiet} disabled={readOnly} />
                <MoneyInput label="Vreckové vyplatené" value={pocketMoneyPaid} onChange={setPocketMoneyPaid} disabled={readOnly} />
              </div>
            </section>
          )}

          {/* výmenný kurz */}
          {isForeign && (
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Výmenný kurz</h3>
              </div>
              <div className="px-4 py-4 flex flex-wrap items-end gap-6">
                <div className="w-52">
                  <MoneyInput label="Výmenný kurz (1 EUR = ?)" value={exchangeRate} onChange={setExchangeRate} step={0.0001} disabled={readOnly} />
                </div>
                {exchangeRate && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 self-end pb-1">
                    1 {currCode} = {(1 / (parseFloat(exchangeRate) || 1)).toFixed(4)} EUR
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ostatné výdavky */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ostatné výdavky</h3>
            {/* Ubytovanie */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ubytovanie</span>
                  {isForeign && <CurrencyToggle value={accommodationCurrForeign} onChange={setAccommodationCurrForeign} currCode={currCode} disabled={readOnly} />}
                </div>
                {!readOnly && (
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => switchAccommodationMode("simple")}
                      className={`px-3 py-1.5 transition-colors ${accommodationMode === "simple" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                    >
                      Jednoduché
                    </button>
                    <button
                      type="button"
                      onClick={() => switchAccommodationMode("detailed")}
                      className={`px-3 py-1.5 border-l border-gray-200 dark:border-gray-700 transition-colors ${accommodationMode === "detailed" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                    >
                      Podrobný rozpis
                    </button>
                  </div>
                )}
                {readOnly && accommodationMode === "detailed" && (
                  <span className="text-xs text-gray-400">Podrobný rozpis</span>
                )}
              </div>

              {accommodationMode === "simple" ? (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={accommodation}
                  onChange={(e) => setAccommodation(e.target.value)}
                  disabled={readOnly}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Hlavička tabuľky */}
                  <div className="grid grid-cols-[1fr_5rem_5rem_5rem_2rem] gap-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
                    <span className="text-xs font-medium text-gray-500">Položka</span>
                    <span className="text-xs font-medium text-gray-500 text-right">Cena ({isForeign && accommodationCurrForeign ? currCode : "EUR"})</span>
                    <span className="text-xs font-medium text-gray-500 text-right">Firemná karta ({isForeign && accommodationCurrForeign ? currCode : "EUR"})</span>
                    <span className="text-xs font-medium text-gray-500 text-right">Zamestnanec ({isForeign && accommodationCurrForeign ? currCode : "EUR"})</span>
                    <span />
                  </div>

                  {/* Riadky položiek */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {accommodationItems.length === 0 && (
                      <p className="px-3 py-3 text-xs text-gray-400 italic">
                        {readOnly ? "Žiadne položky." : "Pridajte položku nižšie."}
                      </p>
                    )}
                    {accommodationItems.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_5rem_5rem_5rem_2rem] gap-0 items-center px-3 py-2 gap-x-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateAccommodationItem(item.id, "description", e.target.value)}
                          disabled={readOnly}
                          placeholder="Hotel, noc..."
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                        />
                        <input
                          type="number" min={0} step={0.01}
                          value={item.price}
                          onChange={(e) => updateAccommodationItem(item.id, "price", e.target.value)}
                          disabled={readOnly}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 text-right"
                        />
                        <input
                          type="number" min={0} step={0.01}
                          value={item.companyCard}
                          onChange={(e) => updateAccommodationItem(item.id, "companyCard", e.target.value)}
                          disabled={readOnly}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 text-right"
                        />
                        <input
                          type="number" min={0} step={0.01}
                          value={item.employee}
                          onChange={(e) => updateAccommodationItem(item.id, "employee", e.target.value)}
                          disabled={readOnly}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 text-right"
                        />
                        {!readOnly ? (
                          <button type="button" onClick={() => removeAccommodationItem(item.id)}
                            className="flex items-center justify-center text-gray-400 hover:text-red-500 dark:hover:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        ) : <span />}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                    {!readOnly ? (
                      <button type="button" onClick={addAccommodationItem}
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                        <Plus size={12} />
                        Pridať položku
                      </button>
                    ) : <span />}
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Zamestnanec spolu:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {accommodationCurrForeign
                          ? <>{accItemsEmployeeTotal.toFixed(2)} {currCode} <span className="text-gray-400 text-xs font-normal">= {accommodationEur.toFixed(2)} €</span></>
                          : `${accommodationEur.toFixed(2)} €`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-xs">
                <MoneyInput label={`Parkovné (${isForeign && parkingCurrForeign ? currCode : "EUR"})`} value={parking} onChange={setParking} disabled={readOnly} />
              </div>
              {isForeign && <div className="pb-0.5"><CurrencyToggle value={parkingCurrForeign} onChange={setParkingCurrForeign} currCode={currCode} disabled={readOnly} /></div>}
            </div>

            {/* Iné výdavky — dynamický zoznam */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Iné výdavky</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={addOtherItem}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    <Plus size={13} />
                    Pridať položku
                  </button>
                )}
              </div>

              {otherItems.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  {readOnly ? "Žiadne iné výdavky." : "Kliknite „Pridať položku“ pre pridanie výdavku."}
                </p>
              )}

              {otherItems.map((item) => (
                <div key={item.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateOtherItem(item.id, "description", e.target.value)}
                    disabled={readOnly}
                    placeholder="Popis výdavku"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.amount}
                    onChange={(e) => updateOtherItem(item.id, "amount", e.target.value)}
                    disabled={readOnly}
                    placeholder="0.00"
                    className="w-28 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                  {isForeign
                    ? <CurrencyToggle value={item.currForeign} onChange={(v) => updateOtherItem(item.id, "currForeign", v)} currCode={currCode} disabled={readOnly} />
                    : <span className="text-xs text-gray-400 dark:text-gray-500 self-center shrink-0">EUR</span>
                  }
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => removeOtherItem(item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}

              {otherItems.length > 0 && (
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                  <span>Iné výdavky spolu</span>
                  <span className="font-medium">
                    {otherForeignRaw > 0 && otherEurDirect > 0
                      ? <>{otherForeignRaw.toFixed(2)} {currCode} + {otherEurDirect.toFixed(2)} € <span className="text-gray-400 font-normal">= {otherItemsTotalEur.toFixed(2)} €</span></>
                      : otherForeignRaw > 0
                      ? <>{otherForeignRaw.toFixed(2)} {currCode} <span className="text-gray-400 font-normal">= {otherItemsTotalEur.toFixed(2)} €</span></>
                      : `${otherItemsTotalEur.toFixed(2)} €`}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* rekapitulácia */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Rekapitulácia</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-1.5 text-sm">
              {isForeign && exchangeRate && (
                <p className="text-xs text-gray-400 dark:text-gray-500 pb-1">
                  Výmenný kurz: 1 EUR = {exchangeRate} {currCode}
                </p>
              )}
              <SummaryRow label="Diéty" eurTotal={totalDietAmount} />
              {ownVehicle && <SummaryRow label="Náhrada za km" eurTotal={kmComp} />}
              <SummaryRow label="Verejná doprava" eurTotal={pubTransTotalEur} foreignRaw={pubTransForeignRaw > 0 ? pubTransForeignRaw : undefined} eurDirect={pubTransEurDirect > 0 ? pubTransEurDirect : undefined} curr={currCode} />
              <SummaryRow label="Taxi" eurTotal={taxiCostEur} foreignRaw={taxiCurrForeign ? taxiRaw : undefined} curr={currCode} />
              <SummaryRow label="Ubytovanie" eurTotal={accommodationEur} foreignRaw={accommodationCurrForeign ? effectiveAccommodation : undefined} curr={currCode} />
              <SummaryRow label="Parkovné" eurTotal={parkingEur} foreignRaw={parkingCurrForeign ? parkingRaw : undefined} curr={currCode} />
              <SummaryRow label="Iné výdavky" eurTotal={otherItemsTotalEur} foreignRaw={otherForeignRaw > 0 ? otherForeignRaw : undefined} eurDirect={otherEurDirect > 0 ? otherEurDirect : undefined} curr={currCode} />
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Celkové výdavky</span>
                <span className="text-gray-900 dark:text-white">{totalExpenses.toFixed(2)} €</span>
              </div>
            </div>

            <MoneyInput label="Preddavok prijatý (€)" value={advanceReceived} onChange={setAdvanceReceived} disabled={readOnly} />

            <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${
              balance > 0.005 ? "bg-green-50 dark:bg-green-900/20"
              : balance < -0.005 ? "bg-red-50 dark:bg-red-900/20"
              : "bg-gray-50 dark:bg-gray-800"
            }`}>
              <span className={`text-sm font-medium ${
                balance > 0.005 ? "text-green-700 dark:text-green-400"
                : balance < -0.005 ? "text-red-700 dark:text-red-400"
                : "text-gray-600 dark:text-gray-300"
              }`}>
                {balance > 0.005 ? "Zamestnávateľ doplácá" : balance < -0.005 ? "Zamestnanec vracia" : "Vyrovnané"}
              </span>
              <span className={`text-lg font-bold ${
                balance > 0.005 ? "text-green-700 dark:text-green-400"
                : balance < -0.005 ? "text-red-700 dark:text-red-400"
                : "text-gray-600"
              }`}>
                {Math.abs(balance).toFixed(2)} €
              </span>
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={pendingMode !== null}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
          >
            {readOnly ? "Zatvoriť" : "Zrušiť"}
          </button>
          {!readOnly && (
            <>
              <button
                onClick={() => doSave(true)}
                disabled={pendingMode !== null}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {pendingMode === "saveAndSend" && <Loader2 size={14} className="animate-spin" />}
                Uložiť a odoslať
              </button>
              <button
                onClick={() => doSave(false)}
                disabled={pendingMode !== null}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {pendingMode === "save" && <Loader2 size={14} className="animate-spin" />}
                Uložiť vyúčtovanie
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── sub-components ────────────────────────────────────────────────────────────

function MealCell({ checked, onChange, disabled, label }: {
  checked: boolean; onChange: () => void; disabled: boolean; label: string
}) {
  return (
    <td className="px-3 py-2.5 text-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        title={label}
        className="w-4 h-4 rounded border-gray-300 cursor-pointer disabled:cursor-default"
      />
    </td>
  )
}

function DTInput({ label, value, onChange, disabled, required }: {
  label: string; value: string; onChange: (v: string) => void; disabled: boolean; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
    </div>
  )
}

function MoneyInput({ label, value, onChange, step = 0.01, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void; step?: number; disabled: boolean; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)}
        disabled={disabled} placeholder="0.00"
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function SummaryRow({ label, eurTotal, foreignRaw, eurDirect, curr }: {
  label: string; eurTotal: number; foreignRaw?: number; eurDirect?: number; curr?: string
}) {
  if (eurTotal === 0 && (!foreignRaw || foreignRaw === 0)) return null
  const hasForeign = (foreignRaw ?? 0) > 0 && curr
  const hasEurDirect = (eurDirect ?? 0) > 0
  return (
    <div className="flex justify-between text-gray-600 dark:text-gray-400">
      <span>{label}</span>
      <span className="text-right">
        {hasForeign && hasEurDirect ? (
          <>
            <span className="text-xs">{foreignRaw!.toFixed(2)} {curr} + {eurDirect!.toFixed(2)} €</span>
            {" "}<span className="text-gray-400 dark:text-gray-500 text-xs">= {eurTotal.toFixed(2)} €</span>
          </>
        ) : hasForeign ? (
          <>
            {foreignRaw!.toFixed(2)} <span className="text-xs">{curr}</span>
            {" "}<span className="text-gray-400 dark:text-gray-500 text-xs">= {eurTotal.toFixed(2)} €</span>
          </>
        ) : (
          `${eurTotal.toFixed(2)} €`
        )}
      </span>
    </div>
  )
}

function CurrencyToggle({ value, onChange, currCode, disabled }: {
  value: boolean; onChange: (v: boolean) => void; currCode: string; disabled?: boolean
}) {
  return (
    <div className="flex rounded border border-gray-200 dark:border-gray-700 text-xs overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={`px-2 py-1.5 transition-colors ${!value ? "bg-blue-600 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
      >EUR</button>
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={`px-2 py-1.5 border-l border-gray-200 dark:border-gray-700 transition-colors ${value ? "bg-blue-600 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
      >{currCode}</button>
    </div>
  )
}
