/**
 * Merge MYSEN intro lyrics with timestamp rows (same rules as /mysen runtime without showcase JSON).
 * Shared by script.js and showcase authoring helpers.
 */

/**
 * @param {number} atMediaSec
 * @param {object[]|undefined} groups
 * @returns {object|null}
 */
export function findMysenTsLineGroup(atMediaSec, groups) {
    if (!groups || !groups.length) return null;
    for (let i = 0; i < groups.length; i++) {
        const gr = groups[i];
        const lo = gr.tMin;
        const hi = gr.tMax;
        if (Number.isFinite(lo) && Number.isFinite(hi) && atMediaSec >= lo && atMediaSec <= hi) {
            return gr;
        }
    }
    return null;
}

/**
 * Highest lineIndex that would be assigned to a word in this lyric list (no trailing lineBreak after last word).
 * @param {object[]|undefined} lyrics
 * @returns {number}
 */
export function lastFilledLineIndexInLyrics(lyrics) {
    let currentLineIdx = 0;
    let maxL = -1;
    if (!Array.isArray(lyrics)) return -1;
    for (let i = 0; i < lyrics.length; i++) {
        const item = lyrics[i];
        if (item.lineBreak) currentLineIdx++;
        else maxL = Math.max(maxL, currentLineIdx);
    }
    return maxL;
}

/**
 * @param {object} mysenConfig — MYSEN_CONFIG-shaped (introLyrics, timestampLyricsEnabled, audioStartTime, …)
 * @param {{ text: string, at: number, color?: number }[]} timestampRows — parsed timestamp file (`at` = media seconds)
 * @returns {object[]}
 */
export function buildMergedMysenLyricsArray(mysenConfig, timestampRows) {
    const intro = mysenConfig.introLyrics || mysenConfig.lyrics;
    const merged = Array.isArray(intro) ? intro.slice() : [];
    const startT = mysenConfig.audioStartTime || 0;
    const grpCfg = mysenConfig.mysenTimestampLineGroups;
    const groups =
        grpCfg && grpCfg.enabled !== false && Array.isArray(grpCfg.groups) ? grpCfg.groups : null;
    const ts = timestampRows;

    if (mysenConfig.timestampLyricsEnabled && Array.isArray(ts) && ts.length) {
        merged.push({ lineBreak: true });
        let i = 0;
        while (i < ts.length) {
            const row = ts[i];
            const gr = findMysenTsLineGroup(row.at, groups);

            if (!gr) {
                merged.push({
                    text: row.text,
                    color: row.color ?? mysenConfig.timestampWordColor,
                    at: row.at - startT,
                    atSourceSec: row.at
                });
                merged.push({ lineBreak: true });
                i++;
                continue;
            }

            const buf = [];
            while (i < ts.length && findMysenTsLineGroup(ts[i].at, groups) === gr) {
                buf.push(ts[i]);
                i++;
            }

            const splitSpec = gr.splitLines;
            if (Array.isArray(splitSpec) && splitSpec.length > 0) {
                let t = 0;
                for (let si = 0; si < splitSpec.length; si++) {
                    const sl = splitSpec[si];
                    const n = Math.max(0, Math.floor(sl.wordCount ?? 0));
                    for (let k = 0; k < n && t < buf.length; k++, t++) {
                        const r = buf[t];
                        merged.push({
                            text: r.text,
                            color: r.color ?? mysenConfig.timestampWordColor,
                            at: r.at - startT,
                            atSourceSec: r.at,
                            lineVanishAtSourceSec: gr.lineVanishAtMediaSec,
                            mysenGroupedLine: true,
                            offsetX: sl.offsetX ?? 0,
                            offsetY: sl.offsetY ?? 0,
                            mysenSplitRow: si
                        });
                    }
                }
                if (t < buf.length) {
                    console.warn(
                        '[MYSEN] splitLines wordCount sum < tokens in group; appending remainder on last row'
                    );
                    const lastSi = splitSpec.length - 1;
                    const sl = splitSpec[lastSi];
                    while (t < buf.length) {
                        const r = buf[t++];
                        merged.push({
                            text: r.text,
                            color: r.color ?? mysenConfig.timestampWordColor,
                            at: r.at - startT,
                            atSourceSec: r.at,
                            lineVanishAtSourceSec: gr.lineVanishAtMediaSec,
                            mysenGroupedLine: true,
                            offsetX: sl.offsetX ?? 0,
                            offsetY: sl.offsetY ?? 0,
                            mysenSplitRow: lastSi
                        });
                    }
                }
            } else {
                for (let bi = 0; bi < buf.length; bi++) {
                    const r = buf[bi];
                    merged.push({
                        text: r.text,
                        color: r.color ?? mysenConfig.timestampWordColor,
                        at: r.at - startT,
                        atSourceSec: r.at,
                        lineVanishAtSourceSec: gr.lineVanishAtMediaSec,
                        mysenGroupedLine: true
                    });
                }
            }
            merged.push({ lineBreak: true });
        }
    }
    return merged;
}
