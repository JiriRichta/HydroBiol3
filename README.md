# HydroBiol3

Lokální webová aplikace pro přípravu hydrobiologických dat ze sondových
exportů (EUREKA, YSI/KorEXO, WTW) do laboratorního systému **LabSystem**.
Běží výhradně v prohlížeči — žádný backend, žádná databáze, žádné
odesílání dat na server. Podrobná specifikace: `docs/HYDROBIOL3_MVP_SPEC.md`,
design systém: `docs/HYDROBIOL3_DESIGN_SYSTEM.md`.

## Spuštění

Vyžaduje Node.js 20+ (vyvíjeno a testováno na Node 26) a npm.

```bash
npm install          # instalace závislostí (včetně SheetJS z cdn.sheetjs.com)
npm run dev          # vývojový server, http://localhost:5173
```

Produkční build a lokální ověření:

```bash
npm run build        # vytvoří dist/
npm run preview      # obslouží dist/ na http://localhost:4173
```

## Testy

```bash
npm test             # Vitest — jednotkové a integrační testy (syntetická data)
npm run test:e2e     # Playwright — end-to-end workflow (sestaví dist/ a spustí preview)
```

Testy proti **reálným** vzorovým souborům (`fixtures/input/*`, `fixtures/export/*`)
se spustí automaticky navíc, pokud složka `fixtures/` v repozitáři existuje
(lokálně u vývojáře); v čistém klonu bez této složky se bezpečně přeskočí.
Složka `fixtures/` je úmyslně v `.gitignore` — obsahuje skutečná laboratorní
data a nesmí být verzována ani nasazována.

Playwright potřebuje jednorázově stažený Chromium: `npx playwright install chromium`.

## Architektura

```
src/core/      čistá doménová logika (bez DOM): import, normalizace, validace,
               snapshoty, výpočty, export — plně testovatelná ve Vitest
src/ui/        vanilla JS vrstva nad core/: shell, DataGrid, 4 záložky, dialogy
public/assets/ branding (SVG, favicon, CSS tokeny) dle design systému
tests/unit/    Vitest testy na syntetických datech (v Gitu)
tests/real/    Vitest testy proti reálným fixturám (běží jen když fixtures/ existuje)
tests/e2e/     Playwright — hlavní desktopový workflow
```

Vrstvy (jednosměrný tok): `import adapters → normalizace + registr parametrů
→ validace → sourceStore (Data) → workingSet (Pracovní sada) → UI/výpočty
→ export profily`.

## Hlavní workflow

1. **Import** — vyberte/přetáhněte soubory (EUREKA, ISY Android, ISY KorEXO
   ČB/Praha, WTW XLSX). Aplikace rozpozná formát z obsahu, zobrazí
   diagnostiku a vyžádá explicitní potvrzení převodu vodivosti (µS/cm → mS/m)
   a korekce záporné hloubky, pokud jsou relevantní. „Načíst data" přidá
   validní soubory do záložky **Data**.
2. **Data** — needitovatelný přehled všech normalizovaných záznamů. Výběr
   (checkbox, Shift/Ctrl) a „Přidat vybrané do pracovní sady" vytvoří hluboké
   nezávislé snapshoty v **Pracovní sadě**.
3. **Pracovní sada** — doplňkové údaje (číslo vzorku, průhlednost, průtok,
   teplota vzduchu, popis) jsou vždy editovatelné přímo v tabulce. Původní
   naměřené hodnoty lze upravit jen v **Detailu** (jeden záznam) nebo v
   **Hromadné editaci** (transakčně, Uložit/Zahodit/Pokračovat). K dispozici
   jsou i Nový záznam, Směsný vzorek (pH agregované přes H⁺) a Odebrat.
4. **Export** — zvolte profil (ČB/Praha) a rozsah, potvrďte neověřená
   mapování (viz níže) a stáhněte XLSX. Blokující chyby (špatná jednotka,
   neplatná hodnota, chybějící povinné pole) nelze obejít žádným
   potvrzením.

## Známá integrační omezení (SPEC §11)

Tato mapování jsou v aplikaci implementována, ale jejich **skutečná
akceptace LabSystemem nebyla ověřena** — export je u nich podmíněn vědomým
potvrzením uživatele a UI je trvale označuje jako neověřená:

- **ČB:** sloupce `Date`/`Time` (nově přidané na konec, nejisté zda je
  LabSystem umí mapovat nebo bezpečně ignorovat), `CHLOROPHYL`, `FLOW`
  (cílová jednotka průtoku nepotvrzena).
- **Praha:** `SpCond` (cílová jednotka, pravděpodobně mS/m), `Turbidity+`
  (NTU vs. FNU), `BGA`, `ch-isy` (přesný zdrojový kanál a jednotka).
- Textové číslo vzorku s úvodními nulami nebo mezerou (`K 4353`) — čtení
  LabSystemem jako text nebylo ověřeno.

Skutečný integrační test v LabSystemu je samostatný krok mimo tuto
aplikaci; automatické testy ověřují pouze přesnost vygenerovaného XLSX
(hlavičky, typy buněk, počty řádků, zpětné načtení).

## Bezpečnost a soukromí

- Žádný síťový požadavek s laboratorními daty — `vercel.json` nastavuje CSP
  (`connect-src 'self'`) jako technickou pojistku.
- Fonty (Quicksand, Inter) jsou self-hostované přes `@fontsource`, žádné
  volání na Google Fonts.
- Export vždy zapisuje text jako `t:'s'` buňky, nikdy jako vzorec — hodnota
  začínající `=` se do XLSX uloží jako neaktivní text.
- Relace žije pouze v paměti prohlížeče (žádné `localStorage`/IndexedDB);
  zavření karty nebo obnovení stránky znamená ztrátu neexportované práce —
  aplikace na to upozorňuje (`beforeunload`), pokud jsou v Data nebo
  Pracovní sadě nějaká data.

## Nasazení

Statický build (`npm run build` → `dist/`) lze nasadit na Vercel nebo
jakýkoli statický hosting. `vercel.json` v repozitáři nastavuje bezpečnostní
HTTP hlavičky. Žádný krok nasazení nebyl v rámci této implementace spuštěn.
