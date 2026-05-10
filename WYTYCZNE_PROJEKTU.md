# Wytyczne projektu TOPKEK

Dokument opisuje technologie, metody pracy, zależności i konwencje używane w projekcie **TOPKEK** (strona TOPKEK Productions).

---

## 1. Stack technologiczny

### Frontend (aplikacja główna)
- **HTML5** – struktura strony, semantyka, `lang="en"`
- **CSS3** – style (bez preprocesorów), zmienne CSS gdzie potrzebne
- **JavaScript (ES modules)** – logika w plikach `.js` z `type="module"` w HTML

### Brak frameworków i bundlerów
- **Brak** React, Vue, Angular
- **Brak** npm/yarn/pnpm – brak pliku `package.json` w tym repozytorium
- **Brak** Vite, Webpack, Parcel – aplikacja działa jako statyczne pliki + serwer dev

### 3D i grafika
- **Three.js** w wersji **0.160.0**, ładowany przez **import map** z CDN (unpkg)
- Używane moduły:
  - `three` (core)
  - `three/addons/controls/OrbitControls.js`
  - `three/addons/loaders/FontLoader.js`, `RGBELoader.js`
  - `three/addons/geometries/TextGeometry.js`, `RoundedBoxGeometry.js`
  - `three/addons/math/MeshSurfaceSampler.js`
  - `three/addons/utils/BufferGeometryUtils.js`
  - `three/addons/postprocessing/*` (EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, SAOPass)

Źródło w `index.html`:
```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
```

---

## 2. Zależności zewnętrzne (runtime)

| Zależność   | Wersja   | Sposób dostarczenia |
|------------|----------|----------------------|
| Three.js   | 0.160.0  | Import map → unpkg CDN |
| Orbitron (Google Fonts) | zmienna (CSS2 API) | `fonts.googleapis.com` / `fonts.gstatic.com` — neonowe nagłówki szuflad w menu terminala (banery VAJBUJ / NEWSKIN, bloki MYSEN / Games / Software; klasa `.term-menu-drawer-display-title`) |
| vis-network | 9.1.9   | jsDelivr CDN ([dokumentacja](https://visjs.org/)) — tylko podstrona **AGENTS · symulacja** (`ASSETS/agents/simulacja-www/index.html`), graf mapy Katalogu |

Poza powyższym główna aplikacja jest „vanilla”; symulacja AGENTS ładuje vis-network jako osobny skrypt klasyczny (bez bundlera), patrz `IMPLEMENTACJA.md` w tym katalogu.

---

## 3. Struktura plików i odpowiedzialności

| Plik / folder        | Opis |
|----------------------|------|
| `index.html`         | Punkt wejścia, import map, modale (APPSTAIN, Glitch Lab, GENIMG, custom text, image viewer), podłączenie CSS/JS |
| `script.js`          | Główny moduł ES: scena 3D, cząsteczki, kamera, postprocessing, obsługa modali, loader |
| `config.js`          | Konfiguracja: `CONFIG`, `VAJBUJ_CONFIG`, `SHADER_CONFIG`, `MATERIALS`, `SHAPE_DEFINITIONS`, `CINEMATIC_CONFIG`, `LOADER_CONFIG`, eksport do `script.js` |
| `style.css`          | Style globalne, loadera, menu terminala, modali, responsywność |
| `start.bat`          | Uruchomienie lokalnego serwera (Python) i otwarcie przeglądarki |
| `particles_pc.json`  | Dane cząsteczek dla wersji desktop (duży plik) |
| `particles_mobile.json` | Dane cząsteczek dla wersji mobilnej |
| `keyframes.txt`      | Numery klatek (np. do synchronizacji z animacją/After Effects) |
| `keyframes.aep`      | Projekt After Effects (animacje / keyframe’y) |
| `src/showcase/`      | Moduły ES: showcase / MYSEN / animacja dokumentu (importowane z `script.js` i z `tools/`) |
| `src/ui/`            | Moduły ES: konsola terminala, panel FX, Buuch chat |
| `knowledge_base.json` | Baza intencji Buucha (ładowana przez `fetch` z poziomu strony głównej) |
| `ASSETS/`            | Zasoby: obrazy, audio, wideo, fonty, podprojekty |

### ASSETS
- **ASSETS/APPSTAIN/** – zasoby gry APPSTAIN (obrazy, muzyka, wideo, screenshoty)
- **ASSETS/APPSTAIN/topkek_trump_head/** – gadająca głowa (Trump): `trump-head.css`, `trump-quotes.js`, `embed-snippet.html`, `index.html`, `README.md`
- **ASSETS/GENIMG/** – galeria GENIMG (obrazy, `system_and_ui_overview.md.resolved`)

---

## 4. Środowisko deweloperskie

### Serwer lokalny
- **Python 3** – wbudowany moduł `http.server`
- Port: **8002**
- Uruchomienie: `start.bat` (Windows) lub ręcznie:
  ```bash
  python -m http.server 8002
  ```
- `start.bat` dodatkowo otwiera w przeglądarce `http://localhost:8002`

### Wymagania
- Przeglądarka z obsługą **ES modules** i **import maps**
- Python w PATH (do `start.bat`)

---

## 5. Metody pracy i konwencje

### Kod
- **Język logiki:** JavaScript (ES6+), moduły przez `import`/`export`
- **Język styli:** CSS (plain)
- **Język struktury:** HTML5
- **Konfiguracja:** jedna główna – `config.js` (parametry sceny, cząsteczek, shaderów, materiałów, VAJBUJ, kamery, loadera)

### Rozdzielenie odpowiedzialności
- `config.js` – tylko dane i stałe konfiguracyjne, bez logiki
- `script.js` – importuje z `config.js`, zawiera całą logikę 3D, UI i zdarzeń
- Style – w `style.css` oraz `ASSETS/APPSTAIN/topkek_trump_head/trump-head.css`

### Wykrywanie urządzenia
- **Mobile:** `config.js` eksportuje `IS_MOBILE` (user agent + `window.innerWidth < 800`)
- Od tego zależą m.in. liczba cząsteczek, plik particles (`particles_mobile.json` vs `particles_pc.json`), rozmiar tekstu, shadow map

### Języki w treściach
- Strona główna: angielski (`lang="en"`)
- Modal Glitch Lab: przełącznik PL/ENG (treści z zewnętrznych plików Markdown)
- Inne treści: mix PL/ENG w zależności od kontekstu (np. APPSTAIN, GENIMG)

### Zasoby zewnętrzne
- Three.js: **tylko** z unpkg (wersja 0.160.0)
- Wyjątek: **Google Fonts** (Orbitron) — typografia nagłówków szuflad menu terminala (`.term-menu-drawer-display-title` w `style.css`, ładowane z `index.html`); reszta UI bez dodatkowych CDN dla JS/CSS

---

## 6. Funkcjonalności główne (dla orientacji)

- Scena 3D z tekstem „TOPKEK” (voxele/cząsteczki), efekt repulsion/scatter/grid
- Tryb VAJBUJ (tekst + muzyka + animacja słów)
- Kamera: orbit, cinematic, free cam
- Postprocessing: bloom, SAO, CRT (shader w `script.js`)
- Modale: APPSTAIN (gra), Glitch Lab (opis + repo), GENIMG (galeria + opis systemu), custom text, podgląd obrazu
- Loader z paskiem postępu (assets + generowanie cząsteczek)
- Gadająca głowa (Trump) w modalu APPSTAIN – cytaty z `trump-quotes.js`

---

## 7. Dokumentacja i pliki towarzyszące

- **README** i opisy:** w katalogu nadrzędnym (np. `README_GL_PL.md`, `README_GL_ENG.md`) oraz w `ASSETS/APPSTAIN/topkek_trump_head/README.md`
- **Instrukcje / notatki:** np. `docs/VAJBUJ-instrukcja-zwrotki.md`
- W tym katalogu: **WYTYCZNE_PROJEKTU.md** (ten plik) jako punkt odniesienia dla stacku, zależności i metod pracy

---

## 8. Podsumowanie – „z czego korzystamy”

| Aspekt            | Wybór w projekcie |
|-------------------|--------------------|
| Języki            | HTML5, CSS3, JavaScript (ES modules) |
| Framework JS      | Brak (vanilla JS) |
| 3D                | Three.js 0.160.0 (CDN unpkg) |
| Build / bundle    | Brak (statyczne pliki) |
| Package manager   | Brak (brak package.json) |
| Serwer dev        | Python `http.server` (port 8002) |
| Konfiguracja      | `config.js` |
| Style             | Plain CSS, jeden główny plik + trump-head.css |
| Zasoby            | Katalog `ASSETS/`, JSON (particles), MD gdzie potrzebne |
| Animacje zewn.    | After Effects (plik .aep), keyframes w `keyframes.txt` |

Jeśli dodajesz nowe zależności (np. kolejną wersję Three.js lub inną bibliotekę), zaktualizuj import map w `index.html` oraz ten dokument.
