---
name: staff-walkers-random-sprites
overview: Przerobienie systemu staff walkers na losowanie losowych sprite'ów z puli dla każdego typu staff, z obsługą do 5 póz i konfigurowalnymi regułami użycia dodatkowych pozy.
todos:
  - id: "1"
    content: Dodać konfigurację POSE_RULES i parametry wykrywania sprite'ów do js/config.js
    status: pending
  - id: "2"
    content: Zaimplementować metodę discoverAvailableSprites() w StaffWalkersManager do automatycznego wykrywania dostępnych sprite'ów
    status: pending
  - id: "3"
    content: Zmienić resolveSpriteSheetPath() na resolveSpriteSheet() z losowaniem z puli i zapisem spriteNumber
    status: pending
  - id: "4"
    content: Dodać metodę detectPoseCount() do wykrywania liczby póz z szerokości sprite sheet
    status: pending
  - id: "5"
    content: Dodać metodę loadPoseRules() do ładowania reguł pozy z config dla danego sprite'a
    status: pending
  - id: "6"
    content: Rozszerzyć updateAnimation() o obsługę pozy 3, 4, 5 zgodnie z regułami
    status: pending
  - id: "7"
    content: Dodać śledzenie idleTime i lastDirectionChange w move() dla reguł pozy
    status: pending
  - id: "8"
    content: Dodać spriteNumber do getSaveState() i constructor() dla zapisu/ładowania stanu
    status: pending
isProject: false
---

# Plan: System losowych sprite'ów dla Staff Walkers

## Cel

Przerobienie systemu staff walkers tak, aby:

- Losował losowy sprite z puli dla danego typu staff (np. crew_troll_01.png, crew_troll_02.png)
- Automatycznie wykrywał dostępne sprite'y na podstawie wzorca nazwy
- Obsługiwał sprite'y z różną liczbą póz (2-5)
- Każdy sprite miał własne reguły kiedy używać pozy 3, 4, 5

## Zmiany w plikach

### js/staff_walkers.js

**Klasa StaffWalker:**

- Dodanie właściwości `spriteNumber` - numer wybranego sprite'a (zapisywany w save state)
- Dodanie właściwości `totalPoses` - liczba dostępnych póz dla danego sprite'a (wykrywana automatycznie)
- Dodanie właściwości `poseRules` - reguły użycia pozy 3, 4, 5 dla danego sprite'a
- Dodanie właściwości `currentPose` - aktualna pozy (0-4)
- Dodanie właściwości `idleTime` - czas stania (dla reguł pozy 3)
- Dodanie właściwości `lastDirectionChange` - czas ostatniej zmiany kierunku (dla reguł pozy 4)

**Zmiany w metodach:**

- `resolveSpriteSheetPath()` → `resolveSpriteSheet()` - zmiana na losowanie z puli dostępnych sprite'ów
- `init()` - aktualizacja do wykrywania liczby póz z szerokości sprite sheet i ładowania reguł z config
- `updateAnimation()` - rozszerzenie o obsługę pozy 3, 4, 5 zgodnie z regułami
- `move()` - dodanie śledzenia czasu stania i zmiany kierunku dla reguł pozy
- `getSaveState()` - dodanie `spriteNumber` do zapisu
- `constructor()` - przywracanie `spriteNumber` z savedState

**Nowe metody:**

- `discoverAvailableSprites(staffType, isBig)` - statyczna metoda do wykrywania dostępnych sprite'ów
- `loadPoseRules(spriteNumber, staffType)` - ładowanie reguł pozy z config
- `detectPoseCount(spritePath)` - wykrywanie liczby póz z szerokości sprite sheet (async)
- `shouldUsePose(poseIndex)` - sprawdzanie czy użyć danej pozy na podstawie reguł
- `updatePose()` - aktualizacja aktualnej pozy na podstawie stanu i reguł

**Klasa StaffWalkersManager:**

- Dodanie cache'u dostępnych sprite'ów: `availableSpritesCache = {}`
- Metoda `getAvailableSprites(staffType, isBig)` - zwraca listę dostępnych sprite'ów (z cache)
- Inicjalizacja cache przy starcie systemu

### js/config.js

**Dodanie do STAFF_WALKERS:**

- `SPRITE_PATTERN` - wzorzec nazwy sprite'a (np. `'ASSETS/CREW/crew_{type}_{number}.png'`)
- `SPRITE_NUMBER_FORMAT` - format numeru (np. `'01'` dla 2 cyfr)
- `SPRITE_DISCOVERY_MAX` - maksymalna liczba sprite'ów do sprawdzenia (np. 50)

**Dodanie sekcji POSE_RULES:**

```javascript
POSE_RULES: {
    // Przykładowa struktura - każdy sprite może mieć własne reguły
    'troll.01': {
        '01': { // sprite number
            pose3: { condition: 'idle', minTime: 3.0 }, // pozy 3 gdy stoi > 3s
            pose4: { condition: 'direction_change', cooldown: 2.0 }, // pozy 4 przy zmianie kierunku
            pose5: { condition: 'never' } // pozy 5 nieużywana
        },
        '02': {
            pose3: { condition: 'idle', minTime: 5.0 },
            pose4: { condition: 'direction_change', cooldown: 1.5 },
            pose5: { condition: 'random', chance: 0.1 } // 10% szansy przy każdym sprawdzeniu
        }
    }
}
```

**Usunięcie:**

- `SPRITE_SHEETS` - zastąpione przez automatyczne wykrywanie
- `BIG_SPRITE_SHEETS` - zastąpione przez automatyczne wykrywanie
- `FRAMES_COUNT` - zastąpione przez automatyczne wykrywanie z sprite sheet

**Zachowanie:**

- `SPRITE_WIDTH`, `SPRITE_HEIGHT` - nadal używane do obliczeń

### js/offline.js

**Zmiany w saveGame():**

- `staffWalkersState` już istnieje, ale teraz będzie zawierać `spriteNumber` dla każdego walkera

**Zmiany w loadGame():**

- Przywracanie `spriteNumber` z savedState (już obsługiwane przez StaffWalker constructor)

## Logika działania

### Wykrywanie dostępnych sprite'ów

1. Przy inicjalizacji systemu, dla każdego typu staff sprawdzane są dostępne pliki
2. Wzorzec: `ASSETS/CREW/crew_{staffType}_{number}.png` gdzie number to 01, 02, 03...
3. Sprawdzanie odbywa się przez próbę załadowania obrazka (Image object)
4. Wyniki są cache'owane w `StaffWalkersManager.availableSpritesCache`

### Losowanie sprite'a

1. Przy tworzeniu nowego walkera, losowany jest numer z dostępnej puli
2. Numer jest zapisywany w `spriteNumber` i w save state
3. Przy przywracaniu z save, używany jest zapisany numer

### Wykrywanie liczby póz

1. Po załadowaniu sprite sheet, sprawdzana jest jego szerokość
2. `totalPoses = Math.floor(spriteWidth / SPRITE_WIDTH)`
3. Jeśli sprite ma więcej niż 2 pozy, ładowane są reguły z config

### Reguły pozy 3, 4, 5

- **Pose 3**: Używana gdy `condition === 'idle'` i `idleTime >= minTime`
- **Pose 4**: Używana gdy `condition === 'direction_change'` i minęło mniej niż `cooldown` sekund od zmiany
- **Pose 5**: Używana gdy `condition === 'random'` i los < `chance`, lub `condition === 'never'` (nigdy)
- Domyślnie pozy 0 (idle) i 1 (walk) działają jak dotychczas

### Animacja

- Pozy 0-1: jak dotychczas (idle/walk)
- Pozy 2-4: używane zgodnie z regułami, przełączane po spełnieniu warunków
- `currentFrame` w `updateAnimation()` jest ustawiane na podstawie `currentPose` i `isMoving`

## Uwagi implementacyjne

1. Wykrywanie sprite'ów wymaga asynchronicznego ładowania obrazków - użyć Promise.all
2. Cache dostępnych sprite'ów jest inicjalizowany przy starcie systemu
3. Jeśli sprite nie zostanie znaleziony, użyć fallback do pierwszego dostępnego lub domyślnego
4. Reguły pozy są opcjonalne - jeśli nie ma reguł dla danego sprite'a, używać tylko pozy 0-1
5. Wykrywanie liczby póz może wymagać załadowania obrazka - użyć callback lub Promise
