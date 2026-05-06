"use server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

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
  const user = session.user as { id: string; roles: string[] }
  if (!user.roles.includes("SPRAVCA_PC")) throw new Error("Nemáte oprávnenie.")

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

  await prisma.travelRateConfig.create({
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
      createdById: parseInt(user.id),
    },
  })
  revalidatePath("/dashboard/nastavenia/sadzby")
}

export async function deleteRateConfig(id: number) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Nie ste prihlásený.")
  const user = session.user as { id: string; roles: string[] }
  if (!user.roles.includes("SPRAVCA_PC")) throw new Error("Nemáte oprávnenie.")
  await prisma.travelRateConfig.delete({ where: { id } })
  revalidatePath("/dashboard/nastavenia/sadzby")
}
