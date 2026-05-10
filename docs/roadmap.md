# Szczegółowa roadmapa APPSTAIN

Pełna lista planów; skrót dla graczy w grze (Settings → View Roadmap).

## Wysoki priorytet

- **Eventy przy spadku poparcia** – eventy na progach 20, 15, 10, 8, 6, 5, 4, 3, 2, 1%; wybory A/B/C, efekty na żelazny elektorat / regenerację. Sceny: wiadomości w TV, wizyta na polu golfowym, konferencja w drzwiach od samolotu itp. Zob. [TODO.md](../TODO.md) (Wysoki priorytet).
- **Tło left-panel a budynki** – warstwy tła zależne od liczby/typu budynków; progi 1/5/10/20/50/100/200/500; jeden mechanizm: stan gry → background_layers. Zob. [TODO.md](../TODO.md).
- **Przebudowa tła left-panel zależnego od poparcia** – jedna logika warstw (support + budynki + eventy + tłum). Progi wizualne (sceneria, pogoda, budynek) od 0% do 100%+; osobna warstwa postaci (staff / wyborcy / protestujący) zależna od poparcia, stany tłumu i reakcja na eventy. Zob. [TODO.md](../TODO.md) (Wysoki priorytet).
- **Spójna logika warstw left-panel** – support + budynki + eventy + tłum w jednym systemie. Zob. [TODO.md](../TODO.md).
- **Redesign systemu combo i ekscytacja** – przebudowa combo, dodanie ekscytacji. Zob. [TODO.md](../TODO.md).

## Średni priorytet

- **Przebudowa UI i wyglądu wszystkich modali systemów** – spójny wygląd i UX modali (Propaganda, Tower, Wall, Cave, Augments itd.). Zob. [TODO.md](../TODO.md) (Średni).
- **Poprawa propaganda modal** – opisy i wygląd. Zob. [TODO.md](../TODO.md) (Średni) oraz sekcja Grafika/UI.
- **Propaganda System v2.0 (mechanika + grafika)** – warunek zakupu mediów zależny od liczby Propaganda Network, ewolucja budynku w left-panel, narracja w czasie rzeczywistym z barometrem (-100..100, krok 5) i 5 teł per medium zależnych od narracji. Plan: [docs/plans/2026_02/26_02_27_propaganda_system_overhaul.md](plans/2026_02/26_02_27_propaganda_system_overhaul.md). Zob. [TODO.md](../TODO.md).
- **Więcej statystyk w UI** – zbieranie i wyświetlanie statystyk. Zob. [TODO.md](../TODO.md).
- **Wygrana gry i Prestiż** – wygrana po zakupie 9 członków Sądu Najwyższego, system Prestiżu. Zob. [TODO.md](../TODO.md); plany w [docs/plans/2026_02/](plans/2026_02/).
- **Tłumaczenie gry na polski** – pełna lokalizacja. Zob. [TODO.md](../TODO.md).

## Niski priorytet / Pomysły

- **Augments modal przy zakupie** – aktualizacja listy U/B po zakupie. Zob. [TODO.md](../TODO.md).
- **Wybór systemu damage control** – opcja włącz/wyłącz. Zob. [TODO.md](../TODO.md).
- **Eksport zapisu** – eksport stanu gry. Zob. [TODO.md](../TODO.md).
- **Questy – grafiki przy odbieraniu nagrody** – osobne grafiki na ekran odbioru nagrody. Zob. [TODO.md](../TODO.md).

## Błędy do naprawienia

- **Animacja „popchnięcia” paska poparcia** – przywrócenie animacji push (widoczna klatka + powrót 0.5s). Zob. [TODO.md](../TODO.md) (Błędy).
- **Kolumna timera systems-wrapper** – `.system-timer-cell` widoczne tylko z klasą `.active`; znaleźć źródło nadpisu CSS. Zob. [TODO.md](../TODO.md).

## Ulepszenia / Optymalizacje

- **Płynność działania** – optymalizacja pod dużo ruchu (animacje, staff walkers, warstwy tła). Zob. [TODO.md](../TODO.md).

## Grafika / UI

- **Poprawa tower modal** – opisy i wygląd. Zob. [TODO.md](../TODO.md) (Grafika/UI).
- **Przebudowa systems-wrapper** – ikony z ASSETS/ICONS/BUILDINGS, złota ramka, inner shadow dla ukrytych systemów. Zob. [TODO.md](../TODO.md).

## Techniczne

- **Poprawa UI na mobile** – dostosowanie interfejsu. Zob. [TODO.md](../TODO.md).

---

## Przyszłe systemy (backlog koncepcyjny)

- **Cryptobros** – handel kryptowalutami, ragpullowanie, łapówki za wolność, przekręty. Nowy system z osobną ekonomią i walutą (krypto). Zob. [TODO.md](../TODO.md) (Przyszłe systemy).
- **Insider Trader** – bogacenie się na wahańach rynku, które sami wywołujemy (np. „akcje za drogie? cło na tydzień; za tanie? odwołuję”). Osobna ekonomia i waluta. Zob. [TODO.md](../TODO.md).
- **Pole golfowe** – nowy budynek + system „zdobywania” zaufania przez budowę i kontrolę globalnego imperium golfowego; przekręty, szantaże; trawka musi być przystrzyżona. Zob. [TODO.md](../TODO.md).
- **Zarządcy (Managers)** – odblokowane głowy można umieszczać na czele struktur (np. Musk → Propaganda Network); każda postać ma indywidualne efekty szyte na postać. Zob. [TODO.md](../TODO.md).
- **Augments overhaul** – w modalu augmentów: drzewko augmentów i powiązań zamiast tabeli; dla każdego S/B osobne ścieżki (2–4 gałęzie); jedne augmenty odblokowują drugie. Zob. [TODO.md](../TODO.md).
