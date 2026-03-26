/**
 * Terminal-style log + command input + local history. Scene commands live in script.js.
 */
import { TERMINAL_CONFIG } from './config.js';

/**
 * @param {object} options
 * @param {string} [options.rootSelector]
 * @param {(line: string) => (string|string[]|void)} options.onCommand
 */
export function initTopkekTerminalShell(options) {
    const rootSelector = options.rootSelector || '#topkek-terminal-shell';
    const onCommand = options.onCommand;
    if (typeof onCommand !== 'function') return;

    const root = document.querySelector(rootSelector);
    if (!root) return;

    const maxLogLines = TERMINAL_CONFIG.maxLogLines ?? 200;
    const promptChar = TERMINAL_CONFIG.prompt ?? '>';
    const welcomeLines = Array.isArray(TERMINAL_CONFIG.welcomeLines) ? TERMINAL_CONFIG.welcomeLines : [];

    const logEl = root.querySelector('[data-terminal-log]');
    const input = root.querySelector('[data-terminal-input]');
    const promptEl = root.querySelector('[data-terminal-prompt]');
    if (!logEl || !input) return;

    if (promptEl) promptEl.textContent = promptChar;

    const history = [];
    let historyIndex = -1;
    let historyDraft = '';

    function appendLogLine(text, className = '') {
        const line = document.createElement('div');
        line.className = 'topkek-terminal-log-line' + (className ? ` ${className}` : '');
        line.textContent = text;
        logEl.appendChild(line);
        while (logEl.children.length > maxLogLines) {
            logEl.removeChild(logEl.firstChild);
        }
        logEl.scrollTop = logEl.scrollHeight;
    }

    function appendLogLines(lines) {
        if (!lines) return;
        const arr = Array.isArray(lines) ? lines : [lines];
        arr.forEach((l) => appendLogLine(String(l)));
    }

    welcomeLines.forEach((l) => appendLogLine(l, 'topkek-terminal-welcome'));

    function clearLog() {
        logEl.textContent = '';
    }

    input.addEventListener('keydown', (e) => {
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

        appendLogLine(`${promptChar} ${raw}`);
        history.push(raw);
        if (history.length > 100) history.shift();
        historyIndex = -1;
        historyDraft = '';
        input.value = '';

        const low = line.toLowerCase();
        if (low === 'clear') {
            clearLog();
            return;
        }

        let out;
        try {
            out = onCommand(line);
        } catch (err) {
            appendLogLine(`Error: ${err?.message || err}`, 'topkek-terminal-err');
            return;
        }
        appendLogLines(out);
    });
}
