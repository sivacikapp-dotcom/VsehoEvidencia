# Security & Key Management Guide — VšehoEvidencia

Tento dokument popisuje, kde a ako sú uložené tajomstvá, ako ich rotovať a čo robiť pri kompromitácii.

---

## 1. Prehľad tajomstiev

| Premenná | Kde sa používa | Rotácia | Dôsledok kompromitácie |
|----------|---------------|---------|------------------------|
| `DATABASE_URL` | Prisma Client (connection pool) | Pri zmene DB hesla | Útočník má čítací/zapisovací prístup k celej DB |
| `DATABASE_DIRECT_URL` | Prisma migrátory + seed | Pri zmene DB hesla | Rovnaké ako vyššie |
| `NEXTAUTH_SECRET` | Podpis a šifrovanie JWT session tokenov | Každých 90 dní / pri podozrení | Všetky aktívne sessions sú neplatné; nové sú bezpečné |
| `SEED_ADMIN_PASSWORD` | Len seed skript (dev/staging) | Pri každom nasadení | Kompromitovaný testovací účet |

---

## 2. Kde sú tajomstvá uložené

```
projekt/
├── .env                  ← NIKDY necommitovať; vylúčený v .gitignore
├── .env.example          ← Vzor bez skutočných hodnôt; commitnutý
└── .gitignore            ← .env a .env.* sú vylúčené; .env.example nie
```

**Pravidlá:**
- `.env` obsahuje len **vývojové hodnoty** a nikdy nejde do git
- `.env.example` je šablóna — každý vývojár si ho skopíruje a vyplní
- V produkcii sú premenné nastavené priamo v CI/CD (GitHub Secrets, Vault, k8s Secrets)

---

## 3. Generovanie nových tajomstiev

### NEXTAUTH_SECRET
```bash
# Linux / macOS / Git Bash
openssl rand -base64 32

# PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```
Výsledok vložte do `.env` / CI/CD.

### Databázové heslo
Použite správcu hesiel (Bitwarden, 1Password) alebo:
```bash
openssl rand -base64 24
```
Potom zmeňte heslo v PostgreSQL:
```sql
ALTER USER app_user WITH PASSWORD 'nové_silné_heslo';
```

---

## 4. Rotácia tajomstiev

### 4.1 Rotácia NEXTAUTH_SECRET

> ⚠️ Zmenou `NEXTAUTH_SECRET` sa **odhlásia všetci aktívni používatelia** (ich JWT tokeny prestanú byť platné). Plánujte rotáciu mimo pracovného času.

1. Vygenerujte nový secret (viď sekcia 3)
2. Aktualizujte hodnotu v CI/CD / Vault
3. Nasaďte aplikáciu (reštart)
4. Overte, že sa prihlásenie funguje
5. Informujte používateľov o nutnosti opätovného prihlásenia (voliteľné)

**Odporúčaná frekvencia:** každých 90 dní, alebo okamžite pri podozrení na kompromitáciu.

### 4.2 Rotácia DB hesla

1. Vytvorte nového DB používateľa s novým heslom (alebo zmeňte heslo existujúcemu)
2. Aktualizujte `DATABASE_URL` a `DATABASE_DIRECT_URL` v CI/CD
3. Nasaďte aplikáciu (nové spojenia použijú nové heslo)
4. Overte funkčnosť
5. Odvolajte starý prístup (ak nový používateľ)

**Odporúčaná frekvencia:** pri každej zmene tímu (odchod zamestnanca), minimálne raz ročne.

---

## 5. Mechanizmus hashovania hesiel

Aplikácia používa **Argon2id** (od verzie po audite 2026-06-12).

### Parametre (OWASP 2024)
| Parameter | Hodnota | Dôvod |
|-----------|---------|-------|
| Algoritmus | Argon2id | Odolnosť voči GPU aj side-channel útokom |
| Pamäť (`m`) | 65 536 KiB (64 MiB) | Sťažuje paralelné lámanie |
| Iterácie (`t`) | 3 | Minimálny OWASP odporúčaný počet |
| Paralelizmus (`p`) | 4 | 4 vlákna |

### Lazy migrácia z bcrypt

Existujúce heslá uložené ako bcrypt (prefix `$2`) sú **transparentne prehashovávané** pri ďalšom prihlásení používateľa — bez nutnosti reset hesla.

```
Prihlásenie:
  1. Načítaj hash z DB
  2. Ak hash.startsWith("$2") → over cez bcrypt
     Inak → over cez argon2id
  3. Ak platné a bcrypt → rehash na argon2id → ulož do DB
  4. Pokračuj normálne
```

Implementácia: `src/lib/password.ts`

### Kontrola po migrácii
Po 30 dňoch od nasadenia by mal byť zlomok bcrypt hashov v DB minimálny (len neaktívni používatelia). Príkaz na overenie:
```sql
SELECT
  COUNT(*) FILTER (WHERE password LIKE '$2%') AS bcrypt_count,
  COUNT(*) FILTER (WHERE password LIKE '$argon2id%') AS argon2id_count
FROM "User";
```

---

## 6. Kľúče pre budúce rozšírenia

### 6.1 Šifrovanie citlivých DB polí (AES-256-GCM) — IMPLEMENTOVANÉ ✅

Modul `src/lib/fieldEncryption.ts` poskytuje hotové funkcie `encryptField()` a `decryptField()`.

**Technické detaily:**
- Algoritmus: AES-256-GCM (autentifikované šifrovanie, odolné voči tamperingu)
- IV: 12 bajtov, náhodný pri každom šifrovaní (rôzne ciphertexty pre rovnaký plaintext)
- Auth tag: 16 bajtov (overuje integritu pri dešifrovaní)
- Formát v DB: `base64( IV[12] | Tag[16] | Ciphertext[n] )`
- Kľúč: `APP_ENCRYPTION_KEY` env premenná (32 B, base64) — **vygenerovaný a uložený v `.env`**

**Ako použiť pri implementácii MFA** (vzor pre `users/actions.ts`):

```ts
import { encryptField, decryptField, isEncrypted } from "@/lib/fieldEncryption"

// Zápis TOTP secretu do DB (napr. pri aktivácii MFA):
await prisma.user.update({
  where: { id: userId },
  data: {
    mfaSecret: encryptField(totpSecret),  // totpSecret = napr. "JBSWY3DPEHPK3PXP"
    mfaEnabled: true,
  },
})

// Čítanie a dešifrovanie pri TOTP overení:
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { mfaSecret: true, mfaEnabled: true },
})
if (user?.mfaSecret) {
  const plainSecret = decryptField(user.mfaSecret)  // "JBSWY3DPEHPK3PXP"
  // ... verifikácia TOTP tokenu
}
```

**Rotácia kľúča** — pred zmenou `APP_ENCRYPTION_KEY` je nutné:
1. Načítať všetky šifrované riadky starým kľúčom (`decryptField`)
2. Zašifrovať novým kľúčom (`encryptField` s novým kľúčom)
3. Uložiť späť do DB
4. Až potom zmeniť env premennú a nasadiť

Premenná: `APP_ENCRYPTION_KEY` — vygenerovaná a zdokumentovaná v `.env.example`.

### 6.2 TLS konfigurácia (nginx)

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate     /etc/ssl/certs/vsehoevidencia.crt;
    ssl_certificate_key /etc/ssl/private/vsehoevidencia.key;

    # TLS 1.3 only — zakázať TLS 1.0/1.1/1.2
    ssl_protocols TLSv1.3;
    ssl_prefer_server_ciphers off;

    # HSTS (Next.js ho tiež posiela, ale nginx ako prvá vrstva)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# Presmerovanie HTTP → HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### 6.3 HTTP zakázanie (produkcia)
V produkcii musí byť port 80 **buď zakázaný firewallom, alebo presmerovaný na HTTPS** (viď nginx konfigurácia vyššie). Aplikácia sama o sebe HTTP blokuje cez HSTS header, ale to funguje len po prvej HTTPS návšteve.

---

## 7. Checklist pred produkčným nasadením

- [ ] `NEXTAUTH_SECRET` vygenerovaný novým `openssl rand -base64 32` (nie dev hodnota)
- [ ] `DATABASE_URL` používa aplikačného používateľa, nie `postgres` / superuser
- [ ] DB používateľ má len `SELECT/INSERT/UPDATE/DELETE` — nie `CREATEDB`, `SUPERUSER`
- [ ] `NEXTAUTH_URL` nastavené na produkčnú HTTPS adresu
- [ ] `SEED_ADMIN_PASSWORD` **nie je nastavené** v produkcii (seed sa nespúšťa)
- [ ] nginx nakonfigurovaný s TLS 1.3 + redirect HTTP→HTTPS
- [ ] `.env` nie je commitnutý v git (`git ls-files .env` musí vrátiť prázdny výstup)
- [ ] Zálohovanie DB s šifrovaním at-rest
- [ ] `uploads/` adresár nie je v git; na produkcii použiť object storage (S3, MinIO)

---

## 8. Postup pri kompromitácii

### Scenár: Uniknutý NEXTAUTH_SECRET

1. **Okamžite** vygenerujte nový secret a nasaďte
2. Všetky sessions sa automaticky invalidujú — používatelia sa musia znovu prihlásiť
3. Skontrolujte audit log (`AuditLog` tabuľka, akcia `LOGIN_SUCCESS`) na podozrivé aktivity
4. Zmeňte DB heslo ako preventívne opatrenie

### Scenár: Uniknuté DB heslo

1. **Okamžite** zmeňte heslo v PostgreSQL (`ALTER USER ... WITH PASSWORD ...`)
2. Aktualizujte `DATABASE_URL` v CI/CD a nasaďte
3. Skontrolujte PostgreSQL log na neautorizované pripojenia
4. Zvážte audit celej tabuľky `AuditLog` na anomálie

### Scenár: Kompromitovaný administrátorský účet

1. Zablokujte účet cez admin panel (nastavte `lockedUntil` na ďalekú budúcnosť)
2. Skontrolujte `AuditLog` na akcie tohto účtu za posledných 30 dní
3. Resetujte heslo — nové bude hashované Argon2id
4. Informujte ostatných správcov (automatická `mustAcknowledge` notifikácia sa odošle)

---

*Posledná aktualizácia: 2026-06-12*
