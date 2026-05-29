"use client"

import { useState } from "react"
import { Loader2, Check } from "lucide-react"
import { updateRegistraturaRoles } from "./actions"

type UserRow = {
  id: number
  firstName: string
  lastName: string
  hasPodatelna: boolean
  hasSpracovatel: boolean
}

type Tab = "plan" | "role" | "ine"

const TABS: { key: Tab; label: string }[] = [
  { key: "plan", label: "Registratúrny plán" },
  { key: "role", label: "Správa rolí" },
  { key: "ine", label: "Iné nastavenia" },
]

export default function NastaveniaRegistraturyClient({ users: initial }: { users: UserRow[] }) {
  const [tab, setTab] = useState<Tab>("plan")
  const [users, setUsers] = useState(initial)
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  async function toggle(userId: number, field: "hasPodatelna" | "hasSpracovatel") {
    const key = `${userId}-${field}`
    if (saving[key]) return

    const user = users.find(u => u.id === userId)!
    const next = { ...user, [field]: !user[field] }

    setUsers(prev => prev.map(u => (u.id === userId ? next : u)))
    setSaving(prev => ({ ...prev, [key]: true }))

    const res = await updateRegistraturaRoles(userId, next.hasPodatelna, next.hasSpracovatel)
    setSaving(prev => ({ ...prev, [key]: false }))

    if (res.error) {
      setUsers(prev => prev.map(u => (u.id === userId ? user : u)))
      alert(res.error)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Nastavenia registratúry
      </h1>

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Registratúrny plán */}
      {tab === "plan" && (
        <p className="text-sm italic text-gray-400 dark:text-gray-500">
          Obsah bude doplnený.
        </p>
      )}

      {/* Správa rolí */}
      {tab === "role" && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Priezvisko, Meno
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-44">
                  Prac. podateľne
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-44">
                  Spracovateľ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {u.lastName} {u.firstName}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ToggleCell
                      checked={u.hasPodatelna}
                      loading={!!saving[`${u.id}-hasPodatelna`]}
                      onChange={() => toggle(u.id, "hasPodatelna")}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ToggleCell
                      checked={u.hasSpracovatel}
                      loading={!!saving[`${u.id}-hasSpracovatel`]}
                      onChange={() => toggle(u.id, "hasSpracovatel")}
                    />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">
                    Žiadni používatelia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Iné nastavenia */}
      {tab === "ine" && (
        <p className="text-sm italic text-gray-400 dark:text-gray-500">
          Obsah bude doplnený.
        </p>
      )}
    </div>
  )
}

function ToggleCell({
  checked,
  loading,
  onChange,
}: {
  checked: boolean
  loading: boolean
  onChange: () => void
}) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      title={checked ? "Odobrať rolu" : "Priradiť rolu"}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-50 ${
        checked
          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
          : "bg-gray-100 dark:bg-gray-700/60 text-gray-300 dark:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
    </button>
  )
}
