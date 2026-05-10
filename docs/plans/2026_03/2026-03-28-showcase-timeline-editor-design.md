# Showcase timeline editor — design (approved)

**Data:** 2026-03-28  
**Decyzja:** osobna strona statyczna w repozytorium (`tools/…`), nie nakładka w głównej aplikacji.

## Cel

Narzędzie do autoringu pokazów typu `/mysen` (i później innych `ShowcaseExperience`) z **osią czasu zsynchronizowaną z audio** i **podglądem na żywo** (scrub / play), bez bundlera — ten sam stack co TOPKEK (vanilla ES modules, Three.js 0.160.0 z import map).

## Kontekst w kodzie

- Kontrakt experience: `docs/plans/2026_03/2026-03-28-showcase-experience-contract.md`.
- MYSEN: timing rozłożony na `MYSEN_CONFIG` (`config.js`), `timestampLyricsUrl`, `wordAnimationUrl`, intro z polami `at`, grupy `mysenTimestampLineGroups` z `tMin` / `tMax` / `lineVanishAtMediaSec` itd.

## Architektura (wysoki poziom)

1. **Entrypoint:** `tools/showcase-timeline-editor.html` (lub `tools/mysen-timeline.html` na pierwszą iterację) — własny `<script type="module">`, **import map kopiowany / współdzielony** z `index.html` (Three 0.160 z unpkg), żeby nie mieszać wersji.
2. **UI:** panel DOM (timeline: waveforms opcjonalnie później, playhead, markery z konfiguracji i z parsowanych timestampów), kontrolki transportu (play/pause, seek).
3. **Podgląd 3D:** osobny moduł ES, który inicjalizuje **minimalną scenę** (kamera, renderer, światła) i wywołuje **współdzieloną** logikę „krok słów / voxel lyrics” dla wybranego czasu `t`, zamiast pełnego `script.js`.
4. **Źródło prawdy na start:** odczyt tych samych URL-i co produkcja (`fetch` na `ASSETS/mysen/…` względem origin serwera statycznego). Edycja w UI → na pierwszym etapie **eksport** (JSON / fragmenty do wklejenia w `config.js`), bez automatycznego zapisu do dysku (brak backendu).

## Fazy (YAGNI)

| Faza | Zakres |
|------|--------|
| **MVP** | Jedna strona, tylko MYSEN: audio + timeline z markerami (intro `at`, zakresy grup, `fadeStartSec`, koniec fragmentu), seek → podgląd stanu słów w 3D (uproszczona scena). |
| **v2** | Edycja wybranych pól (np. czasy grup) + eksport JSON; integracja z `mysen-word-animation.json`. |
| **v3** | Abstrakcja „experience id” + rejestr (drugi showcase tylko po stabilnym API preview). |

## Ograniczenia projektu

- Bez npm / bundlera; brak zapisu plików z przeglądarki — eksport przez schowek lub pobranie `Blob`.
- `config.js` pozostaje źródłem stałych produkcyjnych; narzędzie może generować **patch** lub instrukcję ręcznej aktualizacji.
- Mobile: edytor może być oznaczony jako desktop-first (szeroki layout).

## Ryzyka

- **Duplikacja logiki** do czasu wydzielenia wspólnego modułu (np. `music-lyric-voxels.js` już istnieje — należy go rozszerzać zamiast kopiować `stepMysenLyricWords` w całości).
- **Ścieżki assetów:** edytor musi być serwowany z **rootu projektu** (`python -m http.server` jak główna aplikacja), żeby `fetch('ASSETS/mysen/...')` działał tak samo jak na `index.html`.

## Następny krok

Plan implementacji: `2026-03-28-showcase-timeline-editor.md` (zadania krok po kroku).
