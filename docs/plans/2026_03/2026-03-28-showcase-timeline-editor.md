# Showcase timeline editor (tools page) — implementation plan

> **Goal:** Dodać osobną stronę `tools/showcase-timeline-editor.html` z timeline zsynchronizowanym z audio MYSEN i podglądem 3D opartym na współdzielonej logice voxel-lyrics (bez bundlera).

**Architecture:** Statyczny HTML + ES module `tools/showcase-timeline-editor.js` (oraz ewentualnie `tools/mysen-timeline-preview.js`) ładują te same assety co produkcja (`fetch` względem origin). Import map jak w `index.html`. Refaktor: wyciągnąć z `script.js` minimalny zestaw funkcji potrzebnych do „seek → stan słów” do istniejącego lub nowego modułu w rootcie repo, importowanego zarówno z narzędzia (po zaakceptowaniu zależności), jak i z `script.js` (opcjonalnie w drugiej iteracji, jeśli MVP duplikuje cienką warstwę).

**Tech Stack:** Vanilla JS, Three.js 0.160.0 (unpkg), istniejące moduły TOPKEK tam, gdzie nie wprowadzają cykli importów.

---

### Task 1: Import map i szkielet strony

**Files:**
- Create: `tools/showcase-timeline-editor.html`
- Create: `tools/showcase-timeline-editor.js` (stub: log + mount pustego canvas)

**Steps:**
1. Skopiuj blok `importmap` z `index.html` (Three + addons paths) do `tools/showcase-timeline-editor.html`.
2. Dodaj `#preview-canvas-container`, `#timeline-root`, przyciski Play/Pause i `<input type="range">` lub custom playhead (MVP).
3. W module zaimportuj `three` i utwórz `WebGLRenderer` + `PerspectiveCamera` + `Scene` + jedno światło — render pustej sceny w pętli `requestAnimationFrame`.
4. Uruchom `python -m http.server 8002` z katalogu `topkek`, otwórz `http://localhost:8002/tools/showcase-timeline-editor.html` — brak błędów w konsoli.

---

### Task 2: Załaduj audio i MYSEN assetów jak produkcja

**Files:**
- Modify: `tools/showcase-timeline-editor.js`
- Read-only: `config.js` — skopiuj do narzędzia **tylko ścieżki** (duplikat stałych ścieżek w małym obiekcie `EDITOR_MYSEN_PATHS` w module narzędzia) *albo* dynamiczny `import('./config.js')` jeśli nie powoduje ciągnięcia całego `IS_MOBILE` side-effectów — preferuj jawne ścieżki w pliku narzędzia na MVP, żeby uniknąć importu całego `config.js`.

**Steps:**
1. `fetch` timestamp lyrics z tej samej ścieżki co `MYSEN_CONFIG.timestampLyricsUrl` (wartość wpisana w `EDITOR_MYSEN_PATHS`).
2. `fetch` `wordAnimationUrl` jeśli włączone (opcjonalnie w MVP).
3. Użyj tego samego parsera co aplikacja: zaimportuj funkcję z modułu współdzielonego — jeśli `parseMysenTimestampLyricsFile` jest tylko w `script.js`, **wydziel** ją do `mysen-timestamp-parse.js` (eksport czystej funkcji) i zaimportuj w `script.js` + w edytorze.
4. Odtwarzacz: `Audio` element z `EDITOR_MYSEN_PATHS.audioFile`; podłącz Play/Pause i `currentTime` z suwakiem.

---

### Task 3: Wspólny moduł parsowania timestampów

**Files:**
- Create: `mysen-timestamp-parse.js` (lub nazwa zgodna z konwencją repo)
- Modify: `script.js` — importuj parser z modułu, usuń lokalną duplikację

**Steps:**
1. Znajdź `parseMysenTimestampLyricsFile` i zależności; przenieś do nowego pliku bez importu z `script.js`.
2. Uruchom główną aplikację, `/mysen start` — regresja: timestampy ładują się jak wcześniej.

---

### Task 4: Timeline — markery tylko do odczytu (MVP)

**Files:**
- Modify: `tools/showcase-timeline-editor.js`
- Optional: `tools/showcase-timeline-editor.css`

**Steps:**
1. Zbuduj listę markerów: z `introLyrics` (`at`), z `mysenTimestampLineGroups` (`tMin`, `tMax`, `lineVanishAtMediaSec`), z `mysenBackgroundVideoFadeOut.fadeStartSec`, koniec fragmentu (`audioEndTime` lub duration).
2. Narysuj poziomy pasek czasu (CSS + divy lub canvas 2D); pozycja playhead = `audio.currentTime` (uwzględnij `audioStartTime` jak w MYSEN).
3. Klik w pasek ustawia `audio.currentTime` (clamp do długości fragmentu).

---

### Task 5: Podgląd 3D — minimalna integracja z logiką słów

**Files:**
- Modify: `music-lyric-voxels.js` i/lub nowy `mysen-preview-step.js`
- Modify: `script.js` tylko jeśli trzeba wyeksportować helper

**Steps:**
1. Zidentyfikuj minimalny stan: `words` przygotowane jak w `prepareMysenLyricWords` / `queueMysenVoxelPregen` — **najmniejszy** zestaw: wywołaj istniejącą funkcję przygotowania z mock `mysenState` jeśli da się wydzielić bez `script.js` context; w przeciwnym razie w edytorze zaimplementuj „fake state” zgodny z oczekiwaniami `stepMysenLyricWords`.
2. Na każdą klatkę (lub tylko przy seek + play): `elapsed = audio.currentTime - audioStartTime`, wywołaj krok aktualizacji pozycji/ widoczności wokseli; render sceny z InstancedMesh jak w MYSEN (uproszczona wersja: tylko słowa widoczne w czasie `t`).
3. Ograniczenie MVP: jeśli pełna ścieżka jest zbyt kosztowna, pokaż **pozycje placeholder** (kolorowe boxy per aktywne słowo) z poprawnym timingiem — potem zamień na prawdziwe voxele.

---

### Task 6: Dokumentacja i CHANGELOG

**Files:**
- Modify: `ASSETS/mysen/README.md` lub `README_GL_PL.md` — krótka sekcja „Timeline editor”
- Modify: `CHANGELOG.md` — [Unreleased] Added

**Steps:**
1. Opisz URL otwarcia, wymaganie serwera z root `topkek`, oraz że ścieżki audio/timestampów muszą być zsynchronizowane z `MYSEN_CONFIG`.
2. Dopisz wpis w changelogu po zmergowaniu funkcji.

---

### Task 7 (opcjonalnie v2): Eksport

**Files:**
- Modify: `tools/showcase-timeline-editor.js`

**Steps:**
1. Przycisk „Copy JSON” generujący zaktualizowaną strukturę `mysenTimestampLineGroups` lub `mysen-word-animation.json` po edycji w UI.
2. Bez automatycznego zapisu na dysk.

---

## Weryfikacja ręczna

- `tools/showcase-timeline-editor.html` — audio gra, seek działa, markery zgadzają się z `config.js` dla MYSEN.
- `index.html` — `/mysen` bez regresji po wydzieleniu parsera.
- Mobile: brak wymogu (desktop-first OK).

## Zależności między zadaniami

`Task 3` przed `Task 2` jeśli edytor ma parsować ten sam format bez duplikacji — można zamienić kolejność: najpierw Task 3, potem Task 2.
