# VšehoEvidencia

Interná podniková aplikácia na správu majetku, dokumentov a pracovných ciest. Určená pre organizácie, ktoré potrebujú evidovať IT a kancelárske vybavenie, spravovať riadené dokumenty s rôznymi úrovňami dôvernosti a spracovávať tuzemské aj zahraničné pracovné cesty podľa zákona 283/2002 Z. z.

## Technologický základ

| Vrstva | Technológia |
| ------ | ----------- |
| Framework | Next.js 16.2.4 (App Router, Server Actions) |
| Databáza | PostgreSQL + Prisma ORM 7 |
| Autentifikácia | NextAuth.js 4 (JWT stratégia, bcrypt) |
| Štýlovanie | Tailwind CSS 4 |
| Ikony | Lucide React |
| Runtime | Node.js 20+ |

## Požiadavky

- Node.js >= 20
- PostgreSQL >= 14
- npm

## Inštalácia

```bash
# 1. Klonovanie repozitára
git clone <url-repozitara>
cd vsehoevidencia

# 2. Inštalácia závislostí
npm install

# 3. Konfigurácia prostredia
cp .env.example .env
# Vyplňte hodnoty v .env (viď sekciu Konfigurácia)

# 4. Vytvorenie databázy a spustenie migrácií
npx prisma migrate deploy

# 5. Voliteľne: naplnenie počiatočnými dátami
npm run seed

# 6. Spustenie vývojového servera
npm run dev
```

Aplikácia bude dostupná na `http://localhost:3000`.

## Konfigurácia (.env)

Súbor `.env` **nesmie byť** commitnutý do repozitára (je v `.gitignore`). Vytvorte ho podľa šablóny:

```env
# Pripojenie k databáze (Prisma CLI)
DATABASE_URL="postgresql://POUZIVATEL:HESLO@localhost:5432/vsehoevidencia?schema=public"

# Priame pripojenie pre Prisma Client (bez ?schema=public)
DATABASE_DIRECT_URL="postgresql://POUZIVATEL:HESLO@localhost:5432/vsehoevidencia"

# NextAuth
NEXTAUTH_URL="https://vasa-domena.sk"
NEXTAUTH_SECRET="<min. 32 náhodných znakov, napr. openssl rand -base64 32>"
```

> **Dôležité:** `NEXTAUTH_SECRET` musí byť kryptograficky náhodný reťazec dlhý aspoň 32 znakov.
> Nikdy nepoužívajte rovnaké heslo databázy pre vývoj aj produkciu.

## Dostupné príkazy

```bash
npm run dev        # Vývojový server s hot-reload
npm run build      # Produkčný build
npm run start      # Spustenie produkčného buildu
npm run lint       # Kontrola kódu cez ESLint
npm run seed       # Naplnenie DB počiatočnými dátami (len vývoj)
```

## Produkčné nasadenie

```bash
npm run build
npm run start
```

Pred nasadením skontrolujte:

- [ ] `NEXTAUTH_URL` smeruje na skutočnú HTTPS adresu
- [ ] Databázové heslo je dostatočne silné a odlišné od vývojového
- [ ] `NEXTAUTH_SECRET` je unikátny a nepredvídateľný
- [ ] PostgreSQL nie je verejne dostupný (iba localhost alebo private sieť)
- [ ] Adresár `uploads/` má správne oprávnenia (zápis pre Node.js proces)

## Adresár nahrávaných súborov

Súbory nahrané používateľmi sa ukladajú do `uploads/` v koreňovom adresári projektu:

```text
uploads/
  assets/    # Prílohy k majetku
  docs/      # Prílohy k dokumentom
  travel/    # Prílohy k pracovným cestám
```

Tento adresár **nesmie byť** verejne prístupný cez webový server. Prístup prebieha výlučne cez autorizované API cesty.

## Moduly aplikácie

| Modul | URL cesta | Popis |
| ----- | --------- | ----- |
| Majetok | `/dashboard/assets` | Evidencia IT a kancelárskeho vybavenia |
| Môj majetok | `/dashboard/my-assets` | Majetok priradený prihlásenému používateľovi |
| Moja karta | `/dashboard/my-card` | Osobný prehľad s BP informáciami |
| Miestnosti | `/dashboard/rooms` | Evidencia miestností a ich vybavenia |
| Dokumenty | `/dashboard/dokumenty` | Riadená dokumentácia s verziovaním |
| Pracovné cesty | `/dashboard/pracovne-cesty` | Príkazy na pracovné cesty a vyúčtovania |
| Používatelia | `/dashboard/users` | Správa používateľov a rolí |
| Nastavenia | `/dashboard/nastavenia` | Sadzby náhrad za pracovné cesty |
