# VšehoEvidencia

**Navigation / Navigácia**

- 📖 [English Version](#-všehoevidencia-en)
- 📖 [Slovenská verzia / Slovak Version](#-všehoevidencia-sk)

---

## 🇬🇧 VšehoEvidencia {#-všehoevidencia-en}

> Internal enterprise management system for asset tracking, document management, business travel, and records management.

### Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roles & Permissions](#roles--permissions)
- [Security Hardening](#security-hardening)
- [Installation](#installation)
- [Environment Variables](#environment-variables)

---

### Overview

VšehoEvidencia is a full-stack internal web application built for organisations that need to manage:

- **Asset inventory** — track physical assets, assign them to employees, manage rooms
- **Internal documents & agendas** — versioned company directives with role-based access
- **Business travel** — travel order creation, two-step approval workflow, expense settlement
- **Records management (Registratúra)** — registry plan, incoming/outgoing mail, case files

---

### Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| Language | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | ^4 |
| ORM | Prisma | ^7 |
| Database | PostgreSQL | ≥ 14 |
| Authentication | NextAuth.js (Auth.js) v4 | ^4.24 |
| Password hashing | Argon2id (`@node-rs/argon2`) | ^2 |
| Icons | Lucide React | ^1.14 |

---

### Project Structure

```
src/
├── app/
│   ├── (print)/          # Print-only protocol layouts
│   ├── api/              # REST API routes (file serving, auth)
│   └── dashboard/
│       ├── admin/        # Admin: units, audit logs
│       ├── assets/       # Asset inventory
│       ├── dokumenty/    # Documents & agendas
│       ├── my-assets/    # Employee — assigned assets view
│       ├── my-card/      # Employee profile & password change
│       ├── nastavenia/   # Settings (travel rates)
│       ├── pracovne-cesty/ # Business travel
│       ├── registratura/ # Records management
│       ├── rooms/        # Room management
│       └── users/        # User administration
├── lib/
│   ├── auth.ts           # NextAuth configuration
│   ├── fieldEncryption.ts # AES-256-GCM field-level encryption
│   ├── password.ts       # Argon2id hashing (lazy bcrypt migration)
│   └── prisma.ts         # Prisma client singleton
└── types/
    └── next-auth.d.ts    # Session type augmentation
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Initial data seed
```

---

### Roles & Permissions

| Role | Description |
|---|---|
| `ADMIN` | Full system access |
| `SPRAVCA_MAJETKU` | Asset inventory management |
| `SPRAVCA_DOKUMENTOV` | Document & agenda management |
| `SPRAVCA_REGISTRATURY` | Records management configuration |
| `PRACOVNIK_PODATELNE` | Incoming/outgoing mail processing |
| `SUPERVISOR` | Business travel — first-level approver |
| `MANAGER` | Business travel — final approver |
| `EMPLOYEE` | Standard user (travel orders, own assets) |

---

### Security Hardening

The application underwent a comprehensive multi-phase security audit (SAST + manual review + OWASP ZAP DAST) on 2026-06-12.

#### OWASP ZAP Penetration Testing

Dynamic Application Security Testing (DAST) was performed under **three separate roles**:

- **Anonymous attacker** — unauthenticated access attempts
- **Regular user (EMPLOYEE)** — privilege escalation and IDOR attempts
- **Administrator (ADMIN)** — full authenticated surface scan

**SQL Injection (parameter `_rsc`)** — ZAP flagged a potential SQL injection on the `_rsc` query parameter used in several routes. After detailed analysis this was confirmed as a **false positive**: `_rsc` is an internal Next.js App Router parameter used for React Server Component streaming. All database access goes through **Prisma ORM with fully parameterised queries** — no raw SQL is used anywhere in the application.

**Path Traversal (`/api/auth/signout`)** — ZAP detected a path traversal anomaly on the NextAuth sign-out endpoint. After analysis this was confirmed as a **false positive**: the endpoint is a built-in NextAuth.js route that handles CSRF-protected session invalidation. No filesystem access occurs on this path.

#### Implemented Security Controls

| Control | Implementation |
|---|---|
| Password hashing | Argon2id — m=64 MiB, t=3, p=4 (OWASP 2024) |
| Legacy bcrypt migration | Transparent lazy rehash on next login |
| Session cookies | `HttpOnly`, `Secure`, `SameSite=Lax`, `__Secure-` prefix in production |
| JWT signing | HMAC-SHA256 via `NEXTAUTH_SECRET` |
| Field-level encryption | AES-256-GCM for sensitive DB columns (`mfaSecret`) |
| HSTS | `max-age=63072000; includeSubDomains; preload` (production only) |
| Content-Security-Policy | `unsafe-eval` disabled in production |
| X-Frame-Options | `SAMEORIGIN` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| X-Powered-By header | Disabled via `poweredByHeader: false` in `next.config.ts` |
| File upload validation | Extension allowlist + 50 MB size cap |
| Path traversal prevention | `path.resolve()` + `startsWith()` guard on all file-serving routes |
| Authorization | Role check + IDOR owner check on every Server Action and API route |
| Static analysis | `eslint-plugin-security` integrated into CI lint step |

---

### Installation

**Prerequisites:** Node.js ≥ 20, PostgreSQL ≥ 14

```bash
# 1. Clone the repository
git clone <repository-url>
cd vsehoevidencia

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env — fill in DATABASE_URL, NEXTAUTH_SECRET, APP_ENCRYPTION_KEY

# 4. Push database schema
npx prisma db push

# 5. Seed initial data (development only)
SEED_ADMIN_PASSWORD="YourStrongPassword1" npm run seed

# 6. Start development server
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

For production builds:

```bash
npm run build
npm start
```

---

### Environment Variables

See [`.env.example`](.env.example) for the full list and descriptions. Never commit `.env` to version control.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DATABASE_DIRECT_URL` | Yes | Direct connection (used by Prisma migrations) |
| `NEXTAUTH_URL` | Yes | Public application URL (must be `https://` in production) |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret — generate with `openssl rand -base64 32` |
| `APP_ENCRYPTION_KEY` | Yes | AES-256-GCM key (32 bytes, base64) — `openssl rand -base64 32` |
| `SEED_ADMIN_PASSWORD` | Dev only | Initial admin password for seed script |

---

## 🇸🇰 VšehoEvidencia {#-všehoevidencia-sk}

> Interný podnikový informačný systém pre evidenciu majetku, správu dokumentov, pracovné cesty a vedenie registratúry.

### Obsah

- [Prehľad](#prehľad)
- [Technologický stack](#technologický-stack)
- [Štruktúra projektu](#štruktúra-projektu)
- [Roly a oprávnenia](#roly-a-oprávnenia)
- [Bezpečnostné zabezpečenie](#bezpečnostné-zabezpečenie)
- [Inštalácia](#inštalácia)
- [Premenné prostredia](#premenné-prostredia)

---

### Prehľad

VšehoEvidencia je full-stack interná webová aplikácia pre organizácie, ktoré potrebujú spravovať:

- **Evidenciu majetku** — sledovanie fyzického majetku, prideľovanie zamestnancom, správa miestností
- **Interné dokumenty a agendy** — verzionované firemné smernice s prístupom podľa rolí
- **Pracovné cesty** — vytváranie cestovných príkazov, dvojstupňové schvaľovanie, vyúčtovanie
- **Registratúru** — registratúrny plán, podateľňa, záznamy a spisy

---

### Technologický stack

| Vrstva | Technológia | Verzia |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| Jazyk | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Štýlovanie | Tailwind CSS | ^4 |
| ORM | Prisma | ^7 |
| Databáza | PostgreSQL | ≥ 14 |
| Autentifikácia | NextAuth.js (Auth.js) v4 | ^4.24 |
| Hashovanie hesiel | Argon2id (`@node-rs/argon2`) | ^2 |
| Ikony | Lucide React | ^1.14 |

---

### Štruktúra projektu

```
src/
├── app/
│   ├── (print)/          # Tlačové layouty pre protokoly
│   ├── api/              # REST API routes (servírovanie súborov, auth)
│   └── dashboard/
│       ├── admin/        # Administrácia: útvary, audit logy
│       ├── assets/       # Evidencia majetku
│       ├── dokumenty/    # Dokumenty a agendy
│       ├── my-assets/    # Zamestnanec — pridelený majetok
│       ├── my-card/      # Profil zamestnanca a zmena hesla
│       ├── nastavenia/   # Nastavenia (cestovné sadzby)
│       ├── pracovne-cesty/ # Pracovné cesty
│       ├── registratura/ # Registratúra
│       ├── rooms/        # Správa miestností
│       └── users/        # Správa používateľov
├── lib/
│   ├── auth.ts           # Konfigurácia NextAuth
│   ├── fieldEncryption.ts # AES-256-GCM šifrovanie DB polí
│   ├── password.ts       # Argon2id hashovanie (lazy migrácia z bcrypt)
│   └── prisma.ts         # Prisma client singleton
└── types/
    └── next-auth.d.ts    # Rozšírenie typov session
prisma/
├── schema.prisma         # Schéma databázy
└── seed.ts               # Počiatočné dáta
```

---

### Roly a oprávnenia

| Rola | Popis |
|---|---|
| `ADMIN` | Plný prístup k celému systému |
| `SPRAVCA_MAJETKU` | Správa evidencie majetku |
| `SPRAVCA_DOKUMENTOV` | Správa dokumentov a agend |
| `SPRAVCA_REGISTRATURY` | Konfigurácia registratúry |
| `PRACOVNIK_PODATELNE` | Spracovanie pošty v podateľni |
| `SUPERVISOR` | Pracovné cesty — schvaľovanie prvého stupňa |
| `MANAGER` | Pracovné cesty — finálne schválenie |
| `EMPLOYEE` | Štandardný používateľ (cestovné príkazy, vlastný majetok) |

---

### Bezpečnostné zabezpečenie

Aplikácia prešla komplexným viacfázovým bezpečnostným auditom (SAST + manuálna revízia + OWASP ZAP DAST) dňa 2026-06-12.

#### Penetračné testovanie OWASP ZAP

Dynamické testovanie bezpečnosti aplikácie (DAST) bolo vykonané pod **tromi samostatnými rolami**:

- **Anonymný útočník** — pokusy o neoprávnený prístup bez prihlásenia
- **Bežný používateľ (EMPLOYEE)** — pokusy o eskaláciu privilégií a IDOR
- **Administrátor (ADMIN)** — skenovanie plnej autentifikovanej plochy

**SQL Injection (parameter `_rsc`)** — ZAP nahlásil potenciálnu SQL injekciu na parametri `_rsc` v niekoľkých routách. Po podrobnej analýze bol nález vyhodnotený ako **falošný poplach**: `_rsc` je interný parameter frameworku Next.js App Router používaný pri streamovaní React Server Components. Všetky databázové operácie prechádzajú cez **Prisma ORM s plne parametrizovanými dopytmi** — aplikácia neobsahuje žiadne surové SQL dopyty.

**Path Traversal (`/api/auth/signout`)** — ZAP detegoval anomáliu path traversal na endpointe odhlásenia NextAuth. Po analýze bol nález vyhodnotený ako **falošný poplach**: ide o vstavaný NextAuth.js endpoint, ktorý obsluhuje CSRF-chránenú invalidáciu session. Na tejto ceste nevzniká žiadny prístup k súborovému systému.

#### Implementované bezpečnostné opatrenia

| Opatrenie | Implementácia |
|---|---|
| Hashovanie hesiel | Argon2id — m=64 MiB, t=3, p=4 (OWASP 2024) |
| Migrácia zo starého bcrypt | Transparentný lazy rehash pri ďalšom prihlásení |
| Session cookies | `HttpOnly`, `Secure`, `SameSite=Lax`, prefix `__Secure-` v produkcii |
| Podpis JWT | HMAC-SHA256 cez `NEXTAUTH_SECRET` |
| Šifrovanie DB polí | AES-256-GCM pre citlivé stĺpce (`mfaSecret`) |
| HSTS | `max-age=63072000; includeSubDomains; preload` (iba produkcia) |
| Content-Security-Policy | `unsafe-eval` zakázané v produkcii |
| X-Frame-Options | `SAMEORIGIN` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Hlavička X-Powered-By | Zakázaná cez `poweredByHeader: false` v `next.config.ts` |
| Validácia nahrávaných súborov | Allowlist prípon + limit veľkosti 50 MB |
| Ochrana pred path traversal | `path.resolve()` + `startsWith()` guard na všetkých file-serving routách |
| Autorizácia | Kontrola roly + IDOR owner check pri každej Server Action a API route |
| Statická analýza | `eslint-plugin-security` integrovaný do lint kroku |

---

### Inštalácia

**Predpoklady:** Node.js ≥ 20, PostgreSQL ≥ 14

```bash
# 1. Klonovanie repozitára
git clone <url-repozitara>
cd vsehoevidencia

# 2. Inštalácia závislostí
npm install

# 3. Konfigurácia premenných prostredia
cp .env.example .env
# Upravte .env — vyplňte DATABASE_URL, NEXTAUTH_SECRET, APP_ENCRYPTION_KEY

# 4. Vytvorenie schémy databázy
npx prisma db push

# 5. Naplnenie počiatočnými dátami (iba development)
SEED_ADMIN_PASSWORD="VašeSilnéHeslo1" npm run seed

# 6. Spustenie vývojového servera
npm run dev
```

Aplikácia bude dostupná na adrese [http://localhost:3000](http://localhost:3000).

Pre produkčný build:

```bash
npm run build
npm start
```

---

### Premenné prostredia

Úplný zoznam a popis nájdete v súbore [`.env.example`](.env.example). Nikdy necommitujte `.env` do verziovacieho systému.

| Premenná | Povinná | Popis |
|---|---|---|
| `DATABASE_URL` | Áno | PostgreSQL connection string |
| `DATABASE_DIRECT_URL` | Áno | Priame pripojenie (Prisma migrácie) |
| `NEXTAUTH_URL` | Áno | Verejná URL aplikácie (v produkcii musí byť `https://`) |
| `NEXTAUTH_SECRET` | Áno | Kľúč na podpis JWT — `openssl rand -base64 32` |
| `APP_ENCRYPTION_KEY` | Áno | AES-256-GCM kľúč (32 B, base64) — `openssl rand -base64 32` |
| `SEED_ADMIN_PASSWORD` | Iba dev | Počiatočné heslo admina pre seed skript |
