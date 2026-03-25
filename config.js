import * as THREE from 'three';

// Device Detection
export const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

// Tryb wydajności: `?perf=lite|full|auto`, potem localStorage (`storageKey`), domyślnie auto + heurystyka
export const PERFORMANCE_CONFIG = {
    storageKey: 'topkek-performance',
    urlParam: 'perf',
    autoLiteMaxDeviceMemoryGb: 4,
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
    particleCount: 0, // Will be determined by sampler
    targetCubeCount: IS_MOBILE ? 15000 : 50000, // Reduced particle count for mobile
    particlesFile: IS_MOBILE ? 'particles_mobile.json' : 'particles_pc.json', // File to load particles from
    repulsionRadius: 3, // Increased radius
    repulsionStrength: 4,
    returnSpeed: 0.2,
    sampleDensity: 1, // Points per unit area (increase for more dense voxels)
    letterSpacing: 0.5, // Extra spacing between letters
    animationMode: 'repulsion', // 'repulsion', 'scatter', or 'grid'
    gridCols: 10, // For grid calculation
    gridSpacing: 2,
    shadowMapSize: IS_MOBILE ? 128 : 2048, // Reduced shadow map size for mobile
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
            'ASSETS/BGs/01_torus.mp4',
            'ASSETS/BGs/02_bag_1.mp4',
            'ASSETS/BGs/06_kostki_02.mp4'
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
            intervalMs: IS_MOBILE ? 0 : 320,
            /** Promień rozmycia w radianach — Three.js ogranicza ~20 próbek; >~0.1 zwykle klipuje (konsola). */
            sigma: 0.04
        },
        hemisphereFromVideo: {
            enabled: true,
            /** true na desktopie = zapasowy fill z kolorem wideo, gdy PMREM/ACES psuje jasność */
            always: !IS_MOBILE,
            intensity: 0.85,
            ambientIntensity: 0.32,
            intervalMs: 420,
            canvasWidth: 32,
            canvasHeight: 64
        },
        /** Mnożniki envMapIntensity względem MATERIALS.* (żeby widać dynamiczne IBL) */
        envMapIntensityBoost: {
            defaultBox: 2.4,
            glass: 2.0,
            gold: 2.2,
            innerCubes: 2.0,
            heart: 1.35,
            vajbujBgCubes: 2.0
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
    intervalMin: 2000,   // ms – min odstęp auto-triggera
    intervalMax: 5000,   // ms – max odstęp auto-triggera
    duration: 0.12,      // s – jak długo offset jest widoczny
    maxOffset: 0.4,      // maks. przesunięcie na oś
    bandCount: 8,        // na ile pasów (X) dzielimy napis (pattern 'bands')
    bandsPerGlitch: 2,   // ile pasów jednocześnie glitchować
    includeInnerCubes: true,

    // Wspólne opcje zachowania
    pattern: 'bands', // 'bands' | 'grid2d' | 'clusters'
    useRotation: false,
    useScale: false,
    useColorFlicker: false,

    // Rotacja i skala
    rotationMaxAngle: Math.PI / 4,
    scaleMin: 0.9,
    scaleMax: 1.15,

    // Parametry dla patternu 'grid2d'
    gridCols: 4,
    gridRows: 3,
    tilesPerGlitch: 1,

    // Parametry dla patternu 'clusters'
    clusterFraction: 0.05,
    clusterMinCount: 50,
    clusterMaxCount: 500,

    // Kolor – używane w drugiej iteracji (color flicker)
    colorFlickerStrength: 0.2
};

// Presety zachowania glitch volumetrycznego
export const GLITCH_VOLUME_PRESETS = {
    subtelny: {
        pattern: 'bands',
        duration: 0.08,
        maxOffset: 0.25,
        bandsPerGlitch: 1,
        tilesPerGlitch: 1,
        clusterFraction: 0.02,
        intervalMin: 2200,
        intervalMax: 5200,
        useRotation: false,
        useScale: false,
        useColorFlicker: false
    },
    mocny: {
        pattern: 'grid2d',
        duration: 0.14,
        maxOffset: 0.45,
        bandsPerGlitch: 2,
        tilesPerGlitch: 2,
        clusterFraction: 0.06,
        intervalMin: 1800,
        intervalMax: 4200,
        useRotation: true,
        useScale: true,
        useColorFlicker: false
    },
    chaos: {
        pattern: 'clusters',
        duration: 0.1,
        maxOffset: 0.6,
        bandsPerGlitch: 3,
        tilesPerGlitch: 3,
        clusterFraction: 0.15,
        intervalMin: 1200,
        intervalMax: 3200,
        useRotation: true,
        useScale: true,
        useColorFlicker: true
    }
};

export const GLITCH_VOLUME_STATE = {
    currentPreset: 'subtelny'
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
        metalness: 0.2,
        roughness: 0.8
    },

    // Tempo dynamics
    slowPhaseEnd: 0.48, // 48% - when slow phase ends
    slowPhaseSpeed: 0.15, // 15% speed during slow phase

    // Final question mark
    finalSymbol: "?",
    finalSymbolColor: 0xff0000, // red
    finalSymbolScale: 2.0
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
        threshold: 0.3,
        strength: 1, // Domyślna siła bloom
        alternateStrength: 0.3, // Siła bloom po naciśnięciu spacji
        radius: 1
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
        color: 0xffffff,
        roughness: 0,
        metalness: 0,
        emissiveIntensity: 0.1
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
    colors: {
        background: "#111",
        barBackground: "rgba(255, 255, 255, 0.1)",
        barFill: "#ffffff",
        text: "#ffffff"
    }
};
