# Systems Wrapper Redesign – Design Doc

**Data:** 2026-02-20  
**Status:** Zatwierdzone

## Cel

Przebudowa kontenera przycisków systemów (`#systems-wrapper`): ikony z ASSETS/ICONS/BUILDINGS zamiast emoji, gruba złota ramka bez zaokrągleń, wrapper przyklejony do lewej krawędzi bez marginesów/paddingu i bez odstępów między przyciskami, stan „wciśnięty” (inner shadow) dla ukrytych/zablokowanych, spójny hover dla aktywnych.

## Zakres

- Kontener: `#systems-wrapper` (index.html + css/systems.css).
- Przyciski: wszystkie 8 (Propaganda, Tower, Wall, D.O.G.E., TLA, Billionaire's Cave, Ballroom, Mars).

## 1. Mapowanie ikon (sztywne)

| Przycisk / id           | Plik ikony |
|-------------------------|--------------------------------------------|
| propaganda-btn          | 04_propaganda_128x128.jpg |
| tower-btn               | 05_tower_128x128.jpg |
| wall-btn                | 06_wall_128x128.jpg |
| tla-btn / #tla-btn      | 07_tla_128x128.jpg |
| billionaire-cave-btn    | 08_cave_128x128.jpg |
| ballroom-btn            | 09_ballroom_128x128.jpg |
| doge-btn                | 10_doge_128x128.jpg |
| mars-btn                | 11_mars_128x128.jpg |

Ścieżki w CSS: `../ASSETS/ICONS/BUILDINGS/XX_...jpg` (spójnie z data_buildings.js).

## 2. Wrapper – ramka i układ

- **Ramka:** gruba (3–4 px), kolor `var(--primary-gold)`, **bez zaokrągleń** (`border-radius: 0`).
- **Pozycjonowanie:** wrapper przyklejony do lewej krawędzi ekranu: `left: 0`, `top` według obecnego układu; **brak marginesów i paddingu** (0 margin, 0 padding).
- **Odstępy:** **brak odstępów między przyciskami** – `gap: 0` (obecne `gap: 0.75rem` usunąć).

## 3. Przyciski – ikony zamiast emoji

- **Wymiar:** 50×50 px (bez zmiany).
- **Ikona:** `background-image` w CSS per klasa/id, `background-size: cover`, `background-position: center`. Można zachować delikatne tło (gradient) pod ikoną lub tylko ramkę; ikona jako główny wizual.
- **Treść:** emoji usunięte z HTML; `title` / `aria-label` bez zmian.
- **Placeholdery:** dla `#doge-btn`, `#tla-btn`, `#billionaire-cave-btn`, `#ballroom-btn`, `#mars-btn` dopisać w CSS odpowiednie `background-image` (każdy ma własną ikonę mimo wspólnej klasy `.placeholder-btn`).

Podejście: **Opcja A** – obrazek w CSS (background-image per klasa/id), bez JS.

## 4. Stan „wciśnięty” (ukryte / zablokowane)

- **Dotyczy:** przyciski z `.hidden` (propaganda, tower, wall przed odblokowaniem) oraz `.placeholder-btn` (doge, tla, cave, ballroom, mars przed odblokowaniem).
- **Efekt:**
  - **Dodać:** `box-shadow: inset ...` (np. `inset 0 2px 8px rgba(0,0,0,0.5)`).
  - **Zachować:** `filter: grayscale(1); opacity: 0.5` (dla `.hidden`), analogicznie dla `.placeholder-btn`.
  - **Scale:** opcjonalnie zostawić `scale(0.8)` lub zmniejszyć do `scale(0.9)`; spójna reguła dla `.tower-btn.hidden`, `.propaganda-btn.hidden`, `.wall-btn.hidden`, `.placeholder-btn`.

## 5. Hover (aktywne przyciski)

- **Aktywne** (bez `.hidden`, bez `.placeholder-btn`):
  - `transform: scale(1.05)` lub `scale(1.1)`,
  - `box-shadow` z delikatnym złotym świeceniem (np. `0 4px 12px rgba(212, 175, 55, 0.5)`),
  - opcjonalnie `filter: brightness(1.1)` na hover.
- **Zablokowane:** `pointer-events: none`, `cursor: not-allowed` – brak reakcji na hover.

## Pliki do zmiany

- **index.html:** usunięcie emoji z treści przycisków w `#systems-wrapper`.
- **css/systems.css:** `.systems-wrapper` (ramka, gap, padding, left/top), style przycisków (background-image per przycisk), `.xxx-btn.hidden` i `.placeholder-btn` (inset shadow, grayscale, opacity), hover dla aktywnych.
- **css/mobile.css:** nie edytować (zgodnie z zasadami), chyba że użytkownik wskaże inaczej.

## Poza zakresem

- Kompatybilność wsteczna (nie wymagana).
- Zmiana logiki odblokowania systemów (np. w late_game_systems.js) – tylko wizualna przebudowa wrappera i przycisków.
