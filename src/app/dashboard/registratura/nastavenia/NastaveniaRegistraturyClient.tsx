"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2, Check, Plus, Pencil, Trash2, X, ChevronRight, ChevronDown,
  FolderOpen, FileText, FileCode, Archive, Search, Shield,
} from "lucide-react"
import { setRegRoles, createPlanItem, updatePlanItem, deletePlanItem } from "./actions"
import CislonikTab from "./CislonikTab"
import type { CislonikTyp, CislonikItem } from "@/lib/cislonik"
import type { Role } from "@/generated/prisma/enums"
import { regRoleLabels } from "@/lib/regLabels"

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRow = { id: number; name: string; email: string; regRoles: string[] }
type PlanItem = { id: number; znacka: string; nazov: string; lehota: number; maArchivnu: boolean }

interface Props {
  users: UserRow[]
  plan: PlanItem[]
  cislonik: Record<CislonikTyp, CislonikItem[]>
}

type Tab = "plan" | "role" | "cislonik" | "ine"
const TABS: { key: Tab; label: string }[] = [
  { key: "plan",     label: "Registratúrny plán" },
  { key: "role",     label: "Správa rolí" },
  { key: "cislonik", label: "Číselníky" },
  { key: "ine",      label: "Iné nastavenia" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function level(znacka: string) { return znacka.split(".").length }
function parentOf(znacka: string) { const p = znacka.split("."); p.pop(); return p.join(".") }

function levelIcon(lvl: number) {
  if (lvl === 1) return <FolderOpen size={14} className="text-blue-500 shrink-0" />
  if (lvl === 2) return <FileText size={14} className="text-gray-400 shrink-0" />
  return <FileCode size={13} className="text-gray-300 shrink-0" />
}

const inputCls = "w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5"

// ─── Plan Tab ─────────────────────────────────────────────────────────────────

function PlanTab({ plan }: { plan: PlanItem[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set())
  const [expandedL2, setExpandedL2] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nazov: "", lehota: 1, maArchivnu: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [addState, setAddState] = useState<{ prefix: string } | null>(null)
  const [addForm, setAddForm] = useState({ znacka: "", nazov: "", lehota: 1, maArchivnu: false })

  // Build hierarchy
  const l1 = plan.filter(p => level(p.znacka) === 1)
  const l2 = plan.filter(p => level(p.znacka) === 2)
  const l3 = plan.filter(p => level(p.znacka) === 3)

  function childrenOf(parentZnacka: string, allLevel: PlanItem[]) {
    return allLevel.filter(p => parentOf(p.znacka) === parentZnacka)
  }

  function toggleL1(z: string) {
    setExpandedL1(prev => { const s = new Set(prev); s.has(z) ? s.delete(z) : s.add(z); return s })
  }
  function toggleL2(z: string) {
    setExpandedL2(prev => { const s = new Set(prev); s.has(z) ? s.delete(z) : s.add(z); return s })
  }

  function startEdit(item: PlanItem) {
    setEditingId(item.id)
    setEditForm({ nazov: item.nazov, lehota: item.lehota, maArchivnu: item.maArchivnu })
    setError("")
  }

  function openAdd(prefix: string) {
    setAddState({ prefix })
    setAddForm({ znacka: prefix ? prefix + "." : "", nazov: "", lehota: 5, maArchivnu: false })
    setError("")
  }

  async function handleSaveEdit(id: number) {
    setSaving(true); setError("")
    const res = await updatePlanItem(id, editForm)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setEditingId(null)
    startTransition(() => router.refresh())
  }

  async function handleAdd() {
    setSaving(true); setError("")
    const res = await createPlanItem({ ...addForm, znacka: addForm.znacka.trim().toUpperCase() })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setAddState(null)
    // auto-expand parents
    const parts = addForm.znacka.trim().toUpperCase().split(".")
    if (parts.length >= 2) setExpandedL1(prev => new Set([...prev, parts[0]]))
    if (parts.length >= 3) setExpandedL2(prev => new Set([...prev, parts.slice(0, 2).join(".")]))
    startTransition(() => router.refresh())
  }

  async function handleDelete(item: PlanItem) {
    if (!confirm(`Naozaj chcete zmazať položku „${item.znacka} – ${item.nazov}"?`)) return
    setSaving(true); setError("")
    const res = await deletePlanItem(item.id)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    startTransition(() => router.refresh())
  }

  // Inline edit form
  function EditForm({ item }: { item: PlanItem }) {
    return (
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className={labelCls}>Názov</label>
          <input value={editForm.nazov} onChange={e => setEditForm(f => ({ ...f, nazov: e.target.value }))} className={inputCls} />
        </div>
        <div className="w-24">
          <label className={labelCls}>Lehota (roky)</label>
          <input type="number" min={1} value={editForm.lehota}
            onChange={e => setEditForm(f => ({ ...f, lehota: parseInt(e.target.value) || 1 }))} className={inputCls} />
        </div>
        <div className="flex items-center gap-1.5 pb-0.5">
          <input type="checkbox" id={`arch-${item.id}`} checked={editForm.maArchivnu}
            onChange={e => setEditForm(f => ({ ...f, maArchivnu: e.target.checked }))}
            className="w-3.5 h-3.5 accent-blue-600" />
          <label htmlFor={`arch-${item.id}`} className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap">
            Archívna hodnota
          </label>
        </div>
        <div className="flex gap-1.5 pb-0.5">
          <button onClick={() => handleSaveEdit(item.id)} disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Uložiť
          </button>
          <button onClick={() => setEditingId(null)} className="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <X size={11} />
          </button>
        </div>
      </div>
    )
  }

  // Shared row actions
  function RowActions({ item }: { item: PlanItem }) {
    return (
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => startEdit(item)}
          className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg transition-colors" title="Upraviť">
          <Pencil size={13} />
        </button>
        <button onClick={() => handleDelete(item)}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors" title="Zmazať">
          <Trash2 size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Global error */}
      {error && (
        <div className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {plan.length} položiek · 3-úrovňová hierarchia (Značka.Podznačka.Podpodznačka)
        </p>
        <button onClick={() => openAdd("")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={14} /> Pridať položku
        </button>
      </div>

      {/* Add form */}
      {addState !== null && (
        <div className="border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Nová položka plánu</p>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="w-32">
              <label className={labelCls}>Značka *</label>
              <input
                value={addForm.znacka}
                onChange={e => setAddForm(f => ({ ...f, znacka: e.target.value }))}
                placeholder="napr. A.B.C"
                className={inputCls}
                autoFocus
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Max 3 úrovne, oddelené bodkou</p>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className={labelCls}>Názov *</label>
              <input value={addForm.nazov} onChange={e => setAddForm(f => ({ ...f, nazov: e.target.value }))}
                placeholder="Popis položky" className={inputCls} />
            </div>
            <div className="w-24">
              <label className={labelCls}>Lehota (roky)</label>
              <input type="number" min={1} value={addForm.lehota}
                onChange={e => setAddForm(f => ({ ...f, lehota: parseInt(e.target.value) || 1 }))} className={inputCls} />
            </div>
            <div className="flex items-center gap-1.5 pb-0.5">
              <input type="checkbox" id="arch-new" checked={addForm.maArchivnu}
                onChange={e => setAddForm(f => ({ ...f, maArchivnu: e.target.checked }))}
                className="w-3.5 h-3.5 accent-blue-600" />
              <label htmlFor="arch-new" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap">
                Archívna hodnota
              </label>
            </div>
            <div className="flex gap-1.5 pb-0.5">
              <button onClick={handleAdd} disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Pridať
              </button>
              <button onClick={() => { setAddState(null); setError("") }}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tree */}
      {plan.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <FolderOpen size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Registratúrny plán je prázdny.</p>
          <p className="text-xs mt-1">Pridajte prvú položku tlačidlom vyššie.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {l1.map((item1, idx1) => {
            const children2 = childrenOf(item1.znacka, l2)
            const isExpL1 = expandedL1.has(item1.znacka)
            const isLast1 = idx1 === l1.length - 1

            return (
              <div key={item1.id} className={!isLast1 ? "border-b border-gray-100 dark:border-gray-800" : ""}>
                {/* Level 1 row */}
                <div className="group flex items-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <button onClick={() => toggleL1(item1.znacka)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0">
                    {children2.length > 0
                      ? (isExpL1 ? <ChevronDown size={15} /> : <ChevronRight size={15} />)
                      : <span className="w-[15px] inline-block" />}
                  </button>
                  {levelIcon(1)}
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 w-20 shrink-0">{item1.znacka}</span>
                  {editingId === item1.id ? (
                    <div className="flex-1"><EditForm item={item1} /></div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{item1.nazov}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{item1.lehota} r.</span>
                      {item1.maArchivnu && <span title="Archívna hodnota"><Archive size={13} className="text-amber-500 shrink-0" /></span>}
                      <RowActions item={item1} />
                      <button onClick={() => { openAdd(item1.znacka); setExpandedL1(prev => new Set([...prev, item1.znacka])) }}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-[10px] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shrink-0"
                        title="Pridať podpoložku úrovne 2">
                        <Plus size={10} /> L2
                      </button>
                    </>
                  )}
                </div>

                {/* Level 2 children */}
                {isExpL1 && children2.map((item2, idx2) => {
                  const children3 = childrenOf(item2.znacka, l3)
                  const isExpL2 = expandedL2.has(item2.znacka)
                  const isLast2 = idx2 === children2.length - 1

                  return (
                    <div key={item2.id} className={`border-t border-gray-100 dark:border-gray-800 ${!isLast2 || children3.length > 0 ? "" : ""}`}>
                      <div className="group flex items-center gap-2 px-4 py-2.5 pl-10 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors bg-gray-50/30 dark:bg-gray-800/10">
                        <button onClick={() => toggleL2(item2.znacka)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0">
                          {children3.length > 0
                            ? (isExpL2 ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
                            : <span className="w-[13px] inline-block" />}
                        </button>
                        {levelIcon(2)}
                        <span className="font-mono text-xs font-semibold text-gray-600 dark:text-gray-300 w-20 shrink-0">{item2.znacka}</span>
                        {editingId === item2.id ? (
                          <div className="flex-1"><EditForm item={item2} /></div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{item2.nazov}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{item2.lehota} r.</span>
                            {item2.maArchivnu && <span title="Archívna hodnota"><Archive size={12} className="text-amber-500 shrink-0" /></span>}
                            <RowActions item={item2} />
                            <button onClick={() => { openAdd(item2.znacka); setExpandedL2(prev => new Set([...prev, item2.znacka])) }}
                              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shrink-0"
                              title="Pridať podpoložku úrovne 3">
                              <Plus size={10} /> L3
                            </button>
                          </>
                        )}
                      </div>

                      {/* Level 3 children */}
                      {isExpL2 && children3.map((item3, idx3) => (
                        <div key={item3.id}
                          className={`group flex items-center gap-2 px-4 py-2 pl-20 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors bg-gray-50/50 dark:bg-gray-800/20 ${idx3 === children3.length - 1 ? "" : ""}`}>
                          {levelIcon(3)}
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-24 shrink-0">{item3.znacka}</span>
                          {editingId === item3.id ? (
                            <div className="flex-1"><EditForm item={item3} /></div>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{item3.nazov}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{item3.lehota} r.</span>
                              {item3.maArchivnu && <span title="Archívna hodnota"><Archive size={12} className="text-amber-500 shrink-0" /></span>}
                              <RowActions item={item3} />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Role Tab ─────────────────────────────────────────────────────────────────

const ALL_REG_ROLES: Role[] = ["SPRAVCA_REGISTRATURY", "PRACOVNIK_PODATELNE", "SPRACOVATEL_REGISTRATURY"]

const ROLE_DESC: Record<string, string> = {
  SPRAVCA_REGISTRATURY:    "Čítanie všetkých záznamov, správa plánov a rolí",
  PRACOVNIK_PODATELNE:     "Príjem a registrácia poštových zásielok",
  SPRACOVATEL_REGISTRATURY: "Vytváranie a správa vlastných záznamov a spisov",
}

function RoleTab({ users }: { users: UserRow[] }) {
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
    setEditRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ALL_REG_ROLES.map(role => (
          <div key={role} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={13} className="text-blue-500 shrink-0" />
              <p className="text-xs font-medium text-gray-900 dark:text-white">{regRoleLabels[role]}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{ROLE_DESC[role]}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hľadať používateľa…"
          className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Používateľ</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Správca registratúry</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pracovník podateľne</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Spracovateľ</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">Žiadni používatelia</td></tr>
            )}
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                </td>
                {editId === u.id ? (
                  <>
                    {ALL_REG_ROLES.map(role => (
                      <td key={role} className="px-4 py-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={editRoles.includes(role)} onChange={() => toggleRole(role)}
                            className="rounded border-gray-300 text-blue-600" />
                        </label>
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={handleSave} disabled={saving}
                          className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {saving ? <Loader2 size={13} className="animate-spin text-white" /> : <Check size={13} className="text-white" />}
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
                    {ALL_REG_ROLES.map(role => (
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function NastaveniaRegistraturyClient({ users, plan, cislonik }: Props) {
  const [tab, setTab] = useState<Tab>("plan")

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Nastavenia registratúry</h1>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "plan"     && <PlanTab plan={plan} />}
      {tab === "role"     && <RoleTab users={users} />}
      {tab === "cislonik" && <CislonikTab cislonik={cislonik} />}
      {tab === "ine"      && <p className="text-sm italic text-gray-400 dark:text-gray-500">Obsah bude doplnený.</p>}
    </div>
  )
}
