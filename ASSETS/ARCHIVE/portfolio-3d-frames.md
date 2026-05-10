# Archiwum: system portfolio 3D (ramki + miniatury wideo)

**Data archiwum:** 2026-03-11  
**Opis:** Sekcja portfolio z ramkami z kostek 3D i płaszczyzn z miniaturami wideo. Aktywacja po najechaniu na "Animation portfolio" w terminal-menu. Repulsion/scatter na ramkach, klik w miniaturę otwiera modal Vimeo.

---

## 1. index.html – terminal menu + modal Vimeo

**Terminal (nad "Under Development"):**
```html
<div class="term-line">Animation portfolio</div>
<div class="term-line interactive-term-line" id="term-anim-portfolio">> Animation portfolio</div>
```

**Osobna linia (Vimeo test):**
```html
<div class="term-line interactive-term-line" id="term-portfolio">> Portfolio (Vimeo test)</div>
```

**Modal Vimeo:**
```html
<!-- PORTFOLIO VIMEO MODAL -->
<div id="portfolio-vimeo-modal" class="hidden">
    <div id="portfolio-vimeo-backdrop"></div>
    <div id="portfolio-vimeo-content">
        <button id="portfolio-vimeo-close" class="close-btn">X</button>
        <div class="portfolio-vimeo-aspect">
            <iframe id="portfolio-vimeo-iframe"
                src=""
                frameborder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                title="Portfolio video">
            </iframe>
        </div>
    </div>
</div>
```

---

## 2. config.js – CONFIG.portfolio + PORTFOLIO_CONFIG

```javascript
// W CONFIG:
portfolio: {
    sampleVimeoUrl: "https://player.vimeo.com/video/1170695269"
}

// Portfolio thumbnails (max 6) – below PRODUCTIONS, 2×3 grid (spaced out)
export const PORTFOLIO_CONFIG = {
    offsetYTop: -7.0,
    rowSpacing: 3.2,
    slotWidth: 4.0,
    slotHeight: 2.1,
    slotSpacing: 5.5,
    cubeSize: 0.12,
    frameThickness: 2,
    planeZOffset: 0.02,
    forceScale: 1.0,
    items: [
        { id: "zorza", title: "ZORZA 2025", thumbnailVideo: "ASSETS/PORTFOLIO/test_miniatura.mp4", vimeoUrl: "https://player.vimeo.com/video/1170695269" },
        // ... do 6 items
    ]
};
```

---

## 3. script.js – stan i import

**Import:** `PORTFOLIO_CONFIG` z `./config.js`.

**portfolioState:**
```javascript
let portfolioState = {
    frameCubes: [],
    frameMesh: null,
    planeMeshes: [],
    items: [],
    hoveredIndex: -1,
    group: null,
    initialized: false,
    visible: false
};
```

**Lazy-init (Terminal):** przy `mouseenter` na `#term-anim-portfolio` wywołać `initPortfolio()` i ustawić `portfolioState.initialized = true`. Nie wywoływać `initPortfolio()` przy starcie sceny.

**term-portfolio (Vimeo test):** `onclick` → `openPortfolioModal(CONFIG.portfolio?.sampleVimeoUrl || "https://player.vimeo.com/video/1170695269")`.

**openPortfolioModal(rawUrl):** normalizacja URL Vimeo, ustawienie `iframe.src`, `modal.classList.remove('hidden')`.

**initPortfolioVimeoModal():** closeBtn i backdrop zamykają modal, czyścą iframe.src.

**onMouseDown:** jeśli `event.button === 0` i `portfolioState.hoveredIndex >= 0` i jest item → `openPortfolioModal(portfolioState.items[portfolioState.hoveredIndex].vimeoUrl); return;`.

**initPortfolio():** buduje THREE.Group z InstancedMesh (ramki z kostek), dla każdego itemu plane z VideoTexture; pozycje slotów z jitterem; `scene.add(group)`.

**W pętli render:**  
- Dla `portfolioState.frameMesh` i `frameCubes`: raycaster → portfolioTarget na płaszczyźnie Z=0; repulsion/scatter (`repulsion` lub `scatter` + dist < repulsionRadius); powrót do originalPos; aktualizacja matrix.  
- Dla `planeMeshes`: raycaster → hoveredIndex; play/pause wideo na hover.

---

## 4. style.css – modal Vimeo

```css
/* Portfolio Vimeo Modal */
#portfolio-vimeo-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2200;
    font-family: 'Courier New', monospace;
}
#portfolio-vimeo-modal.hidden { display: none; }
#portfolio-vimeo-backdrop { position: absolute; inset: 0; cursor: pointer; }
#portfolio-vimeo-content {
    position: relative;
    background: #000;
    border: 1px solid rgba(255, 255, 255, 0.25);
    width: 90vw;
    max-width: 960px;
    max-height: 90vh;
    padding: 18px 18px 24px;
    box-shadow: 0 0 24px rgba(0, 0, 0, 0.6);
    border-radius: 8px;
}
#portfolio-vimeo-content .close-btn { position: absolute; top: 10px; right: 12px; }
.portfolio-vimeo-aspect {
    position: relative;
    width: 100%;
    padding-top: 56.25%;
    overflow: hidden;
    border-radius: 4px;
}
.portfolio-vimeo-aspect iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
```

---

## Przywracanie

Aby przywrócić ten system: wklej/odtworz powyższe fragmenty w odpowiednich plikach, upewnij się że `initPortfolio()` nie jest wywoływane przy starcie (tylko po hoverze na `#term-anim-portfolio`), oraz że w pętli render jest blok portfolio (frame + planeMeshes).
