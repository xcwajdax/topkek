# System Ludzików w Lewym Panelu

## Przegląd

System animowanych postaci dla każdego typu STAFF (troll, conspiracy theorist, influencer, press, politician, billionaire, supreme court justice), które pojawiają się w lewym panelu na dole i poruszają się losowo. Ilość ludzików każdego typu zależy od liczby kupionych upgrade'ów danego typu. System dużych ludzików: gdy masz 50+ jednostek danego typu, pojawia się 1 duży ludzik zamiast 50 małych (np. 75 troli = 1 duży troll + 25 małych troli).

## Struktura plików

### Nowe pliki

- `js/staff_walkers.js` - główny moduł systemu ludzików
  - Klasa `StaffWalker` - reprezentuje pojedynczego ludzika (mały lub duży)
  - Klasa `StaffWalkersManager` - zarządza wszystkimi ludzikami wszystkich typów
  - Integracja z `requestAnimationFrame` (podobnie jak `background_layers.js`)
  - Aktualizacja ilości ludzików na podstawie wszystkich upgrade'ów STAFF:
    - `troll.01` - Troll
    - `conspiracy_theorist.02` - Conspiracy Theorist
    - `influencer.03` - Social Media Influencer
    - `press.04` - Corrupt Journalist
    - `politician.05` - Corrupt Politician
    - `billionaire.06` - Useful Idiot
    - `supreme_court_justice.09` - Supreme Court Justice

### Modyfikacje istniejących plików

#### `js/config.js`

- Dodanie sekcji `STAFF_WALKERS` z parametrami:
  - `BIG_WALKER_THRESHOLDS` - obiekt z progami dla dużych ludzików dla każdego typu STAFF:
    ```javascript
    BIG_WALKER_THRESHOLDS: {
      'troll.01': 50,                    // Troll - próg 50
      'conspiracy_theorist.02': 30,     // Conspiracy Theorist - próg 30
      'influencer.03': 20,              // Influencer - próg 20
      'press.04': 15,                   // Press - próg 15
      'politician.05': 10,              // Politician - próg 10
      'billionaire.06': 5,              // Billionaire - próg 5
      'supreme_court_justice.09': 3     // Supreme Court Justice - próg 3
    }
    ```

  - `BIG_WALKER_SCALES` - obiekt ze skalą dużych ludzików dla każdego typu STAFF:
    ```javascript
    BIG_WALKER_SCALES: {
      'troll.01': 2.0,                  // Troll - 2.0x większy
      'conspiracy_theorist.02': 2.2,    // Conspiracy Theorist - 2.2x większy
      'influencer.03': 2.3,             // Influencer - 2.3x większy
      'press.04': 2.4,                  // Press - 2.4x większy
      'politician.05': 2.5,             // Politician - 2.5x większy
      'billionaire.06': 2.8,            // Billionaire - 2.8x większy
      'supreme_court_justice.09': 3.0   // Supreme Court Justice - 3.0x większy
    }
    ```

  - `SPRITE_SHEETS` - obiekt mapujący typy STAFF na ścieżki sprite sheet:
    ```javascript
    SPRITE_SHEETS: {
      'troll.01': 'ASSETS/CREW/troll_01.png',
      'conspiracy_theorist.02': 'ASSETS/CREW/conspiracy_theorist_01.png',
      'influencer.03': 'ASSETS/CREW/influencer_01.png',
      'press.04': 'ASSETS/CREW/press_01.png',
      'politician.05': 'ASSETS/CREW/politician_01.png',
      'billionaire.06': 'ASSETS/CREW/billionaire_01.png',
      'supreme_court_justice.09': 'ASSETS/CREW/supreme_court_justice_01.png'
    }
    ```

  - `SPRITE_WIDTH`, `SPRITE_HEIGHT` - rozmiar pojedynczej klatki (wspólny dla wszystkich)
  - `FRAMES_COUNT` - liczba klatek (2: idle, walk) - wspólne dla wszystkich
  - `ANIMATION_SPEED` - szybkość animacji (zmiana klatek)
  - `WALK_SPEED_MIN`, `WALK_SPEED_MAX` - zakres prędkości poruszania
  - `STEP_DISTANCE` - odległość jednego kroku
  - `CHANGE_DIRECTION_CHANCE` - szansa na zmianę kierunku
  - `VERTICAL_MOVEMENT_CHANCE` - szansa na ruch w górę/dół
  - `SPAWN_Y_POSITION` - pozycja Y na dole panelu (w %)
  - `MIN_SPAWN_X`, `MAX_SPAWN_X` - zakres pozycji X
  - `Z_INDEX` - warstwa renderowania (niska, w tle)
  - `SCALE_SMALL` - skala małych ludzików (wspólna dla wszystkich typów)
  - `COLOR_VARIATION` - parametry wariacji kolorów dla każdego ludzika:
    - `HUE_ROTATE_MIN`, `HUE_ROTATE_MAX` - zakres obrotu odcienia (w stopniach, np. -30 do 30)
    - `BRIGHTNESS_MIN`, `BRIGHTNESS_MAX` - zakres jasności (np. 0.8 do 1.2)
    - `SATURATE_MIN`, `SATURATE_MAX` - zakres nasycenia (np. 0.9 do 1.1)

#### `css/components.css` lub `css/systems.css`

- Style dla `.staff-walker`:
  - `position: absolute`
  - `image-rendering: pixelated`
  - `pointer-events: none`
  - `z-index` zgodny z konfiguracją
  - `transform-origin` dla animacji sprite sheet
  - `filter` - ustawiany dynamicznie przez JavaScript z wariacjami kolorów (hue-rotate, brightness, saturate)
- Style dla `.staff-walker.big`:
  - Większa skala (ustawiana dynamicznie przez JavaScript zgodnie z `BIG_WALKER_SCALES` dla danego typu)
  - Możliwe dodatkowe efekty wizualne (np. cień, outline)

#### `js/offline.js`

- Dodanie do `saveGame()`: zapis stanu ludzików (pozycje, kierunki, wariacje kolorów)
- Dodanie do `loadGame()`: przywrócenie stanu ludzików wraz z ich wariacjami kolorów
- Struktura zapisu dla każdego ludzika:
  ```javascript
  {
    id: string,
    staffType: string,
    isBig: boolean,
    x: number,
    y: number,
    direction: string,
    colorVariant: { hueRotate: number, brightness: number, saturate: number }
  }
  ```

#### `index.html`

- Dodanie kontenera dla ludzików w lewym panelu:
  ```html
  <div id="staff-walkers-container" class="staff-walkers-container"></div>
  ```
  Umieścić w `.left-panel`, przed innymi elementami UI (niski z-index).

#### `script.js` lub odpowiedni plik inicjalizacyjny

- Wywołanie `initStaffWalkers()` po załadowaniu gry
- Subskrypcja na zmiany wszystkich upgrade'ów STAFF w `GameStore`:
  - `troll.01`, `conspiracy_theorist.02`, `influencer.03`, `press.04`, `politician.05`, `billionaire.06`, `supreme_court_justice.09`
- Aktualizacja ilości ludzików przy zakupie/sprzedaży każdego typu STAFF

## Implementacja szczegółowa

### Klasa StaffWalker

- Właściwości:
  - `id` - unikalny identyfikator
  - `staffType` - typ STAFF (np. `'troll.01'`, `'conspiracy_theorist.02'`)
  - `isBig` - czy to duży ludzik (true/false)
  - `x`, `y` - pozycja (w px lub %)
  - `direction` - kierunek ruchu (`'left'`, `'right'`, `'up'`, `'down'`)
  - `currentFrame` - aktualna klatka animacji (0 = idle, 1 = walk)
  - `frameProgress` - postęp animacji
  - `walkProgress` - postęp ruchu (0-1)
  - `isMoving` - czy aktualnie się porusza
  - `element` - referencja do DOM elementu
  - `spriteSheetPath` - ścieżka do sprite sheet dla tego typu
  - `colorVariant` - obiekt z losowymi wartościami wariacji kolorów:
    - `hueRotate` - losowa wartość obrotu odcienia (stopnie)
    - `brightness` - losowa wartość jasności
    - `saturate` - losowa wartość nasycenia

- Metody:
  - `init(container)` - tworzy element DOM, ustawia sprite sheet dla danego typu, generuje losowe wariacje kolorów
  - `generateColorVariant()` - generuje losowe wartości wariacji kolorów na podstawie konfiguracji
  - `applyColorVariant()` - aplikuje CSS filter z wariacjami kolorów do elementu DOM
  - `update(deltaTime)` - aktualizuje pozycję i animację
  - `changeDirection()` - losowo zmienia kierunek
  - `move(deltaTime)` - wykonuje ruch o jeden krok
  - `updateAnimation(deltaTime)` - zmienia klatki sprite sheet
  - `destroy()` - usuwa element z DOM

### Klasa StaffWalkersManager

- Właściwości:
  - `walkers` - tablica aktywnych ludzików wszystkich typów
  - `container` - kontener DOM
  - `animationFrameId` - ID requestAnimationFrame
  - `targetCounts` - obiekt z docelową liczbą ludzików dla każdego typu:
    ```javascript
    {
      'troll.01': { small: 25, big: 1 },
      'conspiracy_theorist.02': { small: 10, big: 0 },
      // ... dla wszystkich typów
    }
    ```

- Metody:
  - `init()` - inicjalizacja, znajdowanie kontenera
  - `start()` - rozpoczyna pętlę animacji
  - `stop()` - zatrzymuje pętlę
  - `animate()` - główna pętla requestAnimationFrame
  - `updateCounts()` - aktualizuje liczbę ludzików na podstawie wszystkich upgrade'ów STAFF
  - `calculateWalkerCounts(count, staffType)` - oblicza ile małych i dużych ludzików dla danego typu:
    - Pobiera próg z `BIG_WALKER_THRESHOLDS[staffType]`
    - Jeśli `count >= threshold`: `big = Math.floor(count / threshold)`, `small = count % threshold`
    - Przykład: 75 troli, threshold=50 → `big = 1`, `small = 25`
    - Przykład: 8 supreme court justices, threshold=3 → `big = 2`, `small = 2`
  - `spawnWalker(staffType, isBig)` - tworzy nowego ludzika (małego lub dużego)
  - `removeWalker(id)` - usuwa ludzika
  - `updateTypeCount(staffType, count)` - aktualizuje ludzików dla konkretnego typu

### Sprite Sheets

- Na ten moment wszystkie typy STAFF używają tego samego przykładowego sprite'a trolla (tymczasowo).
- Docelowo każdy typ otrzyma własny sprite po uznaniu, że system działa wystarczająco dobrze.

- Format: osobny sprite sheet dla każdego typu STAFF
- Każdy sprite sheet: poziomy układ z 2 klatkami
- Klatka 0: idle (stoi)
- Klatka 1: walk (idzie)
- Użycie `background-position` w CSS do wyświetlania odpowiedniej klatki
- Struktura folderów: `ASSETS/CREW/` z plikami:
  - `troll_01.png` (już istnieje)
  - `conspiracy_theorist_01.png`
  - `influencer_01.png`
  - `press_01.png`
  - `politician_01.png`
  - `billionaire_01.png`
  - `supreme_court_justice_01.png`

### Animacja ruchu

- Ruch o jeden krok (`STEP_DISTANCE`)
- Po zakończeniu kroku: szansa na zmianę kierunku lub kontynuację
- Głównie ruch poziomy, czasem w górę/dół (zgodnie z `VERTICAL_MOVEMENT_CHANCE`)
- Animacja sprite: przełączanie między klatkami podczas ruchu

### System wariacji kolorów

- Każdy ludzik otrzymuje losowe wariacje kolorów przy tworzeniu
- Implementacja przez CSS `filter` z trzema właściwościami:
  - `hue-rotate()` - zmiana odcienia (np. -30deg do 30deg)
  - `brightness()` - zmiana jasności (np. 0.8 do 1.2)
  - `saturate()` - zmiana nasycenia (np. 0.9 do 1.1)
- Przykładowy CSS filter: `filter: hue-rotate(15deg) brightness(0.95) saturate(1.05)`
- Wartości są generowane losowo z zakresów zdefiniowanych w `COLOR_VARIATION` w konfiguracji
- Wariacje są zapisywane w `colorVariant` dla każdego ludzika (dla zapisu/ładowania stanu)
- Każdy ludzik ma unikalny wygląd, zachowując podstawowy sprite

### Integracja z systemem STAFF

- Subskrypcja na zmiany wszystkich upgrade'ów STAFF w `GameStore`
- Dla każdego typu STAFF:
  - Przy zakupie: dodanie nowych ludzików (małych lub dużych w zależności od ilości)
  - Przy sprzedaży: usunięcie nadmiarowych ludzików
  - Przeliczanie dużych/małych ludzików przy każdej zmianie ilości
- Płynne pojawianie/znikanie (fade in/out)
- Logika dużych ludzików (indywidualna dla każdego typu):
  - Każdy typ STAFF ma swój własny próg z `BIG_WALKER_THRESHOLDS[staffType]`
  - Jeśli `count >= threshold`:
    - `bigCount = Math.floor(count / threshold)`
    - `smallCount = count % threshold`
  - Przykłady:
    - 75 troli, threshold=50 → 1 duży + 25 małych
    - 150 troli, threshold=50 → 3 duże + 0 małych
    - 8 supreme court justices, threshold=3 → 2 duże + 2 małe
    - 12 politicians, threshold=10 → 1 duży + 2 małe
  - Każdy typ ma również własną skalę dużych ludzików z `BIG_WALKER_SCALES[staffType]`

## Zależności

- `GameStore` - do śledzenia liczby wszystkich upgrade'ów STAFF
- `UPGRADE_DEFINITIONS` - do mapowania typów STAFF
- `requestAnimationFrame` - do animacji
- `GAME_CONFIG` - do konfiguracji parametrów

## Uwagi techniczne

- Ludziki nie są klikalne (`pointer-events: none`)
- Renderowanie w tle (niski z-index)
- Optymalizacja: limit maksymalnej liczby ludzików na ekranie (np. 100 łącznie dla wszystkich typów)
- Sprite sheets powinny być w folderze `ASSETS/CREW/` z konwencją nazewnictwa: `{staff_type}_01.png`
- Duże ludziki mają wyższy priorytet renderowania (wyświetlane na wierzchu małych)
- Każdy typ STAFF ma indywidualne parametry:
  - Własny próg dla dużych ludzików (`BIG_WALKER_THRESHOLDS`)
  - Własną skalę dużych ludzików (`BIG_WALKER_SCALES`)
  - Możliwość rozszerzenia o inne parametry (prędkość, rozmiar) - rozszerzalne w konfiguracji
- **System wariacji kolorów**: Każdy ludzik otrzymuje losowe wartości CSS filter (hue-rotate, brightness, saturate) przy tworzeniu, co zapewnia wizualną różnorodność bez potrzeby tworzenia wielu wariantów sprite'ów. Wartości są generowane losowo z zakresów zdefiniowanych w konfiguracji i zapisywane w `colorVariant` dla każdego ludzika.
