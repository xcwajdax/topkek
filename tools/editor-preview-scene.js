/**
 * Minimal Three preview for showcase editor — FOV + optional XZ grid.
 */
import * as THREE from 'three';

const DEFAULT_FOV = 45;

/**
 * @param {HTMLElement} container
 * @param {{ getFovDeg?: () => number, showGrid?: boolean }} opts
 */
export function createEditorPreviewScene(container, opts = {}) {
    let scene;
    let camera;
    let renderer;
    /** @type {THREE.GridHelper | null} */
    let grid = null;
    let showGrid = opts.showGrid !== false;

    function getFovDeg() {
        const g = opts.getFovDeg;
        const v = typeof g === 'function' ? g() : DEFAULT_FOV;
        return Number.isFinite(v) && v > 0 ? v : DEFAULT_FOV;
    }

    function init() {
        const w = container.clientWidth || 640;
        const h = container.clientHeight || 360;
        scene = new THREE.Scene();
        scene.background = null;
        camera = new THREE.PerspectiveCamera(getFovDeg(), w / h, 0.1, 500);
        camera.position.set(0, 2, 42);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.35));
        const d = new THREE.DirectionalLight(0xffffff, 1.1);
        d.position.set(4, 10, 12);
        scene.add(d);

        grid = new THREE.GridHelper(80, 40, 0x2a4a2a, 0x1a2a1a);
        grid.position.y = -2;
        grid.visible = showGrid;
        scene.add(grid);

        window.addEventListener('resize', onResize);
    }

    function onResize() {
        if (!container || !camera || !renderer) return;
        const nw = container.clientWidth;
        const nh = container.clientHeight || 360;
        camera.aspect = nw / nh;
        camera.fov = getFovDeg();
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
    }

    function setGridVisible(v) {
        showGrid = !!v;
        if (grid) grid.visible = showGrid;
    }

    function syncFovFromDoc() {
        if (camera) {
            camera.fov = getFovDeg();
            camera.updateProjectionMatrix();
        }
    }

    function renderFrame() {
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function dispose() {
        window.removeEventListener('resize', onResize);
        if (grid && scene) scene.remove(grid);
        grid = null;
        if (renderer?.domElement?.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer?.dispose();
    }

    return {
        init,
        onResize,
        setGridVisible,
        syncFovFromDoc,
        renderFrame,
        dispose,
        get scene() {
            return scene;
        },
        get camera() {
            return camera;
        },
        get renderer() {
            return renderer;
        }
    };
}
