"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2 } from "lucide-react"
import { createAsset } from "./actions"
import {
  assetTypeLabels,
  brandLabels,
  usagePlaceLabels,
  assetKindLabels,
} from "@/lib/labels"
import { AssetType, Brand, UsagePlace, AssetKind } from "@/generated/prisma/enums"

interface Props {
  onClose: () => void
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  )
}

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

const currentYear = new Date().getFullYear()

export default function NewAssetModal({ onClose }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setPending(true)
    setError("")

    const result = await createAsset(new FormData(formRef.current))

    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nový majetok</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Section: Identifikácia */}
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                Identifikácia
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Typ" required>
                  <select name="type" required className={inputCls} defaultValue="">
                    <option value="" disabled>— vybrať —</option>
                    {(Object.keys(assetTypeLabels) as AssetType[]).map((k) => (
                      <option key={k} value={k}>{assetTypeLabels[k]}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Značka">
                  <select name="brand" className={inputCls} defaultValue="Neurcena">
                    {(Object.keys(brandLabels) as Brand[]).map((k) => (
                      <option key={k} value={k}>{brandLabels[k]}</option>
                    ))}
                  </select>
                </Field>

                <div className="col-span-2">
                  <Field label="Názov / Popis" required>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder='napr. MacBook Pro 14" M3'
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="col-span-2">
                  <Field label="Výrobné číslo (sériové)" hint="Nesmie obsahovať medzery (napr. SN-2024-00123)">
                    <input
                      type="text"
                      name="serialNumber"
                      placeholder="napr. SN-2024-00123"
                      pattern="[^\s]+"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Section: Klasifikácia */}
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                Klasifikácia
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Druh majetku" required>
                  <select name="kind" required className={inputCls} defaultValue="">
                    <option value="" disabled>— vybrať —</option>
                    {(Object.keys(assetKindLabels) as AssetKind[]).map((k) => (
                      <option key={k} value={k}>{assetKindLabels[k]}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Miesto použitia" required>
                  <select name="usagePlace" required className={inputCls} defaultValue="">
                    <option value="" disabled>— vybrať —</option>
                    {(Object.keys(usagePlaceLabels) as UsagePlace[]).map((k) => (
                      <option key={k} value={k}>{usagePlaceLabels[k]}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Rok výroby" hint={`Rok výroby v rozsahu 1900 – ${currentYear + 1}`}>
                  <input
                    type="number"
                    name="yearOfManufacture"
                    min={1900}
                    max={currentYear + 1}
                    placeholder={String(currentYear)}
                    className={inputCls}
                  />
                </Field>

                <Field label="Dátum nadobudnutia">
                  <input
                    type="date"
                    name="acquisitionDate"
                    className={inputCls}
                  />
                </Field>

                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input type="checkbox" name="isSecurity" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bezpečnostný</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section: Poznámky */}
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                Poznámky
              </p>
              <div className="space-y-3">
                <Field label="Verejná poznámka">
                  <textarea
                    name="publicNote"
                    rows={2}
                    placeholder="Viditeľná pre všetkých"
                    maxLength={1000}
                    className={inputCls}
                  />
                </Field>
                <Field label="Evidenčná poznámka">
                  <textarea
                    name="recordNote"
                    rows={2}
                    placeholder="Interná poznámka (nie pre BP)"
                    maxLength={1000}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Polia označené <span className="text-red-500">*</span> sú povinné
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Zrušiť
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {pending ? "Ukladám..." : "Uložiť"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
