"use client"

import { useState, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, X, Loader2, Trash2, ShieldCheck, User as UserIcon, AlertTriangle, Search, ChevronUp, ChevronDown, ArrowUpDown, Layers, Crown } from "lucide-react"
import { createUser, deleteUser } from "./actions"
import type { Role } from "@/generated/prisma/enums"
import { MultiSelect } from "@/components/MultiSelect"
import { FilterSelect } from "@/components/FilterSelect"

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

type SortKey = "id" | "username" | "name" | "email"

const accountTypeOptions = [
  { value: "regular", label: "Bežný účet" },
  { value: "admin",   label: "Admin účet" },
]

const roleFilterOptions = (Object.keys(roleLabel) as Role[]).map(r => ({ value: r, label: roleLabel[r] }))

type User = {
  id: number
  username: string
  firstName: string
  lastName: string
  email: string
  roles: Role[]
  isAdminAccount: boolean
  linkedUserId: number | null
  adminAccounts: { id: number; username: string }[]
  supervisorId: number | null
  supervisorName: string | null
  totalAssignments: number
  utvary: { id: number; nazov: string }[]
  vedouciUtvary: { id: number; nazov: string }[]
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

function RoleCheckboxes({
  selected,
  onChange,
  excludeRoles = [],
}: {
  selected: Role[]
  onChange: (r: Role[]) => void
  excludeRoles?: Role[]
}) {
  function toggle(value: Role) {
    onChange(selected.includes(value) ? selected.filter((r) => r !== value) : [...selected, value])
  }
  const visibleGroups = ROLE_GROUPS.map((g) => ({
    ...g,
    roles: g.roles.filter((r) => !excludeRoles.includes(r.value)),
  })).filter((g) => g.roles.length > 0)

  return (
    <div className="space-y-3">
      {visibleGroups.map((group, gi) => (
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
  const [isAdminAccount, setIsAdminAccount] = useState(false)
  const [roles, setRoles] = useState<Role[]>(["PRIJEMCA"])
  const [linkedPersonId, setLinkedPersonId] = useState<number | null>(null)

  const regularUsers = users.filter(u => !u.isAdminAccount)
  const linkedPerson = linkedPersonId ? users.find(u => u.id === linkedPersonId) ?? null : null

  function handleAccountTypeChange(admin: boolean) {
    setIsAdminAccount(admin)
    setRoles(admin ? ["SPRAVCA_APLIKACIE"] : ["PRIJEMCA"])
    if (!admin) setLinkedPersonId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setPending(true)
    setError("")

    const fd = new FormData(formRef.current)
    roles.forEach((r) => fd.append("roles", r))
    fd.set("isAdminAccount", isAdminAccount ? "true" : "false")
    if (linkedPersonId) fd.set("linkedUserId", String(linkedPersonId))

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

            {/* Typ účtu */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Typ účtu <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAccountTypeChange(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    !isAdminAccount
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                  }`}
                >
                  <UserIcon size={15} />
                  Bežný účet
                </button>
                <button
                  type="button"
                  onClick={() => handleAccountTypeChange(true)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    isAdminAccount
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                  }`}
                >
                  <ShieldCheck size={15} />
                  Admin účet
                </button>
              </div>
              {isAdminAccount && (
                <p className="mt-1.5 text-xs text-orange-600 dark:text-orange-400">
                  Admin účet môže mať výhradne rolu Správca aplikácie. Odporúčané meno: admin.meno
                </p>
              )}
            </div>

            {/* Prepojenie s osobou — len pre admin účty */}
            {isAdminAccount && (
              <Field label="Prepojiť s osobou" hint="Meno, priezvisko a e-mail sa prevezmú z bežného účtu osoby.">
                <select
                  className={inputCls}
                  value={linkedPersonId ?? ""}
                  onChange={e => setLinkedPersonId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">— samostatný admin účet (bez prepojenia) —</option>
                  {regularUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.lastName} {u.firstName} (@{u.username})
                    </option>
                  ))}
                </select>
                {linkedPerson && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 text-xs text-orange-700 dark:text-orange-300 space-y-0.5">
                    <div><span className="font-medium">Osoba:</span> {linkedPerson.firstName} {linkedPerson.lastName}</div>
                    <div><span className="font-medium">E-mail:</span> {linkedPerson.email}</div>
                  </div>
                )}
              </Field>
            )}

            <Field
              label="Používateľské meno"
              required
              hint={isAdminAccount ? "Odporúčaný formát: admin.janci alebo admin_janci" : "Písmená, číslice, podčiarkovník, bodka, pomlčka (napr. janci alebo jan_ci)"}
            >
              <input
                type="text"
                name="username"
                required
                className={inputCls}
                placeholder={isAdminAccount ? "admin.janci" : "janci"}
                autoComplete="off"
                pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{1,49}"
                title="Písmená, číslice, podčiarkovník, bodka, pomlčka; 2–50 znakov"
              />
            </Field>

            {/* Meno/Priezvisko/Email — skryté ak je prepojená osoba (server si ich prevezme) */}
            {linkedPerson ? (
              <>
                <input type="hidden" name="firstName" value={linkedPerson.firstName} />
                <input type="hidden" name="lastName" value={linkedPerson.lastName} />
                <input type="hidden" name="email" value={linkedPerson.email} />
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Meno" required>
                    <input type="text" name="firstName" required className={inputCls} />
                  </Field>
                  <Field label="Priezvisko" required>
                    <input type="text" name="lastName" required className={inputCls} />
                  </Field>
                </div>
                <Field label="Firemný e-mail" required hint="Notifikácie z oboch účtov budú chodiť na tento mail.">
                  <input type="email" name="email" required className={inputCls} placeholder="meno@firma.sk" autoComplete="off" />
                </Field>
              </>
            )}

            <Field label="Heslo (počiatočné)" required hint="Min. 10 znakov, aspoň 1 veľké, 1 malé písmeno a 1 číslica.">
              <input type="password" name="password" required minLength={10} className={inputCls} autoComplete="new-password" />
            </Field>

            <Field label="Role" required>
              {isAdminAccount ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-sm text-orange-700 dark:text-orange-300">
                  <ShieldCheck size={14} />
                  Správca aplikácie (fixné pre admin účet)
                </div>
              ) : (
                <RoleCheckboxes
                  selected={roles}
                  onChange={setRoles}
                  excludeRoles={["SPRAVCA_APLIKACIE"]}
                />
              )}
            </Field>

            {!isAdminAccount && (
              <Field label="Nadriadený">
                <select name="supervisorId" className={inputCls} defaultValue="">
                  <option value="">— bez nadriadeného —</option>
                  {regularUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.lastName} {u.firstName}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            {error ? <p className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</p> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                Zrušiť
              </button>
              <button
                type="submit"
                disabled={pending}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60 ${
                  isAdminAccount ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
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

// ── Delete block modal ─────────────────────────────────────────────────────
function DeleteBlockModal({ userName, errors, onClose }: { userName: string; errors: string[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40">
            <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Používateľa nie je možné vymazať</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Pred zmazaním <span className="font-medium text-gray-700 dark:text-gray-200">{userName}</span> je potrebné vyriešiť:
            </p>
          </div>
        </div>
        <ul className="px-6 pb-5 space-y-2">
          {errors.map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
              {e}
            </li>
          ))}
        </ul>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 rounded-lg"
          >
            Rozumiem
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Column header helper ────────────────────────────────────────────────────
const thBase = "px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"

function SortTh({ label, colKey, sortKey, sortDir, onSort }: {
  label: string; colKey: SortKey; sortKey: SortKey | null; sortDir: "asc" | "desc"
  onSort: (k: SortKey) => void
}) {
  const active = sortKey === colKey
  return (
    <th
      className={`${thBase} cursor-pointer select-none group hover:text-gray-700 dark:hover:text-gray-200`}
      onClick={() => onSort(colKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? sortDir === "asc"
            ? <ChevronUp size={12} className="text-blue-500 shrink-0" />
            : <ChevronDown size={12} className="text-blue-500 shrink-0" />
          : <ArrowUpDown size={11} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
        }
      </div>
    </th>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function UsersClient({ users, canManage = false }: { users: User[]; canManage?: boolean }) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteBlock, setDeleteBlock] = useState<{ userName: string; errors: string[] } | null>(null)

  // Filter & sort state
  const [search, setSearch] = useState("")
  const [filterAccountType, setFilterAccountType] = useState("")
  const [filterRoles, setFilterRoles] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  function clearAll() {
    setSearch(""); setFilterAccountType(""); setFilterRoles(new Set()); setSortKey(null)
  }

  const activeFiltersCount = (filterAccountType ? 1 : 0) + filterRoles.size
  const hasAnyFilter = activeFiltersCount > 0 || !!search

  async function handleDelete(u: User) {
    if (!confirm(`Naozaj chcete zmazať používateľa ${u.lastName} ${u.firstName}?`)) return
    setDeletingId(u.id)
    const res = await deleteUser(u.id)
    setDeletingId(null)
    if (res.errors && res.errors.length > 0) {
      setDeleteBlock({ userName: `${u.firstName} ${u.lastName}`, errors: res.errors })
    } else if (res.error) {
      setDeleteBlock({ userName: `${u.firstName} ${u.lastName}`, errors: [res.error] })
    } else {
      router.refresh()
    }
  }

  // 1. Vylúčiť prepojené admin účty (tie sa zobrazujú ako badge na riadku osoby)
  const baseUsers = useMemo(
    () => users.filter(u => !(u.isAdminAccount && u.linkedUserId !== null)),
    [users]
  )
  const hiddenLinked = users.length - baseUsers.length

  // 2. Textový filter
  const searchFiltered = useMemo(() => {
    if (!search) return baseUsers
    const q = search.toLowerCase()
    return baseUsers.filter(u =>
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  }, [baseUsers, search])

  // 3. Rozbaľovacie filtre
  const filtered = useMemo(() => searchFiltered.filter(u => {
    if (filterAccountType === "regular" && u.isAdminAccount) return false
    if (filterAccountType === "admin" && !u.isAdminAccount) return false
    if (filterRoles.size > 0 && !u.roles.some(r => filterRoles.has(r))) return false
    return true
  }), [searchFiltered, filterAccountType, filterRoles])

  // 4. Zoradenie
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let aVal: string | number = ""
      let bVal: string | number = ""
      switch (sortKey) {
        case "id":       aVal = a.id;       bVal = b.id;       break
        case "username": aVal = a.username; bVal = b.username; break
        case "name":     aVal = `${a.lastName} ${a.firstName}`; bVal = `${b.lastName} ${b.firstName}`; break
        case "email":    aVal = a.email;    bVal = b.email;    break
      }
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), "sk")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Používatelia</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {sorted.length !== baseUsers.length
              ? <>{sorted.length} z {baseUsers.length} používateľov</>
              : <>{baseUsers.length} {baseUsers.length === 1 ? "používateľ" : "používateľov"}</>
            }
            {hiddenLinked > 0 && (
              <span className="ml-1.5 text-orange-500">· {hiddenLinked} prepojený admin {hiddenLinked === 1 ? "účet" : "účty"}</span>
            )}
          </p>
        </div>
        {canManage ? (
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shrink-0">
            <Plus size={15} />
            Nový používateľ
          </button>
        ) : (
          <span className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0">
            Len na čítanie
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hľadať podľa mena, loginu, e-mailu…"
            className="pl-8 pr-3 py-1.5 text-sm w-64 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <FilterSelect
          label="Typ účtu"
          options={accountTypeOptions}
          value={filterAccountType}
          onChange={setFilterAccountType}
        />
        <MultiSelect
          placeholder="Rola"
          options={roleFilterOptions}
          selected={filterRoles}
          onChange={setFilterRoles}
        />
        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <X size={12} /> Zrušiť filtre
          </button>
        )}
        {sortKey && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg">
            {sortDir === "asc" ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
            <span>{sortKey === "id" ? "ID" : sortKey === "username" ? "Username" : sortKey === "name" ? "Meno" : "E-mail"}</span>
            <button type="button" onClick={() => setSortKey(null)} className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100">
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <SortTh label="ID"       colKey="id"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Username / Admin účty" colKey="username" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Priezvisko, Meno"      colKey="name"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Email"    colKey="email"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              {["Role", "Nadriadený", "Útvar", ""].map(h => (
                <th key={h} className={thBase}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sorted.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${u.isAdminAccount ? "bg-orange-50/40 dark:bg-orange-900/10" : ""}`}>
                <td className="px-4 py-3 text-xs font-mono text-gray-400 dark:text-gray-500">{u.id}</td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1.5 text-sm font-mono font-medium ${
                    u.isAdminAccount ? "text-orange-700 dark:text-orange-400" : "text-gray-700 dark:text-gray-300"
                  }`}>
                    {u.isAdminAccount && <ShieldCheck size={13} />}
                    {u.username}
                  </span>
                  {u.adminAccounts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {u.adminAccounts.map(a => (
                        <Link
                          key={a.id}
                          href={`/dashboard/users/${a.id}`}
                          className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono font-medium rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
                          title="Administrátorský účet tejto osoby"
                        >
                          <ShieldCheck size={10} />
                          {a.username}
                        </Link>
                      ))}
                    </div>
                  )}
                </td>
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
                  {(u.utvary.length > 0 || u.vedouciUtvary.length > 0) ? (
                    <div className="flex flex-wrap gap-1">
                      {u.utvary.map(v => (
                        <span key={v.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium">
                          <Layers size={9} className="shrink-0" />{v.nazov}
                        </span>
                      ))}
                      {u.vedouciUtvary.map(v => (
                        <span key={v.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                          <Crown size={9} className="shrink-0" />{v.nazov}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
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
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  {hasAnyFilter ? "Žiadni používatelia nezodpovedajú filtru." : "Žiadni používatelia."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && <NewUserModal users={users} onClose={() => setShowNew(false)} />}
      {deleteBlock && (
        <DeleteBlockModal
          userName={deleteBlock.userName}
          errors={deleteBlock.errors}
          onClose={() => setDeleteBlock(null)}
        />
      )}
    </div>
  )
}
