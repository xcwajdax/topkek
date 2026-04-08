/**
 * Showcase animation editor v2 — modular UI, timeline 60 FPS, pack FSA export.
 * Serve: python -m http.server 8002 → /tools/showcase-animation-editor.html
 */
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import {
    createEmptyShowcaseAnimationDoc,
    validateShowcaseAnimationDoc,
    migrateShowcaseAnimationDocToV2
} from '../src/showcase/showcase-animation-schema.js';
import {
    buildShowcaseAnimationDocFromMysenRuntimeMerge,
    lyricsArrayFromShowcaseDoc
} from '../src/showcase/showcase-animation-adapters.js';
import { interpolateTransformKeyframes } from '../src/showcase/showcase-animation-keyframes.js';
import { createVoxelWord, voxelStyleFromMusicConfig } from '../src/showcase/music-lyric-voxels.js';
import { CONFIG, MYSEN_CONFIG } from '../config.js';
import {
    SHOWCASE_MATERIAL_PRESETS,
    SHOWCASE_WORD_FX_PRESETS,
    SHOWCASE_POSTPROCESS_TRACK_IDS,
    SHOWCASE_VOLUMETRIC_TRACK_IDS,
    SHOWCASE_CUSTOM_TRACK_IDS
} from '../src/showcase/showcase-effect-catalog.js';
import {
    tryParseProjectFileText,
    importShowcasePackFromDirectory,
    exportShowcasePackToDirectory,
    defaultPackManifest,
    isFileSystemAccessSupported,
    downloadJson
} from './editor-project-io.js';
import { createEditorPreviewScene } from './editor-preview-scene.js';
import { attachShowcaseTimeline, SHOWCASE_TIMELINE_FPS } from './editor-timeline.js';
import {
    parseMysenTimestampLyricsFile,
    parseWhisperStyleTimestampTxtToWordEntries
} from '../src/showcase/mysen-timestamp-parse.js';

/**
 * Editor script lives under /tools/; bare paths like "ASSETS/..." would otherwise resolve to /tools/ASSETS/...
 * @param {string} path
 * @returns {string}
 */
function resolveRepoRelativeFetchUrl(path) {
    const p = (path || '').trim();
    if (!p) return p;
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/')) return p;
    return new URL(`../${p.replace(/^\.?\//, '')}`, import.meta.url).href;
}

/** @type {import('../src/showcase/showcase-animation-schema.js').ShowcaseAnimationDoc} */
let doc = structuredClone(createEmptyShowcaseAnimationDoc());

let selectedWordIndex = -1;
let selectedTransformKfIndex = -1;
let selectedScalar = /** @type {{ kind: 'post' | 'vol' | 'custom', idx: number } | null} */ (null);
let selectedBgScalar = /** @type {{ kind: 'opacity' | 'playbackRate', idx: number } | null} */ (null);
let activeLeftTab = 'words';

/** @type {THREE.Object3D | null} */
let editPivot = null;
/** @type {TransformControls | null} */
let transformControls = null;
/** @type {HTMLVideoElement | null} */
let previewBgVideoEl = null;
let previewBgVideoObjectUrl = null;

let audioEl = null;
let audioObjectUrl = null;
let lastAudioFile = null;

const container = document.getElementById('preview-canvas-container');
const wordListEl = document.getElementById('word-list');
const validationEl = document.getElementById('validation-msg');
const timeDisplay = document.getElementById('time-display');

const preview = createEditorPreviewScene(container, {
    getFovDeg: () => doc.cameraPreview?.fovDeg ?? 45,
    showGrid: true
});

let scene;
let camera;
let renderer;
let dummy = new THREE.Object3D();
/** @type {import('three').Font | null} */
let editorFont = null;
const voxelCache = {};
/** @type {Map<string, { mesh: import('three').InstancedMesh; cubes: object[]; inScene: boolean }>} */
const meshByWordId = new Map();

/** @type {ReturnType<typeof attachShowcaseTimeline> | null} */
let timelineCtl = null;

function effectiveStyle() {
    const st = doc.style || {};
    return {
        wordSize: st.wordSize ?? 1.0,
        wordHeight: st.wordHeight ?? 0.12,
        wordThickness: st.wordThickness ?? 2,
        scatterRadius: st.scatterRadius ?? 6,
        defaultWordColor: st.defaultWordColor ?? 0xffffff,
        wordAssemblyDuration: st.wordAssemblyDuration ?? 1.8,
        lyricsStartDelay: st.lyricsStartDelay ?? 0,
        lineSpacing: st.lineSpacing ?? 2.0,
        wordSpacing: st.wordSpacing ?? 0.8,
        lyricsOffsetY: st.lyricsOffsetY ?? 0.5
    };
}

function musicConfigSlice() {
    const s = effectiveStyle();
    return {
        wordSize: s.wordSize,
        wordHeight: s.wordHeight,
        wordThickness: s.wordThickness,
        scatterRadius: s.scatterRadius,
        defaultWordColor: s.defaultWordColor
    };
}

function parseTriple(str, def = [0, 0, 0]) {
    if (!str || typeof str !== 'string') return def.slice();
    const p = str.split(/[,;\s]+/).map(Number).filter((n) => Number.isFinite(n));
    return [p[0] ?? def[0], p[1] ?? def[1], p[2] ?? def[2]];
}

function getFragmentTime() {
    if (!audioEl || !Number.isFinite(audioEl.duration)) return 0;
    const start = Number(doc.timing?.audioStartTime) || 0;
    return Math.max(0, audioEl.currentTime - start);
}

function durationSec() {
    if (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0) return audioEl.duration;
    const d = doc.audio?.durationSec;
    return Number.isFinite(d) && d > 0 ? d : 60;
}

function seekFragmentTime(tFrag) {
    const st = Number(doc.timing?.audioStartTime) || 0;
    const d = durationSec();
    const tt = st + Math.max(0, Math.min(d, tFrag));
    if (audioEl) audioEl.currentTime = tt;
}

function snapFragT(t) {
    return document.getElementById('chk-snap-frame')?.checked
        ? Math.round(t * SHOWCASE_TIMELINE_FPS) / SHOWCASE_TIMELINE_FPS
        : t;
}

/**
 * @param {{ t: number, v: number }[] | undefined} arr
 * @param {number} tSec
 * @param {number} defaultV
 */
function interpolateScalarKeyframes(arr, tSec, defaultV) {
    if (!arr || !arr.length) return defaultV;
    const sorted = arr
        .filter((r) => r && typeof r.t === 'number' && Number.isFinite(r.t) && Number.isFinite(r.v))
        .slice()
        .sort((a, b) => a.t - b.t);
    if (!sorted.length) return defaultV;
    if (tSec <= sorted[0].t) return sorted[0].v;
    if (tSec >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].v;
    let i = 0;
    for (; i < sorted.length - 1; i++) {
        if (sorted[i + 1].t >= tSec) break;
    }
    const a = sorted[i];
    const b = sorted[i + 1];
    const u = b.t - a.t > 1e-6 ? (tSec - a.t) / (b.t - a.t) : 0;
    return a.v + (b.v - a.v) * u;
}

function ensureStyleBackgroundVideo() {
    if (!doc.style || typeof doc.style !== 'object') doc.style = {};
    const st = /** @type {Record<string, unknown>} */ (doc.style);
    if (!st.backgroundVideo || typeof st.backgroundVideo !== 'object') {
        st.backgroundVideo = {
            relativePath: '',
            opacityKeyframes: [],
            playbackRateKeyframes: []
        };
    }
    const bg = /** @type {{ relativePath?: string, opacityKeyframes?: { t: number, v: number }[], playbackRateKeyframes?: { t: number, v: number }[] }} */ (
        st.backgroundVideo
    );
    if (!Array.isArray(bg.opacityKeyframes)) bg.opacityKeyframes = [];
    if (!Array.isArray(bg.playbackRateKeyframes)) bg.playbackRateKeyframes = [];
    return bg;
}

function getInterpolatedTransformComponents(wordId, t) {
    const o = interpolateTransformKeyframes(doc.transformKeyframes?.[wordId] || [], t);
    return { ox: o.ox, oy: o.oy, oz: o.oz, rx: o.rx, ry: o.ry, rz: o.rz, scale: o.scaleMul };
}

/**
 * @param {string} wordId
 * @param {number} tRaw
 * @param {{ px?: number, py?: number, pz?: number, rx?: number, ry?: number, rz?: number, scale?: number }} patch
 */
/**
 * One identity transform keyframe per word at assembly start — rail layout (layoutRailPositions) supplies centered lines.
 * @param {import('../src/showcase/showcase-animation-schema.js').ShowcaseAnimationDoc} docRef
 */
function buildRailIdentityTransformKeyframesForAllWords(docRef) {
    const rows = collectWordRows();
    layoutRailPositions(rows);
    docRef.transformKeyframes = {};
    for (const w of rows) {
        const id = w.showcaseWordId;
        if (!id) continue;
        const t = snapFragT(w.startTime);
        docRef.transformKeyframes[id] = [
            { t, position: [0, 0, 0], rotationEuler: [0, 0, 0], scale: 1 }
        ];
    }
}

function seekToFirstTransformKeyframeForWord(wordEntry) {
    if (!wordEntry || wordEntry.lineBreak || !wordEntry.id) return;
    const kfs = doc.transformKeyframes?.[wordEntry.id];
    if (!kfs?.length) return;
    let bestIdx = 0;
    let bestT = kfs[0].t;
    for (let idx = 1; idx < kfs.length; idx++) {
        if (kfs[idx].t < bestT - 1e-9) {
            bestT = kfs[idx].t;
            bestIdx = idx;
        }
    }
    seekFragmentTime(bestT);
    selectedTransformKfIndex = bestIdx;
}

function upsertTransformKeyframeAtT(wordId, tRaw, patch) {
    const t = snapFragT(tRaw);
    const c = getInterpolatedTransformComponents(wordId, t);
    const pos = [
        patch.px !== undefined ? patch.px : c.ox,
        patch.py !== undefined ? patch.py : c.oy,
        patch.pz !== undefined ? patch.pz : c.oz
    ];
    const rot = [
        patch.rx !== undefined ? patch.rx : c.rx,
        patch.ry !== undefined ? patch.ry : c.ry,
        patch.rz !== undefined ? patch.rz : c.rz
    ];
    const scale = patch.scale !== undefined ? patch.scale : c.scale;
    if (!doc.transformKeyframes) doc.transformKeyframes = {};
    if (!doc.transformKeyframes[wordId]) doc.transformKeyframes[wordId] = [];
    const kfs = doc.transformKeyframes[wordId];
    const eps = 1e-4;
    let idx = kfs.findIndex((k) => Math.abs(k.t - t) < eps);
    const entry = { t, position: pos, rotationEuler: rot, scale };
    if (idx >= 0) kfs[idx] = entry;
    else kfs.push(entry);
    kfs.sort((a, b) => a.t - b.t);
    selectedTransformKfIndex = kfs.findIndex((k) => Math.abs(k.t - t) < eps);
}

function getSelectedWordRow() {
    const w = getSelectedWordEntry();
    if (!w || w.lineBreak || !w.id) return null;
    const rows = collectWordRows();
    layoutRailPositions(rows);
    return rows.find((r) => r.showcaseWordId === w.id) ?? null;
}

function commitEditPivotToKeyframe() {
    const w = getSelectedWordEntry();
    const row = getSelectedWordRow();
    if (!w?.id || !row || !editPivot) return;
    const tFrag = getFragmentTime();
    const pose = computeWordPreviewPose(row, tFrag);
    if (!pose) return;
    upsertTransformKeyframeAtT(w.id, tFrag, {
        px: editPivot.position.x - pose.basePx,
        py: editPivot.position.y - pose.basePy,
        pz: editPivot.position.z - pose.basePz,
        rx: editPivot.rotation.x,
        ry: editPivot.rotation.y,
        rz: editPivot.rotation.z
    });
    renderKeyframeList();
    syncKfEditorFromSelection();
    timelineCtl?.redraw();
}

function syncTransformGizmo() {
    if (!transformControls || !editPivot || !scene) return;
    const w = getSelectedWordEntry();
    const row = getSelectedWordRow();
    if (!w || w.lineBreak || !w.id) {
        transformControls.detach();
        return;
    }
    const tFrag = getFragmentTime();
    const pose = computeWordPreviewPose(row, tFrag);
    if (!pose) {
        transformControls.detach();
        return;
    }
    if (!transformControls.dragging) {
        editPivot.position.set(pose.px, pose.py, pose.pz);
        editPivot.rotation.set(pose.krX, pose.krY, pose.krZ);
        editPivot.scale.set(1, 1, 1);
    }
    if (transformControls.object !== editPivot) {
        transformControls.attach(editPivot);
    }
}

function updatePreviewBackgroundVideo(tFrag) {
    const vid = previewBgVideoEl;
    if (!vid) return;
    const bg = ensureStyleBackgroundVideo();
    const op = interpolateScalarKeyframes(bg.opacityKeyframes, tFrag, 1);
    const pr = interpolateScalarKeyframes(bg.playbackRateKeyframes, tFrag, 1);
    vid.style.opacity = String(Math.min(1, Math.max(0, op)));
    const rate = Math.max(0.05, Math.min(4, pr));
    if (Number.isFinite(rate)) vid.playbackRate = rate;
    if (audioEl && vid.src && Number.isFinite(audioEl.currentTime)) {
        const diff = Math.abs(vid.currentTime - audioEl.currentTime);
        if (diff > 0.15 || vid.paused) {
            try {
                vid.currentTime = audioEl.currentTime;
            } catch {
                /* ignore */
            }
        }
        if (!audioEl.paused && vid.paused) {
            vid.play().catch(() => {});
        }
        if (audioEl.paused && !vid.paused) vid.pause();
    }
}

function renderBgVideoKeyframeLists() {
    const bg = ensureStyleBackgroundVideo();
    const renderList = (kind, listId) => {
        const ul = document.getElementById(listId);
        if (!ul) return;
        ul.innerHTML = '';
        const arr = kind === 'opacity' ? bg.opacityKeyframes : bg.playbackRateKeyframes;
        arr.forEach((row, idx) => {
            const li = document.createElement('li');
            li.textContent = `t=${row.t.toFixed(3)} v=${row.v}`;
            if (
                selectedBgScalar?.kind === kind &&
                selectedBgScalar.idx === idx
            ) {
                li.classList.add('selected');
            }
            li.addEventListener('click', () => {
                selectedBgScalar = { kind, idx };
                if (kind === 'opacity') {
                    document.getElementById('bg-op-t').value = String(row.t);
                    document.getElementById('bg-op-v').value = String(row.v);
                } else {
                    document.getElementById('bg-pr-t').value = String(row.t);
                    document.getElementById('bg-pr-v').value = String(row.v);
                }
                renderBgVideoKeyframeLists();
            });
            ul.appendChild(li);
        });
    };
    renderList('opacity', 'bg-op-kf-list');
    renderList('playbackRate', 'bg-pr-kf-list');
}

function readBgVideoFromPanels() {
    const pi = document.getElementById('bg-video-path');
    if (pi) ensureStyleBackgroundVideo().relativePath = pi.value.trim();
}

function cloneDocForJsonExport() {
    const out = structuredClone(doc);
    const st = out.style;
    if (st && typeof st === 'object' && st.backgroundVideo && typeof st.backgroundVideo === 'object') {
        const bg = { ...st.backgroundVideo };
        delete bg.objectUrl;
        st.backgroundVideo = bg;
    }
    return out;
}

function collectWordRows() {
    const lyrics = lyricsArrayFromShowcaseDoc(doc);
    const rows = [];
    let lineIdx = 0;
    let wInLine = 0;
    for (let i = 0; i < lyrics.length; i++) {
        const item = lyrics[i];
        if (item.lineBreak) {
            lineIdx++;
            wInLine = 0;
        } else {
            rows.push({ ...item, lineIndex: lineIdx, wordInLine: wInLine++ });
        }
    }
    const s = effectiveStyle();
    const delay = s.lyricsStartDelay;
    const startT = doc.timing?.audioStartTime ?? 0;
    return rows.map((w) => {
        const at = Number.isFinite(w.at) ? w.at : 0;
        const assembledAt = at + delay;
        const asm =
            Number.isFinite(w.assemblyDurationSec) && w.assemblyDurationSec > 0
                ? w.assemblyDurationSec
                : s.wordAssemblyDuration;
        const startTime = Math.max(0, assembledAt - asm);
        return {
            ...w,
            startTime,
            assembledTime: assembledAt,
            atSourceSec: Number.isFinite(w.atSourceSec) ? w.atSourceSec : startT + at
        };
    });
}

function getEditorSpreadDurSec() {
    const v = doc.style?.spread?.durationSec;
    if (Number.isFinite(v) && v > 0) return v;
    return 1.35;
}

function editorApproxMediaSecFromFragment(tFrag) {
    return (Number(doc.timing?.audioStartTime) || 0) + tFrag;
}

function editorPreviewSpawn(w, railX, railY, railZ) {
    let h = 0;
    const s = `${w.text}|${w.at}|${w.showcaseWordId || ''}`;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    const u1 = ((h >>> 0) % 1000) / 1000;
    const u2 = ((Math.imul(h, 17) >>> 0) % 1000) / 1000;
    return {
        x: railX + 12 + u1 * 16,
        y: railY + 4 + u2 * 8,
        z: railZ + (u1 - 0.5) * 6
    };
}

function wordFlyModeFromDocWord(w) {
    if (!w || w.lineBreak) return 'default';
    if (w.groupedLine === true) return 'rail';
    if (
        w.spawn &&
        typeof w.spawn === 'object' &&
        [w.spawn.x, w.spawn.y, w.spawn.z].every((n) => Number.isFinite(n))
    ) {
        return 'fixed';
    }
    return 'default';
}

function layoutRailPositions(rows) {
    const eff = musicConfigSlice();
    const vStyle = voxelStyleFromMusicConfig(eff);
    const byLine = new Map();
    for (const w of rows) {
        if (!byLine.has(w.lineIndex)) byLine.set(w.lineIndex, []);
        byLine.get(w.lineIndex).push(w);
    }
    for (const [, lineWords] of byLine) {
        let totalW = 0;
        for (const w of lineWords) {
            if (!w.width) {
                if (editorFont) {
                    const vw = createVoxelWord(w, editorFont, voxelCache, vStyle);
                    w.width = vw.width;
                } else {
                    const len = String(w.text ?? '').length || 1;
                    w.width = Math.max(0.35, len * eff.wordSize * 0.52);
                }
            }
            totalW += w.width + eff.wordSpacing;
        }
        totalW -= eff.wordSpacing;
        let lineX = -totalW / 2;
        for (const w of lineWords) {
            w.posX = lineX + (w.width || 1) / 2 + (w.offsetX || 0);
            w.posY = eff.lyricsOffsetY + w.lineIndex * eff.lineSpacing + (w.offsetY || 0);
            w.posZ = w.offsetZ || 0;
            lineX += (w.width || 1) + eff.wordSpacing;
        }
    }
}

function ensureWordMeshes(rows) {
    if (!editorFont) return;
    const vStyle = voxelStyleFromMusicConfig(musicConfigSlice());
    const seen = new Set();
    for (const w of rows) {
        const id = w.showcaseWordId;
        if (!id) continue;
        seen.add(id);
        if (meshByWordId.has(id)) continue;
        const vw = createVoxelWord(w, editorFont, voxelCache, vStyle);
        scene.add(vw.mesh);
        meshByWordId.set(id, { mesh: vw.mesh, cubes: vw.cubes, inScene: true });
        vw.mesh.visible = false;
    }
    for (const [id, rec] of meshByWordId) {
        if (!seen.has(id)) {
            scene.remove(rec.mesh);
            rec.mesh.geometry?.dispose();
            rec.mesh.material?.dispose();
            meshByWordId.delete(id);
        }
    }
}

function applyKeyframesToWord(w, tFrag) {
    const id = w.showcaseWordId;
    const kfs = id && doc.transformKeyframes?.[id];
    const o = interpolateTransformKeyframes(kfs || [], tFrag);
    return { kx: o.ox, ky: o.oy, kz: o.oz, krX: o.rx, krY: o.ry, krZ: o.rz, kScale: o.scaleMul };
}

/**
 * @param {object} w — row from collectWordRows (after layoutRailPositions)
 * @param {number} tFrag
 * @returns {null | {
 *   basePx: number, basePy: number, basePz: number,
 *   px: number, py: number, pz: number,
 *   krX: number, krY: number, krZ: number,
 *   wordScaleMul: number, assembling: boolean, progress: number,
 *   inSpread: boolean, spreadU: number, amp: number, cubeProgress: number,
 *   hexEnd: number
 * }}
 */
function computeWordPreviewPose(w, tFrag) {
    const s = effectiveStyle();
    const firstTs = Number.isFinite(doc.timing?.firstTimestampLineIndex)
        ? doc.timing.firstTimestampLineIndex
        : 99999;
    const audioStart = Number(doc.timing?.audioStartTime) || 0;
    const spreadDur = getEditorSpreadDurSec();
    const randomFlyEnabled = doc.style?.randomFly?.enabled === true;

    const vf = w.visibleFromFragSec;
    const vt = w.visibleToFragSec;
    if (Number.isFinite(vf) || Number.isFinite(vt)) {
        const inWin =
            (!Number.isFinite(vf) || tFrag >= vf) && (!Number.isFinite(vt) || tFrag <= vt);
        if (!inWin) return null;
    }

    if (tFrag < w.startTime) return null;

    const { kx, ky, kz, krX, krY, krZ, kScale } = applyKeyframesToWord(w, tFrag);
    const baseScale = w.scale > 0 ? w.scale : 1;
    const wordScaleMul = baseScale * (kScale > 0 ? kScale : 1);

    const asm =
        Number.isFinite(w.assemblyDurationSec) && w.assemblyDurationSec > 0
            ? w.assemblyDurationSec
            : s.wordAssemblyDuration;

    const isTsWord = w.lineIndex >= firstTs;
    const groupedTsLine = w.mysenGroupedLine === true;
    const hasFixedSpawn =
        Number.isFinite(w.spawnX) && Number.isFinite(w.spawnY) && Number.isFinite(w.spawnZ);
    const useFly = isTsWord && !groupedTsLine && (hasFixedSpawn || randomFlyEnabled);

    const railX = w.posX || 0;
    const railY = w.posY || 0;
    const railZ = w.posZ || 0;
    let spawnPt;
    if (hasFixedSpawn) {
        spawnPt = { x: w.spawnX, y: w.spawnY, z: w.spawnZ };
    } else if (useFly) {
        spawnPt = editorPreviewSpawn(w, railX, railY, railZ);
    } else {
        spawnPt = { x: railX, y: railY, z: railZ };
    }

    const assembling = tFrag < w.assembledTime;
    const assemblyElapsed = tFrag - w.startTime;
    const progress = Math.min(1, assemblyElapsed / asm);

    let basePx;
    let basePy;
    let basePz;
    if (assembling && useFly) {
        basePx = THREE.MathUtils.lerp(spawnPt.x, railX, progress);
        basePy = THREE.MathUtils.lerp(spawnPt.y, railY, progress);
        basePz = THREE.MathUtils.lerp(spawnPt.z, railZ, progress);
    } else if (!assembling) {
        basePx = railX;
        basePy = railY;
        basePz = railZ;
    } else {
        basePx = railX;
        basePy = railY;
        basePz = railZ;
    }

    const px = basePx + kx;
    const py = basePy + ky;
    const pz = basePz + kz;

    let spreadU = 0;
    let inSpread = false;
    if (!assembling && isTsWord && spreadDur > 0) {
        const vanishFrag = Number.isFinite(w.lineVanishAtSourceSec)
            ? w.lineVanishAtSourceSec - audioStart
            : null;
        const spreadStart = Number.isFinite(vanishFrag)
            ? Math.max(w.assembledTime, vanishFrag)
            : w.assembledTime;
        if (tFrag >= spreadStart) {
            inSpread = true;
            spreadU = Math.min(1, (tFrag - spreadStart) / spreadDur);
        }
    }

    if (inSpread && spreadU >= 1) return null;

    const hexEnd = typeof w.color === 'number' ? w.color : 0xffffff;
    const cubeProgress = assembling ? progress : 1;
    const amp =
        inSpread && spreadDur > 0
            ? (s.scatterRadius ?? 6) * spreadU * (1 - spreadU + 0.2)
            : 0;

    return {
        basePx,
        basePy,
        basePz,
        px,
        py,
        pz,
        krX,
        krY,
        krZ,
        wordScaleMul,
        assembling,
        progress,
        inSpread,
        spreadU,
        amp,
        cubeProgress,
        hexEnd
    };
}

function updatePreviewAtTime(tFrag) {
    if (!editorFont || !scene) return;
    const rows = collectWordRows();
    layoutRailPositions(rows);
    ensureWordMeshes(rows);

    for (const w of rows) {
        const id = w.showcaseWordId;
        const rec = id ? meshByWordId.get(id) : null;
        if (!rec) continue;

        const pose = computeWordPreviewPose(w, tFrag);
        if (!pose) {
            rec.mesh.visible = false;
            continue;
        }

        const {
            px,
            py,
            pz,
            krX,
            krY,
            krZ,
            wordScaleMul,
            assembling,
            progress,
            inSpread,
            spreadU,
            amp,
            cubeProgress,
            hexEnd
        } = pose;

        rec.mesh.visible = true;

        const asmStart = new THREE.Color(0x050505);
        const asmEnd = new THREE.Color(hexEnd);
        const tempColor = new THREE.Color();

        rec.cubes.forEach((cube, i) => {
            let effectiveProgress = 0;
            if (cubeProgress > cube.delay) {
                effectiveProgress = (cubeProgress - cube.delay) / (1 - cube.delay);
            }
            const eased =
                effectiveProgress >= 1
                    ? 1
                    : effectiveProgress <= 0
                      ? 0
                      : 1 - Math.pow(2, -10 * effectiveProgress);

            cube.currentPos.lerpVectors(cube.scatterPos, cube.targetPos, eased);
            cube.currentScale = eased;

            if (effectiveProgress >= 1) tempColor.copy(asmEnd);
            else tempColor.copy(asmStart);
            rec.mesh.setColorAt(i, tempColor);

            const sx = cube.targetPos.x !== 0 ? Math.sign(cube.targetPos.x) : i % 2 === 0 ? 1 : -1;
            const sy = cube.targetPos.y !== 0 ? Math.sign(cube.targetPos.y) : i % 3 === 0 ? 1 : -1;
            const ox = inSpread ? sx * amp * 0.2 : 0;
            const oy = inSpread ? sy * amp * 0.2 : 0;
            const oz = 0;
            const scaleMul = inSpread
                ? Math.max(0, 1 - spreadU) * wordScaleMul
                : cube.currentScale * wordScaleMul;

            dummy.position.set(
                cube.currentPos.x + px + ox,
                cube.currentPos.y + py + oy,
                cube.currentPos.z + pz + oz
            );
            dummy.scale.setScalar(scaleMul);
            dummy.rotation.set(krX, krY, krZ);
            dummy.updateMatrix();
            rec.mesh.setMatrixAt(i, dummy.matrix);
        });
        rec.mesh.instanceMatrix.needsUpdate = true;
        if (rec.mesh.instanceColor) rec.mesh.instanceColor.needsUpdate = true;
    }
}

function animate() {
    requestAnimationFrame(animate);
    const t = getFragmentTime();
    const fr = Math.round(t * SHOWCASE_TIMELINE_FPS);
    timeDisplay.textContent = `t=${t.toFixed(2)}s · ${fr}f / frag`;
    timelineCtl?.redraw();
    preview.syncFovFromDoc();
    updatePreviewAtTime(t);
    updatePreviewBackgroundVideo(t);
    syncTransformGizmo();
    preview.renderFrame();
}

function getSelectedWordEntry() {
    if (selectedWordIndex < 0) return null;
    return doc.words[selectedWordIndex] ?? null;
}

function renderWordList() {
    wordListEl.innerHTML = '';
    doc.words.forEach((w, i) => {
        const li = document.createElement('li');
        if (w.lineBreak) {
            li.textContent = '— line break —';
            li.classList.add('linebreak');
        } else {
            li.textContent = `${w.id || '?'}: "${w.text}" @ ${w.at ?? 0}s`;
        }
        if (i === selectedWordIndex) li.classList.add('selected');
        li.addEventListener('click', () => {
            selectedWordIndex = i;
            selectedTransformKfIndex = -1;
            const sel = doc.words[i];
            seekToFirstTransformKeyframeForWord(sel);
            renderWordList();
            syncPropsPanel();
            renderKeyframeList();
            syncKfEditorFromSelection();
            timelineCtl?.redraw();
        });
        wordListEl.appendChild(li);
    });
}

function syncBgVideoPanel() {
    const bg = ensureStyleBackgroundVideo();
    const pathInp = document.getElementById('bg-video-path');
    if (pathInp) pathInp.value = bg.relativePath || '';
    renderBgVideoKeyframeLists();
}

function reloadPreviewBackgroundVideo() {
    const vid = previewBgVideoEl;
    if (!vid) return;
    if (previewBgVideoObjectUrl) {
        vid.src = previewBgVideoObjectUrl;
        return;
    }
    const bg = ensureStyleBackgroundVideo();
    const p = (bg.relativePath || '').trim();
    if (!p) {
        vid.removeAttribute('src');
        return;
    }
    vid.src = resolveRepoRelativeFetchUrl(p);
}

function syncPropsPanel() {
    const w = getSelectedWordEntry();
    const panel = document.getElementById('prop-panel');
    const ids = ['prop-id', 'prop-text', 'prop-at', 'prop-color', 'prop-scale'];
    const disableWordControls = () => {
        panel?.querySelectorAll('input, button, select').forEach((el) => {
            if (
                el.id?.startsWith('prop-') ||
                el.id?.startsWith('kf-') ||
                el.id === 'btn-add-kf' ||
                el.id === 'btn-del-kf' ||
                el.id === 'gizmo-mode' ||
                el.id === 'gizmo-space' ||
                el.id?.startsWith('btn-kf-')
            ) {
                el.disabled = true;
            }
        });
    };
    if (!w || w.lineBreak) {
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        disableWordControls();
        syncBgVideoPanel();
        return;
    }
    panel?.querySelectorAll('input, button, select').forEach((el) => {
        el.disabled = false;
    });
    document.getElementById('prop-id').value = w.id || '';
    document.getElementById('prop-text').value = w.text || '';
    document.getElementById('prop-at').value = String(w.at ?? 0);
    const c = typeof w.color === 'number' ? w.color : 0xffffff;
    document.getElementById('prop-color').value = c.toString(16).padStart(6, '0');
    document.getElementById('prop-scale').value = String(w.scale ?? 1);

    document.getElementById('prop-word-size').value =
        Number.isFinite(w.wordSize) ? String(w.wordSize) : '';
    document.getElementById('prop-word-height').value =
        Number.isFinite(w.wordHeight) ? String(w.wordHeight) : '';
    document.getElementById('prop-word-thickness').value =
        Number.isFinite(w.wordThickness) ? String(w.wordThickness) : '';
    document.getElementById('prop-scatter').value =
        Number.isFinite(w.scatterRadius) ? String(w.scatterRadius) : '';
    document.getElementById('prop-material').value = w.materialPresetId || 'standard';
    document.getElementById('prop-word-fx').value = w.wordFxId || 'none';
    document.getElementById('prop-vis-from').value =
        Number.isFinite(w.visibleFromFragSec) ? String(w.visibleFromFragSec) : '';
    document.getElementById('prop-vis-to').value =
        Number.isFinite(w.visibleToFragSec) ? String(w.visibleToFragSec) : '';

    const mode = wordFlyModeFromDocWord(w);
    const flySel = document.getElementById('prop-fly-mode');
    if (flySel) flySel.value = mode;
    const sp = w.spawn;
    const spawnInp = document.getElementById('prop-spawn');
    if (spawnInp) {
        spawnInp.disabled = mode !== 'fixed';
        if (mode === 'fixed' && sp && [sp.x, sp.y, sp.z].every((n) => Number.isFinite(n))) {
            spawnInp.value = `${sp.x}, ${sp.y}, ${sp.z}`;
        } else if (mode === 'fixed') {
            spawnInp.value = spawnInp.value || '20, 6, 0';
        } else {
            spawnInp.value = '';
        }
    }
    const vanInp = document.getElementById('prop-vanish-media');
    if (vanInp) {
        vanInp.value = Number.isFinite(w.vanishAtMediaSec) ? String(w.vanishAtMediaSec) : '';
    }
    const adInp = document.getElementById('prop-assembly-dur');
    if (adInp) {
        adInp.value =
            Number.isFinite(w.assemblyDurationSec) && w.assemblyDurationSec > 0
                ? String(w.assemblyDurationSec)
                : '';
    }
    const perInp = document.getElementById('prop-persistent');
    if (perInp) {
        perInp.checked = !!(w.persistentOnScreen === true || w.mysenPersistentOnScreen === true);
    }
    syncKfEditorFromSelection();
    syncBgVideoPanel();
}

function syncKfEditorFromSelection() {
    const w = getSelectedWordEntry();
    const kfs = w && !w.lineBreak && w.id ? doc.transformKeyframes?.[w.id] || [] : [];
    const kf = selectedTransformKfIndex >= 0 ? kfs[selectedTransformKfIndex] : null;
    const setNum = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = String(v);
    };
    if (!w || w.lineBreak || !w.id) {
        ['kf-px', 'kf-py', 'kf-pz', 'kf-rx', 'kf-ry', 'kf-rz', 'kf-scale'].forEach((id) => setNum(id, id === 'kf-scale' ? 1 : 0));
        return;
    }
    let p;
    let r;
    let sc;
    if (kf) {
        p = kf.position || [0, 0, 0];
        r = kf.rotationEuler || [0, 0, 0];
        sc = kf.scale ?? 1;
    } else {
        const t = getFragmentTime();
        const c = getInterpolatedTransformComponents(w.id, t);
        p = [c.ox, c.oy, c.oz];
        r = [c.rx, c.ry, c.rz];
        sc = c.scale;
    }
    setNum('kf-px', p[0] ?? 0);
    setNum('kf-py', p[1] ?? 0);
    setNum('kf-pz', p[2] ?? 0);
    setNum('kf-rx', r[0] ?? 0);
    setNum('kf-ry', r[1] ?? 0);
    setNum('kf-rz', r[2] ?? 0);
    setNum('kf-scale', sc);
}

function renderKeyframeList() {
    const ul = document.getElementById('kf-list');
    ul.innerHTML = '';
    const w = getSelectedWordEntry();
    if (!w || w.lineBreak || !w.id) return;
    const kfs = doc.transformKeyframes?.[w.id] || [];
    kfs.forEach((kf, idx) => {
        const li = document.createElement('li');
        li.textContent = `t=${kf.t.toFixed(3)}`;
        if (idx === selectedTransformKfIndex) li.classList.add('selected');
        li.addEventListener('click', () => {
            selectedTransformKfIndex = idx;
            seekFragmentTime(kf.t);
            renderKeyframeList();
            syncKfEditorFromSelection();
            timelineCtl?.redraw();
        });
        ul.appendChild(li);
    });
}

function readPropsFromPanel() {
    const w = getSelectedWordEntry();
    if (!w || w.lineBreak) return;
    w.id = document.getElementById('prop-id').value.trim() || w.id;
    w.text = document.getElementById('prop-text').value || w.text;
    w.at = parseFloat(document.getElementById('prop-at').value) || 0;
    const hex = document.getElementById('prop-color').value.replace(/^#/, '');
    const n = parseInt(hex, 16);
    w.color = Number.isFinite(n) ? n : 0xffffff;
    w.scale = parseFloat(document.getElementById('prop-scale').value) || 1;

    const ws = document.getElementById('prop-word-size').value.trim();
    if (ws === '') delete w.wordSize;
    else {
        const x = parseFloat(ws);
        if (Number.isFinite(x) && x > 0) w.wordSize = x;
    }
    const wh = document.getElementById('prop-word-height').value.trim();
    if (wh === '') delete w.wordHeight;
    else {
        const x = parseFloat(wh);
        if (Number.isFinite(x) && x > 0) w.wordHeight = x;
    }
    const wt = document.getElementById('prop-word-thickness').value.trim();
    if (wt === '') delete w.wordThickness;
    else {
        const x = parseInt(wt, 10);
        if (Number.isFinite(x) && x > 0) w.wordThickness = x;
    }
    const sc = document.getElementById('prop-scatter').value.trim();
    if (sc === '') delete w.scatterRadius;
    else {
        const x = parseFloat(sc);
        if (Number.isFinite(x) && x > 0) w.scatterRadius = x;
    }
    const mat = document.getElementById('prop-material').value;
    w.materialPresetId = mat || 'standard';
    const fx = document.getElementById('prop-word-fx').value;
    if (fx === 'none') delete w.wordFxId;
    else w.wordFxId = fx;

    const vf = document.getElementById('prop-vis-from').value.trim();
    if (vf === '') delete w.visibleFromFragSec;
    else {
        const x = parseFloat(vf);
        if (Number.isFinite(x)) w.visibleFromFragSec = x;
    }
    const vt = document.getElementById('prop-vis-to').value.trim();
    if (vt === '') delete w.visibleToFragSec;
    else {
        const x = parseFloat(vt);
        if (Number.isFinite(x)) w.visibleToFragSec = x;
    }

    delete w.groupedLine;
    delete w.spawn;
    delete w.mysenPersistentOnScreen;
    const mode = document.getElementById('prop-fly-mode')?.value || 'default';
    if (mode === 'rail') {
        w.groupedLine = true;
    } else if (mode === 'fixed') {
        const sp = parseTriple(document.getElementById('prop-spawn')?.value || '0,0,0');
        w.spawn = { x: sp[0], y: sp[1], z: sp[2] };
    }

    const per = document.getElementById('prop-persistent')?.checked;
    if (per) w.persistentOnScreen = true;
    else delete w.persistentOnScreen;

    const vanStr = document.getElementById('prop-vanish-media')?.value?.trim() ?? '';
    if (vanStr === '') delete w.vanishAtMediaSec;
    else {
        const v = parseFloat(vanStr);
        if (Number.isFinite(v)) w.vanishAtMediaSec = v;
        else delete w.vanishAtMediaSec;
    }

    const adStr = document.getElementById('prop-assembly-dur')?.value?.trim() ?? '';
    if (adStr === '') delete w.assemblyDurationSec;
    else {
        const a = parseFloat(adStr);
        if (Number.isFinite(a) && a > 0) w.assemblyDurationSec = a;
        else delete w.assemblyDurationSec;
    }
}

function syncTimingInputs() {
    document.getElementById('inp-audio-start').value = String(doc.timing?.audioStartTime ?? 0);
    document.getElementById('inp-first-ts').value = String(doc.timing?.firstTimestampLineIndex ?? 99999);
}

function applyTimingFromInputs() {
    if (!doc.timing) doc.timing = {};
    doc.timing.audioStartTime = parseFloat(document.getElementById('inp-audio-start').value) || 0;
    doc.timing.firstTimestampLineIndex = parseInt(document.getElementById('inp-first-ts').value, 10) || 99999;
}

function applyLoadedDoc(newDoc) {
    doc = migrateShowcaseAnimationDocToV2(newDoc);
    meshByWordId.clear();
    selectedWordIndex = doc.words.findIndex((x) => !x.lineBreak);
    if (selectedWordIndex < 0) selectedWordIndex = 0;
    selectedTransformKfIndex = -1;
    if (previewBgVideoObjectUrl) {
        URL.revokeObjectURL(previewBgVideoObjectUrl);
        previewBgVideoObjectUrl = null;
    }
    ensureStyleBackgroundVideo();
    syncTimingInputs();
    renderWordList();
    syncPropsPanel();
    renderKeyframeList();
    renderScalarLists();
    timelineCtl?.refit();
    timelineCtl?.redraw();
    reloadPreviewBackgroundVideo();
}

function initialSelectedWordIndexAfterLoad() {
    for (let i = 0; i < doc.words.length; i++) {
        if (!doc.words[i].lineBreak) return i;
    }
    return doc.words.length > 0 ? 0 : -1;
}

function fillCatalogSelects() {
    const mat = document.getElementById('prop-material');
    mat.innerHTML = '';
    SHOWCASE_MATERIAL_PRESETS.forEach((p) => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.label;
        mat.appendChild(o);
    });
    const fx = document.getElementById('prop-word-fx');
    fx.innerHTML = '';
    SHOWCASE_WORD_FX_PRESETS.forEach((p) => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.label;
        fx.appendChild(o);
    });
    const fillIds = (sel, ids) => {
        sel.innerHTML = '';
        ids.forEach((id) => {
            const o = document.createElement('option');
            o.value = id;
            o.textContent = id;
            sel.appendChild(o);
        });
    };
    fillIds(document.getElementById('post-track-id'), [...SHOWCASE_POSTPROCESS_TRACK_IDS]);
    fillIds(document.getElementById('vol-track-id'), [...SHOWCASE_VOLUMETRIC_TRACK_IDS]);
    fillIds(document.getElementById('custom-track-id'), [...SHOWCASE_CUSTOM_TRACK_IDS]);
}

function getScalarBucket(kind) {
    if (kind === 'post') return doc.postprocessKeyframes || (doc.postprocessKeyframes = {});
    if (kind === 'vol') return doc.volumetricKeyframes || (doc.volumetricKeyframes = {});
    return doc.customKeyframes || (doc.customKeyframes = {});
}

function currentScalarTrackId(kind) {
    if (kind === 'post') return document.getElementById('post-track-id').value;
    if (kind === 'vol') return document.getElementById('vol-track-id').value;
    return document.getElementById('custom-track-id').value;
}

function renderScalarLists() {
    const render = (kind, listId) => {
        const ul = document.getElementById(listId);
        ul.innerHTML = '';
        const tid = currentScalarTrackId(kind);
        const bucket = getScalarBucket(kind);
        const arr = bucket[tid] || [];
        arr.forEach((row, idx) => {
            const li = document.createElement('li');
            li.textContent = `t=${row.t.toFixed(3)} v=${row.v}`;
            if (selectedScalar?.kind === kind && selectedScalar.idx === idx) li.classList.add('selected');
            li.addEventListener('click', () => {
                selectedScalar = { kind, idx };
                document.getElementById('scalar-kf-t').value = String(row.t);
                document.getElementById('scalar-kf-v').value = String(row.v);
                renderScalarLists();
            });
            ul.appendChild(li);
        });
    };
    render('post', 'post-kf-list');
    render('vol', 'vol-kf-list');
    render('custom', 'custom-kf-list');
}

function addScalarKeyframe(kind) {
    const tid = currentScalarTrackId(kind);
    const bucket = getScalarBucket(kind);
    if (!bucket[tid]) bucket[tid] = [];
    const tFrag = getFragmentTime();
    const snap = document.getElementById('chk-snap-frame')?.checked
        ? Math.round(tFrag * SHOWCASE_TIMELINE_FPS) / SHOWCASE_TIMELINE_FPS
        : tFrag;
    let v = parseFloat(document.getElementById('scalar-kf-v').value);
    if (!Number.isFinite(v)) v = 1;
    bucket[tid].push({ t: snap, v });
    bucket[tid].sort((a, b) => a.t - b.t);
    renderScalarLists();
}

function applyScalarKeyframeEdit() {
    if (!selectedScalar) return;
    const tid = currentScalarTrackId(selectedScalar.kind);
    const bucket = getScalarBucket(selectedScalar.kind);
    const arr = bucket[tid];
    if (!arr || !arr[selectedScalar.idx]) return;
    const t = parseFloat(document.getElementById('scalar-kf-t').value);
    const v = parseFloat(document.getElementById('scalar-kf-v').value);
    if (!Number.isFinite(t) || !Number.isFinite(v)) return;
    arr[selectedScalar.idx] = { t, v };
    arr.sort((a, b) => a.t - b.t);
    renderScalarLists();
}

function deleteScalarKeyframe() {
    if (!selectedScalar) return;
    const tid = currentScalarTrackId(selectedScalar.kind);
    const bucket = getScalarBucket(selectedScalar.kind);
    const arr = bucket[tid];
    if (!arr) return;
    arr.splice(selectedScalar.idx, 1);
    if (!arr.length) delete bucket[tid];
    selectedScalar = null;
    renderScalarLists();
}

function setLeftTab(tab) {
    activeLeftTab = tab;
    document.querySelectorAll('.editor-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.getElementById('tab-words').classList.toggle('hidden', tab !== 'words');
    document.getElementById('tab-post').classList.toggle('hidden', tab !== 'post');
    document.getElementById('tab-vol').classList.toggle('hidden', tab !== 'vol');
    document.getElementById('tab-custom').classList.toggle('hidden', tab !== 'custom');
    const wordPanel = document.getElementById('panel-word-props');
    const scalarPanel = document.getElementById('panel-scalar-props');
    wordPanel.classList.toggle('hidden', tab !== 'words');
    scalarPanel.classList.toggle('hidden', tab === 'words');
}

function wireTimeline() {
    const viewportEl = document.getElementById('timeline-viewport');
    timelineCtl = attachShowcaseTimeline({
        viewport: viewportEl,
        inner: document.getElementById('timeline-inner'),
        ruler: document.getElementById('timeline-ruler'),
        trackKeyframes: document.getElementById('timeline-track-kf'),
        playhead: document.getElementById('timeline-playhead'),
        kfBand: document.getElementById('timeline-kf-band'),
        visRange: document.getElementById('timeline-vis-range'),
        getViewportInnerWidth: () => Math.max(32, viewportEl?.clientWidth || 320),
        getDurationSec: () => {
            const st = Number(doc.timing?.audioStartTime) || 0;
            return Math.max(0.01, durationSec() - st);
        },
        getFragmentTime,
        seekFragmentTime,
        getSnapToFrame: () => !!document.getElementById('chk-snap-frame')?.checked,
        getKeyframes: () => {
            const w = getSelectedWordEntry();
            if (!w || w.lineBreak || !w.id) return null;
            return doc.transformKeyframes?.[w.id] || [];
        },
        onKeyframeMoved: (index, newT) => {
            const w = getSelectedWordEntry();
            if (!w || w.lineBreak || !w.id) return;
            if (!doc.transformKeyframes?.[w.id]) return;
            const kfs = doc.transformKeyframes[w.id];
            if (!kfs[index]) return;
            kfs[index].t = newT;
            kfs.sort((a, b) => a.t - b.t);
            renderKeyframeList();
        },
        onKeyframeClick: (idx) => {
            selectedTransformKfIndex = idx;
            const w = getSelectedWordEntry();
            const kfs = w && w.id ? doc.transformKeyframes?.[w.id] : null;
            if (kfs && kfs[idx]) seekFragmentTime(kfs[idx].t);
            renderKeyframeList();
            syncKfEditorFromSelection();
        },
        onRedraw: () => {},
        getVisibilityRange: () => {
            const w = getSelectedWordEntry();
            if (!w || w.lineBreak) return { from: null, to: null };
            return {
                from: Number.isFinite(w.visibleFromFragSec) ? w.visibleFromFragSec : null,
                to: Number.isFinite(w.visibleToFragSec) ? w.visibleToFragSec : null
            };
        },
        setVisibilityRange: (from, to) => {
            const w = getSelectedWordEntry();
            if (!w || w.lineBreak) return;
            w.visibleFromFragSec = from;
            w.visibleToFragSec = to;
            syncPropsPanel();
        },
        onZoomMultiplierChange: (mul) => {
            const rng = document.getElementById('rng-timeline-zoom');
            if (rng) rng.value = String(Math.round(mul * 100));
        }
    });
    document.getElementById('rng-timeline-zoom')?.addEventListener('input', (e) => {
        const pct = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10);
        const mul = Math.max(1, Math.min(8, pct / 100));
        timelineCtl?.setZoomMultiplier(mul);
    });
    window.addEventListener('resize', () => timelineCtl?.refit());
    timelineCtl.refit();
}

function setEditorFileName(inputId, file) {
    const el = document.getElementById(`${inputId}-name`);
    if (!el) return;
    el.textContent = file?.name || '';
}

async function tryAutoLoadOnBoot() {
    const params = new URLSearchParams(window.location.search);
    const noAutoload = params.get('noautoload') === '1' || params.get('autoload') === '0';
    const docPath = params.get('doc') || params.get('animation');

    if (docPath) {
        const path = docPath.trim();
        if (!path) return;
        validationEl.textContent = 'Ładowanie dokumentu…';
        try {
            const fetchUrl = resolveRepoRelativeFetchUrl(path);
            const res = await fetch(fetchUrl);
            if (!res.ok) {
                validationEl.textContent = `Nie udało się pobrać: ${path} (${res.status})`;
                return;
            }
            const parsed = tryParseProjectFileText(await res.text());
            if (!parsed.ok) {
                validationEl.textContent = parsed.error;
                return;
            }
            applyLoadedDoc(parsed.doc);
            validationEl.textContent = `Wczytano: ${path}`;
        } catch (err) {
            validationEl.textContent = String(err?.message || err);
        }
        return;
    }

    if (noAutoload) return;

    const url =
        typeof MYSEN_CONFIG.showcaseAnimationUrl === 'string'
            ? MYSEN_CONFIG.showcaseAnimationUrl.trim()
            : '';
    if (!MYSEN_CONFIG.showcaseAnimationEnabled || !url) return;

    validationEl.textContent = 'Ładowanie z konfiguracji…';
    try {
        const res = await fetch(resolveRepoRelativeFetchUrl(url));
        if (!res.ok) {
            validationEl.textContent = `Config fetch: ${url} (${res.status})`;
            return;
        }
        const parsed = tryParseProjectFileText(await res.text());
        if (!parsed.ok) {
            validationEl.textContent = parsed.error;
            return;
        }
        applyLoadedDoc(parsed.doc);
        validationEl.textContent = `Wczytano z MYSEN_CONFIG: ${url}`;
    } catch (err) {
        validationEl.textContent = String(err?.message || err);
    }
}

function boot() {
    preview.init();
    scene = preview.scene;
    camera = preview.camera;
    renderer = preview.renderer;

    previewBgVideoEl = document.getElementById('preview-bg-video');

    editPivot = new THREE.Object3D();
    scene.add(editPivot);
    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setSize(0.75);
    transformControls.setMode('translate');
    transformControls.addEventListener('dragging-changed', (ev) => {
        if (ev.value === false) commitEditPivotToKeyframe();
    });
    scene.add(transformControls);

    document.getElementById('gizmo-mode')?.addEventListener('change', (e) => {
        const m = /** @type {HTMLSelectElement} */ (e.target).value;
        if (transformControls && (m === 'translate' || m === 'rotate')) {
            transformControls.setMode(/** @type {'translate' | 'rotate'} */ (m));
        }
    });
    document.getElementById('gizmo-space')?.addEventListener('change', (e) => {
        const sp = /** @type {HTMLSelectElement} */ (e.target).value;
        if (transformControls && (sp === 'world' || sp === 'local')) {
            transformControls.setSpace(sp);
        }
    });

    fillCatalogSelects();
    wireTimeline();

    document.getElementById('fsa-hint').textContent = isFileSystemAccessSupported()
        ? 'Eksport/Import folderu: wspierane w tej przeglądarce.'
        : 'Brak File System Access API — użyj „Pobierz JSON”.';

    document.querySelectorAll('.editor-tab').forEach((btn) => {
        btn.addEventListener('click', () => setLeftTab(btn.dataset.tab || 'words'));
    });

    document.getElementById('chk-show-grid')?.addEventListener('change', (e) => {
        preview.setGridVisible(/** @type {HTMLInputElement} */ (e.target).checked);
    });

    document.getElementById('project-source')?.addEventListener('change', async (e) => {
        const v = /** @type {HTMLSelectElement} */ (e.target).value;
        if (v === 'empty') {
            applyLoadedDoc(structuredClone(createEmptyShowcaseAnimationDoc()));
            validationEl.textContent = 'Nowy dokument v2.';
            e.target.value = 'empty';
            return;
        }
        if (v === 'audio') {
            applyLoadedDoc(structuredClone(createEmptyShowcaseAnimationDoc()));
            validationEl.textContent = 'Nowy v2 — wybierz plik audio.';
            document.getElementById('audio-file')?.click();
            e.target.value = 'empty';
            return;
        }
        if (v === 'mysen') {
            validationEl.textContent = 'Ładowanie presetu MYSEN…';
            try {
                const res = await fetch(
                    resolveRepoRelativeFetchUrl('ASSETS/mysen/showcase-animation.sample.json')
                );
                if (!res.ok) {
                    validationEl.textContent = `Preset MYSEN: HTTP ${res.status} — serwuj z katalogu topkek/ (nie tools/).`;
                    e.target.value = 'empty';
                    return;
                }
                const parsed = tryParseProjectFileText(await res.text());
                if (!parsed.ok) validationEl.textContent = parsed.error;
                else {
                    applyLoadedDoc(parsed.doc);
                    validationEl.textContent = 'Preset MYSEN wczytany.';
                }
            } catch (err) {
                validationEl.textContent = String(err?.message || err);
            }
            e.target.value = 'empty';
            return;
        }
        if (v === 'mysen-prod') {
            validationEl.textContent = 'Budowanie dokumentu (intro + timestampy jak przy /mysen)…';
            const tsUrl = (MYSEN_CONFIG.timestampLyricsUrl || '').trim();
            if (!MYSEN_CONFIG.timestampLyricsEnabled || !tsUrl) {
                validationEl.textContent = 'MYSEN: timestampLyrics wyłączone lub brak timestampLyricsUrl w config.';
                e.target.value = 'empty';
                return;
            }
            try {
                const tsRes = await fetch(resolveRepoRelativeFetchUrl(tsUrl));
                if (!tsRes.ok) {
                    validationEl.textContent = `Timestampy: ${tsUrl} (${tsRes.status})`;
                    e.target.value = 'empty';
                    return;
                }
                const rows = parseMysenTimestampLyricsFile(await tsRes.text());
                let wordAnimDoc = null;
                if (MYSEN_CONFIG.wordAnimationEnabled && MYSEN_CONFIG.wordAnimationUrl) {
                    const waUrl = String(MYSEN_CONFIG.wordAnimationUrl).trim();
                    if (waUrl) {
                        try {
                            const waRes = await fetch(resolveRepoRelativeFetchUrl(waUrl));
                            if (waRes.ok) {
                                const j = JSON.parse(await waRes.text());
                                wordAnimDoc = j && typeof j === 'object' ? j : null;
                            }
                        } catch {
                            /* optional */
                        }
                    }
                }
                const built = buildShowcaseAnimationDocFromMysenRuntimeMerge(MYSEN_CONFIG, rows, wordAnimDoc);
                const parsed = tryParseProjectFileText(JSON.stringify(built));
                if (!parsed.ok) {
                    validationEl.textContent = parsed.error;
                } else {
                    applyLoadedDoc(parsed.doc);
                    validationEl.textContent = `Wczytano merge jak /mysen (${rows.length} tokenów TS + intro).`;
                }
            } catch (err) {
                validationEl.textContent = String(err?.message || err);
            }
            e.target.value = 'empty';
            return;
        }
        if (v === 'vajbuj') {
            validationEl.textContent = 'Ładowanie presetu VAJBUJ…';
            try {
                const res = await fetch(
                    resolveRepoRelativeFetchUrl('ASSETS/vajbuj/showcase-animation.sample.json')
                );
                if (!res.ok) {
                    validationEl.textContent = `Preset VAJBUJ: HTTP ${res.status} — serwuj z katalogu topkek/.`;
                    e.target.value = 'empty';
                    return;
                }
                const parsed = tryParseProjectFileText(await res.text());
                if (!parsed.ok) validationEl.textContent = parsed.error;
                else {
                    applyLoadedDoc(parsed.doc);
                    validationEl.textContent = 'Preset VAJBUJ (tylko edycja / eksport; runtime MYSEN wymaga adaptera mysen).';
                }
            } catch (err) {
                validationEl.textContent = String(err?.message || err);
            }
            e.target.value = 'empty';
            return;
        }
        if (v === 'config') {
            const url = (MYSEN_CONFIG.showcaseAnimationUrl || '').trim();
            if (!MYSEN_CONFIG.showcaseAnimationEnabled || !url) {
                validationEl.textContent = 'MYSEN_CONFIG.showcaseAnimationEnabled / URL nieustawione.';
                e.target.value = 'empty';
                return;
            }
            try {
                const res = await fetch(resolveRepoRelativeFetchUrl(url));
                const parsed = tryParseProjectFileText(await res.text());
                if (!parsed.ok) validationEl.textContent = parsed.error;
                else {
                    applyLoadedDoc(parsed.doc);
                    validationEl.textContent = `Wczytano z config: ${url}`;
                }
            } catch (err) {
                validationEl.textContent = String(err?.message || err);
            }
            e.target.value = 'empty';
        }
    });

    document.getElementById('btn-import-pack')?.addEventListener('click', async () => {
        if (!isFileSystemAccessSupported()) {
            validationEl.textContent = 'Import folderu wymaga Chrome/Edge (File System Access API).';
            return;
        }
        try {
            // @ts-ignore — browser API
            const dir = await window.showDirectoryPicker();
            const r = await importShowcasePackFromDirectory(dir);
            if (!r.ok) {
                validationEl.textContent = r.error;
                return;
            }
            applyLoadedDoc(r.doc);
            if (r.audioFile) {
                lastAudioFile = r.audioFile;
                if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
                audioObjectUrl = URL.createObjectURL(r.audioFile);
                if (!audioEl) {
                    audioEl = new Audio();
                }
                audioEl.src = audioObjectUrl;
                doc.audio = doc.audio || {};
                doc.audio.suggestedFileName = r.audioFile.name;
                doc.audio.relativeAudioPath = r.manifest.files.audio;
                setEditorFileName('audio-file', r.audioFile);
            }
            validationEl.textContent = 'Wczytano pakiet z folderu.';
        } catch (err) {
            if (String(err).includes('abort')) return;
            validationEl.textContent = String(err?.message || err);
        }
    });

    document.getElementById('btn-export-pack')?.addEventListener('click', async () => {
        applyTimingFromInputs();
        readPropsFromPanel();
        readBgVideoFromPanels();
        const v = validateShowcaseAnimationDoc(doc);
        if (!v.ok) {
            validationEl.textContent = v.error;
            return;
        }
        const exp = document.getElementById('pack-experience')?.value || 'mysen';
        const animName = 'animation.json';
        const rawAudio = doc.audio?.relativeAudioPath || doc.audio?.suggestedFileName || 'audio.mp3';
        const audioBase = rawAudio.split(/[/\\]/).pop() || 'audio.mp3';
        const manifest = defaultPackManifest(exp, animName, audioBase);

        if (!isFileSystemAccessSupported()) {
            downloadJson(manifest, 'showcase-pack.json');
            downloadJson(cloneDocForJsonExport(), animName);
            validationEl.textContent = 'Pobrano manifest + animation.json (dodaj audio ręcznie).';
            return;
        }
        try {
            // @ts-ignore
            const dir = await window.showDirectoryPicker();
            const audioBlob =
                lastAudioFile ||
                (audioObjectUrl
                    ? await (await fetch(audioObjectUrl)).blob().catch(() => null)
                    : null);
            await exportShowcasePackToDirectory(dir, manifest, cloneDocForJsonExport(), audioBlob, manifest.files.audio);
            validationEl.textContent = 'Zapisano pakiet do folderu.';
        } catch (err) {
            if (String(err).includes('abort')) return;
            validationEl.textContent = String(err?.message || err);
        }
    });

    document.getElementById('btn-export')?.addEventListener('click', () => {
        applyTimingFromInputs();
        readPropsFromPanel();
        readBgVideoFromPanels();
        const v = validateShowcaseAnimationDoc(doc);
        if (!v.ok) {
            validationEl.textContent = v.error;
            return;
        }
        downloadJson(
            cloneDocForJsonExport(),
            (doc.audio?.suggestedFileName || 'showcase').replace(/\.[^.]+$/, '') + '-showcase.json'
        );
        validationEl.textContent = '';
    });

    document.getElementById('btn-copy')?.addEventListener('click', async () => {
        applyTimingFromInputs();
        readPropsFromPanel();
        readBgVideoFromPanels();
        const v = validateShowcaseAnimationDoc(doc);
        if (!v.ok) {
            validationEl.textContent = v.error;
            return;
        }
        await navigator.clipboard.writeText(JSON.stringify(cloneDocForJsonExport(), null, 2));
        validationEl.textContent = 'Skopiowano do schowka.';
    });

    document.getElementById('rng-volume')?.addEventListener('input', (e) => {
        const x = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
        if (audioEl) audioEl.volume = x;
    });

    ['post-track-id', 'vol-track-id', 'custom-track-id'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', () => {
            selectedScalar = null;
            renderScalarLists();
        });
    });
    document.getElementById('btn-post-add-kf')?.addEventListener('click', () => addScalarKeyframe('post'));
    document.getElementById('btn-vol-add-kf')?.addEventListener('click', () => addScalarKeyframe('vol'));
    document.getElementById('btn-custom-add-kf')?.addEventListener('click', () => addScalarKeyframe('custom'));
    document.getElementById('btn-scalar-apply')?.addEventListener('click', () => applyScalarKeyframeEdit());
    document.getElementById('btn-scalar-del')?.addEventListener('click', () => deleteScalarKeyframe());

    document.getElementById('btn-add-word')?.addEventListener('click', () => {
        const n = doc.words.filter((x) => !x.lineBreak).length;
        doc.words.push({ id: `w${n}`, text: 'WORD', at: 0, color: 0xffffff, scale: 1, materialPresetId: 'standard' });
        selectedWordIndex = doc.words.length - 1;
        renderWordList();
        syncPropsPanel();
        timelineCtl?.redraw();
        validationEl.textContent = '';
    });
    document.getElementById('btn-add-break')?.addEventListener('click', () => {
        doc.words.push({ lineBreak: true });
        selectedWordIndex = doc.words.length - 1;
        renderWordList();
        syncPropsPanel();
        timelineCtl?.redraw();
    });
    document.getElementById('btn-del-item')?.addEventListener('click', () => {
        if (selectedWordIndex < 0) return;
        const w = doc.words[selectedWordIndex];
        if (w && !w.lineBreak && w.id && doc.transformKeyframes?.[w.id]) {
            delete doc.transformKeyframes[w.id];
        }
        doc.words.splice(selectedWordIndex, 1);
        selectedWordIndex = Math.min(selectedWordIndex, doc.words.length - 1);
        renderWordList();
        syncPropsPanel();
        renderKeyframeList();
        timelineCtl?.redraw();
    });

    document.getElementById('btn-add-kf')?.addEventListener('click', () => {
        const w = getSelectedWordEntry();
        if (!w || w.lineBreak || !w.id) return;
        const tFrag = getFragmentTime();
        const px = parseFloat(document.getElementById('kf-px')?.value ?? '0');
        const py = parseFloat(document.getElementById('kf-py')?.value ?? '0');
        const pz = parseFloat(document.getElementById('kf-pz')?.value ?? '0');
        const rx = parseFloat(document.getElementById('kf-rx')?.value ?? '0');
        const ry = parseFloat(document.getElementById('kf-ry')?.value ?? '0');
        const rz = parseFloat(document.getElementById('kf-rz')?.value ?? '0');
        const sc = parseFloat(document.getElementById('kf-scale')?.value ?? '1') || 1;
        upsertTransformKeyframeAtT(w.id, tFrag, {
            px: Number.isFinite(px) ? px : 0,
            py: Number.isFinite(py) ? py : 0,
            pz: Number.isFinite(pz) ? pz : 0,
            rx: Number.isFinite(rx) ? rx : 0,
            ry: Number.isFinite(ry) ? ry : 0,
            rz: Number.isFinite(rz) ? rz : 0,
            scale: sc
        });
        renderKeyframeList();
        syncKfEditorFromSelection();
        timelineCtl?.redraw();
    });

    const wireKfChip = (btnId, patch) => {
        document.getElementById(btnId)?.addEventListener('click', () => {
            const w = getSelectedWordEntry();
            if (!w || w.lineBreak || !w.id) return;
            const tFrag = getFragmentTime();
            upsertTransformKeyframeAtT(w.id, tFrag, patch());
            renderKeyframeList();
            syncKfEditorFromSelection();
            timelineCtl?.redraw();
        });
    };
    wireKfChip('btn-kf-px', () => ({
        px: parseFloat(document.getElementById('kf-px')?.value ?? '0') || 0
    }));
    wireKfChip('btn-kf-py', () => ({
        py: parseFloat(document.getElementById('kf-py')?.value ?? '0') || 0
    }));
    wireKfChip('btn-kf-pz', () => ({
        pz: parseFloat(document.getElementById('kf-pz')?.value ?? '0') || 0
    }));
    wireKfChip('btn-kf-rx', () => ({
        rx: parseFloat(document.getElementById('kf-rx')?.value ?? '0') || 0
    }));
    wireKfChip('btn-kf-ry', () => ({
        ry: parseFloat(document.getElementById('kf-ry')?.value ?? '0') || 0
    }));
    wireKfChip('btn-kf-rz', () => ({
        rz: parseFloat(document.getElementById('kf-rz')?.value ?? '0') || 0
    }));
    wireKfChip('btn-kf-scale', () => ({
        scale: parseFloat(document.getElementById('kf-scale')?.value ?? '1') || 1
    }));

    document.getElementById('btn-del-kf')?.addEventListener('click', () => {
        const w = getSelectedWordEntry();
        if (!w || w.lineBreak || !w.id || selectedTransformKfIndex < 0) return;
        const kfs = doc.transformKeyframes?.[w.id];
        if (!kfs) return;
        kfs.splice(selectedTransformKfIndex, 1);
        if (!kfs.length && doc.transformKeyframes) delete doc.transformKeyframes[w.id];
        selectedTransformKfIndex = -1;
        renderKeyframeList();
        syncKfEditorFromSelection();
        timelineCtl?.redraw();
    });

    ['kf-px', 'kf-py', 'kf-pz', 'kf-rx', 'kf-ry', 'kf-rz', 'kf-scale'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', () => {
            const w = getSelectedWordEntry();
            if (!w || !w.id || selectedTransformKfIndex < 0) return;
            const kfs = doc.transformKeyframes?.[w.id];
            if (!kfs?.[selectedTransformKfIndex]) return;
            const kf = kfs[selectedTransformKfIndex];
            kf.position = [
                parseFloat(document.getElementById('kf-px')?.value ?? '0') || 0,
                parseFloat(document.getElementById('kf-py')?.value ?? '0') || 0,
                parseFloat(document.getElementById('kf-pz')?.value ?? '0') || 0
            ];
            kf.rotationEuler = [
                parseFloat(document.getElementById('kf-rx')?.value ?? '0') || 0,
                parseFloat(document.getElementById('kf-ry')?.value ?? '0') || 0,
                parseFloat(document.getElementById('kf-rz')?.value ?? '0') || 0
            ];
            kf.scale = parseFloat(document.getElementById('kf-scale')?.value ?? '1') || 1;
            renderKeyframeList();
        });
    });

    document.getElementById('btn-vis-from-now')?.addEventListener('click', () => {
        const w = getSelectedWordEntry();
        if (!w || w.lineBreak) return;
        const t = getFragmentTime();
        w.visibleFromFragSec = document.getElementById('chk-snap-frame')?.checked
            ? Math.round(t * SHOWCASE_TIMELINE_FPS) / SHOWCASE_TIMELINE_FPS
            : t;
        syncPropsPanel();
        timelineCtl?.redraw();
    });
    document.getElementById('btn-vis-to-now')?.addEventListener('click', () => {
        const w = getSelectedWordEntry();
        if (!w || w.lineBreak) return;
        const t = getFragmentTime();
        w.visibleToFragSec = document.getElementById('chk-snap-frame')?.checked
            ? Math.round(t * SHOWCASE_TIMELINE_FPS) / SHOWCASE_TIMELINE_FPS
            : t;
        syncPropsPanel();
        timelineCtl?.redraw();
    });

    document.getElementById('btn-vanish-now')?.addEventListener('click', () => {
        applyTimingFromInputs();
        const w = getSelectedWordEntry();
        if (!w || w.lineBreak) return;
        let mediaSec;
        if (audioEl && Number.isFinite(audioEl.currentTime)) {
            mediaSec = audioEl.currentTime;
        } else {
            mediaSec = editorApproxMediaSecFromFragment(getFragmentTime());
        }
        const inp = document.getElementById('prop-vanish-media');
        if (inp) inp.value = String(Math.round(mediaSec * 1000) / 1000);
        readPropsFromPanel();
        validationEl.textContent = `vanishAtMediaSec = ${inp?.value}`;
    });

    document.getElementById('inp-audio-start')?.addEventListener('change', () => {
        applyTimingFromInputs();
        if (audioEl) audioEl.currentTime = doc.timing.audioStartTime + getFragmentTime();
    });
    document.getElementById('inp-first-ts')?.addEventListener('change', applyTimingFromInputs);

    const propIds = [
        'prop-id',
        'prop-text',
        'prop-at',
        'prop-color',
        'prop-scale',
        'prop-spawn',
        'prop-vanish-media',
        'prop-assembly-dur',
        'prop-fly-mode',
        'prop-persistent',
        'prop-word-size',
        'prop-word-height',
        'prop-word-thickness',
        'prop-scatter',
        'prop-material',
        'prop-word-fx',
        'prop-vis-from',
        'prop-vis-to'
    ];
    propIds.forEach((id) => {
        document.getElementById(id)?.addEventListener('change', () => {
            readPropsFromPanel();
            syncPropsPanel();
            renderWordList();
            timelineCtl?.redraw();
            meshByWordId.clear();
        });
    });

    document.getElementById('audio-file')?.addEventListener('change', (e) => {
        const f = /** @type {HTMLInputElement} */ (e.target).files?.[0];
        setEditorFileName('audio-file', f || null);
        if (!f) return;
        lastAudioFile = f;
        if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
        audioObjectUrl = URL.createObjectURL(f);
        if (!audioEl) {
            audioEl = new Audio();
        }
        audioEl.src = audioObjectUrl;
        audioEl.addEventListener(
            'loadedmetadata',
            () => {
                if (!doc.audio) doc.audio = {};
                doc.audio.durationSec = audioEl.duration;
                doc.audio.suggestedFileName = f.name;
                doc.audio.relativeAudioPath = f.name.split(/[/\\]/).pop() || f.name;
                timelineCtl?.refit();
                timelineCtl?.redraw();
                validationEl.textContent = `Audio: ${f.name} (${audioEl.duration.toFixed(2)} s)`;
            },
            { once: true }
        );
    });

    document.getElementById('bg-video-file')?.addEventListener('change', (e) => {
        const f = /** @type {HTMLInputElement} */ (e.target).files?.[0];
        setEditorFileName('bg-video-file', f || null);
        if (!f) return;
        if (previewBgVideoObjectUrl) URL.revokeObjectURL(previewBgVideoObjectUrl);
        previewBgVideoObjectUrl = URL.createObjectURL(f);
        const bg = ensureStyleBackgroundVideo();
        bg.relativePath = f.name;
        const pi = document.getElementById('bg-video-path');
        if (pi) pi.value = f.name;
        reloadPreviewBackgroundVideo();
    });

    document.getElementById('bg-video-path')?.addEventListener('change', () => {
        const v = document.getElementById('bg-video-path')?.value?.trim() ?? '';
        ensureStyleBackgroundVideo().relativePath = v;
        if (!previewBgVideoObjectUrl) reloadPreviewBackgroundVideo();
    });

    function addBgOpacityKeyframeAtInputs() {
        const bg = ensureStyleBackgroundVideo();
        const tRaw = parseFloat(document.getElementById('bg-op-t')?.value ?? '');
        const t = Number.isFinite(tRaw) ? snapFragT(tRaw) : snapFragT(getFragmentTime());
        const v = parseFloat(document.getElementById('bg-op-v')?.value ?? '');
        if (!Number.isFinite(v)) return;
        bg.opacityKeyframes.push({ t, v: Math.min(1, Math.max(0, v)) });
        bg.opacityKeyframes.sort((a, b) => a.t - b.t);
        selectedBgScalar = null;
        renderBgVideoKeyframeLists();
    }

    function addBgPlaybackKeyframeAtInputs() {
        const bg = ensureStyleBackgroundVideo();
        const tRaw = parseFloat(document.getElementById('bg-pr-t')?.value ?? '');
        const t = Number.isFinite(tRaw) ? snapFragT(tRaw) : snapFragT(getFragmentTime());
        const v = parseFloat(document.getElementById('bg-pr-v')?.value ?? '');
        if (!Number.isFinite(v)) return;
        bg.playbackRateKeyframes.push({ t, v: Math.max(0.05, Math.min(4, v)) });
        bg.playbackRateKeyframes.sort((a, b) => a.t - b.t);
        selectedBgScalar = null;
        renderBgVideoKeyframeLists();
    }

    document.getElementById('btn-bg-op-add')?.addEventListener('click', () => {
        const tFrag = getFragmentTime();
        document.getElementById('bg-op-t').value = String(snapFragT(tFrag));
        addBgOpacityKeyframeAtInputs();
    });
    document.getElementById('btn-bg-pr-add')?.addEventListener('click', () => {
        const tFrag = getFragmentTime();
        document.getElementById('bg-pr-t').value = String(snapFragT(tFrag));
        addBgPlaybackKeyframeAtInputs();
    });
    document.getElementById('btn-bg-op-apply')?.addEventListener('click', () => {
        if (!selectedBgScalar || selectedBgScalar.kind !== 'opacity') return;
        const bg = ensureStyleBackgroundVideo();
        const arr = bg.opacityKeyframes;
        const row = arr[selectedBgScalar.idx];
        if (!row) return;
        const t = parseFloat(document.getElementById('bg-op-t')?.value ?? '');
        const v = parseFloat(document.getElementById('bg-op-v')?.value ?? '');
        if (!Number.isFinite(t) || !Number.isFinite(v)) return;
        row.t = t;
        row.v = Math.min(1, Math.max(0, v));
        arr.sort((a, b) => a.t - b.t);
        renderBgVideoKeyframeLists();
    });
    document.getElementById('btn-bg-pr-apply')?.addEventListener('click', () => {
        if (!selectedBgScalar || selectedBgScalar.kind !== 'playbackRate') return;
        const bg = ensureStyleBackgroundVideo();
        const arr = bg.playbackRateKeyframes;
        const row = arr[selectedBgScalar.idx];
        if (!row) return;
        const t = parseFloat(document.getElementById('bg-pr-t')?.value ?? '');
        const v = parseFloat(document.getElementById('bg-pr-v')?.value ?? '');
        if (!Number.isFinite(t) || !Number.isFinite(v)) return;
        row.t = t;
        row.v = Math.max(0.05, Math.min(4, v));
        arr.sort((a, b) => a.t - b.t);
        renderBgVideoKeyframeLists();
    });
    document.getElementById('btn-bg-op-del')?.addEventListener('click', () => {
        if (!selectedBgScalar || selectedBgScalar.kind !== 'opacity') return;
        const bg = ensureStyleBackgroundVideo();
        bg.opacityKeyframes.splice(selectedBgScalar.idx, 1);
        selectedBgScalar = null;
        renderBgVideoKeyframeLists();
    });
    document.getElementById('btn-bg-pr-del')?.addEventListener('click', () => {
        if (!selectedBgScalar || selectedBgScalar.kind !== 'playbackRate') return;
        const bg = ensureStyleBackgroundVideo();
        bg.playbackRateKeyframes.splice(selectedBgScalar.idx, 1);
        selectedBgScalar = null;
        renderBgVideoKeyframeLists();
    });

    document.getElementById('btn-play')?.addEventListener('click', () => {
        if (audioEl) {
            const st = Number(doc.timing?.audioStartTime) || 0;
            if (audioEl.currentTime < st) audioEl.currentTime = st;
            audioEl.play();
        }
    });
    document.getElementById('btn-pause')?.addEventListener('click', () => audioEl?.pause());

    document.getElementById('import-project')?.addEventListener('change', async (e) => {
        const f = /** @type {HTMLInputElement} */ (e.target).files?.[0];
        if (!f) return;
        try {
            const parsed = tryParseProjectFileText(await f.text());
            if (!parsed.ok) {
                validationEl.textContent = parsed.error;
                return;
            }
            applyLoadedDoc(parsed.doc);
            validationEl.textContent =
                parsed.source === 'legacy' ? 'Wczytano pakiet legacy → v2.' : 'Wczytano dokument showcase.';
        } catch (err) {
            validationEl.textContent = String(err?.message || err);
        }
        e.target.value = '';
    });

    document.getElementById('whisper-ts-file')?.addEventListener('change', async (e) => {
        const input = /** @type {HTMLInputElement} */ (e.target);
        const f = input.files?.[0];
        setEditorFileName('whisper-ts-file', f || null);
        if (!f) return;
        try {
            applyTimingFromInputs();
            const audioStart = doc.timing?.audioStartTime ?? 0;
            const text = await f.text();
            const { entries, wordCount, negativeAtCount } = parseWhisperStyleTimestampTxtToWordEntries(
                text,
                audioStart
            );
            if (wordCount === 0) {
                validationEl.textContent = 'Brak słów w pliku (nierozpoznany format lub tylko „Muzyka”).';
                input.value = '';
                setEditorFileName('whisper-ts-file', null);
                return;
            }
            doc.words = entries;
            if (!doc.timing) doc.timing = {};
            doc.timing.firstTimestampLineIndex = 0;
            buildRailIdentityTransformKeyframesForAllWords(doc);
            meshByWordId.clear();
            selectedWordIndex = doc.words.findIndex((x) => !x.lineBreak);
            if (selectedWordIndex < 0) selectedWordIndex = 0;
            selectedTransformKfIndex = -1;
            syncTimingInputs();
            renderWordList();
            syncPropsPanel();
            renderKeyframeList();
            timelineCtl?.redraw();
            const v = validateShowcaseAnimationDoc(doc);
            let msg = `Wczytano timestampy: ${wordCount} słów (${f.name}).`;
            if (negativeAtCount > 0) {
                msg += ` Uwaga: ${negativeAtCount} słów ma ujemne at — sprawdź audioStart.`;
            }
            if (!v.ok) {
                validationEl.textContent = `${msg} Walidacja: ${v.error}`;
            } else {
                validationEl.textContent = msg;
            }
        } catch (err) {
            validationEl.textContent = String(err?.message || err);
        }
        input.value = '';
    });

    syncTimingInputs();
    renderWordList();
    syncPropsPanel();
    renderKeyframeList();
    renderScalarLists();
    setLeftTab('words');
    selectedWordIndex = initialSelectedWordIndexAfterLoad();
    renderWordList();
    syncPropsPanel();
    animate();
    void tryAutoLoadOnBoot();

    const loader = new FontLoader();
    loader.load(
        'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json',
        (font) => {
            editorFont = font;
            const cur = (validationEl.textContent || '').trim();
            const keep = /^(Wczytano|Zapisano|Preset|Nowy)/.test(cur);
            validationEl.textContent = keep ? `${cur} · Font OK` : 'Font OK';
        },
        undefined,
        (err) => {
            validationEl.textContent = 'Błąd fontu: ' + String(err);
        }
    );
}

boot();
