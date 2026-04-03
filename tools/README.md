# Narzędzia TOPKEK (statyczne)

## Showcase animation editor

**Plik:** [showcase-animation-editor.html](showcase-animation-editor.html)

Edytor dokumentu showcase **schemaVersion 1 lub 2** (`adapter: voxelLyricsMysen` albo `voxelLyricsVajbuj` w pliku — **runtime MYSEN** ładuje tylko `voxelLyricsMysen`). Moduły: `editor-project-io.js` (import/eksport pakietu), `editor-timeline.js` (oś 60 FPS, przeciąganie kluczy), `editor-preview-scene.js` (FOV + siatka XZ), współdzielone w [`../src/showcase/`](../src/showcase/): `showcase-animation-schema.js`, `showcase-effect-catalog.js`, `showcase-pack-schema.js` itd.

### Funkcje (v2)

- **Źródło projektu:** lista (nowy v2, nowy + audio, preset MYSEN sample JSON, **MYSEN jak /mysen** — ten sam merge co runtime: `introLyrics` + `timestampLyricsUrl` + grupy z `MYSEN_CONFIG`, opcjonalnie domyślne z `wordAnimationUrl`; preset VAJBUJ sample; fetch z `MYSEN_CONFIG.showcaseAnimationUrl` gdy włączone).
- **Timeline:** transport (play/pause/głośność) nad osią, zoom (px/s), etykiety w **klatkach** (`60f`), przeciąganie **kluczy transformacji** słowa, pasmo między skrajnymi kluczami, **zakres widoczności** słowa (niebieski prostokąt, przeciąganie krawędzi).
- **Słowa:** parametry statyczne — `wordSize` / `wordHeight` / `wordThickness` / `scatterRadius`, `materialPresetId`, `wordFxId`, `visibleFromFragSec` / `visibleToFragSec` (oś czasu fragmentu jak `elapsed` MYSEN).
- **Zakładki:** Postproc / Volumetryka / Custom — tory skalarne `{ t, v }` (lista z katalogu `showcase-effect-catalog.js`); runtime MYSEN stosuje postproc i mnożniki env sześcianów z dokumentu.
- **Pakiet folderu:** `showcase-pack.json` + `animation.json` + audio — **zapis przez File System Access API** (`Eksport folderu` / `Import folderu`); w przeglądarkach bez API — pobranie samych JSON.
- **Import jednego pliku:** JSON showcase (v1/v2) lub pakiet legacy `mysenLegacyImportBundle` (jak wcześniej).

### Uruchomienie

Z katalogu głównego projektu (`topkek/`), nie z `tools/`:

```bash
python -m http.server 8002
```

Otwórz: `http://localhost:8002/tools/showcase-animation-editor.html`

**Ważne:** root serwera musi być folder `topkek/` (tam gdzie leży `ASSETS/`). Strona edytora jest w podkatalogu `/tools/` — fetch do plików projektu jest rozwiązywany względem rootu repozytorium (nie względem `/tools/`), żeby uniknąć błędnego URL `/tools/ASSETS/...` (404).

### Automatyczne wczytanie

1. **URL:** `?doc=` / `?animation=` — ścieżka względna do rootu serwera (showcase JSON lub legacy bundle).
2. **Config:** gdy brak `doc=`, włączone `MYSEN_CONFIG.showcaseAnimationEnabled` i `showcaseAnimationUrl`.
3. **Wyłączenie:** `?noautoload=1` lub `?autoload=0`.

### Integracja ze stroną (MYSEN)

1. Zapisz `animation.json` (np. w `ASSETS/mysen/moja-animacja/`).
2. W [config.js](../config.js): `showcaseAnimationEnabled: true`, `showcaseAnimationUrl` → ten plik, `audioFile` zgodnie z utworem.
3. **Tylko** `adapter: "voxelLyricsMysen"` — inaczej `script.js` odrzuci dokument przy starcie MYSEN.

### Pakiet (manifest)

`showcase-pack.json` (walidacja: `showcase-pack-schema.js`):

- `kind`: `"showcasePack"`
- `schemaVersion`: `1`
- `experienceId`: `mysen` | `vajbuj` | …
- `files.animation`, `files.audio` (względem folderu pakietu)

### Moduły powiązane w repo

- [../src/showcase/showcase-animation-schema.js](../src/showcase/showcase-animation-schema.js), [../src/showcase/showcase-animation-adapters.js](../src/showcase/showcase-animation-adapters.js), [../src/showcase/showcase-animation-pass-runtime.js](../src/showcase/showcase-animation-pass-runtime.js), [../src/showcase/music-lyric-voxels.js](../src/showcase/music-lyric-voxels.js).

### Legacy import (jeden plik JSON)

Pakiet `mysenLegacyImportBundle` v1 — zob. [../ASSETS/mysen/mysen-legacy-import-bundle.sample.json](../ASSETS/mysen/mysen-legacy-import-bundle.sample.json).

Grupy `mysenTimestampLineGroups` nadal **nie** są odtwarzane z pakietu legacy.
