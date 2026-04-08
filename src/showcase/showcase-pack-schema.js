/**
 * Showcase pack manifest — one folder per animation (editor export / import).
 * Runtime MYSEN still loads animation.json via config; manifest is for tooling.
 */

export const SHOWCASE_PACK_KIND = 'showcasePack';
export const SHOWCASE_PACK_SCHEMA_VERSION = 1;

/**
 * @typedef {object} ShowcasePackManifest
 * @property {typeof SHOWCASE_PACK_KIND} kind
 * @property {number} schemaVersion
 * @property {'mysen' | 'vajbuj' | string} experienceId
 * @property {{ animation: string, audio: string, video?: string }} files
 * @property {string} [exportHintPath]
 */

/**
 * @param {unknown} raw
 * @returns {{ ok: true, manifest: ShowcasePackManifest } | { ok: false, error: string }}
 */
export function validateShowcasePackManifest(raw) {
    if (!raw || typeof raw !== 'object') {
        return { ok: false, error: 'Manifest must be an object' };
    }
    const o = /** @type {Record<string, unknown>} */ (raw);
    if (o.kind !== SHOWCASE_PACK_KIND) {
        return { ok: false, error: `kind must be "${SHOWCASE_PACK_KIND}"` };
    }
    if (o.schemaVersion !== SHOWCASE_PACK_SCHEMA_VERSION) {
        return { ok: false, error: `schemaVersion must be ${SHOWCASE_PACK_SCHEMA_VERSION}` };
    }
    if (typeof o.experienceId !== 'string' || !o.experienceId.length) {
        return { ok: false, error: 'experienceId must be a non-empty string' };
    }
    const files = o.files;
    if (!files || typeof files !== 'object' || Array.isArray(files)) {
        return { ok: false, error: 'files must be an object' };
    }
    const f = /** @type {Record<string, unknown>} */ (files);
    if (typeof f.animation !== 'string' || !f.animation.length) {
        return { ok: false, error: 'files.animation must be a non-empty string' };
    }
    if (typeof f.audio !== 'string' || !f.audio.length) {
        return { ok: false, error: 'files.audio must be a non-empty string' };
    }
    if (f.video != null && typeof f.video !== 'string') {
        return { ok: false, error: 'files.video must be a string when set' };
    }

    const manifest = /** @type {ShowcasePackManifest} */ ({
        kind: SHOWCASE_PACK_KIND,
        schemaVersion: SHOWCASE_PACK_SCHEMA_VERSION,
        experienceId: o.experienceId,
        files: {
            animation: f.animation,
            audio: f.audio,
            ...(typeof f.video === 'string' && f.video.length ? { video: f.video } : {})
        },
        ...(typeof o.exportHintPath === 'string' ? { exportHintPath: o.exportHintPath } : {})
    });
    return { ok: true, manifest };
}

/**
 * @param {string} experienceId
 * @param {{ animation: string, audio: string, video?: string }} files
 * @returns {ShowcasePackManifest}
 */
export function createShowcasePackManifest(experienceId, files) {
    return {
        kind: SHOWCASE_PACK_KIND,
        schemaVersion: SHOWCASE_PACK_SCHEMA_VERSION,
        experienceId,
        files: { ...files }
    };
}
