# Heads System – grafiki do stworzenia

Lista plików graficznych wymaganych przez system Heads (postacie w grze). Ścieżki są względem katalogu głównego projektu.

---

## Wymagane (użycie w grze)

| # | Ścieżka pliku | Postać | Uwagi |
|---|----------------|--------|--------|
| 1 | `ASSETS/character_head.png` | Ronald Dump (default) | Głowa domyślna; używana też jako **favicon** (index.html). |
| 2 | `ASSETS/characters/kusher.png` | Kusher (Jared Kushner) | |
| 3 | `ASSETS/characters/miller.png` | Miller (Stephen Miller) | |
| 4 | `ASSETS/characters/musk.png` | Musk (Elon Musk) | |
| 5 | `ASSETS/characters/vance.png` | Vance (J.D. Vance) | |
| 6 | `ASSETS/characters/bubba.png` | Bubba (Bill Clinton) | |
| 7 | `ASSETS/characters/pizza_prince.png` | The Pizza Prince (Książę Andrzej) | |
| 8 | `ASSETS/characters/cosmic_scholar.png` | The Cosmic Scholar | |
| 9 | `ASSETS/characters/dersh.png` | The Dersh (Alan Dershowitz) | |
| 10 | `ASSETS/characters/little_george.png` | Little George (George Stephanopoulos) | |

**Razem: 10 plików** (1 w `ASSETS/`, 9 w `ASSETS/characters/`).

---

## Wymiary i format

- **Format:** PNG (przezroczyste tło zalecane).
- **Wyświetlanie:**  
  - Desktop: **80×80 px** (`.character-head` w `css/components.css`).  
  - Mobile: **60×60 px** (nadpisanie w `css/mobile.css`).  
- **Styl:** W CSS ustawione jest `image-rendering: pixelated` – grafiki mogą być w stylu pixel art; w przeciwnym razie można rozważyć usunięcie tej reguły.
- **Rekomendacja:** Przygotować obrazy w rozdzielczości co najmniej **80×80 px** (np. 160×160 lub 256×256 dla retina), w jednym stylu (np. „głowa” / popiersie, ten sam kadr dla wszystkich).

---

## Gdzie są używane

- **Rząd głów:** `index.html` – `<div class="character-heads-row">` z `<img id="character-head-{id}" src="...">`.
- **Cytaty / modal:** `js/data/quotes_data.js` – `imagePath` w `CHARACTERS`; `script.js` – wyświetlanie wybranej głowy przy cytacie.
- **Favicon:** tylko `ASSETS/character_head.png` – `<link rel="icon" href="ASSETS/character_head.png">`.

---

## Opcjonalne (na przyszłość)

Postacie **bezos**, **gates**, **thiel** są w stanie gry i przypisane do budynków w Billionaire's Cave, ale **nie mają** w kodzie `imagePath` ani elementów `<img>` w rzędzie głów. Jeśli planujesz dodać dla nich ikony w UI (np. w rzędzie głów lub w Cave), trzeba będzie:

- dodać wpisy w `CHARACTERS` w `js/data/quotes_data.js` (id, name, imagePath, quotes),
- dodać `<img id="character-head-bezos">` itd. w `index.html`,
- utworzyć pliki:
  - `ASSETS/characters/bezos.png`
  - `ASSETS/characters/gates.png`
  - `ASSETS/characters/thiel.png`

Na ten moment **nie są wymagane** do działania gry.
