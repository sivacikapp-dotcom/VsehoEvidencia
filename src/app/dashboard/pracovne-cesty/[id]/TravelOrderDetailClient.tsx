"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Check, X, RotateCcw, Send, Pencil, Trash2, Loader2, AlertTriangle, FileText,
  Paperclip, Download, Trash, Printer,
} from "lucide-react"
import {
  travelOrderTypeLabels,
  travelOrderTypeColors,
  travelOrderStatusLabels,
  travelOrderStatusColors,
  transportMeansLabels,
} from "@/lib/labels"
import type { TravelOrderType, TravelOrderStatus, TransportMeans, VehicleCategory } from "@/generated/prisma/enums"
import { kmRateLabel, buildDayInfos, formatLocalDate, type TravelRates, DEFAULT_TRAVEL_RATES } from "@/lib/travelUtils"
import { fmtDate, fmtDateTime, toDatetimeLocalInput } from "@/lib/formatDate"
import type { DayInfo } from "@/lib/travelUtils"
import {
  submitTravelOrder,
  supervisorApproveTravelOrder,
  supervisorRejectTravelOrder,
  managerApproveTravelOrder,
  managerRejectTravelOrder,
  deleteTravelOrder,
  reopenTravelOrder,
  submitExpenseReport,
  supervisorApproveExpenseReport,
  supervisorRejectExpenseReport,
  managerApproveExpenseReport,
  managerRejectExpenseReport,
  uploadExpenseReportAttachment,
  deleteExpenseReportAttachment,
} from "../actions"
import { dismissTravelOrderNotifications } from "@/app/dashboard/notifications/actions"
import NewTravelOrderModal from "../NewTravelOrderModal"
import type { InitialValues } from "../NewTravelOrderModal"
import ExpenseReportModal from "../ExpenseReportModal"

type ExpenseReport = {
  id: number
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
  status: TravelOrderStatus
  supervisorApprovedAt: string | null
  supervisorRejectedAt: string | null
  managerApprovedAt: string | null
  managerRejectedAt: string | null
  rejectionNote: string | null
  rejectedSnapshot: string | null
  updatedAt: string
  attachments: {
    id: number
    storedName: string
    originalName: string
    mimeType: string
    size: number
    createdAt: string
    uploadedBy: { firstName: string; lastName: string } | null
  }[]
}

type Order = {
  id: number
  orderNumber: string
  type: TravelOrderType
  status: TravelOrderStatus
  userId: number
  purpose: string
  startLocation: string
  destination: string
  departureAt: string
  returnAt: string
  transport: TransportMeans[]
  vehicleCategory: VehicleCategory | null
  vehicleRegPlate: string | null
  engineVolume: number | null
  advanceEUR: number | null
  countries: string | null
  advanceForeign: number | null
  foreignCurrency: string | null
  pocketMoney: number | null
  travelInsurance: boolean
  supervisorId: number | null
  supervisorApprovedAt: string | null
  supervisorRejectedAt: string | null
  managerApprovedAt: string | null
  managerRejectedAt: string | null
  rejectionNote: string | null
  user: { id: number; firstName: string; lastName: string; email: string }
  supervisor: { id: number; firstName: string; lastName: string } | null
  manager: { id: number; firstName: string; lastName: string } | null
  expenseReport: ExpenseReport | null
  createdAt: string
  updatedAt: string
}

interface Props {
  order: Order
  currentUserId: number
  userRoles: string[]
  supervisors: { id: number; firstName: string; lastName: string }[]
  rates?: TravelRates | null
  isAppAdmin?: boolean
}

export default function TravelOrderDetailClient({ order, currentUserId, userRoles, supervisors, rates, isAppAdmin = false }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [showRejectErBox, setShowRejectErBox] = useState(false)
  const [rejectErNote, setRejectErNote] = useState("")
  const [showEdit, setShowEdit] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
  const [actionError, setActionError] = useState("")

  useEffect(() => {
    dismissTravelOrderNotifications(order.id)
  }, [order.id])

  const isOwner = order.userId === currentUserId
  const isSupervisor = order.supervisorId === currentUserId
  const isSpravcaPC = userRoles.includes("SPRAVCA_PRACOVNYCH_CIEST")
  const isLocked = order.status === "APPROVED"

  const er = order.expenseReport
  const erStatus = er?.status ?? null
  const erLocked = erStatus === "APPROVED"

  async function doAction(key: string, fn: () => Promise<void>) {
    setActionError("")
    setPending(key)
    try {
      await fn()
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Nastala chyba.")
    } finally {
      setPending(null)
    }
  }

  function fmtEUR(n: number | null) {
    if (n == null) return "—"
    return n.toFixed(2) + " €"
  }

  const editInitial: InitialValues = {
    purpose: order.purpose,
    startLocation: order.startLocation,
    destination: order.destination,
    departureAt: toDatetimeLocalInput(order.departureAt),
    returnAt: toDatetimeLocalInput(order.returnAt),
    transport: order.transport,
    vehicleCategory: order.vehicleCategory ?? "",
    vehicleRegPlate: order.vehicleRegPlate ?? "",
    engineVolume: order.engineVolume ? String(order.engineVolume) : "",
    advanceEUR: order.advanceEUR != null ? String(order.advanceEUR) : "",
    countries: order.countries ?? "",
    advanceForeign: order.advanceForeign != null ? String(order.advanceForeign) : "",
    foreignCurrency: order.foreignCurrency ?? "EUR",
    pocketMoney: order.pocketMoney != null ? String(order.pocketMoney) : "",
    travelInsurance: order.travelInsurance,
    supervisorId: order.supervisorId ? String(order.supervisorId) : "",
  }

  // Vypočítaj trvanie v hodinách
  function durationHours(dep: string, ret: string) {
    const h = (new Date(ret).getTime() - new Date(dep).getTime()) / 3_600_000
    return Math.max(0, h)
  }

  function dietTier(hours: number) {
    if (hours < 5) return "Bez diét (menej ako 5 h)"
    if (hours < 12) return "Sadzba 1 (5 – 12 h)"
    if (hours < 18) return "Sadzba 2 (12 – 18 h)"
    return "Sadzba 3 (nad 18 h)"
  }

  const plannedHours = durationHours(order.departureAt, order.returnAt)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {isAppAdmin && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg text-sm text-violet-700 dark:text-violet-300">
          Režim len na čítanie — finančné hodnoty sú skryté.
        </div>
      )}
      {/* header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/pracovne-cesty"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white font-mono">
              {order.orderNumber}
            </h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${travelOrderTypeColors[order.type]}`}>
              {travelOrderTypeLabels[order.type]}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${travelOrderStatusColors[order.status]}`}>
              {travelOrderStatusLabels[order.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {order.user.firstName} {order.user.lastName} · Vytvorený {fmtDate(order.createdAt)}
          </p>
        </div>
      </div>

      {/* rejection note */}
      {order.status === "REJECTED" && order.rejectionNote && (
        <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Dôvod zamietnutia</p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">{order.rejectionNote}</p>
          </div>
        </div>
      )}

      {actionError && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{actionError}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* ľavý stĺpec — detail príkazu */}
        <div className="lg:col-span-3 space-y-4">
          {/* základné info */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cestovný príkaz</h2>

            <Row label="Účel cesty" value={order.purpose} />
            <Row label="Miesto odchodu" value={order.startLocation} />
            <Row label="Cieľ cesty" value={order.destination} />
            {order.countries && <Row label="Navštívené krajiny" value={order.countries} />}
            <Row label="Odchod" value={fmtDateTime(order.departureAt)} />
            <Row label="Návrat" value={fmtDateTime(order.returnAt)} />
            <Row label="Plánované trvanie" value={`${plannedHours.toFixed(1)} h — ${dietTier(plannedHours)}`} />
            <Row label="Dopravný prostriedok" value={order.transport.map(t => transportMeansLabels[t]).join(", ")} />
            {order.vehicleCategory && (
              <Row
                label="Druh vozidla"
                value={order.vehicleCategory === "JEDNOSTOPOVE" ? "Jednostopové (motocykel)" : "Osobné vozidlo"}
              />
            )}
            {order.vehicleRegPlate && <Row label="EČV vozidla" value={order.vehicleRegPlate} />}
            {order.engineVolume && <Row label="Objem motora" value={`${order.engineVolume} cm³`} />}
            {order.transport.includes("VLASTNE_VOZIDLO") && (
              <Row label="Sadzba náhrady/km" value={kmRateLabel(order.vehicleCategory, order.engineVolume)} />
            )}
          </div>

          {/* finančné údaje */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Finančné údaje</h2>
            <Row label="Preddavok (EUR)" value={fmtEUR(order.advanceEUR)} />
            {order.type === "ZAHRANICNY" && (
              <>
                <Row
                  label="Preddavok (cudzia mena)"
                  value={
                    order.advanceForeign != null
                      ? `${order.advanceForeign.toFixed(2)} ${order.foreignCurrency ?? ""}`
                      : "—"
                  }
                />
                <Row
                  label="Vreckové"
                  value={order.pocketMoney != null ? `${order.pocketMoney.toFixed(2)} ${order.foreignCurrency ?? ""}` : "—"}
                />
                <Row label="Cestovné poistenie" value={order.travelInsurance ? "Áno" : "Nie"} />
              </>
            )}
          </div>

          {/* vyúčtovanie */}
          {order.expenseReport && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Vyúčtovanie</h2>
                  {erStatus && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${travelOrderStatusColors[erStatus]}`}>
                      {travelOrderStatusLabels[erStatus]}
                    </span>
                  )}
                </div>
                {isOwner && order.status === "APPROVED" && (erStatus === null || erStatus === "DRAFT") && (
                  <button
                    onClick={() => setShowExpense(true)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    Upraviť
                  </button>
                )}
              </div>
              {erStatus === "REJECTED" && er?.rejectionNote && (
                <div className="flex gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">Dôvod zamietnutia vyúčtovania</p>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{er.rejectionNote}</p>
                  </div>
                </div>
              )}
              <ExpenseReportView
                er={order.expenseReport}
                orderType={order.type}
                orderTransport={order.transport}
                orderDepartureAt={order.departureAt}
                orderReturnAt={order.returnAt}
                fmtEUR={fmtEUR}
                rejectedSnapshot={order.expenseReport.rejectedSnapshot}
              />
            </div>
          )}

          {/* prílohy vyúčtovania — samostatná karta, viditeľná vždy keď príkaz APPROVED */}
          {order.status === "APPROVED" && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <ExpenseReportAttachments
                er={order.expenseReport}
                travelOrderId={order.id}
                canEdit={isOwner && (erStatus === null || erStatus === "DRAFT")}
                onChanged={() => startTransition(() => router.refresh())}
              />
            </div>
          )}
        </div>

        {/* pravý stĺpec — schvaľovací stav + akcie */}
        <div className="space-y-4">
          {/* timeline schvaľovania */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Schvaľovanie</h2>

            <ApprovalStep
              number={1}
              label="Nadriadený"
              person={order.supervisor ? `${order.supervisor.firstName} ${order.supervisor.lastName}` : "—"}
              approvedAt={order.supervisorApprovedAt}
              rejectedAt={order.supervisorRejectedAt}
              status={order.status}
              relevantStatuses={["PENDING_SUPERVISOR", "APPROVED", "REJECTED"]}
            />
          </div>

          {/* schvaľovanie vyúčtovania */}
          {er && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Schvaľovanie vyúčtovania</h2>
              <ApprovalStep
                number={1}
                label="Nadriadený"
                person={order.supervisor ? `${order.supervisor.firstName} ${order.supervisor.lastName}` : "—"}
                approvedAt={er.supervisorApprovedAt}
                rejectedAt={er.supervisorRejectedAt}
                status={erStatus ?? "DRAFT"}
                relevantStatuses={["PENDING_SUPERVISOR", "PENDING_MANAGER", "APPROVED", "REJECTED"]}
              />
              <div className="border-l-2 border-gray-200 dark:border-gray-700 ml-4 h-4" />
              <ApprovalStep
                number={2}
                label="Správca PC"
                person={order.manager ? `${order.manager.firstName} ${order.manager.lastName}` : "—"}
                approvedAt={er.managerApprovedAt}
                rejectedAt={er.managerRejectedAt}
                status={erStatus ?? "DRAFT"}
                relevantStatuses={["PENDING_MANAGER", "APPROVED", "REJECTED"]}
              />
            </div>
          )}

          {/* akcie */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Akcie</h2>

            {/* OWNER actions */}
            {isOwner && order.status === "DRAFT" && (
              <>
                <ActionBtn
                  icon={<Send size={14} />}
                  label="Odoslať na schválenie"
                  color="blue"
                  loading={pending === "submit"}
                  onClick={() => doAction("submit", () => submitTravelOrder(order.id))}
                />
                <ActionBtn
                  icon={<Pencil size={14} />}
                  label="Upraviť príkaz"
                  color="gray"
                  loading={false}
                  onClick={() => setShowEdit(true)}
                />
                <ActionBtn
                  icon={<Trash2 size={14} />}
                  label="Vymazať príkaz"
                  color="red"
                  loading={pending === "delete"}
                  onClick={() =>
                    doAction("delete", async () => {
                      await deleteTravelOrder(order.id)
                      router.push("/dashboard/pracovne-cesty")
                    })
                  }
                />
              </>
            )}

            {isOwner && order.status === "REJECTED" && (
              <ActionBtn
                icon={<RotateCcw size={14} />}
                label="Vrátiť do rozpracovania"
                color="gray"
                loading={pending === "reopen"}
                onClick={() => doAction("reopen", () => reopenTravelOrder(order.id))}
              />
            )}

            {/* Vyúčtovanie – dostupné až po schválení príkazu */}
            {isOwner && order.status === "APPROVED" && (erStatus === null || erStatus === "DRAFT") && (
              <ActionBtn
                icon={<FileText size={14} />}
                label={order.expenseReport ? "Upraviť vyúčtovanie" : "Vyplniť vyúčtovanie"}
                color="teal"
                loading={false}
                onClick={() => setShowExpense(true)}
              />
            )}

            {/* Odoslať vyúčtovanie na schválenie */}
            {isOwner && order.status === "APPROVED" && er && erStatus === "DRAFT" && (
              <ActionBtn
                icon={<Send size={14} />}
                label="Odoslať vyúčtovanie na schválenie"
                color="teal"
                loading={pending === "er-submit"}
                onClick={() => doAction("er-submit", () => submitExpenseReport(order.id))}
              />
            )}

            {/* Schvaľovanie vyúčtovania – nadriadený */}
            {isSupervisor && erStatus === "PENDING_SUPERVISOR" && (
              <>
                <ActionBtn
                  icon={<Check size={14} />}
                  label="Schváliť vyúčtovanie"
                  color="green"
                  loading={pending === "er-sup-approve"}
                  onClick={() => doAction("er-sup-approve", () => supervisorApproveExpenseReport(order.id))}
                />
                {!showRejectErBox && (
                  <ActionBtn
                    icon={<X size={14} />}
                    label="Zamietnuť vyúčtovanie"
                    color="red"
                    loading={false}
                    onClick={() => setShowRejectErBox(true)}
                  />
                )}
              </>
            )}

            {/* Schvaľovanie vyúčtovania – správca PC */}
            {isSpravcaPC && erStatus === "PENDING_MANAGER" && (
              <>
                <ActionBtn
                  icon={<Check size={14} />}
                  label="Schváliť vyúčtovanie"
                  color="green"
                  loading={pending === "er-mgr-approve"}
                  onClick={() => doAction("er-mgr-approve", () => managerApproveExpenseReport(order.id))}
                />
                {!showRejectErBox && (
                  <ActionBtn
                    icon={<X size={14} />}
                    label="Zamietnuť vyúčtovanie"
                    color="red"
                    loading={false}
                    onClick={() => setShowRejectErBox(true)}
                  />
                )}
              </>
            )}

            {/* ER zamietnutie box */}
            {showRejectErBox && (
              <div className="space-y-2 pt-1">
                <textarea
                  value={rejectErNote}
                  onChange={(e) => setRejectErNote(e.target.value)}
                  placeholder="Dôvod zamietnutia vyúčtovania..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!rejectErNote.trim()) {
                        setActionError("Zadajte dôvod zamietnutia.")
                        return
                      }
                      const fn =
                        erStatus === "PENDING_SUPERVISOR"
                          ? () => supervisorRejectExpenseReport(order.id, rejectErNote)
                          : () => managerRejectExpenseReport(order.id, rejectErNote)
                      const key = erStatus === "PENDING_SUPERVISOR" ? "er-sup-reject" : "er-mgr-reject"
                      doAction(key, fn)
                      setShowRejectErBox(false)
                    }}
                    disabled={pending !== null}
                    className="flex-1 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Potvrdiť zamietnutie
                  </button>
                  <button
                    onClick={() => { setShowRejectErBox(false); setRejectErNote("") }}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Zrušiť
                  </button>
                </div>
              </div>
            )}

            {erLocked && (
              <>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Check size={14} />
                  Vyúčtovanie je schválené a uzamknuté
                </div>
                <Link
                  href={`/protocol/travel/${order.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
                >
                  <Printer size={14} />
                  Tlačiť príkaz a vyúčtovanie
                </Link>
              </>
            )}

            {/* SUPERVISOR actions */}
            {isSupervisor && order.status === "PENDING_SUPERVISOR" && (
              <>
                <ActionBtn
                  icon={<Check size={14} />}
                  label="Schváliť príkaz"
                  color="green"
                  loading={pending === "sup-approve"}
                  onClick={() => doAction("sup-approve", () => supervisorApproveTravelOrder(order.id))}
                />
                {!showRejectBox && (
                  <ActionBtn
                    icon={<X size={14} />}
                    label="Zamietnuť príkaz"
                    color="red"
                    loading={false}
                    onClick={() => setShowRejectBox(true)}
                  />
                )}
              </>
            )}

            {/* reject box */}
            {showRejectBox && (
              <div className="space-y-2 pt-1">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Dôvod zamietnutia..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!rejectNote.trim()) {
                        setActionError("Zadajte dôvod zamietnutia.")
                        return
                      }
                      const fn =
                        isSupervisor
                          ? () => supervisorRejectTravelOrder(order.id, rejectNote)
                          : () => managerRejectTravelOrder(order.id, rejectNote)
                      const key = isSupervisor ? "sup-reject" : "mgr-reject"
                      doAction(key, fn)
                      setShowRejectBox(false)
                    }}
                    disabled={pending !== null}
                    className="flex-1 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Potvrdiť zamietnutie
                  </button>
                  <button
                    onClick={() => { setShowRejectBox(false); setRejectNote("") }}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Zrušiť
                  </button>
                </div>
              </div>
            )}

            {order.status === "APPROVED" && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Check size={14} />
                Príkaz je schválený a uzamknutý
              </div>
            )}
          </div>
        </div>
      </div>

      {/* edit modal */}
      {showEdit && (
        <NewTravelOrderModal
          type={order.type}
          supervisors={supervisors}
          onClose={() => setShowEdit(false)}
          onCreated={() => {}}
          initial={editInitial}
          orderId={order.id}
          onUpdated={() => {
            setShowEdit(false)
            startTransition(() => router.refresh())
          }}
        />
      )}

      {/* expense report modal */}
      {showExpense && (
        <ExpenseReportModal
          order={{
            id: order.id,
            type: order.type,
            departureAt: order.departureAt,
            returnAt: order.returnAt,
            transport: order.transport,
            vehicleCategory: order.vehicleCategory,
            vehicleRegPlate: order.vehicleRegPlate,
            engineVolume: order.engineVolume,
            advanceEUR: order.advanceEUR,
            foreignCurrency: order.foreignCurrency,
          }}
          existing={order.expenseReport}
          readOnly={erLocked}
          rates={rates ?? undefined}
          onClose={() => setShowExpense(false)}
          onSaved={() => {
            setShowExpense(false)
            startTransition(() => router.refresh())
          }}
        />
      )}
    </div>
  )
}

// ─── sub-components ────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-52 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white">{value}</span>
    </div>
  )
}

function ActionBtn({
  icon, label, color, loading, onClick, disabled,
}: {
  icon: React.ReactNode
  label: string
  color: "blue" | "green" | "red" | "gray" | "teal"
  loading: boolean
  onClick: () => void
  disabled?: boolean
}) {
  const colors = {
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    green: "bg-green-600 hover:bg-green-700 text-white",
    red: "bg-red-600 hover:bg-red-700 text-white",
    gray: "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300",
    teal: "bg-teal-600 hover:bg-teal-700 text-white",
  }
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${colors[color]}`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}

function ApprovalStep({
  number, label, person, approvedAt, rejectedAt, status, relevantStatuses,
}: {
  number: number
  label: string
  person: string
  approvedAt: string | null
  rejectedAt: string | null
  status: TravelOrderStatus
  relevantStatuses: TravelOrderStatus[]
}) {
  const active = relevantStatuses.includes(status)
  const approved = !!approvedAt
  const rejected = !!rejectedAt

  return (
    <div className="flex gap-3 items-start">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          approved
            ? "bg-green-100 text-green-700"
            : rejected
            ? "bg-red-100 text-red-600"
            : active
            ? "bg-yellow-100 text-yellow-700"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        {approved ? <Check size={14} /> : rejected ? <X size={14} /> : number}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{person}</p>
        {approved && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Schválené {fmtDateTime(approvedAt!)}</p>
        )}
        {rejected && (
          <p className="text-xs text-red-500 mt-0.5">Zamietnuté {fmtDateTime(rejectedAt!)}</p>
        )}
      </div>
    </div>
  )
}

function ExpenseReportAttachments({
  er, travelOrderId, canEdit, onChanged,
}: {
  er: ExpenseReport | null
  travelOrderId: number
  canEdit: boolean
  onChanged: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState("")

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError("")
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      fd.set("travelOrderId", String(travelOrderId))
      await uploadExpenseReportAttachment(fd)
      onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nastala chyba pri nahrávaní.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDelete(id: number) {
    setError("")
    setDeletingId(id)
    try {
      await deleteExpenseReportAttachment(id, travelOrderId)
      onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nastala chyba pri mazaní.")
    } finally {
      setDeletingId(null)
    }
  }

  function fmtSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const attachments = er?.attachments ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <Paperclip size={14} />
          Prílohy vyúčtovania
          {attachments.length > 0 && (
            <span className="ml-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-1.5 py-0.5 text-xs font-medium">
              {attachments.length}
            </span>
          )}
        </h3>
        {canEdit && er && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
              {uploading ? "Nahrávam…" : "Pripojiť súbor"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv"
            />
          </>
        )}
      </div>

      {!er && (
        <p className="text-xs text-gray-400 italic">Prílohy možno pridávať po uložení vyúčtovania.</p>
      )}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg">{error}</p>
      )}

      {er && attachments.length === 0 && (
        <p className="text-xs text-gray-400 italic">Žiadne prílohy.</p>
      )}

      {attachments.length > 0 && (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2 text-sm"
            >
              <FileText size={14} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-gray-800 dark:text-gray-200 font-medium text-xs">
                  {att.originalName}
                </p>
                <p className="text-xs text-gray-400">
                  {fmtSize(att.size)} · {new Date(att.createdAt).toLocaleDateString("sk-SK")}
                </p>
              </div>
              <a
                href={`/api/travel/file/${att.storedName}?name=${encodeURIComponent(att.originalName)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0"
                title="Otvoriť / stiahnuť"
              >
                <Download size={14} />
              </a>
              {canEdit && (
                <button
                  onClick={() => handleDelete(att.id)}
                  disabled={deletingId === att.id}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 shrink-0 disabled:opacity-50"
                  title="Zmazať prílohu"
                >
                  {deletingId === att.id ? <Loader2 size={14} className="animate-spin" /> : <Trash size={14} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function sameTransportArrays(a: TransportMeans[], b: TransportMeans[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

type RejectedSnapshot = {
  rejectedBy: "supervisor" | "manager"
  actualDepartureAt: string
  actualReturnAt: string
  actualTransport: TransportMeans[]
  dietAmount: number
  kmDriven: number | null
  kmCompensation: number | null
  publicTransportCost: number | null
  taxiCost: number | null
  accommodation: number | null
  parking: number | null
  otherExpenses: number | null
  foreignDiet: number | null
  pocketMoneyPaid: number | null
  totalExpenses: number
}

function ExpenseReportView({
  er, orderType, orderTransport, orderDepartureAt, orderReturnAt, fmtEUR, rejectedSnapshot,
}: {
  er: ExpenseReport
  orderType: TravelOrderType
  orderTransport: TransportMeans[]
  orderDepartureAt: string
  orderReturnAt: string
  fmtEUR: (n: number | null) => string
  rejectedSnapshot?: string | null
}) {
  const storedMeals = er.mealsPerDay ? (() => { try { return JSON.parse(er.mealsPerDay!) } catch { return [] } })() : []
  const dayInfos: DayInfo[] = buildDayInfos(er.actualDepartureAt, er.actualReturnAt, storedMeals)
  const hours = (new Date(er.actualReturnAt).getTime() - new Date(er.actualDepartureAt).getTime()) / 3_600_000
  const balance = er.totalExpenses - er.advanceReceived

  // Zostavenie zoznamu zmien oproti schválenému príkazu
  const diffs: { label: string; original: string; changed: string }[] = []

  const depChanged = er.actualDepartureAt !== orderDepartureAt
  const retChanged = er.actualReturnAt !== orderReturnAt
  const transportChanged = er.actualTransport != null
    && er.actualTransport.length > 0
    && !sameTransportArrays(er.actualTransport, orderTransport)

  if (depChanged) {
    diffs.push({
      label: "Odchod",
      original: fmtDateTime(orderDepartureAt),
      changed: fmtDateTime(er.actualDepartureAt),
    })
  }
  if (retChanged) {
    diffs.push({
      label: "Návrat",
      original: fmtDateTime(orderReturnAt),
      changed: fmtDateTime(er.actualReturnAt),
    })
  }
  if (transportChanged) {
    diffs.push({
      label: "Dopravný prostriedok",
      original: orderTransport.map(t => transportMeansLabels[t]).join(", "),
      changed: er.actualTransport!.map(t => transportMeansLabels[t]).join(", "),
    })
  }

  const effectiveTransport = (er.actualTransport?.length ? er.actualTransport : orderTransport)
  const isOwnVehicle = effectiveTransport.includes("VLASTNE_VOZIDLO")

  // Zmeny oproti zamietnutému vyúčtovaniu
  const snap: RejectedSnapshot | null = rejectedSnapshot ? (() => { try { return JSON.parse(rejectedSnapshot) } catch { return null } })() : null
  const rejDiffs: { label: string; original: string; changed: string }[] = []
  if (snap) {
    const fmtEuro = (v: number | null) => v != null ? `${v.toFixed(2)} €` : "—"
    if (snap.actualDepartureAt !== er.actualDepartureAt)
      rejDiffs.push({ label: "Odchod", original: fmtDateTime(snap.actualDepartureAt), changed: fmtDateTime(er.actualDepartureAt) })
    if (snap.actualReturnAt !== er.actualReturnAt)
      rejDiffs.push({ label: "Návrat", original: fmtDateTime(snap.actualReturnAt), changed: fmtDateTime(er.actualReturnAt) })
    if (!sameTransportArrays(snap.actualTransport, er.actualTransport ?? []))
      rejDiffs.push({ label: "Doprava", original: snap.actualTransport.map(t => transportMeansLabels[t]).join(", ") || "—", changed: (er.actualTransport ?? []).map(t => transportMeansLabels[t]).join(", ") || "—" })
    if (snap.dietAmount !== er.dietAmount)
      rejDiffs.push({ label: "Diéty", original: fmtEuro(snap.dietAmount), changed: fmtEuro(er.dietAmount) })
    if (snap.kmDriven !== er.kmDriven)
      rejDiffs.push({ label: "Počet km", original: snap.kmDriven != null ? `${snap.kmDriven} km` : "—", changed: er.kmDriven != null ? `${er.kmDriven} km` : "—" })
    if (snap.kmCompensation !== er.kmCompensation)
      rejDiffs.push({ label: "Náhrada km", original: fmtEuro(snap.kmCompensation), changed: fmtEuro(er.kmCompensation) })
    if (snap.publicTransportCost !== er.publicTransportCost)
      rejDiffs.push({ label: "Ver. doprava", original: fmtEuro(snap.publicTransportCost), changed: fmtEuro(er.publicTransportCost) })
    if (snap.taxiCost !== er.taxiCost)
      rejDiffs.push({ label: "Taxi", original: fmtEuro(snap.taxiCost), changed: fmtEuro(er.taxiCost) })
    if (snap.accommodation !== er.accommodation)
      rejDiffs.push({ label: "Ubytovanie", original: fmtEuro(snap.accommodation), changed: fmtEuro(er.accommodation) })
    if (snap.parking !== er.parking)
      rejDiffs.push({ label: "Parkovné", original: fmtEuro(snap.parking), changed: fmtEuro(er.parking) })
    if (snap.otherExpenses !== er.otherExpenses)
      rejDiffs.push({ label: "Ostatné výd.", original: fmtEuro(snap.otherExpenses), changed: fmtEuro(er.otherExpenses) })
    if (snap.foreignDiet !== er.foreignDiet)
      rejDiffs.push({ label: "Zahr. diéta", original: fmtEuro(snap.foreignDiet), changed: fmtEuro(er.foreignDiet) })
    if (snap.pocketMoneyPaid !== er.pocketMoneyPaid)
      rejDiffs.push({ label: "Vreckové", original: fmtEuro(snap.pocketMoneyPaid), changed: fmtEuro(er.pocketMoneyPaid) })
    if (snap.totalExpenses !== er.totalExpenses)
      rejDiffs.push({ label: "Celkom", original: fmtEuro(snap.totalExpenses), changed: fmtEuro(er.totalExpenses) })
  }

  const rejectedByLabel = snap?.rejectedBy === "manager" ? "správcom pracovných ciest" : "nadriadeným"

  return (
    <div className="space-y-3 text-sm">

      {/* Zmeny oproti schválenému príkazu */}
      {diffs.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Zmeny oproti schválenému Cestovnému príkazu
          </p>
          <div className="space-y-1.5">
            {diffs.map((d) => (
              <div key={d.label} className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
                <span className="text-amber-600 dark:text-amber-400 font-medium pt-0.5">{d.label}</span>
                <span>
                  <span className="line-through text-gray-400 dark:text-gray-500">{d.original}</span>
                  <span className="mx-1.5 text-amber-500">→</span>
                  <span className="font-medium text-amber-800 dark:text-amber-300">{d.changed}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zmeny po zamietnutí */}
      {rejDiffs.length > 0 && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
            Zmeny oproti zamietnutému vyúčtovaniu ({rejectedByLabel})
          </p>
          <div className="space-y-1.5">
            {rejDiffs.map((d) => (
              <div key={d.label} className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
                <span className="text-rose-600 dark:text-rose-400 font-medium pt-0.5">{d.label}</span>
                <span>
                  <span className="line-through text-gray-400 dark:text-gray-500">{d.original}</span>
                  <span className="mx-1.5 text-rose-500">→</span>
                  <span className="font-medium text-rose-800 dark:text-rose-300">{d.changed}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Row label="Skutočný odchod" value={fmtDateTime(er.actualDepartureAt)} />
      <Row label="Skutočný návrat" value={fmtDateTime(er.actualReturnAt)} />
      <Row label="Skutočné trvanie" value={`${hours.toFixed(1)} h`} />
      <Row label="Dopravný prostriedok" value={effectiveTransport.map(t => transportMeansLabels[t]).join(", ")} />
      {er.actualTransport?.length && er.actualVehicleRegPlate && (
        <Row label="EČV vozidla" value={er.actualVehicleRegPlate} />
      )}

      {effectiveTransport.includes("VEREJNY_TRANSPORT") && er.publicTransportCost != null && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Verejná doprava (§8)</p>
          {er.publicTransportItems
            ? (() => {
                try {
                  const items = JSON.parse(er.publicTransportItems) as { description: string; amount: number }[]
                  return (
                    <>
                      {items.map((item, i) => (
                        <Row key={i} label={item.description || `Položka ${i + 1}`} value={`${item.amount.toFixed(2)} €`} />
                      ))}
                      {items.length > 1 && <Row label="Verejná doprava spolu" value={fmtEUR(er.publicTransportCost)} />}
                    </>
                  )
                } catch { return <Row label="Náklady na cestovné" value={fmtEUR(er.publicTransportCost)} /> }
              })()
            : <Row label="Náklady na cestovné" value={fmtEUR(er.publicTransportCost)} />
          }
        </div>
      )}

      {effectiveTransport.includes("TAXIK") && er.taxiCost != null && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Taxi</p>
          <Row label="Náklady na taxi" value={fmtEUR(er.taxiCost)} />
        </div>
      )}

      {orderType !== "ZAHRANICNY" && dayInfos.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Diéty (§5 zák. 283/2002)</p>
          <div className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium text-gray-500">Dátum</th>
                  <th className="text-center px-2 py-1.5 font-medium text-gray-500">R</th>
                  <th className="text-center px-2 py-1.5 font-medium text-gray-500">O</th>
                  <th className="text-center px-2 py-1.5 font-medium text-gray-500">V</th>
                  <th className="text-right px-2 py-1.5 font-medium text-gray-500">Diéta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {dayInfos.map((d) => (
                  <tr key={d.date} className={d.hours < 5 ? "opacity-40" : ""}>
                    <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{formatLocalDate(d.date)}</td>
                    <td className="px-2 py-1.5 text-center">{d.breakfast ? "✓" : "—"}</td>
                    <td className="px-2 py-1.5 text-center">{d.lunch ? "✓" : "—"}</td>
                    <td className="px-2 py-1.5 text-center">{d.dinner ? "✓" : "—"}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300">
                      {d.hours < 5 ? "—" : `${d.dietAmount.toFixed(2)} €`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Row label="Diéty spolu" value={fmtEUR(er.dietAmount)} />
        </div>
      )}

      {isOwnVehicle && er.kmDriven && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Náhrada za km (§7)</p>
          <Row label="Počet km" value={`${er.kmDriven} km`} />
          {er.kmBasicRate && <Row label="Základná náhrada/km" value={`${er.kmBasicRate} €`} />}
          {er.fuelConsumption && er.fuelPricePerL && (
            <Row label="Náhrada za PHM/km" value={`${((er.fuelConsumption / 100) * er.fuelPricePerL).toFixed(4)} €`} />
          )}
          <Row label="Náhrada za km spolu" value={fmtEUR(er.kmCompensation)} />
        </div>
      )}

      {orderType === "ZAHRANICNY" && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Zahraničné náhrady</p>
          <Row label="Zahraničná diéta" value={er.foreignDiet != null ? `${er.foreignDiet.toFixed(2)}` : "—"} />
          <Row label="Vreckové vyplatené" value={er.pocketMoneyPaid != null ? `${er.pocketMoneyPaid.toFixed(2)}` : "—"} />
          <Row label="Výmenný kurz" value={er.exchangeRate != null ? String(er.exchangeRate) : "—"} />
        </div>
      )}

      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ostatné výdavky</p>
        {er.accommodationItems
          ? (() => {
              try {
                const items = JSON.parse(er.accommodationItems) as { description: string; price: number; companyCard: number; employee: number }[]
                return (
                  <>
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-52 shrink-0 pt-0.5">
                          {item.description || `Ubytovanie ${i + 1}`}
                        </span>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {item.price.toFixed(2)} €
                          {(item.companyCard > 0 || item.employee > 0) && (
                            <span className="text-xs text-gray-400 ml-2">
                              (karta: {item.companyCard.toFixed(2)} € · zamestnanec: {item.employee.toFixed(2)} €)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    <Row label="Ubytovanie spolu" value={fmtEUR(er.accommodation)} />
                  </>
                )
              } catch { return <Row label="Ubytovanie" value={fmtEUR(er.accommodation)} /> }
            })()
          : <Row label="Ubytovanie" value={fmtEUR(er.accommodation)} />
        }
        <Row label="Parkovné" value={fmtEUR(er.parking)} />
        {er.otherExpenseItems
          ? (() => {
              try {
                const items = JSON.parse(er.otherExpenseItems) as { description: string; amount: number }[]
                return items.map((item, i) => (
                  <Row key={i} label={item.description || "Iný výdavok"} value={`${item.amount.toFixed(2)} €`} />
                ))
              } catch { return null }
            })()
          : er.otherExpenses != null && <Row label="Iné výdavky" value={fmtEUR(er.otherExpenses)} />
        }
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Rekapitulácia</p>
        <Row label="Celkové výdavky" value={fmtEUR(er.totalExpenses)} />
        <Row label="Preddavok prijatý" value={fmtEUR(er.advanceReceived)} />
        <div className="flex gap-4 pt-1">
          <span className="text-xs text-gray-500 w-52 shrink-0 pt-0.5">
            {balance > 0.005 ? "Doplatiť zamestnancovi" : balance < -0.005 ? "Vrátiť preddavok" : "Vyrovnané"}
          </span>
          <span className={`text-sm font-semibold ${balance > 0.005 ? "text-green-600" : balance < -0.005 ? "text-red-600" : "text-gray-600"}`}>
            {Math.abs(balance).toFixed(2)} €
          </span>
        </div>
      </div>
    </div>
  )
}
