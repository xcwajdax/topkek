/**
 * Developer panel for terminal FX (FX_CONFIG.registry) — toggled via /fx dev.
 */
import { FX_CONFIG } from './config.js';

/**
 * @param {object} options
 * @param {HTMLElement} options.mountAfter - Element to insert panel after (e.g. terminal log).
 * @param {object} options.api
 * @param {() => { enabled: boolean, bpm: number, defaults: Record<string, Record<string, unknown>> }} options.api.getRuntime
 * @param {(v: boolean) => void} options.api.setEnabled
 * @param {(n: number) => void} options.api.setBpm
 * @param {(effectId: string, key: string, raw: string) => boolean} options.api.applyDefaultKey
 * @param {(effectId: string, mode: 'trigger'|'loop', overrides: Record<string, unknown>) => string[]} options.api.runStart
 * @param {(target: string) => string[]} options.api.runStop
 * @param {(raw: string) => Record<string, unknown>} options.api.parseFxParamsFromParts
 * @param {(data: unknown) => { ok: boolean, error?: string }} options.api.applyPreset
 * @param {() => object} options.api.exportPreset
 * @param {(msg: string) => void} [options.api.log]
 */
export function initFxDevPanel(options) {
    const { mountAfter, api } = options;
    if (!mountAfter?.parentNode || !api) {
        return { toggle: () => {}, isVisible: () => false };
    }

    const log = typeof api.log === 'function' ? api.log : () => {};

    const panel = document.createElement('div');
    panel.className = 'topkek-fx-dev-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'FX developer controls');
    panel.hidden = true;

    const header = document.createElement('div');
    header.className = 'topkek-fx-dev-panel-header';
    const title = document.createElement('div');
    title.className = 'topkek-fx-dev-panel-title';
    title.textContent = 'FX dev';
    header.appendChild(title);

    const globalRow = document.createElement('div');
    globalRow.className = 'topkek-fx-dev-global';

    const lblEn = document.createElement('label');
    lblEn.className = 'topkek-fx-dev-label-inline';
    const chkEn = document.createElement('input');
    chkEn.type = 'checkbox';
    chkEn.id = 'topkek-fx-dev-enabled';
    lblEn.appendChild(chkEn);
    lblEn.appendChild(document.createTextNode(' FX runtime'));

    const lblBpm = document.createElement('label');
    lblBpm.className = 'topkek-fx-dev-label-inline';
    lblBpm.textContent = 'BPM ';
    const inpBpm = document.createElement('input');
    inpBpm.type = 'number';
    inpBpm.className = 'topkek-fx-dev-input-num';
    inpBpm.min = '20';
    inpBpm.max = '300';
    inpBpm.step = '1';
    inpBpm.id = 'topkek-fx-dev-bpm';
    lblBpm.appendChild(inpBpm);

    const btnStopAll = document.createElement('button');
    btnStopAll.type = 'button';
    btnStopAll.className = 'topkek-fx-dev-btn';
    btnStopAll.textContent = 'Stop all';

    globalRow.appendChild(lblEn);
    globalRow.appendChild(lblBpm);
    globalRow.appendChild(btnStopAll);

    const presetRow = document.createElement('div');
    presetRow.className = 'topkek-fx-dev-presets';

    const btnExport = document.createElement('button');
    btnExport.type = 'button';
    btnExport.className = 'topkek-fx-dev-btn';
    btnExport.textContent = 'Export JSON';

    const btnCopy = document.createElement('button');
    btnCopy.type = 'button';
    btnCopy.className = 'topkek-fx-dev-btn';
    btnCopy.textContent = 'Copy';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.className = 'topkek-fx-dev-file';
    fileInput.setAttribute('aria-label', 'Import FX preset from JSON file');

    const pasteTa = document.createElement('textarea');
    pasteTa.className = 'topkek-fx-dev-paste';
    pasteTa.rows = 2;
    pasteTa.placeholder = 'Paste preset JSON…';
    pasteTa.setAttribute('aria-label', 'Paste preset JSON');

    const btnImportPaste = document.createElement('button');
    btnImportPaste.type = 'button';
    btnImportPaste.className = 'topkek-fx-dev-btn';
    btnImportPaste.textContent = 'Apply paste';

    presetRow.appendChild(btnExport);
    presetRow.appendChild(btnCopy);
    presetRow.appendChild(fileInput);
    presetRow.appendChild(pasteTa);
    presetRow.appendChild(btnImportPaste);

    const effectsWrap = document.createElement('div');
    effectsWrap.className = 'topkek-fx-dev-effects';

    /** @type {Map<string, HTMLInputElement[]>} */
    const paramInputs = new Map();

    const registry = FX_CONFIG?.registry || {};
    Object.entries(registry).forEach(([effectId, cfg]) => {
        const section = document.createElement('section');
        section.className = 'topkek-fx-dev-effect';
        const h = document.createElement('h4');
        h.className = 'topkek-fx-dev-effect-title';
        h.textContent = cfg.label || effectId;
        section.appendChild(h);

        const btnRow = document.createElement('div');
        btnRow.className = 'topkek-fx-dev-btns';
        const btnTrig = document.createElement('button');
        btnTrig.type = 'button';
        btnTrig.className = 'topkek-fx-dev-btn';
        btnTrig.textContent = 'Trigger';
        const btnLoop = document.createElement('button');
        btnLoop.type = 'button';
        btnLoop.className = 'topkek-fx-dev-btn';
        btnLoop.textContent = 'Start loop';
        const btnStop = document.createElement('button');
        btnStop.type = 'button';
        btnStop.className = 'topkek-fx-dev-btn';
        btnStop.textContent = 'Stop';
        btnRow.appendChild(btnTrig);
        btnRow.appendChild(btnLoop);
        btnRow.appendChild(btnStop);
        section.appendChild(btnRow);

        const grid = document.createElement('div');
        grid.className = 'topkek-fx-dev-fields';

        const defaults = cfg.defaults || {};
        const ranges = cfg.ranges || {};
        const keys = Object.keys(defaults);
        const inputsForEffect = [];

        keys.forEach((key) => {
            const row = document.createElement('div');
            row.className = 'topkek-fx-dev-field';
            const lab = document.createElement('label');
            lab.className = 'topkek-fx-dev-field-label';
            lab.textContent = key;
            const inp = document.createElement('input');
            inp.dataset.fxEffect = effectId;
            inp.dataset.fxKey = key;
            const range = ranges[key];
            if (range && typeof range.min === 'number' && typeof range.max === 'number') {
                inp.type = 'number';
                inp.min = String(range.min);
                inp.max = String(range.max);
                inp.step = range.max - range.min > 5 ? '0.05' : '0.01';
                inp.className = 'topkek-fx-dev-input-num';
            } else {
                inp.type = 'text';
                inp.className = 'topkek-fx-dev-input-text';
            }
            inp.addEventListener('change', () => {
                const ok = api.applyDefaultKey(effectId, key, inp.value);
                if (!ok) log(`FX dev: invalid value for ${effectId}.${key}`);
            });
            inputsForEffect.push(inp);
            row.appendChild(lab);
            row.appendChild(inp);
            grid.appendChild(row);
        });

        paramInputs.set(effectId, inputsForEffect);

        btnTrig.addEventListener('click', () => {
            const overrides = collectOverrides(effectId);
            const lines = api.runStart(effectId, 'trigger', overrides);
            lines.forEach((l) => log(l));
        });
        btnLoop.addEventListener('click', () => {
            const overrides = collectOverrides(effectId);
            const lines = api.runStart(effectId, 'loop', overrides);
            lines.forEach((l) => log(l));
        });
        btnStop.addEventListener('click', () => {
            api.runStop(effectId).forEach((l) => log(l));
        });

        section.appendChild(grid);
        effectsWrap.appendChild(section);
    });

    panel.appendChild(header);
    panel.appendChild(globalRow);
    panel.appendChild(presetRow);
    panel.appendChild(effectsWrap);

    mountAfter.parentNode.insertBefore(panel, mountAfter.nextSibling);

    function collectOverrides(effectId) {
        const inputs = paramInputs.get(effectId) || [];
        const parts = [];
        inputs.forEach((inp) => {
            const key = inp.dataset.fxKey;
            if (key) parts.push(`${key}=${inp.value}`);
        });
        return api.parseFxParamsFromParts(parts);
    }

    function syncFromRuntime() {
        const rt = api.getRuntime();
        chkEn.checked = !!rt.enabled;
        inpBpm.value = String(Math.round(rt.bpm));
        Object.keys(registry).forEach((effectId) => {
            const defs = rt.defaults[effectId] || {};
            const inputs = paramInputs.get(effectId) || [];
            inputs.forEach((inp) => {
                const k = inp.dataset.fxKey;
                if (k == null) return;
                const v = defs[k];
                if (v === undefined || v === null) inp.value = '';
                else inp.value = typeof v === 'object' ? JSON.stringify(v) : String(v);
            });
        });
    }

    chkEn.addEventListener('change', () => {
        api.setEnabled(chkEn.checked);
    });
    inpBpm.addEventListener('change', () => {
        const n = parseFloat(inpBpm.value);
        if (Number.isFinite(n)) api.setBpm(n);
        syncFromRuntime();
    });
    btnStopAll.addEventListener('click', () => {
        api.runStop('all').forEach((l) => log(l));
    });

    function downloadJson(obj) {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const d = new Date();
        const pad = (x) => String(x).padStart(2, '0');
        a.download = `topkek-fx-preset-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    btnExport.addEventListener('click', () => {
        downloadJson(api.exportPreset());
        log('FX dev: preset exported (download).');
    });

    btnCopy.addEventListener('click', async () => {
        const text = JSON.stringify(api.exportPreset(), null, 2);
        try {
            await navigator.clipboard.writeText(text);
            log('FX dev: preset copied to clipboard.');
        } catch {
            log('FX dev: clipboard failed.');
        }
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(String(reader.result || '{}'));
                const res = api.applyPreset(data);
                if (res.ok) {
                    syncFromRuntime();
                    log('FX dev: preset imported from file.');
                } else {
                    log(`FX dev: import failed — ${res.error || 'unknown'}`);
                }
            } catch (e) {
                log(`FX dev: import parse error — ${e?.message || e}`);
            }
        };
        reader.readAsText(file);
    });

    btnImportPaste.addEventListener('click', () => {
        try {
            const data = JSON.parse(pasteTa.value.trim() || '{}');
            const res = api.applyPreset(data);
            if (res.ok) {
                syncFromRuntime();
                log('FX dev: preset applied from paste.');
            } else {
                log(`FX dev: import failed — ${res.error || 'unknown'}`);
            }
        } catch (e) {
            log(`FX dev: import parse error — ${e?.message || e}`);
        }
    });

    let visible = false;

    function toggle() {
        visible = !visible;
        panel.hidden = !visible;
        panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (visible) syncFromRuntime();
    }

    function isVisible() {
        return visible;
    }

    syncFromRuntime();

    return { toggle, isVisible, syncFromRuntime };
}
