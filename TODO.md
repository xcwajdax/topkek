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

### 1. Portfolio animacyjne z projektami [średni]
- [ ] Dodać sekcję Portfolio na stronie (np. dostępną z menu / przycisku lub jako osobną „zakładkę” w UI).
- [ ] Przygotować listę projektów w config.js (tytuł, miniaturka, ID/link Vimeo, ewent. krótki opis).
- [ ] Zaimplementować animowane miniaturki (CSS lub lekkie animacje w canvas/JS – hover, wejście).
- [ ] Po kliknięciu w miniaturkę: otwierać modal z embedem Vimeo (iframe) i przyciskiem zamknięcia.
- [ ] Stylowanie modala portfolio (spójne z resztą strony) i obsługa zamknięcia (X, Escape, klik w tło).

### 2. Ulepszenie Vajbuj [średni]
- [ ] Dodać zwrotkę (link powrotny / przycisk „Wróć” do głównego widoku po zakończeniu lub w trakcie Vajbuj).
- [ ] Wprowadzić nowe, ładniejsze animacje (np. wejście/wyjście słów, tła, ewent. drobne efekty cząsteczkowe lub przejścia).
- [ ] Opcjonalnie: dopracować timing animacji i synchronizację z muzyką.

### 3. Ujednolicenie modali projektów (kodowanie) [wysoki]
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
