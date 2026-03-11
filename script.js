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
import { IS_MOBILE as isMobile, CONFIG, SHADER_CONFIG, MATERIALS, SHAPE_DEFINITIONS, CINEMATIC_CONFIG as cinematicConfig, LOADER_CONFIG, VAJBUJ_CONFIG, PORTFOLIO_CONFIG } from './config.js';

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

// Portfolio (video thumbnails below PRODUCTIONS)
let portfolioState = {
    frameCubes: [],
    frameMesh: null,
    planeMeshes: [],
    items: [],
    hoveredIndex: -1,
    group: null
};

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

// Cinematic Camera State (Shots imported)
let cinematicDollySpeed = 0; // Speed of radius change
let currentShotSpeedMult = 0.2; // Speed of orbit

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

function init() {
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
            initPortfolio();

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

const clock = new THREE.Clock();

init();
animate();

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

    // Camera Mode Toggle
    const btnCinematic = document.createElement('button');
    btnCinematic.className = 'mode-btn';
    btnCinematic.innerText = 'Dynamic Cam';
    btnCinematic.onclick = () => {
        if (!isCinematic) {
            setCameraMode('dynamic');
            btnCinematic.classList.add('active');
        } else {
            setCameraMode('manual');
            btnCinematic.classList.remove('active');
        }
    };
    ui.appendChild(btnCinematic);

    // Custom Text Button
    const btnCustomText = document.createElement('button');
    btnCustomText.className = 'mode-btn';
    btnCustomText.innerText = 'Change Text';
    btnCustomText.onclick = () => {
        document.getElementById('custom-text-modal').classList.remove('hidden');
    };
    ui.appendChild(btnCustomText);

    // Store reference for status update
    window.cinematicButton = btnCinematic;

    // VAJBUJ Button
    if (VAJBUJ_CONFIG.enabled) {
        const btnVajbuj = document.createElement('button');
        btnVajbuj.className = 'mode-btn vajbuj-btn';
        btnVajbuj.innerText = '🎵 VAJBUJ';
        btnVajbuj.onclick = () => {
            if (!vajbujState.active) {
                startVajbujMode();
                btnVajbuj.classList.add('active');
            } else {
                stopVajbujMode();
            }
        };
        ui.appendChild(btnVajbuj);

        // Store reference for deactivation
        window.vajbujButton = btnVajbuj;
    }

    document.body.appendChild(ui);

    // --- NEW UI ELEMENTS ---

    // 1. Production Label (Left)
    const label = document.createElement('div');
    label.className = 'prod-label';
    label.innerHTML = 'TOP KEK Productions &reg; - Handcrafted Games';
    document.body.appendChild(label);

    // 2. Terminal Menu Logic
    const termAppstain = document.getElementById('term-appstain');
    const termGlitch = document.getElementById('term-glitch');
    const termGenimg = document.getElementById('term-genimg');
    const termPortfolio = document.getElementById('term-portfolio');

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
        const closeBtn = document.getElementById('glitch-close');
        const langPl = document.getElementById('lang-pl');
        const langEng = document.getElementById('lang-eng');

        closeBtn.onclick = () => {
            modal.classList.add('hidden');
        };

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

    // 5. Custom Text Modal Logic
    const initCustomTextModal = () => {
        const modal = document.getElementById('custom-text-modal');
        const closeBtn = document.getElementById('custom-text-close');
        const submitBtn = document.getElementById('custom-text-submit');
        const input = document.getElementById('custom-text-input');

        const close = () => {
            modal.classList.add('hidden');
            input.value = '';
        };

        const submit = () => {
            const text = input.value.trim().toUpperCase();
            if (text.length > 0) {
                updateText(text);
                close();
            }
        };

        closeBtn.onclick = close;
        submitBtn.onclick = submit;

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submit();
            }
        });
    };
    initCustomTextModal();

    // 6. Portfolio Vimeo Modal Logic
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
    } else if (mode === 'dynamic') {
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

    // Sync UI Button
    if (window.cinematicButton) {
        if (isCinematic) window.cinematicButton.classList.add('active');
        else window.cinematicButton.classList.remove('active');
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
    resetVajbujActivityTimer();
    if (isFreeCam) return;

    // Left click on portfolio thumbnail -> open Vimeo modal, do not rotate
    if (event.button === 0 && portfolioState.hoveredIndex >= 0 && portfolioState.items[portfolioState.hoveredIndex]) {
        openPortfolioModal(portfolioState.items[portfolioState.hoveredIndex].vimeoUrl);
        return;
    }

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
    initMeshes(groupCounts);

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

function initPortfolio() {
    if (!PORTFOLIO_CONFIG || !PORTFOLIO_CONFIG.items || PORTFOLIO_CONFIG.items.length === 0) return;
    const cfg = PORTFOLIO_CONFIG;
    const items = cfg.items;
    const cubeSize = cfg.cubeSize;
    const slotW = cfg.slotWidth;
    const slotH = cfg.slotHeight;
    const thickness = cfg.frameThickness;
    const nX = Math.ceil(slotW / cubeSize);
    const nY = Math.ceil(slotH / cubeSize);
    const borderCount = 2 * nX + 2 * (nY - 2);
    const cubesPerSlot = borderCount * thickness;
    const totalCubes = items.length * cubesPerSlot;
    if (totalCubes <= 0) return;

    const group = new THREE.Group();
    portfolioState.group = group;

    if (!defaultBoxMaterial) defaultBoxMaterial = new THREE.MeshStandardMaterial(MATERIALS.defaultBox);
    const boxGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const frameMesh = new THREE.InstancedMesh(boxGeo, defaultBoxMaterial, totalCubes);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    portfolioState.frameMesh = frameMesh;
    group.add(frameMesh);

    const frameCubes = [];
    let cubeIndex = 0;
    const borderSet = new Set();
    for (let gx = 0; gx < nX; gx++) {
        borderSet.add(`${gx},0`);
        borderSet.add(`${gx},${nY - 1}`);
    }
    for (let gy = 0; gy < nY; gy++) {
        borderSet.add(`0,${gy}`);
        borderSet.add(`${nX - 1},${gy}`);
    }

    const cols = 3;
    for (let i = 0; i < items.length; i++) {
        const rowIndex = Math.floor(i / cols);
        const colIndex = i % cols;
        const centerX = (colIndex - (cols - 1) / 2) * cfg.slotSpacing;
        const centerY = cfg.offsetYTop - rowIndex * cfg.rowSpacing;

        for (const key of borderSet) {
            const [gx, gy] = key.split(',').map(Number);
            const px = centerX + (gx - (nX - 1) / 2) * cubeSize;
            const py = centerY + (gy - (nY - 1) / 2) * cubeSize;
            for (let zLayer = 0; zLayer < thickness; zLayer++) {
                const pz = -zLayer * cubeSize;
                const pos = new THREE.Vector3(px, py, pz);
                frameCubes.push({
                    originalPos: pos.clone(),
                    currentPos: pos.clone(),
                    velocity: new THREE.Vector3(0, 0, 0),
                    meshIndex: cubeIndex
                });
                dummy.position.copy(pos);
                dummy.rotation.set(0, 0, 0);
                dummy.scale.setScalar(1);
                dummy.updateMatrix();
                frameMesh.setMatrixAt(cubeIndex, dummy.matrix);
                cubeIndex++;
            }
        }

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
        const planeW = slotW * 0.92;
        const planeH = slotH * 0.92;
        const planeGeo = new THREE.PlaneGeometry(planeW, planeH);
        const planeMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const planeMesh = new THREE.Mesh(planeGeo, planeMat);
        planeMesh.position.set(centerX, centerY, cfg.planeZOffset);
        planeMesh.userData.portfolioIndex = i;
        group.add(planeMesh);
        portfolioState.planeMeshes.push(planeMesh);
        portfolioState.items.push({ vimeoUrl: item.vimeoUrl, video, texture, mesh: planeMesh });
    }

    portfolioState.frameCubes = frameCubes;
    frameMesh.instanceMatrix.needsUpdate = true;
    scene.add(group);
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
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    if (crtPass) crtPass.uniforms['resolution'].value.set(window.innerWidth, window.innerHeight);
}



function animate() {
    requestAnimationFrame(animate);

    if (isFreeCam && controls) {
        controls.update();

        // Auto-switch back to dynamic if idle - DISABLED
        /*
        if (Date.now() - lastInteractionTime > cinematicConfig.autoDynamicTimeout) {
            setCameraMode('dynamic');
        }
        */
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
            const dist = group.currentPos.distanceTo(target);

            if (CONFIG.animationMode === 'repulsion') {
                // --- MODE 1: REPULSION (Original) ---
                // --- DYNAMIC HOME POSITION FOR VAJBUJ MODE ---
                let targetHome = group.originalPos.clone();
                if (vajbujBounceActive) {
                    // Quantized Alternating: Odd blocks UP, Even blocks DOWN
                    // Period approx 3.5 units (covering letter + spacing)
                    // T(-3) -> Odd, O(-2) -> Even, P(-1) -> Odd, K(0) -> Even...
                    const bucket = Math.floor(group.originalPos.x / 3.5);
                    const isOdd = Math.abs(bucket) % 2 === 1;
                    const alternate = isOdd ? 1 : -1;

                    targetHome.y += vajbujBounceAmplitude * alternate;
                }

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

                const returnVec = new THREE.Vector3().subVectors(targetHome, group.currentPos);

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

                // --- DYNAMIC HOME POSITION FOR VAJBUJ MODE ---
                let targetHome = data.originalPos.clone();
                if (vajbujBounceActive) {
                    const bucket = Math.floor(data.originalPos.x / 3.5);
                    const isOdd = Math.abs(bucket) % 2 === 1;
                    const alternate = isOdd ? 1 : -1;

                    targetHome.y += vajbujBounceAmplitude * alternate;
                }

                if (dist < CONFIG.repulsionRadius) {
                    const force = new THREE.Vector3().subVectors(data.currentPos, target);
                    if (force.length() > 0) {
                        force.normalize();
                        const strength = (1 - dist / CONFIG.repulsionRadius) * CONFIG.repulsionStrength;
                        // No noise
                        data.velocity.addScaledVector(force, strength * 0.05);
                    }
                }
                const returnVec = new THREE.Vector3().subVectors(targetHome, data.currentPos);

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

    // --- Portfolio: frame repulsion, hover (play/pause video), update matrices ---
    if (portfolioState.frameMesh && portfolioState.frameCubes.length > 0) {
        const portfolioTarget = new THREE.Vector3(1000, 1000, 1000);
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), portfolioTarget);
        const forceScale = PORTFOLIO_CONFIG.forceScale ?? 0.25;
        for (let i = 0; i < portfolioState.frameCubes.length; i++) {
            const data = portfolioState.frameCubes[i];
            const dist = data.currentPos.distanceTo(portfolioTarget);

            if (CONFIG.animationMode === 'repulsion' && dist < CONFIG.repulsionRadius) {
                const force = new THREE.Vector3().subVectors(data.currentPos, portfolioTarget);
                if (force.length() > 0) {
                    force.normalize();
                    const strength = (1 - dist / CONFIG.repulsionRadius) * CONFIG.repulsionStrength;
                    data.velocity.addScaledVector(force, strength * 0.05 * forceScale);
                }
            }

            const returnVec = new THREE.Vector3().subVectors(data.originalPos, data.currentPos);
            data.velocity.add(returnVec.clone().multiplyScalar(0.05));
            data.velocity.multiplyScalar(0.85);
            data.currentPos.add(data.velocity);
            dummy.position.copy(data.currentPos);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            portfolioState.frameMesh.setMatrixAt(data.meshIndex, dummy.matrix);
        }
        portfolioState.frameMesh.instanceMatrix.needsUpdate = true;
    }
    if (portfolioState.planeMeshes.length > 0) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(portfolioState.planeMeshes);
        portfolioState.hoveredIndex = hits.length > 0 && hits[0].object.userData.portfolioIndex !== undefined
            ? hits[0].object.userData.portfolioIndex
            : -1;
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

    if (crtPass) {
        crtPass.uniforms['time'].value = Date.now() * 0.001;
    }

    composer.render();

    // Update Vajbuj mode
    updateVajbujMode(clock.getDelta());

    // Process Background Generation Queue (Fluid Loading)
    if (vajbujState.generationQueue.length > 0) {
        const queueStart = performance.now();
        const maxFrameTime = 4; // Max ms per frame for background tasks

        while (vajbujState.generationQueue.length > 0 && performance.now() - queueStart < maxFrameTime) {
            const task = vajbujState.generationQueue[0];
            const done = task(); // Execute chunk
            if (done) {
                vajbujState.generationQueue.shift();
            }
        }
    }
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

    // Check if Glitch Lab modal is open
    const glitchModal = document.getElementById('glitch-modal');
    if (glitchModal && !glitchModal.classList.contains('hidden')) {
        // Allow default scrolling for the modal
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

    // Create background cubes for Vajbuj
    createVajbujBackgroundCubes();

    console.log('[VAJBUJ] Mode initialized, waiting for inactivity...');

    // Start background generation of lyrics voxels
    if (loadedFontRegular) {
        startBackgroundGeneration(loadedFontRegular);
    }
}

function startBackgroundGeneration(font) {
    const uniqueWords = new Set();
    VAJBUJ_CONFIG.lyrics.forEach(item => {
        if (!item.lineBreak) {
            const word = item.text;
            const scale = item.scale || 1.0;
            uniqueWords.add(`${word}_${scale}`);
        }
    });

    console.log(`[VAJBUJ] Queuing ${uniqueWords.size} unique words for background generation...`);

    uniqueWords.forEach(key => {
        const [word, scaleStr] = key.split('_');
        const scale = parseFloat(scaleStr);

        // Task Factory
        const task = createVoxelGenerationTask(word, scale, font);
        vajbujState.generationQueue.push(task);
    });
}

function createVoxelGenerationTask(word, scale, font) {
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
            if (vajbujState.voxelCache[cacheKey]) return true; // Already done

            // Replacement map for Polish characters
            const polishMap = {
                'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
                'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
                '.': '', ',': '', '!': '', '?': ''
            };
            const displayWord = word.split('').map(char => polishMap[char] || char).join('');

            textGeo = new TextGeometry(displayWord, {
                font: font,
                size: VAJBUJ_CONFIG.wordSize * scale,
                height: VAJBUJ_CONFIG.wordHeight * scale,
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
                        for (let z = 0; z < VAJBUJ_CONFIG.wordThickness; z++) {
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

            vajbujState.voxelCache[`${word}_${scale}`] = {
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

function createVajbujBackgroundCubes() {
    const count = VAJBUJ_CONFIG.bgCubeCount;
    const size = VAJBUJ_CONFIG.bgCubeSize;

    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: VAJBUJ_CONFIG.bgCubeMaterial.metalness,
        roughness: VAJBUJ_CONFIG.bgCubeMaterial.roughness,
        transparent: true,
        opacity: 1
    });

    vajbujState.bgCubesMesh = new THREE.InstancedMesh(geometry, material, count);
    vajbujState.bgCubesMesh.visible = false;

    const colors = VAJBUJ_CONFIG.bgCubeColors;
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
        // Random position around the text
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
        vajbujState.bgCubesMesh.setMatrixAt(i, dummy.matrix);

        // Random color from palette
        color.setHex(colors[Math.floor(Math.random() * colors.length)]);
        vajbujState.bgCubesMesh.setColorAt(i, color);

        // Store cube data
        vajbujState.bgCubes.push({
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

    vajbujState.bgCubesMesh.instanceMatrix.needsUpdate = true;
    if (vajbujState.bgCubesMesh.instanceColor) {
        vajbujState.bgCubesMesh.instanceColor.needsUpdate = true;
    }

    scene.add(vajbujState.bgCubesMesh);
}

function startVajbujMode() {
    if (vajbujState.active) return;

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

function prepareVajbujWords() {
    vajbujState.words = [];

    const allWords = [];
    let currentLineIdx = 0;
    let wordInLineIdx = 0;

    VAJBUJ_CONFIG.lyrics.forEach((item) => {
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
    const fragmentDuration = VAJBUJ_CONFIG.audioEndTime - VAJBUJ_CONFIG.audioStartTime;
    const fps = 25;

    // Calculate timing and PRE-CALCULATE widths for centering
    allWords.forEach((wordData, globalIdx) => {
        // Measure word immediately to fix X alignment
        if (loadedFontRegular) {
            const textGeo = new TextGeometry(wordData.text, {
                font: loadedFontRegular,
                size: VAJBUJ_CONFIG.wordSize * (wordData.scale || 1.0),
                height: VAJBUJ_CONFIG.wordHeight * (wordData.scale || 1.0),
                curveSegments: 4,
                bevelEnabled: false
            });
            textGeo.computeBoundingBox();
            wordData.width = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
            textGeo.dispose();
        }

        let targetFrame;
        if (VAJBUJ_CONFIG.wordTimings.length >= totalWords) {
            targetFrame = VAJBUJ_CONFIG.wordTimings[globalIdx];
        } else {
            // Distribution across the whole fragment
            const lineCountCalc = totalLines > 1 ? totalLines - 1 : 1;
            const lineStartNormalized = wordData.lineIndex / lineCountCalc;
            // Distribute lines over first 80% of duration
            const lineStartFrame = lineStartNormalized * (fragmentDuration * 0.8) * fps;

            const wordStagger = 12;
            targetFrame = Math.round(lineStartFrame + (wordData.wordIndex * wordStagger));
        }

        // Apply global delay of 18 frames as requested (previously 25)
        targetFrame += 18;

        // Convert frame to seconds from fragment start + delay
        const assembledAtSeconds = (targetFrame / fps) + (VAJBUJ_CONFIG.lyricsStartDelay || 0);
        // Word should START assembling earlier
        const startSeconds = Math.max(0, assembledAtSeconds - VAJBUJ_CONFIG.wordAssemblyDuration);

        vajbujState.words.push({
            ...wordData,
            startTime: startSeconds,
            assembledTime: assembledAtSeconds,
            state: 'waiting', // waiting, assembling, assembled
            mesh: null,
            cubes: [], // Individual cube positions for scatter effect
            progress: 0
        });
    });

    console.log(`[VAJBUJ] Prepared ${vajbujState.words.length} words in ${totalLines} lines.`);
}

function createVoxelWord(wordData, font) {
    const word = wordData.text;
    // Replacement map for Polish characters missing in standard Three.js fonts (helvetiker)
    const polishMap = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
        '.': '', ',': '', '!': '', '?': '' // Remove punctuation from 3D geometry to prevent voxel clutter
    };

    // Clean word for 3D generation (fallback to ASCII-ish and remove punctuation)
    const displayWord = word.split('').map(char => polishMap[char] || char).join('');

    // Scale support
    const wordScale = wordData.scale || 1.0;
    const voxelSize = CONFIG.particleSize;

    // Check Cache
    const cacheKey = `${word}_${wordScale}`;
    let cubePositions = [];
    let width = 0;

    if (vajbujState.voxelCache && vajbujState.voxelCache[cacheKey]) {
        cubePositions = vajbujState.voxelCache[cacheKey].positions;
        width = vajbujState.voxelCache[cacheKey].width;
    } else {
        // Create text geometry (Fallback)
        const textGeo = new TextGeometry(displayWord, {
            font: font,
            size: VAJBUJ_CONFIG.wordSize * wordScale,
            height: VAJBUJ_CONFIG.wordHeight * wordScale,
            curveSegments: 4,
            bevelEnabled: false
        });

        textGeo.computeBoundingBox();
        width = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;

        // Sample points on the text surface
        const mesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial());

        const voxelMap = new Map();

        // Grid scan for deterministic voxelization
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
                    for (let z = 0; z < VAJBUJ_CONFIG.wordThickness; z++) {
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

        // Cache this result for next time
        if (!vajbujState.voxelCache) vajbujState.voxelCache = {};
        vajbujState.voxelCache[cacheKey] = {
            positions: cubePositions,
            width: width
        };

        textGeo.dispose();
    }

    // Create instanced mesh for word
    const cubeGeo = new THREE.BoxGeometry(voxelSize * 0.95, voxelSize * 0.95, voxelSize * 0.95);
    const wordColor = wordData.color || VAJBUJ_CONFIG.defaultWordColor || 0xffffff;
    // Force white material for the black-to-white transition effect
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

    // Initialize particles to dark color (almost black)
    const initColor = new THREE.Color(0x050505);
    for (let i = 0; i < cubePositions.length; i++) {
        instancedMesh.setColorAt(i, initColor);
    }

    // Store cube data with scatter positions
    const cubes = cubePositions.map((pos, i) => {
        // Random scatter position
        const scatterPos = new THREE.Vector3(
            pos.x + (Math.random() - 0.5) * VAJBUJ_CONFIG.scatterRadius * 2,
            pos.y + (Math.random() - 0.5) * VAJBUJ_CONFIG.scatterRadius * 2 - 5, // Start below
            pos.z + (Math.random() - 0.5) * VAJBUJ_CONFIG.scatterRadius
        );

        // Distribution: More particles appear at the start (lower delay), fewer at the end (higher delay)
        // Power curve: x^3 pushes values towards 0 so more particles have small delay
        const delay = Math.pow(Math.random(), 3) * 0.7; // Max 70% delay

        return {
            targetPos: pos.clone(),
            scatterPos: scatterPos,
            currentPos: scatterPos.clone(),
            currentScale: 0,
            delay: delay,
            delay: delay,
            shouldOvershoot: Math.random() < 0.3, // 30% chance for overshoot
            overshootMagnitude: 0.3 + Math.random() * 0.4 // Random magnitude ~0.5 (was 1.5, so 3x smaller)
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

function updateVajbujMode(delta) {
    if (!vajbujState.active) {
        // Check for inactivity to trigger Vajbuj (only if autoTrigger enabled)
        if (VAJBUJ_CONFIG.enabled && VAJBUJ_CONFIG.autoTrigger &&
            Date.now() - vajbujState.lastActivityTime > VAJBUJ_CONFIG.inactivityTimeout) {
            startVajbujMode();
        }
        return;
    }

    const tempColor = new THREE.Color();
    const targetWhite = new THREE.Color(0xffffff);
    const startDark = new THREE.Color(0x050505);

    const elapsed = (Date.now() - vajbujState.startTime) / 1000;
    const fragmentDuration = VAJBUJ_CONFIG.audioEndTime - VAJBUJ_CONFIG.audioStartTime;
    const progressNormalized = elapsed / fragmentDuration;

    // Tempo multiplier (slow phase vs fast phase)
    let tempoMultiplier = 1.0;
    if (progressNormalized < VAJBUJ_CONFIG.slowPhaseEnd) {
        tempoMultiplier = VAJBUJ_CONFIG.slowPhaseSpeed;
    }

    // Update words
    vajbujState.words.forEach((wordData, idx) => {
        if (wordData.state === 'waiting' && elapsed >= wordData.startTime) {
            // Start assembling this word
            wordData.state = 'assembling';

            // Create the voxel word mesh
            if (!wordData.mesh && loadedFontRegular) {
                const voxelWord = createVoxelWord(wordData, loadedFontRegular);
                wordData.mesh = voxelWord.mesh;
                wordData.cubes = voxelWord.cubes;
                wordData.width = voxelWord.width;

                // Calculate X position based on word index in line
                let lineX = 0;
                const wordsInThisLine = vajbujState.words.filter(w => w.lineIndex === wordData.lineIndex);
                const currentWordIdxInLine = wordsInThisLine.indexOf(wordData);

                for (let i = 0; i < currentWordIdxInLine; i++) {
                    const prevWord = wordsInThisLine[i];
                    if (prevWord && prevWord.width) {
                        lineX += prevWord.width + VAJBUJ_CONFIG.wordSpacing;
                    } else {
                        lineX += 1.5; // Default spacing if width unknown
                    }
                }

                // Center the line
                let totalLineWidth = 0;
                wordsInThisLine.forEach(w => {
                    totalLineWidth += (w.width || 1.5) + VAJBUJ_CONFIG.wordSpacing;
                });
                totalLineWidth -= VAJBUJ_CONFIG.wordSpacing;

                const startX = -totalLineWidth / 2;
                // Add half-width because the mesh is centered, but lineX is the left-edge cursor
                wordData.posX = startX + lineX + (wordData.width / 2) + (wordData.offsetX || 0);
                // Initial Y position (will be updated dynamically for shifting)
                wordData.posY = VAJBUJ_CONFIG.lyricsOffsetY + (wordData.offsetY || 0);
                wordData.posZ = 0;

                scene.add(wordData.mesh);
                wordData.mesh.visible = true;
            }
        }

        if (wordData.state === 'assembling' || wordData.state === 'assembled') {
            // Calculate target Y based on how many lines are completed
            // Current line always appears at lyricsOffsetY.
            // Completed lines move up by lineSpacing.
            let shiftCount = vajbujState.completedLines - wordData.lineIndex;
            if (shiftCount < 0) shiftCount = 0; // Future lines stay at base

            const targetLineY = VAJBUJ_CONFIG.lyricsOffsetY + shiftCount * VAJBUJ_CONFIG.lineSpacing;

            // Smoothly lerp the Y position
            if (wordData.posY === undefined) wordData.posY = VAJBUJ_CONFIG.lyricsOffsetY;
            wordData.posY += (targetLineY - wordData.posY) * 0.1;

            if (wordData.state === 'assembling') {
                // Calculate assembly progress
                const assemblyElapsed = elapsed - wordData.startTime;
                const assemblyDuration = VAJBUJ_CONFIG.wordAssemblyDuration;
                wordData.progress = Math.min(assemblyElapsed / assemblyDuration, 1);

                // Update each cube
                if (wordData.mesh && wordData.cubes) {
                    wordData.cubes.forEach((cube, i) => {
                        // Calculate per-cube progress based on delay
                        let effectiveProgress = 0;
                        if (wordData.progress > cube.delay) {
                            effectiveProgress = (wordData.progress - cube.delay) / (1 - cube.delay);
                        }

                        // EaseOut Expo for the specific cube (or Back for overshoot)
                        let eased;
                        if (cube.shouldOvershoot) {
                            const t = effectiveProgress;
                            if (t >= 1) {
                                eased = 1;
                            } else if (t <= 0) {
                                eased = 0;
                            } else {
                                const c1 = cube.overshootMagnitude; // Random "Light" overshoot
                                const c3 = c1 + 1;
                                eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
                            }
                        } else {
                            eased = effectiveProgress >= 1 ? 1 : (effectiveProgress <= 0 ? 0 : 1 - Math.pow(2, -10 * effectiveProgress));
                        }

                        // Interpolate position
                        cube.currentPos.lerpVectors(cube.scatterPos, cube.targetPos, eased);
                        cube.currentScale = eased;

                        // --- Particle Color Transition ---
                        // Dark (almost black) until 2 frames before completion, then white
                        if (wordData.mesh) {
                            const assemblyDuration = VAJBUJ_CONFIG.wordAssemblyDuration;
                            // Total active time for this specific particle
                            const totalParticleTime = (1 - cube.delay) * assemblyDuration;
                            // Time remaining for this particle
                            const timeRemaining = (1 - effectiveProgress) * totalParticleTime;
                            const transitionWindow = 0.5; // Extended to 0.5s as requested

                            if (effectiveProgress >= 1) {
                                tempColor.copy(targetWhite);
                            } else if (timeRemaining <= transitionWindow && timeRemaining > 0) {
                                // Interpolate from Dark to White
                                const t = 1 - (timeRemaining / transitionWindow);
                                tempColor.copy(startDark).lerp(targetWhite, t);
                            } else {
                                // Stay Dark
                                tempColor.copy(startDark);
                            }
                            wordData.mesh.setColorAt(i, tempColor);
                        }

                        // Add word position offset
                        dummy.position.set(
                            cube.currentPos.x + (wordData.posX || 0),
                            cube.currentPos.y + (wordData.posY || 0),
                            cube.currentPos.z + (wordData.posZ || 0)
                        );
                        dummy.scale.setScalar(cube.currentScale);
                        dummy.rotation.set(0, 0, 0);
                        dummy.updateMatrix();
                        wordData.mesh.setMatrixAt(i, dummy.matrix);
                    });
                    wordData.mesh.instanceMatrix.needsUpdate = true;
                    if (wordData.mesh.instanceColor) wordData.mesh.instanceColor.needsUpdate = true;
                }

                if (wordData.progress >= 1) {
                    wordData.state = 'assembled';

                    // Check if this was the last word of the line to trigger global shift
                    const lineWords = vajbujState.words.filter(w => w.lineIndex === wordData.lineIndex);
                    const allAssembled = lineWords.every(w => w.state === 'assembled' || w.state === 'assembling' && w.progress >= 1);

                    if (allAssembled && wordData.lineIndex >= vajbujState.completedLines) {
                        vajbujState.completedLines = wordData.lineIndex + 1;
                        console.log(`[VAJBUJ] Line ${wordData.lineIndex} completed. Shifting up!`);
                    }
                }
            } else {
                // state === 'assembled'
                // Still need to update matrix for the vertical shift
                if (wordData.mesh && wordData.cubes) {
                    wordData.cubes.forEach((cube, i) => {
                        dummy.position.set(
                            cube.targetPos.x + (wordData.posX || 0),
                            cube.targetPos.y + (wordData.posY || 0),
                            cube.targetPos.z + (wordData.posZ || 0)
                        );
                        dummy.scale.setScalar(1);
                        dummy.rotation.set(0, 0, 0);
                        dummy.updateMatrix();
                        wordData.mesh.setMatrixAt(i, dummy.matrix);
                    });
                    wordData.mesh.instanceMatrix.needsUpdate = true;
                }
            }
        }
    });

    // Update background cubes
    if (vajbujState.bgCubesMesh && vajbujState.bgCubesMesh.visible) {
        vajbujState.bgCubes.forEach((cube, i) => {
            // Apply velocity with tempo multiplier
            cube.position.add(cube.velocity.clone().multiplyScalar(tempoMultiplier));

            // Apply spin
            cube.rotation.x += cube.spin.x * tempoMultiplier;
            cube.rotation.y += cube.spin.y * tempoMultiplier;
            cube.rotation.z += cube.spin.z * tempoMultiplier;

            // Bounce off invisible walls
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
            vajbujState.bgCubesMesh.setMatrixAt(i, dummy.matrix);
        });
        vajbujState.bgCubesMesh.instanceMatrix.needsUpdate = true;
    }
}

function stopVajbujMode() {
    if (vajbujState.isStopping) return;
    if (!vajbujState.active) return;

    console.log('[VAJBUJ] Initiating smooth shutdown');
    vajbujState.isStopping = true;

    // 1. Mute / Fade out audio and visuals
    if (vajbujState.audio) {
        // Fade out over 2 seconds
        fadeAudio(vajbujState.audio, vajbujState.audio.volume, 0, 2);
    }

    // Fade out background cubes
    if (vajbujState.bgCubesMesh) {
        fadeVisualOpacity(vajbujState.bgCubesMesh.material, 1, 0, 2);
    }

    // Fade out active words
    vajbujState.words.forEach(word => {
        if (word.mesh && word.mesh.material) {
            fadeVisualOpacity(word.mesh.material, 1, 0, 2);
        }
    });

    // 2. Return camera to start position
    setCameraMode('manual');
    targetCameraAngle = 0;
    targetCameraVerticalAngle = 0;
    targetCameraRadius = CONFIG.initialZoom;
    cameraFocusPoint.set(0, 0, 0);

    // Sync UI Button immediately
    if (window.vajbujButton) {
        window.vajbujButton.classList.remove('active');
    }

    // 3. Final cleanup after ~2s
    setTimeout(() => {
        console.log('[VAJBUJ] Final shutdown cleanup');

        // Stop and reset audio
        if (vajbujState.audio) {
            vajbujState.audio.pause();
            vajbujState.audio.currentTime = 0;
            vajbujState.audio.volume = 0;
        }

        // Hide background cubes
        if (vajbujState.bgCubesMesh) {
            vajbujState.bgCubesMesh.visible = false;
        }

        // Clean up all words
        cleanupVajbujWords();

        // Reset state
        vajbujState.active = false;
        vajbujState.isStopping = false;
        vajbujState.lastActivityTime = Date.now();
    }, 2000);
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
    await new Promise(resolve => setTimeout(resolve, 0));

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
    await new Promise(resolve => setTimeout(resolve, 0));

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
            glitchTarget: new THREE.Vector3()
        });
    });

    // Notify Three.js to update
    Object.values(meshRegistry).forEach(e => {
        if (e.top) e.top.instanceMatrix.needsUpdate = true;
        if (e.kek) e.kek.instanceMatrix.needsUpdate = true;
    });

    loadState.generation = 80;
    updateProgress();
    await new Promise(resolve => setTimeout(resolve, 0));

    // 4. Inner Cubes
    innerCubeParticles = [];

    // Check if inner data exists
    if (!data.inner) data.inner = [];

    const innerCount = data.inner.length;
    const innerCubeGeo = new THREE.BoxGeometry(CONFIG.particleSize, CONFIG.particleSize, CONFIG.particleSize);
    const innerCubeMat = new THREE.MeshStandardMaterial(MATERIALS.innerCubes);

    innerCubeInstancedMesh = new THREE.InstancedMesh(innerCubeGeo, innerCubeMat, innerCount);
    const color = new THREE.Color();

    let minX = Infinity;
    let maxX = -Infinity;
    if (innerCount > 0) {
        data.inner.forEach(p => {
            if (p.p[0] < minX) minX = p.p[0];
            if (p.p[0] > maxX) maxX = p.p[0];
        });
    }
    const textWidth = maxX - minX || 1;

    let sIdx = 0;
    data.inner.forEach(p => {
        const pos = new THREE.Vector3(p.p[0], p.p[1], p.p[2]);

        dummy.position.copy(pos);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        innerCubeInstancedMesh.setMatrixAt(sIdx, dummy.matrix);

        const hue = (pos.x - minX) / textWidth;
        color.setHSL(hue, 1.0, 0.5);
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
            glitchTarget: new THREE.Vector3()
        });
        sIdx++;
    });

    innerCubeInstancedMesh.count = sIdx;
    innerCubeInstancedMesh.instanceMatrix.needsUpdate = true;
    if (innerCubeInstancedMesh.instanceColor) innerCubeInstancedMesh.instanceColor.needsUpdate = true;
    scene.add(innerCubeInstancedMesh);

    loadState.generation = 100;
    updateProgress();

    // Hide Loader
    loaderContainer.classList.add('hidden');
    setTimeout(() => {
        loaderContainer.style.display = 'none';
    }, 500);
}
