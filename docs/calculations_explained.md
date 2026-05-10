# Obliczenia Bonusów z Augmentów, APC i APS

## Spis treści
1. [Bonusy z Augmentów](#bonusy-z-augmentów)
2. [Obliczanie APS (Acts Per Second)](#obliczanie-aps)
3. [Obliczanie APC (Acts Per Click)](#obliczanie-apc)

---

## Bonusy z Augmentów

### Typy Augmentów

#### 1. Standardowe Augmenty (bez tablicy `effects`)

Standardowe augmenty działają na pojedynczy cel (jeden budynek lub upgrade).

**Obliczanie wartości bonusu:**
- **Zwykłe augmenty**: `bonusValue = baseBonusValue * level`
- **Milestone augmenty**: Suma bonusów wszystkich odblokowanych poziomów
  ```javascript
  totalBonus = 0
  for (i = 1; i <= level; i++) {
      milestone = milestones.find(m => m.level === i)
      if (milestone) totalBonus += milestone.bonusValue
  }
  ```

**Zastosowanie bonusu:**
- **Flat bonus** (`bonusType === 'flat'`): Dodawany do bazowej wartości
  ```
  finalValue = baseValue + flatBonus
  ```
- **Percent bonus** (`bonusType === 'percent'`): Mnożony jako mnożnik procentowy
  ```
  finalValue = baseValue * (1 + bonusValue / 100)
  ```

#### 2. Multi-Target Augmenty (z tablicą `effects`)

Augmenty mogą wpływać na wiele celów jednocześnie poprzez tablicę `effects`.

**Obliczanie wartości efektu:**
```javascript
effectValue = effect.baseBonusValue * (1 + bonusScaling)^(level - 1)
```

Gdzie:
- `bonusScaling` - domyślnie 1.5 (może być zdefiniowane w augmentcie)
- `level` - poziom augmentu

**Przykład dla `baseBonusValue = 10`, `bonusScaling = 1.5`:**
- Poziom 1: `10 * (2.5)^0 = 10`
- Poziom 2: `10 * (2.5)^1 = 25`
- Poziom 3: `10 * (2.5)^2 = 62.5`
- Poziom 4: `10 * (2.5)^3 = 156.25`

**Zastosowanie:**
- Każdy efekt w tablicy `effects` może mieć własny `targetType`, `targetId` i `bonusType`
- Flat bonusy są sumowane
- Percent bonusy są mnożone razem

#### 3. Globalne Bonusy APC

Augmenty z efektem `targetId === 'all_upgrades'` wpływają na wszystkie upgrade'y jednocześnie.

**Obliczanie:**
```javascript
globalAPCMultiplier = 1
for (augment z efektem 'all_upgrades') {
    effectValue = getMultiTargetEffectValue(augment, effectIndex)
    if (bonusType === 'percent') {
        globalAPCMultiplier *= (1 + effectValue / 100)
    }
}
```

**Zastosowanie:**
Globalny mnożnik jest aplikowany do każdego upgrade'a po zastosowaniu jego indywidualnych bonusów:
```
upgradePower = (basePower + flatBonus) * percentMultiplier * globalAPCMultiplier
```

---

## Obliczanie APS

**APS (Acts Per Second)** to pasywna produkcja aktów na sekundę z budynków.

### Krok 1: Bazowa produkcja budynków

Dla każdego budynku:
```javascript
baseProduction = building.production
```

### Krok 2: Zastosowanie bonusów z augmentów

Dla każdego budynku zbierane są wszystkie bonusy z augmentów:

```javascript
flatBonus = 0
percentMultiplier = 1

// Standardowe augmenty
for (augment bez effects) {
    if (augment.targetType === 'buildings' && augment.targetId === buildingId) {
        bonusValue = getAugmentBonusValue(augment)
        if (bonusType === 'flat') {
            flatBonus += bonusValue
        } else if (bonusType === 'percent') {
            percentMultiplier *= (1 + bonusValue / 100)
        }
    }
}

// Multi-target augmenty
for (augment z effects) {
    for (effect w augment.effects) {
        if (effect.targetType === 'buildings' && effect.targetId === buildingId) {
            effectValue = getMultiTargetEffectValue(augment, effectIndex)
            if (effect.bonusType === 'flat') {
                flatBonus += effectValue
            } else if (effect.bonusType === 'percent') {
                percentMultiplier *= (1 + effectValue / 100)
            }
        }
    }
}
```

### Krok 3: Obliczenie efektywnej produkcji

```javascript
effectiveProduction = (baseProduction + flatBonus) * percentMultiplier
```

### Krok 4: Mnożniki specyficzne dla budynków

Niektóre systemy (np. Tower) mogą mieć mnożniki specyficzne dla konkretnych budynków:
```javascript
if (getTowerBuildingProductionMultiplier istnieje) {
    effectiveProduction *= getTowerBuildingProductionMultiplier(buildingId)
}
```

### Krok 5: Sumowanie produkcji wszystkich budynków

```javascript
totalAPS = 0
for (building w buildings) {
    totalAPS += building.count * effectiveProduction
}
```

### Krok 6: Zastosowanie globalnych mnożników

Mnożniki są aplikowane w kolejności:

1. **Political Support APS Multiplier**
   ```javascript
   aps *= getSupportAPSMultiplier()
   ```
   - Wysokie wsparcie (>70%): bonus do +30%
   - Niskie wsparcie (<30%): debuff do -90%

2. **Tower APS Multiplier**
   ```javascript
   aps *= getTowerAPSMultiplier()
   ```

3. **Propaganda APS Multiplier**
   ```javascript
   aps *= getPropagandaAPSMultiplier()
   ```

### Finalna formuła APS

```
APS = Σ(building.count * effectiveProduction) * supportMultiplier * towerMultiplier * propagandaMultiplier

gdzie:
effectiveProduction = (baseProduction + flatBonus) * percentMultiplier * towerBuildingMultiplier
```

---

## Obliczanie APC

**APC (Acts Per Click)** to moc pojedynczego kliknięcia, obliczana na podstawie upgrade'ów.

### Krok 1: Bazowa moc upgrade'ów

Dla każdego upgrade'a:
```javascript
basePower = upgrade.power
```

### Krok 2: Zbieranie globalnych bonusów APC

Najpierw zbierane są globalne bonusy wpływające na wszystkie upgrade'y:
```javascript
globalAPCMultiplier = 1
for (augment z effects) {
    for (effect w augment.effects) {
        if (effect.targetType === 'upgrades' && effect.targetId === 'all_upgrades') {
            effectValue = getMultiTargetEffectValue(augment, effectIndex)
            if (effect.bonusType === 'percent') {
                globalAPCMultiplier *= (1 + effectValue / 100)
            }
        }
    }
}
```

### Krok 3: Zastosowanie bonusów z augmentów dla każdego upgrade'a

Dla każdego upgrade'a zbierane są indywidualne bonusy:

```javascript
flatBonus = 0
percentMultiplier = 1

// Standardowe augmenty
for (augment bez effects) {
    if (augment.targetType === 'upgrades' && augment.targetId === upgradeId) {
        bonusValue = getAugmentBonusValue(augment)
        if (bonusType === 'flat') {
            flatBonus += bonusValue
        } else if (bonusType === 'percent') {
            percentMultiplier *= (1 + bonusValue / 100)
        }
    }
}

// Multi-target augmenty (pomijając 'all_upgrades' - już zastosowane globalnie)
for (augment z effects) {
    for (effect w augment.effects) {
        if (effect.targetType === 'upgrades' && 
            effect.targetId === upgradeId && 
            effect.targetId !== 'all_upgrades') {
            effectValue = getMultiTargetEffectValue(augment, effectIndex)
            if (effect.bonusType === 'flat') {
                flatBonus += effectValue
            } else if (effect.bonusType === 'percent') {
                percentMultiplier *= (1 + effectValue / 100)
            }
        }
    }
}
```

### Krok 4: Obliczenie efektywnej mocy upgrade'a

```javascript
upgradePower = (basePower + flatBonus) * percentMultiplier * globalAPCMultiplier
```

### Krok 5: Sumowanie mocy wszystkich upgrade'ów

```javascript
totalPower = 1  // Bazowa moc
for (upgrade w upgrades) {
    totalPower += upgrade.count * upgradePower
}
```

### Krok 6: Dodanie bonusu z APS

Część obecnego APS jest dodawana do APC:
```javascript
apsBonus = actsPerSecond * GAME_CONFIG.APS_TO_CLICK_POWER_RATIO
power += apsBonus
```

**Uwaga:** W konfiguracji `APS_TO_CLICK_POWER_RATIO` jest obecnie ustawione na `0`, więc ten bonus nie jest aktywny.

### Krok 7: Zastosowanie globalnych mnożników

Mnożniki są aplikowane w kolejności:

1. **Political Support APC Multiplier**
   ```javascript
   power *= getSupportAPCMultiplier()
   ```
   - Wysokie wsparcie (>70%): bonus do +30%
   - Niskie wsparcie (<30%): debuff do -99% (po 10s przy 0%)

2. **Tower APC Multiplier**
   ```javascript
   power *= getTowerAPCMultiplier()
   ```

3. **Propaganda APC Multiplier**
   ```javascript
   power *= getPropagandaAPCMultiplier()
   ```

### Finalna formuła APC

```
APC = floor(max(1, totalPower * supportMultiplier * towerMultiplier * propagandaMultiplier))

gdzie:
totalPower = 1 + Σ(upgrade.count * upgradePower) + (APS * APS_TO_CLICK_POWER_RATIO)
upgradePower = (basePower + flatBonus) * percentMultiplier * globalAPCMultiplier
```

---

## Ważne uwagi

### Kolejność aplikacji bonusów

1. **Flat bonusy** są dodawane do bazowej wartości
2. **Percent bonusy** są mnożone razem (mnożnikowy efekt)
3. **Globalne mnożniki** są aplikowane na końcu

### Przykład obliczeń

**Przykład APS:**
- Budynek: `production = 10`, `count = 5`
- Augment 1: `+5 flat` (flat bonus)
- Augment 2: `+20%` (percent bonus)
- Augment 3: `+10%` (percent bonus)
- Support multiplier: `1.2x`

```
effectiveProduction = (10 + 5) * 1.2 * 1.1 = 19.8
totalAPS = 5 * 19.8 * 1.2 = 118.8
```

**Przykład APC:**
- Upgrade: `power = 50`, `count = 3`
- Augment 1: `+10 flat`
- Augment 2: `+30%`
- Global augment: `+15%` (dla wszystkich upgrade'ów)
- Support multiplier: `1.15x`

```
upgradePower = (50 + 10) * 1.3 * 1.15 = 89.7
totalPower = 1 + 3 * 89.7 = 270.1
APC = floor(270.1 * 1.15) = 310
```

### Funkcje pomocnicze

- `getAugmentBonusValue(augment)` - oblicza wartość bonusu dla standardowego augmentu
- `getMultiTargetEffectValue(augment, effectIndex, level)` - oblicza wartość efektu dla multi-target augmentu
- `getEffectiveBuildingProduction(buildingId)` - oblicza efektywną produkcję budynku
- `getEffectiveUpgradePower(upgradeId)` - oblicza efektywną moc upgrade'a

---

## Lokalizacja kodu

- **Obliczenia APS**: `js/mechanics.js` - funkcja `calculateAPS()`
- **Obliczenia APC**: `js/mechanics.js` - funkcja `calculateClickPower()`
- **Bonusy augmentów**: `js/augments.js` - funkcje `getAugmentBonusValue()` i `getMultiTargetEffectValue()`
- **Konfiguracja**: `js/config.js` - `GAME_CONFIG`
