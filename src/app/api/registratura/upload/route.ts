import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { addZaznamPriloha } from "@/app/dashboard/registratura/zaznamy/actions"

function canUpload(roles: string[]) {
  return roles.includes("SPRACOVATEL_REGISTRATURY") || roles.includes("SPRAVCA_REGISTRATURY") || roles.includes("PRACOVNIK_PODATELNE")
}

// This route is a thin wrapper around the addZaznamPriloha server action.
// Accepts: zaznamId, nazov, forma, file
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Neautorizovaný." }, { status: 401 })
  if (!canUpload(session.user.roles as string[])) {
    return NextResponse.json({ error: "Nemáte oprávnenie nahrávať súbory." }, { status: 403 })
  }

  let formData: FormData
  try { formData = await request.formData() } catch {
    return NextResponse.json({ error: "Neplatný formát požiadavky." }, { status: 400 })
  }

  const zaznamIdRaw = formData.get("zaznamId") as string | null
  if (!zaznamIdRaw) return NextResponse.json({ error: "Chýba zaznamId." }, { status: 400 })
  const zaznamId = parseInt(zaznamIdRaw)
  if (isNaN(zaznamId)) return NextResponse.json({ error: "Neplatné ID záznamu." }, { status: 400 })

  const result = await addZaznamPriloha(zaznamId, formData)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
