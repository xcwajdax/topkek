/**
 * Developer panel for terminal FX (FX_CONFIG.registry) — toggled via /fx dev.
 * Top-centered menubar + [ Active | editor ].
 */
import { FX_CONFIG, FX_SAMPLE_PRESETS } from './config.js';

function formatFxDefaultForInput(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Number.isInteger(value) ? String(value) : String(value);
    }
    return String(value);
}

function numberInputStep(range) {
    if (!range || typeof range.min !== 'number' || typeof range.max !== 'number') return '0.01';
    const span = range.max - range.min;
    if (Number.isInteger(range.min) && Number.isInteger(range.max) && span <= 24 && span >= 0) {
        return '1';
    }
    return span > 5 ? '0.05' : '0.01';
}

function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function formatInstanceParamValue(value) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

/**
 * @param {object} options
 * @param {HTMLElement} [options.mountRoot]
 * @param {object} options.api
 */
export function initFxDevPanel(options) {
    const mountRoot = options.mountRoot || (typeof document !== 'undefined' ? document.body : null);
    const { api } = options;
    if (!mountRoot || !api) {
        return { toggle: () => {}, isVisible: () => false, syncFromRuntime: () => {} };
    }

    const log = typeof api.log === 'function' ? api.log : () => {};

    /** @type {Set<string>} */
    const expandedActiveParamsIds = new Set();

    const shell = document.createElement('div');
    shell.className = 'topkek-fx-dev-shell';
    shell.hidden = true;
    shell.setAttribute('aria-label', 'FX developer');

    const menubar = document.createElement('div');
    menubar.className = 'topkek-fx-dev-menubar';
    const menubarTitle = document.createElement('span');
    menubarTitle.className = 'topkek-fx-dev-menubar-title';
    menubarTitle.textContent = 'FX Dev';
    const btnMin = document.createElement('button');
    btnMin.type = 'button';
    btnMin.className = 'topkek-fx-dev-menubar-btn';
    btnMin.textContent = 'Minimize';
    btnMin.setAttribute('aria-label', 'Minimize panel');
    const btnExportAll = document.createElement('button');
    btnExportAll.type = 'button';
    btnExportAll.className = 'topkek-fx-dev-menubar-btn';
    btnExportAll.textContent = 'Export all';
    btnExportAll.title = 'Full JSON preset (BPM, all effect defaults)';
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'topkek-fx-dev-close';
    btnClose.setAttribute('aria-label', 'Close (click twice)');
    btnClose.title = 'Close — click once to arm (red), again to close';
    btnClose.innerHTML = '&times;';
    menubar.appendChild(menubarTitle);
    menubar.appendChild(btnMin);
    menubar.appendChild(btnExportAll);
    menubar.appendChild(btnClose);

    const bodyRow = document.createElement('div');
    bodyRow.className = 'topkek-fx-dev-body';

    const activePanel = document.createElement('aside');
    activePanel.className = 'topkek-fx-dev-active';
    activePanel.setAttribute('aria-label', 'Active FX instances');

    const activeTitle = document.createElement('div');
    activeTitle.className = 'topkek-fx-dev-active-title';
    activeTitle.textContent = 'Active';
    const activeListEl = document.createElement('div');
    activeListEl.className = 'topkek-fx-dev-active-list topkek-fx-dev-scroll';

    const addBlock = document.createElement('div');
    addBlock.className = 'topkek-fx-dev-add';
    const addLabel = document.createElement('div');
    addLabel.className = 'topkek-fx-dev-add-label';
    addLabel.textContent = 'Add loop preset';
    const addRow = document.createElement('div');
    addRow.className = 'topkek-fx-dev-add-row';
    const addSelect = document.createElement('select');
    addSelect.className = 'topkek-fx-dev-input topkek-fx-dev-select';
    addSelect.setAttribute('aria-label', 'Effect for sample preset');
    const presetSelect = document.createElement('select');
    presetSelect.className = 'topkek-fx-dev-input topkek-fx-dev-select';
    presetSelect.setAttribute('aria-label', 'Sample preset');

    const registry = FX_CONFIG?.registry || {};
    const effectIds = Object.keys(registry);
    effectIds.forEach((id) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = registry[id].label || id;
        addSelect.appendChild(opt);
    });

    function syncPresetSelectForEffect(effectId) {
        presetSelect.textContent = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = 'Select preset…';
        presetSelect.appendChild(ph);
        const list = FX_SAMPLE_PRESETS[effectId] || [];
        list.forEach((entry, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            opt.textContent = entry.label;
            presetSelect.appendChild(opt);
        });
    }

    addSelect.addEventListener('change', () => syncPresetSelectForEffect(addSelect.value));
    syncPresetSelectForEffect(effectIds[0] || '');

    const btnAddLoop = document.createElement('button');
    btnAddLoop.type = 'button';
    btnAddLoop.className = 'topkek-fx-dev-btn mode-btn topkek-fx-dev-add-loop';
    btnAddLoop.textContent = 'Add loop';
    btnAddLoop.addEventListener('click', () => {
        const effectId = addSelect.value;
        const raw = presetSelect.value;
        if (!effectId || raw === '') return;
        const idx = parseInt(raw, 10);
        if (!Number.isFinite(idx)) return;
        const list = FX_SAMPLE_PRESETS[effectId] || [];
        const entry = list[idx];
        if (!entry) return;
        const lines = api.runStart(effectId, 'loop', entry.params || {});
        lines.forEach((l) => log(l));
        presetSelect.value = '';
        refreshActiveList();
    });

    addRow.appendChild(addSelect);
    addRow.appendChild(presetSelect);
    addRow.appendChild(btnAddLoop);

    addBlock.appendChild(addLabel);
    addBlock.appendChild(addRow);

    activePanel.appendChild(activeTitle);
    activePanel.appendChild(activeListEl);
    activePanel.appendChild(addBlock);

    const panel = document.createElement('div');
    panel.className = 'topkek-fx-dev-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'FX parameters');

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
    inpBpm.className = 'topkek-fx-dev-input topkek-fx-dev-input-num';
    inpBpm.min = '20';
    inpBpm.max = '300';
    inpBpm.step = '1';
    inpBpm.id = 'topkek-fx-dev-bpm';
    inpBpm.title = '20–300';
    lblBpm.appendChild(inpBpm);

    const btnStopAll = document.createElement('button');
    btnStopAll.type = 'button';
    btnStopAll.className = 'topkek-fx-dev-btn mode-btn';
    btnStopAll.textContent = 'Stop all';

    globalRow.appendChild(lblEn);
    globalRow.appendChild(lblBpm);
    globalRow.appendChild(btnStopAll);

    const presetRow = document.createElement('div');
    presetRow.className = 'topkek-fx-dev-presets-compact';

    const fileWrap = document.createElement('div');
    fileWrap.className = 'topkek-fx-dev-file-wrap';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.className = 'topkek-fx-dev-file-input';
    fileInput.setAttribute('aria-label', 'Import JSON file');
    const btnChooseFile = document.createElement('button');
    btnChooseFile.type = 'button';
    btnChooseFile.className = 'topkek-fx-dev-btn mode-btn topkek-fx-dev-choose-file';
    btnChooseFile.textContent = 'Choose file';
    btnChooseFile.addEventListener('click', () => fileInput.click());
    fileWrap.appendChild(fileInput);
    fileWrap.appendChild(btnChooseFile);

    const pasteTa = document.createElement('textarea');
    pasteTa.className = 'topkek-fx-dev-paste';
    pasteTa.rows = 2;
    pasteTa.placeholder = 'Paste JSON…';
    pasteTa.setAttribute('aria-label', 'Paste preset JSON');

    const btnImportPaste = document.createElement('button');
    btnImportPaste.type = 'button';
    btnImportPaste.className = 'topkek-fx-dev-btn mode-btn';
    btnImportPaste.textContent = 'Apply';

    presetRow.appendChild(fileWrap);
    presetRow.appendChild(pasteTa);
    presetRow.appendChild(btnImportPaste);

    const effectsWrap = document.createElement('div');
    effectsWrap.className = 'topkek-fx-dev-effects topkek-fx-dev-scroll';

    /** @type {Map<string, HTMLInputElement[]>} */
    const paramInputs = new Map();

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
        btnTrig.className = 'topkek-fx-dev-btn mode-btn';
        btnTrig.textContent = 'Trigger';
        const btnLoop = document.createElement('button');
        btnLoop.type = 'button';
        btnLoop.className = 'topkek-fx-dev-btn mode-btn';
        btnLoop.textContent = 'Loop';
        const btnStop = document.createElement('button');
        btnStop.type = 'button';
        btnStop.className = 'topkek-fx-dev-btn mode-btn';
        btnStop.textContent = 'Stop';
        btnRow.appendChild(btnTrig);
        btnRow.appendChild(btnLoop);
        btnRow.appendChild(btnStop);
        section.appendChild(btnRow);

        const paramsRoot = document.createElement('div');
        paramsRoot.className = 'topkek-fx-dev-params';

        const defaults = cfg.defaults || {};
        const ranges = cfg.ranges || {};
        const paramHints = cfg.paramHints || {};
        const keys = Object.keys(defaults);
        const inputsForEffect = [];

        for (let i = 0; i < keys.length; i += 3) {
            const line = document.createElement('div');
            line.className = 'topkek-fx-dev-param-line';
            for (let k = 0; k < 3; k++) {
                const idx = i + k;
                const slot = document.createElement('div');
                slot.className = 'topkek-fx-dev-param-slot';
                if (idx >= keys.length) {
                    slot.classList.add('topkek-fx-dev-param-slot--empty');
                    line.appendChild(slot);
                    continue;
                }
                const key = keys[idx];
                const lab = document.createElement('label');
                lab.className = 'topkek-fx-dev-field-label';
                lab.textContent = key;
                lab.title = key;
                const inp = document.createElement('input');
                inp.dataset.fxEffect = effectId;
                inp.dataset.fxKey = key;
                const range = ranges[key];
                if (range && typeof range.min === 'number' && typeof range.max === 'number') {
                    inp.type = 'number';
                    inp.min = String(range.min);
                    inp.max = String(range.max);
                    inp.step = numberInputStep(range);
                    inp.title = `${range.min}–${range.max}`;
                    inp.className = 'topkek-fx-dev-input topkek-fx-dev-input-num';
                } else {
                    inp.type = 'text';
                    inp.className = 'topkek-fx-dev-input topkek-fx-dev-input-text';
                    if (paramHints[key]) inp.title = paramHints[key];
                }
                inp.value = formatFxDefaultForInput(defaults[key]);
                inp.addEventListener('change', () => {
                    const ok = api.applyDefaultKey(effectId, key, inp.value);
                    if (!ok) log(`FX dev: invalid value for ${effectId}.${key}`);
                });
                const hintEl = document.createElement('span');
                hintEl.className = 'topkek-fx-dev-hint';
                let hintText = '';
                if (range && typeof range.min === 'number' && typeof range.max === 'number') {
                    hintText = `${range.min} – ${range.max}`;
                } else if (paramHints[key]) {
                    hintText = paramHints[key];
                }
                hintEl.textContent = hintText;
                hintEl.hidden = !hintText;
                inputsForEffect.push(inp);
                slot.appendChild(lab);
                slot.appendChild(inp);
                slot.appendChild(hintEl);
                line.appendChild(slot);
            }
            paramsRoot.appendChild(line);
        }

        paramInputs.set(effectId, inputsForEffect);

        const btnExportPreset = document.createElement('button');
        btnExportPreset.type = 'button';
        btnExportPreset.className = 'topkek-fx-dev-btn mode-btn topkek-fx-dev-export-preset';
        btnExportPreset.textContent = 'Export preset';
        btnExportPreset.title = `Download JSON for ${effectId}`;

        btnTrig.addEventListener('click', () => {
            const overrides = collectOverrides(effectId);
            const lines = api.runStart(effectId, 'trigger', overrides);
            lines.forEach((l) => log(l));
            refreshActiveList();
        });
        btnLoop.addEventListener('click', () => {
            const overrides = collectOverrides(effectId);
            const lines = api.runStart(effectId, 'loop', overrides);
            lines.forEach((l) => log(l));
            refreshActiveList();
        });
        btnStop.addEventListener('click', () => {
            api.runStop(effectId).forEach((l) => log(l));
            refreshActiveList();
        });
        btnExportPreset.addEventListener('click', () => {
            const obj = api.exportEffectPreset(effectId);
            if (!obj) return;
            downloadJson(obj, `topkek-fx-${effectId}.json`);
            log(`FX dev: exported ${effectId}.`);
        });

        section.appendChild(paramsRoot);
        section.appendChild(btnExportPreset);
        effectsWrap.appendChild(section);
    });

    panel.appendChild(globalRow);
    panel.appendChild(presetRow);
    panel.appendChild(effectsWrap);

    bodyRow.appendChild(activePanel);
    bodyRow.appendChild(panel);
    shell.appendChild(menubar);
    shell.appendChild(bodyRow);
    mountRoot.appendChild(shell);

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

    function refreshActiveList() {
        activeListEl.textContent = '';
        const rows = typeof api.getActiveInstances === 'function' ? api.getActiveInstances() : [];
        const currentIds = new Set(rows.map((r) => r.id));
        for (const id of [...expandedActiveParamsIds]) {
            if (!currentIds.has(id)) expandedActiveParamsIds.delete(id);
        }
        if (rows.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'topkek-fx-dev-active-empty';
            empty.textContent = '—';
            activeListEl.appendChild(empty);
            return;
        }
        rows.forEach((row, rowIdx) => {
            const line = document.createElement('div');
            line.className = 'topkek-fx-dev-active-row';
            const meta = document.createElement('div');
            meta.className = 'topkek-fx-dev-active-meta';
            const shortId = row.id.replace(/^fx-/, '');
            const nextStr =
                row.nextInSec != null && Number.isFinite(row.nextInSec) ? `${row.nextInSec.toFixed(1)}s` : '—';
            meta.textContent = `${shortId} · ${row.effectId} · ${row.mode}`;
            const sub = document.createElement('div');
            sub.className = 'topkek-fx-dev-active-sub';
            sub.textContent = row.mode === 'loop' ? `next ${nextStr}${row.paused ? ' · paused' : ''}` : 'trigger';
            const actions = document.createElement('div');
            actions.className = 'topkek-fx-dev-active-actions';
            const expanded = expandedActiveParamsIds.has(row.id);
            const btnParams = document.createElement('button');
            btnParams.type = 'button';
            btnParams.className = 'topkek-fx-dev-mini-btn topkek-fx-dev-active-params-toggle';
            btnParams.textContent = expanded ? '▴' : '▾';
            btnParams.title = expanded ? 'Hide parameters' : 'Show parameters';
            btnParams.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            btnParams.addEventListener('click', () => {
                if (expandedActiveParamsIds.has(row.id)) expandedActiveParamsIds.delete(row.id);
                else expandedActiveParamsIds.add(row.id);
                refreshActiveList();
            });
            actions.appendChild(btnParams);
            if (typeof api.moveActiveInstance === 'function') {
                const btnUp = document.createElement('button');
                btnUp.type = 'button';
                btnUp.className = 'topkek-fx-dev-mini-btn topkek-fx-dev-active-reorder';
                btnUp.textContent = '↑';
                btnUp.title = 'Move up';
                btnUp.disabled = rowIdx === 0;
                btnUp.addEventListener('click', () => {
                    api.moveActiveInstance(row.id, 'up');
                    refreshActiveList();
                });
                const btnDown = document.createElement('button');
                btnDown.type = 'button';
                btnDown.className = 'topkek-fx-dev-mini-btn topkek-fx-dev-active-reorder';
                btnDown.textContent = '↓';
                btnDown.title = 'Move down';
                btnDown.disabled = rowIdx >= rows.length - 1;
                btnDown.addEventListener('click', () => {
                    api.moveActiveInstance(row.id, 'down');
                    refreshActiveList();
                });
                actions.appendChild(btnUp);
                actions.appendChild(btnDown);
            }
            if (row.mode === 'loop') {
                const btnPause = document.createElement('button');
                btnPause.type = 'button';
                btnPause.className = 'topkek-fx-dev-mini-btn';
                btnPause.textContent = row.paused ? '▶' : '❚❚';
                btnPause.title = row.paused ? 'Resume' : 'Pause';
                btnPause.addEventListener('click', () => {
                    api.setInstancePaused(row.id, !row.paused);
                    refreshActiveList();
                });
                actions.appendChild(btnPause);
            }
            const btnDel = document.createElement('button');
            btnDel.type = 'button';
            btnDel.className = 'topkek-fx-dev-mini-btn';
            btnDel.textContent = '×';
            btnDel.title = 'Remove';
            btnDel.addEventListener('click', () => {
                api.removeInstance(row.id);
                refreshActiveList();
            });
            actions.appendChild(btnDel);
            line.appendChild(meta);
            line.appendChild(sub);
            line.appendChild(actions);
            const paramsWrap = document.createElement('div');
            paramsWrap.className = 'topkek-fx-dev-active-params topkek-fx-dev-scroll';
            paramsWrap.hidden = !expanded;
            const paramsObj = row.params && typeof row.params === 'object' ? row.params : {};
            const keys = Object.keys(paramsObj).sort();
            if (keys.length === 0) {
                const emptyP = document.createElement('div');
                emptyP.className = 'topkek-fx-dev-active-params-empty';
                emptyP.textContent = '(no parameters)';
                paramsWrap.appendChild(emptyP);
            } else {
                keys.forEach((key) => {
                    const rowEl = document.createElement('div');
                    rowEl.className = 'topkek-fx-dev-active-param-row';
                    const kEl = document.createElement('span');
                    kEl.className = 'topkek-fx-dev-active-param-key';
                    kEl.textContent = key;
                    const vEl = document.createElement('span');
                    vEl.className = 'topkek-fx-dev-active-param-val';
                    vEl.textContent = formatInstanceParamValue(paramsObj[key]);
                    vEl.title = vEl.textContent;
                    rowEl.appendChild(kEl);
                    rowEl.appendChild(vEl);
                    paramsWrap.appendChild(rowEl);
                });
            }
            line.appendChild(paramsWrap);
            activeListEl.appendChild(line);
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
        refreshActiveList();
    });

    btnExportAll.addEventListener('click', () => {
        downloadJson(api.exportPreset(), `topkek-fx-preset-full.json`);
        log('FX dev: full preset exported.');
    });

    let closeArmed = false;
    function resetCloseArmed() {
        closeArmed = false;
        btnClose.classList.remove('topkek-fx-dev-close--armed');
    }

    let visible = false;
    let pollId = null;

    function performClose() {
        visible = false;
        shell.hidden = true;
        shell.setAttribute('aria-hidden', 'true');
        shell.classList.remove('topkek-fx-dev-shell--minimized');
        btnMin.textContent = 'Minimize';
        btnMin.setAttribute('aria-label', 'Minimize panel');
        if (pollId != null) {
            window.clearInterval(pollId);
            pollId = null;
        }
    }

    btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!closeArmed) {
            closeArmed = true;
            btnClose.classList.add('topkek-fx-dev-close--armed');
        } else {
            resetCloseArmed();
            if (visible) performClose();
        }
    });

    btnMin.addEventListener('click', () => {
        const min = shell.classList.toggle('topkek-fx-dev-shell--minimized');
        btnMin.textContent = min ? 'Restore' : 'Minimize';
        btnMin.setAttribute('aria-label', min ? 'Restore panel' : 'Minimize panel');
        resetCloseArmed();
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
                    log('FX dev: import OK.');
                } else {
                    log(`FX dev: import — ${res.error || 'unknown'}`);
                }
            } catch (err) {
                log(`FX dev: import parse — ${err?.message || err}`);
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
                log('FX dev: import OK.');
            } else {
                log(`FX dev: import — ${res.error || 'unknown'}`);
            }
        } catch (err) {
            log(`FX dev: import parse — ${err?.message || err}`);
        }
    });

    function toggle() {
        visible = !visible;
        shell.hidden = !visible;
        shell.setAttribute('aria-hidden', visible ? 'false' : 'true');
        resetCloseArmed();
        if (visible) {
            shell.classList.remove('topkek-fx-dev-shell--minimized');
            btnMin.textContent = 'Minimize';
            btnMin.setAttribute('aria-label', 'Minimize panel');
            syncFromRuntime();
            refreshActiveList();
            pollId = window.setInterval(refreshActiveList, 300);
        } else if (pollId != null) {
            window.clearInterval(pollId);
            pollId = null;
        }
    }

    function isVisible() {
        return visible;
    }

    syncFromRuntime();
    refreshActiveList();

    return { toggle, isVisible, syncFromRuntime };
}
