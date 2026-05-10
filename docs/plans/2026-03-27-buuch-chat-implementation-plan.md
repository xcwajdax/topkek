# Buuch Chat — Implementation Plan

**Status:** Saved, not implemented
**Created:** 2026-03-27
**Author:** Buuch
**Time estimate:** ~2-3h

---

## Overview

Stateless chat z Buuch'em w terminalu topkek.info.
- Użytkownik wpisuje pytanie → dostaje odpowiedź w stylu Buucha
- Komendy `/` omijają chat i działają normalnie
- Zero pamięci między sesjami, zero LLM, zero GPU
- Ton: suchy humor, direct, bez fillerów

---

## Files to Create/Modify

| File | Action | Lines est. |
|-------|--------|------------|
| `buuch-chat.js` | **CREATE** | ~150 |
| `knowledge_base.json` | **CREATE** | ~120 |
| `terminal-shell.js` | **MODIFY** | +30 |
| `docs/plans/2026-03-27-buuch-chat-implementation-plan.md` | **CREATE** | (this file) |

---

## Step 1 — Create `knowledge_base.json`

**Path:** `C:\Users\user\.openclaw\workspace\projects\topkek\knowledge_base.json`

**Content:**

```json
{
  "intents": [
    {
      "id": "who_is_topkek",
      "keywords": ["topkek", "kim jest", "who is", "about", "co to", "xcwajdax"],
      "response": "TOPKEK Productions to jednoosobowa marka Jakuba (xcwajdax). Animator, dev, twórca satyrycznych gier i eksperymentów. W skrócie: robi rzeczy które go bawią."
    },
    {
      "id": "contact",
      "keywords": ["contact", "kontakt", "email", "discord", "whatsapp", "napisz", "jak się", "dotarcie"],
      "response": "Discord lub WhatsApp — linki znajdziesz na dole strony. Nie lubi LinkedIn."
    },
    {
      "id": "appstain",
      "keywords": ["appstain", "trump", "clicker", "gra", "game", "apk", "app"],
      "response": "APPSTAIN to satyryczny clicker o Trumpie. Budujesz imperium, zbierasz Acts, unikasz impeachmentu. Jeszcze w alfie — wpisz /appstain w terminalu."
    },
    {
      "id": "vajbuj",
      "keywords": ["vajbuj", "vajbuj szmato", "muzyka", "muzyki", "piosenka", "szmato"],
      "response": "VAJBUJ to eksperyment muzyczny TOPKEK. Wpisz `vajbuj` w terminalu (bez `/`) żeby odpalić."
    },
    {
      "id": "terminal_help",
      "keywords": ["help", "pomoc", "komendy", "commands", "co mogę", "co mozna", "dostępne"],
      "response": "Wpisz /help żeby zobaczyć listę komend. Wszystko ze `/` to komendy. Reszta — pytaj."
    },
    {
      "id": "projects",
      "keywords": ["projekty", "projects", "co robisz", "co robi", "portfolio", "coś"],
      "response": "Główny projekt to APPSTAIN (satyra na Trumpa). Potem SCNDBREJN (memory browser), Glitch Lab, GENIMG. Wszystko znajdziesz w terminalu."
    },
    {
      "id": "glitch_lab",
      "keywords": ["glitch", "glitch lab", "glitchlab", "art", "glitche"],
      "response": "Glitch Lab to narzędzie do tworzenia glitch art. Wpisz /glitch w terminalu."
    },
    {
      "id": "scndbrejn",
      "keywords": ["scndbrejn", "second brain", "2nd brain", "pamięć", "notes", "notatki"],
      "response": "SCNDBREJN to local web app do zarządzania pamięcią/notes. Kręci się w tle jako eksperyment."
    },
    {
      "id": "who_are_you",
      "keywords": ["kim jesteś", "who are you", "buuch", "buszek", "you", "jesteś", "co to"],
      "response": "Jestem Buuch. Technical AI assistant specjalizujący się w webdev. Suchy humor, direct, bez pierdolenia. Pytaj."
    },
    {
      "id": "where",
      "keywords": ["where", "gdzie", "lokalizacja", "szczecin", "location"],
      "response": "Szczecin. Nie myl z Warsaw — to inna planeta."
    },
    {
      "id": "undefined_question",
      "keywords": [],
      "response": "Nie jestem pewien co masz na myśli. Spróbuj /help żeby zobaczyć dostępne komendy."
    }
  ]
}
```

---

## Step 2 — Create `buuch-chat.js`

**Path:** `C:\Users\user\.openclaw\workspace\projects\topkek\buuch-chat.js`

**Content:**

```javascript
/**
 * buuch-chat.js — Stateless Buuch chat engine
 * 
 * Matches user input against knowledge_base.json intents.
 * Zero memory, zero LLM, zero GPU.
 */

import { TERMINAL_CONFIG } from './config.js';

let knowledgeBase = null;
let kbLoaded = false;

/**
 * Load knowledge base from JSON file.
 * Called once on init.
 */
export async function initBuuchChat() {
    if (kbLoaded) return;
    try {
        const res = await fetch('./knowledge_base.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        knowledgeBase = data;
        kbLoaded = true;
    } catch (err) {
        console.error('[Buuch] Failed to load knowledge_base.json:', err);
        // Fallback: inline minimal KB
        knowledgeBase = { intents: [{ id: 'error', keywords: [], response: 'KB unavailable.' }] };
        kbLoaded = true;
    }
}

/**
 * Detects if input is a command (starts with /).
 */
export function isCommand(input) {
    return typeof input === 'string' && input.trim().startsWith('/');
}

/**
 * Normalizes input for matching:
 * - lowercase
 * - remove punctuation
 * - trim
 */
function normalizeInput(input) {
    return input
        .toLowerCase()
        .replace(/[.,!?;:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Tokenizes input into words.
 */
function tokenize(input) {
    return normalizeInput(input).split(' ').filter(Boolean);
}

/**
 * Checks if a keyword matches the input.
 * Match types (in priority order):
 * 1. exact keyword in tokens
 * 2. keyword is substring of input
 * 3. token is substring of keyword
 */
function keywordMatches(keyword, input, tokens) {
    const normalized = normalizeInput(input);
    
    // Check if keyword is substring of normalized input
    if (normalized.includes(keyword)) return 2;
    
    // Check if any token contains the keyword
    for (const token of tokens) {
        if (token.includes(keyword)) return 1;
    }
    
    return 0;
}

/**
 * Finds best matching intent from knowledge base.
 * Returns the matched intent object (never null).
 */
export function matchIntent(input) {
    if (!kbLoaded || !knowledgeBase) {
        return { id: 'error', response: 'KB not loaded.' };
    }

    const tokens = tokenize(input);
    const normalized = normalizeInput(input);

    let bestScore = 0;
    let bestIntent = null;

    for (const intent of knowledgeBase.intents) {
        // undefined_question always matches last
        if (intent.id === 'undefined_question') continue;

        let score = 0;

        for (const keyword of intent.keywords) {
            const match = keywordMatches(keyword, input, tokens);
            score += match;
        }

        if (score > bestScore) {
            bestScore = score;
            bestIntent = intent;
        }
    }

    // If no match found, use undefined_question
    if (!bestIntent) {
        bestIntent = knowledgeBase.intents.find(i => i.id === 'undefined_question') || {
            id: 'undefined_question',
            response: 'Nie jestem pewien co masz na myśli. Spróbuj /help.'
        };
    }

    return bestIntent;
}

/**
 * Main function: returns Buuch's reply for the given input.
 * Returns null if input looks like a command.
 */
export function buuchReply(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (isCommand(trimmed)) return null;

    const intent = matchIntent(trimmed);
    return intent?.response || 'Co?';
}

/**
 * Adds Buuch response to terminal log.
 * Creates 'buuch' class on the line for CSS styling.
 */
export async function appendBuuchResponse(logEl, response, options = {}) {
    const line = document.createElement('div');
    line.className = 'topkek-terminal-log-line topkek-terminal-line-buuch';

    if (TERMINAL_CONFIG?.timestamp?.enabled !== false) {
        const ts = document.createElement('span');
        ts.className = 'topkek-terminal-log-ts';
        const now = new Date();
        ts.textContent = `[${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]`;
        line.appendChild(ts);
    }

    const textEl = document.createElement('span');
    textEl.className = 'topkek-terminal-log-text';
    textEl.textContent = response;
    line.appendChild(textEl);

    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
}
```

---

## Step 3 — Modify `terminal-shell.js`

**Path:** `C:\Users\user\.openclaw\workspace\projects\topkek\terminal-shell.js`

**Changes:**

1. Add import at top (after existing imports):
```javascript
import { initBuuchChat, isCommand, buuchReply, appendBuuchResponse } from './buuch-chat.js';
```

2. After shell initialization, call `initBuuchChat()`:
```javascript
// After welcomeLines.forEach...
initBuuchChat();
```

3. In the `keydown` handler (around line 120), change the non-`/clear` branch:

**Find this code (around line 135):**
```javascript
if (low === '/clear') {
    clearLog();
    return;
}

let out;
try {
    out = onCommand(line);
} catch (err) {
    await appendLogLine(`Error: ${err?.message || err}`, 'topkek-terminal-err', 'error');
    return;
}
if (out && typeof out === 'object' && !Array.isArray(out) && Array.isArray(out.lines)) {
    await appendLogLines(out.lines, 'response', { stream: !!out.stream });
    return;
}
await appendLogLines(out, 'response');
```

**Replace with:**
```javascript
if (low === '/clear') {
    clearLog();
    return;
}

if (isCommand(line)) {
    // Existing command flow
    let out;
    try {
        out = onCommand(line);
    } catch (err) {
        await appendLogLine(`Error: ${err?.message || err}`, 'topkek-terminal-err', 'error');
        return;
    }
    if (out && typeof out === 'object' && !Array.isArray(out) && Array.isArray(out.lines)) {
        await appendLogLines(out.lines, 'response', { stream: !!out.stream });
        return;
    }
    await appendLogLines(out, 'response');
} else {
    // Buuch chat
    const response = buuchReply(line);
    if (response) {
        await appendBuuchResponse(logEl, response);
    }
}
```

4. Add CSS for Buuch responses (in `style.css` or a new `buuch-chat.css`):

```css
.topkek-terminal-line-buuch {
    color: #00ff99;
}
.topkek-terminal-line-buuch .topkek-terminal-log-text {
    color: #00ff99;
}
```

---

## Step 4 — Optional: Create `buuch-chat.css`

**Path:** `C:\Users\user\.openclaw\workspace\projects\topkek\buuch-chat.css`

**Content:**

```css
/* Buuch chat terminal styling */
.topkek-terminal-line-buuch {
    color: #00ff99;
    opacity: 0.95;
}

.topkek-terminal-line-buuch .topkek-terminal-log-text {
    color: #00ff99;
}

.topkek-terminal-line-buuch .topkek-terminal-log-ts {
    color: #666;
}
```

**Then add to `index.html` (in `<head>`):**
```html
<link rel="stylesheet" href="buuch-chat.css">
```

---

## Testing Checklist

- [ ] `knowledge_base.json` loads without errors (check console)
- [ ] Non-command input ("kim jest TOPKEK?") returns response
- [ ] Command input ("/help") still routes to command handler
- [ ] `undefined_question` fallback works for random input
- [ ] Green text appears in terminal for Buuch responses
- [ ] Scroll behavior preserved
- [ ] Works on mobile (touch + enter)
- [ ] No console errors in browser DevTools

---

## Extending Knowledge Base

To add new Q&A without touching code:

1. Open `knowledge_base.json`
2. Add new object to `intents[]`:
```json
{
  "id": "unique_id",
  "keywords": ["keyword1", "keyword2", "partial match"],
  "response": "Response text in Buuch voice."
}
```

3. Restart server (required for v1)

---

## Future Upgrades (Out of Scope v1)

- `/kb add "question" | "answer"` — hot-add to KB
- LLM integration via Ollama (Plan B from original)
- Session memory
- Multi-language support
- Hot-reload KB without restart

---

## Commit Message

```
feat: Add stateless Buuch chat to terminal

- buuch-chat.js: intent matching engine
- knowledge_base.json: FAQ + responses in Buuch voice
- terminal-shell.js: / → command handler, rest → KB lookup
- buuch-chat.css: green terminal styling

Scope: stateless, zero LLM, zero GPU
```

---

**Plan saved. To implement:** Run `implement buuch-chat` or ask Buuch to start coding.
