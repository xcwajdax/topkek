/**
 * Scalar keyframe interpolation on showcase fragment timeline (seconds).
 */

/**
 * @param {{ t: number, v: number }[]} keyframes
 * @param {number} tSec
 * @returns {number | undefined} undefined = no keyframes / skip apply
 */
export function interpolateScalarKeyframes(keyframes, tSec) {
    if (!keyframes || keyframes.length === 0) return undefined;

    const sorted = keyframes
        .filter((k) => k && typeof k.t === 'number' && Number.isFinite(k.t) && typeof k.v === 'number' && Number.isFinite(k.v))
        .slice()
        .sort((a, b) => a.t - b.t);

    if (sorted.length === 0) return undefined;
    if (tSec <= sorted[0].t) return sorted[0].v;
    if (tSec >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].v;

    let i = 0;
    for (; i < sorted.length - 1; i++) {
        if (sorted[i + 1].t >= tSec) break;
    }
    const a = sorted[i];
    const b = sorted[i + 1];
    const span = b.t - a.t;
    const u = span > 1e-6 ? (tSec - a.t) / span : 0;
    return a.v + (b.v - a.v) * u;
}
