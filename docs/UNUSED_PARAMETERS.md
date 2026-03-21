# Niewykorzystane Parametry i Funkcje

Ten dokument śledzi wszystkie parametry, funkcje i właściwości, które są zdefiniowane w systemach gry, ale nie są jeszcze wykorzystywane w logice aplikacji.

## System: Tower Floors (`js/data_tower_floors.js`, `js/tower.js`)

### Funkcje niewykorzystane

#### `getTowerComboModifiers()`
- **Status**: NIEZIMPLEMENTOWANE
- **Lokalizacja**: `js/tower.js:265-284`
- **Opis**: Funkcja zwraca obiekt z `durationMultiplier` i `criticalChance`, ale nigdy nie jest wywoływana w kodzie.
- **Zwracane wartości**:
  - `durationMultiplier: 1.0` - mnożnik czasu trwania combo (domyślnie 1.0, zwiększany przez efekt `combo_duration`)
  - `criticalChance: 0.0` - bonusowa szansa na krytyka (dodawana przez efekt `critical_chance`)
- **Pomysł na implementację**:
  - `durationMultiplier` → zastosować w `comboSystem.maxTime` podczas inicjalizacji combo w `script.js` (funkcja `handleActClick()`)
    - Przykład: `comboSystem.maxTime = GAME_CONFIG.COMBO.INITIAL_MAX_TIME * towerComboModifiers.durationMultiplier`
  - `criticalChance` → dodać do `rollCriticalHit()` w `script.js` jako bonus do szansy krytyka
    - Przykład: zwiększyć `CRITICAL_CONFIG.X2_CHANCE`, `X3_CHANCE`, `X5_CHANCE` o wartość `criticalChance`
- **Zależności**: 
  - Wymaga modyfikacji `script.js`:
    - Funkcja `handleActClick()` - zastosować `durationMultiplier` przy inicjalizacji combo
    - Funkcja `rollCriticalHit()` - dodać bonus `criticalChance` do szans krytyka
  - Możliwe że wymaga modyfikacji `js/combo.js` jeśli istnieje osobny plik dla combo systemu

#### `getTowerSupportModifiers()`
- **Status**: NIEZIMPLEMENTOWANE
- **Lokalizacja**: `js/tower.js:243-262`
- **Opis**: Funkcja zwraca obiekt z `maxSupportBoost` i `decayReduction`, ale nigdy nie jest wywoływana w kodzie.
- **Zwracane wartości**:
  - `maxSupportBoost: 0` - bonus do maksymalnego wsparcia politycznego (domyślnie 0, zwiększany przez efekt `support_boost`)
  - `decayReduction: 1.0` - redukcja utraty wsparcia przy kliknięciu (domyślnie 1.0, zmniejszana przez efekt `support_decay_reduction`)
- **Pomysł na implementację**:
  - `maxSupportBoost` → zwiększyć maksymalne wsparcie powyżej 100% (np. 100% + boost)
    - Przykład: w `js/support.js` funkcja `updateSupport()` - zmienić limit z 100 na `100 + maxSupportBoost`
    - Również w `calculateSupportRegeneration()` - zmienić warunek `if (currentSupport >= 100)`
  - `decayReduction` → zastosować w `suppressAct()` w `script.js` jako redukcja utraty wsparcia przy kliknięciu
    - Przykład: `reductionAmount *= towerSupportModifiers.decayReduction` przed wywołaniem `updateSupport()`
- **Zależności**:
  - Wymaga modyfikacji `script.js`:
    - Funkcja `suppressAct()` - zastosować `decayReduction` przy obliczaniu redukcji wsparcia
  - Wymaga modyfikacji `js/support.js`:
    - Funkcja `updateSupport()` - zwiększyć limit wsparcia o `maxSupportBoost`
    - Funkcja `calculateSupportRegeneration()` - uwzględnić zwiększony limit wsparcia

### Parametry niewykorzystane

#### `target` w `TOWER_FLOOR_EFFECTS`
- **Status**: CZĘŚCIOWO WYKORZYSTANY (tylko w opisach, nie w logice)
- **Lokalizacja**: `js/data_tower_floors.js:80-190`
- **Opis**: Każdy efekt w `TOWER_FLOOR_EFFECTS` ma właściwość `target` (np. `'aps'`, `'apc'`, `'buildings'`, `'max_support'`), ale nie jest używana w logice aplikacji efektów. Obecnie kategoryzacja efektów odbywa się przez hardcodowane `if/else` w funkcji `getTowerSystemEffects()` w `js/support.js`.
- **Pomysł**: Można użyć `target` do automatycznej kategoryzacji efektów zamiast hardcodowanych `if/else`
  - Przykład: w `getTowerSystemEffects()` użyć `effect.target` do automatycznego przypisania efektu do odpowiedniej kategorii
  - To uprościłoby kod i uczyniło go bardziej skalowalnym
- **Zależności**: 
  - Wymaga refaktoryzacji `js/support.js` - funkcja `getTowerSystemEffects()`
  - Możliwe że wymaga modyfikacji innych miejsc gdzie efekty są kategoryzowane

#### `storyTemplate` w `TOWER_FLOOR_TYPES`
- **Status**: PLANOWANE
- **Lokalizacja**: `js/data_tower_floors.js:5-48`
- **Opis**: Wszystkie typy pięter mają `storyTemplate: 'generic'`, a w `FLOOR_STORY_TEMPLATES` zdefiniowany jest tylko szablon `'generic'`. W komentarzu jest napisane "W przyszłości: 'residential', 'office', 'luxury', etc."
- **Pomysł**: Dodać unikalne szablony dla każdego typu piętra (residential, office, luxury, industrial, surveillance, propaganda)
  - Każdy szablon powinien mieć unikalny styl narracji pasujący do typu piętra
  - Przykład: `residential` - opowieść o mieszkańcach, `office` - o biurokracji, `surveillance` - o monitoringu
- **Zależności**:
  - Wymaga rozszerzenia `FLOOR_STORY_TEMPLATES` w `js/data_tower_floors.js`
  - Funkcja `generateFloorStory()` w `js/tower.js` już obsługuje różne szablony, więc nie wymaga modyfikacji

---

## System: Damage Control (`js/damage_control.js`, `js/config.js`)

### Informacje o augmentach

#### Augment odblokowujący Damage Control
- **Augment ID**: `supreme_court_justice.09_aug3` (wcześniej `troll.01_aug3`, jeszcze wcześniej `influencer.03_aug3`)
- **Status**: ZIMPLEMENTOWANE (2026-01-XX)
- **Lokalizacja**: `js/augments.js`
- **Opis**: Augment "Damage Control" odblokowuje się po zakupie 1 Supreme Court Justice (upgrade `supreme_court_justice.09`). System został przeniesiony z Troll do Supreme Court Justice.

### Parametry niewykorzystane

#### `MAX_ACTIVE_ICONS` w `DAMAGE_CONTROL`
- **Status**: PLANOWANE
- **Lokalizacja**: `js/config.js` (brak w konfiguracji)
- **Opis**: Maksymalna liczba aktywnych ikon na ekranie jednocześnie. Obecnie nie ma limitu - ikony są spawnowane przy każdym kliknięciu suppress-btn.
- **Pomysł**: Dodać limit aktywnych ikon (np. 5-10) aby uniknąć przeładowania ekranu. Gdy limit zostanie osiągnięty, nowe ikony nie będą spawnowane aż któraś nie zostanie złapana lub spadnie.
- **Zależności**:
  - Wymaga modyfikacji `js/damage_control.js`:
    - Funkcja `spawnActIcon()` - sprawdzić liczbę aktywnych ikon przed spawnem
    - Funkcja `updateActIcons()` - sprawdzić limit przed aktualizacją

#### `ICON_LIFETIME` w `DAMAGE_CONTROL`
- **Status**: PLANOWANE
- **Lokalizacja**: `js/config.js` (brak w konfiguracji)
- **Opis**: Czas życia ikony w sekundach - po tym czasie ikona automatycznie znika jeśli nie zostanie złapana.
- **Pomysł**: Dodać timer dla każdej ikony. Po upływie czasu życia (np. 10-15 sekund) ikona automatycznie znika bez odzyskania supportu.
- **Zależności**:
  - Wymaga modyfikacji `js/damage_control.js`:
    - Struktura ikony - dodać `spawnTime: Date.now()`
    - Funkcja `updateActIcons()` - sprawdzić czas życia i usunąć stare ikony

#### `ICON_TYPES` w `DAMAGE_CONTROL`
- **Status**: PLANOWANE
- **Lokalizacja**: `js/config.js` (brak w konfiguracji)
- **Opis**: Różne typy ikon z różnymi wartościami odzysku supportu. Obecnie wszystkie ikony mają taką samą wartość.
- **Pomysł**: Dodać różne typy ikon (np. "common", "rare", "epic") z różnymi procentami odzysku:
  - Common: 10% (bazowy)
  - Rare: 25%
  - Epic: 50%
- **Zależności**:
  - Wymaga modyfikacji `js/damage_control.js`:
    - Struktura ikony - dodać `type: 'common' | 'rare' | 'epic'`
    - Funkcja `spawnActIcon()` - losować typ ikony z wagami
    - Funkcja `getEffectiveRecoveryPercent()` - uwzględnić typ ikony
  - Wymaga modyfikacji `css/components.css` - różne kolory dla różnych typów

#### `COMBO_SYSTEM` w `DAMAGE_CONTROL`
- **Status**: PLANOWANE
- **Lokalizacja**: `js/config.js` (brak w konfiguracji)
- **Opis**: System combo dla łapania wielu ikon z rzędu - bonus do odzysku supportu za combo.
- **Pomysł**: Dodać system combo który zwiększa procent odzysku za każde kolejne złapanie w krótkim czasie:
  - 2 ikony z rzędu: +5% do odzysku
  - 3 ikony z rzędu: +10% do odzysku
  - 4+ ikony z rzędu: +15% do odzysku
  - Combo resetuje się po 3 sekundach bez złapania
- **Zależności**:
  - Wymaga modyfikacji `js/damage_control.js`:
    - Struktura `gameState.damageControl` - dodać `comboCount: 0`, `lastCatchTime: 0`
    - Funkcja `catchIcon()` - zwiększyć combo i zaktualizować timer
    - Funkcja `getEffectiveRecoveryPercent()` - uwzględnić bonus combo
    - Funkcja `updateActIcons()` - resetować combo po timeout

---

## System: Combo System (`script.js`, `js/config.js`)

### Informacje o augmentach

#### Augment odblokowujący Combo System
- **Augment ID**: `conspiracy_theorist.02_aug3`
- **Status**: ZIMPLEMENTOWANE (2025-01-XX)
- **Lokalizacja**: `js/augments.js`
- **Opis**: Augment "Combo System" odblokowuje się po zakupie 2 Conspiracy Theorist (upgrade `conspiracy_theorist.02`). System został przeniesiony z domyślnego stanu (zawsze dostępny) do augmentu.
- **Efekty augmentu**:
  - Poziom 1: +0.2s do combo time, -0.01s time decay reduction
  - Poziom 2: +0.4s do combo time, -0.02s time decay reduction
  - ... (każdy poziom: +0.2s i -0.01s więcej)
  - Maksymalny poziom: 10

### Parametry niewykorzystane

#### `baseBonusValueTime` i `baseBonusValueDecay` w augmentach
- **Status**: ZIMPLEMENTOWANE (2025-01-XX)
- **Lokalizacja**: `js/augments.js` - augment `conspiracy_theorist.02_aug3`
- **Opis**: Parametry określające bonusy z augmentu Combo System. `baseBonusValueTime` to sekundy dodawane do INITIAL_MAX_TIME na poziom, `baseBonusValueDecay` to sekundy odejmowane z TIME_DECAY na poziom.
- **Użycie**: Wykorzystywane w funkcji `getComboSystemBonuses()` w `script.js` do obliczania efektywnych wartości combo systemu.

---

## TEMPLATE: Szablon dla nowych systemów

Skopiuj poniższy szablon i wypełnij dla każdego nowego systemu:

```markdown
## System: [Nazwa Systemu] (`[ścieżka/do/pliku_data.js]`, `[ścieżka/do/pliku_logika.js]`)

### Funkcje niewykorzystane

#### `[nazwa_funkcji]()`
- **Status**: NIEZIMPLEMENTOWANE / PLANOWANE / CZĘŚCIOWO WYKORZYSTANY
- **Lokalizacja**: `[ścieżka:linia_start-linia_end]`
- **Opis**: [Krótki opis co robi funkcja i dlaczego nie jest używana]
- **Zwracane wartości**: [Co zwraca funkcja]
- **Pomysł na implementację**: [Jak można wykorzystać tę funkcję]
- **Zależności**: [Jakie pliki/funkcje trzeba zmodyfikować]

### Parametry niewykorzystane

#### `[nazwa_parametru]` w `[nazwa_obiektu/struktury]`
- **Status**: NIEZIMPLEMENTOWANE / PLANOWANE / CZĘŚCIOWO WYKORZYSTANY
- **Lokalizacja**: `[ścieżka:linia]`
- **Opis**: [Krótki opis parametru]
- **Pomysł**: [Jak można wykorzystać ten parametr]
- **Zależności**: [Jakie pliki/funkcje trzeba zmodyfikować]

### Nowa waluta (jeśli dotyczy)

#### `[nazwa_waluty]`
- **Status**: NIEZIMPLEMENTOWANE / PLANOWANE / CZĘŚCIOWO WYKORZYSTANY
- **Lokalizacja w gameState**: `gameState.[ścieżka]`
- **Opis**: [Opis waluty, jak jest zdobywana/wydawana]
- **Zapis w saveGame**: TAK / NIE / DO DODANIA
- **Zapis w loadGame**: TAK / NIE / DO DODANIA
- **Zapis w offline.js**: TAK / NIE / DO DODANIA
- **Miejsca użycia**:
  - [ ] [Miejsce 1 - zaimplementowane/niezaimplementowane]
  - [ ] [Miejsce 2 - zaimplementowane/niezaimplementowane]
- **Pomysł na implementację**: [Jak waluta powinna być wykorzystywana]
- **Zależności**: [Jakie pliki/funkcje trzeba zmodyfikować]
```

---

## Legenda statusów

- **NIEZIMPLEMENTOWANE**: Parametr/funkcja jest zdefiniowana, ale w ogóle nie jest używana w kodzie
- **PLANOWANE**: Parametr/funkcja jest zaplanowana do implementacji w przyszłości (może być częściowo zdefiniowana)
- **CZĘŚCIOWO WYKORZYSTANY**: Parametr/funkcja jest używana w niektórych miejscach, ale nie we wszystkich miejscach gdzie powinna być
- **ZIMPLEMENTOWANE**: Parametr/funkcja została w pełni zaimplementowana (z datą implementacji)

---

## Historia zmian

- **2025-01-XX**: Utworzono dokumentację dla systemu Tower Floors
- [Dodaj tutaj kolejne wpisy gdy implementujesz parametry lub dodajesz nowe systemy]

