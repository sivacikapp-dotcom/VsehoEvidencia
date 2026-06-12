/**
 * AES-256-GCM field-level encryption for sensitive DB columns (e.g. mfaSecret).
 *
 * Wire format stored in the database (base64-encoded):
 *   [ IV (12 B) | Auth Tag (16 B) | Ciphertext (variable) ]
 *
 * Each call to encryptField() generates a fresh random IV, so identical
 * plaintexts produce different ciphertexts — no deterministic leakage.
 *
 * Key source: APP_ENCRYPTION_KEY env variable (32 raw bytes, base64-encoded).
 * Generate: openssl rand -base64 32
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_BYTES   = 12   // 96-bit IV — GCM recommended size
const TAG_BYTES  = 16   // 128-bit authentication tag

/** Reads and validates the encryption key from the environment. */
function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. " +
      "Generate one with: openssl rand -base64 32"
    )
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
      "Regenerate with: openssl rand -base64 32"
    )
  }
  return key
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a base64 string safe to store in a TEXT/VARCHAR DB column.
 */
export function encryptField(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(IV_BYTES)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ct     = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag    = cipher.getAuthTag()

  // Layout: IV | Tag | Ciphertext — all concatenated, then base64
  return Buffer.concat([iv, tag, ct]).toString("base64")
}

/**
 * Decrypts a value previously produced by encryptField().
 * Throws if the auth tag is invalid (data tampered or wrong key).
 */
export function decryptField(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, "base64")

  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error("Invalid encrypted value: payload too short.")
  }

  const iv  = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ct  = buf.subarray(IV_BYTES + TAG_BYTES)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(ct).toString("utf8") + decipher.final("utf8")
}

/**
 * Returns true when the value looks like a raw (unencrypted) TOTP secret.
 * TOTP secrets are typically base32 strings (A-Z2-7); our encrypted values
 * contain "+", "/" and "=" from base64. Use this during a migration to detect
 * rows that were stored before encryption was enabled.
 */
export function isEncrypted(value: string): boolean {
  // Heuristic: our wire format always starts with 12 bytes of IV encoded in
  // base64 (16 chars), and the total length is always > 40 chars.
  return value.length > 40 && /[+/]/.test(value.slice(0, 16))
}
