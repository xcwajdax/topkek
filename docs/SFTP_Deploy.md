# Wdrożenie strony przez SFTP (Cursor / VS Code)

Strona TOPKEK jest statyczna (HTML, CSS, JS, assety). Wystarczy wgrać pliki na katalog WWW hostingu — nie jest potrzebny Node ani Python na serwerze.

## Bezpieczeństwo

- **Nie commituj** pliku `.vscode/sftp.json`, jeśli zawiera hasło — w repozytorium jest `.gitignore` dla tego pliku.
- **Nie wklejaj haseł** do czatu ani do publicznych repozytoriów. Hasło do SFTP zmień w panelu hostingu, jeśli mogło wyciec.

## Pliki w projekcie

- **`.vscode/sftp.json.example`** — szablon konfiguracji (host, port, użytkownik, `remotePath`).
- **`.vscode/sftp.json`** — Twoja lokalna kopia z hasłem (utwórz ją sam; nie jest wersjonowana).

### Pierwsza konfiguracja

1. Skopiuj `.vscode/sftp.json.example` → `.vscode/sftp.json`.
2. Uzupełnij w `sftp.json` pole `"password"` hasłem z panelu hostingu (albo zostaw `""`, jeśli rozszerzenie samo wyświetli monit — zależy od wersji).
3. Sprawdź **`remotePath`**: w przykładzie jest `/public_html`. U niektórych hostów katalog strony to np. `html`, `www`, `htdocs` — wtedy zmień ścieżkę zgodnie z panelem lub pierwszym połączeniem SFTP.

## Rozszerzenie SFTP w Cursorze

1. Otwórz folder projektu **topkek** jako workspace.
2. **Command Palette** (`Ctrl+Shift+P`) → komendy typu **SFTP: Config**, **SFTP: Upload Project** lub **SFTP: Sync Local -> Remote** (dokładne nazwy zależą od rozszerzenia; popularne: Natizyskunk SFTP).
3. Pierwszy upload: **Upload Project** wgra projekt z uwzględnieniem listy **`ignore`** z konfiguracji (m.in. `.git`, `.cursor`, `docs`, `start.bat`).

## Co musi być na serwerze

W katalogu głównym strony (document root) powinny znaleźć się m.in.:

- `index.html`, `script.js`, `config.js`, `style.css`
- `ASSETS/` (jeśli strona z nich korzysta)
- `particles_pc.json`, `particles_mobile.json` oraz inne pliki ładowane z kodu (np. `keyframes.txt`, `terminal-shell.js` — według tego, co jest importowane / linkowane w `index.html`)

**Nie są wymagane** na serwerze: `.git/`, `.cursor/`, lokalny `start.bat` (opcjonalnie).

## Po wgraniu

- Otwórz w przeglądarce adres strony z panelu hostingu lub przypisaną domenę.
- **404 lub pusta strona**: często zły folder (`remotePath`) albo brak `index.html` w katalogu głównym witryny.
- W panelu hostingu włącz **SSL (HTTPS)**, jeśli jest dostępny (np. Let’s Encrypt).

## Domena

- W panelu przypisz domenę do pakietu i ustaw rekordy **DNS** (A / CNAME) według instrukcji dostawcy.
