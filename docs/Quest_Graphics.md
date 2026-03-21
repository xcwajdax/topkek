# Grafiki questów

W modalu każdego questa (sekcja `.quest-picture`) wyświetlana jest **jedna ilustracja** przypisana do tego questa.

## Konwencja

| Quest | Nazwa (skrót) | Plik PNG |
|-------|----------------|----------|
| quest_01 | First Redactions | `ASSETS/QUESTS/quest_01.png` |
| quest_02 | Troll Army | `ASSETS/QUESTS/quest_02.png` |
| quest_03 | Professional Troublemaker | `ASSETS/QUESTS/quest_03.png` |
| quest_04 | Enhancement Protocol | `ASSETS/QUESTS/quest_04.png` |
| quest_05 | Ready for the Real Game | `ASSETS/QUESTS/quest_05.png` |
| quest_06 | Re-election | `ASSETS/QUESTS/quest_06.png` |

Ścieżka do obrazka jest wpisana na stałe w odpowiednim pliku HTML w `ASSETS/QUESTS/` (np. `quest_01_clicks.html` → `quest_01.png`). Definicje w `js/quests.js` (QUEST_DEFINITIONS) nie zawierają pola `imagePath`.

Styl grafik: refined pixel art (scenki), grube obrysy, ograniczona paleta, czytelne przy wyświetlaniu do ok. 300px wysokości. Prompty użyte do generacji zapisane w `docs/Image_Generation_Prompts.md`.
