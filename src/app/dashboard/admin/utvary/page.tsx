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

  const utvary = await prisma.utvar.findMany({
    orderBy: { nazov: "asc" },
    include: { _count: { select: { users: true } } },
  })

  return (
    <div className="flex-1 overflow-auto">
      <UtvaryAdminClient
        utvary={utvary.map(u => ({
          id: u.id,
          nazov: u.nazov,
          pocetPouzivatelov: u._count.users,
        }))}
      />
    </div>
  )
}
