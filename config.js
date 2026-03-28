import * as THREE from 'three';

// Device Detection
export const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

// Tryb wydajności: `?perf=lite|full|auto`, potem localStorage (`storageKey`), domyślnie auto + heurystyka
export const PERFORMANCE_CONFIG = {
    storageKey: 'topkek-performance',
    urlParam: 'perf',
    // ≤3 GB → lite; 4 GB often reported on capable desktops (see auto perf heuristic)
    autoLiteMaxDeviceMemoryGb: 3,
    autoLiteMaxHardwareConcurrency: 4,
    profiles: {
        full: {
            maxPixelRatioCap: 2,
            enableSao: true,
            enableBloom: true,
            enableCrt: true,
            secondLightCastShadow: true,
            shadowMapSizeOverride: null
        },
        lite: {
            maxPixelRatioCap: 1.25,
            enableSao: false,
            enableBloom: true,
            enableCrt: false,
            secondLightCastShadow: false,
            shadowMapSizeOverride: 512
        }
    }
};

// Text & Particle Configuration
export const CONFIG = {
    text: IS_MOBILE ? "K" : "TOPKEK",
    textSize: IS_MOBILE ? 2.5 : 3, // Smaller text on mobile
    textHeight: IS_MOBILE ? 0.1 : 0.5,
    particleSize: 0.1,
    // loadParticles(JSON): symmetric ±Z nudge. Use 0 for baked particles_*.json (non-zero pushes z≥0 toward +Z → wystaje „z przodu”).
    innerCubeZBias: 0,
    particleCount: 0, // Will be determined by sampler
    targetCubeCount: IS_MOBILE ? 15000 : 50000, // Reduced particle count for mobile
    particlesFile: IS_MOBILE ? 'particles_mobile.json' : 'particles_pc.json', // File to load particles from
    repulsionRadius: 3, // Increased radius
    repulsionStrength: 4,
    returnSpeed: 0.2,
    sampleDensity: 1, // Points per unit area (increase for more dense voxels)
    letterSpacing: 0.5, // Extra spacing between letters
    animationMode: 'scatter', // 'repulsion', 'scatter', or 'grid'
    gridCols: 10, // For grid calculation
    gridSpacing: 2,
    shadowMapSize: IS_MOBILE ? 128 : 1028, // Reduced shadow map size for mobile
    zoomSensitivity: 0.005, // Speed of zoom via scroll
    freeCamZoomSpeed: 0.005, // Szybkość zoomu w trybie Free Cam (OrbitControls)
    minZoom: 3, // Minimum camera distance
    maxZoom: 50, // Maximum camera distance (increased for Vajbuj)
    initialZoom: 20, // Default starting camera distance
    panSpeed: 0.02, // Speed of panning with middle mouse
    subtitle: {
        text: "PRODUCTIONS",
        size: 0.8, // Much smaller than main text
        height: 0.12, // Thickness for geometry (not used for particles directly if hardcoded)
        offsetY: -3, // Position below main text (slightly higher)
        thickness: 2, // Voxel thickness
        letterSpacing: 1, // Slightly more spread between letters
    },
    appstainPassword: "lol",
    appstainRedirectUrl: "https://xcwajdax.github.io/appstainsaga/",
    portfolio: {
        sampleVimeoUrl: "https://player.vimeo.com/video/1170695269"
    },
    // Ogromne wideo za napisem TOPKEK jako tło 3D – przy ładowaniu strony wybierane losowo
    backgroundVideo: {
        sources: [
            {
                src: 'ASSETS/BGs/01_torus.mp4',
                envMapIntensityBoost: {
                    defaultBox: 25.0,
                    glass: 6.0,
                    gold: 6.2,
                    innerCubes: 0.5,
                    heart: 1.35,   
                    vajbujBgCubes: 2.0,
                    mysenBgCubes: 2.0
                },
                hemisphereFromVideo: {
                    intensity: 2.0,
                    ambientIntensity: 1
                }
            },
            {
                src: 'ASSETS/BGs/02_bag_1.mp4',
                envMapIntensityBoost: {
                    defaultBox: 5.0,
                    glass: 2.0,
                    gold: 2.2,
                    innerCubes: 0.5,
                    heart: 1.35,
                    vajbujBgCubes: 2.0,
                    mysenBgCubes: 2.0
                },
                hemisphereFromVideo: {
                    intensity: 1.2,
                    ambientIntensity: 1
                }
            },
            {
                src: 'ASSETS/BGs/06_kostki_02.mp4',
                envMapIntensityBoost: {
                    defaultBox: 5.0,
                    glass: 2.0,
                    gold: 2.2,
                    innerCubes: 0.5,
                    heart: 1.35,
                    vajbujBgCubes: 2.0,
                    mysenBgCubes: 2.0
                },
                hemisphereFromVideo: {
                    intensity: 3,
                    ambientIntensity: 0.5
                }
            }
        ],
        positionZ: -20,
        width: 80,
        height: 45,
        /** Fake GI z klatki wideo: PMREM (desktop) + próbkowanie koloru → Hemisphere/Ambient (mobile) */
        videoIbl: {
            enabled: true,
            /** Na mobile domyślnie wyłączone (koszt GPU); Hemisphere wystarczy */
            usePmrem: !IS_MOBILE,
            /** false = scene.environment zostaje HDRI (odporność na czarny PMREM); wideo tylko Hemisphere + boost */
            replaceSceneEnvironment: true,
            // Mniej opóźnienia “fake GI” po klatkach w tle
            intervalMs: IS_MOBILE ? 0 : 320,
            /** Promień rozmycia w radianach — Three.js ogranicza ~20 próbek; >~0.1 zwykle klipuje (konsola). */
            sigma: 0.04
        },
        hemisphereFromVideo: {
            enabled: true,
            /** true na desktopie = zapasowy fill z kolorem wideo, gdy PMREM/ACES psuje jasność */
            always: !IS_MOBILE,
            intensity: 0.85,
            ambientIntensity: 0.6,
            // Szybsza reakcja kolorów (bez zbyt częstych próbek)
            intervalMs: 40,
            canvasWidth: 32,
            canvasHeight: 64
        },
        /** Mnożniki envMapIntensity względem MATERIALS.* (żeby widać dynamiczne IBL) */
        envMapIntensityBoost: {
            defaultBox: 5.0,
            glass: 2.0,
            gold: 2.2,
            innerCubes: 0.1,
            heart: 1.35,
            vajbujBgCubes: 2.0,
            mysenBgCubes: 2.0
        },
        bpmControl: {
            baseBpm: 120,
            defaultBpm: 120,
            options: [60, 75, 90, 100, 110, 120, 128, 140, 160]
        }
    }
};

// Portfolio thumbnails (max 6) – below PRODUCTIONS, 2×3 grid (spaced out)
export const PORTFOLIO_CONFIG = {
    offsetYTop: -7.0,
    rowSpacing: 3.2,
    slotWidth: 4.0,
    slotHeight: 2.1,
    slotSpacing: 5.5,
    cubeSize: 0.12,
    frameThickness: 2,
    planeZOffset: 0.02,
    forceScale: 1.0,
    items: [
        { id: "zorza", title: "ZORZA 2025", thumbnailVideo: "ASSETS/PORTFOLIO/test_miniatura.mp4", vimeoUrl: "https://player.vimeo.com/video/1170695269", description: "Motion design project.", images: [], typography: [] },
        { id: "p2", title: "Project 2", thumbnailVideo: "ASSETS/PORTFOLIO/test_miniatura.mp4", vimeoUrl: "https://player.vimeo.com/video/1170695269", description: "Motion design project.", images: [], typography: [] },
        { id: "p3", title: "Project 3", thumbnailVideo: "ASSETS/PORTFOLIO/test_miniatura.mp4", vimeoUrl: "https://player.vimeo.com/video/1170695269", description: "Motion design project.", images: [], typography: [] },
        { id: "p4", title: "Project 4", thumbnailVideo: "ASSETS/PORTFOLIO/test_miniatura.mp4", vimeoUrl: "https://player.vimeo.com/video/1170695269", description: "Motion design project.", images: [], typography: [] },
        { id: "p5", title: "Project 5", thumbnailVideo: "ASSETS/PORTFOLIO/test_miniatura.mp4", vimeoUrl: "https://player.vimeo.com/video/1170695269", description: "Motion design project.", images: [], typography: [] },
        { id: "p6", title: "Project 6", thumbnailVideo: "ASSETS/PORTFOLIO/test_miniatura.mp4", vimeoUrl: "https://player.vimeo.com/video/1170695269", description: "Motion design project.", images: [], typography: [] }
    ]
};

// Portfolio scene transition (camera, phases, MOTION DESIGN)
export const PORTFOLIO_SCENE_CONFIG = {
    cameraMoveDuration: 2.5,
    cameraFocusTarget: { x: 0, y: -4, z: 0 },
    cameraRadiusTarget: 30,
    cameraAngleTarget: 0,
    cameraVerticalAngleTarget: -0.35,
    subtitleTransformDuration: 1.5,
    motionDesignLineOffset: 1.2,
    heartFlyDuration: 1.2,
    flashDuration: 0.15,
    windowsFlyInDuration: 1.0,
    bgVideoOffsetY: -4,
    bgVideoMoveDuration: 2.8
};

// Glitch volumetryczne – blokowe przeskoki fragmentów napisu TOPKEK
export const GLITCH_VOLUME_CONFIG = {
    enabled: false,
    intervalMin: 200,   // ms – min odstęp auto-triggera
    intervalMax: 2000,   // ms – max odstęp auto-triggera
    duration: 0.88,      // s – jak długo offset jest widoczny
    maxOffset: 0.4,      // maks. przesunięcie na oś
    bandCount: 32,        // na ile pasów (X) dzielimy napis (pattern 'bands')
    bandsPerGlitch: 4,   // ile pasów jednocześnie glitchować
    includeInnerCubes: true,

    // Wspólne opcje zachowania
    pattern: 'bands', // 'bands' | 'grid2d' | 'clusters'
    useRotation: false,
    useScale: true,
    useColorFlicker: true,

    // Rotacja i skala
    rotationMaxAngle: Math.PI / 4,
    scaleMin: 0.9,
    scaleMax: 1.15,

    // Parametry dla patternu 'grid2d'
    gridCols: 25,
    gridRows: 8,
    tilesPerGlitch: 4,

    // Parametry dla patternu 'clusters'
    clusterFraction: 0.05,
    clusterMinCount: 50,
    clusterMaxCount: 300,

    // Kolor – używane w drugiej iteracji (color flicker)
    colorFlickerStrength: 0.2
};

// Presety zachowania glitch volumetrycznego
export const GLITCH_VOLUME_PRESETS = {
    subtelny: {
        pattern: 'bands',
        duration: 0.2,
        maxOffset: 1,
        bandsPerGlitch: 0.3,
        tilesPerGlitch: 0.2,
        clusterFraction: 0.2,
        intervalMin: 220,
        intervalMax: 50,
        useRotation: false,
        useScale: true,
        useColorFlicker: false
    },
    mocny: {
        pattern: 'grid2d',
        duration: 0.80,
        maxOffset: 0.45,
        bandsPerGlitch: 6,
        tilesPerGlitch: 3,
        clusterFraction: 0.12,
        intervalMin: 180,
        intervalMax: 1200,
        useRotation: true,
        useScale: true,
        useColorFlicker: false
    },
    chaos: {
        pattern: 'clusters',
        duration: 0.3,
        maxOffset: 0.4,
        bandsPerGlitch: 5,
        tilesPerGlitch: 3,
        clusterFraction: 0.15,
        intervalMin: 60,
        intervalMax: 900,
        useRotation: true,
        useScale: false,
        useColorFlicker: false
    }
};

export const GLITCH_VOLUME_STATE = {
    currentPreset: 'subtelny'
};

// Base of volumetric effects controlled from terminal (MVP).
export const FX_CONFIG = {
    global: {
        enabled: true,
        defaultBpm: 120,
        timeMode: 'hybrid',
        maxActiveInstances: 24
    },
    registry: {
        scatterBurst: {
            label: 'Scatter Burst',
            aliases: ['sc', 'scatter'],
            defaults: {
                frequency: '1/4',
                scale: 1.0,
                speed: 1.0,
                spread: 0.55,
                decay: 0.6,
                easing: 'outCubic',
                variation: 'radial'
            },
            ranges: {
                scale: { min: 0.1, max: 5.0 },
                speed: { min: 0.1, max: 8.0 },
                spread: { min: 0.05, max: 1.0 },
                decay: { min: 0.05, max: 3.0 }
            },
            /** Krótkie podpowiedzi pod polem (parametry bez liczbowego ranges). */
            paramHints: {
                frequency: 'np. 1/4, 1/8 · 0.25s, 2s · 1b, 2b (sync BPM)',
                easing: 'np. linear, outCubic, inOutCubic',
                variation: 'np. radial'
            }
        },
        letterEmission: {
            label: 'Letter Emission',
            aliases: ['le', 'emit'],
            defaults: {
                target: 'both',
                distribution: 'sequential',
                color: '#66ccff',
                duration: '1/8',
                frequency: '1/8',
                falloff: 0.65,
                gain: 1.0,
                pulseScale: 0.32,
                easing: 'inOutCubic'
            },
            ranges: {
                falloff: { min: 0.05, max: 1.5 },
                gain: { min: 0.1, max: 4.0 },
                pulseScale: { min: 0.05, max: 0.65 }
            },
            paramHints: {
                target: 'main · subtitle · both',
                distribution: 'sequential · random · pingpong',
                color: '#rrggbb lub 0xrrggbb',
                duration: 'jak frequency (beat, s, b)',
                frequency: 'np. 1/8, 1/4 · 0.2s · 1b',
                pulseScale: 'mnożnik pulsu skali (gain × pulseScale, max +0.55)',
                easing: 'np. linear, inOutCubic, outCubic'
            }
        },
        repulsionSwarm: {
            label: 'Repulsion Swarm',
            aliases: ['rp', 'swarm'],
            defaults: {
                count: 3,
                radius: 3.0,
                speed: 1.2,
                turnRate: 1.0,
                pattern: 'wander',
                easing: 'linear'
            },
            ranges: {
                count: { min: 1, max: 12 },
                radius: { min: 0.5, max: 12.0 },
                speed: { min: 0.1, max: 6.0 },
                turnRate: { min: 0.1, max: 6.0 }
            },
            paramHints: {
                pattern: 'np. wander',
                easing: 'np. linear, outCubic'
            }
        },
        gridNoiseMask: {
            label: 'Grid Noise Mask',
            aliases: ['gn', 'gridnoise'],
            defaults: {
                noiseType: 'sine',
                loopLength: '2b',
                clampUp: 1.0,
                clampDown: 0.0,
                brightness: 0.5,
                contrast: 1.0,
                speed: 1.0,
                threshold: 0.6,
                bpmSync: 1
            },
            ranges: {
                clampUp: { min: 0.0, max: 1.0 },
                clampDown: { min: 0.0, max: 1.0 },
                brightness: { min: 0.0, max: 2.0 },
                contrast: { min: 0.1, max: 3.0 },
                speed: { min: 0.1, max: 6.0 },
                threshold: { min: 0.0, max: 1.0 },
                bpmSync: { min: 0, max: 1 }
            },
            paramHints: {
                noiseType: 'np. sine',
                loopLength: 'np. 2b, 4b, 1s (faza / długość pętli)'
            }
        }
    },
    aliasCommands: {
        sc_trig: 'fx trigger scatterBurst',
        sc_start: 'fx start scatterBurst',
        rp_trig: 'fx trigger repulsionSwarm',
        rp_start: 'fx start repulsionSwarm',
        gn_trig: 'fx trigger gridNoiseMask',
        gn_start: 'fx start gridNoiseMask',
        le_trig: 'fx trigger letterEmission',
        le_start: 'fx start letterEmission',
        fx_bpm: 'fx bpm'
    }
};

/** Przykładowe presety do panelu FX dev (3 na każdy effectId); params mergowane z defaults przy starcie. */
export const FX_SAMPLE_PRESETS = {
    scatterBurst: [
        { label: 'Fast beat', params: { frequency: '1/8', speed: 1.6, scale: 1.1 } },
        { label: 'Wide spread', params: { spread: 0.85, decay: 0.85, speed: 1.2 } },
        { label: 'Subtle', params: { scale: 0.75, speed: 0.65, spread: 0.35 } }
    ],
    letterEmission: [
        { label: 'Random letters', params: { distribution: 'random', gain: 1.3, frequency: '1/4' } },
        { label: 'Ping-pong', params: { distribution: 'pingpong', duration: '1/8', falloff: 0.9 } },
        { label: 'Main only', params: { target: 'main', color: '#ffcc66', gain: 1.15 } }
    ],
    repulsionSwarm: [
        { label: 'Dense swarm', params: { count: 8, radius: 4.5, speed: 1.4 } },
        { label: 'Wide ring', params: { count: 4, radius: 8, turnRate: 0.6 } },
        { label: 'Slow drift', params: { count: 3, speed: 0.5, turnRate: 0.4, pattern: 'wander' } }
    ],
    gridNoiseMask: [
        { label: 'Heavy noise', params: { threshold: 0.35, speed: 2.2, brightness: 0.65 } },
        { label: 'High contrast', params: { contrast: 2.0, threshold: 0.55, clampDown: 0.1 } },
        { label: 'Calm grid', params: { speed: 0.5, threshold: 0.75, brightness: 0.4 } }
    ]
};

// VAJBUJ SZMATO Mode Configuration
export const VAJBUJ_CONFIG = {
    enabled: true,
    autoTrigger: false, // Disabled - use button instead
    inactivityTimeout: 15000, // ms before Vajbuj activates (not used when autoTrigger=false)

    // Audio settings
    audioFile: 'VAJBUJ_TRIMMED.mp3',
    audioStartTime: 0, // seconds - fragment start
    audioEndTime: 29, // seconds - fragment end
    fadeInDuration: 1.5, // seconds
    fadeOutDuration: 1.5, // seconds

    // Lyrics - each object can have custom properties
    lyrics: [
        { text: "Podchodzę", color: 0xffffff, offsetX: 0, offsetY: 0 },
        { text: "se", color: 0xffffff, offsetX: 0 },
        { text: "do", color: 0xffffff, offsetX: 0 },
        { text: "ziomala", color: 0xffffff, offsetX: 0 },
        { text: "mówię", color: 0xffffff, offsetX: 0 },
        { text: "vajbuj", color: 0xffffff, offsetX: 0 },
        { text: "Szmato.", color: 0xff0000, scale: 1.2, offsetX: 0 },
        { lineBreak: true },

        { text: "Co", color: 0xffffff, offsetX: 0 },
        { text: "mi", color: 0xffffff, offsetX: 0 },
        { text: "odpowiesz", color: 0xffffff, offsetX: 0 },
        { text: "na", color: 0xffffff, offsetX: 0 },
        { text: "to?", color: 0xffffff, offsetX: 0 },
        { lineBreak: true },

        { text: "Podchodzę", color: 0xffffff },
        { text: "se", color: 0xffffff },
        { text: "do", color: 0xffffff },
        { text: "ziomala", color: 0xffffff },
        { text: "mówię", color: 0xffffff },
        { text: "vajbuj", color: 0xffffff },
        { text: "Szmato.", color: 0xff0000, scale: 1.2 },
        { lineBreak: true },

        { text: "Co", color: 0xffffff },
        { text: "mi", color: 0xffffff },
        { text: "odpowiesz", color: 0xffffff },
        { text: "na", color: 0xffffff },
        { text: "to?", color: 0xffffff },
        { lineBreak: true },

        { text: "Podchodzę", color: 0xffffff },
        { text: "se", color: 0xffffff },
        { text: "do", color: 0xffffff },
        { text: "ziomala", color: 0xffffff },
        { text: "mówię", color: 0xffffff },
        { text: "vajbuj", color: 0xffffff },
        { text: "Szmato.", color: 0xff0000, scale: 1.2 },
        { lineBreak: true },

        { text: "Co", color: 0xffffff },
        { text: "mi", color: 0xffffff },
        { text: "odpowiesz", color: 0xffffff },
        { text: "na", color: 0xffffff },
        { text: "to?", color: 0xffffff },
        { lineBreak: true },

        { text: "Podchodzę", color: 0xffffff },
        { text: "se", color: 0xffffff },
        { text: "do", color: 0xffffff },
        { text: "ziomala", color: 0xffffff },
        { text: "mówię", color: 0xffffff },
        { text: "vajbuj", color: 0xffffff },
        { text: "Szmato.", color: 0xff0000, scale: 1.2 },
        { lineBreak: true },

        { text: "Co", color: 0xffffff },
        { text: "mi", color: 0xffffff },
        { text: "odpowiesz", color: 0xffffff },
        { text: "na", color: 0xffffff },
        { text: "to?", color: 0xffffff },
        { lineBreak: true }
    ],

    // Default color for words
    defaultWordColor: 0xffffff,

    // Word timings in FRAMES (25 FPS) from fragment start (frame 0 = 0:41)
    // When word should be FULLY ASSEMBLED
    // Leave empty for auto-distribution, fill with frame numbers when ready
    wordTimings: [13, 22, 29, 40, 54, 63, 76, 116, 123, 131, 145, 152, 177, 193, 199, 205, 218, 231, 242, 290, 300, 308, 316, 323, 349, 358, 365, 376, 390, 399, 412, 463, 470, 478, 492, 499, 523, 530, 537, 546, 558, 566, 578, 632, 638, 645, 657, 663], // e.g., [12, 25, 38, 50, ...] 

    // Animation settings
    wordAssemblyDuration: 1.8, // Krótszy czas składania dla lepszej dynamiki
    lyricsStartDelay: 0, // Zmienione na 0, bo używamy manualnych keyframes
    wordSize: 0.9, // Increased from 0.8 for better legibility
    wordHeight: 0.12, // Increased from 0.12
    wordThickness: 2, // voxel layers
    lineSpacing: 2.0, // Zwiększone dla lepszej separacji
    wordSpacing: 0.8, // Zwiększone dla lepszej czytelności
    lyricsOffsetY: 4.2, // position above TOPKEK

    // Scatter settings for word assembly
    scatterRadius: 6, // how far cubes scatter before assembling

    // Background cubes - blue to purple palette
    bgCubeColors: [
        0x00d4ff, // bright cyan
        0x0099ff, // sky blue
        0x0066ff, // royal blue
        0x6600ff, // purple
        0x9900ff, // violet
        0xaa00ff  // magenta-purple
    ],
    bgCubeSize: 0.25, // smaller cubes
    bgCubeCount: 100,
    bgCubeMaterial: {
        metalness: 0.6,
        roughness: 0.4
    },

    // Tempo dynamics
    slowPhaseEnd: 0.48, // 48% - when slow phase ends
    slowPhaseSpeed: 0.15, // 15% speed during slow phase

    // Final question mark
    finalSymbol: "?",
    finalSymbolColor: 0xff0000, // red
    finalSymbolScale: 2.0
};

/** MYSEN remix mode — console `/mysen start|stop`. Lyrics use `at` (seconds from fragment start) or `wordTimesSec`; voxel style like VAJBUJ but main TOPKEK mesh is hidden. */
export const MYSEN_CONFIG = {
    enabled: true,
    /** When true, skip init on mobile (lighter scene). */
    disableOnMobile: false,

    /** Must exist on the static server (same origin). 404 → see audioFileFallback. */
    audioFile: 'ASSETS/mysen/mysen-remix.mp3',
    /** Used when audioFile fails (missing file / 404). Set null to disable. Often VAJBUJ clip until remix is in ASSETS/mysen/. */
    audioFileFallback: 'VAJBUJ_TRIMMED.mp3',
    audioStartTime: 0,
    /** Absolute end time on the media timeline (seconds). Use `null` to play from audioStartTime to the natural end of the file (`audio.duration`). A finite number trims like a short clip. */
    audioEndTime: null,
    fadeInDuration: 1.5,
    fadeOutDuration: 1.5,

    /** Hide the background video plane while MYSEN plays (reduces visual clash). */
    hideBackgroundVideo: true,

    /**
     * Lyrics: same shape as VAJBUJ plus optional `at` (seconds from audioStartTime) for variable tempo.
     * Optional per-word pulse after assemble: `pulseScale`, `pulseMs`.
     */
    lyrics: [
        { text: 'BEZSEN - MYSEN', color: 0x66ccff, at: 0.6 },
        { lineBreak: true },
        { text: 'Topkek reimagined', color: 0xffffff, at: 2.2 }
    ],

    /** If length matches word count (no lineBreak entries counted), overrides missing `at`. */
    wordTimesSec: [],

    /** Global matchers: pulse when a word finishes assembling (in addition to per-line pulseScale). */
    wordPulses: [],

    wordAssemblyDuration: 1.8,
    lyricsStartDelay: 0,
    wordSize: 1.0,
    wordHeight: 0.12,
    wordThickness: 2,
    lineSpacing: 2.0,
    wordSpacing: 0.8,
    lyricsOffsetY: 0.5,
    scatterRadius: 6,
    defaultWordColor: 0xffffff,

    bgCubeColors: [
        0x1a3a4a,
        0x2d5a6b,
        0x4a90a4,
        0x6ec8d8,
        0x88dde8,
        0xa8f0ff
    ],
    bgCubeSize: 0.25,
    bgCubeCount: IS_MOBILE ? 48 : 100,
    bgCubeMaterial: {
        metalness: 0.55,
        roughness: 0.42,
        envMapIntensity: 1
    },

    /** 0 = no slow phase; else fraction of fragment duration with slowPhaseSpeed multiplier on bg cubes. */
    slowPhaseEnd: 0,
    slowPhaseSpeed: 0.2
};

// Shader Configuration
export const SHADER_CONFIG = {
    crt: {
        curvature: new THREE.Vector2(0.5, 0.40), // 1.0 = flat, wyższe = mocniejsza krzywizna
        lineWidth: 0.25,
        scanlineIntensity: IS_MOBILE ? 0.2 : 0.35,
        scanlineCount: IS_MOBILE ? 200 : 400,
        vignetteStrength: 0.85,
        vignetteRadius: 1.0,
        chromaticAberration: IS_MOBILE ? 0.001 : 0.003,
        flickerAmount: IS_MOBILE ? 0 : 0.02
    },
    bloom: {
        // RenderPass zapisuje obraz już po tone mappingu (ACES na rendererze); wysoki próg (np. 0.48) odcina prawie cały bloom.
        // Oficjalny przykład three r160 używa threshold 0. Umiarkowany próg + siła utrzymują poświatę bez przepalenia.
        threshold: 0.12,
        strength: 0.82,
        alternateStrength: 0.32, // Siła bloom po naciśnięciu spacji
        radius: 0.85
    },
    sao: {
        saoBias: 1,                 // Odchylenie cienia (unika artefaktów/shadow acne)
        saoIntensity: 0.05,         // Intensywność cieniowania (wyższa = ciemniej)
        saoScale: 1,                // Skala globalna efektu
        saoKernelRadius: 25,        // Promień próbkowania (większy = bardziej miękkie cienie)
        saoMinResolution: 0,        // Minimalna rozdzielczość
        saoBlur: false,              // Włącz rozmycie szumu
        saoBlurRadius: 10,          // Promień rozmycia (wygładzanie)
        saoBlurStdDev: 5,           // Odchylenie standardowe rozmycia
        saoBlurDepthCutoff: 0.05    // Odcięcie głębi (chroni krawędzie przed rozmyciem na tło)
    }

};

/** Terminal shell UI (bottom of #right-panel): prompt, log limits, welcome text — no logic. */
export const TERMINAL_CONFIG = {
    maxLogLines: 200,
    /** Shown before typed input and echoed user lines in the log. */
    prompt: 'U >',
    /** Prefix before Buuch chat replies in the log (space added before body). */
    buuchLogPrefix: 'B >',
    welcomeLines: [
        'TOPKEK console — /help for a short list, /help full for every command line.'
    ],
    timestamp: {
        enabled: true,
        locale: 'en-GB',
        hour12: false,
        showSeconds: true
    },
    stream: {
        enabled: true,
        /** Conversational replies (Buuch, default command output). */
        charDelayMs: 8,
        lineDelayMs: 45,
        /** Long listings e.g. /help full — character typing uses this profile in terminal-shell. */
        fastCharDelayMs: 2,
        fastLineDelayMs: 15
    },
    shellUi: {
        maximizedClass: 'topkek-terminal-shell--maximized',
        collapsedClass: 'topkek-terminal-shell--collapsed'
    }
};

/** Short `/help` listing (console). Full reference: `/help full`. */
export const TERMINAL_HELP_LINES_COMPACT = [
    '/help // Short list. ex: /help',
    '/help full // Every command line + FX aliases. ex: /help full',
    '/clear // Clears console log. ex: /clear',
    '/vajbuj [start|stop] // VAJBUJ mode. ex: /vajbuj start',
    '/mysen [start|stop] // MYSEN remix mode. ex: /mysen start',
    '/bloom <on|off|strength> [value] | /sao <on|off> | /crt <on|off> // Postprocess toggles.',
    '/postproc <status> // Bloom / SAO / CRT + fake GI (video IBL). ex: /postproc status',
    '/fakegi <on|off|status> // Wideo jako fake GI (PMREM + hemisphere). ex: /fakegi status',
    '/material <toggle|default|alt|status> // TOP/KEK materials. ex: /material toggle',
    '/light <1|2> color <#rrggbb|0xrrggbb> | /light <1|2> intensity <value> // Lights.',
    '/fx list // Effect ids and aliases (use for shortcut names). ex: /fx list',
    '/fx dev // Toggle FX developer panel (top overlay; params + preset). ex: /fx dev',
    '/fx on | /fx off // Enable or disable FX runtime. ex: /fx off',
    '/fx status | /fx bpm | /fx set | /fx trigger | /fx start | /fx stop // FX control.',
    'FX time tokens: 0.25s | 2s | 1b | 2b | 1/4 | 1/8'
];

/** Full `/help full` listing (same content as former default /help). */
export const TERMINAL_HELP_LINES_FULL = [
    '/help // Short list. ex: /help',
    '/help full // This full list. ex: /help full',
    '/clear // Clears console log. ex: /clear',
    '/vajbuj [start|stop] // Starts/stops VAJBUJ mode. ex: /vajbuj start',
    '/mysen [start|stop] // Starts/stops MYSEN remix mode (hides TOPKEK letters). ex: /mysen start',
    '/bloom <on|off|strength> [value] // Controls bloom pass. ex: /bloom strength 0.9',
    '/sao <on|off> // Toggles SAO pass (full perf). ex: /sao on',
    '/crt <on|off> // Toggles CRT pass. ex: /crt off',
    '/postproc <status> // Bloom / SAO / CRT + stan fake GI (video IBL, światła wideo). ex: /postproc status',
    '/fakegi <on|off|status> // Włącza/wyłącza fake GI z wideo: PMREM → scene.environment, boost envMap, Hemisphere+Ambient z klatki. ex: /fakegi off',
    '/material <toggle|default|alt|status> // Switches TOP/KEK material mode. ex: /material toggle',
    '/light <1|2> color <#rrggbb|0xrrggbb> // Sets light color. ex: /light 1 color #66ccff',
    '/light <1|2> intensity <value> // Sets light intensity. ex: /light 2 intensity 1.8',
    '/fx list // Lists effect ids and aliases. ex: /fx list',
    '/fx dev // Toggles top-centered FX developer panel (defaults, Trigger / Start / Stop, JSON preset). ex: /fx dev',
    '/fx on // Enables FX runtime (same as panel checkbox). ex: /fx on',
    '/fx off // Disables FX runtime. ex: /fx off',
    '/fx status // Shows FX runtime and active instances. ex: /fx status',
    '/fx bpm <value> // Sets global FX BPM (20..300). ex: /fx bpm 128',
    '/fx set <effectId.param> <value> // Sets default FX parameter. ex: /fx set scatterBurst.speed 2.1',
    '/fx trigger <effectId> [param=value ...] // Runs one-shot effect. ex: /fx trigger scatterBurst speed=2',
    '/fx start <effectId> [param=value ...] // Starts looped effect. ex: /fx start repulsionSwarm count=4',
    '/fx stop <instanceId|effectId|all> // Stops matching FX instances. ex: /fx stop all',
    '/sc_trig // Alias: /fx trigger scatterBurst. ex: /sc_trig speed=2',
    '/sc_start // Alias: /fx start scatterBurst. ex: /sc_start speed=2',
    '/rp_trig // Alias: /fx trigger repulsionSwarm. ex: /rp_trig count=3',
    '/rp_start // Alias: /fx start repulsionSwarm. ex: /rp_start radius=3',
    '/gn_trig // Alias: /fx trigger gridNoiseMask. ex: /gn_trig threshold=0.6',
    '/gn_start // Alias: /fx start gridNoiseMask. ex: /gn_start speed=1.4',
    '/le_trig // Alias: /fx trigger letterEmission. ex: /le_trig distribution=random',
    '/le_start // Alias: /fx start letterEmission. ex: /le_start target=both',
    '/fx_bpm <value> // Alias: /fx bpm <value>. ex: /fx_bpm 140',
    'FX time tokens: 0.25s | 2s | 1b | 2b | 1/4 | 1/8'
];

// Debug-only flags (default: off). Keep this as data-only: no side effects.
export const DEBUG_FLAGS = {
    // innerCubes shader patch validation (varying selection + token replacement).
    innerCubesEmissivePatchLog: false
};

// Material Configuration
export const MATERIALS = {
    defaultBox: {
        color: 0x0FFFF0,
        roughness: 0.5,
        metalness: 0.4,
        envMapIntensity: 0.2
    },
    glass: {
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.3,
        transmission: 1.0,
        thickness: 1.0,
        envMapIntensity: 0.4,
        ior: 1.5,
        transparent: true,
        opacity: 1.0
    },
    gold: {
        color: 0xFFD700,
        metalness: 1.0,
        roughness: 0.15,
        envMapIntensity: 0.5
    },
    innerCubes: {
        // Jaśniejsze albedo + silniejszy emissive niż 2.4: czytelna siatka w środku bez „białej plamy” (łagodny lift w shaderze).
        color: 0x5a5a5a,
        envMapIntensity: 0.52,
        roughness: 0.88,
        metalness: 0.06,
        emissive: 0xffffff,
        emissiveIntensity: 4.2,
        toneMapped: false
    }
};

// Shape Definitions for Voxel Grouping
export const SHAPE_DEFINITIONS = [
    { id: '2x2', w: 2, h: 2, d: 1, offsets: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { id: '3x1', w: 3, h: 1, d: 1, offsets: [[0, 0], [1, 0], [2, 0]] },
    { id: '1x3', w: 1, h: 3, d: 1, offsets: [[0, 0], [0, 1], [0, 2]] },
    { id: '2x1', w: 2, h: 1, d: 1, offsets: [[0, 0], [1, 0]] },
    { id: '1x2', w: 1, h: 2, d: 1, offsets: [[0, 0], [0, 1]] },
    { id: '1x1', w: 1, h: 1, d: 1, offsets: [[0, 0]] }
];

// After loader: fly camera from far radius to CONFIG.initialZoom (manual path, ease-in)
export const INTRO_CAMERA_CONFIG = {
    durationMs: 6000,
    /** Must be > CONFIG.initialZoom; keep < camera far plane (0.1..100) */
    startRadius: 45
};

/** UI reveal after intro fly-in ends (terminal lines, prod label, camera HUD). */
export const POST_INTRO_UI_CONFIG = {
    enabled: true,
    menuLineStaggerMs: 52,
    menuLineAnimSec: 0.62,
    uiContainerDelayMs: 60,
    uiContainerAnimSec: 0.52,
    terminalShellDelayMs: 380,
    terminalShellAnimSec: 0.55,
    cameraHudDelayMs: 100,
    cameraHudAnimSec: 0.58,
    prodLabelDelayMs: 240,
    prodLabelAnimSec: 0.72,
    slidePx: 44
};

// Top-left camera HUD (live coords + mode buttons)
export const CAMERA_HUD_CONFIG = {
    coordinateDecimals: 2,
    defaultFov: 45
};

// Performance HUD (FPS + mini graph highs/lows)
export const PERF_HUD_CONFIG = {
    enabled: true,
    updateIntervalMs: 120,
    smoothingAlpha: 0.2,
    graph: {
        width: 180,
        height: 54,
        maxSamples: 72,
        yMaxFps: 60
    },
    thresholds: {
        goodFps: 58,
        warnFps: 45
    }
};

// Cinematic Camera Shots
// Procedural Cinematic Camera Configuration
export const CINEMATIC_CONFIG = {
    // Zakresy kątów (w radianach) - ograniczenie, aby nie wchodzić za tekst (ok. -80 do 80 stopni)
    angleRange: { min: -1.2, max: 1.2 },
    // Zakresy kąta wertykalnego (od dołu do góry)
    vertRange: { min: -0.7, max: 0.7 },
    // Zakresy odległości kamery (zoom)
    radiusRange: { min: 4, max: 15 },
    // Zakresy pola widzenia (FOV) - od teleobiektywu do szerokiego kąta
    fovRange: { min: 25, max: 90 },
    // Mnożnik prędkości ruchu kamery (drift) - wolny vs szybki
    speedMultRange: { min: 0.8, max: 1.8 },
    // Czas trwania ujęcia w milisekundach
    shotDurationRange: { min: 7000, max: 12000 },
    // Czas bezczynności (ms), po którym następuje powrót do kamery dynamicznej
    autoDynamicTimeout: 10000,
    // Opóźnienie początkowe (ms) przed startem kamery dynamicznej
    initialDelay: 10000
};

// Loader Configuration
export const LOADER_CONFIG = {
    phases: {
        assets: { weight: 50, text: "Loading Assets..." },   // wideo w tle + fonty – postęp buforowania widać na pasku (0–50%)
        generation: { weight: 50, text: "Generating Particles..." }
    },
    // Fake loader: pasek ma rosnąć sam (coraz wolniej) i zmieniać opis co sekundę,
    // dopóki aplikacja nie dojdzie realnie do "Ready".
    simulation: {
        enabled: true,
        // Miękki sufit (symulacja dąży do tego, a potem i tak „dociskamy” do 100% przy zakończeniu).
        softCap: 99,
        // Stała czasowa dla podejścia wykładniczego (im większa, tym wolniej).
        tauMs: 5000,
        // Ile ms między podmianą komunikatu.
        messageIntervalMs: 3000,
        // Ile procent „wyprzedzenia” może mieć symulacja względem realnego postępu
        // (żeby pasek nie kończył się zanim realnie dojdzie reszta).
        maxLeadPercentage: 25,
        // Żeby symulacja startowała od 0 bez skoku.
        startPercentage: 0
    },
    messages: {
        assets: [
            "Buffering the universe. Almost there...",
            "Feeding the background video. Shhh...",
            "Warming up fonts and tiny lies...",
            "Scanning for pixels. Please wait...",
            "Feeding the renderer data. Slowly, proudly."
        ],
        generation: [
            "Voxelizing the dream. No questions asked...",
            "Sampling surfaces. Vibes are loading...",
            "Building TOPKEK blocks. Good luck, patience.",
            "Packing cubes into cubes. They approve.",
            "Almost there - keep breathing."
        ],
        ready: [
            "Ready. Please pretend this was instant.",
            "Load complete. KEK is on the way.",
            "Done. The rest is pure magic."
        ]
    },
    colors: {
        background: "#111",
        barBackground: "rgba(255, 255, 255, 0.1)",
        barFill: "#ffffff",
        text: "#ffffff"
    }
};
