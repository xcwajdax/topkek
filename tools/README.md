# Narzędzia TOPKEK (statyczne)

## Showcase animation editor

**Plik:** [showcase-animation-editor.html](showcase-animation-editor.html)

Edytor dokumentu JSON `schemaVersion: 1`, `adapter: voxelLyricsMysen` — słowa na timeline, klucze transformacji (pozycja / rotacja Euler w radianach / skala), **panel pojawiania / znikania** (lot: domyślny timestamp / tylko szyna / spawn, `vanishAtMediaSec`, czas składania per słowo, persistent), import i eksport. Podgląd 3D używa tego samego pipeline’u wokseli co MYSEN (`music-lyric-voxels.js`).

### Uruchomienie

Z katalogu głównego projektu (`topkek/`), nie z `tools/`:

```bash
python -m http.server 8002
```

Otwórz w przeglądarce: `http://localhost:8002/tools/showcase-animation-editor.html`

Bez serwera HTTP moduły ES i `fetch` do assetów nie zadziałają poprawnie.

### Automatyczne wczytanie dokumentu JSON

1. **Parametr URL (pierwszeństwo):** `doc` lub `animation` — ścieżka względna do rootu serwera (katalog `topkek/`), np. dokument showcase **albo** pakiet `mysenLegacyImportBundle`, np.  
   `http://localhost:8002/tools/showcase-animation-editor.html?doc=ASSETS/mysen/mysen-legacy-import-bundle.sample.json`
2. **Z `config.js`:** jeśli w URL **nie** ma `doc` / `animation`, a `MYSEN_CONFIG.showcaseAnimationEnabled === true` i ustawiony jest niepusty `showcaseAnimationUrl`, edytor przy starcie zrobi `fetch` tego pliku (ten sam co strona główna w MYSEN).
3. **Wyłączenie punktu 2:** `?noautoload=1` lub `?autoload=0` — bez pobierania z konfiguracji (pusty dokument na starcie, o ile nie podano `doc=`). Jawny `doc=` nadal działa.

Przy błędzie sieci lub walidacji dokument pozostaje pusty (jak po starcie bez auto-load); komunikat jest w pasku walidacji pod edytorem.

### Audio

Wgrywany plik audio jest tylko w pamięci przeglądarki (blob URL). W wyeksportowanym JSON znajdują się `suggestedFileName` / `exportHintPath` — **trzeba ręcznie** skopiować plik MP3 pod ścieżkę w repo i ustawić `MYSEN_CONFIG.audioFile` zgodnie z projektem.

### Integracja ze stroną

1. Zapisz JSON np. jako `ASSETS/mysen/moja-animacja.json`.
2. W [config.js](../config.js) ustaw `MYSEN_CONFIG.showcaseAnimationEnabled: true` oraz `showcaseAnimationUrl` na ten plik.
3. Uruchom `/mysen start` — merge intro + timestamp z pliku jest **pomijany**, gdy wczytano poprawny dokument showcase.

### Wczytaj projekt (jeden plik)

Przycisk **Wczytaj projekt** akceptuje:

1. **Gotowy dokument showcase v1** — ten sam format co eksport (`schemaVersion`, `adapter: voxelLyricsMysen`, …).
2. **Pakiet legacy MYSEN** — jeden JSON z polami:
   - `kind`: `"mysenLegacyImportBundle"`
   - `version`: `1`
   - `mediaStart`: liczba (sekundy, jak wcześniej przy imporcie)
   - `intro`: tablica jak `MYSEN_CONFIG.introLyrics` (może być `[]`)
   - `timestampLyrics`: cała treść pliku `mysen_timestamps.txt` jako jeden string (z `\n`)
   - `wordAnimation`: opcjonalnie obiekt jak w `mysen-word-animation.json` (do `style` trafiają `defaults`)

Przykład: [../ASSETS/mysen/mysen-legacy-import-bundle.sample.json](../ASSETS/mysen/mysen-legacy-import-bundle.sample.json).

Grupy `mysenTimestampLineGroups` nadal **nie** są odtwarzane z pakietu legacy.
