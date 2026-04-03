# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

TOPKEK Productions is a zero-dependency static website (vanilla HTML/CSS/JS + Three.js 0.160.0 from CDN). There is no build step, no `package.json`, no `node_modules`, and no bundler. See `WYTYCZNE_PROJEKTU.md` and `.cursor/rules/topkek-project-rules.mdc` for full project conventions.

### Running the dev server

```
python3 server.py 8002
```

This starts a static HTTP server on port 8002 serving the workspace root. The app is then available at `http://localhost:8002/`. The server is a thin wrapper around Python's `http.server` that suppresses connection-reset errors.

### Linting / testing / building

- **No automated test suite** exists in this project.
- **No linter configuration** (ESLint, Prettier, etc.) is present.
- **No build step** — the project runs as raw static files.
- To verify correctness, open `http://localhost:8002/` in a browser and interact with the 3D scene (particle effects, menu, camera modes).

### Key gotchas

- Three.js is loaded from `unpkg.com` CDN at runtime, so **internet access is required** on first load.
- The import map in `index.html` pins Three.js to version **0.160.0**; do not change without updating all imports and testing for regressions.
- `config.js` contains only configuration data — never add runtime logic or side effects there.
- Particle data lives in `particles_pc.json` (desktop) and `particles_mobile.json` (mobile); changes to their format must be synced with the loader in `script.js`.
