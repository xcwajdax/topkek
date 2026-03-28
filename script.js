import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { initTopkekTerminalShell } from './terminal-shell.js';
import { initFxDevPanel } from './fx-dev-panel.js';
import { IS_MOBILE, CONFIG, SHADER_CONFIG, MATERIALS, SHAPE_DEFINITIONS, CINEMATIC_CONFIG as cinematicConfig, INTRO_CAMERA_CONFIG, POST_INTRO_UI_CONFIG, CAMERA_HUD_CONFIG, PERF_HUD_CONFIG, LOADER_CONFIG, VAJBUJ_CONFIG, MYSEN_CONFIG, PORTFOLIO_CONFIG, PORTFOLIO_SCENE_CONFIG, GLITCH_VOLUME_CONFIG, GLITCH_VOLUME_PRESETS, GLITCH_VOLUME_STATE, FX_CONFIG, PERFORMANCE_CONFIG, DEBUG_FLAGS, TERMINAL_HELP_LINES_COMPACT, TERMINAL_HELP_LINES_FULL } from './config.js';

const CUSTOM_TEXT_QUERY_PARAM = 'text';
const MAX_CUSTOM_TEXT_LENGTH = 10;

function sanitizeCustomText(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toUpperCase().slice(0, MAX_CUSTOM_TEXT_LENGTH);
}

function resolvePerformanceMode() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get(PERFORMANCE_CONFIG.urlParam);
    if (q === 'lite' || q === 'full' || q === 'auto') {
        try {
            localStorage.setItem(PERFORMANCE_CONFIG.storageKey, q);
        } catch (_) { /* ignore */ }
        return q;
    }
    try {
        const stored = localStorage.getItem(PERFORMANCE_CONFIG.storageKey);
        if (stored === 'lite' || stored === 'full' || stored === 'auto') return stored;
    } catch (_) { /* ignore */ }
    return 'auto';
}

function shouldUseLitePerformance(mode) {
    if (mode === 'lite') return true;
    if (mode === 'full') return false;
    const mem = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency || 8;
    if (mem != null && mem <= PERFORMANCE_CONFIG.autoLiteMaxDeviceMemoryGb) return true;
    if (cores <= PERFORMANCE_CONFIG.autoLiteMaxHardwareConcurrency) return true;
    return false;
}

const performanceRuntime = (() => {
    const mode = resolvePerformanceMode();
    const lite = shouldUseLitePerformance(mode);
    const prof = PERFORMANCE_CONFIG.profiles[lite ? 'lite' : 'full'];
    const shadowMapSize = IS_MOBILE
        ? CONFIG.shadowMapSize
        : (prof.shadowMapSizeOverride ?? CONFIG.shadowMapSize);
    return {
        mode,
        lite,
        maxPixelRatioCap: prof.maxPixelRatioCap,
        enableSao: prof.enableSao,
        enableBloom: prof.enableBloom,
        enableCrt: prof.enableCrt,
        secondLightCastShadow: prof.secondLightCastShadow,
        shadowMapSize
    };
})();

const customTextFromUrl = sanitizeCustomText(
    new URLSearchParams(window.location.search).get(CUSTOM_TEXT_QUERY_PARAM) || ''
);
if (customTextFromUrl) {
    CONFIG.text = customTextFromUrl;
}

function getEffectivePixelRatio() {
    return Math.min(window.devicePixelRatio || 1, performanceRuntime.maxPixelRatioCap);
}

const _simForce = new THREE.Vector3();
const _simReturnVec = new THREE.Vector3();
const _simTargetHome = new THREE.Vector3();
const _simImpulse = new THREE.Vector3();
const _simSpinAxis = new THREE.Vector3();
const _simDeltaRotAxis = new THREE.Vector3();
const _simOffset = new THREE.Vector3();
const _simRotAxisGrid = new THREE.Vector3();
const _simEuler = new THREE.Euler();
const _simFinalQuatRepulsion = new THREE.Quaternion();
const _simFinalQuatWithGlitch = new THREE.Quaternion();
const _quatIdentity = new THREE.Quaternion(0, 0, 0, 1);
const _simFarSim = new THREE.Vector3(1000, 1000, 1000);
const _mousePickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _rayPlaneHit = new THREE.Vector3();

const CRTShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0 },
        'resolution': { value: new THREE.Vector2() },
        'curvature': { value: SHADER_CONFIG.crt.curvature },
        'lineWidth': { value: SHADER_CONFIG.crt.lineWidth },
        'scanlineIntensity': { value: SHADER_CONFIG.crt.scanlineIntensity },
        'scanlineCount': { value: SHADER_CONFIG.crt.scanlineCount },
        'vignetteStrength': { value: SHADER_CONFIG.crt.vignetteStrength },
        'vignetteRadius': { value: SHADER_CONFIG.crt.vignetteRadius },
        'chromaticAberration': { value: SHADER_CONFIG.crt.chromaticAberration },
        'flickerAmount': { value: SHADER_CONFIG.crt.flickerAmount }
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,

    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 resolution;
        uniform vec2 curvature;
        uniform float lineWidth;
        uniform float scanlineIntensity;
        uniform float scanlineCount;
        uniform float vignetteStrength;
        uniform float vignetteRadius;
        uniform float chromaticAberration;
        uniform float flickerAmount;
        varying vec2 vUv;

        vec2 curve(vec2 uv) {
            uv = (uv - 0.5) * 2.0;
            uv *= 1.1;
            uv.x *= 1.0 + pow((abs(uv.y) * curvature.x), 2.0);
            uv.y *= 1.0 + pow((abs(uv.x) * curvature.y), 2.0);
            uv  = (uv / 2.0) + 0.5;
            uv =  uv * 0.95 + 0.05;
            return uv;
        }

        void main() {
            vec2 uv = curve(vUv);
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }

            vec2 uvC = uv - 0.5;
            float dist = length(uvC) * 2.0;
            vec2 dir = normalize(uvC);
            vec2 uvR = uv + dir * chromaticAberration * dist;
            vec2 uvB = uv - dir * chromaticAberration * dist;

            float r = texture2D(tDiffuse, uvR).r;
            float g = texture2D(tDiffuse, uv).g;
            float b = texture2D(tDiffuse, uvB).b;
            float a = texture2D(tDiffuse, uv).a;
            vec4 color = vec4(r, g, b, a);

            float scanline = sin(uv.y * scanlineCount * 3.14159) * 0.5 + 0.5;
            color.rgb *= 1.0 - scanline * scanlineIntensity;

            float vig = 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
            vig = pow(vig, vignetteStrength);
            float vigRad = smoothstep(vignetteRadius, vignetteRadius - 0.2, dist);
            color.rgb *= mix(vig, 1.0, vigRad);

            float flicker = 1.0 - flickerAmount * (sin(time * 50.0) * 0.5 + 0.5);
            color.rgb *= flicker;

            gl_FragColor = color;
        }
    `
};

// Configuration and State imported from config.js

// State
let scene, camera, renderer, composer, crtPass, bloomPass;
let saoPass = null;
let keyDirectionalLight = null;
let fillDirectionalLight = null;
let meshRegistry = {}; // { shape: { top: Mesh, kek: Mesh } }
let innerCubeInstancedMesh;
let dummy = new THREE.Object3D();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2(-1000, -1000); // Start off-screen
let cubeGroups = []; // Stores rigid body groups
let innerCubeParticles = []; // Stores individual inner cube particles
let defaultBoxMaterial, glassMaterial, goldMaterial;
let isAlternateMaterial = false;
let debugMesh; // Visual debug cursor
let mouseVelocity = new THREE.Vector3();
let lastMousePos = new THREE.Vector2();
let lastMouseTime = 0;
let lastTarget = new THREE.Vector3();
let loadedFont = null; // Store loaded font globally
let loadedFontRegular = null; // Store loaded regular font globally

// Background video (ogromne wideo za TOPKEK)
let backgroundVideoEl = null;
let backgroundVideoTexture = null;
/** Drugi VideoTexture z mapping equirect — nie ruszamy UV płaszczyzny tła */
let backgroundVideoTextureEnv = null;
let backgroundVideoMesh = null;
/** Użytkownik świadomie wstrzymał wideo tła — nie wymuszaj odtwarzania po loaderze. */
let backgroundVideoUserPaused = false;
let backgroundVideoPlayToggleBtn = null;

// Frame-sync helpers for video-based lighting (reduces perceived lag)
let videoFrameCounter = 0;
let lastHemiSampleFrameCounter = -1;
let lastPmremSampleFrameCounter = -1;
let videoFrameCallbackStarted = false;

// Video IBL (fake GI) + HDRI fallback
let hdriEnvironmentTexture = null;
let videoIblPmremGenerator = null;
let videoIblEnvScene = null;
let videoIblLastPmremTime = 0;
let videoIblLastHemisphereSampleTime = 0;
let videoIblPmremRenderTarget = null;
let videoIblSamplingCanvas = null;
let videoIblSamplingCtx = null;
let videoHemisphereLight = null;
let videoAmbientLight = null;
/** PMREM env sphere material — same mapColorGain as background plane for brighter video → IBL bake */
let videoIblEnvSphereMaterial = null;

// Active profile for currently playing background video (used for per-BG intensity "emission" tuning).
let activeBackgroundVideoSource = null;
let currentBackgroundBpm = CONFIG.backgroundVideo?.bpmControl?.defaultBpm ?? CONFIG.backgroundVideo?.bpmControl?.baseBpm ?? 120;
let backgroundBeatSegments = [];
let backgroundBeatLastStep = -1;

function getActiveHemisphereCfg() {
    const base = CONFIG.backgroundVideo?.hemisphereFromVideo ?? {};
    const override = activeBackgroundVideoSource?.hemisphereFromVideo ?? {};
    return { ...base, ...override };
}

function getActiveEnvMapIntensityBoost() {
    const base = CONFIG.backgroundVideo?.envMapIntensityBoost ?? {};
    const override = activeBackgroundVideoSource?.envMapIntensityBoost ?? {};
    return { ...base, ...override };
}

function getActiveMapColorGain() {
    const override = activeBackgroundVideoSource?.mapColorGain;
    const base = CONFIG.backgroundVideo?.mapColorGain;
    const raw = override != null && override !== '' ? Number(override) : Number(base);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.min(3, Math.max(0.25, raw));
}

function applyBackgroundVideoMapColorGain() {
    const g = getActiveMapColorGain();
    if (backgroundVideoMesh?.material?.color) {
        backgroundVideoMesh.material.color.setScalar(g);
    }
    if (videoIblEnvSphereMaterial?.color) {
        videoIblEnvSphereMaterial.color.setScalar(g);
    }
}

function normalizeBackgroundVideoSrc(src) {
    return typeof src === 'string' ? src.replace(/^\//, '') : '';
}

function getBackgroundVideoLabel(src) {
    const normalized = normalizeBackgroundVideoSrc(src);
    if (!normalized) return 'Unknown BG';
    const parts = normalized.split('/');
    return parts[parts.length - 1] || normalized;
}

function getBackgroundPlaybackRateFromBpm(bpm) {
    const bgCfg = CONFIG.backgroundVideo;
    const bpmCfg = bgCfg?.bpmControl ?? {};
    const baseBpm = Number(bpmCfg.baseBpm) || 120;
    const safeBpm = Number(bpm) || baseBpm;
    return Math.max(0.1, safeBpm / baseBpm);
}

function applyBackgroundVideoPlaybackRate(bpm) {
    currentBackgroundBpm = Number(bpm) || currentBackgroundBpm;
    if (!backgroundVideoEl) return;
    backgroundVideoEl.playbackRate = getBackgroundPlaybackRateFromBpm(currentBackgroundBpm);
}

function updateBackgroundVideoPlayToggleUi() {
    if (!backgroundVideoPlayToggleBtn || !backgroundVideoEl) return;
    const paused = backgroundVideoEl.paused;
    backgroundVideoPlayToggleBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    const resume = 'Wznów wideo tła';
    const pause = 'Wstrzymaj wideo tła';
    backgroundVideoPlayToggleBtn.title = paused ? resume : pause;
    backgroundVideoPlayToggleBtn.setAttribute('aria-label', paused ? resume : pause);
    backgroundVideoPlayToggleBtn.textContent = paused ? '▶' : '⏸';
}

function updateBackgroundBeatIndicator(elapsedSeconds) {
    if (!Array.isArray(backgroundBeatSegments) || backgroundBeatSegments.length !== 4) return;
    if (backgroundVideoEl && backgroundVideoEl.paused) {
        backgroundBeatSegments.forEach((segment) => segment.classList.remove('is-active'));
        backgroundBeatLastStep = -1;
        return;
    }
    const safeBpm = Math.max(1, Number(currentBackgroundBpm) || 120);
    const beatSec = 60 / safeBpm;
    const step = Math.floor(elapsedSeconds / beatSec) % 4;
    if (step === backgroundBeatLastStep) return;
    backgroundBeatLastStep = step;
    backgroundBeatSegments.forEach((segment, index) => {
        segment.classList.toggle('is-active', index === step);
    });
}

function setBackgroundVideoBySrc(nextSrc) {
    const bgCfg = CONFIG.backgroundVideo;
    const sources = bgCfg?.sources;
    if (!backgroundVideoEl || !Array.isArray(sources) || sources.length === 0 || !nextSrc) return;

    const normalizedTarget = normalizeBackgroundVideoSrc(nextSrc);
    const next = sources.find(s => normalizeBackgroundVideoSrc(s?.src) === normalizedTarget);
    if (!next?.src) return;

    activeBackgroundVideoSource = next;
    backgroundVideoUserPaused = false;
    backgroundVideoEl.src = next.src;
    backgroundVideoEl.load();
    applyBackgroundVideoPlaybackRate(currentBackgroundBpm);
    backgroundVideoEl.play().catch(() => {});
    updateBackgroundVideoPlayToggleUi();
    videoIblLastPmremTime = 0;
    videoIblLastHemisphereSampleTime = 0;
    lastHemiSampleFrameCounter = -1;
    lastPmremSampleFrameCounter = -1;

    // Apply tuning immediately (without waiting for the next sampling tick).
    applyVideoIblMaterialBoost();
    applyBackgroundVideoMapColorGain();
    const hemiCfg = getActiveHemisphereCfg();
    if (hemiCfg?.enabled && (IS_MOBILE || hemiCfg.always === true) && videoHemisphereLight && videoAmbientLight) {
        videoHemisphereLight.intensity = hemiCfg.intensity ?? 0.85;
        videoAmbientLight.intensity = hemiCfg.ambientIntensity ?? 0.32;
    }
}

function disposeVideoIblPmremTarget() {
    if (videoIblPmremRenderTarget) {
        videoIblPmremRenderTarget.dispose();
        videoIblPmremRenderTarget = null;
    }
}

function sampleVideoColorsToHemisphere(hemiCfg) {
    if (!backgroundVideoEl || !videoHemisphereLight || !videoAmbientLight) return;

    // Even if sampling fails (e.g. tainted canvas), lights must keep their "power".
    const hemiIntensity = hemiCfg.intensity ?? 0.85;
    const ambientIntensity = hemiCfg.ambientIntensity ?? 0.32;
    videoHemisphereLight.intensity = hemiIntensity;
    videoAmbientLight.intensity = ambientIntensity;

    const w = hemiCfg.canvasWidth ?? 32;
    const h = hemiCfg.canvasHeight ?? 64;
    if (!videoIblSamplingCanvas) {
        videoIblSamplingCanvas = document.createElement('canvas');
        videoIblSamplingCtx = videoIblSamplingCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (videoIblSamplingCanvas.width !== w || videoIblSamplingCanvas.height !== h) {
        videoIblSamplingCanvas.width = w;
        videoIblSamplingCanvas.height = h;
    }
    const ctx = videoIblSamplingCtx;
    try {
        ctx.drawImage(backgroundVideoEl, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        const mid = Math.floor(h / 2);
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let nTop = 0;
        let gr = 0;
        let gg = 0;
        let gb = 0;
        let nBot = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const r = d[i];
                const g = d[i + 1];
                const b = d[i + 2];
                if (y < mid) {
                    sr += r;
                    sg += g;
                    sb += b;
                    nTop++;
                } else {
                    gr += r;
                    gg += g;
                    gb += b;
                    nBot++;
                }
            }
        }
        if (nTop < 1 || nBot < 1) return;
        videoHemisphereLight.color.setRGB(sr / nTop / 255, sg / nTop / 255, sb / nTop / 255);
        videoHemisphereLight.groundColor.setRGB(gr / nBot / 255, gg / nBot / 255, gb / nBot / 255);
        videoAmbientLight.color.lerpColors(videoHemisphereLight.color, videoHemisphereLight.groundColor, 0.5);
    } catch (_) {
        /* np. canvas tainted — zostaw poprzednie kolory */
    }
}

function updateVideoBasedLighting(nowMs) {
    const vi = CONFIG.backgroundVideo?.videoIbl;
    const hemiCfg = getActiveHemisphereCfg();
    // Hemisphere/Ambient (fallback fill) powinny działać nawet jeśli PMREM jest wyłączony.
    if (!backgroundVideoEl || !renderer) return;
    if (backgroundVideoEl.readyState < 2) return;

    const usePmrem = Boolean(
        vi?.enabled &&
        backgroundVideoTextureEnv &&
        videoIblPmremGenerator &&
        videoIblEnvScene &&
        vi.usePmrem !== false &&
        !IS_MOBILE &&
        vi.replaceSceneEnvironment !== false
    );
    const useHemisphere = Boolean(
        hemiCfg?.enabled &&
        videoHemisphereLight &&
        videoAmbientLight &&
        (IS_MOBILE || hemiCfg.always === true)
    );

    if (useHemisphere) {
        const hw = hemiCfg.intervalMs || 400;
        if (nowMs - videoIblLastHemisphereSampleTime >= hw) {
            const frameChanged = videoFrameCounter !== lastHemiSampleFrameCounter;
            const shouldSample = !videoFrameCallbackStarted || frameChanged;
            if (shouldSample) {
                videoIblLastHemisphereSampleTime = nowMs;
                if (videoFrameCallbackStarted) lastHemiSampleFrameCounter = videoFrameCounter;
                sampleVideoColorsToHemisphere(hemiCfg);
            }
        }
    }

    if (!usePmrem) return;

    const pw = vi.intervalMs || 320;
    if (pw > 0 && nowMs - videoIblLastPmremTime < pw) return;
    if (videoFrameCallbackStarted && videoFrameCounter === lastPmremSampleFrameCounter) return;
    videoIblLastPmremTime = nowMs;
    if (videoFrameCallbackStarted) lastPmremSampleFrameCounter = videoFrameCounter;

    try {
        const sigmaRaw = vi.sigma ?? 0.04;
        const sigma = Math.min(Math.max(0, sigmaRaw), 0.08);
        if (backgroundVideoTextureEnv) backgroundVideoTextureEnv.needsUpdate = true;
        const newRt = videoIblPmremGenerator.fromScene(videoIblEnvScene, sigma);
        const prev = videoIblPmremRenderTarget;
        videoIblPmremRenderTarget = newRt;
        scene.environment = newRt.texture;
        if (prev && prev !== newRt) prev.dispose();
    } catch (err) {
        console.warn('[VideoIBL] PMREM failed', err);
        if (hdriEnvironmentTexture) scene.environment = hdriEnvironmentTexture;
    }
}

function startVideoFrameCallbackOnce() {
    if (videoFrameCallbackStarted) return;
    if (!backgroundVideoEl || typeof backgroundVideoEl.requestVideoFrameCallback !== 'function') return;
    if (backgroundVideoEl.readyState < 2) return; // Not enough data decoded yet

    videoFrameCallbackStarted = true;
    const v = backgroundVideoEl;
    const onVideoFrame = () => {
        videoFrameCounter++;
        v.requestVideoFrameCallback(onVideoFrame);
    };

    v.requestVideoFrameCallback(onVideoFrame);
}

function initBackgroundVideoIbl() {
    const vi = CONFIG.backgroundVideo?.videoIbl;
    if (!vi?.enabled || !renderer || !backgroundVideoEl) return;

    if (!IS_MOBILE && vi.usePmrem !== false && vi.replaceSceneEnvironment !== false) {
        videoIblPmremGenerator = new THREE.PMREMGenerator(renderer);
        backgroundVideoTextureEnv = new THREE.VideoTexture(backgroundVideoEl);
        backgroundVideoTextureEnv.mapping = THREE.EquirectangularReflectionMapping;
        backgroundVideoTextureEnv.minFilter = THREE.LinearFilter;
        backgroundVideoTextureEnv.magFilter = THREE.LinearFilter;
        if ('colorSpace' in backgroundVideoTextureEnv) {
            backgroundVideoTextureEnv.colorSpace = THREE.SRGBColorSpace;
        }

        videoIblEnvScene = new THREE.Scene();
        const sphereGeo = new THREE.SphereGeometry(200, 48, 24);
        /** toneMapped: false — inaczej ACES na rendererze „gasi” LDR wideo w bake PMREM (prawie czarne env). */
        const envSphereMat = new THREE.MeshBasicMaterial({
            map: backgroundVideoTextureEnv,
            side: THREE.BackSide,
            toneMapped: false
        });
        videoIblEnvSphereMaterial = envSphereMat;
        videoIblEnvScene.add(new THREE.Mesh(sphereGeo, envSphereMat));
    } else {
        videoIblEnvSphereMaterial = null;
    }

    const hemiCfg = getActiveHemisphereCfg();
    if (hemiCfg?.enabled) {
        // Important: even if sampling colors fails (CORS/tainted canvas), lights must still have power.
        const hemiIntensity = hemiCfg.intensity ?? 0.85;
        const ambientIntensity = hemiCfg.ambientIntensity ?? 0.32;
        videoHemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, hemiIntensity);
        videoAmbientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
        scene.add(videoHemisphereLight);
        scene.add(videoAmbientLight);
    }
}

/** Restore envMapIntensity on letter materials to `MATERIALS` defaults (after disabling video IBL boost). */
function resetLetterMaterialsEnvMapIntensityToDefaults() {
    if (defaultBoxMaterial && MATERIALS.defaultBox?.envMapIntensity != null) {
        defaultBoxMaterial.envMapIntensity = MATERIALS.defaultBox.envMapIntensity;
    }
    if (glassMaterial && MATERIALS.glass?.envMapIntensity != null) {
        glassMaterial.envMapIntensity = MATERIALS.glass.envMapIntensity;
    }
    if (goldMaterial && MATERIALS.gold?.envMapIntensity != null) {
        goldMaterial.envMapIntensity = MATERIALS.gold.envMapIntensity;
    }
    if (innerCubeInstancedMesh?.material && MATERIALS.innerCubes?.envMapIntensity != null) {
        innerCubeInstancedMesh.material.envMapIntensity = MATERIALS.innerCubes.envMapIntensity;
    }
}

/**
 * Runtime toggle: video-based fake GI (PMREM → scene.environment + boosted envMapIntensity) and hemisphere/ambient from video colors.
 * Does not remove HDRI fallback; disabling zeros video fill lights and resets material env boosts.
 */
function setFakeGiEnabled(wantOn) {
    const vi = CONFIG.backgroundVideo?.videoIbl;
    const hemiRoot = CONFIG.backgroundVideo?.hemisphereFromVideo;
    if (!vi || !hemiRoot) return ['Brak CONFIG.backgroundVideo.videoIbl / hemisphereFromVideo.'];

    if (wantOn) {
        vi.enabled = true;
        hemiRoot.enabled = true;
        disposeVideoIblPmremTarget();
        if (scene && hdriEnvironmentTexture) scene.environment = hdriEnvironmentTexture;
        videoIblLastPmremTime = 0;
        lastPmremSampleFrameCounter = -1;
        if (videoHemisphereLight && videoAmbientLight) {
            const h = getActiveHemisphereCfg();
            videoHemisphereLight.intensity = h.intensity ?? 0.85;
            videoAmbientLight.intensity = h.ambientIntensity ?? 0.32;
        }
        applyVideoIblMaterialBoost();
        applyBackgroundVideoMapColorGain();
        return ['Fake GI ON (video PMREM + hemisphere / ambient z klatki wideo, boost envMapIntensity).'];
    }

    vi.enabled = false;
    hemiRoot.enabled = false;
    disposeVideoIblPmremTarget();
    if (scene && hdriEnvironmentTexture) scene.environment = hdriEnvironmentTexture;
    if (videoHemisphereLight) videoHemisphereLight.intensity = 0;
    if (videoAmbientLight) videoAmbientLight.intensity = 0;
    resetLetterMaterialsEnvMapIntensityToDefaults();
    applyBackgroundVideoMapColorGain();
    return ['Fake GI OFF (scene.environment → HDRI; światła wideo wyłączone; envMapIntensity jak w MATERIALS).'];
}

function getFakeGiStatusLines() {
    const vi = CONFIG.backgroundVideo?.videoIbl;
    const hemiRoot = CONFIG.backgroundVideo?.hemisphereFromVideo;
    const lines = [
        `fake GI: videoIbl.enabled=${!!vi?.enabled} hemisphereFromVideo.enabled=${!!hemiRoot?.enabled}`,
        `  PMREM: usePmrem=${vi?.usePmrem !== false} replaceSceneEnvironment=${vi?.replaceSceneEnvironment !== false} mobile=${IS_MOBILE}`
    ];
    if (videoHemisphereLight) {
        lines.push(`  videoHemisphere: intensity=${videoHemisphereLight.intensity.toFixed(1.2)}`);
    }
    if (videoAmbientLight) {
        lines.push(`  videoAmbient: intensity=${videoAmbientLight.intensity.toFixed(1.22)}`);
    }
    lines.push(`  scene.environment: ${scene?.environment ? 'yes' : 'no'}`);
    if (defaultBoxMaterial) {
        lines.push(`  defaultBox.envMapIntensity=${defaultBoxMaterial.envMapIntensity?.toFixed?.(2) ?? defaultBoxMaterial.envMapIntensity}`);
    }
    return lines;
}

function applyVideoIblMaterialBoost() {
    const vi = CONFIG.backgroundVideo?.videoIbl;
    const boost = getActiveEnvMapIntensityBoost();
    if (!vi?.enabled || !backgroundVideoEl || !boost) return;

    const applyStd = (mat, matKey) => {
        if (!mat) return;
        const b = boost[matKey];
        if (b == null) return;
        const base = MATERIALS[matKey]?.envMapIntensity ?? 1;
        mat.envMapIntensity = base * b;
    };

    applyStd(defaultBoxMaterial, 'defaultBox');
    applyStd(glassMaterial, 'glass');
    applyStd(goldMaterial, 'gold');
    if (innerCubeInstancedMesh?.material) applyStd(innerCubeInstancedMesh.material, 'innerCubes');

    const hv = boost.vajbujBgCubes;
    if (hv != null && vajbujState.bgCubesMesh?.material) {
        const base = VAJBUJ_CONFIG.bgCubeMaterial?.envMapIntensity ?? 1;
        vajbujState.bgCubesMesh.material.envMapIntensity = base * hv;
    }

    const hm = boost.mysenBgCubes;
    if (hm != null && mysenState.bgCubesMesh?.material) {
        const baseM = MYSEN_CONFIG.bgCubeMaterial?.envMapIntensity ?? 1;
        mysenState.bgCubesMesh.material.envMapIntensity = baseM * hm;
    }

    const hh = boost.heart;
    if (hh != null && motionDesignState?.heartMesh?.material) {
        motionDesignState.heartMesh.material.envMapIntensity = 0.4 * hh;
    }
}

// Portfolio (video thumbnails below PRODUCTIONS)
let portfolioState = {
    frameCubes: [],
    frameMesh: null,
    planeMeshes: [],
    items: [],
    hoveredIndex: -1,
    group: null,
    initialized: false,
    visible: false
};

// Portfolio scene transition state (after click "> Animation portfolio")
let portfolioSceneActive = false;
let portfolioScenePhase = 'idle'; // 'idle' | 'camera_move' | 'subtitle_transform' | 'windows_fly_in' | 'floating' | 'flash'
let portfolioScenePhaseStartTime = 0;
let portfolioCameraStart = null; // { focus: Vector3, radius, angle, verticalAngle } set when entering camera_move

let motionDesignState = null; // { targets: Vector3[], heartCenter: Vector3, productionsAssignments: Map, extraGroups: [], heartCubes: [], recyclingDone, spawnDone, heartDone }
let motionDesignExtraMesh = null;
let motionDesignHeartMesh = null;
let motionDesignFlashStart = 0;

const HEART_PIXEL_MASK = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0]
];
let portfolioWindowsFlyInInitDone = false;
let portfolioSceneStartTime = 0;

// VAJBUJ Mode State
let vajbujState = {
    active: false,
    audio: null,
    startTime: 0,
    words: [], // Array of word objects with mesh, timing, state
    currentLineIndex: 0,
    currentWordIndex: 0,
    completedLines: 0, // Number of fully assembled lines
    lineShiftY: 0, // Smooth vertical offset for shifting
    displayedLines: [], // Lines currently on screen
    bgCubes: [], // Background animated cubes
    bgCubesMesh: null,
    lastActivityTime: Date.now(),
    isStopping: false,
    voxelCache: {}, // Cache for pre-calculated voxel data
    generationQueue: [] // Queue for background processing
};

let vajbujFinalizeTimerId = null;
let mysenFinalizeTimerId = null;

/** Hide right-panel menu + left HUD during VAJBUJ/MYSEN; keep #topkek-terminal-shell visible. */
function setMusicShowcaseMenuUiHidden(hidden) {
    document.body.classList.toggle('music-showcase-ui-minimal', !!hidden);
}

// MYSEN remix mode state (separate voxel cache from VAJBUJ)
let mysenState = {
    active: false,
    audio: null,
    startTime: 0,
    words: [],
    currentLineIndex: 0,
    currentWordIndex: 0,
    completedLines: 0,
    lineShiftY: 0,
    displayedLines: [],
    bgCubes: [],
    bgCubesMesh: null,
    lastActivityTime: Date.now(),
    isStopping: false,
    voxelCache: {},
    generationQueue: [],
    playbackDurationSec: null,
    _fadeTimeoutId: null,
    _stopTimeoutId: null,
    /** Parsed lines from timestampLyricsUrl (fetch). */
    timestampLyricsParsed: [],
    /** First line index where timestamp / random-fly lyrics start. */
    firstTimestampLineIndex: 99999,
    savedBgSrcForMysen: null,
    /** Promise — czekamy w startMysenMode, żeby prepareMysenWords miał timestampy. */
    _timestampLoadPromise: null,
    /** Parsed `wordAnimationUrl` (defaults + overrides). */
    wordAnimationDoc: null,
    _wordAnimationLoadPromise: null,
    /** Shallow merge: MYSEN_CONFIG + JSON `defaults` (tylko dozwolone klucze), ustawiane przy starcie MYSEN. */
    mergedMysenConfig: null
};

const _mysenFrustumTmp = new THREE.Vector3();
const _mysenFrustumDir = new THREE.Vector3();

function clearMysenPlaybackTimers() {
    if (mysenState._fadeTimeoutId) {
        clearTimeout(mysenState._fadeTimeoutId);
        mysenState._fadeTimeoutId = null;
    }
    if (mysenState._stopTimeoutId) {
        clearTimeout(mysenState._stopTimeoutId);
        mysenState._stopTimeoutId = null;
    }
}

/** Keys from JSON `defaults` merged into effective MYSEN config (lyric animation tuning). */
const MYSEN_WORD_ANIM_SCALAR_KEYS = [
    'wordAssemblyDuration',
    'lyricsStartDelay',
    'scatterRadius',
    'lyricsOffsetY',
    'lineSpacing',
    'wordSpacing',
    'wordSize',
    'wordHeight',
    'wordThickness',
    'slowPhaseEnd',
    'slowPhaseSpeed'
];

const MYSEN_WORD_ANIM_NEST_KEYS = [
    'randomFly',
    'spread',
    'introOutroSpread',
    'lyricSpread',
    'introAssembly',
    'lyricAssembly'
];

const MYSEN_MATCH_AT_EPSILON = 0.02;

/** @param {unknown} v */
function parseMysenAnimColor(v) {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        let s = v.trim();
        if (s.startsWith('#')) s = s.slice(1);
        const n = parseInt(s, 16);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function buildMysenEffectiveConfig() {
    const doc = mysenState.wordAnimationDoc;
    if (!doc || typeof doc !== 'object' || !doc.defaults || typeof doc.defaults !== 'object') {
        return MYSEN_CONFIG;
    }
    const d = doc.defaults;
    const out = { ...MYSEN_CONFIG };
    for (let i = 0; i < MYSEN_WORD_ANIM_SCALAR_KEYS.length; i++) {
        const k = MYSEN_WORD_ANIM_SCALAR_KEYS[i];
        if (d[k] !== undefined) out[k] = d[k];
    }
    for (let i = 0; i < MYSEN_WORD_ANIM_NEST_KEYS.length; i++) {
        const k = MYSEN_WORD_ANIM_NEST_KEYS[i];
        const baseNest = MYSEN_CONFIG[k];
        if (d[k] != null && typeof d[k] === 'object' && baseNest != null && typeof baseNest === 'object') {
            out[k] = { ...baseNest, ...d[k] };
        } else if (d[k] != null && typeof d[k] === 'object') {
            out[k] = { ...d[k] };
        }
    }
    return out;
}

/**
 * Mutates merged lyric items before `prepareMusicLyricWords` (scale → poprawne width / voxele).
 * @param {object[]} merged
 * @param {unknown} overridesRaw
 */
function applyMysenWordAnimationToMergedLyrics(merged, overridesRaw) {
    if (!Array.isArray(merged) || !Array.isArray(overridesRaw) || !overridesRaw.length) return;
    const startT = MYSEN_CONFIG.audioStartTime || 0;
    let globalIdx = 0;
    for (let i = 0; i < merged.length; i++) {
        const item = merged[i];
        if (item.lineBreak) continue;

        const atSrc = Number.isFinite(item.atSourceSec)
            ? item.atSourceSec
            : startT + (Number.isFinite(item.at) ? item.at : 0);

        for (let oi = 0; oi < overridesRaw.length; oi++) {
            const o = overridesRaw[oi];
            if (!o || typeof o !== 'object') continue;
            const m = o.match;
            if (!m || typeof m !== 'object') continue;
            let hit = false;
            if (Number.isFinite(m.globalIndex) && m.globalIndex === globalIdx) {
                hit = true;
            } else if (typeof m.text === 'string' && Number.isFinite(m.at)) {
                if (
                    Number.isFinite(atSrc) &&
                    Math.abs(atSrc - m.at) < MYSEN_MATCH_AT_EPSILON &&
                    item.text === m.text
                ) {
                    hit = true;
                }
            }
            if (!hit) continue;

            const sp = o.spawn;
            if (sp && typeof sp === 'object') {
                if (Number.isFinite(sp.x) && Number.isFinite(sp.y) && Number.isFinite(sp.z)) {
                    item.spawnX = sp.x;
                    item.spawnY = sp.y;
                    item.spawnZ = sp.z;
                }
            }
            if (Number.isFinite(o.offsetX)) item.offsetX = (item.offsetX || 0) + o.offsetX;
            if (Number.isFinite(o.offsetY)) item.offsetY = (item.offsetY || 0) + o.offsetY;
            if (Number.isFinite(o.offsetZ)) item.offsetZ = (item.offsetZ || 0) + o.offsetZ;

            const cs = parseMysenAnimColor(o.colorStart);
            const ce = parseMysenAnimColor(o.colorEnd);
            if (cs != null) item._assemblyColorStart = cs;
            if (ce != null) {
                item._assemblyColorEnd = ce;
                item.color = ce;
            }

            if (Number.isFinite(o.assembledScale) && o.assembledScale > 0) item.assembledScale = o.assembledScale;
            if (Number.isFinite(o.scale) && o.scale > 0) item.scale = o.scale;
            break;
        }
        globalIdx++;
    }
}

async function ensureMysenWordAnimationLoaded() {
    if (!MYSEN_CONFIG.wordAnimationEnabled || !MYSEN_CONFIG.wordAnimationUrl) return;
    try {
        await mysenState._wordAnimationLoadPromise;
    } catch (e) {
        console.warn('[MYSEN] Word animation await failed:', e);
    }
}

function queueMysenVoxelPregenForPreparedWords(state, lyricsConfig) {
    if (!loadedFontRegular || !state.words?.length) return;
    const seen = new Set();
    const styleSlice = {
        wordSize: lyricsConfig.wordSize,
        wordHeight: lyricsConfig.wordHeight,
        wordThickness: lyricsConfig.wordThickness
    };
    state.words.forEach((w) => {
        if (!w.text) return;
        const sc = w.scale || 1;
        const key = `${w.text}§${sc}`;
        if (seen.has(key)) return;
        seen.add(key);
        state.generationQueue.push(
            createVoxelGenerationTask(w.text, sc, loadedFontRegular, state.voxelCache, styleSlice)
        );
    });
}

/** @returns {{ text: string, at: number, color?: number }[]} */
function parseMysenTimestampLyricsFile(text) {
    const out = [];
    if (!text || typeof text !== 'string') return out;
    const re = /^\s*([\d.]+)\s*-->\s*([\d.]+)\s*\|\s*(.+)$/;
    // CRLF: split(/\n/) leaves trailing \r; . in regex does not match \r, so lines never matched.
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(re);
        if (!m) continue;
        const start = parseFloat(m[1]);
        const label = m[3].trim();
        if (!label || /^muzyka$/i.test(label)) continue;
        if (!Number.isFinite(start)) continue;
        out.push({ text: label, at: start });
    }
    return out;
}

/** Highest lineIndex that would be assigned to a word in this lyric list (no trailing lineBreak after last word). */
function lastFilledLineIndexInLyrics(lyrics) {
    let currentLineIdx = 0;
    let maxL = -1;
    if (!Array.isArray(lyrics)) return -1;
    for (let i = 0; i < lyrics.length; i++) {
        const item = lyrics[i];
        if (item.lineBreak) currentLineIdx++;
        else maxL = Math.max(maxL, currentLineIdx);
    }
    return maxL;
}

/** Merge intro + timestamp words; opcjonalnie grupy w jednym wierszu (`mysenTimestampLineGroups`). */
function buildMergedMysenLyrics() {
    const intro = MYSEN_CONFIG.introLyrics || MYSEN_CONFIG.lyrics;
    const merged = intro.slice();
    const ts = mysenState.timestampLyricsParsed;
    const startT = MYSEN_CONFIG.audioStartTime || 0;
    const grpCfg = MYSEN_CONFIG.mysenTimestampLineGroups;
    const groups =
        grpCfg && grpCfg.enabled !== false && Array.isArray(grpCfg.groups) ? grpCfg.groups : null;

    if (MYSEN_CONFIG.timestampLyricsEnabled && Array.isArray(ts) && ts.length) {
        merged.push({ lineBreak: true });
        let i = 0;
        while (i < ts.length) {
            const row = ts[i];
            const gr = findMysenTsLineGroup(row.at, groups);

            if (!gr) {
                merged.push({
                    text: row.text,
                    color: row.color ?? MYSEN_CONFIG.timestampWordColor,
                    at: row.at - startT,
                    atSourceSec: row.at
                });
                merged.push({ lineBreak: true });
                i++;
                continue;
            }

            while (i < ts.length && findMysenTsLineGroup(ts[i].at, groups) === gr) {
                const r = ts[i];
                merged.push({
                    text: r.text,
                    color: r.color ?? MYSEN_CONFIG.timestampWordColor,
                    at: r.at - startT,
                    atSourceSec: r.at,
                    lineVanishAtSourceSec: gr.lineVanishAtMediaSec,
                    mysenGroupedLine: true
                });
                i++;
            }
            merged.push({ lineBreak: true });
        }
    }
    return merged;
}

function queueMysenTimestampVoxelPregen() {
    if (!loadedFontRegular || !mysenState.timestampLyricsParsed?.length) return;
    const items = mysenState.timestampLyricsParsed.map((row) => ({ text: row.text, scale: 1 }));
    queueLyricVoxelPregeneration(items, loadedFontRegular, mysenState, MYSEN_CONFIG, 'MYSEN-ts');
}

function sampleMysenRandomFrustumPoint(distance) {
    const m = MYSEN_CONFIG.randomFly?.ndcMargin ?? 0.1;
    const ndcX = (Math.random() * 2 - 1) * (1 - m);
    const ndcY = (Math.random() * 2 - 1) * (1 - m);
    _mysenFrustumTmp.set(ndcX, ndcY, 0.5);
    _mysenFrustumTmp.unproject(camera);
    _mysenFrustumDir.subVectors(_mysenFrustumTmp, camera.position).normalize().multiplyScalar(distance);
    return camera.position.clone().add(_mysenFrustumDir);
}

/** FNV-1a–style hash for stable spawn seeds (MYSEN timestamp words). */
function mysenHashSeedU32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/** Mulberry32 PRNG in [0, 1). */
function mysenMulberry32Next(stateRef) {
    let t = (stateRef.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Jak `sampleMysenRandomFrustumPoint`, ale odległość + NDC z jednego strumienia Mulberry32 (stabilny spawn per seed).
 */
function sampleMysenSeededRandomFlySpawn(d0, d1, ndcMargin, seedU32) {
    const stateRef = { s: seedU32 >>> 0 };
    const dist = d0 + mysenMulberry32Next(stateRef) * Math.max(0.01, d1 - d0);
    const m = ndcMargin ?? 0.1;
    const ndcX = (mysenMulberry32Next(stateRef) * 2 - 1) * (1 - m);
    const ndcY = (mysenMulberry32Next(stateRef) * 2 - 1) * (1 - m);
    _mysenFrustumTmp.set(ndcX, ndcY, 0.5);
    _mysenFrustumTmp.unproject(camera);
    _mysenFrustumDir.subVectors(_mysenFrustumTmp, camera.position).normalize().multiplyScalar(dist);
    return camera.position.clone().add(_mysenFrustumDir);
}

/**
 * @param {number} atMediaSec
 * @param {object[]|undefined} groups
 * @returns {object|null}
 */
function findMysenTsLineGroup(atMediaSec, groups) {
    if (!groups || !groups.length) return null;
    for (let i = 0; i < groups.length; i++) {
        const gr = groups[i];
        const lo = gr.tMin;
        const hi = gr.tMax;
        if (Number.isFinite(lo) && Number.isFinite(hi) && atMediaSec >= lo && atMediaSec <= hi) {
            return gr;
        }
    }
    return null;
}

async function ensureMysenTimestampsLoaded() {
    if (!MYSEN_CONFIG.timestampLyricsEnabled || !MYSEN_CONFIG.timestampLyricsUrl) return;
    try {
        if (!mysenState._timestampLoadPromise) {
            mysenState._timestampLoadPromise = fetch(MYSEN_CONFIG.timestampLyricsUrl)
                .then((r) => (r.ok ? r.text() : ''))
                .then((text) => {
                    mysenState.timestampLyricsParsed = parseMysenTimestampLyricsFile(text);
                    if (mysenState.timestampLyricsParsed.length) {
                        console.log('[MYSEN] Loaded', mysenState.timestampLyricsParsed.length, 'timestamp lyric tokens');
                    }
                    queueMysenTimestampVoxelPregen();
                });
        }
        await mysenState._timestampLoadPromise;
    } catch (e) {
        console.warn('[MYSEN] Timestamp lyrics fetch failed:', e);
    }
}

function mysenHideBackgroundVideoWhileActive() {
    if (MYSEN_CONFIG.showBackgroundVideoDuringMysen === true) return false;
    return MYSEN_CONFIG.hideBackgroundVideo === true;
}

/** Length of the played window in seconds (from audioStartTime), or null if unknown. */
function resolveMysenFragmentDurationSec(audio, config = MYSEN_CONFIG) {
    const startT = config.audioStartTime || 0;
    const endT = config.audioEndTime;
    if (endT != null && Number.isFinite(endT) && endT > startT) {
        return endT - startT;
    }
    const d = audio?.duration;
    if (Number.isFinite(d) && d > startT) {
        return Math.max(0.01, d - startT);
    }
    return null;
}

function scheduleMysenPlaybackEnd(audio) {
    clearMysenPlaybackTimers();

    const runSchedule = () => {
        if (!mysenState.active) return;
        const startT = MYSEN_CONFIG.audioStartTime || 0;
        const fragmentLen = resolveMysenFragmentDurationSec(audio, MYSEN_CONFIG);
        if (!Number.isFinite(fragmentLen) || fragmentLen <= 0) {
            console.warn('[MYSEN] Could not resolve playback length; retry when metadata loads.');
            return;
        }

        mysenState.playbackDurationSec = fragmentLen;

        const endMedia = startT + fragmentLen;
        const cur = audio.currentTime;
        const remain = Math.max(0.05, endMedia - cur);
        const fadeMs = Math.max(0, (remain - MYSEN_CONFIG.fadeOutDuration) * 1000);
        const stopMs = remain * 1000;

        mysenState._fadeTimeoutId = setTimeout(() => {
            mysenState._fadeTimeoutId = null;
            if (!mysenState.active) return;
            fadeAudio(audio, audio.volume, 0, MYSEN_CONFIG.fadeOutDuration);
        }, fadeMs);

        mysenState._stopTimeoutId = setTimeout(() => {
            mysenState._stopTimeoutId = null;
            if (!mysenState.active) return;
            stopMysenMode();
        }, stopMs);
    };

    if (Number.isFinite(audio.duration) && audio.duration > 0) {
        runSchedule();
    } else {
        audio.addEventListener('loadedmetadata', () => runSchedule(), { once: true });
    }
}

/** Hide TOPKEK shell + inner instanced mesh (and optionally background video) for music-only modes. */
function setMainTopkekSceneVisible(visible, opts = {}) {
    const hideVideo = opts.hideBackgroundVideo === true;
    Object.values(meshRegistry).forEach((entry) => {
        if (entry.top) entry.top.visible = visible;
        if (entry.kek) entry.kek.visible = visible;
    });
    if (innerCubeInstancedMesh) innerCubeInstancedMesh.visible = visible;
    if (backgroundVideoMesh) {
        if (visible) {
            // Always show BG video when restoring the main scene (avoids stale visible=false after MYSEN
            // if hideBackgroundVideo was toggled or opts omitted — that killed emissive fill / perceived “blue”).
            backgroundVideoMesh.visible = true;
            if (backgroundVideoEl && !backgroundVideoUserPaused) {
                backgroundVideoEl.play().catch(() => {});
            }
        } else if (hideVideo) {
            backgroundVideoMesh.visible = false;
        }
    }
}

// Camera Rotation & Pan State
let isDragging = false;
let isPanning = false;
let previousMouseX = 0;
let previousMouseY = 0;
let cameraAngle = 0;
let cameraFocusPoint = new THREE.Vector3(0, 0, 0);
let targetCameraAngle = 0; // Target angle for smoothing
let cameraVerticalAngle = 0;
let targetCameraVerticalAngle = 0;
let cameraRadius = CONFIG.initialZoom;
let targetCameraRadius = CONFIG.initialZoom;
const MAX_ANGLE = Math.PI / 4; // 45 degrees

// Free Camera State
let controls;
let isFreeCam = false;

// Cinematic Camera State
let isCinematic = false;
let cinematicSwitchTime = 0;
let lastInteractionTime = Date.now();
let isInitialSequence = true;

// Intro fly-in (after loader): radius eases from INTRO_CAMERA_CONFIG.startRadius to CONFIG.initialZoom
let introCameraFlyInActive = false;
let introFlyInStartTime = 0;
let introFlyInStartRadius = INTRO_CAMERA_CONFIG.startRadius;
let postIntroUiRevealed = false;

// Cinematic Camera State (Shots imported)
let cinematicDollySpeed = 0; // Speed of radius change
let currentShotSpeedMult = 0.2; // Speed of orbit

// Camera HUD (top-left panel)
let cameraHudModeEl = null;
let cameraHudPosEl = null;
let cameraHudTgtEl = null;
let perfHudRootEl = null;
let perfHudFpsEl = null;
let perfHudHighEl = null;
let perfHudLowEl = null;
let perfHudCanvasEl = null;
let perfHudCtx = null;
const perfHudState = {
    lastFrameTs: 0,
    lastUiTs: 0,
    smoothedFps: 0,
    samples: []
};

// DOM Elements
const container = document.getElementById('canvas-container');
const loaderContainer = document.getElementById('loader-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-percentage');
const statusText = document.getElementById('loading-text');

// Global State for UI
let currentLang = 'PL';


// Loading State
let loadState = {
    assets: 0,
    generation: 0
};

// Loader simulation state (fake progress + funny rotating messages)
let loaderSim = {
    active: false,
    rafId: null,
    intervalId: null,
    simProgress: 0,
    lastBarWidth: null,
    lastMessage: null
};

function getRealPhase() {
    if (loadState.assets < 100) return 'assets';
    if (loadState.generation < 100) return 'generation';
    return 'ready';
}

function computeRealPercentage() {
    const totalWeight = LOADER_CONFIG.phases.assets.weight + LOADER_CONFIG.phases.generation.weight;
    const currentWeight = (loadState.assets * LOADER_CONFIG.phases.assets.weight / 100) +
        (loadState.generation * LOADER_CONFIG.phases.generation.weight / 100);
    return Math.max(0, Math.min(100, Math.round((currentWeight / totalWeight) * 100)));
}

function setLoaderUI(percentage, text) {
    const pct = Math.max(0, Math.min(100, percentage));
    // Keep bar animating smoothly even if the integer text stays the same.
    const widthStr = `${pct.toFixed(2)}%`;
    if (loaderSim.lastBarWidth !== widthStr) {
        progressFill.style.width = widthStr;
        progressText.innerText = `${Math.round(pct)}%`;
        loaderSim.lastBarWidth = widthStr;
    }
    if (typeof text === 'string') {
        if (statusText.innerText !== text) {
            statusText.innerText = text;
        }
    }
}

function pickLoaderMessage(phase) {
    const pools = LOADER_CONFIG.messages || {};
    const list = pools[phase] || [];
    if (!list.length) return 'Loading...';
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
}

function stopLoaderSimulation({ finalize = false } = {}) {
    if (!loaderSim.active && !finalize) return;

    loaderSim.active = false;
    if (loaderSim.rafId) cancelAnimationFrame(loaderSim.rafId);
    if (loaderSim.intervalId) clearInterval(loaderSim.intervalId);
    loaderSim.rafId = null;
    loaderSim.intervalId = null;

    if (finalize) {
        const readyText = pickLoaderMessage('ready');
        setLoaderUI(100, readyText);
    }
}

function startLoaderSimulation() {
    if (!LOADER_CONFIG.simulation?.enabled) return;

    // If user triggers reload quickly (e.g. custom text), restart simulation cleanly.
    stopLoaderSimulation();

    loaderSim.active = true;
    loaderSim.simProgress = LOADER_CONFIG.simulation?.startPercentage ?? 0;
    loaderSim.lastBarWidth = null;

    const phase = getRealPhase();
    setLoaderUI(loaderSim.simProgress, pickLoaderMessage(phase));

    const softCap = Math.max(loaderSim.simProgress, LOADER_CONFIG.simulation?.softCap ?? 99);
    const tauMs = LOADER_CONFIG.simulation?.tauMs ?? 2400;
    const maxLeadPercentage = LOADER_CONFIG.simulation?.maxLeadPercentage ?? 25;

    let lastT = performance.now();
    const tick = (now) => {
        if (!loaderSim.active) return;
        const dt = Math.max(0, now - lastT);
        lastT = now;

        // Keep the fake progress behind the real loading (with small lead).
        // It still accelerates at the beginning and slows down near the current cap.
        const realPct = computeRealPercentage();
        const dynamicCap = Math.min(softCap, realPct + maxLeadPercentage);

        // Exponential approach to dynamicCap:
        // progress moves fast at start and slows down near the cap.
        const decay = Math.exp(-dt / tauMs);
        loaderSim.simProgress = dynamicCap - (dynamicCap - loaderSim.simProgress) * decay;
        loaderSim.simProgress = Math.min(loaderSim.simProgress, dynamicCap);

        setLoaderUI(loaderSim.simProgress);

        loaderSim.rafId = requestAnimationFrame(tick);
    };
    loaderSim.rafId = requestAnimationFrame(tick);

    const intervalMs = LOADER_CONFIG.simulation?.messageIntervalMs ?? 1000;
    loaderSim.intervalId = setInterval(() => {
        if (!loaderSim.active) return;
        const nextPhase = getRealPhase();
        // Ensure the text changes even if the phase doesn't.
        setLoaderUI(loaderSim.simProgress, pickLoaderMessage(nextPhase));
    }, intervalMs);
}

function updateProgress() {
    // Keep the "real progress" calculation for phase selection,
    // but avoid DOM writes while the fake loader simulation is active.
    const percentage = computeRealPercentage();

    if (loaderSim.active) return;

    progressFill.style.width = `${percentage}%`;
    progressText.innerText = `${percentage}%`;

    if (loadState.assets < 100) {
        statusText.innerText = LOADER_CONFIG.phases.assets.text;
    } else if (loadState.generation < 100) {
        statusText.innerText = LOADER_CONFIG.phases.generation.text;
    } else {
        statusText.innerText = "Ready!";
    }
}

function applyPostIntroUiCssVars() {
    const c = POST_INTRO_UI_CONFIG;
    const r = document.documentElement;
    const px = `${c.slidePx}px`;
    r.style.setProperty('--post-intro-slide-x', px);
    r.style.setProperty('--post-intro-menu-stagger', `${c.menuLineStaggerMs}ms`);
    r.style.setProperty('--post-intro-menu-dur', `${c.menuLineAnimSec}s`);
    r.style.setProperty('--post-intro-ui-delay', `${c.uiContainerDelayMs}ms`);
    r.style.setProperty('--post-intro-ui-dur', `${c.uiContainerAnimSec}s`);
    r.style.setProperty('--post-intro-shell-delay', `${c.terminalShellDelayMs}ms`);
    r.style.setProperty('--post-intro-shell-dur', `${c.terminalShellAnimSec}s`);
    r.style.setProperty('--post-intro-hud-delay', `${c.cameraHudDelayMs}ms`);
    r.style.setProperty('--post-intro-hud-dur', `${c.cameraHudAnimSec}s`);
    r.style.setProperty('--post-intro-prod-delay', `${c.prodLabelDelayMs}ms`);
    r.style.setProperty('--post-intro-prod-dur', `${c.prodLabelAnimSec}s`);
}

function revealPostIntroUi() {
    if (postIntroUiRevealed) return;
    postIntroUiRevealed = true;
    const body = document.body;
    if (!POST_INTRO_UI_CONFIG.enabled) {
        applyPostIntroUiCssVars();
        body.classList.remove('post-intro-ui-pending');
        body.classList.add('post-intro-ui-ready');
        return;
    }
    applyPostIntroUiCssVars();
    document.querySelectorAll('#terminal-menu .term-line').forEach((el, i) => {
        el.style.setProperty('--post-intro-line-index', String(i));
    });
    body.classList.remove('post-intro-ui-pending');
    body.classList.add('post-intro-ui-ready');
}

function init() {
    startLoaderSimulation();
    updateProgress(); // zapewnij spójność fazy (bez nadpisywania DOM-a przy sim)
    requestAnimationFrame(() => {
        initSceneAndLoad();
    });
}

function initSceneAndLoad() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111); // Dark background
    scene.fog = new THREE.Fog(0x000000, 10, 50); // Optional fog

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, CONFIG.initialZoom);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(getEffectivePixelRatio());
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // Orbit Controls (Free Cam)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = CONFIG.minZoom;
    controls.maxDistance = CONFIG.maxZoom;
    controls.zoomSpeed = CONFIG.freeCamZoomSpeed;
    controls.enabled = false; // Start disabled

    // Post-Processing (zależnie od performanceRuntime: SAO / bloom / CRT)
    const renderScene = new RenderPass(scene, camera);
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);

    if (performanceRuntime.enableSao) {
        saoPass = new SAOPass(scene, camera, new THREE.Vector2(window.innerWidth, window.innerHeight));
        saoPass.params.saoBias = SHADER_CONFIG.sao.saoBias;
        saoPass.params.saoIntensity = SHADER_CONFIG.sao.saoIntensity;
        saoPass.params.saoScale = SHADER_CONFIG.sao.saoScale;
        saoPass.params.saoKernelRadius = SHADER_CONFIG.sao.saoKernelRadius;
        saoPass.params.saoMinResolution = SHADER_CONFIG.sao.saoMinResolution;
        saoPass.params.saoBlur = SHADER_CONFIG.sao.saoBlur;
        saoPass.params.saoBlurRadius = SHADER_CONFIG.sao.saoBlurRadius;
        saoPass.params.saoBlurStdDev = SHADER_CONFIG.sao.saoBlurStdDev;
        saoPass.params.saoBlurDepthCutoff = SHADER_CONFIG.sao.saoBlurDepthCutoff;
        composer.addPass(saoPass);
    } else {
        saoPass = null;
    }

    if (performanceRuntime.enableBloom) {
        bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = SHADER_CONFIG.bloom.threshold;
        bloomPass.strength = SHADER_CONFIG.bloom.strength;
        bloomPass.radius = SHADER_CONFIG.bloom.radius;
        composer.addPass(bloomPass);
    } else {
        bloomPass = null;
    }

    if (performanceRuntime.enableCrt) {
        crtPass = new ShaderPass(CRTShader);
        crtPass.uniforms['resolution'].value.set(window.innerWidth, window.innerHeight);
        composer.addPass(crtPass);
    } else {
        crtPass = null;
    }

    composer.addPass(new OutputPass());

    // 4. Lighting & Environment (HDRI — fallback dopóki PMREM z wideo nie nadpisze scene.environment)
    new RGBELoader()
        .load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr', function (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            hdriEnvironmentTexture = texture;
            scene.environment = texture;
        });

    // Keep a subtle Directional Light1 for sharp shadows
    keyDirectionalLight = new THREE.DirectionalLight(0xFF0000, 15);
    keyDirectionalLight.position.set(-10, 1-0, 10);
    keyDirectionalLight.castShadow = true;
    keyDirectionalLight.shadow.mapSize.width = performanceRuntime.shadowMapSize;
    keyDirectionalLight.shadow.mapSize.height = performanceRuntime.shadowMapSize;
    fillDirectionalLight = new THREE.DirectionalLight(0x0000FF, 1);
    fillDirectionalLight.position.set(10, 10, 10);
    fillDirectionalLight.castShadow = performanceRuntime.secondLightCastShadow;
    fillDirectionalLight.shadow.mapSize.width = performanceRuntime.shadowMapSize;
    fillDirectionalLight.shadow.mapSize.height = performanceRuntime.shadowMapSize;
    scene.add(keyDirectionalLight);
    scene.add(fillDirectionalLight);

    // Debug Cursor
    const debugGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const debugMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    debugMesh = new THREE.Mesh(debugGeo, debugMat);
    scene.add(debugMesh);

    // Tło: ogromne wideo daleko za napisem TOPKEK (losowy plik z listy przy ładowaniu)
    const bgCfg = CONFIG.backgroundVideo;
    const bgSources = bgCfg?.sources;
    const bgSource = Array.isArray(bgSources) && bgSources.length
        ? bgSources[Math.floor(Math.random() * bgSources.length)]
        : null;
    activeBackgroundVideoSource = bgSource;
    const bgSrc = bgSource?.src ?? bgCfg?.src;

    let videoReadyPromise = Promise.resolve();
    if (bgCfg && bgSrc) {
        backgroundVideoEl = document.createElement('video');
        backgroundVideoEl.muted = true;
        backgroundVideoEl.loop = true;
        backgroundVideoEl.playsInline = true;
        backgroundVideoEl.preload = 'auto';
        backgroundVideoEl.crossOrigin = 'anonymous';
        backgroundVideoEl.src = bgSrc;
        applyBackgroundVideoPlaybackRate(currentBackgroundBpm);
        backgroundVideoEl.load();

        const updateVideoProgress = () => {
            if (loadState.assets >= 100) return;
            const v = backgroundVideoEl;
            let pct = 0;
            const durOk = v.duration && typeof v.duration === 'number' && isFinite(v.duration);
            if (durOk && v.buffered.length > 0) {
                const endVal = v.buffered.end(v.buffered.length - 1);
                pct = Math.min(100, Math.round((endVal / v.duration) * 100));
            } else if (v.buffered.length > 0) {
                pct = Math.min(90, loadState.assets + 15);
            }
            loadState.assets = Math.max(loadState.assets, pct);
            updateProgress();
        };
        backgroundVideoEl.addEventListener('progress', updateVideoProgress);
        backgroundVideoEl.addEventListener('loadedmetadata', updateVideoProgress);
        backgroundVideoEl.addEventListener('loadeddata', updateVideoProgress);
        backgroundVideoEl.addEventListener('play', () => updateBackgroundVideoPlayToggleUi());
        backgroundVideoEl.addEventListener('pause', () => updateBackgroundVideoPlayToggleUi());

        videoReadyPromise = new Promise((resolve) => {
            const onReady = () => {
                loadState.assets = 100;
                updateProgress();
                backgroundVideoEl.play().catch(() => {});
                startVideoFrameCallbackOnce();
                resolve();
            };
            backgroundVideoEl.addEventListener('canplay', onReady, { once: true });
            backgroundVideoEl.addEventListener('error', onReady, { once: true });
        });

        backgroundVideoTexture = new THREE.VideoTexture(backgroundVideoEl);
        backgroundVideoTexture.minFilter = THREE.LinearFilter;
        backgroundVideoTexture.magFilter = THREE.LinearFilter;
        const bgGeo = new THREE.PlaneGeometry(bgCfg.width, bgCfg.height);
        const bgMat = new THREE.MeshBasicMaterial({ map: backgroundVideoTexture, side: THREE.DoubleSide });
        backgroundVideoMesh = new THREE.Mesh(bgGeo, bgMat);
        backgroundVideoMesh.position.set(0, 0, bgCfg.positionZ);
        scene.add(backgroundVideoMesh);

        initBackgroundVideoIbl();
        applyBackgroundVideoMapColorGain();
    }

    // 5. Load Fonts and Generate Text
    const loader = new FontLoader();

    // Fonts + wideo muszą być gotowe zanim zaczniemy ładować cząsteczki (żeby postęp buforowania był widoczny i żeby nie pokazywać napisu bez wideo)
    const fontBoldPromise = new Promise((resolve, reject) => {
        loader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json', resolve, undefined, reject);
    });

    const fontRegularPromise = new Promise((resolve, reject) => {
        loader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', resolve, undefined, reject);
    });

    Promise.all([fontBoldPromise, fontRegularPromise, videoReadyPromise])
        .then(async ([fontBold, fontRegular]) => {
            loadedFont = fontBold;
            loadedFontRegular = fontRegular;
            loadState.assets = 100;
            loadState.generation = 0;
            updateProgress();

            // Daj przeglądarce czas na przerysowanie loadera (postęp i komunikat)
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => setTimeout(resolve, 50));

            // Try to load particles from file
            try {
                const response = await fetch(CONFIG.particlesFile);
                if (response.ok) {
                    const data = await response.json();
                    // Check if text matches (handle custom text logic later)
                    if (data.text === CONFIG.text) {
                        await loadParticles(data);
                    } else {
                        console.log("Particle file text mismatch, regenerating...");
                        await generateParticles(fontBold, fontRegular);
                    }
                } else {
                    throw new Error("File not found");
                }
            } catch (e) {
                console.log("Generating particles (No cache found)...");
                await generateParticles(fontBold, fontRegular);
            }

            // Initialize Vajbuj mode after particles are ready
            initVajbujMode();
            initMysenMode();
            // Portfolio is lazy-initialized on first hover over "Animation portfolio" in terminal

            // Loader is about to disappear; stop fake progress to avoid running in background.
            stopLoaderSimulation({ finalize: true });
            introFlyInStartRadius = INTRO_CAMERA_CONFIG.startRadius;
            cameraRadius = introFlyInStartRadius;
            targetCameraRadius = introFlyInStartRadius;
            introFlyInStartTime = performance.now();
            introCameraFlyInActive = true;
            setTimeout(() => {
                revealPostIntroUi();
            }, INTRO_CAMERA_CONFIG.durationMs + 200);
            loaderContainer.classList.add('hidden');
            if (backgroundVideoEl && !backgroundVideoUserPaused) {
                backgroundVideoEl.play().catch(() => {});
            }
            setTimeout(() => {
                loaderContainer.style.display = 'none';
            }, 500);
        })
        .catch(err => {
            console.error("Error loading fonts:", err);
            stopLoaderSimulation();
            statusText.innerText = "Error Loading Fonts";
            revealPostIntroUi();
        });

    // 6. Events
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
            if (isCinematic || isFreeCam) {
                setCameraMode('manual');
                lastInteractionTime = Date.now();
            }
        }
    });

    // Touch Events
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('wheel', onWheel, { passive: false });

    // Initial Camera Delay
    setTimeout(() => {
        isInitialSequence = false;
    }, cinematicConfig.initialDelay);

    createUI();
}

function makeSectionCollapsible(sectionEl, label) {
    if (!sectionEl || sectionEl.dataset.sectionToggleBound === '1') return;

    const content = document.createElement('div');
    content.className = 'menu-section-content';
    while (sectionEl.firstChild) {
        content.appendChild(sectionEl.firstChild);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-section-toggle';

    const applyCollapsedState = (collapsed) => {
        sectionEl.classList.toggle('menu-section-collapsed', collapsed);
        btn.textContent = collapsed ? '+' : '−';
        const action = collapsed ? 'Expand' : 'Collapse';
        btn.setAttribute('aria-label', `${action} ${label}`);
        btn.title = `${action} ${label}`;
    };

    btn.addEventListener('click', (event) => {
        event.stopPropagation();
        applyCollapsedState(!sectionEl.classList.contains('menu-section-collapsed'));
    });

    sectionEl.classList.add('menu-collapsible-section');
    sectionEl.appendChild(btn);
    sectionEl.appendChild(content);
    sectionEl.dataset.sectionToggleBound = '1';
    applyCollapsedState(false);
}

function initSectionMenuToggles() {
    const cameraHud = document.getElementById('camera-hud');
    if (cameraHud) {
        const cameraHudSections = Array.from(cameraHud.querySelectorAll('.controls-section'));
        cameraHudSections.forEach((section, index) => {
            makeSectionCollapsible(section, `left section ${index + 1}`);
        });
    }

    const perfHud = document.getElementById('perf-hud');
    if (perfHud) makeSectionCollapsible(perfHud, 'performance panel');

    const uiContainer = document.getElementById('ui-container');
    if (uiContainer) makeSectionCollapsible(uiContainer, 'right controls');

    const terminalMenu = document.getElementById('terminal-menu');
    if (terminalMenu) makeSectionCollapsible(terminalMenu, 'terminal menu');

    /* Console (#topkek-terminal-shell): collapse is an icon in the shell header — see terminal-shell.js */
}

// --- Portfolio Vimeo helpers ---
function openPortfolioModal(rawUrl) {
    const modal = document.getElementById('portfolio-vimeo-modal');
    const iframe = document.getElementById('portfolio-vimeo-iframe');
    if (!modal || !iframe) return;

    let url = rawUrl || '';
    if (!url) return;

    // Normalize regular Vimeo URL to player.vimeo.com/video/ID
    if (!url.includes('player.vimeo.com')) {
        const match = url.match(/vimeo\.com\/(\d+)/);
        if (match && match[1]) {
            url = `https://player.vimeo.com/video/${match[1]}`;
        }
    }

    // Add autoplay if missing
    if (!url.includes('autoplay=')) {
        const sep = url.includes('?') ? '&' : '?';
        url += `${sep}autoplay=1`;
    }

    iframe.src = url;
    modal.classList.remove('hidden');
}

function openPortfolioDetailModal(item) {
    const modal = document.getElementById('portfolio-detail-modal');
    if (!modal) {
        openPortfolioModal(item?.vimeoUrl);
        return;
    }
    const titleEl = document.getElementById('portfolio-detail-title');
    const descEl = document.getElementById('portfolio-detail-description');
    if (titleEl) titleEl.textContent = item?.title || '';
    if (descEl) descEl.textContent = item?.description || '';
    const playBtn = document.getElementById('portfolio-detail-play-video');
    if (playBtn) playBtn.onclick = () => openPortfolioModal(item?.vimeoUrl);
    modal.classList.remove('hidden');
}

const clock = new THREE.Clock();
let glitchVolumeNextTrigger = 0; // next time (s) to auto-trigger volumetric glitch
/** @type {{ toggle: () => void, isVisible: () => boolean, syncFromRuntime: () => void } | null} */
let fxDevPanelControl = null;

const fxRuntime = {
    enabled: FX_CONFIG?.global?.enabled !== false,
    bpm: FX_CONFIG?.global?.defaultBpm || 120,
    nextInstanceId: 1,
    activeInstances: [],
    defaults: {}
};
Object.keys(FX_CONFIG?.registry || {}).forEach((effectId) => {
    fxRuntime.defaults[effectId] = { ...(FX_CONFIG.registry[effectId]?.defaults || {}) };
});

const fxTmpVec = new THREE.Vector3();

function normalizeFxAlias(line) {
    if (!line) return line;
    const trimmed = line.trim();
    const firstToken = trimmed.split(/\s+/)[0]?.toLowerCase();
    const alias = FX_CONFIG?.aliasCommands?.[firstToken];
    if (!alias) return line;
    const rest = trimmed.slice(firstToken.length).trim();
    return `${alias}${rest ? ` ${rest}` : ''}`;
}

function resolveFxSeconds(value, bpm = fxRuntime.bpm) {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const token = String(value).trim().toLowerCase();
    if (!token) return null;
    if (/^\d+(\.\d+)?s$/.test(token)) return parseFloat(token.slice(0, -1));
    if (/^\d+(\.\d+)?b$/.test(token)) {
        const beats = parseFloat(token.slice(0, -1));
        return beats * 60 / Math.max(1, bpm);
    }
    if (/^\d+\/\d+$/.test(token)) {
        const [aRaw, bRaw] = token.split('/');
        const a = parseFloat(aRaw);
        const b = parseFloat(bRaw);
        if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
        return (a / b) * 4 * 60 / Math.max(1, bpm);
    }
    const numeric = parseFloat(token);
    return Number.isFinite(numeric) ? numeric : null;
}

function parseFxParams(rawParts, fromIndex = 0) {
    const params = {};
    for (let i = fromIndex; i < rawParts.length; i++) {
        const t = rawParts[i];
        const eq = t.indexOf('=');
        if (eq <= 0) continue;
        const key = t.slice(0, eq).trim();
        const valueRaw = t.slice(eq + 1).trim();
        if (!key) continue;
        if (valueRaw === 'true' || valueRaw === 'false') {
            params[key] = valueRaw === 'true';
            continue;
        }
        if (/^#?[0-9a-f]{6}$/i.test(valueRaw) || /^0x[0-9a-f]{6}$/i.test(valueRaw)) {
            params[key] = valueRaw;
            continue;
        }
        const num = parseFloat(valueRaw);
        params[key] = Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(valueRaw) ? num : valueRaw;
    }
    return params;
}

function getFxRegistryConfig(effectId) {
    return FX_CONFIG?.registry?.[effectId] || null;
}

function resolveFxEffectId(inputId) {
    const id = String(inputId || '').trim();
    if (!id) return null;
    if (FX_CONFIG?.registry?.[id]) return id;
    const low = id.toLowerCase();
    const keys = Object.keys(FX_CONFIG?.registry || {});
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const aliases = FX_CONFIG.registry[key]?.aliases || [];
        if (aliases.some((a) => String(a).toLowerCase() === low)) return key;
    }
    return null;
}

function clampFxParam(effectId, key, value) {
    const effectCfg = getFxRegistryConfig(effectId);
    const range = effectCfg?.ranges?.[key];
    if (!range || typeof value !== 'number' || !Number.isFinite(value)) return value;
    return Math.max(range.min, Math.min(range.max, value));
}

function getSubtitleSplitY() {
    const offsetY = CONFIG?.subtitle?.offsetY;
    if (!Number.isFinite(offsetY)) return -1.5;
    return offsetY * 0.5;
}

function getGroupLayer(group) {
    return group.originalPos.y < getSubtitleSplitY() ? 'subtitle' : 'main';
}

function getTargetGroupsByMode(targetMode) {
    const mode = String(targetMode || 'both').toLowerCase();
    if (mode === 'main') return cubeGroups.filter((g) => getGroupLayer(g) === 'main');
    if (mode === 'subtitle') return cubeGroups.filter((g) => getGroupLayer(g) === 'subtitle');
    return cubeGroups;
}

function resolveFxParams(effectId, overrides = {}) {
    const defaults = fxRuntime.defaults[effectId] || getFxRegistryConfig(effectId)?.defaults || {};
    const merged = { ...defaults, ...overrides };
    const normalized = {};
    Object.keys(merged).forEach((k) => {
        normalized[k] = clampFxParam(effectId, k, merged[k]);
    });
    return normalized;
}

function nextFxIntervalSeconds(params) {
    return Math.max(0.03, resolveFxSeconds(params.frequency, fxRuntime.bpm) || 0.25);
}

function applyScatterBurst(params) {
    const spread = Math.max(0.05, Math.min(1, params.spread ?? 0.5));
    const speed = Math.max(0.1, params.speed ?? 1);
    const scale = Math.max(0.1, params.scale ?? 1);
    const count = Math.max(4, Math.floor(cubeGroups.length * Math.min(0.6, spread * 0.35)));
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * cubeGroups.length);
        const group = cubeGroups[idx];
        if (!group) continue;
        fxTmpVec.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.08 * speed * scale);
        group.isFlying = true;
        group.velocity.add(fxTmpVec);
        group.returnStartTime = (Date.now() * 0.001) + 0.25 + (params.decay || 0.5);
    }
}

function applyRepulsionSwarm(instance, dt) {
    if (!instance.state.points || instance.state.points.length === 0) return;
    const params = instance.params;
    const radius = Math.max(0.2, params.radius ?? 3);
    const speed = Math.max(0.1, params.speed ?? 1);
    const turnRate = Math.max(0.05, params.turnRate ?? 1);
    const now = instance.elapsed;
    for (let i = 0; i < instance.state.points.length; i++) {
        const p = instance.state.points[i];
        p.phase += dt * turnRate;
        const r = radius * (0.65 + 0.35 * Math.sin(p.seed + now * 0.3));
        p.pos.set(
            Math.sin(p.phase + p.seed) * r,
            Math.cos(p.phase * 1.7 + p.seed) * r * 0.7,
            Math.cos(p.phase + p.seed) * r
        );
        for (let g = 0; g < cubeGroups.length; g++) {
            const group = cubeGroups[g];
            const dist = group.currentPos.distanceTo(p.pos);
            if (dist > radius) continue;
            fxTmpVec.subVectors(group.currentPos, p.pos);
            if (fxTmpVec.lengthSq() < 1e-6) continue;
            fxTmpVec.normalize().multiplyScalar((1 - dist / radius) * 0.06 * speed);
            // Scatter/grid ignore velocity unless isFlying; repulsion integrates velocity every frame.
            if (CONFIG.animationMode === 'repulsion') {
                group.velocity.add(fxTmpVec);
            } else {
                group.currentPos.add(fxTmpVec);
            }
        }
    }
}

function applyLetterEmission(instance) {
    const params = instance.params;
    const groups = getTargetGroupsByMode(params.target);
    if (!groups.length) return;
    const distribution = String(params.distribution || 'sequential');
    let chosen = null;
    if (distribution === 'random') {
        chosen = groups[Math.floor(Math.random() * groups.length)];
    } else if (distribution === 'pingpong') {
        const n = groups.length;
        const idx = instance.state.index % (n * 2 - 2 || 1);
        const mirrored = idx < n ? idx : (2 * n - 2 - idx);
        chosen = groups[Math.max(0, Math.min(n - 1, mirrored))];
        instance.state.index += 1;
    } else {
        chosen = groups[instance.state.index % groups.length];
        instance.state.index += 1;
    }
    if (!chosen) return;
    chosen.fxGlowUntil = instance.now + Math.max(0.04, resolveFxSeconds(params.duration, fxRuntime.bpm) || 0.2);
    chosen.fxGlowGain = Math.max(0.1, params.gain ?? 1);
    chosen.fxGlowPulseK = params.pulseScale ?? 0.32;
}

function noiseAt(x, y, t, speed = 1) {
    return 0.5 + 0.5 * Math.sin((x * 1.7 + y * 1.2) + t * speed);
}

function applyGridNoiseMask(instance) {
    const params = instance.params;
    const threshold = Math.max(0, Math.min(1, params.threshold ?? 0.6));
    const speed = Math.max(0.1, params.speed ?? 1);
    let hits = 0;
    for (let i = 0; i < cubeGroups.length; i++) {
        const g = cubeGroups[i];
        const n = noiseAt(g.originalPos.x, g.originalPos.y, instance.elapsed, speed);
        if (n < threshold) continue;
        hits++;
        if (hits > 120) break;
        g.glitchDisplayOffset.set(
            (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.12
        );
        g.glitchEndTime = instance.now + 0.08;
    }
}

function buildFxInstance(effectId, mode, params) {
    return {
        id: `fx-${fxRuntime.nextInstanceId++}`,
        effectId,
        mode,
        params,
        paused: false,
        createdAt: clock.getElapsedTime(),
        now: clock.getElapsedTime(),
        elapsed: 0,
        nextFireAt: clock.getElapsedTime(),
        state: {
            index: 0,
            points: []
        }
    };
}

function startFxEffect(effectId, mode = 'trigger', overrides = {}) {
    if (!fxRuntime.enabled) return { ok: false, lines: ['FX runtime is disabled.'] };
    const resolvedId = resolveFxEffectId(effectId);
    if (!resolvedId) return { ok: false, lines: [`Unknown effect: ${effectId}`] };
    const params = resolveFxParams(resolvedId, overrides);
    if (fxRuntime.activeInstances.length >= (FX_CONFIG?.global?.maxActiveInstances || 24)) {
        return { ok: false, lines: ['Too many active FX instances. Stop some effects first.'] };
    }
    const instance = buildFxInstance(resolvedId, mode, params);
    if (resolvedId === 'repulsionSwarm') {
        const count = Math.round(params.count || 3);
        instance.state.points = Array.from({ length: Math.max(1, count) }, (_, idx) => ({
            seed: Math.random() * Math.PI * 2 + idx,
            phase: Math.random() * Math.PI * 2,
            pos: new THREE.Vector3()
        }));
    }
    fxRuntime.activeInstances.push(instance);
    return { ok: true, instance, lines: [`FX ${mode}: ${resolvedId} (${instance.id})`] };
}

function stopFxEffects(target = 'all') {
    const low = String(target || 'all').toLowerCase();
    if (low === 'all') {
        const count = fxRuntime.activeInstances.length;
        fxRuntime.activeInstances = [];
        return [`Stopped ${count} FX instance(s).`];
    }
    const before = fxRuntime.activeInstances.length;
    fxRuntime.activeInstances = fxRuntime.activeInstances.filter((inst) => inst.id !== target && inst.effectId !== target);
    return [`Stopped ${before - fxRuntime.activeInstances.length} FX instance(s).`];
}

function listFxEffects() {
    return Object.entries(FX_CONFIG?.registry || {}).map(([id, cfg]) => {
        const aliases = (cfg.aliases || []).join(', ');
        return `${id}${aliases ? ` (aliases: ${aliases})` : ''}`;
    });
}

function updateFxRuntime(now, dt) {
    if (!fxRuntime.enabled || fxRuntime.activeInstances.length === 0) return;
    for (let i = fxRuntime.activeInstances.length - 1; i >= 0; i--) {
        const inst = fxRuntime.activeInstances[i];
        inst.now = now;
        inst.elapsed = clock.getElapsedTime() - inst.createdAt;
        if (inst.paused) continue;
        const shouldFire = now >= inst.nextFireAt;
        if (!shouldFire) {
            if (inst.effectId === 'repulsionSwarm') applyRepulsionSwarm(inst, dt);
            continue;
        }
        if (inst.effectId === 'scatterBurst') applyScatterBurst(inst.params);
        else if (inst.effectId === 'letterEmission') applyLetterEmission(inst);
        else if (inst.effectId === 'repulsionSwarm') applyRepulsionSwarm(inst, dt);
        else if (inst.effectId === 'gridNoiseMask') applyGridNoiseMask(inst);

        if (inst.mode === 'trigger') {
            fxRuntime.activeInstances.splice(i, 1);
        } else {
            inst.nextFireAt = now + nextFxIntervalSeconds(inst.params);
        }
    }
}

function fxStatusLines() {
    const header = `FX runtime: ${fxRuntime.enabled ? 'on' : 'off'} | bpm=${fxRuntime.bpm} | active=${fxRuntime.activeInstances.length}`;
    const wallT = Date.now() * 0.001;
    const lines = fxRuntime.activeInstances.slice(0, 10).map((inst) =>
        `${inst.id}: ${inst.effectId} [${inst.mode}] next=${Math.max(0, inst.nextFireAt - wallT).toFixed(2)}s`
    );
    return [header, ...lines];
}

function fxDevGetRuntime() {
    return {
        enabled: fxRuntime.enabled,
        bpm: fxRuntime.bpm,
        defaults: JSON.parse(JSON.stringify(fxRuntime.defaults))
    };
}

function fxDevSetEnabled(v) {
    fxRuntime.enabled = !!v;
}

function fxDevSetBpm(n) {
    fxRuntime.bpm = Math.max(20, Math.min(300, n));
}

function fxDevApplyDefaultKey(effectId, key, rawStr) {
    if (rawStr === '') return false;
    const parsed = parseFxParams([`${key}=${rawStr}`], 0);
    if (parsed[key] == null) return false;
    fxRuntime.defaults[effectId] = resolveFxParams(effectId, { [key]: parsed[key] });
    return true;
}

function fxDevApplyPreset(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'not an object' };
    if (data.topkekFxPreset !== 1) return { ok: false, error: 'topkekFxPreset must be 1' };
    if (data.bpm != null) {
        const n = Number(data.bpm);
        if (Number.isFinite(n)) fxDevSetBpm(n);
    }
    if (data.fxEnabled != null) fxRuntime.enabled = !!data.fxEnabled;
    if (data.effectId && data.defaults && typeof data.defaults === 'object') {
        const nestedByEffect = Object.keys(data.defaults).some((k) => FX_CONFIG.registry[k]);
        if (!nestedByEffect) {
            const id = resolveFxEffectId(String(data.effectId));
            if (!id) return { ok: false, error: 'unknown effectId' };
            fxRuntime.defaults[id] = resolveFxParams(id, data.defaults);
            return { ok: true };
        }
    }
    if (data.defaults && typeof data.defaults === 'object') {
        Object.entries(data.defaults).forEach(([id, params]) => {
            if (!FX_CONFIG.registry[id]) return;
            if (!params || typeof params !== 'object') return;
            fxRuntime.defaults[id] = resolveFxParams(id, params);
        });
    }
    return { ok: true };
}

function fxDevExportPreset() {
    return {
        topkekFxPreset: 1,
        bpm: fxRuntime.bpm,
        fxEnabled: fxRuntime.enabled,
        defaults: JSON.parse(JSON.stringify(fxRuntime.defaults))
    };
}

function fxDevExportEffectPreset(effectId) {
    const id = resolveFxEffectId(effectId);
    if (!id) return null;
    const defs = fxRuntime.defaults[id] || {};
    return {
        topkekFxPreset: 1,
        effectId: id,
        defaults: JSON.parse(JSON.stringify(defs))
    };
}

function fxDevGetActiveInstances() {
    const t = Date.now() * 0.001;
    return fxRuntime.activeInstances.map((inst) => ({
        id: inst.id,
        effectId: inst.effectId,
        mode: inst.mode,
        paused: !!inst.paused,
        nextInSec: inst.mode === 'loop' ? Math.max(0, inst.nextFireAt - t) : null,
        params: inst.params && typeof inst.params === 'object' ? JSON.parse(JSON.stringify(inst.params)) : {}
    }));
}

function fxDevSetInstancePaused(id, paused) {
    const inst = fxRuntime.activeInstances.find((i) => i.id === id);
    if (inst) inst.paused = !!paused;
}

function fxDevRemoveInstance(id) {
    const before = fxRuntime.activeInstances.length;
    fxRuntime.activeInstances = fxRuntime.activeInstances.filter((i) => i.id !== id);
    return before > fxRuntime.activeInstances.length;
}

/** Swap instance with neighbor in activeInstances (visual list order: index 0 = top). */
function fxDevMoveActiveInstance(id, direction) {
    const arr = fxRuntime.activeInstances;
    const idx = arr.findIndex((i) => i.id === id);
    if (idx < 0) return false;
    if (direction === 'up') {
        if (idx <= 0) return false;
        const t = arr[idx - 1];
        arr[idx - 1] = arr[idx];
        arr[idx] = t;
        return true;
    }
    if (direction === 'down') {
        if (idx >= arr.length - 1) return false;
        const t = arr[idx + 1];
        arr[idx + 1] = arr[idx];
        arr[idx] = t;
        return true;
    }
    return false;
}

function parseTerminalHexColor(token) {
    if (!token) return null;
    let t = token.trim();
    if (t.toLowerCase().startsWith('0x')) t = t.slice(2);
    else if (t.startsWith('#')) t = t.slice(1);
    if (!/^[0-9a-fA-F]{6}$/.test(t)) return null;
    return parseInt(t, 16);
}

function passEnabledLine(name, pass) {
    if (!pass) return `${name}: n/a`;
    return `${name}: ${pass.enabled ? 'on' : 'off'}`;
}

function setAlternateMaterialMode(nextState) {
    isAlternateMaterial = !!nextState;
    if (bloomPass) {
        bloomPass.strength = isAlternateMaterial ? SHADER_CONFIG.bloom.alternateStrength : SHADER_CONFIG.bloom.strength;
    }
    Object.values(meshRegistry).forEach(entry => {
        if (entry.top) entry.top.material = isAlternateMaterial ? glassMaterial : defaultBoxMaterial;
        if (entry.kek) entry.kek.material = isAlternateMaterial ? goldMaterial : defaultBoxMaterial;
    });
}

function runTopkekTerminalCommand(line) {
    const raw = String(line || '').trim();
    if (!raw.startsWith('/')) {
        return ['Commands require leading slash. Try: /help or /help full'];
    }
    const slashless = raw.slice(1).trim();
    if (!slashless) return ['Usage: /help [full]'];

    const normalizedLine = normalizeFxAlias(slashless);
    const parts = normalizedLine.trim().split(/\s+/).filter(Boolean);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'help') {
        const helpArg = (parts[1] || '').toLowerCase();
        if (parts.length > 2 || (helpArg && helpArg !== 'full')) {
            return ['Usage: /help [full]'];
        }
        // stream: true → fast character delay in terminal-shell (listings); not “enable streaming”.
        // plainListing → one wrapper block, lines without per-line chip background.
        const lines = helpArg === 'full' ? TERMINAL_HELP_LINES_FULL : TERMINAL_HELP_LINES_COMPACT;
        return {
            stream: true,
            plainListing: true,
            lines
        };
    }

    if (cmd === 'fx') {
        const sub = (parts[1] || 'status').toLowerCase();
        if (sub === 'dev') {
            if (fxDevPanelControl && typeof fxDevPanelControl.toggle === 'function') {
                fxDevPanelControl.toggle();
                return ['FX dev: active list left, editor right; import JSON; Export preset per effect or Export all; close × needs two clicks (first arms red).'];
            }
            return ['FX dev panel unavailable.'];
        }
        if (sub === 'on') {
            fxRuntime.enabled = true;
            if (fxDevPanelControl?.syncFromRuntime) fxDevPanelControl.syncFromRuntime();
            return ['FX runtime on.'];
        }
        if (sub === 'off') {
            fxRuntime.enabled = false;
            if (fxDevPanelControl?.syncFromRuntime) fxDevPanelControl.syncFromRuntime();
            return ['FX runtime off.'];
        }
        if (sub === 'list') return listFxEffects();
        if (sub === 'status') return fxStatusLines();
        if (sub === 'bpm') {
            const n = parseFloat(parts[2]);
            if (!Number.isFinite(n) || n <= 0) return ['Usage: /fx bpm <value>'];
            fxRuntime.bpm = Math.max(20, Math.min(300, n));
            return [`FX bpm = ${fxRuntime.bpm}`];
        }
        if (sub === 'set') {
            const key = parts[2] || '';
            const valueToken = parts[3];
            if (!key.includes('.') || valueToken == null) return ['Usage: /fx set <effectId.param> <value>'];
            const [rawEffectId, param] = key.split('.');
            const effectId = resolveFxEffectId(rawEffectId);
            if (!effectId || !param) return ['Unknown effect or param path.'];
            const parsedParams = parseFxParams([`${param}=${valueToken}`], 0);
            if (parsedParams[param] == null) return ['Invalid value.'];
            const current = resolveFxParams(effectId);
            current[param] = clampFxParam(effectId, param, parsedParams[param]);
            fxRuntime.defaults[effectId] = current;
            return [`FX default ${effectId}.${param} = ${current[param]}`];
        }
        if (sub === 'trigger' || sub === 'start') {
            const effectId = parts[2];
            if (!effectId) return [`Usage: /fx ${sub} <effectId> [param=value ...]`];
            const overrides = parseFxParams(parts, 3);
            const result = startFxEffect(effectId, sub === 'trigger' ? 'trigger' : 'loop', overrides);
            return result.lines;
        }
        if (sub === 'stop') {
            return stopFxEffects(parts[2] || 'all');
        }
        return ['Usage: /fx <list|status|bpm|set|trigger|start|stop|dev|on|off> ...'];
    }

    if (cmd === 'vajbuj') {
        const sub = (parts[1] || 'start').toLowerCase();
        if (sub === 'stop') {
            stopVajbujMode();
            return ['VAJBUJ: stopping…'];
        }
        if (sub !== 'start' && parts.length > 1) {
            return ['Usage: /vajbuj [start|stop]'];
        }
        if (!VAJBUJ_CONFIG.enabled) return ['VAJBUJ disabled in config.'];
        if (!vajbujState.audio) return ['VAJBUJ audio not ready yet.'];
        if (typeof portfolioSceneActive !== 'undefined' && portfolioSceneActive) {
            exitPortfolioScene();
            const ap = document.getElementById('term-anim-portfolio');
            if (ap) ap.classList.remove('portfolio-active');
        }
        if (vajbujState.active && !vajbujState.isStopping) {
            return ['VAJBUJ already active. Use: vajbuj stop'];
        }
        if (vajbujState.active) return ['VAJBUJ is stopping, wait…'];
        startVajbujMode();
        return ['VAJBUJ started.'];
    }

    if (cmd === 'mysen') {
        const sub = (parts[1] || 'start').toLowerCase();
        if (sub === 'stop') {
            stopMysenMode();
            return ['MYSEN: stopping…'];
        }
        if (sub !== 'start' && parts.length > 1) {
            return ['Usage: /mysen [start|stop]'];
        }
        if (!MYSEN_CONFIG.enabled) return ['MYSEN disabled in config.'];
        if (MYSEN_CONFIG.disableOnMobile && IS_MOBILE) return ['MYSEN disabled on mobile in config.'];
        if (!mysenState.audio) return ['MYSEN audio not ready yet.'];
        if (!loadedFontRegular) return ['MYSEN: font not ready yet.'];
        if (typeof portfolioSceneActive !== 'undefined' && portfolioSceneActive) {
            exitPortfolioScene();
            const ap = document.getElementById('term-anim-portfolio');
            if (ap) ap.classList.remove('portfolio-active');
        }
        if (mysenState.active && !mysenState.isStopping) {
            return ['MYSEN already active. Use: /mysen stop'];
        }
        if (mysenState.active) return ['MYSEN is stopping, wait…'];
        startMysenMode().catch((e) => console.warn('[MYSEN] start failed:', e));
        return ['MYSEN started.'];
    }

    if (cmd === 'bloom') {
        const sub = (parts[1] || '').toLowerCase();
        if (!bloomPass) return ['Bloom pass not active in this profile.'];
        if (sub === 'on') {
            bloomPass.enabled = true;
            return ['Bloom on.'];
        }
        if (sub === 'off') {
            bloomPass.enabled = false;
            return ['Bloom off.'];
        }
        if (sub === 'strength' && parts[2] !== undefined) {
            const n = parseFloat(parts[2]);
            if (!Number.isFinite(n)) return ['Usage: /bloom strength <value>'];
            bloomPass.strength = Math.max(0, Math.min(3, n));
            return [`Bloom strength = ${bloomPass.strength}`];
        }
        return ['Usage: /bloom <on|off|strength> [value]'];
    }

    if (cmd === 'sao') {
        const sub = (parts[1] || '').toLowerCase();
        if (!saoPass) return ['SAO not available (lite/mobile or disabled). Try ?perf=full on desktop.'];
        if (sub === 'on') {
            saoPass.enabled = true;
            return ['SAO on.'];
        }
        if (sub === 'off') {
            saoPass.enabled = false;
            return ['SAO off.'];
        }
        return ['Usage: /sao <on|off>'];
    }

    if (cmd === 'crt') {
        const sub = (parts[1] || '').toLowerCase();
        if (!crtPass) return ['CRT pass not active in this profile.'];
        if (sub === 'on') {
            crtPass.enabled = true;
            return ['CRT on.'];
        }
        if (sub === 'off') {
            crtPass.enabled = false;
            return ['CRT off.'];
        }
        return ['Usage: /crt <on|off>'];
    }

    if (cmd === 'material') {
        const sub = (parts[1] || 'status').toLowerCase();
        if (sub === 'toggle') {
            setAlternateMaterialMode(!isAlternateMaterial);
            return [`Material mode: ${isAlternateMaterial ? 'alt' : 'default'}.`];
        }
        if (sub === 'default') {
            setAlternateMaterialMode(false);
            return ['Material mode: default.'];
        }
        if (sub === 'alt') {
            setAlternateMaterialMode(true);
            return ['Material mode: alt.'];
        }
        if (sub === 'status') {
            return [`Material mode: ${isAlternateMaterial ? 'alt' : 'default'}.`];
        }
        return ['Usage: /material <toggle|default|alt|status>'];
    }

    if (cmd === 'light') {
        const idx = parts[1];
        const op = (parts[2] || '').toLowerCase();
        const light = idx === '1' ? keyDirectionalLight : idx === '2' ? fillDirectionalLight : null;
        if (!light) return ['Usage: /light <1|2> <color|intensity> <value>'];
        if (op === 'color' && parts[3]) {
            const hex = parseTerminalHexColor(parts[3]);
            if (hex === null) return ['Invalid color. Use #rrggbb or 0xrrggbb (6 hex digits).'];
            light.color.setHex(hex);
            return [`Light ${idx} color set.`];
        }
        if (op === 'intensity' && parts[3] !== undefined) {
            const n = parseFloat(parts[3]);
            if (!Number.isFinite(n) || n < 0) return ['Invalid intensity.'];
            light.intensity = n;
            return [`Light ${idx} intensity = ${n}`];
        }
        return ['Usage: /light <1|2> <color|intensity> <value>'];
    }

    if (cmd === 'postproc') {
        const sub = (parts[1] || 'status').toLowerCase();
        if (sub !== 'status') return ['Usage: /postproc <status>'];
        return [
            passEnabledLine('bloom', bloomPass),
            passEnabledLine('sao', saoPass),
            passEnabledLine('crt', crtPass),
            '—',
            ...getFakeGiStatusLines()
        ];
    }

    if (cmd === 'fakegi') {
        const sub = (parts[1] || 'status').toLowerCase();
        if (sub === 'status') return getFakeGiStatusLines();
        if (sub === 'on' || sub === '1' || sub === 'true') return setFakeGiEnabled(true);
        if (sub === 'off' || sub === '0' || sub === 'false') return setFakeGiEnabled(false);
        return ['Usage: /fakegi <on|off|status> // Video IBL (PMREM) + światła z koloru wideo. ex: /fakegi off'];
    }

    return [`Unknown command: /${cmd}. Type /help or /help full.`];
}


init();
animate();


function createUI() {
    const rightPanel = document.getElementById('right-panel');
    if (!rightPanel) return;

    let ui = document.getElementById('ui-container');
    if (!ui) {
        ui = document.createElement('div');
        ui.id = 'ui-container';
        rightPanel.insertBefore(ui, rightPanel.firstChild);
    }

    // --- Mouse animation Mode (under Camera HUD) ---
    const mouseModeWrap = document.createElement('div');
    mouseModeWrap.className = 'controls-section';
    const titleMode = document.createElement('div');
    titleMode.className = 'controls-category-title';
    titleMode.textContent = 'Mouse animation Mode';
    mouseModeWrap.appendChild(titleMode);
    const itemsMode = document.createElement('div');
    itemsMode.className = 'controls-category-items';

    const btn1 = document.createElement('button');
    btn1.className = 'mode-btn active';
    btn1.innerText = '> Repulsion';
    btn1.onclick = () => setMode('repulsion', btn1, [btn2, btn3]);

    const btn2 = document.createElement('button');
    btn2.className = 'mode-btn';
    btn2.innerText = '> Scatter';
    btn2.onclick = () => setMode('scatter', btn2, [btn1, btn3]);

    const btn3 = document.createElement('button');
    btn3.className = 'mode-btn';
    btn3.innerText = '> Grid';
    btn3.onclick = () => setMode('grid', btn3, [btn1, btn2]);

    itemsMode.appendChild(btn1);
    itemsMode.appendChild(btn2);
    itemsMode.appendChild(btn3);
    mouseModeWrap.appendChild(itemsMode);

    // --- Camera HUD (top-left; live coords + mode + reset) ---
    const cameraHud = document.createElement('div');
    cameraHud.id = 'camera-hud';
    const cameraSection = document.createElement('div');
    cameraSection.className = 'controls-section controls-section--camera';

    const cameraTitle = document.createElement('div');
    cameraTitle.className = 'controls-category-title';
    cameraTitle.textContent = 'Camera';
    cameraSection.appendChild(cameraTitle);

    const cameraMeta = document.createElement('div');
    cameraMeta.className = 'camera-hud-meta';

    cameraHudModeEl = document.createElement('div');
    cameraHudModeEl.className = 'camera-hud-mode';
    cameraMeta.appendChild(cameraHudModeEl);

    cameraHudPosEl = document.createElement('pre');
    cameraHudPosEl.className = 'camera-hud-coords';
    cameraMeta.appendChild(cameraHudPosEl);

    cameraHudTgtEl = document.createElement('pre');
    cameraHudTgtEl.className = 'camera-hud-coords';
    cameraMeta.appendChild(cameraHudTgtEl);

    cameraSection.appendChild(cameraMeta);

    const hudItems = document.createElement('div');
    hudItems.className = 'controls-category-items';

    const btnFreeCam = document.createElement('button');
    btnFreeCam.className = 'mode-btn' + (isCinematic ? '' : ' active');
    btnFreeCam.innerText = '> Free Cam';
    btnFreeCam.onclick = () => {
        setCameraMode('free');
        btnFreeCam.classList.add('active');
        btnCinematic.classList.remove('active');
    };

    const btnCinematic = document.createElement('button');
    btnCinematic.className = 'mode-btn' + (isCinematic ? ' active' : '');
    btnCinematic.innerText = '> Dynamic Cam';
    btnCinematic.onclick = () => {
        setCameraMode('dynamic');
        btnCinematic.classList.add('active');
        btnFreeCam.classList.remove('active');
    };

    const btnResetCam = document.createElement('button');
    btnResetCam.className = 'mode-btn';
    btnResetCam.innerText = '> Reset widoku';
    btnResetCam.title = 'Przywróć domyślną pozycję kamery';
    btnResetCam.onclick = () => resetCameraToDefaultView();

    hudItems.appendChild(btnFreeCam);
    hudItems.appendChild(btnCinematic);
    hudItems.appendChild(btnResetCam);
    cameraSection.appendChild(hudItems);
    cameraHud.appendChild(cameraSection);
    cameraHud.appendChild(mouseModeWrap);
    
    // --- Glitch Volumetric ---
    const sectionGlitch = document.createElement('div');
    sectionGlitch.className = 'controls-section';
    const glitchTitle = document.createElement('div');
    glitchTitle.className = 'controls-category-title';
    glitchTitle.textContent = 'Glitch Volumetric';
    sectionGlitch.appendChild(glitchTitle);

    const glitchItems = document.createElement('div');
    glitchItems.className = 'controls-category-items';
    const btnGlitchToggle = document.createElement('button');
    btnGlitchToggle.id = 'btn-glitch-toggle';
    btnGlitchToggle.className = 'mode-btn';
    btnGlitchToggle.innerText = '> Activate';
    glitchItems.appendChild(btnGlitchToggle);

    const btnPresetSubtelny = document.createElement('button');
    btnPresetSubtelny.id = 'btn-glitch-preset-subtelny';
    btnPresetSubtelny.className = 'mode-btn';
    btnPresetSubtelny.innerText = '> Soft';
    glitchItems.appendChild(btnPresetSubtelny);

    const btnPresetMocny = document.createElement('button');
    btnPresetMocny.id = 'btn-glitch-preset-mocny';
    btnPresetMocny.className = 'mode-btn';
    btnPresetMocny.innerText = '> Strong';
    glitchItems.appendChild(btnPresetMocny);

    const btnPresetChaos = document.createElement('button');
    btnPresetChaos.id = 'btn-glitch-preset-chaos';
    btnPresetChaos.className = 'mode-btn';
    btnPresetChaos.innerText = '> Crazy';
    glitchItems.appendChild(btnPresetChaos);

    sectionGlitch.appendChild(glitchItems);
    cameraHud.appendChild(sectionGlitch);

    // --- Change text ---
    const sectionText = document.createElement('div');
    sectionText.className = 'controls-section';
    const textTitle = document.createElement('div');
    textTitle.className = 'controls-category-title';
    textTitle.textContent = 'Change text';
    sectionText.appendChild(textTitle);
    const btnCustomText = document.createElement('button');
    btnCustomText.className = 'mode-btn';
    btnCustomText.innerText = '> Edit text';

    const customTextInlineControls = document.createElement('div');
    customTextInlineControls.className = 'inline-text-regen hidden';

    const customTextInput = document.createElement('input');
    customTextInput.className = 'inline-text-regen-input';
    customTextInput.type = 'text';
    customTextInput.maxLength = MAX_CUSTOM_TEXT_LENGTH;
    customTextInput.placeholder = 'TOPKEK';

    const regenButton = document.createElement('button');
    regenButton.className = 'mode-btn inline-text-regen-btn';
    regenButton.innerText = 'regen';

    const runRegen = () => {
        const nextText = sanitizeCustomText(customTextInput.value);
        if (!nextText) {
            customTextInput.classList.add('is-invalid');
            customTextInput.focus();
            return;
        }
        customTextInput.classList.remove('is-invalid');

        const params = new URLSearchParams(window.location.search);
        params.set(CUSTOM_TEXT_QUERY_PARAM, nextText);
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
        window.location.assign(nextUrl);
    };

    btnCustomText.onclick = () => {
        customTextInput.value = CONFIG.text;
        customTextInlineControls.classList.remove('hidden');
        btnCustomText.classList.add('hidden');
        customTextInput.focus();
        customTextInput.select();
    };

    customTextInput.addEventListener('input', () => {
        customTextInput.value = customTextInput.value.toUpperCase();
        customTextInput.classList.remove('is-invalid');
    });
    customTextInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runRegen();
    });
    regenButton.onclick = runRegen;

    sectionText.appendChild(btnCustomText);
    customTextInlineControls.appendChild(customTextInput);
    customTextInlineControls.appendChild(regenButton);
    sectionText.appendChild(customTextInlineControls);
    cameraHud.appendChild(sectionText);

    // --- BG controls ---
    const bgCfg = CONFIG.backgroundVideo;
    if (bgCfg && Array.isArray(bgCfg.sources) && bgCfg.sources.length > 0) {
        const sectionBg = document.createElement('div');
        sectionBg.className = 'controls-section';
        const bgControlsRow = document.createElement('div');
        bgControlsRow.className = 'camera-hud-bg-row';
        const bgControlsLeft = document.createElement('div');
        bgControlsLeft.className = 'camera-hud-bg-controls';

        const bgSelectLabel = document.createElement('label');
        bgSelectLabel.className = 'camera-hud-control-label';
        bgSelectLabel.innerText = 'Background';
        bgSelectLabel.htmlFor = 'bg-video-select';
        bgControlsLeft.appendChild(bgSelectLabel);

        const bgSelect = document.createElement('select');
        bgSelect.id = 'bg-video-select';
        bgSelect.className = 'camera-hud-select';
        bgCfg.sources.forEach((source) => {
            if (!source?.src) return;
            const option = document.createElement('option');
            option.value = normalizeBackgroundVideoSrc(source.src);
            option.textContent = getBackgroundVideoLabel(source.src);
            bgSelect.appendChild(option);
        });
        const activeSrc = activeBackgroundVideoSource?.src ?? bgCfg.sources[0]?.src;
        bgSelect.value = normalizeBackgroundVideoSrc(activeSrc);
        bgSelect.title = 'Wybierz wideo tła';
        bgSelect.addEventListener('change', () => setBackgroundVideoBySrc(bgSelect.value));

        const bgSelectRow = document.createElement('div');
        bgSelectRow.className = 'camera-hud-bg-select-row';
        bgSelectRow.appendChild(bgSelect);

        const bgPlayToggle = document.createElement('button');
        bgPlayToggle.type = 'button';
        bgPlayToggle.id = 'bg-video-play-toggle';
        bgPlayToggle.className = 'camera-hud-bg-play-toggle';
        bgPlayToggle.addEventListener('click', () => {
            if (!backgroundVideoEl) return;
            if (backgroundVideoEl.paused) {
                backgroundVideoUserPaused = false;
                backgroundVideoEl.play().catch(() => {});
            } else {
                backgroundVideoUserPaused = true;
                backgroundVideoEl.pause();
            }
            updateBackgroundVideoPlayToggleUi();
        });
        backgroundVideoPlayToggleBtn = bgPlayToggle;
        bgSelectRow.appendChild(bgPlayToggle);
        bgControlsLeft.appendChild(bgSelectRow);
        updateBackgroundVideoPlayToggleUi();

        const bpmControlCfg = bgCfg.bpmControl ?? {};
        const bpmOptions = Array.isArray(bpmControlCfg.options) && bpmControlCfg.options.length
            ? bpmControlCfg.options
            : [60, 75, 90, 100, 120, 140];

        const bpmLabel = document.createElement('label');
        bpmLabel.className = 'camera-hud-control-label';
        bpmLabel.innerText = 'Background BPM';
        bpmLabel.htmlFor = 'bg-bpm-select';
        bgControlsLeft.appendChild(bpmLabel);

        const bpmSelect = document.createElement('select');
        bpmSelect.id = 'bg-bpm-select';
        bpmSelect.className = 'camera-hud-select';
        bpmOptions.forEach((bpm) => {
            const bpmValue = Number(bpm);
            if (!Number.isFinite(bpmValue) || bpmValue <= 0) return;
            const option = document.createElement('option');
            option.value = String(bpmValue);
            option.textContent = `${bpmValue} BPM`;
            bpmSelect.appendChild(option);
        });

        const desiredBpm = Number(currentBackgroundBpm);
        if (Array.from(bpmSelect.options).some(opt => Number(opt.value) === desiredBpm)) {
            bpmSelect.value = String(desiredBpm);
        } else if (bpmSelect.options.length) {
            bpmSelect.selectedIndex = 0;
            applyBackgroundVideoPlaybackRate(Number(bpmSelect.value));
        }

        bpmSelect.title = 'Tempo animacji tła';
        bpmSelect.addEventListener('change', () => {
            applyBackgroundVideoPlaybackRate(Number(bpmSelect.value));
        });
        bgControlsLeft.appendChild(bpmSelect);

        const bpmIndicatorWrap = document.createElement('div');
        bpmIndicatorWrap.className = 'camera-hud-bpm-indicator-wrap';
        bpmIndicatorWrap.setAttribute('aria-label', 'Background beat indicator');
        const bpmIndicatorLabel = document.createElement('div');
        bpmIndicatorLabel.className = 'camera-hud-control-label camera-hud-bpm-indicator-label';
        bpmIndicatorLabel.textContent = 'Beat';
        bpmIndicatorWrap.appendChild(bpmIndicatorLabel);
        const bpmGrid = document.createElement('div');
        bpmGrid.className = 'camera-hud-bpm-grid';
        backgroundBeatSegments = [];
        for (let i = 0; i < 4; i++) {
            const segment = document.createElement('span');
            segment.className = 'camera-hud-bpm-segment';
            bpmGrid.appendChild(segment);
            backgroundBeatSegments.push(segment);
        }
        backgroundBeatLastStep = -1;
        bpmIndicatorWrap.appendChild(bpmGrid);

        bgControlsRow.appendChild(bgControlsLeft);
        bgControlsRow.appendChild(bpmIndicatorWrap);
        sectionBg.appendChild(bgControlsRow);

        cameraHud.appendChild(sectionBg);
        initPerformanceHud(cameraHud);
    }
    if (!cameraHud.querySelector('#perf-hud')) {
        initPerformanceHud(cameraHud);
    }
    document.body.appendChild(cameraHud);
    initSectionMenuToggles();

    // --- Glitch volumetryczne ---
    const btnGlitchTrigger = document.getElementById('btn-glitch-trigger');
    const presetButtons = {
        subtelny: btnPresetSubtelny,
        mocny: btnPresetMocny,
        chaos: btnPresetChaos
    };

    if (btnGlitchToggle) {
        btnGlitchToggle.classList.toggle('active', GLITCH_VOLUME_CONFIG.enabled);
        btnGlitchToggle.title = 'Włącz/wyłącz blokowe przeskoki fragmentów napisu';
        btnGlitchToggle.onclick = () => {
            GLITCH_VOLUME_CONFIG.enabled = !GLITCH_VOLUME_CONFIG.enabled;
            btnGlitchToggle.classList.toggle('active', GLITCH_VOLUME_CONFIG.enabled);
            if (!GLITCH_VOLUME_CONFIG.enabled) glitchVolumeNextTrigger = 0;
        };
    }

    if (btnGlitchTrigger) {
        btnGlitchTrigger.title = 'Jednorazowe wywołanie glitcha';
        // Must match render loop `time` (wall seconds), not clock.getElapsedTime(), or glitchEndTime is ~0–100s while time is unix → instant expiry.
        btnGlitchTrigger.onclick = () => triggerVolumetricGlitch(Date.now() * 0.001);
    }

    const applyGlitchPreset = (name) => {
        const preset = GLITCH_VOLUME_PRESETS[name];
        if (!preset) return;

        // Nadpisujemy tylko wybrane pola w głównym configu
        GLITCH_VOLUME_CONFIG.pattern = preset.pattern;
        GLITCH_VOLUME_CONFIG.duration = preset.duration;
        GLITCH_VOLUME_CONFIG.maxOffset = preset.maxOffset;
        if (preset.bandsPerGlitch != null) GLITCH_VOLUME_CONFIG.bandsPerGlitch = preset.bandsPerGlitch;
        if (preset.tilesPerGlitch != null) GLITCH_VOLUME_CONFIG.tilesPerGlitch = preset.tilesPerGlitch;
        if (preset.clusterFraction != null) GLITCH_VOLUME_CONFIG.clusterFraction = preset.clusterFraction;
        if (preset.intervalMin != null) GLITCH_VOLUME_CONFIG.intervalMin = preset.intervalMin;
        if (preset.intervalMax != null) GLITCH_VOLUME_CONFIG.intervalMax = preset.intervalMax;
        GLITCH_VOLUME_CONFIG.useRotation = !!preset.useRotation;
        GLITCH_VOLUME_CONFIG.useScale = !!preset.useScale;
        GLITCH_VOLUME_CONFIG.useColorFlicker = !!preset.useColorFlicker;

        GLITCH_VOLUME_STATE.currentPreset = name;

        // Resetujemy auto-trigger, żeby szybko zobaczyć zmianę charakteru glitcha
        glitchVolumeNextTrigger = 0;

        // Aktualizujemy klasę active na przyciskach presetów
        Object.keys(presetButtons).forEach(key => {
            presetButtons[key]?.classList.toggle('active', key === name);
        });
    };

    if (btnPresetSubtelny) {
        btnPresetSubtelny.title = 'Delikatny glitch (bands/grid2d)';
        btnPresetSubtelny.onclick = () => applyGlitchPreset('subtelny');
    }

    if (btnPresetMocny) {
        btnPresetMocny.title = 'Mocniejszy glitch z rotacją i skalą';
        btnPresetMocny.onclick = () => applyGlitchPreset('mocny');
    }

    if (btnPresetChaos) {
        btnPresetChaos.title = 'Chaotyczne klastry voxelowe';
        btnPresetChaos.onclick = () => applyGlitchPreset('chaos');
    }

    // Ustaw stan początkowy presetów zgodnie z configiem
    if (GLITCH_VOLUME_STATE.currentPreset && presetButtons[GLITCH_VOLUME_STATE.currentPreset]) {
        presetButtons[GLITCH_VOLUME_STATE.currentPreset].classList.add('active');
    }

    window.cinematicButton = btnCinematic;
    window.freeCamButton = btnFreeCam;

    // Vajbuj: ukryty (nie dodajemy przycisku)

    // --- NEW UI ELEMENTS ---

    // 1. Production Label (Left)
    const label = document.createElement('div');
    label.className = 'prod-label';
    label.innerHTML = 'TOP KEK Productions &reg; - Handcrafted Experiences';
    document.body.appendChild(label);

    // 2. Terminal Menu Logic
    const termAppstain = document.getElementById('term-appstain');
    const termGlitch = document.getElementById('term-glitch');
    const termGenimg = document.getElementById('term-genimg');
    const termPortfolio = document.getElementById('term-portfolio');
    const termScndbrejn = document.getElementById('term-scndbrejn');
    const termAnimPortfolio = document.getElementById('term-anim-portfolio');

    if (termAnimPortfolio) {
        termAnimPortfolio.addEventListener('click', () => {
            if (portfolioSceneActive) {
                exitPortfolioScene();
                termAnimPortfolio.classList.remove('portfolio-active');
                return;
            }
            portfolioSceneActive = true;
            termAnimPortfolio.classList.add('portfolio-active');
            if (!portfolioState.initialized) {
                initPortfolio(true);
                portfolioState.initialized = true;
            }
            controls.enabled = false;
            portfolioScenePhase = 'camera_move';
            portfolioScenePhaseStartTime = Date.now();
            portfolioSceneStartTime = Date.now();
        });
    }

    const termVajbuj = document.getElementById('term-vajbuj');
    if (termVajbuj) {
        window.vajbujButton = termVajbuj;
    }

    const termMysen = document.getElementById('term-mysen');
    if (termMysen) {
        window.mysenButton = termMysen;
    }

    if (termAppstain) {
        termAppstain.onclick = () => {
            const modal = document.getElementById('appstain-modal');
            modal.classList.remove('hidden');
            modal.classList.remove('appstain-modal-closing');
            if (typeof TopkekTrumpHead !== 'undefined' && document.getElementById('topkek-trump-head')) {
                TopkekTrumpHead.init({
                    imagePath: 'ASSETS/APPSTAIN/character_head.png',
                    minInterval: 20000,
                    maxInterval: 45000
                });
            }
        };
    }

    if (termGlitch) {
        termGlitch.onclick = () => {
            document.getElementById('glitch-modal').classList.remove('hidden');
            loadGlitchContent(); // Load content when opened
        };
    }

    if (termGenimg) {
        termGenimg.onclick = () => {
            document.getElementById('genimg-modal').classList.remove('hidden');
        };
    }

    if (termScndbrejn) {
        termScndbrejn.onclick = () => {
            document.getElementById('scndbrejn-modal').classList.remove('hidden');
        };
    }

    if (termPortfolio) {
        termPortfolio.onclick = () => {
            openPortfolioModal(CONFIG.portfolio?.sampleVimeoUrl || "https://player.vimeo.com/video/1170695269");
        };
    }

    // 3. APPSTAIN Modal Logic
    const initAppstainModal = () => {
        const modal = document.getElementById('appstain-modal');
        const closeBtn = document.getElementById('appstain-close');
        const submitBtn = document.getElementById('appstain-submit');
        const passwordInput = document.getElementById('appstain-password');
        const errorMsg = document.getElementById('appstain-error');

        closeBtn.onclick = () => {
            modal.classList.add('appstain-modal-closing');
            const onCloseEnd = (e) => {
                if (e.target !== modal) return;
                modal.removeEventListener('animationend', onCloseEnd);
                modal.classList.add('hidden');
                modal.classList.remove('appstain-modal-closing');
                errorMsg.classList.remove('visible');
                passwordInput.value = '';
            };
            modal.addEventListener('animationend', onCloseEnd);
        };

        const checkPassword = () => {
            if (passwordInput.value === CONFIG.appstainPassword) {
                window.location.href = CONFIG.appstainRedirectUrl || 'https://xcwajdax.github.io/appstainsaga/';
            } else {
                errorMsg.classList.add('visible');
                passwordInput.value = '';
            }
        };

        submitBtn.onclick = checkPassword;

        // Allow Enter key to submit
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                checkPassword();
            }
        });

        // Image viewer: click any APPSTAIN screenshot/quest image to open full size
        const content = document.getElementById('appstain-content');
        const viewer = document.getElementById('image-viewer');
        const fullImg = document.getElementById('full-image');
        if (content && viewer && fullImg) {
            content.querySelectorAll('.appstain-screenshot').forEach((img) => {
                img.addEventListener('click', () => {
                    fullImg.src = img.src;
                    viewer.classList.remove('hidden');
                });
            });
        }

        // Custom audio player for APPSTAIN modal
        const audioEl = document.getElementById('appstain-audio-el');
        const playBtn = document.getElementById('appstain-audio-play');
        const seekInput = document.getElementById('appstain-audio-seek');
        const progressFill = document.getElementById('appstain-audio-progress-fill');
        const timeEl = document.getElementById('appstain-audio-time');
        if (audioEl && playBtn && seekInput && progressFill && timeEl) {
            const formatTime = (s) => {
                if (!isFinite(s) || s < 0) return '0:00';
                const m = Math.floor(s / 60);
                const sec = Math.floor(s % 60);
                return m + ':' + (sec < 10 ? '0' : '') + sec;
            };
            const updateTime = () => {
                const cur = audioEl.currentTime;
                const dur = audioEl.duration;
                timeEl.textContent = formatTime(cur) + ' / ' + formatTime(dur);
                const pct = dur > 0 ? (cur / dur) * 100 : 0;
                seekInput.value = pct;
                progressFill.style.width = pct + '%';
            };
            playBtn.addEventListener('click', () => {
                if (audioEl.paused) {
                    audioEl.play();
                    playBtn.textContent = 'Pause';
                    playBtn.classList.add('playing');
                    playBtn.setAttribute('aria-label', 'Pause');
                } else {
                    audioEl.pause();
                    playBtn.textContent = 'Play';
                    playBtn.classList.remove('playing');
                    playBtn.setAttribute('aria-label', 'Play');
                }
            });
            audioEl.addEventListener('play', () => {
                playBtn.textContent = 'Pause';
                playBtn.classList.add('playing');
            });
            audioEl.addEventListener('pause', () => {
                playBtn.textContent = 'Play';
                playBtn.classList.remove('playing');
            });
            audioEl.addEventListener('timeupdate', updateTime);
            audioEl.addEventListener('durationchange', updateTime);
            audioEl.addEventListener('ended', () => {
                playBtn.textContent = 'Play';
                playBtn.classList.remove('playing');
                updateTime();
            });
            seekInput.addEventListener('input', () => {
                const pct = parseFloat(seekInput.value);
                if (audioEl.duration) {
                    audioEl.currentTime = (pct / 100) * audioEl.duration;
                }
                progressFill.style.width = pct + '%';
            });
            updateTime();
        }
    };
    initAppstainModal();

    // GENIMG Modal – open/close
    const genimgModal = document.getElementById('genimg-modal');
    const genimgClose = document.getElementById('genimg-close');
    const genimgBackdrop = document.getElementById('genimg-backdrop');
    if (genimgModal && genimgClose) {
        genimgClose.onclick = () => genimgModal.classList.add('hidden');
        if (genimgBackdrop) genimgBackdrop.onclick = () => genimgModal.classList.add('hidden');
    }

    const scndbrejnModal = document.getElementById('scndbrejn-modal');
    const scndbrejnClose = document.getElementById('scndbrejn-close');
    const scndbrejnBackdrop = document.getElementById('scndbrejn-backdrop');
    if (scndbrejnModal && scndbrejnClose) {
        scndbrejnClose.onclick = () => scndbrejnModal.classList.add('hidden');
        if (scndbrejnBackdrop) scndbrejnBackdrop.onclick = () => scndbrejnModal.classList.add('hidden');
    }
    // GENIMG gallery: click thumb to open in image-viewer (same as APPSTAIN)
    const genimgContent = document.getElementById('genimg-content');
    const imageViewer = document.getElementById('image-viewer');
    const fullImageEl = document.getElementById('full-image');
    if (genimgContent && imageViewer && fullImageEl) {
        genimgContent.querySelectorAll('.genimg-thumb').forEach((img) => {
            img.addEventListener('click', () => {
                fullImageEl.src = img.src;
                imageViewer.classList.remove('hidden');
            });
        });
    }

    // 4. Glitch Lab Modal Logic
    // currentLang is now global


    const initGlitchModal = () => {
        const modal = document.getElementById('glitch-modal');
        const backdrop = document.getElementById('glitch-backdrop');
        const closeBtn = document.getElementById('glitch-close');
        const langPl = document.getElementById('lang-pl');
        const langEng = document.getElementById('lang-eng');

        closeBtn.onclick = () => modal.classList.add('hidden');
        if (backdrop) backdrop.onclick = () => modal.classList.add('hidden');

        langPl.onclick = () => {
            if (currentLang !== 'PL') {
                currentLang = 'PL';
                langPl.classList.add('active');
                langEng.classList.remove('active');
                loadGlitchContent();
            }
        };

        langEng.onclick = () => {
            if (currentLang !== 'ENG') {
                currentLang = 'ENG';
                langEng.classList.add('active');
                langPl.classList.remove('active');
                loadGlitchContent();
            }
        };

        // Image Zoom Logic
        const imgContainer = document.getElementById('glitch-img-container');
        const viewer = document.getElementById('image-viewer');
        const fullImg = document.getElementById('full-image');

        if (imgContainer) {
            const thumb = imgContainer.querySelector('img');
            thumb.onclick = () => {
                fullImg.src = thumb.src;
                viewer.classList.remove('hidden');
            };
        }

        if (viewer) {
            viewer.onclick = () => {
                viewer.classList.add('hidden');
            };
        }
    };
    initGlitchModal();

    // 5. Portfolio Vimeo Modal Logic
    const initPortfolioVimeoModal = () => {
        const modal = document.getElementById('portfolio-vimeo-modal');
        const closeBtn = document.getElementById('portfolio-vimeo-close');
        const backdrop = document.getElementById('portfolio-vimeo-backdrop');
        const iframe = document.getElementById('portfolio-vimeo-iframe');

        if (!modal || !closeBtn || !backdrop || !iframe) return;

        const close = () => {
            iframe.src = '';
            modal.classList.add('hidden');
        };

        closeBtn.onclick = close;
        backdrop.onclick = close;
    };
    initPortfolioVimeoModal();

    const initPortfolioDetailModal = () => {
        const modal = document.getElementById('portfolio-detail-modal');
        const closeBtn = document.getElementById('portfolio-detail-close');
        const backdrop = modal?.querySelector('.portfolio-detail-backdrop');
        if (!modal || !closeBtn || !backdrop) return;
        const close = () => modal.classList.add('hidden');
        closeBtn.onclick = close;
        backdrop.onclick = close;
    };
    initPortfolioDetailModal();

    // --- END NEW UI ELEMENTS ---

    initTopkekTerminalShell({ onCommand: runTopkekTerminalCommand });

    if (document.body) {
        fxDevPanelControl = initFxDevPanel({
            mountRoot: document.body,
            api: {
                getRuntime: fxDevGetRuntime,
                setEnabled: fxDevSetEnabled,
                setBpm: fxDevSetBpm,
                applyDefaultKey: fxDevApplyDefaultKey,
                runStart: (effectId, mode, overrides) => {
                    const res = startFxEffect(effectId, mode, overrides);
                    return res.lines || [];
                },
                runStop: stopFxEffects,
                parseFxParamsFromParts: (parts) => parseFxParams(parts, 0),
                applyPreset: fxDevApplyPreset,
                exportPreset: fxDevExportPreset,
                exportEffectPreset: fxDevExportEffectPreset,
                getActiveInstances: fxDevGetActiveInstances,
                setInstancePaused: fxDevSetInstancePaused,
                removeInstance: fxDevRemoveInstance,
                moveActiveInstance: fxDevMoveActiveInstance,
                log: (msg) => console.log('[FX dev]', msg)
            }
        });
    }

    if (IS_MOBILE) {
        const info = document.createElement('div');
        info.className = 'mobile-info';
        info.innerText = 'Check out on Pc/MAC';
        document.body.appendChild(info);

        // Letter selection UI
        const letterContainer = document.createElement('div');
        letterContainer.id = 'mobile-letters-container';

        ['T', 'O', 'P', 'K', 'E', 'K'].forEach(letter => {
            const btn = document.createElement('button');
            btn.className = 'letter-btn';
            btn.innerText = letter;
            btn.onclick = () => updateText(letter);
            letterContainer.appendChild(btn);
        });

        document.body.appendChild(letterContainer);
    }
}

function initPerformanceHud(parentEl) {
    if (!PERF_HUD_CONFIG.enabled) return;
    if (document.getElementById('perf-hud')) return;
    if (!parentEl) return;

    const hud = document.createElement('div');
    hud.id = 'perf-hud';
    hud.className = 'perf-hud perf-hud--good';

    const title = document.createElement('div');
    title.className = 'perf-hud-title';
    title.textContent = 'Performance';
    hud.appendChild(title);

    const row = document.createElement('div');
    row.className = 'perf-hud-row';
    const fps = document.createElement('span');
    fps.className = 'perf-hud-fps';
    fps.textContent = 'FPS: --';
    const high = document.createElement('span');
    high.className = 'perf-hud-stat';
    high.textContent = 'H: --';
    const low = document.createElement('span');
    low.className = 'perf-hud-stat';
    low.textContent = 'L: --';
    row.appendChild(fps);
    row.appendChild(high);
    row.appendChild(low);
    hud.appendChild(row);

    const canvas = document.createElement('canvas');
    canvas.className = 'perf-hud-graph';
    canvas.width = PERF_HUD_CONFIG.graph.width;
    canvas.height = PERF_HUD_CONFIG.graph.height;
    hud.appendChild(canvas);

    parentEl.appendChild(hud);

    perfHudRootEl = hud;
    perfHudFpsEl = fps;
    perfHudHighEl = high;
    perfHudLowEl = low;
    perfHudCanvasEl = canvas;
    perfHudCtx = canvas.getContext('2d');
}

function getPerfStatusClass(fpsValue) {
    if (fpsValue >= PERF_HUD_CONFIG.thresholds.goodFps) return 'perf-hud--good';
    if (fpsValue >= PERF_HUD_CONFIG.thresholds.warnFps) return 'perf-hud--warn';
    return 'perf-hud--bad';
}

function drawPerformanceGraph() {
    if (!perfHudCtx || !perfHudCanvasEl || perfHudState.samples.length < 2) return;
    const ctx = perfHudCtx;
    const w = perfHudCanvasEl.width;
    const h = perfHudCanvasEl.height;
    const yMax = Math.max(1, PERF_HUD_CONFIG.graph.yMaxFps);
    const warnY = h - (Math.min(PERF_HUD_CONFIG.thresholds.warnFps, yMax) / yMax) * h;
    const goodY = h - (Math.min(PERF_HUD_CONFIG.thresholds.goodFps, yMax) / yMax) * h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 204, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, warnY);
    ctx.lineTo(w, warnY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 255, 153, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, goodY);
    ctx.lineTo(w, goodY);
    ctx.stroke();

    const samples = perfHudState.samples;
    const len = samples.length;
    const stepX = len > 1 ? w / (len - 1) : w;
    let lowIdx = 0;
    let highIdx = 0;
    for (let i = 1; i < len; i++) {
        if (samples[i] < samples[lowIdx]) lowIdx = i;
        if (samples[i] > samples[highIdx]) highIdx = i;
    }

    ctx.strokeStyle = 'rgba(160, 255, 190, 0.95)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
        const sample = Math.max(0, Math.min(yMax, samples[i]));
        const x = i * stepX;
        const y = h - (sample / yMax) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const drawMarker = (index, color) => {
        const sample = Math.max(0, Math.min(yMax, samples[index]));
        const x = index * stepX;
        const y = h - (sample / yMax) * h;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill();
    };

    drawMarker(highIdx, '#00ff99');
    drawMarker(lowIdx, '#ff3b3b');
}

function updatePerformanceHud(frameNowMs) {
    if (!PERF_HUD_CONFIG.enabled || !perfHudRootEl) return;
    if (perfHudState.lastFrameTs === 0) {
        perfHudState.lastFrameTs = frameNowMs;
        return;
    }

    const deltaMs = frameNowMs - perfHudState.lastFrameTs;
    perfHudState.lastFrameTs = frameNowMs;
    if (deltaMs <= 0) return;

    const instFps = 1000 / deltaMs;
    const alpha = Math.max(0.01, Math.min(1, PERF_HUD_CONFIG.smoothingAlpha));
    perfHudState.smoothedFps = perfHudState.smoothedFps > 0
        ? perfHudState.smoothedFps + (instFps - perfHudState.smoothedFps) * alpha
        : instFps;

    if ((frameNowMs - perfHudState.lastUiTs) < PERF_HUD_CONFIG.updateIntervalMs) return;
    perfHudState.lastUiTs = frameNowMs;

    const maxSamples = Math.max(8, PERF_HUD_CONFIG.graph.maxSamples);
    perfHudState.samples.push(perfHudState.smoothedFps);
    if (perfHudState.samples.length > maxSamples) {
        perfHudState.samples.splice(0, perfHudState.samples.length - maxSamples);
    }

    const roundedCurrent = Math.round(perfHudState.smoothedFps);
    const roundedHigh = Math.round(Math.max(...perfHudState.samples));
    const roundedLow = Math.round(Math.min(...perfHudState.samples));
    const statusClass = getPerfStatusClass(perfHudState.smoothedFps);

    perfHudRootEl.classList.remove('perf-hud--good', 'perf-hud--warn', 'perf-hud--bad');
    perfHudRootEl.classList.add(statusClass);
    perfHudFpsEl.textContent = `FPS: ${roundedCurrent}`;
    perfHudHighEl.textContent = `H: ${roundedHigh}`;
    perfHudLowEl.textContent = `L: ${roundedLow}`;

    drawPerformanceGraph();
}

// Helper to load and render markdown
async function loadGlitchContent() {
    const contentDiv = document.getElementById('glitch-md-content');
    const filename = currentLang === 'PL' ? 'README_GL_PL.md' : 'README_GL_ENG.md';

    try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error('Failed to load file');
        const text = await response.text();

        // Simple Markdown Parsing
        // 1. Headers
        let html = text.replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            // 2. Bold
            .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
            // 3. Line breaks
            .replace(/\n/gim, '<br>');

        contentDiv.innerHTML = html;

    } catch (err) {
        console.error("Error loading README:", err);
        contentDiv.innerHTML = "Error loading content. Please check the file exists.";
    }
}

async function updateText(newText) {
    if (!loadedFont) return;

    // Show loader again
    loaderContainer.style.display = 'flex';
    loaderContainer.classList.remove('hidden');
    loadState.generation = 0;
    startLoaderSimulation();
    updateProgress();

    // Allow UI to update
    await new Promise(resolve => setTimeout(resolve, 50));

    // Cleanup existing
    Object.values(meshRegistry).forEach(entry => {
        if (entry.top) {
            scene.remove(entry.top);
            entry.top.geometry.dispose();
        }
        if (entry.kek) {
            scene.remove(entry.kek);
            entry.kek.geometry.dispose();
        }
    });
    meshRegistry = {};

    if (innerCubeInstancedMesh) {
        scene.remove(innerCubeInstancedMesh);
        innerCubeInstancedMesh.geometry.dispose();
        innerCubeInstancedMesh.material.dispose();
    }

    // Reset arrays
    cubeGroups = [];
    innerCubeParticles = [];

    CONFIG.text = newText;
    CONFIG.text = newText;
    await generateParticles(loadedFont, loadedFontRegular);

    stopLoaderSimulation({ finalize: true });
    loaderContainer.classList.add('hidden');
    setTimeout(() => {
        loaderContainer.style.display = 'none';
    }, 500);
}

function setMode(mode, activeBtn, inactiveBtns) {
    CONFIG.animationMode = mode;
    activeBtn.classList.add('active');
    if (Array.isArray(inactiveBtns)) {
        inactiveBtns.forEach(btn => btn.classList.remove('active'));
    } else {
        inactiveBtns.classList.remove('active');
    }
}

function triggerVolumetricGlitch(time) {
    const cfg = GLITCH_VOLUME_CONFIG;
    if (!cubeGroups.length) return;

    const maxOffset = cfg.maxOffset;
    const duration = cfg.duration;
    const endTime = time + duration;

    const targetGroups = [];
    const targetInner = [];

    // --- Pattern selection for cubeGroups ---
    if (cfg.pattern === 'grid2d' || cfg.pattern === 'bands') {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < cubeGroups.length; i++) {
            const p = cubeGroups[i].originalPos;
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        const spanX = maxX - minX;
        const spanY = maxY - minY;
        if (spanX <= 0) return;

        if (cfg.pattern === 'bands') {
            const bandCount = Math.max(1, cfg.bandCount);
            const bandsPerGlitch = Math.min(cfg.bandsPerGlitch, bandCount);
            const selectedBands = new Set();
            while (selectedBands.size < bandsPerGlitch) {
                selectedBands.add(Math.floor(Math.random() * bandCount));
            }

            for (let i = 0; i < cubeGroups.length; i++) {
                const group = cubeGroups[i];
                const bandIdx = Math.min(
                    bandCount - 1,
                    Math.floor(((group.originalPos.x - minX) / spanX) * bandCount)
                );
                if (selectedBands.has(bandIdx)) targetGroups.push(group);
            }

            if (cfg.includeInnerCubes && innerCubeParticles.length > 0) {
                let innerMinX = Infinity;
                let innerMaxX = -Infinity;
                for (let i = 0; i < innerCubeParticles.length; i++) {
                    const x = innerCubeParticles[i].originalPos.x;
                    if (x < innerMinX) innerMinX = x;
                    if (x > innerMaxX) innerMaxX = x;
                }
                const innerSpanX = innerMaxX - innerMinX;
                if (innerSpanX > 0) {
                    for (let i = 0; i < innerCubeParticles.length; i++) {
                        const data = innerCubeParticles[i];
                        const bandIdx = Math.min(
                            bandCount - 1,
                            Math.floor(((data.originalPos.x - innerMinX) / innerSpanX) * bandCount)
                        );
                        if (selectedBands.has(bandIdx)) targetInner.push(data);
                    }
                }
            }
        } else {
            const cols = Math.max(1, cfg.gridCols || 4);
            const rows = Math.max(1, cfg.gridRows || 3);
            const tilesPerGlitch = Math.min(cfg.tilesPerGlitch || 1, cols * rows);

            const chosenTiles = new Set();
            while (chosenTiles.size < tilesPerGlitch) {
                const c = Math.floor(Math.random() * cols);
                const r = Math.floor(Math.random() * rows);
                chosenTiles.add(`${c},${r}`);
            }

            const getTileIndex = (x, y) => {
                const colIdx = Math.min(cols - 1, Math.max(0, Math.floor(((x - minX) / spanX) * cols)));
                const rowIdx = spanY > 0
                    ? Math.min(rows - 1, Math.max(0, Math.floor(((y - minY) / spanY) * rows)))
                    : 0;
                return `${colIdx},${rowIdx}`;
            };

            for (let i = 0; i < cubeGroups.length; i++) {
                const group = cubeGroups[i];
                const key = getTileIndex(group.originalPos.x, group.originalPos.y);
                if (chosenTiles.has(key)) targetGroups.push(group);
            }

            if (cfg.includeInnerCubes && innerCubeParticles.length > 0) {
                for (let i = 0; i < innerCubeParticles.length; i++) {
                    const data = innerCubeParticles[i];
                    const key = getTileIndex(data.originalPos.x, data.originalPos.y);
                    if (chosenTiles.has(key)) targetInner.push(data);
                }
            }
        }
    } else {
        // clusters
        const total = cubeGroups.length;
        if (total === 0) return;
        let targetCount = Math.round((cfg.clusterFraction || 0.05) * total);
        if (cfg.clusterMinCount != null) targetCount = Math.max(cfg.clusterMinCount, targetCount);
        if (cfg.clusterMaxCount != null) targetCount = Math.min(cfg.clusterMaxCount, targetCount);
        targetCount = Math.min(targetCount, total);

        const indices = [];
        for (let i = 0; i < total; i++) indices.push(i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = indices[i];
            indices[i] = indices[j];
            indices[j] = tmp;
        }
        for (let i = 0; i < targetCount; i++) {
            targetGroups.push(cubeGroups[indices[i]]);
        }

        if (cfg.includeInnerCubes && innerCubeParticles.length > 0) {
            const innerTotal = innerCubeParticles.length;
            let innerTargetCount = Math.round((cfg.clusterFraction || 0.05) * innerTotal);
            if (cfg.clusterMinCount != null) innerTargetCount = Math.max(cfg.clusterMinCount, innerTargetCount);
            if (cfg.clusterMaxCount != null) innerTargetCount = Math.min(cfg.clusterMaxCount, innerTargetCount);
            innerTargetCount = Math.min(innerTargetCount, innerTotal);

            const innerIdx = [];
            for (let i = 0; i < innerTotal; i++) innerIdx.push(i);
            for (let i = innerIdx.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = innerIdx[i];
                innerIdx[i] = innerIdx[j];
                innerIdx[j] = tmp;
            }
            for (let i = 0; i < innerTargetCount; i++) {
                targetInner.push(innerCubeParticles[innerIdx[i]]);
            }
        }
    }

    const applyGlitchTo = (targetArray) => {
        for (let i = 0; i < targetArray.length; i++) {
            const item = targetArray[i];
            if (maxOffset > 0) {
                item.glitchDisplayOffset.set(
                    (Math.random() - 0.5) * 2 * maxOffset,
                    (Math.random() - 0.5) * 2 * maxOffset,
                    (Math.random() - 0.5) * 2 * maxOffset
                );
            } else {
                item.glitchDisplayOffset.set(0, 0, 0);
            }
            item.glitchEndTime = endTime;

            if (cfg.useRotation) {
                const axis = new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize();
                const angle = (Math.random() * 2 - 1) * (cfg.rotationMaxAngle || Math.PI / 4);
                if (!item.glitchRotation) item.glitchRotation = new THREE.Quaternion();
                item.glitchRotation.setFromAxisAngle(axis, angle);
            } else {
                item.glitchRotation = null;
            }

            if (cfg.useScale) {
                const sRangeMin = cfg.scaleMin != null ? cfg.scaleMin : 0.9;
                const sRangeMax = cfg.scaleMax != null ? cfg.scaleMax : 1.15;
                const s = sRangeMin + Math.random() * (sRangeMax - sRangeMin);
                if (!item.glitchScale) item.glitchScale = new THREE.Vector3(1, 1, 1);
                item.glitchScale.set(s, s, s);
            } else {
                item.glitchScale = null;
            }
        }
    };

    applyGlitchTo(targetGroups);
    applyGlitchTo(targetInner);
}

function setCameraMode(mode) {
    if (mode === 'free') {
        introCameraFlyInActive = false;
        isFreeCam = true;
        controls.enabled = true;
        controls.target.copy(cameraFocusPoint);
        controls.update();
        isCinematic = false;
        isDragging = false; // Stop any custom dragging
    } else if (mode === 'dynamic') {
        introCameraFlyInActive = false;
        isFreeCam = false;
        controls.enabled = false;
        isCinematic = true;

        // Reset Focus Point so we look at the text again
        cameraFocusPoint.set(0, 0, 0);

        // Sync internal state to current camera position (prevent jump)
        const pos = camera.position;
        cameraRadius = pos.length();
        // Avoid division by zero
        if (cameraRadius > 0.1) {
            cameraVerticalAngle = Math.asin(pos.y / cameraRadius);
        } else {
            cameraVerticalAngle = 0;
        }
        cameraAngle = Math.atan2(pos.x, pos.z);

        // Update targets to match
        targetCameraAngle = cameraAngle;
        targetCameraVerticalAngle = cameraVerticalAngle;
        targetCameraRadius = cameraRadius;

        cinematicSwitchTime = Date.now() + 2000; // Small delay before next cut
    } else if (mode === 'manual') {
        isFreeCam = false;
        controls.enabled = false;
        isCinematic = false;
    }

    // Sync UI buttons (Free Cam / Dynamic Cam)
    if (window.cinematicButton) {
        if (isCinematic) {
            window.cinematicButton.classList.add('active');
            if (window.freeCamButton) window.freeCamButton.classList.remove('active');
        } else {
            window.cinematicButton.classList.remove('active');
            if (window.freeCamButton) window.freeCamButton.classList.add('active');
        }
    }
}

function resetCameraToDefaultView() {
    if (typeof portfolioSceneActive !== 'undefined' && portfolioSceneActive) {
        exitPortfolioScene();
        const ap = document.getElementById('term-anim-portfolio');
        if (ap) ap.classList.remove('portfolio-active');
    }

    introCameraFlyInActive = false;

    const fov = CAMERA_HUD_CONFIG.defaultFov;
    const z0 = CONFIG.initialZoom;

    cameraFocusPoint.set(0, 0, 0);
    cameraAngle = 0;
    cameraVerticalAngle = 0;
    cameraRadius = z0;
    targetCameraAngle = 0;
    targetCameraVerticalAngle = 0;
    targetCameraRadius = z0;
    cinematicDollySpeed = 0;

    if (camera) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
    }

    if (isFreeCam && controls) {
        camera.position.set(0, 0, z0);
        controls.target.set(0, 0, 0);
        cameraFocusPoint.copy(controls.target);
        controls.update();
    } else if (camera) {
        const horizontalRadius = cameraRadius * Math.cos(cameraVerticalAngle);
        camera.position.x = cameraFocusPoint.x + Math.sin(cameraAngle) * horizontalRadius;
        camera.position.z = cameraFocusPoint.z + Math.cos(cameraAngle) * horizontalRadius;
        camera.position.y = cameraFocusPoint.y + Math.sin(cameraVerticalAngle) * cameraRadius;
        camera.lookAt(cameraFocusPoint);
    }

    if (isCinematic) {
        cinematicSwitchTime = Date.now() + 2000;
    }
}

function updateCameraHud() {
    if (!camera || !cameraHudModeEl || !cameraHudPosEl || !cameraHudTgtEl) return;

    const d = CAMERA_HUD_CONFIG.coordinateDecimals;
    const fmt = (n) => n.toFixed(d);
    const p = camera.position;
    cameraHudPosEl.textContent = `pos: ${fmt(p.x)} ${fmt(p.y)} ${fmt(p.z)}`;

    if (isFreeCam && controls) {
        const t = controls.target;
        cameraHudTgtEl.textContent = `tgt: ${fmt(t.x)} ${fmt(t.y)} ${fmt(t.z)}`;
        cameraHudTgtEl.classList.remove('camera-hud-coords--hidden');
    } else {
        cameraHudTgtEl.textContent = '';
        cameraHudTgtEl.classList.add('camera-hud-coords--hidden');
    }

    let modeLabel = 'Manual';
    if (portfolioSceneActive) modeLabel = 'Portfolio';
    else if (isFreeCam) modeLabel = 'Free';
    else if (isCinematic) modeLabel = 'Dynamic';
    cameraHudModeEl.textContent = `Mode: ${modeLabel}`;
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function computeMotionDesignTargets(font) {
    if (!font || !CONFIG.subtitle || !PORTFOLIO_SCENE_CONFIG) return null;
    const lineOffset = PORTFOLIO_SCENE_CONFIG.motionDesignLineOffset || 1.2;
    const offsetY = CONFIG.subtitle.offsetY + lineOffset;
    const opts = { font, size: CONFIG.subtitle.size, height: CONFIG.subtitle.height, curveSegments: 6, bevelEnabled: false };
    const letterSpacing = CONFIG.subtitle.letterSpacing;

    const buildWord = (word) => {
        const geos = [];
        let xOff = 0;
        for (const char of word) {
            const g = new TextGeometry(char, opts);
            g.computeBoundingBox();
            const w = g.boundingBox.max.x - g.boundingBox.min.x;
            g.translate(xOff, 0, 0);
            geos.push(g);
            xOff += w + letterSpacing;
        }
        return geos.length ? BufferGeometryUtils.mergeGeometries(geos) : null;
    };

    const g1 = buildWord('MOTION ');
    const gHeart = buildWord(' ');
    const g2 = buildWord(' DESIGN');
    if (!g1 || !g2) return null;

    g1.computeBoundingBox();
    const w1 = g1.boundingBox.max.x - g1.boundingBox.min.x;
    let heartCenterX = w1 + letterSpacing;
    let wHeart = 0;
    if (gHeart) {
        gHeart.computeBoundingBox();
        wHeart = (gHeart.boundingBox.max.x - gHeart.boundingBox.min.x) + letterSpacing;
        const hw = wHeart - letterSpacing;
        heartCenterX += hw * 0.5;
        gHeart.translate(w1 + letterSpacing, 0, 0);
    }
    g2.computeBoundingBox();
    g2.translate(w1 + letterSpacing + wHeart, 0, 0);

    const geos = [g1];
    if (gHeart) geos.push(gHeart);
    geos.push(g2);
    const merged = BufferGeometryUtils.mergeGeometries(geos);
    merged.computeBoundingBox();
    const totalW = merged.boundingBox.max.x - merged.boundingBox.min.x;
    const subOffsetX = -totalW / 2;
    merged.translate(subOffsetX, offsetY, 0);
    heartCenterX += subOffsetX;

    const mdVoxelMap = new Map();
    const startX = Math.floor(merged.boundingBox.min.x / CONFIG.particleSize);
    const endX = Math.ceil(merged.boundingBox.max.x / CONFIG.particleSize);
    const startY = Math.floor(merged.boundingBox.min.y / CONFIG.particleSize);
    const endY = Math.ceil(merged.boundingBox.max.y / CONFIG.particleSize);
    const subRaycaster = new THREE.Raycaster();
    const subDirection = new THREE.Vector3(0, 0, -1);
    const subMesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
    subMesh.updateMatrixWorld(true);

    for (let gx = startX; gx <= endX; gx++) {
        for (let gy = startY; gy <= endY; gy++) {
            const px = gx * CONFIG.particleSize;
            const py = gy * CONFIG.particleSize;
            subRaycaster.set(new THREE.Vector3(px, py, 10), subDirection);
            const hits = subRaycaster.intersectObject(subMesh);
            if (hits.length > 0) {
                for (let zStep = 0; zStep < CONFIG.subtitle.thickness; zStep++) {
                    const gz = -zStep;
                    const pz = gz * CONFIG.particleSize;
                    const key = `${gx},${gy},${gz}`;
                    if (!mdVoxelMap.has(key)) {
                        mdVoxelMap.set(key, { gx, gy, gz, x: px, y: py, z: pz, normal: new THREE.Vector3(0, 0, 1), visited: false });
                    }
                }
            }
        }
    }
    merged.dispose();
    if (gHeart) gHeart.dispose();
    g1.dispose();
    g2.dispose();

    const mdVoxels = Array.from(mdVoxelMap.values());
    const shapeDefinitions = SHAPE_DEFINITIONS;
    const proposedGroups = [];
    for (const startVoxel of mdVoxels) {
        if (startVoxel.visited) continue;
        for (const shape of shapeDefinitions) {
            const shapeVoxels = [];
            let fits = true;
            for (const offset of shape.offsets) {
                const key = `${startVoxel.gx + offset[0]},${startVoxel.gy + offset[1]},${startVoxel.gz}`;
                const v = mdVoxelMap.get(key);
                if (v && !v.visited) shapeVoxels.push(v);
                else { fits = false; break; }
            }
            if (fits) {
                shapeVoxels.forEach(v => v.visited = true);
                const centroid = new THREE.Vector3();
                shapeVoxels.forEach(v => centroid.add(new THREE.Vector3(v.x, v.y, v.z)));
                centroid.divideScalar(shapeVoxels.length);
                proposedGroups.push(centroid);
                break;
            }
        }
    }

    const heartCenter = new THREE.Vector3(heartCenterX, offsetY, -CONFIG.particleSize * 0.5);
    return { targets: proposedGroups, heartCenter };
}

function createHeartMesh(heartCenter) {
    const cellSize = CONFIG.particleSize * 1.2;
    const rows = HEART_PIXEL_MASK.length;
    const cols = HEART_PIXEL_MASK[0].length;
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const positions = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (HEART_PIXEL_MASK[row][col]) {
                const px = (col - cx) * cellSize;
                const py = (rows - 1 - row - cy) * cellSize;
                positions.push(new THREE.Vector3(heartCenter.x + px, heartCenter.y + py, heartCenter.z));
            }
        }
    }
    const count = positions.length;
    if (count === 0) return { mesh: null, heartCubes: [] };
    const boxGeo = new THREE.BoxGeometry(cellSize * 0.95, cellSize * 0.95, cellSize * 0.6);
    const heartMat = new THREE.MeshStandardMaterial({
        color: 0xcc2222,
        metalness: 0.75,
        roughness: 0.25,
        emissive: 0xff2222,
        emissiveIntensity: 0,
        envMapIntensity: 0.4
    });
    const mesh = new THREE.InstancedMesh(boxGeo, heartMat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const heartCubes = [];
    const dummyHeart = new THREE.Object3D();
    const offDist = 18;
    for (let i = 0; i < count; i++) {
        const targetPos = positions[i];
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.8 + Math.PI * 0.1;
        const startPos = targetPos.clone().add(new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * offDist,
            Math.sin(phi) * Math.sin(theta) * offDist,
            Math.cos(phi) * offDist * 0.5
        ));
        heartCubes.push({
            currentPos: startPos.clone(),
            targetPos,
            startPos,
            meshIndex: i
        });
        dummyHeart.position.copy(startPos);
        dummyHeart.scale.setScalar(1);
        dummyHeart.updateMatrix();
        mesh.setMatrixAt(i, dummyHeart.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return { mesh, heartCubes };
}

// Helper to generate a robotic path that reconstructs the position
function generateReturnPath(startPos, startRot, endPos) {
    const steps = [];
    // We want exactly 4 to 6 steps
    const numSteps = Math.floor(Math.random() * 3) + 4;

    let currentPos = startPos.clone();
    let currentRot = startRot.clone();

    const totalDiff = new THREE.Vector3().subVectors(endPos, startPos);

    // Decompose into axis components
    // We need to spend these components over `numSteps` movements.
    // Strategy: Create a list of "moves" (e.g. [dx, dy, dz, 0, 0...]) and shuffle/split them.

    let moves = [
        new THREE.Vector3(totalDiff.x, 0, 0),
        new THREE.Vector3(0, totalDiff.y, 0),
        new THREE.Vector3(0, 0, totalDiff.z)
    ];

    // Fill up to numSteps with dummy moves or splits
    // For visual noise, let's add opposing pairs: +v and -v.
    // This makes the "robot" do unnecessary work but look busy.
    while (moves.length < numSteps) {
        // Pick a random axis
        const axis = Math.floor(Math.random() * 3);
        const dist = (Math.random() * 0.4 + 0.1) * (Math.random() > 0.5 ? 1 : -1);

        let v1 = new THREE.Vector3();
        let v2 = new THREE.Vector3();

        if (axis === 0) { v1.x = dist; v2.x = -dist; }
        else if (axis === 1) { v1.y = dist; v2.y = -dist; }
        else { v1.z = dist; v2.z = -dist; }

        moves.push(v1);
        moves.push(v2);
    }

    // Shuffle moves
    for (let i = moves.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [moves[i], moves[j]] = [moves[j], moves[i]];
    }

    // Limit to numSteps (we might have exceeded if we added pairs)
    // Actually, adding pairs increases by 2.
    // If we have 3, and want 4, we add 2 -> 5. That's fine.

    moves.slice(0, 6).forEach(move => {
        const nextPos = currentPos.clone().add(move);

        // Rotate 90 degrees around random axis
        const rotAxisIdx = Math.floor(Math.random() * 3);
        const rotAxis = new THREE.Vector3(rotAxisIdx === 0 ? 1 : 0, rotAxisIdx === 1 ? 1 : 0, rotAxisIdx === 2 ? 1 : 0);
        const rotSign = Math.random() > 0.5 ? 1 : -1;
        const nextRot = new THREE.Quaternion().setFromAxisAngle(rotAxis, rotSign * Math.PI / 2);
        nextRot.multiply(currentRot);

        steps.push({
            pos: nextPos,
            rot: nextRot
        });

        currentPos = nextPos;
        currentRot = nextRot;
    });

    // Final Step: Snap to Home
    steps.push({
        pos: endPos.clone(),
        rot: new THREE.Quaternion() // Identity
    });

    return steps;
}

/** Per-instance HSL for inner cubes: horizontal rainbow + slight vertical spread (see CONFIG.innerCubeHueGradient). */
function setInnerCubeInstanceHue(color, x, y, minX, maxX, minY, maxY) {
    const g = CONFIG.innerCubeHueGradient;
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const nx = THREE.MathUtils.clamp((x - minX) / w, 0, 1);
    const ny = THREE.MathUtils.clamp((y - minY) / h, 0, 1);
    if (!g?.enabled) {
        const hue = nx - Math.floor(nx);
        color.setHSL(hue, 1.0, 0.5);
        return;
    }
    const xW = g.xWeight ?? 0.78;
    const yW = g.yWeight ?? 0.22;
    let hue = nx * xW + ny * yW;
    hue -= Math.floor(hue);
    color.setHSL(hue, g.saturation ?? 1.0, g.lightness ?? 0.52);
}

function attachInnerCubeGradientShader(innerCubeMat) {
    innerCubeMat.vertexColors = true;
    innerCubeMat.onBeforeCompile = (shader) => {
        const hasInstanceColor =
            shader.vertexShader.includes('vInstanceColor') ||
            shader.fragmentShader.includes('vInstanceColor');
        const colorVarying = hasInstanceColor ? 'vInstanceColor' : 'vColor';
        const perInstanceFactor = `(${colorVarying} * 0.96 + vec3(0.04))`;

        const before = shader.fragmentShader;
        let after = before;

        const emissiveRadianceToken = /vec3\s+emissiveRadiance\s*=\s*emissive\s*;/;
        let emissiveRadiancePatched = false;
        if (emissiveRadianceToken.test(after)) {
            after = after.replace(emissiveRadianceToken, `vec3 emissiveRadiance = emissive * ${perInstanceFactor};`);
            emissiveRadiancePatched = true;
        }

        const totalFromEmissiveRadianceToken = /vec3\s+totalEmissiveRadiance\s*=\s*emissiveRadiance\s*;/;
        if (!emissiveRadiancePatched && totalFromEmissiveRadianceToken.test(after)) {
            after = after.replace(totalFromEmissiveRadianceToken, `vec3 totalEmissiveRadiance = emissiveRadiance * ${perInstanceFactor};`);
        }

        const totalFromEmissiveToken = /vec3\s+totalEmissiveRadiance\s*=\s*emissive\s*;/;
        if (!emissiveRadiancePatched && totalFromEmissiveToken.test(after)) {
            after = after.replace(totalFromEmissiveToken, `vec3 totalEmissiveRadiance = emissive * ${perInstanceFactor};`);
        }

        if (after === before) {
            console.warn('[innerCubes] emissive per-instance shader patch: token not found; expected totalEmissiveRadiance assignment.');
        }

        if (DEBUG_FLAGS?.innerCubesEmissivePatchLog && !innerCubeMat.userData._innerCubesEmissivePatchLogged) {
            innerCubeMat.userData._innerCubesEmissivePatchLogged = true;
            console.log('[innerCubes] emissive patch debug', { colorVarying, shaderPatched: after !== before });
        }
        shader.fragmentShader = after;
    };
}

function onMouseDown(event) {
    // Ignore clicks on UI buttons
    if (event.target.closest('button') || event.target.closest('.mode-btn') || event.target.closest('.letter-btn')) {
        return;
    }

    lastInteractionTime = Date.now();
    resetVajbujActivityTimer();
    if (isFreeCam) return;

    // Left click on portfolio thumbnail -> open detail modal (or Vimeo when in portfolio scene)
    if (event.button === 0 && portfolioState.hoveredIndex >= 0 && portfolioState.items[portfolioState.hoveredIndex]) {
        if (portfolioSceneActive && portfolioScenePhase === 'floating') {
            openPortfolioDetailModal(PORTFOLIO_CONFIG.items[portfolioState.hoveredIndex]);
        } else {
            openPortfolioModal(portfolioState.items[portfolioState.hoveredIndex].vimeoUrl);
        }
        return;
    }

    if (portfolioSceneActive) return;

    // Middle Mouse Button (Button 1) -> Pan
    if (event.button === 1) {
        isPanning = true;
        setCameraMode('manual');
        event.preventDefault(); // Prevent scroll cursor
    }
    // Left Mouse Button (Button 0) -> Rotate
    else if (event.button === 0) {
        isDragging = true;
        setCameraMode('manual');
    }

    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
}

function onMouseUp(event) {
    if (isFreeCam) return;
    isDragging = false;
    isPanning = false;
}

async function generateParticles(font, fontRegular) {
    // 1. Create separate geometries for each letter to handle spacing
    const geometries = [];
    let xOffset = 0;
    const chars = CONFIG.text.split('');

    chars.forEach(char => {
        const charGeo = new TextGeometry(char, {
            font: font,
            size: CONFIG.textSize,
            height: CONFIG.textHeight, // Thickness
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.5,
            bevelSize: 0.2,
            bevelOffset: 0,
            bevelSegments: 5
        });

        charGeo.computeBoundingBox();
        const width = charGeo.boundingBox.max.x - charGeo.boundingBox.min.x;

        charGeo.translate(xOffset, 0, 0);
        geometries.push(charGeo);

        xOffset += width + CONFIG.letterSpacing;
    });

    // 2. Merge all letters into one geometry
    if (geometries.length === 0) return;

    const geometry = BufferGeometryUtils.mergeGeometries(geometries);
    geometry.center();

    geometry.computeBoundingBox();
    const minX = geometry.boundingBox.min.x;
    const maxX = geometry.boundingBox.max.x;
    const minY = geometry.boundingBox.min.y;
    const maxY = geometry.boundingBox.max.y;

    // Sample points
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const sampler = new MeshSurfaceSampler(mesh).build();

    // --- CUBES (Shell) ---
    // Initialize Materials
    // Initialize Materials
    if (!defaultBoxMaterial) {
        defaultBoxMaterial = new THREE.MeshStandardMaterial(MATERIALS.defaultBox);
    }

    if (!glassMaterial) {
        glassMaterial = new THREE.MeshPhysicalMaterial(MATERIALS.glass);
    }

    if (!goldMaterial) {
        goldMaterial = new THREE.MeshStandardMaterial(MATERIALS.gold);
    }

    cubeGroups = [];
    innerCubeParticles = [];

    // --- VOXEL COLLECTION FOR CUBES ---
    const voxelMap = new Map(); // Key: "x,y,z", Value: { gx, gy, gz, x, y, z, visited }

    // --- PIXEL ART FRONT LAYER SCAN ---
    const scanSize = CONFIG.particleSize;

    // Calculate grid bounds
    const minGx = Math.floor(minX / scanSize);
    const maxGx = Math.ceil(maxX / scanSize);
    const minGy = Math.floor(geometry.boundingBox.min.y / scanSize);
    const maxGy = Math.ceil(geometry.boundingBox.max.y / scanSize);

    const scanRaycaster = new THREE.Raycaster();
    const scanDir = new THREE.Vector3(0, 0, -1); // Raycast backward towards text

    // Async chunking variables
    const chunkSize = 1000; // Process N iterations before yielding
    let iterationCount = 0;

    for (let gx = minGx; gx <= maxGx; gx++) {
        for (let gy = minGy; gy <= maxGy; gy++) {
            const scanX = gx * scanSize;
            const scanY = gy * scanSize;

            // Raycast from in front of the text
            scanRaycaster.set(new THREE.Vector3(scanX, scanY, 20), scanDir);
            const intersects = scanRaycaster.intersectObject(mesh);

            if (intersects.length > 0) {
                const frontHit = intersects[0];
                const point = frontHit.point;
                if (point.z > 0) {
                    const gz = Math.round(point.z / scanSize);
                    const key = `${gx},${gy},${gz}`;
                    if (!voxelMap.has(key)) {
                        voxelMap.set(key, {
                            gx, gy, gz,
                            x: gx * scanSize,
                            y: gy * scanSize,
                            z: gz * scanSize,
                            normal: new THREE.Vector3(0, 0, 1), // Front facing
                            visited: false
                        });
                    }
                }
            }
        }

        // Progress update during voxelization (approx 30% of generation phase)
        iterationCount++;
        if (iterationCount % 50 === 0) { // Update every 50 columns
            loadState.generation = Math.round((gx - minGx) / (maxGx - minGx) * 30);
            updateProgress();
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }

    // Saturation loop
    const tempPosition = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();
    let consecutiveFailures = 0;
    const maxFailures = 2000;
    const targetCubeCount = CONFIG.targetCubeCount; // Target for saturation
    const totalSaturationSteps = targetCubeCount * 20;

    for (let i = 0; i < totalSaturationSteps; i++) {
        // Progress update during saturation (30% to 90% of generation phase)
        if (i % chunkSize === 0) {
            const progress = 30 + (i / totalSaturationSteps) * 60;
            loadState.generation = Math.min(90, Math.round(progress));
            updateProgress();
            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        sampler.sample(tempPosition, tempNormal);

        const tryAddVoxel = (pX, pY, pZ, pNormal) => {
            const gx = Math.round(pX / CONFIG.particleSize);
            const gy = Math.round(pY / CONFIG.particleSize);
            const gz = Math.round(pZ / CONFIG.particleSize);
            const key = `${gx},${gy},${gz}`;
            if (!voxelMap.has(key)) {
                voxelMap.set(key, {
                    gx, gy, gz,
                    x: gx * CONFIG.particleSize,
                    y: gy * CONFIG.particleSize,
                    z: gz * CONFIG.particleSize,
                    normal: pNormal ? pNormal.clone() : new THREE.Vector3(0, 1, 0),
                    visited: false
                });
                return true;
            }
            return false;
        };

        let added = tryAddVoxel(tempPosition.x, tempPosition.y, tempPosition.z, tempNormal);

        if (Math.abs(tempNormal.z) < 0.5) {
            const gx = Math.round(tempPosition.x / CONFIG.particleSize);
            const gy = Math.round(tempPosition.y / CONFIG.particleSize);
            const noise = Math.sin(gx * 0.45) * Math.cos(gy * 0.45);

            if (noise > 0.1) {
                const extPos = tempPosition.clone().addScaledVector(tempNormal, CONFIG.particleSize);
                if (tryAddVoxel(extPos.x, extPos.y, extPos.z, tempNormal)) {
                    added = true;
                }
            }
        }

        if (added) {
            consecutiveFailures = 0;
            if (voxelMap.size >= targetCubeCount) break;
        } else {
            consecutiveFailures++;
        }
        if (consecutiveFailures > maxFailures) break;
    }

    // --- SUBTITLE: PRODUCTIONS (Deterministic Generation) ---
    if (fontRegular && CONFIG.subtitle) {
        // Generate separate geometries for each letter to handle spacing
        const subGeometries = [];
        let subXOffset = 0;
        const subChars = CONFIG.subtitle.text.split('');

        subChars.forEach(char => {
            const charGeo = new TextGeometry(char, {
                font: fontRegular,
                size: CONFIG.subtitle.size,
                height: CONFIG.subtitle.height,
                curveSegments: 6,
                bevelEnabled: false
            });

            charGeo.computeBoundingBox();
            const width = charGeo.boundingBox.max.x - charGeo.boundingBox.min.x;

            charGeo.translate(subXOffset, 0, 0);
            subGeometries.push(charGeo);

            subXOffset += width + CONFIG.subtitle.letterSpacing;
        });

        if (subGeometries.length === 0) return;

        const subGeo = BufferGeometryUtils.mergeGeometries(subGeometries);


        subGeo.computeBoundingBox();
        const subWidth = subGeo.boundingBox.max.x - subGeo.boundingBox.min.x;
        const subHeight = subGeo.boundingBox.max.y - subGeo.boundingBox.min.y;

        // Center alignment calculation
        // Main text center X is roughly 0 because geometry.center() was called on it.
        // So we just center the subtitle at 0.
        const subOffsetX = -subWidth / 2;
        const subOffsetY = CONFIG.subtitle.offsetY;

        subGeo.translate(subOffsetX, subOffsetY, 0);

        // Deterministic Grid Scan for Subtitle
        // We scan the bounding box of the subtitle
        const startX = Math.floor(subGeo.boundingBox.min.x / CONFIG.particleSize);
        const endX = Math.ceil(subGeo.boundingBox.max.x / CONFIG.particleSize);
        const startY = Math.floor(subGeo.boundingBox.min.y / CONFIG.particleSize);
        const endY = Math.ceil(subGeo.boundingBox.max.y / CONFIG.particleSize);

        const subRaycaster = new THREE.Raycaster();
        const subDirection = new THREE.Vector3(0, 0, -1);
        const subtitleMesh = new THREE.Mesh(subGeo, new THREE.MeshBasicMaterial());
        subtitleMesh.updateMatrixWorld(); // Ensure world matrix is up to date

        for (let gx = startX; gx <= endX; gx++) {
            for (let gy = startY; gy <= endY; gy++) {
                const px = gx * CONFIG.particleSize;
                const py = gy * CONFIG.particleSize;

                // Raycast to check if point is inside text
                // Start ray from z=10 looking back at text which is at z=0 (approximately)
                // Actually the text geometry is extruded, but we only care about the shape in X/Y.
                // Text is extruded by height.

                subRaycaster.set(new THREE.Vector3(px, py, 10), subDirection);
                const intersects = subRaycaster.intersectObject(subtitleMesh);

                if (intersects.length > 0) {
                    // It's a hit. Add voxels.
                    // Requirement: "grubości 2 sześcianów" (thickness 2 cubes).
                    // We add one at z=0 and one at z = -particleSize (or +particleSize).
                    // Let's do 0 and -particleSize to align with front face.

                    for (let zStep = 0; zStep < CONFIG.subtitle.thickness; zStep++) {
                        const gz = -zStep; // 0, -1
                        const pz = gz * CONFIG.particleSize;

                        const key = `${gx},${gy},${gz}`;
                        if (!voxelMap.has(key)) {
                            voxelMap.set(key, {
                                gx, gy, gz,
                                x: px,
                                y: py,
                                z: pz,
                                normal: new THREE.Vector3(0, 0, 1),
                                visited: false,
                                isSubtitle: true // Tag it if we want special logic later
                            });
                        }
                    }
                }
            }
        }

        // Clean up
        subGeo.dispose();
    }

    // --- GROUPING ALGORITHM ---
    // --- GROUPING ALGORITHM ---
    const shapeDefinitions = SHAPE_DEFINITIONS;

    const voxels = Array.from(voxelMap.values());
    // Shuffle voxels
    for (let i = voxels.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [voxels[i], voxels[j]] = [voxels[j], voxels[i]];
    }

    const proposedGroups = []; // { shapeId: '2x2', centroid: Vector3, isTop: boolean }
    const groupCounts = {}; // { '2x2': { top: 0, kek: 0 } }

    // Init counts
    shapeDefinitions.forEach(s => groupCounts[s.id] = { top: 0, kek: 0 });

    for (const startVoxel of voxels) {
        if (startVoxel.visited) continue;

        for (const shape of shapeDefinitions) {
            const shapeVoxels = [];
            let fits = true;

            for (const offset of shape.offsets) {
                const key = `${startVoxel.gx + offset[0]},${startVoxel.gy + offset[1]},${startVoxel.gz}`;
                const v = voxelMap.get(key);
                if (v && !v.visited) {
                    shapeVoxels.push(v);
                } else {
                    fits = false;
                    break;
                }
            }

            if (fits) {
                // Mark visited
                shapeVoxels.forEach(v => v.visited = true);

                // Determine Center
                const centroid = new THREE.Vector3();
                const normalSum = new THREE.Vector3();
                shapeVoxels.forEach(v => {
                    centroid.add(new THREE.Vector3(v.x, v.y, v.z));
                    if (v.normal) normalSum.add(v.normal);
                });
                centroid.divideScalar(shapeVoxels.length);
                normalSum.normalize();

                const isTop = startVoxel.x < 0; // Use start voxel to determine side

                proposedGroups.push({
                    shapeId: shape.id,
                    centroid: centroid,
                    originalPos: centroid.clone(),
                    normal: normalSum,
                    isTop: isTop
                });

                if (isTop) groupCounts[shape.id].top++;
                else groupCounts[shape.id].kek++;

                break; // Shape found, move to next voxel
            }
        }
    }

    // --- MESH INITIALIZATION ---
    initMeshes(groupCounts);

    loadState.generation = 95;
    updateProgress();
    await new Promise(resolve => requestAnimationFrame(resolve));

    // --- POPULATE MESHES ---
    proposedGroups.forEach(groupProps => {
        const { shapeId, centroid, isTop, normal } = groupProps;
        const entry = meshRegistry[shapeId];
        const mesh = isTop ? entry.top : entry.kek;
        const index = isTop ? entry.topIndex++ : entry.kekIndex++;

        // Determine Scale based on Normal
        // We want a random scale > 1.0 to ensure overlap
        const scaleMag = 1.0 + Math.random() * 0.8; // zmiana randomu scianek
        const scaleVec = new THREE.Vector3(1, 1, 1);

        const absX = Math.abs(normal.x);
        const absY = Math.abs(normal.y);
        const absZ = Math.abs(normal.z);

        if (absZ > absX && absZ > absY) {
            // Front/Back -> Scale Z
            scaleVec.z = scaleMag;
        } else if (absY > absX && absY > absZ) {
            // Top/Bottom -> Scale Y
            scaleVec.y = scaleMag;
        } else {
            // Side -> Scale X
            scaleVec.x = scaleMag;
        }

        // Set initial matrix
        dummy.position.copy(centroid);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.copy(scaleVec);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);

        // Create Group Logic Object
        const groupLogic = {
            originalPos: centroid.clone(),
            currentPos: centroid.clone(),
            baseScale: scaleVec,

            // Rendering Links
            shapeId: shapeId,
            isTop: isTop,
            meshIndex: index,

            // Physics State
            velocity: new THREE.Vector3(0, 0, 0),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Quaternion(),
            isFlying: false,
            returnStartTime: 0,
            freezeTime: 0,
            // Props
            returnSpeed: CONFIG.returnSpeed * (0.5 + Math.random()),
            wobbleFreq: Math.random() * 0.1,
            wobbleAmp: Math.random() * 0.05,

            // Grid Mode State
            gridState: 'IDLE',
            returnQueue: [],
            currentStepIndex: 0,
            stepStartTime: 0,
            glitchTarget: new THREE.Vector3(),

            // Glitch volumetryczne (nakładka wizualna)
            glitchDisplayOffset: new THREE.Vector3(0, 0, 0),
            glitchEndTime: 0,
        };

        cubeGroups.push(groupLogic);
    });

    // --- INNER CUBES (Core) ---
    const innerCubeCount = 2000;
    const innerCubeGeo = new THREE.BoxGeometry(CONFIG.particleSize * 1, CONFIG.particleSize * 1, CONFIG.particleSize * 1);
    const innerCubeMat = new THREE.MeshStandardMaterial(MATERIALS.innerCubes);
    attachInnerCubeGradientShader(innerCubeMat);

    innerCubeInstancedMesh = new THREE.InstancedMesh(innerCubeGeo, innerCubeMat, innerCubeCount);
    const color = new THREE.Color();
    let sIdx = 0;

    for (let i = 0; i < innerCubeCount; i++) {
        sampler.sample(tempPosition, tempNormal);
        const innerOffset = 0.3;
        tempPosition.addScaledVector(tempNormal, -innerOffset);
        tempPosition.z = (Math.random() - 0.5) * 1.2;

        dummy.position.copy(tempPosition);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        innerCubeInstancedMesh.setMatrixAt(sIdx, dummy.matrix);

        setInnerCubeInstanceHue(color, tempPosition.x, tempPosition.y, minX, maxX, minY, maxY);
        innerCubeInstancedMesh.setColorAt(sIdx, color);

        innerCubeParticles.push({
            meshIndex: sIdx,
            originalPos: tempPosition.clone(),
            currentPos: tempPosition.clone(),
            velocity: new THREE.Vector3(0, 0, 0),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Quaternion(),
            isFlying: false,
            returnStartTime: 0,
            returnSpeed: CONFIG.returnSpeed,
            gridState: 'IDLE',
            returnQueue: [],
            currentStepIndex: 0,
            stepStartTime: 0,
            glitchTarget: new THREE.Vector3(),
            glitchDisplayOffset: new THREE.Vector3(0, 0, 0),
            glitchEndTime: 0,
            glitchRotation: null,
            glitchScale: null,
        });
        sIdx++;
    }
    innerCubeInstancedMesh.count = sIdx;
    innerCubeInstancedMesh.instanceMatrix.needsUpdate = true;
    if (innerCubeInstancedMesh.instanceColor) innerCubeInstancedMesh.instanceColor.needsUpdate = true;
    scene.add(innerCubeInstancedMesh);

    // Final progress update
    loadState.generation = 100;
    updateProgress();
    applyVideoIblMaterialBoost();
}

function exitPortfolioScene() {
    portfolioSceneActive = false;
    portfolioScenePhase = 'idle';

    if (portfolioCameraStart) {
        cameraFocusPoint.copy(portfolioCameraStart.focus);
        cameraRadius = portfolioCameraStart.radius;
        cameraAngle = portfolioCameraStart.angle;
        cameraVerticalAngle = portfolioCameraStart.verticalAngle;
        targetCameraAngle = cameraAngle;
        targetCameraVerticalAngle = cameraVerticalAngle;
        targetCameraRadius = cameraRadius;
    }

    if (portfolioState.group && portfolioState.group.parent) {
        portfolioState.group.parent.remove(portfolioState.group);
    }
    if (motionDesignState && motionDesignState.heartMesh && motionDesignState.heartMesh.parent) {
        motionDesignState.heartMesh.parent.remove(motionDesignState.heartMesh);
    }

    portfolioWindowsFlyInInitDone = false;

    portfolioState.items.forEach(item => {
        if (item.video && !item.video.paused) item.video.pause();
    });
}

function initPortfolio(skipAddToScene = false) {
    if (!PORTFOLIO_CONFIG || !PORTFOLIO_CONFIG.items || PORTFOLIO_CONFIG.items.length === 0) return;
    const cfg = PORTFOLIO_CONFIG;
    const items = cfg.items;
    const slotW = cfg.slotWidth;
    const slotH = cfg.slotHeight;
    const overlapSpacing = 3.2;
    const overlapRowSpacing = 2.4;
    const cols = 3;

    const group = new THREE.Group();
    portfolioState.group = group;
    portfolioState.frameMesh = null;
    portfolioState.frameCubes = [];
    portfolioState.planeMeshes = [];
    portfolioState.planeTargetPositions = [];
    portfolioState.windowData = [];
    portfolioState.items = [];

    const sides = [
        () => new THREE.Vector3(-14, 0, 0),
        () => new THREE.Vector3(14, 0, 0),
        () => new THREE.Vector3(0, -10, 0),
        () => new THREE.Vector3(0, 8, 0)
    ];

    for (let i = 0; i < items.length; i++) {
        const rowIndex = Math.floor(i / cols);
        const colIndex = i % cols;
        const scale = 0.7 + Math.random() * 0.6;
        const jitterX = (Math.random() - 0.5) * 0.4;
        const jitterY = (Math.random() - 0.5) * 0.3;
        const centerX = (colIndex - (cols - 1) / 2) * overlapSpacing + jitterX;
        const centerY = cfg.offsetYTop - rowIndex * overlapRowSpacing + jitterY;
        const targetPos = new THREE.Vector3(centerX, centerY, cfg.planeZOffset);
        const sideOffset = sides[i % 4]();
        const flyInStartPos = targetPos.clone().add(sideOffset);

        const item = items[i];
        const video = document.createElement('video');
        video.src = item.thumbnailVideo || '';
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.crossOrigin = 'anonymous';
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        const planeW = slotW * 0.92 * scale;
        const planeH = slotH * 0.92 * scale;
        const planeGeo = new THREE.PlaneGeometry(planeW, planeH);
        const planeMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const planeMesh = new THREE.Mesh(planeGeo, planeMat);
        planeMesh.position.copy(flyInStartPos);
        planeMesh.userData.portfolioIndex = i;
        group.add(planeMesh);
        portfolioState.planeMeshes.push(planeMesh);
        portfolioState.planeTargetPositions.push(targetPos);
        portfolioState.windowData.push({ targetPos, flyInStartPos, scale });
        portfolioState.items.push({ vimeoUrl: item.vimeoUrl, video, texture, mesh: planeMesh });
    }

    if (!skipAddToScene) scene.add(group);
}

function onMouseMove(event) {
    if (isDragging || isPanning) lastInteractionTime = Date.now();

    // Normalize mouse coordinates (Always update)
    if (renderer) { // Safety check if called early
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // Handle Camera Rotation & Panning (disabled when portfolio scene is active)
    if (!isFreeCam && !portfolioSceneActive) {
        if (isDragging || isPanning) {
            const deltaX = event.clientX - previousMouseX;
            const deltaY = event.clientY - previousMouseY;

            previousMouseX = event.clientX;
            previousMouseY = event.clientY;

            if (isDragging) {
                // Rotation
                targetCameraAngle -= deltaX * 0.005;
                targetCameraVerticalAngle -= deltaY * 0.005;

                // Clamp angles
                targetCameraAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, targetCameraAngle));
                targetCameraVerticalAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, targetCameraVerticalAngle));
            }

            if (isPanning) {
                // Panning relative to camera view
                // Get Camera Local Axes
                const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0); // Local X
                const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);    // Local Y

                // Scaling factor can depend on radius for consistent feel
                const panFactor = CONFIG.panSpeed * (cameraRadius / CONFIG.initialZoom);

                // Move focus point: Mouse moves Left -> Focus moves Left (Right Vector is negative) (Drag world)
                // Actually, if I drag Left (negative deltaX), I want the world to move Left (negative X).
                // If I drag Up (negative deltaY), I want world to move Up.

                cameraFocusPoint.addScaledVector(camRight, -deltaX * panFactor);
                cameraFocusPoint.addScaledVector(camUp, deltaY * panFactor);
            }
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();
    renderer.setPixelRatio(getEffectivePixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    if (crtPass) crtPass.uniforms['resolution'].value.set(window.innerWidth, window.innerHeight);
}



function animate() {
    requestAnimationFrame(animate);

    if (!camera || !scene || !renderer) return;
    updatePerformanceHud(performance.now());

    updateVideoBasedLighting(performance.now());
    updateBackgroundBeatIndicator(performance.now() * 0.001);

    if (isFreeCam && controls) {
        controls.update();

        // Auto-switch back to dynamic if idle - DISABLED
        /*
        if (Date.now() - lastInteractionTime > cinematicConfig.autoDynamicTimeout) {
            setCameraMode('dynamic');
        }
        */
    } else {
        if (portfolioSceneActive) {
            const psc = PORTFOLIO_SCENE_CONFIG;
            const now = Date.now();
            const elapsed = (now - portfolioScenePhaseStartTime) / 1000;

            if (portfolioScenePhase === 'camera_move') {
                if (portfolioCameraStart === null) {
                    portfolioCameraStart = {
                        focus: cameraFocusPoint.clone(),
                        radius: cameraRadius,
                        angle: cameraAngle,
                        verticalAngle: cameraVerticalAngle
                    };
                }
                const dur = psc.cameraMoveDuration;
                const progress = Math.min(1, elapsed / dur);
                const e = easeInOutCubic(progress);
                cameraFocusPoint.x = portfolioCameraStart.focus.x + (psc.cameraFocusTarget.x - portfolioCameraStart.focus.x) * e;
                cameraFocusPoint.y = portfolioCameraStart.focus.y + (psc.cameraFocusTarget.y - portfolioCameraStart.focus.y) * e;
                cameraFocusPoint.z = portfolioCameraStart.focus.z + (psc.cameraFocusTarget.z - portfolioCameraStart.focus.z) * e;
                cameraRadius = portfolioCameraStart.radius + (psc.cameraRadiusTarget - portfolioCameraStart.radius) * e;
                cameraAngle = portfolioCameraStart.angle;
                cameraVerticalAngle = portfolioCameraStart.verticalAngle;
                targetCameraAngle = cameraAngle;
                targetCameraVerticalAngle = cameraVerticalAngle;
                targetCameraRadius = cameraRadius;
                if (progress >= 1) {
                    portfolioScenePhase = 'subtitle_transform';
                    portfolioScenePhaseStartTime = Date.now();
                }
            } else {
                cameraFocusPoint.set(psc.cameraFocusTarget.x, psc.cameraFocusTarget.y, psc.cameraFocusTarget.z);
                cameraRadius = psc.cameraRadiusTarget;
                if (portfolioCameraStart) {
                    cameraAngle = portfolioCameraStart.angle;
                    cameraVerticalAngle = portfolioCameraStart.verticalAngle;
                }
            }

            if (portfolioScenePhase === 'subtitle_transform' && motionDesignState && !motionDesignState.recyclingDone) {
                const elapsed = (now - portfolioScenePhaseStartTime) / 1000;
                if (elapsed >= psc.subtitleTransformDuration) {
                    motionDesignState.recyclingDone = true;
                    portfolioScenePhase = 'flash';
                    portfolioScenePhaseStartTime = Date.now();
                }
            } else if (portfolioScenePhase === 'flash') {
                if ((Date.now() - portfolioScenePhaseStartTime) / 1000 >= psc.flashDuration) {
                    portfolioScenePhase = 'windows_fly_in';
                    portfolioScenePhaseStartTime = Date.now();
                }
            } else if (portfolioScenePhase === 'windows_fly_in' && !portfolioWindowsFlyInInitDone && portfolioState.group) {
                scene.add(portfolioState.group);
                if (portfolioState.windowData && portfolioState.planeMeshes.length) {
                    portfolioState.planeMeshes.forEach((mesh, idx) => {
                        const wd = portfolioState.windowData[idx];
                        if (wd) mesh.position.copy(wd.flyInStartPos);
                    });
                }
                portfolioWindowsFlyInInitDone = true;
            }

            if (backgroundVideoMesh && psc.bgVideoOffsetY != null) {
                const bgProgress = Math.min(1, (Date.now() - portfolioSceneStartTime) / 1000 / (psc.bgVideoMoveDuration || 2.8));
                backgroundVideoMesh.position.y = psc.bgVideoOffsetY * easeInOutCubic(bgProgress);
            }

            const horizontalRadius = cameraRadius * Math.cos(cameraVerticalAngle);
            camera.position.x = cameraFocusPoint.x + Math.sin(cameraAngle) * horizontalRadius;
            camera.position.z = cameraFocusPoint.z + Math.cos(cameraAngle) * horizontalRadius;
            camera.position.y = cameraFocusPoint.y + Math.sin(cameraVerticalAngle) * cameraRadius;
            camera.lookAt(cameraFocusPoint);
        } else {
        if (introCameraFlyInActive) {
            const nowIntro = performance.now();
            const ic = INTRO_CAMERA_CONFIG;
            const tIntro = Math.min(1, (nowIntro - introFlyInStartTime) / ic.durationMs);
            const eIntro = easeOutCubic(tIntro);
            cameraRadius = introFlyInStartRadius + (CONFIG.initialZoom - introFlyInStartRadius) * eIntro;
            targetCameraRadius = CONFIG.initialZoom;
            if (tIntro >= 1) {
                introCameraFlyInActive = false;
                cameraRadius = CONFIG.initialZoom;
                revealPostIntroUi();
            }
        }

        // Cinematic Mode Logic
        if (isCinematic) {
            if (isInitialSequence) {
                // Stay static
            } else {
                const now = Date.now();
                if (now > cinematicSwitchTime) {
                    // Procedurally Generate Shot
                    const cfg = cinematicConfig;

                    // Helper for random in range
                    const rand = (min, max) => min + Math.random() * (max - min);

                    // Generate Targets
                    // Generate Targets
                    // Constrain radius to [minZoom, maxZoom - 10]
                    const minR = Math.max(cfg.radiusRange.min, CONFIG.minZoom);
                    const maxR = Math.min(cfg.radiusRange.max, CONFIG.maxZoom - 10);

                    targetCameraAngle = rand(cfg.angleRange.min, cfg.angleRange.max);
                    targetCameraVerticalAngle = rand(cfg.vertRange.min, cfg.vertRange.max);
                    targetCameraRadius = rand(minR, maxR);

                    // Camera modifiers
                    currentShotSpeedMult = rand(cfg.speedMultRange.min, cfg.speedMultRange.max);
                    const newFov = rand(cfg.fovRange.min, cfg.fovRange.max);

                    // Instant cut for cinematic feel
                    cameraAngle = targetCameraAngle;
                    cameraVerticalAngle = targetCameraVerticalAngle;
                    cameraRadius = targetCameraRadius;

                    // Apply FOV
                    camera.fov = newFov;
                    camera.updateProjectionMatrix();

                    // Set next duration
                    const duration = rand(cfg.shotDurationRange.min, cfg.shotDurationRange.max);
                    cinematicSwitchTime = now + duration;

                    // Random Dolly Speed (Move in or out)
                    // Speed: +/- 0.01 to 0.03 per frame roughly
                    cinematicDollySpeed = (Math.random() - 0.5) * 0.04;
                }

                // Slow cinematic drift (modified by speedMult)
                cameraAngle += 0.0002 * currentShotSpeedMult * Math.sin(now * 0.001);
                cameraVerticalAngle += 0.0001 * currentShotSpeedMult * Math.cos(now * 0.001);

                // Dolly movement
                cameraRadius += cinematicDollySpeed;

                // Sync targets to current drift so no jump on exit
                targetCameraAngle = cameraAngle;
                targetCameraVerticalAngle = cameraVerticalAngle;
                targetCameraRadius = cameraRadius;
            } // End else !isInitialSequence

        } else {
            // Smooth Camera Rotation (User Control)
            if (!introCameraFlyInActive) {
                cameraAngle += (targetCameraAngle - cameraAngle) * 0.1;
                cameraVerticalAngle += (targetCameraVerticalAngle - cameraVerticalAngle) * 0.1;
                cameraRadius += (targetCameraRadius - cameraRadius) * 0.1;
            }

            // Auto-switch back to dynamic if idle - DISABLED
            /*
            if (Date.now() - lastInteractionTime > cinematicConfig.autoDynamicTimeout) {
                setCameraMode('dynamic');
            }
            */
        }

        const horizontalRadius = cameraRadius * Math.cos(cameraVerticalAngle);

        camera.position.x = cameraFocusPoint.x + Math.sin(cameraAngle) * horizontalRadius;
        camera.position.z = cameraFocusPoint.z + Math.cos(cameraAngle) * horizontalRadius;
        camera.position.y = cameraFocusPoint.y + Math.sin(cameraVerticalAngle) * cameraRadius;

        camera.lookAt(cameraFocusPoint);
        }
    }

    updateCameraHud();

    if (Object.keys(meshRegistry).length > 0) {
        raycaster.setFromCamera(mouse, camera);

        const intersection = raycaster.ray.intersectPlane(_mousePickPlane, _rayPlaneHit);

        if (intersection) {
            debugMesh.position.copy(_rayPlaneHit); // Update debug sphere

            // Calculate Mouse Velocity (not when portfolio / MYSEN active - no sim interaction)
            if (!portfolioSceneActive && !mysenState.active) {
                const now = Date.now();
                const dt = (now - lastMouseTime) / 1000;
                if (dt > 0 && dt < 0.1) {
                    mouseVelocity.subVectors(_rayPlaneHit, lastTarget).divideScalar(dt);
                }
                lastMouseTime = now;
                lastTarget.copy(_rayPlaneHit);
            }
        } else {
            _rayPlaneHit.set(1000, 1000, 1000);
            mouseVelocity.set(0, 0, 0);
        }

        const simTarget = (portfolioSceneActive || mysenState.active)
            ? _simFarSim.set(1000, 1000, 1000)
            : _rayPlaneHit;

        const time = Date.now() * 0.001;
        const delta = clock.getDelta();
        updateFxRuntime(time, delta);

        if (portfolioSceneActive && portfolioScenePhase === 'subtitle_transform' && motionDesignState && motionDesignState.heartMesh && motionDesignState.heartCubes.length > 0) {
            const psc = PORTFOLIO_SCENE_CONFIG;
            const heartElapsed = (Date.now() - portfolioScenePhaseStartTime) / 1000;
            const heartProgress = Math.min(1, heartElapsed / (psc.heartFlyDuration || 1.2));
            const heartE = easeInOutCubic(heartProgress);
            motionDesignState.heartCubes.forEach((hc) => {
                hc.currentPos.lerpVectors(hc.startPos, hc.targetPos, heartE);
                dummy.position.copy(hc.currentPos);
                dummy.scale.setScalar(1);
                dummy.updateMatrix();
                motionDesignState.heartMesh.setMatrixAt(hc.meshIndex, dummy.matrix);
            });
            motionDesignState.heartMesh.instanceMatrix.needsUpdate = true;
            if (motionDesignState.heartMesh.material.emissiveIntensity !== undefined) {
                motionDesignState.heartMesh.material.emissiveIntensity = 1.2 * (1 - heartE);
            }
        }

        if (portfolioSceneActive && portfolioScenePhase === 'subtitle_transform' && motionDesignState === null && loadedFontRegular) {
            const data = computeMotionDesignTargets(loadedFontRegular);
            if (data) {
                const productionsGroups = cubeGroups.filter(g => !g.isTop);
                const byX = (a, b) => (a.originalPos?.x ?? a.x) - (b.originalPos?.x ?? b.x);
                const sortedGroups = productionsGroups.slice().sort((a, b) => byX(a, b));
                const sortedTargets = data.targets.slice().sort((a, b) => a.x - b.x);
                const K = Math.min(sortedGroups.length, sortedTargets.length);
                for (let i = 0; i < K; i++) {
                    sortedGroups[i].portfolioStartPos = sortedGroups[i].currentPos.clone();
                    sortedGroups[i].portfolioTargetPos = sortedTargets[i].clone();
                }
                const heartData = createHeartMesh(data.heartCenter);
                motionDesignState = {
                    targets: data.targets,
                    heartCenter: data.heartCenter,
                    recyclingDone: false,
                    spawnDone: false,
                    heartDone: false,
                    extraGroups: [],
                    heartCubes: heartData.heartCubes,
                    heartMesh: heartData.mesh
                };
                if (heartData.mesh) scene.add(heartData.mesh);
                applyVideoIblMaterialBoost();
            }
        }

        // --- CUBE GROUPS LOGIC ---

        // Glitch volumetryczne: auto-trigger gdy włączone
        if (cubeGroups.length > 0 && GLITCH_VOLUME_CONFIG.enabled) {
            if (glitchVolumeNextTrigger === 0) {
                const cfg = GLITCH_VOLUME_CONFIG;
                glitchVolumeNextTrigger = time + (cfg.intervalMin + Math.random() * (cfg.intervalMax - cfg.intervalMin)) / 1000;
            }
            if (time >= glitchVolumeNextTrigger) {
                triggerVolumetricGlitch(time);
                const cfg = GLITCH_VOLUME_CONFIG;
                glitchVolumeNextTrigger = time + (cfg.intervalMin + Math.random() * (cfg.intervalMax - cfg.intervalMin)) / 1000;
            }
        }

        // Pre-calculate Vajbuj Bounce State
        let vajbujBounceActive = false;
        let vajbujBounceAmplitude = 0;
        if (vajbujState.active) {
            const vElapsed = (Date.now() - vajbujState.startTime) / 1000;
            const vDuration = VAJBUJ_CONFIG.audioEndTime - VAJBUJ_CONFIG.audioStartTime;
            const vProgress = vElapsed / vDuration;

            if (vProgress > 0.52) {
                vajbujBounceActive = true;

                // Custom Waveform: "1 very fast change, 2 3 4 very slow bounce"
                // Split cycle: 25% fast transition, 75% slow return
                const freq = 3.75; // Radian/s approx
                // Normalized Phase 0..1
                const phase = (vElapsed * freq / (Math.PI * 2)) % 1;

                let wave;
                // Beat 1: Fast Rise (-1 to 1)
                if (phase < 0.25) {
                    // Map 0..0.25 -> -PI/2 .. PI/2
                    wave = Math.sin((phase / 0.25) * Math.PI - Math.PI / 2);
                } else {
                    // Beats 2,3,4: Slow Fall (1 to -1)
                    // Map 0.25..1.0 -> PI/2 .. 3PI/2
                    const p2 = (phase - 0.25) / 0.75;
                    wave = Math.sin(p2 * Math.PI + Math.PI / 2);
                }

                vajbujBounceAmplitude = wave * 0.8;
            }
        }

        for (let i = 0; i < cubeGroups.length; i++) {
            const group = cubeGroups[i];

            if (portfolioSceneActive && portfolioScenePhase === 'subtitle_transform' && group.portfolioTargetPos && motionDesignState) {
                const psc = PORTFOLIO_SCENE_CONFIG;
                const elapsed = (Date.now() - portfolioScenePhaseStartTime) / 1000;
                const progress = Math.min(1, elapsed / psc.subtitleTransformDuration);
                const e = easeInOutCubic(progress);
                const start = group.portfolioStartPos || group.originalPos;
                group.currentPos.lerpVectors(start, group.portfolioTargetPos, e);
                if (progress >= 1) {
                    group.originalPos.copy(group.portfolioTargetPos);
                }
                let finalQuat = group.rotation;
                dummy.position.copy(group.currentPos);
                dummy.rotation.setFromQuaternion(finalQuat);
                dummy.scale.copy(group.baseScale);
                dummy.updateMatrix();
                const entry = meshRegistry[group.shapeId];
                if (entry) {
                    const targetMesh = group.isTop ? entry.top : entry.kek;
                    if (targetMesh) {
                        targetMesh.setMatrixAt(group.meshIndex, dummy.matrix);
                    }
                }
                continue;
            }

            const dist = group.currentPos.distanceTo(simTarget);

            if (CONFIG.animationMode === 'repulsion') {
                // --- MODE 1: REPULSION (Original) ---
                // --- DYNAMIC HOME POSITION FOR VAJBUJ MODE ---
                _simTargetHome.copy(group.originalPos);
                if (vajbujBounceActive) {
                    // Quantized Alternating: Odd blocks UP, Even blocks DOWN
                    // Period approx 3.5 units (covering letter + spacing)
                    // T(-3) -> Odd, O(-2) -> Even, P(-1) -> Odd, K(0) -> Even...
                    const bucket = Math.floor(group.originalPos.x / 3.5);
                    const isOdd = Math.abs(bucket) % 2 === 1;
                    const alternate = isOdd ? 1 : -1;

                    _simTargetHome.y += vajbujBounceAmplitude * alternate;
                }

                if (dist < CONFIG.repulsionRadius) {
                    _simForce.subVectors(group.currentPos, simTarget);
                    const len = _simForce.length();
                    if (len > 0) {
                        _simForce.normalize();
                        const strength = (1 - dist / CONFIG.repulsionRadius) * CONFIG.repulsionStrength;
                        // Removed random noise to prevent jelly effect
                        group.velocity.addScaledVector(_simForce, strength * 0.05);
                    }
                }

                _simReturnVec.subVectors(_simTargetHome, group.currentPos);

                // Overdamped Spring (EaseOut)
                // Stronger pull, much stronger drag
                group.velocity.addScaledVector(_simReturnVec, 0.05);
                group.velocity.multiplyScalar(0.85); // High friction -> No overshoot

                group.currentPos.add(group.velocity);

                // Reset rotation
                group.rotation.slerp(_quatIdentity, 0.1);

            } else if (CONFIG.animationMode === 'grid') {
                // --- MODE 3: GRID & CHOREOGRAPHED RETURN ---

                // 1. Interaction: Jump to Grid (Local Glitch)
                // Dynamic Radius and Strength based on Mouse Velocity
                const speed = mouseVelocity.length();
                // Reduced 10x as requested
                const dynamicRadius = 0.5 + Math.min(speed * 0.05, 1.0);
                const displacementScale = 0.03 + Math.min(speed * 0.08, 2.5);

                if (dist < dynamicRadius && speed > 2) {
                    group.gridState = 'DISPLACED';

                    // LOCAL GLITCH TARGET
                    // Don't set currentPos instantly. Set target.
                    _simOffset.set(
                        (Math.random() - 0.5) * displacementScale,
                        (Math.random() - 0.5) * displacementScale,
                        (Math.random() - 0.5) * displacementScale
                    );

                    group.glitchTarget.addVectors(group.originalPos, _simOffset);

                    // Start rotation towards random orthogonal
                    const rotAxisIdx = Math.floor(Math.random() * 3);
                    _simRotAxisGrid.set(rotAxisIdx === 0 ? 1 : 0, rotAxisIdx === 1 ? 1 : 0, rotAxisIdx === 2 ? 1 : 0);
                    group.rotation.setFromAxisAngle(_simRotAxisGrid, (Math.random() > 0.5 ? 1 : -1) * Math.PI / 2);

                    group.stepStartTime = time + 1.0; // Fly out for 1 second? Or wait?
                }

                if (group.gridState === 'DISPLACED') {
                    // Fly towards glitch target smoothly
                    const lerpSpeed = 2.0 * delta; // Adjust speeed here
                    group.currentPos.lerp(group.glitchTarget, lerpSpeed);

                    // We wait until time passes
                    if (time > group.stepStartTime) {
                        group.gridState = 'RETURNING';
                        // Generate Path NOW
                        group.returnQueue = generateReturnPath(group.currentPos, group.rotation, group.originalPos);
                        group.currentStepIndex = 0;
                    }
                } else if (group.gridState === 'RETURNING') {
                    if (group.currentStepIndex < group.returnQueue.length) {
                        const targetStep = group.returnQueue[group.currentStepIndex];
                        const stepDuration = 0.2; // Fast snaps

                        // Lerp to Step Target
                        const lerpSpeed = 10.0 * delta;
                        group.currentPos.lerp(targetStep.pos, lerpSpeed);
                        group.rotation.slerp(targetStep.rot, lerpSpeed);

                        // Check completion (time based for rhythm)
                        if (time > group.stepStartTime + stepDuration) {
                            group.currentStepIndex++;
                            group.stepStartTime = time;
                        }
                    } else {
                        // Done
                        group.gridState = 'IDLE';
                    }
                } else {
                    // IDLE - ensure home
                    const lerpFactor = 1 - Math.exp(-2.0 * delta);
                    group.currentPos.lerp(group.originalPos, lerpFactor);
                    group.rotation.slerp(_quatIdentity, lerpFactor);
                }

            } else {
                // --- MODE 2: SCATTER & FREEZE ---

                // Interaction
                if (dist < 1.5 && mouseVelocity.length() > 2) {
                    // Smash!
                    group.isFlying = true;
                    // Impulse matches mouse direction + randomness
                    _simImpulse.copy(mouseVelocity).multiplyScalar(0.002);
                    _simImpulse.x += (Math.random() - 0.5) * 0.02;
                    _simImpulse.y += (Math.random() - 0.5) * 0.02;
                    _simImpulse.z += (Math.random() - 0.5) * 0.05; // More Z chaos

                    group.velocity.add(_simImpulse);

                    // Add Spin
                    _simSpinAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                    group.angularVelocity.add(_simSpinAxis.multiplyScalar(mouseVelocity.length() * 0.002));

                    // Schedule Return (fly for 0.5s to 1.5s)
                    group.returnStartTime = time + 0.5 + Math.random();
                }

                // Physics
                if (group.isFlying) {
                    group.velocity.multiplyScalar(0.96); // Drag
                    group.angularVelocity.multiplyScalar(0.96); // Angular Drag
                    group.currentPos.add(group.velocity);

                    // Apply rotation
                    const avLen = group.angularVelocity.length();
                    if (avLen > 1e-8) {
                        _simDeltaRotAxis.copy(group.angularVelocity).multiplyScalar(1 / avLen);
                        _simFinalQuatWithGlitch.setFromAxisAngle(_simDeltaRotAxis, avLen);
                        group.rotation.multiply(_simFinalQuatWithGlitch);
                    }

                    // Check if time to return
                    if (time > group.returnStartTime) {
                        group.isFlying = false;
                    }
                } else {
                    // Returning home logic

                    // Check delay (already handled by returnStartTime, so just return)
                    {
                        // Drift back slowly
                        _simReturnVec.subVectors(group.originalPos, group.currentPos);
                        const d = _simReturnVec.length();

                        if (d > 0.01) {
                            // Ease out cubic or simple lerp
                            const speed = 0.02; // Very slow return
                            group.currentPos.add(_simReturnVec.multiplyScalar(speed));

                            // Rotate back to identity
                            group.rotation.slerp(_quatIdentity, 0.05);
                        } else {
                            // Snap
                            group.currentPos.copy(group.originalPos);
                            group.rotation.set(0, 0, 0, 1);
                        }
                    }
                }
            }

            // Common Rendering for Groups
            // Reduced tilt sensitivity to avoid jelly look
            const rotX = group.velocity.y * 0.15;
            const rotY = group.velocity.x * 0.15;
            const rotZ = group.velocity.z * 0.15;

            // In Repulsion mode, we use velocity tilt. In Scatter, we use actual physics rotation.
            let finalQuat;
            if (CONFIG.animationMode === 'repulsion') {
                _simEuler.set(rotX, rotY, rotZ);
                _simFinalQuatRepulsion.setFromEuler(_simEuler);
                finalQuat = _simFinalQuatRepulsion;
            } else {
                finalQuat = group.rotation;
            }

            // Update Single Fused Mesh Instance (glitch volumetryczne: nakładka wizualna)
            let hasActiveGlitch = group.glitchEndTime && time < group.glitchEndTime;
            if (hasActiveGlitch) {
                dummy.position.copy(group.currentPos).add(group.glitchDisplayOffset);
            } else {
                dummy.position.copy(group.currentPos);
                if (group.glitchEndTime) {
                    group.glitchDisplayOffset.set(0, 0, 0);
                    group.glitchEndTime = 0;
                    group.glitchRotation = null;
                    group.glitchScale = null;
                    hasActiveGlitch = false;
                }
            }

            if (hasActiveGlitch && group.glitchRotation) {
                _simFinalQuatWithGlitch.copy(finalQuat).multiply(group.glitchRotation);
                dummy.rotation.setFromQuaternion(_simFinalQuatWithGlitch);
            } else {
                dummy.rotation.setFromQuaternion(finalQuat);
            }

            if (hasActiveGlitch && group.glitchScale) {
                dummy.scale.copy(group.baseScale).multiply(group.glitchScale);
            } else {
                dummy.scale.copy(group.baseScale);
            }
            if (group.fxGlowUntil && time < group.fxGlowUntil) {
                const gain = group.fxGlowGain || 1;
                const pulseK = group.fxGlowPulseK ?? 0.32;
                const pulse = 1 + Math.min(0.55, pulseK * gain);
                dummy.scale.multiplyScalar(pulse);
            } else if (group.fxGlowUntil) {
                group.fxGlowPulseK = undefined;
                group.fxGlowUntil = 0;
                group.fxGlowGain = 0;
            }
            dummy.updateMatrix();

            // Find the correct mesh
            const entry = meshRegistry[group.shapeId];
            if (entry) {
                const targetMesh = group.isTop ? entry.top : entry.kek;
                if (targetMesh) {
                    targetMesh.setMatrixAt(group.meshIndex, dummy.matrix);
                }
            }
        }

        // --- INNER CUBE PARTICLES LOGIC ---
        for (let i = 0; i < innerCubeParticles.length; i++) {
            const data = innerCubeParticles[i];
            const dist = data.currentPos.distanceTo(simTarget);

            if (CONFIG.animationMode === 'repulsion') {
                // --- INNER CUBE REPULSION ---

                // --- DYNAMIC HOME POSITION FOR VAJBUJ MODE ---
                _simTargetHome.copy(data.originalPos);
                if (vajbujBounceActive) {
                    const bucket = Math.floor(data.originalPos.x / 3.5);
                    const isOdd = Math.abs(bucket) % 2 === 1;
                    const alternate = isOdd ? 1 : -1;

                    _simTargetHome.y += vajbujBounceAmplitude * alternate;
                }

                if (dist < CONFIG.repulsionRadius) {
                    _simForce.subVectors(data.currentPos, simTarget);
                    if (_simForce.length() > 0) {
                        _simForce.normalize();
                        const strength = (1 - dist / CONFIG.repulsionRadius) * CONFIG.repulsionStrength;
                        // No noise
                        data.velocity.addScaledVector(_simForce, strength * 0.05);
                    }
                }
                _simReturnVec.subVectors(_simTargetHome, data.currentPos);

                // Overdamped Return
                data.velocity.addScaledVector(_simReturnVec, 0.05);
                data.velocity.multiplyScalar(0.85);
                data.currentPos.add(data.velocity);

            } else if (CONFIG.animationMode === 'grid') {
                // Inner Cube Grid Mode (Mirroring Cubes)
                const speed = mouseVelocity.length();
                const dynamicRadius = 0.3 + Math.min(speed * 0.02, 1.0);
                const displacementScale = 0.05 + Math.min(speed * 0.01, 0.2);

                if (dist < dynamicRadius && speed > 2) {
                    data.gridState = 'DISPLACED';

                    _simOffset.set(
                        (Math.random() - 0.5) * displacementScale,
                        (Math.random() - 0.5) * displacementScale,
                        (Math.random() - 0.5) * displacementScale
                    );
                    data.glitchTarget.addVectors(data.originalPos, _simOffset);

                    data.stepStartTime = time + 1.0;
                }

                if (data.gridState === 'DISPLACED') {
                    // Fly towards target
                    const lerpSpeed = 2.0 * delta;
                    data.currentPos.lerp(data.glitchTarget, lerpSpeed);

                    if (time > data.stepStartTime) {
                        data.gridState = 'RETURNING';
                        // Generate Path
                        data.returnQueue = generateReturnPath(data.currentPos, data.gridRotation || new THREE.Quaternion(), data.originalPos);
                        data.stepStartTime = time;
                    }
                } else if (data.gridState === 'RETURNING') {
                    if (data.currentStepIndex < data.returnQueue.length) {
                        const targetStep = data.returnQueue[data.currentStepIndex];
                        const stepDuration = 0.2;

                        const lerpSpeed = 10.0 * delta;
                        data.currentPos.lerp(targetStep.pos, lerpSpeed);
                        // Inner cubes don't visually rotate much, but let's do it for consistency

                        if (time > data.stepStartTime + stepDuration) {
                            data.currentStepIndex++;
                            data.stepStartTime = time;
                        }
                    } else {
                        data.gridState = 'IDLE';
                    }
                } else {
                    const lerpFactor = 1 - Math.exp(-2.0 * delta);
                    data.currentPos.lerp(data.originalPos, lerpFactor);
                }

            } else {
                // --- INNER CUBE SCATTER ---
                if (dist < 1.5 && mouseVelocity.length() > 2) {
                    data.isFlying = true;
                    // Reduced Power (0.001 vs 0.002)
                    _simImpulse.copy(mouseVelocity).multiplyScalar(0.001);
                    _simImpulse.x += (Math.random() - 0.5) * 0.01;
                    _simImpulse.y += (Math.random() - 0.5) * 0.01;
                    _simImpulse.z += (Math.random() - 0.5) * 0.02;

                    data.velocity.add(_simImpulse);

                    // Helper for return time
                    data.returnStartTime = time + 0.5 + Math.random();
                }

                if (data.isFlying) {
                    data.velocity.multiplyScalar(0.96);
                    data.currentPos.add(data.velocity);

                    if (time > data.returnStartTime) {
                        data.isFlying = false;
                    }
                } else {
                    // Return logic
                    _simReturnVec.subVectors(data.originalPos, data.currentPos);
                    const d = _simReturnVec.length();
                    if (d > 0.01) {
                        data.currentPos.add(_simReturnVec.multiplyScalar(0.02));
                    } else {
                        data.currentPos.copy(data.originalPos);
                    }
                }
            }

            // Glitch volumetryczne: nakładka wizualna dla inner cubes
            let innerHasGlitch = data.glitchEndTime && time < data.glitchEndTime;
            if (innerHasGlitch) {
                dummy.position.copy(data.currentPos).add(data.glitchDisplayOffset);
            } else {
                dummy.position.copy(data.currentPos);
                if (data.glitchEndTime) {
                    data.glitchDisplayOffset.set(0, 0, 0);
                    data.glitchEndTime = 0;
                    data.glitchRotation = null;
                    data.glitchScale = null;
                    innerHasGlitch = false;
                }
            }

            if (innerHasGlitch && data.glitchRotation) {
                dummy.rotation.setFromQuaternion(data.glitchRotation);
            } else {
                dummy.rotation.set(0, 0, 0);
            }

            if (innerHasGlitch && data.glitchScale) {
                dummy.scale.copy(data.glitchScale);
            } else {
                dummy.scale.setScalar(1);
            }
            dummy.updateMatrix();
            innerCubeInstancedMesh.setMatrixAt(data.meshIndex, dummy.matrix);
        }

        Object.values(meshRegistry).forEach(entry => {
            if (entry.top) entry.top.instanceMatrix.needsUpdate = true;
            if (entry.kek) entry.kek.instanceMatrix.needsUpdate = true;
        });
        if (innerCubeInstancedMesh) {
            innerCubeInstancedMesh.instanceMatrix.needsUpdate = true;
        }
    }

    // --- Portfolio: windows fly-in / floating and hover (play/pause video) ---
    if (portfolioState.planeMeshes.length > 0) {
        const psc = PORTFOLIO_SCENE_CONFIG;
        if (portfolioSceneActive && (portfolioScenePhase === 'windows_fly_in' || portfolioScenePhase === 'floating')) {
            const elapsed = (Date.now() - portfolioScenePhaseStartTime) / 1000;
            if (portfolioScenePhase === 'windows_fly_in' && portfolioState.windowData) {
                const progress = Math.min(1, elapsed / (psc.windowsFlyInDuration || 1));
                const e = easeInOutCubic(progress);
                portfolioState.planeMeshes.forEach((mesh, idx) => {
                    const wd = portfolioState.windowData[idx];
                    const t = portfolioState.planeTargetPositions[idx];
                    if (wd && t) {
                        mesh.position.lerpVectors(wd.flyInStartPos, t, e);
                    }
                });
                if (progress >= 1) {
                    portfolioScenePhase = 'floating';
                    portfolioScenePhaseStartTime = Date.now();
                }
            } else if (portfolioScenePhase === 'floating' && portfolioState.planeTargetPositions) {
                const t = Date.now() * 0.001;
                portfolioState.planeMeshes.forEach((mesh, idx) => {
                    const tgt = portfolioState.planeTargetPositions[idx];
                    if (tgt) {
                        const drift = 0.04 * Math.sin(t + idx);
                        mesh.position.x = tgt.x + drift;
                        mesh.position.y = tgt.y + 0.03 * Math.cos(t * 0.6 + idx * 0.5);
                        mesh.position.z = tgt.z;
                    }
                });
            }
        }

        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(portfolioState.planeMeshes);
        portfolioState.hoveredIndex = hits.length > 0 && hits[0].object.userData.portfolioIndex !== undefined
            ? hits[0].object.userData.portfolioIndex
            : -1;
        if (portfolioSceneActive && (portfolioScenePhase === 'windows_fly_in' || portfolioScenePhase === 'floating')) {
            portfolioState.items.forEach((item, idx) => {
                if (idx === portfolioState.hoveredIndex) {
                    if (item.video.paused) item.video.play().catch(() => {});
                    item.texture.needsUpdate = true;
                } else {
                    if (!item.video.paused) item.video.pause();
                    item.video.currentTime = 0;
                }
            });
        }
    }

    if (crtPass) {
        crtPass.uniforms['time'].value = Date.now() * 0.001;
    }

    composer.render();

    // Update Vajbuj mode
    updateVajbujMode(clock.getDelta());
    updateMysenMode(clock.getDelta());

    // Process background voxel generation queues (VAJBUJ + MYSEN)
    const runLyricGenQueue = (state) => {
        if (state.generationQueue.length === 0) return;
        const queueStart = performance.now();
        const maxFrameTime = 4;
        while (state.generationQueue.length > 0 && performance.now() - queueStart < maxFrameTime) {
            const task = state.generationQueue[0];
            const done = task();
            if (done) state.generationQueue.shift();
        }
    };
    runLyricGenQueue(vajbujState);
    runLyricGenQueue(mysenState);
}

function onTouchStart(event) {
    lastInteractionTime = Date.now();
    resetVajbujActivityTimer();
    if (isFreeCam) return;
    if (event.touches.length > 0) {
        if (event.target === renderer.domElement) {
            event.preventDefault();
        }

        isDragging = true;
        setCameraMode('manual'); // Disable cinematic mode on touch
        previousMouseX = event.touches[0].clientX;
        previousMouseY = event.touches[0].clientY;

        // Update mouse pos for raycaster
        mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
}

function onTouchMove(event) {
    if (event.touches.length > 0) {
        if (event.target === renderer.domElement) {
            event.preventDefault();
        }

        const clientX = event.touches[0].clientX;
        const clientY = event.touches[0].clientY;

        // Update generic mouse
        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        if (isDragging && !isFreeCam) {
            const deltaX = clientX - previousMouseX;
            const deltaY = clientY - previousMouseY;

            previousMouseX = clientX;
            previousMouseY = clientY;

            targetCameraAngle -= deltaX * 0.005;
            targetCameraVerticalAngle -= deltaY * 0.005;

            // Clamp angles
            targetCameraAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, targetCameraAngle));
            targetCameraVerticalAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, targetCameraVerticalAngle));
        }
    }
}

function onTouchEnd(event) {
    isDragging = false;
    // Reset mouse offscreen
    mouse.x = -1000;
    mouse.y = -1000;
}

function onWheel(event) {
    lastInteractionTime = Date.now();
    resetVajbujActivityTimer();
    if (isFreeCam) return;

    // Allow default scrolling when any scrollable modal is open (APPSTAIN, Glitch Lab, GENIMG, SCNDBREJN)
    const appstainModal = document.getElementById('appstain-modal');
    const glitchModal = document.getElementById('glitch-modal');
    const genimgModal = document.getElementById('genimg-modal');
    const scndbrejnModalWheel = document.getElementById('scndbrejn-modal');
    if (
        (appstainModal && !appstainModal.classList.contains('hidden')) ||
        (glitchModal && !glitchModal.classList.contains('hidden')) ||
        (genimgModal && !genimgModal.classList.contains('hidden')) ||
        (scndbrejnModalWheel && !scndbrejnModalWheel.classList.contains('hidden'))
    ) {
        return;
    }

    // Prevent default scrolling of the page
    event.preventDefault();

    // Disable cinematic mode to take control
    isCinematic = false;

    // Apply zoom
    targetCameraRadius += event.deltaY * CONFIG.zoomSensitivity;

    // Clamp
    targetCameraRadius = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, targetCameraRadius));
}

// ============================================
// VAJBUJ SZMATO MODE
// ============================================

function initVajbujMode() {
    if (!VAJBUJ_CONFIG.enabled) return;

    // Preload audio
    vajbujState.audio = new Audio(VAJBUJ_CONFIG.audioFile);
    vajbujState.audio.volume = 0;
    vajbujState.audio.preload = 'auto';

    createMusicModeBackgroundCubes(vajbujState, VAJBUJ_CONFIG);

    console.log('[VAJBUJ] Mode initialized, waiting for inactivity...');

    // Start background generation of lyrics voxels
    if (loadedFontRegular) {
        startBackgroundGeneration(loadedFontRegular);
    }
}

function queueLyricVoxelPregeneration(lyrics, font, state, lyricsConfig, logLabel) {
    const uniqueWords = new Set();
    lyrics.forEach((item) => {
        if (!item.lineBreak) {
            const word = item.text;
            const scale = item.scale || 1.0;
            uniqueWords.add(`${word}§${scale}`);
        }
    });

    const styleSlice = {
        wordSize: lyricsConfig.wordSize,
        wordHeight: lyricsConfig.wordHeight,
        wordThickness: lyricsConfig.wordThickness
    };

    console.log(`[${logLabel}] Queuing ${uniqueWords.size} unique words for background generation...`);

    uniqueWords.forEach((key) => {
        const sep = key.indexOf('§');
        const word = key.slice(0, sep);
        const scale = parseFloat(key.slice(sep + 1));
        const task = createVoxelGenerationTask(word, scale, font, state.voxelCache, styleSlice);
        state.generationQueue.push(task);
    });
}

function startBackgroundGeneration(font) {
    queueLyricVoxelPregeneration(VAJBUJ_CONFIG.lyrics, font, vajbujState, VAJBUJ_CONFIG, 'VAJBUJ');
}

function createVoxelGenerationTask(word, scale, font, voxelCache, styleSlice) {
    // State for the task
    let step = 0;
    let width = 0;
    let voxelMap = new Map();
    let gx, gy, minX, maxX, minY, maxY;
    let textGeo, mesh;
    let scanRaycaster = new THREE.Raycaster();
    const voxelSize = CONFIG.particleSize;

    return () => {
        // Step 0: Init Geometry
        if (step === 0) {
            // Check cache first
            const cacheKey = `${word}_${scale}`;
            if (voxelCache[cacheKey]) return true; // Already done

            // Replacement map for Polish characters
            const polishMap = {
                'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
                'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
                '.': '', ',': '', '!': '', '?': ''
            };
            const displayWord = word.split('').map(char => polishMap[char] || char).join('');

            textGeo = new TextGeometry(displayWord, {
                font: font,
                size: styleSlice.wordSize * scale,
                height: styleSlice.wordHeight * scale,
                curveSegments: 4,
                bevelEnabled: false
            });
            textGeo.computeBoundingBox();
            width = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;

            mesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial());
            mesh.updateMatrixWorld(); // Important for raycaster

            minX = Math.floor(textGeo.boundingBox.min.x / voxelSize);
            maxX = Math.ceil(textGeo.boundingBox.max.x / voxelSize);
            minY = Math.floor(textGeo.boundingBox.min.y / voxelSize);
            maxY = Math.ceil(textGeo.boundingBox.max.y / voxelSize);

            gx = minX;
            gy = minY;
            step = 1;
            return false; // Not done
        }

        // Step 1: Voxelization Loop (Chunked)
        if (step === 1) {
            const scanDir = new THREE.Vector3(0, 0, -1);
            let iterations = 0;
            const maxIter = 50; // Check 50 columns per frame

            while (gx <= maxX) {
                while (gy <= maxY) {
                    const px = gx * voxelSize;
                    const py = gy * voxelSize;

                    scanRaycaster.set(new THREE.Vector3(px, py, 10), scanDir);
                    const intersects = scanRaycaster.intersectObject(mesh);

                    if (intersects.length > 0) {
                        for (let z = 0; z < styleSlice.wordThickness; z++) {
                            const key = `${gx},${gy},${z}`;
                            if (!voxelMap.has(key)) {
                                voxelMap.set(key, { x: px, y: py, z: z * voxelSize });
                            }
                        }
                    }
                    gy++;
                }
                gy = minY; // Reset Y
                gx++; // Next X

                iterations++;
                if (iterations > 10) { // Small chunk size inside loop, yielding to supervisor loop
                    return false;
                }
            }

            // Loop finished
            step = 2;
            return false; // Yield one last time before finalizing
        }

        // Step 2: Finalize
        if (step === 2) {
            const positions = Array.from(voxelMap.values()).map(v => new THREE.Vector3(v.x, v.y, v.z));

            voxelCache[`${word}_${scale}`] = {
                positions: positions,
                width: width
            };

            // Cleanup
            if (textGeo) textGeo.dispose();
            // mesh doesn't own geometry in this scope, but textGeo is disposed.

            return true; // DONE
        }
    };
}

function createMusicModeBackgroundCubes(state, cfg) {
    const count = cfg.bgCubeCount;
    const size = cfg.bgCubeSize;

    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: cfg.bgCubeMaterial.metalness,
        roughness: cfg.bgCubeMaterial.roughness,
        transparent: true,
        opacity: 1
    });
    if (cfg.bgCubeMaterial.envMapIntensity != null) {
        material.envMapIntensity = cfg.bgCubeMaterial.envMapIntensity;
    }

    state.bgCubesMesh = new THREE.InstancedMesh(geometry, material, count);
    state.bgCubesMesh.visible = false;
    state.bgCubes = [];

    const colors = cfg.bgCubeColors;
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
        const pos = new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 15 + 3,
            (Math.random() - 0.5) * 10
        );

        dummy.position.copy(pos);
        dummy.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        state.bgCubesMesh.setMatrixAt(i, dummy.matrix);

        color.setHex(colors[Math.floor(Math.random() * colors.length)]);
        state.bgCubesMesh.setColorAt(i, color);

        state.bgCubes.push({
            position: pos.clone(),
            rotation: new THREE.Euler(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            ),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02
            ),
            spin: new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05
            )
        });
    }

    state.bgCubesMesh.instanceMatrix.needsUpdate = true;
    if (state.bgCubesMesh.instanceColor) {
        state.bgCubesMesh.instanceColor.needsUpdate = true;
    }

    scene.add(state.bgCubesMesh);
    applyVideoIblMaterialBoost();
}

function startVajbujMode() {
    if (vajbujState.active) return;

    setMusicShowcaseMenuUiHidden(true);
    forceStopMysenSilent();

    introCameraFlyInActive = false;

    console.log('[VAJBUJ] Starting music video mode!');
    vajbujState.active = true;
    vajbujState.startTime = Date.now();
    vajbujState.currentLineIndex = 0;
    vajbujState.currentWordIndex = 0;
    vajbujState.completedLines = 0;
    vajbujState.displayedLines = [];

    // Reset camera to starting position
    CONFIG.animationMode = 'repulsion'; // Ensure we are in repulsion mode for the animation to work
    isCinematic = false;
    isFreeCam = false;
    controls.enabled = false;
    cameraAngle = 0;
    cameraVerticalAngle = 0;
    cameraRadius = CONFIG.initialZoom;
    targetCameraAngle = 0;
    targetCameraVerticalAngle = 0;
    targetCameraRadius = CONFIG.initialZoom;
    cameraFocusPoint.set(0, 0, 0);
    camera.fov = 45;
    camera.updateProjectionMatrix();

    // Clear any existing word meshes
    cleanupVajbujWords();

    // Prepare all words with timing
    prepareVajbujWords();

    // Show background cubes and reset opacity
    if (vajbujState.bgCubesMesh) {
        vajbujState.bgCubesMesh.visible = true;
        vajbujState.bgCubesMesh.material.opacity = 1;
    }

    // Start audio
    const audio = vajbujState.audio;
    audio.pause();

    // Reset volume and current time
    audio.volume = 0;
    audio.currentTime = VAJBUJ_CONFIG.audioStartTime;

    // Play with a small delay or on seeked to ensure we are at 41s
    const startPlay = () => {
        audio.play().catch(e => console.warn('[VAJBUJ] Audio play failed:', e));
        fadeAudio(audio, 0, 1, VAJBUJ_CONFIG.fadeInDuration);
    };

    // Remove old listeners to avoid duplicates
    audio.onseeked = null;
    audio.oncanplay = null;

    audio.onseeked = () => {
        startPlay();
        audio.onseeked = null;
        clearTimeout(seekFallback);
    };

    const seekFallback = setTimeout(() => {
        if (vajbujState.active && audio.paused) {
            console.log('[VAJBUJ] Seek fallback triggered');
            startPlay();
        }
    }, 1000);

    // If already seeked or doesn't need to
    if (Math.abs(audio.currentTime - VAJBUJ_CONFIG.audioStartTime) < 0.1) {
        startPlay();
        clearTimeout(seekFallback);
    }

    // Schedule fade out and stop
    const duration = VAJBUJ_CONFIG.audioEndTime - VAJBUJ_CONFIG.audioStartTime;
    setTimeout(() => {
        fadeAudio(audio, 1, 0, VAJBUJ_CONFIG.fadeOutDuration);
    }, (duration - VAJBUJ_CONFIG.fadeOutDuration) * 1000);

    setTimeout(() => {
        stopVajbujMode();
    }, duration * 1000);

    if (window.vajbujButton) window.vajbujButton.classList.add('vajbuj-active');
}

function fadeAudio(audio, fromVol, toVol, duration) {
    const startTime = Date.now();
    const durationMs = duration * 1000;

    function tick() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        audio.volume = fromVol + (toVol - fromVol) * progress;

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    }
    tick();
}

function fadeVisualOpacity(material, fromOpacity, toOpacity, duration) {
    const startTime = Date.now();
    const durationMs = duration * 1000;

    function tick() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        material.opacity = fromOpacity + (toOpacity - fromOpacity) * progress;

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    }
    tick();
}

/**
 * @param {'vajbuj'|'mysen'} timingKind — vajbuj uses wordTimings (frames); mysen uses `at` or wordTimesSec
 */
function prepareMusicLyricWords(config, state, timingKind, lyricsSource) {
    state.words = [];

    const allWords = [];
    let currentLineIdx = 0;
    let wordInLineIdx = 0;
    const src = lyricsSource || config.lyrics;

    src.forEach((item) => {
        if (item.lineBreak) {
            currentLineIdx++;
            wordInLineIdx = 0;
        } else {
            allWords.push({
                ...item,
                lineIndex: currentLineIdx,
                wordIndex: wordInLineIdx++
            });
        }
    });

    const totalWords = allWords.length;
    const totalLines = currentLineIdx + 1;
    const startT = config.audioStartTime || 0;
    let fragmentDuration;
    if (timingKind === 'mysen') {
        const endT = config.audioEndTime;
        if (endT != null && Number.isFinite(endT) && endT > startT) {
            fragmentDuration = endT - startT;
        } else {
            const d = state.audio?.duration;
            fragmentDuration = (Number.isFinite(d) && d > startT) ? d - startT : 180;
        }
    } else {
        fragmentDuration = config.audioEndTime - config.audioStartTime;
    }
    const fps = 25;

    allWords.forEach((wordData, globalIdx) => {
        if (loadedFontRegular) {
            const textGeo = new TextGeometry(wordData.text, {
                font: loadedFontRegular,
                size: config.wordSize * (wordData.scale || 1.0),
                height: config.wordHeight * (wordData.scale || 1.0),
                curveSegments: 4,
                bevelEnabled: false
            });
            textGeo.computeBoundingBox();
            wordData.width = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
            textGeo.dispose();
        }

        let assembledAtSeconds;
        if (timingKind === 'vajbuj') {
            let targetFrame;
            if (config.wordTimings.length >= totalWords) {
                targetFrame = config.wordTimings[globalIdx];
            } else {
                const lineCountCalc = totalLines > 1 ? totalLines - 1 : 1;
                const lineStartNormalized = wordData.lineIndex / lineCountCalc;
                const lineStartFrame = lineStartNormalized * (fragmentDuration * 0.8) * fps;
                const wordStagger = 12;
                targetFrame = Math.round(lineStartFrame + (wordData.wordIndex * wordStagger));
            }
            targetFrame += 18;
            assembledAtSeconds = (targetFrame / fps) + (config.lyricsStartDelay || 0);
        } else {
            if (Number.isFinite(wordData.at)) {
                assembledAtSeconds = wordData.at + (config.lyricsStartDelay || 0);
            } else if (config.wordTimesSec && config.wordTimesSec.length > globalIdx) {
                assembledAtSeconds = config.wordTimesSec[globalIdx] + (config.lyricsStartDelay || 0);
            } else {
                const t = totalWords > 1 ? globalIdx / (totalWords - 1) : 0;
                assembledAtSeconds = t * fragmentDuration * 0.85 + (config.lyricsStartDelay || 0);
            }
        }

        const startSeconds = Math.max(0, assembledAtSeconds - config.wordAssemblyDuration);

        const atSrc = Number.isFinite(wordData.atSourceSec)
            ? wordData.atSourceSec
            : startT + (Number.isFinite(wordData.at) ? wordData.at : 0);

        state.words.push({
            ...wordData,
            atSourceSec: atSrc,
            startTime: startSeconds,
            assembledTime: assembledAtSeconds,
            state: 'waiting',
            mesh: null,
            cubes: [],
            progress: 0
        });
    });
}

function prepareVajbujWords() {
    prepareMusicLyricWords(VAJBUJ_CONFIG, vajbujState, 'vajbuj');
    const lineCount = vajbujState.words.length ? vajbujState.words[vajbujState.words.length - 1].lineIndex + 1 : 0;
    console.log(`[VAJBUJ] Prepared ${vajbujState.words.length} words in ${lineCount} lines.`);
}

function prepareMysenWords() {
    const eff = mysenState.mergedMysenConfig || MYSEN_CONFIG;
    const merged = buildMergedMysenLyrics();
    const lastIntro = lastFilledLineIndexInLyrics(eff.introLyrics || eff.lyrics);
    mysenState.firstTimestampLineIndex = lastIntro >= 0 ? lastIntro + 1 : 6;

    applyMysenWordAnimationToMergedLyrics(merged, mysenState.wordAnimationDoc?.overrides);
    prepareMusicLyricWords(eff, mysenState, 'mysen', merged);
    queueMysenVoxelPregenForPreparedWords(mysenState, eff);

    const firstTs = mysenState.firstTimestampLineIndex;
    const introStagger = eff.introAssembly?.lineStaggerSec ?? 0;
    if (introStagger > 0) {
        for (let i = 0; i < mysenState.words.length; i++) {
            const w = mysenState.words[i];
            if (w.lineIndex < firstTs) {
                const off = w.lineIndex * introStagger;
                w.startTime += off;
                w.assembledTime += off;
            }
        }
    }

    const lineStaggerLyrics = eff.lyricAssembly?.lineStaggerSec ?? 0;
    if (lineStaggerLyrics > 0) {
        for (let i = 0; i < mysenState.words.length; i++) {
            const w = mysenState.words[i];
            if (w.lineIndex >= firstTs) {
                const k = w.lineIndex - firstTs;
                w.startTime += k * lineStaggerLyrics;
                w.assembledTime += k * lineStaggerLyrics;
            }
        }
    }

    const lineCount = mysenState.words.length ? mysenState.words[mysenState.words.length - 1].lineIndex + 1 : 0;
    console.log(`[MYSEN] Prepared ${mysenState.words.length} words in ${lineCount} lines (timestamp line ≥ ${mysenState.firstTimestampLineIndex}).`);
}

function createVoxelWord(wordData, font, voxelCache, voxelStyle) {
    const word = wordData.text;
    const polishMap = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
        '.': '', ',': '', '!': '', '?': ''
    };

    const displayWord = word.split('').map(char => polishMap[char] || char).join('');

    const wordScale = wordData.scale || 1.0;
    const voxelSize = CONFIG.particleSize;
    const scatterRadius = voxelStyle.scatterRadius;

    const cacheKey = `${word}_${wordScale}`;
    let cubePositions = [];
    let width = 0;

    if (voxelCache && voxelCache[cacheKey]) {
        cubePositions = voxelCache[cacheKey].positions;
        width = voxelCache[cacheKey].width;
    } else {
        const textGeo = new TextGeometry(displayWord, {
            font: font,
            size: voxelStyle.wordSize * wordScale,
            height: voxelStyle.wordHeight * wordScale,
            curveSegments: 4,
            bevelEnabled: false
        });

        textGeo.computeBoundingBox();
        width = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;

        const mesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial());
        const voxelMap = new Map();

        const minX = Math.floor(textGeo.boundingBox.min.x / voxelSize);
        const maxX = Math.ceil(textGeo.boundingBox.max.x / voxelSize);
        const minY = Math.floor(textGeo.boundingBox.min.y / voxelSize);
        const maxY = Math.ceil(textGeo.boundingBox.max.y / voxelSize);

        const scanRaycaster = new THREE.Raycaster();
        const scanDir = new THREE.Vector3(0, 0, -1);

        for (let gx = minX; gx <= maxX; gx++) {
            for (let gy = minY; gy <= maxY; gy++) {
                const px = gx * voxelSize;
                const py = gy * voxelSize;

                scanRaycaster.set(new THREE.Vector3(px, py, 10), scanDir);
                const intersects = scanRaycaster.intersectObject(mesh);

                if (intersects.length > 0) {
                    for (let z = 0; z < voxelStyle.wordThickness; z++) {
                        const key = `${gx},${gy},${z}`;
                        if (!voxelMap.has(key)) {
                            voxelMap.set(key, {
                                x: px,
                                y: py,
                                z: z * voxelSize
                            });
                        }
                    }
                }
            }
        }

        voxelMap.forEach(v => cubePositions.push(new THREE.Vector3(v.x, v.y, v.z)));

        voxelCache[cacheKey] = {
            positions: cubePositions,
            width: width
        };

        textGeo.dispose();
    }

    const cubeGeo = new THREE.BoxGeometry(voxelSize * 0.95, voxelSize * 0.95, voxelSize * 0.95);
    const cubeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.3,
        roughness: 0.7,
        emissive: new THREE.Color(0xffffff).multiplyScalar(0.2),
        transparent: true,
        opacity: 1
    });

    const instancedMesh = new THREE.InstancedMesh(cubeGeo, cubeMat, cubePositions.length);
    instancedMesh.visible = false;

    const initColor = new THREE.Color(0x050505);
    for (let i = 0; i < cubePositions.length; i++) {
        instancedMesh.setColorAt(i, initColor);
    }

    const cubes = cubePositions.map((pos) => {
        const scatterPos = new THREE.Vector3(
            pos.x + (Math.random() - 0.5) * scatterRadius * 2,
            pos.y + (Math.random() - 0.5) * scatterRadius * 2 - 5,
            pos.z + (Math.random() - 0.5) * scatterRadius
        );

        const delay = Math.pow(Math.random(), 3) * 0.7;

        return {
            targetPos: pos.clone(),
            scatterPos: scatterPos,
            currentPos: scatterPos.clone(),
            currentScale: 0,
            delay,
            shouldOvershoot: Math.random() < 0.3,
            overshootMagnitude: 0.3 + Math.random() * 0.4
        };
    });

    // Center the word
    const centerX = width / 2;
    cubes.forEach(cube => {
        cube.targetPos.x -= centerX;
        cube.scatterPos.x -= centerX;
        cube.currentPos.x -= centerX;
    });

    // textGeo.dispose(); // Removed to fix ReferenceError

    return {
        mesh: instancedMesh,
        cubes: cubes,
        width: width
    };
}

function voxelStyleFromMusicConfig(config) {
    return {
        wordSize: config.wordSize,
        wordHeight: config.wordHeight,
        wordThickness: config.wordThickness,
        scatterRadius: config.scatterRadius,
        defaultWordColor: config.defaultWordColor
    };
}

function maybeStartWordPulse(wordData, config) {
    if (Number.isFinite(wordData.pulseMs) && Number.isFinite(wordData.pulseScale) && wordData.pulseScale > 1) {
        wordData._pulseUntil = Date.now() + wordData.pulseMs;
        wordData._pulseDurationMs = wordData.pulseMs;
        wordData._pulseScaleMax = wordData.pulseScale;
        return;
    }
    const pulses = config.wordPulses;
    if (!pulses || !pulses.length) return;
    for (let i = 0; i < pulses.length; i++) {
        const p = pulses[i];
        if (p.matchText === wordData.text) {
            wordData._pulseUntil = Date.now() + p.ms;
            wordData._pulseDurationMs = p.ms;
            wordData._pulseScaleMax = p.scale;
            return;
        }
    }
}

function getWordPulseScaleMul(wordData) {
    if (!wordData._pulseUntil || !wordData._pulseScaleMax) return 1;
    const now = Date.now();
    if (now >= wordData._pulseUntil) {
        wordData._pulseUntil = 0;
        return 1;
    }
    const rem = wordData._pulseUntil - now;
    const p = rem / (wordData._pulseDurationMs || 1);
    return 1 + (wordData._pulseScaleMax - 1) * p;
}

/** Mysen lyric timing uses wall `elapsed` from mode start; keep spread/vanish on same axis as `assembledTime` (not raw audio.currentTime, which can lag or differ with fallback clip). */
function getMysenSpreadDurationSec(config) {
    const v = config.spread?.durationSec;
    if (Number.isFinite(v) && v > 0) return v;
    const fb = MYSEN_CONFIG.spread?.durationSec;
    return Number.isFinite(fb) && fb > 0 ? fb : 1.35;
}

/** Approximate media timeline position on file (s) — matches how word `startTime` / `at` are interpreted vs `elapsed`. */
function getMysenApproxMediaSec(config, elapsed) {
    const startT = config.audioStartTime || 0;
    return startT + elapsed;
}

function stepMusicLyricWords(state, config, elapsed, tempoMultiplier, options = {}) {
    const { consoleTag = 'MUSIC', enablePulse = false, mysenMode = false, deltaSec = 1 / 60 } = options;
    const tempColor = new THREE.Color();
    const asmEndCol = new THREE.Color();
    const asmStartCol = new THREE.Color();
    const vStyle = voxelStyleFromMusicConfig(config);
    const firstTs = mysenState.firstTimestampLineIndex ?? 99999;

    state.words.forEach((wordData) => {
        if (wordData.state === 'done') return;

        const wordScaleMul = wordData.assembledScale > 0 ? wordData.assembledScale : 1;

        if (wordData.state === 'spreading' && wordData.mesh && wordData.cubes) {
            const introDur = config.introOutroSpread?.spreadDurationSec;
            const dur = wordData._introOutroSpread && Number.isFinite(introDur) && introDur > 0
                ? introDur
                : getMysenSpreadDurationSec(config);
            wordData._spreadT = (wordData._spreadT || 0) + deltaSec;
            const u = dur > 0 ? wordData._spreadT / dur : 1;
            const t = Math.min(1, Math.max(0, u));
            const amp = (config.spread?.amplitude ?? 4) * t;
            const pulseMul = enablePulse ? getWordPulseScaleMul(wordData) : 1;
            const px = wordData.posX || 0;
            const py = wordData.posY || 0;
            const pz = wordData.posZ || 0;

            wordData.cubes.forEach((cube, i) => {
                const sx = cube.targetPos.x !== 0 ? Math.sign(cube.targetPos.x) : (i % 2 === 0 ? 1 : -1);
                const sy = cube.targetPos.y !== 0 ? Math.sign(cube.targetPos.y) : (i % 3 === 0 ? 1 : -1);
                dummy.position.set(
                    cube.targetPos.x + sx * amp * 0.2 + px,
                    cube.targetPos.y + sy * amp * 0.2 + py,
                    cube.targetPos.z + pz
                );
                dummy.scale.setScalar(pulseMul * (1 - t) * wordScaleMul);
                dummy.rotation.set(0, 0, 0);
                dummy.updateMatrix();
                wordData.mesh.setMatrixAt(i, dummy.matrix);
            });
            wordData.mesh.instanceMatrix.needsUpdate = true;
            if (t >= 1) {
                wordData.state = 'done';
                wordData.mesh.visible = false;
            }
            return;
        }

        if (wordData.state === 'waiting' && elapsed >= wordData.startTime) {
            wordData.state = 'assembling';

            if (!wordData.mesh && loadedFontRegular) {
                const voxelWord = createVoxelWord(wordData, loadedFontRegular, state.voxelCache, vStyle);
                wordData.mesh = voxelWord.mesh;
                wordData.cubes = voxelWord.cubes;
                wordData.width = voxelWord.width;

                let lineX = 0;
                const wordsInThisLine = state.words.filter(w => w.lineIndex === wordData.lineIndex);
                const currentWordIdxInLine = wordsInThisLine.indexOf(wordData);

                for (let i = 0; i < currentWordIdxInLine; i++) {
                    const prevWord = wordsInThisLine[i];
                    const pw = prevWord && prevWord.width ? prevWord.width : 1.5;
                    const extra = prevWord && prevWord.extraWordSpacingAfter ? prevWord.extraWordSpacingAfter : 0;
                    lineX += pw + config.wordSpacing + extra;
                }

                let totalLineWidth = 0;
                for (let wi = 0; wi < wordsInThisLine.length; wi++) {
                    const w = wordsInThisLine[wi];
                    totalLineWidth += (w.width || 1.5);
                    if (wi < wordsInThisLine.length - 1) {
                        totalLineWidth += config.wordSpacing + (w.extraWordSpacingAfter || 0);
                    }
                }

                const startX = -totalLineWidth / 2;
                wordData.posX = startX + lineX + (wordData.width / 2) + (wordData.offsetX || 0);
                wordData.posY = config.lyricsOffsetY + (wordData.offsetY || 0);
                wordData.posZ = wordData.offsetZ || 0;

                const isTsWord = mysenMode && state === mysenState && wordData.lineIndex >= firstTs;
                const groupedTsLine = wordData.mysenGroupedLine === true;
                const hasFixedSpawn =
                    Number.isFinite(wordData.spawnX) &&
                    Number.isFinite(wordData.spawnY) &&
                    Number.isFinite(wordData.spawnZ);
                const useFly =
                    isTsWord && !groupedTsLine && (hasFixedSpawn || config.randomFly?.enabled);
                if (useFly) {
                    wordData._railX = wordData.posX;
                    wordData._railY = wordData.posY;
                    wordData._railZ = wordData.posZ;
                    if (hasFixedSpawn) {
                        wordData._spawnX = wordData.spawnX;
                        wordData._spawnY = wordData.spawnY;
                        wordData._spawnZ = wordData.spawnZ;
                        wordData.posX = wordData.spawnX;
                        wordData.posY = wordData.spawnY;
                        wordData.posZ = wordData.spawnZ;
                    } else {
                        const d0 = config.randomFly.spawnDistanceMin ?? 25;
                        const d1 = config.randomFly.spawnDistanceMax ?? 40;
                        const margin = config.randomFly?.ndcMargin ?? 0.1;
                        const useSeeded =
                            config.mysenTimestampLineGroups?.seededRandomFly !== false &&
                            Number.isFinite(wordData.atSourceSec);
                        const spawn = useSeeded
                            ? sampleMysenSeededRandomFlySpawn(
                                  d0,
                                  d1,
                                  margin,
                                  mysenHashSeedU32(`${wordData.text}|${wordData.atSourceSec}`)
                              )
                            : sampleMysenRandomFrustumPoint(
                                  d0 + Math.random() * Math.max(0.01, d1 - d0)
                              );
                        wordData._spawnX = spawn.x;
                        wordData._spawnY = spawn.y;
                        wordData._spawnZ = spawn.z;
                        wordData.posX = spawn.x;
                        wordData.posY = spawn.y;
                        wordData.posZ = spawn.z;
                    }
                }

                scene.add(wordData.mesh);
                wordData.mesh.visible = true;
            }
        }

        if (wordData.state === 'assembling' || wordData.state === 'assembled') {
            let shiftCount = state.completedLines - wordData.lineIndex;
            if (shiftCount < 0) shiftCount = 0;

            const targetLineY = config.lyricsOffsetY + shiftCount * config.lineSpacing;

            if (wordData.posY === undefined) wordData.posY = config.lyricsOffsetY;
            wordData.posY += (targetLineY - wordData.posY) * 0.1;

            const isTsWord = mysenMode && state === mysenState && wordData.lineIndex >= firstTs;
            if (isTsWord && wordData._railX != null && wordData.state === 'assembling') {
                const flyBlend = wordData.progress ?? 0;
                wordData.posX = THREE.MathUtils.lerp(wordData._spawnX, wordData._railX, flyBlend);
                wordData.posY = THREE.MathUtils.lerp(wordData._spawnY, wordData._railY, flyBlend);
                wordData.posZ = THREE.MathUtils.lerp(wordData._spawnZ, wordData._railZ, flyBlend);
            }

            const pulseMul = enablePulse ? getWordPulseScaleMul(wordData) : 1;
            const jx = 0;
            const jy = 0;
            const jz = 0;

            if (wordData.state === 'assembling') {
                const assemblyElapsed = elapsed - wordData.startTime;
                const assemblyDuration = config.wordAssemblyDuration;
                wordData.progress = Math.min(assemblyElapsed / assemblyDuration, 1);

                const hexAsmEnd =
                    wordData._assemblyColorEnd != null
                        ? wordData._assemblyColorEnd
                        : wordData.color != null
                          ? wordData.color
                          : 0xffffff;
                const hexAsmStart =
                    wordData._assemblyColorStart != null ? wordData._assemblyColorStart : 0x050505;
                asmEndCol.setHex(hexAsmEnd);
                asmStartCol.setHex(hexAsmStart);

                if (wordData.mesh && wordData.cubes) {
                    wordData.cubes.forEach((cube, i) => {
                        let effectiveProgress = 0;
                        if (wordData.progress > cube.delay) {
                            effectiveProgress = (wordData.progress - cube.delay) / (1 - cube.delay);
                        }

                        let eased;
                        if (cube.shouldOvershoot) {
                            const t = effectiveProgress;
                            if (t >= 1) {
                                eased = 1;
                            } else if (t <= 0) {
                                eased = 0;
                            } else {
                                const c1 = cube.overshootMagnitude;
                                const c3 = c1 + 1;
                                eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
                            }
                        } else {
                            eased = effectiveProgress >= 1 ? 1 : (effectiveProgress <= 0 ? 0 : 1 - Math.pow(2, -10 * effectiveProgress));
                        }

                        cube.currentPos.lerpVectors(cube.scatterPos, cube.targetPos, eased);
                        cube.currentScale = eased;

                        if (wordData.mesh) {
                            const totalParticleTime = (1 - cube.delay) * assemblyDuration;
                            const timeRemaining = (1 - effectiveProgress) * totalParticleTime;
                            const transitionWindow = 0.5;

                            if (effectiveProgress >= 1) {
                                tempColor.copy(asmEndCol);
                            } else if (timeRemaining <= transitionWindow && timeRemaining > 0) {
                                const tt = 1 - (timeRemaining / transitionWindow);
                                tempColor.copy(asmStartCol).lerp(asmEndCol, tt);
                            } else {
                                tempColor.copy(asmStartCol);
                            }
                            wordData.mesh.setColorAt(i, tempColor);
                        }

                        dummy.position.set(
                            cube.currentPos.x + (wordData.posX || 0) + jx,
                            cube.currentPos.y + (wordData.posY || 0) + jy,
                            cube.currentPos.z + (wordData.posZ || 0) + jz
                        );
                        dummy.scale.setScalar(cube.currentScale * pulseMul * wordScaleMul);
                        dummy.rotation.set(0, 0, 0);
                        dummy.updateMatrix();
                        wordData.mesh.setMatrixAt(i, dummy.matrix);
                    });
                    wordData.mesh.instanceMatrix.needsUpdate = true;
                    if (wordData.mesh.instanceColor) wordData.mesh.instanceColor.needsUpdate = true;
                }

                if (wordData.progress >= 1) {
                    wordData.state = 'assembled';
                    if (enablePulse) maybeStartWordPulse(wordData, config);

                    const lineWords = state.words.filter(w => w.lineIndex === wordData.lineIndex);
                    const allAssembled = lineWords.every(w => w.state === 'assembled' || w.state === 'assembling' && w.progress >= 1);

                    if (allAssembled && wordData.lineIndex >= state.completedLines) {
                        state.completedLines = wordData.lineIndex + 1;
                        console.log(`[${consoleTag}] Line ${wordData.lineIndex} completed. Shifting up!`);
                    }

                    const vanishAtMedia = wordData.lineVanishAtSourceSec;
                    const spreadDur = getMysenSpreadDurationSec(config);
                    const goSpreadTs =
                        mysenMode &&
                        state === mysenState &&
                        isTsWord &&
                        spreadDur > 0 &&
                        !Number.isFinite(vanishAtMedia);
                    if (goSpreadTs) {
                        wordData.state = 'spreading';
                        const lst = config.lyricSpread?.lineStaggerSec ?? 0;
                        const li = Math.max(0, wordData.lineIndex - firstTs);
                        wordData._spreadT = lst > 0 ? -li * lst : 0;
                        wordData._introOutroSpread = false;
                    }
                }
            } else if (wordData.mesh && wordData.cubes) {
                if (wordData.state === 'assembled' && mysenMode && state === mysenState && wordData.lineIndex < firstTs) {
                    const ios = config.introOutroSpread;
                    if (
                        ios &&
                        ios.enabled !== false &&
                        (getMysenSpreadDurationSec(config) > 0 ||
                            (Number.isFinite(ios.spreadDurationSec) && ios.spreadDurationSec > 0))
                    ) {
                        const wall = (Date.now() - mysenState.startTime) / 1000;
                        const d = ios.delaySec ?? 4;
                        const st = ios.lineStaggerSec ?? 0.35;
                        if (wall >= d + wordData.lineIndex * st) {
                            wordData.state = 'spreading';
                            wordData._spreadT = 0;
                            wordData._introOutroSpread = true;
                        }
                    }
                }
                if (
                    wordData.state === 'assembled' &&
                    mysenMode &&
                    state === mysenState &&
                    isTsWord &&
                    Number.isFinite(wordData.lineVanishAtSourceSec) &&
                    getMysenSpreadDurationSec(config) > 0
                ) {
                    const mediaSec = getMysenApproxMediaSec(config, elapsed);
                    if (mediaSec >= wordData.lineVanishAtSourceSec) {
                        wordData.state = 'spreading';
                        wordData._spreadT = 0;
                        wordData._introOutroSpread = false;
                    }
                }
                wordData.cubes.forEach((cube, i) => {
                    dummy.position.set(
                        cube.targetPos.x + (wordData.posX || 0) + jx,
                        cube.targetPos.y + (wordData.posY || 0) + jy,
                        cube.targetPos.z + (wordData.posZ || 0) + jz
                    );
                    dummy.scale.setScalar(pulseMul * wordScaleMul);
                    dummy.rotation.set(0, 0, 0);
                    dummy.updateMatrix();
                    wordData.mesh.setMatrixAt(i, dummy.matrix);
                });
                wordData.mesh.instanceMatrix.needsUpdate = true;
            }
        }
    });

    if (state.bgCubesMesh && state.bgCubesMesh.visible) {
        state.bgCubes.forEach((cube, i) => {
            cube.position.add(cube.velocity.clone().multiplyScalar(tempoMultiplier));
            cube.rotation.x += cube.spin.x * tempoMultiplier;
            cube.rotation.y += cube.spin.y * tempoMultiplier;
            cube.rotation.z += cube.spin.z * tempoMultiplier;

            const bounds = 15;
            ['x', 'y', 'z'].forEach(axis => {
                if (Math.abs(cube.position[axis]) > bounds) {
                    cube.velocity[axis] *= -1;
                    cube.position[axis] = Math.sign(cube.position[axis]) * bounds;
                }
            });

            dummy.position.copy(cube.position);
            dummy.rotation.copy(cube.rotation);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            state.bgCubesMesh.setMatrixAt(i, dummy.matrix);
        });
        state.bgCubesMesh.instanceMatrix.needsUpdate = true;
    }
}

function updateVajbujMode(delta) {
    if (!vajbujState.active) {
        if (VAJBUJ_CONFIG.enabled && VAJBUJ_CONFIG.autoTrigger &&
            Date.now() - vajbujState.lastActivityTime > VAJBUJ_CONFIG.inactivityTimeout) {
            startVajbujMode();
        }
        return;
    }

    const elapsed = (Date.now() - vajbujState.startTime) / 1000;
    const fragmentDuration = VAJBUJ_CONFIG.audioEndTime - VAJBUJ_CONFIG.audioStartTime;
    const progressNormalized = elapsed / fragmentDuration;

    let tempoMultiplier = 1.0;
    if (progressNormalized < VAJBUJ_CONFIG.slowPhaseEnd) {
        tempoMultiplier = VAJBUJ_CONFIG.slowPhaseSpeed;
    }

    stepMusicLyricWords(vajbujState, VAJBUJ_CONFIG, elapsed, tempoMultiplier, { consoleTag: 'VAJBUJ', enablePulse: false });
}

function updateMysenMode(delta) {
    if (!mysenState.active) return;

    const eff = mysenState.mergedMysenConfig || MYSEN_CONFIG;
    const elapsed = (Date.now() - mysenState.startTime) / 1000;
    let fragmentDuration = mysenState.playbackDurationSec;
    if (!Number.isFinite(fragmentDuration) || fragmentDuration <= 0) {
        fragmentDuration = resolveMysenFragmentDurationSec(mysenState.audio, MYSEN_CONFIG) || 1;
    }
    const progressNormalized = fragmentDuration > 0 ? elapsed / fragmentDuration : 0;

    let tempoMultiplier = 1.0;
    if (progressNormalized < eff.slowPhaseEnd) {
        tempoMultiplier = eff.slowPhaseSpeed;
    }

    if (backgroundVideoEl && MYSEN_CONFIG.mysenVideoPlaybackRate?.enabled) {
        const pr = MYSEN_CONFIG.mysenVideoPlaybackRate;
        const r0 = pr.start ?? 1;
        const r1 = pr.end ?? 0.35;
        backgroundVideoEl.playbackRate = r0 + (r1 - r0) * Math.min(1, progressNormalized);
    }

    stepMusicLyricWords(mysenState, eff, elapsed, tempoMultiplier, {
        consoleTag: 'MYSEN',
        enablePulse: true,
        mysenMode: true,
        deltaSec: delta
    });
}

function finalizeVajbujCleanup() {
    if (vajbujFinalizeTimerId) {
        clearTimeout(vajbujFinalizeTimerId);
        vajbujFinalizeTimerId = null;
    }
    console.log('[VAJBUJ] Final shutdown cleanup');

    if (vajbujState.audio) {
        vajbujState.audio.pause();
        vajbujState.audio.currentTime = 0;
        vajbujState.audio.volume = 0;
    }

    if (vajbujState.bgCubesMesh) {
        vajbujState.bgCubesMesh.visible = false;
        vajbujState.bgCubesMesh.material.opacity = 1;
    }

    cleanupVajbujWords();
    vajbujState.active = false;
    vajbujState.isStopping = false;
    vajbujState.lastActivityTime = Date.now();
    setMusicShowcaseMenuUiHidden(false);
}

function forceStopVajbujSilent() {
    if (!vajbujState.active && !vajbujState.isStopping) return;
    if (vajbujFinalizeTimerId) {
        clearTimeout(vajbujFinalizeTimerId);
        vajbujFinalizeTimerId = null;
    }
    if (vajbujState.audio) {
        vajbujState.audio.pause();
        vajbujState.audio.currentTime = 0;
        vajbujState.audio.volume = 0;
    }
    if (vajbujState.bgCubesMesh) {
        vajbujState.bgCubesMesh.material.opacity = 1;
        vajbujState.bgCubesMesh.visible = false;
    }
    cleanupVajbujWords();
    vajbujState.active = false;
    vajbujState.isStopping = false;
    if (window.vajbujButton) window.vajbujButton.classList.remove('vajbuj-active');
}

function stopVajbujMode() {
    if (vajbujState.isStopping) return;
    if (!vajbujState.active) return;

    console.log('[VAJBUJ] Initiating smooth shutdown');
    vajbujState.isStopping = true;

    if (vajbujState.audio) {
        fadeAudio(vajbujState.audio, vajbujState.audio.volume, 0, 2);
    }

    if (vajbujState.bgCubesMesh) {
        fadeVisualOpacity(vajbujState.bgCubesMesh.material, 1, 0, 2);
    }

    vajbujState.words.forEach(word => {
        if (word.mesh && word.mesh.material) {
            fadeVisualOpacity(word.mesh.material, 1, 0, 2);
        }
    });

    setCameraMode('manual');
    targetCameraAngle = 0;
    targetCameraVerticalAngle = 0;
    targetCameraRadius = CONFIG.initialZoom;
    cameraFocusPoint.set(0, 0, 0);

    if (window.vajbujButton) {
        window.vajbujButton.classList.remove('vajbuj-active');
    }

    if (vajbujFinalizeTimerId) clearTimeout(vajbujFinalizeTimerId);
    vajbujFinalizeTimerId = setTimeout(() => {
        vajbujFinalizeTimerId = null;
        finalizeVajbujCleanup();
    }, 2000);
}

function finalizeMysenCleanup() {
    if (mysenFinalizeTimerId) {
        clearTimeout(mysenFinalizeTimerId);
        mysenFinalizeTimerId = null;
    }
    console.log('[MYSEN] Final shutdown cleanup');

    if (mysenState.audio) {
        mysenState.audio.pause();
        mysenState.audio.currentTime = 0;
        mysenState.audio.volume = 0;
    }

    if (mysenState.bgCubesMesh) {
        mysenState.bgCubesMesh.visible = false;
        mysenState.bgCubesMesh.material.opacity = 1;
    }

    cleanupMysenWords();
    mysenState.active = false;
    mysenState.isStopping = false;
    mysenState.lastActivityTime = Date.now();

    if (mysenState.savedBgSrcForMysen && MYSEN_CONFIG.mysenBackgroundVideoSrc) {
        setBackgroundVideoBySrc(mysenState.savedBgSrcForMysen);
        mysenState.savedBgSrcForMysen = null;
    }
    if (backgroundVideoEl) {
        applyBackgroundVideoPlaybackRate(currentBackgroundBpm);
    }
    setMainTopkekSceneVisible(true, { hideBackgroundVideo: MYSEN_CONFIG.hideBackgroundVideo });
    if (window.mysenButton) window.mysenButton.classList.remove('mysen-active');
    clearMysenPlaybackTimers();
    mysenState.playbackDurationSec = null;
    setMusicShowcaseMenuUiHidden(false);
}

function forceStopMysenSilent() {
    if (!mysenState.active && !mysenState.isStopping) return;
    if (mysenFinalizeTimerId) {
        clearTimeout(mysenFinalizeTimerId);
        mysenFinalizeTimerId = null;
    }
    if (mysenState.audio) {
        mysenState.audio.pause();
        mysenState.audio.currentTime = 0;
        mysenState.audio.volume = 0;
    }
    if (mysenState.bgCubesMesh) {
        mysenState.bgCubesMesh.material.opacity = 1;
        mysenState.bgCubesMesh.visible = false;
    }
    cleanupMysenWords();
    mysenState.active = false;
    mysenState.isStopping = false;
    if (mysenState.savedBgSrcForMysen && MYSEN_CONFIG.mysenBackgroundVideoSrc) {
        setBackgroundVideoBySrc(mysenState.savedBgSrcForMysen);
        mysenState.savedBgSrcForMysen = null;
    }
    if (backgroundVideoEl) {
        applyBackgroundVideoPlaybackRate(currentBackgroundBpm);
    }
    setMainTopkekSceneVisible(true, { hideBackgroundVideo: MYSEN_CONFIG.hideBackgroundVideo });
    if (window.mysenButton) window.mysenButton.classList.remove('mysen-active');
    clearMysenPlaybackTimers();
    mysenState.playbackDurationSec = null;
}

function createMysenAudioElement() {
    const primary = MYSEN_CONFIG.audioFile;
    const fallback = MYSEN_CONFIG.audioFileFallback || null;
    const audio = new Audio();
    audio.volume = 0;
    audio.preload = 'auto';

    const trySrc = (src, isFallback) => {
        audio.removeAttribute('src');
        audio.src = src;
        audio.load();
        const onErr = () => {
            audio.removeEventListener('error', onErr);
            if (!isFallback && fallback) {
                console.warn('[MYSEN] Could not load audioFile (404 or bad path):', src);
                console.warn('[MYSEN] Trying audioFileFallback:', fallback);
                trySrc(fallback, true);
            } else {
                console.error(
                    '[MYSEN] Audio load failed. Add your MP3 as',
                    primary,
                    'or set MYSEN_CONFIG.audioFile / audioFileFallback in config.js. currentSrc:',
                    audio.currentSrc || '(none)'
                );
            }
        };
        audio.addEventListener('error', onErr, { once: true });
    };

    trySrc(primary, false);
    return audio;
}

function initMysenMode() {
    if (!MYSEN_CONFIG.enabled) return;
    if (MYSEN_CONFIG.disableOnMobile && IS_MOBILE) return;

    mysenState.audio = createMysenAudioElement();

    createMusicModeBackgroundCubes(mysenState, MYSEN_CONFIG);

    mysenState.timestampLyricsParsed = [];
    mysenState._timestampLoadPromise = Promise.resolve();
    mysenState.wordAnimationDoc = null;
    mysenState._wordAnimationLoadPromise = Promise.resolve();
    if (loadedFontRegular) {
        queueLyricVoxelPregeneration(MYSEN_CONFIG.introLyrics || MYSEN_CONFIG.lyrics, loadedFontRegular, mysenState, MYSEN_CONFIG, 'MYSEN');
    }
    if (MYSEN_CONFIG.timestampLyricsEnabled && MYSEN_CONFIG.timestampLyricsUrl) {
        mysenState._timestampLoadPromise = fetch(MYSEN_CONFIG.timestampLyricsUrl)
            .then((r) => (r.ok ? r.text() : ''))
            .then((text) => {
                mysenState.timestampLyricsParsed = parseMysenTimestampLyricsFile(text);
                if (mysenState.timestampLyricsParsed.length) {
                    console.log('[MYSEN] Loaded', mysenState.timestampLyricsParsed.length, 'timestamp lyric tokens');
                }
                queueMysenTimestampVoxelPregen();
            })
            .catch(() => {});
    }
    if (MYSEN_CONFIG.wordAnimationEnabled && MYSEN_CONFIG.wordAnimationUrl) {
        mysenState._wordAnimationLoadPromise = fetch(MYSEN_CONFIG.wordAnimationUrl)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                mysenState.wordAnimationDoc = data && typeof data === 'object' ? data : null;
                if (mysenState.wordAnimationDoc?.version != null) {
                    console.log('[MYSEN] Word animation JSON loaded, version', mysenState.wordAnimationDoc.version);
                }
            })
            .catch((e) => {
                console.warn('[MYSEN] Word animation JSON fetch/parse failed:', e);
                mysenState.wordAnimationDoc = null;
            });
    }

    console.log('[MYSEN] Mode initialized.');
}

async function startMysenMode() {
    if (mysenState.active) return;

    setMusicShowcaseMenuUiHidden(true);
    forceStopVajbujSilent();

    introCameraFlyInActive = false;

    try {
        await ensureMysenTimestampsLoaded();
        await ensureMysenWordAnimationLoaded();
    } catch (e) {
        setMusicShowcaseMenuUiHidden(false);
        throw e;
    }
    mysenState.mergedMysenConfig = buildMysenEffectiveConfig();

    console.log('[MYSEN] Starting remix mode');
    clearMysenPlaybackTimers();
    mysenState.playbackDurationSec = null;
    mysenState.active = true;
    mysenState.startTime = Date.now();
    mysenState.currentLineIndex = 0;
    mysenState.currentWordIndex = 0;
    mysenState.completedLines = 0;
    mysenState.displayedLines = [];

    CONFIG.animationMode = 'repulsion';
    isCinematic = false;
    isFreeCam = false;
    controls.enabled = false;
    cameraAngle = 0;
    cameraVerticalAngle = 0;
    cameraRadius = CONFIG.initialZoom;
    targetCameraAngle = 0;
    targetCameraVerticalAngle = 0;
    targetCameraRadius = CONFIG.initialZoom;
    cameraFocusPoint.set(0, 0, 0);
    camera.fov = 45;
    camera.updateProjectionMatrix();

    cleanupMysenWords();
    prepareMysenWords();

    if (MYSEN_CONFIG.mysenBackgroundVideoSrc) {
        mysenState.savedBgSrcForMysen = activeBackgroundVideoSource?.src ?? null;
        setBackgroundVideoBySrc(MYSEN_CONFIG.mysenBackgroundVideoSrc);
    }

    setMainTopkekSceneVisible(false, { hideBackgroundVideo: mysenHideBackgroundVideoWhileActive() });

    if (mysenState.bgCubesMesh) {
        mysenState.bgCubesMesh.visible = true;
        mysenState.bgCubesMesh.material.opacity = 1;
    }

    const audio = mysenState.audio;
    audio.pause();
    audio.volume = 0;
    audio.currentTime = MYSEN_CONFIG.audioStartTime;

    const startPlay = () => {
        audio.play().catch((e) => {
            console.warn('[MYSEN] Audio play failed:', e?.name || e);
            console.warn(
                '[MYSEN] Ensure MYSEN_CONFIG.audioFile exists (no 404) or a working audioFileFallback; currentSrc:',
                audio.currentSrc || '(empty)'
            );
        });
        fadeAudio(audio, 0, 1, MYSEN_CONFIG.fadeInDuration);
        scheduleMysenPlaybackEnd(audio);
    };

    audio.onseeked = null;
    audio.oncanplay = null;

    let seekFallbackMysen = null;
    audio.onseeked = () => {
        startPlay();
        audio.onseeked = null;
        if (seekFallbackMysen) clearTimeout(seekFallbackMysen);
    };

    seekFallbackMysen = setTimeout(() => {
        if (mysenState.active && audio.paused) {
            console.log('[MYSEN] Seek fallback triggered');
            startPlay();
        }
    }, 1000);

    if (Math.abs(audio.currentTime - MYSEN_CONFIG.audioStartTime) < 0.1) {
        startPlay();
        if (seekFallbackMysen) clearTimeout(seekFallbackMysen);
    }

    if (window.mysenButton) window.mysenButton.classList.add('mysen-active');
}

function stopMysenMode() {
    if (mysenState.isStopping) return;
    if (!mysenState.active) return;

    console.log('[MYSEN] Initiating smooth shutdown');
    mysenState.isStopping = true;
    clearMysenPlaybackTimers();

    if (mysenState.audio) {
        fadeAudio(mysenState.audio, mysenState.audio.volume, 0, 2);
    }

    if (mysenState.bgCubesMesh) {
        fadeVisualOpacity(mysenState.bgCubesMesh.material, 1, 0, 2);
    }

    mysenState.words.forEach(word => {
        if (word.mesh && word.mesh.material) {
            fadeVisualOpacity(word.mesh.material, 1, 0, 2);
        }
    });

    setCameraMode('manual');
    targetCameraAngle = 0;
    targetCameraVerticalAngle = 0;
    targetCameraRadius = CONFIG.initialZoom;
    cameraFocusPoint.set(0, 0, 0);

    if (window.mysenButton) window.mysenButton.classList.remove('mysen-active');

    if (mysenFinalizeTimerId) clearTimeout(mysenFinalizeTimerId);
    mysenFinalizeTimerId = setTimeout(() => {
        mysenFinalizeTimerId = null;
        finalizeMysenCleanup();
    }, 2000);
}

function cleanupMysenWords() {
    mysenState.words.forEach(wordData => {
        if (wordData.mesh) {
            scene.remove(wordData.mesh);
            wordData.mesh.geometry.dispose();
            wordData.mesh.material.dispose();
            wordData.mesh = null;
        }
    });
    mysenState.words = [];
}

function cleanupVajbujWords() {
    vajbujState.words.forEach(wordData => {
        if (wordData.mesh) {
            scene.remove(wordData.mesh);
            wordData.mesh.geometry.dispose();
            wordData.mesh.material.dispose();
            wordData.mesh = null;
        }
    });
    vajbujState.words = [];
}

function resetVajbujActivityTimer() {
    vajbujState.lastActivityTime = Date.now();

    // If Vajbuj is active and user interacts, don't stop - let them control camera
    // Only reset timer for triggering new Vajbuj after it ends
}

// --- PARTICLE SERIALIZATION & LOADING ---

function initMeshes(groupCounts) {
    meshRegistry = {};
    const baseSize = CONFIG.particleSize;

    // Ensure materials are initialized
    if (!defaultBoxMaterial) defaultBoxMaterial = new THREE.MeshStandardMaterial(MATERIALS.defaultBox);
    if (!glassMaterial) glassMaterial = new THREE.MeshPhysicalMaterial(MATERIALS.glass);
    if (!goldMaterial) goldMaterial = new THREE.MeshStandardMaterial(MATERIALS.gold);

    SHAPE_DEFINITIONS.forEach(shape => {
        const geoW = shape.w * baseSize;
        const geoH = shape.h * baseSize;
        const geoD = shape.d * baseSize;
        const radius = baseSize * 0.05;

        const geometry = new RoundedBoxGeometry(geoW, geoH, geoD, 2, radius);
        const entry = {};

        if (groupCounts[shape.id].top > 0) {
            const mesh = new THREE.InstancedMesh(geometry, isAlternateMaterial ? glassMaterial : defaultBoxMaterial, groupCounts[shape.id].top);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            entry.top = mesh;
            entry.topIndex = 0;
            scene.add(mesh);
        }

        if (groupCounts[shape.id].kek > 0) {
            const mesh = new THREE.InstancedMesh(geometry, isAlternateMaterial ? goldMaterial : defaultBoxMaterial, groupCounts[shape.id].kek);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            entry.kek = mesh;
            entry.kekIndex = 0;
            scene.add(mesh);
        }

        meshRegistry[shape.id] = entry;
    });
}
function exportParticles() {
    const data = {
        cubeGroups: cubeGroups.map(g => ({
            p: [Number(g.originalPos.x.toFixed(3)), Number(g.originalPos.y.toFixed(3)), Number(g.originalPos.z.toFixed(3))],
            s: [Number(g.baseScale.x.toFixed(3)), Number(g.baseScale.y.toFixed(3)), Number(g.baseScale.z.toFixed(3))],
            id: g.shapeId,
            t: g.isTop ? 1 : 0
        })),
        inner: innerCubeParticles.map(p => ({
            p: [Number(p.originalPos.x.toFixed(3)), Number(p.originalPos.y.toFixed(3)), Number(p.originalPos.z.toFixed(3))]
        })),
        text: CONFIG.text
    };

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = CONFIG.particlesFile;
    a.click();
    URL.revokeObjectURL(url);
}

async function loadParticles(data) {
    console.log("Loading particles from file...");
    loadState.generation = 10;
    updateProgress();
    await new Promise(resolve => requestAnimationFrame(resolve));

    // 1. Reconstruct Counts
    const groupCounts = {};
    SHAPE_DEFINITIONS.forEach(s => groupCounts[s.id] = { top: 0, kek: 0 });

    data.cubeGroups.forEach(g => {
        if (g.t) groupCounts[g.id].top++;
        else groupCounts[g.id].kek++;
    });

    // 2. Init Meshes
    initMeshes(groupCounts);

    loadState.generation = 50;
    updateProgress();
    await new Promise(resolve => requestAnimationFrame(resolve));

    // 3. Populate Cubes
    cubeGroups = [];
    dummy.rotation.set(0, 0, 0);

    data.cubeGroups.forEach(g => {
        const entry = meshRegistry[g.id];
        const mesh = g.t ? entry.top : entry.kek;
        const index = g.t ? entry.topIndex++ : entry.kekIndex++;

        const pos = new THREE.Vector3(g.p[0], g.p[1], g.p[2]);
        const scale = new THREE.Vector3(g.s[0], g.s[1], g.s[2]);

        dummy.position.copy(pos);
        dummy.scale.copy(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);

        cubeGroups.push({
            originalPos: pos.clone(),
            currentPos: pos.clone(),
            baseScale: scale.clone(),
            shapeId: g.id,
            isTop: Boolean(g.t),
            meshIndex: index,
            velocity: new THREE.Vector3(0, 0, 0),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Quaternion(),
            isFlying: false,
            returnStartTime: 0,
            freezeTime: 0,
            returnSpeed: CONFIG.returnSpeed * (0.5 + Math.random()),
            wobbleFreq: Math.random() * 0.1,
            wobbleAmp: Math.random() * 0.05,
            gridState: 'IDLE',
            returnQueue: [],
            currentStepIndex: 0,
            stepStartTime: 0,
            glitchTarget: new THREE.Vector3(),
            glitchDisplayOffset: new THREE.Vector3(0, 0, 0),
            glitchEndTime: 0,
            glitchRotation: null,
            glitchScale: null,
        });
    });

    // Notify Three.js to update
    Object.values(meshRegistry).forEach(e => {
        if (e.top) e.top.instanceMatrix.needsUpdate = true;
        if (e.kek) e.kek.instanceMatrix.needsUpdate = true;
    });

    loadState.generation = 80;
    updateProgress();
    await new Promise(resolve => requestAnimationFrame(resolve));

    // 4. Inner Cubes
    innerCubeParticles = [];

    // Check if inner data exists
    if (!data.inner) data.inner = [];

    const innerCount = data.inner.length;
    const innerCubeGeo = new THREE.BoxGeometry(CONFIG.particleSize, CONFIG.particleSize, CONFIG.particleSize);
    const innerCubeMat = new THREE.MeshStandardMaterial(MATERIALS.innerCubes);
    attachInnerCubeGradientShader(innerCubeMat);

    innerCubeInstancedMesh = new THREE.InstancedMesh(innerCubeGeo, innerCubeMat, innerCount);
    const color = new THREE.Color();

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    if (innerCount > 0) {
        data.inner.forEach(p => {
            const px = p.p[0];
            const py = p.p[1];
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        });
    }

    let sIdx = 0;
    data.inner.forEach(p => {
        const pos = new THREE.Vector3(p.p[0], p.p[1], p.p[2]);
        const zBias = CONFIG.innerCubeZBias ?? 0;
        pos.z += (pos.z >= 0 ? 1 : -1) * zBias;

        dummy.position.copy(pos);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        innerCubeInstancedMesh.setMatrixAt(sIdx, dummy.matrix);

        setInnerCubeInstanceHue(color, pos.x, pos.y, minX, maxX, minY, maxY);
        innerCubeInstancedMesh.setColorAt(sIdx, color);

        innerCubeParticles.push({
            meshIndex: sIdx,
            originalPos: pos.clone(),
            currentPos: pos.clone(),
            velocity: new THREE.Vector3(0, 0, 0),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Quaternion(),
            isFlying: false,
            returnStartTime: 0,
            returnSpeed: CONFIG.returnSpeed,
            gridState: 'IDLE',
            returnQueue: [],
            currentStepIndex: 0,
            stepStartTime: 0,
            glitchTarget: new THREE.Vector3(),
            glitchDisplayOffset: new THREE.Vector3(0, 0, 0),
            glitchEndTime: 0,
            glitchRotation: null,
            glitchScale: null,
        });
        sIdx++;
    });

    innerCubeInstancedMesh.count = sIdx;
    innerCubeInstancedMesh.instanceMatrix.needsUpdate = true;
    if (innerCubeInstancedMesh.instanceColor) innerCubeInstancedMesh.instanceColor.needsUpdate = true;
    scene.add(innerCubeInstancedMesh);

    loadState.generation = 100;
    updateProgress();
    stopLoaderSimulation({ finalize: true });
    applyVideoIblMaterialBoost();

    // Hide Loader
    loaderContainer.classList.add('hidden');
    setTimeout(() => {
        loaderContainer.style.display = 'none';
    }, 500);
}
