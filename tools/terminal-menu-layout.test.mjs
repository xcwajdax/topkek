/**
 * Contract tests for #terminal-menu markup (no DOM; static HTML slice).
 * Run: node --test tools/terminal-menu-layout.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, '..', 'index.html');
const configPath = path.join(__dirname, '..', 'config.js');

function getTerminalMenuInner(html) {
    const token = 'id="terminal-menu"';
    const idx = html.indexOf(token);
    if (idx < 0) throw new Error('missing #terminal-menu');
    const openStart = html.lastIndexOf('<div', idx);
    const contentStart = html.indexOf('>', openStart) + 1;
    let depth = 1;
    let i = contentStart;
    let innerEnd = contentStart;
    while (i < html.length && depth > 0) {
        if (html.startsWith('<div', i) && /[\s>]/.test(html[i + 4] || '')) {
            depth++;
            i += 4;
            continue;
        }
        if (html.startsWith('</div>', i)) {
            depth--;
            if (depth === 0) {
                innerEnd = i;
                break;
            }
            i += 6;
            continue;
        }
        i++;
    }
    return html.slice(contentStart, innerEnd);
}

function bannerCmdsInOrder(inner) {
    const re = /data-term-banner-cmd="([^"]+)"/g;
    const out = [];
    let m;
    while ((m = re.exec(inner)) !== null) out.push(m[1]);
    return out;
}

test('terminal menu: banner cmd order Pushka → Newskin → Mysen → Vajbuj', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const inner = getTerminalMenuInner(html);
    assert.deepEqual(bannerCmdsInOrder(inner), ['/pushka', '/newskin', '/mysen', '/vajbuj']);
});

test('terminal menu: no duplicate MYSEN section hint id', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const inner = getTerminalMenuInner(html);
    assert.equal(inner.includes('id="term-menu-section-mysen-hint"'), false);
});

test('terminal menu: MYSEN banner uses neon drawer title, not menu-section-title drawer', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const inner = getTerminalMenuInner(html);
    const mysenIdx = inner.indexOf('term-menu-banner-mysen-wrap');
    assert.ok(mysenIdx >= 0, 'mysen wrap');
    const afterMysen = inner.slice(mysenIdx);
    const nextBanner = afterMysen.indexOf('class="term-menu-banner-block"', 1);
    const mysenBlock = nextBanner < 0 ? afterMysen : afterMysen.slice(0, nextBanner);
    assert.ok(mysenBlock.includes('term-mysen-drawer-display-title'));
    assert.ok(mysenBlock.includes('term-menu-drawer-display-title'));
    assert.equal(mysenBlock.includes('term-menu-banner-drawer-title'), false);
});

test('terminal menu: no menu-section-title inside panel', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const inner = getTerminalMenuInner(html);
    assert.equal(inner.includes('class="menu-section-title"'), false);
});

test('terminal menu: category headings ANIMATIONS → GAMES → SOFTWARE in order', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const inner = getTerminalMenuInner(html);
    const a = inner.indexOf('term-menu-category-heading');
    assert.ok(a >= 0);
    const anim = inner.indexOf('ANIMATIONS');
    const games = inner.indexOf('GAMES');
    const soft = inner.indexOf('SOFTWARE');
    assert.ok(anim >= 0 && games >= 0 && soft >= 0);
    assert.ok(anim < games && games < soft);
});

test('terminal menu: spacer between animations block and GAMES heading', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const inner = getTerminalMenuInner(html);
    const spacer = inner.indexOf('term-menu-category-spacer');
    const gamesDrawer = inner.indexOf('term-menu-section-games-display-title');
    assert.ok(spacer >= 0);
    assert.ok(gamesDrawer >= 0);
    assert.ok(spacer < gamesDrawer);
});

test('Pushka: Vimeo modal markup and banner video path in config', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    assert.ok(html.includes('id="pushka-modal"'));
    assert.ok(html.includes('id="pushka-modal-vimeo-iframe"'));
    const cfg = fs.readFileSync(configPath, 'utf8');
    assert.ok(cfg.includes('pushka_baner.mp4'));
});
