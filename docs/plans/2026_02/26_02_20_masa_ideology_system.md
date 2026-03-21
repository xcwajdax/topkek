# System Odchylenia Ideologicznego dla Budynku MASA

## Przegląd

System wprowadza wskaźnik odchylenia ideologicznego władzy, który informuje gracza o aktualnym wychyleniu ideologicznym (lewo/prawo). System aktywuje się po zakupie pierwszego budynku University of MASA i wyświetla gauge pod paskiem poparcia politycznego.

## Komponenty do implementacji

### 1. Nowy moduł: `js/ideology.js`

- Funkcja obliczania odchylenia ideologicznego:
  - Średnia ważona narracji mediów propagandowych (waga = koszt medium)
  - Wpływ poziomu poparcia politycznego (niskie poparcie → większe skrajności)
  - Kombinacja obu czynników
- Funkcje pomocnicze:
  - `calculateIdeologyDeviation()` - główna funkcja obliczająca odchylenie (-100 do +100)
  - `getPropagandaWeightedNarrative()` - średnia ważona narracji mediów
  - `getSupportInfluenceOnIdeology()` - wpływ poparcia na odchylenie
  - `isIdeologySystemUnlocked()` - sprawdza czy system jest odblokowany
  - `unlockIdeologySystem()` - odblokowuje system po zakupie pierwszego MASA
- Funkcje UI:
  - `updateIdeologyGauge()` - aktualizuje wizualizację gauge
  - `initIdeologySystem()` - inicjalizacja systemu

### 2. Konfiguracja w `js/config.js`

Dodanie sekcji `IDEOLOGY` z parametrami:

- `UNLOCK_BUILDING_ID`: 'university_of_masa.03'
- `PROPAGANDA_WEIGHT_BASE`: bazowa waga dla propagandy (np. 0.7)
- `SUPPORT_INFLUENCE_STRENGTH`: siła wpływu poparcia (np. 0.3)
- `SUPPORT_INFLUENCE_CURVE`: krzywa wpływu poparcia (funkcja matematyczna)
- `GAUGE_UPDATE_INTERVAL`: interwał aktualizacji gauge (ms)

### 3. HTML w `index.html`

Dodanie elementu gauge pod paskiem poparcia (w `.support-container-left`):

```html
<div id="ideology-gauge-container" class="ideology-gauge-container hidden">
    <div class="ideology-gauge-label">Ideological Deviation</div>
    <div class="ideology-gauge-wrapper">
        <div class="ideology-gauge">
            <div class="ideology-gauge-needle"></div>
            <div class="ideology-gauge-marks">
                <!-- Znaki na tarczy: LEFT, CENTER, RIGHT -->
            </div>
        </div>
        <div class="ideology-gauge-value" id="ideology-value">0</div>
    </div>
</div>
```

### 4. Style CSS

Dodanie do odpowiednich plików CSS:

- `css/components.css`: style dla gauge (tarcza, igła, etykiety)
- Animacje dla igły gauge
- Responsywność dla mobile

### 5. Integracja z systemem zakupów

W `js/purchases.js`:

- Dodanie sprawdzenia przy zakupie budynku MASA (w `buyItem` i `buyMultiple`)
- Wywołanie `unlockIdeologySystem()` gdy `count === 1`

### 6. Integracja z systemem zapisu/ładowania

W `js/offline.js`:

- Dodanie `ideologySystem` do `saveGame()` i `loadGame()`
- Stan systemu: `{ unlocked: false, deviation: 0 }`

### 7. Integracja z UI

W `script.js` lub `js/ui.js`:

- Wywołanie `updateIdeologyGauge()` w `updateUI()`
- Inicjalizacja w `initGame()`

### 8. Achievementy

W `js/achievements.js`:

- Achievement za odblokowanie systemu
- Achievement za osiągnięcie skrajnego odchylenia (lewo/prawo)

### 9. Dokumentacja efektów

Dodanie informacji o systemie do `support-effect-list` (kolumna "other") - na razie tylko informacja o odchyleniu, bez efektów gameplayowych

## Szczegóły implementacji

### Obliczanie odchylenia ideologicznego

1. **Średnia ważona narracji propagandowej**:

   - Dla każdego medium: wartość numeryczna narracji (-4 do +4: far_left=-4, left=-3, ..., far_right=+4)
   - Waga = koszt bazowy medium
   - Średnia ważona = Σ(narracja × waga) / Σ(waga)

2. **Wpływ poparcia**:

   - Niskie poparcie (<30%): zwiększa skrajności (mnożnik)
   - Wysokie poparcie (>70%): zmniejsza skrajności (mnożnik)
   - Średnie poparcie (30-70%): neutralny wpływ

3. **Kombinacja**:

   - `deviation = (propaganda_weight × propaganda_avg) + (support_influence × support_modifier)`
   - Normalizacja do zakresu -100 do +100

### Wizualizacja gauge

- Tarcza półkolista z zakresem -100 (LEFT) do +100 (RIGHT)
- Igła wskazująca aktualne odchylenie
- Etykiety: FAR LEFT, LEFT, CENTER, RIGHT, FAR RIGHT
- Kolor igły zmienia się w zależności od odchylenia (niebieski→zielony→żółty→pomarańczowy→czerwony)

## Pliki do modyfikacji

1. `js/ideology.js` - NOWY PLIK
2. `js/config.js` - dodanie sekcji IDEOLOGY
3. `index.html` - dodanie HTML dla gauge
4. `css/components.css` - style dla gauge
5. `js/purchases.js` - aktywacja systemu
6. `js/offline.js` - zapis/ładowanie stanu
7. `js/ui.js` lub `script.js` - integracja z updateUI
8. `js/achievements.js` - achievementy

## Kolejność implementacji

1. Utworzenie modułu `js/ideology.js` z logiką obliczania
2. Dodanie konfiguracji do `config.js`
3. Dodanie HTML i CSS dla gauge
4. Integracja z systemem zakupów (aktywacja)
5. Integracja z UI (aktualizacja gauge)
6. Integracja z zapisem/ładowaniem
7. Dodanie achievementów
8. Testowanie i balansowanie

## Status zadań

- [ ] Utworzenie modułu `js/ideology.js` z funkcjami obliczania odchylenia ideologicznego
- [ ] Dodanie sekcji IDEOLOGY do `js/config.js` z parametrami balansowania
- [ ] Dodanie HTML dla gauge w `index.html` pod paskiem poparcia
- [ ] Dodanie stylów CSS dla gauge w `css/components.css`
- [ ] Integracja z `js/purchases.js` - aktywacja systemu po zakupie pierwszego MASA
- [ ] Integracja z `updateUI()` - wywołanie `updateIdeologyGauge()`
- [ ] Dodanie `ideologySystem` do `saveGame()` i `loadGame()` w `js/offline.js`
- [ ] Dodanie achievementów w `js/achievements.js`
