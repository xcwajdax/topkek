# Prompty do generowania grafik

Wszystkie prompty użyte do generowania obrazów w projekcie (np. Heads System, ikony) są zapisywane w tym pliku. Każdy wpis zawiera: plik docelowy, datę/kontekst, oraz pełny prompt.

---

## ASSETS/characters/cosmic_scholar.png

### Wersja 1 (cartoon, odrzucona)
- **Kontekst:** Pierwsza generacja, bez wzoru.
- **Prompt:**
```
Character portrait for a satirical political game: "The Cosmic Scholar" – middle-aged male scholar with glasses, receding hair, slight knowing smirk, academic and slightly absurd look. Cartoon or stylized illustration, head and shoulders, front view. Plain or transparent background. Square aspect ratio, readable at small size (80x80px). Tone: dark comedy, parody of a physicist type.
```

### Wersja 2 (pixel art 8-bit, zgodna z character_head.png)
- **Kontekst:** Regeneracja w stylu szablonu ASSETS/character_head.png.
- **Prompt:**
```
Pixel art character portrait, 8-bit/16-bit game style, IDENTICAL to reference: square pixels, thick black outlines around face hair eyes nose mouth shirt tie jacket. Limited color palette with lighter and darker tones for shading. Frontal view, head and upper torso only (collar, tie knot, jacket lapels visible). Transparent background. Character: middle-aged male scholar, grey or white messy hair receding at temples, black rectangular glasses (simple pixel frames), slight smile, white shirt collar, red or dark tie, dark blue suit jacket. Same proportions and crop as classic pixel art political figure portrait. No gradients, no soft edges—only blocky pixels and black outlines.
```
- **Reference:** ASSETS/character_head.png (template).

### Wersja 3 (więcej szczegółów i cieniowania, nie 8-bit)
- **Kontekst:** Zwiększona szczegółowość i cieniowanie na życzenie użytkownika.
- **Prompt:**
```
Character portrait in refined pixel art style, higher detail than 8-bit: "The Cosmic Scholar". Same composition as reference template (frontal view, head and upper torso, collar, tie, jacket lapels). Thick black outlines, transparent background. Character: middle-aged male scholar, grey or white messy receding hair, black rectangular glasses, slight knowing smile. ADD more detail and smooth shading: subtle gradients and midtones on face (cheekbones, nose, forehead), hair with multiple shade steps, fabric folds and shading on white shirt and dark blue suit jacket, tie with slight highlight. Still pixel art aesthetic but 16-bit or higher resolution feel—readable at 80x80px display, more depth and volume. No photorealistic rendering; keep clear pixel/illustration look with improved shading.
```
- **Reference:** ASSETS/character_head.png (composition/template).

---

## ASSETS/characters/pizza_prince.png

### Wersja 1 (refined pixel art, jak cosmic_scholar v3)
- **Kontekst:** Zwykły Andrzej (postać w grze: The Pizza Prince); ten sam styl co cosmic_scholar v3.
- **Prompt:**
```
Character portrait in refined pixel art style, higher detail than 8-bit: "Andrew" (former British royal, now ordinary middle-aged man). Same composition as reference template (frontal view, head and upper torso, collar, tie, jacket lapels). Thick black outlines, transparent background. Character: middle-aged British man, receding grey or sandy hair, slightly jowly face, pale skin, stiff or pompous expression, white shirt collar, tie, dark blue or grey suit jacket. ADD more detail and smooth shading: subtle gradients and midtones on face (cheekbones, jaw, forehead), hair with multiple shade steps, fabric folds and shading on shirt and jacket, tie with slight highlight. Still pixel art aesthetic but 16-bit or higher resolution feel—readable at 80x80px display, more depth and volume. No photorealistic rendering; keep clear pixel/illustration look with improved shading. No crown, no royal symbols.
```
- **Reference:** ASSETS/character_head.png (composition/template).

---

## ASSETS/characters/bubba.png

### Wersja 1 (refined pixel art, jak cosmic_scholar v3)
- **Kontekst:** Bubba (Bill Clinton); ten sam styl co cosmic_scholar v3.
- **Prompt:**
```
Character portrait in refined pixel art style, higher detail than 8-bit: "Bubba" (Bill Clinton type). Same composition as reference template (frontal view, head and upper torso, collar, tie, jacket lapels). Thick black outlines, transparent background. Character: middle-aged American man, full rounded face, warm charismatic smile, light grey or whitish receding hair, red or blue tie, white shirt, dark suit jacket. ADD more detail and smooth shading: subtle gradients and midtones on face (cheekbones, smile lines, forehead), hair with multiple shade steps, fabric folds and shading on shirt and jacket, tie with slight highlight. Still pixel art aesthetic but 16-bit or higher resolution feel—readable at 80x80px display, more depth and volume. No photorealistic rendering; keep clear pixel/illustration look with improved shading.
```
- **Reference:** ASSETS/character_head.png (composition/template).

---

## ASSETS/characters/dersh.png

### Wersja 1 (refined pixel art, jak cosmic_scholar v3)
- **Kontekst:** The Dersh (Alan Dershowitz); ten sam styl co cosmic_scholar v3.
- **Prompt:**
```
Character portrait in refined pixel art style, higher detail than 8-bit: "The Dersh" (Alan Dershowitz type – lawyer). Same composition as reference template (frontal view, head and upper torso, collar, tie, jacket lapels). Thick black outlines, transparent background. Character: elderly man, glasses, bushy dark eyebrows, intense or shrewd expression, grey or white hair, white shirt, tie, dark suit jacket. ADD more detail and smooth shading: subtle gradients and midtones on face (cheekbones, nose, forehead), hair and eyebrows with multiple shade steps, fabric folds and shading on shirt and jacket, tie with slight highlight. Still pixel art aesthetic but 16-bit or higher resolution feel—readable at 80x80px display, more depth and volume. No photorealistic rendering; keep clear pixel/illustration look with improved shading.
```
- **Reference:** ASSETS/character_head.png (composition/template).

---

## ASSETS/characters/little_george.png

### Wersja 1 (refined pixel art, jak cosmic_scholar v3 – zbyt dokładna)
- **Kontekst:** Little George (George Stephanopoulos); ten sam styl co cosmic_scholar v3; użytkownik: „trochę zbyt dokładny”.
- **Prompt:**
```
Character portrait in refined pixel art style, higher detail than 8-bit: "Little George" (George Stephanopoulos type – TV news anchor). Same composition as reference template (frontal view, head and upper torso, collar, tie, jacket lapels). Thick black outlines, transparent background. Character: middle-aged man, clean-cut, neat dark hair, professional anchor look, slight smile or neutral expression, white shirt, tie, dark blue or grey suit jacket. ADD more detail and smooth shading: subtle gradients and midtones on face (cheekbones, jaw, forehead), hair with multiple shade steps, fabric folds and shading on shirt and jacket, tie with slight highlight. Still pixel art aesthetic but 16-bit or higher resolution feel—readable at 80x80px display, more depth and volume. No photorealistic rendering; keep clear pixel/illustration look with improved shading.
```
- **Reference:** ASSETS/character_head.png (composition/template).

### Wersja 2 (uproszczona, mniej szczegółów – zbyt mało)
- **Kontekst:** Regeneracja na życzenie: mniej dokładności; użytkownik: „zbyt mało szczegółowy”.
- **Prompt:**
```
Character portrait in refined pixel art style, SIMPLER and less detailed than previous: "Little George" (TV news anchor type). Same composition as reference (frontal view, head and upper torso, collar, tie, jacket lapels). Thick black outlines, transparent background. Character: middle-aged man, clean-cut, neat dark hair, professional look, slight smile. Keep ONLY moderate shading: simple midtones on face (no wrinkles, no crow's feet, no fine skin texture), hair with 2–3 shade steps only, simple folds on shirt and jacket. Stylized and readable at 80x80px. Do NOT add high-fidelity detail: no individual hair strands, no intricate fabric stitching, no subtle skin variations. Blockier, cleaner pixel art with limited color steps per area.
```
- **Reference:** ASSETS/character_head.png (composition/template).

### Wersja 3 (wypośrodkowana – medium detail)
- **Kontekst:** Wypośrodkowanie między v1 (za dokładna) a v2 (za mało szczegółów).
- **Prompt:**
```
Character portrait in refined pixel art, MEDIUM detail (balance between too detailed and too simple): "Little George" (TV news anchor type). Same composition as reference (frontal view, head and upper torso, collar, tie, jacket lapels). Thick black outlines, transparent background. Character: middle-aged man, clean-cut, neat dark hair, professional look, slight smile. Use moderate shading: clear midtones on face for cheekbones and jaw (smooth, no wrinkles or crow's feet), hair with 4–5 shade steps for volume, shirt and jacket with visible but simple folds and shading, tie with one highlight. Enough detail to feel depth and form, but stylized—no fine skin texture, no individual hair strands, no intricate fabric detail. Pixel art readable at 80x80px; middle ground between flat and high-fidelity.
```
- **Reference:** ASSETS/character_head.png (composition/template).

---

## ASSETS/characters/bezos.png

### Wersja 1 (medium detail, Heads System – Bezos)
- **Kontekst:** Nowa postać Heads System – Jeff Bezos; ikona w rzędzie głów, odblokowanie z Billionaire's Cave (Prime Panopticon).
- **Prompt:** Character portrait in refined pixel art, MEDIUM detail: "Jeff Bezos" (tech billionaire, Amazon founder). Same composition as reference (frontal view, head and upper torso, collar, tie, jacket lapels). Thick black outlines, transparent background. Character: middle-aged man, bald or very short dark hair, rounded head, confident slight smile, white shirt, tie, dark suit jacket. Moderate shading: clear midtones on face, 4–5 shade steps in hair, simple folds on shirt and jacket, tie with one highlight. Pixel art readable at 80x80px.
- **Reference:** ASSETS/character_head.png.

---

## ASSETS/characters/gates.png

### Wersja 1 (medium detail, Heads System – Gates)
- **Kontekst:** Nowa postać Heads System – Bill Gates; odblokowanie z Billionaire's Cave (Microsoft Fortress).
- **Prompt:** Character portrait in refined pixel art, MEDIUM detail: "Bill Gates" (tech billionaire, Microsoft founder). Same composition as reference. Thick black outlines, transparent background. Character: middle-aged to elderly man, grey receding hair, large round glasses, friendly or neutral expression, white shirt, tie, dark suit. Moderate shading as per template. Pixel art readable at 80x80px.
- **Reference:** ASSETS/character_head.png.

---

## ASSETS/characters/thiel.png

### Wersja 1 (medium detail, Heads System – Thiel)
- **Kontekst:** Nowa postać Heads System – Peter Thiel; odblokowanie z Billionaire's Cave (Palantir HQ).
- **Prompt:** Character portrait in refined pixel art, MEDIUM detail: "Peter Thiel" (tech billionaire, Palantir co-founder). Same composition as reference. Thick black outlines, transparent background. Character: middle-aged man, clean-cut, blond or light hair, sharp features, calm or intense expression, white shirt, tie, dark suit jacket. Moderate shading as per template. Pixel art readable at 80x80px.
- **Reference:** ASSETS/character_head.png.

---

## ASSETS/characters/patel.png

### Wersja 1 (medium detail, Heads System – Patel)
- **Kontekst:** Nowa postać Heads System – Kash Patel (były DOJ/administracja).
- **Prompt:** Character portrait in refined pixel art, MEDIUM detail: "Kash Patel" (former DOJ/Trump administration official, South Asian American). Same composition as reference. Thick black outlines, transparent background. Character: middle-aged man, dark hair short or receding, brown skin tone, serious or determined expression, white shirt, tie, dark suit jacket. Moderate shading as per template. Pixel art readable at 80x80px.
- **Reference:** ASSETS/character_head.png.

---

## ASSETS/characters/topkeka.png

### Wersja 1 (medium detail, portret użytkownika – topkeka)
- **Kontekst:** Portret użytkownika (topkeka) w stylu Heads System; kompozycja i rozmiar jak dersh.png i gates.png.
- **Prompt:** Character portrait in refined pixel art, MEDIUM detail, identical composition and size to reference: frontal view, head and upper torso only, white shirt collar, tie knot, dark suit jacket lapels visible. Subject: man in his late 20s or early 30s ("topkeka"), dark curly or wavy messy hair, full light brown or ginger beard, optional small eyebrow piercing on one side, serious or neutral expression, fair skin with natural complexion. Thick black outlines, transparent background. Same pixel art style as dersh and gates: clear midtones on face for cheekbones and jaw (smooth), hair with 4–5 shade steps, white shirt and dark navy or charcoal suit jacket with simple folds and shading, red or dark tie with one highlight. Readable at 80x80px; no fine skin texture, no individual hair strands. Stylized pixel art, not photorealistic.
- **Reference:** ASSETS/characters/dersh.png, ASSETS/characters/gates.png (kompozycja i styl).

---

## ASSETS/characters/bondi.png

### Wersja 1 (medium detail, Heads System – Bondi)
- **Kontekst:** Nowa postać Heads System – Pam Bondi (była prokurator generalna Florydy).
- **Prompt:** Character portrait in refined pixel art, MEDIUM detail: "Pam Bondi" (former Florida Attorney General, woman). Same composition as reference (frontal view, head and upper torso, collar, jacket lapels; woman in professional blazer and blouse instead of tie). Thick black outlines, transparent background. Character: middle-aged woman, blonde or light hair, professional look, confident smile or neutral expression, white or light blouse with collar, dark blazer. Moderate shading as per template. Pixel art readable at 80x80px.
- **Reference:** ASSETS/character_head.png.

---

## ASSETS/QUESTS/quest_01.png

### Wersja 1 (refined pixel art scene – First Redactions)
- **Kontekst:** Ilustracja do questa 01 – First Redactions (klikanie, redakcja dokumentów). Wyświetlana w modalu questa, max-height 300px.
- **Prompt:**
```
Scene illustration in refined pixel art style for a satirical political game. Thick black outlines, limited color palette with shading. Scene: desk covered with stacks of manila folders stamped "CLASSIFIED" in red; a small stylized figure (no realistic face) at the desk with one hand on a big red "REDACT" button or stamp; papers flying or being shredded. Dark comedy tone, no photorealism. Landscape or square composition, readable when displayed at 150–300px height. Transparent or dark blue gradient background to match game UI. No text in image except optional "CLASSIFIED" on folders.
```

### Wersja 2 (dopracowywana – szczegóły, cienkie linie, cieniowanie, tekstura, 2.5:1)
- **Kontekst:** Ilustracja do questa 01 – First Redactions. Styl jak quest_placeholder.png: szczegółowa pixel art, cienkie linie, cieniowanie, tekstury, aspect ratio 2.5:1.
- **Prompt:**
```
Detailed pixel art illustration, 2.5:1 aspect ratio. Thin, precise pixel lines (no thick outlines). Rich shading and subtle texture throughout: wood grain on desk, fabric folds, paper texture on documents. Scene: stylized politician (Trump-like) at a large desk in an office setting, one hand on a red REDACT stamp or button; desk and surroundings covered with manila folders and papers stamped CLASSIFIED in red; a modest pile of stacked documents (Acts) beside him. Papers mid-redaction or flying. The figure must be comically, exaggeratedly tan or orange-skinned (over-the-top fake tan, satirical). Muted palette: browns, golds, off-whites, red accents; the character's skin stands out as vividly orange. Depth and volume from pixelated shading on every surface. Same level of detail as a refined Oval Office pixel scene—drapes, desk details, document seals and text suggestion. Dark comedy satirical tone, no photorealism. Readable when displayed at 150–300px height.
```
- **Reference (styl):** ASSETS/QUESTS/quest_placeholder.png

---

## ASSETS/QUESTS/quest_02.png

### Wersja 1 (refined pixel art scene – Troll Army)
- **Kontekst:** Ilustracja do questa 02 – Troll Army (troll farm, budynki, internet).
- **Prompt:**
```
Scene illustration in refined pixel art style for a satirical political game. Thick black outlines, limited color palette with shading. Scene: a "troll farm" – small building or server racks with antenna; 2–3 stylized troll or bot figures (cartoonish, no realistic faces) at keyboards or screens; network cables or signal waves; chaotic internet vibe. Dark comedy, parody of social media farms. Landscape or square composition, readable at 150–300px height. Transparent or dark background. No photorealism.
```

### Wersja 2 (szczegóły, cienkie linie, 2.5:1, pomarańczowy Trump)
- **Kontekst:** Ilustracja do questa 02 – Troll Farm. Styl jak quest_01 Wersja 2.
- **Prompt:**
```
Detailed pixel art illustration, 2.5:1 aspect ratio. Thin, precise pixel lines (no thick outlines). Rich shading and subtle texture: wood grain, metal server racks, screen glow, cable texture. Scene: comically exaggerated orange-skinned politician (Trump-like) in a troll farm – warehouse with server racks, monitors, 2–3 stylized troll or bot figures at keyboards; a medium-sized pile of stacked documents (Acts) beside or around him. Network cables, chaotic internet vibe, dark comedy. Muted palette with character's skin vividly orange. Depth and volume from pixelated shading. No photorealism. Readable at 150–300px height.
```

---

## ASSETS/QUESTS/quest_03.png

### Wersja 1 (refined pixel art scene – Professional Troublemaker)
- **Kontekst:** Ilustracja do questa 03 – Professional Troublemaker (wynajęcie trolla, news ticker).
- **Prompt:**
```
Scene illustration in refined pixel art style for a satirical political game. Thick black outlines, limited color palette. Scene: one prominent "troll" character (stylized, at keyboard or with phone); a scrolling news ticker or headline bar in the background; office or desk setting. Dark comedy tone. Landscape or square, readable at 150–300px height. Transparent or dark background. No realistic faces, no photorealism.
```

### Wersja 2 (szczegóły, cienkie linie, 2.5:1, pomarańczowy Trump)
- **Kontekst:** Ilustracja do questa 03 – Professional Troublemaker. Styl jak quest_01 Wersja 2.
- **Prompt:**
```
Detailed pixel art illustration, 2.5:1 aspect ratio. Thin, precise pixel lines (no thick outlines). Rich shading and subtle texture: desk, monitors, paper. Scene: comically exaggerated orange-skinned politician (Trump-like) with one prominent troll figure (stylized, at keyboard or with phone, Cheeto-dust vibe); a scrolling news ticker or headline bar in the background; office or desk setting; a larger pile of stacked documents (Acts) than in previous quests. Dark comedy. Muted palette with character's skin vividly orange. Depth and volume from pixelated shading. No photorealism. Readable at 150–300px height.
```

### Wersja 3 (spójna z quest_01/02/04/06 – bez napisów, bez goblina)
- **Kontekst:** Regeneracja – scena w tym samym klimacie co reszta serii: gabinet, biurko, sterta dokumentów; bez dosłownych napisów i przesadnych postaci.
- **Prompt:**
```
Detailed pixel art illustration, 2.5:1 aspect ratio. Thin, precise pixel lines (no thick outlines). Rich shading and subtle texture: wood grain on desk, fabric folds, paper texture, monitor glow. Scene: same style as quest_01 and quest_02 – office or Oval Office-like room. Comically exaggerated orange-skinned politician (Trump-like) in dark suit and red tie at a large desk; one staff member (humanoid, subtle, professional) at a keyboard or screen in the background; a tall pile of stacked documents (papers, folders, no text or labels on them) beside the desk. Optional: faint scrolling ticker bar on a wall monitor, no readable text. Muted palette: browns, golds, off-whites, red tie; character's skin vividly orange. Depth and volume from pixelated shading. No text in image. No goblins, no brand names, no banners. Dark comedy tone, no photorealism. Readable at 150–300px height.
```

---

## ASSETS/QUESTS/quest_04.png

### Wersja 1 (refined pixel art scene – Enhancement Protocol)
- **Kontekst:** Ilustracja do questa 04 – Enhancement Protocol (augmenty, ulepszenia).
- **Prompt:**
```
Scene illustration in refined pixel art style for a satirical political game. Thick black outlines, limited color palette. Scene: a character being "upgraded" – surrounded by floating icons (gears, arrows up, power symbols); augment or upgrade panel aesthetic; sci-fi or tech parody vibe. Dark comedy. Landscape or square, readable at 150–300px height. Transparent or dark background. No realistic faces, stylized only.
```

### Wersja 2 (szczegóły, cienkie linie, 2.5:1, pomarańczowy Trump)
- **Kontekst:** Ilustracja do questa 04 – Augments. Styl jak quest_01 Wersja 2.
- **Prompt:**
```
Detailed pixel art illustration, 2.5:1 aspect ratio. Thin, precise pixel lines (no thick outlines). Rich shading and subtle texture: briefcase, glass vials, desk. Scene: comically exaggerated orange-skinned politician (Trump-like) opening a briefcase with glowing vials (augments); floating upgrade icons (gears, arrows up, power symbols) around; a large pile of stacked documents (Acts) beside him. Sci-fi tech parody, dark comedy. Muted palette with character's skin vividly orange. Depth and volume from pixelated shading. No photorealism. Readable at 150–300px height.
```

---

## ASSETS/QUESTS/quest_05.png

### Wersja 1 (refined pixel art scene – Ready for the Real Game)
- **Kontekst:** Ilustracja do questa 05 – Ready for the Real Game (koniec early game, Vance, pełna gra).
- **Prompt:**
```
Scene illustration in refined pixel art style for a satirical political game. Thick black outlines, limited color palette. Scene: transition from "tutorial" to "full game" – e.g. a door or gate opening, or a stylized character (Vance or generic) stepping from a small room into a larger stage; "next level" or "ready" vibe. Dark comedy. Landscape or square, readable at 150–300px height. Transparent or dark background. No realistic faces.
```

### Wersja 2 (szczegóły, cienkie linie, 2.5:1, pomarańczowy Trump)
- **Kontekst:** Ilustracja do questa 05 – End Game. Styl jak quest_01 Wersja 2.
- **Prompt:**
```
Detailed pixel art illustration, 2.5:1 aspect ratio. Thin, precise pixel lines (no thick outlines). Rich shading and subtle texture: desk, drapes, door or gate. Scene: comically exaggerated orange-skinned politician (Trump-like) triumphant, removing tiny training wheels from an oversized folder or tossing them aside; transition from small room to larger stage or door opening to full game; a big pile of stacked documents (Acts) towering beside him. Dark comedy. Muted palette with character's skin vividly orange. Depth and volume from pixelated shading. No photorealism. Readable at 150–300px height.
```

### Wersja 3 (spójna z resztą serii – gabinet, bez tricykla i teatru)
- **Kontekst:** Regeneracja – ta sama scena co quest_01/04/06: gabinet z biurkiem, sterta dokumentów; bez tricykla, bez teatralnej sceny, bez etykiet ACT 1/2/3.
- **Prompt:**
```
Detailed pixel art illustration, 2.5:1 aspect ratio. Thin, precise pixel lines (no thick outlines). Rich shading and subtle texture: wood grain on desk, fabric folds on drapes, paper texture. Scene: same style as quest_01 and quest_04 – office or Oval Office-like room with desk and heavy curtains. Comically exaggerated orange-skinned politician (Trump-like) in dark suit and red tie, standing or seated at the desk in a confident, triumphant pose; on the desk a small pair of toy training wheels next to a folder (suggesting "training wheels off" subtly, no tricycle). A large pile of stacked documents (papers and folders, no labels or text) beside the desk. Muted palette: browns, golds, off-whites, red tie; character's skin vividly orange. Depth and volume from pixelated shading. No text in image. No theater stage, no archway, no throwing. Dark comedy tone, no photorealism. Readable at 150–300px height.
```

---

## ASSETS/QUESTS/quest_06.png

### Wersja 1 (refined pixel art scene – Re-election)
- **Kontekst:** Ilustracja do questa 06 – Re-election (prestiż, druga kadencja).
- **Prompt:**
```
Scene illustration in refined pixel art style for a satirical political game. Thick black outlines, limited color palette. Scene: portrait frame on a wall with "Term 2" or empty frame beside it; or Supreme Court / power symbols (gavel, scales); re-election or prestige vibe. Dark comedy, political satire. Landscape or square, readable at 150–300px height. Transparent or dark background. No realistic faces, stylized only.
```

### Wersja 2 (szczegóły, cienkie linie, 2.5:1, pomarańczowy Trump)
- **Kontekst:** Ilustracja do questa 06 – Re-election. Styl jak quest_01 Wersja 2. (W razie ponownej generacji użyj tego promptu.)
- **Prompt:**
```
Detailed pixel art illustration, 2.5:1 aspect ratio. Thin, precise pixel lines (no thick outlines). Rich shading and subtle texture: wall, frames, drapes, wood. Scene: comically exaggerated orange-skinned politician (Trump-like) gazing at a portrait of himself on the wall with an empty frame beside it for Term 2; Oval Office or office with flags; a maximum towering pile of stacked documents (Acts) filling the room or beside him, the largest stack of all. Re-election prestige dark comedy. Muted palette with character's skin vividly orange. Depth and volume from pixelated shading. No photorealism. Readable at 150–300px height.
```

---

## ASSETS/ICONS/STAFF/10_czar_128x128.png (Czar of Everything)

### Wersja 1 (ikona 128×128, bez implementacji)
- **Kontekst:** Ikona ulepszenia "Czar of Everything" (total oversight, zero accountability). Wygenerowano bez podpięcia w grze; w data_upgrades.js jest ścieżka do .jpg – przy implementacji zmienić na .png lub skonwertować.
- **Prompt:**
```
Square pixel art icon, 128x128 style, for a satirical political game. Subject: "Czar of Everything" – a golden crown on a dark desk with a small stack of folders or papers; optional tiny figure with orange skin in dark suit in background. Thin precise pixel lines, rich shading, muted palette (browns, golds, off-whites, red accent). Dark comedy tone, no photorealism. Same visual style as classic 16-bit refined pixel art with clear outlines and limited color steps. No text in image.
```

---

## ASSETS/ICONS/BUILDINGS/10_doge_128x128.png (D.O.G.E.)

### Wersja 1 (ikona 128×128, bez implementacji)
- **Kontekst:** Ikona budynku D.O.G.E. (Department of Government Efficiency). Wygenerowano bez podpięcia; w data_buildings.js jest ścieżka do .jpg – przy implementacji zmienić na .png lub skonwertować.
- **Prompt:**
```
Square pixel art icon, 128x128 style, for a satirical political game. Subject: "D.O.G.E." (Department of Government Efficiency) – stylized dog (mascot) with a tiny chainsaw or scissors, or a government building with a dog silhouette and "efficiency" vibe (paper shredder, scissors). Thin precise pixel lines, rich shading, muted palette (browns, grays, golds, red or orange accent). Dark comedy, parody of bureaucracy. Same style as refined pixel art with clear outlines, no photorealism. No text in image.
```

---

## ASSETS/ICONS/BUILDINGS/11_mars_128x128.png (Mars Colony One)

### Wersja 1 (ikona 128×128, bez implementacji)
- **Kontekst:** Ikona budynku Mars Colony One. Wygenerowano bez podpięcia; w data_buildings.js jest ścieżka do .jpg – przy implementacji zmienić na .png lub skonwertować.
- **Prompt:**
```
Square pixel art icon, 128x128 style, for a satirical political game. Subject: "Mars Colony One" – Mars planet with a small colony dome or rocket landing pad, red/orange Martian surface, space vibe. Thin precise pixel lines, rich shading, muted palette with rusty reds, browns, dark sky, gold or white dome. Dark comedy "backup server for the regime" tone. Same refined pixel art style as other game icons, clear outlines, no photorealism. No text in image.
```

---

## ASSETS/bgs/AnimBgs/buildings/buildings_troll_farm_01.png

### Wersja 1 (pilot – warstwa tła budynków, left-panel; odrzucona – styl malowany)
- **Kontekst:** Pilotowa warstwa tła zależna od liczby budynków (minCount: 1). Troll Farm – pierwszy budynek w grze; element tła w scenie left-panel. Wersja w stylu malowanym, niezgodna z resztą gry.
- **Prompt:**
```
Background layer for a satirical political game left-panel: "Troll Farm" – industrial facility or factory silhouette suggesting a social media troll operation (rows of screens, smokestacks, dystopian vibe). Painted illustration style, not pixel art. Fits behind a White House / political scene: muted colors, slight haze, readable at panel size. Can have transparent or blend-friendly edges. Dark comedy tone, no text. Landscape-oriented, suitable as a parallax or overlay layer.
```

### Wersja 2 (refined pixel art – spójna z questami i ikonami)
- **Kontekst:** Warstwa tła budynków (minCount: 1). Styl dopasowany do gry: refined pixel art jak w ASSETS/QUESTS (quest_01, quest_02) i ikonach budynków (ASSETS/ICONS/BUILDINGS).
- **Prompt:**
```
Background layer in refined pixel art style for a satirical political game left-panel. Subject: "Troll Farm" – industrial building or warehouse silhouette suggesting a social media troll operation: server racks, antenna, rows of monitors, dystopian factory vibe. Thick black outlines or thin precise pixel lines; rich shading, muted palette (browns, grays, dark blues, subtle glow from screens). Same visual language as game quest scenes and building icons: clear outlines, no photorealism. Dark comedy tone. Readable at left-panel size; landscape-oriented; transparent or blend-friendly edges for overlay. No text in image.
```
- **Reference (styl):** ASSETS/QUESTS/quest_01.png, quest_02.png; ASSETS/ICONS/BUILDINGS (paleta i poziom szczegółowości).

---

## ASSETS/bgs/AnimBgs/buildings/ – Tiery Troll Farm (tier1–tier7)

Wszystkie grafiki: refined pixel art, **safe margins** (zawartość nie dotyka góry ani boków), **dolna krawędź = poziom ziemi** (budynek „stoi” na dole obrazka), **transparent background**. Left-panel w stylu Heroes 3 (miasto u dołu). Zapis w config: buildingIds: ['troll_farm.01'], minCount/maxCount per tier.

### Tier 1 (1–9 farm) – buildings_troll_farm_tier1.png
- **Opis wizualny:** Kilka trolli siedzących pod prowizorycznym daszkiem. Pogodnie, kolorowo.
- **Prompt:**
```
Refined pixel art building layer for a satirical political game left-panel (Heroes 3 city view). Subject: "Troll Farm" tier 1 – a few troll figures sitting under a makeshift awning or tent; sunny, cheerful, colorful. Thick black outlines or thin precise pixel lines; rich shading, muted but warm palette (browns, greens, sky blue). Content must NOT touch the top or side edges of the image; leave safe margins. The BOTTOM edge of the image is the ground line – the awning and figures sit on this baseline. Transparent background. Same style as game quest scenes. Dark comedy tone. No text.
```

### Tier 2 (10–49 farm) – buildings_troll_farm_tier2.png
- **Opis wizualny:** Namiot zamienia się w prosty budyneczek. Mniej kolorów, bardziej wyblakłe.
- **Prompt:**
```
Refined pixel art building layer for a satirical political game left-panel (Heroes 3 city view). Subject: "Troll Farm" tier 2 – the tent has become a simple small building; slightly faded, fewer colors, washed-out look. Thick black outlines or thin precise pixel lines; rich shading, muted palette. Safe margins from top and sides; bottom edge of image = ground line; building sits on this baseline. Transparent background. Same style as game quest scenes. Dark comedy tone. No text.
```

### Tier 3 (50–99 farm) – buildings_troll_farm_tier3.png
- **Opis wizualny:** Budynek zyskuje piętra (2 piętra łącznie z parterem).
- **Prompt:**
```
Refined pixel art building layer for a satirical political game left-panel (Heroes 3 city view). Subject: "Troll Farm" tier 3 – the building has gained a second floor (two storeys including ground floor). Simple multi-storey structure, troll farm vibe. Thick black outlines or thin precise pixel lines; rich shading, muted palette. Safe margins from top and sides; bottom edge of image = ground line. Transparent background. Same style as game quest scenes. Dark comedy tone. No text.
```

### Tier 4 (100–149 farm) – buildings_troll_farm_tier4.png
- **Opis wizualny:** 3 piętra (parter + 2).
- **Prompt:**
```
Refined pixel art building layer for a satirical political game left-panel (Heroes 3 city view). Subject: "Troll Farm" tier 4 – three-storey building (ground floor plus two upper floors). Larger structure, still readable at panel size. Thick black outlines or thin precise pixel lines; rich shading, muted palette. Safe margins from top and sides; bottom edge of image = ground line. Transparent background. Same style as game quest scenes. Dark comedy tone. No text.
```

### Tier 5 (150–250 farm) – buildings_troll_farm_tier5.png
- **Opis wizualny:** Budynek obrasta okablowaniem i antenami, dobudówki. Elewacja ciemniejsza.
- **Prompt:**
```
Refined pixel art building layer for a satirical political game left-panel (Heroes 3 city view). Subject: "Troll Farm" tier 5 – building with cables, antennas, and annexes; facade darker. Industrial troll farm look. Thick black outlines or thin precise pixel lines; rich shading, darker muted palette. Safe margins from top and sides; bottom edge of image = ground line. Transparent background. Same style as game quest scenes. Dark comedy tone. No text.
```

### Tier 6 (250–499 farm) – buildings_troll_farm_01.png (obecna grafika)
- **Opis wizualny:** Mroczny klimat, kominy z dymem (palenie akt). Zbliżone do obecnej generacji.
- **Prompt:**
```
Refined pixel art building layer for a satirical political game left-panel (Heroes 3 city view). Subject: "Troll Farm" tier 6 – dark mood, chimneys with smoke (burning Acts), industrial dystopian factory; server racks, antenna, rows of monitors. Thick black outlines or thin precise pixel lines; rich shading, muted dark palette (browns, grays, dark blues, subtle glow from screens). Safe margins from top and sides; bottom edge of image = ground line. Transparent background. Same style as game quest scenes. Dark comedy tone. No text.
```

### Tier 7 (500+ farm) – buildings_troll_farm_tier7.png
- **Opis wizualny:** Placeholder – wielki kompleks przemysłowy (ostateczna skala); docelowo TBD po ustaleniu wizji.
- **Prompt (użyty do generacji):**
```
Refined pixel art building layer for a satirical political game left-panel (Heroes 3 city view). Subject: "Troll Farm" tier 7 (500+ farms) – massive industrial troll farm complex, ultimate scale: multiple chimneys with smoke, dense cables and antennas, dark mood. Safe margins from top and sides; bottom edge = ground line. Transparent background. Same style as game quest scenes. No text.
```
- **Reference (styl):** ASSETS/QUESTS/quest_01.png

---

## ASSETS/propaganda/backgrounds/ (sala narad gazety – 5 wariantów narracji)

Seria 5 grafik: **ta sama sala** od lewej do prawej ściany (pełny pokój), warianty tylko w detalach narracji (CAP_LEFT … CAP_RIGHT). Plan: [docs/plans/2026_02/26_02_27_propaganda_system_overhaul.md](docs/plans/2026_02/26_02_27_propaganda_system_overhaul.md) § 2.4.

**Zasady (inne niż building_bg_graphics):** Generujemy **cały obrazek** – pełna scena pokoju, **solidne tło** (ściany, sufit, podłoga wypełnione; bez przezroczystości). Styl: refined pixel art, „z jajem” / bold satirical dark comedy.

**Wersja 3 (aktualna):** Wszystkie warianty oparte na jednej ulubionej grafice użytkownika – sala z drewnianym stołem, 5 osób, trzy złote wiszące lampy nad stołem, tylna ściana z plakatami. CENTRUM = oryginał użytkownika (sala z plakatami workers' rights / solidarity); CAP_LEFT, LEFT, RIGHT, CAP_RIGHT wygenerowane z tej grafiki jako reference.

### newspaper_cap_left.png
- **Kontekst:** Tło okienka medium „newspaper” przy skrajnie lewej narracji (CAP_LEFT).
- **Wersja 1 (stara):** transparent background, różne style między wariantami – zastąpiona wersją 2.
- **Wersja 2 (pełny pokój, tło nieprzezroczyste, bardziej z jajem):**
- **Prompt:**
```
Refined pixel art, same style and composition as reference: full editorial conference room from left wall to right wall. Large rectangular table in center, 5 people seated around it, head-on view. CAP_LEFT variant: warm golden lighting; walls with posters or cutouts for solidarity and workers' rights; people leaning in, gesturing, collaborative; warm colors (red, ochre, brown); casual dress. Thick black outlines, rich shading, muted palette. Bold satirical dark comedy. Solid opaque background – full room, no transparency. More punch and edge.
```
- **Reference (kompozycja/styl):** grafika użytkownika (sala narad, stół, 5 osób, head-on).
- **Wersja 3 (reference = ulubiona grafika użytkownika – sala z lampami, plakaty):**
- **Prompt:**
```
Pixel art scene, identical composition and style to reference: full newspaper conference room from left wall to right wall. Large rectangular wooden table center, 5 people in office chairs, three golden pendant lamps above table. CAP_LEFT variant: warm golden lighting; walls covered with bold posters – "WORKERS' RIGHTS", "SOLIDARITY FOREVER", "UNION NOW", raised fists, defiant slogans; people leaning in, gesturing emphatically, unified and determined; casual or worker-style dress (overalls, caps, red/brown shirts). Same muted browns, reds, beiges palette. Thick black outlines, rich shading. Solid opaque background. Bold satirical dark comedy. More intense and radical than reference.
```
- **Reference:** ulubiona grafika użytkownika (sala z trzema lampami, plakaty workers' rights).

### newspaper_left.png
- **Kontekst:** Tło okienka medium „newspaper” przy lewej narracji (LEFT).
- **Wersja 2 (pełny pokój, tło nieprzezroczyste, bardziej z jajem):**
- **Prompt:**
```
Refined pixel art, same style and composition as reference: full editorial conference room from left wall to right wall. Large rectangular table in center, 5 people seated around it, head-on view. LEFT variant: warm lighting; posters or newspapers on wall suggesting solidarity, workers, rights; people in cooperative discussion, gesturing; warm accents (red, ochre, brown); semi-formal dress. Thick black outlines, rich shading, muted palette. Bold satirical dark comedy. Solid opaque background – full room, no transparency. More punch and edge.
```
- **Wersja 3 (reference = ulubiona grafika użytkownika):**
- **Prompt:**
```
Pixel art scene, identical composition and style to reference: full newspaper conference room from left wall to right wall. Large rectangular wooden table center, 5 people in office chairs, three golden pendant lamps above table. LEFT variant: warm lighting; back wall with posters about workers' rights, solidarity, unions – softer than cap; people in cooperative discussion, some gesturing, mix of casual and semi-formal; browns, reds, beiges. Same layout and perspective as reference. Thick black outlines, rich shading. Solid opaque background. Bold satirical dark comedy.
```

### newspaper_center.png
- **Kontekst:** Tło okienka medium „newspaper” przy neutralnej narracji (CENTRUM).
- **Wersja 2 (pełny pokój, tło nieprzezroczyste, bardziej z jajem):** jak wyżej (prompt generowany).
- **Wersja 3 (aktualna):** **Oryginał użytkownika** – bez generacji. Ulubiona grafika: sala z drewnianym stołem, 5 osób (dziennikarze/aktywiści), trzy złote wiszące lampy, tylna ściana z plakatami WORKERS' RIGHTS, SOLIDARITY FOREVER, UNION NOW; paleta brązów, czerwieni, beży; animowana dyskusja. Plik skopiowany do ASSETS/propaganda/backgrounds/newspaper_center.png.

### newspaper_right.png
- **Kontekst:** Tło okienka medium „newspaper” przy prawej narracji (RIGHT).
- **Wersja 2 (pełny pokój, tło nieprzezroczyste, bardziej z jajem):**
- **Prompt:**
```
Refined pixel art, same style and composition as reference: full editorial conference room from left wall to right wall. Large rectangular table in center, 5 people seated around it, head-on view. RIGHT variant: cooler corporate lighting; one person at head of table, others in disciplined poses; back wall with charts or framed headlines "Markets" "Order" "Business"; navy and grey suits. Thick black outlines, rich shading, muted palette. Bold satirical dark comedy. Solid opaque background – full room, no transparency. More punch and edge.
```
- **Wersja 3 (reference = ulubiona grafika użytkownika):**
- **Prompt:**
```
Pixel art scene, identical composition and style to reference: full newspaper conference room from left wall to right wall. Large rectangular wooden table center, 5 people in office chairs. RIGHT variant: cooler corporate lighting – replace pendant lamps with ceiling fluorescents or keep same room but cooler tone; back wall with different posters – "Markets", "Order", "Business", charts or framed headlines; one person clearly at head of table, others in more disciplined poses; suits, ties, navy and grey. Same room shape and table. Thick black outlines, rich shading, muted palette. Solid opaque background. Bold satirical dark comedy.
```

### newspaper_cap_right.png
- **Kontekst:** Tło okienka medium „newspaper” przy skrajnie prawej narracji (CAP_RIGHT).
- **Wersja 2 (pełny pokój, tło nieprzezroczyste, bardziej z jajem):**
- **Prompt:**
```
Refined pixel art, same style as reference: editorial conference room of a newspaper seen in full from left wall to right wall. Large rectangular table in center, 5 people seated around it, head-on view from slightly low angle. CAP_RIGHT variant: one clear boss at head of table (center), others in rigid poses; back wall with flags on poles, circular seal, and a display showing "LAW & ORDER" / "NATIONAL SECURITY" / "FISCAL RESPONSIBILITY"; dark grey ceiling with fluorescent lights. Thick black outlines, rich shading, muted palette (dark brown table, grey and blue suits, gold accents). Bold satirical dark comedy tone, exaggerated but readable. Solid opaque background: fill the entire frame with the room (walls, ceiling, floor) – no transparency, no checkerboard. Same room layout and perspective as reference. More punch and edge than reference.
```
- **Reference (kompozycja/styl):** załączona grafika użytkownika (sala z flagami, pieczęcią, napisami LAW & ORDER).
- **Wersja 3 (reference = ulubiona grafika użytkownika – sala z lampami, plakaty):**
- **Prompt:**
```
Pixel art scene, identical composition and style to reference: full newspaper conference room from left wall to right wall. Large rectangular wooden table center, 5 people in office chairs. CAP_RIGHT variant: harsh bright boardroom lighting; back wall – replace worker posters with flags on poles, circular seal, display showing "LAW & ORDER", "NATIONAL SECURITY", "FISCAL RESPONSIBILITY"; one clear boss at head of table, rest in rigid poses, hands on table; dark suits, navy, gold accents. Same room shape, table, 5 seats. Thick black outlines, rich shading. Solid opaque background. Bold satirical dark comedy.
```
- **Reference:** ulubiona grafika użytkownika (sala z trzema lampami, workers' rights).

---

## ASSETS/propaganda/backgrounds/ – placeholdery (radio, tv_national, tv_global, social_media, prompt_injection)

Dla każdego z 5 mediów (poza newspaper) wygenerowano **jeden placeholder**; ten sam obraz skopiowano do 5 plików wariantów narracji (`*_cap_left.png`, `*_left.png`, `*_center.png`, `*_right.png`, `*_cap_right.png`). Do zastąpienia docelowymi grafikami per wariant.

### radio (placeholder)
- **Prompt:**
```
Refined pixel art placeholder for a satirical political game. Radio station studio: full room from left to right wall. Mixing desk or control panel, microphones on stands, "ON AIR" light, shelves with equipment. 2–3 stylized figures (hosts or technicians). Same style as newspaper propaganda backgrounds: thick black outlines, rich shading, muted palette (browns, greys, warm accents). Solid opaque background, no transparency. Bold satirical dark comedy. Readable at 200–400px width.
```
- **Pliki:** `radio_cap_left.png` … `radio_cap_right.png` (wszystkie = kopia tego samego placeholderu).

### tv_national (placeholder)
- **Prompt:**
```
Refined pixel art placeholder for a satirical political game. National TV news studio: full room from left to right wall. Anchor desk, cameras on tripods, monitors or screens on walls, studio lights. 2–3 stylized figures (anchor, crew). Same style as newspaper propaganda backgrounds: thick black outlines, rich shading, muted palette (browns, greys, blues). Solid opaque background, no transparency. Bold satirical dark comedy. Readable at 200–400px width.
```
- **Pliki:** `tv_national_cap_left.png` … `tv_national_cap_right.png` (wszystkie = kopia tego samego placeholderu).

### tv_global (placeholder)
- **Prompt:**
```
Refined pixel art placeholder for a satirical political game. Global TV / international news hub: full room from left to right wall. Multiple large screens showing world map or feeds, control desks, satellite or globe imagery. 2–3 stylized figures. Same style as newspaper propaganda backgrounds: thick black outlines, rich shading, muted palette. Solid opaque background, no transparency. Bold satirical dark comedy. Readable at 200–400px width.
```
- **Pliki:** `tv_global_cap_left.png` … `tv_global_cap_right.png` (wszystkie = kopia tego samego placeholderu).

### social_media (placeholder)
- **Prompt:**
```
Refined pixel art placeholder for a satirical political game. Social media / algorithm room: full room from left to right wall. Multiple monitors or phones showing feeds, likes, shares, trending symbols; server racks or data vibe. 2–3 stylized figures at screens. Same style as newspaper propaganda backgrounds: thick black outlines, rich shading, muted palette (blues, greys, accent colors). Solid opaque background, no transparency. Bold satirical dark comedy. Readable at 200–400px width.
```
- **Pliki:** `social_media_cap_left.png` … `social_media_cap_right.png` (wszystkie = kopia tego samego placeholderu).

### prompt_injection (placeholder)
- **Prompt:**
```
Refined pixel art placeholder for a satirical political game. Prompt injection / AI control room: full room from left to right wall. Terminals, neural-network or AI aesthetic, code or prompt text on screens, futuristic control panels. 2–3 stylized figures (operators or androids). Same style as newspaper propaganda backgrounds: thick black outlines, rich shading, muted palette with tech accents. Solid opaque background, no transparency. Bold satirical dark comedy. Readable at 200–400px width.
```
- **Pliki:** `prompt_injection_cap_left.png` … `prompt_injection_cap_right.png` (wszystkie = kopia tego samego placeholderu).
