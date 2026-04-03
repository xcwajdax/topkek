/**
 * Timeline (60 FPS labels), transform keyframe drag, visibility range, playhead.
 * Zoom = multiplier × (viewportWidth / duration); min multiplier = fit (no horizontal scroll).
 */

export const SHOWCASE_TIMELINE_FPS = 60;

const ZOOM_MUL_MIN = 1;
const ZOOM_MUL_MAX = 8;

/**
 * @param {object} ctx
 * @param {HTMLElement} ctx.viewport
 * @param {HTMLElement} ctx.inner
 * @param {HTMLElement} ctx.ruler
 * @param {HTMLElement} ctx.trackKeyframes
 * @param {HTMLElement} ctx.playhead
 * @param {HTMLElement} ctx.kfBand
 * @param {HTMLElement} ctx.visRange
 * @param {() => number} ctx.getDurationSec
 * @param {() => number} ctx.getFragmentTime
 * @param {(t: number) => void} ctx.seekFragmentTime
 * @param {() => boolean} ctx.getSnapToFrame
 * @param {() => import('../src/showcase/showcase-animation-schema.js').ShowcaseTransformKeyframe[] | null} ctx.getKeyframes
 * @param {(index: number, t: number) => void} ctx.onKeyframeMoved
 * @param {() => void} ctx.onRedraw
 * @param {() => { from: number | null, to: number | null }} ctx.getVisibilityRange
 * @param {(from: number | null, to: number | null) => void} ctx.setVisibilityRange
 * @param {() => number} [ctx.getViewportInnerWidth] — width available for timeline (default: viewport.clientWidth)
 * @param {(mul: number) => void} [ctx.onZoomMultiplierChange]
 */
export function attachShowcaseTimeline(ctx) {
    const {
        viewport,
        inner,
        ruler,
        trackKeyframes,
        playhead,
        kfBand,
        visRange,
        getDurationSec,
        getFragmentTime,
        seekFragmentTime,
        getSnapToFrame,
        getKeyframes,
        onKeyframeMoved,
        onRedraw,
        getVisibilityRange,
        setVisibilityRange
    } = ctx;

    /** @type {number} */
    let zoomMul = 1;
    let dragKf = /** @type {{ idx: number, startX: number, startT: number } | null} */ (null);
    let dragVis = /** @type {'from' | 'to' | 'move' | null} */ (null);
    let visDragStart = /** @type {{ x: number, from: number, to: number } | null} */ (null);
    let mmbPan = /** @type {{ x: number, scrollLeft: number } | null} */ (null);

    function viewportInnerW() {
        const g = ctx.getViewportInnerWidth;
        const w = typeof g === 'function' ? g() : viewport.clientWidth;
        return Math.max(32, w);
    }

    function fitPxPerSec() {
        const d = Math.max(0.001, getDurationSec());
        return viewportInnerW() / d;
    }

    function effectivePxPerSec() {
        return fitPxPerSec() * zoomMul;
    }

    function snapT(t) {
        if (!getSnapToFrame()) return t;
        return Math.round(t * SHOWCASE_TIMELINE_FPS) / SHOWCASE_TIMELINE_FPS;
    }

    function tFromClientX(clientX) {
        const d = Math.max(1e-6, getDurationSec());
        const rect = inner.getBoundingClientRect();
        const x = clientX - rect.left;
        const u = Math.max(0, Math.min(1, x / rect.width));
        return snapT(u * d);
    }

    function clampZoomMul(m) {
        return Math.max(ZOOM_MUL_MIN, Math.min(ZOOM_MUL_MAX, m));
    }

    function redraw() {
        const d = Math.max(0.001, getDurationSec());
        const pxPerSec = effectivePxPerSec();
        const w = d * pxPerSec;
        inner.style.width = `${w}px`;

        const vpW = viewport.clientWidth;
        if (w <= vpW + 0.5) {
            viewport.scrollLeft = 0;
        }

        ruler.innerHTML = '';
        const major = Math.max(1, Math.floor(80 / pxPerSec));
        for (let s = 0; s <= d + 1e-6; s += major) {
            const tick = document.createElement('div');
            tick.className = 'timeline-tick';
            tick.style.left = `${(s / d) * w}px`;
            const fr = Math.round(s * SHOWCASE_TIMELINE_FPS);
            tick.title = `${s.toFixed(2)}s · ${fr}f`;
            const lab = document.createElement('span');
            lab.className = 'timeline-tick-label';
            lab.textContent = `${fr}f`;
            tick.appendChild(lab);
            ruler.appendChild(tick);
        }

        trackKeyframes.innerHTML = '';
        const kfs = getKeyframes();
        if (kfs && kfs.length) {
            const t0 = Math.min(...kfs.map((k) => k.t));
            const t1 = Math.max(...kfs.map((k) => k.t));
            kfBand.style.display = 'block';
            kfBand.style.left = `${(t0 / d) * w}px`;
            kfBand.style.width = `${((t1 - t0) / d) * w}px`;
        } else {
            kfBand.style.display = 'none';
        }

        if (kfs) {
            kfs.forEach((kf, idx) => {
                const el = document.createElement('button');
                el.type = 'button';
                el.className = 'timeline-kf-diamond';
                el.style.left = `${(kf.t / d) * w}px`;
                el.title = `t=${kf.t.toFixed(3)}s`;
                el.dataset.idx = String(idx);
                el.addEventListener('pointerdown', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    try {
                        el.setPointerCapture(ev.pointerId);
                    } catch {
                        /* ignore */
                    }
                    dragKf = { idx, startX: ev.clientX, startT: kf.t };
                });
                el.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    ctx.onKeyframeClick?.(idx);
                });
                trackKeyframes.appendChild(el);
            });
        }

        const vr = getVisibilityRange();
        if (vr.from != null && vr.to != null && vr.to > vr.from) {
            visRange.style.display = 'block';
            visRange.style.left = `${(vr.from / d) * w}px`;
            visRange.style.width = `${((vr.to - vr.from) / d) * w}px`;
        } else {
            visRange.style.display = 'none';
        }

        const t = getFragmentTime();
        playhead.style.left = `${(Math.min(d, Math.max(0, t)) / d) * w}px`;

        onRedraw?.();
    }

    function onKfPointerMove(ev) {
        if (!dragKf) return;
        const d = Math.max(1e-6, getDurationSec());
        const w = d * effectivePxPerSec();
        const dx = ev.clientX - dragKf.startX;
        const dt = (dx / w) * d;
        let nt = dragKf.startT + dt;
        nt = Math.max(0, Math.min(d, snapT(nt)));
        onKeyframeMoved(dragKf.idx, nt);
        redraw();
    }

    function clearKfDrag() {
        dragKf = null;
    }

    viewport.addEventListener('pointermove', onKfPointerMove);
    viewport.addEventListener('pointerup', clearKfDrag);
    viewport.addEventListener('pointercancel', clearKfDrag);
    window.addEventListener('pointerup', clearKfDrag);
    window.addEventListener('pointercancel', clearKfDrag);

    inner.addEventListener('click', (ev) => {
        if (ev.button !== 0) return;
        if ((ev.target).closest('.timeline-kf-diamond')) return;
        seekFragmentTime(tFromClientX(ev.clientX));
        redraw();
    });

    viewport.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 1) return;
        ev.preventDefault();
        mmbPan = { x: ev.clientX, scrollLeft: viewport.scrollLeft };
        try {
            viewport.setPointerCapture(ev.pointerId);
        } catch {
            /* ignore */
        }
    });

    viewport.addEventListener('pointermove', (ev) => {
        if (!mmbPan) return;
        if (!(ev.buttons & 4)) {
            mmbPan = null;
            return;
        }
        viewport.scrollLeft = mmbPan.scrollLeft - (ev.clientX - mmbPan.x);
    });

    viewport.addEventListener('pointerup', (ev) => {
        if (ev.button === 1) mmbPan = null;
    });
    viewport.addEventListener('pointercancel', () => {
        mmbPan = null;
    });

    viewport.addEventListener('auxclick', (ev) => {
        if (ev.button === 1) ev.preventDefault();
    });

    viewport.addEventListener(
        'wheel',
        (ev) => {
            ev.preventDefault();
            const d = Math.max(0.001, getDurationSec());
            const vpRect = viewport.getBoundingClientRect();
            const W0 = d * effectivePxPerSec();
            const S0 = viewport.scrollLeft;
            const xInContent = S0 + (ev.clientX - vpRect.left);
            const u = W0 > 0 ? xInContent / W0 : 0;

            const step = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
            const next = clampZoomMul(zoomMul * step);
            if (next === zoomMul) return;
            zoomMul = next;

            redraw();

            const W1 = d * effectivePxPerSec();
            const newScroll = u * W1 - (ev.clientX - vpRect.left);
            const maxScroll = Math.max(0, W1 - viewport.clientWidth);
            viewport.scrollLeft = Math.max(0, Math.min(maxScroll, newScroll));

            ctx.onZoomMultiplierChange?.(zoomMul);
        },
        { passive: false }
    );

    visRange.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        const vr = getVisibilityRange();
        if (vr.from == null || vr.to == null) return;
        const rect = visRange.getBoundingClientRect();
        const edge = 8;
        if (ev.clientX < rect.left + edge) dragVis = 'from';
        else if (ev.clientX > rect.right - edge) dragVis = 'to';
        else dragVis = 'move';
        visDragStart = { x: ev.clientX, from: vr.from, to: vr.to };
        visRange.setPointerCapture(ev.pointerId);
    });

    visRange.addEventListener('pointermove', (ev) => {
        if (!dragVis || !visDragStart) return;
        const d = Math.max(1e-6, getDurationSec());
        const w = d * effectivePxPerSec();
        const dt = ((ev.clientX - visDragStart.x) / w) * d;
        let from = visDragStart.from;
        let to = visDragStart.to;
        if (dragVis === 'from') {
            from = snapT(Math.max(0, Math.min(to - 0.01, from + dt)));
        } else if (dragVis === 'to') {
            to = snapT(Math.min(d, Math.max(from + 0.01, to + dt)));
        } else {
            const span = to - from;
            from = snapT(Math.max(0, Math.min(d - span, from + dt)));
            to = from + span;
        }
        setVisibilityRange(from, to);
        redraw();
    });

    visRange.addEventListener('pointerup', () => {
        dragVis = null;
        visDragStart = null;
    });

    return {
        redraw,
        refit() {
            redraw();
        },
        setZoomMultiplier(m) {
            zoomMul = clampZoomMul(m);
            redraw();
            ctx.onZoomMultiplierChange?.(zoomMul);
        },
        getZoomMultiplier() {
            return zoomMul;
        },
        getFitPxPerSec() {
            return fitPxPerSec();
        },
        /** @deprecated use setZoomMultiplier */
        setPxPerSec(v) {
            const fit = fitPxPerSec();
            if (fit > 1e-9) zoomMul = clampZoomMul(v / fit);
            redraw();
            ctx.onZoomMultiplierChange?.(zoomMul);
        },
        getPxPerSec() {
            return effectivePxPerSec();
        }
    };
}
