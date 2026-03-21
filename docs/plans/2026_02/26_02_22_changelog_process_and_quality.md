# Plan: Changelog process & quality (SemVer, atomic commits, feature flags, tests)

**Data:** 2026-02-22  
**Kontekst:** Analiza ~180 changelogów od grudnia 2025; zidentyfikowane problemy w procesie i rekomendacje.

---

## Zidentyfikowane problemy

1. **Zbyt duże zmiany w jednym PR/commicie**  
   Typowy changelog: "fix tooltip, fix modal, fix support bar, add feature, refactor state" — wszystko naraz. Ryzyko: trudny rollback, testowanie i śledzenie regresji.

2. **Brak powiązania changelogów z wersjami**  
   Format pliku: `changelog_26_02_20_48_...` (data + numer). Semver jest w `CHANGELOG.txt` i `GAME_VERSION` w script.js, ale w plikach per‑zmiana tylko "Sugerowana wersja (backup)" na końcu; brak automatycznego generowania numerów wersji.

3. **Duplikacja pracy**  
   Ręczna edycja wielu plików naraz; historia changelogów (np. duplicate_scripts_fix) wskazuje na powtarzające się problemy.

4. **Brak testów E2E/zintegrowanych**  
   Żaden changelog nie wspomina o testach. Częste "fix null check", "fix NaN" — takie błędy łapałyby testy.

5. **Brak ujednoliconego systemu feature flags**  
   Left-panel test: najpierw config, potem przeniesiony do Settings — to jest pattern feature flag, ale ręczny i pojedynczy.

---

## Rekomendacje (do wdrożenia krok po kroku)

### 1. Semantic Versioning + powiązanie z changelogami

- **Obecny stan:** `GAME_VERSION` w script.js; `CHANGELOG.txt` z sekcjami `[0.100.0]` aktualizowany przy backupie (backup.mdc); pojedyncze pliki `changelog_YY_MM_DD_HH_...md` w `CHANGELOGS/{YYYY_MM}`.
- **Propozycja:**
  - Zachować jeden główny `CHANGELOG.txt` jako źródło prawdy dla wersji (już jest).
  - W każdym pliku changelogu per‑zmiana: na końcu wpis **Wersja:** np. `0.100.1` (patch) zamiast tylko "Sugerowana wersja (backup)" — spójna nomenklatura.
  - Opcjonalnie: folder `changes/` z numerowanymi plikami `001-add-roadmap.md`, `002-fix-tooltip.md` i skrypt łączący je do `CHANGELOG.md` lub do sekcji w `CHANGELOG.txt` (conventional commits → auto-changelog to osobny krok).

### 2. Mniejsze, atomowe commity

- **Zasada:** 1 zmiana = 1 changelog = 1 commit.
- **W praktyce:** przy jednej sesji wielu zmian — albo commity per‑changelog (po każdej implementacji), albo jeden commit z listą w message (np. "fix tooltip; fix modal; add X") i osobne pliki changelogów dla śledzenia.
- **Zasady w .cursor/rules:** w changelog.mdc dodać zalecenie "jedna logiczna zmiana na jeden plik changelogu"; przy backupie commit zbiorczy jest OK.

### 3. Feature flags w config.js

- **Obecny stan:** `LEFT_PANEL_TEST_ENABLED: false` w config; w grze przełącznik w Settings (leftPanelTestEnabled w state/save).
- **Propozycja:** jeden obiekt `FEATURES` w config.js, np.:
  ```js
  FEATURES: {
    LEFT_PANEL_TEST:    { enabled: false, releaseVersion: '0.100.0', desc: 'Panel testowy poparcia (slider, freeze)' },
    NEW_COMBO_ANIMATION: { enabled: true,  releaseVersion: '0.99.0',  desc: 'Nowa animacja combo' }
  }
  ```
- **Użycie:** w kodzie `GAME_CONFIG.FEATURES?.LEFT_PANEL_TEST?.enabled` (lub helper `isFeatureEnabled('LEFT_PANEL_TEST')`). Opcjonalnie: w UI Settings tylko te z `enabled: true` lub z flagą `showInSettings: true`.
- **Migracja:** LEFT_PANEL_TEST_ENABLED zastąpić przez FEATURES.LEFT_PANEL_TEST; stan w grze (Settings toggle) pozostaje nadrzędny nad config (config = domyślna wartość przy pierwszym uruchomieniu).

### 4. Testy automatyczne (podstawowe)

- **Zakres:** QUnit lub zwykły JS (Node lub browser): testy dla `formatNumberBigStatsSplit`, stanu GameStore (get/set), config.js (struktura, wymagane klucze), ewentualnie mechanics (APS/APC dla prostego przypadku).
- **Integracja:** skrypt `npm test` lub `node run-tests.js`; w changelogu wpis typu "tested: unit tests for GameStore pass".
- **Lokalizacja:** np. `tests/` lub `js/tests/`; ładowane tylko w dev lub przez osobny runner.

### 5. Release candidates / rytm wersji

- **Obecny stan:** backup (i bump wersji) na życzenie użytkownika (backup.mdc); wersje typu 0.099.420.
- **Propozycja:** ustalić rytm (np. co N changelogów lub raz dziennie) jako "release candidate" i bump patch; minor przy nowych funkcjach, major przy breaking changes. Opcjonalnie tag w git: `v0.100.0`.
- **CHANGELOG.txt:** już grupuje zmiany pod wersją; przy backupie dopisywanie z `CHANGELOGS/old/{YYYY_MM_DD}` — bez zmian.

---

## Kolejność wdrożenia (sugerowana)

| Krok | Działanie | Wpływ |
|------|-----------|--------|
| 1 | Ujednolicić w changelog.mdc: "1 zmiana = 1 plik changelogu" + opcjonalnie pole **Wersja:** w pliku | Niski; lepsza czytelność |
| 2 | Dodać `FEATURES` do config.js i przenieść LEFT_PANEL_TEST do FEATURES; helper `isFeatureEnabled(id)` | Średni; gotowy pattern na kolejne flagi |
| 3 | Dodać minimalny zestaw testów (formatNumber, GameStore, config) + skrypt uruchamiający | Średni; łapanie regresji |
| 4 | Przy backupie: tag git `v{X.Y.Z}` i ewentualnie automatyczne dopisywanie wersji do CHANGELOG.txt z plików z folderu old | Niski; lepsze śledzenie wersji |
| 5 | (Opcjonalnie) conventional commits + auto-generowanie fragmentu CHANGELOG z changes/*.md | Później; wymaga zmiany workflow |

---

## Pliki do ewentualnej modyfikacji

- `.cursor/rules/changelog.mdc` — zalecenie atomowych zmian, pole Wersja w pliku.
- `js/config.js` — FEATURES, migracja LEFT_PANEL_TEST_ENABLED.
- `js/left_panel_test.js` (i miejsca używające flagi) — użycie FEATURES / isFeatureEnabled.
- Nowe: `tests/` lub `js/tests/`, skrypt testowy, (opcjonalnie) package.json scripts.
- `CHANGELOG.txt` — bez zmiany formatu; ewentualnie skrypt łączący changelogi z old → sekcja.

---

## Zależności

- Feature flags: zależne tylko od config.js i miejsc użycia (state/settings pozostają bez zmian poza odwołaniem do config).
- Testy: brak zależności od istniejącego builda; można uruchamiać w Node z mockami lub w przeglądarce z QUnit.
