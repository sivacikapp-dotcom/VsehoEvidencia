"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search, Check, X, Shield, Users } from "lucide-react"
import { regRoleLabels } from "@/lib/regLabels"
import type { Role } from "@/generated/prisma/enums"
import { setRegRoles } from "./actions"

const REG_ROLES: Role[] = ["SPRAVCA_REGISTRATURY", "PRACOVNIK_PODATELNE", "SPRACOVATEL_REGISTRATURY"]

type UserRow = {
  id: number
  name: string
  email: string
  regRoles: string[]
}

interface Props {
  users: UserRow[]
}

export default function AdminClient({ users }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editRoles, setEditRoles] = useState<Role[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  function startEdit(user: UserRow) {
    setEditId(user.id)
    setEditRoles(user.regRoles as Role[])
    setError("")
  }

  function toggleRole(role: Role) {
    setEditRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  async function handleSave() {
    if (editId === null) return
    setSaving(true); setError("")
    const result = await setRegRoles(editId, editRoles)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setEditId(null)
    startTransition(() => router.refresh())
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield size={20} className="text-blue-500" />
          Správa rolí registratúry
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Priraďte používateľom prístupové roly pre modul Registratúra
        </p>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {REG_ROLES.map(role => (
          <div key={role} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-900 dark:text-white">{regRoleLabels[role]}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {role === "SPRAVCA_REGISTRATURY" && "Čítanie všetkých záznamov, správa plánov a rolí"}
              {role === "PRACOVNIK_PODATELNE" && "Príjem a registrácia poštových zásielok"}
              {role === "SPRACOVATEL_REGISTRATURY" && "Vytváranie a správa vlastných záznamov a spisov"}
            </p>
          </div>
        ))}
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hľadať používateľa..."
          className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Používateľ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Správca registratúry</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Pracovník podateľne</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Spracovateľ</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                <Users size={20} className="mx-auto mb-2 opacity-40" />
                Žiadni používatelia
              </td></tr>
            )}
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                </td>
                {editId === u.id ? (
                  <>
                    {REG_ROLES.map(role => (
                      <td key={role} className="px-4 py-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={editRoles.includes(role)} onChange={() => toggleRole(role)}
                            className="rounded border-gray-300 text-blue-600" />
                          <span className="text-xs text-gray-600 dark:text-gray-300 sr-only">{regRoleLabels[role]}</span>
                        </label>
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={handleSave} disabled={saving}
                          className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          <Check size={13} className="text-white" />
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <X size={13} className="text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    {REG_ROLES.map(role => (
                      <td key={role} className="px-4 py-3">
                        {u.regRoles.includes(role) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                            <Check size={11} /> Áno
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <button onClick={() => startEdit(u)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        Upraviť
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {error && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
