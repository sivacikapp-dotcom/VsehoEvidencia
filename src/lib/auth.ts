import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { createAuditLog } from "./auditLog"

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 2 * 60 * 60 * 1000 // 2 hodiny
const SUSPICIOUS_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hodín

async function notifyAccountLocked(userId: number, email: string, fullName: string, supervisorId: number | null) {
  const appAdmins = await prisma.user.findMany({
    where: { roles: { has: "SPRAVCA_APLIKACIE" } },
    select: { id: true },
  })
  const recipientIds = new Set(appAdmins.map((u) => u.id))
  if (supervisorId) recipientIds.add(supervisorId)
  if (recipientIds.size === 0) return

  await prisma.notification.createMany({
    data: [...recipientIds].map((uid) => ({
      userId: uid,
      type: "ACCOUNT_LOCKED" as const,
      title: "Účet zablokovaný",
      message: `Účet používateľa ${fullName} (${email}) bol zablokovaný na 2 hodiny po ${MAX_ATTEMPTS} neúspešných pokusoch o prihlásenie.`,
      mustAcknowledge: false,
    })),
  })
}

async function checkAndNotifySuspiciousLogin(email: string) {
  const since = new Date(Date.now() - SUSPICIOUS_WINDOW_MS)
  const count = await prisma.auditLog.count({
    where: {
      action: "LOGIN_FAILURE",
      entityType: "AUTH_SUSPICIOUS",
      entityLabel: email,
      createdAt: { gte: since },
    },
  })
  // Notify at every multiple of MAX_ATTEMPTS to catch persistent attacks
  if (count > 0 && count % MAX_ATTEMPTS === 0) {
    const appAdmins = await prisma.user.findMany({
      where: { roles: { has: "SPRAVCA_APLIKACIE" } },
      select: { id: true },
    })
    if (appAdmins.length === 0) return

    await prisma.notification.createMany({
      data: appAdmins.map((u) => ({
        userId: u.id,
        type: "SUSPICIOUS_LOGIN" as const,
        title: "Podozrivé pokusy o prihlásenie",
        message: `Zaznamenalo sa ${count} neúspešných pokusov o prihlásenie s emailom „${email}" (neexistujúci alebo zablokovaný účet) za posledných 24 hodín.`,
        mustAcknowledge: false,
      })),
    })
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 2 * 60 * 60,  // 2 hodiny
    updateAge: 5 * 60,    // obnoviť token pri aktivite (každých 5 min)
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.trim().toLowerCase()
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true, email: true, firstName: true, lastName: true,
            password: true, roles: true, supervisorId: true,
            loginAttempts: true, lockedUntil: true,
          },
        })

        // ── Unknown email ──────────────────────────────────────────────────
        if (!user) {
          await createAuditLog({
            action: "LOGIN_FAILURE",
            entityType: "AUTH_SUSPICIOUS",
            entityId: email,
            entityLabel: email,
            newData: { reason: "Používateľ neexistuje" },
          })
          await checkAndNotifySuspiciousLogin(email)
          return null
        }

        const fullName = `${user.firstName} ${user.lastName}`

        // ── Locked account ─────────────────────────────────────────────────
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await createAuditLog({
            userId: user.id,
            userEmail: user.email,
            userName: fullName,
            action: "LOGIN_FAILURE",
            entityType: "AUTH_SUSPICIOUS",
            entityId: user.id,
            entityLabel: user.email,
            newData: { reason: "Účet je zablokovaný" },
          })
          await checkAndNotifySuspiciousLogin(email)
          throw new Error("AccountLocked")
        }

        // ── Wrong password ─────────────────────────────────────────────────
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) {
          const newAttempts = user.loginAttempts + 1

          if (newAttempts >= MAX_ATTEMPTS) {
            const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS)
            await prisma.user.update({
              where: { id: user.id },
              data: { loginAttempts: 0, lockedUntil },
            })
            await createAuditLog({
              userId: user.id,
              userEmail: user.email,
              userName: fullName,
              action: "LOGIN_FAILURE",
              entityType: "AUTH",
              entityId: user.id,
              entityLabel: user.email,
              newData: { reason: "Nesprávne heslo — účet zablokovaný", lockedUntil: lockedUntil.toISOString() },
            })
            await notifyAccountLocked(user.id, user.email, fullName, user.supervisorId)
            throw new Error("AccountLocked")
          } else {
            await prisma.user.update({
              where: { id: user.id },
              data: { loginAttempts: newAttempts },
            })
            await createAuditLog({
              userId: user.id,
              userEmail: user.email,
              userName: fullName,
              action: "LOGIN_FAILURE",
              entityType: "AUTH",
              entityId: user.id,
              entityLabel: user.email,
              newData: { reason: "Nesprávne heslo", attempt: newAttempts },
            })
            return null
          }
        }

        // ── Successful login — reset counter ───────────────────────────────
        if (user.loginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { loginAttempts: 0, lockedUntil: null },
          })
        }

        return {
          id: String(user.id),
          email: user.email,
          name: fullName,
          roles: user.roles,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.roles = (user as any).roles
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).id = token.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).roles = token.roles
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      await createAuditLog({
        userId: user.id ? parseInt(user.id) : null,
        userEmail: user.email ?? null,
        userName: user.name ?? null,
        action: "LOGIN_SUCCESS",
        entityType: "AUTH",
        entityId: user.id ?? user.email ?? "?",
        entityLabel: user.email ?? null,
      })
    },
    async signOut({ token }) {
      const t = token as { id?: string; email?: string; name?: string } | null
      await createAuditLog({
        userId: t?.id ? parseInt(t.id) : null,
        userEmail: t?.email ?? null,
        userName: t?.name ?? null,
        action: "LOGOUT",
        entityType: "AUTH",
        entityId: t?.id ?? t?.email ?? "?",
        entityLabel: t?.email ?? null,
      })
    },
  },
  pages: {
    signIn: "/login",
  },
}
