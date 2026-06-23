# Messenger Three.js Reference — for ATELIER

Source: WeChat article `最近火的那个Three.js星球游戏，是怎么做出来的？`
URL: https://mp.weixin.qq.com/s/IYptvKlyLwto69-sxxZcIA
Author: 毛豆西葫芦园子
Article timestamp observed from page metadata: 2026-06-19 08:51:54 UTC

This note is not a feature spec. It is a reusable design/technical lens for
future ATELIER visual upgrades.

## Core Takeaway

Messenger's value is not "more Three.js". Its value is a tight visual system:
thin app shell, light scene graph, strong shader-driven atmosphere, compressed
assets, optional post-processing, and browser-level verification.

For ATELIER, the lesson is:

> Keep the magazine as a paper installation, but move more of the perceived
> richness into shaders, resource discipline, and narrative pacing instead of
> adding more heavy PNG layers or UI controls.

## What Messenger Does Well

1. Thin framework shell
   - SvelteKit/Svelte is mostly the wrapper.
   - The memorable effect lives in Three.js objects, GLSL shaders, and render
     pipeline choices.

2. Shader-first visual richness
   - Water, terrain, clouds, tree motion, and post-processing are driven by GLSL.
   - Noise functions create variation without requiring huge bespoke texture sets.
   - Time uniforms give the scene a living quality with small GPU-side changes.

3. Resource formats match WebGL delivery
   - Draco geometry compression reduces model payloads.
   - KTX2/Basis texture compression keeps GPU textures compact and avoids paying
     full PNG decode/upload cost for every visual layer.

4. Optional post-processing
   - The render chain can add color grading and depth effects when the device can
     afford it, and skip them when it cannot.
   - Post effects are a visual language tool, not a default pile-on.

5. Real-browser verification
   - WebGL behavior must be tested in a browser, not inferred from Node tests.
   - Rendering checks need screenshots, pixel probes, and interaction smoke tests.

## ATELIER Mapping

Current ATELIER strengths:

- The paper-installation concept is coherent: 3D table, magazine, page turns,
  standees, expression cards, runway mode, and DOM reading mode.
- The split between 3D browsing and DOM `鑑賞` reading is correct. The DOM page
  layer stays crisp because it uses real `<img>` pages, not a canvas flipbook.
- The renderer already has important hygiene: SSAA bounded by DPR, shadow maps
  refreshed only while casters move, ImageBitmap decoding for print art, and
  BokehPass disabled by default.

Current gaps compared with the Messenger pattern:

- Visual richness is still mostly asset-heavy PNG/PBR, not shader-authored.
- Production assets are very heavy for the amount of visible motion. The build
  currently ships many large PNGs and 2k PBR maps.
- The few shaders we have are narrow: grain and runway stage masking. Paper,
  ink, page edge, standee silhouette, and material aging are still mostly static.
- Interaction has many features, but the path can feel like operating a demo
  rather than being guided through a visual story.

## Borrow, Adapt, Avoid

Borrow:

- Use shader layers for paper grain, ink edge softness, page-edge glints,
  standee rim response, and subtle live atmosphere.
- Convert WebGL-only textures to GPU-friendly compressed formats when feasible.
- Make post-processing a small configurable chain: color grade first, expensive
  effects only when they clearly earn their frame cost.
- Add deterministic visual tests for desktop and mobile viewports before calling
  any visual iteration complete.

Adapt:

- Messenger uses low-poly world geometry; ATELIER should keep flat printed pages
  and paper-object geometry.
- Messenger's OrbitControls-style exploration should translate into restrained
  editorial camera pacing, not free camera chaos by default.
- Noise should support print/paper/lighting texture, not become generic animated
  decoration.

Avoid:

- Do not re-open BokehPass by default. Prior ATELIER profiling showed it is too
  expensive for little benefit in this scene.
- Do not chase 3D single-page zoom as the main reading fix. Reading belongs in
  the DOM `鑑賞` layer.
- Do not assume higher SSAA can fix page clarity. The 941x1672 page assets are
  the ceiling; true clarity needs higher-resolution source pages.
- Do not make this a global Codex skill yet. This is currently project-specific
  visual direction, not a proven reusable workflow.

## Candidate Workstreams

### 1. Resource Pipeline Pass

Goal: reduce load, upload, and memory pressure without changing the experience.

- Audit built asset size by category: page prints, background-only images,
  standee cutouts, expression sheets, PBR maps, video.
- Generate WebGL texture variants for non-DOM surfaces: KTX2/Basis where the
  toolchain is available, otherwise WebP/AVIF as an intermediate step.
- Keep DOM `鑑賞` images browser-native and crisp: use high-resolution source
  images plus responsive `srcset`, not compressed GPU textures.
- Downsize or replace oversized PBR maps if the camera never resolves their
  2k detail.

Acceptance checks:

- `npm run build` passes.
- First usable frame is not delayed by non-visible page/standee assets.
- 1280x800 and 375x812 visual checks show no color/orientation regressions.
- Dist asset totals and largest-file list are recorded before/after.

### 2. ATELIER Paper Shader Pass

Goal: move tactile paper/print richness into cheap GPU-side variation.

Candidate shader surfaces:

- Printed page material: subtle paper fiber, ink micro-contrast, page edge
  darkening, controlled specular breakup.
- Page-turn leaf: bend-dependent highlight and shadow, so turning feels more
  physical without adding geometry.
- Standee material: soft rim and cutout integration, not a hard flat sticker.
- Dust/air layer: keep extremely subtle; it should support the room, not become
  a visible particle effect.

Acceptance checks:

- Reduced-motion disables time-varying decorative effects.
- Pixel checks confirm average luminance and clipping stay within the current
  `render-config.js` visual baseline.
- Manual review verifies the page still reads as print, not plastic or glass.

### 3. Lightweight Color Grade

Goal: give 3D view, runway mode, and UI overlays a shared editorial tone.

- Prefer one small ShaderPass or LUT-style mapping after the main render.
- Keep it configurable through `render-config.js`.
- Treat it as color management, not as a place to add blur, bloom, or heavy DoF.

Acceptance checks:

- No highlight clipping on cover, paper, or standee rim.
- DOM `鑑賞` layer remains visually compatible with the 3D scene.
- Mobile and desktop screenshots keep the same art direction.

### 4. Narrative Pacing Pass

Goal: make the experience feel guided rather than feature-dense.

- Define one primary focal event per spread: page turn, standee rise, look card,
  runway, or quiet reading.
- Add restrained camera nudges and captions only when they clarify the current
  visual beat.
- Make hidden interactions discoverable through the scene itself before adding
  more HUD text.

Acceptance checks:

- First-time user can discover page turn, standee, and reading mode without
  keyboard knowledge.
- Existing deep links, gallery landing, look card state guards, and reduced
  motion behavior still pass.

## When To Promote This Into A Skill

Do not create a global skill from this note yet.

Promote later only after at least one ATELIER implementation pass proves the
workflow in code and verification. A good future skill would be:

`threejs-visual-system-audit`

It should contain reusable prompts/checklists for:

- thin shell vs shader/core split
- asset format and payload audit
- shader opportunities by surface
- optional post-processing gates
- reduced-motion rules
- browser screenshot and pixel verification

Do not include:

- ATELIER-specific file paths
- this project's line numbers
- private source links beyond public references
- exact visual constants from `render-config.js`

