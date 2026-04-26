# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TOPKEK Productions is a vanilla 3D web application built with HTML5, CSS3, JavaScript ES modules, and Three.js 0.160.0. It renders an interactive particle/voxel scene with multiple showcase modes (VAJBUJ, MYSEN music visualizers, APPSTAIN game, GENIMG gallery). There is no build step, no bundler, no package manager — static files served by a Python HTTP server.

## Running the Project

```bash
# Start dev server (Linux/macOS)
python -m http.server 8002
# Then open http://127.0.0.1:8002/ (use 127.0.0.1, not localhost, to avoid IPv4/IPv6 issues on Windows)

# Windows
start.bat

# Custom port
python server.py 9000
```

URL parameters for testing:
- `?perf=lite` / `?perf=full` / `?perf=auto` — override performance profile
- `?text=CUSTOM` — custom display text (max 10 chars, uppercase)

## Tests

Tests use Node's built-in `node:test` module (no test runner required). Run from project root:

```bash
node --test tools/mysen-runtime-showcase-doc.test.mjs
node --test tools/terminal-menu-layout.test.mjs
```

No linter or formatter is configured.

## Architecture

### File Responsibilities

| File | Role |
|------|------|
| `index.html` | Entry point, import map for Three.js CDN, modal HTML, single `<script type="module" src="script.js">` |
| `script.js` | Main ES module: 3D scene init, particle system, camera, postprocessing, UI event handling, modal logic |
| `config.js` | **All** tunable parameters — `CONFIG`, `VAJBUJ_CONFIG`, `SHADER_CONFIG`, `MATERIALS`, `SHAPE_DEFINITIONS`, `CINEMATIC_CONFIG`, `LOADER_CONFIG`, `IS_MOBILE`, performance profiles. Zero business logic. |
| `style.css` | Global styles, responsive layout, terminal UI, modals |
| `src/ui/` | Reusable UI modules: `terminal-shell.js`, `fx-dev-panel.js`, `buuch-chat.js` |
| `src/showcase/` | Showcase animation system: schema, runtime, voxel lyrics, VAJBUJ/MYSEN mode controllers |
| `tools/` | Dev-only: showcase animation editor (`showcase-animation-editor.html`) and test files |
| `particles_pc.json` / `particles_mobile.json` | Pre-generated particle position data (sole source of truth for particle layout) |
| `knowledge_base.json` | Intent/response pairs for the Buuch chatbot |

### Key Architectural Rules

**Config vs. Logic split:** Any new parameter (number, color, flag, path) goes in `config.js` first — `script.js` only consumes it. "Change behavior" = edit `script.js`; "change tuning" = edit `config.js`.

**Three.js version lock:** Always Three.js **0.160.0** via the import map in `index.html`. Addons import from `three/addons/`. Never mix versions or change the CDN without a conscious decision and regression testing.

**No new dependencies without CDN:** Before adding any library, attempt vanilla JS / Three.js first. If a library is truly necessary, add it via CDN in `index.html` and document it in `WYTYCZNE_PROJEKTU.md` under "Zależności zewnętrzne".

**Mobile/desktop branching:** Use `IS_MOBILE` from `config.js` for any conditional logic (particle count, effect intensity, shadow map size). Never re-detect device inline.

**Performance profiles:** `lite` (≤3 GB RAM or ≤4 cores) disables SAO, CRT, reduces pixel ratio. `full` enables all effects. Controlled entirely through `config.js`; override via `?perf=` URL param.

### Showcase Animation System

`src/showcase/showcase-animation-schema.js` defines a versioned JSON schema for keyframe animations. `src/showcase/showcase-animation-runtime.js` plays them. The `tools/showcase-animation-editor.html` tool is used to author animations and export JSON compatible with this schema.

### Module Naming Conventions

- Config constants: `UPPER_SNAKE_CASE`
- Runtime variables and functions: `camelCase`
- File names: `kebab-case`
- CSS classes: BEM or consistent prefix per feature area (`appstain-`, `topkek-`, `term-`, `mysen-`)

## After Every Implementation

Update `CHANGELOG.md` under `## [Unreleased]` in the appropriate subsection (Added / Changed / Fixed / Removed). Entries are in Polish, past tense, one line per change.

## Documentation Files

- `WYTYCZNE_PROJEKTU.md` — comprehensive stack, file responsibilities, and conventions (Polish)
- `TODO.md` — task list (`[ ]` open, `[x]` done, `[~]` in progress; priorities: `[wysokie/średni/niski]`)
- `docs/plans/YYYY_MM/YYYY-MM-DD-slug.md` — dated implementation plans
- `CHANGELOG.md` — Keep a Changelog format
