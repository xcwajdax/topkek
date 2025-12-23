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
import { IS_MOBILE as isMobile, CONFIG, SHADER_CONFIG, MATERIALS, SHAPE_DEFINITIONS, CINEMATIC_CONFIG as cinematicConfig, LOADER_CONFIG } from './config.js';

const CRTShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0 },
        'start_time': { value: 0 },
        'resolution': { value: new THREE.Vector2() },
        'curvature': { value: SHADER_CONFIG.crt.curvature }, // 1.0 = flat
        'lineWidth': { value: SHADER_CONFIG.crt.lineWidth } // Scanline width
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
        uniform float time; // Time in seconds
        uniform vec2 resolution;
        uniform vec2 curvature;
        uniform float lineWidth;
        
        varying vec2 vUv;

        // Curve operation
        vec2 curve(vec2 uv) {
            uv = (uv - 0.5) * 2.0;
            uv *= 1.1; // Zoom out slightly to fit curve
            uv.x *= 1.0 + pow((abs(uv.y) * curvature.x), 2.0);
            uv.y *= 1.0 + pow((abs(uv.x) * curvature.y), 2.0);
            uv  = (uv / 2.0) + 0.5;
            uv =  uv * 0.95 + 0.05;
            return uv;
        }

        void main() {
            vec2 uv = curve(vUv);
            
            // Check bounds
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            } else {
                // Base color with curvature only
                vec4 color = texture2D(tDiffuse, uv);

                // Vignette at edges of curved screen
                float vig = 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
                color.rgb *= vec3(pow(vig, 0.9));

                gl_FragColor = color;
            }
        }
    `
};

// Configuration and State imported from config.js

// State
let scene, camera, renderer, composer, crtPass, bloomPass;
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
let cameraRadius = 15;
let targetCameraRadius = 15;
const MAX_ANGLE = Math.PI / 4; // 45 degrees

// Free Camera State
let controls;
let isFreeCam = false;

// Cinematic Camera State
let isCinematic = true;
let cinematicSwitchTime = 0;
let lastInteractionTime = Date.now();
let isInitialSequence = true;

// Cinematic Camera State (Shots imported)
let cinematicDollySpeed = 0; // Speed of radius change
let currentShotSpeedMult = 0.2; // Speed of orbit

// DOM Elements
const container = document.getElementById('canvas-container');
const loaderContainer = document.getElementById('loader-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-percentage');
const statusText = document.getElementById('loading-text');

// Loading State
let loadState = {
    assets: 0,
    generation: 0
};

function updateProgress() {
    const totalWeight = LOADER_CONFIG.phases.assets.weight + LOADER_CONFIG.phases.generation.weight;
    const currentWeight = (loadState.assets * LOADER_CONFIG.phases.assets.weight / 100) +
        (loadState.generation * LOADER_CONFIG.phases.generation.weight / 100);
    const percentage = Math.round((currentWeight / totalWeight) * 100);

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

const clock = new THREE.Clock();

init();
animate();

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111); // Dark background
    scene.fog = new THREE.Fog(0x000000, 10, 50); // Optional fog

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 15);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
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

    // Post-Processing
    const renderScene = new RenderPass(scene, camera);

    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = SHADER_CONFIG.bloom.threshold;
    bloomPass.strength = SHADER_CONFIG.bloom.strength; // Adjust for glow intensity
    bloomPass.radius = SHADER_CONFIG.bloom.radius;

    const outputPass = new OutputPass();

    crtPass = new ShaderPass(CRTShader);
    crtPass.uniforms['resolution'].value.set(window.innerWidth, window.innerHeight);

    const saoPass = new SAOPass(scene, camera, new THREE.Vector2(window.innerWidth, window.innerHeight));
    saoPass.params.saoBias = SHADER_CONFIG.sao.saoBias;
    saoPass.params.saoIntensity = SHADER_CONFIG.sao.saoIntensity;
    saoPass.params.saoScale = SHADER_CONFIG.sao.saoScale;
    saoPass.params.saoKernelRadius = SHADER_CONFIG.sao.saoKernelRadius;
    saoPass.params.saoMinResolution = SHADER_CONFIG.sao.saoMinResolution;
    saoPass.params.saoBlur = SHADER_CONFIG.sao.saoBlur;
    saoPass.params.saoBlurRadius = SHADER_CONFIG.sao.saoBlurRadius;
    saoPass.params.saoBlurStdDev = SHADER_CONFIG.sao.saoBlurStdDev;
    saoPass.params.saoBlurDepthCutoff = SHADER_CONFIG.sao.saoBlurDepthCutoff;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(saoPass);
    composer.addPass(bloomPass);
    composer.addPass(crtPass);
    composer.addPass(outputPass);

    // 4. Lighting & Environment (HDRI)
    new RGBELoader()
        .load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr', function (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            // scene.background = texture; // Uncomment to see the HDR background
            scene.environment = texture;

            // Generate particles only after basic setup is safe, but we can do it parallel
        });

    // Keep a subtle Directional Light1 for sharp shadows
    const dirLight1 = new THREE.DirectionalLight(0xFF0000, 0.7);
    dirLight1.position.set(10, 10, 10);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = CONFIG.shadowMapSize;
    dirLight1.shadow.mapSize.height = CONFIG.shadowMapSize;
    const dirLight2 = new THREE.DirectionalLight(0x0000FF, 0.7);
    dirLight2.position.set(-10, -10, 10);
    dirLight2.castShadow = true;
    dirLight2.shadow.mapSize.width = CONFIG.shadowMapSize;
    dirLight2.shadow.mapSize.height = CONFIG.shadowMapSize;
    scene.add(dirLight1);
    scene.add(dirLight2);

    // Debug Cursor
    const debugGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const debugMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    debugMesh = new THREE.Mesh(debugGeo, debugMat);
    scene.add(debugMesh);

    // 5. Load Fonts and Generate Text
    const loader = new FontLoader();

    // Load both fonts in parallel
    const fontBoldPromise = new Promise((resolve, reject) => {
        loader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json', resolve, undefined, reject);
    });

    const fontRegularPromise = new Promise((resolve, reject) => {
        // Using helvetiker_regular for a thinner look
        loader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', resolve, undefined, reject);
    });

    Promise.all([fontBoldPromise, fontRegularPromise])
        .then(async ([fontBold, fontRegular]) => {
            loadedFont = fontBold;
            loadedFontRegular = fontRegular;
            loadState.assets = 100; // Fonts loaded
            updateProgress();

            // Allow UI to update before heavy processing
            await new Promise(resolve => requestAnimationFrame(resolve));

            await generateParticles(fontBold, fontRegular); // Await async generation

            loaderContainer.classList.add('hidden');
            setTimeout(() => {
                loaderContainer.style.display = 'none';
            }, 500);
        })
        .catch(err => {
            console.error("Error loading fonts:", err);
            statusText.innerText = "Error Loading Fonts";
        });

    // 6. Events
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            isAlternateMaterial = !isAlternateMaterial;

            // Update Bloom Strength
            if (bloomPass) {
                bloomPass.strength = isAlternateMaterial ? SHADER_CONFIG.bloom.alternateStrength : SHADER_CONFIG.bloom.strength;
            }


            // Iterate over registry to update materials
            Object.values(meshRegistry).forEach(entry => {
                if (entry.top) entry.top.material = isAlternateMaterial ? glassMaterial : defaultBoxMaterial;
                if (entry.kek) entry.kek.material = isAlternateMaterial ? goldMaterial : defaultBoxMaterial;
            });
        }
        if (e.code === 'Escape') {
            if (!isCinematic || isFreeCam) {
                setCameraMode('dynamic');
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

function createUI() {
    const ui = document.createElement('div');
    ui.id = 'ui-container';

    const btn1 = document.createElement('button');
    btn1.className = 'mode-btn active';
    btn1.innerText = 'Repulsion';
    btn1.onclick = () => setMode('repulsion', btn1, [btn2, btn3]);

    const btn2 = document.createElement('button');
    btn2.className = 'mode-btn';
    btn2.innerText = 'Scatter';
    btn2.onclick = () => setMode('scatter', btn2, [btn1, btn3]);

    const btn3 = document.createElement('button');
    btn3.className = 'mode-btn';
    btn3.innerText = 'Grid';
    btn3.onclick = () => setMode('grid', btn3, [btn1, btn2]);

    ui.appendChild(btn1);
    ui.appendChild(btn2);
    ui.appendChild(btn3);
    document.body.appendChild(ui);

    // --- NEW UI ELEMENTS ---

    // 1. Production Label (Left)
    const label = document.createElement('div');
    label.className = 'prod-label';
    label.innerText = 'TOP KEK Productions ® - Handcrafted Games';
    // Add trademark symbol replacement if needed, but text is fine
    const tmSpan = document.createElement('sup');
    tmSpan.innerText = 'R'; // Using 'R' as requested in brackets, or simple text
    // User asked for "[znaczek R, reserved]", let's use standard ® symbol in text or styled
    // Let's stick to simple text with the symbol
    label.innerHTML = 'TOP KEK Productions &reg; - Handcrafted Games';
    document.body.appendChild(label);

    // 2. APPSTAIN Button (Right)
    const btnAppstain = document.createElement('button');
    btnAppstain.className = 'mode-btn'; // Same style
    btnAppstain.style.position = 'absolute';
    btnAppstain.style.bottom = '20px'; // Same level as UI container
    btnAppstain.style.right = '20px'; // Position right
    btnAppstain.innerText = 'APPSTAIN';
    btnAppstain.onclick = () => {
        document.getElementById('appstain-modal').classList.remove('hidden');
    };
    document.body.appendChild(btnAppstain);

    // 3. Modal Logic
    const modal = document.getElementById('appstain-modal');
    const closeBtn = document.getElementById('appstain-close');
    const submitBtn = document.getElementById('appstain-submit');
    const passwordInput = document.getElementById('appstain-password');
    const errorMsg = document.getElementById('appstain-error');

    closeBtn.onclick = () => {
        modal.classList.add('hidden');
        errorMsg.style.display = 'none';
        passwordInput.value = '';
    };

    const checkPassword = () => {
        if (passwordInput.value === CONFIG.appstainPassword) {
            window.location.href = 'http://xcwajdax.github.io';
        } else {
            errorMsg.style.display = 'block';
            passwordInput.value = ''; // Clear input on error
        }
    };

    submitBtn.onclick = checkPassword;

    // Allow Enter key to submit
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });


    // --- END NEW UI ELEMENTS ---

    if (isMobile) {
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

async function updateText(newText) {
    if (!loadedFont) return;

    // Show loader again
    loaderContainer.style.display = 'flex';
    loaderContainer.classList.remove('hidden');
    loadState.generation = 0;
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

function setCameraMode(mode) {
    if (mode === 'free') {
        isFreeCam = true;
        controls.enabled = true;
        controls.target.copy(cameraFocusPoint);
        controls.update();
        isCinematic = false;
        isDragging = false; // Stop any custom dragging
    } else {
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
    }
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

function onMouseDown(event) {
    // Ignore clicks on UI buttons
    if (event.target.closest('button') || event.target.closest('.mode-btn') || event.target.closest('.letter-btn')) {
        return;
    }

    lastInteractionTime = Date.now();
    if (isFreeCam) return;

    // Middle Mouse Button (Button 1) -> Pan
    if (event.button === 1) {
        isPanning = true;
        isCinematic = false;
        event.preventDefault(); // Prevent scroll cursor
    }
    // Left Mouse Button (Button 0) -> Rotate
    else if (event.button === 0) {
        isDragging = true;
        isCinematic = false;
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
    const textWidth = maxX - minX;

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
            await new Promise(resolve => setTimeout(resolve, 0));
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
            await new Promise(resolve => setTimeout(resolve, 0));
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
    meshRegistry = {};
    const baseSize = CONFIG.particleSize;

    shapeDefinitions.forEach(shape => {
        // Create fused geometry
        // Note: scaling dimensions. 
        // For a 2x1 group, width is 2*size.
        // We use RoundedBoxGeometry to get the bevels around the FUSED shape.
        const geoW = shape.w * baseSize;
        const geoH = shape.h * baseSize;
        const geoD = shape.d * baseSize;

        // Bevel radius: 0.05 * size (same as original proportion)
        const radius = baseSize * 0.05;

        const geometry = new RoundedBoxGeometry(geoW, geoH, geoD, 2, radius);

        // Create Meshes if count > 0
        const entry = {};

        if (groupCounts[shape.id].top > 0) {
            const mesh = new THREE.InstancedMesh(geometry, isAlternateMaterial ? glassMaterial : defaultBoxMaterial, groupCounts[shape.id].top);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            entry.top = mesh;
            entry.topIndex = 0; // Counter for filling
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

    loadState.generation = 95;
    updateProgress();
    await new Promise(resolve => setTimeout(resolve, 0));

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
        };

        cubeGroups.push(groupLogic);
    });

    // --- INNER CUBES (Core) ---
    const innerCubeCount = 2000;
    const innerCubeGeo = new THREE.BoxGeometry(CONFIG.particleSize * 1, CONFIG.particleSize * 1, CONFIG.particleSize * 1);
    const innerCubeMat = new THREE.MeshStandardMaterial(MATERIALS.innerCubes);

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

        const hue = (tempPosition.x - minX) / textWidth;
        color.setHSL(hue, 1.0, 0.5);
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
            glitchTarget: new THREE.Vector3()
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
}

function onMouseMove(event) {
    if (isDragging || isPanning) lastInteractionTime = Date.now();

    // Normalize mouse coordinates (Always update)
    if (renderer) { // Safety check if called early
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // Handle Camera Rotation & Panning
    if (!isFreeCam) {
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
                const panFactor = CONFIG.panSpeed * (cameraRadius / 15);

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
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    if (crtPass) crtPass.uniforms['resolution'].value.set(window.innerWidth, window.innerHeight);
}



function animate() {
    requestAnimationFrame(animate);

    if (isFreeCam && controls) {
        controls.update();

        // Auto-switch back to dynamic if idle
        if (Date.now() - lastInteractionTime > cinematicConfig.autoDynamicTimeout) {
            setCameraMode('dynamic');
        }
    } else {
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
            cameraAngle += (targetCameraAngle - cameraAngle) * 0.1;
            cameraVerticalAngle += (targetCameraVerticalAngle - cameraVerticalAngle) * 0.1;
            cameraRadius += (targetCameraRadius - cameraRadius) * 0.1;

            // Auto-switch back to dynamic if idle (for manual mode)
            if (Date.now() - lastInteractionTime > cinematicConfig.autoDynamicTimeout) {
                setCameraMode('dynamic');
            }
        }

        const horizontalRadius = cameraRadius * Math.cos(cameraVerticalAngle);

        camera.position.x = cameraFocusPoint.x + Math.sin(cameraAngle) * horizontalRadius;
        camera.position.z = cameraFocusPoint.z + Math.cos(cameraAngle) * horizontalRadius;
        camera.position.y = cameraFocusPoint.y + Math.sin(cameraVerticalAngle) * cameraRadius;

        camera.lookAt(cameraFocusPoint);
    }

    if (Object.keys(meshRegistry).length > 0) {
        raycaster.setFromCamera(mouse, camera);

        const target = new THREE.Vector3();
        const intersection = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), target);

        if (intersection) {
            debugMesh.position.copy(target); // Update debug sphere

            // Calculate Mouse Velocity
            const now = Date.now();
            const dt = (now - lastMouseTime) / 1000;
            if (dt > 0 && dt < 0.1) {
                mouseVelocity.subVectors(target, lastTarget).divideScalar(dt);
            }
            lastMouseTime = now;
            lastTarget.copy(target);

        } else {
            target.set(1000, 1000, 1000);
            mouseVelocity.set(0, 0, 0);
        }

        const time = Date.now() * 0.001;
        const delta = clock.getDelta();

        // --- CUBE GROUPS LOGIC ---
        for (let i = 0; i < cubeGroups.length; i++) {
            const group = cubeGroups[i];
            const dist = group.currentPos.distanceTo(target);

            if (CONFIG.animationMode === 'repulsion') {
                // --- MODE 1: REPULSION (Original) ---
                if (dist < CONFIG.repulsionRadius) {
                    const force = new THREE.Vector3().subVectors(group.currentPos, target);
                    const len = force.length();
                    if (len > 0) {
                        force.normalize();
                        const strength = (1 - dist / CONFIG.repulsionRadius) * CONFIG.repulsionStrength;
                        // Removed random noise to prevent jelly effect
                        group.velocity.addScaledVector(force, strength * 0.05);
                    }
                }

                const returnVec = new THREE.Vector3().subVectors(group.originalPos, group.currentPos);

                // Overdamped Spring (EaseOut)
                // Stronger pull, much stronger drag
                group.velocity.add(returnVec.clone().multiplyScalar(0.05));
                group.velocity.multiplyScalar(0.85); // High friction -> No overshoot

                group.currentPos.add(group.velocity);

                // Reset rotation
                group.rotation.slerp(new THREE.Quaternion(), 0.1);

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
                    const offset = new THREE.Vector3(
                        (Math.random() - 0.5) * displacementScale,
                        (Math.random() - 0.5) * displacementScale,
                        (Math.random() - 0.5) * displacementScale
                    );

                    group.glitchTarget.addVectors(group.originalPos, offset);

                    // Start rotation towards random orthogonal
                    const rotAxisIdx = Math.floor(Math.random() * 3);
                    const rotAxis = new THREE.Vector3(rotAxisIdx === 0 ? 1 : 0, rotAxisIdx === 1 ? 1 : 0, rotAxisIdx === 2 ? 1 : 0);
                    group.rotation.setFromAxisAngle(rotAxis, (Math.random() > 0.5 ? 1 : -1) * Math.PI / 2);

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
                    group.rotation.slerp(new THREE.Quaternion(), lerpFactor);
                }

            } else {
                // --- MODE 2: SCATTER & FREEZE ---

                // Interaction
                if (dist < 1.5 && mouseVelocity.length() > 2) {
                    // Smash!
                    group.isFlying = true;
                    // Impulse matches mouse direction + randomness
                    const impulse = mouseVelocity.clone().multiplyScalar(0.002);
                    impulse.x += (Math.random() - 0.5) * 0.02;
                    impulse.y += (Math.random() - 0.5) * 0.02;
                    impulse.z += (Math.random() - 0.5) * 0.05; // More Z chaos

                    group.velocity.add(impulse);

                    // Add Spin
                    const spinAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                    group.angularVelocity.add(spinAxis.multiplyScalar(mouseVelocity.length() * 0.002));

                    // Schedule Return (fly for 0.5s to 1.5s)
                    group.returnStartTime = time + 0.5 + Math.random();
                }

                // Physics
                if (group.isFlying) {
                    group.velocity.multiplyScalar(0.96); // Drag
                    group.angularVelocity.multiplyScalar(0.96); // Angular Drag
                    group.currentPos.add(group.velocity);

                    // Apply rotation
                    const deltaRot = new THREE.Quaternion().setFromAxisAngle(
                        group.angularVelocity.clone().normalize(),
                        group.angularVelocity.length()
                    );
                    group.rotation.multiply(deltaRot);

                    // Check if time to return
                    if (time > group.returnStartTime) {
                        group.isFlying = false;
                    }
                } else {
                    // Returning home logic

                    // Check delay (already handled by returnStartTime, so just return)
                    {
                        // Drift back slowly
                        const returnVec = new THREE.Vector3().subVectors(group.originalPos, group.currentPos);
                        const d = returnVec.length();

                        if (d > 0.01) {
                            // Ease out cubic or simple lerp
                            const speed = 0.02; // Very slow return
                            group.currentPos.add(returnVec.multiplyScalar(speed));

                            // Rotate back to identity
                            group.rotation.slerp(new THREE.Quaternion(), 0.05);
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
                // Convert old Euler tilt to Quat
                const euler = new THREE.Euler(rotX, rotY, rotZ);
                finalQuat = new THREE.Quaternion().setFromEuler(euler);
            } else {
                finalQuat = group.rotation;
            }

            // Update Single Fused Mesh Instance
            dummy.position.copy(group.currentPos);
            dummy.rotation.setFromQuaternion(finalQuat);
            dummy.scale.copy(group.baseScale);
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
            const dist = data.currentPos.distanceTo(target);

            if (CONFIG.animationMode === 'repulsion') {
                // --- INNER CUBE REPULSION ---
                if (dist < CONFIG.repulsionRadius) {
                    const force = new THREE.Vector3().subVectors(data.currentPos, target);
                    if (force.length() > 0) {
                        force.normalize();
                        const strength = (1 - dist / CONFIG.repulsionRadius) * CONFIG.repulsionStrength;
                        // No noise
                        data.velocity.addScaledVector(force, strength * 0.05);
                    }
                }
                const returnVec = new THREE.Vector3().subVectors(data.originalPos, data.currentPos);

                // Overdamped Return
                data.velocity.add(returnVec.clone().multiplyScalar(0.05));
                data.velocity.multiplyScalar(0.85);
                data.currentPos.add(data.velocity);

            } else if (CONFIG.animationMode === 'grid') {
                // Inner Cube Grid Mode (Mirroring Cubes)
                const speed = mouseVelocity.length();
                const dynamicRadius = 0.3 + Math.min(speed * 0.02, 1.0);
                const displacementScale = 0.05 + Math.min(speed * 0.01, 0.2);

                if (dist < dynamicRadius && speed > 2) {
                    data.gridState = 'DISPLACED';

                    const offset = new THREE.Vector3(
                        (Math.random() - 0.5) * displacementScale,
                        (Math.random() - 0.5) * displacementScale,
                        (Math.random() - 0.5) * displacementScale
                    );
                    data.glitchTarget.addVectors(data.originalPos, offset);

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
                    const impulse = mouseVelocity.clone().multiplyScalar(0.001);
                    impulse.x += (Math.random() - 0.5) * 0.01;
                    impulse.y += (Math.random() - 0.5) * 0.01;
                    impulse.z += (Math.random() - 0.5) * 0.02;

                    data.velocity.add(impulse);

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
                    const returnVec = new THREE.Vector3().subVectors(data.originalPos, data.currentPos);
                    const d = returnVec.length();
                    if (d > 0.01) {
                        data.currentPos.add(returnVec.multiplyScalar(0.02));
                    } else {
                        data.currentPos.copy(data.originalPos);
                    }
                }
            }

            dummy.position.copy(data.currentPos);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(1);
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

    if (crtPass) {
        crtPass.uniforms['time'].value = Date.now() * 0.001;
    }

    composer.render();
}

function onTouchStart(event) {
    lastInteractionTime = Date.now();
    if (isFreeCam) return;
    if (event.touches.length > 0) {
        if (event.target === renderer.domElement) {
            event.preventDefault();
        }

        isDragging = true;
        isCinematic = false; // Disable cinematic mode on touch
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
    if (isFreeCam) return;

    // Prevent default scrolling of the page
    event.preventDefault();

    // Disable cinematic mode to take control
    isCinematic = false;

    // Apply zoom
    targetCameraRadius += event.deltaY * CONFIG.zoomSensitivity;

    // Clamp
    targetCameraRadius = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, targetCameraRadius));
}
