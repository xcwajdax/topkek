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

/**
 * Word-level timestamp txt (Whisper / MYSEN style): segment headers `[a --> b]` and lines `a --> b | word`.
 * Inserts lineBreak between segments. `at` is fragment time: word start (media sec) minus audioStartTime.
 *
 * @param {string} text
 * @param {number} [audioStartTime]
 * @returns {{ entries: import('./showcase-animation-schema.js').ShowcaseWordEntry[], wordCount: number, negativeAtCount: number }}
 */
export function parseWhisperStyleTimestampTxtToWordEntries(text, audioStartTime = 0) {
    /** @type {import('./showcase-animation-schema.js').ShowcaseWordEntry[]} */
    const entries = [];
    let wordCount = 0;
    let negativeAtCount = 0;
    const audioStart = Number.isFinite(audioStartTime) ? audioStartTime : 0;

    if (!text || typeof text !== 'string') {
        return { entries, wordCount: 0, negativeAtCount: 0 };
    }

    const wordRe = /^\s*([\d.]+)\s*-->\s*([\d.]+)\s*\|\s*(.+)$/;
    const segmentRe = /^\s*\[[\d.]+\s*-->\s*[\d.]+\]\s*$/;
    const lines = text.split(/\r?\n/);
    let hadWordYet = false;
    let needLineBreakBeforeNextWord = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (segmentRe.test(line)) {
            if (hadWordYet) needLineBreakBeforeNextWord = true;
            continue;
        }
        const m = line.match(wordRe);
        if (!m) continue;
        const start = parseFloat(m[1]);
        const label = m[3].trim();
        if (!label || /^muzyka$/i.test(label)) continue;
        if (!Number.isFinite(start)) continue;

        if (needLineBreakBeforeNextWord) {
            entries.push({ lineBreak: true });
            needLineBreakBeforeNextWord = false;
        }

        const at = start - audioStart;
        if (at < 0) negativeAtCount++;

        entries.push({
            id: `w${wordCount}`,
            text: label,
            at,
            color: 0xffffff,
            scale: 1,
            materialPresetId: 'standard',
            groupedLine: true
        });
        wordCount++;
        hadWordYet = true;
    }

    return { entries, wordCount, negativeAtCount };
}
