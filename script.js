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
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

// Configuration
const CONFIG = {
    text: "TOPKEK",
    particleSize: 0.1,
    particleCount: 0, // Will be determined by sampler
    repulsionRadius: 3, // Increased radius
    repulsionStrength: 4,
    returnSpeed: 0.2,
    sampleDensity: 2, // Points per unit area (increase for more dense voxels)
    letterSpacing: 0.5, // Extra spacing between letters
    animationMode: 'repulsion' // 'repulsion' or 'scatter'
};

// State
let scene, camera, renderer, composer;
let instancedMesh, sphereInstancedMesh;
let crtPass;
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
    bloomPass.strength = 0.7; // Adjust for glow intensity
    bloomPass.radius = 1;

    const outputPass = new OutputPass();

    crtPass = new FilmPass(0.35, 0.025, 648, false);

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(crtPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    // 4. Lighting & Environment (HDRI)
    new RGBELoader()
        .load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr', function (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            // scene.background = texture; // Uncomment to see the HDR background
            scene.environment = texture;

            // Generate particles only after basic setup is safe, but we can do it parallel
        });

    // Keep a subtle Directional Light for sharp shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Debug Cursor
    const debugGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const debugMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
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

    createUI();
}

function createUI() {
    const ui = document.createElement('div');
    ui.id = 'ui-container';

    const btn1 = document.createElement('button');
    btn1.className = 'mode-btn active';
    btn1.innerText = 'Repulsion';
    btn1.onclick = () => setMode('repulsion', btn1, btn2);

    const btn2 = document.createElement('button');
    btn2.className = 'mode-btn';
    btn2.innerText = 'Scatter';
    btn2.onclick = () => setMode('scatter', btn2, btn1);

    ui.appendChild(btn1);
    ui.appendChild(btn2);
    document.body.appendChild(ui);
}

function setMode(mode, activeBtn, inactiveBtn) {
    CONFIG.animationMode = mode;
    activeBtn.classList.add('active');
    inactiveBtn.classList.remove('active');
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
    try {
        console.log("Starting generateParticles...");
        // 1. Create separate geometries for each letter to handle spacing
        const geometries = [];
        let xOffset = 0;
        const chars = CONFIG.text.split('');

        chars.forEach(char => {
            const charGeo = new TextGeometry(char, {
                font: font,
                size: 3,
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
        const targetCubeCount = 50000;

        // Restore Bevel: size, size, size, segments, radius
        const boxGeo = new RoundedBoxGeometry(CONFIG.particleSize, CONFIG.particleSize, CONFIG.particleSize, 2, CONFIG.particleSize * 0.05);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1, // Increased roughness (was 0.1)
            metalness: 0.9,
            envMapIntensity: 0.02
        });

        instancedMesh = new THREE.InstancedMesh(boxGeo, boxMat, targetCubeCount);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        // --- SPHERES (Core) ---
        const sphereCount = 15000;
        const sphereGeo = new THREE.SphereGeometry(CONFIG.particleSize * 0.8, 8, 8); // Significantly smaller to hide better
        const sphereMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1,
            metalness: 0.5,
            emissiveIntensity: 0.2 // Glow!
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
                        freezeTime: 0,
                        // Existing props
                        returnSpeed: CONFIG.returnSpeed * (0.5 + Math.random()),
                        returnDelay: Math.random() * 2.0 + 0.5, // Random delay between 0.5s and 2.5s
                        wobbleFreq: Math.random() * 0.1,
                        wobbleAmp: Math.random() * 0.05,
                        particles: []
                    };

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

            // Move inside!
            // Instead of pushing along normal, we just randomize Z to fill the volume
            // preserving the X/Y shape found by the sampler.
            tempPosition.z = (Math.random() - 0.5) * 0.5; // Range [-0.25, 0.25]

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
                freezeTime: 0,
                // Existing
                returnSpeed: CONFIG.returnSpeed * (0.5 + Math.random()),
                wobbleFreq: Math.random() * 0.1,
                wobbleAmp: Math.random() * 0.05
            });
            sIdx++;
        }

        sphereInstancedMesh.count = sIdx;

        instancedMesh.instanceMatrix.needsUpdate = true;
        sphereInstancedMesh.instanceMatrix.needsUpdate = true;
        if (sphereInstancedMesh.instanceColor) sphereInstancedMesh.instanceColor.needsUpdate = true;

        scene.add(instancedMesh);
        scene.add(sphereInstancedMesh);
        console.log(`Generation complete. Cubes: ${meshIndex}, Spheres: ${sIdx}`);

    } catch (e) {
        console.error(e);
        alert("Error generating particles: " + e.message);
    }
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
                        force.x += (Math.random() - 0.5) * 0.5;
                        force.y += (Math.random() - 0.5) * 0.5;
                        force.z += (Math.random() - 0.5) * 0.5;
                        group.velocity.addScaledVector(force, strength * 0.05);
                    }
                }

                const returnVec = new THREE.Vector3().subVectors(group.originalPos, group.currentPos);
                const distToOriginal = returnVec.length();

                group.velocity.add(returnVec.clone().multiplyScalar(group.returnSpeed));

                if (distToOriginal > 0.01) {
                    const dir = returnVec.clone().normalize();
                    group.velocity.add(dir.multiplyScalar(0.002));
                }

                if (distToOriginal > 0.2) {
                    const wobble = new THREE.Vector3(
                        Math.sin(time + group.originalPos.y) * group.wobbleAmp,
                        Math.cos(time + group.originalPos.x) * group.wobbleAmp,
                        Math.sin(time + group.originalPos.z) * group.wobbleAmp
                    );
                    wobble.multiplyScalar(Math.min(distToOriginal, 1.0));
                    group.velocity.add(wobble);
                }

                group.velocity.multiplyScalar(0.92);
                group.currentPos.add(group.velocity);

                // Reset rotation
                group.rotation.slerp(new THREE.Quaternion(), 0.1);

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

                    // Check if stopped
                    if (group.velocity.length() < 0.01 && group.angularVelocity.length() < 0.01) {
                        group.isFlying = false;
                        group.freezeTime = time; // Mark time
                    }
                } else {
                    // Returning home logic

                    // Check delay
                    if (time - group.freezeTime < group.returnDelay) {
                        // Still frozen, do nothing
                    } else {
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
            const rotX = group.velocity.y * 0.5;
            const rotY = group.velocity.x * 0.5;
            const rotZ = group.velocity.z * 0.5;

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

        // --- SPHERE PARTICLES LOGIC (Simplified for now) ---
        for (let i = 0; i < sphereParticles.length; i++) {
            const data = sphereParticles[i];
            const dist = data.currentPos.distanceTo(target);

            // Just keep original simple loop for spheres regardless of mode for now, or match mode
            // For simplicity, let's keep them responding to repulsion to keep the "Core" alive
            if (dist < CONFIG.repulsionRadius) {
                const force = new THREE.Vector3().subVectors(data.currentPos, target);
                if (force.length() > 0) {
                    force.normalize();
                    const strength = (1 - dist / CONFIG.repulsionRadius) * CONFIG.repulsionStrength;
                    force.x += (Math.random() - 0.5) * 0.5;
                    force.y += (Math.random() - 0.5) * 0.5;
                    force.z += (Math.random() - 0.5) * 0.5;
                    data.velocity.addScaledVector(force, strength * 0.05);
                }
            }
            const returnVec = new THREE.Vector3().subVectors(data.originalPos, data.currentPos);
            data.velocity.add(returnVec.clone().multiplyScalar(data.returnSpeed));
            data.velocity.multiplyScalar(0.92);
            data.currentPos.add(data.velocity);

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

    composer.render();
}
