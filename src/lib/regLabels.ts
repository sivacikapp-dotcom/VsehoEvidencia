import type { PostaDirection, PostaSpusob, PostaStatus, RegZaznamType, RegZaznamStatus, SpisStatus } from "@/generated/prisma/enums"

export const postaDirectionLabels: Record<PostaDirection, string> = {
  DOSLA: "Došlá",
  ODOSLANA: "Odoslaná",
}

export const postaDirectionColors: Record<PostaDirection, string> = {
  DOSLA: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ODOSLANA: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
}

export const postaSpusobLabels: Record<PostaSpusob, string> = {
  EMAIL: "E-mail",
  POSTA: "Pošta",
  UPVS: "ÚPVS",
  OSOBNE: "Osobne",
}

export const postaStatusLabels: Record<PostaStatus, string> = {
  ZAREGISTROVANA: "Zaregistrovaná",
  PREKLASIFIKOVANA: "Preklopená",
}

export const postaStatusColors: Record<PostaStatus, string> = {
  ZAREGISTROVANA: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  PREKLASIFIKOVANA: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
}

export const regZaznamTypeLabels: Record<RegZaznamType, string> = {
  ELEKTRONICKY: "Elektronický",
  NEELEKTRONICKY: "Neelektronický",
}

export const regZaznamStatusLabels: Record<RegZaznamStatus, string> = {
  ROZPRACOVANY: "Rozpracovaný",
  REGISTROVANY: "Registrovaný",
  UZAVRETY: "Uzavretý",
  VYRADENY: "Vyradený",
}

export const regZaznamStatusColors: Record<RegZaznamStatus, string> = {
  ROZPRACOVANY: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  REGISTROVANY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  UZAVRETY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  VYRADENY: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

export const spisStatusLabels: Record<SpisStatus, string> = {
  OTVORENY: "Otvorený",
  UZATVORENY: "Uzatvorený",
}

export const spisStatusColors: Record<SpisStatus, string> = {
  OTVORENY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  UZATVORENY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
}

export const regRoleLabels: Record<string, string> = {
  SPRAVCA_REGISTRATURY: "Správca registratúry",
  PRACOVNIK_PODATELNE: "Pracovník podateľne",
  SPRACOVATEL_REGISTRATURY: "Spracovateľ",
}
