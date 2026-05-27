import type {
  AssetType,
  Brand,
  UsagePlace,
  AllocationStatus,
  FunctionStatus,
  AssetKind,
  TravelOrderType,
  TravelOrderStatus,
  TransportMeans,
} from "@/generated/prisma/enums"

export const assetTypeLabels: Record<AssetType, string> = {
  Kluc: "Kľúč",
  Cip: "Čip",
  Notebook: "Notebook",
  MobilnyTelefon: "Mobilný telefón",
  Monitor: "Monitor",
  Klavesnica: "Klávesnica",
  Mys: "Myš",
  DokovaciaStanica: "Dokovacia stanica",
  Peciatka: "Pečiatka",
  Sluchadla: "Slúchadlá",
  SIMKarta: "SIM karta",
  NapajaciAdapter: "Napájací adaptér",
  Stolicka: "Stolička",
  Stol: "Stôl",
  Skartovacka: "Skartovačka",
  Reproduktor: "Reproduktor",
  USBKluc: "USB kľúč",
  Projektor: "Projektor",
  Platno: "Plátno",
  Tlaciaren: "Tlačiareň",
  TaskaNaNotebook: "Taška na notebook",
  ExternyDisk: "Externý disk",
  PevnaLinka: "Pevná linka",
  Server: "Server",
  Kvetinac: "Kvetináč",
  SmetnyKos: "Smetný kôš",
  Router: "Router",
  CistickaVzduchu: "Čistička vzduchu",
  Kreslo: "Kreslo",
  Gauc: "Gauč",
  Ine: "Iné",
}

export const brandLabels: Record<Brand, string> = {
  Apple: "Apple",
  Lenovo: "Lenovo",
  HP: "HP",
  Dell: "Dell",
  Samsung: "Samsung",
  Asus: "Asus",
  Sony: "Sony",
  Neurcena: "Neurčená",
}

export const usagePlaceLabels: Record<UsagePlace, string> = {
  Office: "Kancelária",
  HomeOffice: "Home office",
  Prenosny: "Prenosný",
  Nezadane: "Neurčené",
}

export const allocationStatusLabels: Record<AllocationStatus, string> = {
  Neprideleny_Volny: "Voľný",
  Neprideleny_BCM: "BCM",
  Prideleny_Recipient: "Príjemca",
  Prideleny_Room: "Miestnosť",
  V_procese: "V procese",
  Vyradeny: "Vyradený",
}

export const allocationStatusColors: Record<AllocationStatus, string> = {
  Neprideleny_Volny: "bg-gray-100 text-gray-600",
  Neprideleny_BCM: "bg-yellow-100 text-yellow-700",
  Prideleny_Recipient: "bg-blue-100 text-blue-700",
  Prideleny_Room: "bg-purple-100 text-purple-700",
  V_procese: "bg-amber-100 text-amber-700",
  Vyradeny: "bg-red-100 text-red-600",
}

export const functionStatusLabels: Record<FunctionStatus, string> = {
  Funkcny: "Funkčný",
  Pokazeny_Poskodeny: "Pokazený",
  NaLikvidaciu: "Likvidácia",
}

export const functionStatusColors: Record<FunctionStatus, string> = {
  Funkcny: "bg-green-100 text-green-700",
  Pokazeny_Poskodeny: "bg-orange-100 text-orange-700",
  NaLikvidaciu: "bg-red-100 text-red-600",
}

export const assetKindLabels: Record<AssetKind, string> = {
  DlhodobyHmotny: "Dlh. hmotný",
  DlhodobyNehmotny: "Dlh. nehmotný",
  DrobnyHmotny: "Drob. hmotný",
  DrobnyNehmotny: "Drob. nehmotný",
  Prenajaty: "Prenajatý",
  Leasing: "Leasing",
}

export const travelOrderTypeLabels: Record<TravelOrderType, string> = {
  TUZEMSKY: "Tuzemský",
  ZAHRANICNY: "Zahraničný",
}

export const travelOrderTypeColors: Record<TravelOrderType, string> = {
  TUZEMSKY: "bg-blue-100 text-blue-700",
  ZAHRANICNY: "bg-purple-100 text-purple-700",
}

export const travelOrderStatusLabels: Record<TravelOrderStatus, string> = {
  DRAFT: "Rozpracovaný",
  PENDING_SUPERVISOR: "Čaká na nadriadeného",
  PENDING_MANAGER: "Čaká na správcu PC",
  APPROVED: "Schválený",
  REJECTED: "Zamietnutý",
}

export const travelOrderStatusColors: Record<TravelOrderStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_SUPERVISOR: "bg-yellow-100 text-yellow-700",
  PENDING_MANAGER: "bg-orange-100 text-orange-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
}

export const transportMeansLabels: Record<TransportMeans, string> = {
  VLASTNE_VOZIDLO: "Vlastné vozidlo",
  VEREJNY_TRANSPORT: "Verejná doprava",
  SLUZOBNE_VOZIDLO: "Služobné vozidlo",
  TAXIK: "Taxík",
  INE: "Iné",
}
