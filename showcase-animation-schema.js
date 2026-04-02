/**
 * Showcase animation document — versioned JSON for voxel-lyric showcases (MYSEN adapter first).
 * Shared by tools/showcase-animation-editor and runtime merge in script.js.
 */

export const SHOWCASE_ANIMATION_SCHEMA_VERSION = 1;

/** @type {readonly string[]} */
export const SHOWCASE_ANIMATION_ADAPTERS = Object.freeze(['voxelLyricsMysen']);

/**
 * @typedef {object} ShowcaseAnimationAudio
 * @property {number} [durationSec]
 * @property {string} [suggestedFileName]
 * @property {string} [exportHintPath]
 */

/**
 * @typedef {object} ShowcaseAnimationTiming
 * @property {number} [audioStartTime]
 * @property {number} [audioEndTime]
 * @property {number} [firstTimestampLineIndex] — runtime: words with lineIndex >= this use MYSEN timestamp fly; default high = rail-only
 */

/**
 * @typedef {object} ShowcaseWordSpawn
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {object} ShowcaseWordEntry
 * @property {string} [id]
 * @property {string} [text]
 * @property {number} [at] — seconds from fragment start (same as MYSEN lyric `at`)
 * @property {number} [color] — hex int
 * @property {number} [scale]
 * @property {boolean} [lineBreak]
 * @property {boolean} [persistentOnScreen] — MYSEN: skip intro line spread-out (stay on screen)
 * @property {boolean} [mysenPersistentOnScreen] — alias of persistentOnScreen for older JSON
 * @property {boolean} [groupedLine] — MYSEN: rail-only for timestamp words (no frustum fly)
 * @property {ShowcaseWordSpawn} [spawn] — fixed fly start → spawnX/Y/Z in runtime
 * @property {number} [vanishAtMediaSec] — absolute media time (s) when line spread-out starts (same axis as audio file)
 * @property {number} [assemblyDurationSec] — per-word voxel assembly duration (overrides style.wordAssemblyDuration)
 */

/**
 * @typedef {object} ShowcaseTransformKeyframe
 * @property {number} t — seconds on fragment timeline (same axis as MYSEN `elapsed`)
 * @property {number[]} [position] — [x,y,z] additive offset on top of lyric layout (world-ish units)
 * @property {number[]} [rotationEuler] — [rx,ry,rz] radians
 * @property {number} [scale] — multiplier on assembled voxel scale
 */

/**
 * @typedef {object} ShowcaseAnimationDoc
 * @property {number} schemaVersion
 * @property {string} adapter
 * @property {ShowcaseAnimationAudio} [audio]
 * @property {ShowcaseAnimationTiming} [timing]
 * @property {ShowcaseWordEntry[]} words
 * @property {Record<string, ShowcaseTransformKeyframe[]>} [transformKeyframes]
 * @property {Record<string, unknown>} [style]
 */

/**
 * @param {unknown} raw
 * @returns {{ ok: true, doc: ShowcaseAnimationDoc } | { ok: false, error: string }}
 */
export function validateShowcaseAnimationDoc(raw) {
    if (!raw || typeof raw !== 'object') {
        return { ok: false, error: 'Document must be an object' };
    }
    const o = /** @type {Record<string, unknown>} */ (raw);
    if (o.schemaVersion !== SHOWCASE_ANIMATION_SCHEMA_VERSION) {
        return { ok: false, error: `schemaVersion must be ${SHOWCASE_ANIMATION_SCHEMA_VERSION}` };
    }
    if (typeof o.adapter !== 'string' || !SHOWCASE_ANIMATION_ADAPTERS.includes(o.adapter)) {
        return { ok: false, error: `adapter must be one of: ${SHOWCASE_ANIMATION_ADAPTERS.join(', ')}` };
    }
    if (!Array.isArray(o.words) || o.words.length === 0) {
        return { ok: false, error: 'words must be a non-empty array' };
    }

    let wordCount = 0;
    for (let i = 0; i < o.words.length; i++) {
        const w = o.words[i];
        if (!w || typeof w !== 'object') {
            return { ok: false, error: `words[${i}] must be an object` };
        }
        const we = /** @type {Record<string, unknown>} */ (w);
        if (we.lineBreak === true) continue;
        if (typeof we.text !== 'string' || !we.text.length) {
            return { ok: false, error: `words[${i}].text required (non-empty string)` };
        }
        wordCount++;
        if (we.at != null && typeof we.at !== 'number') {
            return { ok: false, error: `words[${i}].at must be a number` };
        }
        if (we.persistentOnScreen != null && typeof we.persistentOnScreen !== 'boolean') {
            return { ok: false, error: `words[${i}].persistentOnScreen must be a boolean` };
        }
        if (we.mysenPersistentOnScreen != null && typeof we.mysenPersistentOnScreen !== 'boolean') {
            return { ok: false, error: `words[${i}].mysenPersistentOnScreen must be a boolean` };
        }
        if (we.groupedLine != null && typeof we.groupedLine !== 'boolean') {
            return { ok: false, error: `words[${i}].groupedLine must be a boolean` };
        }
        if (we.spawn != null) {
            if (typeof we.spawn !== 'object' || we.spawn === null || Array.isArray(we.spawn)) {
                return { ok: false, error: `words[${i}].spawn must be an object` };
            }
            const sp = /** @type {Record<string, unknown>} */ (we.spawn);
            for (const k of ['x', 'y', 'z']) {
                if (typeof sp[k] !== 'number' || !Number.isFinite(/** @type {number} */ (sp[k]))) {
                    return { ok: false, error: `words[${i}].spawn.${k} must be a finite number` };
                }
            }
        }
        if (we.vanishAtMediaSec != null) {
            if (typeof we.vanishAtMediaSec !== 'number' || !Number.isFinite(we.vanishAtMediaSec)) {
                return { ok: false, error: `words[${i}].vanishAtMediaSec must be a finite number` };
            }
        }
        if (we.assemblyDurationSec != null) {
            if (
                typeof we.assemblyDurationSec !== 'number' ||
                !Number.isFinite(we.assemblyDurationSec) ||
                we.assemblyDurationSec <= 0
            ) {
                return { ok: false, error: `words[${i}].assemblyDurationSec must be a finite number > 0` };
            }
        }
    }
    if (wordCount === 0) {
        return { ok: false, error: 'At least one word entry with text is required' };
    }

    if (o.transformKeyframes != null) {
        if (typeof o.transformKeyframes !== 'object' || Array.isArray(o.transformKeyframes)) {
            return { ok: false, error: 'transformKeyframes must be an object map' };
        }
        const tf = /** @type {Record<string, unknown>} */ (o.transformKeyframes);
        for (const key of Object.keys(tf)) {
            const arr = tf[key];
            if (!Array.isArray(arr)) {
                return { ok: false, error: `transformKeyframes.${key} must be an array` };
            }
            for (let j = 0; j < arr.length; j++) {
                const kf = arr[j];
                if (!kf || typeof kf !== 'object') {
                    return { ok: false, error: `transformKeyframes.${key}[${j}] invalid` };
                }
                const k = /** @type {Record<string, unknown>} */ (kf);
                if (typeof k.t !== 'number' || !Number.isFinite(k.t)) {
                    return { ok: false, error: `Keyframe ${key}[${j}].t must be a finite number` };
                }
            }
        }
    }

    const doc = /** @type {ShowcaseAnimationDoc} */ ({
        schemaVersion: SHOWCASE_ANIMATION_SCHEMA_VERSION,
        adapter: o.adapter,
        audio: o.audio && typeof o.audio === 'object' ? o.audio : undefined,
        timing: o.timing && typeof o.timing === 'object' ? o.timing : undefined,
        words: o.words,
        transformKeyframes:
            o.transformKeyframes && typeof o.transformKeyframes === 'object' && !Array.isArray(o.transformKeyframes)
                ? o.transformKeyframes
                : undefined,
        style: o.style && typeof o.style === 'object' ? o.style : undefined
    });
    return { ok: true, doc };
}

/**
 * @returns {ShowcaseAnimationDoc}
 */
export function createEmptyShowcaseAnimationDoc() {
    return {
        schemaVersion: SHOWCASE_ANIMATION_SCHEMA_VERSION,
        adapter: 'voxelLyricsMysen',
        audio: { durationSec: 0, suggestedFileName: '', exportHintPath: 'ASSETS/mysen/showcase-animation.json' },
        timing: { audioStartTime: 0, audioEndTime: null, firstTimestampLineIndex: 99999 },
        words: [{ id: 'w0', text: 'TOPKEK', at: 0, color: 0xffffff, scale: 1 }],
        transformKeyframes: {},
        style: {
            wordSize: 1.0,
            wordAssemblyDuration: 1.8,
            randomFly: { enabled: false }
        }
    };
}
