/**
 * Shared voxel text mesh + background lyric voxelization queue (VAJBUJ / MYSEN).
 */
import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { CONFIG } from './config.js';

export function createVoxelWord(wordData, font, voxelCache, voxelStyle) {
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

    const centerX = width / 2;
    cubes.forEach(cube => {
        cube.targetPos.x -= centerX;
        cube.scatterPos.x -= centerX;
        cube.currentPos.x -= centerX;
    });

    return {
        mesh: instancedMesh,
        cubes: cubes,
        width: width
    };
}

export function voxelStyleFromMusicConfig(config) {
    return {
        wordSize: config.wordSize,
        wordHeight: config.wordHeight,
        wordThickness: config.wordThickness,
        scatterRadius: config.scatterRadius,
        defaultWordColor: config.defaultWordColor
    };
}

export function queueLyricVoxelPregeneration(lyrics, font, state, lyricsConfig, logLabel) {
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

export function createVoxelGenerationTask(word, scale, font, voxelCache, styleSlice) {
    let step = 0;
    let width = 0;
    let voxelMap = new Map();
    let gx, gy, minX, maxX, minY, maxY;
    let textGeo, mesh;
    const scanRaycaster = new THREE.Raycaster();
    const voxelSize = CONFIG.particleSize;

    return () => {
        if (step === 0) {
            const cacheKey = `${word}_${scale}`;
            if (voxelCache[cacheKey]) return true;

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
            mesh.updateMatrixWorld();

            minX = Math.floor(textGeo.boundingBox.min.x / voxelSize);
            maxX = Math.ceil(textGeo.boundingBox.max.x / voxelSize);
            minY = Math.floor(textGeo.boundingBox.min.y / voxelSize);
            maxY = Math.ceil(textGeo.boundingBox.max.y / voxelSize);

            gx = minX;
            gy = minY;
            step = 1;
            return false;
        }

        if (step === 1) {
            const scanDir = new THREE.Vector3(0, 0, -1);
            let iterations = 0;

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
                gy = minY;
                gx++;

                iterations++;
                if (iterations > 10) {
                    return false;
                }
            }

            step = 2;
            return false;
        }

        if (step === 2) {
            const positions = Array.from(voxelMap.values()).map(v => new THREE.Vector3(v.x, v.y, v.z));

            voxelCache[`${word}_${scale}`] = {
                positions: positions,
                width: width
            };

            if (textGeo) textGeo.dispose();

            return true;
        }
    };
}
