"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import {
  LayoutDashboard,
  Package,
  User,
  Users,
  Building2,
  LogOut,
  Sun,
  Moon,
  CreditCard,
  FolderOpen,
  Plane,
  Settings,
  ScrollText,
  Timer,
  ChevronDown,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Loader2,
  CheckCheck,
} from "lucide-react"
import type { Role } from "@/generated/prisma/enums"
import { useTheme } from "./ThemeProvider"
import { changePassword } from "@/app/dashboard/my-card/actions"

interface SidebarProps {
  user: {
    name: string
    email: string
    roles: Role[]
  }
}

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: Role[]
}

interface NavSection {
  title?: string
  items: NavItem[]
}

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

  const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

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
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"><X size={18} /></button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <KeyRound size={22} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Heslo bolo úspešne zmenené.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Zavrieť</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Aktuálne heslo <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showOld ? "text" : "password"} value={oldPwd} onChange={e => setOldPwd(e.target.value)} className={inputCls} autoFocus autoComplete="current-password" />
                <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nové heslo <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showNew ? "text" : "password"} value={newPwd} onChange={e => setNewPwd(e.target.value)} className={inputCls} autoComplete="new-password" />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Min. 10 znakov, aspoň 1 veľké, 1 malé písmeno a 1 číslica.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Potvrdiť nové heslo <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} className={inputCls} autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {newPwd && confirmPwd && newPwd !== confirmPwd && (
                <p className="mt-1 text-xs text-red-500">Heslá sa nezhodujú.</p>
              )}
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Zrušiť</button>
              <button onClick={handleSubmit} disabled={pending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
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

const navSections: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [] },
    ],
  },
  {
    title: "Evidencia majetku",
    items: [
      { href: "/dashboard/assets", label: "Majetok", icon: Package, roles: ["SPRAVCA_KARIET", "BEZPECNOSTNY_PRACOVNIK", "SPRAVCA_APLIKACIE"] },
      { href: "/dashboard/my-assets", label: "Moje priradenia", icon: User, roles: ["PRIJEMCA"] },
      { href: "/dashboard/my-card", label: "Moja karta", icon: CreditCard, roles: [] },
      { href: "/dashboard/rooms", label: "Miestnosti", icon: Building2, roles: ["SPRAVCA_KARIET", "SPRAVCA_APLIKACIE"] },
    ],
  },
  {
    title: "Interné dokumenty",
    items: [
      { href: "/dashboard/dokumenty", label: "Dokumenty", icon: FolderOpen, roles: [] },
    ],
  },
  {
    title: "Pracovné cesty",
    items: [
      { href: "/dashboard/pracovne-cesty", label: "Cestovné príkazy", icon: Plane, roles: [] },
      { href: "/dashboard/pracovne-cesty/vyuctovane", label: "Vyúčtované cesty", icon: CheckCheck, roles: [] },
      { href: "/dashboard/nastavenia/sadzby", label: "Sadzby PC", icon: Settings, roles: ["SPRAVCA_PC", "SPRAVCA_APLIKACIE"] },
    ],
  },
  {
    title: "Nastavenia",
    items: [
      { href: "/dashboard/users", label: "Používatelia", icon: Users, roles: [] },
      { href: "/dashboard/admin/logs", label: "Audit Log", icon: ScrollText, roles: ["SPRAVCA_KARIET", "SPRAVCA_ROLI", "SPRAVCA_APLIKACIE"] },
    ],
  },
]

const roleLabels: Record<Role, string> = {
  SPRAVCA_KARIET: "Správca kariet",
  BEZPECNOSTNY_PRACOVNIK: "BP",
  NADRIADENY: "Nadriadený",
  PRIJEMCA: "Príjemca",
  SPRAVCA_PC: "Správca PC",
  SPRAVCA_ROLI: "Správca rolí",
  SPRAVCA_APLIKACIE: "Správca aplikácie",
}

const roleBadgeColors: Record<Role, string> = {
  SPRAVCA_KARIET: "bg-blue-900 text-blue-200",
  BEZPECNOSTNY_PRACOVNIK: "bg-red-900 text-red-200",
  NADRIADENY: "bg-green-900 text-green-200",
  PRIJEMCA: "bg-gray-700 text-gray-300",
  SPRAVCA_PC: "bg-teal-900 text-teal-200",
  SPRAVCA_ROLI: "bg-amber-900 text-amber-200",
  SPRAVCA_APLIKACIE: "bg-violet-900 text-violet-200",
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [showChangePwd, setShowChangePwd] = useState(false)
  const { data: sessionData, update } = useSession()

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {}
    try {
      const stored = localStorage.getItem("ve_sidebar_collapsed")
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  function toggleSection(title: string) {
    setCollapsed(prev => {
      const next = { ...prev, [title]: !prev[title] }
      try { localStorage.setItem("ve_sidebar_collapsed", JSON.stringify(next)) } catch {}
      return next
    })
  }
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const expires = sessionData?.expires
    if (!expires) return
    const tick = () => {
      const rem = Math.max(0, new Date(expires).getTime() - Date.now())
      setRemaining(rem)
      if (rem === 0) signOut({ callbackUrl: "/login" })
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [sessionData?.expires])

  useEffect(() => {
    let lastUpdate = 0
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastUpdate > 60_000) {
        lastUpdate = now
        update()
      }
    }
    window.addEventListener("click", handleActivity)
    window.addEventListener("keydown", handleActivity)
    return () => {
      window.removeEventListener("click", handleActivity)
      window.removeEventListener("keydown", handleActivity)
    }
  }, [update])

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-6 py-5 border-b border-gray-700/60">
        <h1 className="text-base font-semibold text-white tracking-tight">
          VšehoEvidencia
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Správa organizácie</p>
        {remaining !== null && (
          <div className={`flex items-center gap-1.5 mt-2 text-xs font-mono ${
            remaining < 5 * 60 * 1000
              ? "text-red-400"
              : remaining < 10 * 60 * 1000
              ? "text-yellow-400"
              : "text-gray-500"
          }`}>
            <Timer size={11} />
            <span>{formatRemaining(remaining)}</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navSections.map((section) => {
          const visible = section.items.filter(
            (item) => item.roles.length === 0 || item.roles.some((r) => user.roles.includes(r))
          )
          if (visible.length === 0) return null
          const isCollapsed = section.title ? (collapsed[section.title] ?? false) : false
          const longestMatchHref = visible
            .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
            .reduce<string | undefined>((best, item) =>
              item.href.length > (best?.length ?? 0) ? item.href : best,
              undefined
            )
          return (
            <div key={section.title ?? "__top"}>
              {section.title ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.title!)}
                  className="flex items-center justify-between w-full px-3 mb-1 group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors">
                    {section.title}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-gray-600 group-hover:text-gray-400 transition-all duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>
              ) : null}
              <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${isCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}>
                {visible.map(({ href, label, icon: Icon }) => {
                  const active = href === longestMatchHref
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-700/60 space-y-1">
        <div className="px-2 mb-3">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {user.roles.map((role) => (
              <span
                key={role}
                className={`text-xs rounded px-1.5 py-0.5 font-medium ${roleBadgeColors[role]}`}
              >
                {roleLabels[role]}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={toggle}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title={theme === "dark" ? "Prepnúť na svetlý režim" : "Prepnúť na tmavý režim"}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          {theme === "dark" ? "Svetlý režim" : "Tmavý režim"}
        </button>

        <button
          onClick={() => setShowChangePwd(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <KeyRound size={15} />
          Zmeniť heslo
        </button>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut size={15} />
          Odhlásiť sa
        </button>
      </div>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </aside>
  )
}
