"use client"

import { Printer, ArrowLeft } from "lucide-react"
import { transportMeansLabels } from "@/lib/labels"
import { buildDayInfos, formatLocalDate, tierLabel } from "@/lib/travelUtils"
import type { TransportMeans, VehicleCategory, TravelOrderType } from "@/generated/prisma/enums"

interface Props {
  order: {
    orderNumber: string
    type: TravelOrderType
    purpose: string
    startLocation: string
    destination: string
    countries: string | null
    departureAt: string
    returnAt: string
    transport: TransportMeans[]
    vehicleCategory: VehicleCategory | null
    vehicleRegPlate: string | null
    engineVolume: number | null
    advanceEUR: number | null
    advanceForeign: number | null
    foreignCurrency: string | null
    pocketMoney: number | null
    travelInsurance: boolean
    supervisorApprovedAt: string | null
    managerApprovedAt: string | null
  }
  employee: { name: string; email: string }
  supervisor: string | null
  manager: string | null
  expenseReport: {
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
    otherExpenseItems: string | null
    foreignDiet: number | null
    pocketMoneyPaid: number | null
    exchangeRate: number | null
    totalExpenses: number
    advanceReceived: number
    supervisorApprovedAt: string | null
    managerApprovedAt: string | null
  }
  generatedAt: string
}

function R({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <tr>
      <td className="py-1.5 pr-4 text-xs text-gray-500 w-52 align-top whitespace-nowrap">{label}</td>
      <td className="py-1.5 text-xs text-gray-900 font-medium">{value ?? "—"}</td>
    </tr>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{children}</span>
      <div className="flex-1 border-t border-gray-200" />
    </div>
  )
}

function fmtEUR(n: number | null) {
  if (n == null || n === 0) return null
  return `${n.toFixed(2)} €`
}

export default function TravelOrderPrint({ order, employee, supervisor, manager, expenseReport: er }: Props) {
  const isForeign = order.type === "ZAHRANICNY"
  const effectiveTransport = er.actualTransport?.length ? er.actualTransport : order.transport
  const isOwnVehicle = effectiveTransport.includes("VLASTNE_VOZIDLO")

  const storedMeals = er.mealsPerDay ? JSON.parse(er.mealsPerDay) : []
  const dayInfos = buildDayInfos(
    er.actualDepartureAt.slice(0, 16),
    er.actualReturnAt.slice(0, 16),
    storedMeals
  )

  const pubTransItems: { description: string; amount: number }[] = (() => {
    if (er.publicTransportItems) {
      try { return JSON.parse(er.publicTransportItems) } catch { /* empty */ }
    }
    if (er.publicTransportCost != null) return [{ description: "Cestovné", amount: er.publicTransportCost }]
    return []
  })()

  const accItems: { description: string; price: number; companyCard: number; employee: number }[] = (() => {
    if (er.accommodationItems) {
      try { return JSON.parse(er.accommodationItems) } catch { /* empty */ }
    }
    return []
  })()

  const otherItems: { description: string; amount: number }[] = (() => {
    if (er.otherExpenseItems) {
      try { return JSON.parse(er.otherExpenseItems) } catch { /* empty */ }
    }
    if (er.otherExpenses != null) return [{ description: "Iné výdavky", amount: er.otherExpenses }]
    return []
  })()

  const balance = er.totalExpenses - er.advanceReceived

  return (
    <>
      {/* Toolbar */}
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

      {/* Document */}
      <div className="min-h-screen bg-gray-100 print:bg-white pt-16 print:pt-0">
        <div className="max-w-3xl mx-auto bg-white print:max-w-none print:mx-0 shadow-sm print:shadow-none px-12 py-10 print:px-10 print:py-8 my-6 print:my-0">

          {/* ── HLAVIČKA ── */}
          <div className="flex items-start justify-between mb-6 pb-5 border-b-2 border-gray-900">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">VšehoEvidencia</p>
              <h1 className="text-lg font-bold text-gray-900 leading-snug">
                CESTOVNÝ PRÍKAZ<br />A VYÚČTOVANIE PRACOVNEJ CESTY
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                {order.type === "TUZEMSKY" ? "Tuzemská pracovná cesta" : "Zahraničná pracovná cesta"}
              </p>
            </div>
            <div className="text-right shrink-0 ml-8">
              <p className="text-[10px] text-gray-400 mb-0.5">Číslo príkazu</p>
              <p className="font-mono text-sm font-bold text-gray-900">{order.orderNumber}</p>
              <p className="text-[10px] text-gray-400 mt-3 mb-0.5">Vygenerované</p>
              <p className="text-xs text-gray-900">{new Date().toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>

          {/* ── ČASŤ I — CESTOVNÝ PRÍKAZ ── */}
          <div className="mb-7">
            <div className="inline-block bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded mb-4">
              Časť I — Cestovný príkaz
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-0">
              <div>
                <SectionTitle>Zamestnanec</SectionTitle>
                <table className="w-full">
                  <tbody>
                    <R label="Meno a priezvisko" value={employee.name} />
                    <R label="Email" value={employee.email} />
                  </tbody>
                </table>
              </div>
              <div>
                <SectionTitle>Schvaľovanie príkazu</SectionTitle>
                <table className="w-full">
                  <tbody>
                    <R label="Nadriadený" value={supervisor} />
                    <R label="Dátum schválenia" value={order.supervisorApprovedAt} />
                    <R label="Správca PC" value={manager} />
                    <R label="Dátum schválenia" value={order.managerApprovedAt} />
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4">
              <SectionTitle>Údaje o ceste</SectionTitle>
              <div className="grid grid-cols-2 gap-x-8">
                <table className="w-full">
                  <tbody>
                    <R label="Účel cesty" value={order.purpose} />
                    <R label="Miesto odchodu" value={order.startLocation} />
                    <R label="Cieľ cesty" value={order.destination} />
                    {order.countries && <R label="Navštívené krajiny" value={order.countries} />}
                    <R label="Plánovaný odchod" value={order.departureAt} />
                    <R label="Plánovaný návrat" value={order.returnAt} />
                  </tbody>
                </table>
                <table className="w-full">
                  <tbody>
                    <R label="Dopravný prostriedok" value={order.transport.map(t => transportMeansLabels[t]).join(", ")} />
                    {order.vehicleCategory && (
                      <R label="Druh vozidla" value={order.vehicleCategory === "JEDNOSTOPOVE" ? "Jednostopové (motocykel)" : "Osobné vozidlo"} />
                    )}
                    {order.vehicleRegPlate && <R label="EČV vozidla" value={order.vehicleRegPlate} />}
                    {order.engineVolume && <R label="Objem motora" value={`${order.engineVolume} cm³`} />}
                    <R label="Preddavok (EUR)" value={fmtEUR(order.advanceEUR) ?? "—"} />
                    {isForeign && order.advanceForeign != null && (
                      <R label={`Preddavok (${order.foreignCurrency ?? ""})`} value={`${order.advanceForeign.toFixed(2)} ${order.foreignCurrency ?? ""}`} />
                    )}
                    {isForeign && order.pocketMoney != null && (
                      <R label="Vreckové" value={`${order.pocketMoney.toFixed(2)} ${order.foreignCurrency ?? ""}`} />
                    )}
                    {isForeign && <R label="Cestovné poistenie" value={order.travelInsurance ? "Áno" : "Nie"} />}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── ČASŤ II — VYÚČTOVANIE ── */}
          <div className="mb-6">
            <div className="inline-block bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded mb-4">
              Časť II — Vyúčtovanie
            </div>

            {/* Skutočný priebeh */}
            <SectionTitle>Skutočný priebeh cesty</SectionTitle>
            <div className="grid grid-cols-2 gap-x-8 mb-4">
              <table className="w-full">
                <tbody>
                  <R label="Skutočný odchod" value={er.actualDepartureAt} />
                  <R label="Skutočný návrat" value={er.actualReturnAt} />
                </tbody>
              </table>
              <table className="w-full">
                <tbody>
                  <R
                    label="Skutočná doprava"
                    value={effectiveTransport.map(t => transportMeansLabels[t]).join(", ")}
                  />
                  {er.actualTransport?.length && er.actualVehicleRegPlate && (
                    <R label="EČV vozidla (skutočné)" value={er.actualVehicleRegPlate} />
                  )}
                </tbody>
              </table>
            </div>

            {/* Diéty — tuzemská */}
            {!isForeign && dayInfos.length > 0 && (
              <div className="mb-4">
                <SectionTitle>Diéty (§5 zák. 283/2002 Z.z.)</SectionTitle>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1.5 pr-3 text-gray-500 font-medium">Dátum</th>
                      <th className="text-left py-1.5 pr-3 text-gray-500 font-medium">Hodiny / Sadzba</th>
                      <th className="text-center py-1.5 px-2 text-gray-500 font-medium" title="Raňajky −25 %">R</th>
                      <th className="text-center py-1.5 px-2 text-gray-500 font-medium" title="Obed −40 %">O</th>
                      <th className="text-center py-1.5 px-2 text-gray-500 font-medium" title="Večera −35 %">V</th>
                      <th className="text-right py-1.5 text-gray-500 font-medium">Diéta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayInfos.map((d) => (
                      <tr key={d.date} className={`border-b border-gray-100 ${d.hours < 5 ? "opacity-40" : ""}`}>
                        <td className="py-1.5 pr-3 text-gray-800">{formatLocalDate(d.date)}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{d.hours.toFixed(1)} h · {tierLabel(d.hours)}</td>
                        <td className="py-1.5 px-2 text-center">{d.breakfast ? "✓" : "—"}</td>
                        <td className="py-1.5 px-2 text-center">{d.lunch ? "✓" : "—"}</td>
                        <td className="py-1.5 px-2 text-center">{d.dinner ? "✓" : "—"}</td>
                        <td className="py-1.5 text-right font-medium text-gray-900">
                          {d.hours < 5 ? "—" : `${d.dietAmount.toFixed(2)} €`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-300">
                      <td colSpan={5} className="py-1.5 font-semibold text-gray-700">Diéty spolu</td>
                      <td className="py-1.5 text-right font-bold text-gray-900">{er.dietAmount.toFixed(2)} €</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Diéty — zahraničná */}
            {isForeign && (
              <div className="mb-4">
                <SectionTitle>Zahraničné náhrady (§13 zák. 283/2002 Z.z.)</SectionTitle>
                <table className="w-full">
                  <tbody>
                    <R label={`Zahraničná diéta (${order.foreignCurrency ?? ""})`} value={er.foreignDiet != null ? `${er.foreignDiet.toFixed(2)} ${order.foreignCurrency ?? ""}` : null} />
                    <R label="Vreckové vyplatené" value={er.pocketMoneyPaid != null ? `${er.pocketMoneyPaid.toFixed(2)} ${order.foreignCurrency ?? ""}` : null} />
                    <R label="Výmenný kurz (1 EUR = ?)" value={er.exchangeRate != null ? String(er.exchangeRate) : null} />
                  </tbody>
                </table>
              </div>
            )}

            {/* Náklady na dopravu */}
            {(isOwnVehicle || er.publicTransportCost != null || er.taxiCost != null) && (
              <div className="mb-4">
                <SectionTitle>Náklady na dopravu</SectionTitle>
                <table className="w-full">
                  <tbody>
                    {isOwnVehicle && er.kmDriven && (
                      <>
                        <R label="Počet najazdených km" value={`${er.kmDriven} km`} />
                        {er.kmBasicRate && <R label="Základná náhrada/km" value={`${er.kmBasicRate} €/km`} />}
                        {er.fuelConsumption && er.fuelPricePerL && (
                          <R label="Náhrada za PHM/km" value={`${((er.fuelConsumption / 100) * er.fuelPricePerL).toFixed(4)} €/km`} />
                        )}
                        <R label="Náhrada za km spolu (§7)" value={fmtEUR(er.kmCompensation)} />
                      </>
                    )}
                    {pubTransItems.length === 1 && (
                      <R label="Verejná doprava — cestovné (§8)" value={`${pubTransItems[0].amount.toFixed(2)} €`} />
                    )}
                    {pubTransItems.length > 1 && (
                      <>
                        {pubTransItems.map((item, i) => (
                          <R key={i} label={item.description || `Cestovné položka ${i + 1}`} value={`${item.amount.toFixed(2)} €`} />
                        ))}
                        <R label="Verejná doprava spolu (§8)" value={fmtEUR(er.publicTransportCost)} />
                      </>
                    )}
                    {er.taxiCost != null && (
                      <R label="Taxi" value={fmtEUR(er.taxiCost)} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Ostatné výdavky */}
            {(er.accommodation != null || er.parking != null || otherItems.length > 0) && (
              <div className="mb-4">
                <SectionTitle>Ostatné výdavky</SectionTitle>
                <table className="w-full">
                  <tbody>
                    {accItems.length > 0
                      ? (
                        <>
                          {accItems.map((item, i) => (
                            <tr key={i}>
                              <td className="py-1.5 pr-4 text-xs text-gray-500 w-52 align-top whitespace-nowrap">
                                {item.description || `Ubytovanie ${i + 1}`}
                              </td>
                              <td className="py-1.5 text-xs text-gray-900 font-medium">
                                {item.price.toFixed(2)} €
                                {(item.companyCard > 0 || item.employee > 0) && (
                                  <span className="ml-2 font-normal text-gray-500">
                                    (karta: {item.companyCard.toFixed(2)} € · zamestnanec: {item.employee.toFixed(2)} €)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {er.accommodation != null && <R label="Ubytovanie spolu" value={fmtEUR(er.accommodation)} />}
                        </>
                      )
                      : er.accommodation != null && <R label="Ubytovanie" value={fmtEUR(er.accommodation)} />
                    }
                    {er.parking != null && <R label="Parkovné" value={fmtEUR(er.parking)} />}
                    {otherItems.map((item, i) => (
                      <R key={i} label={item.description || "Iný výdavok"} value={`${item.amount.toFixed(2)} €`} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rekapitulácia */}
            <SectionTitle>Rekapitulácia</SectionTitle>
            <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full">
                <tbody>
                  {er.dietAmount > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-600">Diéty</td>
                      <td className="px-4 py-2 text-right text-gray-900">{er.dietAmount.toFixed(2)} €</td>
                    </tr>
                  )}
                  {er.kmCompensation != null && er.kmCompensation > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-600">Náhrada za km</td>
                      <td className="px-4 py-2 text-right text-gray-900">{er.kmCompensation.toFixed(2)} €</td>
                    </tr>
                  )}
                  {er.publicTransportCost != null && (
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-600">Verejná doprava</td>
                      <td className="px-4 py-2 text-right text-gray-900">{er.publicTransportCost.toFixed(2)} €</td>
                    </tr>
                  )}
                  {er.taxiCost != null && (
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-600">Taxi</td>
                      <td className="px-4 py-2 text-right text-gray-900">{er.taxiCost.toFixed(2)} €</td>
                    </tr>
                  )}
                  {er.accommodation != null && (
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-600">Ubytovanie</td>
                      <td className="px-4 py-2 text-right text-gray-900">{er.accommodation.toFixed(2)} €</td>
                    </tr>
                  )}
                  {er.parking != null && (
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-600">Parkovné</td>
                      <td className="px-4 py-2 text-right text-gray-900">{er.parking.toFixed(2)} €</td>
                    </tr>
                  )}
                  {otherItems.length > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-600">Iné výdavky</td>
                      <td className="px-4 py-2 text-right text-gray-900">{otherItems.reduce((s, i) => s + i.amount, 0).toFixed(2)} €</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="px-4 py-2.5 font-semibold text-gray-800">Celkové výdavky</td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-900">{er.totalExpenses.toFixed(2)} €</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-600">Preddavok prijatý</td>
                    <td className="px-4 py-2 text-right text-gray-900">{er.advanceReceived.toFixed(2)} €</td>
                  </tr>
                  <tr className={balance > 0.005 ? "bg-green-50" : balance < -0.005 ? "bg-red-50" : ""}>
                    <td className={`px-4 py-2.5 font-semibold ${balance > 0.005 ? "text-green-800" : balance < -0.005 ? "text-red-800" : "text-gray-700"}`}>
                      {balance > 0.005 ? "Doplatiť zamestnancovi" : balance < -0.005 ? "Zamestnanec vracia" : "Vyrovnané"}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold text-lg ${balance > 0.005 ? "text-green-700" : balance < -0.005 ? "text-red-700" : "text-gray-600"}`}>
                      {Math.abs(balance).toFixed(2)} €
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── PODPISY ── */}
          <div className="border-t-2 border-gray-200 pt-6 mt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-5">Podpisy</p>
            <div className="grid grid-cols-3 gap-6">

              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Zamestnanec</p>
                <p className="text-xs text-gray-700 mb-5">{employee.name}</p>
                <div className="border-b border-gray-400 mb-1 h-10" />
                <p className="text-[10px] text-gray-400">Podpis · Dátum</p>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Nadriadený</p>
                <p className="text-xs text-gray-700 mb-1">{supervisor ?? "—"}</p>
                {er.supervisorApprovedAt && (
                  <p className="text-[10px] text-green-600 mb-3">Schválené dňa: {er.supervisorApprovedAt}</p>
                )}
                <div className="border-b border-gray-400 mb-1 h-10" />
                <p className="text-[10px] text-gray-400">Podpis · Dátum</p>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Správca PC</p>
                <p className="text-xs text-gray-700 mb-1">{manager ?? "—"}</p>
                {er.managerApprovedAt && (
                  <p className="text-[10px] text-green-600 mb-3">Schválené dňa: {er.managerApprovedAt}</p>
                )}
                <div className="border-b border-gray-400 mb-1 h-10" />
                <p className="text-[10px] text-gray-400">Podpis · Dátum</p>
              </div>

            </div>

            <p className="text-[10px] text-gray-400 text-center mt-8 print:mt-12">
              Dokument vygenerovaný systémom VšehoEvidencia · {new Date().toLocaleDateString("sk-SK")}
            </p>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 12mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
