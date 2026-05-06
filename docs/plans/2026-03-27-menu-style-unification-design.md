# Ujednolicenie stylu menu TOPKEK (Background/Performance jako wzorzec)

## Cel
Ujednolicić wygląd wszystkich menu UI tak, aby bazowały na estetyce sekcji `Background` i `Performance`.

## Zakres
- `#camera-hud`
- `#perf-hud`
- `#ui-container` (prawy panel)
- `#terminal-menu`
- `.topkek-terminal-shell`

## Wybrane podejście
Podejście 2: wspólny shell wizualny + tokeny CSS.

## Kroki implementacji
1. Dodać wspólne tokeny panelowe w `style.css` (`--menu-surface-*`, `--menu-label-color`, `--menu-text-color`).
2. Przepiąć kluczowe kontenery menu na wspólne tło, border, radius i cień.
3. Ujednolicić kolorystykę tekstów/etykiet panelowych.
4. Zachować istniejącą logikę JS i strukturę DOM bez zmian funkcjonalnych.
5. Zweryfikować lint i dopisać wpis do `CHANGELOG.md`.

## Kryteria akceptacji
- Wszystkie menu mają spójny wygląd ramki/tła.
- Sekcje `Background` i `Performance` pozostają wizualnym wzorcem.
- Brak zmian funkcjonalnych w interakcjach paneli.
