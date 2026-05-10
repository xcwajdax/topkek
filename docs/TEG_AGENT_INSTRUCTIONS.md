# TEG (Trivial Event Generator) — Agent Instructions

Instructions for the agent that generates daily TEG event reports for the APPSTAIN game.

---

## Purpose

Generate **one markdown file per day** with event proposals based on **real-world events** from that day. Events are sourced from verified outlets (e.g. USAWATCHDOG Daily Report or other designated sources). Each event is a short scenario with three player choices and narrative effects.

---

## Output File

- **Path:** `docs/meta_threads/TEG_YYYY-MM-DD.md`
- **Naming:** Use the date of the report, e.g. `TEG_2026-02-25.md`.

---

## File Header

Start the file with:

```markdown
# TEG Event Proposals - YYYY-MM-DD

Generated from [Source Name, e.g. USAWATCHDOG Daily Report]

---

```

---

## Event Block Structure (strict)

Each event must follow this structure. Use exactly this format.

### 1. Event header

```markdown
## EVENT: [Full Event Title]
```

Use a short, descriptive title (e.g. "The Epstein Bombshell", "Iran Strikes Looming").

### 2. Metadata (one per line)

- **Rarity:** One of: `Common`, `Rare`, `Epic`, `Legendary`
- **Type:** One of: `Crisis`, `Policy`, `Economic`, `Military`, `Flavor`
- **Trigger:** Plain-text description of when this event could appear (e.g. "Support < 55%", "Day > 7")
- **Meta Thread:** One or more tags/themes (e.g. "Epstein", "Iran", "Immigration, Economy")

Example:

```markdown
**Rarity:** Legendary
**Type:** Crisis
**Trigger:** Any investigation progress > 30%, or Support < 55%
**Meta Thread:** Epstein
```

### 3. Event description

```markdown
### Event Description
[One paragraph of narrative text. Second person ("you, the President"). No bullet lists here.]
```

### 4. Responses (exactly three: A, B, C)

For each response:

```markdown
**A) "[Button label / short quote]"**
- Effect: [List of effects in consistent notation, e.g. "Support +5%, Media +10%, Investigation Progress +15%"]
- Flavor: "[In-character one-liner or quote.]"
```

Use **B)** and **C)** for the second and third options. Keep:

- **Effect:** Same notation across events (Support ±X%, Media ±X%, Economy ±X%, etc.). Use commas between effects.
- **Flavor:** Short in-character line (or "[Silent stare into camera]" etc.).

---

## Effect Notation (consistent)

Use these patterns so effects can be parsed or mapped later:

- `Support +5%` / `Support -10%` — Political support
- `Media +10%` / `Media -15%` — Media / coverage
- `Economy +5%` / `Economy -3%` — Economy
- `Investigation Progress +15%` / `Investigation Progress -20%`
- `Cabinet -10%`, `Relations (Military) -10%`, `Congress Relations +10%`
- `Global Tension +30%`, `Iran Relations +20%`

Keep one style (e.g. "Support +5%" not "support +5") for consistency.

---

## After Generating the Daily File

Update the **proposal pool** document:

- **Path:** `docs/RANDOM_EVENTS_Proposal.md`
- Add a new date section (e.g. `## 2026-02-25`) with:
  - **Events Generated Today:** Numbered list of event titles with Rarity/Type and a one-line summary; link to the full event in `meta_threads/TEG_YYYY-MM-DD.md` using anchor (e.g. `#the-epstein-bombshell`).
  - **Cross-References:** For each meta thread (e.g. Epstein, Iran), list today’s events that use it and "See also" links to related past events or threads.

---

## Language and Tone

- **Language:** American English for all in-game text (descriptions, choices, flavor).
- **Tone:** Fits the game’s fiction (political satire / alternate history). Real-world persons and events can be referenced within the game’s fictional frame.

---

## Verified Sources (reference)

Events should be grounded in real-world news from the report date. Prefer:

- USAWATCHDOG Daily Report (or other designated daily briefings)
- Major wire services and established outlets as needed

Do not invent factual claims; fictionalize only within the game’s scenario (e.g. "you, the President" responding to a crisis).

---

## Checklist Before Saving

- [ ] File name is `TEG_YYYY-MM-DD.md` in `docs/meta_threads/`
- [ ] Each event has exactly **3** responses (A, B, C)
- [ ] Each response has **Effect** and **Flavor**
- [ ] Rarity and Type use only the allowed values
- [ ] `docs/RANDOM_EVENTS_Proposal.md` updated with today’s events and cross-references
