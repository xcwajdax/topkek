# Glitch volumetryczne – rozbudowa efektu TOPKEK

## 1. Cel

- **Rozszerzyć istniejący efekt** „Glitch volumetryczne” tak, aby:
  - Nadal był lekką **nakładką wizualną** (nie modyfikuje `currentPos`, `velocity`, `gridState`).
  - Oferował **różne patterny** wyboru fragmentów (`bands`, `grid2d`, `clusters`).
  - Miał **bogatsze zachowanie wizualne**: offset + rotacja + skala + opcjonalny color flicker.
  - Był sterowany prostymi **presetami** (subtelny / mocny / chaos) z prawego panelu.

## 2. Konfiguracja – `config.js`

### 2.1. Bazowy config

Rozszerzamy istniejący `GLITCH_VOLUME_CONFIG`:

- **Istniejące pola**:
  - `enabled: boolean` – globalny toggle.
  - `intervalMin: number` – min odstęp auto-triggera (ms).
  - `intervalMax: number` – max odstęp auto-triggera (ms).
  - `duration: number` – czas trwania glitcha (s).
  - `maxOffset: number` – maksymalna wartość przesunięcia (będzie modulowana przez presety).
  - `bandCount: number` – liczba pasów X dla patternu `bands`.
  - `bandsPerGlitch: number` – ile pasów jednocześnie glitchujemy.
  - `includeInnerCubes: boolean` – czy glitch obejmuje też `innerCubeParticles`.

- **Nowe pola ogólne**:
  - `pattern: 'bands' | 'grid2d' | 'clusters'` – aktualny pattern wyboru fragmentów.
  - `useRotation: boolean` – czy w ogóle aplikujemy rotację.
  - `useScale: boolean` – czy aplikujemy skalowanie.
  - `useColorFlicker: boolean` – czy aplikujemy flicker koloru.

- **Parametry rotacji i skali**:
  - `rotationMaxAngle: number` – maksymalny kąt obrotu w radianach (np. π/4).
  - `scaleMin: number` – minimalny mnożnik skali (np. 0.9).
  - `scaleMax: number` – maksymalny mnożnik skali (np. 1.15).

- **Parametry dla `grid2d`**:
  - `gridCols: number` – liczba „kafelków” w osi X (np. 4–6).
  - `gridRows: number` – liczba kafelków w osi Y (np. 3–4).
  - `tilesPerGlitch: number` – ile kafelków wybieramy naraz.

- **Parametry dla `clusters`**:
  - `clusterFraction: number` – ułamek liczby voxeli, które glitchujemy (np. 0.05 = 5%).
  - (opcjonalnie) `clusterMinCount`, `clusterMaxCount` – widełki liczby voxelów niezależne od frakcji.

- **Kolor**:
  - `colorFlickerStrength: number` – jak mocno przyciemniamy/rozjaśniamy kolor (np. 0.2 → ±20%).

### 2.2. Presety

W `config.js` dodajemy:

- `GLITCH_VOLUME_PRESETS` – obiekt z trzema presetami:

  - `subtelny`:
    - Krótki `duration` (np. 0.08–0.10).
    - Mały `maxOffset`.
    - `pattern: 'bands'` lub `'grid2d'`.
    - `bandsPerGlitch` / `tilesPerGlitch` = 1.
    - `useRotation: false`, `useScale: false`, `useColorFlicker: false`.

  - `mocny`:
    - Średni `duration` (np. 0.12–0.16).
    - Większy `maxOffset`.
    - `pattern: 'bands'` lub `'grid2d'`.
    - `bandsPerGlitch` / `tilesPerGlitch` = 2–3.
    - `useRotation: true`, `useScale: true`, `useColorFlicker: false` lub bardzo delikatny.

  - `chaos`:
    - `pattern: 'clusters'`.
    - `clusterFraction` większy (np. 0.1–0.2).
    - Krótszy `duration` (intensywny, ale krótki).
    - Duży `maxOffset`.
    - `useRotation: true`, `useScale: true`, `useColorFlicker: true`.

- Prostą strukturę stanu, np.:
  - `GLITCH_VOLUME_STATE = { currentPreset: 'subtelny' }`
  - albo pole w configu: `preset: 'subtelny' | 'mocny' | 'chaos'`.

**Zasada:** przy zmianie presetu helper w `script.js` („`applyGlitchPreset`”) przepisuje wybrane pola z `GLITCH_VOLUME_PRESETS[x]` do `GLITCH_VOLUME_CONFIG`, tak aby reszta kodu korzystała z jednego, „spłaszczonego” configu.

## 3. Struktura danych w `script.js`

### 3.1. Dodatkowe pola w `cubeGroups`

Dla obiektów logiki przechowywanych w `cubeGroups` (oba miejsca: generacja proceduralna i ładowanie z JSON) dokładamy:

- **Już są:**
  - `glitchDisplayOffset: THREE.Vector3`
  - `glitchEndTime: number`

- **Dodajemy:**
  - `glitchRotation: THREE.Quaternion | null` – losowa rotacja na czas glitcha.
  - `glitchScale: THREE.Vector3 | null` – mnożnik skali (np. (1.05, 1.05, 1.05)).
  - (opcjonalnie) `glitchColorTint: number | null` – np. wartość, o ile ściemnić/rozjaśnić kolor.

Reset tych pól następuje, gdy w renderze wykryjemy `time >= glitchEndTime`.

### 3.2. `innerCubeParticles`

Analogicznie rozbudowujemy obiekty z `innerCubeParticles`:

- `glitchRotation?: THREE.Quaternion`
- `glitchScale?: THREE.Vector3`
- `glitchColorTint?: number`
- `glitchDisplayOffset: THREE.Vector3`
- `glitchEndTime: number`

## 4. Wybór fragmentów – patterns w `triggerVolumetricGlitch`

Cała logika „które voxele glitchujemy” mieszka w `triggerVolumetricGlitch(time)`.

### 4.1. Wspólny szkielet

1. `time` pochodzi z `clock.getElapsedTime()`.
2. Z configu (po uwzględnieniu presetu) odczytujemy: `pattern`, `duration`, `maxOffset`, `useRotation`, `useScale`, `useColorFlicker`, itd.
3. Dla `cubeGroups` i opcjonalnie `innerCubeParticles` wyliczamy metadane:
   - Zakres X (i Y dla `grid2d`): `minX`, `maxX`, `minY`, `maxY`, `spanX`, `spanY`.
   - Dla `clusters` – liczba dostępnych voxelów.
4. Na końcu mamy listy:
   - `targetGroups: cubeGroups[]`
   - `targetInner: innerCubeParticles[]` (opcjonalnie).

Następnie dla każdej jednostki w tych listach ustawiamy offset, rotację, skalę i ewentualnie kolor.

### 4.2. Pattern `bands`

Obecny algorytm:

- Liczymy `minX`, `maxX`, `spanX`.
- Dzielimy na `bandCount` pasów.
- Losujemy `bandsPerGlitch` indeksów pasów.
- Dla każdej grupy:
  - `bandIdx = floor(((originalPos.x - minX) / spanX) * bandCount)`.
  - Jeśli `bandIdx` w wylosowanym secie → voxel jest targetem.

Ten pattern zostaje jako wariant bazowy.

### 4.3. Pattern `grid2d`

Nowy pattern – siatka w 2D:

1. Z `cubeGroups` liczymy:
   - `minX`, `maxX`, `minY`, `maxY`.
   - `spanX`, `spanY`.
2. Dzielimy przestrzeń na `gridCols × gridRows`.
3. Losujemy `tilesPerGlitch` par `(col, row)`.
4. Dla każdej grupy:
   - `colIdx = floor(((x - minX) / spanX) * gridCols)`
   - `rowIdx = floor(((y - minY) / spanY) * gridRows)`
   - Jeśli `(colIdx, rowIdx)` jest wybrane → voxel jest targetem.
5. Dla `innerCubeParticles` można:
   - Powtórzyć to samo na ich własnym zakresie X/Y,
   - Lub reuse’ować zakres z `cubeGroups`, aby kafelki były spójne.

Efekt: glitchuje się „prostokątny kafelek” napisu (bardziej TV „blocky video”).

### 4.4. Pattern `clusters`

Pattern dla trybu „chaos”:

1. Tworzymy tablicę indeksów `[0..cubeGroups.length-1]`.
2. Losujemy (lub tasujemy) i wybieramy:
   - `targetCount = round(clusterFraction * cubeGroups.length)`, z ewentualnymi min/max.
3. Pierwsze `targetCount` indeksów to `targetGroups`.
4. Dla `innerCubeParticles` stosujemy tę samą logikę (osobno) lub pomijamy, jeśli config wyłącza inner cubes.

Wrażenie: „rozsypane” glitche w wielu nieregularnych miejscach.

## 5. Wizualny glitch – jak stosujemy na targetach

Załóżmy, że mamy listy `targetGroups` i `targetInner`.

### 5.1. Offset

- Jeżeli `maxOffset > 0`:
  - `glitchDisplayOffset` = losowy wektor w zakresie `[-maxOffset, maxOffset]` na każdej osi.
- `glitchEndTime = time + duration`.

### 5.2. Rotacja (`useRotation`)

- Losujemy:
  - Oś obrotu (normalizowany `THREE.Vector3`).
  - Kąt w przedziale `[-rotationMaxAngle, rotationMaxAngle]`.
- Tworzymy quaternion:
  - `glitchRotation = new THREE.Quaternion().setFromAxisAngle(axis, angle)`.

Zastosowanie w renderze:

- Dla `cubeGroups`:
  - `baseQuat` =:
    - W trybie `repulsion`: quaternion z tilt velocity.
    - W innych trybach: `group.rotation`.
  - `finalQuat = baseQuat * glitchRotation` (mnożenie quaternionów).

- Dla `innerCubeParticles`:
  - Normalnie rotacja jest identity → na czas glitcha używamy samego `glitchRotation`.

Po wygaśnięciu glitcha `glitchRotation` ustawiamy na `null`.

### 5.3. Skala (`useScale`)

- Losujemy mnożnik `s` z `[scaleMin, scaleMax]`.
- `glitchScale = new THREE.Vector3(s, s, s)` (lub delikatnie różne osie, jeśli chcemy).

W renderze:

- Dla `cubeGroups`:
  - `dummy.scale.copy(baseScale).multiply(glitchScale)` jeśli glitch aktywny.
- Dla `innerCubeParticles`:
  - `dummy.scale.copy(glitchScale)` lub po prostu `setScalar(s)`.

Po wygaśnięciu glitcha `glitchScale` ustawiamy na `null`.

### 5.4. Kolor (`useColorFlicker`) – opcjonalnie

- Dla każdego targetu:
  - Przy pierwszym glitchu zapisujemy oryginalny kolor (np. `originalColor: THREE.Color`) jeśli jeszcze nie istnieje.
  - Obliczamy `tintedColor = originalColor * (1 ± colorFlickerStrength)` (np. zmiana jasności).
  - Wywołujemy `setColorAt(meshIndex, tintedColor)` i ustawiamy `instanceColor.needsUpdate = true`.
- Po zakończeniu `time >= glitchEndTime` przywracamy `originalColor`.

Ta część jest oznaczona jako opcjonalna (druga iteracja) – najpierw można wdrożyć offset/rotację/skalę.

## 6. Render – integracja z istniejącą pętlą

### 6.1. `cubeGroups`

Obecnie:

- Fizyka / logika trybów.
- Wyznaczenie `finalQuat`.
- Ustawienie:
  - `dummy.position` (z `currentPos` + ewentualny offset).
  - `dummy.rotation` = `finalQuat`.
  - `dummy.scale` = `baseScale`.

Po zmianie:

- **Pozycja**:
  - Jak obecnie: jeśli glitch aktywny → `currentPos + glitchDisplayOffset`, inaczej `currentPos`.

- **Rotacja**:
  - Jeśli `glitchRotation` i `time < glitchEndTime`:
    - `finalQuatWithGlitch = finalQuat.clone().multiply(glitchRotation)`.
  - Inaczej: `finalQuatWithGlitch = finalQuat`.

- **Skala**:
  - Jeśli `glitchScale` i aktywny glitch:
    - `dummy.scale.copy(baseScale).multiply(glitchScale)`.
  - Inaczej: `dummy.scale.copy(baseScale)`.

Po wygaśnięciu glitcha:

- Zerujemy `glitchDisplayOffset` (0,0,0), `glitchEndTime = 0`, `glitchRotation = null`, `glitchScale = null` (i ewentualnie `glitchColorTint`).

### 6.2. `innerCubeParticles`

Analogicznie:

- **Pozycja**: `currentPos` lub `currentPos + glitchDisplayOffset`.
- **Rotacja**:
  - Zwykle identity.
  - Jeśli `glitchRotation` + glitch aktywny → `dummy.rotation.setFromQuaternion(glitchRotation)`.
- **Skala**:
  - Jeśli `glitchScale` → `dummy.scale.copy(glitchScale)`, inaczej `setScalar(1)`.

Po wygaśnięciu glitcha – ten sam schemat czyszczenia pól.

## 7. UI – prawy panel

Sekcja „Glitch volumetryczne” (już istniejąca) zostaje rozbudowana:

- **Aktualny stan**:
  - Toggle on/off (`GLITCH_VOLUME_CONFIG.enabled`).
  - Przycisk „Trigger”.

- **Dodajemy presety**:
  - 3 przyciski (`mode-btn`):
    - `> Subtelny`
    - `> Mocny`
    - `> Chaos`
  - Każdy:
    - Ustawia `currentPreset` (`subtelny` / `mocny` / `chaos`).
    - Wywołuje helper `applyGlitchPreset(name)`, który:
      - Odczytuje `GLITCH_VOLUME_PRESETS[name]`.
      - Nadpisuje odpowiednie pola w `GLITCH_VOLUME_CONFIG`.
      - Opcjonalnie resetuje `glitchVolumeNextTrigger` tak, aby kolejny glitch użył nowej konfiguracji.
    - Aktualizuje klasy `active` na przyciskach presetów.

- **Opcjonalne suwaki (druga iteracja)**:
  - „Intensity” – skaluje `maxOffset`, `clusterFraction`.
  - „Rate” – wpływa na `intervalMin/intervalMax`.

UI pozostaje proste: **on/off**, **preset**, **Trigger**.

## 8. Auto-trigger – współpraca z presetami

Obecnie:

- Gdy `GLITCH_VOLUME_CONFIG.enabled` i są `cubeGroups`, auto-trigger:
  - Inicjalizuje `glitchVolumeNextTrigger` przy pierwszym wejściu.
  - Po osiągnięciu czasu wywołuje `triggerVolumetricGlitch(time)` i ustawia następny czas na bazie `intervalMin/intervalMax`.

Z presetami:

- `intervalMin`/`intervalMax` są częścią presetu, więc:
  - Po zmianie presetu można:
    - Zostawić stary `glitchVolumeNextTrigger` (łagodne przejście),
    - Lub zresetować (np. `glitchVolumeNextTrigger = time + nowyInterval`) – wtedy użytkownik szybciej zobaczy zmianę charakteru glitcha.

Rekomendacja: resetować `glitchVolumeNextTrigger` przy zmianie presetu.

## 9. Zakres pierwszej iteracji

**Pierwsza iteracja:**

- Implementujemy:
  - Patterny: `bands`, `grid2d`, `clusters`.
  - Presety: `subtelny`, `mocny`, `chaos` (pattern + parametry).
  - Rotację i skalę (bez koloru).
  - Integrację z auto-triggerem i prosty UI presetów.

**Druga iteracja (opcjonalnie):**

- Dodajemy:
  - Color flicker (tint na `setColorAt` + pamiętanie `originalColor`).
  - Suwaki intensywności / częstotliwości w panelu.

