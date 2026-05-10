/**
 * Linear interpolation of transform keyframes on the showcase fragment timeline (seconds).
 */

/**
 * @typedef {import('./showcase-animation-schema.js').ShowcaseTransformKeyframe} ShowcaseTransformKeyframe
 */

/**
 * @param {ShowcaseTransformKeyframe[]} keyframes
 * @param {number} tSec
 * @returns {{ ox: number, oy: number, oz: number, rx: number, ry: number, rz: number, scaleMul: number }}
 */
export function interpolateTransformKeyframes(keyframes, tSec) {
    const def = { ox: 0, oy: 0, oz: 0, rx: 0, ry: 0, rz: 0, scaleMul: 1 };
    if (!keyframes || keyframes.length === 0) return def;

    const sorted = keyframes
        .filter((k) => k && typeof k.t === 'number' && Number.isFinite(k.t))
        .slice()
        .sort((a, b) => a.t - b.t);

    if (sorted.length === 0) return def;
    if (tSec <= sorted[0].t) {
        return keyframeToComponents(sorted[0], def);
    }
    if (tSec >= sorted[sorted.length - 1].t) {
        return keyframeToComponents(sorted[sorted.length - 1], def);
    }

    let i = 0;
    for (; i < sorted.length - 1; i++) {
        if (sorted[i + 1].t >= tSec) break;
    }
    const a = sorted[i];
    const b = sorted[i + 1];
    const span = b.t - a.t;
    const u = span > 1e-6 ? (tSec - a.t) / span : 0;

    const A = keyframeToComponents(a, def);
    const B = keyframeToComponents(b, def);
    return {
        ox: lerp(A.ox, B.ox, u),
        oy: lerp(A.oy, B.oy, u),
        oz: lerp(A.oz, B.oz, u),
        rx: lerp(A.rx, B.rx, u),
        ry: lerp(A.ry, B.ry, u),
        rz: lerp(A.rz, B.rz, u),
        scaleMul: lerp(A.scaleMul, B.scaleMul, u)
    };
}

/**
 * @param {ShowcaseTransformKeyframe} k
 * @param {{ ox: number, oy: number, oz: number, rx: number, ry: number, rz: number, scaleMul: number }} def
 */
function keyframeToComponents(k, def) {
    const p = Array.isArray(k.position) ? k.position : null;
    const r = Array.isArray(k.rotationEuler) ? k.rotationEuler : null;
    const sc = typeof k.scale === 'number' && Number.isFinite(k.scale) && k.scale > 0 ? k.scale : 1;
    return {
        ox: p && p.length >= 1 ? Number(p[0]) : def.ox,
        oy: p && p.length >= 2 ? Number(p[1]) : def.oy,
        oz: p && p.length >= 3 ? Number(p[2]) : def.oz,
        rx: r && r.length >= 1 ? Number(r[0]) : def.rx,
        ry: r && r.length >= 2 ? Number(r[1]) : def.ry,
        rz: r && r.length >= 3 ? Number(r[2]) : def.rz,
        scaleMul: sc
    };
}

function lerp(a, b, u) {
    return a + (b - a) * u;
}
