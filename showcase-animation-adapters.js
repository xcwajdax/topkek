/**
 * Map showcase animation documents to MYSEN lyric arrays and config patches.
 */

import { parseMysenTimestampLyricsFile } from './mysen-timestamp-parse.js';
import { SHOWCASE_ANIMATION_SCHEMA_VERSION } from './showcase-animation-schema.js';

/** Single-file legacy import for the showcase editor (intro + raw TS text + wordAnimation in one JSON). */
export const MYSEN_LEGACY_IMPORT_BUNDLE_KIND = 'mysenLegacyImportBundle';
export const MYSEN_LEGACY_IMPORT_BUNDLE_VERSION = 1;

/**
 * @typedef {import('./showcase-animation-schema.js').ShowcaseAnimationDoc} ShowcaseAnimationDoc
 */

/**
 * Build MYSEN-style lyrics array (with lineBreak entries) from a validated doc.
 * @param {ShowcaseAnimationDoc} doc
 * @returns {object[]}
 */
export function lyricsArrayFromShowcaseDoc(doc) {
    const startT = doc.timing?.audioStartTime ?? 0;
    const out = [];
    const words = doc.words || [];
    let autoId = 0;

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (w.lineBreak === true) {
            out.push({ lineBreak: true });
            continue;
        }
        const id = typeof w.id === 'string' && w.id.length ? w.id : `w${autoId++}`;
        const at = Number.isFinite(w.at) ? w.at : 0;
        const entry = {
            text: w.text,
            at,
            color: typeof w.color === 'number' ? w.color : 0xffffff,
            scale: typeof w.scale === 'number' && w.scale > 0 ? w.scale : 1,
            showcaseWordId: id,
            atSourceSec: startT + at
        };
        if (w.mysenPersistentOnScreen === true || w.persistentOnScreen === true) {
            entry.mysenPersistentOnScreen = true;
        }
        if (w.groupedLine === true) {
            entry.mysenGroupedLine = true;
        }
        if (w.spawn && typeof w.spawn === 'object' && !Array.isArray(w.spawn)) {
            const sp = /** @type {{ x?: number, y?: number, z?: number }} */ (w.spawn);
            if (Number.isFinite(sp.x)) entry.spawnX = sp.x;
            if (Number.isFinite(sp.y)) entry.spawnY = sp.y;
            if (Number.isFinite(sp.z)) entry.spawnZ = sp.z;
        }
        if (Number.isFinite(w.vanishAtMediaSec)) {
            entry.lineVanishAtSourceSec = w.vanishAtMediaSec;
        }
        if (Number.isFinite(w.assemblyDurationSec) && w.assemblyDurationSec > 0) {
            entry.assemblyDurationSec = w.assemblyDurationSec;
        }
        out.push(entry);
    }
    return out;
}

/**
 * Shallow merge doc.style into a MYSEN config slice (mutates target for known music keys only).
 * @param {Record<string, unknown>} target — merged MYSEN config object
 * @param {ShowcaseAnimationDoc} doc
 */
export function mergeShowcaseStyleIntoConfig(target, doc) {
    const st = doc.style;
    if (!st || typeof st !== 'object') return;

    const keys = [
        'wordSize',
        'wordHeight',
        'wordThickness',
        'wordAssemblyDuration',
        'lyricsStartDelay',
        'lineSpacing',
        'wordSpacing',
        'lyricsOffsetY',
        'scatterRadius',
        'defaultWordColor'
    ];
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (st[k] !== undefined) target[k] = st[k];
    }
    if (st.spread && typeof st.spread === 'object') {
        target.spread = { ...(target.spread || {}), ...st.spread };
    }
    if (st.randomFly && typeof st.randomFly === 'object') {
        target.randomFly = { ...(target.randomFly || {}), ...st.randomFly };
    }
}

/**
 * @param {object[]} introLyrics — MYSEN introLyrics items
 * @param {{ text: string, at: number }[]} timestampRows — absolute media seconds in `at`
 * @param {number} audioStartTime
 * @param {object | null} wordAnimDoc — parsed mysen-word-animation.json
 * @returns {ShowcaseAnimationDoc}
 */
export function buildShowcaseDocFromLegacyMysen(introLyrics, timestampRows, audioStartTime, wordAnimDoc) {
    /** @type {import('./showcase-animation-schema.js').ShowcaseWordEntry[]} */
    const words = [];

    const pushIntro = () => {
        if (!Array.isArray(introLyrics)) return;
        for (let i = 0; i < introLyrics.length; i++) {
            const item = introLyrics[i];
            if (item.lineBreak) {
                words.push({ lineBreak: true });
                continue;
            }
            const at = Number.isFinite(item.at) ? item.at : 0;
            words.push({
                id: `intro_${i}`,
                text: item.text,
                at,
                color: typeof item.color === 'number' ? item.color : 0xffffff,
                scale: typeof item.scale === 'number' ? item.scale : 1
            });
        }
    };

    pushIntro();

    if (Array.isArray(timestampRows) && timestampRows.length) {
        words.push({ lineBreak: true });
        for (let j = 0; j < timestampRows.length; j++) {
            const row = timestampRows[j];
            const absAt = row.at;
            const atFrag = Number.isFinite(absAt) ? absAt - audioStartTime : 0;
            words.push({
                id: `ts_${j}`,
                text: row.text,
                at: atFrag,
                color: 0xffffff,
                scale: 1
            });
            words.push({ lineBreak: true });
        }
    }

    return {
        schemaVersion: SHOWCASE_ANIMATION_SCHEMA_VERSION,
        adapter: 'voxelLyricsMysen',
        audio: { durationSec: 0 },
        timing: {
            audioStartTime,
            audioEndTime: null,
            firstTimestampLineIndex: 99999
        },
        words,
        style: wordAnimDoc?.defaults && typeof wordAnimDoc.defaults === 'object' ? wordAnimDoc.defaults : undefined
    };
}

/**
 * If `json` is a legacy import bundle, build a showcase doc; otherwise `{ handled: false }`.
 * @param {unknown} json
 * @returns {{ handled: false } | { handled: true, ok: true, doc: ShowcaseAnimationDoc } | { handled: true, ok: false, error: string }}
 */
export function tryBuildShowcaseDocFromLegacyImportBundle(json) {
    if (!json || typeof json !== 'object') return { handled: false };
    const o = /** @type {Record<string, unknown>} */ (json);
    if (o.kind !== MYSEN_LEGACY_IMPORT_BUNDLE_KIND || Number(o.version) !== MYSEN_LEGACY_IMPORT_BUNDLE_VERSION) {
        return { handled: false };
    }
    try {
        const intro = Array.isArray(o.intro) ? o.intro : [];
        const tsText = typeof o.timestampLyrics === 'string' ? o.timestampLyrics : '';
        const tsRows = parseMysenTimestampLyricsFile(tsText);
        const mediaStart = Number(o.mediaStart) || 0;
        const wordAnim =
            o.wordAnimation != null && typeof o.wordAnimation === 'object'
                ? /** @type {object} */ (o.wordAnimation)
                : null;
        const doc = buildShowcaseDocFromLegacyMysen(intro, tsRows, mediaStart, wordAnim);
        return { handled: true, ok: true, doc };
    } catch (err) {
        return { handled: true, ok: false, error: String(err?.message || err) };
    }
}
