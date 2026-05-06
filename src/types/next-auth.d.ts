import type { Role } from "@/generated/prisma/enums"
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      roles: Role[]
    }
  }
  interface User {
    id: string
    roles: Role[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    roles: Role[]
  }
}
