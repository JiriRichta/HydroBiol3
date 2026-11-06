# HydroBiol3 — Mini Design System v1.0

**Stav:** schválený výchozí vizuální směr pro desktopové MVP  
**Datum:** 2026-11-06  
**Související dokument:** `HYDROBIOL3_MVP_SPEC.md`  
**Implementace:** HTML / CSS / vanilla JavaScript, Vite; nepřidávat UI framework bez technické nutnosti.

> Tento dokument je zdroj pravdy pro vizuální vrstvu. Funkčnost a datovou architekturu upravuje `HYDROBIOL3_MVP_SPEC.md`. Případné rozpory nebo nedostatečné kontrasty řešit úpravou konkrétního prvku, ne změnou celé vizuální identity.

## 1. Charakter značky

HydroBiol3 je vědecký nástroj pro práci s hydrobiologickými daty. Vizuální identita má působit **odborně, přesně, moderně a přátelsky**, nikoliv jako generická AI administrativní aplikace či kopie MS Excelu. Z Excelu přebíráme přehlednost a efektivitu tabulkové práce, nikoli vzhled ribbonu nebo jeho barvy.

- Čisté světle laděné rozhraní, maximální prostor pro data.
- Modrá jako výrazná identita; zelená pro výběry a akcenty; světle modrá pro doplňkové panely.
- Zaoblené konce ikonických vln, organický ale kontrolovaný charakter sondy a logotypu.
- Minimální dekorace uvnitř editoru; jemné okraje namísto silných stínů.
- Kompaktní tabulky s výraznou hierarchií stavů, ne obří karty s velkými mezerami.

## 2. Logo a jeho varianty

**Motiv:** centrální multiparametrická sonda se zakřiveným kabelem, přes dvě stylizované vlny. Obě vlny jsou v SVG skutečné Bézierovy křivky se **stejnou tloušťkou `stroke-width=19` a `stroke-linecap=round`**. Spodní část sondy je zjednodušená tak, aby byla použitelná i v malém měřítku.

| Soubor | Použití |
|---|---|
| `assets/hydrobiol3-logo-horizontal.svg` | Formální horizontální logo s podtitulkem |
| `assets/hydrobiol3-logo-header.svg` | Kompaktní logo v hlavičce webové aplikace bez podtitulku |
| `assets/hydrobiol3-symbol.svg` | Samostatný barevný symbol, splash, přehledy |
| `assets/hydrobiol3-symbol-mono.svg` | Jednobarevný tmavomodrý symbol pro tisk či monochromatické použití |
| `assets/hydrobiol3-symbol-white.svg` | Jednobarevný bílý symbol pro tmavé pozadí |
| `assets/hydrobiol3-logo-horizontal-mono.svg` | Jednobarevné tmavomodré horizontální logo |
| `assets/hydrobiol3-logo-horizontal-white.svg` | Jednobarevné bílé horizontální logo na tmavém podkladu |
| `assets/favicon.svg` a `assets/favicon.ico` | Zjednodušená ikonová varianta; neznázorňuje typografii |

### 2.1 Technická pravidla

- Loga jsou **skutečná editovatelná SVG** (path, rect, text, group), bez zabudovaných rastrových obrázků.
- Nápis **HydroBiol** je tmavomodrý `#0625A2`; číslice **3** je jasně zelená `#4BD541`. Obě jsou typograficky Quicksand 700.
- Samostatný symbol neobsahuje písmo. Zmenšení symbolu na 24–32 px ověřit v aplikaci.
- Logo zachovat v proporcích a neotáčet, nedeformovat, nevkládat do stínovaných karet ani neměnit nezávisle barvy vln.
- Kolem symbolu ponechat minimální odstup alespoň poloviny šířky těla sondy.
- Na světlém pozadí použít barevnou nebo tmavomodrou verzi, na tmavomodrém pozadí bílou variantu.

**Písmo a přenositelnost SVG:** Logotyp používá živé SVG `<text>` s deklarací `font-family="Quicksand, Comfortaa, sans-serif"`. Díky tomu je snadno editovatelný. Pro věrné zobrazení musí hostitelská webová stránka načíst Quicksand (viz § 4). Při otevření samostatného SVG mimo web může prohlížeč použít náhradní font; takové SVG nepovažujeme za typograficky uzamčenou tiskovou předlohu. Pokud bude později nutná naprosto přenosná verze do tisku, vytvoří se *odvozená* varianta s textem převedeným na křivky z licencovaného Quicksand, **nikdy** však nepřipojovat soubory fontů do exportovaného balíčku.

## 3. Barevný systém

### 3.1 Značkové barvy

| Token | Hex | Účel |
|---|---|---|
| `--hb-blue` | `#0625A2` | Logo, primární tlačítko, aktivní záložka, fokus |
| `--hb-blue-hover` | `#041C81` | Hover na primární akci |
| `--hb-sky` | `#84BCDA` | Vedlejší část loga, podpůrné informační plochy |
| `--hb-sky-strong` | `#36A5DA` | Spodní vlna symbolu, výraznější modrý detail |
| `--hb-lime` | `#A1EF8B` | Světle zelený akcent podle původní palety |
| `--hb-green-brand` | `#4BD541` | Zelená vlna, číslice 3; nikoli drobný text na bílém |
| `--hb-coral` | `#E68B75` | Volitelný dekorativní kontrast; není barvou chyb |

Uživatelsky schválená trojice **`#0625A2 / #84BCDA / #A1EF8B`** zůstává základní značkovou paletou. Jasnější zelená a modrá v logu jsou její sytější deriváty, které lépe drží vizuální čitelnost symbolu. Korálová je skutečně doplňková a má být používána ojediněle.

### 3.2 Rozhraní a stavy

| Token | Hex | Význam |
|---|---|---|
| `--hb-bg` | `#F7F9FC` | Pozadí aplikace |
| `--hb-surface` | `#FFFFFF` | Tabulky, dialogy, panely |
| `--hb-surface-subtle` | `#F1F6FA` | Hlavička tabulky, jemné dělení |
| `--hb-text` | `#17283C` | Primární text |
| `--hb-text-secondary` | `#536477` | Sekundární text |
| `--hb-border` | `#D6E1EB` | Jemné linky a oddělovače |
| `--hb-row-hover` | `#F0F7FC` | Hover v tabulkách |
| `--hb-row-selected` | `#E9F9E7` | Vybrané měření |
| `--hb-editing` | `#FEF6DB` | Rozpracovaná buňka |
| `--hb-success` | `#25783A` | Úspěch, validace prošla |
| `--hb-warning` | `#915A00` | Upozornění |
| `--hb-danger` | `#B1323A` | Chyba, konflikt senzorů |
| `--hb-info` | `#075E91` | Informační stav |

**Kontrast:** Barvy `#A1EF8B`, `#4BD541` a `#84BCDA` nejsou barvy pro malé písmo na bílém podkladu. Sémantické sdělení nedělit pouze barvou: použít také text, ikonu a podle potřeby popis problému. Primární tlačítko je bílé písmo na tmavomodré. Barvy validace mají samostatné tmavé textové tokeny.

## 4. Typografie

**Quicksand 500 / 600 / 700:** značka, nadpisy, čtyři záložky Import / Data / Pracovní sada / Export, tlačítka a zřetelná UI navigace. **Inter 400 / 500 / 600:** husté datové tabulky, numerické hodnoty, formulářová pole, technické zprávy. Používat `font-variant-numeric: tabular-nums` pro číselné sloupce a vhodné zarovnání doprava. Čas, pH, konduktivita a podobné sloupce mají být snadno vizuálně porovnatelné.

Připojení Google Fonts do HTML:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Soukromí/offline:** Google Fonts z prohlížeče typicky vyžaduje externí HTTP požadavky. Pokud požadujeme úplně offline nebo bez požadavků třetí straně, je potřeba fonty obsluhovat lokálně v rámci aplikace podle jejich licencí (nikoliv přikládat fonty do tohoto předávacího balíčku). Fallbacky jsou nastavené v CSS.

| Úroveň | Typická velikost | Váha |
|---|---:|---:|
| Nadpis stránky | 24–28 px | Quicksand 700 |
| Sekce / dialog | 18–20 px | Quicksand 700 |
| Záložky a tlačítka | 13–14 px | Quicksand 700 |
| Běžný text | 14 px | Inter 400/500 |
| Tabulka | 13 px | Inter 400/500 |
| Metainformace | 12 px | Inter 400/500 |

## 5. Rozložení a prostor

- **Primárně PC.** Pro MVP optimalizovat rozsah notebooků až po 1920×1080. Responsivní přestavba na telefon není závazná pro tuto verzi.
- Horní lišta: symbol / název, horizontální záložky, kontextová informace o lokální relaci. Výška cílově kolem 60–68 px; nezabírat přehnaně prostor tabulkám.
- Aktivní sekce na jedné obrazovce; neimitovat Excel Ribbon ani nevytvářet boční menu jen kvůli navigaci.
- Moduly oddělovat zřetelnou hierarchií: základní stránka, nástroje, datový obsah, stavová lišta.
- **Radius:** 4–6 px u tabulky a polí, 6–8 px pro tlačítka, 12–14 px pro dialogy. Nezavádět plošně vysoké zaoblení všech komponent.
- **Spacing:** škála 4 / 8 / 12 / 16 / 20 / 24 / 32 px.
- Omezit stíny převážně na dialogy; jinak používat neutrální okraje.

## 6. Tabulkový editor (prioritní komponenta)

| Oblast | Pravidlo |
|---|---|
| Výška řádku | Výchozí 36 px (možná později nastavitelná hustota) |
| Hlavička | 38 px, jemně modrošedá, přichycená při vertikálním scrollu |
| Čísla | Inter 13 px, tabulární číslice, ideálně doprava |
| Výběr | Jemně zelené pozadí `#E9F9E7`, viditelný checkbox a počet výběrů |
| Hover | Světle modrý podklad `#F0F7FC` |
| Trvale editovatelné doplňkové hodnoty | Jemný podklad `#F8FCF5`, jasný stav při fokusu |
| Naměřené hodnoty v běžném režimu | Read-only; bez vzhledu neaktivního formuláře v každé buňce |
| Hromadná editace | Jen označené řádky; viditelný banner editačního režimu; rozpracované buňky `#FEF6DB` |
| Validace | Červená linka v chybné buňce, popis při fokusu/kliknutí, souhrn problémů |
| Identifikace | Připnutá oblast s checkboxem a ID/číslem vzorku, posuv ostatních sloupců |
| Řazení a filtry | Výběr vázat na `measurementId` – nikdy na index viditelného řádku |
| Skryté sloupce | Pouze změna pohledu, ne vymazání dat |

**Obsluha výběru:** Checkbox, Ctrl+klik, Shift+klik; zvýraznění sady a počtu vybraných řádků; srozumitelný tooltip. Uživatel nesmí při filtrování či řazení náhodně změnit výběr měření. V aktivním režimu hromadné editace změny seřazení/filtrů bezpečně zablokovat nebo vyžádat dokončení editace.

### 6.1 Doplňkové parametry a snapshoty

V **Pracovní sadě** jsou doplňkové parametry **vždy** editovatelné. Původní naměřené hodnoty a metadata až po přepnutí režimu hromadné editace; detail jednoho záznamu může upravit všechny hodnoty kromě `measurementId`. V záložce **Data** zůstává vše neměnné. Zápis se provádí do nezávislého snapshotu a nikdy nemění normalizovaný originál.

## 7. Komponenty a stavy

### 7.1 Tlačítka

- **Primary:** tmavě modré, bílý text; jedna hlavní akce na kontext (např. „Načíst data“, „Přidat do pracovní sady“, „Stáhnout XLSX“).
- **Secondary:** bílé s modrým textem a jemným okrajem; běžné akce.
- **Quiet/Icon:** text + ikonka, průhledné pozadí; sekundární nástroje tabulky.
- **Destructive:** jasný text a potvrzovací dialog pro ztrátu úprav/pracovního záznamu; barva chyby pouze pro destruktivní akce, nikoli pro běžné odebrání ze seznamu.
- Disabled musí být rozpoznatelný, ale stav nesmí být jediným sdělením; poskytnout vysvětlení proč je akce neaktivní.

### 7.2 Záložky

Čtyři stálé záložky **Import / Data / Pracovní sada / Export**. Aktivní záložka má světle modré pozadí a spodní linku Klein Blue, ne velkou modrou kartu. Návrat do jiného kroku nesmí resetovat data. V aktivní hromadné editaci vyžádat uložení / zahození / pokračování.

### 7.3 Dialogy

Pro importní potvrzení, detail měření, směsný vzorek, dokončení hromadné editace a kontrolu exportu. Kompaktní typografie, maximální šířka přiměřená obsahu, jasně pojmenované akce. Detail editace jednoho záznamu může mít větší rozměr s logickými skupinami polí. Dialog nesmí skrytě ukládat změny při Storno.

### 7.4 Stavová lišta

Dole v Data/Pracovní sadě souhrn `počet měření • vybráno • validační problémy • rozpracované změny`. Vizuálně střídmá, bez permanentních toastů. Stav úspěchu a chyby oznámit textem a případně ikonou; nedávat validační výsledek jen do barvy.

## 8. Ikony

Preferovat soudržnou sadu Lucide (24×24 zdroj, v UI běžně 16–18 px) se zaoblenými konci (`stroke-linecap: round`). Pro značku se používá pouze vlastní symbol sondy. Nezaměňovat standardní ikony za barevné emoji. Stavy nekomunikovat jen barvou a samotnou ikonou.

## 9. Příklad připojení do aplikace

```html
<!-- public/assets/hydrobiol3-logo-header.svg a favicon.svg -->
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/hydrobiol3-tokens.css">
```

Hlavička:

```html
<img src="/assets/hydrobiol3-logo-header.svg" alt="HydroBiol3" width="220" height="58">
```

**Poznámka k fontům v externím SVG `<img>`:** Při vložení SVG přes `<img>` nemusí font načtený stránkou proniknout do izolovaného dokumentu SVG. Pro vizuálně přesný logotyp v aplikaci proto doporučujeme *inline SVG* nebo vykreslit symbol jako `<img>` a vedle něj HTML text `HydroBiol` + `3` s Quicksand. Pokud bude nutné logo použít jako samostatné `<img>` bez závislosti na dostupnosti fontu, musí vzniknout samostatná outline varianta z Quicksandu. Samotný symbol ani favicon žádný font nepotřebují.

## 10. Přejímací kontrola grafiky a UI

- [ ] Symbol má dvě skutečné vektorové vlny stejné tloušťky a zaoblených konců.
- [ ] Sonda i vlny jsou skutečné SVG geometrie; nejsou to rastry.
- [ ] Logo je čitelné na bílém pozadí; existuje monochromatická a bílá varianta.
- [ ] Favicon je čitelná v 16×16, 32×32 a 48×48 px.
- [ ] Quicksand 700 se v aplikaci používá na značce/navigaci, Inter na tabulkách.
- [ ] Tabulkový editor má správný výběr, střídmou hustotu a výrazně rozlišené editační stavy.
- [ ] Na žádné kartě nejsou použity nesmyslné dekorativní vlny, gradienty nebo silné stíny.
- [ ] Výstrahy a chybové stavy nezávisí pouze na barvě.
- [ ] Klávesnicový fokus je viditelný a hlavní texty mají dostatečný kontrast.

## 11. Připravenost pro Claude Code

Předat společně `HYDROBIOL3_MVP_SPEC.md`, tento soubor, `assets/hydrobiol3-tokens.css`, příslušná SVG a vzory importu/exportu. Nechat Claude Code především vytvořit konzistentní UI nad připravenými CSS tokeny. **Nepřevádět bez souhlasu projekt na React nebo Tailwind** a nezavádět rozsáhlou komponentovou knihovnu jen kvůli vzhledu.
