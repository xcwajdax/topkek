# ⚡ Glitch Lab

**Eksperymentalne efekty glitch na klatkach animacji z podglądem w czasie rzeczywistym**

Glitch Lab to zaawansowane narzędzie desktop do tworzenia sztuki cyfrowej poprzez kontrolowane zniekształcenia obrazu. Aplikacja pozwala na zastosowanie różnorodnych efektów glitch do sekwencji klatek animacji, oferując pełną kontrolę nad intensywnością i parametrami efektów.

![Glitch Lab Interface](https://img.shields.io/badge/Interface-Polish-blue) ![Python](https://img.shields.io/badge/Python-3.x-green) ![GUI](https://img.shields.io/badge/GUI-Tkinter-orange) ![License](https://img.shields.io/badge/License-Open%20Source-brightgreen)

## ✨ Główne Funkcje

### 🎨 **10+ Efektów Glitch**
- **RGB Shift** - Przesunięcie kanałów kolorów dla efektu chromatic aberration
- **Horizontal Shift** - Poziome przesunięcia pasków obrazu
- **Block Displacement** - Przemieszczanie bloków pikseli
- **Scanlines** - Efekt linii skanujących w stylu CRT
- **Color Channel Swap** - Zamiana kanałów kolorów
- **Noise Bands** - Paski szumu cyfrowego
- **VHS Tracking** - Efekty śledzenia w stylu VHS
- **JPEG Artifacts** - Symulacja artefaktów kompresji

### 🎬 **Zaawansowany System Animacji**
- **Keyframe Animation** - Pełna kontrola nad intensywnością efektów w czasie
- **Wzorce Animacji**: `every`, `every_n`, `random`, `burst`, `keyframes`
- **Tryby Intensywności**: `constant`, `fade_in`, `fade_out`, `pulse`, `random`
- **Interpolacja** - Płynne przejścia między keyframe'ami

### 👁️ **Podgląd w Czasie Rzeczywistym**
- **Dual Preview** - Równoczesny podgląd oryginału i wyniku
- **Synchronizacja** - Wspólne sterowanie odtwarzaniem
- **Zoom & Pan** - Pełna kontrola nad widokiem
- **Frame Navigation** - Precyzyjna nawigacja po klatkach

### ⚙️ **Tryb Zaawansowany**
- **Parametry Efektów** - Szczegółowa kontrola nad każdym efektem
- **Real-time Preview** - Podgląd pojedynczej klatki z efektami
- **Batch Processing** - Przetwarzanie całych sekwencji

## 🚀 Szybki Start

### Automatyczna Instalacja (Zalecane)

#### Windows
```bash
# Pełna instalacja (Python + biblioteki)
install.bat

# Tylko biblioteki (jeśli Python już zainstalowany)
install-packages.bat
```

#### Linux/macOS
```bash
# Pełna instalacja (Python + biblioteki)
./install.sh

# Lub ręcznie przez pip
pip install -r requirements.txt
```

### Ręczna Instalacja
```bash
# Wymagane biblioteki
pip install Pillow numpy

# Opcjonalne (auto-restart)
pip install watchdog
```

### Uruchomienie
```bash
# Windows
run.bat

# Linux/macOS lub bezpośrednio
python main.py
```

### Podstawowe Użycie
1. **Wybierz katalog** z ponumerowanymi klatkami (np. `frame_001.png`, `frame_002.jpg`)
2. **Ustaw katalog wyjściowy** lub użyj "Nowy Output"
3. **Wybierz efekty** z listy dostępnych
4. **Dostosuj intensywność** (0.5 - 5.0)
5. **Kliknij GENERUJ** i obserwuj postęp

## 🎯 Dla Kogo?

- **Digital Artists** - Tworzenie eksperymentalnej sztuki cyfrowej
- **Video Editors** - Dodawanie efektów glitch do animacji
- **Creative Professionals** - Praca z estetyką glitch art
- **Hobbyści** - Eksperymentowanie z wizualnymi efektami

## 🛠️ Architektura

### Modularny Design
```
glitch_lab/
├── main.py                 # Główna aplikacja i GUI
├── core/                   # Logika przetwarzania
│   ├── effects.py          # Implementacje efektów
│   ├── animation.py        # System keyframe'ów
│   ├── processing.py       # Pipeline przetwarzania
│   └── utils.py           # Narzędzia pomocnicze
├── gui/                    # Komponenty interfejsu
│   ├── theme.py           # Ciemny motyw neonowy
│   ├── preview.py         # Odtwarzacze podglądu
│   └── animation_editor.py # Edytor keyframe'ów
└── config/                 # Konfiguracja
    ├── effects_registry.py # Rejestr efektów
    └── constants.py       # Stałe aplikacji
```

### Kluczowe Technologie
- **Python 3.x** - Język programowania
- **Tkinter + ttk** - Framework GUI z ciemnym motywem
- **PIL/Pillow** - Przetwarzanie obrazów
- **NumPy** - Operacje na tablicach pikseli

## 🎨 Przykłady Efektów

### RGB Shift
Klasyczny efekt chromatic aberration - przesunięcie kanałów czerwonego i niebieskiego tworzy charakterystyczne "rozszczepienie" kolorów.

### Block Displacement
Losowe przemieszczanie prostokątnych bloków pikseli, tworząc efekt "rozpadającego się" obrazu.

### VHS Tracking
Symulacja problemów z odtwarzaniem taśm VHS - faliste zniekształcenia i artefakty śledzenia.

## 🔧 Zaawansowane Funkcje

### Mnożnik Klatek
Automatyczne duplikowanie klatek z sekwencyjną numeracją - idealne do dostosowywania frame rate.

### Keyframe Animation
Pełna kontrola nad animacją efektów:
- Definiowanie punktów kluczowych
- Interpolacja między keyframe'ami
- Różne tryby przejść (linear, ease-in, ease-out)

### Batch Processing
Wydajne przetwarzanie całych sekwencji z:
- Paskiem postępu w czasie rzeczywistym
- Logowaniem operacji
- Obsługą błędów

## 📊 Workflow

1. **Import** → Załaduj sekwencję klatek
2. **Configure** → Wybierz efekty i parametry
3. **Preview** → Sprawdź wynik na pojedynczej klatce
4. **Animate** → Ustaw animację intensywności (opcjonalnie)
5. **Process** → Wygeneruj całą sekwencję
6. **Export** → Gotowe klatki w katalogu wyjściowym

## 🎪 Interface

Aplikacja oferuje intuicyjny interfejs w języku polskim z trzema głównymi panelami:

- **Lewy Panel** - Ustawienia podstawowe, efekty, animacja
- **Środkowy Panel** - Zaawansowane parametry efektów (opcjonalny)
- **Prawy Panel** - Podglądy oryginału i wyniku z kontrolkami

## 🚀 Rozwój

Glitch Lab jest aktywnie rozwijany z naciskiem na:
- Dodawanie nowych efektów glitch
- Optymalizację wydajności
- Rozszerzanie możliwości animacji
- Poprawę user experience

## 🤝 Wkład w Projekt

Zapraszamy do współpracy! Projekt jest otwarty na:
- Nowe efekty glitch
- Poprawki błędów
- Optymalizacje wydajności
- Tłumaczenia interfejsu
- Dokumentację

## 📋 TODO i Changelog

- **[TODO.md](TODO.md)** – lista zadań (do zrobienia, w toku, zrobione). Instrukcja użytkowania jest w pliku.
- **[CHANGELOG.md](CHANGELOG.md)** – historia zmian wersji. Zasady prowadzenia (Keep a Changelog) są opisane na początku pliku.

## 📄 Licencja

Open Source - szczegóły w pliku LICENSE

---

**Glitch Lab** - Gdzie kontrolowane zniekształcenia stają się sztuką cyfrową ⚡