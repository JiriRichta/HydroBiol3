# HydroBiol3 – handoff pro Claude Code

Tento balíček obsahuje schválené zadání MVP, design system, vektorové brand assets a 5 vstupních + 2 výstupní XLSX/CSV vzory.

## Struktura
- `docs/HYDROBIOL3_MVP_SPEC.md` – hlavní funkční a datová specifikace.
- `docs/HYDROBIOL3_DESIGN_SYSTEM.md` – návrhová pravidla UI.
- `public/assets/` – SVG logo/symbol, favicon, CSS tokeny.
- `fixtures/input/` – skutečné laboratorní vzory pro ověření importérů.
- `fixtures/export/` – dva referenční výstupní XLSX.

## Bezpečnost
- `fixtures/` považujte za lokální testovací vstupy; bez výslovného oprávnění je NEPŘIDÁVEJTE do Gitu ani nenasazujte na Vercel.
- Vytvořte `.gitignore` zahrnující `fixtures/`, `node_modules/`, `dist/`, `.env*`, tajné soubory a lokální výstupy.
- Pro veřejný repozitář použijte malé syntetické testy bez reálných laboratorních dat.
- Před zpracováním externím AI nástrojem zvažte, zda máte oprávnění sdílet pracovní soubory s tímto poskytovatelem.

## Spuštění plánování
Otevřete kořen složky projektu v PowerShellu, spusťte Claude Code v PLAN režimu a použijte zadání připravené v konverzaci s ChatGPT.
Při interpretaci těchto souborů jsou hlavní zdroje pravdy dva Markdown dokumenty, skutečné soubory slouží k technické validaci.
