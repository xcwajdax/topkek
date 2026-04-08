/**
 * Showcase animation document — versioned JSON for voxel-lyric showcases.
 * Shared by tools/showcase-animation-editor and runtime merge in script.js.
 */

import {
    SHOWCASE_CUSTOM_TRACK_IDS,
    SHOWCASE_MATERIAL_PRESETS,
    SHOWCASE_POSTPROCESS_TRACK_IDS,
    SHOWCASE_VOLUMETRIC_TRACK_IDS,
    SHOWCASE_WORD_FX_PRESETS
} from './showcase-effect-catalog.js';

/** Latest schema version for newly created documents */
export const SHOWCASE_ANIMATION_SCHEMA_VERSION = 2;

/** Supported on disk (runtime + editor) */
export const SHOWCASE_ANIMATION_SCHEMA_VERSION_MIN = 1;
export const SHOWCASE_ANIMATION_SCHEMA_VERSION_MAX = 2;

/** @type {readonly string[]} */
export const SHOWCASE_ANIMATION_ADAPTERS = Object.freeze(['voxelLyricsMysen', 'voxelLyricsVajbuj']);

/**
 * @typedef {object} ShowcaseAnimationAudio
 * @property {number} [durationSec]
 * @property {string} [suggestedFileName]
 * @property {string} [exportHintPath]
 * @property {string} [relativeAudioPath] — v2: path inside pack folder
 */

/**
 * @typedef {object} ShowcaseAnimationTiming
 * @property {number} [audioStartTime]
 * @property {number} [audioEndTime]
 * @property {number} [firstTimestampLineIndex]
 */

/**
 * @typedef {object} ShowcaseWordSpawn
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {object} ShowcaseScalarKeyframe
 * @property {number} t
 * @property {number} v
 */

/**
 * @typedef {object} ShowcaseWordEntry
 * @property {string} [id]
 * @property {string} [text]
 * @property {number} [at]
 * @property {number} [color]
 * @property {number} [scale]
 * @property {boolean} [lineBreak]
 * @property {boolean} [persistentOnScreen]
 * @property {boolean} [mysenPersistentOnScreen]
 * @property {boolean} [groupedLine]
 * @property {ShowcaseWordSpawn} [spawn]
 * @property {number} [vanishAtMediaSec]
 * @property {number} [assemblyDurationSec]
 * @property {number} [wordSize]
 * @property {number} [wordHeight]
 * @property {number} [wordThickness]
 * @property {number} [scatterRadius]
 * @property {string} [materialPresetId]
 * @property {string} [wordFxId]
 * @property {number} [visibleFromFragSec]
 * @property {number} [visibleToFragSec]
 * @property {number} [offsetX] — MYSEN rail row offset (world X), optional
 * @property {number} [offsetY] — MYSEN rail row offset (world Y), optional
 * @property {number} [offsetZ] — MYSEN rail offset Z, optional
 * @property {number} [mysenSplitRow] — sub-row index within grouped timestamp line, optional
 */

/**
 * @typedef {object} ShowcaseTransformKeyframe
 * @property {number} t
 * @property {number[]} [position]
 * @property {number[]} [rotationEuler]
 * @property {number} [scale]
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
 * @property {Record<string, ShowcaseScalarKeyframe[]>} [postprocessKeyframes]
 * @property {Record<string, ShowcaseScalarKeyframe[]>} [volumetricKeyframes]
 * @property {Record<string, ShowcaseScalarKeyframe[]>} [customKeyframes]
 * @property {{ fovDeg?: number, near?: number, far?: number }} [cameraPreview]
 */

/**
 * @param {unknown} mapVal
 * @param {string} label
 * @param {readonly string[]} [allowedKeys]
 * @returns {string | null} error or null
 */
function validateScalarKeyframeRecord(mapVal, label, allowedKeys) {
    if (mapVal == null) return null;
    if (typeof mapVal !== 'object' || Array.isArray(mapVal)) {
        return `${label} must be an object map`;
    }
    const o = /** @type {Record<string, unknown>} */ (mapVal);
    const keys = Object.keys(o);
    const allow = allowedKeys && allowedKeys.length ? new Set(allowedKeys) : null;
    for (let ki = 0; ki < keys.length; ki++) {
        const key = keys[ki];
        if (allow && !allow.has(key)) {
            return `${label}: unknown track "${key}"`;
        }
        const arr = o[key];
        if (!Array.isArray(arr)) {
            return `${label}.${key} must be an array`;
        }
        for (let j = 0; j < arr.length; j++) {
            const it = arr[j];
            if (!it || typeof it !== 'object') {
                return `${label}.${key}[${j}] invalid`;
            }
            const row = /** @type {Record<string, unknown>} */ (it);
            if (typeof row.t !== 'number' || !Number.isFinite(row.t)) {
                return `${label}.${key}[${j}].t must be finite`;
            }
            if (typeof row.v !== 'number' || !Number.isFinite(row.v)) {
                return `${label}.${key}[${j}].v must be finite`;
            }
        }
    }
    return null;
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, doc: ShowcaseAnimationDoc } | { ok: false, error: string }}
 */
export function validateShowcaseAnimationDoc(raw) {
    if (!raw || typeof raw !== 'object') {
        return { ok: false, error: 'Document must be an object' };
    }
    const o = /** @type {Record<string, unknown>} */ (raw);
    const ver = o.schemaVersion;
    if (ver !== 1 && ver !== 2) {
        return {
            ok: false,
            error: `schemaVersion must be ${SHOWCASE_ANIMATION_SCHEMA_VERSION_MIN} or ${SHOWCASE_ANIMATION_SCHEMA_VERSION_MAX}`
        };
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

        if (ver === 2) {
            for (const fld of ['wordSize', 'wordHeight', 'wordThickness', 'scatterRadius']) {
                if (we[fld] != null) {
                    const n = we[fld];
                    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
                        return { ok: false, error: `words[${i}].${fld} must be a finite number > 0` };
                    }
                }
            }
            if (we.materialPresetId != null) {
                if (typeof we.materialPresetId !== 'string' || !SHOWCASE_MATERIAL_PRESETS.some((p) => p.id === we.materialPresetId)) {
                    return { ok: false, error: `words[${i}].materialPresetId must be a known preset` };
                }
            }
            if (we.wordFxId != null) {
                if (typeof we.wordFxId !== 'string' || !SHOWCASE_WORD_FX_PRESETS.some((p) => p.id === we.wordFxId)) {
                    return { ok: false, error: `words[${i}].wordFxId must be a known preset` };
                }
            }
            for (const vf of ['visibleFromFragSec', 'visibleToFragSec']) {
                if (we[vf] != null) {
                    const n = we[vf];
                    if (typeof n !== 'number' || !Number.isFinite(n)) {
                        return { ok: false, error: `words[${i}].${vf} must be a finite number` };
                    }
                }
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

    if (ver === 2) {
        let err = validateScalarKeyframeRecord(o.postprocessKeyframes, 'postprocessKeyframes', SHOWCASE_POSTPROCESS_TRACK_IDS);
        if (err) return { ok: false, error: err };
        err = validateScalarKeyframeRecord(o.volumetricKeyframes, 'volumetricKeyframes', SHOWCASE_VOLUMETRIC_TRACK_IDS);
        if (err) return { ok: false, error: err };
        err = validateScalarKeyframeRecord(o.customKeyframes, 'customKeyframes', SHOWCASE_CUSTOM_TRACK_IDS);
        if (err) return { ok: false, error: err };

        if (o.cameraPreview != null) {
            if (typeof o.cameraPreview !== 'object' || Array.isArray(o.cameraPreview)) {
                return { ok: false, error: 'cameraPreview must be an object' };
            }
            const cp = /** @type {Record<string, unknown>} */ (o.cameraPreview);
            if (cp.fovDeg != null && (typeof cp.fovDeg !== 'number' || !Number.isFinite(cp.fovDeg) || cp.fovDeg <= 0)) {
                return { ok: false, error: 'cameraPreview.fovDeg must be a finite number > 0' };
            }
        }
    }

    const doc = /** @type {ShowcaseAnimationDoc} */ ({
        schemaVersion: ver,
        adapter: o.adapter,
        audio: o.audio && typeof o.audio === 'object' ? o.audio : undefined,
        timing: o.timing && typeof o.timing === 'object' ? o.timing : undefined,
        words: o.words,
        transformKeyframes:
            o.transformKeyframes && typeof o.transformKeyframes === 'object' && !Array.isArray(o.transformKeyframes)
                ? o.transformKeyframes
                : undefined,
        style: o.style && typeof o.style === 'object' ? o.style : undefined,
        ...(ver === 2
            ? {
                  postprocessKeyframes:
                      o.postprocessKeyframes && typeof o.postprocessKeyframes === 'object' && !Array.isArray(o.postprocessKeyframes)
                          ? o.postprocessKeyframes
                          : undefined,
                  volumetricKeyframes:
                      o.volumetricKeyframes && typeof o.volumetricKeyframes === 'object' && !Array.isArray(o.volumetricKeyframes)
                          ? o.volumetricKeyframes
                          : undefined,
                  customKeyframes:
                      o.customKeyframes && typeof o.customKeyframes === 'object' && !Array.isArray(o.customKeyframes)
                          ? o.customKeyframes
                          : undefined,
                  cameraPreview:
                      o.cameraPreview && typeof o.cameraPreview === 'object' && !Array.isArray(o.cameraPreview)
                          ? o.cameraPreview
                          : undefined
              }
            : {})
    });
    return { ok: true, doc };
}

/**
 * Upgrade v1 document to v2 shape (mutates copy).
 * @param {ShowcaseAnimationDoc} doc
 * @returns {ShowcaseAnimationDoc}
 */
export function migrateShowcaseAnimationDocToV2(doc) {
    const out = structuredClone(doc);
    if (out.schemaVersion < SHOWCASE_ANIMATION_SCHEMA_VERSION_MAX) {
        out.schemaVersion = SHOWCASE_ANIMATION_SCHEMA_VERSION_MAX;
    }
    if (!out.postprocessKeyframes) out.postprocessKeyframes = {};
    if (!out.volumetricKeyframes) out.volumetricKeyframes = {};
    if (!out.customKeyframes) out.customKeyframes = {};
    if (!out.cameraPreview) out.cameraPreview = { fovDeg: 45 };
    if (!out.style || typeof out.style !== 'object') out.style = {};
    const st = /** @type {Record<string, unknown>} */ (out.style);
    if (!st.backgroundVideo || typeof st.backgroundVideo !== 'object') {
        st.backgroundVideo = {
            relativePath: '',
            opacityKeyframes: [],
            playbackRateKeyframes: []
        };
    }
    return out;
}

/**
 * Normalize for runtime (always v2 fields present).
 * @param {ShowcaseAnimationDoc} doc
 * @returns {ShowcaseAnimationDoc}
 */
export function normalizeShowcaseAnimationDocForRuntime(doc) {
    if (doc.schemaVersion >= 2) {
        return {
            ...doc,
            postprocessKeyframes: doc.postprocessKeyframes || {},
            volumetricKeyframes: doc.volumetricKeyframes || {},
            customKeyframes: doc.customKeyframes || {},
            cameraPreview: doc.cameraPreview || { fovDeg: 45 }
        };
    }
    return migrateShowcaseAnimationDocToV2(doc);
}

/**
 * @returns {ShowcaseAnimationDoc}
 */
export function createEmptyShowcaseAnimationDoc() {
    return {
        schemaVersion: SHOWCASE_ANIMATION_SCHEMA_VERSION,
        adapter: 'voxelLyricsMysen',
        audio: {
            durationSec: 0,
            suggestedFileName: '',
            exportHintPath: 'ASSETS/mysen/showcase-animation.json',
            relativeAudioPath: 'audio.mp3'
        },
        timing: { audioStartTime: 0, audioEndTime: null, firstTimestampLineIndex: 99999 },
        words: [{ id: 'w0', text: 'TOPKEK', at: 0, color: 0xffffff, scale: 1 }],
        transformKeyframes: {},
        postprocessKeyframes: {},
        volumetricKeyframes: {},
        customKeyframes: {},
        cameraPreview: { fovDeg: 45, near: 0.1, far: 500 },
        style: {
            wordSize: 1.0,
            wordAssemblyDuration: 1.8,
            randomFly: { enabled: false },
            backgroundVideo: {
                relativePath: '',
                opacityKeyframes: [],
                playbackRateKeyframes: []
            }
        }
    };
}
