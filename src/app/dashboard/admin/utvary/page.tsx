import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import UtvaryAdminClient from "./UtvaryAdminClient"

export default async function UtvaryAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  const callerRoles = (session.user as { roles?: string[] })?.roles ?? []
  if (!callerRoles.includes("SPRAVCA_APLIKACIE")) redirect("/dashboard")

  const [utvaryRaw, allUsers] = await Promise.all([
    prisma.utvar.findMany({
      orderBy: { nazov: "asc" },
      include: {
        vedouci: { select: { id: true, firstName: true, lastName: true } },
        users: {
          select: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { isAdminAccount: false },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ])

  const utvary = utvaryRaw.map(u => ({
    ...u,
    users: u.users
      .map(uu => uu.user)
      .sort((a, b) => a.lastName.localeCompare(b.lastName, "sk")),
  }))

  return (
    <div className="flex-1 overflow-auto">
      <UtvaryAdminClient utvary={utvary} allUsers={allUsers} />
    </div>
  )
}
