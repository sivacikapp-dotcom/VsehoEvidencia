# Používateľská príručka — VšehoEvidencia

> Táto príručka je určená pre interných zamestnancov organizácie. Popisuje prácu so systémom VšehoEvidencia — od prvého prihlásenia až po pokročilé funkcie jednotlivých modulov.

---

## Obsah

1. [Prihlásenie a odhlásenie](#1-prihlásenie-a-odhlásenie)
2. [Hlavný Dashboard](#2-hlavný-dashboard)
3. [Moja karta (profil zamestnanca)](#3-moja-karta-profil-zamestnanca)
4. [Evidencia majetku](#4-evidencia-majetku)
5. [Interné dokumenty a Agendy](#5-interné-dokumenty-a-agendy)
6. [Pracovné cesty](#6-pracovné-cesty)
7. [Registratúra](#7-registratúra)
8. [Správa používateľov (pre administrátorov)](#8-správa-používateľov-pre-administrátorov)

---

## 1. Prihlásenie a odhlásenie

### Prihlásenie

1. Otvorte webový prehliadač a prejdite na adresu aplikácie, ktorú vám poskytol správca systému.
2. Zadajte **prihlasovacie meno** a **heslo**.
3. Kliknite na tlačidlo **Prihlásiť sa**.

> Ak sa vám prihlásenie nedarí, skontrolujte, či nemáte zapnutý Caps Lock. Po niekoľkých neúspešných pokusoch môže byť váš účet dočasne zablokovaný — kontaktujte správcu systému.

### Odhlásenie

> ⚠️ **Dôležité upozornenie:** Po skončení práce so systémom sa vždy odhlás kliknutím na tlačidlo **Odhlásiť sa** v hlavnom menu. Nestačí zatvoriť záložku prehliadača — vaša session môže zostať aktívna. Bezpečné odhlásenie chráni vaše dáta pred neoprávneným prístupom, najmä na zdieľaných počítačoch.

---

## 2. Hlavný Dashboard

Po prihlásení sa zobrazí hlavný prehľad (Dashboard). Obsah sa líši podľa vašich oprávnení.

### Štatistické karty (pre správcov majetku)

| Karta | Popis |
|---|---|
| **Evidovaný majetok** | Celkový počet všetkých aktívnych majetkových položiek v systéme |
| **Pridelené položky** | Počet položiek, ktoré sú momentálne priradené konkrétnemu zamestnancovi alebo miestnosti |
| **Voľné položky** | Počet položiek bez priradenia — dostupné na pridelenie |
| **Používatelia** | Celkový počet registrovaných používateľov systému |

### Navigačné menu

Ľavý panel obsahuje navigáciu do jednotlivých modulov podľa vašej roly:

- **Moja karta** — váš profil, pridelený majetok, zmena hesla
- **Môj majetok** — prehľad majetku priradeného práve vám
- **Evidencia majetku** — správa všetkých aktív *(správca majetku)*
- **Miestnosti** — správa miestností *(správca majetku)*
- **Dokumenty** — interné smernice a agendy
- **Pracovné cesty** — cestovné príkazy a vyúčtovania
- **Registratúra** — podateľňa, záznamy, spisy
- **Používatelia** — správa účtov *(administrátor)*
- **Administrácia** — útvary, audit log *(administrátor)*

---

## 3. Moja karta (profil zamestnanca)

Sekcia **Moja karta** je dostupná každému prihlásenému používateľovi. Obsahuje:

### Osobné údaje

Zobrazuje vaše meno, prihlasovacie meno, e-mail, útvar a aktuálne priradené roly.

### Pridelený majetok

Prehľad všetkých majetkových položiek, ktoré vám boli pridelené (napr. notebook, telefón, nábytok). Pre každú položku vidíte:

- Názov a inventárne číslo
- Dátum pridelenia
- Aktuálny stav

### Zmena hesla

1. V sekcii **Zmena hesla** zadajte vaše súčasné heslo.
2. Zadajte nové heslo (minimálne 8 znakov).
3. Zopakujte nové heslo pre overenie.
4. Kliknite na **Zmeniť heslo**.

> Heslo je uložené v zašifrovanej forme — správca systému ho nevidí a nedokáže vám ho zobraziť. V prípade zabudnutia kontaktujte administrátora, ktorý vám nastaví nové heslo.

---

## 4. Evidencia majetku

Modul je dostupný pre používateľov s rolou **Správca majetku**.

### Prehľad majetku

Zobrazuje tabuľku všetkých evidovaných aktív s možnosťami filtrovania a vyhľadávania podľa:

- Názvu alebo inventárneho čísla
- Stavu (aktívny, vyradený, v oprave)
- Pridelenia (pridelený / voľný)
- Kategórie alebo miestnosti

### Pridanie novej položky

1. Kliknite na tlačidlo **Pridať majetok**.
2. Vyplňte formulár: názov, inventárne číslo, kategória, obstarávacia cena, dátum obstarania.
3. Voliteľne priložte fotodokumentáciu alebo faktúru.
4. Potvrďte kliknutím na **Uložiť**.

### Pridelenie majetku zamestnancovi

1. Otvorte detail konkrétnej položky kliknutím na jej názov.
2. Kliknite na **Prideliť**.
3. Vyberte zamestnanca zo zoznamu.
4. Potvrďte pridelenie.

Systém automaticky zaznamená dátum pridelenia a pridá záznam do histórie pohybov danej položky.

### Vyradenie majetku

1. Otvorte detail položky.
2. Kliknite na **Vyradiť z evidencie**.
3. Zvoľte dôvod vyradenia (fyzická likvidácia, predaj, krádež...).
4. Potvrďte operáciu.

> Vyradené položky nie sú zo systému zmazané — zostávajú v evidencii so stavom *Vyradený* pre účely auditov a inventúr.

---

## 5. Interné dokumenty a Agendy

Modul slúži na správu interných firemných smerníc, poriadkov a iných dokumentov organizovaných do **agend**.

### Štruktúra

Dokumenty sú usporiadané hierarchicky:

```
Agenda (napr. "Smernice BOZP")
└── Dokument (napr. "Smernica č. 3/2025 — Práca so zobrazovacou technikou")
    └── Prílohy (napr. formuláre, výkresy)
```

### Prezeranie dokumentov

1. V ľavom menu kliknite na **Dokumenty**.
2. Vyberte agendu zo zoznamu.
3. Kliknite na názov dokumentu pre zobrazenie jeho detailu.
4. Na stiahnutie súboru kliknite na ikonu stiahnutia pri prílohe.

> Prístup k dokumentom je riadený oprávneniami. Dokumenty označené ako **Dôverné** vidíte iba vtedy, ak vám správca pridelil príslušný prístup alebo ste gestorom danej agendy.

### Správa verzií

Každý dokument uchováva históriu verzií. Pri nahraní novej verzie:

1. Otvorte detail dokumentu.
2. Kliknite na **Nahrať novú verziu**.
3. Vyberte súbor a vyplňte popis zmeny.
4. Uložte.

Predchádzajúce verzie zostávajú dostupné v záložke **História verzií**.

### Pridanie dokumentu (pre správcov dokumentov)

1. Vyberte agendu a kliknite na **Pridať dokument**.
2. Vyplňte názov, číslo dokumentu, dátum platnosti a úroveň dôvernosti.
3. Nahrajte súbor prílohy.
4. Nastavte prístupy pre konkrétnych používateľov (ak je úroveň *Dôverný*).
5. Uložte.

---

## 6. Pracovné cesty

Modul pokrýva celý životný cyklus pracovnej cesty — od vytvorenia cestovného príkazu až po finančné vyúčtovanie.

### Stavy cestovného príkazu

```
DRAFT → PENDING_SUPERVISOR → PENDING_MANAGER → APPROVED → SETTLED
                                                         → REJECTED
```

| Stav | Popis |
|---|---|
| `DRAFT` | Rozpracovaný príkaz — ešte neodoslaný na schválenie |
| `PENDING_SUPERVISOR` | Čaká na schválenie nadriadeným (1. stupeň) |
| `PENDING_MANAGER` | Čaká na schválenie manažérom (2. stupeň) |
| `APPROVED` | Schválený — cesta môže prebehnúť |
| `SETTLED` | Vyúčtovaný a uzavretý |
| `REJECTED` | Zamietnutý |

### Vytvorenie cestovného príkazu (zamestnanec)

1. Kliknite na **Pracovné cesty** v menu.
2. Kliknite na **Nový cestovný príkaz**.
3. Vyplňte povinné údaje:
   - Cieľ cesty a účel
   - Dátum a čas odchodu a príchodu
   - Dopravný prostriedok
4. Voliteľne pridajte ubytovanie, zálohu alebo ďalšie výdavky.
5. Odošlite na schválenie tlačidlom **Odoslať nadriadenému**.

### Schvaľovanie (nadriadený / manažér)

1. V prehľade cestovných príkazov sa zobrazia príkazy čakajúce na vaše schválenie.
2. Kliknite na príkaz pre zobrazenie detailu.
3. Príkaz **schváľte** alebo **zamietne** s odôvodnením.

### Vyúčtovanie po ceste (zamestnanec)

1. Otvorte schválený cestovný príkaz.
2. Kliknite na **Vyúčtovať**.
3. Vyplňte skutočné časy odchodu a príchodu, priložte doklady o výdavkoch.
4. Odošlite vyúčtovanie.

### Tlač protokolu

Z detailu schváleného cestovného príkazu môžete vytlačiť **Cestovný príkaz** vo formáte vhodnom na podpis.

---

## 7. Registratúra

Modul pokrýva evidenciu pošty a dokumentov v súlade s pravidlami registratúrneho poriadku.

### Časti modulu

| Sekcia | Popis | Prístup |
|---|---|---|
| **Podateľňa** | Príjem a evidencia prichádzajúcej a odchádzajúcej pošty | Pracovník podateľne |
| **Záznamy** | Evidencia interných záznamov a listov | Oprávnení zamestnanci |
| **Spisy** | Správa spisov — skupín súvisiacich dokumentov | Správca registratúry |
| **Registratúrny plán** | Konfigurácia značiek, lhôt uchovávania | Správca registratúry |
| **Adresár** | Správa externých subjektov (odosielatelia / adresáti) | Správca registratúry |

### Príjem pošty (podateľňa)

1. Prejdite do sekcie **Podateľňa**.
2. Kliknite na **Nový záznam príchodzenej pošty**.
3. Vyplňte: odosielateľ, vec, dátum doručenia, spôsob doručenia.
4. Naskenujte a priložte dokument.
5. Uložte — systém automaticky pridelí číslo záznamu podľa registratúrneho plánu.

### Vybavenie záznamu

1. Otvorte záznam v zozname.
2. Po vybavení kliknite na **Označiť ako vybavené**.
3. Zadajte spôsob vybavenia a dátum.

### Spisy

Spis združuje viacero súvisiacich záznamov do jedného celku (napr. všetka korešpondencia k jednej zmluve).

1. Vytvorte nový spis: názov, registratúrna značka, lehota uchovávania.
2. Pridávajte záznamy do spisu cez tlačidlo **Vložiť do spisu**.
3. Po uzavretí veci spis uzavrite — zmení sa jeho stav na *Uzavretý* a začína plynúť lehota uchovávania.

---

## 8. Správa používateľov (pre administrátorov)

### Vytvorenie nového používateľa

1. Prejdite do sekcie **Používatelia**.
2. Kliknite na **Pridať používateľa**.
3. Vyplňte: meno, priezvisko, prihlasovacie meno, e-mail, útvar.
4. Nastavte počiatočné heslo — používateľ si ho po prvom prihlásení zmení.
5. Priraďte roly podľa pracovného zaradenia.
6. Uložte.

### Správa rolí

Roly je možné kedykoľvek zmeniť v detaile používateľa. Zmena oprávnení sa prejaví pri ďalšom prihlásení používateľa.

### Blokovanie účtu

Ak potrebujete dočasne zamedziť prístup (napr. počas absencie zamestnanca), môžete účet uzamknúť. Zablokovaný používateľ sa nebude môcť prihlásiť, jeho dáta ostávajú zachované.

### Audit log

Sekcia **Admin → Audit log** zaznamenáva všetky dôležité udalosti v systéme:

- Prihlásenia a odhlásenia
- Zmeny hesiel
- Vytvorenia, úpravy a mazania záznamov
- Schvaľovacie akcie

Log je dostupný iba administrátorom a slúži na bezpečnostné audity a sledovanie zmien.

---

*Posledná aktualizácia príručky: 2026-06-12*

*V prípade technických problémov alebo otázok kontaktujte správcu systému.*
