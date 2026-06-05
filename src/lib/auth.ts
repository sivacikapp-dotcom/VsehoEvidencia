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

async function checkAndNotifySuspiciousLogin(username: string) {
  const since = new Date(Date.now() - SUSPICIOUS_WINDOW_MS)
  const count = await prisma.auditLog.count({
    where: {
      action: "LOGIN_FAILURE",
      entityType: "AUTH_SUSPICIOUS",
      entityLabel: username,
      createdAt: { gte: since },
    },
  })
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
        message: `Zaznamenalo sa ${count} neúspešných pokusov o prihlásenie s používateľským menom „${username}" (neexistujúci alebo zablokovaný účet) za posledných 24 hodín.`,
        mustAcknowledge: false,
      })),
    })
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 2 * 60 * 60,   // 2 hodiny
    updateAge: 5 * 60,      // obnoviť token pri aktivite (každých 5 min)
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        // Pole sa volá "email" kvôli kompatibilite s next-auth formulárom,
        // ale hodnota obsahuje username (nie e-mail)
        email: { label: "Používateľské meno", type: "text" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const username = credentials.email.trim().toLowerCase()
        const user = await prisma.user.findUnique({
          where: { username },
          select: {
            id: true, username: true, email: true,
            firstName: true, lastName: true,
            password: true, roles: true, supervisorId: true,
            loginAttempts: true, lockedUntil: true,
            isAdminAccount: true,
          },
        })

        // ── Neznáme username ───────────────────────────────────────────────
        if (!user) {
          await createAuditLog({
            action: "LOGIN_FAILURE",
            entityType: "AUTH_SUSPICIOUS",
            entityId: username,
            entityLabel: username,
            actorUsername: username,
            newData: { reason: "Používateľ neexistuje" },
          })
          await checkAndNotifySuspiciousLogin(username)
          return null
        }

        const fullName = `${user.firstName} ${user.lastName}`

        // ── Zablokovaný účet ──────────────────────────────────────────────
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await createAuditLog({
            userId: user.id,
            userEmail: user.email,
            userName: fullName,
            actorUsername: user.username ?? username,
            action: "LOGIN_FAILURE",
            entityType: "AUTH_SUSPICIOUS",
            entityId: user.id,
            entityLabel: user.username ?? user.email,
            newData: { reason: "Účet je zablokovaný" },
          })
          await checkAndNotifySuspiciousLogin(username)
          throw new Error("AccountLocked")
        }

        // ── Nesprávne heslo ───────────────────────────────────────────────
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
              actorUsername: user.username ?? username,
              action: "LOGIN_FAILURE",
              entityType: "AUTH",
              entityId: user.id,
              entityLabel: user.username ?? user.email,
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
              actorUsername: user.username ?? username,
              action: "LOGIN_FAILURE",
              entityType: "AUTH",
              entityId: user.id,
              entityLabel: user.username ?? user.email,
              newData: { reason: "Nesprávne heslo", attempt: newAttempts },
            })
            return null
          }
        }

        // ── Úspešné prihlásenie — reset počítadla ─────────────────────────
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
          username: user.username,
          isAdminAccount: user.isAdminAccount,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.username = (user as any).username
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.isAdminAccount = (user as any).isAdminAccount
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).id = token.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).roles = token.roles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).username = token.username
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).isAdminAccount = token.isAdminAccount
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actorUsername: (user as any).username ?? null,
        action: "LOGIN_SUCCESS",
        entityType: "AUTH",
        entityId: user.id ?? user.email ?? "?",
        entityLabel: user.email ?? null,
      })
    },
    async signOut({ token }) {
      const t = token as { id?: string; email?: string; name?: string; username?: string } | null
      await createAuditLog({
        userId: t?.id ? parseInt(t.id) : null,
        userEmail: t?.email ?? null,
        userName: t?.name ?? null,
        actorUsername: t?.username ?? null,
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
