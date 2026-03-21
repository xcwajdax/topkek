# Roadmap – dokument designu

**Data:** 2026-02-20  
**Status:** Zatwierdzony

---

## 1. Cel i zakres

- **Dla graczy:** krótka roadmapa w grze – przycisk w modalu Settings otwiera osobny modal „Roadmap” z listą planowanych rzeczy (bez dat, bez technikaliów).
- **Szczegółowa:** pełna roadmapa w dokumentach (`docs/roadmap.md`) – jedno miejsce do utrzymywania, linkowanie z TODO i planami.
- **Wejście:** przycisk w Settings (np. „View Roadmap”), modal tego samego wzorca co Achievements / Prestige Shop.
- **Poza zakresem (na teraz):** daty w roadmapzie, wersje, tłumaczenie roadmapy na PL, achievement za pierwsze otwarcie (można dodać później).

---

## 2. UI: wejście i modal

**Wejście w Settings**
- Nowa `setting-row`: etykieta „Roadmap”, przycisk „View Roadmap” (klasa `action-btn`).
- Umiejscowienie: zaraz po wierszu „Changelog” (Changelog / Roadmap / Creator Message jako blok info).

**Modal Roadmap**
- Id: `#roadmap-modal`. Struktura: `modal` + `modal-content`, header (tytuł „Roadmap” + przycisk ×), body przewijalny (`#roadmap-modal-body`).
- Treść: sekcje (np. „Story & events”, „Visuals & atmosphere”, „Quality of life”) + bullet pointy po angielsku, zrozumiałe dla gracza.
- Styl: reużycie klas z `modals.css` / `systems.css`; ewentualne `.roadmap-section`, `.roadmap-list` w `systems.css` lub `modals.css`. Bez zmian w `mobile.css` na start.
- Zachowanie: klik „View Roadmap” → otwarcie modala (Settings można zamknąć lub zostawić – spójnie z Changelog). Zamknięcie: × lub overlay. Brak persistencji.

---

## 3. Źródło treści: osobny plik HTML + dokument szczegółowy

**Treść dla graczy**
- Osobny plik **`roadmap.html`** w głównym katalogu projektu (obok `index.html`).
- Zawartość: **fragment** (bez `<!DOCTYPE>`, `<html>`, `<body>`): np. `<div class="roadmap-content">` z `<section class="roadmap-section">`, `<h3>`, `<ul class="roadmap-list">`, `<li>`.
- Ładowanie: przy otwarciu modala `fetch('./roadmap.html')` → `#roadmap-modal-body.innerHTML = await response.text()`. Przy błędzie: fallback „Roadmap unavailable.” w body modala.

**Dokument szczegółowy**
- **`docs/roadmap.md`**: pełna roadmapa (High / Medium / Low, Bugs, Polish), opisy po polsku, linki do TODO i `docs/plans/`. Osobne od `roadmap.html` – tam tylko to, co widzi gracz.

---

## 4. Szczegóły techniczne

**index.html**
- Nowa `setting-row` po „Changelog”: etykieta „Roadmap”, przycisk `id="show-roadmap-btn"`, tekst „View Roadmap”, klasa `action-btn`.
- Nowy modal `#roadmap-modal`: `modal-content`, `modal-header` („Roadmap” + `id="close-roadmap"`), `#roadmap-modal-body` na start pusty (lub „Loading…” opcjonalnie).

**JS (events.js)**
- `openRoadmapModal()`: pokazanie modala, `fetch('./roadmap.html')`, po sukcesie wstrzyknięcie treści do `#roadmap-modal-body`, po błędzie ustawienie fallbacku.
- Listenery: `#show-roadmap-btn` → `openRoadmapModal()`; `#close-roadmap` i overlay → ukrycie modala (jak inne modale).

**CSS**
- Klasy `.roadmap-content`, `.roadmap-section`, `.roadmap-list`, `.roadmap-fallback` w `systems.css` lub `modals.css`. `mobile.css` bez zmian.

**Ścieżka**
- `roadmap.html` w root projektu; fetch `./roadmap.html` względem strony z grą.

**Opcjonalny achievement**
- „Viewed roadmap” – poza scope na teraz; można dopisać w TODO.
