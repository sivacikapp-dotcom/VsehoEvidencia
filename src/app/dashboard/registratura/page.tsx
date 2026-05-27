import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function RegistraturaPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const roles = session.user.roles as string[]
  if (roles.includes("PRACOVNIK_PODATELNE")) redirect("/dashboard/registratura/podatelna")
  if (roles.includes("SPRACOVATEL_REGISTRATURY")) redirect("/dashboard/registratura/zaznamy")
  if (roles.includes("SPRAVCA_REGISTRATURY")) redirect("/dashboard/registratura/admin")
  redirect("/dashboard")
}
