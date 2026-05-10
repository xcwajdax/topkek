# Plan fragmentacji struktury TOPKEK

**Status:** Zaplanowane, niezaimplementowane  
**Created:** 2026-03-28  
**Updated:** 2026-03-28 — doprecyzowanie układu katalogów (cienki root, `src/`), strategii HTML/CSS, zasady liczby modułów vs plików  
**Cel:** rozbić monolit `script.js`, odchudzić `index.html`, uporządkować `config.js` i przygotować repo pod dalszy rozwój bez utraty obecnego działania — **bez zagracania katalogu głównego projektu**.

---

## 1. Cel

Aktualna struktura repo działa, ale kilka plików urosło do poziomu monolitów. Największy koszt utrzymania siedzi w:

- `script.js` — wszystkie systemy aplikacji w jednym miejscu
- `config.js` — dużo konfiguracji z różnych domen
- `style.css` — style całej aplikacji w jednym pliku
- `index.html` — cały shell UI oraz wszystkie modale

Plan zakłada fragmentację według odpowiedzialności, nie według arbitralnych kawałków kodu.

### 1.1. Układ katalogów — cienki root (`/` repo topkek)

**W katalogu głównym zostają wyłącznie „punkt wejścia” i zasoby statyczne**, żeby nie rozrastać listy plików obok `index.html`.

Zalecenie:

- **`index.html`** — import map (Three.js), jeden główny `<script type="module">` (patrz niżej).
- **`script.js`** (opcjonalnie zachowany jako **jedyny** cienki moduł w root) — wyłącznie `import './src/main.js'` (lub równoważny bootstrap), albo bootstrap przeniesiony do `src/main.js` a w HTML od razu `src/main.js` — decyzja przy wdrożeniu; **nie** dodajemy kolejnych plików logiki obok bez potrzeby.
- **`config.js`** — może pozostać w root **tymczasowo** jako warstwa re-exportu ze `src/config/index.js` (kompatybilność ze starymi importami `from './config.js'`), do czasu gdy wszystkie importy przejdą na `src/config/`.
- **`style.css`** — **jeden plik** w root, który agreguje warstwy (np. `@import` plików z `styles/`). Dzięki temu `index.html` nie linkuje ośmiu osobnych arkuszy i root nie „puchnie” semantycznie.
- Moduły aplikacji wyłącznie pod prefiksem **`src/`** (alternatywna nazwa `app/` — jedna konwencja na cały projekt):

```
src/
  main.js              # bootstrap
  config/
    index.js           # zbiorczy export (nazewnictwo plików domenowych poniżej)
    performance.js
    scene.js
    ...
  core/
  features/
  ui/
  input/
  data/
styles/                 # fragmenty CSS importowane z root style.css
```

**Istniejące pliki w root** (np. `terminal-shell.js`, `buuch-chat.js`, `fx-dev-panel.js`) — przy refaktorze **preferować przeniesienie do `src/`** (np. `src/features/`, `src/ui/`) lub podkatalogów zgodnych z domeną; unikać nowych „luźnych” skryptów w root bez uzasadnienia.

---

## 2. Priorytety fragmentacji

### 2.1. Najpierw dane i konfiguracja

`config.js` należy podzielić na mniejsze moduły — **ścieżki względem `src/config/`** (nie w katalogu głównym):

- `src/config/performance.js`
- `src/config/scene.js`
- `src/config/portfolio.js`
- `src/config/vajbuj.js`
- `src/config/glitch.js`
- `src/config/terminal.js`
- `src/config/loader.js`
- `src/config/camera.js`

Zbiorczy eksport: **`src/config/index.js`**. Root **`config.js`** (jeśli zostaje) tylko re-eksportuje z `src/config/index.js`, bez logiki.

### 2.2. Potem logika aplikacji

Zawartość obecnego `script.js` rozciąć na moduły — **prefiks `src/`**:

- `src/main.js` — bootstrap aplikacji
- `src/core/scene.js` — scena, renderer, kamera, composer, światła
- `src/core/loader.js` — loader i postęp ładowania
- `src/features/background-video.js` — tło wideo, IBL, PMREM, próbkowanie kolorów
- `src/features/portfolio.js` — portfolio, modal, przejścia sceny
- `src/features/vajbuj.js` — tryb VAJBUJ
- `src/features/fx.js` lub `src/features/glitch.js` — efekty scatter/repulsion/grid/glitch
- `src/features/terminal-commands.js` — komendy terminala
- `src/ui/hud.js` — camera HUD i performance HUD
- `src/ui/modals.js` — wspólna obsługa modali
- `src/input/events.js` — mouse/touch/wheel/resize
- `src/data/particles.js` — ładowanie, serializacja i eksport cząsteczek

### 2.3. Następnie HTML

`index.html` powinien zostać uproszczony do samego szkieletu:

- kontener canvas
- loader
- prawy panel
- główny shell terminala
- fragmenty modali — **strategia do wyboru przed cięciem**:
  - **Opcja A (ostrożna):** zostawić większość markupu w `index.html`, wydzielić tylko największe, zamknięte sekcje.
  - **Opcja B:** partials ładowane w runtime (`fetch` + wstrzyknięcie HTML) — wymaga pilnowania ścieżek względnych, kolejności init skryptów, a11y (focus trap); więcej requestów HTTP przy starcie (na `python -m http.server` akceptowalne, na produkcji rozważyć agregację lub cache).

### 2.4. Na końcu CSS

Warstwy tematyczne trzymać pod **`styles/`**, a w root **`style.css`** tylko je spiąć (np. `@import`), np.:

- `styles/base.css`
- `styles/layout.css`
- `styles/loader.css`
- `styles/terminal.css`
- `styles/hud.css`
- `styles/modals.css`
- `styles/animations.css`
- `styles/responsive.css`

---

## 3. Docelowa kolejność wdrożenia

### Etap 1 — konfiguracja

1. Rozdzielić `config.js` na pliki domenowe w `src/config/`.
2. `src/config/index.js` jako warstwa agregująca; opcjonalnie root `config.js` jako cienki re-export.
3. Upewnić się, że żadna logika nie wylądowała w plikach konfiguracyjnych.

### Etap 2 — core i feature modules

1. Wyciągnąć bootstrap do `src/main.js`.
2. Wyizolować scenę, loader i post-processing w `src/core/`.
3. Oddzielić background video, portfolio i VAJBUJ jako niezależne moduły w `src/features/`.
4. Przenieść obsługę terminala i eventów wejściowych do osobnych plików (`src/features/` / `src/input/`).

### Etap 3 — UI

1. Zmniejszyć `index.html` (zgodnie z wybraną strategią partiali z §2.3).
2. Przenieść / wstrzyknąć sekcje modali bez psucia selektorów DOM.
3. Rozłożyć `style.css` na pliki w `styles/`, z jednym agregatem w root.

### Etap 4 — porządki w assetach i docs

1. Utrzymać `ASSETS/` jako magazyn mediów runtime.
2. Trzymać notatki i plany wyłącznie w `docs/`.
3. Jeżeli podprojekt ma własny cykl życia, zamknąć go w jednym folderze.

---

## 4. Zasady projektowe

- Jeden plik = jedna odpowiedzialność.
- Logika nie wchodzi do configów.
- UI i logika nie powinny być splecione w jednym pliku.
- Nie dzielimy wszystkiego na mikromoduły bez potrzeby.
- **Granice domenowe (warstwy „co robi aplikacja”):** ok. **8–12** sensownych obszarów (core, features, ui, data, input itd.) — to **nie jest twardy limit liczby plików** `.js`. Lista w §2 może dać więcej plików w `src/`; ważne jest, by **nie** mnożyć drobnych helperów bez domeny i **nie** odkładać nowych modułów luzem w katalogu głównym. Jeśli liczba plików rośnie, scalać sąsiadujące odpowiedzialności (np. HUD + events tylko jeśli nadal czytelne).

---

## 5. Proponowane granice modułów

### Core

- scena, renderer, kamera
- loader
- eventy wejścia
- wspólne utilsy

### Features

- background video
- portfolio
- VAJBUJ
- efekty glitch / fx
- terminal commands

### UI

- HUD
- modale
- shell terminala

### Data

- particles
- konfiguracje (importowane z `src/config`)
- stałe i presety

---

## 6. Ryzyka

- Zbyt agresywne rozcinanie może utrudnić debugowanie.
- Fragmentacja bez jasno ustalonych granic może spowodować duplikację helperów.
- Przenoszenie modali do partiali wymaga ostrożności, żeby nie zepsuć selektorów DOM.
- Podział CSS bez porządku może tylko zwiększyć chaos.
- Wiele osobnych `<link rel="stylesheet">` w `index.html` zwiększa liczbę żądań — preferować jeden root `style.css` z `@import` plików z katalogu `styles/` (jak w §2.4).

---

## 7. Rekomendowana kolejność prac praktycznych

1. Utworzyć `src/config/` i podzielić `config.js`.
2. Wyciągnąć bootstrap do `src/main.js` i stopniowo przenosić kod z `script.js`.
3. Odseparować background video i portfolio.
4. Rozdzielić VAJBUJ oraz terminal commands.
5. Uporządkować modale w `index.html` (strategia z §2.3).
6. Rozbić `style.css` na `styles/` + agregat w root.
7. Przejrzeć `docs/` i `ASSETS/` pod kątem dalszego porządku; przenieść luźne skrypty z root do `src/` tam, gdzie to ma sens.

---

## 8. Kryterium sukcesu

Plan będzie uznany za dobrze wdrożony, jeśli:

- logika aplikacji nie jest już jednym monolitycznym `script.js` (entry może pozostać cienki)
- konfiguracja jest podzielona domenowo pod `src/config/`
- `index.html` stanie się cienkim shell’em
- style będą utrzymywalne (warstwy w `styles/`, jeden główny arkusz w root)
- **katalog główny pozostaje cienki:** brak nowych „płaskich” modułów domenowych obok `index.html`; kod aplikacji konsoliduje się pod `src/`
- dalsze funkcje da się dodawać bez dokładania wszystkiego do jednego pliku
