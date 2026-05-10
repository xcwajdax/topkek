# MYSEN — remiks / audio na stronę

Projekty **Audacity** (`.aup3`, `.aup`) trzymaj lokalnie — są w `.gitignore` (duży rozmiar). W repozytorium wystarczy eksport audio (np. `.mp3`).

Umieść tutaj plik audio remiksu (np. `mysen-remix.mp3`) i ustaw `MYSEN_CONFIG.audioFile` w [`config.js`](../../config.js) na tę samą ścieżkę względem rootu strony (np. `ASSETS/mysen/mysen-remix.mp3`).

Jeśli tego pliku nie ma (404), aplikacja spróbuje **`MYSEN_CONFIG.audioFileFallback`** (domyślnie `VAJBUJ_TRIMMED.mp3` w katalogu głównym strony), żeby tryb dało się odpalić podczas testów. Ustaw `audioFileFallback: null`, gdy nie chcesz zapasowej ścieżki.

Długość odtwarzania: w `MYSEN_CONFIG` ustaw `audioEndTime: null`, żeby grać od `audioStartTime` do końca pliku (`audio.duration`). Skończony czas (np. skrót) ustawiasz liczbą sekund na osi czasu mediów.

Tryb uruchamiasz z konsoli: `/mysen start` i zatrzymujesz: `/mysen stop`.

Po **naturalnym** końcu odtwarzanego fragmentu (nie po `/mysen stop`) możesz pokazać embed Spotify oryginału: w [`config.js`](../../config.js) ustaw `MYSEN_CONFIG.originalTrackSpotifyEmbedSrc` na pełny adres iframe (jak z „Share → Embed” na Spotify) oraz opcjonalnie `originalTrackSpotifyWidgetTitle`. `null` wyłącza widget.

Przy **`showBackgroundVideoDuringMysen: true`** możesz włączyć **`mysenBackgroundVideoFadeOut`** w [`config.js`](../../config.js): od `fadeStartSec` (np. 60 s od startu trybu) nieprzezroczystość płaszczyzny wideo tła maleje liniowo do `endOpacity` przy końcu odtwarzanego fragmentu; po wyjściu z MYSEN materiał jest resetowany.

## Grupy linii z timestampów — `mysenTimestampLineGroups`

W [`config.js`](../../config.js), `MYSEN_CONFIG.mysenTimestampLineGroups`:

- **`enabled`** — włącza logikę grup.
- **`groups`** — tablica bloków `{ tMin, tMax, lineVanishAtMediaSec }`. Czas **`at`** słowa z `mysen_timestamps.txt` (oś pliku audio) musi mieścić się w `[tMin, tMax]` — wszystkie kolejne słowa z tego zakresu trafiają do **jednego wiersza** (jak zwrotka w jednej linii). Nie ma wtedy lotu z losowego punktu w FOV — słowa składają się na wspólnej „szynie”.
- **`lineVanishAtMediaSec`** — znikanie wiersza, gdy **przybliżony czas na osi pliku** `audioStartTime + elapsed` (od startu `/mysen`, ta sama skala co pola `at` w timestampach) osiągnie tę wartość; wtedy cała linia przechodzi w rozproszenie (`spread`). Nie opieramy się tylko na `audio.currentTime`, żeby uniknąć braku rozlotu przy opóźnieniu odtwarzania lub innym klipie fallback.
- **`splitLines`** (opcjonalne) — tablica `{ wordCount, offsetX?, offsetY? }`: zamiast jednej poziomej linii kolejne tokeny z pliku timestampów (w kolejności czasu) trafiają na **podwiersze** z przesunięciem; wszystkie nadal mają ten sam logiczny „wiersz” (wspólne znikanie przy `lineVanishAtMediaSec`). `wordCount` musi sumować się do liczby słów w grupie (np. 4+4 dla ośmiu tokenów).
- **`seededRandomFly`** — dla słów **poza** żadną grupą: spawn nadal w frustum, ale **deterministyczny** (hash z `tekst` + `at`), żeby układ był „losowy”, lecz ten sam przy każdym odtworzeniu.

Domyślna konfiguracja odpowiada pierwszej i drugiej zwrotce z obecnego `mysen_timestamps.txt` (ok. 23.7–30.36 s i 31.84–38.7 s) ze znikaniami przy **31.5 s** i **41.0 s**; te dwie grupy używają **`splitLines`** (dwa podwiersze na zwrotkę). Reszta utworu zostaje przy jednym słowie na wiersz + seedowany spawn.

## Animacja słów — `mysen-word-animation.json`

Opcjonalny plik JSON (domyślnie `ASSETS/mysen/mysen-word-animation.json`, włącznik: `MYSEN_CONFIG.wordAnimationEnabled` / `wordAnimationUrl` w [`config.js`](../../config.js)).

- **`version`** — liczba (np. `1`), tylko do logów.
- **`defaults`** — nadpisuje wybrane pola z `MYSEN_CONFIG` na czas jednego odtworzenia MYSEN (po `mergedMysenConfig`): m.in. `wordAssemblyDuration`, `lyricsStartDelay`, `scatterRadius`, `lyricsOffsetY`, `lineSpacing`, `wordSpacing`, `wordSize`, `wordHeight`, `wordThickness`, `slowPhaseEnd`, `slowPhaseSpeed`, oraz obiekty `randomFly`, `spread`, `introOutroSpread`, `lyricSpread`, `introAssembly`, `lyricAssembly` (płytkie scalenie z bazą z `config.js`).
- **`overrides`** — tablica wpisów z polem **`match`** i opcjonalnymi stylami słowa:
  - **`match: { "at": number, "text": "string" }`** — `at` w **sekundach na osi pliku audio**, tak jak pierwsza kolumna czasu w `mysen_timestamps.txt` (np. `23.74` dla pierwszego „Zamykam”). Dla powtarzających się słów ten czas rozróżnia wystąpienia.
  - **`match: { "globalIndex": number }`** — indeks słowa w kolejności merge (intro + timestampy, bez `lineBreak`), od `0`; kruchy przy zmianie intro.
  - Pola wpisu (wszystkie opcjonalne):
    - **`spawn`**: `{ "x", "y", "z" }` — stały punkt startu lotu (świat); jeśli ustawiony, lot jest włączony nawet przy `randomFly.enabled: false`.
    - **`offsetX`**, **`offsetY`**, **`offsetZ`** — dodawane do pozycji „szyny” (layout + offsety).
    - **`colorStart`**, **`colorEnd`** — hex (`"#ff00aa"` lub `"ff00aa"`) albo liczba `0x…`; przejście koloru wokseli podczas składania. `colorEnd` ustawia też `color` słowa.
    - **`scale`** — rozmiar geometrii tekstu (jak w `introLyrics`).
    - **`assembledScale`** — dodatkowy mnożnik skali instancji po złożeniu / rozlocie.

Przykład (pierwsze „Zamykam” z timestampów przy `23.740`):

```json
{
  "version": 1,
  "defaults": {},
  "overrides": [
    {
      "match": { "at": 23.74, "text": "Zamykam" },
      "spawn": { "x": 12, "y": 4, "z": -18 },
      "colorStart": "#020202",
      "colorEnd": "#66ccff",
      "assembledScale": 1.15,
      "offsetZ": 0.5
    }
  ]
}
```

## Showcase animation JSON (v1) — edytor + strona

Uniwersalny dokument (`schemaVersion: 1`, `adapter: voxelLyricsMysen`) zastępuje **merge** intro + `mysen_timestamps.txt`, gdy w [`config.js`](../../config.js) włączysz `MYSEN_CONFIG.showcaseAnimationEnabled` i ustawisz `showcaseAnimationUrl` na plik JSON.

- **Edytor (timeline + klucze + podgląd 3D):** [`tools/showcase-animation-editor.html`](../../tools/showcase-animation-editor.html) — instrukcja w [`tools/README.md`](../../tools/README.md).
- **Przykład pliku:** [showcase-animation.sample.json](showcase-animation.sample.json).
- **Pakiet legacy (jeden JSON do edytora):** [mysen-legacy-import-bundle.sample.json](mysen-legacy-import-bundle.sample.json).
- **Klucze** `transformKeyframes` — czas `t` w sekundach od początku **fragmentu** (jak `elapsed` w MYSEN); `position` to dodatek do pozycji z layoutu lyriców; `rotationEuler` w **radianach**; `scale` mnoży skalę wokseli po złożeniu.
- **Opcje słowa (pojawianie / znikanie), opcjonalnie na wpisie w `words`:** `persistentOnScreen` (alias w JSON: `mysenPersistentOnScreen`) — bez rozlotu intro; `groupedLine` — dla słów timestamp bez lotu z frustum, tylko szyna; `spawn`: `{ "x", "y", "z" }` — stały punkt startu lotu; `vanishAtMediaSec` — znikanie (rozlot) przy tej pozycji na osi **pliku audio** (sekundy media, jak `audio.currentTime`); `assemblyDurationSec` — czas składania wokseli dla tego słowa (nadpisuje `style.wordAssemblyDuration`).
