"use client"

import { Printer, ArrowLeft } from "lucide-react"

interface Props {
  asset: {
    id: number
    type: string
    name: string
    brand: string
    serialNumber: string | null
    usagePlace: string
    yearOfManufacture: number | null
    functionStatus: string
    kind: string
    acquisitionDate: string | null
  }
  assignment: {
    recipientName: string
    recipientEmail: string
    assignedAt: string
    assignedBy: string
    note: string | null
  } | null
  generatedAt: string
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-6 text-sm font-medium text-gray-500 w-48 align-top">{label}</td>
      <td className="py-2 text-sm text-gray-900">{value ?? "—"}</td>
    </tr>
  )
}

export default function ProtocolPrint({ asset, assignment, generatedAt }: Props) {
  const docNumber = `VE-${asset.id.toString().padStart(5, "0")}-${generatedAt.replace(/-/g, "")}`

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
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Printer size={15} />
          Tlačiť / Uložiť PDF
        </button>
      </div>

      {/* Protocol document */}
      <div className="min-h-screen bg-gray-100 print:bg-white pt-16 print:pt-0">
        <div className="max-w-2xl mx-auto bg-white print:max-w-none print:mx-0 shadow-sm print:shadow-none p-10 print:p-8 my-6 print:my-0">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-900">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                VšehoEvidencia
              </p>
              <h1 className="text-xl font-bold text-gray-900 mt-1 leading-tight">
                PROTOKOL O ODOVZDANÍ
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

          {/* Asset details */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Údaje o majetku
            </h2>
            <table className="w-full">
              <tbody>
                <Row label="Evidenčné číslo (ID)" value={asset.id} />
                <Row label="Typ majetku" value={asset.type} />
                <Row label="Popis / Názov" value={asset.name} />
                <Row label="Výrobca (značka)" value={asset.brand} />
                <Row label="Výrobné / sériové číslo" value={asset.serialNumber} />
                <Row label="Rok výroby" value={asset.yearOfManufacture} />
                <Row label="Druh majetku" value={asset.kind} />
                <Row label="Miesto použitia" value={asset.usagePlace} />
                <Row label="Funkčný stav" value={asset.functionStatus} />
                <Row label="Dátum nadobudnutia" value={asset.acquisitionDate} />
              </tbody>
            </table>
          </div>

          {/* Assignment / Handover */}
          <div className="mb-10">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Odovzdanie / Príjemca
            </h2>
            {assignment ? (
              <table className="w-full">
                <tbody>
                  <Row label="Meno a priezvisko" value={assignment.recipientName} />
                  <Row label="Email" value={assignment.recipientEmail} />
                  <Row label="Dátum prevzatia" value={assignment.assignedAt} />
                  <Row label="Odovzdal" value={assignment.assignedBy} />
                  {assignment.note && (
                    <Row label="Poznámka" value={assignment.note} />
                  )}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500 italic">
                Majetok nie je aktuálne priradený príjemcovi.
              </p>
            )}
          </div>

          {/* Signature block */}
          <div className="border-t-2 border-gray-200 pt-8">
            <div className="grid grid-cols-2 gap-12">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-6">
                  Odovzdávajúci
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
                  Príjemca
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
              Dokument vygenerovaný systémom VšehoEvidencia · {generatedAt}
            </p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
