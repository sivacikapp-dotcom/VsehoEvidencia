"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import {
  LayoutDashboard,
  Package,
  User,
  Users,
  Building2,
  CreditCard,
  FolderOpen,
  Plane,
  Settings,
  ScrollText,
  CheckCheck,
  ChevronDown,
  Inbox,
  FileText,
  Folders,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react"
import type { Role } from "@/generated/prisma/enums"

interface SidebarProps {
  user: {
    roles: Role[]
  }
}

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  color: string
  roles: Role[]
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-slate-400", roles: [] },
    ],
  },
  {
    title: "Evidencia majetku",
    items: [
      { href: "/dashboard/assets",    label: "Majetok",         icon: Package,    color: "text-orange-400",  roles: ["SPRAVCA_MAJETKU", "BEZPECNOSTNY_PRACOVNIK", "SPRAVCA_APLIKACIE"] },
      { href: "/dashboard/my-assets", label: "Moje priradenia", icon: User,       color: "text-violet-400",  roles: ["PRIJEMCA"] },
      { href: "/dashboard/my-card",   label: "Moja karta",      icon: CreditCard, color: "text-emerald-400", roles: [] },
      { href: "/dashboard/rooms",     label: "Miestnosti",      icon: Building2,  color: "text-cyan-400",    roles: ["SPRAVCA_MAJETKU", "SPRAVCA_APLIKACIE"] },
    ],
  },
  {
    title: "Interné dokumenty",
    items: [
      { href: "/dashboard/dokumenty",            label: "Dokumenty",  icon: FolderOpen,        color: "text-blue-400",  roles: [] },
      { href: "/dashboard/dokumenty/nastavenia", label: "Nastavenia", icon: SlidersHorizontal, color: "text-slate-400", roles: ["SPRAVCA_DOKUMENTOV"] },
    ],
  },
  {
    title: "Pracovné cesty",
    items: [
      { href: "/dashboard/pracovne-cesty",            label: "Cestovné príkazy", icon: Plane,      color: "text-sky-400",    roles: [] },
      { href: "/dashboard/pracovne-cesty/vyuctovane", label: "Vyúčtované cesty", icon: CheckCheck, color: "text-green-400",  roles: [] },
      { href: "/dashboard/nastavenia/sadzby",         label: "Sadzby PC",        icon: Settings,   color: "text-amber-400",  roles: ["SPRAVCA_PRACOVNYCH_CIEST", "SPRAVCA_APLIKACIE"] },
    ],
  },
  {
    title: "Registratúra",
    items: [
      { href: "/dashboard/registratura/podatelna", label: "Podateľňa",          icon: Inbox,       color: "text-teal-400",   roles: ["PRACOVNIK_PODATELNE", "SPRAVCA_REGISTRATURY", "SPRAVCA_APLIKACIE"] },
      { href: "/dashboard/registratura/zaznamy",   label: "Záznamy",             icon: FileText,    color: "text-indigo-400", roles: ["SPRACOVATEL_REGISTRATURY", "SPRAVCA_REGISTRATURY", "SPRAVCA_APLIKACIE"] },
      { href: "/dashboard/registratura/spisy",     label: "Spisy",               icon: Folders,     color: "text-violet-400", roles: ["SPRACOVATEL_REGISTRATURY", "SPRAVCA_REGISTRATURY", "SPRAVCA_APLIKACIE"] },
      { href: "/dashboard/registratura/admin",      label: "Správa rolí",  icon: ShieldCheck,       color: "text-rose-400",  roles: ["SPRAVCA_REGISTRATURY", "SPRAVCA_APLIKACIE"] },
      { href: "/dashboard/registratura/nastavenia", label: "Nastavenia",  icon: SlidersHorizontal, color: "text-slate-400", roles: ["SPRAVCA_REGISTRATURY"] },
    ],
  },
  {
    title: "Nastavenia",
    items: [
      { href: "/dashboard/users",      label: "Používatelia", icon: Users,      color: "text-purple-400", roles: [] },
      { href: "/dashboard/admin/logs", label: "Audit Log",    icon: ScrollText, color: "text-rose-400",   roles: ["SPRAVCA_MAJETKU", "SPRAVCA_APLIKACIE"] },
    ],
  },
]

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const [mounted, setMounted] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem("ve_sidebar_collapsed")
      if (stored) setCollapsed(JSON.parse(stored))
    } catch {}
  }, [])

  function toggleSection(title: string) {
    setCollapsed(prev => {
      const next = { ...prev, [title]: !prev[title] }
      try { localStorage.setItem("ve_sidebar_collapsed", JSON.stringify(next)) } catch {}
      return next
    })
  }

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-6 py-5 border-b border-gray-700/60">
        <h1 className="text-base font-semibold text-white tracking-tight">VšehoEvidencia</h1>
        <p className="text-xs text-gray-500 mt-0.5">Správa organizácie</p>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navSections.map((section) => {
          const visible = section.items.filter(
            item => item.roles.length === 0 || item.roles.some(r => user.roles.includes(r))
          )
          if (visible.length === 0) return null

          const longestMatchHref = mounted
            ? visible
                .filter(item => pathname === item.href || pathname.startsWith(item.href + "/"))
                .reduce<string | undefined>((best, item) =>
                  item.href.length > (best?.length ?? 0) ? item.href : best,
                  undefined
                )
            : undefined
          const sectionIsActive = mounted && longestMatchHref !== undefined
          // aktívna sekcia sa nedá zbaliť
          const isCollapsed = section.title ? ((collapsed[section.title] ?? false) && !sectionIsActive) : false

          return (
            <div key={section.title ?? "__top"}>
              {section.title && (
                <button
                  type="button"
                  onClick={() => toggleSection(section.title!)}
                  className="flex items-center justify-between w-full px-3 mb-1 group"
                >
                  <div className="flex items-center gap-2">
                    {sectionIsActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <span className={`text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                      sectionIsActive
                        ? "text-blue-400"
                        : "text-gray-500 group-hover:text-gray-400"
                    }`}>
                      {section.title}
                    </span>
                  </div>
                  <ChevronDown
                    size={12}
                    className={`transition-all duration-200 ${
                      sectionIsActive ? "text-blue-500" : "text-gray-600 group-hover:text-gray-400"
                    } ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>
              )}
              <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${isCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}>
                {visible.map(({ href, label, icon: Icon, color }) => {
                  const active = href === longestMatchHref
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-white" : color} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
