# Prestige System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the prestige system: soft reset (keep prestige progress, earn points from B/S, level-based bonuses) with unlock via any victory condition (9 Supreme Court, Epstaina on Mars, or war-triggered); hard reset unchanged; UI in Settings with confirm + success modals; save/load and mechanics integration.

**Architecture:** Prestige state lives in GameStore; one module `js/prestige.js` for victory check, point calculation, reset list, and apply bonuses. Mechanics/purchases apply prestige multipliers. Reset = update prestige, clear all state except prestige (explicit list), save, then reload. Use existing CSS variables for UI.

**Tech Stack:** Vanilla JS, GameStore (state.js), config.js, mechanics.js, purchases.js, offline.js, index.html, css/systems.css. Design doc: `docs/plans/2026_02/26_02_19_prestige_system_design.md`.

---

## Task 1: Add prestige config and default state

**Files:**
- Modify: `js/config.js` (add PRESTIGE block)
- Modify: `js/state.js` (add prestige object to initial state)

**Step 1: Add PRESTIGE config**

In `js/config.js`, add a new top-level key `PRESTIGE` (e.g. after existing blocks), with Polish comments:

```javascript
// ==========================================
// SYSTEM PRESTIŻU
// ==========================================
PRESTIGE: {
    // Punkty z B/S (log od baseCost)
    BUILDING_MULT: 2,           // Mnożnik dla log10(1+baseCost) budynków
    UPGRADE_MULT: 2,             // Mnożnik dla log10(1+baseCost) ulepszeń
    CAP_PER_ITEM: 100,            // Maks. punktów od jednego typu B/S (0 = brak capu)
    // Bonusy z levelu (obecna faza)
    APS_MULTIPLIER_PER_LEVEL: 1.10,   // +10% APS per level
    APC_MULTIPLIER_PER_LEVEL: 1.05,   // +5% APC per level
    COST_REDUCTION_PER_LEVEL: 0.02,   // -2% kosztów per level
    MAX_APS_MULTIPLIER: 10,
    MAX_APC_MULTIPLIER: 5,
    MAX_COST_REDUCTION: 0.5
},
```

**Step 2: Add default prestige to state**

In `js/state.js`, inside the initial `state` object (e.g. before or after `metaRoom`), add:

```javascript
prestige: {
    level: 0,
    totalPrestigePoints: 0,
    prestigePoints: 0,
    spentPrestigePoints: 0,
    bonuses: { apsMultiplier: 1, apcMultiplier: 1, costReduction: 0 },
    unlocked: false
},
```

Also add (for future war victory) a top-level flag if not present:

```javascript
warTriggered: false,
```

(Only add `warTriggered` if it does not already exist elsewhere.)

**Step 3: Commit**

```bash
git add js/config.js js/state.js
git commit -m "config: add PRESTIGE config and prestige + warTriggered state"
```

---

## Task 2: Create prestige module (points, bonuses, victory check)

**Files:**
- Create: `js/prestige.js`
- Modify: `index.html` (add script tag for prestige.js after state.js / config, before mechanics)

**Step 1: Add script tag**

In `index.html`, add `<script src="js/prestige.js"></script>` after `js/config.js` and before `js/mechanics.js` (or after state.js so GameStore and GAME_CONFIG exist).

**Step 2: Implement prestige.js**

Create `js/prestige.js` with:

- **getDefaultPrestige()** – returns the default prestige object (same shape as in state.js).
- **checkVictoryConditions()** – reads from GameStore: upgrades['supreme_court_justice.09'].count >= 9, marsSystem.epstainaFounded === true, warTriggered === true; returns `{ anyVictory, supremeCourt, marsEpstaina, warTriggered }`. If anyVictory, set prestige.unlocked = true (GameStore) and return.
- **calculatePrestigePointsFromBS()** – iterates buildings and upgrades; for each with count > 0, points += count * min(floor(log10(1+baseCost)*MULT), CAP_PER_ITEM) using GAME_CONFIG.PRESTIGE; return total (buildings + upgrades).
- **applyPrestigeBonuses()** – read prestige from GameStore; set bonuses.apsMultiplier, apcMultiplier, costReduction from level and PRESTIGE caps; GameStore.setValue('prestige', updatedPrestige).

Use `GameStore.getValue('prestige')` / `GameStore.setValue('prestige', obj)` and merge with getDefaultPrestige() when reading so missing fields are filled.

**Step 3: Commit**

```bash
git add js/prestige.js index.html
git commit -m "feat: add prestige module (victory check, points from B/S, apply bonuses)"
```

---

## Task 3: Apply prestige bonuses in mechanics and purchases

**Files:**
- Modify: `js/mechanics.js` (calculateAPS, calculateClickPower, calculateTotalBuyCost)
- Modify: `js/purchases.js` (effectiveCost in buyItem and buyItemStack)

**Step 1: APS multiplier**

In `js/mechanics.js`, in `calculateAPS()`, before the final `return aps;` (after Cave gigafactory block), add:

```javascript
// Prestige APS bonus
const prestige = GameStore.getValue('prestige');
if (prestige && prestige.bonuses && typeof prestige.bonuses.apsMultiplier === 'number' && prestige.bonuses.apsMultiplier > 0) {
    aps *= prestige.bonuses.apsMultiplier;
}
```

**Step 2: APC multiplier**

In `calculateClickPower()`, before the final `return Math.max(1, Math.floor(power));`, add:

```javascript
// Prestige APC bonus
const prestige = GameStore.getValue('prestige');
if (prestige && prestige.bonuses && typeof prestige.bonuses.apcMultiplier === 'number' && prestige.bonuses.apcMultiplier > 0) {
    power *= prestige.bonuses.apcMultiplier;
}
```

**Step 3: Cost reduction in mechanics**

In `calculateTotalBuyCost()`, where `cost = Math.ceil(item.baseCost * ... * dogeMultiplier)`, multiply the right-hand side by `(1 - prestigeCostReduction)`. Add at the start of the function (after getting type):

```javascript
let prestigeCostReduction = 0;
const prestige = GameStore.getValue('prestige');
if (prestige && prestige.bonuses && typeof prestige.bonuses.costReduction === 'number') {
    prestigeCostReduction = Math.max(0, Math.min(1, prestige.bonuses.costReduction));
}
```

Then in the line that computes `cost`, multiply by `(1 - prestigeCostReduction)` (e.g. after dogeMultiplier). Do the same for the other cost computation in that function if there are two (for quantity loop).

**Step 4: Cost reduction in purchases.js**

In `buyItem()` (single purchase), before `effectiveCost = Math.floor(...)`, get prestige cost reduction:

```javascript
let prestigeCostReduction = 0;
const prestige = GameStore.getValue('prestige');
if (prestige && prestige.bonuses && typeof prestige.bonuses.costReduction === 'number') {
    prestigeCostReduction = Math.max(0, Math.min(1, prestige.bonuses.costReduction));
}
const effectiveCost = Math.floor(baseCost * multiplier * towerMultiplier * propagandaMultiplier * (1 - eventDiscount) * (1 - prestigeCostReduction));
```

In the stack-buy loop (buyItemStack or equivalent), apply the same `(1 - prestigeCostReduction)` in the effectiveCost formula.

**Step 5: Commit**

```bash
git add js/mechanics.js js/purchases.js
git commit -m "feat: apply prestige APS/APC/cost bonuses in mechanics and purchases"
```

---

## Task 4: Implement resetStateForPrestige and performPrestige

**Files:**
- Modify: `js/prestige.js`
- Modify: `js/state.js` (optional: ensure all keys that must be reset are documented; no code change if list lives only in prestige.js)

**Step 1: Build initial state snapshot helper**

In `js/prestige.js`, add a function that returns an object with the same keys as GameStore.state that should be reset, with values equal to the initial values from state.js (e.g. suppressedActs: 0, actsPerSecond: 0, buildings/upgrades/augments from data_* with count 0 and base cost, quests null, characters/selectedHeads default, caveSystem/marsSystem/dogeSystem/ballroomSystem/tlaSystem defaults, etc.). You can reference the full list from the design doc (Section 3). Important: do NOT include `prestige` in this snapshot. For buildings/upgrades/augments, the game re-initializes them from data_buildings/data_upgrades/augments elsewhere on load, so reset can set them to a clean state (e.g. from getInitialBuildingsState() if such exists, or by iterating and setting count 0, cost = baseCost, unlocked per first-item rules). Check how initGame or similar initializes buildings/upgrades – reuse that or duplicate the minimal reset needed.

**Step 2: resetStateForPrestige()**

Function that: (1) reads current prestige from GameStore; (2) computes points with calculatePrestigePointsFromBS(); (3) updates prestige: level += 1, prestigePoints += points, totalPrestigePoints += points, then applyPrestigeBonuses(); (4) overwrites all other state keys with initial values (from Step 1). For buildings/upgrades/augments, set each item to count 0, cost = baseCost, unlocked according to game rules (first building/upgrade unlocked, rest false). Set achievements = [], quests to initial (or null and let quests re-init), characters/selectedHeads to default, all late-game systems to default, flags (tutorialChoiceMade, etc.) to false where needed. (5) Call GameStore.setState(resetState) with the full state object (prestige = updated prestige, rest = initial). Do not clear localStorage; do not reload here.

**Step 3: performPrestige()**

Function that: if !prestige.unlocked, return; else call resetStateForPrestige(), then saveGame(), then show success modal (see Task 6), then after short delay or button click call location.reload(). So performPrestige does not take care of the confirm modal – that is UI (Task 6).

**Step 4: Hook victory check after purchase and Mars**

- In `js/purchases.js`, at the end of buyItem (and buyItemStack if applicable), after updating support and any quest/achievement logic, add: if (type === 'upgrades' && id === 'supreme_court_justice.09' && typeof checkVictoryConditions === 'function') checkVictoryConditions();
- In `js/late_game_systems.js` (or wherever epstainaFounded is set to true), right after setting it, add: if (typeof checkVictoryConditions === 'function') checkVictoryConditions();
- warTriggered: when in the future the event chain sets warTriggered = true, call checkVictoryConditions() there; for now ensure state has warTriggered: false and prestige.js reads it.

**Step 5: Commit**

```bash
git add js/prestige.js js/purchases.js
git commit -m "feat: resetStateForPrestige, performPrestige, victory hooks"
```

---

## Task 5: Save/load and init for prestige

**Files:**
- Modify: `js/offline.js` (saveGame includes prestige from getState; loadGame restores prestige and calls applyPrestigeBonuses)
- Modify: `js/state.js` (ensure prestige and warTriggered in initial state – already in Task 1)

**Step 1: saveGame**

saveGame uses GameStore.getState(), so once prestige is in state it is saved. Verify no code strips prestige. If getState() is spread and some keys are overridden, ensure prestige is not dropped. If the save object is built manually elsewhere, add prestige to that build.

**Step 2: loadGame**

In loadGame(), in the object passed to setState (stateToLoad), add:

```javascript
prestige: (function () {
    const def = getDefaultPrestige ? getDefaultPrestige() : { level: 0, totalPrestigePoints: 0, prestigePoints: 0, spentPrestigePoints: 0, bonuses: { apsMultiplier: 1, apcMultiplier: 1, costReduction: 0 }, unlocked: false };
    const saved = savedState.prestige;
    if (!saved) return def;
    return { ...def, ...saved, bonuses: saved.bonuses ? { ...def.bonuses, ...saved.bonuses } : def.bonuses };
})(),
warTriggered: savedState.warTriggered === true,
```

After GameStore.setState(stateToLoad), add:

```javascript
if (typeof applyPrestigeBonuses === 'function') applyPrestigeBonuses();
```

**Step 3: initGame**

Ensure on first load (no save) prestige is the default from state.js. No change needed if state is already default and loadGame only runs when save exists; if init merges default state, ensure prestige is present.

**Step 4: Commit**

```bash
git add js/offline.js
git commit -m "feat: save/load prestige and warTriggered; apply bonuses on load"
```

---

## Task 6: Prestige UI (Settings section, confirm modal, success modal)

**Files:**
- Modify: `index.html` (Settings: Prestige section with level, points, Prestige button; modals for confirm and success)
- Modify: `css/systems.css` (classes for prestige UI using var(--primary-gold), var(--primary-blue), var(--panel-bg), var(--text-light), var(--font-heading))
- Modify: `script.js` or `js/events.js` (wire Prestige button, open confirm modal; on confirm call performPrestige; show success modal before reload; update prestige display when Settings opens)

**Step 1: HTML**

In the Settings modal, after the "Game Progress" row (save-btn, reset-btn), add a new section "Prestige" (or "Prestige & Influence" to match existing heading elsewhere): a div that shows Prestige Level, Prestige Points (available), and a button "Prestige". This block is visible only when prestige.unlocked (controlled by class or display in JS). Add two modals: (1) Prestige confirm modal – title "Prestige", text that game will reset and bonuses will apply, preview of points and new level, current bonuses after prestige, buttons Cancel and Prestige Now; (2) Prestige success modal – short message "Earned X Prestige Points! Level Y" and a Continue button (or auto-close after 2s then reload). Use ids: e.g. prestige-section, prestige-level-value, prestige-points-value, prestige-btn, prestige-confirm-modal, prestige-success-modal, cancel-prestige-btn, confirm-prestige-btn, prestige-success-continue-btn.

**Step 2: CSS**

In `css/systems.css`, add classes: .prestige-section, .prestige-btn, .prestige-modal-content, .prestige-bonuses, .bonus-item, using var(--primary-gold), var(--primary-blue), var(--panel-bg), var(--text-light), var(--font-heading). Style the Prestige button and modals to match existing modals.

**Step 3: Wire UI**

- On Settings open (or when prestige section is shown), call updatePrestigeDisplay() to set level and points in the prestige section; show/hide the section based on prestige.unlocked.
- prestige-btn click: open confirm modal; fill preview (points from calculatePrestigePointsFromBS(), new level = prestige.level + 1, bonuses after apply would be from next level – can compute in JS without actually applying).
- confirm-prestige-btn click: close confirm modal; call performPrestige(). performPrestige should: resetStateForPrestige(), saveGame(), show success modal with earned points and new level, then on success modal button click (or 2s timeout) call location.reload().
- cancel-prestige-btn: close confirm modal.

**Step 4: Commit**

```bash
git add index.html css/systems.css script.js
git commit -m "feat: Prestige UI in Settings, confirm and success modals"
```

---

## Task 7: Quest 06 and prestigeUnlocked sync

**Files:**
- Modify: `js/quests.js` (applyQuestUnlocks case 'prestige' already sets quests.prestigeUnlocked; ensure checkVictoryConditions also sets prestige.unlocked so both stay in sync when victory is via quest trigger)

**Step 1:** When quest_06 completes, it runs applyQuestUnlocks('prestige') which sets quests.prestigeUnlocked = true. The prestige system uses prestige.unlocked. So when checkVictoryConditions() sets prestige.unlocked = true (on 9 Justices, Epstaina, or war), that is the source of truth. Optionally in applyQuestUnlocks('prestige') also set GameStore prestige.unlocked = true so that completing quest_06 alone unlocks prestige even if checkVictoryConditions was not called yet. That way both victory paths (direct purchase vs quest completion) keep prestige.unlocked true.

**Step 2: Commit**

```bash
git add js/quests.js
git commit -m "fix: set prestige.unlocked in quest 06 unlock"
```

---

## Task 8: Mars epstainaFounded victory hook

**Files:**
- Modify: `js/late_game_systems.js` (where epstainaFounded is set to true)

**Step 1:** Locate the line that sets epstainaFounded = true (e.g. state.epstainaFounded = true in Mars completion). Right after that, call if (typeof checkVictoryConditions === 'function') checkVictoryConditions(); Use the same state reference (marsSystem) so GameStore has been updated before the call; if the set is on a local copy, ensure GameStore.setValue('marsSystem', ...) is called before checkVictoryConditions.

**Step 2: Commit**

```bash
git add js/late_game_systems.js
git commit -m "feat: call checkVictoryConditions when Epstaina founded"
```

---

## Task 9: Achievements for prestige

**Files:**
- Modify: `js/achievements.js` (add achievements: First Prestige, Prestige Master e.g. 10, Prestige Legend e.g. 50, High Prestige e.g. level 25). Conditions read prestige.level or prestige.totalPrestigePoints from state.

**Step 1:** Add achievement definitions that check GameStore.getValue('prestige').level (or state.prestige in condition callback). Unlock when condition first becomes true (existing achievement system). Add unlockAchievement call in performPrestige for "First Prestige"; others can be checked in checkAchievements if it runs every tick.

**Step 2: Commit**

```bash
git add js/achievements.js
git commit -m "feat: prestige achievements (First Prestige, Master, Legend, High Prestige)"
```

---

## Task 10: support-effect-list and docs

**Files:**
- Modify: HTML or JS that defines "support-effect-list" (add prestige bonuses to the appropriate column, e.g. "other" or APS/APC/cost column per project rules)
- Modify: `docs/plans/2026_02/26_02_19_prestige_system_design.md` (add "Implemented" note or leave as-is)
- Optional: `.cursor/rules/system-effects-sync.mdc` checklist if applicable

**Step 1:** Add prestige bonus descriptions to support-effect-list (APS mult, APC mult, cost reduction) in the correct column per .cursor/rules.

**Step 2: Commit**

```bash
git add [files]
git commit -m "docs: support-effect-list prestige bonuses"
```

---

## Task 11: Changelog and version bump

**Files:**
- Create: `CHANGELOGS/2026_02/changelog_26_02_19_XX_prestige_system.md`
- Modify: `script.js` (GAME_VERSION bump if desired – minor)

**Step 1:** Write short changelog per .cursor/rules/changelog.mdc: list new files (prestige.js), modified files, new config keys, new state keys, UI elements, victory conditions, save/load. Propose next version (e.g. minor bump).

**Step 2: Commit**

```bash
git add CHANGELOGS/2026_02/changelog_26_02_19_XX_prestige_system.md script.js
git commit -m "changelog: prestige system; version bump"
```

---

## Execution options

Plan saved to `docs/plans/2026_02/26_02_19_prestige_system_implementation.md`.

**Two execution options:**

1. **Subagent-driven (this session)** – I run tasks one by one (or dispatch subagents per task), you review between tasks for fast iteration.
2. **Parallel session (separate)** – You open a new session with executing-plans and run the plan with checkpoints there.

Which approach do you prefer?
