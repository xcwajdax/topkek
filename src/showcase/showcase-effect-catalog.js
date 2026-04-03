/**
 * Authoring catalog for showcase animation editor — presets and allowed track ids.
 * Not executable config; runtime applies only known pass fields in showcase-animation-pass-runtime.js.
 */

/** @type {readonly { id: string, label: string }[]} */
export const SHOWCASE_MATERIAL_PRESETS = Object.freeze([
    { id: 'standard', label: 'Standard (metal/rough)' },
    { id: 'neon', label: 'Neon emissive' },
    { id: 'matte', label: 'Matte (low metal)' }
]);

/** @type {readonly { id: string, label: string }[]} */
export const SHOWCASE_WORD_FX_PRESETS = Object.freeze([
    { id: 'none', label: 'Brak' },
    { id: 'pulseHint', label: 'Pulse (runtime wordPulses)' }
]);

/** Postprocess track ids → applied in MYSEN when passes exist */
export const SHOWCASE_POSTPROCESS_TRACK_IDS = Object.freeze([
    'bloomStrength',
    'bloomRadius',
    'bloomThreshold',
    'crtScanlineIntensity',
    'crtCurvature',
    'saoIntensity'
]);

/** Volumetric / env boost track ids → multiplied in applyVideoIblMaterialBoost */
export const SHOWCASE_VOLUMETRIC_TRACK_IDS = Object.freeze(['mysenBgCubes', 'vajbujBgCubes']);

/** Custom numeric tracks (stored + interpolated; optional future hooks) */
export const SHOWCASE_CUSTOM_TRACK_IDS = Object.freeze(['authoringNote0', 'authoringNote1']);

export function isAllowedMaterialPreset(id) {
    return SHOWCASE_MATERIAL_PRESETS.some((p) => p.id === id);
}

export function isAllowedWordFx(id) {
    return SHOWCASE_WORD_FX_PRESETS.some((p) => p.id === id);
}
