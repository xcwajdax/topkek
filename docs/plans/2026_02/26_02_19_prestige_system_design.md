# System prestiżu – dokument designu

**Data:** 2026-02-19  
**Status:** Zatwierdzony

---

## 1. Cel i zakres

- **Hard reset (Reset Game):** bez zmian – pełne wyzerowanie save, reload. Prestige też jest usuwane.
- **Prestige (soft reset):** zerowanie całego stanu gry poza **prestige progress**; punkty zdobywane w momencie resetu (formuła od B/S); bonusy z levelu; w przyszłości punkty do wydawania na bonusy.
- **Wygrana:** jeden wspólny Prestige odblokowany przez **dowolny** warunek końca gry (9 Supreme Court **lub** Epstaina na Marsie **lub** wywołanie wojny). Po pierwszej wygranej `prestige.unlocked = true` na stałe.

---

## 2. Stan prestiżu (prestige progress)

**Obiekt `prestige` w GameStore (oraz w save/load):**

| Pole | Typ | Opis |
|------|-----|------|
| `level` | number | Liczba wykonanych prestiżów (0, 1, 2, …). |
| `totalPrestigePoints` | number | Suma punktów zdobytych we wszystkich runach (statystyka). |
| `prestigePoints` | number | Dostępne punkty do wydania (rosną przy każdym Prestige; w przyszłości spadają przy kupnie bonusów). |
| `spentPrestigePoints` | number | (Opcjonalnie) Łącznie wydane punkty; na start 0. |
| `bonuses` | object | `apsMultiplier`, `apcMultiplier`, `costReduction` – obliczane z levelu (i w przyszłości z wykupionych bonusów). |
| `unlocked` | boolean | Czy kiedykolwiek spełniono warunek wygranej; po pierwszej wygranej na stałe `true`. |

**Persistence:** `prestige` zapisywany w `saveGame()`, wczytywany w `loadGame()`. Przy hard resecie cały save jest usuwany. W init/state.js musi istnieć **domyślny** obiekt `prestige` (level 0, prestigePoints 0, unlocked false, bonuses 1/1/0), żeby brak klucza w starym save nie psuł gry.

---

## 3. Lista resetu przy Prestige

Przy Prestige zerowane / przywracane do stanu początkowego (jedna funkcja, np. `resetStateForPrestige()`):

- Zasoby: `suppressedActs`, `actsPerSecond`, `clickPower`, `politicalSupport`, `lastUpdateTime`, `lastSupportEventTime`, `supportDebuffTimer`
- `buildings`, `upgrades`, `augments` – count/cost/unlocked jak na start
- `itemLifetimeProduction`, `itemLifetimeClicks`, `purchaseStacks`
- `achievements`, `quests` (w tym questStates; `prestigeUnlocked` w questach ustawiane na true dopiero po ponownym spełnieniu wygranej w nowym runie)
- `characters`, `selectedHeads`, `characterClickCooldown`
- Systemy late-game: `caveSystem`, `marsSystem`, `dogeSystem`, `ballroomSystem`, `tlaSystem` oraz ewentualne inne (propaganda, tower itd.) – stan początkowy
- Flagi: `creatorMessageSeen`, `earlyGameThresholdReached`, `tutorialChoiceMade`, `performanceOverlayEnabled` (np. tutorialChoiceMade → false)
- Stan combo / damage control (jeśli w state) – stan początkowy

**Nie zerujemy:** `prestige`; opcjonalnie ustawienia dźwięku (jeśli w tym samym save).

Po resecie: `saveGame()` z zaktualizowanym `prestige` i wyzerowanym stanem, następnie `location.reload()`.

---

## 4. Warunki wygranej i odblokowanie Prestige

**Centralna funkcja:** `checkVictoryConditions()` – zwraca np. `{ anyVictory, supremeCourt, marsEpstaina, warTriggered }`.

**Warunki (na start):**
1. **Supreme Court:** `upgrades['supreme_court_justice.09'].count >= 9`
2. **Epstaina na Marsie:** `marsSystem.epstainaFounded === true`
3. **Wywołanie wojny:** flaga w state (np. `warTriggered === true`), ustawiana gdy seria eventów doprowadzi do zakończenia „wojna” (seria eventów: wojna vs wielkie zyski – poza zakresem tego designu; tylko flaga + wywołanie `checkVictoryConditions()` w momencie ustawienia)

**Wywołanie:** po zakupie upgrade’u (dla supreme_court_justice.09), po ustawieniu epstainaFounded w module Mars, po ustawieniu flagi wojny. Jeśli `anyVictory === true`: ustaw `prestige.unlocked = true`, opcjonalnie pokaż modal wygranej, zapisz grę.

**Quest 06:** odblokowanie prestiżu może dalej ustawiać `quests.prestigeUnlocked` dla UI; bramką do przycisku Prestige jest `prestige.unlocked` z `checkVictoryConditions()`.

---

## 5. Punkty prestiżu (zaawansowana formuła B/S)

**Źródło:** tylko budynki (B) i ulepszenia (S) w momencie Prestige.

- **Budynki:** dla każdego z `count > 0`: waga od `baseCost`, np. `pointsPerUnit = floor(log10(1 + baseCost) * MULT_B)`; opcjonalnie cap per building type. Suma po `count * pointsPerUnit`.
- **Ulepszenia:** analogicznie z `MULT_S` i opcjonalnym capem.

**Config (config.js):** `PRESTIGE.BUILDING_MULT`, `PRESTIGE.UPGRADE_MULT`, opcjonalnie `PRESTIGE.CAP_PER_ITEM`. Ewentualnie formuła oparta na tierze (tablice wag).

**Wynik:** `prestigePointsEarned = buildingPoints + upgradePoints`; dodawane do `prestige.prestigePoints` i `prestige.totalPrestigePoints` przy Prestige.

---

## 6. Bonusy z levelu (obecna faza)

Obliczanie w `applyPrestigeBonuses()` na podstawie `prestige.level`:

- APS: `bonuses.apsMultiplier = min(1 + level * (APS_PER_LEVEL - 1), MAX_APS_MULT)` (np. +10% per level, cap 10)
- APC: `bonuses.apcMultiplier` analogicznie (np. +5% per level, cap 5)
- Koszty: `bonuses.costReduction = min(level * COST_REDUCTION_PER_LEVEL, MAX_COST_REDUCTION)` (np. -2% per level, max 50%)

**Zastosowanie:** w `calculateAPS()` mnożyć przez `prestige.bonuses.apsMultiplier`; w `calculateClickPower()` przez `prestige.bonuses.apcMultiplier`; w obliczaniu efektywnego kosztu B/S przez `(1 - prestige.bonuses.costReduction)`.

**Config:** `APS_MULTIPLIER_PER_LEVEL`, `APC_MULTIPLIER_PER_LEVEL`, `COST_REDUCTION_PER_LEVEL`, `MAX_*`.

W przyszłości: część bonusów z „sklepu” za `prestigePoints`; wtedy `applyPrestigeBonuses()` uwzględnia też wykupione ulepszenia.

---

## 7. Przepływ Prestige i UI

**Przepływ:**
1. Przycisk Prestige (widoczny gdy `prestige.unlocked === true`) → otwiera modal potwierdzenia.
2. Modal: preview punktów (`calculatePrestigePointsFromBS()`), nowy level, aktualne bonusy; Cancel / Prestige Now.
3. Prestige Now: oblicz punkty, zaktualizuj `prestige` (level+1, prestigePoints, totalPrestigePoints), `applyPrestigeBonuses()`, `resetStateForPrestige()`, `saveGame()`, **krótki modal sukcesu** (np. „Earned X Prestige Points! Level Y”), po 2 s lub przycisku – `location.reload()`.

**Hard reset:** bez zmian; czyści save, reload.

**UI:**
- Przycisk Prestige: w Settings w sekcji „Prestige & Influence” obok Reset Game.
- Wyświetlanie: Level, Prestige Points (available), opcjonalnie Total earned, aktualne bonusy (APS/APC/cost).
- Modale: (1) potwierdzenie Prestige, (2) krótki modal sukcesu po Prestige przed reloadem. Opcjonalnie: modal wygranej przy pierwszym `prestige.unlocked`.
- **Kolory:** używać zmiennych zdefiniowanych w projekcie (np. `var(--primary-gold)`, `var(--primary-blue)`, `var(--panel-bg)`, `var(--text-light)`, `var(--font-heading)` z base.css). Style w `css/systems.css` (np. `.prestige-btn`, `.prestige-modal-content`, `.prestige-bonuses`).

---

## 8. Save/Load i integracja

- **saveGame():** zapisać `prestige` (cały obiekt). Ewentualnie `warTriggered` jeśli w tym samym obiekcie stanu.
- **loadGame():** jeśli w save jest `prestige` – ustawić w GameStore, wywołać `applyPrestigeBonuses()`. Nie ustawiać `prestige.unlocked` z questów.
- **Init:** domyślny `prestige` w state.js (level 0, prestigePoints 0, totalPrestigePoints 0, bonuses 1/1/0, unlocked false).
- **Offline / inne serializacje:** dodać `prestige` (i ewentualnie `warTriggered`) do tej samej listy pól co w głównym save/load (zgodnie z save-load-sync).

---

## 9. Przyszłe rozszerzenia

- **Sklep prestiżu:** katalog bonusów z cenami w `prestigePoints`; przy zakupie odejmowanie punktów i uwzględnienie w `bonuses` oraz w calculateAPS/calculateClickPower/koszty.
- **Dodatkowe warunki wygranej:** dopisanie checku w `checkVictoryConditions()` i wywołanie w odpowiednim miejscu.
- **Victory flags:** opcjonalnie trzymać które warunki zostały spełnione (np. do statystyk lub UI).
