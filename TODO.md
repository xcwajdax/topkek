# TODO – lista zadań

Lista rzeczy do zrobienia w projekcie. Aktualizuj ten plik przy planowaniu i zamykaniu zadań.

---

## Jak używać

- **Dodawanie:** wpisuj nowe zadania na górze sekcji (najnowsze pierwsze).
- **Status:** używaj prefiksów `[ ]` (do zrobienia), `[x]` (zrobione), `[~]` (w toku / odłożone).
- **Priorytet:** opcjonalnie dopisuj `[wysoki]` / `[średni]` / `[niski]`.
- **Zamykanie:** po zrobieniu zamień `[ ]` na `[x]` i w razie potrzeby przenieś do „Zrobione” lub usuń.
- **Przegląd:** co jakiś czas przenoś zrobione wpisy do sekcji „Zrobione” lub usuń stare.

---

## Do zrobienia

### 1. Brave – profil wydajności vs post-processing [średni]

- [ ] Zbadać zachowanie strony w **przeglądarce Brave** (Shields, blokady, WebGL, ewent. ograniczenia canvas) – czy problem dotyczy **pipeline’u post-processingu** (`EffectComposer`, passy), czy **niewłaściwego doboru profilu** `PERFORMANCE_CONFIG` (`?perf=`, `localStorage`, heurystyka `deviceMemory` / `hardwareConcurrency`).
- [ ] Odtworzyć regresję (np. brak passów, czarny ekran, złe kolory, zbyt agresywny `lite`) i dopisać **obejście lub detekcję** (fallback, komunikat w UI, dokumentacja: wyłączenie Shields / `?perf=full`), tak aby wygląd i efekty były spójne z Chrome/Firefox przy świadomym profilu.

### 2. Kolory sześcianów (voxeli) wewnątrz napisu [średni]

- [ ] Zbadać i poprawić **kolorystykę pojedynczych sześcianów / voxeli** składających się na litery (`TOPKEK` itd.) – niespójności, przepalenia, złe mapowanie z `MATERIALS` / shaderów, wpływ oświetlenia i post-processu na odczyt koloru.
- [ ] Upewnić się, że tryby materiałów (`/material`, `CONFIG` / `SHAPE_DEFINITIONS`) dają przewidywalne, zamierzone kolory na kostkach w środku „objętości” tekstu (nie tylko na powierzchni / w podglądzie).

### 3. Panel kontroli efektów – sekcje post-processingu [średni]

W panelu deweloperskim efektów (`fx-dev-panel.js` / UI powiązane z pipeline’em z `script.js`: `EffectComposer`, passy z `three/addons/postprocessing`) **dodać wyraźne sekcje (nagłówki / grupy)** dla efektów post-processingu, analogicznie do tego jak terminal ma komendy `/postproc`, `/bloom`, `/sao`, `/crt`, `/fakegi`.

- [ ] **Bloom** – sekcja z włącz/wyłącz (o ile profil wydajności na to pozwala) i suwakami / polami dla parametrów ze `SHADER_CONFIG.bloom` (threshold, strength, radius itd.).
- [ ] **Fake Global Illumination (wideo IBL)** – sekcja dla fake GI (PMREM z wideo, `scene.environment`, światła z klatki – zgodnie z istniejącą logiką i `/fakegi`).
- [ ] **CRT** – sekcja dla passu CRT i parametrów ze `SHADER_CONFIG.crt` (krzywizna, scanline, vignette, aberracja itd.).
- [ ] **SAO** (i ewentualne inne passy z composera) – osobna sekcja tam, gdzie pass jest aktywny w danym profilu (`PERFORMANCE_CONFIG` → `enableSao` itd.).
- [ ] **Spójność:** objąć **wszystkie** aktualne (i przyszłe) passy post-processingu – każdy ma mieć czytelną sekcję w panelu, a etykiety i zakresy wartości trzymać zsynchronizowane z `config.js` (`SHADER_CONFIG`, `FX_CONFIG` jeśli dotyczy).

### 4. Portfolio animacyjne z projektami [średni]
- [ ] Dodać sekcję Portfolio na stronie (np. dostępną z menu / przycisku lub jako osobną „zakładkę” w UI).
- [ ] Przygotować listę projektów w config.js (tytuł, miniaturka, ID/link Vimeo, ewent. krótki opis).
- [ ] Zaimplementować animowane miniaturki (CSS lub lekkie animacje w canvas/JS – hover, wejście).
- [ ] Po kliknięciu w miniaturkę: otwierać modal z embedem Vimeo (iframe) i przyciskiem zamknięcia.
- [ ] Stylowanie modala portfolio (spójne z resztą strony) i obsługa zamknięcia (X, Escape, klik w tło).

### 5. Ulepszenie Vajbuj [średni]
- [ ] Dodać zwrotkę (link powrotny / przycisk „Wróć” do głównego widoku po zakończeniu lub w trakcie Vajbuj).
- [ ] Wprowadzić nowe, ładniejsze animacje (np. wejście/wyjście słów, tła, ewent. drobne efekty cząsteczkowe lub przejścia).
- [ ] Opcjonalnie: dopracować timing animacji i synchronizację z muzyką.

### 6. Ujednolicenie modali projektów (kodowanie) [wysoki]
- [ ] Ustalić wspólny wzorzec: jeden wrapper (backdrop + content), spójne otwieranie/zamykanie (animacja wejścia/wyjścia, Escape, klik w backdrop).
- [ ] Ujednolicić wygląd: wspólna klasa bazowa dla modali (np. `.modal`, `.modal-backdrop`, `.modal-content`), spójny przycisk X, opcjonalnie ten sam styl scrollbara i typografia.
- [ ] Zastosować wzorzec do modali: APPSTAIN, Glitch Lab, GENIMG (zachowując specyfikę treści każdego projektu).
- [ ] W script.js: jedna funkcja do otwierania/zamykania modali (np. `openModal(id)`, `closeModal(id)`) z obsługą animacji i focus trap.

---

## W toku / odłożone

- [~] *(przykład)* Zadanie w trakcie lub odłożone

---

## Zrobione

*(Tu możesz przenosić zakończone zadania albo usuwać je po wpisaniu do CHANGELOG.)*

- [x] *(przykład)* Zaimplementowano Z
