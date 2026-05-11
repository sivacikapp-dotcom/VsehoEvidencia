"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, ChevronRight, Pencil, X, Loader2, Paperclip,
  Download, Lock, Eye, EyeOff, Users, UserPlus, UserMinus, Shield,
  Plus, Trash2, History, GitBranch, AlertTriangle,
} from "lucide-react"
import {
  updateDocument, grantDocumentAccess, revokeDocumentAccess, setDocumentGestor,
  createDocumentAttachment, updateDocumentAttachment, deleteDocumentAttachment,
  grantAttachmentAccess, revokeAttachmentAccess,
  createDocumentVersion, createAttachmentVersion,
} from "../../actions"
import { fmtDate } from "@/lib/formatDate"

type Confidentiality = "VEREJNY" | "INTERNI" | "DOVERNI"
interface DocUser { id: number; name: string; email: string }
interface DocUserWithAccess extends DocUser { hasAccess: boolean }

interface AttachmentData {
  id: number
  znacka: string
  nazov: string
  datumSchvalenia: string
  datumPrvehoSchvalenia: string | null
  version: number
  parentId: number | null
  isLatest: boolean
  confidentiality: Confidentiality
  filePath: string | null
  fileName: string | null
  canDownload: boolean
  accessUserIds: number[]
  accessUsers: { id: number; name: string; email: string }[]
}

interface VersionHistoryItem {
  id: number
  version: number
  znacka: string
  nazov: string
  datumSchvalenia: string
  isLatest: boolean
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
  version: number
  isLatest: boolean
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
  canManageAccess: boolean
  canManageGestors: boolean
  isAdmin: boolean
  isAppAdmin?: boolean
  allUsers: DocUserWithAccess[]
  allUsersForAttachment: DocUser[]
  nextZnacka: string
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

// ─── Attachment Modal (create / edit / new version) ───────────────────────────
interface AttachmentModalProps {
  mode: "create" | "edit" | "newVersion"
  documentId: number
  defaultZnacka: string
  defaultConfidentiality: Confidentiality
  existing?: AttachmentData
  onClose: () => void
  onDone: () => void
}

function AttachmentModal({ mode, documentId, defaultZnacka, defaultConfidentiality, existing, onClose, onDone }: AttachmentModalProps) {
  const today = new Date().toISOString().split("T")[0]
  const [znacka, setZnacka] = useState(existing?.znacka ?? defaultZnacka)
  const [nazov, setNazov] = useState(existing?.nazov ?? "")
  const [datumSchvalenia, setDatumSchvalenia] = useState(
    mode === "newVersion" ? today : (existing?.datumSchvalenia ?? today)
  )
  const [confidentiality, setConfidentiality] = useState<Confidentiality>(
    existing?.confidentiality ?? defaultConfidentiality
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [removeFile, setRemoveFile] = useState(false)

  const title = mode === "create" ? "Nová príloha" : mode === "edit" ? "Editovať prílohu" : `Nová verzia prílohy (v${(existing?.version ?? 1) + 1})`

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
      res = await createDocumentAttachment(fd)
    } else if (mode === "edit") {
      fd.set("attachmentId", String(existing!.id))
      fd.set("removeFile", removeFile ? "true" : "false")
      if (fileRef.current?.files?.[0]) fd.set("file", fileRef.current.files[0])
      res = await updateDocumentAttachment(fd)
    } else {
      // newVersion
      fd.set("sourceAttachmentId", String(existing!.id))
      fd.set("keepFile", (!removeFile && !fileRef.current?.files?.[0]) ? "true" : "false")
      if (fileRef.current?.files?.[0]) fd.set("file", fileRef.current.files[0])
      res = await createAttachmentVersion(fd)
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
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Súbor</label>
            {(mode === "create" || (!hasExistingFile || removeFile)) ? (
              <div className="space-y-1">
                {mode !== "create" && hasExistingFile && removeFile && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Súbor bude {mode === "newVersion" ? "nahradený novým alebo ponechaný bez súboru" : "odstránený"}.{" "}
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
                  {mode === "newVersion" ? "Nahradiť" : "Odstrániť"}
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
            {mode === "create" ? "Pridať" : mode === "edit" ? "Uložiť" : "Vytvoriť verziu"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── New Document Version Modal ───────────────────────────────────────────────
interface NewDocVersionModalProps {
  doc: DocumentData
  nextZnacka: string
  onClose: () => void
  onCreated: (newId: number) => void
}

function NewDocVersionModal({ doc, nextZnacka, onClose, onCreated }: NewDocVersionModalProps) {
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
    const res = await createDocumentVersion(fd)
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nová verzia dokumentu</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Archivovaná verzia zostane v histórii</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Značka <span className="text-red-500">*</span></label>
            <input value={znacka} onChange={(e) => setZnacka(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Názov <span className="text-red-500">*</span></label>
            <input value={nazov} onChange={(e) => setNazov(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dátum schválenia tejto verzie <span className="text-red-500">*</span></label>
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Príloha dokumentu</label>
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
                  <button onClick={() => setKeepPriloha(true)} className="text-xs text-blue-500 underline">Ponechať pôvodnú prílohu</button>
                )}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Zrušiť</button>
          <button onClick={handleSubmit} disabled={pending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {pending && <Loader2 size={14} className="animate-spin" />}
            Vytvoriť verziu
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
  canManageAccess,
  canManageGestors,
  isAppAdmin = false,
  allUsers,
  allUsersForAttachment,
  nextZnacka,
}: Props) {
  const router = useRouter()

  // Document edit state
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    znacka: doc.znacka, nazov: doc.nazov,
    datumSchvalenia: doc.datumSchvalenia, confidentiality: doc.confidentiality,
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
    { mode: "create" } | { mode: "edit" | "newVersion"; attachment: AttachmentData } | null
  >(null)
  const [deletingAttach, setDeletingAttach] = useState<number | null>(null)
  const [attachAccessModal, setAttachAccessModal] = useState<AttachmentData | null>(null)
  const [attachAccessPending, setAttachAccessPending] = useState<number | null>(null)
  const [expandedAttachHistory, setExpandedAttachHistory] = useState<number | null>(null) // rootId

  // New document version modal
  const [showNewDocVersion, setShowNewDocVersion] = useState(false)

  const currentGestor = doc.gestors[0] ?? null
  const accessIds = new Set(doc.accesses.map((a) => a.id))

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
    <div className="max-w-3xl">
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

      {/* Historical version banner */}
      {!doc.isLatest && (
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

      {/* Document card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                {doc.znacka}
              </span>
              {doc.version > 1 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  v{doc.version}
                </span>
              )}
              {!doc.isLatest && (
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
            {canEdit && doc.isLatest && !editing && (
              <button
                onClick={() => setShowNewDocVersion(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
              >
                <GitBranch size={14} /> Nová verzia
              </button>
            )}
            {canEdit && doc.isLatest && !editing && (
              <button
                onClick={() => { setEditing(true); setError(""); setFileName(null); setRemovePriloha(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Pencil size={14} /> Editovať
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Značka <span className="text-red-500">*</span></label>
              <input value={form.znacka} onChange={(e) => setForm((f) => ({ ...f, znacka: e.target.value }))} className={inputCls} />
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
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Príloha</label>
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
                      Príloha bude odstránená.{" "}
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
          <dl className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-5">
            {doc.datumPrvehoSchvalenia ? (
              <>
                <Field label="Prvé schválenie">
                  <span className="text-sm text-gray-900 dark:text-gray-100 tabular-nums">{fmtDate(doc.datumPrvehoSchvalenia)}</span>
                </Field>
                <Field label="Schválenie tejto verzie">
                  <span className="text-sm text-gray-900 dark:text-gray-100 tabular-nums">{fmtDate(doc.datumSchvalenia)}</span>
                </Field>
              </>
            ) : (
              <Field label="Dátum schválenia">
                <span className="text-sm text-gray-900 dark:text-gray-100 tabular-nums">{fmtDate(doc.datumSchvalenia)}</span>
              </Field>
            )}
            <Field label="Agenda">
              <span className="text-sm text-gray-900 dark:text-gray-100">{doc.agendaName}</span>
            </Field>
            <Field label="Príloha">
              {doc.prilohaPath ? (
                <a href={`/api/dokumenty/file/${doc.prilohaPath}?name=${encodeURIComponent(doc.prilohaName ?? "priloha")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  <Download size={14} />{doc.prilohaName}
                </a>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">Žiadna príloha</span>
              )}
            </Field>
            <Field label="Gestor dokumentu">
              {currentGestor
                ? <span className="text-sm text-gray-900 dark:text-gray-100">{currentGestor.name}</span>
                : <span className="text-sm text-gray-400 dark:text-gray-500">—</span>}
            </Field>
          </dl>
        )}
      </div>

      {/* Version History */}
      {versionHistory.length > 1 && (
        <div className="mt-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <History size={15} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">História verzií</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">({versionHistory.length})</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-2.5">Verzia</th>
                <th className="text-left px-5 py-2.5">Značka</th>
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
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">v{v.version}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">{v.znacka}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400 tabular-nums">{fmtDate(v.datumSchvalenia)}</td>
                  <td className="px-5 py-3">
                    {v.isLatest
                      ? <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">Aktuálna</span>
                      : <span className="text-xs text-gray-400 dark:text-gray-500">Archivovaná</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Prílohy */}
      <div className="mt-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip size={15} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Prílohy</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">({latestAttachments.length})</span>
          </div>
          {canEdit && doc.isLatest && (
            <button
              onClick={() => setAttachModal({ mode: "create" })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Plus size={13} /> Pridať prílohu
            </button>
          )}
        </div>

        {latestAttachments.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-gray-500">Žiadne prílohy.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5">Značka</th>
                  <th className="text-left px-5 py-2.5">Názov</th>
                  <th className="text-left px-5 py-2.5">Schválenie</th>
                  <th className="text-left px-5 py-2.5">Dôvernosť</th>
                  <th className="text-left px-5 py-2.5">Súbor</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {latestAttachments.map((att) => {
                  const rootId = att.parentId ?? att.id
                  const family = attByRoot.get(rootId) ?? [att]
                  const hasHistory = family.length > 1
                  const isExpanded = expandedAttachHistory === rootId

                  return (
                    <>
                      <tr key={att.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                              {att.znacka}
                            </span>
                            {att.version > 1 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                v{att.version}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{att.nazov}</td>
                        <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                          <div>{fmtDate(att.datumSchvalenia)}</div>
                          {att.datumPrvehoSchvalenia && (
                            <div className="text-gray-400 dark:text-gray-500">Prvé: {fmtDate(att.datumPrvehoSchvalenia)}</div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${confidentialityColors[att.confidentiality]}`}>
                            {att.confidentiality === "DOVERNI" && <Lock size={10} />}
                            {confidentialityLabels[att.confidentiality]}
                          </span>
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
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                <Lock size={11} /> Prístup obmedzený
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
                                <History size={13} /> {family.length}
                              </button>
                            )}
                            {canEdit && att.confidentiality === "DOVERNI" && (
                              <button onClick={() => setAttachAccessModal(att)}
                                className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors" title="Správa prístupov">
                                <Users size={13} />
                              </button>
                            )}
                            {canEdit && doc.isLatest && (
                              <>
                                <button onClick={() => setAttachModal({ mode: "newVersion", attachment: att })}
                                  className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Nová verzia prílohy">
                                  <GitBranch size={13} />
                                </button>
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
                      </tr>
                      {/* Inline attachment version history */}
                      {isExpanded && family.filter((a) => !a.isLatest).map((old) => (
                        <tr key={old.id} className="border-b border-gray-100 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-800/20">
                          <td className="pl-10 pr-5 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{old.znacka}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">v{old.version}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2 text-xs text-gray-500 dark:text-gray-400">{old.nazov}</td>
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
                        </tr>
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Gestor dokumentu */}
      {canManageGestors && doc.isLatest && (
        <div className="mt-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Shield size={15} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Gestor dokumentu</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">— môže editovať tento dokument</span>
          </div>
          <div className="px-5 py-4 flex items-center gap-3">
            <select value={currentGestor?.id ?? ""} onChange={(e) => handleGestor(e.target.value ? parseInt(e.target.value) : null)}
              disabled={gestorPending}
              className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60">
              <option value="">— Žiadny gestor —</option>
              {allUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {gestorPending && <Loader2 size={16} className="animate-spin text-gray-400 shrink-0" />}
          </div>
        </div>
      )}

      {/* Prístupy používateľov */}
      {canManageAccess && doc.isLatest && (
        <div className="mt-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Users size={15} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Prístupy používateľov</h2>
          </div>
          {doc.confidentiality !== "DOVERNI" ? (
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
                {allUsers.map((u) => (
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
          )}
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

      {showNewDocVersion && (
        <NewDocVersionModal
          doc={doc}
          nextZnacka={nextDocVersionZnacka}
          onClose={() => setShowNewDocVersion(false)}
          onCreated={(newId) => {
            setShowNewDocVersion(false)
            router.push(`/dashboard/dokumenty/${doc.agendaId}/${newId}`)
          }}
        />
      )}
    </div>
  )
}
