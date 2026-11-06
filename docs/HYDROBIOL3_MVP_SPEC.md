# HydroBiol3 – specifikace MVP

**Dokument:** `HYDROBIOL3_MVP_SPEC.md`  
**Verze:** 1.0 – výchozí zadání pro technický plán  
**Datum:** 2026-11-06  
**Stav:** Produktové a funkční zadání schváleného konceptu; konkrétní mapování nejasných veličin a interoperabilita s LabSystemem mají označené ověřovací body.  
**Implementační nástroj:** Claude Code (nejprve PLAN, následně implementace po makroblocích).  
**Jazyk produktu:** čeština; názvy exportních sloupců musejí respektovat přesnou podobu šablon.

> **Účel dokumentu:** Tento soubor je zdrojem pravdy pro MVP. Rozhodnutí explicitně označená jako **MVP** se implementují; položky **OVĚŘIT** se nesmějí tiše domýšlet. Pokud se objeví rozpor mezi původními soubory, dřívějšími návrhy a tímto dokumentem, má Claude Code rozpor zdokumentovat a navrhnout nejjednodušší bezpečné řešení. Neprovádět zásadní změny schváleného workflow bez odsouhlasení.

---

## 1. Produkt a cíl

HydroBiol3 je lokálně fungující webová aplikace pro přípravu hydrobiologických dat do laboratorního informačního systému **LabSystem**. Typické použití:

1. Uživatel otevře webovou aplikaci na PC.
2. Načte jeden nebo více souborů z měřicích sond.
3. Aplikace rozpozná formáty, nabídne importní transformace, normalizuje a zvaliduje data.
4. Uživatel v záložce **Data** vidí všechny naimportované záznamy včetně úplných metadat, filtruje, řadí a označuje měření.
5. Vybraná měření přidá jako **nezávislé snapshoty** do **Pracovní sady**.
6. V Pracovní sadě přidává doplňkové parametry, upravuje hodnoty, případně vytváří nové a směsné vzorky.
7. V záložce **Export** zvolí profil **ČB** nebo **Praha**, prohlédne výsledek a stáhne XLSX pro LabSystem.
8. Po skončení relace aplikaci zavře. Data aplikace neodesílá k serverovému zpracování ani trvale neukládá do cloudu.

**Cílová platforma MVP:** PC / desktopový prohlížeč; optimalizace pro běžné notebooky a monitory včetně 1920 × 1080. Plnohodnotnou responzivitu pro telefony a tablety odložit.

### 1.1 Do rozsahu MVP patří

- Pět importních rodin (viz § 3) a opakovaný import dalších souborů do téže relace.
- Normalizovaný datový model, uchování původních údajů a metadat, validace, řízené transformace jednotek.
- Čtyři trvale dostupné záložky: **Import / Data / Pracovní sada / Export**.
- Tabulkový výběr s myší a klávesami Shift/Ctrl; filtrování, řazení, viditelnost sloupců.
- Nezměnitelná referenční záložka Data a editovatelné snapshoty v Pracovní sadě.
- Přímá editace doplňkových údajů; detailní editace jednotlivého záznamu; režim hromadné editace naměřených dat.
- Ruční přidání měření; odebrání měření; výpočet směsného vzorku.
- Volitelný nedestruktivní přenos `Annotation` do čísla vzorku u EUREKA.
- **Dva** exportní profily XLSX pro LabSystem: ČB a Praha.
- Automatické testy importérů, transformačních pravidel, identity/snapshotů, výpočtů a exportů; základní desktopové UAT.

### 1.2 Mimo rozsah MVP

- Autentizace, role, uživatelské účty, víceuživatelská práce, synchronizace a databáze.
- Serverové zpracování nebo ukládání měření, cloudové zálohy, trvalé pracovní projekty.
- Pokročilé statistiky, grafy, prostorové analýzy, interpolace, predikce a automatický výpočet objemově vážených směsí.
- Automatické řešení kolizí dvou senzorů měřících stejný parametr v jednom měření.
- Komplexní Excel klon (vzorce, formátování buněk, více pracovních listů uživatele), rozsáhlá historie Undo/Redo.
- Optimalizace mobilního rozhraní.

---

## 2. Nevyjednatelné principy dat

**DATA-01 – Každé měření je samostatná jednotka.** Každý záznam obsahuje kompletní vlastní hodnoty i vlastní metadata (datum, čas, lokalitu, přístroj, číslo vzorku, doplňkové parametry apod.). Neexistují editovatelné „globální parametry“, jejichž změna by automaticky přepisovala více záznamů. Hromadné doplnění zapisuje samostatné hodnoty do jednotlivých záznamů.

**DATA-02 – Neměnný normalizovaný originál.** Záložka **Data** reprezentuje normalizovaná měření po uživatelem schválených importních transformacích. Uživatel je zde vybírá, filtruje a prohlíží, nikoli edituje. Původní surové hodnoty a provenience importu se uchovají pro dohledání transformací.

**DATA-03 – Pracovní sada obsahuje hluboké snapshoty.** Při přidání do Pracovní sady se zkopíruje **kompletní** záznam (včetně všech parametrů a metadat), ne pouze viditelné sloupce a ne reference na objekt z Data. Editace snapshotu **nikdy** nemění původní záznam v Data.

**DATA-04 – Identita záznamu je stabilní.** Každé naimportované měření obdrží v rámci relace unikátní, neměnné `measurementId`. Pracovní snapshot si ponechává **stejné** `measurementId`. Toto ID nelze změnit v detailu, tabulce ani hromadnou editací. Číslo vzorku (`sampleNumber`, `vz`/`VZOREK`) **není** interní identita a může se změnit.

**DATA-05 – Duplicita při přidání do Pracovní sady.** Jedno zdrojové `measurementId` se v Pracovní sadě smí vyskytovat nanejvýš jednou. Pokud výběr obsahuje alespoň jedno již přidané ID, **zruší se celá operace přidání** a aplikace vypíše počet/identifikaci konfliktů; nesmí tiše přidat pouze část výběru.

**DATA-06 – Odebrat a znovu přidat znamená obnovit originál.** Po odebrání importovaného záznamu z Pracovní sady zůstává jeho záznam v Data. Opětovné přidání vytvoří **nový čistý snapshot z Data**, se stejným `measurementId`, ale původními normalizovanými hodnotami; předchozí editace se **neobnovují**.

**DATA-07 – Ruční/vypočítané záznamy.** Ručně založené a vypočítané měření vzniká v Pracovní sadě, získá nové unikátní `measurementId` a příznak `originType = manual | calculated`. Nemusí mít protějšek v Data. Jeho odebrání je skutečným odstraněním z pracovní relace, proto vyžaduje potvrzení.

**DATA-08 – Bez ztráty informací.** Neznámý či nepoužitý vstupní sloupec se nemá bez upozornění zahodit. Uchovat jeho původní název, hodnotu a případnou jednotku v metadatech/rozšířených parametrech. Fyzikálně odlišné veličiny se nesmějí sloučit pouze proto, že mají podobné názvy.

**DATA-09 – Importní transformace vs. editace.** Volby převodu konduktivity a korekce hloubky ovlivní vznik **normalizovaného originálu** v Data. Následné editace v Pracovní sadě se na něj nepropagují. Surový stav před transformací musí být dohledatelný.

### 2.1 Návrh logického modelu (kontrakt, nikoli předepsaná implementace)

```js
Measurement = {
  measurementId: "session-unique-id",   // neměnné
  originType: "imported",               // imported | manual | calculated
  source: {
    importId: "...",                    // u manual/calculated může být null
    fileName: "...",
    format: "ISY_PRH",
    sourceRow: 12,                      // případně skupina řádků u WTW
    originalOrder: 11,
    sensorIds: {},
    transformations: []
  },
  date: "2026-03-30",                  // lokální kalendářní datum, ne UTC
  time: "09:23:56",                    // lokální čas, může být null
  site: "VN Svihov HRAZ",
  sampleNumber: null,                   // STRING, např. "00852", "K 4353"
  annotation: null,
  description: null,
  device: null,
  parameters: {
    water_temperature_c: { value: 4.561, unit: "°C" },
    specific_conductivity: { value: 29.14, unit: "mS/m" },
    ph: { value: 7.89, unit: "pH" }
    // další známé veličiny jako samostatné klíče
  },
  supplementary: {
    air_temperature_c: null,
    transparency_m: null,
    flow: null                           // jednotku doplnit z potvrzené mapy
  },
  extraParameters: {},                   // neznámé/rozšiřující veličiny
  originalRaw: {},                       // surové hodnoty pro audit
  calculation: null                      // u směsného: sourceMeasurementIds, metoda
};
```

Model je orientační: Claude Code může upravit názvy struktur, nikoli uvedené invarianty. `source`, `originalRaw`, interní provenienční a validační údaje jsou systémové; v detailu uživatel edituje **všechny uživatelské hodnoty a metadata**, nikoli interní `measurementId` ani integritu surového auditního záznamu. Původní datum/čas jsou lokální hodnoty bez implicitního posunu do UTC.

---

## 3. Vstupní soubory – ověřené vzory

V repozitáři uchovat testovací vzory (nebo bezpečně anonymizované ekvivalenty) a zajistit regresní testy. Názvy souborů se používají jako nápověda, **formát se musí ověřovat i podle obsahu**.

| Rodina | Ověřený soubor | Kontejner / kódování / struktura | Měření ve vzoru |
|---|---|---|---:|
| `EUREKA_PLZ_*` | `EUREKA_PLZ_BelskyMlyn 3.4.25.csv` | CSV s čárkou, UTF-8, desetinná tečka; `DATE`, `TIME`, `Temp_deg_C`, `Depth_m`, `Annotation` aj. | 17 |
| `ISY_ANDROID_CB_*` | `ISY_ANDROID_CB_Kor Measurement File Export - 033126085850.csv` | TSV, Windows-1252 kompatibilní; `sep=\t`, desetinná čárka; **20 opakovaných bloků hlaviček**, různé sestavy sloupců | 29 |
| `ISY_CB_*` | `ISY_CB_jorKorEXO Measurement File Export - 032426 135022.csv` | TSV, UTF-16 LE s BOM, `sep=\t`, desetinná tečka; hlavičky s identifikací senzoru, např. `DO mg/L-21K101267` | 32 |
| `ISY_PRH_*` | `ISY_PRH_exobackup-260330-142128.csv` | CSV se středníkem, UTF-16 LE s BOM, `sep=;`, desetinná čárka | 170 |
| `WTW_CB_*` | `WTW_CB_wtw 24.3.2026.xlsx` | XLSX; pro jedno měření jsou typicky **3 řádky** (vodivost, pH, O₂); seskupení podle zařízení/ID/času | 5 |

Pět výše uvedených souborů obsahuje celkem **253 měření**. Počty se vztahují výhradně k těmto přiloženým vzorům, nikoliv k obecné vlastnosti formátu.

### 3.1 Požadavky na importéry

**IMP-01 – Samostatný adaptér pro každý formát.** Každý adaptér vrací stejný normalizovaný kontrakt a strukturovaný diagnostický výsledek (`importable`, počet záznamů, upozornění, chyby, jednotky, detekované parametry).

**IMP-02 – EUREKA.** Zpracovat `Annotation` jako původní textovou hodnotu u každého měření. Nepřenášet ji automaticky do `sampleNumber`. Volitelná akce v Pracovní sadě kopíruje (snapshotuje) `Annotation → sampleNumber`, bez změny či mazání `Annotation`; existující číslo vzorku nepřepisovat bez výslovného potvrzení.

**IMP-03 – Android YSI.** Soubor může opakovat hlavičku před jednotlivými skupinami záznamů a měnit sadu/pořadí sloupců. Parser musí pracovat s hlavičkou **aktuálního bloku**, nikoli s jednou globální první hlavičkou. Prázdné oddělovací řádky nejsou měření.

**IMP-04 – YSI s ID senzorů.** V názvu sloupce rozlišit fyzikální veličinu, jednotku a identifikátor čidla. Např. `DO mg/L-21K101267` a `DO mg/L-21K985476` mohou označovat **tutéž veličinu ze dvou senzorů**. Pokud v **jednom měření** oba sloupce obsahují hodnotu pro tentýž kanonický parametr, vzniká kolize; **odmítnout import příslušného souboru jako celek** s informací o parametru, řádku a senzorech. Neprovádět implicitní prioritu ani průměr. Pouhá přítomnost dvou čidel v souboru bez kolize v konkrétním měření není důvodem odmítnutí.

**IMP-05 – Neplést rozdílné veličiny.** Například `DO %` a `DO mg/L`, `SPC-uS/cm` a `C-uS/cm`, `pH` a `pH mV`, `Chl ug/L` a `Chl RFU`, `BGA-PC ug/L` a `BGA-PC RFU` **nejsou duplicity**. Zachovat samostatně; cílové profily mapují jen odpovídající veličinu.

**IMP-06 – WTW pivot.** Z opakovaných řádků podle skupinovací identity WTW (`Device`, `Device serial`, `ID`, `Date/Time`, s kontrolou konzistence) vznikne **jeden** normalizovaný záznam. Senzory mohou vykazovat rozdílné dílčí teploty. **Autoritativní teplota vody je hodnota `Temp` u řádku `Mode = Cond` (konduktometrické čidlo)**. Ostatní teploty zachovat v provenienci, nikoli tiše přepsat výslednou teplotu. Pokud teplota vodivostního čidla chybí, upozornit; náhradní senzor nevybírat bez potvrzeného pravidla.

**IMP-07 – Nepřevádět formáty odhadem.** Datum, čas a čísla parsovat podle zjištěného zdroje. Prázdnou hodnotu odlišit od nuly. Neplatné číslo označit, nikoliv automaticky dosadit `0`; desetinnou čárku interpretovat podle formátu. `sampleNumber` nikdy nepřevádět bez potřeby na číslo.

**IMP-08 – Opakovaný import.** Do již existující relace lze přidávat nové soubory, aniž by se resetovala Data či Pracovní sada. Každá importní dávka má samostatné `importId`; původní pořadí v každém souboru se zachovává.

**IMP-09 – Zamezení dvojího importu téhož souboru.** Pro identický obsah souboru vyhodnotit otisk a odmítnout opětovné načtení se srozumitelným upozorněním. Automaticky neslučovat dva *různé* soubory jen kvůli stejným časům či hodnotám – mohou představovat legitimní opakování.

### 3.2 Povinné importní volby

Po výběru souboru zobrazit detekovaný formát, počet měření, jednotky a případné chyby. **Před dokončením importu vyžadovat explicitní potvrzení** následujících voleb tam, kde jsou relevantní:

1. **Vodivost:** pokud zdroj používá `µS/cm`, nabídnout převod na `mS/m` vztahem `hodnota × 0,1`, nebo ponechání původní hodnoty v původní jednotce. Nikdy pouze nevyměnit štítek jednotky. Výsledná hodnota vždy nese aktuální jednotku a záznam transformace; aplikovat jen jednou. Pokud se uživatel rozhodne nepřevádět, exportní validace musí zabránit chybné interpretaci jednotky v cílovém sloupci a vyžádat si výslovné doplnění/odsouhlasení převodu.
2. **Hloubka:** volitelná korekce **všech záporných hodnot** `Depth < 0 → 0 m`. Je-li vypnuta, hodnoty zůstávají beze změny a mohou dostat upozornění validace. Surové záporné hodnoty uchovat.

Volby evidovat pro konkrétní importovaný soubor; nelze je zpětně nenápadně změnit u jiných importů. Není-li možné jednoznačně určit jednotku, zablokovat automatický převod a vyžádat si upřesnění.

### 3.3 Normalizace a slovník parametrů

Zavést centrální registr definic parametrů: `canonicalKey`, popisek, fyzikální význam, jednotka, typ, případné aliasy pro jednotlivé importéry, cílové mapování do profilu a pravidlo agregace. **Ověřit podle skutečných hlaviček a jednotek; nic nepřevádět podle podobnosti názvu.**

Minimální kanonické veličiny:

| Kanonický význam | Příklady zdrojových hlaviček | Poznámka |
|---|---|---|
| Datum, čas, lokalita | `Date`, `DATE`, `Time`, `TIME`, `Site`, `Site Name` | Samostatné metadata každého měření |
| Teplota vody | `Temp_deg_C`, `°C`, `Temp ( °C )`, WTW `Temp` u `Cond` | °C; u WTW předepsaná priorita |
| Specifická vodivost | `SpCond_uS/cm`, `SPC-uS/cm`, `Sp Cond ( µS/cm )`, WTW `Cond` | Provenience/metoda a jednotka musí být explicitní; `C-uS/cm` je jiná varianta |
| Kyslík nasycení | `HDO_%Sat`, `DO %`, `DO ( % Sat )` | % |
| Kyslík koncentrace | `HDO_mg/l`, `DO mg/L`, `DO ( mg/L )`, WTW `Ox` | mg/L |
| Hloubka | `Depth_m`, `DEP m`, `Depth` | m; volitelná korekce |
| pH | `pH_units`, `pH`, `pH ( pH )` | Neslučovat s elektrochemickým signálem `pH mV` |
| ORP | `ORP_mV`, `ORP mV`, `ORP ( mV )` | mV |
| Chlorofyl | `Chl_ug/l`, `Chl ug/L`, `Chlorophyll ( µg/L )` | µg/L; nikoli RFU |
| Zákal | `Turb_NTU`, `NTU`, `FNU`, `Turbidity ( FNU )` | Metodu a jednotku zachovat; neztotožnit NTU/FNU bez ověřeného pravidla |
| Sinice | `BGA-PC ug/L`, případně další kanály | Ověřit cílový význam `BGA` Praha |
| Doplňkové veličiny | `air_temperature_c`, `transparency_m`, `flow` aj. | Vyplňuje uživatel; jednotky zobrazovat explicitně |

Pokud je parametr numerický, ale nemá potvrzené mapování do LabSystemu, zůstává interně dostupný a viditelný v Data/detailu. Export jej nevkládá do libovolného sloupce naslepo.

---

## 4. Validace a chybové stavy

**VAL-01 – Tři úrovně:** `error` (blokující), `warning` (vyžaduje pozornost), `info` (informace o transformaci). Každý problém má kód, `measurementId` nebo zdrojový řádek, pole, popis a případně návrh nápravy.

**VAL-02 – Typy:** neplatné číslo/datum/čas, kolidující senzory, neznámá jednotka, nepovolený převod, chybějící údaje pro export, neplatné rozsahy. Rozsahy pro odborné výjimky řešit konfigurovatelnými pravidly; bez odborného schválení nevymýšlet libovolné numerické limity.

**VAL-03 – Záporná hloubka:** buď explicitní importní korekce na nulu pro **všechny** záporné hodnoty, nebo zachování původní hodnoty s upozorněním. Nedělat nezdokumentovanou automatickou korekci.

**VAL-04 – Volitelná pole:** u některých legitimních záznamů (např. směsných/ručních) může chybět čas. Chybějící čas proto obecně není důvodem ke ztrátě měření. Povinnost vybraných polí závisí na exportním profilu a pravidlech LabSystemu.

**VAL-05 – Exportní kontrola:** před vytvořením XLSX zkontrolovat vybrané měření, cílové jednotky, povinná pole (zejména číslo vzorku), mapování hodnot a počet řádků. Nepřevádět chybná data na nuly a nedoplňovat „náhradní“ čísla vzorků.

**VAL-06 – Bezpečná importní transakce:** při fatální chybě importu (např. senzorová kolize) nepřidat **žádné** měření z chybného souboru. Ostatní validní soubory v dávce zůstávají samostatně zpracovatelné. Data a pracovní sada z dřívějška se nemění.

---

## 5. Celkové UI/UX – čtyři záložky

Základní desktopový layout je **Tabbed Form / průvodce datovým workflow s chováním tabulkového editoru**, částečně inspirovaný MS Excelem. Záložky **Import**, **Data**, **Pracovní sada**, **Export** jsou trvale dostupné, není nutné postupovat jen dopředu. Změna záložky nesmí sama resetovat stav.

V horní části aplikace: název, záložky, stručné počty naimportovaných záznamů/pracovní sady/varování. V tabulkách: hlavička, panel nástrojů, zamrazený výběrový/identifikační sloupec, horizontální posuv, čitelné jednotky u sloupců, stavový řádek s počty.

### 5.1 Záložka Import

- Výběr nebo přetažení jednoho či více souborů.
- Pod ním **dynamický sumář** po souborech: název, typ, počet nalezených měření, parametry, rozpoznané jednotky, upozornění/chyby, stav.
- Importní volby z § 3.2 pro každý relevantní soubor; možnost odstranit soubor z čekající dávky.
- Primární tlačítko **Načíst data**: bezpečně zpracuje připravené soubory, doplní Data a přepne na záložku **Data**.
- Po návratu do této záložky může uživatel načíst **další** soubory; již existující Data/Pracovní sada zůstávají zachována.

### 5.2 Záložka Data

- Kompletní přehled **všech normalizovaných záznamů**, včetně měřených hodnot, metadat a rozšířených parametrů; tabulka pouze pro čtení.
- První sloupec: checkbox výběru. Další: identifikace, datum, čas, lokalita, měřené hodnoty, doplňkové/ostatní údaje. Velké množství sloupců řešit posuvem a volbou viditelnosti.
- Hledání, filtrování, řazení podle libovolného podporovaného parametru, přepnutí viditelnosti jednotlivých sloupců. Numerické sloupce se řadí numericky, datum a čas chronologicky, text přirozeně.
- Označování: obyčejný klik na checkbox přepíná řádek; **Shift + klik** označuje souvislý rozsah mezi kotvou a cílem v **aktuálně zobrazeném, filtrovaném a seřazeném seznamu**; **Ctrl + klik** jednotlivé řádky přidává/odebírá. Výběr je množina `measurementId`, nikdy indexů řádků.
- „Vybrat vše“ vybírá **aktuálně filtrované** záznamy, ne skryté mimo filtr. Uvádět počet celkem označených i počet viditelných. Změna filtru/řazení nesmí změnit to, *která ID* byla vybrána.
- Tlačítko **Přidat vybrané do pracovní sady**. Pokud výběr obsahuje ID již v Pracovní sadě, **zrušit celou akci** a vysvětlit proč. Přidané záznamy v Data vizuálně označit.

### 5.3 Záložka Pracovní sada

- Tabulka z nezávislých snapshotů; zobrazovat jen praktické sloupce a připravené doplňkové parametry, **bez zbytečných systémových metadat**. Úplný detail je dostupný zvlášť.
- Základní viditelné skupiny: číslo vzorku, datum, čas, lokalita, hloubka, teplota vody, O₂, vodivost, pH, doplňkové parametry (průhlednost, průtok, teplota vzduchu). Viditelnost individuálně nastavitelná.
- Filtrování, řazení, výběr a nastavení viditelnosti sloupců jako v Data. Řazení mění **jen pohled**, nikoli identitu či stabilní pořadí pracovní sady.
- Stavový řádek: počet všech, zobrazených, označených, varování, indikátor aktivní editace/nepotvrzených změn.

**Režim A – běžná práce:**

- **Doplňkové parametry jsou vždy editovatelné přímo v tabulce**, bez přepínání režimu (např. číslo vzorku, průhlednost, průtok, teplota vzduchu a další definované doplňkové položky).
- **Původní naměřené hodnoty a původní metadata** jsou v tabulce mimo režim hromadné editace zamčené.
- Editace jednotlivé doplňkové buňky se bezpečně potvrdí (např. Enter/opustit buňku), Escape vrátí předchozí hodnotu; při neplatném vstupu se změna neaplikuje. Neměnit tabulku Data.

**Režim B – Detail záznamu:**

- Tlačítko **Editovat** otevře **samostatný modální dialog** úplného záznamu. Při označení více měření se otevře **první označené v aktuálním pořadí zobrazení**.
- V detailu jsou editovatelné veškeré uživatelské hodnoty a metadata (včetně původních měřených veličin), nikoliv `measurementId` ani systémová surová provenience.
- Tlačítka **Uložit / Storno**; změny se projeví ve snapshotu pouze po Uložit, Storno je zahodí.

**Režim C – Hromadná editace v tabulce:**

- Tlačítko **Hromadná editace** otevře režim jen pro **aktuálně označená měření** a odemkne u nich všechny zobrazené uživatelsky editovatelné sloupce (včetně původních dat). Ostatní řádky zůstanou uzamčené.
- Změny se drží ve **dočasném draftu**, dokud uživatel nepotvrdí uložení.
- Opětovné stisknutí téhož tlačítka zobrazí **Uložit změny / Zahodit změny / Pokračovat v editaci**. Stejná ochrana se použije při pokusu změnit záložku, řazení, filtr, výběr, přejít na export nebo spustit kolidující akci.
- Při Uložit proběhne validace a teprve poté atomické propsání draftu do Pracovní sady; při Zahodit se obnoví předchozí snapshoty. Nepoužívat změny přenášené průběžně do původních Data.

**Akce nad pracovní sadou:**

| Akce | Chování |
|---|---|
| **Nový vlastní záznam** | Založí prázdné měření s novým `measurementId`; vloží **na konec sady** nebo **pod první označený**; nabídne detail/editaci |
| **Směsný vzorek** | Ze **dvou či více** označených měření vytvoří nový vypočítaný záznam **před prvním z označených**; viz § 6 |
| **Odebrat** | Po potvrzení odstraní označené snapshoty; importované originály zůstanou v Data |
| **Editovat** | Otevře úplný detail prvního označeného záznamu |
| **Hromadná editace** | Zapíná/vypíná transakční editační režim |
| **Export** | Přejde na záložku Export; může předat aktuální výběr jako předvolený rozsah |

Pro stabilní vkládání řádků držet interní `workingOrder` nezávislé na aktuálním řazení. Při vložení během aktivního řazení ukázat informaci a přepnout tabulku na **ruční pořadí**, aby byl nově vložený řádek skutečně viditelný na očekávaném místě.

### 5.4 Záložka Export

- Volba profilu: **ČB** nebo **Praha**.
- Rozsah: **všechna měření pracovní sady** nebo **aktuálně vybraná**; před exportem jednoznačně zobrazit počet a identifikace výběru. Výchozí nastavení: celá Pracovní sada.
- Náhled přesné výstupní hlavičky a prvních/posledních řádků, včetně výsledných jednotek a prázdných hodnot.
- Validace cílového souboru: číslo vzorku, chybějící/nesprávně mapované parametry, nepovolené jednotky, neuzavřený režim editace.
- Možnost zvolit název souboru. Stažení lokálně do prohlížeče; pokud podporuje bezpečný dialog volby umístění, lze jej nabídnout, jinak použít standardní stažení (nepředstírat přístup k libovolné cestě na disku).
- Exportuje se **aktuální Pracovní sada**, nikdy původní Data.

---

## 6. Výpočet směsného vzorku

**MIX-01 – Vstup:** nejméně dva označené snapshoty v Pracovní sadě. Před výpočtem dialog: „Vytvořit směsný vzorek z N vybraných měření?“

**MIX-02 – Datum a lokalita:** `Date` a `Site` musejí být ve vybraných záznamech shodné; při neshodě operaci zastavit s vysvětlením (uživatel může nejprve opravit údaje). `Time` převzít z **prvního vybraného měření ve stabilním pracovním pořadí**, nikoli podle právě zapnutého řazení na obrazovce.

**MIX-03 – Agregace:**

- Běžné odborně agregovatelné **numerické měřené parametry**: aritmetický průměr dostupných platných hodnot, se stejnou vahou pro každé měření.
- `pH`: **speciální výpočet přes vodíkové ionty**, nikoli aritmetický průměr čísel pH:

  \[
  pH_{mix}=-\log_{10}\left(\frac{1}{n}\sum_{i=1}^{n}10^{-pH_i}\right)
  \]

  `n` = počet **platných dostupných** hodnot pH. Kontrolní příklad `pH = 7` a `pH = 8` dává přibližně **7,259637…** (zobrazení může zaokrouhlovat, model zachová přesnost).
- **Neprůměrovat `Depth` ani `sampleNumber` (`vz` / `VZOREK`)**; výsledné hodnoty ponechat prázdné a editovatelné. Totéž platí pro identifikační/systémová metadata, textové poznámky a veličiny bez schválené agregace. Vzorový pražský „směsný-PH“ může mít hloubku vyplněnou, ale MVP ji **nesmí automaticky dopočítat**.
- Pokud pro parametr nejsou žádné platné hodnoty, ponechat jej prázdný; nevkládat nulu. Chybějící hodnoty nezapočítávat do jmenovatele.
- Nevytvářet průměr ze vzájemně nekompatibilních jednotek bez schváleného převodu.

**MIX-04 – Výsledek:** nová samostatná entita `originType = calculated` s vlastním novým `measurementId`, `calculation.sourceMeasurementIds`, zvolenými metodami a počty vstupních hodnot. Vložit **před první vybrané měření** ve stabilním pořadí. Původní záznamy neměnit. Výsledek lze dále plně editovat a exportovat.

**Odborná hranice interpretace:** Výpočet přes průměr koncentrací H⁺ je požadovaný agregační algoritmus. Nemusí se rovnat skutečnému pH fyzicky smíchaných pufrovaných vod, protože výsledné pH závisí i na alkalitě a acidobazických rovnováhách. V UI jej označovat např. „agregované pH (průměr přes H⁺)“, nikoli jej vydávat za laboratorní simulaci směsi.

---

## 7. Výstupní profily XLSX – přesné kontrakty

Pro export nepoužívat automaticky generované překlady názvů; pořadí, velikost písmen, znaky a formát hlaviček jsou součástí integrace s LabSystemem. Systém musí umět **dva samostatné profily**, nikoliv jediný profil s náhodně přepínanými sloupci.

### 7.1 Profil „LabSystem ČB“

**Vzor:** `EXPORT_VZOR_2026-02-04 B01 exo3 ric.xlsx`, list **`LabSys_Export`**. Původní vzor má **12** hlaviček v řádku 1. Podle nového produktového rozhodnutí se do MVP **přidávají `Date` a `Time` na konec**.

**Výsledná hlavička MVP – přesně 14 sloupců:**

```text
VZOREK | TEMP | COND | DO_% | DO_CONC | DEPTH | PH | CHLOROPHYL | ORP | TEMPA | TRANSP | FLOW | Date | Time
```

| Sloupec | Význam / mapování |
|---|---|
| `VZOREK` | Textové číslo vzorku `sampleNumber` |
| `TEMP` | Teplota vody °C |
| `COND` | Vodivost v **mS/m**; příslušné mapování a metoda dle importéru |
| `DO_%` | Nasycení kyslíkem v % |
| `DO_CONC` | Koncentrace kyslíku mg/L |
| `DEPTH` | Hloubka m |
| `PH` | pH |
| `CHLOROPHYL` | Chlorofyl v odpovídající hmotnostní jednotce, ověřit zdrojový kanál |
| `ORP` | ORP mV |
| `TEMPA` | Doplňková teplota vzduchu (°C) |
| `TRANSP` | Doplňková průhlednost (m) |
| `FLOW` | Doplňkový průtok; **OVĚŘIT** cílovou jednotku / mapování v LabSystem |
| `Date` | Datum daného měření, nově přidaný sloupec |
| `Time` | Čas daného měření, nově přidaný sloupec |

**Integrační poznámka:** Uživatelský plán je nastavit v LabSystemu mapování nových `Date`/`Time`; pokud je LabSystem neumí mapovat, předpokládá se jejich ignorování, **ale toto je potřeba otestovat**. Při nemožnosti importu 14 sloupců bude nezbytné dohodnout kompatibilní variantu; neodstraňovat je potichu z definovaného MVP profilu.

### 7.2 Profil „LabSystem Praha“

**Vzor:** `Slapy_10_8_2026imp.xlsx`, list `exobackup-260810-133932`. V prvním řádku je **14 pojmenovaných** sloupců A–N a **nepojmenovaný** sloupec O s textovým popisem odběru.

**Výsledná hlavička MVP – přesné názvy A–N + prázdná O:**

```text
Date | Time | Site | Temp | DO % | DO Conc | SpCond | pH | ORP | Turbidity+ | BGA | ch-isy | Depth | vz | [prázdná hlavička]
```

| Sloupec | Význam / mapování |
|---|---|
| `Date` | Datum měření / vzorku |
| `Time` | Čas měření; může být prázdný |
| `Site` | Lokalita |
| `Temp` | Teplota vody °C |
| `DO %` | Nasycení O₂ % |
| `DO Conc` | Koncentrace O₂ mg/L |
| `SpCond` | Specifická vodivost, ve vzoru hodnoty kolem desítek; **OVĚŘIT** jednotku očekávanou LabSystemem, pravděpodobně mS/m |
| `pH` | pH |
| `ORP` | ORP mV |
| `Turbidity+` | Zákal; **OVĚŘIT** metodický význam a jednotku (NTU/FNU nepokládat automaticky za ekvivalentní) |
| `BGA` | Sinicový parametr; **OVĚŘIT** kanál / jednotku proti sondě |
| `ch-isy` | Chlorofylový parametr; **OVĚŘIT** kanál / jednotku proti sondě |
| `Depth` | Hloubka m |
| `vz` | Textové číslo vzorku, včetně hodnot jako `K 4353` |
| sloupec `O` bez hlavičky | Volitelný slovní popis odběru; zachovat prázdnou buňku hlavičky, nikoli vytvářet název `Unnamed: 14` |

**Specifika ověřeného vzoru:** 125 řádků s číslem vzorku a čtyři prázdné oddělovací řádky bez čísla vzorku; objevuje se kontrolní záznam `K 4353` a směsné záznamy označené v popisu `směsný-PH`. **V našem exportu se žádné umělé oddělovací řádky nevytvářejí.** Žádná nulová vodivost jako separator; výsledný list obsahuje hlavičku a pouze exportovaná měření. Je předpoklad, že LabSystem řádky bez čísla vzorku ignoruje, ale toto tvrzení není pro nové řešení potřeba využívat ani považovat za ověřené.

### 7.3 Společná exportní pravidla

- Formát XLSX, jeden cílový datový list pro zvolený profil, bez uměle doplněných oddělovacích řádků a bez dalších datových sloupců mimo zvolený kontrakt.
- Rozvržení výstupu podle **stabilního pořadí Pracovní sady**, nikoli implicitně podle momentálního vizuálního řazení. Uživatel musí před exportem vidět výsledné pořadí v náhledu.
- `sampleNumber` exportovat jako **text**, včetně případných mezer a počátečních nul. Výstupní čísla zapisovat jako numerické hodnoty, nikoli jako lokalizovaný text s desetinnou čárkou.
- Datum a čas zapisovat v cílovém XLSX konzistentně a správným datovým typem/Excel formátem; ověřit čtení v LabSystemu. Nesmí docházet k posunu dne vlivem časové zóny.
- Prázdné hodnoty zapisovat jako **prázdné buňky**, ne nuly, pomlčky ani string `null`.
- Nezaokrouhlovat hodnoty v modelu při mezikrocích. Zobrazení v UI může mít omezenou přesnost; exportní přesnost nastavit podle cílových požadavků a testů.
- Před exportem vyžadovat správné cílové jednotky; žádné tiché přepočty nebo převzetí hodnot s nesprávným štítkem.
- Textové hodnoty zapisovat jako **data**, nikoli spustitelné Excel vzorce (ochrana proti formula injection); bezpečně zobrazovat také HTML obsah hodnot/poznámek.
- Zachovat výstupní profily deklarativně (mapovací konfigurace), aby bylo možné později přidat další laboratoř bez přepsání importérů.

---

## 8. Výběry, řazení, filtrování a stav aplikace

**UI-01 – Výběr přes ID:** množina vybraných `measurementId`; nikdy neindexovat výběr podle pořadí řádku. Shift rozsah počítat nad aktuálně viditelným a seřazeným seznamem, kotva výběru má definované ID. Po změně filtru stávající výběr zůstává, ale UI transparentně uvádí vybrané skryté záznamy.

**UI-02 – Řazení:** klik v hlavičce přepíná vzestupně / sestupně / výchozí pracovní pořadí. Řazení numerické, textové a datumové podle typu veličiny. Chybějící hodnoty mít konzistentně na konci.

**UI-03 – Filtry:** minimálně textové hledání a jednoduchý filtr hodnot/rozmezí podle zvolených sloupců. Používat konzistentně v Data i v Pracovní sadě.

**UI-04 – Zobrazení:** volba viditelných sloupců nikdy nemaže hodnoty. Identifikační sloupec a checkbox mají zůstat přehledně dostupné při horizontálním posuvu.

**UI-05 – Zákaz skryté ztráty:** změny přímé editace doplňkových buněk bezpečně potvrdit; draft detailu a hromadné editace nesmí být zahozena navigací bez volby Uložit/Zahodit/Pokračovat.

**UI-06 – Volatilní relace:** stav pouze lokálně v paměti prohlížeče; obnovení stránky či zavření může znamenat ztrátu práce. Zřetelně upozornit na tento režim a dle možností prohlížeče varovat při odchodu, jsou-li neexportované změny. Nepředstírat garantovanou obnovu po restartu prohlížeče.

---

## 9. Technologické hranice a požadavky na implementaci

- **Frontend:** HTML, CSS, vanilla JavaScript; jednoduchý modulární kód. **Vite** je přípustný pro sestavení a lokální vývoj. **Nenasazovat React automaticky.**
- **Hosting:** Vercel pro statickou klientskou aplikaci; žádný backend, databáze ani upload dat na server. Zpracování importovaných souborů probíhá v prohlížeči.
- **XLSX/CSV:** volba malé, dlouhodobě udržované knihovny pro XLSX a vhodného parseru CSV/TSV je na PLAN fázi; doložit podporu UTF-16, Windows-1252, proměnlivých hlaviček a Excel datových buněk. Nestavět nadbytečný framework kvůli editoru.
- **Vrstvy:** `import adapters` → `normalization + parameter registry` → `validation` → `source store` → `working snapshot store` → `UI` / `calculations` → `export profiles`.
- **Bezpečnost:** žádné vzdálené odesílání laboratorních dat, žádný skrytý analytics upload, kontrola názvů a obsahu XLSX, bezpečné vykreslování buněk.
- **Udržovatelnost:** centrální mapování parametrů a výstupních profilů, minimum duplicit kódu, jednoduché a čitelné API modulů. Nepřidávat komplikovanou persistenci, komplexní synchronizaci ani zbytečné abstrakce.
- **Git:** smysluplné commity s českými commit message; implementace po end-to-end makroblocích, ne stovkách mikroúkolů.
- **Autonomie:** Claude Code může autonomně řešit lokální technické detaily a doplňovat testy; nepřepisovat záměrně produktová pravidla kvůli snazší implementaci. Při opakujících se regresích zastavit cyklus a navrhnout jednodušší architekturu.

### 9.1 Orientační implementační makrobloky

1. **A – Datové jádro:** formáty/parse → normalizace → jednotky/validace → stabilní identity + sady testů na všech pěti souborech.
2. **B – UI a snapshoty:** záložky, importní dialog, tabulky Data/Pracovní sada, výběr, řazení/filtry, snapshoty, editace, přidání/odebrání, ochrana draftů.
3. **C – Výpočty, export, dokončení:** směsný vzorek, profily ČB/Praha, náhled a export XLSX, akceptační testy, build a Vercel preflight.

Před implementací vytvořit konkrétní PLAN, ověřit soubory a identifikovat případné skutečné blokery. V průběhu vždy dodávat funkční vertikální celek s testy.

---

## 10. Akceptační testy / definition of done

| ID | Test | Očekávaný výsledek |
|---|---|---|
| AT-01 | Import všech pěti poskytnutých vstupů | **17 + 29 + 32 + 170 + 5 = 253** měření, bez ztráty dat či opakovaných hlaviček jako měření |
| AT-02 | Android YSI s proměnnými hlavičkami | Každý datový řádek je interpretován podle vlastní blokové hlavičky |
| AT-03 | WTW, jedno ID a 3 senzorové řádky | Jeden výsledný záznam; teplota ze senzoru `Cond`, ostatní teploty dohledatelné |
| AT-04 | Umělý YSI řádek se dvěma platnými `DO mg/L-<sensorId>` | Soubor odmítnut jako celek; hlášení o kolidujícím parametru a senzorech |
| AT-05 | Importní volba `µS/cm → mS/m` | Např. 261,6 → **26,16**, současně správná jednotka a provenience; bez dvojí konverze |
| AT-06 | Importní volba záporné hloubky | Např. −0,006 m → **0 m** při zapnuté volbě; při vypnuté zůstane −0,006 m |
| AT-07 | Přidání do Pracovní sady | Úplný deep snapshot; Data se po následné editaci pracovní kopie nezmění |
| AT-08 | Odebrání a nové přidání stejného ID | Obnovení původních normalizovaných hodnot, nikoli dřívějších úprav |
| AT-09 | Přidání výběru obsahujícího již přidané ID | Celá operace se zruší, pracovní sada zůstane nezměněna |
| AT-10 | Nový vlastní záznam | Nové ID, prázdné uživatelské hodnoty, možnost všechna pole vyplnit a exportovat |
| AT-11 | Běžná editace v Pracovní sadě | Doplňkové buňky lze editovat ihned; originální měřené hodnoty nikoli |
| AT-12 | Detail záznamu | Všechny uživatelské hodnoty editovatelné; ID nelze změnit; Storno nic nepropíše |
| AT-13 | Hromadná editace + Storno | Odemknou se jen označené řádky; Zahodit vrátí původní pracovní hodnoty, Uložit aplikuje změny |
| AT-14 | Shift/Ctrl výběr, filtrování, řazení | Výběr sleduje ID; přerovnání nemění vybraná měření; „Vybrat vše“ respektuje filtr |
| AT-15 | Směsný vzorek ze dvou pH 7,0 a 8,0 | Agregované pH cca **7,259637**, žádné aritmetické 7,5; nové ID a vazba na zdrojová ID |
| AT-16 | Směsný vzorek, Depth a vz | Zůstanou prázdné; Date/Site shodné, Time z prvního ve stabilním pořadí |
| AT-17 | EUREKA Annotation → číslo vzorku | Volitelná kopie, nedestruktivní; nedojde k implicitnímu přepsání existujícího čísla |
| AT-18 | Export ČB | Hlavička **14 přesných sloupců** včetně `Date`, `Time`; pouze měření pracovní sady |
| AT-19 | Export Praha | 14 přesných názvů A–N, prázdná hlavička O, popis v O, textový vzorek typu `K 4353` |
| AT-20 | Export bez umělých separátorů | Počet datových řádků XLSX přesně odpovídá počtu exportovaných měření |
| AT-21 | Opakovaný import nového souboru | Původní Data a Pracovní sada zůstávají zachovány, nová měření se přidají |
| AT-22 | Pokus načíst identický soubor podruhé | Duplicitní import je zablokován bez vytvoření nových záznamů |
| AT-23 | Vypnutá konverze vodivosti | Hodnoty s původní jednotkou nejsou falešně vydávány za mS/m; export kontroluje kompatibilitu |
| AT-24 | Neúplné časové údaje / kontrolní vzorek | Záznam bez Time lze zpracovat, `K 4353` zůstává textem |
| AT-25 | Návrat do záložky během editačního draftu | Nedojde k tichému zahození změn; dialog Uložit / Zahodit / Pokračovat |
| AT-26 | XLSX bezpečnost a validace | Prázdné buňky nejsou nuly, datum/čas bez posunu, text nevytváří Excel vzorce |

**Definition of done:** běží lokálně (`npm run dev` či ekvivalent), úspěšný produkční build, automatické testy příslušných pravidel, ručně projitý hlavní workflow na desktopu, generované oba XLSX profily a známá integrační omezení zdokumentovaná. **Skutečná akceptace LabSystemem** je samostatný integrační UAT krok na straně laboratoře; test v prohlížeči jej nenahrazuje.

---

## 11. Otevřené body k ověření (bez nekontrolovaného domýšlení)

1. **LabSystem ČB + `Date`/`Time`:** zda mapuje nové sloupce nebo je bezpečně ignoruje, jakou očekává reprezentaci data/času.
2. **LabSystem Praha – `SpCond`:** přesná cílová jednotka a potvrzení mapování z vodivosti sondy (ve vzoru jsou typicky hodnoty ~26; hodnoty samotné nejsou dostatečným důkazem jednotky).
3. **Praha – `Turbidity+`, `BGA`, `ch-isy`:** přesný zdrojový kanál, jednotky a případné rozdíly metody FNU/NTU či RFU/µg/L. Nevymýšlet převod, který není odborně potvrzen.
4. **Praha – sloupec O:** potvrdit, že při cílovém importu má zůstat **bez hlavičky** a zda záleží na názvu listu. Pro MVP vycházet doslova ze vzoru.
5. **ČB – `FLOW` a případné doplňkové jednotky:** potvrdit mapování/průtokovou jednotku; UI ji má zobrazovat a nesmí ji odhadovat.
6. **Čísla vzorků:** potvrdit, že LabSystem ČB i Praha správně přečtou textové identifikátory (včetně kontrolních `K 4353` a případných počátečních nul).
7. **Rozsahy odborných validačních pravidel:** základní validace je implementovatelná; přesné oborové limity a další výjimky budou přidávány postupně.
8. **Přesnost a formát exportu:** číselné formátování/zaokrouhlení podle požadavků LabSystemu ověřit na skutečně importovaných XLSX, nepodřezávat přesnost už v interním modelu.

Položky **1–8** mají být evidované jako konkrétní integrační/oborové úkoly; základní aplikaci mohou umožnit vytvořit bez blokace, ale nesmějí být prezentovány jako fakticky ověřená kompatibilita. Claude Code nesmí bez výslovného schválení provést nevratné či metodicky sporné mapování.

---

## 12. Podklady a interpretace jejich role

| Soubor | Role |
|---|---|
| `EUREKA_PLZ_BelskyMlyn 3.4.25.csv` | Vstupní vzor EUREKA, `Annotation` a GPS |
| `ISY_ANDROID_CB_Kor Measurement File Export - 033126085850.csv` | Vstupní vzor Android YSI, blokové hlavičky |
| `ISY_CB_jorKorEXO Measurement File Export - 032426 135022.csv` | Vstupní vzor YSI ČB, identifikátory senzorů |
| `ISY_PRH_exobackup-260330-142128.csv` | Vstupní vzor YSI Praha, datum/čas/lokality |
| `WTW_CB_wtw 24.3.2026.xlsx` | Vstupní vzor WTW, pivot více senzorových řádků |
| `EXPORT_VZOR_2026-02-04 B01 exo3 ric.xlsx` | **Výstupní vzor ČB**: důležitý list `LabSys_Export`; ostatní listy ilustrují dosavadní pracovní postup |
| `Slapy_10_8_2026imp.xlsx` | **Výstupní pracovní vzor Praha**: 14 pojmenovaných sloupců + textový O, směsné a kontrolní vzorky |

**Poznámka k pražskému souboru:** obsahuje také čtyři oddělovací řádky s nulovou vodivostí bez čísla vzorku. Jde o vlastnost starého pracovního XLSX, **nikoli** požadavek HydroBiol3 na tvorbu takových řádků. Přímou kompatibilitu výsledného exportu s LabSystemem je nutné testovat.

---

## 13. Pravidla pro Claude Code při převzetí

1. **Nejprve PLAN.** Před programováním porovnat tuto specifikaci s reálnými soubory, identifikovat shodné a odlišné hlavičky, přesně odvodit mapování, návrh datového modelu a testovací strategii.
2. **Maximálně tři implementační makrobloky**, podle § 9.1. Dodat funkční celky a po každém základní UAT.
3. **Nepřetěžovat aplikaci** frameworkem, databází, účty, serverem, persistencí ani komplikovanými obecnými konfigurátory.
4. **Neslévat různé fyzikální veličiny a nemařit původní data.** Všechny konflikty/nejistoty pojmenovat a otestovat.
5. **Dodržet identitu a snapshoty.** Kritické invarianty DATA-02 až DATA-07 musí mít automatické testy.
6. **Vizuální orientace na PC**, tabulka podobná Excelu, čtyři záložky, vysoce použitelná hromadná práce.
7. **Průběžně ověřovat reálné exporty**, ne pouze objektové struktury v paměti. Výsledná XLSX znovu načíst testem a ověřit hlavičky, datové typy i počty řádků.
8. Při opakovaném návratu stejného problému zastavit opravný cyklus a navrhnout jednodušší technickou variantu.

**Výstup následujícího kroku:** plán architektury, konkrétní mapovací tabulky všech pěti importérů a dvou exportů, struktura projektu, rozdělení makrobloků, testy a seznam skutečně blokujících nejasností. Implementaci zahájit až po revizi plánu.
