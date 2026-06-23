# SPRINT 14 — Printed Paper Shader and Light Color Grade

> Active contract for `multi-ralph` Sprint 14. Use this file with
> `--sprint docs/plans/SPRINT14.md`; do not use the historical
> `docs/plans/SPRINT.md` contract for this sprint.

## Product Context

- Product: ATELIER アトリヱ, a Three.js 3D fashion magazine.
- Stack: Vite 8 + React 19 + Three.js 0.184 + page-flip 2.0.7.
- Current baseline: Sprint 13a/13b closed the resource budget; `dist/` is under
  100 MB, DOM `鑑賞` remains real `<img>`, and WebGL-only display assets use
  `images-webgl/*.webp`.
- Reference direction: `docs/messenger-visual-reference.md` and
  `docs/FUTURE.md` Sprint 14.

## Scope

Sprint 14 is a conservative visual-material pass. It should make the magazine
feel more like printed paper under light by moving richness into subtle shader
or material rules, not by adding large new image assets or changing navigation.

In scope:

- Printed paper / ink / page-edge shader or equivalent material extension.
- Bend-dependent highlight or shadow on turning/peeling pages.
- Subtle standee rim or soft cutout integration.
- Lightweight color grade inside the existing postprocessing pipeline.
- Reduced-motion handling for any time-driven visual effect.
- Build, asset audit, and visual smoke evidence.

Out of scope:

- Reopening BokehPass by default.
- Changing `renderer.toneMapping` away from the current Neutral baseline.
- Camera framing, page geometry dimensions, page count, gallery/DOM reader,
  commentary, TTS, or resource packaging changes.
- New large raster assets.
- Broad refactors of `magazineScene.js` or extraction of unrelated state-machine
  modules.

## Tasks

- [x] S14-PAPER-1: Printed paper material layer
  - Goal: Add subtle paper fiber, ink micro-contrast, page-edge breakup, or equivalent paper-print feel to printed page/cover surfaces.
  - Acceptance:
    - Printed pages and covers still use the existing page/cover texture maps and PBR paper maps.
    - The result still reads as paper/ink, not plastic, glass, bloom UI, or a screen overlay.
    - The effect is configurable or locally bounded and introduces no large new assets.

- [x] S14-TURN-1: Bend-dependent page highlight/shadow
  - Goal: Make active page peel/turn surfaces show a mild bend-aware light/shadow cue so bending paper has thickness and stress.
  - Acceptance:
    - The cue appears only during peel/turn or on the active turning leaf; settled pages keep their stable reading look.
    - Existing turn/peel state machine behavior, page dimensions, and camera framing are unchanged.
    - The cue does not make page content unreadable.

- [x] S14-STANDEE-1: Standee rim and soft cutout integration
  - Goal: Reduce the flat sticker feel of risen standees with subtle rim/edge integration while keeping the paper-cutout character.
  - Acceptance:
    - Standee NCC fitting, anchors, click targets, commentary UI, alpha behavior, and pose/action logic continue to work.
    - Transparent cutout edges do not show obvious halos or dark outlines.
    - Reduced-motion users do not receive fast pulsing or noisy edge animation.

- [x] S14-GRADE-1: Lightweight color grade and reduced-motion guard
  - Goal: Add a small configurable color-grade layer or equivalent postprocess adjustment that preserves the current NeutralToneMapping baseline.
  - Acceptance:
    - `BokehPass` remains disabled by default.
    - `renderer.toneMapping` stays `THREE.NeutralToneMapping` through the existing `render-config.js` path.
    - Any time-driven shader or postprocess component is disabled or frozen under reduced-motion; static paper texture is allowed.
    - Visual constants that belong to render baseline remain centralized in `render-config.js`; do not dump unrelated physics/material logic into it.

- [x] S14-VERIFY-1: Visual verification and documentation
  - Goal: Leave repeatable evidence that Sprint 14 works and did not regress the 13b resource/reader boundaries.
  - Acceptance:
    - `npm run build` passes.
    - `npm run asset:audit` passes and the WebGL variant drift check remains clean.
    - A repo-local visual smoke command exists and passes using system Chrome/Edge headless or an equivalent no-new-dependency path.
    - The visual smoke covers desktop 1280x800 and mobile 375x812, confirms a nonblank WebGL render, and records screenshot paths or summary metrics.
    - `docs/FUTURE.md` marks Sprint 14 items complete or explicitly deferred.
    - `docs/project_structure.md` is updated if new scripts, files, or material modules are introduced.

## Pitfalls To Respect

- Do not regress DOM `鑑賞`: it must remain real `<img>` pages, not canvas.
- Do not claim shader/SSAA can exceed the 941x1672 source-art ceiling for small print.
- Do not reopen BokehPass by default.
- Do not change tone mapping away from `THREE.NeutralToneMapping`.
- Do not wrap light color hex values with `LinearSRGBColorSpace`; that red line applies only to background/fog/material-color style values, not light constructors.
- Do not convert standee raw `TextureLoader` paths to `ImageBitmapLoader`; pixel analysis relies on unflipped images.
- If `render-config.js` changes, visual smoke must reload/recreate the scene before reading values.
- Keep Sprint 13b resource boundaries intact: `images-webgl/*.webp` for WebGL-only display copies, canonical PNG pages for DOM reading.

## Verification Commands

```powershell
npm run build
npm run asset:audit
npm run visual:smoke
Select-String -Path 'src/magazineScene.js' -Pattern 'this.bokehPass.enabled = false'
Select-String -Path 'src/render-config.js' -Pattern 'NeutralToneMapping'
Select-String -Path 'docs/FUTURE.md' -Pattern 'Sprint 14'
```
