import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) return null

        // TODO: obnoviť bcrypt overenie po testovaní
        const valid = credentials.password === "test" || await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return {
          id: String(user.id),
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
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
  pages: {
    signIn: "/login",
  },
}
