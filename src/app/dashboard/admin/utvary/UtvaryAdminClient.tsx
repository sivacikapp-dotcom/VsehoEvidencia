"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, X, Loader2, Users, ChevronDown, ChevronRight, Crown } from "lucide-react"
import { createUtvar, updateUtvar, deleteUtvar } from "./actions"

type UtvarUser = { id: number; firstName: string; lastName: string; username: string }
type UtvarVedouci = { id: number; firstName: string; lastName: string }

type UtvarFlat = {
  id: number
  nazov: string
  parentId: number | null
  vedouci: UtvarVedouci | null
  users: UtvarUser[]
}

type UtvarNode = UtvarFlat & { children: UtvarNode[]; level: number }

type AllUser = { id: number; firstName: string; lastName: string }

const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

function buildTree(flat: UtvarFlat[]): UtvarNode[] {
  const map = new Map<number, UtvarNode>()
  for (const u of flat) map.set(u.id, { ...u, children: [], level: 0 })

  const roots: UtvarNode[] = []
  for (const node of map.values()) {
    if (node.parentId === null) roots.push(node)
    else map.get(node.parentId)?.children.push(node)
  }

  function setLevel(node: UtvarNode, lvl: number) {
    node.level = lvl
    for (const child of node.children) setLevel(child, lvl + 1)
  }
  for (const root of roots) setLevel(root, 1)

  function sort(nodes: UtvarNode[]) {
    nodes.sort((a, b) => a.nazov.localeCompare(b.nazov, "sk"))
    for (const n of nodes) sort(n.children)
  }
  sort(roots)

  return roots
}

function getDescendantIds(node: UtvarNode): Set<number> {
  const ids = new Set<number>()
  function collect(n: UtvarNode) {
    for (const c of n.children) { ids.add(c.id); collect(c) }
  }
  collect(node)
  return ids
}

function computeLevels(flat: UtvarFlat[]): Map<number, number> {
  const map = new Map<number, number>()
  function getLevel(id: number): number {
    if (map.has(id)) return map.get(id)!
    const node = flat.find(u => u.id === id)
    if (!node || !node.parentId) { map.set(id, 1); return 1 }
    const l = 1 + getLevel(node.parentId)
    map.set(id, l)
    return l
  }
  for (const u of flat) getLevel(u.id)
  return map
}

function UtvarModal({
  utvar,
  initialParentId,
  allUtvary,
  allUsers,
  levels,
  onClose,
}: {
  utvar?: UtvarNode
  initialParentId?: number | null
  allUtvary: UtvarFlat[]
  allUsers: AllUser[]
  levels: Map<number, number>
  onClose: () => void
}) {
  const router = useRouter()
  const [nazov, setNazov] = useState(utvar?.nazov ?? "")
  const [parentId, setParentId] = useState<number | null>(utvar?.parentId ?? initialParentId ?? null)
  const [vedouciId, setVedouciId] = useState<number | null>(utvar?.vedouci?.id ?? null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  const descendantIds = useMemo(() => utvar ? getDescendantIds(utvar) : new Set<number>(), [utvar])

  const parentOptions = useMemo(() =>
    allUtvary.filter(u => {
      if (utvar && u.id === utvar.id) return false
      if (utvar && descendantIds.has(u.id)) return false
      return (levels.get(u.id) ?? 1) < 3
    }),
  [allUtvary, utvar, descendantIds, levels])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError("")
    const result = utvar
      ? await updateUtvar(utvar.id, nazov, parentId, vedouciId)
      : await createUtvar(nazov, parentId, vedouciId)
    setPending(false)
    if (result.error) { setError(result.error); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {utvar ? "Upraviť útvar" : "Nový útvar"}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Názov útvaru <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nazov}
                onChange={e => setNazov(e.target.value)}
                required
                autoFocus
                maxLength={200}
                className={inputCls}
                placeholder="napr. Ekonomický útvar"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nadriadený útvar <span className="text-gray-400 font-normal">(voliteľné – max. 3 úrovne)</span>
              </label>
              <select
                value={parentId ?? ""}
                onChange={e => setParentId(e.target.value ? parseInt(e.target.value) : null)}
                className={inputCls}
              >
                <option value="">— bez nadriadeného (1. úroveň) —</option>
                {parentOptions.map(u => {
                  const lvl = levels.get(u.id) ?? 1
                  const prefix = lvl === 2 ? "    └─ " : ""
                  return (
                    <option key={u.id} value={u.id}>{prefix}{u.nazov}</option>
                  )
                })}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Hierarchia max. 3 úrovne: oddelenie → pododdelenie → tím
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vedúci útvaru <span className="text-gray-400 font-normal">(voliteľné)</span>
              </label>
              <select
                value={vedouciId ?? ""}
                onChange={e => setVedouciId(e.target.value ? parseInt(e.target.value) : null)}
                className={inputCls}
              >
                <option value="">— bez vedúceho —</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Zrušiť
            </button>
            <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" />}
              {pending ? "Ukladám..." : utvar ? "Uložiť" : "Vytvoriť"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UtvarRow({
  node,
  allUtvary,
  allUsers,
  levels,
  expandedIds,
  toggleExpand,
  onEdit,
  onAddChild,
  onDelete,
  deletingId,
}: {
  node: UtvarNode
  allUtvary: UtvarFlat[]
  allUsers: AllUser[]
  levels: Map<number, number>
  expandedIds: Set<number>
  toggleExpand: (id: number) => void
  onEdit: (node: UtvarNode) => void
  onAddChild: (parentId: number) => void
  onDelete: (node: UtvarNode) => void
  deletingId: number | null
}) {
  const isExpanded = expandedIds.has(node.id)
  const hasUsers = node.users.length > 0
  const hasChildren = node.children.length > 0
  const canAddChild = node.level < 3

  const indent = (node.level - 1) * 28

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/60 group">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${indent}px` }}>
            {node.level > 1 && (
              <span className="text-gray-300 dark:text-gray-600 shrink-0 font-mono text-xs select-none">└─</span>
            )}
            <span className="font-medium text-gray-900 dark:text-gray-100">{node.nazov}</span>
            {node.vedouci && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium shrink-0">
                <Crown size={10} />
                {node.vedouci.lastName} {node.vedouci.firstName}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => hasUsers && toggleExpand(node.id)}
            className={`flex items-center gap-1.5 text-sm transition-colors ${hasUsers ? "text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400" : "text-gray-300 dark:text-gray-600 cursor-default"}`}
          >
            {hasUsers ? (
              isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
            ) : (
              <span className="w-[13px]" />
            )}
            <Users size={13} className="opacity-60" />
            <span>{node.users.length}</span>
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {canAddChild && (
              <button
                onClick={() => onAddChild(node.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md font-medium"
              >
                <Plus size={10} />Sub
              </button>
            )}
            <button
              onClick={() => onEdit(node)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md font-medium"
            >
              <Pencil size={11} />Upraviť
            </button>
            <button
              onClick={() => onDelete(node)}
              disabled={deletingId === node.id}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium disabled:opacity-50"
            >
              {deletingId === node.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Zmazať
            </button>
          </div>
        </td>
      </tr>

      {isExpanded && hasUsers && (
        <tr className="bg-gray-50/70 dark:bg-gray-800/30">
          <td colSpan={3} className="px-4 py-2.5" style={{ paddingLeft: `${indent + 44}px` }}>
            <div className="flex flex-wrap gap-1.5">
              {node.users.map(u => (
                <span key={u.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300">
                  {u.lastName} {u.firstName}
                  <span className="text-gray-400 dark:text-gray-500">@{u.username}</span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}

      {hasChildren && node.children.map(child => (
        <UtvarRow
          key={child.id}
          node={child}
          allUtvary={allUtvary}
          allUsers={allUsers}
          levels={levels}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}
    </>
  )
}

export default function UtvaryAdminClient({
  utvary,
  allUsers,
}: {
  utvary: UtvarFlat[]
  allUsers: AllUser[]
}) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [editNode, setEditNode] = useState<UtvarNode | null>(null)
  const [presetParentId, setPresetParentId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const tree = useMemo(() => buildTree(utvary), [utvary])
  const levels = useMemo(() => computeLevels(utvary), [utvary])
  const totalCount = utvary.length

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleAddChild(parentId: number) {
    setPresetParentId(parentId)
    setShowNew(true)
  }

  function handleCloseNew() {
    setShowNew(false)
    setPresetParentId(null)
  }

  async function handleDelete(node: UtvarNode) {
    if (node.children.length > 0) {
      alert(`Útvar má ${node.children.length} pododdelení. Najprv ich odstráňte alebo presuňte.`)
      return
    }
    if (node.users.length > 0) {
      alert(`Útvar má priradených ${node.users.length} používateľov. Najprv ich presuňte do iného útvaru.`)
      return
    }
    if (!confirm(`Naozaj chcete zmazať útvar „${node.nazov}"?`)) return
    setDeletingId(node.id)
    const res = await deleteUtvar(node.id)
    setDeletingId(null)
    if (res.error) alert(res.error)
    else router.refresh()
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Útvary</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Správa organizačných útvarov ({totalCount}) · Hierarchia max. 3 úrovne
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus size={15} />Nový útvar
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {tree.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
            Žiadne útvary. Vytvorte prvý útvar kliknutím na tlačidlo vyššie.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Útvar</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">Používatelia</th>
                <th className="w-48" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {tree.map(root => (
                <UtvarRow
                  key={root.id}
                  node={root}
                  allUtvary={utvary}
                  allUsers={allUsers}
                  levels={levels}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  onEdit={setEditNode}
                  onAddChild={handleAddChild}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <UtvarModal
          allUtvary={utvary}
          allUsers={allUsers}
          levels={levels}
          initialParentId={presetParentId}
          onClose={handleCloseNew}
        />
      )}
      {editNode && (
        <UtvarModal
          utvar={editNode}
          allUtvary={utvary}
          allUsers={allUsers}
          levels={levels}
          onClose={() => setEditNode(null)}
        />
      )}
    </div>
  )
}
