# System meta wątków i pokoju (Meta Room)

**Plan:** Meta wątki (dane w Markdown, łatwa edycja powiązań) + pokój zastępujący left-panel (ściana powiązań, tape recorder, regał akt, czwarty element). Zapis stanu i integracja z istniejącą strukturą gry.

---

## 1. Cel i zakres

- **Meta wątki**: fabularne wątki pojawiające się w grze (teksty, opisy, cytaty, eventy, questy). Każdy wątek ma powiązane postacie (Heads) odblokowywane w trakcie śledzenia. Wątki mogą się łączyć.
- **Pokój**: osobne okno zastępujące **cały left-panel** (nie overlay jak dotychczasowe modale). Nawigacja: klikalne elementy w pokoju + menu na dole. Zawartość: ściana powiązań, biurko z tape recorderem, regał z aktami, czwarty element (propozycje poniżej).
- **Edycja**: ręczne dodawanie/edycja meta wątków i powiązań przez pliki Markdown (bez konieczności zmiany kodu przy nowym wątku).

---

## 2. Architektura danych

### 2.1 Źródło: Markdown

- Obecne pliki w `docs/meta_threads` są researchowe; do gry potrzebna jest **konwencja parseowalna**.
- Propozycja: **jeden katalog** z plikami MD (np. `docs/meta_threads` lub `js/data/meta_threads`) + **wymagany frontmatter YAML** w każdym pliku, reszta w sekcjach o stałych nagłówkach.

**Minimalny frontmatter i sekcje (do parsowania):**

```yaml
---
id: dhs_ice          # unikalny ID wątku
title: DHS/ICE/DOJ/IRS
connections: [epstein_international, controversial_pardons]  # ID innych wątków
characters: [tom_homan, pam_bondi]   # id głów (Heads) do odblokowania
---
```

- Sekcje do parsowania (opcjonalnie, w zależności od potrzeby w grze):
  - **NODES** – każdy `### NODE X: NAZWA` + lista faktów → do ściany („karty” na ścianie) i warunków odblokowania.
  - **CONNECTIONS** / **LINKS TO OTHER THREADS** – już w frontmatter `connections`; ewentualnie w treści dla ludzi, parser bierze z YAML.
  - **QUOTE POOL** – cytaty do eventów / tooltipów.
- **Nowy wątek**: dodajesz nowy plik `.md` z frontmatter; w istniejących plikach dopisujesz ich `id` do `connections` w YAML. Żadna zmiana w JS przy samym dodaniu wątku (parser ładuje wszystkie MD z katalogu lub z listy plików z indexu).

### 2.2 Index plików (opcjonalnie)

- Plik `meta_threads_index.json` (lub jeden `index.md` z listą) z listą ścieżek do MD, żeby kolejność ładowania i „oficjalna lista” wątków była kontrolowana bez skanowania folderu. Edycja: dopisanie jednej linii przy nowym wątku.

### 2.3 Graf powiązań

- Po załadowaniu MD parser buduje strukturę: `{ threadId, title, connections[], characterIds[], nodes[] }`. Powiązania między wątkami = graf do wyświetlenia na ścianie i do logiki odblokowań (np. „wątek B odblokowany po postępie w wątku A”).

---

## 3. Pokój zastępujący left-panel

### 3.1 Zasada „zastąpienia”

- Obecne modale to `position: fixed` na cały ekran (`css/modals.css`).
- Tutaj: **zawartość left-panel ma być ukryta**, a w jej miejscu (wewnątrz `.left-panel`) wyświetlany jest **kontener pokoju**.
- Realizacja: np. na `.left-panel` klasa `room-view-active`; wszystkie dotychczasowe dzieci left-panel dostają `visibility: hidden` lub `display: none`, a jeden nowy div (np. `#meta-room-container`) wewnątrz left-panel ma `display: flex` i wypełnia panel. Przycisk „zamknij pokój” usuwa klasę i pokazuje standardową zawartość.
- Alternatywa: left-panel ma dwa „sloty” – domyślny (obecna zawartość) i `#meta-room-container`; przełączanie widoczności między nimi. Right-panel pozostaje bez zmian.

### 3.2 Wejście do pokoju

- Dodatkowy przycisk w Campaign Headquarters w kontenerze `systems-buttons-container` otwiera pokój. Integracja z `js/modal_manager.js` tylko jeśli pokój ma być w kolejce z innymi modalami; jeśli pokój ma być „innym widokiem” lewej strony, można go otwierać bez ModalManagera.

### 3.3 Nawigacja w pokoju

- **Menu na dole**: ikony / etykiety (Ściana | Taśma | Akta | Czwarty element) – przełączanie „stref” lub widoków w obrębie tego samego pokoju (jeden widok na raz albo podział ekranu – do ustalenia w implementacji).
- **Klikalne elementy**: np. klik w „ścianę” przewija/otwiera widok ściany, klik w „biurko” – tape recorder, itd.

---

## 4. Cztery elementy pokoju

### 4.1 Ściana powiązań

- **Opis**: ściana, na której przybywają grafiki (wycinki gazet, zdjęcia); łączone nitkami i pinezkami; rozbudowuje się z postępem w grze.
- **Dane**: każdy „element ściany” to rekord: `id`, `metaThreadId`, `nodeId` (opcjonalnie – z NODES w MD), `assetUrl` (obrazek), `label`, `unlockCondition` (np. `event:dhs_ice_node_1`, `support:50`, `quest:quest_05`). Powiązania między elementami: `fromElementId`, `toElementId` (nitka) – mogą wynikać z `connections` wątków lub z osobnej listy w MD/JSON.
- **Edycja**: w MD wątku w sekcji NODES można dodać pole `wallItem: { assetUrl, label }`; warunki odblokowania w configu lub w MD. Listę powiązań nitkami można trzymać w jednym pliku (np. `wall_connections.json`) lub generować z `connections` wątków (jeden „sznurek” między wątkiem A a B).

### 4.2 Biurko z tape recorderem

- **Opis**: odtwarzacz „wiadomości” odblokowanych w grze (np. pliki audio z questów, „przesłuchania”).
- **Dane**: lista wiadomości: `id`, `title`, `audioUrl` (lub brak – wtedy tylko tekst), `textTranscript`, `unlockCondition` (quest id, achievement, event, meta thread node). Obecnie `js/quests.js` nie ma audio w rewardach – to rozszerzenie: quest może przy ukończeniu odblokować wpis w „taśmie”.
- **Edycja**: jeden plik (np. `js/data/tape_messages.js` lub MD w `docs/meta_threads/tape_messages.md`) z listą definicji; warunki odblokowania w jednym miejscu. Łatwe dopisywanie nowych wiadomości bez ruszania logiki pokoju.

### 4.3 Regał z aktami (log gry po sesjach)

- **Opis**: gracz przegląda „log” gry z podziałem na sesje (każda sesja = jeden „plik” / jedna teczka).
- **Dane**: trzeba **persystować** log sesji. Obecny `js/acts_log.js` trzyma tylko `sessionEntries` w pamięci i nie zapisuje do save. Rozszerzenie: przy zapisie gry (lub przy zamknięciu sesji) dopisywanie bieżącej sesji do tablicy `savedSessions` w stanie; każda sesja: `sessionStartTime`, `sessionEndTime`, `actsGained`, `actsSpent`, lista wpisów (jak teraz `amount`, `source`, `timestamp`) oraz opcjonalnie: ukończone questy, kluczowe eventy. W pokoju: lista sesji (np. po dacie); po wyborze sesji – podgląd wpisów (jak obecny Acts Log, ale dla wybranej sesji).
- **Edycja**: format sesji ustalony w kodzie; ewentualne filtry/limit liczby sesji w `js/config.js` (np. ostatnie 30 sesji).

### 4.4 Propozycje czwartego elementu

- **Tablica / kalendarz kluczowych dat**: oś czasu z odblokowanymi „punktami” (daty wydarzeń z meta wątków lub gry). Klik w punkt pokazuje krótki opis. Dane: lista eventów z datą i warunkiem odblokowania; edycja = dopisanie wpisu do listy (MD/JSON).
- **Mapa (np. USA)**: pinami oznaczone miejsca związane z meta wątkami (Minnesota, DC, itd.). Odblokowane wątki/nody odblokują piny; klik w pin = tooltip lub krótki opis. Dane: plik z listą lokacji (id, lat/lon lub pozycja %, label, metaThreadId, unlockCondition).
- **Szafa / „sejf” z żartami**: lista krótkich tekstów (easter eggi, „classified” one-linery) odblokowywanych przy określonych achievementach lub postępach w meta wątkach. Prosty lista `id`, `text`, `unlockCondition`; łatwo edytowalna.

Wybierz jeden z powyższych (lub kombinację) na czwarty element; w planie implementacyjnym można zrealizować najpierw jeden.

---

## 5. Stan do zapisu (save/load)

Zgodnie z zasadą save-load-sync:

- **GameStore** (w `js/state.js`): nowy blok, np. `metaRoom: { wallUnlockedIds: [], tapeUnlockedIds: [], sessionLog: [ { sessionStart, sessionEnd, entries: [] }, ... ] }`. Opcjonalnie `metaThreadProgress: { threadId: { unlockedNodeIds: [], characterUnlocked: boolean } }` jeśli postęp w wątku ma być zapisywany osobno.
- **loadGame** w `js/offline.js`: w `stateToLoad` dodać `metaRoom: savedState.metaRoom || defaultMetaRoom`, oraz ewentualnie `metaThreadProgress`.
- **Sesje do regału**: albo `metaRoom.sessionLog` jest uzupełniany przy każdym `saveGame()` (bieżąca sesja dopisywana), albo przy starcie gry poprzednia sesja jest „zamykana” i dopisywana do `sessionLog`. Wymaga ustalenia, kiedy „kończy się” sesja (np. zamknięcie karty, save, lub tylko przy następnym load).

---

## 6. Pliki i miejsca w kodzie

| Co | Gdzie |
|----|--------|
| Definicje meta wątków (edytowalne) | `docs/meta_threads` – rozszerzyć o frontmatter YAML i konwencję sekcji; lub `js/data/meta_threads/*.md` |
| Index wątków (opcjonalnie) | `js/data/meta_threads_index.json` lub `docs/meta_threads/index.md` |
| Parser MD → struktura wątków | Nowy moduł, np. `js/meta_threads.js` (ładuje MD, parsuje frontmatter + sekcje, API: getThreads(), getConnections(), getNodesForThread()) |
| Definicje elementów ściany / warunki | W MD przy NODES lub osobny plik `js/data/meta_wall_items.js` / `wall_connections.json` |
| Definicje wiadomości taśmy | `js/data/tape_messages.js` lub MD |
| Stan pokoju i postęp wątków | `js/state.js` – `metaRoom`, ewent. `metaThreadProgress` |
| Zapis/wczytanie | `js/offline.js` – saveGame/loadGame + checklista z save-load-sync |
| HTML pokoju | Nowy kontener w `index.html` wewnątrz `.left-panel` (lub wstrzykiwany z JS), z sekcjami: ściana, biurko, regał, czwarty element |
| Style pokoju | `css/components.css` lub `css/systems.css` – klasy `.meta-room`, `.meta-room-wall`, `.meta-room-tape`, `.meta-room-shelf`, menu dolne |
| Przycisk wejścia | Header lub right-panel – np. ikona „pokój” / „dossier”; skrypt w `script.js` lub w nowym `js/meta_room.js` |
| Grafiki pokoju | `ASSETS/meta_room/` (tła, elementy ściany w `wall/`, placeholder), `ASSETS/UI/meta_room_icon.png`; szczegóły w sekcji 9 |

---

## 7. Przepływ danych (high-level)

- Źródła: Markdown meta_threads, tape_messages, wall items/connections.
- W grze: Parser MD → struktura wątków; GameStore (metaRoom) + Room UI. Eventy/questy/budynki wywołują odblokowanie (np. `metaRoomUnlock('wall', 'dhs_node_1')` lub `metaThreadProgress(threadId, nodeId)`). Moduł pokoju czyta stan z GameStore i pokazuje/ukrywa elementy ściany, taśmy, akt.

---

## 8. Kolejność wdrożenia (sugerowana)

1. **Dane**: Konwencja MD z frontmatter + parser ładujący wątki i powiązania (bez jeszcze wykorzystania w UI).
2. **Stan**: `metaRoom` (i ewent. `metaThreadProgress`) w state.js + save/load w offline.js.
3. **Pokój**: Kontener w left-panel, przełączanie widoku (ukrycie standardowej zawartości), menu dolne, szkielet 4 stref.
4. **Ściana**: Wyświetlanie elementów i nitek na podstawie odblokowań + definicji z MD/JSON.
5. **Taśma**: Lista wiadomości, odtwarzacz (audio + tekst), odblokowania z questów/eventów.
6. **Regał**: Persystowany log sesji + UI listy sesji i podglądu wpisów.
7. **Czwarty element**: W zależności od wyboru (tablica/kalendarz, mapa, szafa żartów).
8. **Integracja**: Wywołania odblokowań z eventów, questów i meta wątków oraz ewentualne powiązanie odblokowań postaci (Heads) z `metaThreadProgress`.

---

## 9. Grafiki i implementacja wizualna

### 9.1 Przegląd grafik (per strefa)

| Strefa | Grafiki | Opis implementacji |
|--------|---------|--------------------|
| **Wejście / pokój** | Ikona przycisku wejścia do pokoju (header/right-panel) | Jedna ikona, np. `ASSETS/UI/meta_room_icon.png` lub `ASSETS/ICONS/meta_room_32.png`. W HTML: `<img>` lub tło przycisku. |
| **Tło pokoju** | Opcjonalnie: tło całego pokoju (biurko + ściana w tle) | Jedna grafika lub CSS (gradient + prosty kształt). Jeśli grafika: `ASSETS/meta_room/room_bg.png` – pełna scena; wtedy strefy mogą być „hotspotami” na obrazie. |
| **Ściana powiązań** | (1) Tło ściany (corkboard / tablica). (2) **Elementy ściany** – wycinki gazet, zdjęcia, dokumenty (per NODE / per wall item). (3) Wizualne „nitki” i pinezki. | Tło: jedna tekstura `ASSETS/meta_room/wall_bg.png`. Elementy: każdy rekord w danych ma `assetUrl` → `ASSETS/meta_room/wall/{id}.png` (lub wspólny katalog). Nitki: SVG/CSS (linie) lub sprite; pinezki: małe ikony PNG. |
| **Biurko + tape** | (1) Biurko z tape recorderem (jedna ilustracja lub część tła). (2) Ikona „taśmy” / listy wiadomości. (3) Opcjonalnie: waveform/ikona odtwarzacza. | Główny widok: `ASSETS/meta_room/desk_tape.png` lub włączone w `room_bg`. Ikony: `ASSETS/UI/` lub `ASSETS/ICONS/`. Audio: tylko pliki dźwiękowe (np. `ASSETS/audio/tape_*.mp3`), bez wymogu grafik per wiadomość. |
| **Regał z aktami** | (1) Regał / półki z teczkami. (2) Ikona „teczki” dla pojedynczej sesji. (3) Opcjonalnie: różne kolory teczek (np. per rok). | Regał: `ASSETS/meta_room/shelf_bg.png` lub część room_bg. Teczki: jedna powtarzalna ikona lub sprite; ewentualnie kolor w CSS. |
| **Czwarty element** | Zależnie od wyboru: mapa USA (1 mapa + piny), kalendarz (tło + punkty), szafa (1 ilustracja szafy + lista tekstów). | Mapa: `ASSETS/meta_room/map_usa.png` + pozycje pinów w %; kalendarz: tło + CSS; szafa: `ASSETS/meta_room/safe_cabinet.png`. |

### 9.2 Struktura katalogów ASSETS

Proponowana struktura (spójna z istniejącą: `ASSETS/UI/`, `ASSETS/ICONS/`, `ASSETS/characters/`):

```
ASSETS/
  meta_room/              # wszystkie assety Meta Room
    room_bg.png           # opcjonalnie: pełne tło pokoju
    wall_bg.png           # tło ściany (corkboard/tablica)
    wall/                 # elementy przyklejane na ścianę (per node/item)
      dhs_node_1.png
      epstein_node_1.png
      ...
    desk_tape.png         # biurko z tape recorderem (lub w room_bg)
    shelf_bg.png          # regał z teczkami (lub w room_bg)
    map_usa.png           # tylko jeśli 4. element = mapa
    safe_cabinet.png      # tylko jeśli 4. element = szafa
    pins_threads.svg      # opcjonalnie: pinezki + fragmenty nitek (sprite)
  UI/
    meta_room_icon.png    # ikona wejścia do pokoju (np. dossier / pinezka)
  audio/                  # jeśli nie istnieje – utworzyć
    tape_*.mp3            # wiadomości taśmy (opcjonalnie)
```

- **Ścieżki w danych**: w MD/JSON zawsze względem root projektu, np. `ASSETS/meta_room/wall/dhs_node_1.png`. W JS przy renderze można użyć tej samej ścieżki w `<img src="...">` (index.html jest w root).
- **Fallback**: jeśli `assetUrl` brak lub plik nie istnieje – placeholder (jedna wspólna grafika „classified” / „redacted”) w `ASSETS/meta_room/placeholder.png`.

### 9.3 Sposób implementacji w kodzie

- **Ładowanie**: obrazy przez `<img src="{assetUrl}">` wstrzykiwane dynamicznie (np. w `js/meta_room.js`) na podstawie definicji z parsera wątków + `metaRoom.wallUnlockedIds`. Dla tła ściany/biurka/regału: `background-image` w CSS dla kontenerów `.meta-room-wall`, `.meta-room-tape`, `.meta-room-shelf`.
- **Nitki między elementami**: linie między pozycjami kart na ścianie – **SVG** (jeden `<svg>` w kontenerze ściany, `<line>` per połączenie) lub Canvas. Pozycje kart z definicji (np. `gridRow`, `gridCol` w wall item) lub z layoutu (flex/grid). Kolor/style linii w CSS lub w danych.
- **Pinezki**: małe ikony w narożnikach kart lub w węzłach; obrazek `ASSETS/meta_room/pin.png` (lub w pins_threads.svg). CSS `position: absolute` względem karty.
- **Responsywność**: left-panel ma ustaloną szerokość; obrazy w `meta_room` można przygotować w rozdzielczości dopasowanej do panelu (np. 400–500 px szerokości dla tła), z możliwością `background-size: cover/contain`.

### 9.4 Styl i konwencje grafik

- **Ściana – elementy (wycinki, zdjęcia)**: celowo „dokumentowe” – mogą być w stylu wyciętej gazety, zdjęcia z archiwum, czerwone stempel „CLASSIFIED”. Spójność z tonem gry (satira, dark comedy). Format: PNG z przezroczystym tłem gdzie potrzebne; proporcje dowolne (np. 2:3, 1:1), kod ujednolici rozmiar wyświetlania (np. max-width/max-height w CSS).
- **Tła (ściana, biurko, regał)**: jeden spójny styl wizualny z resztą gry – np. pixel art / ilustracja 2D w podobnej palecie co `ASSETS/UI/` i `ASSETS/ICONS/`. Unikać fotorealizmu.
- **Ikona wejścia do pokoju**: czytelna przy małym rozmiarze (np. 24–32 px); symbol: dossier, pinezka na mapie, lub drzwi. Zgodność z istniejącymi ikonami w headerze.
- **Dokumentacja**: każda nowa wygenerowana grafika (GenerateImage lub zewnętrzna) – wpis w `docs/Image_Generation_Prompts.md`: plik docelowy, kontekst (np. „Meta Room – tło ściany”), pełny prompt, ewentualnie reference image (np. character_head.png tylko dla postaci; dla ściany – bez obowiązkowego reference).

### 9.5 Placeholdery i kolejność tworzenia grafik

- **Minimum do pierwszej wersji pokoju**: (1) ikona wejścia `meta_room_icon.png`, (2) `wall_bg.png` (prosty corkboard/tablica), (3) jeden plik `ASSETS/meta_room/placeholder.png` na brakujące elementy ściany, (4) opcjonalnie `room_bg.png` lub osobno `desk_tape.png` i `shelf_bg.png`. Dzięki temu UI może działać z pustą ścianą i z jednym testowym elementem (np. `wall/dhs_node_1.png`).
- **Rozbudowa**: kolejne elementy ściany dodawane wraz z NODES w MD (pole `wallItem.assetUrl`); nowe pliki w `ASSETS/meta_room/wall/`. Taśma i regał na start mogą obyć się bez dedykowanych grafik (lista tekstowa + ewentualnie ikona z `ASSETS/UI/`).

### 9.6 Podsumowanie – gdzie co jest

| Grafika | Ścieżka | Źródło w danych / użycie |
|---------|---------|---------------------------|
| Ikona wejścia | `ASSETS/UI/meta_room_icon.png` | Przycisk w headerze/right-panel; na stałe w HTML/CSS. |
| Tło pokoju | `ASSETS/meta_room/room_bg.png` | Opcjonalnie; CSS `.meta-room-container`. |
| Tło ściany | `ASSETS/meta_room/wall_bg.png` | CSS `.meta-room-wall`. |
| Element ściany | `ASSETS/meta_room/wall/{id}.png` | `assetUrl` w NODES (MD) lub `meta_wall_items`; render w JS. |
| Placeholder | `ASSETS/meta_room/placeholder.png` | Gdy brak assetUrl lub 404. |
| Biurko/taśma | `ASSETS/meta_room/desk_tape.png` | CSS lub część room_bg. |
| Regał | `ASSETS/meta_room/shelf_bg.png` | CSS lub część room_bg. |
| Mapa / szafa | `ASSETS/meta_room/map_usa.png` lub `safe_cabinet.png` | Tylko przy wybranym 4. elemencie. |
| Pinezki/nitki | `ASSETS/meta_room/pin.png` lub `.svg` | CSS/JS przy pozycjonowaniu kart. |
| Audio taśmy | `ASSETS/audio/tape_{id}.mp3` | Pole `audioUrl` w definicji wiadomości (tape_messages). |

---

## 10. Pytania do decyzji przed implementacją

- Czy parser MD ma działać w przeglądarce (fetch MD + parser w JS), czy build-time (skrypt generujący JSON z MD)? W przeglądarce: potrzebna biblioteka do YAML (np. front-matter) i ładowanie plików (fetch z tej samej domeny lub wgranie MD do projektu).
- Który wariant czwartego elementu wybierasz: tablica/kalendarz, mapa, szafa żartów?
- Czy wejście do pokoju ma być odblokowane od początku, czy po jakimś warunku (np. pierwszy zakup konkretnego budynku, ukończenie questu)?

---

## 11. Połączenie z planem narzędzi treści

Plan Meta Room jest połączony z **planem narzędzi do tworzenia eventów i postaci** w jeden dokument:

- **Plik połączony:** `.cursor/plans/` – plan „Meta Room, meta wątki i narzędzia treści” (lub `tools_for_events_and_characters_*.plan.md`). Zawiera: Część I (Meta Room + meta wątki – skrót z tego dokumentu), Część II (narzędzia: add-character, add-event, formularze HTML), Część III (integracja: postacie = id w frontmatter wątków; eventy mogą odblokowywać elementy pokoju; opcjonalne narzędzia do wątków MD / ściany / taśmy) oraz **zunifikowaną kolejność wdrożenia** (najpierw tools, potem Meta Room dane/stan/UI/strefy, integracja, ewentualnie rozszerzenie tools o treść Meta Room).

- **Postaci (Heads):** tworzone narzędziem `tools/add-character.js` – te same `id` wpisuje się w `characters: [...]` w frontmatter plików MD wątków.
- **Eventy:** tworzone narzędziem `tools/add-event.js`; po wdrożeniu Meta Room można dodać efekt „odblokuj element pokoju”.
- **Opcjonalnie:** generatory snippetów/plików dla nowego wątku MD, elementu ściany, wpisu taśmy – w katalogu `tools/`.
