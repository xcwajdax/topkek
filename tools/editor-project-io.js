/**
 * Showcase pack import/export (File System Access API + JSON fallbacks).
 */

import { validateShowcaseAnimationDoc, migrateShowcaseAnimationDocToV2 } from '../src/showcase/showcase-animation-schema.js';
import {
    SHOWCASE_PACK_KIND,
    SHOWCASE_PACK_SCHEMA_VERSION,
    validateShowcasePackManifest,
    createShowcasePackManifest
} from '../src/showcase/showcase-pack-schema.js';
import { tryBuildShowcaseDocFromLegacyImportBundle } from '../src/showcase/showcase-animation-adapters.js';

/**
 * @param {FileSystemDirectoryHandle} dirHandle
 * @returns {Promise<{ ok: true, doc: import('../src/showcase/showcase-animation-schema.js').ShowcaseAnimationDoc, audioFile?: File, manifest: import('../src/showcase/showcase-pack-schema.js').ShowcasePackManifest } | { ok: false, error: string }>}
 */
export async function importShowcasePackFromDirectory(dirHandle) {
    let manifestText;
    try {
        const mh = await dirHandle.getFileHandle('showcase-pack.json');
        const mf = await mh.getFile();
        manifestText = await mf.text();
    } catch {
        return { ok: false, error: 'Brak showcase-pack.json w wybranym folderze.' };
    }
    let raw;
    try {
        raw = JSON.parse(manifestText);
    } catch (e) {
        return { ok: false, error: `Manifest JSON: ${e?.message || e}` };
    }
    const vm = validateShowcasePackManifest(raw);
    if (!vm.ok) return { ok: false, error: vm.error };

    let animText;
    try {
        const ah = await dirHandle.getFileHandle(vm.manifest.files.animation);
        const af = await ah.getFile();
        animText = await af.text();
    } catch (e) {
        return { ok: false, error: `Nie można wczytać ${vm.manifest.files.animation}: ${e?.message || e}` };
    }

    const parsed = tryParseProjectFileText(animText);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const doc = migrateShowcaseAnimationDocToV2(parsed.doc);

    let audioFile;
    try {
        const audioName = vm.manifest.files.audio;
        const h = await dirHandle.getFileHandle(audioName);
        audioFile = await h.getFile();
    } catch {
        /* optional */
    }

    return { ok: true, doc, audioFile: audioFile || undefined, manifest: vm.manifest };
}

/**
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {import('../src/showcase/showcase-pack-schema.js').ShowcasePackManifest} manifest
 * @param {import('../src/showcase/showcase-animation-schema.js').ShowcaseAnimationDoc} animationDoc
 * @param {Blob | null} audioBlob
 * @param {string} [audioName]
 */
export async function exportShowcasePackToDirectory(dirHandle, manifest, animationDoc, audioBlob, audioName) {
    const mw = await dirHandle.getFileHandle('showcase-pack.json', { create: true });
    const ms = await mw.createWritable();
    await ms.write(JSON.stringify(manifest, null, 2));
    await ms.close();

    const aw = await dirHandle.getFileHandle(manifest.files.animation, { create: true });
    const as = await aw.createWritable();
    await as.write(JSON.stringify(animationDoc, null, 2));
    await as.close();

    if (audioBlob && audioName && manifest.files.audio) {
        const hw = await dirHandle.getFileHandle(manifest.files.audio, { create: true });
        const hs = await hw.createWritable();
        await hs.write(audioBlob);
        await hs.close();
    }
}

/**
 * @param {string} text
 * @returns {{ ok: true, doc: import('../src/showcase/showcase-animation-schema.js').ShowcaseAnimationDoc } | { ok: false, error: string }}
 */
export function tryParseAnimationDocText(text) {
    let json;
    try {
        json = JSON.parse(text);
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }
    const v = validateShowcaseAnimationDoc(json);
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, doc: migrateShowcaseAnimationDocToV2(v.doc) };
}

/**
 * @param {string} text
 * @returns {{ ok: true, source: 'showcase' | 'legacy', doc: import('../src/showcase/showcase-animation-schema.js').ShowcaseAnimationDoc } | { ok: false, error: string }}
 */
export function tryParseProjectFileText(text) {
    let json;
    try {
        json = JSON.parse(text);
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }

    const v = validateShowcaseAnimationDoc(json);
    if (v.ok) {
        return { ok: true, source: 'showcase', doc: migrateShowcaseAnimationDocToV2(v.doc) };
    }

    const bundle = tryBuildShowcaseDocFromLegacyImportBundle(json);
    if (bundle.handled && bundle.ok) {
        const v2 = validateShowcaseAnimationDoc(bundle.doc);
        if (!v2.ok) return { ok: false, error: v2.error };
        return { ok: true, source: 'legacy', doc: migrateShowcaseAnimationDocToV2(v2.doc) };
    }
    if (bundle.handled && !bundle.ok) return { ok: false, error: bundle.error };

    return {
        ok: false,
        error: `${v.error} — lub pakiet legacy MYSEN (kind + version).`
    };
}

/**
 * @param {'mysen' | 'vajbuj'} experienceId
 * @param {string} animationFile
 * @param {string} audioFile
 */
export function defaultPackManifest(experienceId, animationFile, audioFile) {
    return createShowcasePackManifest(experienceId, {
        animation: animationFile,
        audio: audioFile
    });
}

export function isFileSystemAccessSupported() {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Fallback: trigger download of JSON blob.
 * @param {object} data
 * @param {string} filename
 */
export function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

export { SHOWCASE_PACK_KIND, SHOWCASE_PACK_SCHEMA_VERSION };
