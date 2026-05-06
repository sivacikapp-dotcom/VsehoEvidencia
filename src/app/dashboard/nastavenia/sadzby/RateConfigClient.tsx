"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { createRateConfig, deleteRateConfig } from "./actions"
import type { TravelRates } from "@/lib/travelUtils"

type RateConfigRow = {
  id: number
  validFrom: string
  diet5to12: number
  diet12to18: number
  dietOver18: number
  breakfastPct: number
  lunchPct: number
  dinnerPct: number
  kmJednostopove: number
  kmOsobneDoLimit: number
  kmOsobneNadLimit: number
  kmEngineLimit: number
  createdAt: string
  createdBy: string | null
}

interface Props {
  configs: RateConfigRow[]
  defaultRates: TravelRates
}

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isActive(validFrom: string, configs: RateConfigRow[]): boolean {
  const today = todayStr()
  // Find the latest config with validFrom <= today
  const active = configs
    .filter(c => c.validFrom <= today)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
  return active?.validFrom === validFrom
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

function RateField({
  label, value, onChange, step = 0.001, unit, disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  step?: number
  unit?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
        {unit && <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

function RatesDisplay({ c }: { c: RateConfigRow }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Diéty</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">5–12 h</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{c.diet5to12.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">12–18 h</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{c.diet12to18.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">nad 18 h</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{c.dietOver18.toFixed(2)} €</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Odpočty za stravu</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Raňajky</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{c.breakfastPct} %</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Obed</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{c.lunchPct} %</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Večera</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{c.dinnerPct} %</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Sadzby za km</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Jednostopové</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{c.kmJednostopove.toFixed(3)} €/km</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Os. do {c.kmEngineLimit} cm³</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{c.kmOsobneDoLimit.toFixed(3)} €/km</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Os. nad {c.kmEngineLimit} cm³</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{c.kmOsobneNadLimit.toFixed(3)} €/km</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RateConfigClient({ configs, defaultRates }: Props) {
  const today = todayStr()

  // Find the active config (latest with validFrom <= today)
  const activeConfig = configs
    .filter(c => c.validFrom <= today)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null

  const prefill = activeConfig ?? {
    validFrom: today,
    diet5to12: defaultRates.diet5to12,
    diet12to18: defaultRates.diet12to18,
    dietOver18: defaultRates.dietOver18,
    breakfastPct: defaultRates.breakfastPct,
    lunchPct: defaultRates.lunchPct,
    dinnerPct: defaultRates.dinnerPct,
    kmJednostopove: defaultRates.kmJednostopove,
    kmOsobneDoLimit: defaultRates.kmOsobneDoLimit,
    kmOsobneNadLimit: defaultRates.kmOsobneNadLimit,
    kmEngineLimit: defaultRates.kmEngineLimit,
  }

  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  // Form state
  const [validFrom, setValidFrom] = useState(today)
  const [diet5to12, setDiet5to12] = useState(String(prefill.diet5to12))
  const [diet12to18, setDiet12to18] = useState(String(prefill.diet12to18))
  const [dietOver18, setDietOver18] = useState(String(prefill.dietOver18))
  const [breakfastPct, setBreakfastPct] = useState(String(prefill.breakfastPct))
  const [lunchPct, setLunchPct] = useState(String(prefill.lunchPct))
  const [dinnerPct, setDinnerPct] = useState(String(prefill.dinnerPct))
  const [kmJednostopove, setKmJednostopove] = useState(String(prefill.kmJednostopove))
  const [kmOsobneDoLimit, setKmOsobneDoLimit] = useState(String(prefill.kmOsobneDoLimit))
  const [kmOsobneNadLimit, setKmOsobneNadLimit] = useState(String(prefill.kmOsobneNadLimit))
  const [kmEngineLimit, setKmEngineLimit] = useState(String(prefill.kmEngineLimit))
  const [submitting, setSubmitting] = useState(false)

  function resetForm() {
    setValidFrom(today)
    setDiet5to12(String(prefill.diet5to12))
    setDiet12to18(String(prefill.diet12to18))
    setDietOver18(String(prefill.dietOver18))
    setBreakfastPct(String(prefill.breakfastPct))
    setLunchPct(String(prefill.lunchPct))
    setDinnerPct(String(prefill.dinnerPct))
    setKmJednostopove(String(prefill.kmJednostopove))
    setKmOsobneDoLimit(String(prefill.kmOsobneDoLimit))
    setKmOsobneNadLimit(String(prefill.kmOsobneNadLimit))
    setKmEngineLimit(String(prefill.kmEngineLimit))
    setFormError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")
    if (!validFrom) { setFormError("Zadajte dátum platnosti."); return }

    setSubmitting(true)
    try {
      await createRateConfig({
        validFrom,
        diet5to12: parseFloat(diet5to12),
        diet12to18: parseFloat(diet12to18),
        dietOver18: parseFloat(dietOver18),
        breakfastPct: parseFloat(breakfastPct),
        lunchPct: parseFloat(lunchPct),
        dinnerPct: parseFloat(dinnerPct),
        kmJednostopove: parseFloat(kmJednostopove),
        kmOsobneDoLimit: parseFloat(kmOsobneDoLimit),
        kmOsobneNadLimit: parseFloat(kmOsobneNadLimit),
        kmEngineLimit: parseInt(kmEngineLimit),
      })
      setShowForm(false)
      resetForm()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Nastala chyba.")
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete(id: number) {
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deleteRateConfig(id)
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Nastala chyba pri mazaní.")
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Nastavenia sadzieb pracovných ciest
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Sadzby diét a náhrad za km podľa zák. 283/2002 Z.z.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); if (!showForm) resetForm() }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <ChevronUp size={15} /> : <Plus size={15} />}
          {showForm ? "Zatvoriť formulár" : "Pridať nové sadzby"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nové sadzby</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Valid from */}
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Platnosť od <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={e => setValidFrom(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Diéty */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Diéty (§5 zák. 283/2002 Z.z.)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <RateField label="Sadzba 1 (5–12 h)" value={diet5to12} onChange={setDiet5to12} step={0.01} unit="€" />
                <RateField label="Sadzba 2 (12–18 h)" value={diet12to18} onChange={setDiet12to18} step={0.01} unit="€" />
                <RateField label="Sadzba 3 (nad 18 h)" value={dietOver18} onChange={setDietOver18} step={0.01} unit="€" />
              </div>
            </div>

            {/* Odpočty za stravu */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Odpočty za bezplatnú stravu (% z dennej diéty)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <RateField label="Raňajky" value={breakfastPct} onChange={setBreakfastPct} step={1} unit="%" />
                <RateField label="Obed" value={lunchPct} onChange={setLunchPct} step={1} unit="%" />
                <RateField label="Večera" value={dinnerPct} onChange={setDinnerPct} step={1} unit="%" />
              </div>
            </div>

            {/* Náhrada za km */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Náhrada za km (§7 zák. 283/2002 Z.z.)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RateField label="Jednostopové vozidlo" value={kmJednostopove} onChange={setKmJednostopove} step={0.001} unit="€/km" />
                <RateField label={`Osobné do ${kmEngineLimit} cm³`} value={kmOsobneDoLimit} onChange={setKmOsobneDoLimit} step={0.001} unit="€/km" />
                <RateField label={`Osobné nad ${kmEngineLimit} cm³`} value={kmOsobneNadLimit} onChange={setKmOsobneNadLimit} step={0.001} unit="€/km" />
                <RateField label="Hranica objemu motora" value={kmEngineLimit} onChange={setKmEngineLimit} step={1} unit="cm³" />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{formError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm() }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Zrušiť
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Uložiť sadzby
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active rates card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            Aktuálne platné sadzby
          </h2>
          {activeConfig && (
            <span className="text-xs text-blue-600 dark:text-blue-400">
              platné od {fmtDate(activeConfig.validFrom)}
            </span>
          )}
          {!activeConfig && (
            <span className="text-xs text-gray-500 italic">Žiadna konfigurácia — používajú sa zákonné predvolené hodnoty</span>
          )}
        </div>
        <div className="p-5">
          <RatesDisplay c={activeConfig ?? {
            id: 0,
            validFrom: today,
            diet5to12: defaultRates.diet5to12,
            diet12to18: defaultRates.diet12to18,
            dietOver18: defaultRates.dietOver18,
            breakfastPct: defaultRates.breakfastPct,
            lunchPct: defaultRates.lunchPct,
            dinnerPct: defaultRates.dinnerPct,
            kmJednostopove: defaultRates.kmJednostopove,
            kmOsobneDoLimit: defaultRates.kmOsobneDoLimit,
            kmOsobneNadLimit: defaultRates.kmOsobneNadLimit,
            kmEngineLimit: defaultRates.kmEngineLimit,
            createdAt: new Date().toISOString(),
            createdBy: null,
          }} />
        </div>
      </div>

      {/* History table */}
      {configs.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">História sadzieb</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Platné od</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Diéty (5–12 / 12–18 / +18 h)</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">km sadzby (jed. / do / nad)</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Zadal</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Stav</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {configs.map(c => {
                  const active = isActive(c.validFrom, configs)
                  const isFuture = c.validFrom > today
                  return (
                    <tr key={c.id} className={active ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                        {fmtDate(c.validFrom)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                        {c.diet5to12.toFixed(2)} / {c.diet12to18.toFixed(2)} / {c.dietOver18.toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                        {c.kmJednostopove.toFixed(3)} / {c.kmOsobneDoLimit.toFixed(3)} / {c.kmOsobneNadLimit.toFixed(3)} €/km
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {c.createdBy ?? "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {active && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Aktuálne platné
                          </span>
                        )}
                        {isFuture && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Budúce
                          </span>
                        )}
                        {!active && !isFuture && (
                          <span className="text-xs text-gray-400">Historické</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(isFuture || configs.length > 1) && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deletingId === c.id || active}
                            title={active ? "Aktuálnu konfiguráciu nie je možné zmazať" : "Zmazať"}
                            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {deletingId === c.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {configs.length === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-4">
          Žiadne záznamy. Kliknite „Pridať nové sadzby" pre vytvorenie prvej konfigurácie.
        </p>
      )}
    </div>
  )
}
