"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  FolderOpen, Plus, Trash2, X, Loader2, Users, ChevronRight,
  ShieldCheck, ShieldOff, UserCog,
} from "lucide-react"
import { createAgenda, deleteAgenda, setUserDocRole } from "./actions"

interface Agenda {
  id: number
  name: string
  documentCount: number
  gestors: { id: number; name: string }[]
  isMyAgenda: boolean
}

interface DocUser {
  id: number
  name: string
  email: string
  isDocAdmin: boolean
}

interface Props {
  agendas: Agenda[]
  isAdmin: boolean
  isAppAdmin?: boolean
  allUsers: DocUser[]
}

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

type Tab = "agendy" | "spravcovia"

export default function AgendasClient({ agendas, isAdmin, isAppAdmin = false, allUsers }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("agendy")

  // New agenda
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState<number | null>(null)

  // DocRole management
  const [rolePending, setRolePending] = useState<number | null>(null)

  async function handleCreate() {
    if (!newName.trim()) { setError("Zadajte názov agendy"); return }
    setPending(true); setError("")
    const fd = new FormData(); fd.set("name", newName.trim())
    const res = await createAgenda(fd)
    setPending(false)
    if (res?.error) { setError(res.error); return }
    setNewName(""); setShowNew(false); router.refresh()
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Naozaj chcete zmazať agendu „${name}" a všetky jej dokumenty?`)) return
    setDeleting(id)
    await deleteAgenda(id)
    setDeleting(null)
    router.refresh()
  }

  async function handleDocRole(userId: number, makeAdmin: boolean) {
    setRolePending(userId)
    await setUserDocRole(userId, makeAdmin ? "SPRAVCA_DOKUMENTOV" : "CITATEL")
    setRolePending(null)
    router.refresh()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Interné dokumenty</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {tab === "agendy" ? "Zoznam agend" : "Správcovia dokumentov"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAppAdmin && (
            <span className="px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              Režim len na čítanie
            </span>
          )}
          {isAdmin && tab === "agendy" && !isAppAdmin && (
            <button
              onClick={() => { setShowNew(true); setError("") }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Nová agenda
            </button>
          )}
        </div>
      </div>

      {/* Tabs – only for admin */}
      {isAdmin && (
        <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setTab("agendy")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "agendy"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <FolderOpen size={15} /> Agendy
          </button>
          <button
            onClick={() => setTab("spravcovia")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "spravcovia"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <UserCog size={15} /> Správcovia dokumentov
          </button>
        </div>
      )}

      {/* === AGENDY TAB === */}
      {tab === "agendy" && (
        <>
          {agendas.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
              <p>Zatiaľ žiadne agendy.</p>
              {isAdmin && <p className="text-sm mt-1">Vytvorte prvú agendu tlačidlom vyššie.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {agendas.map((agenda) => (
                <div
                  key={agenda.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-colors group flex items-center"
                >
                  <Link href={`/dashboard/dokumenty/${agenda.id}`} className="flex-1 flex items-center gap-4 px-5 py-4 min-w-0">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg shrink-0">
                      <FolderOpen size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 w-56 shrink-0">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {agenda.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {agenda.documentCount}{" "}
                        {agenda.documentCount === 1 ? "dokument" : agenda.documentCount < 5 ? "dokumenty" : "dokumentov"}
                      </p>
                    </div>
                    <div className="flex-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                      <Users size={13} className="shrink-0" />
                      <span className="truncate">
                        {agenda.gestors.length > 0
                          ? agenda.gestors.map((g) => g.name).join(", ")
                          : <span className="italic">Žiadny gestor</span>
                        }
                      </span>
                    </div>
                    {agenda.isMyAgenda && (
                      <span className="inline-flex items-center text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full shrink-0">
                        Moja agenda
                      </span>
                    )}
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 shrink-0" />
                  </Link>

                  {isAdmin && (
                    <div className="pr-3 shrink-0">
                      <button
                        onClick={(e) => { e.preventDefault(); handleDelete(agenda.id, agenda.name) }}
                        disabled={deleting === agenda.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Zmazať agendu"
                      >
                        {deleting === agenda.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* === SPRÁVCOVIA TAB === */}
      {tab === "spravcovia" && isAdmin && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Správca dokumentov má neobmedzený prístup — môže vytvárať/mazať agendy, editovať všetky dokumenty a spravovať prístupy.
            </p>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {allUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${u.isDocAdmin ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{u.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.isDocAdmin && (
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                      Správca dokumentov
                    </span>
                  )}
                  <button
                    onClick={() => handleDocRole(u.id, !u.isDocAdmin)}
                    disabled={rolePending === u.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      u.isDocAdmin
                        ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {rolePending === u.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : u.isDocAdmin ? (
                      <><ShieldOff size={12} /> Odobrať</>
                    ) : (
                      <><ShieldCheck size={12} /> Priradiť</>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* New Agenda Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNew(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nová agenda</h2>
              <button onClick={() => setShowNew(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Názov agendy <span className="text-red-500">*</span>
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="napr. Bezpečnostné smernice"
              className={inputCls}
              autoFocus
            />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                Zrušiť
              </button>
              <button
                onClick={handleCreate}
                disabled={pending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                Vytvoriť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
