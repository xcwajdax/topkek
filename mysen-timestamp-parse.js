/**
 * Parse MYSEN timestamp lyric file (SRT-like lines).
 * @param {string} text
 * @returns {{ text: string, at: number, color?: number }[]}
 */
export function parseMysenTimestampLyricsFile(text) {
    const out = [];
    if (!text || typeof text !== 'string') return out;
    const re = /^\s*([\d.]+)\s*-->\s*([\d.]+)\s*\|\s*(.+)$/;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(re);
        if (!m) continue;
        const start = parseFloat(m[1]);
        const label = m[3].trim();
        if (!label || /^muzyka$/i.test(label)) continue;
        if (!Number.isFinite(start)) continue;
        out.push({ text: label, at: start });
    }
    return out;
}
