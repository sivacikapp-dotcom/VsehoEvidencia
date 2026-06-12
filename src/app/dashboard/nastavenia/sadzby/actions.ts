"use server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { createAuditLog } from "@/lib/auditLog"

export type CreateRateConfigInput = {
  validFrom: string  // "YYYY-MM-DD"
  diet5to12: number
  diet12to18: number
  dietOver18: number
  breakfastPct: number
  lunchPct: number
  dinnerPct: number
  kmJednostopove: number
  kmOsobneDoLimit: number
  kmOsobneNadLimit: number
  kmEngineLimit: number
}

export async function createRateConfig(data: CreateRateConfigInput) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Nie ste prihlásený.")
  if (!session.user.roles.includes("SPRAVCA_PRACOVNYCH_CIEST")) throw new Error("Nemáte oprávnenie.")

  if (!data.validFrom) throw new Error("Dátum platnosti je povinný.")
  if (new Date(data.validFrom) > new Date()) throw new Error("Dátum platnosti nesmie byť v budúcnosti.")
  if (data.diet5to12 <= 0 || data.diet12to18 <= 0 || data.dietOver18 <= 0)
    throw new Error("Sadzby diét musia byť kladné čísla.")
  if (data.diet5to12 >= data.diet12to18 || data.diet12to18 >= data.dietOver18)
    throw new Error("Sadzby diét musia byť vzostupné: 5–12 h < 12–18 h < nad 18 h.")
  const mealPctSum = data.breakfastPct + data.lunchPct + data.dinnerPct
  if (mealPctSum > 100)
    throw new Error(`Súčet percent za jedlá (${mealPctSum} %) nesmie presiahnuť 100 %.`)
  if (data.kmJednostopove <= 0 || data.kmOsobneDoLimit <= 0 || data.kmOsobneNadLimit <= 0)
    throw new Error("Kilometrové sadzby musia byť kladné čísla.")

  const userId = parseInt(session.user.id)
  const created = await prisma.travelRateConfig.create({
    data: {
      validFrom: new Date(data.validFrom),
      diet5to12: data.diet5to12,
      diet12to18: data.diet12to18,
      dietOver18: data.dietOver18,
      breakfastPct: data.breakfastPct,
      lunchPct: data.lunchPct,
      dinnerPct: data.dinnerPct,
      kmJednostopove: data.kmJednostopove,
      kmOsobneDoLimit: data.kmOsobneDoLimit,
      kmOsobneNadLimit: data.kmOsobneNadLimit,
      kmEngineLimit: data.kmEngineLimit,
      createdById: userId,
    },
  })
  await createAuditLog({
    userId, userEmail: null, userName: session.user.name,
    action: "CREATE", entityType: "RATE_CONFIG", entityId: created.id,
    entityLabel: data.validFrom,
    newData: { validFrom: data.validFrom, diet5to12: data.diet5to12, diet12to18: data.diet12to18, dietOver18: data.dietOver18 },
  })
  revalidatePath("/dashboard/nastavenia/sadzby")
}

export async function deleteRateConfig(id: number) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Nie ste prihlásený.")
  if (!session.user.roles.includes("SPRAVCA_PRACOVNYCH_CIEST")) throw new Error("Nemáte oprávnenie.")
  const userId = parseInt(session.user.id)
  const config = await prisma.travelRateConfig.findUnique({ where: { id }, select: { validFrom: true } })
  await prisma.travelRateConfig.delete({ where: { id } })
  await createAuditLog({
    userId, userEmail: null, userName: session.user.name,
    action: "DELETE", entityType: "RATE_CONFIG", entityId: id,
    entityLabel: config?.validFrom?.toISOString().split("T")[0] ?? null,
    oldData: config ? { validFrom: config.validFrom } : null,
  })
  revalidatePath("/dashboard/nastavenia/sadzby")
}
