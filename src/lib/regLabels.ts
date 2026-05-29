import type {
  PostaDirection, PostaSpusob, PostaStatus, RegZaznamType, SpisStatus,
  ZaznamKategoria, ZaznamStav, SposobVybavenia, ZaznamDovernost,
} from "@/generated/prisma/enums"

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

export const zaznamKategoriaLabels: Record<ZaznamKategoria, string> = {
  PRIJATY: "Prijatý",
  VYTVORENY: "Vytvorený",
}

export const zaznamKategoriaColors: Record<ZaznamKategoria, string> = {
  PRIJATY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  VYTVORENY: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
}

export const zaznamStavLabels: Record<ZaznamStav, string> = {
  PRIDELENY: "Pridelený",
  NOVY: "Vytvorený",
  V_SPISE: "V spise",
  VYBAVENY: "Vybavený",
}

export const zaznamStavColors: Record<ZaznamStav, string> = {
  PRIDELENY: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  NOVY: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  V_SPISE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  VYBAVENY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
}

export const sposobVybaveniaPrijatyLabels: Record<Extract<SposobVybavenia, "VZAL_NA_VEDOMIE" | "ODPOVEDU">, string> = {
  VZAL_NA_VEDOMIE: "Vzal na vedomie",
  ODPOVEDU: "Odpoveďou",
}

export const sposobVybaveniаVytvorenyLabels: Record<Extract<SposobVybavenia, "ZALOZENY" | "ODOSLANY">, string> = {
  ZALOZENY: "Založený",
  ODOSLANY: "Odoslaný",
}

export const sposobVybaveniаLabels: Record<SposobVybavenia, string> = {
  VZAL_NA_VEDOMIE: "Vzal na vedomie",
  ODPOVEDU: "Odpoveďou",
  ZALOZENY: "Založený",
  ODOSLANY: "Odoslaný",
}

export const zaznamDovernostLabels: Record<ZaznamDovernost, string> = {
  VEREJNE: "Verejné",
  INTERNE: "Interné",
  DOVERNE: "Dôverné",
}

export const zaznamDovernostColors: Record<ZaznamDovernost, string> = {
  VEREJNE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  INTERNE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DOVERNE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
