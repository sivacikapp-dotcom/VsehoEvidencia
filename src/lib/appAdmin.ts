export const HIDDEN = "••••••"

/** Replace a string value with the hidden sentinel when masking is active. */
export function maskStr(value: string | null | undefined, mask: boolean): string {
  if (!mask) return value ?? "—"
  return HIDDEN
}

/** Return null for numbers/booleans when masking, so UI shows the hidden sentinel. */
export function maskNum(value: number | null | undefined, mask: boolean): number | null {
  if (!mask) return value ?? null
  return null
}

export function maskBool(value: boolean | null | undefined, mask: boolean): boolean | null {
  if (!mask) return value ?? null
  return null
}
