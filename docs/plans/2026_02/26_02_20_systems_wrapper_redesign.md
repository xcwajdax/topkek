# Systems Wrapper Redesign – Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Przebudowa systems-wrapper: ikony budynków z ASSETS/ICONS/BUILDINGS, gruba złota ramka bez zaokrągleń, wrapper przyklejony do lewej (0 margin/padding), gap 0, stan wciśnięty (inset shadow) dla .hidden/.placeholder-btn, hover dla aktywnych.

**Architecture:** Zmiany tylko w HTML (usunięcie emoji) i CSS (systems.css): wrapper layout/ramka, per-przycisk background-image, ujednolicone .hidden/.placeholder-btn, hover. Bez JS. Mapowanie ikon sztywne w CSS.

**Tech Stack:** HTML, CSS (var(--primary-gold)), ścieżki względne do ASSETS/ICONS/BUILDINGS.

**Design:** `docs/plans/2026_02/26_02_20_systems_wrapper_redesign_design.md`

---

### Task 1: Wrapper – ramka, pozycja, gap

**Files:**
- Modify: `css/systems.css` (sekcja `.systems-wrapper`, ok. linii 252–266)

**Step 1:** W `.systems-wrapper` ustaw:
- `left: 0; top: 0;` (lub zachować obecny `top` jeśli layout wymaga)
- `margin: 0; padding: 0;`
- `gap: 0;`
- `border: 3px solid var(--primary-gold);`
- `border-radius: 0;`
- Usunąć ewentualne inne marginesy/paddingi z wrappera.

W `.systems-wrapper.modal-open` dostosować `left` tak, aby po otwarciu modala wrapper nadal był przyklejony do lewej krawędzi modala (zgodnie z obecną logiką min(35%, 600px) + 1rem – jeśli ma zostać, zostawić; jeśli ma być 0, ustawić 0).

**Step 2:** Zapis pliku, weryfikacja w przeglądarce: wrapper ma złotą ramkę bez zaokrągleń, przy lewej krawędzi, przyciski bez odstępów.

**Step 3:** Commit

```bash
git add css/systems.css
git commit -m "refactor(ui): systems-wrapper gold frame, flush left, gap 0"
```

---

### Task 2: Ikony przycisków – CSS (Propaganda, Tower, Wall)

**Files:**
- Modify: `css/systems.css` (`.tower-btn`, `.propaganda-btn`, `.wall-btn` – bloki ok. 268–280, 801–812, 1335–1343)
- Modify: `index.html` (linie 447, 450, 453 – usunąć emoji z treści przycisków)

**Step 1:** W HTML usunąć znaki emoji z wewnątrz `<button>` dla propaganda-btn, tower-btn, wall-btn (zostawić pustą treść lub ewentualnie span.sr-only; zachować atrybuty `id`, `class`, `title`).

**Step 2:** W CSS dla `.tower-btn`, `.propaganda-btn`, `.wall-btn` dodać:
- `background-image: url('../ASSETS/ICONS/BUILDINGS/05_tower_128x128.jpg');` (dla tower),
- `url('../ASSETS/ICONS/BUILDINGS/04_propaganda_128x128.jpg');` (dla propaganda),
- `url('../ASSETS/ICONS/BUILDINGS/06_wall_128x128.jpg');` (dla wall),
- `background-size: cover;`
- `background-position: center;`
Opcjonalnie: dostosować tło (gradient) tak, aby ikona była czytelna (np. ciemne tło pod ikoną).

**Step 3:** Zapis, odświeżenie – przyciski pokazują ikony zamiast emoji.

**Step 4:** Commit

```bash
git add index.html css/systems.css
git commit -m "feat(ui): system buttons use building icons (propaganda, tower, wall)"
```

---

### Task 3: Ikony placeholderów (D.O.G.E., TLA, Cave, Ballroom, Mars)

**Files:**
- Modify: `index.html` (linie 456–471 – usunąć emoji z doge-btn, tla-btn, billionaire-cave-btn, ballroom-btn, mars-btn)
- Modify: `css/systems.css` (sekcja placeholder-btn oraz style dla #doge-btn, #tla-btn, #billionaire-cave-btn, #ballroom-btn, #mars-btn – lub osobne klasy jeśli używane po odblokowaniu)

**Step 1:** W HTML usunąć emoji z treści przycisków: doge (🐕), tla (🕶️), billionaire-cave (🦇), ballroom (💃), mars (🚀). Zachować `id`, `class`, `title`, `data-tooltip-config`, `disabled` gdzie jest.

**Step 2:** W CSS dodać dla każdego z tych przycisków `background-image` (ścieżki z designu):
- `#doge-btn` → 10_doge_128x128.jpg
- `#tla-btn` → 07_tla_128x128.jpg
- `#billionaire-cave-btn` → 08_cave_128x128.jpg
- `#ballroom-btn` → 09_ballroom_128x128.jpg
- `#mars-btn` → 11_mars_128x128.jpg
oraz `background-size: cover; background-position: center;` (można w jednej wspólnej regule dla tych id lub rozszerzyć .placeholder-btn i nadpisać per id). Upewnić się, że po odblokowaniu (tla-btn, ballroom-btn itd.) przyciski nadal mają te same ikony – jeśli po odblokowaniu zmienia się klasa na .tla-btn itd., dopisać tam te same background-image.

**Step 3:** Zapis, weryfikacja – wszystkie 8 przycisków pokazują grafiki z BUILDINGS.

**Step 4:** Commit

```bash
git add index.html css/systems.css
git commit -m "feat(ui): placeholder system buttons use building icons (doge, tla, cave, ballroom, mars)"
```

---

### Task 4: Stan wciśnięty – inset shadow dla .hidden i .placeholder-btn

**Files:**
- Modify: `css/systems.css` (`.tower-btn.hidden`, `.propaganda-btn.hidden`, `.wall-btn.hidden` – ok. 289–295, 820–826, 1351–1357; oraz .placeholder-btn i ewentualnie .tla-btn.hidden itd.)

**Step 1:** W każdej regule `.tower-btn.hidden`, `.propaganda-btn.hidden`, `.wall-btn.hidden` dodać:
- `box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);` (lub mocniej według uznania).
Zachować: `transform: scale(0.8)` lub zmienić na `scale(0.9)`, `filter: grayscale(1); opacity: 0.5; cursor: not-allowed; pointer-events: none;`.

**Step 2:** Dla `.placeholder-btn` (styl zablokowanego placeholdera) dodać ten sam `box-shadow: inset ...`, zachować grayscale i opacity (obecnie scale 0.8, grayscale, opacity 0.4). Ujednolicić opacity do 0.5 jeśli ma być spójnie z .hidden.

**Step 3:** Zapis, weryfikacja – zablokowane przyciski wyglądają na „wciśnięte” (inner shadow).

**Step 4:** Commit

```bash
git add css/systems.css
git commit -m "style(ui): system buttons hidden/placeholder inset shadow (pressed look)"
```

---

### Task 5: Hover dla aktywnych przycisków

**Files:**
- Modify: `css/systems.css` (`.tower-btn:hover`, `.propaganda-btn:hover`, `.wall-btn:hover` oraz hover dla .tla-btn, .ballroom-btn, .doge-btn, .cave-btn jeśli są używane po odblokowaniu)

**Step 1:** Upewnić się, że aktywne przyciski (bez .hidden, bez .placeholder-btn) mają hover:
- `transform: scale(1.05)` lub `scale(1.1)`
- `box-shadow: 0 4px 12px rgba(212, 175, 55, 0.5);`
- Opcjonalnie: `filter: brightness(1.1);` tylko na hover (uwaga: nie kumulować z grayscale na zablokowanych).

**Step 2:** Dla .tla-btn:hover, .ballroom-btn:hover itd. (gdy te klasy istnieją po odblokowaniu) dodać ten sam wzorzec hover, jeśli jeszcze go nie ma.

**Step 3:** Zapis, weryfikacja – tylko aktywne przyciski reagują na hover (scale + złoty glow); zablokowane bez reakcji.

**Step 4:** Commit

```bash
git add css/systems.css
git commit -m "style(ui): system buttons hover scale and gold glow"
```

---

### Task 6: Changelog i wersja

**Files:**
- Create: `CHANGELOGS/2026_02/changelog_26_02_20_XX_systems_wrapper_redesign.md`
- Modify: `TODO.md` – odhaczyć punkt o przebudowie systems-wrapper (linie 101–104)

**Step 1:** Dodać wpis changelogu według `.cursor/rules/changelog.mdc`: krótki opis (ikony z BUILDINGS, ramka złota, gap 0, inset shadow, hover), lista zmienionych plików (index.html, css/systems.css), parametry/klasy dodane/zmodyfikowane.

**Step 2:** W TODO.md zmienić `- [ ]` na `- [x]` dla punktu „Przebudowa systems-wrapper (przyciski systemów)”.

**Step 3:** Zaproponować numer wersji (patch przy fixach/małych zmianach, minor przy nowych funkcjach).

**Step 4:** Commit

```bash
git add CHANGELOGS/2026_02/changelog_26_02_20_XX_systems_wrapper_redesign.md TODO.md
git commit -m "docs: changelog systems wrapper redesign, TODO done"
```

---

## Execution

Plan zapisany w `docs/plans/2026_02/26_02_20_systems_wrapper_redesign.md`.

**Opcje wykonania:**

1. **Subagent-Driven (ta sesja)** – kolejne zadania wykonywane w tej sesji z przeglądem między krokami.
2. **Osobna sesja (executing-plans)** – otworzyć nową sesję w worktree i realizować plan z checkpointami.

Którą opcję wybierasz?
