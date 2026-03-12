---
name: Portfolio scene transition
overview: "Przejście do sceny portfolio po kliknięciu w \"> Animation portfolio\": wyłączenie hover-miniatur, blokada kamery i myszy, animacja kamery w dół (ease-in-out), transformacja PRODUCTIONS → MOTION ♥ DESIGN (recykling brył + spawn pozostałych + serce z latania), wlatujące pływające okna z miniaturkami, delikatne przesunięcie wideo w tle oraz nowy modal szczegółów animacji."
todos: []
isProject: false
---

# Plan: Przejście do sceny Portfolio po kliknięciu (bez miniatur na hover)

## Kontekst w kodzie

- **Hover i inicjalizacja:** W [script.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\script.js) linie 619–626 – `term-anim-portfolio` ma `mouseenter` wywołujący `initPortfolio()`. Portfolio (ramki + płaszczyzny z wideo) jest w scenie 3D, pozycja np. w `initPortfolio()` (offsetYTop -7, siatka 2×3).
- **PRODUCTIONS:** Subtitle jest w tym samym `voxelMap` co TOPKEK; grupy z `isTop: false` (x ≥ 0) to bryły napisu PRODUCTIONS ([script.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\script.js) ok. 1495, 1522–1525). Generowanie: `TextGeometry` per znak, grid scan, grupowanie (SHAPE_DEFINITIONS), `cubeGroups` + `meshRegistry` (kek = PRODUCTIONS).
- **Efekt Grid:** `generateReturnPath(startPos, startRot, endPos)` zwraca kroki z lerpem; w pętli grup używane są `gridState` (DISPLACED → RETURNING), `returnQueue`, `stepDuration` 0.2, lerp do `targetStep.pos` ([script.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\script.js) ok. 2025–2061).
- **Kamera:** `cameraFocusPoint`, `cameraAngle`, `cameraVerticalAngle`, `cameraRadius`; tryby `setCameraMode('free'|'dynamic'|'manual')`; `controls.enabled`; w manual/dynamic pozycja z orbit ([script.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\script.js) ok. 1883–1889).
- **Wideo w tle:** `backgroundVideoMesh.position.set(0, 0, bgCfg.positionZ)` w [script.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\script.js) ok. 381; konfiguracja w [config.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\config.js) (backgroundVideo).
- **Modal portfolio:** Obecnie [index.html](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\index.html) 222–234 – jeden modal z iframe Vimeo; klik w thumbnail w scenie otwiera `openPortfolioModal(url)`.

---

## 1. Usunięcie miniatur na hover

- Usunąć inicjalizację portfolio na **hover**: w [script.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\script.js) zdjąć `mouseenter` z `term-anim-portfolio` (ok. 619–626). Nie wywoływać `initPortfolio()` przy najechaniu.
- **Nie** usuwać samej logiki `initPortfolio()` – będzie wywoływana przy wejściu w tryb portfolio (po kliknięciu).

---

## 2. Klik „> Animation portfolio” i stan sceny portfolio

- Dodać stan globalny, np. `portfolioSceneActive` (boolean), oraz ewentualnie fazy: `'idle' | 'camera_move' | 'subtitle_transform' | 'windows_fly_in' | 'floating'`.
- Na **klik** w `term-anim-portfolio`:
  - Ustawić `portfolioSceneActive = true`.
  - Wyłączyć sterowanie kamerą i wpływ myszy na symulację:
    - Ustawić `controls.enabled = false`, nie włączać `isFreeCam`; w pętli animacji (gdzie używane są `mouse`, `target`, `raycaster`) **nie** aktualizować `target` z myszy ani nie stosować repulsion/scatter/grid do obiektów gdy `portfolioSceneActive`.
  - Jednorazowo wywołać `initPortfolio()` (jeśli jeszcze nie wywołane), ale **nie** dodawać od razu grupy portfolio do sceny w starej pozycji – grupa portfolio będzie pokazana/animowana w fazie „windows fly in” (punkt 5).
- W `onMouseDown` / `onMouseMove`: gdy `portfolioSceneActive`, nie włączać przeciągania/panowania i nie zmieniać `target` dla fizyki.

---

## 3. Animacja kamery (ease-in-out, TOPKEK u góry)

- Cel: kamera oddala się i przesuwa w dół tak, aby napis TOPKEK był u góry ekranu; użytkownik traci kontrolę (zgodnie z p. 2).
- Dodać w [config.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\config.js) sekcję typu `PORTFOLIO_SCENE_CONFIG`: czas trwania ruchu kamery (np. 2.5 s), docelowy `cameraFocusPoint` (np. `(0, -4, 0)` lub wyliczony tak, żeby TOPKEK był u góry), docelowy `cameraRadius` (np. 28–32), docelowe kąty (np. `cameraVerticalAngle` ujemny, żeby patrzeć z góry w dół).
- W pętli animacji, gdy `portfolioSceneActive` i faza `'camera_move'`:
  - Interpolować `cameraFocusPoint`, `cameraRadius`, `cameraAngle`, `cameraVerticalAngle` od aktualnych wartości do wartości docelowych.
  - Użyć easingu **ease-in-out** (np. smoothstep: `t => t<0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2`) na postęp `progress = (now - startTime) / duration`.
  - Po zakończeniu przełączyć fazę na `'subtitle_transform'`.
- Kamera ma dalej `lookAt(cameraFocusPoint)` (już używane w kodzie).

---

## 4. Transformacja PRODUCTIONS → MOTION ♥ DESIGN

- **Cel:** Napis PRODUCTIONS znika jako tekst; bryły PRODUCTIONS (grupy z `isTop === false`) lecą na nowe pozycje tworząc „MOTION ♥ DESIGN”. Napis ma być o jedną linię wyżej niż PRODUCTIONS; ten sam styl liter (font, size, height, letterSpacing jak w `CONFIG.subtitle`). Serce: pixelowata emotka; elementy wlatują z losowych kierunków z ekranu, świecą, potem gasną do metalicznego czerwonego. Na końcu całość jeden błysk (biało/czerwono).

### 4.1 Generowanie docelowych pozycji „MOTION DESIGN”

- Użyć tej samej metody co dla PRODUCTIONS: `TextGeometry` dla znaków „MOTION ” + placeholder (spacja lub niewidoczny znak na pozycji serca) + „ DESIGN”, te same parametry co `CONFIG.subtitle` (size, height, letterSpacing), **offsetY** = np. `CONFIG.subtitle.offsetY + jednaLinijka` (np. +1.2). Grid scan + ten sam grouping (SHAPE_DEFINITIONS) → lista docelowych centroidów dla „MOTION” i „DESIGN” (bez serca). Zapisać jako tablicę `motionDesignTargets` (Vector3).

### 4.2 Mapowanie PRODUCTIONS → docelowe pozycje

- Subtitle groups: `cubeGroups.filter(g => !g.isTop)`.
- Przypisać każdą taką grupę do jednego z `motionDesignTargets` (np. po kolei lub po odległości – najbliższy wolny target). Powstałe pary (group, targetPos) to „recyklingowane” bryły.

### 4.3 Animacja recyklingu brył

- Dla każdej grupy PRODUCTIONS: docelowa pozycja = przypisany `targetPos`. W fazie `'subtitle_transform'` animować `group.currentPos` (i ewentualnie `group.originalPos` po zakończeniu) do tego targetu z **ease-in-out** w czasie (np. 1.5 s). Nie zmieniać trybu repulsion – w tej fazie dla tych grup używamy tylko tej jednej animacji „fly to target”.

### 4.4 Serce (pixelowate, wlatujące z ekranu)

- Zdefiniować kształt serca jako siatkę punktów (np. 8×8 lub 10×10) w 2D, następnie 2 warstwy w Z (jak `subtitle.thickness`). Pozycja środka serca = między „MOTION” a „DESIGN” (środek placeholder w 4.1).
- Dodać osobny obiekt 3D dla serca: np. `InstancedMesh` z małymi kostkami (rozmiar ~particleSize). Każda instancja ma:
  - `targetPos` (pozycja w napisie),
  - `startPos` – losowy punkt poza ekranem (np. losowy kierunek × duża odległość),
  - animację: ruch od `startPos` do `targetPos` (ease-in-out), równolegle „świecenie” (emissive / kolor) które na początku jest wysokie, potem spada do metalicznego czerwonego.
- Materiał: `MeshStandardMaterial` z `metalness` i `roughness` dla efektu metalicznego; kolor końcowy np. `0xcc2222`; w trakcie lotu można tymczasowo podbijać `emissive`.

### 4.5 Spawn pozostałych brył („reszta do MOTION DESIGN”)

- Dla docelowych pozycji „MOTION DESIGN”, które **nie** dostały grupy z PRODUCTIONS: dodać nowe „grupy” (logiczne obiekty z `currentPos` startującym poza ekranem, `originalPos` = docelowa pozycja). Animacja: ta sama co w trybie Grid – `generateReturnPath(currentPos, rot, originalPos)`, potem w pętli stan RETURNING z `returnQueue` i stepDuration/lerp jak w [script.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\script.js) ok. 2037–2060. Te nowe bloki muszą być renderowane: albo rozszerzenie istniejących instanced mesh (kek), albo osobny InstancedMesh tylko dla „motion design extra” (prostsze do wdrożenia bez przebudowy całego initMeshes).

### 4.6 Jedna linijka wyżej i ten sam styl

- Zapewnione w 4.1 przez `offsetY` = `CONFIG.subtitle.offsetY + lineHeight`. Styl identyczny: ten sam `font`, `CONFIG.subtitle.size`, `height`, `letterSpacing`.

### 4.7 Błysk na końcu

- Po ustawieniu się wszystkich elementów (PRODUCTIONS na miejscu, spawny na miejscu, serce na miejscu): jeden krótki błysk – np. przez 1–2 klatki podbić emissive/bloom na napisie (biało lub czerwono), potem powrót do normalnego materiału. Można to zrobić w jednym kroku „flash” w stanie fazy (np. `'flash'`), po którym faza → `'windows_fly_in'`.

---

## 5. Okna z miniaturkami (wlatują, pływają, hover = odtwarzanie, klik = modal)

- **Wlot:** W fazie `'windows_fly_in'` dodać do sceny grupę portfolio (obecna `portfolioState.group` z ramkami i płaszczyznami wideo). Okna (ramki + płaszczyzny) startują np. poniżej ekranu lub z boku i wlatują na pozycje z krótką animacją ease-in-out. Pozycje docelowe: „pod napisami”, rozrzucone – różne rozmiary (mniejsze i większe): w [config.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\config.js) w PORTFOLIO_CONFIG można dodać `slotScale` per item (np. 0.8, 1, 1.2) i lekki losowy offset, żeby nie była to sztywna siatka.
- **Pływanie:** Po wlocie ustawić fazę `'floating'`. W każdej klatce aktualizować pozycje ramek/plane’ów drobnym ruchem (np. sinus po czasie dla X/Y, mała amplituda) – „bezwładnie”. Nie używać repulsion od myszy w tym trybie.
- **Hover:** Zachować obecną logikę raycastera na `portfolioState.planeMeshes` i `portfolioState.hoveredIndex` tylko gdy `portfolioSceneActive` i faza `'floating'`. Przy hover: odtwarzanie wideo w miniaturce (już jest: `item.video.play()` / `pause()`).
- **Klik:** Przy kliknięciu w hovered thumbnail otworzyć **modal szczegółów** tej animacji (nie od razu pełnoekranowy Vimeo). W modalu: opisy, zdjęcia, filmy, typografia (zgodnie z życzeniem: „opisy foty filmy typografie zdjęcia”). Obecny modal Vimeo można zostawić jako „pełny ekran wideo” otwierany z wnętrza modalu szczegółów (np. przycisk „Odtwórz wideo”).

---

## 6. Wideo w tle

- W fazie portfolio (np. od `'camera_move'` do końca) animować `backgroundVideoMesh.position.y` w dół (np. z 0 do -3 lub -5) z **ease-in-out** w czasie (np. ten sam duration co kamera lub nieco dłuższy). W pętli renderowania: `backgroundVideoMesh.position.y = lerp(startY, endY, easeInOut(progress))`.

---

## 7. Modal szczegółów animacji

- W [index.html](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\index.html) dodać nowy modal, np. `#portfolio-detail-modal`, z sekcjami: tytuł, opis (tekst), galeria zdjęć, filmy (embed Vimeo lub `<video>`), typografia (przykłady fontów/tekstów). Zawartość ładowana dynamicznie z obiektu portfolio (np. rozszerzenie `PORTFOLIO_CONFIG.items[]` o pola: `description`, `images[]`, `vimeoUrl`, `typography` / `fonts`).
- W [config.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\config.js) rozszerzyć każdy item o te pola (nawet placeholderami).
- W [script.js](c:\Users\user\Documents\VIBELIFE2026\TOPKEK-MAIN\topkek\script.js): przy kliknięciu w thumbnail (gdy `portfolioSceneActive`) zamiast od razu `openPortfolioModal(vimeoUrl)` wywołać `openPortfolioDetailModal(item)` który wypełnia i pokazuje `#portfolio-detail-modal`. W środku modalu przycisk „Odtwórz wideo” może wywoływać obecne `openPortfolioModal(vimeoUrl)`.

---

## Kolejność implementacji (propozycja)

1. **Config:** Dodać `PORTFOLIO_SCENE_CONFIG` (kamera, czasy, offset jednej linijki); rozszerzyć `PORTFOLIO_CONFIG.items` o pola do modalu szczegółów.
2. **Stan i klik:** Usunąć hover init; dodać `portfolioSceneActive` i fazy; na klik `term-anim-portfolio` ustawić stan i wyłączyć sterowanie + wpływ myszy na symulację.
3. **Kamera:** Zaimplementować animację kamery z ease-in-out i przełączenie faz.
4. **MOTION DESIGN:** Precomputacja targetów (tekst + grid + grouping), mapowanie PRODUCTIONS → targets, animacja recyklingu; osobny InstancedMesh + animacja dla serca; spawn brakujących brył (Grid-style); błysk.
5. **Okna:** Wlot grupy portfolio, pływanie, zachowanie hover/klik; podpięcie kliku pod nowy modal.
6. **Wideo w tle:** Delikatny ruch w dół w fazach portfolio.
7. **Modal szczegółów:** HTML + CSS + JS ładowanie danych i opcjonalnie „Odtwórz wideo” → istniejący modal Vimeo.

---

## Uwagi techniczne

- **Stała liczba instancji:** Obecne `meshRegistry` i `initMeshes(groupCounts)` zakładają stałe count na podstawie groupCounts. Dodanie „motion design extra” grup może wymagać albo osobnego InstancedMesh dla tych instancji, albo wstępnego wyliczenia łącznej liczby grup (TOPKEK + PRODUCTIONS + motion design extra) przy starcie i alokacji jednego większego bufora – drugie jest większą ingerencją w `generateParticles`. Bezpieczniejsza opcja: osobny `motionDesignExtraMesh` (InstancedMesh) tylko dla brakujących bloków.
- **Serce:** Można trzymać pozycje pikseli w stałej tablicy 2D (np. maska bitmapy 8×8) i konwertować na Vector3 z offsetem środka między MOTION a DESIGN.
- **Ease-in-out:** Jedna wspólna funkcja w script.js, np. `easeInOutCubic(t)` używana dla kamery, ruchu brył i wideo.
