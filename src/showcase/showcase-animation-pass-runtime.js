/**
 * Apply showcase JSON scalar keyframes to postprocessing passes and volumetric boosts.
 */

import { interpolateScalarKeyframes } from './showcase-animation-interpolate.js';

/**
 * @typedef {import('./showcase-animation-schema.js').ShowcaseAnimationDoc} ShowcaseAnimationDoc
 */

/**
 * @param {ShowcaseAnimationDoc | null | undefined} doc
 * @param {number} elapsedSec
 * @param {{ bloomPass?: object, saoPass?: object, crtPass?: object }} passes
 */
export function applyShowcasePostprocessKeyframes(doc, elapsedSec, passes) {
    const pp = doc?.postprocessKeyframes;
    if (!pp || typeof pp !== 'object') return;

    const { bloomPass, saoPass, crtPass } = passes;

    const bs = interpolateScalarKeyframes(pp.bloomStrength, elapsedSec);
    if (bs !== undefined && bloomPass) bloomPass.strength = bs;

    const br = interpolateScalarKeyframes(pp.bloomRadius, elapsedSec);
    if (br !== undefined && bloomPass) bloomPass.radius = br;

    const bt = interpolateScalarKeyframes(pp.bloomThreshold, elapsedSec);
    if (bt !== undefined && bloomPass) bloomPass.threshold = bt;

    const crtSc = interpolateScalarKeyframes(pp.crtScanlineIntensity, elapsedSec);
    if (crtSc !== undefined && crtPass?.uniforms?.scanlineIntensity) {
        crtPass.uniforms['scanlineIntensity'].value = crtSc;
    }

    const crtC = interpolateScalarKeyframes(pp.crtCurvature, elapsedSec);
    if (crtC !== undefined && crtPass?.uniforms?.curvature) {
        crtPass.uniforms['curvature'].value = crtC;
    }

    const saoI = interpolateScalarKeyframes(pp.saoIntensity, elapsedSec);
    if (saoI !== undefined && saoPass?.params) {
        saoPass.params.saoIntensity = saoI;
    }
}

/**
 * @param {ShowcaseAnimationDoc | null | undefined} doc
 * @param {number} elapsedSec
 * @param {Record<string, number>} volBoostOut — cleared then filled with active multipliers
 */
export function applyShowcaseVolumetricKeyframes(doc, elapsedSec, volBoostOut) {
    for (const k of Object.keys(volBoostOut)) {
        delete volBoostOut[k];
    }
    const vol = doc?.volumetricKeyframes;
    if (!vol || typeof vol !== 'object') return;

    for (const key of Object.keys(vol)) {
        const arr = vol[key];
        const v = interpolateScalarKeyframes(arr, elapsedSec);
        if (v !== undefined && Number.isFinite(v) && v > 0) {
            volBoostOut[key] = v;
        }
    }
}

/**
 * @param {ShowcaseAnimationDoc | null | undefined} doc
 * @param {number} elapsedSec
 * @param {Record<string, number>} out
 */
export function applyShowcaseCustomKeyframes(doc, elapsedSec, out) {
    for (const k of Object.keys(out)) {
        delete out[k];
    }
    const c = doc?.customKeyframes;
    if (!c || typeof c !== 'object') return;
    for (const key of Object.keys(c)) {
        const v = interpolateScalarKeyframes(c[key], elapsedSec);
        if (v !== undefined && Number.isFinite(v)) {
            out[key] = v;
        }
    }
}
