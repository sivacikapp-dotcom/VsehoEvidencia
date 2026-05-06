# Používateľský návod — VšehoEvidencia

> Tento návod je určený pre bežného používateľa aplikácie. Neobsahuje technické detaily — vysvetľuje len to, čo vidíte na obrazovke a čo môžete robiť.

---

## Obsah

1. [Prihlásenie do aplikácie](#1-prihlásenie-do-aplikácie)
2. [Prehľad hlavnej obrazovky](#2-prehľad-hlavnej-obrazovky)
3. [Správa majetku](#3-správa-majetku)
4. [Moje priradenia a moja karta](#4-moje-priradenia-a-moja-karta)
5. [Pracovné cesty](#5-pracovné-cesty)
6. [Interné dokumenty](#6-interné-dokumenty)
7. [Miestnosti](#7-miestnosti)
8. [Správa používateľov](#8-správa-používateľov)
9. [Roly a oprávnenia](#9-roly-a-oprávnenia)
10. [Časté otázky](#10-časté-otázky)

---

## 1. Prihlásenie do aplikácie

### Ako sa prihlásiť

1. Otvorte adresu aplikácie vo webovom prehliadači.
2. Zobrazí sa prihlasovacia stránka **VšehoEvidencia — Evidencia majetku spoločnosti**.
3. Zadajte svoj **firemný e-mail** (napr. `meno.priezvisko@firma.sk`).
4. Zadajte **heslo** a kliknite na tlačidlo **Prihlásiť sa**.

Ak zadáte nesprávne údaje, zobrazí sa chybová správa. Skontrolujte e-mail a heslo a skúste znova.

### Pravidlá pre heslo

Aplikácia vyžaduje bezpečné heslo. Pri prvom prihlásení alebo zmene hesla musí heslo spĺňať **všetky** nasledujúce podmienky:

- Minimálne **10 znakov**
- Aspoň **jedno veľké písmeno** (A–Z)
- Aspoň **jedno malé písmeno** (a–z)
- Aspoň **jedna číslica** (0–9)

**Príklad správneho hesla:** `Kancelaria2025`

> Ak vám heslo nastavuje správca systému, požiadajte ho o nové heslo, ktoré spĺňa tieto pravidlá.

### Odhlásenie

Kliknite na tlačidlo **Odhlásiť sa** v dolnej časti ľavého panela. Z bezpečnostných dôvodov vás aplikácia automaticky odhlási po **8 hodinách** nečinnosti.

---

## 2. Prehľad hlavnej obrazovky

Po prihlásení sa ocitnete na hlavnom paneli (dashboard). Obrazovka je rozdelená na dve časti:

### Ľavý panel (navigácia)

Obsahuje všetky sekcie aplikácie. Zobrazujú sa len tie sekcie, ku ktorým máte prístup na základe vašej roly.

| Sekcia | Popis |
| ------ | ----- |
| **Majetok** | Evidencia IT a kancelárskeho vybavenia |
| **Moje priradenia** | Majetok priradený práve vám |
| **Moja karta** | Váš osobný prehľad |
| **Miestnosti** | Vybavenie kancelárií a miestností |
| **Používatelia** | Zoznam zamestnancov a ich rolí |
| **Interné dokumenty** | Riadená dokumentácia firmy |
| **Pracovné cesty** | Príkazy na cesty a vyúčtovania |
| **Nastavenia** | Sadzby náhrad za pracovné cesty |

V dolnej časti panela vidíte:

- Vaše **meno** a **e-mail**
- **Farebné štítky** s vašimi rolami (napr. modré SPRÁVCA KARIET, zelené NADRIADENÝ...)
- Tlačidlo na prepnutie **svetlého / tmavého režimu** (ikona slnka alebo mesiaca)
- Tlačidlo **Odhlásiť sa**

### Hlavná časť obrazovky

Tu sa zobrazuje obsah vybranej sekcie — tabuľky, formuláre alebo karty.

### Upozornenia

Niektoré upozornenia si vyžadujú vaše potvrdenie — zobrazí sa vyskakovacie okno, ktoré nemôžete zavrieť bez kliknutia na **Potvrdiť**. Ide napríklad o oznámenie o pridelení majetku alebo zmene na vašej karte.

---

## 3. Správa majetku

Sekcia **Majetok** je dostupná pre **Správcu kariet** a **Bezpečnostného pracovníka**.

### Prehľad zoznamu

Po otvorení sekcie vidíte tabuľku so všetkým evidovaným majetkom. V hlavičke je zobrazený celkový počet záznamov a koľko z nich práve vidíte po filtrovaní.

Každý riadok v tabuľke zobrazuje:

- **ID** — jedinečné číslo záznamu
- **Typ** — napr. Notebook, Kľúč, SIM karta...
- **Názov** — popis položky
- **Značka** — výrobca (Apple, Lenovo, HP...)
- **Výrobné číslo** — sériové číslo (ak existuje)
- **Miesto použitia** — kancelária / home office / prenosný
- **Stav pridelenia** — voľný, pridelený osobe, pridelený do miestnosti, vyradený
- **Stav funkčnosti** — funkčný, pokazený, na likvidáciu
- **Pridelené** — meno osoby alebo názov miestnosti

### Vyhľadávanie a filtrovanie

Nad tabuľkou nájdete panel s filtrami:

- **Vyhľadávacie pole** — hľadá podľa ID, názvu alebo výrobného čísla; stačí napísať časť slova
- **Typ** — vyfiltruje konkrétny druh majetku
- **Značka** — vyfiltruje podľa výrobcu
- **Miesto** — kancelária / home office / prenosný
- **Pridelenie** — zobrazí len voľný, pridelený alebo vyradený majetok

Ak sú aktívne nejaké filtre, zobrazí sa tlačidlo **Zrušiť filtre**, ktoré ich všetky naraz vymaže.

### Prispôsobenie stĺpcov tabuľky

Vpravo hore v tabuľke je tlačidlo **Stĺpce**. Kliknite naň a môžete:

- Zapnúť alebo vypnúť zobrazenie jednotlivých stĺpcov
- Zmeniť poradie stĺpcov presúvaním
- Obnoviť predvolené nastavenie

### Pridanie nového majetku

> Dostupné len pre **Správcu kariet**.

1. Kliknite na tlačidlo **+ Nový majetok** vpravo hore.
2. Vyplňte formulár podľa nasledujúcich polí.
3. Kliknite na **Vytvoriť**. Nový záznam sa okamžite objaví v tabuľke.

| Pole | Povinné | Popis |
| ---- | ------- | ----- |
| **Typ** | Áno | Kategória (Notebook, Kľúč, Mobil...) |
| **Názov** | Áno | Stručný popis položky |
| **Druh majetku** | Áno | Dlhodobý hmotný, drobný nehmotný... |
| **Miesto použitia** | Áno | Kancelária / home office / prenosný |
| **Značka** | Nie | Výrobca |
| **Výrobné číslo** | Nie | Sériové číslo (musí byť jedinečné) |
| **Rok výroby** | Nie | Rok výroby alebo kúpy |
| **Dátum obstarania** | Nie | Kedy bol majetok obstaraný |
| **Verejná poznámka** | Nie | Poznámka viditeľná aj príjemcovi |

### Pridelenie majetku osobe alebo miestnosti

> Dostupné len pre **Správcu kariet**.

1. V tabuľke nájdite požadovanú položku a kliknite na ikonu **Prideliť** (šípka doprava).
2. Vyberte, či prideľujete **osobe** alebo **miestnosti**.
3. Zo zoznamu vyberte konkrétnu osobu alebo miestnosť.
4. Voliteľne doplňte **poznámku** (napr. "Odovzdané osobne dňa...").
5. Kliknite na **Prideliť**. Príjemca dostane automatické upozornenie.

### Vrátenie majetku

> Dostupné len pre **Správcu kariet**.

1. V tabuľke nájdite pridelenú položku a kliknite na ikonu **Vrátiť** (šípka späť).
2. Potvrďte vrátenie a voliteľne doplňte poznámku.
3. Majetok bude označený ako **voľný** a história vrátenia sa uchová.

### Upravenie záznamu

1. Kliknutím na **ID** alebo ikonu **Detail** otvorte detailnú kartu majetku.
2. Na detailnej karte môžete upravovať polia záznamu — kliknite na konkrétnu hodnotu.
3. Zmeny uložte kliknutím na **Uložiť**.

### Prílohy k majetku

Na detailnej karte majetku môžete priložiť dokumenty:

- Kliknite na sekciu **Prílohy** a potom na **Nahrať prílohu**.
- Vyberte súbor z vášho počítača.

**Povolené formáty súborov:**

```text
PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, TXT
```

- Maximálna veľkosť súboru: **20 MB**
- Pri nahrávaní nastavíte **viditeľnosť** prílohy:
  - **Všetci** — vidí každý prihlásený
  - **Správcovia a BP pracovníci** — obmedzené
  - **Len moja rola** — vidí len nahrávateľova rola

---

## 4. Moje priradenia a moja karta

### Moje priradenia

Sekcia zobrazuje majetok, ktorý vám bol formálne pridelený. Každá karta obsahuje:

- Typ a názov položky
- Výrobné číslo, rok výroby, miesto použitia
- Dátum pridelenia a kto vám ho pridelil
- Prípadnú poznámku od správcu

Tlačidlom **Protokol o odovzdaní (PDF)** si môžete stiahnuť formálny protokol o prevzatí majetku.

V dolnej časti stránky sa nachádza **História vrátení** — rozbaľte ju kliknutím na nadpis, ak chcete vidieť majetok, ktorý ste v minulosti vrátili.

### Moja karta

Vaša osobná karta obsahuje tri sekcie:

**1. Karta majetku príjemcu**
Tabuľka aktuálne prideleného majetku a história vrátení — rovnako ako v sekcii Moje priradenia, len v kompaktnejšom zobrazení.

**2. Karta majetku miestností**
Zobrazuje miestnosti, do ktorých máte prístup, a majetok v nich evidovaný. Kliknite na názov miestnosti, aby ste ju rozbalili.

**3. Podriadení** *(len pre nadriadených)*
Ak máte v systéme podriadených, vidíte tu ich zoznam. Kliknutím na meno podriadného zobrazíte jeho kartu.

---

## 5. Pracovné cesty

### Prehľad príkazov

Sekcia **Pracovné cesty** zobrazuje zoznam všetkých vašich cestovných príkazov a vyúčtovaní. Správca PC vidí príkazy všetkých zamestnancov.

**Filtrovanie podľa stavu:**

| Stav | Popis |
| ---- | ----- |
| **Rozpracovaný** | Príkaz ešte nebol odoslaný |
| **Čaká na nadriadeného** | Odoslaný, čaká na schválenie nadriadeného |
| **Čaká na správcu PC** | Schválený nadriadeným, čaká na správcu PC |
| **Schválený** | Príkaz je schválený, cesta môže prebehnúť |
| **Zamietnutý** | Príkaz bol zamietnutý |

### Vytvorenie nového príkazu

1. Kliknite na **+ Tuzemský príkaz** (cestovanie v rámci SR) alebo **+ Zahraničný príkaz**.
2. Vyplňte formulár podľa nasledujúcich polí.
3. Kliknite na **Odoslať na schválenie**.

| Pole | Povinné | Popis |
| ---- | ------- | ----- |
| **Účel cesty** | Áno | Krátky popis dôvodu cesty |
| **Miesto odchodu** | Áno | Odkiaľ cestujete |
| **Cieľ** | Áno | Kam cestujete |
| **Dátum odchodu** | Áno | Deň a čas odchodu |
| **Dátum návratu** | Áno | Deň a čas návratu |
| **Dopravný prostriedok** | Áno | Vlastné vozidlo, MHD, služobné vozidlo, taxík... |
| **Záloha (EUR)** | Nie | Požadovaný preddavok v hotovosti |
| **Nadriadený** | Nie | Kto musí príkaz schváliť |

Pre **zahraničné cesty** sa zobrazia navyše: krajiny, záloha v cudzej mene, vreckové a možnosť zaškrtnúť cestovné poistenie.

### Schvaľovací postup

```text
Vytvorenie → Odoslanie → Schválenie nadriadeným → Schválenie správcom PC → Schválený
```

- Ak váš nadriadený alebo správca príkaz **zamietne**, obdržíte upozornenie s dôvodom zamietnutia.
- Zamietnutý príkaz môžete upraviť a znova odoslať.

### Vyúčtovanie po návrate

Po skončení pracovnej cesty je potrebné vytvoriť **vyúčtovanie**:

1. Otvorte detail schváleného príkazu.
2. Kliknite na **Vytvoriť vyúčtovanie**.
3. Vyplňte skutočné časy odchodu a príchodu, zadajte výdavky: diéty (vypočítajú sa automaticky), kilometre (pri vlastnom vozidle), lístky, taxík, ubytovanie, parkovanie a ostatné výdavky.
4. Priložte **doklady o výdavkoch** (faktúry, lístky). Povolené formáty: `PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, GIF, TXT, CSV` — max. **20 MB** na súbor.
5. Kliknite na **Odoslať vyúčtovanie**. Prebehne rovnaký schvaľovací postup ako pri príkaze.

### Stiahnutie prílohy

Prílohy k vyúčtovaniu môžete stiahnuť kliknutím na ich názov v detaile príkazu. Súbor sa automaticky stiahne do vášho počítača.

---

## 6. Interné dokumenty

### Prehľad dokumentov

Dokumenty sú organizované do **agend** (tematických skupín). Kliknite na kartu agendy, aby ste zobrazili dokumenty v nej.

Každý dokument má priradenú **úroveň dôvernosti**:

| Úroveň | Kto má prístup |
| ------- | -------------- |
| **Verejný** | Ktokoľvek (bez prihlásenia) |
| **Interný** | Všetci prihlásení zamestnanci |
| **Dôverný** | Len konkrétne určené osoby |

### Stiahnutie dokumentu

1. Kliknite na názov dokumentu v zozname.
2. Ak máte prístup, súbor sa automaticky **stiahne** do vášho počítača.
3. Ak nemáte prístup, zobrazí sa chybová správa. O prístup požiadajte správcu dokumentov.

**Povolené formáty dokumentov:**

```text
PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, TXT
```

### Verzie dokumentov

Dokumenty môžu mať viacero verzií. V zozname vždy vidíte **aktuálnu verziu**. Staršie verzie sú archivované a dostupné správcovi dokumentov.

### Správa dokumentov *(len pre Správcu dokumentov)*

Ak máte rolu správcu dokumentov, môžete navyše:

- Vytvárať nové **agendy** (kliknutím na **+ Nová agenda**)
- Pridávať nové dokumenty do agend
- Vytvárať nové verzie existujúcich dokumentov
- Spravovať, kto má prístup k dôverným dokumentom

---

## 7. Miestnosti

Sekcia **Miestnosti** je dostupná len pre **Správcu kariet**.

### Prehľad miestností

Zobrazuje sa zoznam všetkých miestností. Pri každej miestnosti vidíte:

- Počet kusov majetku evidovaných v miestnosti
- Počet osôb s prístupom do miestnosti

Kliknite na názov miestnosti alebo šípku, aby ste ju rozbalili a zobrazili podrobnosti.

### Majetok v miestnosti

Po rozbalení miestnosti vidíte tabuľku majetku priradeného do tejto miestnosti. Majetok môžete z miestnosti vybrať kliknutím na ikonu **Vybrať z miestnosti** — majetok sa označí ako voľný.

### Prístupy do miestnosti

V rozbalenom zobrazení miestnosti je sekcia **Osoby s prístupom**. Kliknutím na **Upraviť** môžete pridávať alebo odoberať prístupy jednotlivým zamestnancom.

### Pridanie novej miestnosti

1. Kliknite na **+ Nová miestnosť**.
2. Zadajte názov (napr. `Kancelária 101`, `Sklad B`).
3. Kliknite na **Vytvoriť**.

---

## 8. Správa používateľov

Sekcia **Používatelia** je viditeľná pre všetkých prihlásených, ale vytváranie a úpravu používateľov môže robiť len **Správca kariet**.

### Zoznam používateľov

Tabuľka zobrazuje všetkých zamestnancov v systéme:

- Meno a priezvisko
- E-mailová adresa
- Priradené role (farebné štítky)
- Nadriadený
- Počet pridelených majetkových kariet

### Pridanie nového používateľa *(len Správca kariet)*

1. Kliknite na **+ Nový používateľ**.
2. Vyplňte:
   - **Meno** a **Priezvisko**
   - **E-mail** (musí byť jedinečný v systéme)
   - **Počiatočné heslo** — musí spĺňať pravidlá pre silné heslo (min. 10 znakov, veľké + malé písmeno + číslica)
   - **Role** — vyberte jednu alebo viac (viď sekciu Roly a oprávnenia)
   - **Nadriadený** — voliteľne vyberte nadriadeného zamestnanca
3. Kliknite na **Vytvoriť**.

### Úprava používateľa *(len Správca kariet)*

1. V tabuľke kliknite na ikonu **Upraviť** (ceruzka) pri danom zamestnancovi.
2. Môžete zmeniť **role** a **nadriadeného**.
3. Kliknite na **Uložiť**.

### Karta zamestnanca

Kliknutím na tlačidlo **Karta** v tabuľke zobrazíte osobnú kartu daného zamestnanca — zoznam jeho majetku, miestností a podriadených.

---

## 9. Roly a oprávnenia

Každý používateľ môže mať jednu alebo viacero rolí. Rola určuje, čo v aplikácii vidíte a čo môžete robiť.

### Prehľad rolí

| Rola | Farba štítka | Popis |
| ---- | ------------ | ----- |
| **Príjemca** | Sivá | Bežný zamestnanec — vidí len svoj majetok a pracovné cesty |
| **Nadriadený** | Zelená | Schvaľuje pracovné cesty svojich podriadených |
| **Bezpečnostný pracovník** | Červená | Prístup k bezpečnostným informáciám o majetku (IMEI, SIM...) |
| **Správca kariet** | Modrá | Plná správa majetku, miestností, používateľov |
| **Správca PC** | Teal | Plná správa pracovných ciest a sadzieb náhrad |

### Čo môže bežný zamestnanec (Príjemca)

- Prihlásiť sa a odhlásiť
- Zobraziť **svoj pridelený majetok** a históriu vrátení
- Stiahnuť **protokol o odovzdaní** majetku
- Zobraziť svoju **osobnú kartu**
- Vytvoriť, upraviť a odoslať **cestovný príkaz**
- Vytvoriť a odoslať **vyúčtovanie pracovnej cesty**
- Zobraziť a stiahnuť **interné dokumenty** (podľa úrovne dôvernosti)
- Zobraziť zoznam kolegov v sekcii Používatelia

### Čo vyžaduje schválenie nadriadeného

- **Pracovný príkaz** — nadriadený musí schváliť pred odoslaním na správcu PC
- **Vyúčtovanie pracovnej cesty** — rovnaký postup ako príkaz

### Čo môže robiť len Správca kariet

- Pridávať, upravovať a vyraďovať majetok
- Prideľovať a vracať majetok
- Spravovať miestnosti a prístupy do nich
- Vytvárať a upravovať používateľov
- Nahrávať prílohy k majetku

### Čo môže robiť len Správca PC

- Schvaľovať alebo zamietnuť pracovné príkazy a vyúčtovania
- Nastavovať sadzby diét a kilometrových náhrad

### Čo môže robiť Bezpečnostný pracovník

- Zobraziť bezpečnostné informácie o majetku (IMEI, stav v doméne, podpora zariadení)
- Nahrávať prílohy k majetku

---

## 10. Časté otázky

**Zabudol som heslo — čo mám robiť?**

Aplikácia zatiaľ nemá funkciu „Zabudnuté heslo". Kontaktujte **Správcu kariet**, ktorý vám nastaví nové heslo.

---

**Príkaz na pracovnú cestu som omylom odoslal predčasne — dá sa to vrátiť?**

Pokiaľ nadriadený ani správca PC ešte nereagoval, môžete príkaz **stiahnuť späť do rozpracovania** otvorením jeho detailu. Ak už prebehlo schválenie, kontaktujte správcu PC.

---

**Nevidím sekciu Majetok v navigácii — prečo?**

Sekcia Majetok je viditeľná len pre roly **Správca kariet** a **Bezpečnostný pracovník**. Ak by ste k nej mali mať prístup, požiadajte správcu o pridelenie správnej roly.

---

**Nemôžem nahrať prílohu — zobrazuje sa chyba „Nepodporovaný formát".**

Skontrolujte, či súbor má niektorú z povolených prípon:

```text
PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, GIF, TXT, CSV
```

Iné formáty (napr. ZIP, RAR, EXE, MP4) nie sú z bezpečnostných dôvodov povolené.

---

**Príloha sa po kliknutí stiahla — kde ju nájdem?**

Súbor sa stiahol do priečinka **Stiahnuté súbory** (Downloads) vo vašom počítači. Ak používate prehliadač Chrome alebo Edge, v pravom dolnom rohu okna uvidíte priebeh sťahovania.

---

**Vidím upozornenie, ktoré neviem zavrieť.**

Niektoré upozornenia (napr. o pridelení majetku) vyžadujú **potvrdenie**. Prečítajte si text upozornenia a kliknite na tlačidlo **Potvrdiť**. Kým tak neurobíte, okno zostane otvorené.

---

**Chcem zmeniť, ktoré stĺpce vidím v tabuľke.**

Kliknite na tlačidlo **Stĺpce** vpravo hore nad tabuľkou. Zaškrtnite alebo odškrtnite stĺpce podľa potreby. Nastavenie sa uloží automaticky pre váš prehliadač.

---

*Ak nenájdete odpoveď na svoju otázku, kontaktujte správcu systému.*
