# MYSEN — remiks / audio na stronę

Umieść tutaj plik audio remiksu (np. `mysen-remix.mp3`) i ustaw `MYSEN_CONFIG.audioFile` w [`config.js`](../../config.js) na tę samą ścieżkę względem rootu strony (np. `ASSETS/mysen/mysen-remix.mp3`).

Jeśli tego pliku nie ma (404), aplikacja spróbuje **`MYSEN_CONFIG.audioFileFallback`** (domyślnie `VAJBUJ_TRIMMED.mp3` w katalogu głównym strony), żeby tryb dało się odpalić podczas testów. Ustaw `audioFileFallback: null`, gdy nie chcesz zapasowej ścieżki.

Długość odtwarzania: w `MYSEN_CONFIG` ustaw `audioEndTime: null`, żeby grać od `audioStartTime` do końca pliku (`audio.duration`). Skończony czas (np. skrót) ustawiasz liczbą sekund na osi czasu mediów.

Tryb uruchamiasz z konsoli: `/mysen start` i zatrzymujesz: `/mysen stop`.
