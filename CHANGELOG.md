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
- Konsola: **`/fakegi <on|off|status>`** — przełączanie fake GI z wideo (PMREM → `scene.environment`, boost `envMapIntensity`, Hemisphere/Ambient z koloru klatki); **`/postproc status`** dopisuje ten sam stan.
- Tryb **MYSEN** (`/mysen start` / `/mysen stop`): remiks z `ASSETS/mysen`, ukrycie napisu TOPKEK i wideo tła (opcjonalnie), wokselowe słowa zsynchronizowane polem `at` (sekundy) lub `wordTimesSec` w `MYSEN_CONFIG`; puls słów (`pulseScale` / `pulseMs` lub `wordPulses`); sekcja w menu pod Vajbuj; wzajemne wyłączanie z VAJBUJ.

### Fixed
- Glitch volumetryczny (HUD): trigger jednorazowy przekazuje czas ścienny (`Date.now()/1000`) jak pętla renderu — wcześniej `clock.getElapsedTime()` dawało `glitchEndTime` w skali ~sekund od startu strony przy `time` w skali Unix, więc efekt natychmiast wygasał i znikał.
- Oświetlenie / bloom na napisie: cofnięto `vertexColors` na materiałach `defaultBox` / `glass` / `gold` oraz tint `setColorAt` przy Letter Emission (zostaje silniejszy puls skali + `pulseScale`) — `vertexColors` + instancje mogły obniżyć jasność w buforze i osłabić postprocess (bloom).
- Bloom: obniżono `SHADER_CONFIG.bloom.threshold` (0.48 → 0.12) i lekko podniesiono `strength` — po `ACESFilmicToneMapping` w pierwszym przebiegu `RenderPass` bufor jest już ztone-mapowany; wysoki próg wycinał prawie całą poświatę (zgodnie z przykładem three.js z progiem ~0).
- FX Repulsion Swarm: w trybie scatter/grid impuls jest nakładany na `currentPos` (wcześniej tylko `velocity`, ignorowane gdy kostka nie jest „w locie”); w trybie repulsion bez zmian (`velocity` + integracja w symulacji).
- FX Letter Emission: silniejszy, konfigurowalny puls skali (`pulseScale`); `fx elapsed` liczone od `clock` (nie od mieszania z czasem ściennym).
- Panel FX dev — lista Active: zwijanie podglądu parametrów działa (CSS `[hidden]` nie jest już nadpisywane przez `display: flex`); poprawiony podgląd „next” dla pętli (`nextFireAt` vs czas ścienny).
- MYSEN: przy braku pliku `audioFile` (404) automatyczne przełączenie na `MYSEN_CONFIG.audioFileFallback` (domyślnie `VAJBUJ_TRIMMED.mp3`) oraz jaśniejsze logi przy `play()` bez źródła.
- MYSEN: po powrocie do normalnej sceny zawsze przywracane jest widoczne wideo tła (`backgroundVideoMesh` + `play()` gdy użytkownik nie wstrzymał tła) — wcześniej przy `hideBackgroundVideo: false` lub zmianie opcji mesh mógł zostać z `visible: false`, co obcinało duży emisyjny fill (często odczuwany jako „niebieskie” światło).
- MYSEN: domyślnie `audioEndTime: null` — odtwarzanie do naturalnego końca pliku (`audio.duration`); fade/stop liczone po `loadedmetadata`, zamiast sztywnych ~30 s z konfiguracji.
- Poprawiono heurystykę `perf=auto`: profil lite włącza się przy `navigator.deviceMemory` ≤ 3 GB zamiast ≤ 4 GB, żeby na desktopie (np. Brave/Chrome raportujące 4 GB) nie wyłączać SAO i CRT.

### Removed
- Usunięto tymczasową instrumentację debug (żądania HTTP do serwera ingest, zmienne `_agentLog*`, regiony `agent log`) z `script.js`.

### Changed
- Panel FX dev: zmiana kolejności aktywnych instancji (↑↓); przykładowe presety wybierane z dropdownu + przycisk „Add loop” zamiast trzech osobnych przycisków.
- Panel FX dev (`/fx dev`): menubar (Minimize, Export all, zamknięcie × dwuklikowe z uzbrojeniem na czerwono), UI po angielsku; aktywne instancje po lewej, edytor po prawej; parametry w wierszach po 3 sloty [nazwa|pole|zakres]; „Export preset” pod blokiem parametrów; import „Choose file” + Apply; własny scrollbar; większe etykiety/hinty; `FX_SAMPLE_PRESETS` — angielskie etykiety.
- Uaktualniono plan fragmentacji struktury (`docs/plans/2026_03/2026-03-28-plan-fragmentacji-struktury.md`): cienki katalog główny, moduły pod `src/`, agregacja CSS w root, strategia partiali HTML, doprecyzowanie zasady 8–12 granic domenowych vs liczba plików.
- Panel FX dev: styl jak menu (zmienne `--menu-surface-*`, przyciski jak `mode-btn` z prawego panelu), pola z wartościami domyślnymi z konfiguracji, podpowiedzi `Zakres: …` / `paramHints` pod parametrami; w `FX_CONFIG.registry` dodano `paramHints` oraz zakres `bpmSync` dla grid noise.
- Panel deweloperski FX (`/fx dev`): zamiast osadzenia w konsoli — pływający panel u góry ekranu (wyśrodkowany), z przyciskiem zamknięcia; mount do `document.body` w `fx-dev-panel.js`.
- Konsola poleceń: maximize, restore i zwijanie logu to trzy osobne przyciski z ikonami SVG w jednym rzędzie (bez nachodzącego `.menu-section-toggle`); zwijanie obsługuje `terminal-shell.js` i klasa `topkek-terminal-shell--collapsed` z `TERMINAL_CONFIG.shellUi`.
- Rozszerzono `knowledge_base.json` dla Buucha (GENIMG, tryb wydajności, FX, scena i tryby myszy, portfolio 3D vs Vimeo, slash vs czat, stack, podziękowania) oraz doprecyzowano APPSTAIN, Glitch Lab i SCNDBREJN — otwieranie z menu terminala po prawej zamiast nieobecnych w handlerze komend `/<nazwa>`.
- Rozdzielono pomoc konsoli: domyślne `/help` pokazuje skróconą listę komend, `/help full` — pełną dokumentację (w tym aliasy FX); treści w `TERMINAL_HELP_LINES_COMPACT` / `TERMINAL_HELP_LINES_FULL` w `config.js`; komunikaty Usage/Buuch/welcome wskazują obie ścieżki; blok `.topkek-terminal-help-block` ma ograniczoną wysokość z przewijaniem pionowym.

### Added
- Panel FX dev — na liście aktywnych instancji przycisk ▾/▴ rozwija blok z aktualnymi parametrami instancji (`params` z runtime); stan rozwinięcia zachowany przy odświeżaniu listy do czasu zamknięcia lub usunięcia instancji.
- Dodano panel deweloperski FX otwierany z konsoli (`/fx dev`): przełącznik runtime, BPM, Trigger / Start loop / Stop na efekt, pola parametrów, eksport/import presetu JSON (plik, schowek, wklejka); polecenia `/fx on` i `/fx off` włączają lub wyłączają runtime FX.
- Dodano polskie odpowiedniki fraz w `knowledge_base.json` (Buuch dopasowuje też zapytania po polsku).
- Dodano przycisk wstrzymania / wznowienia wideo tła w HUD (obok listy „Background”).
- Dodano wizualne „chipy” w logu konsoli: tło i lewa obwódka zależnie od typu linii (komenda, odpowiedź, info, błąd, Buuch).
- Dodano drugi profil streamu (`fastCharDelayMs` / `fastLineDelayMs` w `TERMINAL_CONFIG`) dla długich listingów `/help`; domyślne odpowiedzi i Buuch używają wolniejszego tempa znak po znaku.
- Dodano bezstanowy chat Buuch w konsoli: linie bez `/` dopasowywane do `knowledge_base.json` (`buuch-chat.js`), komendy `/` bez zmian.
- Dodano panel Performance HUD (`#perf-hud`) z bieżącym FPS, kolorami statusu (zielony/żółty/czerwony według progów) i miniwykresem highs/lows, konfigurowany przez `PERF_HUD_CONFIG` w `config.js`.
- Dodano szablon wdrożenia SFTP dla Cursor/VS Code (`.vscode/sftp.json.example`) oraz wpis w `.gitignore` dla lokalnego `.vscode/sftp.json` z hasłem.
- Dodano dokument `docs/SFTP_Deploy.md` z instrukcją wdrożenia strony przez SFTP w Cursorze/VS Code.
- Dodano animowane pojawianie się UI po zakończeniu lotu intro kamery: HUD kamery z góry, etykieta „TOP KEK Productions…” z dołu, panel kontrolek + konsola i wiersze menu z prawej (stagger + krótki efekt „glitch” na liniach); parametry w `POST_INTRO_UI_CONFIG` (`config.js`); tryb `prefers-reduced-motion` pomija ukrywanie i animacje.
- Dodano panel kamery w lewym górnym rogu (`#camera-hud`): na żywo współrzędne pozycji (i cel orbit w Free Cam), przełączniki Free / Dynamic Cam, przycisk resetu widoku; konfiguracja `CAMERA_HUD_CONFIG` w `config.js`.
- Dodano konsolę poleceń na dole prawego panelu (`terminal-shell.js`, `#topkek-terminal-shell`) z komendami: `help`, `vajbuj` / `vajbuj stop`, `bloom`, `sao`, `crt`, `light`, `postproc status`; dane UI w `TERMINAL_CONFIG` (`config.js`).
- Dodano intro kamery po ukryciu loadera: zbliżanie z dużej odległości do pozycji startowej z ease-in (`INTRO_CAMERA_CONFIG` w `config.js`; czas trwania w konfiguracji).
- Dodano `CONFIG.innerCubeZBias` (opcjonalny offset Z inner cubes przy `loadParticles` z JSON; domyślnie 0 — zgodność z zbakowanym `particles_*.json`).
- Dodano możliwość sterowania „mocą emmisji” (envMapIntensity + intensity/ambient z próbkowania wideo) osobno dla każdego background video.
- Dodano wskaźnik beatu BPM w HUD przy kontrolkach tła: licznik 2x2 zapala kolejne pola w rytmie wybranego BPM.
- Dodano bazę efektów volumetrycznych sterowaną z terminala (`fx`) z registry efektów, parametrami modyfikowalnymi komendami, trybami `trigger/loop` oraz hybrydowym parserem czasu (sekundy i beaty).
- Dodano subtelne przyciski zwijania/rozwijania dla każdej sekcji menu osobno (lewy HUD i prawy panel), widoczne dopiero po najechaniu kursorem na daną sekcję.

### Changed
- Konsola: prompt i echo użytkownika `U >` (fioletowy, wyższa saturacja), odpowiedzi Buucha z prefiksem `B >` i zielonym tłem bez zmian; `/help` w jednym obramowanym bloku bez tła na pojedynczych liniach (`plainListing`); limit linii logu liczy też linie wewnątrz bloku pomocy.
- Zmieniono `knowledge_base.json` Buuch chata na wersję w całości po angielsku (odpowiedzi i słowa kluczowe).
- Rozszerzono stream logu konsoli: powitanie, odpowiedzi komend (poza `{ stream: false }`) i Buuch piszą się znak po znaku w wolnym tempie; `/help` korzysta z szybszego profilu.
- Przypięto konsolę (`#topkek-terminal-shell`) do prawego dolnego rogu ekranu; tryb `maximize` zachowuje tę pozycję i jedynie poszerza panel.
- Przeniesiono obramowania z kontenerów całych menu na poziom pojedynczych sekcji (lewy panel: `Camera`, `Mouse`, `Glitch`, `Change text`; prawy panel: `Vajbuj`, `Games`, `Software`) oraz ujednolicono typografię nagłówków sekcji.
- Ujednolicono styl wszystkich menu (w tym `#camera-hud`, `#perf-hud`, `#ui-container`, `#terminal-menu` i `.topkek-terminal-shell`) do wspólnego shella wizualnego wzorowanego na sekcjach `Background` i `Performance`.
- Dopasowano sekcję `Background BPM` w lewym HUD: wyrównano etykiety `Background` i `Beat` do jednego wiersza oraz powiększono licznik beatów 2x2, aby lepiej odpowiadał wysokości kontrolek dropdown.
- Ujednolicono składnię komend konsoli do formatu z prefiksem slash (`/help`, `/fx ...`, `/material ...`) i zaktualizowano komunikaty `Usage`.
- Dodano symulowany streaming odpowiedzi dla `/help`, aby linie pomocy pojawiały się progresywnie jak w terminalu.
- Rozbudowano komendę `help` w konsoli o sekcyjny opis wszystkich komend (działanie, składnia i przykłady) oraz ujednolicono komunikaty `Usage`.
- Poprawiono czytelność logu konsoli przez dodanie timestampu do każdej linii i kolorystyczne rozróżnienie komend użytkownika, odpowiedzi, informacji i błędów.
- Przeniesiono panel Performance HUD (`#perf-hud`) pod sekcję opcji tła w lewym `#camera-hud`, aby metryki FPS były obok kontrolek background video/BPM.
- Zmieniono nagłówek konsoli TOPKEK: przyciski `maximize` i `restore` umieszczono w tym samym wierszu co napis `console`, a stan maksymalizacji przenosi panel na dół ekranu, centruje go i zwiększa rozmiar.
- Zastąpiono przycisk `Change BG` dwoma listami wyboru w HUD kamery: wybór konkretnego tła oraz wybór BPM sterującego tempem animacji tła (mapowanie BPM na `playbackRate` wideo).
- Przeniesiono kontrolki `Glitch Volumetric`, `Change text` i `Change BG` do lewego HUD kamery pod sekcję „Mouse animation Mode”; sekcja glitch nie jest już renderowana statycznie w `index.html`.
- Przeniesiono przełączanie materiałów napisu z klawisza spacji do komendy terminala `material toggle | default | alt | status`.
- Zmieniono domyślny `CONFIG.animationMode` na `scatter` dla trybu animacji myszy.
- Zmieniono domyślną ścieżkę SFTP w lokalnym pliku `.vscode/sftp.json` z `/public_html` na `/topkek`.
- Zmieniono pasek przewijania logu konsoli terminala (`.topkek-terminal-log`) na customowy, spójny z zielonym motywem UI.
- Przeniesiono menu „Mouse animation Mode” z prawego panelu pod menu kamery w lewym HUD (`#camera-hud`).
- Przeniesiono sekcję „Glitch volumetryczne” z dynamicznego renderowania w `script.js` do statycznego markupu w `index.html`, pozostawiając obsługę logiki przycisków w JS.
- Zmieniono krzywą intro kamery z ease-in na ease-out, aby końcówka dojazdu była płynniejsza.
- Zmieniono treści w `index.html` na spójnie angielskie (w tym etykietę przycisku odtwarzania i pozostałe polskie fragmenty).
- Przeniesiono sterowanie kamerą (Free Cam / Dynamic Cam) z prawego panelu do lewego HUD kamery.
- VAJBUJ uruchamiany wyłącznie z konsoli (wpis `vajbuj`); wpis w menu terminala jest tylko informacyjny.
- Ustawiono start intro kamery na `Z = 50` (`INTRO_CAMERA_CONFIG.startRadius`).
- Wydłużono intro kamery po loaderze do 9 s (`INTRO_CAMERA_CONFIG.durationMs`).
- Zmieniono `Change text` na kontrolkę inline w prawym panelu (input + przycisk `regen`), która przeładowuje stronę z nowym napisem przez parametr URL `?text=...`, oraz usunięto nieużywany modal custom text.
- Dopracowano UX `Change text`: pole pojawia się dopiero po kliknięciu przycisku i zastępuje go w tym samym miejscu; input jest bezramkowy, od razu aktywny (focus + migający caret) i wypełniony aktualnym tekstem.
- *(zmiany w istniejącej funkcjonalności)*
- Ukryto w menu terminala wpis i przycisk „Animation portfolio” (wrapper z atrybutem `hidden` w `index.html`; usunięcie `hidden` przywraca widoczność).
- Zmieniono loader, aby symulował postęp i wyświetlał memiczne komunikaty co sekundę podczas ładowania.
- Zmieniono parametry fake-loadera, aby pasek nie kończył się zbyt szybko i komunikaty zmieniały się rzadziej.
- Dopasowano loader: komunikaty wolniej (ok. co 3s), po angielsku i z mniejszą czcionką.
- Zmieniono font w loaderze na bezszeryfowy.
- Dodano statyczny tytuł `T O P K E K` nad loaderem i wymuszono jednowierszowy `loading-text`.

### Fixed
- Poprawiono przedwczesne pojawianie się pustych ramek prawego menu przed końcem intro kamery: w stanie `post-intro-ui-pending` ukrywany jest cały `#terminal-menu`, a nie tylko jego linie.
- Poprawiono logikę zwijania menu przez usunięcie globalnych przycisków krawędziowych i zastąpienie ich niezależnym zwijaniem sekcji.
- Poprawiono duplikowanie panelu Performance HUD: inicjalizacja sprawdza teraz obecność `#perf-hud` w `camera-hud` przed fallbackowym wywołaniem.
- Poprawiono przewijanie logu konsoli: kółko myszy nad oknem konsoli przewija teraz wyświetlany tekst logu zamiast tła strony.
- Wygładzono animacje wejścia menu/UI: ustawiono `animation-fill-mode: both` i `will-change` dla elementów reveal, aby wyeliminować „skakanie” przy opóźnieniach i staggerze.
- Poprawiono brak animacji wejścia menu/UI na systemach z aktywną preferencją `prefers-reduced-motion`: reveal po intro kamery ponownie wymusza animacje.
- Poprawiono przedwczesne pojawianie się menu/UI: reveal nie uruchamia się już przy przełączaniu trybu kamery i innych akcjach pobocznych, tylko po zakończeniu intro kamery (z krótkim fallbackiem czasowym względem `INTRO_CAMERA_CONFIG.durationMs`).
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
