# Memoriál československých parašutistů 2026 – Interaktivní analýza výsledků

Detailní, zábavná a interaktivní webová analýza oficiální výsledkové listiny ročníku **2026** (7. 11. 2026, Letiště Chrudim, ~70 km, limit 18 hodin, pocta **pplk. Josefu Mašínovi** z cyklu *Tři králové*).

🌐 **Živá stránka (GitHub Pages):** https://michalbcz.github.io/memorial-parasutistu-2026/

## Souhrn dat z oficiální listiny
- **Odstartovalo:** 370 hlídek
- **Dokončilo (`a`):** 294 hlídek (úspěšnost 79,5 % ≈ 80 % v hlavičce PDF; 292 s časem + 2 bez času)
- **V limitu ≤ 18:00:** 237 hlídek
- **Nad limit > 18:00:** 55 hlídek
- **Nedokončilo (`x` / DNF):** 76 hlídek (včetně anomálie `#347 SEPO 224` se zapsaným časem `14:27`)
- **Nedorazilo (`n`) + neobsazeno:** 35 jmenovaných `n` + 4 neobsazená čísla (`225, 261, 314, 320`) + prázdný řádek `410` = 40
- **Nejrychlejší tým:** `#407 Bleskový přesun` (výsadek Zulu) – **10:41** (6,55 km/h)
- **Průměrný / mediánový čas:** **16:45** / **17:00**

## Struktura projektu
- `index.html`, `styles.css`, `app.js` – Statický interaktivní web (taktická karta týmu, duel na trati, simulátor noci, interaktivní grafy Chart.js, forenzní audit, kompletní tabulka všech 409 čísel).
- `build_data.py` – Generátor a validátor datového modelu (`data.js` a `vysledky_2026.csv`).
- `Vysledkova_listina_2026.pdf` – Originální stažená oficiální výsledková listina.
- `vysledky_2026.csv` – Čistý CSV export všech 409 řádků.
