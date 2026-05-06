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
