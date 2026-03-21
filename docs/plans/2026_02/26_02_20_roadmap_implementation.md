# Roadmap (Settings + modal + roadmap.html) – plan implementacji

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dodać roadmapę dla graczy: przycisk „View Roadmap” w Settings otwiera modal ładujący treść z osobnego pliku `roadmap.html`; szczegółowa roadmapa w `docs/roadmap.md`.

**Architecture:** Treść dla graczy w fragmencie HTML (`roadmap.html`); modal w `index.html` z pustym body; przy otwarciu fetch `./roadmap.html` i wstrzyknięcie do body; fallback przy błędzie. Styl jak inne modale.

**Tech Stack:** Vanilla JS, index.html, js/events.js, css/systems.css (lub modals.css), roadmap.html (root), docs/roadmap.md. Design: `docs/plans/2026_02/26_02_20_roadmap_design.md`.

---

## Task 1: Przycisk Roadmap w Settings i szkielet modala

**Pliki:**
- Modyfikacja: `index.html` (setting-row + modal)

**Krok 1: Dodać wiersz Roadmap w Settings**

W `index.html`, w `#settings-modal .modal-body`, zaraz po bloku z „Changelog” (po `<button id="show-changelog-btn">`), dodać:

```html
<div class="setting-row">
    <span>Roadmap</span>
    <div class="setting-actions">
        <button id="show-roadmap-btn" class="action-btn">View Roadmap</button>
    </div>
</div>
```

**Krok 2: Dodać modal Roadmap**

W `index.html`, w tym samym miejscu co inne modale (np. po `#prestige-shop-modal`, przed `#achievements-modal`), dodać:

```html
<!-- Roadmap Modal -->
<div id="roadmap-modal" class="modal hidden">
    <div class="modal-content">
        <div class="modal-header">
            <h2>Roadmap</h2>
            <button id="close-roadmap" class="close-btn">&times;</button>
        </div>
        <div id="roadmap-modal-body" class="modal-body">
            <!-- Treść ładowana z roadmap.html -->
        </div>
    </div>
</div>
```

**Krok 3: Commit**

```bash
git add index.html
git commit -m "feat: add Roadmap row in Settings and roadmap modal skeleton"
```

---

## Task 2: Otwieranie i zamykanie modala Roadmap (events.js)

**Pliki:**
- Modyfikacja: `js/events.js`

**Krok 1: Znaleźć miejsce na listenery**

W `js/events.js` znaleźć blok z listenerami dla Settings (np. `show-changelog-btn`, `close-settings`) i dodać w tym samym stylu obsługę Roadmap.

**Krok 2: Dodać openRoadmapModal()**

- Pobierać `document.getElementById('roadmap-modal')` i `document.getElementById('roadmap-modal-body')`.
- Usunąć klasę `hidden` z modala (pokazać modal).
- Wywołać `fetch('./roadmap.html')`, then `response.text()`, then `roadmapModalBody.innerHTML = text`.
- W catch / przy !response.ok ustawić `roadmapModalBody.innerHTML = '<p class="roadmap-fallback">Roadmap unavailable.</p>'`.

**Krok 3: Podpiąć przycisk i zamknięcie**

- `#show-roadmap-btn` click → wywołać `openRoadmapModal()` (albo `window.openRoadmapModal` jeśli używane z zewnątrz).
- `#close-roadmap` click → dodać klasę `hidden` do `#roadmap-modal`.
- Opcjonalnie: klik w overlay (jeśli inne modale tak zamykają) – dodać ten sam handler dla `#roadmap-modal`.

**Krok 4: Commit**

```bash
git add js/events.js
git commit -m "feat: open/close Roadmap modal and load content from roadmap.html"
```

---

## Task 3: Plik roadmap.html (fragment treści)

**Pliki:**
- Utworzenie: `roadmap.html` (w głównym katalogu projektu)

**Krok 1: Utworzyć fragment HTML**

Plik **nie** zawiera `<!DOCTYPE>`, `<html>`, `<body>`. Tylko treść do wstrzyknięcia, np.:

```html
<div class="roadmap-content">
    <section class="roadmap-section">
        <h3>Story & events</h3>
        <ul class="roadmap-list">
            <li>Events when support drops (choices and consequences)</li>
            <li>Crowd in front of the White House (reactions to events)</li>
        </ul>
    </section>
    <section class="roadmap-section">
        <h3>Visuals & atmosphere</h3>
        <ul class="roadmap-list">
            <li>Background layers tied to built buildings</li>
            <li>Improved propaganda and tower modals</li>
        </ul>
    </section>
    <section class="roadmap-section">
        <h3>Quality of life & polish</h3>
        <ul class="roadmap-list">
            <li>Combo system redesign and excitement</li>
            <li>More stats in UI</li>
        </ul>
    </section>
</div>
```

Treść można dopasować do aktualnego TODO; powyższy przykład na podstawie TODO.md (wysoki/średni priorytet, wersja „dla gracza”).

**Krok 2: Commit**

```bash
git add roadmap.html
git commit -m "content: add roadmap.html fragment for player-facing roadmap"
```

---

## Task 4: Style dla roadmapy (CSS)

**Pliki:**
- Modyfikacja: `css/systems.css` (lub `css/modals.css`)

**Krok 1: Dodać klasy roadmap**

Na końcu odpowiedniego pliku dodać np.:

```css
/* Roadmap modal content */
.roadmap-content { padding: 0; }
.roadmap-section { margin-bottom: 1rem; }
.roadmap-section h3 { font-size: 1rem; margin-bottom: 0.5rem; color: var(--primary-gold, #c9a227); }
.roadmap-list { margin: 0; padding-left: 1.25rem; }
.roadmap-list li { margin-bottom: 0.25rem; }
.roadmap-fallback { color: #888; padding: 1rem; }
```

Dostosować zmienne/kolory do reszty gry.

**Krok 2: Commit**

```bash
git add css/systems.css
git commit -m "style: roadmap modal sections and fallback"
```

---

## Task 5: Dokument szczegółowy docs/roadmap.md

**Pliki:**
- Utworzenie: `docs/roadmap.md`

**Krok 1: Utworzyć roadmap.md**

Struktura: nagłówek (np. „Szczegółowa roadmapa APPSTAIN”), sekcje High / Medium / Low (i ewentualnie Bugs, Polish). Każdy punkt: krótki tytuł + 1–2 zdania; gdzie sensowne – link do `TODO.md` lub pliku w `docs/plans/`. Język opisu: polski. Zawartość zsynchronizowana z TODO (wysoki, średni, niski priorytet).

Przykład początku:

```markdown
# Szczegółowa roadmapa APPSTAIN

Pełna lista planów; skrót dla graczy w grze (Settings → View Roadmap).

## Wysoki priorytet
- **Eventy przy spadku poparcia** – eventy na progach 20, 15, 10, … %; wybory A/B/C, efekty na żelazny elektorat / regenerację. Zob. TODO.md (Wysoki).
- **Tło left-panel a budynki** – warstwy tła zależne od liczby/typu budynków. …
...
```

**Krok 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: add detailed roadmap (docs/roadmap.md)"
```

---

## Weryfikacja końcowa

- Otworzyć grę → Settings → „View Roadmap” → modal się otwiera, treść z `roadmap.html` widoczna.
- Zamknięcie przez × i (jeśli zaimplementowano) overlay zamyka modal.
- Przy braku `roadmap.html` lub błędzie sieci w body modala widać „Roadmap unavailable.”
- `docs/roadmap.md` istnieje i jest spójny z TODO.

---

**Plan zapisany w:** `docs/plans/2026_02/26_02_20_roadmap_implementation.md`

**Opcje wykonania:**

1. **Subagent-Driven (ta sesja)** – kolejne zadania wykonywane po kolei z przeglądem między taskami.
2. **Osobna sesja (executing-plans)** – nowa sesja w worktree z wykonaniem planu krok po kroku.

Którą opcję wybierasz?
