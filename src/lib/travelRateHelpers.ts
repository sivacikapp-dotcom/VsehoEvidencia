import { prisma } from "@/lib/prisma"
import { DEFAULT_TRAVEL_RATES, type TravelRates } from "./travelUtils"

// Returns the most recently published rate config, or built-in defaults when none exists.
export async function getCurrentTravelRates(): Promise<TravelRates> {
  const config = await prisma.travelRateConfig.findFirst({
    where: { validFrom: { lte: new Date() } },
    orderBy: { validFrom: "desc" },
  })
  if (!config) return DEFAULT_TRAVEL_RATES
  return {
    diet5to12: Number(config.diet5to12),
    diet12to18: Number(config.diet12to18),
    dietOver18: Number(config.dietOver18),
    breakfastPct: Number(config.breakfastPct),
    lunchPct: Number(config.lunchPct),
    dinnerPct: Number(config.dinnerPct),
    kmJednostopove: Number(config.kmJednostopove),
    kmOsobneDoLimit: Number(config.kmOsobneDoLimit),
    kmOsobneNadLimit: Number(config.kmOsobneNadLimit),
    kmEngineLimit: config.kmEngineLimit,
  }
}
