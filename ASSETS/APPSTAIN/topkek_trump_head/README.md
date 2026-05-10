# TOPKEK – Gadająca głowa Trumpa (Ronald Dump)

Widget do osadzenia na stronie TOPKEK: **jedna głowa Trumpa** i **dymek z cytatami** – zachowanie i wygląd **identyczne** z systemem Heads w grze APPSTAIN.

## Zawartość

- **trump-head.css** – style (kontener, głowa, dymek, ogon dymka, animacja `bubbleAppear`)
- **trump-quotes.js** – cytaty (Ronald Dump z APPSTAIN) + logika: `showQuote`, losowy cytat w odstępach czasu, klik w głowę = nowy cytat z cooldownem
- **index.html** – strona demo (odpal z serwera lub z dysku; ścieżka do obrazka względem katalogu APPSTAIN)

## Osadzenie na stronie TOPKEK

1. **Skopiuj pliki** `trump-head.css` i `trump-quotes.js` na serwer/stronę TOPKEK (np. w katalogu `assets/topkek-trump/`).

2. **Dodaj fragment HTML** w miejscu, gdzie ma być widget (np. u góry strony, jak w APPSTAIN):

```html
<div id="topkek-character-container" class="topkek-character-container">
    <div class="topkek-character-heads-row">
        <img id="topkek-trump-head" class="topkek-character-head" src="ŚCIEŻKA_DO_OBRAZKA" alt="Ronald Dump">
    </div>
    <div id="topkek-speech-bubble" class="topkek-speech-bubble hidden">
        <div class="topkek-speech-text"></div>
        <div class="topkek-speech-tail"></div>
    </div>
</div>
```

3. **Podłącz CSS i JS** (ścieżki dostosuj do swojej strony):

```html
<link rel="stylesheet" href="ścieżka/trump-head.css">
<!-- ... treść strony ... -->
<script src="ścieżka/trump-quotes.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', function () {
        TopkekTrumpHead.init({
            imagePath: 'ŚCIEŻKA_DO_character_head.png'
        });
    });
</script>
```

4. **Obrazek głowy**  
   W APPSTAIN używany jest `ASSETS/character_head.png`. Na TOPKEK wklej ten plik w wybraną lokalizację i ustaw `imagePath` w `init()` (oraz atrybut `src` w `<img>`) na tę ścieżkę.

## Opcje `TopkekTrumpHead.init(options)`

| Parametr | Domyślnie | Opis |
|----------|-----------|------|
| `imagePath` | `'ASSETS/character_head.png'` | URL obrazka głowy |
| `minInterval` | 60000 | Min. odstęp (ms) między automatycznymi cytatami |
| `maxInterval` | 120000 | Maks. odstęp (ms) |
| `displayDurationBase` | 3000 | Bazowy czas wyświetlania dymka (ms) |
| `displayDurationPerChar` | 50 | Dodatkowy czas na znak (ms) |
| `displayDurationMin` | 3000 | Min. czas wyświetlania (ms) |
| `displayDurationMax` | 15000 | Maks. czas wyświetlania (ms) |
| `clickCooldown` | 25000 | Cooldown (ms) po kliknięciu w głowę |

## Zachowanie (jak w APPSTAIN)

- Co pewien losowy czas (między `minInterval` a `maxInterval`) pokazuje się losowy cytat w dymku.
- Kliknięcie w głowę pokazuje od razu losowy cytat; przez `clickCooldown` ms kolejne kliknięcia są ignorowane.
- Czas pokazywania dymka zależy od długości cytatu (jak w grze).

## Test lokalny

Otwórz `index.html` w przeglądarce (najlepiej przez serwer, np. z katalogu głównego APPSTAIN), aby ścieżka `../ASSETS/character_head.png` działała. Na samej stronie TOPKEK użyj ścieżek względnych do Twojego hosta.
