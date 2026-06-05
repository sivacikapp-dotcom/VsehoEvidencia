"use client"

import { useState, useRef, Fragment } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, ChevronRight, Pencil, X, Loader2, Paperclip,
  Download, Lock, Eye, EyeOff, Users, UserPlus, UserMinus, Shield,
  Plus, Trash2, History, GitBranch, AlertTriangle, MessageSquare, Send, ChevronDown, ChevronUp,
} from "lucide-react"
import {
  updateDocument, deleteDocument, grantDocumentAccess, revokeDocumentAccess, setDocumentGestor,
  createDocumentAttachment, updateDocumentAttachment, deleteDocumentAttachment,
  grantAttachmentAccess, revokeAttachmentAccess,
  createDocumentDraft, approveDocumentDraft,
  createAttachmentDraft, approveAttachmentDraft,
  createDocumentNote, updateDocumentNote, deleteDocumentNote,
  addDocumentAuxFile, deleteDocumentAuxFile,
  addAttachmentAuxFile, deleteAttachmentAuxFile,
} from "../../actions"
import { fmtDate } from "@/lib/formatDate"

type Confidentiality = "VEREJNY" | "INTERNI" | "DOVERNI"
interface DocUser { id: number; name: string; email: string }
interface DocUserWithAccess extends DocUser { hasAccess: boolean }
interface DocNote { id: number; content: string; createdByName: string; createdAt: string; updatedAt: string }
interface DocAuxFile { id: number; storedName: string; originalName: string }

interface AttachmentData {
  id: number
  znacka: string
  nazov: string
  datumSchvalenia: string
  datumPrvehoSchvalenia: string | null
  version: number
  parentId: number | null
  isLatest: boolean
  status: string
  confidentiality: Confidentiality
  filePath: string | null
  fileName: string | null
  canDownload: boolean
  accessUserIds: number[]
  accessUsers: { id: number; name: string; email: string }[]
  auxFiles: DocAuxFile[]
}

interface VersionHistoryItem {
  id: number
  version: number
  znacka: string
  nazov: string
  datumSchvalenia: string
  isLatest: boolean
  status: string
}

interface DocumentData {
  id: number
  znacka: string
  nazov: string
  datumSchvalenia: string
  datumPrvehoSchvalenia: string | null
  confidentiality: Confidentiality
  prilohaPath: string | null
  prilohaName: string | null
  agendaId: number
  agendaName: string
  agendaSkratka: string | null
  parentId: number | null
  version: number
  isLatest: boolean
  status: string
  auxFiles: DocAuxFile[]
  gestors: { id: number; name: string }[]
  accesses: { id: number; name: string; email: string }[]
  attachments: AttachmentData[]
}

interface Props {
  document: DocumentData
  versionHistory: VersionHistoryItem[]
  latestDocId: number
  nextDocVersionZnacka: string
  canEdit: boolean
  canDelete: boolean
  canManageAccess: boolean
  canManageGestors: boolean
  isAdmin: boolean
  isAppAdmin?: boolean
  hasDraft: boolean
  draftDocId: number | null
  allUsers: DocUserWithAccess[]
  allUsersForAttachment: DocUser[]
  gestorUsers: DocUser[]
  notes: DocNote[]
  canManageNotes: boolean
  canSeeAuxFiles: boolean
  nextZnacka: string
  attachmentOnlyMode?: boolean
}

const confidentialityLabels: Record<Confidentiality, string> = {
  VEREJNY: "Verejný", INTERNI: "Interný", DOVERNI: "Dôverný",
}
const confidentialityColors: Record<Confidentiality, string> = {
  VEREJNY: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  INTERNI: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  DOVERNI: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const inputCls =
  "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}

// ─── Attachment Modal (create / edit / draft) ─────────────────────────────────
interface AttachmentModalProps {
  mode: "create" | "edit" | "draft"
  documentId: number
  defaultZnacka: string
  defaultConfidentiality: Confidentiality
  existing?: AttachmentData
  allUsers?: { id: number; name: string; email: string }[]
  onClose: () => void
  onDone: () => void
}

function AttachmentModal({ mode, documentId, defaultZnacka, defaultConfidentiality, existing, allUsers = [], onClose, onDone }: AttachmentModalProps) {
  const today = new Date().toISOString().split("T")[0]
  const [znacka, setZnacka] = useState(existing?.znacka ?? defaultZnacka)
  const [nazov, setNazov] = useState(existing?.nazov ?? "")
  const [datumSchvalenia, setDatumSchvalenia] = useState(
    mode === "draft" ? today : (existing?.datumSchvalenia ?? today)
  )
  const [confidentiality, setConfidentiality] = useState<Confidentiality>(
    existing?.confidentiality ?? defaultConfidentiality
  )
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [removeFile, setRemoveFile] = useState(false)

  const title = mode === "create" ? "Nová príloha" : mode === "edit" ? "Editovať prílohu" : `Návrh novej verzie prílohy (v_rev${(existing?.version ?? 1) + 1})`

  async function handleSubmit() {
    setPending(true); setError("")
    const fd = new FormData()
    fd.set("znacka", znacka.trim())
    fd.set("nazov", nazov.trim())
    fd.set("datumSchvalenia", datumSchvalenia)
    fd.set("confidentiality", confidentiality)

    let res
    if (mode === "create") {
      fd.set("documentId", String(documentId))
      if (confidentiality === "DOVERNI" && selectedUserIds.size > 0) {
        fd.set("accessUserIds", JSON.stringify([...selectedUserIds]))
      }
      res = await createDocumentAttachment(fd)
    } else if (mode === "edit") {
      fd.set("attachmentId", String(existing!.id))
      fd.set("removeFile", removeFile ? "true" : "false")
      if (fileRef.current?.files?.[0]) fd.set("file", fileRef.current.files[0])
      res = await updateDocumentAttachment(fd)
    } else {
      // draft
      fd.set("sourceAttachmentId", String(existing!.id))
      fd.set("keepFile", (!removeFile && !fileRef.current?.files?.[0]) ? "true" : "false")
      if (fileRef.current?.files?.[0]) fd.set("file", fileRef.current.files[0])
      res = await createAttachmentDraft(fd)
    }
    setPending(false)
    if (res?.error) { setError(res.error); return }
    onDone()
  }

  const showFileSection = mode !== "create"
  const hasExistingFile = !!existing?.fileName

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Značka <span className="text-red-500">*</span></label>
            <input value={znacka} onChange={(e) => setZnacka(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Názov <span className="text-red-500">*</span></label>
            <input value={nazov} onChange={(e) => setNazov(e.target.value)} className={inputCls} placeholder="Popis prílohy" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dátum schválenia <span className="text-red-500">*</span></label>
            <input type="date" value={datumSchvalenia} onChange={(e) => setDatumSchvalenia(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Úroveň dôvernosti</label>
            <select value={confidentiality} onChange={(e) => setConfidentiality(e.target.value as Confidentiality)} className={inputCls}>
              <option value="VEREJNY">Verejný</option>
              <option value="INTERNI">Interný</option>
              <option value="DOVERNI">Dôverný</option>
            </select>
          </div>
          {mode === "create" && confidentiality === "DOVERNI" && allUsers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Prístupy k prílohe
                {selectedUserIds.size > 0 && (
                  <span className="ml-1.5 text-purple-600 dark:text-purple-400">({selectedUserIds.size})</span>
                )}
              </label>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50 max-h-44 overflow-y-auto">
                {allUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(u.id)}
                      onChange={(e) => {
                        const next = new Set(selectedUserIds)
                        if (e.target.checked) next.add(u.id)
                        else next.delete(u.id)
                        setSelectedUserIds(next)
                      }}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{u.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Súbor</label>
            {(mode === "create" || (!hasExistingFile || removeFile)) ? (
              <div className="space-y-1">
                {mode !== "create" && hasExistingFile && removeFile && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Súbor bude {mode === "draft" ? "nahradený novým alebo ponechaný bez súboru" : "odstránený"}.{" "}
                    <button onClick={() => setRemoveFile(false)} className="underline">Zrušiť</button>
                  </p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400"
                />
                {fileName && <p className="text-xs text-gray-500">{fileName}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <Paperclip size={14} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{existing!.fileName}</span>
                <button onClick={() => setRemoveFile(true)} className="text-xs text-red-500 hover:text-red-700 shrink-0">
                  {mode === "draft" ? "Nahradiť" : "Odstrániť"}
                </button>
              </div>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Zrušiť</button>
          <button onClick={handleSubmit} disabled={pending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {pending && <Loader2 size={14} className="animate-spin" />}
            {mode === "create" ? "Pridať" : mode === "edit" ? "Uložiť" : "Vytvoriť návrh"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── New Document Draft Modal ─────────────────────────────────────────────────
interface NewDocDraftModalProps {
  doc: DocumentData
  nextZnacka: string
  nextVersion: number
  onClose: () => void
  onCreated: (newId: number) => void
}

function NewDocDraftModal({ doc, nextZnacka, nextVersion, onClose, onCreated }: NewDocDraftModalProps) {
  const today = new Date().toISOString().split("T")[0]
  const [znacka, setZnacka] = useState(nextZnacka)
  const [nazov, setNazov] = useState(doc.nazov)
  const [datumSchvalenia, setDatumSchvalenia] = useState(today)
  const [confidentiality, setConfidentiality] = useState<Confidentiality>(doc.confidentiality)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [keepPriloha, setKeepPriloha] = useState(!!doc.prilohaName)

  async function handleSubmit() {
    setPending(true); setError("")
    const fd = new FormData()
    fd.set("sourceDocumentId", String(doc.id))
    fd.set("znacka", znacka.trim())
    fd.set("nazov", nazov.trim())
    fd.set("datumSchvalenia", datumSchvalenia)
    fd.set("confidentiality", confidentiality)
    fd.set("keepPriloha", keepPriloha ? "true" : "false")
    if (fileRef.current?.files?.[0]) fd.set("priloha", fileRef.current.files[0])
    const res = await createDocumentDraft(fd)
    setPending(false)
    if (res?.error) { setError(res.error); return }
    if (res?.newDocumentId) onCreated(res.newDocumentId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Návrh novej verzie</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Vytvorí sa verzia <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">v_rev{nextVersion}</span> viditeľná len gestorovi</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Poradové číslo <span className="text-red-500">*</span></label>
            <input value={znacka} onChange={(e) => setZnacka(e.target.value)} placeholder="napr. 1-2024" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Názov <span className="text-red-500">*</span></label>
            <input value={nazov} onChange={(e) => setNazov(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Plánovaný dátum schválenia <span className="text-red-500">*</span></label>
            <input type="date" value={datumSchvalenia} onChange={(e) => setDatumSchvalenia(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Úroveň dôvernosti</label>
            <select value={confidentiality} onChange={(e) => setConfidentiality(e.target.value as Confidentiality)} className={inputCls}>
              <option value="VEREJNY">Verejný</option>
              <option value="INTERNI">Interný</option>
              <option value="DOVERNI">Dôverný</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Súbor dokumentu</label>
            {doc.prilohaName && keepPriloha ? (
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <Paperclip size={14} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{doc.prilohaName}</span>
                <button onClick={() => setKeepPriloha(false)} className="text-xs text-orange-500 hover:text-orange-700 shrink-0">Nahradiť</button>
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  ref={fileRef}
                  type="file"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400"
                />
                {fileName && <p className="text-xs text-gray-500">{fileName}</p>}
                {doc.prilohaName && !keepPriloha && (
                  <button onClick={() => setKeepPriloha(true)} className="text-xs text-blue-500 underline">Ponechať pôvodný súbor</button>
                )}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Zrušiť</button>
          <button onClick={handleSubmit} disabled={pending} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {pending && <Loader2 size={14} className="animate-spin" />}
            Vytvoriť návrh
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DocumentDetailClient({
  document: doc,
  versionHistory,
  latestDocId,
  nextDocVersionZnacka,
  canEdit,
  canDelete,
  canManageAccess,
  canManageGestors,
  isAppAdmin = false,
  hasDraft,
  draftDocId,
  allUsers,
  allUsersForAttachment,
  gestorUsers,
  notes: initialNotes,
  canManageNotes,
  canSeeAuxFiles,
  nextZnacka,
  attachmentOnlyMode = false,
}: Props) {
  const router = useRouter()

  // Document edit state
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    znacka: doc.znacka, nazov: doc.nazov,
    datumSchvalenia: doc.datumSchvalenia, confidentiality: doc.confidentiality,
    gestorId: (doc.gestors[0]?.id ?? null) as number | null,
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [removePriloha, setRemovePriloha] = useState(false)

  // Access & gestor state
  const [accessPending, setAccessPending] = useState<number | null>(null)
  const [gestorPending, setGestorPending] = useState(false)

  // Attachment state
  const [attachModal, setAttachModal] = useState<
    { mode: "create" } | { mode: "edit" | "draft"; attachment: AttachmentData } | null
  >(null)
  const [deletingAttach, setDeletingAttach] = useState<number | null>(null)
  const [attachAccessModal, setAttachAccessModal] = useState<AttachmentData | null>(null)
  const [attachAccessPending, setAttachAccessPending] = useState<number | null>(null)
  const [expandedAttachHistory, setExpandedAttachHistory] = useState<number | null>(null) // rootId
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [attachmentsOpen, setAttachmentsOpen] = useState(attachmentOnlyMode)
  const [accessOpen, setAccessOpen] = useState(false)

  // New document draft modal
  const [showNewDocDraft, setShowNewDocDraft] = useState(false)
  const [approvingDoc, setApprovingDoc] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState(false)

  // Notes state — initialNotes comes directly from server props (router.refresh() updates them)
  const [newNoteText, setNewNoteText] = useState("")
  const [addingNote, setAddingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingNoteText, setEditingNoteText] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null)

  // Aux files state
  const auxFileRef = useRef<HTMLInputElement>(null)
  const [addingDocAuxFile, setAddingDocAuxFile] = useState(false)
  const [savingDocAuxFile, setSavingDocAuxFile] = useState(false)
  const [deletingDocAuxFileId, setDeletingDocAuxFileId] = useState<number | null>(null)
  const attAuxFileRefs = useRef<Map<number, HTMLInputElement | null>>(new Map())
  const [addingAttAuxFile, setAddingAttAuxFile] = useState<number | null>(null) // attachmentId
  const [savingAttAuxFile, setSavingAttAuxFile] = useState(false)
  const [deletingAttAuxFileId, setDeletingAttAuxFileId] = useState<number | null>(null)

  const currentGestor = doc.gestors[0] ?? null
  const accessIds = new Set(doc.accesses.map((a) => a.id))
  const cisloDokumentu = doc.agendaSkratka ? `SKNIC-${doc.agendaSkratka}-${doc.znacka}-${doc.version}` : null

  // Group attachments by family (parentId ?? id = rootId)
  const attByRoot = new Map<number, AttachmentData[]>()
  for (const att of doc.attachments) {
    const rootId = att.parentId ?? att.id
    if (!attByRoot.has(rootId)) attByRoot.set(rootId, [])
    attByRoot.get(rootId)!.push(att)
  }
  const latestAttachments = doc.attachments.filter((a) => a.isLatest)

  async function handleSave() {
    setPending(true); setError("")
    const fd = new FormData()
    fd.set("documentId", String(doc.id))
    fd.set("znacka", form.znacka); fd.set("nazov", form.nazov)
    fd.set("datumSchvalenia", form.datumSchvalenia)
    fd.set("confidentiality", form.confidentiality)
    fd.set("removePriloha", removePriloha ? "true" : "false")
    if (fileRef.current?.files?.[0]) fd.set("priloha", fileRef.current.files[0])
    const res = await updateDocument(fd)
    setPending(false)
    if (res?.error) { setError(res.error); return }
    if (canManageGestors) await setDocumentGestor(doc.id, form.gestorId)
    setEditing(false); router.refresh()
  }

  async function handleAccess(userId: number, grant: boolean) {
    setAccessPending(userId)
    if (grant) await grantDocumentAccess(doc.id, userId)
    else await revokeDocumentAccess(doc.id, userId)
    setAccessPending(null); router.refresh()
  }

  async function handleGestor(userId: number | null) {
    setGestorPending(true)
    await setDocumentGestor(doc.id, userId)
    setGestorPending(false); router.refresh()
  }

  async function handleApproveDoc() {
    if (!confirm(`Naozaj chcete schváliť návrh verzie „${doc.nazov}"? Aktuálna verzia bude archivovaná.`)) return
    setApprovingDoc(true)
    await approveDocumentDraft(doc.id)
    setApprovingDoc(false)
    router.push(`/dashboard/dokumenty/${doc.agendaId}/${doc.id}`)
    router.refresh()
  }

  async function handleDeleteDoc() {
    const msg = doc.parentId === null
      ? `Naozaj chcete zmazať dokument „${doc.nazov}"? Budú vymazané všetky verzie dokumentu.`
      : `Naozaj chcete zmazať dokument „${doc.nazov}"? Bude vymazaná len táto verzia.`
    if (!confirm(msg)) return
    setDeletingDoc(true)
    const res = await deleteDocument(doc.id)
    setDeletingDoc(false)
    if (res?.error) { setError(res.error); return }
    router.push(`/dashboard/dokumenty/${doc.agendaId}`)
  }

  async function handleApproveAttachment(attachmentId: number) {
    if (!confirm("Naozaj chcete schváliť návrh prílohy?")) return
    await approveAttachmentDraft(attachmentId)
    router.refresh()
  }

  async function handleAddNote() {
    if (!newNoteText.trim()) return
    setSavingNote(true)
    const res = await createDocumentNote(doc.id, newNoteText)
    setSavingNote(false)
    if (res?.success) {
      setNewNoteText("")
      setAddingNote(false)
      router.refresh()
    }
  }

  async function handleSaveNote(noteId: number) {
    if (!editingNoteText.trim()) return
    setSavingNote(true)
    await updateDocumentNote(noteId, editingNoteText)
    setSavingNote(false)
    setEditingNoteId(null)
    router.refresh()
  }

  async function handleDeleteNote(noteId: number) {
    if (!confirm("Naozaj chcete zmazať túto poznámku?")) return
    setDeletingNoteId(noteId)
    await deleteDocumentNote(noteId)
    setDeletingNoteId(null)
    router.refresh()
  }

  async function handleAddDocAuxFile() {
    const file = auxFileRef.current?.files?.[0]
    if (!file) return
    setSavingDocAuxFile(true)
    const fd = new FormData()
    fd.set("file", file)
    await addDocumentAuxFile(doc.id, fd)
    setSavingDocAuxFile(false)
    setAddingDocAuxFile(false)
    if (auxFileRef.current) auxFileRef.current.value = ""
    router.refresh()
  }

  async function handleDeleteDocAuxFile(fileId: number) {
    if (!confirm("Naozaj chcete zmazať tento pomocný súbor?")) return
    setDeletingDocAuxFileId(fileId)
    await deleteDocumentAuxFile(fileId)
    setDeletingDocAuxFileId(null)
    router.refresh()
  }

  async function handleAddAttAuxFile(attachmentId: number) {
    const fileInput = attAuxFileRefs.current.get(attachmentId)
    const file = fileInput?.files?.[0]
    if (!file) return
    setSavingAttAuxFile(true)
    const fd = new FormData()
    fd.set("file", file)
    await addAttachmentAuxFile(attachmentId, fd)
    setSavingAttAuxFile(false)
    setAddingAttAuxFile(null)
    if (fileInput) fileInput.value = ""
    router.refresh()
  }

  async function handleDeleteAttAuxFile(fileId: number) {
    if (!confirm("Naozaj chcete zmazať tento pomocný súbor?")) return
    setDeletingAttAuxFileId(fileId)
    await deleteAttachmentAuxFile(fileId)
    setDeletingAttAuxFileId(null)
    router.refresh()
  }

  async function handleDeleteAttachment(id: number) {
    if (!confirm("Naozaj chcete zmazať túto verziu prílohy?")) return
    setDeletingAttach(id)
    await deleteDocumentAttachment(id)
    setDeletingAttach(null); router.refresh()
  }

  async function handleAttachAccess(attachmentId: number, userId: number, grant: boolean) {
    setAttachAccessPending(userId)
    if (grant) await grantAttachmentAccess(attachmentId, userId)
    else await revokeAttachmentAccess(attachmentId, userId)
    setAttachAccessPending(null); router.refresh()
  }

  return (
    <div className="max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/dokumenty" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <ArrowLeft size={14} className="inline mr-1" />Agendy
        </Link>
        <ChevronRight size={13} />
        <Link href={`/dashboard/dokumenty/${doc.agendaId}`} className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          {doc.agendaName}
        </Link>
        <ChevronRight size={13} />
        <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{doc.znacka}</span>
      </div>

      {/* App admin read-only banner */}
      {isAppAdmin && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg text-sm text-violet-700 dark:text-violet-300">
          Režim len na čítanie — väčšina údajov dokumentu je skrytá.
        </div>
      )}

      {/* Attachment-only access banner */}
      {attachmentOnlyMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          <Paperclip size={15} className="shrink-0" />
          Nemáte prístup k tomuto dokumentu, ale máte prístup k niektorým jeho prílohám — súbor dokumentu je skrytý.
        </div>
      )}

      {/* Historical version banner */}
      {!doc.isLatest && doc.status !== "DRAFT" && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            Toto je <strong>archivovaná verzia v{doc.version}</strong>.{" "}
            <Link href={`/dashboard/dokumenty/${doc.agendaId}/${latestDocId}`} className="underline hover:no-underline">
              Prejsť na aktuálnu verziu →
            </Link>
          </div>
        </div>
      )}

      {/* Draft banner */}
      {doc.status === "DRAFT" && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl">
          <AlertTriangle size={16} className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800 dark:text-orange-300">
            Toto je <strong>neschválený návrh verzie v{doc.version}</strong> — nie je verejne viditeľný.{" "}
            <Link href={`/dashboard/dokumenty/${doc.agendaId}/${latestDocId}`} className="underline hover:no-underline">
              Prejsť na aktuálnu verziu →
            </Link>
          </div>
        </div>
      )}

      {/* Document card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                {cisloDokumentu ?? doc.znacka}
              </span>
              {doc.status === "DRAFT" ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  v_rev{doc.version}
                </span>
              ) : doc.version > 1 ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  v{doc.version}
                </span>
              ) : null}
              {doc.status === "DRAFT" && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
                  Draft
                </span>
              )}
              {doc.status === "PUBLISHED" && !doc.isLatest && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  Archivovaná
                </span>
              )}
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${confidentialityColors[doc.confidentiality]}`}>
                {doc.confidentiality === "DOVERNI" && <Lock size={10} />}
                {doc.confidentiality === "INTERNI" && <Eye size={10} />}
                {doc.confidentiality === "VEREJNY" && <EyeOff size={10} />}
                {confidentialityLabels[doc.confidentiality]}
              </span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{doc.nazov}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Draft: Schváliť button */}
            {canEdit && doc.status === "DRAFT" && !editing && (
              <button
                onClick={handleApproveDoc}
                disabled={approvingDoc}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-60"
              >
                {approvingDoc ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                Schváliť verziu
              </button>
            )}
            {/* Published + latest: Vytvoriť návrh */}
            {canEdit && doc.isLatest && doc.status === "PUBLISHED" && !editing && !hasDraft && (
              <button
                onClick={() => setShowNewDocDraft(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
              >
                <GitBranch size={14} /> Vytvoriť návrh
              </button>
            )}
            {/* Published + latest: existing draft link */}
            {canEdit && doc.isLatest && doc.status === "PUBLISHED" && !editing && hasDraft && draftDocId && (
              <Link
                href={`/dashboard/dokumenty/${doc.agendaId}/${draftDocId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
              >
                <GitBranch size={14} /> Zobraziť návrh
              </Link>
            )}
            {canEdit && (doc.status === "PUBLISHED" ? doc.isLatest : true) && !editing && (
              <button
                onClick={() => { setEditing(true); setError(""); setFileName(null); setRemovePriloha(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Pencil size={14} /> Editovať
              </button>
            )}
            {canDelete && !editing && (
              <button
                onClick={handleDeleteDoc}
                disabled={deletingDoc}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-60"
              >
                {deletingDoc ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Zmazať
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Poradové číslo <span className="text-red-500">*</span></label>
              <input value={form.znacka} onChange={(e) => setForm((f) => ({ ...f, znacka: e.target.value }))} placeholder="napr. 1-2024" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Názov <span className="text-red-500">*</span></label>
              <input value={form.nazov} onChange={(e) => setForm((f) => ({ ...f, nazov: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dátum schválenia <span className="text-red-500">*</span></label>
              <input type="date" value={form.datumSchvalenia} onChange={(e) => setForm((f) => ({ ...f, datumSchvalenia: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Úroveň dôvernosti</label>
              <select value={form.confidentiality} onChange={(e) => setForm((f) => ({ ...f, confidentiality: e.target.value as Confidentiality }))} className={inputCls}>
                <option value="VEREJNY">Verejný</option>
                <option value="INTERNI">Interný</option>
                <option value="DOVERNI">Dôverný</option>
              </select>
            </div>
            {canManageGestors && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Gestor dokumentu</label>
                <select value={form.gestorId ?? ""} onChange={(e) => setForm((f) => ({ ...f, gestorId: e.target.value ? parseInt(e.target.value) : null }))} className={inputCls}>
                  <option value="">— Žiadny gestor —</option>
                  {gestorUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Súbor</label>
              {doc.prilohaName && !removePriloha ? (
                <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <Paperclip size={14} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{doc.prilohaName}</span>
                  <button onClick={() => setRemovePriloha(true)} className="text-xs text-red-500 hover:text-red-700 shrink-0">Odstrániť</button>
                </div>
              ) : (
                <div className="space-y-1">
                  {removePriloha && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      Súbor bude odstránený.{" "}
                      <button onClick={() => setRemovePriloha(false)} className="underline">Zrušiť</button>
                    </p>
                  )}
                  <input ref={fileRef} type="file" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                    className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400"
                  />
                  {fileName && <p className="text-xs text-gray-500">{fileName}</p>}
                </div>
              )}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X size={14} /> Zrušiť
              </button>
              <button onClick={handleSave} disabled={pending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {pending && <Loader2 size={14} className="animate-spin" />} Uložiť
              </button>
            </div>
          </div>
        ) : (
          <dl className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-5">
            <Field label="Poradové číslo">
              <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{doc.znacka}</span>
            </Field>
            <Field label="Dátum schválenia">
              <span className="text-sm text-gray-900 dark:text-gray-100 tabular-nums">{fmtDate(doc.datumSchvalenia)}</span>
            </Field>
            {doc.datumPrvehoSchvalenia ? (
              <Field label="Prvé schválenie">
                <span className="text-sm text-gray-900 dark:text-gray-100 tabular-nums">{fmtDate(doc.datumPrvehoSchvalenia)}</span>
              </Field>
            ) : (
              <Field label="Agenda">
                <span className="text-sm text-gray-900 dark:text-gray-100">{doc.agendaName}</span>
              </Field>
            )}
            <Field label="Gestor dokumentu">
              {currentGestor
                ? <span className="text-sm text-gray-900 dark:text-gray-100">{currentGestor.name}</span>
                : <span className="text-sm text-gray-400 dark:text-gray-500">—</span>}
            </Field>
            <Field label="Hlavný súbor">
              {doc.prilohaPath ? (
                <a href={`/api/dokumenty/file/${doc.prilohaPath}?name=${encodeURIComponent(doc.prilohaName ?? "priloha")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  <Download size={14} />{doc.prilohaName}
                </a>
              ) : attachmentOnlyMode ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                  <Lock size={11} /> Prístup obmedzený
                </span>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">Žiadny súbor</span>
              )}
            </Field>
            {canSeeAuxFiles && (
              <div className="col-span-full">
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Pomocné súbory</dt>
                <dd className="space-y-1">
                  {doc.auxFiles.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <a href={`/api/dokumenty/file/${f.storedName}?name=${encodeURIComponent(f.originalName)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline flex-1 min-w-0 truncate">
                        <Download size={13} />{f.originalName}
                      </a>
                      {canEdit && (
                        <button onClick={() => handleDeleteDocAuxFile(f.id)} disabled={deletingDocAuxFileId === f.id}
                          className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors shrink-0" title="Zmazať">
                          {deletingDocAuxFileId === f.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      )}
                    </div>
                  ))}
                  {canEdit && !addingDocAuxFile && (
                    <button onClick={() => setAddingDocAuxFile(true)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors mt-1">
                      <Plus size={12} /> Pridať pomocný súbor
                    </button>
                  )}
                  {canEdit && addingDocAuxFile && (
                    <div className="flex items-center gap-2 mt-1">
                      <input ref={auxFileRef} type="file"
                        className="text-xs text-gray-700 dark:text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-300" />
                      <button onClick={handleAddDocAuxFile} disabled={savingDocAuxFile}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs disabled:opacity-60">
                        {savingDocAuxFile ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Uložiť
                      </button>
                      <button onClick={() => setAddingDocAuxFile(false)}
                        className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 rounded">Zrušiť</button>
                    </div>
                  )}
                  {doc.auxFiles.length === 0 && !addingDocAuxFile && (
                    <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                  )}
                </dd>
              </div>
            )}
            {doc.datumPrvehoSchvalenia && (
              <Field label="Agenda">
                <span className="text-sm text-gray-900 dark:text-gray-100">{doc.agendaName}</span>
              </Field>
            )}
          </dl>
        )}
      </div>

      {/* Version History */}
      {versionHistory.length > 1 && (
        <div className="mt-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <button
            type="button"
            onClick={() => setVersionHistoryOpen((o) => !o)}
            className="w-full px-5 py-4 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors rounded-xl"
          >
            <History size={15} className="text-gray-500 shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">História verzií</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">({versionHistory.length})</span>
            <span className="ml-auto text-gray-400 dark:text-gray-500">
              {versionHistoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>
          {versionHistoryOpen && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700" />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-2.5">Ver.</th>
                    <th className="text-left px-5 py-2.5">Značka</th>
                    <th className="text-left px-5 py-2.5">Názov</th>
                    <th className="text-left px-5 py-2.5">Dátum schválenia</th>
                    <th className="text-left px-5 py-2.5">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {versionHistory.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => router.push(`/dashboard/dokumenty/${doc.agendaId}/${v.id}`)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${v.id === doc.id ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                    >
                      <td className="px-5 py-3">
                        {v.status === "DRAFT" ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">v_rev{v.version}</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">v{v.version}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">{v.znacka}</td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{v.nazov}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400 tabular-nums">{fmtDate(v.datumSchvalenia)}</td>
                      <td className="px-5 py-3">
                        {v.status === "DRAFT"
                          ? <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-700">Draft</span>
                          : v.isLatest
                            ? <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">Aktuálna</span>
                            : <span className="text-xs text-gray-400 dark:text-gray-500">Archivovaná</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Prílohy */}
      <div className="mt-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className={`px-5 py-4 ${attachmentsOpen ? "border-b border-gray-200 dark:border-gray-700" : ""} flex items-center gap-2`}>
          <button type="button" onClick={() => setAttachmentsOpen((o) => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
            <Paperclip size={15} className="text-gray-500 shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Prílohy</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">({latestAttachments.length})</span>
            <span className="ml-2 text-gray-400 dark:text-gray-500">
              {attachmentsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>
          {canEdit && doc.isLatest && (
            <button
              onClick={() => setAttachModal({ mode: "create" })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
            >
              <Plus size={13} /> Pridať prílohu
            </button>
          )}
        </div>

        {attachmentsOpen && (latestAttachments.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-gray-500">Žiadne prílohy.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5">Značka</th>
                  <th className="text-left px-5 py-2.5">Názov</th>
                  <th className="text-left px-5 py-2.5">Prvé schválenie</th>
                  <th className="text-left px-5 py-2.5">Schválenie verzie</th>
                  <th className="text-left px-5 py-2.5">Dôvernosť</th>
                  <th className="text-left px-5 py-2.5">Súbor</th>
                  <th className="px-5 py-2.5" />
                  {canSeeAuxFiles && <th className="text-left px-5 py-2.5">Pom. súbory</th>}
                </tr>
              </thead>
              <tbody>
                {latestAttachments.map((att) => {
                  const rootId = att.parentId ?? att.id
                  const family = attByRoot.get(rootId) ?? [att]
                  const historicCount = family.filter((a) => !a.isLatest && a.status !== "DRAFT").length
                  const hasHistory = historicCount > 0
                  const isExpanded = expandedAttachHistory === rootId

                  return (
                    <Fragment key={att.id}>
                      <tr className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!att.canDownload && att.confidentiality === "DOVERNI" ? "opacity-60 bg-red-50/20 dark:bg-red-900/5" : ""}`}>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                              {att.znacka}
                            </span>
                            {att.status === "DRAFT" ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                v_rev{att.version}
                              </span>
                            ) : att.version > 1 ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                v{att.version}
                              </span>
                            ) : null}
                            {att.status === "DRAFT" && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700">
                                Draft
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-gray-900 dark:text-gray-100">{att.nazov}</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                          {att.datumPrvehoSchvalenia ? fmtDate(att.datumPrvehoSchvalenia) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                          {fmtDate(att.datumSchvalenia)}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${confidentialityColors[att.confidentiality]}`}>
                            {att.confidentiality === "DOVERNI" && <Lock size={10} />}
                            {confidentialityLabels[att.confidentiality]}
                          </span>
                          {att.accessUsers.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              <Users size={10} className="text-purple-400 shrink-0" />
                              {att.accessUsers.map((u) => (
                                <span key={u.id} className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-full">
                                  {u.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {att.filePath ? (
                            att.canDownload ? (
                              <a href={`/api/dokumenty/file/${att.filePath}?name=${encodeURIComponent(att.fileName ?? "priloha")}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline text-xs">
                                <Download size={13} /> {att.fileName}
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                <Lock size={11} /> Nemáte prístup
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {hasHistory && (
                              <button
                                onClick={() => setExpandedAttachHistory(isExpanded ? null : rootId)}
                                className={`p-1.5 rounded-lg transition-colors text-xs font-medium flex items-center gap-1 ${isExpanded ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"}`}
                                title="História verzií"
                              >
                                <History size={13} /> {historicCount}
                              </button>
                            )}
                            {canEdit && att.confidentiality === "DOVERNI" && (
                              <button onClick={() => setAttachAccessModal(att)}
                                className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors" title="Správa prístupov">
                                <Users size={13} />
                              </button>
                            )}
                            {canEdit && att.status === "DRAFT" && (
                              <button onClick={() => handleApproveAttachment(att.id)}
                                className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Schváliť návrh prílohy">
                                <GitBranch size={13} />
                              </button>
                            )}
                            {canEdit && att.status === "PUBLISHED" && doc.isLatest && (
                              <button
                                onClick={() => setAttachModal({ mode: "draft", attachment: att })}
                                className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                title="Vytvoriť návrh novej verzie prílohy"
                              >
                                <GitBranch size={13} />
                              </button>
                            )}
                            {canEdit && doc.isLatest && (
                              <>
                                <button onClick={() => setAttachModal({ mode: "edit", attachment: att })}
                                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Editovať">
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => handleDeleteAttachment(att.id)} disabled={deletingAttach === att.id}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Zmazať">
                                  {deletingAttach === att.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        {canSeeAuxFiles && (
                          <td className="px-5 py-3 align-top">
                            <div className="flex flex-col gap-1">
                              {att.auxFiles.map((f) => (
                                <div key={f.id} className="flex items-center gap-1">
                                  <a href={`/api/dokumenty/file/${f.storedName}?name=${encodeURIComponent(f.originalName)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[180px]">
                                    <Download size={11} className="shrink-0" />{f.originalName}
                                  </a>
                                  {canEdit && (
                                    <button onClick={() => handleDeleteAttAuxFile(f.id)} disabled={deletingAttAuxFileId === f.id}
                                      className="p-0.5 text-gray-300 hover:text-red-500 rounded transition-colors shrink-0" title="Zmazať">
                                      {deletingAttAuxFileId === f.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                    </button>
                                  )}
                                </div>
                              ))}
                              {canEdit && doc.isLatest && addingAttAuxFile === att.id ? (
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  <input
                                    ref={(el) => { attAuxFileRefs.current.set(att.id, el) }}
                                    type="file"
                                    className="text-xs text-gray-700 dark:text-gray-300 file:mr-1 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-xs file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-300 max-w-[160px]"
                                  />
                                  <button onClick={() => handleAddAttAuxFile(att.id)} disabled={savingAttAuxFile}
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs disabled:opacity-60 shrink-0">
                                    {savingAttAuxFile ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Uložiť
                                  </button>
                                  <button onClick={() => setAddingAttAuxFile(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1 shrink-0">Zrušiť</button>
                                </div>
                              ) : canEdit && doc.isLatest ? (
                                <button onClick={() => setAddingAttAuxFile(att.id)}
                                  className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-blue-500 transition-colors">
                                  <Plus size={11} /> Pridať
                                </button>
                              ) : att.auxFiles.length === 0 ? (
                                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                              ) : null}
                            </div>
                          </td>
                        )}
                      </tr>
                      {/* Draft attachment rows — always visible to gestors */}
                      {family.filter((a) => a.status === "DRAFT").map((draft) => (
                        <tr key={draft.id} className="border-b border-orange-100 dark:border-orange-900/30 bg-orange-50/40 dark:bg-orange-900/10">
                          <td className="pl-10 pr-5 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-orange-700 dark:text-orange-400">{draft.znacka}</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">v_rev{draft.version}</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400">Draft</span>
                            </div>
                          </td>
                          <td className="px-5 py-2 text-xs text-orange-700 dark:text-orange-300">{draft.nazov}</td>
                          <td className="px-5 py-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">—</td>
                          <td className="px-5 py-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">{fmtDate(draft.datumSchvalenia)}</td>
                          <td className="px-5 py-2" colSpan={2}>
                            {draft.filePath && draft.canDownload ? (
                              <a href={`/api/dokumenty/file/${draft.filePath}?name=${encodeURIComponent(draft.fileName ?? "priloha")}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-500 hover:underline text-xs">
                                <Download size={12} /> {draft.fileName}
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-2 text-right">
                            {canEdit && (
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => handleApproveAttachment(draft.id)}
                                  className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Schváliť návrh">
                                  <GitBranch size={12} />
                                </button>
                                <button onClick={() => setAttachModal({ mode: "edit", attachment: draft })}
                                  className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Editovať návrh">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => handleDeleteAttachment(draft.id)} disabled={deletingAttach === draft.id}
                                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Zmazať návrh">
                                  {deletingAttach === draft.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
                              </div>
                            )}
                          </td>
                          {canSeeAuxFiles && <td />}
                        </tr>
                      ))}
                      {/* Inline attachment version history */}
                      {isExpanded && family.filter((a) => !a.isLatest && a.status !== "DRAFT").map((old) => (
                        <tr key={old.id} className="border-b border-gray-100 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-800/20">
                          <td className="pl-10 pr-5 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{old.znacka}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">v{old.version}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2 text-xs text-gray-500 dark:text-gray-400">{old.nazov}</td>
                          <td className="px-5 py-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                            {old.datumPrvehoSchvalenia ? fmtDate(old.datumPrvehoSchvalenia) : "—"}
                          </td>
                          <td className="px-5 py-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">{fmtDate(old.datumSchvalenia)}</td>
                          <td className="px-5 py-2" colSpan={2}>
                            {old.filePath && old.canDownload ? (
                              <a href={`/api/dokumenty/file/${old.filePath}?name=${encodeURIComponent(old.fileName ?? "priloha")}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-500 hover:underline text-xs">
                                <Download size={12} /> {old.fileName}
                              </a>
                            ) : old.filePath ? (
                              <span className="text-xs text-gray-400 flex items-center gap-1"><Lock size={11} /> Prístup obmedzený</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-2 text-right">
                            {canEdit && doc.isLatest && (
                              <button onClick={() => handleDeleteAttachment(old.id)} disabled={deletingAttach === old.id}
                                className="p-1 text-gray-300 hover:text-red-500 rounded-lg" title="Zmazať archivovanú verziu">
                                {deletingAttach === old.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            )}
                          </td>
                          {canSeeAuxFiles && <td />}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Prístupy používateľov */}
      {canManageAccess && doc.isLatest && (
        <div className="mt-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <button type="button" onClick={() => setAccessOpen((o) => !o)} className={`w-full px-5 py-4 ${accessOpen ? "border-b border-gray-200 dark:border-gray-700" : ""} flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors rounded-xl`}>
            <Users size={15} className="text-gray-500 shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Prístupy používateľov</h2>
            <span className="ml-auto text-gray-400 dark:text-gray-500">
              {accessOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>
          {accessOpen && (doc.confidentiality !== "DOVERNI" ? (
            <div className="px-5 py-4 flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${doc.confidentiality === "VEREJNY" ? "bg-green-400" : "bg-blue-400"}`} />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {doc.confidentiality === "VEREJNY"
                  ? "Dokument je verejný — prístup majú všetci (vrátane neprihlásených)."
                  : "Dokument je interný — prístup majú automaticky všetci prihlásení používatelia."}
                {canEdit && (
                  <span className="block mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Pre individuálnu správu prístupov zmeňte dôvernosť na <strong className="text-gray-600 dark:text-gray-400">Dôverný</strong>.
                  </span>
                )}
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {[...allUsers].sort((a, b) => Number(b.hasAccess) - Number(a.hasAccess)).map((u) => (
                  <li key={u.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{u.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                    </div>
                    <button onClick={() => handleAccess(u.id, !accessIds.has(u.id))} disabled={accessPending === u.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        accessIds.has(u.id)
                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}>
                      {accessPending === u.id ? <Loader2 size={12} className="animate-spin" />
                        : accessIds.has(u.id) ? <><UserMinus size={12} /> Odobrať prístup</>
                        : <><UserPlus size={12} /> Udeliť prístup</>}
                    </button>
                  </li>
                ))}
              </ul>
              {allUsers.length === 0 && <p className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">Žiadni ďalší používatelia.</p>}
            </>
          ))}
        </div>
      )}

      {/* Poznámky */}
      {canManageNotes && (
        <div className="mt-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Poznámky</h2>
              {initialNotes.length > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">({initialNotes.length})</span>
              )}
            </div>
            {!addingNote && (
              <button
                onClick={() => setAddingNote(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus size={13} /> Pridať poznámku
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {initialNotes.length === 0 && !addingNote && (
              <p className="px-5 py-5 text-sm text-gray-400 dark:text-gray-500">Žiadne poznámky.</p>
            )}

            {initialNotes.map((note) => (
              <div key={note.id} className="px-5 py-4">
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        Zrušiť
                      </button>
                      <button
                        onClick={() => handleSaveNote(note.id)}
                        disabled={savingNote || !editingNoteText.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-60 transition-colors"
                      >
                        {savingNote && <Loader2 size={12} className="animate-spin" />}
                        Uložiť
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                        {note.createdByName}
                        {" · "}
                        {new Date(note.updatedAt) > new Date(note.createdAt)
                          ? `upravené ${new Date(note.updatedAt).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                          : new Date(note.createdAt).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.content) }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Upraviť"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        disabled={deletingNoteId === note.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Zmazať"
                      >
                        {deletingNoteId === note.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addingNote && (
              <div className="px-5 py-4 space-y-2">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Napíšte poznámku…"
                  rows={3}
                  autoFocus
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setAddingNote(false); setNewNoteText("") }}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Zrušiť
                  </button>
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !newNoteText.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-60 transition-colors"
                  >
                    {savingNote ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Uložiť
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {attachModal && (
        <AttachmentModal
          mode={attachModal.mode}
          documentId={doc.id}
          defaultZnacka={nextZnacka}
          defaultConfidentiality={doc.confidentiality}
          existing={"attachment" in attachModal ? attachModal.attachment : undefined}
          allUsers={allUsersForAttachment}
          onClose={() => setAttachModal(null)}
          onDone={() => { setAttachModal(null); router.refresh() }}
        />
      )}

      {attachAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAttachAccessModal(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Prístupy k prílohe</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">{attachAccessModal.znacka}</p>
              </div>
              <button onClick={() => setAttachAccessModal(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"><X size={18} /></button>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-80 overflow-y-auto">
              {allUsersForAttachment.map((u) => {
                const hasAccess = attachAccessModal.accessUserIds.includes(u.id)
                return (
                  <li key={u.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{u.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                    </div>
                    <button onClick={() => handleAttachAccess(attachAccessModal.id, u.id, !hasAccess)} disabled={attachAccessPending === u.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        hasAccess ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}>
                      {attachAccessPending === u.id ? <Loader2 size={12} className="animate-spin" />
                        : hasAccess ? <><UserMinus size={12} /> Odobrať</> : <><UserPlus size={12} /> Udeliť</>}
                    </button>
                  </li>
                )
              })}
            </ul>
            {allUsersForAttachment.length === 0 && <p className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">Žiadni ďalší používatelia.</p>}
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500">Správcovia a gestori agendy/dokumentu majú prístup vždy.</p>
            </div>
          </div>
        </div>
      )}

      {showNewDocDraft && (
        <NewDocDraftModal
          doc={doc}
          nextZnacka={nextDocVersionZnacka}
          nextVersion={doc.version + 1}
          onClose={() => setShowNewDocDraft(false)}
          onCreated={(newId) => {
            setShowNewDocDraft(false)
            router.push(`/dashboard/dokumenty/${doc.agendaId}/${newId}`)
          }}
        />
      )}
    </div>
  )
}
