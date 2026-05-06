# Štruktúra projektu — VšehoEvidencia

## Adresárová štruktúra

```text
vsehoevidencia/
├── prisma/
│   ├── schema.prisma          # Definícia dátového modelu
│   ├── prisma.config.ts       # Konfigurácia Prisma CLI
│   └── seed.ts                # Počiatočné dáta pre vývoj
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API Route Handlers
│   │   ├── dashboard/         # Chránené stránky aplikácie
│   │   ├── login/             # Prihlasovacia stránka
│   │   └── layout.tsx         # Koreňový layout
│   ├── components/            # Zdieľané React komponenty
│   ├── generated/prisma/      # Automaticky generovaný Prisma Client
│   └── lib/                   # Pomocné knižnice a utility
├── uploads/                   # Nahrávané súbory (mimo git)
├── .env                       # Premenné prostredia (mimo git)
├── next.config.ts             # Konfigurácia Next.js + bezpečnostné hlavičky
├── CLAUDE.md                  # Pokyny pre AI asistenta
├── README.md                  # Inštalácia a spustenie
└── SECURITY.md                # Bezpečnostná politika
```

---

## Dátový model (Prisma)

### Jadro — Používatelia a roly

#### `User`

Centrálny model aplikácie. Každý používateľ má priradenú sadu rolí a voliteľného nadriadeného.

| Pole | Typ | Popis |
| ---- | --- | ----- |
| `id` | Int | Primárny kľúč |
| `firstName`, `lastName` | String | Meno a priezvisko |
| `email` | String (unique) | Prihlasovací identifikátor |
| `password` | String | bcrypt hash hesla |
| `roles` | `Role[]` | Zoznam rolí (viď enum nižšie) |
| `supervisorId` | Int? | Self-referencia na nadriadeného |
| `docRole` | `DocRole` | Rola v module dokumentov |

**Enum `Role`:**

| Hodnota | Popis |
| ------- | ----- |
| `PRIJEMCA` | Bežný zamestnanec — príjemca majetku |
| `NADRIADENY` | Nadriadený, schvaľuje pracovné cesty |
| `BEZPECNOSTNY_PRACOVNIK` | Prístup k BP informáciám o majetku |
| `SPRAVCA_KARIET` | Správca majetku, používateľov a miestností |
| `SPRAVCA_PC` | Správca pracovných ciest |

---

### Modul — Majetok

#### `Asset`

Evidovaná položka majetku (notebook, kľúč, SIM karta, stôl...).

| Pole | Typ | Popis |
| ---- | --- | ----- |
| `type` | `AssetType` | Kategória majetku (30+ hodnôt) |
| `name` | String | Názov položky |
| `brand` | `Brand` | Výrobca |
| `serialNumber` | String? (unique) | Výrobné číslo |
| `allocationStatus` | `AllocationStatus` | Stav pridelenia |
| `functionStatus` | `FunctionStatus` | Funkčný / pokazený / na likvidáciu |
| `kind` | `AssetKind` | Dlhodobý hmotný, drobný nehmotný... |
| `isSecurity` | Boolean | Bezpečnostný majetok (BP prístup) |
| `bpImei1`, `bpImei2` | String? | IMEI čísla mobilných telefónov |
| `bpTelefonneCislo` | String? | Telefónne číslo SIM karty |

**Enum `AllocationStatus`:**

| Hodnota | Popis |
| ------- | ----- |
| `Neprideleny_Volny` | Voľný, nepriradený |
| `Neprideleny_BCM` | Nepriradený, v správe BCM |
| `Prideleny_Recipient` | Priradený konkrétnemu používateľovi |
| `Prideleny_Room` | Priradený do miestnosti |
| `Vyradeny` | Vyradený z evidencie |

#### `AssetRecipientAssignment`

História prideľovania majetku konkrétnym používateľom. Zachováva všetky historické záznamy vrátane dátumov vrátenia.

#### `AssetRoomAssignment`

Historia prideľovania majetku do miestností. Analagická štruktúra ako `AssetRecipientAssignment`.

#### `AssetAttachment`

Príloha k majetkovej karte (PDF, obrázok...). Viditeľnosť riadená enumom `AttachmentVisibility`:

- `Everyone` — všetci prihlásení
- `ManagersAndSecurity` — správcovia a BP pracovníci
- `OwnRoleOnly` — len nahrávateľova rola

---

### Modul — Miestnosti

#### `Room`

Fyzická miestnosť s názvom. Majetok môže byť priradený do miestnosti, používatelia môžu mať prístup do miestností.

#### `UserRoomAccess`

Spojovacia tabuľka M:N medzi `User` a `Room`. Riadená správcom (`SPRAVCA_KARIET`).

---

### Modul — Dokumenty

Hierarchický systém riadenej dokumentácie s verziovaním a riadením prístupu.

#### `Agenda`

Tematická skupina dokumentov. Každý dokument patrí do agendy.

#### `Document`

Riadený dokument s podporou verziovania.

| Pole | Typ | Popis |
| ---- | --- | ----- |
| `znacka` | String | Identifikačná značka dokumentu |
| `nazov` | String | Názov dokumentu |
| `version` | Int | Číslo verzie (začína od 1) |
| `parentId` | Int? | Odkaz na predchádzajúcu verziu |
| `isLatest` | Boolean | Označenie aktuálnej verzie |
| `confidentiality` | `Confidentiality` | Úroveň dôvernosti |

**Enum `Confidentiality`:**

| Hodnota | Prístup |
| ------- | ------- |
| `VEREJNY` | Bez autentifikácie |
| `INTERNI` | Všetci prihlásení |
| `DOVERNI` | Len určení používatelia / gestori |

#### `DocumentAttachment`

Príloha dokumentu — samostatný verziovaný dokument viazaný na hlavný dokument. Má vlastnú dôvernosť a riadenie prístupu.

#### Riadenie prístupu k dokumentom

- `AgendaGestor` — gestor celej agendy (prístup ku všetkým dokumentom v agende)
- `DocumentGestor` — gestor konkrétneho dokumentu
- `DocumentAccess` — explicitný prístup konkrétneho používateľa ku dokumentu
- `DocumentAttachmentAccess` — explicitný prístup ku prílohe dokumentu

---

### Modul — Pracovné cesty

Implementácia podľa zákona 283/2002 Z. z. o cestovných náhradách.

#### `TravelOrder`

Príkaz na pracovnú cestu (tuzemskú alebo zahraničnú).

| Pole | Typ | Popis |
| ---- | --- | ----- |
| `orderNumber` | String (unique) | Jedinečné číslo príkazu |
| `type` | `TravelOrderType` | `TUZEMSKY` / `ZAHRANICNY` |
| `status` | `TravelOrderStatus` | Stav v schvaľovacom workflow |
| `transport` | `TransportMeans[]` | Použitý dopravný prostriedok |
| `vehicleRegPlate` | String? | ŠPZ súkromného vozidla |
| `advanceEUR` | Decimal? | Preddavok v EUR |

**Schvaľovací workflow (`TravelOrderStatus`):**

```text
DRAFT → PENDING_SUPERVISOR → PENDING_MANAGER → APPROVED
                                             ↘ REJECTED
```

#### `TravelExpenseReport`

Vyúčtovanie k pracovnej ceste (1:1 vzťah s `TravelOrder`). Obsahuje:

- Diéty podľa §5 zákona (výpočet na základe dĺžky cesty a odpočtov za jedlá)
- Náhradu km za súkromné vozidlo podľa §7
- Náklady na verejnú dopravu, taxi, ubytovanie, parkovanie
- Podporu pre zahraničné cesty (cudzá mena, vreckové, prepočet kurzom)

#### `TravelRateConfig`

Konfigurovateľné sadzby náhrad (diéty, km sadzby) s platnosťou od dátumu. Správca PC môže pridávať nové sadzby pri legislatívnych zmenách.

---

### Spoločné modely

#### `Notification`

In-app notifikácie pre používateľov. Môžu byť voliteľne povinné na potvrdenie (`mustAcknowledge`). Viazané na majetok, dokument alebo pracovnú cestu.

---

## Kľúčové súbory v `src/`

### `src/lib/`

| Súbor | Popis |
| ----- | ----- |
| `auth.ts` | NextAuth konfigurácia — bcrypt overenie, JWT callbacks, session timeout |
| `prisma.ts` | Singleton Prisma Client s PrismaPg adapterom |
| `labels.ts` | Slovenské popisky pre všetky enumerácie |
| `travelUtils.ts` | Výpočet diét, km náhrad a celkových výdavkov |
| `travelRateHelpers.ts` | Načítanie aktuálnych sadzieb z DB |
| `notificationHelpers.ts` | Vytváranie notifikácií pri kľúčových udalostiach |

### `src/app/api/`

| Cesta | Metóda | Popis |
| ----- | ------ | ----- |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler |
| `/api/attachments` | POST | Nahrávanie príloh k majetku |
| `/api/dokumenty/file/[filename]` | GET | Sťahovanie súborov dokumentov |
| `/api/travel/file/[filename]` | GET | Sťahovanie príloh pracovných ciest |

### `src/app/dashboard/*/actions.ts`

Server Actions — všetky mutácie databázy prebiehajú cez tieto súbory. Každá akcia:

1. Overí session (`getServerSession`)
2. Skontroluje požadovanú rolu volajúceho
3. Validuje vstupné dáta
4. Vykoná Prisma operáciu
5. Revaliduje Next.js cache (`revalidatePath`)

### `src/proxy.ts`

NextAuth middleware — chráni všetky cesty okrem `/login`, `/api/auth` a statických súborov. Neautentifikovaní používatelia sú automaticky presmerovaní.

---

## Tok dát

```text
Prehliadač
  │
  ├─ Server Component (page.tsx)
  │    └─ priamo volá prisma.* pre read operácie
  │
  ├─ Client Component (form, button)
  │    └─ volá Server Action (actions.ts)
  │         ├─ getServerSession() → overenie identity
  │         ├─ kontrola roly
  │         └─ prisma.* → zápis do DB
  │
  └─ Fetch na API Route (/api/*)
       ├─ getServerSession() → overenie identity
       └─ file system / prisma operácie
```
