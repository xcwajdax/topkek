# Plan fragmentacji struktury TOPKEK

**Status:** Zaplanowane, niezaimplementowane  
**Created:** 2026-03-28  
**Cel:** rozbić monolit `script.js`, odchudzić `index.html`, uporządkować `config.js` i przygotować repo pod dalszy rozwój bez utraty obecnego działania.

---

## 1. Cel

Aktualna struktura repo działa, ale kilka plików urosło do poziomu monolitów. Największy koszt utrzymania siedzi w:

- `script.js` - wszystkie systemy aplikacji w jednym miejscu
- `config.js` - dużo konfiguracji z różnych domen
- `style.css` - style całej aplikacji w jednym pliku
- `index.html` - cały shell UI oraz wszystkie modale

Plan zakłada fragmentację według odpowiedzialności, nie według arbitralnych kawałków kodu.

---

## 2. Priorytety fragmentacji

### 2.1. Najpierw dane i konfiguracja

`config.js` powinien zostać podzielony na mniejsze moduły konfiguracyjne:

- `performance.js`
- `scene.js`
- `portfolio.js`
- `vajbuj.js`
- `glitch.js`
- `terminal.js`
- `loader.js`
- `camera.js`

Docelowo jeden plik `config/index.js` może eksportować wszystko zbiorczo.

### 2.2. Potem logika aplikacji

`script.js` należy rozciąć na moduły domenowe:

- `main.js` - bootstrap aplikacji
- `core/scene.js` - scena, renderer, kamera, composer, światła
- `core/loader.js` - loader i postęp ładowania
- `features/background-video.js` - tło wideo, IBL, PMREM, próbkowanie kolorów
- `features/portfolio.js` - portfolio, modal, przejścia sceny
- `features/vajbuj.js` - tryb VAJBUJ
- `features/fx.js` lub `features/glitch.js` - efekty scatter/repulsion/grid/glitch
- `features/terminal-commands.js` - komendy terminala
- `ui/hud.js` - camera HUD i performance HUD
- `ui/modals.js` - wspólna obsługa modali
- `input/events.js` - mouse/touch/wheel/resize
- `data/particles.js` - ładowanie, serializacja i eksport cząsteczek

### 2.3. Następnie HTML

`index.html` powinien zostać uproszczony do samego szkieletu:

- kontener canvas
- loader
- prawy panel
- główny shell terminala
- sekcje modali najlepiej przenieść do partiali lub generować z osobnych template’ów

### 2.4. Na końcu CSS

`style.css` warto rozdzielić na:

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

### Etap 1 - konfiguracja

1. Rozdzielić `config.js` na pliki domenowe.
2. Zostawić `index.js` lub `config.js` jako warstwę agregującą exporty.
3. Upewnić się, że żadna logika nie wylądowała w plikach konfiguracyjnych.

### Etap 2 - core i feature modules

1. Wyciągnąć bootstrap do `main.js`.
2. Wyizolować scenę, loader i post-processing.
3. Oddzielić background video, portfolio i VAJBUJ jako niezależne feature moduły.
4. Przenieść obsługę terminala i eventów wejściowych do osobnych plików.

### Etap 3 - UI

1. Zmniejszyć `index.html`.
2. Przenieść modalne sekcje do osobnych fragmentów.
3. Podzielić CSS na warstwy tematyczne.

### Etap 4 - porządki w assetach i docs

1. Utrzymać `ASSETS/` jako magazyn mediów runtime.
2. Trzymać notatki i plany wyłącznie w `docs/`.
3. Jeżeli podprojekt ma własny cykl życia, zamknąć go w jednym folderze.

---

## 4. Zasady projektowe

- Jeden plik = jedna odpowiedzialność.
- Logika nie wchodzi do configów.
- UI i logika nie powinny być splecione w jednym pliku.
- Nie dzielimy wszystkiego na mikromoduły bez potrzeby.
- Celujemy w 8-12 sensownych modułów, nie w kilkadziesiąt drobnych helperów.

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
- konfiguracje
- stałe i presety

---

## 6. Ryzyka

- Zbyt agresywne rozcinanie może utrudnić debugowanie.
- Fragmentacja bez jasno ustalonych granic może spowodować duplikację helperów.
- Przenoszenie modali do partiali wymaga ostrożności, żeby nie zepsuć selektorów DOM.
- Podział CSS bez porządku może tylko zwiększyć chaos.

---

## 7. Rekomendowana kolejność prac praktycznych

1. Podzielić `config.js`.
2. Wyciągnąć helpery i bootstrap z `script.js`.
3. Odseparować background video i portfolio.
4. Rozdzielić VAJBUJ oraz terminal commands.
5. Uporządkować modale w `index.html`.
6. Rozbić `style.css`.
7. Przejrzeć `docs/` i `ASSETS/` pod kątem dalszego porządku.

---

## 8. Kryterium sukcesu

Plan będzie uznany za dobrze wdrożony, jeśli:

- `script.js` nie będzie już monolitem
- konfiguracja będzie podzielona domenowo
- `index.html` stanie się cienkim shell’em
- style będą utrzymywalne
- dalsze funkcje da się dodawać bez dokładania wszystkiego do jednego pliku

