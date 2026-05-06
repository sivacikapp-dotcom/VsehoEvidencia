"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Loader2, Pencil, ExternalLink } from "lucide-react"
import Link from "next/link"
import { createUser, updateUser } from "./actions"
import type { Role } from "@/generated/prisma/enums"

const ALL_ROLES: { value: Role; label: string }[] = [
  { value: "PRIJEMCA", label: "Príjemca" },
  { value: "NADRIADENY", label: "Nadriadený" },
  { value: "BEZPECNOSTNY_PRACOVNIK", label: "Bezpečnostný pracovník" },
  { value: "SPRAVCA_KARIET", label: "Správca kariet" },
  { value: "SPRAVCA_PC", label: "Správca pracovných ciest" },
]

const roleBadge: Record<Role, string> = {
  PRIJEMCA: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  NADRIADENY: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  BEZPECNOSTNY_PRACOVNIK: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  SPRAVCA_KARIET: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  SPRAVCA_PC: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
}

const roleLabel: Record<Role, string> = {
  PRIJEMCA: "Príjemca",
  NADRIADENY: "Nadriadený",
  BEZPECNOSTNY_PRACOVNIK: "BP",
  SPRAVCA_KARIET: "Správca",
  SPRAVCA_PC: "Správca PC",
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function RoleCheckboxes({ selected, onChange }: { selected: Role[]; onChange: (r: Role[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_ROLES.map(({ value, label }) => {
        const checked = selected.includes(value)
        return (
          <label key={value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
            checked
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
          }`}>
            <input
              type="checkbox"
              className="hidden"
              checked={checked}
              onChange={() =>
                onChange(checked ? selected.filter((r) => r !== value) : [...selected, value])
              }
            />
            {label}
          </label>
        )
      })}
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
            <Field label="Email" required>
              <input type="email" name="email" required className={inputCls} placeholder="meno@firma.sk" />
            </Field>
            <Field label="Heslo (počiatočné)" required>
              <input type="password" name="password" required minLength={6} className={inputCls} placeholder="min. 6 znakov" />
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

// ── Edit User Modal ────────────────────────────────────────────────────────
function EditUserModal({ user, allUsers, onClose }: { user: User; allUsers: User[]; onClose: () => void }) {
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>(user.roles)
  const [supervisorId, setSupervisorId] = useState<string>(user.supervisorId ? String(user.supervisorId) : "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError("")

    const result = await updateUser(user.id, roles, supervisorId ? parseInt(supervisorId) : null)
    setPending(false)
    if (result.error) setError(result.error)
    else { router.refresh(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Upraviť používateľa</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user.lastName} {user.firstName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <Field label="Role" required>
              <RoleCheckboxes selected={roles} onChange={setRoles} />
            </Field>
            <Field label="Nadriadený">
              <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={inputCls}>
                <option value="">— bez nadriadeného —</option>
                {allUsers.filter((u) => u.id !== user.id).map((u) => (
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
                {pending ? "Ukladám..." : "Uložiť"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function UsersClient({ users }: { users: User[] }) {
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Používatelia</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{users.length} používateľov</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={15} />
          Nový používateľ
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {["ID", "Priezvisko, Meno", "Email", "Role", "Nadriadený", "Priradení", "Akcie"].map((h) => (
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
                  {u.lastName} {u.firstName}
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
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">{u.totalAssignments}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/users/${u.id}`} className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-md font-medium">
                      <ExternalLink size={11} />
                      Karta
                    </Link>
                    <button onClick={() => setEditUser(u)} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium">
                      <Pencil size={11} />
                      Upraviť
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  Žiadni používatelia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && <NewUserModal users={users} onClose={() => setShowNew(false)} />}
      {editUser && <EditUserModal user={editUser} allUsers={users} onClose={() => setEditUser(null)} />}
    </div>
  )
}
