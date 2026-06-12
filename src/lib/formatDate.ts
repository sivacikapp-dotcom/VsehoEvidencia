/**
 * Formats a Date object or ISO string to Slovak locale "DD.MM.YYYY".
 * Returns "—" for null/undefined/invalid values.
 */
export function fmtDate(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  const d = typeof value === "string" ? new Date(value) : value
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/**
 * Formats a Date object or ISO string to Slovak locale "DD.MM.YYYY HH:MM".
 * Returns "—" for null/undefined/invalid values.
 */
export function fmtDateTime(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  const d = typeof value === "string" ? new Date(value) : value
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Converts a Date object or ISO string to "YYYY-MM-DD" for use as
 * the value/defaultValue of <input type="date">.
 * Returns "" for null/undefined/invalid values.
 */
export function toDateInput(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  const d = typeof value === "string" ? new Date(value) : value
  if (isNaN(d.getTime())) return ""
  return d.toISOString().split("T")[0]
}

/**
 * Converts a Date object or ISO string to "YYYY-MM-DDTHH:mm" in LOCAL time
 * for use as the value of <input type="datetime-local">.
 * Using .slice(0,16) on an ISO string gives UTC time which differs from
 * the user's local time — this function returns the correct local representation.
 * Returns "" for null/undefined/invalid values.
 */
export function toDatetimeLocalInput(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  const d = typeof value === "string" ? new Date(value) : value
  if (isNaN(d.getTime())) return ""
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
