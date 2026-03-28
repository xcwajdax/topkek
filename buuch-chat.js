/**
 * buuch-chat.js — Stateless Buuch chat engine
 *
 * Matches user input against knowledge_base.json intents.
 * Zero memory, zero LLM, zero GPU.
 */

let knowledgeBase = null;
let kbLoaded = false;

/**
 * Load knowledge base from JSON file. Call once on init; safe to call again (no-op).
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
        knowledgeBase = { intents: [{ id: 'error', keywords: [], response: 'KB unavailable.' }] };
        kbLoaded = true;
    }
}

/** True if input should be handled as a terminal command (leading /). */
export function isCommand(input) {
    return typeof input === 'string' && input.trim().startsWith('/');
}

function normalizeInput(input) {
    return input
        .toLowerCase()
        .replace(/[.,!?;:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(input) {
    return normalizeInput(input).split(' ').filter(Boolean);
}

/**
 * @param {string} keyword
 * @param {string} input raw user input
 * @param {string[]} tokens
 * @returns {number} score 0 = no match; higher = stronger
 */
function keywordMatches(keyword, input, tokens) {
    const normalized = normalizeInput(input);
    const kw = normalizeInput(keyword);
    if (!kw) return 0;
    if (normalized.includes(kw)) return 2;
    for (const token of tokens) {
        if (token.includes(kw)) return 1;
    }
    return 0;
}

/**
 * Best matching intent from the knowledge base (never null).
 */
export function matchIntent(input) {
    if (!kbLoaded || !knowledgeBase) {
        return { id: 'error', response: 'KB not loaded.' };
    }

    const tokens = tokenize(input);

    let bestScore = 0;
    let bestIntent = null;

    for (const intent of knowledgeBase.intents) {
        if (intent.id === 'undefined_question') continue;

        let score = 0;
        for (const keyword of intent.keywords) {
            score += keywordMatches(keyword, input, tokens);
        }
        if (score > bestScore) {
            bestScore = score;
            bestIntent = intent;
        }
    }

    if (!bestIntent) {
        bestIntent = knowledgeBase.intents.find((i) => i.id === 'undefined_question') || {
            id: 'undefined_question',
            response: 'Not sure what you mean. Try /help or /help full for commands.'
        };
    }

    return bestIntent;
}

/**
 * Buuch reply for free-form input, or null for commands / empty.
 */
export function buuchReply(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (isCommand(trimmed)) return null;

    const intent = matchIntent(trimmed);
    return intent?.response || 'Co?';
}
