/**
 * Snapshot / restore EffectComposer pass state for showcase enter/exit (single composer).
 * Passes may be null when disabled by performance profile — always guard.
 */

function cloneSaoParams(params) {
    if (!params || typeof params !== 'object') return null;
    const out = {};
    for (const k of Object.keys(params)) {
        out[k] = params[k];
    }
    return out;
}

/**
 * @param {{ bloomPass?: object, saoPass?: object, crtPass?: object }} passes
 */
export function capturePostprocessingSnapshot(passes) {
    const snap = { bloom: null, sao: null, crt: null };
    const bp = passes.bloomPass;
    if (bp) {
        snap.bloom = {
            enabled: bp.enabled,
            strength: bp.strength,
            threshold: bp.threshold,
            radius: bp.radius
        };
    }
    const sp = passes.saoPass;
    if (sp?.params) {
        snap.sao = {
            enabled: sp.enabled,
            params: cloneSaoParams(sp.params)
        };
    }
    const cp = passes.crtPass;
    if (cp?.uniforms) {
        const u = cp.uniforms;
        snap.crt = {
            enabled: cp.enabled,
            curvature: u.curvature?.value?.clone ? u.curvature.value.clone() : null,
            lineWidth: u.lineWidth?.value,
            scanlineIntensity: u.scanlineIntensity?.value,
            scanlineCount: u.scanlineCount?.value,
            vignetteStrength: u.vignetteStrength?.value,
            vignetteRadius: u.vignetteRadius?.value,
            chromaticAberration: u.chromaticAberration?.value,
            flickerAmount: u.flickerAmount?.value
        };
    }
    return snap;
}

/**
 * @param {{ bloomPass?: object, saoPass?: object, crtPass?: object }} passes
 * @param snap from capturePostprocessingSnapshot
 */
export function restorePostprocessingSnapshot(passes, snap) {
    if (!snap) return;
    if (snap.bloom && passes.bloomPass) {
        const bp = passes.bloomPass;
        const b = snap.bloom;
        if (b.enabled !== undefined) bp.enabled = b.enabled;
        if (b.strength !== undefined) bp.strength = b.strength;
        if (b.threshold !== undefined) bp.threshold = b.threshold;
        if (b.radius !== undefined) bp.radius = b.radius;
    }
    if (snap.sao && passes.saoPass?.params && snap.sao.params) {
        const sp = passes.saoPass;
        if (snap.sao.enabled !== undefined) sp.enabled = snap.sao.enabled;
        Object.assign(sp.params, snap.sao.params);
    }
    if (snap.crt && passes.crtPass?.uniforms) {
        const cp = passes.crtPass;
        const c = snap.crt;
        if (c.enabled !== undefined) cp.enabled = c.enabled;
        const u = cp.uniforms;
        if (c.curvature && u.curvature?.value?.copy) u.curvature.value.copy(c.curvature);
        if (c.lineWidth !== undefined && u.lineWidth) u.lineWidth.value = c.lineWidth;
        if (c.scanlineIntensity !== undefined && u.scanlineIntensity) u.scanlineIntensity.value = c.scanlineIntensity;
        if (c.scanlineCount !== undefined && u.scanlineCount) u.scanlineCount.value = c.scanlineCount;
        if (c.vignetteStrength !== undefined && u.vignetteStrength) u.vignetteStrength.value = c.vignetteStrength;
        if (c.vignetteRadius !== undefined && u.vignetteRadius) u.vignetteRadius.value = c.vignetteRadius;
        if (c.chromaticAberration !== undefined && u.chromaticAberration) u.chromaticAberration.value = c.chromaticAberration;
        if (c.flickerAmount !== undefined && u.flickerAmount) u.flickerAmount.value = c.flickerAmount;
    }
}
