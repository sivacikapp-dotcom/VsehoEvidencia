"use client"

import { Printer, ArrowLeft, AlertTriangle } from "lucide-react"
import type { Role } from "@/generated/prisma/enums"

const roleLabel: Record<Role, string> = {
  PRIJEMCA: "Príjemca",
  NADRIADENY: "Nadriadený",
  BEZPECNOSTNY_PRACOVNIK: "Bezp. pracovník",
  SPRAVCA_KARIET: "Správca kariet",
  SPRAVCA_PC: "Správca PC",
  SPRAVCA_ROLI: "Správca rolí",
  SPRAVCA_APLIKACIE: "Správca aplikácie",
}

interface Asset {
  id: number
  type: string
  name: string
  brand: string
  serialNumber: string | null
  yearOfManufacture: number | null
  kind: string
  usagePlace: string
  functionStatus: string
  acquisitionDate: string | null
  assignedAt: string
  assignedBy: string
}

interface Props {
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
    roles: Role[]
  }
  assets: Asset[]
  generatedAt: string
}

function Cell({ value }: { value: string | number | null | undefined }) {
  return <td className="px-3 py-2 text-sm text-gray-900 border-b border-gray-100">{value ?? "—"}</td>
}

export default function OdovzdanieProtocolPrint({ user, assets, generatedAt }: Props) {
  const docNumber = `VE-OD-${user.id.toString().padStart(5, "0")}-${generatedAt.replace(/-/g, "")}`

  return (
    <>
      {/* Toolbar – hidden on print */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={15} />
          Zavrieť
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <AlertTriangle size={13} />
            Vytlačením sa stav majetku v evidencii nemení — vrátenie je potrebné potvrdiť manuálne.
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Printer size={15} />
            Tlačiť / Uložiť PDF
          </button>
        </div>
      </div>

      {/* Protocol document */}
      <div className="min-h-screen bg-gray-100 print:bg-white pt-16 print:pt-0">
        <div className="max-w-4xl mx-auto bg-white print:max-w-none print:mx-0 shadow-sm print:shadow-none p-10 print:p-8 my-6 print:my-0">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-900">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                VšehoEvidencia
              </p>
              <h1 className="text-xl font-bold text-gray-900 mt-1 leading-tight">
                ODOVZDÁVACÍ PROTOKOL
                <br />
                MAJETKU
              </h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Číslo dokumentu</p>
              <p className="font-mono text-sm font-semibold text-gray-900">{docNumber}</p>
              <p className="text-xs text-gray-500 mt-3 mb-1">Dátum vytvorenia</p>
              <p className="text-sm text-gray-900">{generatedAt}</p>
            </div>
          </div>

          {/* Notice box – visible on print */}
          <div className="mb-6 border border-gray-300 rounded px-4 py-3 print:border-gray-400">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Upozornenie</p>
            <p className="text-sm text-gray-700">
              Tento protokol slúži na fyzické odovzdanie majetku. Stav majetku v evidenčnom systéme sa mení až po manuálnom potvrdení správcom kariet.
            </p>
          </div>

          {/* User info */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Odovzdávajúca osoba
            </h2>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-6 text-sm font-medium text-gray-500 w-48 align-top">Meno a priezvisko</td>
                  <td className="py-2 text-sm text-gray-900 font-medium">{user.lastName} {user.firstName}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-6 text-sm font-medium text-gray-500 w-48 align-top">Email</td>
                  <td className="py-2 text-sm text-gray-900">{user.email}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-6 text-sm font-medium text-gray-500 w-48 align-top">Rola</td>
                  <td className="py-2 text-sm text-gray-900">{user.roles.map(r => roleLabel[r]).join(", ")}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-6 text-sm font-medium text-gray-500 w-48 align-top">Počet odovzdávaných kusov</td>
                  <td className="py-2 text-sm text-gray-900 font-semibold">{assets.length}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Assets table */}
          <div className="mb-10">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Odovzdávaný majetok
            </h2>
            {assets.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">Žiadny majetok na odovzdanie.</p>
            ) : (
              <table className="w-full border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 w-8">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Typ</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Popis / Názov</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Výrobca</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Výr. číslo</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Stav</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">Pridelené od</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a, i) => (
                    <tr key={a.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100">{i + 1}</td>
                      <Cell value={a.type} />
                      <td className="px-3 py-2 text-sm text-gray-900 border-b border-gray-100">
                        <div className="font-medium">{a.name}</div>
                      </td>
                      <Cell value={a.brand} />
                      <td className="px-3 py-2 text-sm text-gray-900 border-b border-gray-100">
                        {a.serialNumber ? <span className="font-mono text-xs">{a.serialNumber}</span> : "—"}
                      </td>
                      <Cell value={a.functionStatus} />
                      <Cell value={a.assignedAt} />
                      <td className="px-3 py-2 text-center border-b border-gray-100">
                        <div className="w-5 h-5 border border-gray-400 rounded mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Signature block */}
          <div className="border-t-2 border-gray-200 pt-8">
            <p className="text-sm text-gray-600 mb-8">
              Podpisom potvrdzujem fyzické odovzdanie vyššie uvedeného majetku. Stav majetku v evidenčnom systéme bude aktualizovaný správcom kariet.
            </p>
            <div className="grid grid-cols-2 gap-12">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-6">
                  Preberajúci (Správca kariet)
                </p>
                <div className="border-b border-gray-400 mb-2 h-10" />
                <p className="text-xs text-gray-400">Podpis a pečiatka</p>
                <div className="mt-4">
                  <div className="border-b border-gray-400 mb-2 h-8" />
                  <p className="text-xs text-gray-400">Meno a priezvisko</p>
                </div>
                <div className="mt-4">
                  <div className="border-b border-gray-400 mb-2 h-8" />
                  <p className="text-xs text-gray-400">Dátum</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-6">
                  Odovzdávajúci
                </p>
                <div className="border-b border-gray-400 mb-2 h-10" />
                <p className="text-xs text-gray-400">Podpis</p>
                <div className="mt-4">
                  <div className="border-b border-gray-400 mb-2 h-8" />
                  <p className="text-xs text-gray-400">Meno a priezvisko</p>
                </div>
                <div className="mt-4">
                  <div className="border-b border-gray-400 mb-2 h-8" />
                  <p className="text-xs text-gray-400">Dátum</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center mt-10 print:mt-16">
              Dokument vygenerovaný systémom VšehoEvidencia · {generatedAt} · Vytlačením sa stav v evidencii nemení.
            </p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
