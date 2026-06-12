/**
 * Centralized password hashing/verification.
 *
 * Algorithm: Argon2id — memory-hard, GPU-resistant.
 * Parameters follow OWASP 2024 recommendations:
 *   m = 64 MiB, t = 3 iterations, p = 4 lanes.
 *
 * Lazy migration: existing bcrypt-12 hashes (prefix "$2") are verified with
 * bcryptjs and silently upgraded to argon2id on the next successful login.
 * No forced password reset is required.
 */
import argon2 from "@node-rs/argon2"
import bcrypt from "bcryptjs"

const ARGON2_OPTIONS: Parameters<typeof argon2.hash>[1] = {
  algorithm: 2,        // 2 = Argon2id
  memoryCost: 65536,   // 64 MiB
  timeCost: 3,
  parallelism: 4,
}

/** Hash a plaintext password with Argon2id. */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS)
}

/**
 * Verify a password against a stored hash.
 * Transparently handles both argon2id and legacy bcrypt hashes.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith("$2")) {
    // Legacy bcrypt hash — still valid, will be upgraded on next login
    return bcrypt.compare(plain, hash)
  }
  return argon2.verify(hash, plain)
}

/** Returns true when a stored hash is a legacy bcrypt hash that should be upgraded. */
export function needsRehash(hash: string): boolean {
  return hash.startsWith("$2")
}
