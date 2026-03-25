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
- Dodano możliwość sterowania „mocą emmisji” (envMapIntensity + intensity/ambient z próbkowania wideo) osobno dla każdego background video.

### Changed
- *(zmiany w istniejącej funkcjonalności)*
- Zmieniono loader, aby symulował postęp i wyświetlał memiczne komunikaty co sekundę podczas ładowania.
- Zmieniono parametry fake-loadera, aby pasek nie kończył się zbyt szybko i komunikaty zmieniały się rzadziej.
- Dopasowano loader: komunikaty wolniej (ok. co 3s), po angielsku i z mniejszą czcionką.
- Zmieniono font w loaderze na bezszeryfowy.
- Dodano statyczny tytuł `T O P K E K` nad loaderem i wymuszono jednowierszowy `loading-text`.

### Fixed
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
