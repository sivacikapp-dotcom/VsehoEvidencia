"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, X, Loader2, Trash2 } from "lucide-react"
import { createUser, deleteUser } from "./actions"
import type { Role } from "@/generated/prisma/enums"

const ROLE_GROUPS: { label: string; roles: { value: Role; label: string }[] }[] = [
  {
    label: "Aplikácia",
    roles: [
      { value: "SPRAVCA_APLIKACIE", label: "Správca aplikácie" },
    ],
  },
  {
    label: "Registratúra",
    roles: [
      { value: "SPRAVCA_REGISTRATURY",     label: "Správca registratúry" },
      { value: "PRACOVNIK_PODATELNE",       label: "Prac. podateľne" },
      { value: "SPRACOVATEL_REGISTRATURY",  label: "Spracovateľ registratúry" },
    ],
  },
  {
    label: "Pracovné cesty",
    roles: [
      { value: "SPRAVCA_PRACOVNYCH_CIEST", label: "Správca pracovných ciest" },
    ],
  },
  {
    label: "Dokumenty",
    roles: [
      { value: "SPRAVCA_DOKUMENTOV", label: "Správca dokumentov" },
      { value: "GESTOR_AGENDY",       label: "Gestor agendy" },
      { value: "GESTOR_DOKUMENTU",    label: "Gestor dokumentu" },
    ],
  },
  {
    label: "Majetok",
    roles: [
      { value: "SPRAVCA_MAJETKU", label: "Správca majetku" },
      { value: "PRIJEMCA",         label: "Príjemca" },
    ],
  },
  {
    label: "Ostatné",
    roles: [
      { value: "BEZPECNOSTNY_PRACOVNIK", label: "Bezpečnostný pracovník" },
      { value: "NADRIADENY",              label: "Nadriadený" },
    ],
  },
]

const roleBadge: Record<Role, string> = {
  PRIJEMCA: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  NADRIADENY: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  BEZPECNOSTNY_PRACOVNIK: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  SPRAVCA_MAJETKU: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  SPRAVCA_PRACOVNYCH_CIEST: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  SPRAVCA_APLIKACIE: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  SPRAVCA_REGISTRATURY: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
  PRACOVNIK_PODATELNE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  SPRACOVATEL_REGISTRATURY: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  SPRAVCA_DOKUMENTOV: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  GESTOR_AGENDY: "bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300",
  GESTOR_DOKUMENTU: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
}

const roleLabel: Record<Role, string> = {
  PRIJEMCA: "Príjemca",
  NADRIADENY: "Nadriadený",
  BEZPECNOSTNY_PRACOVNIK: "BP",
  SPRAVCA_MAJETKU: "Správca majetku",
  SPRAVCA_PRACOVNYCH_CIEST: "Správca PC",
  SPRAVCA_APLIKACIE: "Spr. aplikácie",
  SPRAVCA_REGISTRATURY: "Spr. registratúry",
  PRACOVNIK_PODATELNE: "Prac. podateľne",
  SPRACOVATEL_REGISTRATURY: "Spracovateľ",
  SPRAVCA_DOKUMENTOV: "Spr. dokumentov",
  GESTOR_AGENDY: "Gestor agendy",
  GESTOR_DOKUMENTU: "Gestor dok.",
}

type User = {
  id: number
  firstName: string
  lastName: string
  email: string
  roles: Role[]
  supervisorId: number | null
  supervisorName: string | null
  totalAssignments: number
}

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  )
}

function RoleCheckboxes({ selected, onChange }: { selected: Role[]; onChange: (r: Role[]) => void }) {
  function toggle(value: Role) {
    onChange(selected.includes(value) ? selected.filter((r) => r !== value) : [...selected, value])
  }
  return (
    <div className="space-y-3">
      {ROLE_GROUPS.map((group, gi) => (
        <div key={group.label}>
          {gi > 0 && <div className="border-t border-gray-100 dark:border-gray-700/60 mb-3" />}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.roles.map(({ value, label }) => {
              const checked = selected.includes(value)
              return (
                <label key={value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                  checked
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                }`}>
                  <input type="checkbox" className="hidden" checked={checked} onChange={() => toggle(value)} />
                  {label}
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── New User Modal ─────────────────────────────────────────────────────────
function NewUserModal({ users, onClose }: { users: User[]; onClose: () => void }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [roles, setRoles] = useState<Role[]>(["PRIJEMCA"])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setPending(true)
    setError("")

    const fd = new FormData(formRef.current)
    roles.forEach((r) => fd.append("roles", r))

    const result = await createUser(fd)
    setPending(false)
    if (result.error) setError(result.error)
    else { router.refresh(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nový používateľ</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Meno" required>
                <input type="text" name="firstName" required className={inputCls} />
              </Field>
              <Field label="Priezvisko" required>
                <input type="text" name="lastName" required className={inputCls} />
              </Field>
            </div>
            <Field label="Email" required hint="Platná e-mailová adresa (napr. meno@firma.sk)">
              <input type="email" name="email" required className={inputCls} placeholder="meno@firma.sk" autoComplete="off" />
            </Field>
            <Field label="Heslo (počiatočné)" required hint="Min. 10 znakov, aspoň 1 veľké, 1 malé písmeno a 1 číslica.">
              <input type="password" name="password" required minLength={10} className={inputCls} autoComplete="new-password" />
            </Field>
            <Field label="Role" required>
              <RoleCheckboxes selected={roles} onChange={setRoles} />
            </Field>
            <Field label="Nadriadený">
              <select name="supervisorId" className={inputCls} defaultValue="">
                <option value="">— bez nadriadeného —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.lastName} {u.firstName}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            {error ? <p className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</p> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                Zrušiť
              </button>
              <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {pending && <Loader2 size={14} className="animate-spin" />}
                {pending ? "Ukladám..." : "Vytvoriť"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function UsersClient({ users, canManage = false }: { users: User[]; canManage?: boolean }) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleDelete(u: User) {
    if (!confirm(`Naozaj chcete zmazať používateľa ${u.lastName} ${u.firstName}?`)) return
    setDeletingId(u.id)
    const res = await deleteUser(u.id)
    setDeletingId(null)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Používatelia</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{users.length} používateľov</p>
        </div>
        {canManage ? (
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus size={15} />
            Nový používateľ
          </button>
        ) : (
          <span className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg">
            Len na čítanie
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {["ID", "Priezvisko, Meno", "Email", "Role", "Nadriadený", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3 text-xs font-mono text-gray-400 dark:text-gray-500">{u.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  <Link href={`/dashboard/users/${u.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors">
                    {u.lastName} {u.firstName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[r]}`}>
                        {roleLabel[r]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">
                  {u.supervisorName ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium disabled:opacity-50"
                      >
                        {deletingId === u.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        Zmazať
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  Žiadni používatelia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && <NewUserModal users={users} onClose={() => setShowNew(false)} />}
    </div>
  )
}
