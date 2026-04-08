/**
 * Map showcase animation documents to MYSEN lyric arrays and config patches.
 */

import { parseMysenTimestampLyricsFile } from './mysen-timestamp-parse.js';
import { buildMergedMysenLyricsArray, lastFilledLineIndexInLyrics } from './mysen-merge-lyrics-from-timestamps.js';
import { SHOWCASE_ANIMATION_SCHEMA_VERSION } from './showcase-animation-schema.js';

/**
 * @param {string | undefined} p
 * @returns {string}
 */
function fileNameFromRepoPath(p) {
    if (!p || typeof p !== 'string') return 'audio.mp3';
    const s = p.replace(/\\/g, '/').split('/').pop();
    return s && s.length ? s : 'audio.mp3';
}

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
        if (Number.isFinite(w.wordSize) && w.wordSize > 0) entry.wordSize = w.wordSize;
        if (Number.isFinite(w.wordHeight) && w.wordHeight > 0) entry.wordHeight = w.wordHeight;
        if (Number.isFinite(w.wordThickness) && w.wordThickness > 0) entry.wordThickness = w.wordThickness;
        if (Number.isFinite(w.scatterRadius) && w.scatterRadius > 0) entry.scatterRadius = w.scatterRadius;
        if (typeof w.materialPresetId === 'string' && w.materialPresetId.length) {
            entry.materialPresetId = w.materialPresetId;
        }
        if (typeof w.wordFxId === 'string' && w.wordFxId.length && w.wordFxId !== 'none') {
            entry.wordFxId = w.wordFxId;
        }
        if (Number.isFinite(w.visibleFromFragSec)) entry.visibleFromFragSec = w.visibleFromFragSec;
        if (Number.isFinite(w.visibleToFragSec)) entry.visibleToFragSec = w.visibleToFragSec;
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
        if (Number.isFinite(w.offsetX)) entry.offsetX = w.offsetX;
        if (Number.isFinite(w.offsetY)) entry.offsetY = w.offsetY;
        if (Number.isFinite(w.offsetZ)) entry.offsetZ = w.offsetZ;
        if (Number.isFinite(w.mysenSplitRow)) entry.mysenSplitRow = w.mysenSplitRow;
        out.push(entry);
    }
    return out;
}

/**
 * Build a showcase animation document from the same merge as /mysen without `showcaseAnimationUrl`
 * (intro + timestamp rows + line groups). For authoring in tools/showcase-animation-editor.
 *
 * @param {object} mysenConfig — MYSEN_CONFIG-shaped
 * @param {{ text: string, at: number, color?: number }[]} timestampRows
 * @param {object | null} [wordAnimDoc] — parsed mysen-word-animation.json (optional `defaults`)
 * @returns {import('./showcase-animation-schema.js').ShowcaseAnimationDoc}
 */
export function buildShowcaseAnimationDocFromMysenRuntimeMerge(mysenConfig, timestampRows, wordAnimDoc = null) {
    const merged = buildMergedMysenLyricsArray(mysenConfig, timestampRows);
    const intro = mysenConfig.introLyrics || mysenConfig.lyrics;
    const lastIntro = lastFilledLineIndexInLyrics(intro);
    const firstTimestampLineIndex = lastIntro >= 0 ? lastIntro + 1 : 6;

    /** @type {import('./showcase-animation-schema.js').ShowcaseWordEntry[]} */
    const words = [];
    let wn = 0;
    for (let i = 0; i < merged.length; i++) {
        const item = merged[i];
        if (item.lineBreak === true) {
            words.push({ lineBreak: true });
            continue;
        }
        const id = `w_${wn++}`;
        /** @type {import('./showcase-animation-schema.js').ShowcaseWordEntry} */
        const ent = {
            id,
            text: item.text,
            at: Number.isFinite(item.at) ? item.at : 0,
            color: typeof item.color === 'number' ? item.color : (mysenConfig.timestampWordColor ?? 0xffffff),
            scale: typeof item.scale === 'number' && item.scale > 0 ? item.scale : 1
        };
        if (item.mysenPersistentOnScreen === true) ent.mysenPersistentOnScreen = true;
        if (item.mysenGroupedLine === true) ent.groupedLine = true;
        if (Number.isFinite(item.mysenSplitRow)) ent.mysenSplitRow = item.mysenSplitRow;
        if (Number.isFinite(item.offsetX)) ent.offsetX = item.offsetX;
        if (Number.isFinite(item.offsetY)) ent.offsetY = item.offsetY;
        if (Number.isFinite(item.offsetZ)) ent.offsetZ = item.offsetZ;
        if (Number.isFinite(item.lineVanishAtSourceSec)) ent.vanishAtMediaSec = item.lineVanishAtSourceSec;
        if (Number.isFinite(item.assemblyDurationSec) && item.assemblyDurationSec > 0) {
            ent.assemblyDurationSec = item.assemblyDurationSec;
        }
        words.push(ent);
    }

    /** @type {Record<string, unknown>} */
    const style = {
        wordSize: mysenConfig.wordSize,
        wordHeight: mysenConfig.wordHeight,
        wordThickness: mysenConfig.wordThickness,
        scatterRadius: mysenConfig.scatterRadius,
        defaultWordColor: mysenConfig.defaultWordColor,
        wordAssemblyDuration: mysenConfig.wordAssemblyDuration,
        lyricsStartDelay: mysenConfig.lyricsStartDelay,
        lineSpacing: mysenConfig.lineSpacing,
        wordSpacing: mysenConfig.wordSpacing,
        lyricsOffsetY: mysenConfig.lyricsOffsetY
    };
    if (mysenConfig.spread && typeof mysenConfig.spread === 'object') {
        style.spread = { ...mysenConfig.spread };
    }
    if (mysenConfig.randomFly && typeof mysenConfig.randomFly === 'object') {
        style.randomFly = { ...mysenConfig.randomFly };
    }
    if (wordAnimDoc?.defaults && typeof wordAnimDoc.defaults === 'object') {
        Object.assign(style, wordAnimDoc.defaults);
    }

    return {
        schemaVersion: SHOWCASE_ANIMATION_SCHEMA_VERSION,
        adapter: 'voxelLyricsMysen',
        audio: {
            durationSec: 0,
            suggestedFileName: fileNameFromRepoPath(mysenConfig.audioFile),
            exportHintPath: typeof mysenConfig.audioFile === 'string' ? mysenConfig.audioFile : undefined
        },
        timing: {
            audioStartTime: mysenConfig.audioStartTime ?? 0,
            audioEndTime: mysenConfig.audioEndTime ?? null,
            firstTimestampLineIndex
        },
        words,
        transformKeyframes: {},
        postprocessKeyframes: {},
        volumetricKeyframes: {},
        customKeyframes: {},
        cameraPreview: { fovDeg: 45 },
        style
    };
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
        transformKeyframes: {},
        postprocessKeyframes: {},
        volumetricKeyframes: {},
        customKeyframes: {},
        cameraPreview: { fovDeg: 45 },
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
