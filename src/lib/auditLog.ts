/**
 * Centralized audit-log writer.
 * All mutations in the app call createAuditLog() so that every data change
 * is recorded with who made it, what changed, and when.
 * For UPDATE actions the function automatically diffs old vs. new data and
 * stores only the changed fields, keeping log entries concise.
 */
import { prisma } from "./prisma"

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "PASSWORD_CHANGE"
  | "ROLE_CHANGE"

interface AuditLogParams {
  userId?: number | null
  userEmail?: string | null
  userName?: string | null
  actorUsername?: string | null
  ipAddress?: string | null
  action: AuditAction
  entityType: string
  entityId: string | number
  entityLabel?: string | null
  oldData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    let oldData = params.oldData ?? null
    let newData = params.newData ?? null

    // For UPDATE logs: keep only the fields that actually changed.
    if (params.action === "UPDATE" && params.oldData && params.newData) {
      const diffOld: Record<string, unknown> = {}
      const diffNew: Record<string, unknown> = {}
      const allKeys = new Set([...Object.keys(params.oldData), ...Object.keys(params.newData)])
      for (const key of allKeys) {
        const oldVal = params.oldData[key]
        const newVal = params.newData[key]
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          diffOld[key] = oldVal
          diffNew[key] = newVal
        }
      }
      oldData = Object.keys(diffOld).length > 0 ? diffOld : null
      newData = Object.keys(diffNew).length > 0 ? diffNew : null
    }

    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        userEmail: params.userEmail ?? null,
        userName: params.userName ?? null,
        actorUsername: params.actorUsername ?? null,
        ipAddress: params.ipAddress ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: String(params.entityId),
        entityLabel: params.entityLabel ?? null,
        oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : undefined,
        newData: newData ? JSON.parse(JSON.stringify(newData)) : undefined,
      },
    })
  } catch (e) {
    console.error("[AuditLog] Failed to write:", e)
  }
}
