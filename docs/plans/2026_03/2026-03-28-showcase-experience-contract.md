# Kontrakt ShowcaseExperience (TOPKEK)

Krótki opis API dla trybów „pokazu” na stronie (VAJBUJ, MYSEN, przyszłe animacje). **Konfiguracja** zostaje w `config.js` / `*-config.js`; **logika** w modułach experience. Kernel (`script.js`) nie importuje cyklicznie z experience — experience dostaje `context` z zewnątrz.

## Minimalny interfejs

| Element | Opis |
|--------|------|
| `id` | Unikalny string, np. `vajbuj`, `mysen`. |
| `isActive()` | Czy tryb aktualnie trwa (łącznie z fazą zatrzymywania, jeśli ma blokować inne tryby). |
| `enter(context)` | Start: kamera, widoczność sceny, audio, meshe; opcjonalnie **snapshot** postprocessingu. |
| `update(dt, context)` | Logika klatki. |
| `exit(reason)` | Fade, dispose, **restore** postproc/kamery/UI. |

## Context (przekazywany z kernela)

Referencje tylko jako argumenty lub obiekt read-only: `scene`, `camera`, `renderer`, `composer`, `bloomPass`, `saoPass`, `crtPass`, `clock`, font loader wynik (`loadedFontRegular`), itp. **Zakaz** `import` z `script.js` wewnątrz experience (cykle).

## Postprocessing (jeden EffectComposer)

1. **Snapshot** przy `enter`: skopiować pola passów (`bloomPass?.strength`, uniformy CRT, `saoPass.params`, …).  
2. **Apply** preset z konfiguracji trybu.  
3. **Restore** przy `exit` ze snapshotu.  
Pass `null` = wyłączony w profilu wydajności — zawsze `if (pass)` przed odczytem/zapisem.

## Kamera

Wspólne helpery (np. `applyCameraProfile` / `restoreCameraSnapshot`) zamiast kopiowania ustawień `controls`, `fov`, orbit między trybami.

## FX volumetryczne / runtime

Polityka per tryb (np. blokada auto-glitch, własny preset) — docelowo jedna funkcja typu `shouldAutoTriggerGlitch(activeExperiences)` zamiast rozproszonych `if`.

## Rejestr (kernel)

`showcase-registry.js`: rejestr funkcji `() => boolean` dla „czy coś blokuje auto-start VAJBUJ / symulację myszy / …”. Jedno miejsce zamiast `|| nowyTryb.active` w wielu miejscach w `script.js`.
