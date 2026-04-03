/**
 * MYSEN: merge intro + timestamps → showcase doc (authoring path for the animation editor).
 * Run: node --test tools/mysen-runtime-showcase-doc.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMysenTimestampLyricsFile } from '../src/showcase/mysen-timestamp-parse.js';
import { buildMergedMysenLyricsArray, lastFilledLineIndexInLyrics } from '../src/showcase/mysen-merge-lyrics-from-timestamps.js';
import {
    buildShowcaseAnimationDocFromMysenRuntimeMerge,
    lyricsArrayFromShowcaseDoc
} from '../src/showcase/showcase-animation-adapters.js';
import { validateShowcaseAnimationDoc } from '../src/showcase/showcase-animation-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const mysenTsPath = path.join(repoRoot, 'ASSETS', 'mysen', 'mysen_timestamps.txt');

const minimalIntroConfig = {
    introLyrics: [
        { text: 'A', color: 0x66ccff, at: 0.1 },
        { lineBreak: true },
        { text: 'B', color: 0xffffff, at: 0.2 }
    ],
    lyrics: [],
    audioStartTime: 0,
    audioEndTime: null,
    audioFile: 'ASSETS/mysen/mysen-remix.mp3',
    timestampLyricsEnabled: true,
    timestampWordColor: 0xffffff,
    mysenTimestampLineGroups: { enabled: false, groups: [] },
    wordSize: 1,
    wordHeight: 0.12,
    wordThickness: 2,
    scatterRadius: 6,
    defaultWordColor: 0xffffff,
    wordAssemblyDuration: 1.8,
    lyricsStartDelay: 0,
    lineSpacing: 2,
    wordSpacing: 0.8,
    lyricsOffsetY: 0.5,
    spread: { durationSec: 1.35, amplitude: 5.5 },
    randomFly: { enabled: true, ndcMargin: 0.12 }
};

test('buildMergedMysenLyricsArray: intro + timestamp rows matches legacy merge shape', () => {
    const rows = [
        { text: 'w1', at: 5.0 },
        { text: 'w2', at: 5.5 }
    ];
    const merged = buildMergedMysenLyricsArray(minimalIntroConfig, rows);
    const texts = merged.filter((x) => x && !x.lineBreak).map((x) => x.text);
    assert.deepEqual(texts, ['A', 'B', 'w1', 'w2']);
    const w1 = merged.find((x) => x && x.text === 'w1');
    assert.equal(w1.at, 5);
    assert.equal(w1.atSourceSec, 5);
});

test('buildShowcaseAnimationDocFromMysenRuntimeMerge validates and sets firstTimestampLineIndex', () => {
    const rows = [{ text: 'solo', at: 1.0 }];
    const doc = buildShowcaseAnimationDocFromMysenRuntimeMerge(minimalIntroConfig, rows, null);
    const v = validateShowcaseAnimationDoc(doc);
    assert.equal(v.ok, true, v.ok ? '' : v.error);
    const lastIntro = lastFilledLineIndexInLyrics(minimalIntroConfig.introLyrics);
    assert.equal(doc.timing.firstTimestampLineIndex, lastIntro + 1);
    assert.equal(doc.adapter, 'voxelLyricsMysen');
});

test('round-trip: showcase doc lyrics carry offsetX / groupedLine for runtime prepare', () => {
    const cfg = {
        ...minimalIntroConfig,
        mysenTimestampLineGroups: {
            enabled: true,
            groups: [
                {
                    tMin: 10,
                    tMax: 12,
                    lineVanishAtMediaSec: 15,
                    splitLines: [
                        { wordCount: 1, offsetX: -2, offsetY: 0.5 },
                        { wordCount: 1, offsetX: 3, offsetY: -0.25 }
                    ]
                }
            ]
        }
    };
    const rows = [
        { text: 'left', at: 10.5 },
        { text: 'right', at: 11.0 }
    ];
    const merged = buildMergedMysenLyricsArray(cfg, rows);
    const doc = buildShowcaseAnimationDocFromMysenRuntimeMerge(cfg, rows, null);
    const v = validateShowcaseAnimationDoc(doc);
    assert.equal(v.ok, true, v.ok ? '' : v.error);
    const lyric = lyricsArrayFromShowcaseDoc(doc);
    const mergedWords = merged.filter((x) => x && !x.lineBreak);
    const lyricWords = lyric.filter((x) => x && !x.lineBreak);
    assert.equal(lyricWords.length, mergedWords.length);
    const pick = (arr, t) => arr.find((x) => x.text === t);
    assert.deepEqual(
        {
            gx: pick(lyricWords, 'left').offsetX,
            gy: pick(lyricWords, 'left').offsetY,
            row: pick(lyricWords, 'left').mysenSplitRow,
            vanish: pick(lyricWords, 'left').lineVanishAtSourceSec
        },
        {
            gx: pick(mergedWords, 'left').offsetX,
            gy: pick(mergedWords, 'left').offsetY,
            row: pick(mergedWords, 'left').mysenSplitRow,
            vanish: pick(mergedWords, 'left').lineVanishAtSourceSec
        }
    );
});

test('production mysen_timestamps.txt parses and produces a valid authoring doc', () => {
    const text = fs.readFileSync(mysenTsPath, 'utf8');
    const rows = parseMysenTimestampLyricsFile(text);
    assert.ok(rows.length > 5, 'expected real timestamp file to have tokens');
    const productionLike = {
        ...minimalIntroConfig,
        introLyrics: [
            { text: 'MYSEN - BEZSEN', color: 0x66ccff, at: 0.22, mysenPersistentOnScreen: true },
            { lineBreak: true },
            {
                text: 'TOPKEK',
                color: 0xffffff,
                at: 0.52,
                scale: 0.72,
                mysenPersistentOnScreen: true
            },
            { lineBreak: true },
            { text: 'reimagined', color: 0xaaccff, at: 0.78, mysenPersistentOnScreen: true }
        ],
        mysenTimestampLineGroups: {
            enabled: true,
            seededRandomFly: true,
            groups: [
                {
                    tMin: 23.7,
                    tMax: 30.36,
                    lineVanishAtMediaSec: 31.5,
                    splitLines: [
                        { wordCount: 4, offsetX: -1.45, offsetY: 0.62 },
                        { wordCount: 4, offsetX: 1.35, offsetY: -0.28 }
                    ]
                },
                {
                    tMin: 31.84,
                    tMax: 38.7,
                    lineVanishAtMediaSec: 41.0,
                    splitLines: [
                        { wordCount: 4, offsetX: -1.05, offsetY: 0.22 },
                        { wordCount: 4, offsetX: 1.55, offsetY: -0.58 }
                    ]
                }
            ]
        }
    };
    const doc = buildShowcaseAnimationDocFromMysenRuntimeMerge(productionLike, rows, null);
    const v = validateShowcaseAnimationDoc(doc);
    assert.equal(v.ok, true, v.ok ? '' : v.error);
    assert.equal(doc.timing.firstTimestampLineIndex, 3);
});
