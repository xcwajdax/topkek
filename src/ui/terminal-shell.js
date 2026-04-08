/**
 * Terminal-style log + command input + local history. Scene commands live in script.js.
 */
import { TERMINAL_CONFIG } from '../../config.js';
import { initBuuchChat, isCommand, buuchReply } from './buuch-chat.js';

/**
 * @param {object} options
 * @param {string} [options.rootSelector]
 * @param {(line: string) => (string|string[]|void|Promise<string|string[]|void>)} options.onCommand
 * @returns {{ submitLine: (line: string) => Promise<void> } | undefined}
 */
export function initTopkekTerminalShell(options) {
    const rootSelector = options.rootSelector || '#topkek-terminal-shell';
    const onCommand = options.onCommand;
    if (typeof onCommand !== 'function') return undefined;

    const root = document.querySelector(rootSelector);
    if (!root) return undefined;

    const maxLogLines = TERMINAL_CONFIG.maxLogLines ?? 200;
    const promptChar = TERMINAL_CONFIG.prompt ?? 'U >';
    const buuchLogPrefix = (TERMINAL_CONFIG.buuchLogPrefix ?? 'B >').trim();
    const welcomeLines = Array.isArray(TERMINAL_CONFIG.welcomeLines) ? TERMINAL_CONFIG.welcomeLines : [];
    const shellUi = TERMINAL_CONFIG.shellUi || {};
    const timestampCfg = TERMINAL_CONFIG.timestamp || {};
    const showTimestamp = timestampCfg.enabled !== false;
    const timestampLocale = timestampCfg.locale || undefined;
    const timestampHour12 = timestampCfg.hour12 ?? false;
    const timestampShowSeconds = timestampCfg.showSeconds !== false;
    const streamCfg = TERMINAL_CONFIG.stream || {};
    const streamEnabled = streamCfg.enabled !== false;
    const streamCharDelayMs = Number.isFinite(streamCfg.charDelayMs) ? streamCfg.charDelayMs : 8;
    const streamLineDelayMs = Number.isFinite(streamCfg.lineDelayMs) ? streamCfg.lineDelayMs : 45;
    const fastCharDelayMs = Number.isFinite(streamCfg.fastCharDelayMs) ? streamCfg.fastCharDelayMs : 2;
    const fastLineDelayMs = Number.isFinite(streamCfg.fastLineDelayMs) ? streamCfg.fastLineDelayMs : 15;
    const maximizedClass = shellUi.maximizedClass || 'topkek-terminal-shell--maximized';
    const collapsedClass = shellUi.collapsedClass || 'topkek-terminal-shell--collapsed';

    const logEl = root.querySelector('[data-terminal-log]');
    const input = root.querySelector('[data-terminal-input]');
    const promptEl = root.querySelector('[data-terminal-prompt]');
    if (!logEl || !input) return undefined;

    const inputRow = root.querySelector('.topkek-terminal-input-row');
    if (inputRow && logEl.parentNode === root && inputRow.parentNode === root) {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'topkek-terminal-shell-body';
        root.insertBefore(bodyEl, logEl);
        bodyEl.appendChild(logEl);
        bodyEl.appendChild(inputRow);
    }

    if (promptEl) promptEl.textContent = promptChar;

    function shellIconButton(ariaLabel, titleText, svgInner) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'topkek-terminal-shell-control-btn topkek-terminal-shell-icon-btn';
        btn.setAttribute('aria-label', ariaLabel);
        btn.title = titleText;
        btn.innerHTML =
            `<svg class="topkek-terminal-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgInner}</svg>`;
        return btn;
    }

    const titleEl = root.querySelector('.topkek-terminal-shell-title');
    if (titleEl) {
        const titleText = titleEl.textContent || 'console';
        titleEl.textContent = '';
        titleEl.classList.add('topkek-terminal-shell-header');

        const titleTextEl = document.createElement('span');
        titleTextEl.className = 'topkek-terminal-shell-title-text';
        titleTextEl.textContent = titleText;

        const controlsEl = document.createElement('div');
        controlsEl.className = 'topkek-terminal-shell-controls';

        const expandBtn = shellIconButton(
            'Maximize console',
            'Maximize',
            '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'
        );
        const restoreBtn = shellIconButton(
            'Restore console size',
            'Restore',
            '<rect x="8" y="8" width="13" height="13" rx="1"/><rect x="3" y="3" width="13" height="13" rx="1"/>'
        );
        const foldBtn = shellIconButton(
            'Hide console log',
            'Hide log',
            '<path d="M18 15l-6-6-6 6"/>'
        );

        function syncFoldButton() {
            const expanded = !root.classList.contains(collapsedClass);
            foldBtn.innerHTML = expanded
                ? `<svg class="topkek-terminal-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>`
                : `<svg class="topkek-terminal-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
            foldBtn.setAttribute('aria-label', expanded ? 'Hide console log' : 'Show console log');
            foldBtn.title = expanded ? 'Hide log' : 'Show log';
            foldBtn.setAttribute('aria-expanded', String(expanded));
        }

        function syncControlState() {
            const isMaximized = root.classList.contains(maximizedClass);
            expandBtn.disabled = isMaximized;
            restoreBtn.disabled = !isMaximized;
            expandBtn.setAttribute('aria-pressed', String(isMaximized));
            restoreBtn.setAttribute('aria-pressed', String(!isMaximized));
        }

        function setMaximized(nextState) {
            root.classList.toggle(maximizedClass, !!nextState);
            syncControlState();
        }

        function setCollapsed(nextCollapsed) {
            root.classList.toggle(collapsedClass, !!nextCollapsed);
            syncFoldButton();
        }

        expandBtn.addEventListener('click', () => setMaximized(true));
        restoreBtn.addEventListener('click', () => setMaximized(false));
        foldBtn.addEventListener('click', () => setCollapsed(!root.classList.contains(collapsedClass)));

        controlsEl.appendChild(expandBtn);
        controlsEl.appendChild(restoreBtn);
        controlsEl.appendChild(foldBtn);
        titleEl.appendChild(titleTextEl);
        titleEl.appendChild(controlsEl);
        syncControlState();
        syncFoldButton();
    }

    const history = [];
    let historyIndex = -1;
    let historyDraft = '';

    function formatTimestamp() {
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: !!timestampHour12
        };
        if (timestampShowSeconds) options.second = '2-digit';
        return new Date().toLocaleTimeString(timestampLocale, options);
    }

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function countLogVisualLines() {
        let n = 0;
        for (const c of logEl.children) {
            if (c.classList.contains('topkek-terminal-help-block')) {
                const inner = c.children.length;
                n += inner > 0 ? inner : 1;
            } else {
                n += 1;
            }
        }
        return n;
    }

    function trimLogToMax() {
        while (countLogVisualLines() > maxLogLines && logEl.firstChild) {
            logEl.removeChild(logEl.firstChild);
        }
        logEl.scrollTop = logEl.scrollHeight;
    }

    /**
     * @param {string} text
     * @param {string} className
     * @param {'command'|'response'|'info'|'error'} kind
     * @param {false|'slow'|'fast'} streamMode slow = charDelayMs; fast = listings e.g. /help full
     * @param {object} [logOptions]
     * @param {HTMLElement} [logOptions.parent] mount target (default log root)
     * @param {string} [logOptions.lineClass] extra class on the line row
     */
    async function appendLogLine(text, className = '', kind = 'response', streamMode = false, logOptions = {}) {
        const parent = logOptions.parent || logEl;
        const line = document.createElement('div');
        line.className = 'topkek-terminal-log-line' + (className ? ` ${className}` : '');
        const kindClass = `topkek-terminal-line-${kind}`;
        line.classList.add(kindClass);
        if (logOptions.lineClass) {
            line.classList.add(logOptions.lineClass);
        }

        if (showTimestamp) {
            const ts = document.createElement('span');
            ts.className = 'topkek-terminal-log-ts';
            ts.textContent = `[${formatTimestamp()}]`;
            line.appendChild(ts);
        }
        const textEl = document.createElement('span');
        textEl.className = 'topkek-terminal-log-text';
        const doStream = streamEnabled && (streamMode === 'slow' || streamMode === 'fast');
        const charDelay = streamMode === 'fast' ? fastCharDelayMs : streamCharDelayMs;
        if (doStream) {
            textEl.textContent = '';
        } else {
            textEl.textContent = text;
        }
        line.appendChild(textEl);

        parent.appendChild(line);
        trimLogToMax();
        logEl.scrollTop = logEl.scrollHeight;

        if (doStream) {
            const raw = String(text);
            for (let i = 0; i < raw.length; i++) {
                textEl.textContent += raw[i];
                logEl.scrollTop = logEl.scrollHeight;
                await wait(charDelay);
            }
        }
    }

    /**
     * @param {object} options
     * @param {false|'slow'|'fast'} [options.stream] default slow when stream enabled
     * @param {HTMLElement} [options.parent]
     * @param {string} [options.lineClass]
     */
    async function appendLogLines(lines, kind = 'response', options = {}) {
        if (!lines) return;
        const arr = Array.isArray(lines) ? lines : [lines];
        let streamMode = options.stream;
        if (streamMode === undefined) {
            streamMode = streamEnabled ? 'slow' : false;
        }
        const linePause = streamMode === 'fast' ? fastLineDelayMs : streamLineDelayMs;
        const logOpts = { parent: options.parent, lineClass: options.lineClass };
        for (let i = 0; i < arr.length; i++) {
            await appendLogLine(String(arr[i]), '', kind, streamMode, logOpts);
            if (streamMode && streamEnabled && i < arr.length - 1) {
                await wait(linePause);
            }
        }
    }

    void (async () => {
        for (const l of welcomeLines) {
            await appendLogLine(l, 'topkek-terminal-welcome', 'info', streamEnabled ? 'slow' : false);
        }
    })();

    void initBuuchChat();

    function clearLog() {
        logEl.textContent = '';
    }

    // Keep mouse wheel scrolling inside console log when hovered.
    logEl.addEventListener('wheel', (e) => {
        if (!logEl.matches(':hover')) return;
        logEl.scrollTop += e.deltaY;
        e.preventDefault();
    }, { passive: false });

    /**
     * @param {string} line trimmed non-empty
     */
    async function processSubmittedLine(line) {
        const low = line.toLowerCase();
        if (low === '/clear') {
            clearLog();
            return;
        }

        if (isCommand(line)) {
            let out;
            try {
                out = onCommand(line);
                if (out != null && typeof out.then === 'function') {
                    out = await out;
                }
            } catch (err) {
                await appendLogLine(`Error: ${err?.message || err}`, 'topkek-terminal-err', 'error', streamEnabled ? 'slow' : false, {});
                return;
            }
            if (out && typeof out === 'object' && !Array.isArray(out) && Array.isArray(out.lines)) {
                let streamMode;
                if (out.stream === true) streamMode = 'fast';
                else if (out.stream === false) streamMode = false;
                else streamMode = streamEnabled ? 'slow' : false;
                if (out.plainListing) {
                    const block = document.createElement('div');
                    block.className = 'topkek-terminal-help-block';
                    logEl.appendChild(block);
                    trimLogToMax();
                    await appendLogLines(out.lines, 'response', {
                        stream: streamMode,
                        parent: block,
                        lineClass: 'topkek-terminal-line-plain'
                    });
                } else {
                    await appendLogLines(out.lines, 'response', { stream: streamMode });
                }
                return;
            }
            await appendLogLines(out, 'response', { stream: streamEnabled ? 'slow' : false });
        } else {
            const response = buuchReply(line);
            if (response) {
                const buuchText = buuchLogPrefix ? `${buuchLogPrefix} ${response}` : response;
                await appendLogLine(buuchText, 'topkek-terminal-line-buuch', 'response', streamEnabled ? 'slow' : false, {});
            }
        }
    }

    async function pushEchoAndDispatch(raw) {
        const line = raw.trim();
        if (!line) return;
        await appendLogLine(`${promptChar} ${raw}`, '', 'command', false, {});
        history.push(raw);
        if (history.length > 100) history.shift();
        historyIndex = -1;
        historyDraft = '';
        await processSubmittedLine(line);
    }

    /**
     * Same as submitting from the input (log + history + command handling), without changing the input field.
     * @param {string} text
     */
    async function submitLine(text) {
        const raw = String(text ?? '');
        const line = raw.trim();
        if (!line) return;
        await pushEchoAndDispatch(raw);
    }

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length === 0) return;
            if (historyIndex === -1) historyDraft = input.value;
            historyIndex = Math.min(historyIndex + 1, history.length - 1);
            input.value = history[history.length - 1 - historyIndex];
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (history.length === 0) return;
            if (historyIndex <= 0) {
                historyIndex = -1;
                input.value = historyDraft;
                return;
            }
            historyIndex -= 1;
            input.value = history[history.length - 1 - historyIndex];
            return;
        }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const raw = input.value;
        const line = raw.trim();
        if (!line) return;

        input.value = '';
        await pushEchoAndDispatch(raw);
    });

    return { submitLine };
}
