"use client"

import { useState, useTransition } from "react"
import { X, Loader2 } from "lucide-react"
import { createTravelOrder, submitTravelOrder } from "./actions"
import type { TravelOrderType, TransportMeans, VehicleCategory } from "@/generated/prisma/enums"
import { transportMeansLabels } from "@/lib/labels"

interface Props {
  type: TravelOrderType
  supervisors: { id: number; firstName: string; lastName: string }[]
  onClose: () => void
  onCreated: () => void
  // pre edit mode
  initial?: InitialValues
  orderId?: number
  onUpdated?: () => void
}

export type InitialValues = {
  purpose: string
  startLocation: string
  destination: string
  departureAt: string
  returnAt: string
  transport: TransportMeans[]
  vehicleCategory: VehicleCategory | ""
  vehicleRegPlate: string
  engineVolume: string
  advanceEUR: string
  countries: string
  advanceForeign: string
  foreignCurrency: string
  pocketMoney: string
  travelInsurance: boolean
  supervisorId: string
}

const ALL_TRANSPORTS: TransportMeans[] = [
  "VLASTNE_VOZIDLO",
  "VEREJNY_TRANSPORT",
  "SLUZOBNE_VOZIDLO",
  "TAXIK",
  "INE",
]

export default function NewTravelOrderModal({ type, supervisors, onClose, onCreated, initial, orderId, onUpdated }: Props) {
  const isEdit = !!orderId
  const isForeign = type === "ZAHRANICNY"

  const [form, setForm] = useState<InitialValues>(initial ?? {
    purpose: "",
    startLocation: "",
    destination: "",
    departureAt: "",
    returnAt: "",
    transport: ["VEREJNY_TRANSPORT"],
    vehicleCategory: "",
    vehicleRegPlate: "",
    engineVolume: "",
    advanceEUR: "",
    countries: "",
    advanceForeign: "",
    foreignCurrency: "EUR",
    pocketMoney: "",
    travelInsurance: false,
    supervisorId: "",
  })

  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const [pendingMode, setPendingMode] = useState<"save" | "saveAndSend" | null>(null)

  function set(field: keyof InitialValues, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function validate(): boolean {
    if (!form.purpose.trim()) { setError("Zadajte účel pracovnej cesty."); return false }
    if (!form.startLocation.trim()) { setError("Zadajte miesto odchodu."); return false }
    if (!form.destination.trim()) { setError("Zadajte cieľ cesty."); return false }
    if (!form.departureAt) { setError("Zadajte dátum odchodu."); return false }
    if (!form.returnAt) { setError("Zadajte dátum návratu."); return false }
    if (new Date(form.returnAt) < new Date(form.departureAt)) {
      setError("Dátum návratu nesmie byť pred dátumom odchodu."); return false
    }
    if (form.transport.length === 0) { setError("Vyberte aspoň jeden dopravný prostriedok."); return false }
    return true
  }

  function toggleTransport(t: TransportMeans) {
    setForm((prev) => {
      const has = prev.transport.includes(t)
      const next = has ? prev.transport.filter((x) => x !== t) : [...prev.transport, t]
      return { ...prev, transport: next }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!validate()) return
    doSave(false)
  }

  function doSave(submitAfter: boolean) {
    setPendingMode(submitAfter ? "saveAndSend" : "save")
    startTransition(async () => {
      try {
        const payload = {
          purpose: form.purpose.trim(),
          startLocation: form.startLocation.trim(),
          destination: form.destination.trim(),
          departureAt: form.departureAt,
          returnAt: form.returnAt,
          transport: form.transport,
          vehicleCategory: form.vehicleCategory || undefined,
          vehicleRegPlate: form.vehicleRegPlate.trim() || undefined,
          engineVolume: form.engineVolume ? parseInt(form.engineVolume) : undefined,
          advanceEUR: form.advanceEUR ? parseFloat(form.advanceEUR) : undefined,
          countries: isForeign ? form.countries.trim() || undefined : undefined,
          advanceForeign: isForeign && form.advanceForeign ? parseFloat(form.advanceForeign) : undefined,
          foreignCurrency: isForeign ? form.foreignCurrency.trim() || undefined : undefined,
          pocketMoney: isForeign && form.pocketMoney ? parseFloat(form.pocketMoney) : undefined,
          travelInsurance: isForeign ? form.travelInsurance : false,
          supervisorId: form.supervisorId ? parseInt(form.supervisorId) : undefined,
        }

        if (isEdit && onUpdated) {
          const { updateTravelOrder } = await import("./actions")
          await updateTravelOrder(orderId!, payload)
          if (submitAfter) await submitTravelOrder(orderId!)
          onUpdated()
        } else {
          const { id } = await createTravelOrder({ type, ...payload })
          if (submitAfter) await submitTravelOrder(id)
          onCreated()
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Nastala chyba.")
      } finally {
        setPendingMode(null)
      }
    })
  }

  const ownVehicle = form.transport.includes("VLASTNE_VOZIDLO")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {isEdit ? "Upraviť príkaz" : isForeign ? "Nový zahraničný cestovný príkaz" : "Nový tuzemský cestovný príkaz"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* základné údaje */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Základné údaje</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Účel pracovnej cesty <span className="text-red-500">*</span>
              </label>
              <input
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
                maxLength={300}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Miesto odchodu <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.startLocation}
                  onChange={(e) => set("startLocation", e.target.value)}
                  placeholder="Napr. Bratislava"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cieľ cesty <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value)}
                  placeholder="Napr. Košice"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {isForeign && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Navštívené krajiny
                </label>
                <input
                  value={form.countries}
                  onChange={(e) => set("countries", e.target.value)}
                  placeholder="Napr. Česká republika, Rakúsko"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dátum a čas odchodu <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.departureAt}
                  onChange={(e) => set("departureAt", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dátum a čas návratu <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.returnAt}
                  onChange={(e) => set("returnAt", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          {/* doprava */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dopravný prostriedok</h3>
            <div className="flex flex-wrap gap-3">
              {ALL_TRANSPORTS.map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300 select-none">
                  <input
                    type="checkbox"
                    checked={form.transport.includes(t)}
                    onChange={() => toggleTransport(t)}
                    className="w-4 h-4 rounded border-gray-300 accent-blue-600"
                  />
                  {transportMeansLabels[t]}
                </label>
              ))}
            </div>

            {ownVehicle && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Druh vozidla <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    {(["OSOBNE_VOZIDLO", "JEDNOSTOPOVE"] as VehicleCategory[]).map((cat) => (
                      <label key={cat} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="radio"
                          name="vehicleCategory"
                          value={cat}
                          checked={form.vehicleCategory === cat}
                          onChange={() => set("vehicleCategory", cat)}
                          className="accent-blue-600"
                        />
                        {cat === "OSOBNE_VOZIDLO" ? "Osobné vozidlo" : "Jednostopové vozidlo (motocykel)"}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">EČV vozidla</label>
                    <input
                      value={form.vehicleRegPlate}
                      onChange={(e) => set("vehicleRegPlate", e.target.value)}
                      placeholder="Napr. BA123AB"
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Zdvihový objem motora (cm³){form.vehicleCategory === "OSOBNE_VOZIDLO" && " *"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.engineVolume}
                      onChange={(e) => set("engineVolume", e.target.value)}
                      placeholder="Napr. 1598"
                      disabled={form.vehicleCategory === "JEDNOSTOPOVE"}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* preddavok */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Preddavok</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preddavok v EUR
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.advanceEUR}
                  onChange={(e) => set("advanceEUR", e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {isForeign && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Preddavok v cudzej mene
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.advanceForeign}
                        onChange={(e) => set("advanceForeign", e.target.value)}
                        placeholder="0.00"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        value={form.foreignCurrency}
                        onChange={(e) => set("foreignCurrency", e.target.value)}
                        placeholder="CZK"
                        maxLength={3}
                        className="w-16 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {isForeign && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Vreckové (max 40 % zahraničnej diéty)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.pocketMoney}
                    onChange={(e) => set("pocketMoney", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="travelInsurance"
                    checked={form.travelInsurance}
                    onChange={(e) => set("travelInsurance", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <label htmlFor="travelInsurance" className="text-sm text-gray-700 dark:text-gray-300">
                    Zabezpečené cestovné poistenie
                  </label>
                </div>
              </div>
            )}
          </section>

          {/* nadriadený */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Schvaľovanie</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nadriadený (schvaľuje 1.)
              </label>
              <select
                value={form.supervisorId}
                onChange={(e) => set("supervisorId", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— vybrať nadriadeného —</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Správca pracovných ciest schvaľuje automaticky ako druhý v poradí.
              </p>
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}
        </form>

        {/* footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pendingMode !== null}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            Zrušiť
          </button>
          <button
            type="button"
            onClick={() => { setError(""); if (validate()) doSave(true) }}
            disabled={pendingMode !== null}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {pendingMode === "saveAndSend" && <Loader2 size={14} className="animate-spin" />}
            Uložiť a odoslať
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={pendingMode !== null}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {pendingMode === "save" && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Uložiť zmeny" : "Vytvoriť príkaz"}
          </button>
        </div>
      </div>
    </div>
  )
}
