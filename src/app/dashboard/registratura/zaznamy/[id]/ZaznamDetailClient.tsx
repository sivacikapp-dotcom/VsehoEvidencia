"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, FileText, Upload, Download, ShieldCheck, ShieldAlert,
  CheckCircle, Clock, Archive, Trash2, FolderOpen,
} from "lucide-react"
import { regZaznamStatusLabels, regZaznamStatusColors, regZaznamTypeLabels, spisStatusColors, spisStatusLabels } from "@/lib/regLabels"
import type { RegZaznamStatus, RegZaznamType, SpisStatus } from "@/generated/prisma/enums"
import { updateZaznam, changeZaznamStatus } from "../actions"

type ZaznamDetail = {
  id: number
  cisloZaznamu: string
  plan: { id: number; znacka: string; nazov: string; lehota: number; maArchivnu: boolean }
  spracovatel: string
  typZaznamu: RegZaznamType
  umiestnenieFyzicke: string | null
  originalName: string | null
  fileSize: number | null
  fileHash: string | null
  status: RegZaznamStatus
  posta: { id: number; poradoveCislo: string; vec: string } | null
  spisy: { id: number; cisloSpisu: string; nazov: string; status: SpisStatus }[]
  createdAt: string
  updatedAt: string
}

interface Props {
  zaznam: ZaznamDetail
  plans: { id: number; znacka: string; nazov: string }[]
  canManage: boolean
  isAdmin: boolean
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STATUS_TRANSITIONS: Record<RegZaznamStatus, RegZaznamStatus | null> = {
  ROZPRACOVANY: "REGISTROVANY",
  REGISTROVANY: "UZAVRETY",
  UZAVRETY: null,
  VYRADENY: null,
}

const STATUS_NEXT_LABEL: Partial<Record<RegZaznamStatus, string>> = {
  REGISTROVANY: "Registrovať",
  UZAVRETY: "Uzavrieť záznam",
}

export default function ZaznamDetailClient({ zaznam, plans, canManage, isAdmin }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [integrityOk, setIntegrityOk] = useState<boolean | null>(null)

  const nextStatus = STATUS_TRANSITIONS[zaznam.status]
  const nextLabel = nextStatus ? STATUS_NEXT_LABEL[nextStatus] : null

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError("")
    const result = await updateZaznam(zaznam.id, new FormData(e.currentTarget))
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setEditing(false)
    startTransition(() => router.refresh())
  }

  async function handleStatusChange() {
    if (!nextStatus) return
    setSaving(true); setError("")
    const result = await changeZaznamStatus(zaznam.id, nextStatus)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    startTransition(() => router.refresh())
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError("")
    const fd = new FormData()
    fd.append("file", file)
    fd.append("zaznamId", String(zaznam.id))
    const res = await fetch("/api/registratura/upload", { method: "POST", body: fd })
    const json = await res.json()
    setUploading(false)
    if (!res.ok) { setUploadError(json.error ?? "Chyba pri nahrávaní."); return }
    startTransition(() => router.refresh())
  }

  async function handleDownload() {
    setIntegrityOk(null)
    const res = await fetch(`/api/registratura/file/${zaznam.id}`)
    if (res.status === 409) {
      setIntegrityOk(false)
      return
    }
    if (!res.ok) { setError("Súbor sa nedá stiahnuť."); return }
    setIntegrityOk(true)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = zaznam.originalName ?? "dokument"
    a.click()
    URL.revokeObjectURL(url)
  }

  const isEditable = canManage && zaznam.status !== "UZAVRETY" && zaznam.status !== "VYRADENY"

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/registratura/zaznamy"
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Späť na záznamy
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{zaznam.cisloZaznamu}</p>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mt-0.5">
            {zaznam.plan.znacka} – {zaznam.plan.nazov}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${regZaznamStatusColors[zaznam.status]}`}>
              {regZaznamStatusLabels[zaznam.status]}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{regZaznamTypeLabels[zaznam.typZaznamu]}</span>
          </div>
        </div>
        {canManage && nextStatus && nextLabel && (
          <button onClick={handleStatusChange} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
            {nextStatus === "UZAVRETY" ? <Archive size={15} /> : <CheckCircle size={15} />}
            {nextLabel}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Meta grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info card */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-900 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Detaily záznamu</h2>
            {isEditable && !editing && (
              <button onClick={() => { setEditing(true); setError("") }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Upraviť</button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Registratúrny plán</label>
                <select name="planId" defaultValue={zaznam.plan.id} required
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {plans.map(p => <option key={p.id} value={p.id}>{p.znacka} – {p.nazov}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Typ záznamu</label>
                <select name="typZaznamu" defaultValue={zaznam.typZaznamu}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="ELEKTRONICKY">Elektronický</option>
                  <option value="NEELEKTRONICKY">Neelektronický</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Umiestnenie originálu</label>
                <input type="text" name="umiestnenie" defaultValue={zaznam.umiestnenieFyzicke ?? ""}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="napr. Šanón 2026/A, Regál 3" />
              </div>
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Ukladám…" : "Uložiť"}
                </button>
                <button type="button" onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  Zrušiť
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Registratúrna značka</dt><dd className="font-medium text-gray-900 dark:text-white">{zaznam.plan.znacka}</dd></div>
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Plán – názov</dt><dd className="text-gray-700 dark:text-gray-300">{zaznam.plan.nazov}</dd></div>
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Lehota uloženia</dt><dd className="text-gray-700 dark:text-gray-300">{zaznam.plan.lehota} rokov {zaznam.plan.maArchivnu ? "· Archívna hodnota (A)" : ""}</dd></div>
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Spracovateľ</dt><dd className="text-gray-700 dark:text-gray-300">{zaznam.spracovatel}</dd></div>
              {zaznam.umiestnenieFyzicke && (
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">Umiestnenie originálu</dt><dd className="text-gray-700 dark:text-gray-300">{zaznam.umiestnenieFyzicke}</dd></div>
              )}
              {zaznam.posta && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Pošta</dt>
                  <dd>
                    <Link href={`/dashboard/registratura/podatelna`} className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs">
                      {zaznam.posta.poradoveCislo}
                    </Link>
                    <span className="text-gray-500 dark:text-gray-400 text-xs"> – {zaznam.posta.vec}</span>
                  </dd>
                </div>
              )}
              <div><dt className="text-xs text-gray-500 dark:text-gray-400">Vytvorený</dt><dd className="text-gray-700 dark:text-gray-300">{zaznam.createdAt}</dd></div>
            </dl>
          )}
        </div>

        {/* File card */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-900 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Elektronický dokument</h2>
          {zaznam.typZaznamu === "NEELEKTRONICKY" ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Záznam je neelektronický – fyzický originál.</p>
          ) : zaznam.originalName ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <FileText size={20} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{zaznam.originalName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{zaznam.fileSize ? fmtSize(zaznam.fileSize) : ""}</p>
                  {zaznam.fileHash && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5 truncate" title={zaznam.fileHash}>
                      SHA-256: {zaznam.fileHash.slice(0, 16)}…
                    </p>
                  )}
                </div>
              </div>

              {integrityOk === true && (
                <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                  <ShieldCheck size={14} /> Integrita overená – súbor je neporušený
                </div>
              )}
              {integrityOk === false && (
                <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 font-semibold">
                  <ShieldAlert size={14} /> VAROVANIE: integrita súboru je narušená!
                </div>
              )}

              <button onClick={handleDownload}
                className="flex items-center gap-2 w-full justify-center px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
                <Download size={14} /> Stiahnuť a overiť integritu
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Žiadny súbor nie je nahratý.</p>
              {canManage && isEditable && (
                <>
                  <label className="flex items-center gap-2 w-full justify-center px-3 py-2 text-sm border border-dashed border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-blue-600 dark:text-blue-400 transition-colors">
                    <Upload size={14} />
                    {uploading ? "Nahrávam…" : "Nahrať súbor (read-only po uložení)"}
                    <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                  {uploadError && <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Spisy */}
      {zaznam.spisy.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-900 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen size={16} className="text-gray-400" /> Zaradený v spisoch
          </h2>
          <div className="space-y-2">
            {zaznam.spisy.map(s => (
              <Link key={s.id} href={`/dashboard/registratura/spisy/${s.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div>
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{s.cisloSpisu}</span>
                  <span className="text-sm text-gray-900 dark:text-white ml-2">{s.nazov}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${spisStatusColors[s.status]}`}>
                  {spisStatusLabels[s.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
