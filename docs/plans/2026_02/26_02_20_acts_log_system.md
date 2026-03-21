---
name: Acts Log System
overview: "Nowy system \"Acts Log\" odblokowywany po pierwszym zakupie University of MASA: log zysków i strat Aktów z danej sesji, panel wysuwany z prawej strony stats-container (checkbox w prawym górnym rogu), oraz Zaawansowany log w oknie przesuwalnym/minimalizowalnym z pełną historią i źródłem (Source) dla każdego wpisu."
todos:
  - id: todo-1769813524184-w2ucmbhlv
    content: stworzyć nową zasadę pracy Jeśli w jakimś nowym systemie dodajemy/odejmujemy acts to trzeba to podpiąć do loga
    status: pending
  - id: todo-1769813576003-ovb40wqfp
    content: ""
    status: pending
isProject: false
---

# Plan: System Acts Log

## 1. Odblokowanie i warunek widoczności

- **Warunek odblokowania**: `state.buildings['university_of_masa.03'].count >= 1` (pierwszy zakup University of MASA).
- Nie zapisujemy osobnej flagi w save – odblokowanie wynika z stanu budynków. Checkbox i panel logu są ukryte dopóki warunek nie jest spełniony.
- **Miejsce wykrycia pierwszego zakupu**: w [js/purchases.js](js/purchases.js) w `buyItem()` po `item.count++` – gdy `type === 'buildings'` i `id === 'university_of_masa.03'` i `item.count === 1`, wywołać funkcję z modułu Acts Log (np. `onFirstMasaPurchased()`) w celu pokazania checkboxa i ewentualnego jednorazowego powiadomienia.

---

## 2. Architektura danych i API logowania

- **Nowy moduł**: [js/acts_log.js](js/acts_log.js) (tworzenie od zera).
- **Dane sesji** (tylko w pamięci, bez zapisu do save/load/offline):
  - Tablica wpisów: `{ amount: number, source: string, timestamp: number }`. `amount` > 0 = zysk (zielone tło), `amount` < 0 = strata (czerwone tło).
- **API**:
  - `logActsChange(amount, source)` – wywoływane tylko przy **dyskretnych** zmianach Acts (nie przy pasywnym APS). Dodaje wpis na początek tablicy i odświeża UI logu (jeśli jest widoczny).
- **Źródła (Source)** do użycia przy wywołaniach (**pasywny APS nie trafia do logu**):
  - Zyski: `"Pressed Redact"`, `"Random Event (APC)"`, `"Random Event (APS)"`, `"Random Event (Refund)"`, `"Offline Progress"`, `"Combo"`, `"Quest Reward"`, `"Sold X Building Name"`, `"Sold X Upgrade Name"`.
  - Straty: `"Bought X Building Name"`, `"Bought X Upgrade Name"`, `"Tower Floor"`, `"Tower Reroll"`, `"Propaganda Media"` (lub nazwa medium).

---

## 3. Miejsca wywołań `logActsChange(amount, source)`


| Plik                                       | Zdarzenie                                                                                                                                                           | Wywołanie                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [js/events.js](js/events.js)               | `suppressAct()` – **tylko** gdy `isManualClick === true` (Pressed Redact) oraz w callbacku `animateComboActsTransfer` (Combo). **Nie** wywoływać dla pasywnego APS. | Zysk: `'Pressed Redact'` (klik) lub `'Combo'` (callback animacji). Pasywny APS – brak wpisu w logu.               |
| [js/random_events.js](js/random_events.js) | `acts_instant_apc`, `acts_instant_aps`, refund                                                                                                                      | `logActsChange(amount, 'Random Event (APC)'/'Random Event (APS)'/'Random Event (Refund)')`                        |
| [js/notifications.js](js/notifications.js) | Po dodaniu Acts w ścieżce redact (bez animacji combo i z animacją)                                                                                                  | `logActsChange(pendingActs, 'Offline Progress')` lub przy transferze combo – już w events.js                      |
| [js/quests.js](js/quests.js)               | Po `GameStore.increment('suppressedActs', amount)` za nagrodę                                                                                                       | `logActsChange(amount, 'Quest Reward')`                                                                           |
| [js/purchases.js](js/purchases.js)         | `buyItem()` – odjęcie kosztu                                                                                                                                        | `logActsChange(-effectiveCost, \`Bought 1 ${item.name})`(dla quantity 1; przy batchu np.`Bought 10 ${item.name}`) |
| [js/purchases.js](js/purchases.js)         | `SellB()` / `SellU()` – zwrot                                                                                                                                       | `logActsChange(sellPrice, \`Sold ${sold} ${building.name})` i analogicznie dla upgrade                            |
| [js/tower.js](js/tower.js)                 | Budowa piętra, reroll                                                                                                                                               | `logActsChange(-floorCost, 'Tower Floor')`, `logActsChange(-rerollCost, 'Tower Reroll')`                          |
| [js/propaganda.js](js/propaganda.js)       | Zakup medium                                                                                                                                                        | `logActsChange(-cost, \`Propaganda: ${mediaName})`lub krótko`'Propaganda Media'`                                  |
| [js/events.js](js/events.js)               | Tester: `addActs(amount)`                                                                                                                                           | `logActsChange(amount, 'Tester')`                                                                                 |


Wszystkie wywołania warunkowe: `if (typeof logActsChange === 'function') logActsChange(...)`.

---

## 4. UI – checkbox i panel logu (podstawowy)

- **Checkbox** w prawym górnym rogu [.stats-container](index.html) (np. wewnątrz `stats-container` jako ostatni element lub div z `position: absolute; top: 0; right: 0`). Etykieta np. "Acts Log" / "Log". Checkbox widoczny tylko gdy odblokowany (pierwszy MASA kupiony).
- **Panel logu**:
  - Wysuwa się **po prawej stronie** od stats-container (identyczny styl jak [.stats-container](css/components.css): `background: rgba(18,18,18,0.85)`, `border: 2px solid rgba(212,175,55,0.3)`, `border-radius: 12px`, `backdrop-filter`, `font-family: Jersey 10`).
  - Domyślnie schowany; widoczny gdy checkbox zaznaczony. Layout: np. wrapper `stats-container` + panel logu w jednym kontenerze flex; panel po prawej, ta sama wysokość/linia co stats-container.
  - Zawartość: **10 ostatnich wpisów** (slice z pełnej tablicy sesji). Nowe wpisy **na górze**; przy każdym nowym wpisie animacja **slide-in z lewej** dla nowego wiersza; istniejące wiersze przesuwają się w dół.
  - Każdy wiersz: kolor tła – **zielony** (zysk), **czerwony** (strata). Tekst: np. `+1.5K` / `-100` + opcjonalnie skrót źródła w podstawowym widoku (można pominąć w 10‑wpisowym podglądzie, zostawić tylko w Zaawansowanym).
  - Na dole panelu: przycisk **"Advanced log"** otwierający okno Zaawansowanego logu.

**HTML**: W [index.html](index.html) wewnątrz lub zaraz obok `.stats-container` dodać:

- Kontener obejmujący stats-container + prawy panel (np. `div.acts-log-wrapper`).
- W prawym górnym rogu stats-container: checkbox + etykieta (generowane z JS lub statycznie w HTML; jeśli z JS – wstawiane np. w `stats-container` jak quest bubble w [js/quests.js](js/quests.js)).
- Panel logu: `div#acts-log-panel.acts-log-panel` (ukryty domyślnie), wewnątrz lista wpisów + przycisk "Advanced log".

**CSS** ([css/layout.css](css/layout.css) lub [css/components.css](css/components.css)):

- Pozycjonowanie checkboxa w prawym górnym rogu `.stats-container` (np. `position: relative` na stats-container, checkbox w `position: absolute; top: ...; right: ...`).
- `.acts-log-panel` – wymiary, styl jak `.stats-container`, wyświetlanie (np. `transform`/`width`) zależne od stanu "otwarty/closed".
- Klasy wierszy: `.acts-log-row.acts-log-gain`, `.acts-log-row.acts-log-loss` (zielone/czerwone tło).

**Animacje** ([css/animations.css](css/animations.css) + ewentualnie [js/animations.js](js/animations.js)):

- Klasa animacji slide-in z lewej dla nowego wiersza (np. `@keyframes acts-log-row-slide-in` z `transform: translateX(-100%)` → `translateX(0)`). Dodanie klasy do nowego wiersza w JS, po czasie usunięcie klasy.

---

## 5. Zaawansowany log (okno)

- **Zawartość**: pełna historia sesji (cała tablica); każdy wiersz: wartość (+/-) + **Source** (np. "Pressed Redact", "Bought 10 Troll Farm", "Sold 1 Bathroom Archive", "Combo", "Random Event (APC)").
- **Okno**: przesuwalne (drag), minimalizowalne, zamykalne – ten sam wzorzec co w [js/notifications.js](js/notifications.js) (`.draggable-window`, `.window-header`, `.window-minimize`, `.window-close`) i [js/utils.js](js/utils.js) (`makeWindowDraggable`). Tworzenie okna dynamicznie w JS (jak inne okna w notifications.js).
- **Scroll**: obszar z listą wpisów z overflow-y: auto, żeby przewijać długi log.
- Nie używać ModalManager do kolejkowania – to pomocnicze okno, nie blokujące modalne popupy.

---

## 6. Konfiguracja i pozostałe pliki

- **[js/config.js](js/config.js)**: nowa sekcja np. `ACTS_LOG: { MAX_VISIBLE_ENTRIES: 10, SLIDE_ANIMATION_MS: 300 }` z krótkim opisem po polsku.
- **saveGame/loadGame ([js/script.js](js/script.js) lub gdzie jest zapis)**: nie zapisywać tablicy logu (tylko sesja). Odblokowanie = `buildings['university_of_masa.03'].count >= 1` – brak nowych pól.
- **[js/offline.js](js/offline.js)**: brak zmian (log tylko z bieżącej sesji).
- **support-effect-list (reguła 5)**: W [js/support.js](js/support.js) w `getAllGameEffects()` dodać merge z nową funkcją `getActsLogSystemEffects()`. Funkcja zwraca obiekt z kategorią `other` (jak `getRandomEventSystemEffects`). Gdy log jest odblokowany: `other: [{ source: 'acts_log', icon: '📋', text: 'Acts Log', value: 'Session log of gains/losses', tooltip: '...' }]`. W przeciwnym razie `other: []`. Dzięki temu w kolumnie "Other" pojawi się informacja o Acts Log.
- **Achievements ([js/achievements.js](js/achievements.js))**: Dodać np. jeden achievement: "First Glance" – otworzyć Acts Log po raz pierwszy (checkbox włączony), lub "Archivist" – otworzyć Zaawansowany log. Wymaga wywołania `unlockAchievement()` z modułu acts_log przy pierwszym otwarciu panelu / zaawansowanego okna.

---

## 7. Kolejność ładowania skryptów

- [index.html](index.html): dodać `<script src="js/acts_log.js"></script>` po modułach, które zmieniają Acts (np. po quests.js, random_events.js), a przed script.js (który inicjuje grę). Docelowo: po `support_column.js` lub po `random_events.js`, aby `logActsChange` był dostępny dla events, purchases, tower, propaganda, notifications, quests.

---

## 8. Podsumowanie plików


| Akcja       | Plik                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Nowy        | `js/acts_log.js` – stan sesji, `logActsChange()`, unlock check, budowa UI (checkbox, panel, zaawansowane okno), integracja z draggable |
| Modyfikacja | `index.html` – wrapper/checkbox/panel (lub tylko placeholder, reszta z JS); ewentualnie tylko miejsce na wstrzyknięcie z JS            |
| Modyfikacja | `js/purchases.js` – po zakupie pierwszego MASA wywołanie `onFirstMasaPurchased()`; w buyItem/SellB/SellU wywołania `logActsChange`     |
| Modyfikacja | `js/events.js` – w suppressAct i w callbacku combo `logActsChange`                                                                     |
| Modyfikacja | `js/random_events.js` – po każdej zmianie Acts w eventach `logActsChange`                                                              |
| Modyfikacja | `js/notifications.js` – przy dodaniu Acts (redact) `logActsChange`                                                                       |
| Modyfikacja | `js/quests.js` – po nagrodzie w Acts `logActsChange`                                                                                   |
| Modyfikacja | `js/tower.js` – po build floor i reroll `logActsChange`                                                                                |
| Modyfikacja | `js/propaganda.js` – po zakupie medium `logActsChange`                                                                                 |
| Modyfikacja | `js/config.js` – sekcja ACTS_LOG                                                                                                       |
| Modyfikacja | `js/support.js` – `getActsLogSystemEffects()`, merge w `getAllGameEffects()`                                                           |
| Modyfikacja | `css/components.css` lub `css/layout.css` – style panelu i checkboxa                                                                   |
| Modyfikacja | `css/animations.css` – animacja slide-in wiersza                                                                                       |
| Modyfikacja | `js/achievements.js` – 1 nowy achievement (First Glance / Archivist)                                                                   |


Changelog po implementacji: zapis do `CHANGELOGS/old/{YYYY_MM_DD}/changelog_{YY_MM_DD_HH}_acts_log_system.md` zgodnie z zasadami.
