import type {
  PostaDirection, PostaStatus, RegZaznamType,
  ZaznamKategoria, ZaznamDovernost,
} from "@/generated/prisma/enums"

export const postaDirectionLabels: Record<PostaDirection, string> = {
  DOSLA: "Došlá",
  ODOSLANA: "Odoslaná",
}

export const postaDirectionColors: Record<PostaDirection, string> = {
  DOSLA: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ODOSLANA: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
}

// Spôsob doručenia — dynamic via cislonik (SpDor1..N)
export const postaSpusobLabels: Record<string, string> = {
  SpDor1: "E-mail",
  SpDor2: "Poštou",
  SpDor3: "ÚPVS",
  SpDor4: "Osobne",
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

// Stav záznamu — dynamic via cislonik (StZaz1..N)
export const zaznamStavLabels: Record<string, string> = {
  StZaz1: "Pridelený",
  StZaz2: "Vytvorený",
  StZaz3: "V spise",
  StZaz4: "Vybavený",
}

export const zaznamStavColors: Record<string, string> = {
  StZaz1: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  StZaz2: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  StZaz3: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  StZaz4: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
}

// Spôsob vybavenia záznamu — dynamic via cislonik (StVyZa1..N)
export const sposobVybaveniаLabels: Record<string, string> = {
  StVyZa1: "Vzal na vedomie",
  StVyZa2: "Odpoveďou",
  StVyZa3: "Založený",
  StVyZa4: "Odoslaný",
}

// Backward compat aliases (unused but exported to avoid import errors)
export const sposobVybaveniaPrijatyLabels = sposobVybaveniаLabels
export const sposobVybaveniаVytvorenyLabels = sposobVybaveniаLabels

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

// Stav spisu — dynamic via cislonik (StSpis1..N)
export const spisStatusLabels: Record<string, string> = {
  StSpis1: "Otvorený",
  StSpis2: "Odložený",
  StSpis3: "Vybavený",
  UZATVORENY: "Vybavený", // backward compat
}

export const spisStatusColors: Record<string, string> = {
  StSpis1: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  StSpis2: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  StSpis3: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  UZATVORENY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
}

export const regRoleLabels: Record<string, string> = {
  SPRAVCA_REGISTRATURY: "Správca registratúry",
  PRACOVNIK_PODATELNE: "Pracovník podateľne",
  SPRACOVATEL_REGISTRATURY: "Spracovateľ",
}
