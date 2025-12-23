import * as THREE from 'three';

// Device Detection
export const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

// Text & Particle Configuration
export const CONFIG = {
    text: IS_MOBILE ? "K" : "TOPKEK",
    textSize: IS_MOBILE ? 2.5 : 3, // Smaller text on mobile
    textHeight: IS_MOBILE ? 0.1 : 0.5,
    particleSize: 0.1,
    particleCount: 0, // Will be determined by sampler
    targetCubeCount: IS_MOBILE ? 15000 : 50000, // Reduced particle count for mobile
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
    maxZoom: 20, // Maximum camera distance
    panSpeed: 0.02, // Speed of panning with middle mouse
    subtitle: {
        text: "PRODUCTIONS",
        size: 0.8, // Much smaller than main text
        height: 0.12, // Thickness for geometry (not used for particles directly if hardcoded)
        offsetY: -4, // Position below main text
        thickness: 2, // Voxel thickness
        letterSpacing: 0.7
    },
    appstainPassword: "LOL" // Password for APPSTAIN modal
};

// Shader Configuration
export const SHADER_CONFIG = {
    crt: {
        curvature: new THREE.Vector2(0.5, 0.40), // 1.0 = flat
        lineWidth: 0.1
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
        assets: { weight: 20, text: "Loading Assets..." }, // HDRI, Font
        generation: { weight: 80, text: "Generating Particles..." } // Voxelization & Mesh creation
    },
    colors: {
        background: "#111",
        barBackground: "rgba(255, 255, 255, 0.1)",
        barFill: "#ffffff",
        text: "#ffffff"
    }
};
