# Changelog

Wszystkie istotne zmiany w projekcie są dokumentowane w tym pliku.

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/), wersjonowanie według [Semantic Versioning](https://semver.org/lang/pl/).

---

## Jak prowadzić changelog

1. **Sekcje wersji** – każda wersja ma nagłówek `## [X.Y.Z] - RRRR-MM-DD` (np. `## [1.2.0] - 2026-03-11`).
2. **Typy zmian** – używaj stałych nagłówków:
   - **Added** – nowe funkcje
   - **Changed** – zmiany w istniejącej funkcjonalności
   - **Deprecated** – rzeczy do usunięcia w przyszłości
   - **Removed** – usunięte funkcje
   - **Fixed** – poprawki błędów
   - **Security** – poprawki bezpieczeństwa
3. **Wpis** – jedna linia na zmianę, w czasie przeszłym (np. „Dodano obsługę X”, „Poprawiono błąd Y”).
4. **Kolejność** – najnowsza wersja zawsze na górze (nad `[Unreleased]`).
5. **Unreleased** – zmiany jeszcze niewydane można zbierać pod sekcją `## [Unreleased]` i przy wydaniu przenieść pod konkretną wersję.

---

## [Unreleased]

### Added
- Dodano konsolę poleceń na dole prawego panelu (`terminal-shell.js`, `#topkek-terminal-shell`) z komendami: `help`, `vajbuj` / `vajbuj stop`, `bloom`, `sao`, `crt`, `light`, `postproc status`; dane UI w `TERMINAL_CONFIG` (`config.js`).
- Dodano intro kamery po ukryciu loadera: zbliżanie z dużej odległości do pozycji startowej w 3 s z ease-in (`INTRO_CAMERA_CONFIG` w `config.js`).
- Dodano `CONFIG.innerCubeZBias` (opcjonalny offset Z inner cubes przy `loadParticles` z JSON; domyślnie 0 — zgodność z zbakowanym `particles_*.json`).
- Dodano możliwość sterowania „mocą emmisji” (envMapIntensity + intensity/ambient z próbkowania wideo) osobno dla każdego background video.

### Changed
- VAJBUJ uruchamiany wyłącznie z konsoli (wpis `vajbuj`); wpis w menu terminala jest tylko informacyjny.
- *(zmiany w istniejącej funkcjonalności)*
- Ukryto w menu terminala wpis i przycisk „Animation portfolio” (wrapper z atrybutem `hidden` w `index.html`; usunięcie `hidden` przywraca widoczność).
- Zmieniono loader, aby symulował postęp i wyświetlał memiczne komunikaty co sekundę podczas ładowania.
- Zmieniono parametry fake-loadera, aby pasek nie kończył się zbyt szybko i komunikaty zmieniały się rzadziej.
- Dopasowano loader: komunikaty wolniej (ok. co 3s), po angielsku i z mniejszą czcionką.
- Zmieniono font w loaderze na bezszeryfowy.
- Dodano statyczny tytuł `T O P K E K` nad loaderem i wymuszono jednowierszowy `loading-text`.

### Fixed
- Przywrócono widoczność wewnętrznych sześcianów napisu: jaśniejsze `MATERIALS.innerCubes`, kompromisowe parametry bloom w `SHADER_CONFIG`, oraz łagodny lift emissive w patchu shadera (`generateParticles` / `loadParticles`).
- Poprawiono wystawanie inner cubes od przodu przy `particles_*.json`: `CONFIG.innerCubeZBias` faktycznie ustawiony na 0 w `config.js` (wartość 0.22 wypychała połowę rdzenia w stronę +Z względem zbakowanych pozycji).
- Poprawiono wybielanie inner cubes: usunięto z patcha shadera stałą `+ vec3(0.2)` (podbijała każdy kanał emissive), ujednolicono obie ścieżki tworzenia materiału, dostrojono albedo i metal/roughness w `MATERIALS.innerCubes`, złagodzono bloom w `config.js`.
- Zmniejszono przepalanie inner cubes do bieli w gęstym środku napisu: niższa `emissiveIntensity`, `toneMapped: true` oraz wyższy próg i łagodniejsza siła/promień `UnrealBloom` w `config.js` (diagnoza: suma HDR emissive + bloom + wcześniejsze omijanie tonemappingu).
- Poprawiono przyciemnienie sceny spowodowane wyzerowaniem świateł Hemisphere/Ambient z wideo w tle.
- Poprawiono opóźnienie aktualizacji “fake GI” z wideo przez synchronizację z klatkami (`requestVideoFrameCallback`), z zachowaniem fallbacku na urządzeniach bez API.
- Zmniejszono `intervalMs` dynamicznego oświetlenia z wideo w tle, żeby ograniczyć widoczny lag zmiany kolorów.
- Poprawiono świecenie `innerCubes` (emissive) i ich kolorowanie per-instance (`instanceColor`).
- Poprawiono widoczność emissive `innerCubes` (podbicie i `toneMapped: false`) oraz zabezpieczono mnożenie per-instance, żeby nie zerowało glow.
- Poprawiono mapowanie emissive `innerCubes` per-instance w Three r160 (użycie `vInstanceColor` dla `instanceColor`).
- Poprawiono wstrzykiwanie per-instance emissive w `innerCubes`, aby gradient HSL nie wybielał się do bieli.

---

## [1.0.0] - 2026-03-11

### Added
- Początkowy changelog i instrukcje.
