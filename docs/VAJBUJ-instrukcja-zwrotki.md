# VAJBUJ – przedłużenie symulacji tekstu (kolejna zwrotka)

Instrukcja: co przygotować i gdzie dodać, żeby przedłużyć „lyric simulation” VAJBUJ o kolejną zwrotkę.

---

## 1. Tekst zwrotki w `VAJBUJ_CONFIG.lyrics`

W pliku **`topkek/config.js`** w tablicy `VAJBUJ_CONFIG.lyrics` dopisujesz kolejne elementy w tej samej strukturze co obecne zwrotki:

- **Słowa** – obiekty z `text` i opcjonalnie:
  - `color` – kolor (hex, np. `0xffffff`, `0xff0000`)
  - `scale` – skala słowa (np. `1.2` dla większego)
  - `offsetX`, `offsetY` – przesunięcie
- **Koniec linii** – obiekt `{ lineBreak: true }` (bez `text`).

**Przykład** jednej linii + koniec linii:

```js
{ text: "Twoje", color: 0xffffff, offsetX: 0 },
{ text: "słowa", color: 0xffffff, offsetX: 0 },
{ text: "nowej", color: 0xffffff, offsetX: 0 },
{ text: "zwrotki.", color: 0xff0000, scale: 1.2 },
{ lineBreak: true },
```

Dodaj te obiekty na końcu tablicy `lyrics` (przed zamykającym `]`), tak jak obecne zwrotki.

---

## 2. Opcjonalnie: `wordTimings`

- **`wordTimings`** to tablica **numerów klatek** (25 FPS), w których każde **słowo** (nie `lineBreak`) ma być w pełni złożone.
- Obecnie jest 48 słów i 48 wartości w `wordTimings`.

**Opcja A – chcesz zsynchronizować z bitem:**  
Dla każdego **nowego słowa** (w kolejności) dopisz jeden numer klatki. Np. jeśli nowa zwrotka ma 7 słów, dopisujesz 7 liczb (np. `700, 710, 720, 735, 750, 765, 780`). Łączna liczba elementów w `wordTimings` musi być równa **łącznej liczbie słów** we wszystkich zwrotkach (bez `lineBreak`).

**Opcja B – nie dopisujesz `wordTimings`:**  
Jeśli `wordTimings` jest puste albo krótsze niż liczba słów, kod sam rozkłada słowa w czasie (linie równomiernie w pierwszych ~80% fragmentu, słowa w linii co ~12 klatek). Wtedy **nie musisz** nic przygotowywać poza samym tekstem w `lyrics`.

---

## 3. Długość fragmentu audio (jeśli zwrotka jest w nowym fragmencie)

- `audioStartTime` i `audioEndTime` definiują fragment utworu w sekundach.
- Jeśli nowa zwrotka ma być **po** obecnym fragmencie (29 s), musisz:
  - **albo** przedłużyć `audioEndTime` (i mieć dłuższy plik/trim `VAJBUJ_TRIMMED.mp3`),
  - **albo** zostawić ten sam fragment i dodać tylko tekst – wtedy nowe linie pojawią się w drugiej części tego samego odcinka (z auto-dystrybucją albo z nowymi `wordTimings`).

---

## Podsumowanie

- **Minimum:** przygotuj listę obiektów (słowa + `lineBreak` po każdej linii) i dopisz je do `VAJBUJ_CONFIG.lyrics` w `config.js`.
- **Dla dokładnej synchronizacji z muzyką:** dopisz do `wordTimings` po jednej klatce na każde nowe słowo (w tej samej kolejności co w `lyrics`).
