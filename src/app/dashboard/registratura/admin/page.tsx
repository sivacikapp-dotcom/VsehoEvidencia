import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import AdminClient from "./AdminClient"

export default async function RegAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const roles = session.user.roles as string[]

  const isAdmin = roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("SPRAVCA_APLIKACIE")
  if (!isAdmin) redirect("/dashboard")

  const users = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      roles: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const REG_ROLES = ["SPRAVCA_REGISTRATURY", "PRACOVNIK_PODATELNE", "SPRACOVATEL_REGISTRATURY"]

  return (
    <div className="flex-1 overflow-auto">
      <AdminClient
        users={users.map(u => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          regRoles: (u.roles as string[]).filter(r => REG_ROLES.includes(r)),
        }))}
      />
    </div>
  )
}
