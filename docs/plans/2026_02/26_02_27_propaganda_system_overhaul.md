# Plan ulepszenia systemu Propaganda

**Wersja:** 26_02_27

## Kontekst obecnego stanu

- **Propaganda:** [js/propaganda.js](js/propaganda.js), [js/data_propaganda.js](js/data_propaganda.js) – 6 mediów (newspaper → prompt_injection), suwak 9 pozycji (far_left … far_right), efekty od razu po wyborze narracji. Stan: `ownedMedia: [{ id, narrative }]`.
- **Left-panel:** [js/background_layers.js](js/background_layers.js) – `visibilityConfig.type === 'buildings'` z `buildingIds` + `minCount`/`maxCount`. Budynek Propaganda Network nie ma jeszcze warstw w left-panel.
- **Zasady grafik:** [.cursor/rules/building_bg_graphics.mdc](.cursor/rules/building_bg_graphics.mdc) – ścieżka `ASSETS/bgs/AnimBgs/buildings/`, wpisy w `config.js` → `BACKGROUND_LAYERS.buildingLayers`.

---

## 0. Warunek zakupu mediów (min. liczba Propaganda Network)

**Cel:** Każde medium jest odblokowane do zakupu dopiero po osiągnięciu **minimalnej liczby budynków Propaganda Network** (`buildings['propaganda_network.04'].count`).

**Progi (do wpisania w data/config):**

| Medium             | Wymagana liczba Propaganda Network |
| ------------------ | ---------------------------------- |
| Gazeta (Newspaper) | 1                                  |
| Radio              | 10                                 |
| Telewizja lokalna  | 50                                 |
| Telewizja globalna | 100                                |
| Social Media       | 200                                |
| Prompt Injection   | 400                                |

**Implementacja:**

- W [js/data_propaganda.js](js/data_propaganda.js): dla każdego wpisu w `PROPAGANDA_MEDIA` dodać pole `minPropagandaNetworkCount` (lub w config osobna mapa `mediaId → minCount`). Kolejność zakupu pozostaje `PROPAGANDA_MEDIA_ORDER`; dodatkowy warunek: `buildings['propaganda_network.04'].count >= minPropagandaNetworkCount`.
- W [js/propaganda.js](js/propaganda.js):
  - **Następne medium do zakupu:** `getNextMediaToPurchase()` zwraca pierwsze medium z kolejności, które nie jest jeszcze w `ownedMedia` **oraz** dla którego `buildings['propaganda_network.04'].count >= mediaDef.minPropagandaNetworkCount`. Jeśli żadne nie spełnia – zwrócić `null`.
  - **UI:** slot „next to buy” pokazywać tylko gdy jest następne medium (spełnione oba warunki); sloty „locked” dla mediów dalszych w kolejności lub gdy brak wymaganej liczby budynków – z czytelnym komunikatem (np. „Wymaga 10 Propaganda Network”).
  - **Koszt:** `getNextMediaCost()` bez zmian (koszt nadal z definicji następnego medium); przycisk „Buy next media” disabled gdy brak następnego medium lub za mało Acts.
- Opcjonalnie: parametry progów w [js/config.js](js/config.js) (np. `PROPAGANDA_MEDIA_UNLOCK_COUNTS`) z opisem po polsku, a w data tylko odwołanie do tej listy.

---

## 1. Grafika budynku Propaganda w left-panel (ewoluująca)

**Cel:** Jedna wizualnie ewoluująca grafika budynku – wygląd zależy od liczby zakupionych mediów (1 → 6).

**Wymagania:**

- Warstwa widoczna tylko gdy gracz ma budynek **Propaganda Network** (`buildings['propaganda_network.04'].count >= 1`) oraz system propagandy odblokowany.
- Która wersja grafiki: na podstawie **liczby zakupionych mediów** (`propagandaSystem.ownedMedia.length`), np. 1 medium = wersja 1, 2 = wersja 2, …, 6 = wersja 6.

**Implementacja:**

- Dodać w [js/background_layers.js](js/background_layers.js) obsługę `visibilityConfig.type === 'propaganda'` (lub `'propagandaBuilding'`):
  - Warunek widoczności: `buildings['propaganda_network.04'].count >= 1` oraz `propagandaSystem?.unlocked`.
  - Wybór wariantu: `minOwnedMedia` / `maxOwnedMedia` (np. 1–1, 2–2, …, 6–6) na podstawie `propagandaSystem.ownedMedia.length`; wyświetlana warstwa = ta, której zakres zawiera aktualną liczbę mediów.
- W [js/config.js](js/config.js) w `BACKGROUND_LAYERS.buildingLayers` dodać 6 wpisów dla budynku propagandy (np. `building-propaganda-1` … `building-propaganda-6`) z `visibilityConfig: { type: 'propaganda', minOwnedMedia: N, maxOwnedMedia: N }`, `imagePath` wskazujący na `ASSETS/bgs/AnimBgs/buildings/buildings_propaganda_1.png` … `_6.png`.
- Wywołać aktualizację widoczności warstw propagandy przy każdej zmianie stanu propagandy (zakup medium, odświeżenie UI) – np. w `updatePropagandaUI()` lub w pętli `update()` warstw, jeśli nowy typ jest tam sprawdzany co klatkę.
- Grafiki: 6 plików (refined pixel art, przezroczyste tło, styl jak w building_bg_graphics). Opisy i prompty do `docs/Image_Generation_Prompts.md`.

**Uwaga:** Obecnie `updateVisibilityFromBuildings()` nie czyta stanu propagandy; nowy typ `propaganda` będzie wymagał osobnej metody (np. `updateVisibilityFromPropaganda()`) wywoływanej z `update()` warstwy oraz ewentualnie przy zmianie `ownedMedia`.

---

## 2. Przebudowa działania i UI systemu narracji

### 2.1 Trzy opcje narracji (LEFT, CENTRUM, RIGHT)

- Usunąć suwak 9-stopniowy; zastąpić **trzema przyciskami/opcjami:** LEFT | CENTRUM | RIGHT.
- W UI dla każdego medium: wyświetlać **krótki opis efektów** dla danej opcji (np. „LEFT: +X% APC, -Y% Support Regen” itd.) – dane z [js/data_propaganda.js](js/data_propaganda.js): left/center/right; opcjonalnie tooltip lub rozwijany tekst.

### 2.2 Barometr narracji

- **Barometr** = wizualny wskaźnik w formie **wskazówki** wychylającej się na lewo/prawo względem centrum (skala od -100 … 0 … do +100).
- Wartość barometru wyliczana z **aktualnego poziomu narracji** (patrz 2.3), nie z samego wyboru celu. **Wskazówka przesuwa się skokowo co 5 jednostek** – UI aktualizuje się tylko gdy wartość przekroczy kolejny próg (…,-95,-90,…,0,…,90,95,100), żeby uniknąć migania przy każdym ticku.

### 2.3 Progresja narracji w czasie (real time) i CAP

- **Stan per medium:**
  - `targetNarrative`: 'left' | 'center' | 'right' (wybór gracza).
  - `narrativeLevel`: liczba całkowita z zakresu [-100, 100] (ujemna = w lewo, 0 = centrum, dodatnia = w prawo); używana bezpośrednio do pozycji wskazówki barometru (krok 5 przy aktualizacji UI).
  - `lastNarrativeUpdate`: timestamp (Date.now() lub epoch ms) do liczenia upływu czasu rzeczywistego.
- **Reguła zmiany:**
  - Dla wybranego LEFT: `narrativeLevel` maleje (w stronę -100) o **X% zakresu na 24h rzeczywiste** (z zastosowaniem mnożników prędkości per medium).
  - Dla RIGHT: rośnie (w stronę +100) według tej samej zasady.
  - Dla CENTRUM: `narrativeLevel` dąży do 0 z aktualnej wartości (bez natychmiastowego resetu).
  - **CAP:** maksymalne odchylenie (np. 1.0 lub 100%) – po osiągnięciu CAP wyświetlana jest grafika CAP_LEFT / CAP_RIGHT.
- **Prędkość:** konfigurowalna w [js/config.js](js/config.js), np.:
  - `PROPAGANDA_NARRATIVE_PERCENT_PER_REAL_DAY` (np. 5),
  - `PROPAGANDA_DAYS_TO_CAP` (lub procent per day per medium) – osobno per medium (gazeta najwolniej, radio szybciej itd.) – parametry w config z opisem po polsku.
- **Efekty gry:** interpolacja między center a left/right (i ewentualnie CAP) na podstawie `narrativeLevel`; np. przy 50% w lewo = 50% efektów left + 50% center. Obliczenia w `getPropagandaEffects()` w [js/propaganda.js](js/propaganda.js) – zamiast bezpośredniego odczytu jednej z 9 kluczy, użyć `narrativeLevel` + target + skalowanie efektów.
- **Offline:** przy ładowaniu gry w [js/offline.js](js/offline.js) wyliczyć upływ czasu od `lastNarrativeUpdate` i zaktualizować `narrativeLevel` dla każdego medium (z zachowaniem CAP i prędkości per medium).

**Migracja zapisu:** Obecne `ownedMedia[].narrative` (wartości 9-stopniowe) zmapować na `targetNarrative` (left/center/right) oraz początkowy `narrativeLevel` (np. 0 przy center, ±1 przy skrajnych).

### 2.4 Pięć grafik tła per medium (CAP_LEFT, LEFT, CENTRUM, RIGHT, CAP_RIGHT)

- W **modalu propagandy**, dla każdego medium: tło okienka medium = jedna z 5 grafik zależna od aktualnego **poziomu narracji** (`narrativeLevel` + target):
  - CAP_LEFT, LEFT, CENTRUM, RIGHT, CAP_RIGHT (np. 2 + 1 + 2 = 5).
- Mapowanie: np. poziom w lewo poniżej progu CAP → LEFT, powyżej progu → CAP_LEFT; analogicznie RIGHT/CAP_RIGHT; centrum → CENTRUM.
- Ścieżki: np. `ASSETS/propaganda/backgrounds/{mediaId}_cap_left.png` itd. (lub jedna wspólna konwencja). Definicje w [js/data_propaganda.js](js/data_propaganda.js) (np. `backgrounds: { cap_left: '...', left: '...', center: '...', right: '...', cap_right: '...' }` per medium).
- W [js/propaganda.js](js/propaganda.js) przy renderze slotu medium ustawiać `background-image` lub `<img>` tła według aktualnego poziomu; aktualizacja przy `updatePropagandaUI()` / przy ticku narracji.

---

## 3. Save/Load i config

- **Save/Load ([js/offline.js](js/offline.js)):**
  - Zapis: `ownedMedia` z polami `id`, `targetNarrative`, `narrativeLevel`, `lastNarrativeUpdate`.
  - Load: po wczytaniu wyliczyć narrację po czasie offline (tak jak w 2.3) i zapisać zaktualizowany stan.
- **Config ([js/config.js](js/config.js)):**
  - Dodać sekcję np. `PROPAGANDA_NARRATIVE`: `percentPerRealDay` (domyślnie 5), `daysToCap` (lub odpowiednik), oraz per medium: `narrativeSpeedMultiplier` (gazeta 1.0, radio szybciej itd.) – opisy po polsku.

---

## 4. News-ticker per medium (backlog na v1.0)

- **Na później (v1.0):** Pod okienkiem każdego medium dodać pasek w stylu „news-ticker” z nagłówkami / fragmentami rozmów (radio) / reportaży (TV), z treściami zależnymi od postępów gracza i meta-threads.
- W planie tylko **zadokumentować** (np. w TODO.md lub w tym planie): osobny task na treści, integrację z meta-threads i UI tickera per medium; nie implementować w tej iteracji.

---

## 5. Kolejność prac i zależności

- Najpierw: **warunek zakupu mediów** (min. liczba Propaganda Network per medium w data_propaganda + logika w propaganda.js); rozszerzenie stanu (`targetNarrative`, `narrativeLevel`, `lastNarrativeUpdate`) i config; migracja zapisu.
- Potem: logika progresji w czasie rzeczywistym + offline; interpolacja efektów; zmiana UI (3 opcje, barometr).
- Równolegle lub po: nowy typ warstwy „propaganda” + 6 grafik budynku; 5 grafik tła per medium w modalu.
- Na końcu (lub osobny task): support-effect-list, achievements, ewentualne achievementy za CAP / długie trzymanie narracji.

---

## 6. Pliki do zmiany (podsumowanie)

- **Stan i config:** [js/config.js](js/config.js), [js/data_propaganda.js](js/data_propaganda.js), [js/propaganda.js](js/propaganda.js) – w tym warunek zakupu mediów (minPropagandaNetworkCount)
- **Warstwy tła:** [js/background_layers.js](js/background_layers.js), [js/config.js](js/config.js)
- **Zapis/load:** [js/offline.js](js/offline.js)
- **UI modalu:** [js/propaganda.js](js/propaganda.js), HTML/CSS modala propagandy
- **Grafiki:** Nowe pliki w `ASSETS/bgs/AnimBgs/buildings/` (propaganda 1–6), `ASSETS/propaganda/backgrounds/` (5 × 6 mediów), [docs/Image_Generation_Prompts.md](docs/Image_Generation_Prompts.md)
- **Efekty/support:** [js/support.js](js/support.js) lub miejsce gdzie wywoływane jest `getPropagandaSystemEffects` – upewnić się, że interpolacja jest uwzględniona

---

## 7. Pytania do decyzji w trakcie implementacji

**Ustalone założenia:**

- Skala barometru: **[-100, 100]**, osobny barometr **dla każdego medium**; wskazówka w UI przesuwa się skokowo co 5 jednostek.
- Przy pierwszym zakupie medium domyślnie `targetNarrative = 'center'` i `narrativeLevel = 0`.
- Zmiana wyboru (np. LEFT → RIGHT) **nie resetuje** `narrativeLevel` do 0 – narracja „jedzie” od aktualnego poziomu w nową stronę (to jest core fantasy systemu).
