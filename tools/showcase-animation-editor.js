/**
 * Standalone showcase animation editor (MYSEN voxelLyrics adapter v1).
 * Serve repo root: python -m http.server 8002 → /tools/showcase-animation-editor.html
 */
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import {
    createEmptyShowcaseAnimationDoc,
    validateShowcaseAnimationDoc
} from '../showcase-animation-schema.js';
import {
    lyricsArrayFromShowcaseDoc,
    tryBuildShowcaseDocFromLegacyImportBundle
} from '../showcase-animation-adapters.js';
import { interpolateTransformKeyframes } from '../showcase-animation-keyframes.js';
import { createVoxelWord, voxelStyleFromMusicConfig } from '../music-lyric-voxels.js';
import { CONFIG, MYSEN_CONFIG } from '../config.js';

/** @type {import('../showcase-animation-schema.js').ShowcaseAnimationDoc} */
let doc = structuredClone(createEmptyShowcaseAnimationDoc());

let selectedWordIndex = -1;
let audioEl = null;
let audioObjectUrl = null;

const container = document.getElementById('preview-canvas-container');
const wordListEl = document.getElementById('word-list');
const validationEl = document.getElementById('validation-msg');
const timelineBar = document.getElementById('timeline-bar');
const timelinePlayhead = document.getElementById('timeline-playhead');
const timelineMarkers = document.getElementById('timeline-markers');
const timeDisplay = document.getElementById('time-display');

let renderer;
let scene;
let camera;
let dummy = new THREE.Object3D();
/** @type {import('three').Font | null} */
let editorFont = null;
const voxelCache = {};
/** @type {Map<string, { mesh: import('three').InstancedMesh; cubes: object[]; inScene: boolean }>} */
const meshByWordId = new Map();

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

/** Mirror script.js seeded fly: stable pseudo-spawn for preview when randomFly enabled. */
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
            if (!editorFont) continue;
            if (!w.width) {
                const vw = createVoxelWord(w, editorFont, voxelCache, vStyle);
                w.width = vw.width;
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

function updatePreviewAtTime(tFrag) {
    if (!editorFont || !scene) return;
    const rows = collectWordRows();
    layoutRailPositions(rows);
    ensureWordMeshes(rows);
    const s = effectiveStyle();
    const firstTs = Number.isFinite(doc.timing?.firstTimestampLineIndex)
        ? doc.timing.firstTimestampLineIndex
        : 99999;
    const audioStart = Number(doc.timing?.audioStartTime) || 0;
    const spreadDur = getEditorSpreadDurSec();
    const randomFlyEnabled = doc.style?.randomFly?.enabled === true;

    for (const w of rows) {
        const id = w.showcaseWordId;
        const rec = id ? meshByWordId.get(id) : null;
        if (!rec) continue;

        if (tFrag < w.startTime) {
            rec.mesh.visible = false;
            continue;
        }

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
            Number.isFinite(w.spawnX) &&
            Number.isFinite(w.spawnY) &&
            Number.isFinite(w.spawnZ);
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

        if (inSpread && spreadU >= 1) {
            rec.mesh.visible = false;
            continue;
        }

        rec.mesh.visible = true;

        const hexEnd = typeof w.color === 'number' ? w.color : 0xffffff;
        const asmStart = new THREE.Color(0x050505);
        const asmEnd = new THREE.Color(hexEnd);
        const tempColor = new THREE.Color();

        const cubeProgress = assembling ? progress : 1;
        const amp =
            inSpread && spreadDur > 0
                ? (s.scatterRadius ?? 6) * spreadU * (1 - spreadU + 0.2)
                : 0;

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

function initThree() {
    const w = container.clientWidth || 640;
    const h = container.clientHeight || 360;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
    camera.position.set(0, 2, 42);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const d = new THREE.DirectionalLight(0xffffff, 1.1);
    d.position.set(4, 10, 12);
    scene.add(d);

    window.addEventListener('resize', () => {
        const nw = container.clientWidth;
        const nh = container.clientHeight || 360;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    });
}

function animate() {
    requestAnimationFrame(animate);
    const t = getFragmentTime();
    timeDisplay.textContent = `t = ${t.toFixed(2)} s / fragment`;
    updateTimelinePlayhead(t);
    updatePreviewAtTime(t);
    if (renderer && scene && camera) renderer.render(scene, camera);
}

function updateTimelinePlayhead(tFrag) {
    const d = durationSec();
    const u = d > 0 ? Math.min(1, Math.max(0, tFrag / d)) : 0;
    timelinePlayhead.style.left = `${u * 100}%`;
}

function rebuildTimelineMarkers() {
    timelineMarkers.innerHTML = '';
    const d = durationSec();
    if (d <= 0) return;
    const lyrics = doc.words || [];
    for (const w of lyrics) {
        if (w.lineBreak || typeof w.at !== 'number' || !Number.isFinite(w.at)) continue;
        const u = Math.min(1, Math.max(0, w.at / d));
        const m = document.createElement('div');
        m.className = 'timeline-marker';
        m.style.left = `${u * 100}%`;
        m.title = `${w.text} @ ${w.at}s`;
        timelineMarkers.appendChild(m);
    }
}

function getSelectedWordEntry() {
    if (selectedWordIndex < 0) return null;
    return doc.words[selectedWordIndex] ?? null;
}

function isLineBreakEntry(entry) {
    return entry && entry.lineBreak === true;
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
            renderWordList();
            syncPropsPanel();
            renderKeyframeList();
        });
        wordListEl.appendChild(li);
    });
}

function syncPropsPanel() {
    const w = getSelectedWordEntry();
    const panel = document.getElementById('prop-panel');
    const ids = ['prop-id', 'prop-text', 'prop-at', 'prop-color', 'prop-scale'];
    if (!w || w.lineBreak) {
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const spawnEl = document.getElementById('prop-spawn');
        if (spawnEl) spawnEl.value = '';
        const vanEl = document.getElementById('prop-vanish-media');
        if (vanEl) vanEl.value = '';
        const adEl = document.getElementById('prop-assembly-dur');
        if (adEl) adEl.value = '';
        const flyEl = document.getElementById('prop-fly-mode');
        if (flyEl) flyEl.value = 'default';
        const perEl = document.getElementById('prop-persistent');
        if (perEl) perEl.checked = false;
        panel?.querySelectorAll('input, button, select').forEach((el) => {
            if (
                el.id?.startsWith('prop-') ||
                el.id === 'btn-add-kf' ||
                el.id === 'btn-vanish-now'
            ) {
                el.disabled = true;
            }
        });
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
        vanInp.value =
            Number.isFinite(w.vanishAtMediaSec) ? String(w.vanishAtMediaSec) : '';
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
}

function renderKeyframeList() {
    const ul = document.getElementById('kf-list');
    ul.innerHTML = '';
    const w = getSelectedWordEntry();
    if (!w || w.lineBreak || !w.id) return;
    const kfs = doc.transformKeyframes?.[w.id] || [];
    kfs.forEach((kf, idx) => {
        const li = document.createElement('li');
        li.textContent = `t=${kf.t} pos=${JSON.stringify(kf.position || [])} rot=${JSON.stringify(kf.rotationEuler || [])} s=${kf.scale ?? 1}`;
        li.addEventListener('dblclick', () => {
            kfs.splice(idx, 1);
            if (!kfs.length && doc.transformKeyframes) delete doc.transformKeyframes[w.id];
            renderKeyframeList();
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

/**
 * @param {string} text
 * @returns {{ ok: true, doc: import('../showcase-animation-schema.js').ShowcaseAnimationDoc } | { ok: false, error: string }}
 */
function parseShowcaseDocFromJsonText(text) {
    try {
        const json = JSON.parse(text);
        const v = validateShowcaseAnimationDoc(json);
        if (!v.ok) return { ok: false, error: v.error };
        return { ok: true, doc: v.doc };
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }
}

/**
 * Single project file: validated showcase v1 or legacy import bundle (see tools/README).
 * @param {string} text
 * @returns {{ ok: true, source: 'showcase' | 'legacy', doc: import('../showcase-animation-schema.js').ShowcaseAnimationDoc } | { ok: false, error: string }}
 */
function tryParseProjectFileText(text) {
    let json;
    try {
        json = JSON.parse(text);
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }
    const v = validateShowcaseAnimationDoc(json);
    if (v.ok) return { ok: true, source: 'showcase', doc: v.doc };

    const bundle = tryBuildShowcaseDocFromLegacyImportBundle(json);
    if (bundle.handled && bundle.ok) {
        const v2 = validateShowcaseAnimationDoc(bundle.doc);
        if (!v2.ok) return { ok: false, error: v2.error };
        return { ok: true, source: 'legacy', doc: v2.doc };
    }
    if (bundle.handled && !bundle.ok) return { ok: false, error: bundle.error };

    return {
        ok: false,
        error:
            (v.error || 'Nie rozpoznano pliku.') +
            ' Oczekiwano dokumentu showcase (schemaVersion + adapter) lub pakietu legacy (`kind`: `mysenLegacyImportBundle`, `version`: 1) — zob. tools/README.'
    };
}

function initialSelectedWordIndexAfterLoad() {
    for (let i = 0; i < doc.words.length; i++) {
        if (!doc.words[i].lineBreak) return i;
    }
    return doc.words.length > 0 ? 0 : -1;
}

/** @param {import('../showcase-animation-schema.js').ShowcaseAnimationDoc} newDoc */
function applyLoadedDoc(newDoc) {
    doc = newDoc;
    meshByWordId.clear();
    selectedWordIndex = initialSelectedWordIndexAfterLoad();
    syncTimingInputs();
    renderWordList();
    syncPropsPanel();
    renderKeyframeList();
    rebuildTimelineMarkers();
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
            const res = await fetch(path);
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

    validationEl.textContent = 'Ładowanie dokumentu z konfiguracji…';
    try {
        const res = await fetch(url);
        if (!res.ok) {
            validationEl.textContent = `Nie udało się pobrać z config: ${url} (${res.status})`;
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

/** @param {string} inputId element id without -name suffix */
function setEditorFileName(inputId, file) {
    const el = document.getElementById(`${inputId}-name`);
    if (!el) return;
    el.textContent = file?.name || '';
}

[
    'prop-id',
    'prop-text',
    'prop-at',
    'prop-color',
    'prop-scale',
    'prop-spawn',
    'prop-vanish-media',
    'prop-assembly-dur',
    'prop-fly-mode',
    'prop-persistent'
].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
        readPropsFromPanel();
        syncPropsPanel();
        renderWordList();
        rebuildTimelineMarkers();
    });
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

document.getElementById('btn-add-word')?.addEventListener('click', () => {
    const n = doc.words.filter((x) => !x.lineBreak).length;
    doc.words.push({ id: `w${n}`, text: 'WORD', at: 0, color: 0xffffff, scale: 1 });
    selectedWordIndex = doc.words.length - 1;
    renderWordList();
    syncPropsPanel();
    rebuildTimelineMarkers();
    validationEl.textContent = '';
});

document.getElementById('btn-add-break')?.addEventListener('click', () => {
    doc.words.push({ lineBreak: true });
    selectedWordIndex = doc.words.length - 1;
    renderWordList();
    syncPropsPanel();
    rebuildTimelineMarkers();
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
    rebuildTimelineMarkers();
});

document.getElementById('btn-add-kf')?.addEventListener('click', () => {
    const w = getSelectedWordEntry();
    if (!w || w.lineBreak || !w.id) return;
    const tFrag = getFragmentTime();
    const pos = parseTriple(document.getElementById('kf-pos').value);
    const rot = parseTriple(document.getElementById('kf-rot').value);
    const sc = parseFloat(document.getElementById('kf-scale').value) || 1;
    if (!doc.transformKeyframes) doc.transformKeyframes = {};
    if (!doc.transformKeyframes[w.id]) doc.transformKeyframes[w.id] = [];
    doc.transformKeyframes[w.id].push({
        t: tFrag,
        position: pos,
        rotationEuler: rot,
        scale: sc
    });
    doc.transformKeyframes[w.id].sort((a, b) => a.t - b.t);
    renderKeyframeList();
});

document.getElementById('audio-file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    setEditorFileName('audio-file', f || null);
    if (!f) return;
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = URL.createObjectURL(f);
    if (!audioEl) {
        audioEl = new Audio();
        audioEl.addEventListener('timeupdate', () => updateTimelinePlayhead(getFragmentTime()));
    }
    audioEl.src = audioObjectUrl;
    audioEl.addEventListener(
        'loadedmetadata',
        () => {
            if (!doc.audio) doc.audio = {};
            doc.audio.durationSec = audioEl.duration;
            doc.audio.suggestedFileName = f.name;
            rebuildTimelineMarkers();
            validationEl.textContent = `Audio: ${f.name}, ${audioEl.duration.toFixed(2)} s`;
        },
        { once: true }
    );
});

document.getElementById('btn-play')?.addEventListener('click', () => {
    if (audioEl) {
        const st = Number(doc.timing?.audioStartTime) || 0;
        if (audioEl.currentTime < st) audioEl.currentTime = st;
        audioEl.play();
    }
});

document.getElementById('btn-pause')?.addEventListener('click', () => audioEl?.pause());

timelineBar?.addEventListener('click', (ev) => {
    const d = durationSec();
    if (!audioEl || d <= 0) return;
    const rect = timelineBar.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
    const st = Number(doc.timing?.audioStartTime) || 0;
    audioEl.currentTime = st + u * d;
    updateTimelinePlayhead(getFragmentTime());
});

document.getElementById('btn-export')?.addEventListener('click', () => {
    applyTimingFromInputs();
    readPropsFromPanel();
    const v = validateShowcaseAnimationDoc(doc);
    if (!v.ok) {
        validationEl.textContent = v.error;
        return;
    }
    validationEl.textContent = '';
    const blob = new Blob([JSON.stringify(v.doc, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (doc.audio?.suggestedFileName || 'showcase').replace(/\.[^.]+$/, '') + '-showcase.json';
    a.click();
    URL.revokeObjectURL(a.href);
});

document.getElementById('btn-copy')?.addEventListener('click', async () => {
    applyTimingFromInputs();
    readPropsFromPanel();
    const v = validateShowcaseAnimationDoc(doc);
    if (!v.ok) {
        validationEl.textContent = v.error;
        return;
    }
    await navigator.clipboard.writeText(JSON.stringify(v.doc, null, 2));
    validationEl.textContent = 'Skopiowano do schowka.';
});

document.getElementById('import-project')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) {
        setEditorFileName('import-project', null);
        return;
    }
    setEditorFileName('import-project', f);
    try {
        const parsed = tryParseProjectFileText(await f.text());
        if (!parsed.ok) {
            validationEl.textContent = parsed.error;
            return;
        }
        applyLoadedDoc(parsed.doc);
        validationEl.textContent =
            parsed.source === 'legacy'
                ? 'Wczytano projekt (pakiet legacy MYSEN). Grupy timestampów itd. nie są 1:1.'
                : 'Wczytano projekt (showcase v1).';
    } catch (err) {
        validationEl.textContent = String(err?.message || err);
    }
    e.target.value = '';
    setEditorFileName('import-project', null);
});

function boot() {
    initThree();
    syncTimingInputs();
    renderWordList();
    syncPropsPanel();
    renderKeyframeList();
    rebuildTimelineMarkers();
    animate();
    void tryAutoLoadOnBoot();

    const loader = new FontLoader();
    loader.load(
        'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json',
        (font) => {
            editorFont = font;
            const fontLine = `Font OK · particleSize=${CONFIG.particleSize}`;
            const cur = (validationEl.textContent || '').trim();
            const keepSuccess = /^(Wczytano|Złożono)/.test(cur);
            validationEl.textContent = keepSuccess ? `${cur} · ${fontLine}` : fontLine;
        },
        undefined,
        (err) => {
            validationEl.textContent = 'Błąd ładowania fontu: ' + String(err);
        }
    );
}

boot();
