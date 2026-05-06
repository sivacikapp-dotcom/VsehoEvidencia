"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
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
} from "lucide-react"
import type { Role } from "@/generated/prisma/enums"
import { useTheme } from "./ThemeProvider"

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

const navSections: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [] },
    ],
  },
  {
    title: "Evidencia majetku",
    items: [
      { href: "/dashboard/assets", label: "Majetok", icon: Package, roles: ["SPRAVCA_KARIET", "BEZPECNOSTNY_PRACOVNIK"] },
      { href: "/dashboard/my-assets", label: "Moje priradenia", icon: User, roles: ["PRIJEMCA"] },
      { href: "/dashboard/my-card", label: "Moja karta", icon: CreditCard, roles: [] },
      { href: "/dashboard/users", label: "Používatelia", icon: Users, roles: [] },
      { href: "/dashboard/rooms", label: "Miestnosti", icon: Building2, roles: ["SPRAVCA_KARIET"] },
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
    ],
  },
  {
    title: "Nastavenia",
    items: [
      { href: "/dashboard/nastavenia/sadzby", label: "Sadzby PC", icon: Settings, roles: ["SPRAVCA_PC"] },
    ],
  },
]

const roleLabels: Record<Role, string> = {
  SPRAVCA_KARIET: "Správca kariet",
  BEZPECNOSTNY_PRACOVNIK: "BP",
  NADRIADENY: "Nadriadený",
  PRIJEMCA: "Príjemca",
  SPRAVCA_PC: "Správca PC",
}

const roleBadgeColors: Record<Role, string> = {
  SPRAVCA_KARIET: "bg-blue-900 text-blue-200",
  BEZPECNOSTNY_PRACOVNIK: "bg-red-900 text-red-200",
  NADRIADENY: "bg-green-900 text-green-200",
  PRIJEMCA: "bg-gray-700 text-gray-300",
  SPRAVCA_PC: "bg-teal-900 text-teal-200",
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-6 py-5 border-b border-gray-700/60">
        <h1 className="text-base font-semibold text-white tracking-tight">
          VšehoEvidencia
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Správa organizácie</p>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navSections.map((section) => {
          const visible = section.items.filter(
            (item) => item.roles.length === 0 || item.roles.some((r) => user.roles.includes(r))
          )
          if (visible.length === 0) return null
          return (
            <div key={section.title ?? "__top"}>
              {section.title && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {visible.map(({ href, label, icon: Icon }) => {
                  const active =
                    pathname === href ||
                    (href !== "/dashboard" && pathname.startsWith(href))
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
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut size={15} />
          Odhlásiť sa
        </button>
      </div>
    </aside>
  )
}
