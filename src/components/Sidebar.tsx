"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
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
  roles: Role[]
}

interface NavSection {
  title?: string
  items: NavItem[]
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
      { href: "/dashboard/assets",    label: "Majetok",         icon: Package,    roles: ["SPRAVCA_KARIET", "BEZPECNOSTNY_PRACOVNIK", "SPRAVCA_APLIKACIE"] },
      { href: "/dashboard/my-assets", label: "Moje priradenia", icon: User,       roles: ["PRIJEMCA"] },
      { href: "/dashboard/my-card",   label: "Moja karta",      icon: CreditCard, roles: [] },
      { href: "/dashboard/rooms",     label: "Miestnosti",      icon: Building2,  roles: ["SPRAVCA_KARIET", "SPRAVCA_APLIKACIE"] },
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
      { href: "/dashboard/pracovne-cesty",            label: "Cestovné príkazy", icon: Plane,      roles: [] },
      { href: "/dashboard/pracovne-cesty/vyuctovane", label: "Vyúčtované cesty", icon: CheckCheck, roles: [] },
      { href: "/dashboard/nastavenia/sadzby",         label: "Sadzby PC",        icon: Settings,   roles: ["SPRAVCA_PC", "SPRAVCA_APLIKACIE"] },
    ],
  },
  {
    title: "Nastavenia",
    items: [
      { href: "/dashboard/users",      label: "Používatelia", icon: Users,      roles: [] },
      { href: "/dashboard/admin/logs", label: "Audit Log",    icon: ScrollText, roles: ["SPRAVCA_KARIET", "SPRAVCA_ROLI", "SPRAVCA_APLIKACIE"] },
    ],
  },
]

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

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

          const isCollapsed = section.title ? (collapsed[section.title] ?? false) : false
          const longestMatchHref = visible
            .filter(item => pathname === item.href || pathname.startsWith(item.href + "/"))
            .reduce<string | undefined>((best, item) =>
              item.href.length > (best?.length ?? 0) ? item.href : best,
              undefined
            )

          return (
            <div key={section.title ?? "__top"}>
              {section.title && (
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
              )}
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
    </aside>
  )
}
