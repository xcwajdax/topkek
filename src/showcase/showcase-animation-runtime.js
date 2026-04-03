/**
 * Apply showcase JSON transform keyframes to prepared MYSEN word runtime objects.
 */

import { interpolateTransformKeyframes } from './showcase-animation-keyframes.js';

/**
 * @typedef {import('./showcase-animation-schema.js').ShowcaseAnimationDoc} ShowcaseAnimationDoc
 */

/**
 * @param {{ words?: object[] }} state
 * @param {ShowcaseAnimationDoc | null} doc
 * @param {number} elapsedSec — MYSEN wall elapsed (fragment timeline)
 */
export function applyShowcaseTransformKeyframes(state, doc, elapsedSec) {
    const words = state.words;
    if (!words || !words.length) return;

    if (!doc?.transformKeyframes || typeof doc.transformKeyframes !== 'object') {
        for (let i = 0; i < words.length; i++) {
            clearShowcaseTransform(words[i]);
        }
        return;
    }

    const tf = doc.transformKeyframes;
    for (let i = 0; i < words.length; i++) {
        const wordData = words[i];
        const id = wordData.showcaseWordId;
        if (!id || typeof id !== 'string') {
            clearShowcaseTransform(wordData);
            continue;
        }
        const kfs = tf[id];
        if (!Array.isArray(kfs) || kfs.length === 0) {
            clearShowcaseTransform(wordData);
            continue;
        }
        const o = interpolateTransformKeyframes(kfs, elapsedSec);
        wordData._showcaseOx = o.ox;
        wordData._showcaseOy = o.oy;
        wordData._showcaseOz = o.oz;
        wordData._showcaseRx = o.rx;
        wordData._showcaseRy = o.ry;
        wordData._showcaseRz = o.rz;
        wordData._showcaseScaleMul = o.scaleMul;
    }
}

/** @param {object} wordData */
function clearShowcaseTransform(wordData) {
    wordData._showcaseOx = 0;
    wordData._showcaseOy = 0;
    wordData._showcaseOz = 0;
    wordData._showcaseRx = 0;
    wordData._showcaseRy = 0;
    wordData._showcaseRz = 0;
    wordData._showcaseScaleMul = 1;
}
