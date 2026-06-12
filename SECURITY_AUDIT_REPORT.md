# Security Audit Report — VšehoEvidencia

| Položka | Hodnota |
|---------|---------|
| **Dátum auditu** | 2026-06-12 |
| **Audítor** | Claude Sonnet 4.6 (AI-assisted SAST) |
| **Metodológia** | OWASP Top 10 · vyhláška 227/2025 Z. z. |
| **Rozsah** | Celý `src/` strom, `prisma/`, konfiguračné súbory |
| **Verzia repozitára** | vetva `main`, commit pred auditom: `47e3821` |

---

## 1. Fáza 1 — Statická analýza zraniteľností (SAST)

### 1.1 SQL Injection

| Kontrola | Výsledok |
|----------|----------|
| Použitie `$queryRaw` / `$executeRaw` | ✅ **Žiadne** — aplikácia výhradne používa Prisma Query Builder |
| Vstupy sanitizované cez ORM | ✅ Parametrizované dotazy vo všetkých akciách |

**Záver:** Aplikácia nie je zraniteľná voči SQL injection.

---

### 1.2 Cross-Site Scripting (XSS)

| Kontrola | Výsledok |
|----------|----------|
| `dangerouslySetInnerHTML` | ✅ **Žiadne výskyty** v `src/` |
| Serverové dáta renderované cez React (auto-escapovanie) | ✅ |
| `Content-Security-Policy` hlavička | ✅ Nastavená v `next.config.ts` |
| `unsafe-eval` v produkcii | ⚠️ **Nájdené → OPRAVENÉ** |

**Nález F-1.2-A** `MEDIUM` — `unsafe-eval` bol aktívny aj v produkčnom CSP.  
**Oprava:** `next.config.ts` teraz rozlišuje dev/prod CSP; `'unsafe-eval'` je prítomné len v dev.

---

### 1.3 Insecure Deserialization

| Kontrola | Výsledok |
|----------|----------|
| `eval()`, `Function()`, `vm.runInNewContext()` | ✅ **Žiadne** |
| `JSON.parse` bez schémovej validácie na hraniciach systému | ✅ Vstupy validované |

**Záver:** Žiadna zraniteľnosť.

---

### 1.4 Client-Side Data Leaks (Hydration Leaks)

| Kontrola | Výsledok |
|----------|----------|
| Kompletné DB objekty cez props do Client Components | ✅ **Žiadne** — všade explicitný `select` |
| `passwordHash` / `mfaSecret` v session alebo props | ✅ Nikde neodosielané klientovi |

**Záver:** Žiadna zraniteľnosť.

---

### 1.5 File Upload Security

**Nález F-1.5-A** `HIGH` — 10 upload blokov v `src/app/dashboard/dokumenty/actions.ts` neoverovali príponu súboru. Útočník mohol nahrať `.php`, `.js`, `.sh`.

**Oprava:**
- Pridaná funkcia `validateDocUpload(file)` s allowlistom povolených prípon
- Všetkých 10 blokov aktualizovaných na volanie `validateDocUpload()`
- Overenie veľkosti (max 50 MB) integrované do rovnakej funkcie

**Nález F-1.5-B** `OK` — `registratura/zaznamy/actions.ts` a `attachments/route.ts` mali allowlist validáciu pred auditom.

---

### 1.6 Mŕtvy kód a typová bezpečnosť

| Súbor | Odstránené |
|-------|-----------|
| `src/lib/travelUtils.ts` | Exporty `DIET_RATES`, `KM_RATES` (nikde neimportované) |
| `src/lib/notificationHelpers.ts` | Funkcia `notifyTravelOrderForManager` (nikde nevolaná) |
| `src/lib/regLabels.ts` | Re-exportné aliasy `sposobVybaveniaPrijatyLabels`, `sposobVybavieniaVytvorenyLabels` |

**Nález F-1.6-A** `MEDIUM` — 6× `as any` cast v `src/lib/auth.ts` obchádzalo typový systém.  
**Oprava:** Pridaná správna typová augmentácia next-auth v `src/types/next-auth.d.ts`; všetky `as any` odstránené.

---

## 2. Fáza 2 — Autentifikácia, Autorizácia a Databáza

### 2.1 NextAuth / Session Cookies

| Atribút | Stav pred | Stav po |
|---------|-----------|---------|
| `HttpOnly` | Implicitné (NextAuth default) | ✅ Explicitná konfigurácia |
| `Secure` | Implicitné (len prod) | ✅ Explicitná konfigurácia |
| `SameSite` | Implicitné (`lax`) | ✅ Explicitná konfigurácia |
| `__Secure-` prefix v prod | Implicitné | ✅ Explicitné |
| Session maxAge | 2 hodiny | ✅ Nezmenené |

**Nález F-2.1-A** `MEDIUM` — Bezpečnostné atribúty cookies neboli explicitne dokumentované v `authOptions`.  
**Oprava:** Pridaná sekcia `cookies:` v `src/lib/auth.ts`.

---

### 2.2 Autorizácia — Server Actions

Preverených **17 Server Action súborov** a **10 API Route súborov**.

| Vzor | Výsledok |
|------|----------|
| `getServerSession` pred každou mutáciou | ✅ Všetky súbory |
| Rolová kontrola pred DB operáciami | ✅ Konzistentný vzor |
| IDOR ochrana (owner check) | ✅ `order.userId === uid(user)` vo všetkých travel/expense akciách |
| Supervisor IDOR (`order.supervisorId === uid(user)`) | ✅ |

**Nález F-2.2-A** `LOW` — Zbytočné `as any` a `as { roles: string[] }` casty v 9 súboroch.  
**Oprava:** Všetky casty odstránené; kód používa priamo typy z `Session.user`.

---

### 2.3 API Routes — Prístupová kontrola súborov

| Route | Autentifikácia | Autorizácia | Path Traversal |
|-------|---------------|-------------|----------------|
| `/api/assets/file/[filename]` | ✅ session | ✅ visibility enum | ✅ `path.resolve` guard |
| `/api/dokumenty/file/[filename]` | ✅ (VEREJNY bez auth — zámer) | ✅ DOVERNI granular | ✅ |
| `/api/travel/file/[filename]` | ✅ session | ✅ owner/supervisor/role | ✅ |
| `/api/registratura/file/[id]` | ✅ session | ✅ role + owner | ✅ |
| `/api/attachments` (upload) | ✅ session | ✅ SPRAVCA_MAJETKU / BP | ✅ allowlist |

**Nález F-2.3-A** `LOW (design)` — Dokumenty s úrovňou `VEREJNY` sú prístupné bez autentifikácie. Ak aplikácia beží na verejnom internete, tieto dokumenty sú dostupné komukoľvek.  
**Odporúčanie:** Zabezpečiť sieťovou izoláciou (VPN, intranet) alebo pridať session check aj pre VEREJNY.

---

### 2.4 Databázová schéma

| Kontrola | Výsledok |
|----------|---------|
| SQL injection | ✅ Žiadne raw queries |
| Heslá v DB | ✅ Len hashe (bcrypt → migrované na Argon2id) |
| `mfaSecret` šifrovanie | ⚠️ Plaintext — **MFA momentálne neaktívne** |
| DB user oprávnenia | ⚠️ Vyžaduje manuálne overenie v produkcii |

**Nález F-2.4-A** `LOW` — `mfaSecret` uložený ako plaintext. Pred aktiváciou MFA nutné pridať šifrovanie na úrovni aplikácie (AES-GCM) alebo databázy (`pgcrypto`).

---

## 3. Fáza 3 — Kryptografia a Manažment tajomstiev

### 3.1 Kryptografická tabuľka (stav po audite)

| Účel | Algoritmus | Knižnica | Parametre |
|------|-----------|----------|-----------|
| Hashovanie hesiel | **Argon2id** | `@node-rs/argon2` | m=64 MiB, t=3, p=4 (OWASP 2024) |
| Verifikácia starých bcrypt hashov (lazy migration) | bcrypt-12 | `bcryptjs` | Dočasný fallback |
| JWT session tokeny | HMAC-SHA256 | `next-auth` | Podpísané `NEXTAUTH_SECRET` |
| Integrita súborov registratúry | SHA-256 | Node.js `crypto` | Iba integrity check, nie šifrovanie |
| UUID pre mená uložených súborov | CSPRNG | Node.js `crypto.randomUUID()` | — |

---

### 3.2 Migrácia bcrypt → Argon2id

**Nález F-3.2-A** `MEDIUM` — Heslá boli hashované bcrypt-12. Vyhovuje OWASP 2024, ale nie je súladné s vyhláška 227/2025 Z.z. (vyžaduje Argon2id).

**Oprava:**
- Nový modul `src/lib/password.ts` — centralizovaný `hashPassword()`, `verifyPassword()`, `needsRehash()`
- `src/lib/auth.ts`: pri úspešnom prihlásení s bcrypt hashom sa automaticky rehashuje na Argon2id
- `src/app/dashboard/users/actions.ts`, `my-card/actions.ts`: nové heslá používajú Argon2id
- Žiadny nútený reset hesiel — migrácia prebieha transparentne pri ďalšom prihlásení

---

### 3.3 Správa tajomstiev a prostredí

**Nález F-3.3-A** `HIGH` — Hardcoded heslo `"heslo123"` v `prisma/seed.ts` bolo priamo v zdrojovom kóde.  
**Oprava:** `seed.ts` načítava `SEED_ADMIN_PASSWORD` z env; bez tejto premennej seed zlyhá.

**Nález F-3.3-B** `MEDIUM` — Chýbal `HSTS` (`Strict-Transport-Security`) header.  
**Oprava:** `next.config.ts` pridáva HSTS `max-age=63072000; includeSubDomains; preload` len v produkcii.

**Nález F-3.3-C** `LOW` — Chýbal `.env.example` a `/uploads/` nebol v `.gitignore`.  
**Oprava:** Oba súbory vytvorené/aktualizované.

---

## 4. Súhrnná tabuľka všetkých nálezov

| ID | Fáza | Popis | Riziko | Status |
|----|------|-------|--------|--------|
| F-1.2-A | SAST | `unsafe-eval` v produkcii (CSP) | MEDIUM | ✅ OPRAVENÉ |
| F-1.5-A | SAST | Chýbajúca validácia prípon v 10 upload blokoch (`dokumenty/actions.ts`) | HIGH | ✅ OPRAVENÉ |
| F-1.6-A | SAST | 6× `as any` cast v `auth.ts` | MEDIUM | ✅ OPRAVENÉ |
| F-2.1-A | Auth | Implicitná cookie konfigurácia | MEDIUM | ✅ OPRAVENÉ |
| F-2.2-A | Auth | Zbytočné type casty v 9 súboroch | LOW | ✅ OPRAVENÉ |
| F-2.3-A | Auth | VEREJNY dokumenty bez autentifikácie | LOW | ✅ OPRAVENÉ (2026-06-12) |
| F-2.4-A | DB | `mfaSecret` v plaintext | LOW | ⚠️ MFA neaktívne — pred aktiváciou nutná oprava |
| F-3.2-A | Crypto | bcrypt namiesto Argon2id | MEDIUM | ✅ OPRAVENÉ |
| F-3.3-A | Secrets | Hardcoded heslo v `seed.ts` | HIGH | ✅ OPRAVENÉ |
| F-3.3-B | Secrets | Chýbajúci HSTS header | MEDIUM | ✅ OPRAVENÉ |
| F-3.3-C | Secrets | Chýbajúci `.env.example`, `/uploads/` mimo `.gitignore` | LOW | ✅ OPRAVENÉ |

**Celkový stav:** 10/11 nálezov plne opravených · 1 vyžaduje manuálny zásah

---

## 5. Odporúčania vyžadujúce manuálny zásah

> Tieto položky **nemôžu byť opravené automaticky** — vyžadujú infraštruktúrne alebo architektonické rozhodnutia.

### M-1: TLS 1.3 vynútenie (VYSOKÁ PRIORITA pred produkčným nasadením)
Next.js nekontroluje TLS verzie — toto je zodpovednosť reverse proxy.

**nginx** (odporúčané):
```nginx
ssl_protocols TLSv1.3;
ssl_ciphers TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;
ssl_prefer_server_ciphers off;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
```

**Alternatíva pre Node.js priamo:**
```
NODE_OPTIONS=--tls-min-v1.3 node server.js
```

### M-2: Databázový používateľ — minimálne oprávnenia
Overte, že `DATABASE_URL` v produkcii nepoužíva `postgres` / superuser účet.

```sql
-- Príklad: vytvorenie aplikačného používateľa
CREATE USER app_user WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE vsehoevidencia TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

### M-3: Šifrovanie `mfaSecret` pred aktiváciou MFA
Pred zapnutím MFA je nutné buď:
- **Aplikačne**: šifrovať `mfaSecret` cez AES-256-GCM s kľúčom z `APP_ENCRYPTION_KEY` env pred zápisom do DB
- **Databázove**: použiť PostgreSQL `pgcrypto` rozšírenie (`pgp_sym_encrypt`)

### M-4: Produkčné hodnoty prostredí
Súbor `.env` v repozitári obsahuje **vývojové hodnoty** — nikdy nesmiú ísť do produkcie:
- `DATABASE_URL` s heslom `admin123`
- `NEXTAUTH_SECRET` — vygenerujte nový: `openssl rand -base64 32`
- `SEED_ADMIN_PASSWORD` — v produkcii `seed` nespúšťajte

### ~~M-5: VEREJNY dokumenty a sieťová expozícia~~ — OPRAVENÉ ✅ (2026-06-12)

`api/dokumenty/file/[filename]/route.ts` teraz vždy vyžaduje platnú session pred stiahnutím akéhokoľvek dokumentu bez ohľadu na úroveň dôvernosti. Neprihlásení používatelia dostanú `401 Unauthorized`.

---

*Koniec správy*
