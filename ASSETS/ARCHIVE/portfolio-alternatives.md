# Propozycje alternatywnego systemu portfolio

Po zarchiwizowaniu systemu „3D ramki + miniatury wideo” poniżej są trzy możliwe kierunki na nowy system portfolio. Można wybrać jeden, połączyć elementy lub doprecyzować własny wariant.

---

## Opcja A: Portfolio tylko w terminalu (lista + modal)

- W sekcji **Animation portfolio** w terminal-menu: lista projektów jako zwykłe linie (np. `> ZORZA 2025`, `> Project 2`, …).
- **Bez obiektów 3D** w scenie – cała interakcja w menu.
- Klik w linię projektu otwiera ten sam modal Vimeo z wybranym filmem.
- Zalety: prostota, mniej draw calli, spójne z resztą menu. Minus: brak „wow” w scenie 3D.

---

## Opcja B: Karuzela / jeden „ekran” 3D

- Po najechaniu na „Animation portfolio” w scenie pojawia się **jedna** ramka (lub jeden billboard) z **aktualną** miniaturą wideo.
- Przełączanie projektów: strzałki w UI lub klawisze (np. A/D, lewo/prawo), albo lista w terminalu – zmiana wyświetlanego reelu bez mnożenia obiektów.
- Zalety: jeden mesh, mniej zasobów, czytelny focus. Minus: widać tylko jeden projekt na raz.

---

## Opcja C: Galeria 2D (overlay na stronie)

- Sekcja portfolio to **panel overlay** (np. wysuwany z boku lub pod terminalem), z siatką miniatur **2D** (obrazy lub wideo w `<video>`).
- Klik w miniaturę otwiera modal Vimeo jak teraz.
- Scena 3D bez portfolio – tylko tło.
- Zalety: znajomy pattern (galeria), łatwe rozszerzanie, dobre na mobile. Minus: brak integracji z światem 3D.

---

## Doprecyzowanie

Żeby dopasować implementację do Twoich oczekiwań, warto ustalić:

1. Czy nowy system ma **całkowicie zastąpić** obecny (wtedy usuwamy z kodu 3D ramki i lazy-init), czy ma **współistnieć** (np. przełącznik „stary / nowy” albo osobna ścieżka wejścia).
2. Którą opcję (A, B, C) wybierasz – albo krótki opis własnego pomysłu (np. „karuzela 3D + lista w terminalu”).
3. Czy modal Vimeo po kliknięciu w projekt ma zostać bez zmian (tak jak w archiwum).

Po Twojej decyzji można rozpisać konkretny plan implementacji (kroki, pliki, zmiany w `script.js` / `config.js` / HTML/CSS) pod wybrany wariant.
