import * as THREE from 'three';
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

const CRTShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'time': { value: 0 },
        'start_time': { value: 0 },
        'resolution': { value: new THREE.Vector2() },
        'curvature': { value: new THREE.Vector2(0.5, 0.40) }, // 1.0 = flat
        'lineWidth': { value: 0.1 } // Scanline width
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

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

// Configuration
const CONFIG = {
    text: isMobile ? "K" : "TOPKEK",
    textSize: isMobile ? 1.5 : 3, // Smaller text on mobile
    particleSize: 0.1,
    particleCount: 0, // Will be determined by sampler
    targetCubeCount: isMobile ? 15000 : 50000, // Reduced particle count for mobile
    repulsionRadius: 3, // Increased radius
    repulsionStrength: 4,
    returnSpeed: 0.2,
    sampleDensity: 1, // Points per unit area (increase for more dense voxels)
    letterSpacing: 0.5, // Extra spacing between letters
    animationMode: 'repulsion', // 'repulsion', 'scatter', or 'grid'
    gridCols: 10, // For grid calculation
    animationMode: 'repulsion', // 'repulsion', 'scatter', or 'grid'
    gridCols: 10, // For grid calculation
    gridSpacing: 2,
    shadowMapSize: isMobile ? 256 : 2048 // Reduced shadow map size for mobile
};

// State
let scene, camera, renderer, composer, crtPass;
let instancedMesh, sphereInstancedMesh;
let dummy = new THREE.Object3D();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2(-1000, -1000); // Start off-screen
let cubeGroups = []; // Stores rigid body groups
let sphereParticles = []; // Stores individual sphere particles
let debugMesh; // Visual debug cursor
let mouseVelocity = new THREE.Vector3();
let lastMousePos = new THREE.Vector2();
let lastMouseTime = 0;
let lastTarget = new THREE.Vector3();

// Camera Rotation State
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;
let cameraAngle = 0;
let targetCameraAngle = 0; // Target angle for smoothing
let cameraVerticalAngle = 0;
let targetCameraVerticalAngle = 0;
const MAX_ANGLE = Math.PI / 4; // 45 degrees

// DOM Elements
const container = document.getElementById('canvas-container');
const loading = document.getElementById('loading');

const clock = new THREE.Clock();

init();
animate();

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111); // Dark background
    // scene.fog = new THREE.Fog(0x111111, 10, 50); // Optional fog

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

    // Post-Processing
    const renderScene = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2;
    bloomPass.strength = 0.3; // Adjust for glow intensity
    bloomPass.radius = 1;

    const outputPass = new OutputPass();

    crtPass = new ShaderPass(CRTShader);
    crtPass.uniforms['resolution'].value.set(window.innerWidth, window.innerHeight);

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
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

    // 5. Load Font and Generate Text
    const loader = new FontLoader();
    loader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json', function (font) {
        generateParticles(font);
        loading.classList.add('hidden');
    });

    // 6. Events
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // Touch Events
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

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
    isDragging = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
}

function onMouseUp(event) {
    isDragging = false;
}

function generateParticles(font) {
    // 1. Create separate geometries for each letter to handle spacing
    const geometries = [];
    let xOffset = 0;
    const chars = CONFIG.text.split('');

    chars.forEach(char => {
        const charGeo = new TextGeometry(char, {
            font: font,
            size: CONFIG.textSize,
            height: 0.5, // Thickness
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
    const targetCubeCount = CONFIG.targetCubeCount;

    // Restore Bevel: size, size, size, segments, radius
    const boxGeo = new RoundedBoxGeometry(CONFIG.particleSize, CONFIG.particleSize, CONFIG.particleSize, 2, CONFIG.particleSize * 0.05);
    const boxMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5, // Increased roughness (was 0.1)
        metalness: 0.4,
        envMapIntensity: 0.02
    });

    instancedMesh = new THREE.InstancedMesh(boxGeo, boxMat, targetCubeCount);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    // --- SPHERES (Core) ---
    const sphereCount = 2000;
    const sphereGeo = new THREE.BoxGeometry(CONFIG.particleSize * 1, CONFIG.particleSize * 1, CONFIG.particleSize * 1); // Changed to Box, no bevel
    const sphereMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0,
        metalness: 0,
        emissiveIntensity: 0.01 // Glow!
    });

    sphereInstancedMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, sphereCount);
    sphereInstancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(sphereCount * 3), 3);

    const tempPosition = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();
    const color = new THREE.Color();

    cubeGroups = [];
    sphereParticles = [];

    // --- VOXEL COLLECTION FOR CUBES ---
    const voxelMap = new Map(); // Key: "x,y,z", Value: { gx, gy, gz, x, y, z, visited }

    // Saturation loop: keep trying until we fail to find new spots consistently
    let consecutiveFailures = 0;
    const maxFailures = 2000; // Stop if we can't find a new spot after this many tries

    // We loop safe max times, but rely on failures to break early
    for (let i = 0; i < targetCubeCount * 20; i++) {
        sampler.sample(tempPosition, tempNormal);

        // Helper to add voxel
        const tryAddVoxel = (pX, pY, pZ) => {
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
                    visited: false
                });
                return true;
            }
            return false;
        };

        let added = tryAddVoxel(tempPosition.x, tempPosition.y, tempPosition.z);

        // Wall Extrusion (Noise Pattern)
        // Check if normal is roughly horizontal (small Z component)
        if (Math.abs(tempNormal.z) < 0.5) {
            // Noise pattern based on grid coordinates
            const gx = Math.round(tempPosition.x / CONFIG.particleSize);
            const gy = Math.round(tempPosition.y / CONFIG.particleSize);

            // Simple deterministic noise (adjust freq for pattern scale)
            const noise = Math.sin(gx * 0.45) * Math.cos(gy * 0.45);

            if (noise > 0.1) { // Threshold
                // Extrude outward
                const extPos = tempPosition.clone().addScaledVector(tempNormal, CONFIG.particleSize);
                if (tryAddVoxel(extPos.x, extPos.y, extPos.z)) {
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

        if (consecutiveFailures > maxFailures) break; // We handled the surface
    }

    // --- GROUPING ALGORITHM ---
    const shapes = [
        { w: 2, h: 2, offsets: [[0, 0], [1, 0], [0, 1], [1, 1]] },
        { w: 3, h: 1, offsets: [[0, 0], [1, 0], [2, 0]] },
        { w: 1, h: 3, offsets: [[0, 0], [0, 1], [0, 2]] },
        { w: 2, h: 1, offsets: [[0, 0], [1, 0]] },
        { w: 1, h: 2, offsets: [[0, 0], [0, 1]] },
        { w: 1, h: 1, offsets: [[0, 0]] }
    ];

    let meshIndex = 0;
    const voxels = Array.from(voxelMap.values());

    // Shuffle voxels to avoid directional bias
    for (let i = voxels.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [voxels[i], voxels[j]] = [voxels[j], voxels[i]];
    }

    for (const startVoxel of voxels) {
        if (startVoxel.visited) continue;

        for (const shape of shapes) {
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
                // Determine Center
                const centroid = new THREE.Vector3();
                shapeVoxels.forEach(v => centroid.add(new THREE.Vector3(v.x, v.y, v.z)));
                centroid.divideScalar(shapeVoxels.length);

                // Initialize Group Object
                const group = {
                    originalPos: centroid.clone(),
                    currentPos: centroid.clone(),
                    // Physics State
                    velocity: new THREE.Vector3(0, 0, 0),
                    angularVelocity: new THREE.Vector3(0, 0, 0),
                    rotation: new THREE.Quaternion(),
                    isFlying: false,
                    returnStartTime: 0,
                    freezeTime: 0,
                    // Existing props
                    returnSpeed: CONFIG.returnSpeed * (0.5 + Math.random()),
                    returnDelay: Math.random() * 2.0 + 0.5, // Random delay between 0.5s and 2.5s
                    wobbleFreq: Math.random() * 0.1,
                    wobbleAmp: Math.random() * 0.05,
                    particles: [],
                    // Grid Mode State
                    // Grid Mode State
                    // No pre-calc needed for local glitch
                    gridState: 'IDLE',
                    returnQueue: [],
                    currentStepIndex: 0,
                    stepStartTime: 0,
                    glitchTarget: new THREE.Vector3(), // Target for fly-out
                };
                // Add Particles

                // Add Particles
                shapeVoxels.forEach(v => {
                    v.visited = true;

                    const pos = new THREE.Vector3(v.x, v.y, v.z);
                    const localOffset = new THREE.Vector3().subVectors(pos, centroid);

                    dummy.position.copy(pos);
                    dummy.scale.setScalar(1);
                    dummy.rotation.set(0, 0, 0);
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(meshIndex, dummy.matrix);

                    group.particles.push({
                        meshIndex: meshIndex,
                        localOffset: localOffset
                    });
                    meshIndex++;
                });

                cubeGroups.push(group);
                break; // Move to next unvisited voxel
            }
        }
    }

    CONFIG.cubeCount = meshIndex;
    instancedMesh.count = meshIndex;

    // GENERATE SPHERES (Inside)
    let sIdx = 0;
    for (let i = 0; i < sphereCount; i++) {
        sampler.sample(tempPosition, tempNormal);

        // Push particles inward from "skin" to "core"
        // This moves them away from the outer edges (X/Y)
        const innerOffset = 0.3;
        tempPosition.addScaledVector(tempNormal, -innerOffset);

        // Randomize Z distribution to fill the volume
        // Text height is 0.5, so [-0.25, 0.25] is the core.
        // User increased range to 1.2
        tempPosition.z = (Math.random() - 0.5) * 1.2;

        dummy.position.copy(tempPosition);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        sphereInstancedMesh.setMatrixAt(sIdx, dummy.matrix);

        // Rainbow Color based on X
        const hue = (tempPosition.x - minX) / textWidth;
        color.setHSL(hue, 1.0, 0.5);
        sphereInstancedMesh.setColorAt(sIdx, color);

        sphereParticles.push({
            meshIndex: sIdx, // Index within sphereInstancedMesh
            originalPos: tempPosition.clone(),
            currentPos: tempPosition.clone(),
            // Physics State
            velocity: new THREE.Vector3(0, 0, 0),
            angularVelocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Quaternion(),
            isFlying: false,
            returnStartTime: 0,
            freezeTime: 0,
            // Existing
            returnSpeed: CONFIG.returnSpeed * (0.5 + Math.random()),
            wobbleFreq: Math.random() * 0.1,
            wobbleAmp: Math.random() * 0.05,

            // Grid Mode State
            gridState: 'IDLE',
            returnQueue: [],
            currentStepIndex: 0,
            stepStartTime: 0,
            glitchTarget: new THREE.Vector3(),
        });

        sIdx++;
    }

    sphereInstancedMesh.count = sIdx;

    instancedMesh.instanceMatrix.needsUpdate = true;
    sphereInstancedMesh.instanceMatrix.needsUpdate = true;
    if (sphereInstancedMesh.instanceColor) sphereInstancedMesh.instanceColor.needsUpdate = true;

    scene.add(instancedMesh);
    scene.add(sphereInstancedMesh);
}

function onMouseMove(event) {
    // Normalize mouse coordinates (Always update)
    if (renderer) { // Safety check if called early
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // Handle Camera Rotation
    if (isDragging) {
        const deltaX = event.clientX - previousMouseX;
        const deltaY = event.clientY - previousMouseY;

        previousMouseX = event.clientX;
        previousMouseY = event.clientY;

        // Sensitivity
        targetCameraAngle -= deltaX * 0.005;
        targetCameraVerticalAngle -= deltaY * 0.005;

        // Clamp angles
        targetCameraAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, targetCameraAngle));
        targetCameraVerticalAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, targetCameraVerticalAngle));
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

    // Smooth Camera Rotation
    cameraAngle += (targetCameraAngle - cameraAngle) * 0.1;
    cameraVerticalAngle += (targetCameraVerticalAngle - cameraVerticalAngle) * 0.1;

    const radius = 15;
    const horizontalRadius = radius * Math.cos(cameraVerticalAngle);

    camera.position.x = Math.sin(cameraAngle) * horizontalRadius;
    camera.position.z = Math.cos(cameraAngle) * horizontalRadius;
    camera.position.y = Math.sin(cameraVerticalAngle) * radius;

    camera.lookAt(0, 0, 0);

    if (instancedMesh) {
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

            const dummyPos = new THREE.Vector3();
            // Scaling? Standard (1,1,1)
            const dummyScale = new THREE.Vector3(1, 1, 1);

            for (const p of group.particles) {
                // Apply rotation to local offset
                const rotatedOffset = p.localOffset.clone().applyQuaternion(finalQuat);
                dummyPos.addVectors(group.currentPos, rotatedOffset);

                dummy.position.copy(dummyPos);
                dummy.rotation.setFromQuaternion(finalQuat);
                dummy.scale.copy(dummyScale);

                dummy.updateMatrix();

                instancedMesh.setMatrixAt(p.meshIndex, dummy.matrix);
            }
        }

        // --- SPHERE PARTICLES LOGIC ---
        for (let i = 0; i < sphereParticles.length; i++) {
            const data = sphereParticles[i];
            const dist = data.currentPos.distanceTo(target);

            if (CONFIG.animationMode === 'repulsion') {
                // --- SPHERE REPULSION ---
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
                // Sphere Grid Mode (Mirroring Cubes)
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
                        // Spheres don't visually rotate much, but let's do it for consistency

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
                // --- SPHERE SCATTER ---
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
            sphereInstancedMesh.setMatrixAt(data.meshIndex, dummy.matrix);
        }

        if (instancedMesh) instancedMesh.instanceMatrix.needsUpdate = true;
        if (sphereInstancedMesh) {
            sphereInstancedMesh.instanceMatrix.needsUpdate = true;
        }
    }

    if (crtPass) {
        crtPass.uniforms['time'].value = Date.now() * 0.001;
    }

    composer.render();
}

function onTouchStart(event) {
    if (event.touches.length > 0) {
        if (event.target === renderer.domElement) {
            event.preventDefault();
        }

        isDragging = true;
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

        if (isDragging) {
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
