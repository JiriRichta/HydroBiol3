# SESSION HANDOFF — HydroBiol3 MVP

**Datum předání:** 2026-11-06
**Fáze projektu:** implementace MVP dokončena → **následuje uživatelské testování (UAT)**

Tento dokument předává kontext mezi relacemi. Nezavádí nové požadavky ani
nemění architekturu. Zdroj pravdy pro funkční chování zůstává
`docs/HYDROBIOL3_MVP_SPEC.md`, pro vzhled `docs/HYDROBIOL3_DESIGN_SYSTEM.md`,
pro spuštění a omezení `README.md`.

---

## 1. Stav aplikace a dokončené makrobloky

Schválený plán (rev. 2) počítal se dvěma makrobloky. **Oba jsou hotové.**

**Makroblok A — datové jádro (`src/core/`, bez DOM)**
- 5 importních adaptérů: EUREKA, ISY Android ČB, ISY KorEXO ČB, ISY KorEXO Praha, WTW XLSX.
- Detekce formátu podle obsahu, dekódování UTF-8 / UTF-16LE / windows-1252 podle BOM a formátu.
- Kanonický registr parametrů s explicitními alias tabulkami (žádné fuzzy párování hlaviček).
- Tři oddělené vodivostní veličiny: `specific_conductance`, `conductivity`, `nlf_conductivity` — nikdy se nezastupují.
- Kolize senzorů v jednom řádku → odmítnutí celého souboru s diagnostikou.
- WTW: teplota vody **výhradně** z řádku čidla `Cond`; chybí-li, hodnota zůstává prázdná + warning `WTW_COND_TEMP_MISSING`, žádný fallback na pH/O₂ čidlo.
- Importní transformace jen po explicitním potvrzení (vodivost µS/cm → mS/m dělením 10, korekce záporné hloubky) s auditní stopou v `source.transformations[]` a ochranou proti dvojímu převodu.
- Fingerprint souboru (SHA-256) proti duplicitnímu importu; commit per soubor je atomický.
- Neměnná záložka Data (deep freeze) × nezávislé snapshoty Pracovní sady (`structuredClone`) × transakční editační relace (`editSession`).
- Směsný vzorek: pH přes koncentraci H⁺ (`-log10(mean(10^-pH))`), ostatní parametry aritmetickým průměrem; hloubka a číslo vzorku se nikdy nedopočítávají.
- Dva exportní profily (ČB, Praha) s dvoutřídní validací a bezpečným zápisem XLSX (text vždy `t:'s'`, nikdy vzorec).

**Makroblok B — uživatelské rozhraní (`src/ui/`)**
- Shell se 4 záložkami (Import → Data → Pracovní sada → Export), počty záznamů, indikátor varování, guard proti tiché ztrátě rozpracovaných změn při přepnutí záložky.
- Vlastní jednoduchý tabulkový editor (ne Excel-like framework): sticky hlavička, výběr checkboxy včetně Shift/Ctrl, řazení jednoho sloupce, fulltext a jednoduchý filtr, viditelnost sloupců, editace buňky přes `<input>`.
- Režimy editace: doplňkové údaje vždy přímo v tabulce, Detail záznamu (jeden záznam, všechny parametry), Hromadná editace (transakčně, Uložit / Zahodit / Pokračovat).
- Nový záznam, Směsný vzorek, Odebrat, Export s náhledem a validací.
- Export: blokující chyby vypnou tlačítko Stáhnout a nelze je obejít žádným potvrzením; neověřená mapování vyžadují vědomé zaškrtnutí.
- Před nabídnutím stažení se vygenerovaný XLSX zpětně načte a zkontroluje.

Aplikace běží výhradně v prohlížeči — žádný backend, žádná databáze, žádný
síťový požadavek s laboratorními daty. Relace žije jen v paměti; `beforeunload`
upozorní na neexportovanou práci.

---

## 2. Git — commity a stav pracovního stromu

Repozitář je **lokální, bez vzdáleného remote** (`git remote -v` je prázdné),
větev `main`.

| Commit | Zpráva |
|---|---|
| `585b7df` | Přidej uživatelské rozhraní a export ČB/Praha |
| `ad08420` | Přidej datové jádro: importy, normalizaci, snapshoty, výpočty a exporty |

- Pracovní strom byl před vytvořením tohoto dokumentu **čistý**
  (`git status --short --untracked-files=all` bez výstupu).
- **Žádný push ani deployment nebyl proveden.**
- Reálná laboratorní data ve `fixtures/` **nejsou v žádném commitu** — ověřeno
  přes `git log --all --name-only` i `git ls-files`. `.gitignore` je kotvený na
  `/fixtures/` (dřívější nekotvená varianta omylem vylučovala i
  `tests/fixtures/synthetic/`, což je opravené).

---

## 3. Výsledky testů a produkčního buildu

Ověřeno znovu při předání relace (Node v26.13.0, npm 11.20.0 — přenosná
instalace, globální konfigurace Windows nebyla změněna):

| Kontrola | Příkaz | Výsledek |
|---|---|---|
| Jednotkové a integrační testy | `npm test` | **106 / 106 prošlo**, 15 testovacích souborů, 1,1 s |
| Testy proti reálným fixturám | součást `npm test` (`tests/real/`) | **4 / 4 prošlo** — AT-01 ověřeno: přesně **253 měření** (17 + 29 + 32 + 170 + 5) |
| Produkční build | `npm run build` | **úspěšný**, `dist/assets/index-*.js` 587,96 kB (gzip 192 kB) |
| End-to-end | `npm run test:e2e` | **2 / 2 prošlo** (Chromium, proti produkčnímu buildu) |

E2E scénáře: (1) kompletní workflow import → Data → Pracovní sada (editace
v tabulce + hromadná editace) → stažení exportu; (2) AT-25 — přepnutí záložky
během aktivní hromadné editace vyvolá dialog Uložit / Zahodit / Pokračovat.

Testy v `tests/real/` se spustí jen tehdy, když složka `fixtures/` existuje
lokálně; v čistém klonu se bezpečně přeskočí.

---

## 4. Známá omezení a nevyřešené otázky

**Integrační (SPEC §11) — hlavní předmět UAT.** Tato mapování jsou
implementována, ale **skutečná akceptace LabSystemem nebyla ověřena**; UI je
trvale označuje jako neověřená a export je u nich podmíněn vědomým potvrzením:

- **ČB:** `Date` / `Time` (sloupce přidané na konec — není jisté, zda je LabSystem namapuje nebo bezpečně ignoruje), `CHLOROPHYL`, `FLOW` (cílová jednotka průtoku nepotvrzena).
- **Praha:** `SpCond` (cílová jednotka, pravděpodobně mS/m), `Turbidity+` (NTU vs. FNU), `BGA`, `ch-isy` (přesný zdrojový kanál a jednotka).
- Textové číslo vzorku s úvodními nulami nebo mezerou (`K 4353`) — čtení LabSystemem jako text neověřeno.
- ČB `VZOREK` je ve vzorovém exportu numerický; podle SPEC zapisujeme text — vyžaduje ověření v LabSystemu.

**Implementační zjednodušení (vědomá, neblokující):**
- Grid má sticky jen hlavičku a sloupec s checkboxy, ne druhý sticky sloupec.
- ARIA vazby mezi záložkami a panely nejsou kompletní (role `tab` / `aria-selected` ano, plné `tabpanel` provázání ne).
- Rollup hlásí chunk > 500 kB. Pro offline desktopový nástroj je to přijatelné; dělení na chunky nebylo řešeno.
- Mimo rozsah vlastního gridu zůstává: výběr oblasti buněk, kopírování bloků, vícesloupcové řazení, tažení sloupců, virtualizace, undo/redo.

**Neověřeno automatizovaně:**
- Import reálných souborů přes UI v prohlížeči je pokrytý jen na úrovni importního pipeline (`tests/real/`); E2E běží na syntetických datech. Ruční průchod s reálnými soubory je úkol pro UAT.

---

## 5. Aktuální fáze projektu

**Implementace MVP je dokončena. Následuje uživatelské testování (UAT)
v laboratoři.** Nové funkce ani změny architektury nejsou naplánované; další
práce by měla vycházet až ze zjištění UAT.

Co UAT musí rozhodnout především:
1. Zda LabSystem skutečně přijme oba exportní soubory (viz neověřená mapování v §4).
2. Zda je workflow Pracovní sady pro laborantky průchodné (editace, směsné vzorky, čísla vzorků).
3. Zda diagnostika při importu dává dost informací při neočekávaném souboru ze sondy.

---

## 6. Lokální spuštění

Node.js a npm nejsou na systémové PATH. Přenosná instalace je v
`C:\Users\richta\Tools\node-v26.13.0-win-x64` a stačí ji přidat do PATH
**jen pro aktuální okno** (globální nastavení Windows se nemění):

```powershell
$env:PATH = "C:\Users\richta\Tools\node-v26.13.0-win-x64;" + $env:PATH
```

Pak v kořeni projektu (`C:\Users\richta\ClaudeCodeProject\HydroBiol3`):

```powershell
npm install          # jednorázově (včetně SheetJS z cdn.sheetjs.com)
npm run dev          # vývojový server → http://localhost:5173
```

Produkční verze, testy:

```powershell
npm run build        # vytvoří dist/
npm run preview      # obslouží dist/ → http://localhost:4173
npm test             # Vitest (106 testů)
npx playwright install chromium   # jednorázově před prvním E2E
npm run test:e2e     # Playwright (sestaví dist/ a spustí preview)
```

Pozor: Vite preview na tomto stroji naslouchá na IPv6 `::1`, ne na
`127.0.0.1` — proto `playwright.config.js` cílí na `http://localhost:4173`.

---

## 7. Doporučený další postup

1. **UAT s reálnými soubory** — projít v prohlížeči celý workflow se všemi
   5 vstupními formáty z `fixtures/input/`, včetně importních voleb
   (vodivost, záporná hloubka) a směsného vzorku.
2. **Integrační test v LabSystemu** — nahrát vygenerované XLSX (oba profily)
   a potvrdit nebo vyvrátit neověřená mapování z §4. Výsledek zapsat do
   `README.md` (sekce známých omezení) a podle něj upravit `src/core/export/profiles.js`
   (`mapping: 'unverified'` → `'confirmed'`, případně oprava jednotky).
3. **Zapsat zjištění UAT jako seznam konkrétních defektů / úprav** před
   jakoukoli další implementací; drobné opravy řešit jednotlivě, ne dalším
   makroblokem.
4. Volitelně, až po UAT: doplnit ARIA provázání panelů, zvážit dělení
   bundlu, rozšířit E2E o scénář směsného vzorku a profil Praha.
5. Teprve po přijetí exportů laboratoří zvážit nasazení (`vercel.json` je
   připravený včetně CSP) — vyžaduje výslovné schválení.
