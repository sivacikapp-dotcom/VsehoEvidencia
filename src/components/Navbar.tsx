"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  Bell, X, LogOut, KeyRound, Sun, Moon, Loader2,
  Eye, EyeOff, ChevronDown, Timer,
  Package, RotateCcw, FileText, Trash2, Plane,
  CheckCircle2, XCircle, ShieldAlert, ShieldCheck,
} from "lucide-react"
import type { Role } from "@/generated/prisma/enums"
import { useTheme } from "./ThemeProvider"
import { changePassword } from "@/app/dashboard/my-card/actions"
import { dismissNotification } from "@/app/dashboard/notifications/actions"

export type SoftNotification = {
  id: number
  type: string
  title: string
  message: string
  createdAt: string
  assetId: number | null
  travelOrderId: number | null
  documentId: number | null
}

interface NavbarProps {
  user: { name: string; email: string; roles: Role[]; username?: string | null; isAdminAccount?: boolean }
  notifications: SoftNotification[]
}

const roleLabels: Record<Role, string> = {
  PRIJEMCA:                 "Príjemca",
  NADRIADENY:               "Nadriadený",
  BEZPECNOSTNY_PRACOVNIK:   "BP",
  SPRAVCA_MAJETKU:          "Správca majetku",
  SPRAVCA_PRACOVNYCH_CIEST: "Správca PC",
  SPRAVCA_APLIKACIE:        "Správca aplikácie",
  SPRAVCA_REGISTRATURY:     "Správca registratúry",
  PRACOVNIK_PODATELNE:      "Prac. podateľne",
  SPRACOVATEL_REGISTRATURY: "Spracovateľ",
  SPRAVCA_DOKUMENTOV:       "Správca dokumentov",
  GESTOR_AGENDY:            "Gestor agendy",
  GESTOR_DOKUMENTU:         "Gestor dokumentu",
}

const roleBadgeColors: Record<Role, string> = {
  PRIJEMCA:                 "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  NADRIADENY:               "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  BEZPECNOSTNY_PRACOVNIK:   "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  SPRAVCA_MAJETKU:          "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  SPRAVCA_PRACOVNYCH_CIEST: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  SPRAVCA_APLIKACIE:        "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  SPRAVCA_REGISTRATURY:     "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  PRACOVNIK_PODATELNE:      "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  SPRACOVATEL_REGISTRATURY: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  SPRAVCA_DOKUMENTOV:       "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  GESTOR_AGENDY:            "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  GESTOR_DOKUMENTU:         "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
}

const NOTIF_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  ASSET_CHANGED:              { icon: Package,      color: "text-blue-500" },
  ASSET_ASSIGNED:             { icon: Package,      color: "text-green-500" },
  ASSET_RETURNED:             { icon: RotateCcw,    color: "text-orange-500" },
  ASSET_ACCEPTED:             { icon: CheckCircle2, color: "text-teal-500" },
  DOCUMENT_ADDED:             { icon: FileText,     color: "text-indigo-500" },
  DOCUMENT_DELETED:           { icon: Trash2,       color: "text-red-500" },
  TRAVEL_ORDER_SUBMITTED:     { icon: Plane,        color: "text-blue-500" },
  TRAVEL_ORDER_FOR_MANAGER:   { icon: Plane,        color: "text-amber-500" },
  TRAVEL_ORDER_APPROVED:      { icon: CheckCircle2, color: "text-green-500" },
  TRAVEL_ORDER_REJECTED:      { icon: XCircle,      color: "text-red-500" },
  EXPENSE_REPORT_SUBMITTED:   { icon: Plane,        color: "text-blue-500" },
  EXPENSE_REPORT_FOR_MANAGER: { icon: Plane,        color: "text-amber-500" },
  EXPENSE_REPORT_APPROVED:    { icon: CheckCircle2, color: "text-green-500" },
  EXPENSE_REPORT_REJECTED:    { icon: XCircle,      color: "text-red-500" },
  ACCOUNT_LOCKED:             { icon: ShieldAlert,  color: "text-red-500" },
  SUSPICIOUS_LOGIN:           { icon: ShieldAlert,  color: "text-orange-500" },
  ASSET_CHANGE_REJECTED:      { icon: XCircle,      color: "text-red-500" },
  ADMIN_PASSWORD_CHANGED:     { icon: ShieldAlert,  color: "text-orange-500" },
  ADMIN_ROLE_CHANGED:         { icon: ShieldCheck,  color: "text-orange-500" },
}

function formatRemaining(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  return `${m}:${String(sec).padStart(2, "0")}`
}

// ── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPwd, setOldPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const inputCls =
    "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  async function handleSubmit() {
    setError("")
    if (!oldPwd) { setError("Zadajte aktuálne heslo."); return }
    if (!newPwd) { setError("Zadajte nové heslo."); return }
    if (newPwd !== confirmPwd) { setError("Nové heslá sa nezhodujú."); return }
    setPending(true)
    const res = await changePassword(oldPwd, newPwd)
    setPending(false)
    if (res.error) { setError(res.error); return }
    setSuccess(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Zmena hesla</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <KeyRound size={22} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Heslo bolo úspešne zmenené.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              Zavrieť
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { label: "Aktuálne heslo", value: oldPwd, set: setOldPwd, show: showOld, setShow: setShowOld, auto: "current-password" as const, focus: true },
              { label: "Nové heslo",     value: newPwd, set: setNewPwd, show: showNew, setShow: setShowNew, auto: "new-password" as const, focus: false },
              { label: "Potvrdiť nové heslo", value: confirmPwd, set: setConfirmPwd, show: showConfirm, setShow: setShowConfirm, auto: "new-password" as const, focus: false },
            ].map(({ label, value, set, show, setShow, auto, focus }, i) => (
              <div key={i}>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {label} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={e => set(e.target.value)}
                    onKeyDown={i === 2 ? e => e.key === "Enter" && handleSubmit() : undefined}
                    className={inputCls}
                    autoComplete={auto}
                    autoFocus={focus}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {i === 1 && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Min. 10 znakov, aspoň 1 veľké, 1 malé písmeno a 1 číslica.
                  </p>
                )}
                {i === 2 && newPwd && confirmPwd && newPwd !== confirmPwd && (
                  <p className="mt-1 text-xs text-red-500">Heslá sa nezhodujú.</p>
                )}
              </div>
            ))}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                Zrušiť
              </button>
              <button
                onClick={handleSubmit}
                disabled={pending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                Zmeniť heslo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Navbar ───────────────────────────────────────────────────────────────

export default function Navbar({ user, notifications }: NavbarProps) {
  const isAdmin = user.isAdminAccount ?? false
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const { data: sessionData, update } = useSession()

  const [showNotif, setShowNotif] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [remaining, setRemaining] = useState<number | null>(null)

  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Session countdown
  useEffect(() => {
    const expires = sessionData?.expires
    if (!expires) return
    const tick = () => {
      const rem = Math.max(0, new Date(expires).getTime() - Date.now())
      setRemaining(rem)
      if (rem === 0) signOut({ callbackUrl: "/login" })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sessionData?.expires])

  // Extend session on activity
  useEffect(() => {
    let last = 0
    const handle = () => {
      const now = Date.now()
      if (now - last > 60_000) { last = now; update() }
    }
    window.addEventListener("click", handle)
    window.addEventListener("keydown", handle)
    return () => { window.removeEventListener("click", handle); window.removeEventListener("keydown", handle) }
  }, [update])

  // Close dropdowns on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  async function handleDismiss(id: number) {
    setDismissed(prev => new Set(prev).add(id))
    await dismissNotification(id)
    router.refresh()
  }

  const visible = notifications.filter(n => !dismissed.has(n.id))
  const initials = user.name.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2)

  return (
    <>
      {/* ── Admin Mode Banner ── */}
      {isAdmin && (
        <div className="shrink-0 h-8 bg-orange-500 dark:bg-orange-600 flex items-center justify-center gap-2 px-4">
          <ShieldCheck size={14} className="text-white" />
          <span className="text-xs font-bold tracking-widest text-white uppercase">
            Administrátorský režim
          </span>
          <ShieldCheck size={14} className="text-white" />
        </div>
      )}
      <header className={`h-14 shrink-0 border-b flex items-center justify-end px-5 gap-1.5 ${
        isAdmin
          ? "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
      }`}>

        {/* ── Notification Bell ── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotif(v => !v); setShowProfile(false) }}
            className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Notifikácie"
          >
            <Bell size={18} />
            {visible.length > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1 leading-none">
                {visible.length > 99 ? "99+" : visible.length}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-1.5 w-[380px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifikácie</p>
                {visible.length > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{visible.length} nových</span>
                )}
              </div>

              {visible.length === 0 ? (
                <div className="py-10 flex flex-col items-center text-gray-400 dark:text-gray-500">
                  <Bell size={28} className="opacity-30 mb-2" />
                  <p className="text-sm">Žiadne nové notifikácie</p>
                </div>
              ) : (
                <div className="max-h-[440px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {visible.map(n => {
                    const cfg = NOTIF_CONFIG[n.type] ?? { icon: Bell, color: "text-gray-400" }
                    const Icon = cfg.icon
                    return (
                      <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                          <Icon size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">{n.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 whitespace-pre-line line-clamp-2">{n.message}</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{n.createdAt}</p>
                        </div>
                        <button
                          onClick={() => handleDismiss(n.id)}
                          className="shrink-0 p-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 rounded transition-colors"
                          title="Zatvoriť"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Profile Button ── */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowProfile(v => !v); setShowNotif(false) }}
            className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-lg transition-colors ${
              isAdmin
                ? "hover:bg-orange-100 dark:hover:bg-orange-900/30"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
              isAdmin ? "bg-orange-500" : "bg-blue-600"
            }`}>
              {isAdmin ? <ShieldCheck size={14} /> : initials}
            </div>
            <span className="hidden sm:block text-sm font-medium text-gray-800 dark:text-gray-200 max-w-[140px] truncate">
              {user.name}
            </span>
            <ChevronDown size={13} className={`text-gray-400 transition-transform duration-150 ${showProfile ? "rotate-180" : ""}`} />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
              {/* User info block */}
              <div className={`px-4 py-4 border-b ${isAdmin ? "border-orange-100 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-950/30" : "border-gray-100 dark:border-gray-800"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isAdmin ? "bg-orange-500" : "bg-blue-600"}`}>
                    {isAdmin ? <ShieldCheck size={18} /> : initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
                    {user.username && (
                      <p className={`text-xs font-mono truncate ${isAdmin ? "text-orange-600 dark:text-orange-400" : "text-gray-400 dark:text-gray-500"}`}>
                        @{user.username}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {user.roles.map(role => (
                    <span key={role} className={`text-[11px] font-medium rounded px-1.5 py-0.5 ${roleBadgeColors[role]}`}>
                      {roleLabels[role]}
                    </span>
                  ))}
                </div>
                {remaining !== null && (
                  <div className={`flex items-center gap-1.5 mt-2.5 text-xs font-mono ${
                    remaining < 5 * 60 * 1000  ? "text-red-500 dark:text-red-400" :
                    remaining < 10 * 60 * 1000 ? "text-amber-500 dark:text-amber-400" :
                    "text-gray-400 dark:text-gray-500"
                  }`}>
                    <Timer size={11} />
                    <span>Relácia: {formatRemaining(remaining)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={toggle}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                  {theme === "dark" ? "Svetlý režim" : "Tmavý režim"}
                </button>
                <button
                  onClick={() => { setShowChangePwd(true); setShowProfile(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <KeyRound size={15} />
                  Zmeniť heslo
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <LogOut size={15} />
                  Odhlásiť sa
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  )
}
