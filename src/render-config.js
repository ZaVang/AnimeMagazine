// Move-only consolidation of visual-config constants from magazineScene.js
// (Sprint 6 / Iter 3 TECH-1). Pure data: 0 logic, 0 this-deps, 0 state — safe
// to A/B-test by editing this file alone. The structural payoff:
//
//   1. The Iter 2 pitfall "GrainShader uVignette default must move in lockstep
//      with applyShowDim's runway base" is now PHYSICALLY locked — both sites
//      read `RENDER.grain.vignette`, so silent desync is impossible.
//   2. The 17 联调点位 that an Iter 4 tonemap-switch would touch are visible
//      in one ~30-line block here, instead of scattered across 9 functions.
//
// Red-lines from prior iterations preserved:
//   - light.color hex stays a numeric literal (HemisphereLight / Directional /
//     SpotLight constructors run the default sRGB→linear PBR path). DO NOT
//     wrap in `new THREE.Color().setHex(hex, LinearSRGBColorSpace)` — that
//     breaks Iter 2 red-line ③ (rim reads one step less warm).
//   - bg / fog hex stay numeric literals so the caller can keep its
//     `new THREE.Color().setHex(RENDER.scene.bgHex, THREE.LinearSRGBColorSpace)`
//     call. The second arg is the Iter 2 VIS-SRGB-FIX path; this file just
//     hands over the numeric value.
//   - Material baseColor hex (spineMaterial 0x2a2018 / cover edgeMaterial
//     0x2a2018) is deliberately NOT here — those belong to the "material
//     resource" layer, not "render baseline config" (Scout C-5 boundary).
//   - applyShowDim runway lerp coefficients (0.96 / 0.95 / 0.78 / 1 / 0.95 /
//     0.97) and lightLevels lazy-capture stay in magazineScene.js — those are
//     dramatic-curve LOGIC, not config (Evolution §A.sub-conclusion).
//   - light.position / shadow.camera bounds / SpotLight physical params
//     (distance/angle/penumbra/decay) stay in magazineScene.js — those are
//     "light placement" not "style config".

import * as THREE from "three";

export const RENDER = {
  // --- WebGLRenderer baseline (consumed in createRenderer) -------------------
  renderer: {
    outputColorSpace: THREE.SRGBColorSpace,
    // TONEMAP-1 Stage 1 (Sprint 6 / Iter 4): ACES → Neutral. Research A3
    // minimal-action path — Neutral preserves hue fidelity (cover red reads
    // deeper / closer to the book skin; paper highlight returns from "near
    // white" to "warm-cream"; shadows stay tinted not crushed). The S-curve
    // roll-off ACES used to hide highlight clip is gone, so exposure rises
    // to 1.18 to compensate for the ~5% perceived luminance loss. Stage 2
    // (fallback) would lower exposure to 0.90 + rim 1.5→1.2 + envIntensity
    // 0.55→0.45 + envMap 9 buckets ×0.85 if Tier B clipFrac/brightFrac
    // gates trip; the 6 + 1 red-lines are documented in docs/orch/plan.md
    // §TONEMAP-1.
    toneMapping: THREE.NeutralToneMapping,
    exposure: 1.18,
    // Iter 2: PCFSoftShadowMap is deprecated alias on r0.184 → silent fallback
    // to PCFShadowMap + console warn ×2 per fresh load. The new PCFShadowMap
    // IS the soft implementation (see pitfalls "BUG-SHADOWMAP-DEPRECATED").
    shadowType: THREE.PCFShadowMap,
  },

  // --- Scene baseline (consumed in createScene) ------------------------------
  scene: {
    // bg / fog hex are numeric literals. Caller wraps them with
    // `setHex(hex, LinearSRGBColorSpace)` — that's the Iter 2 VIS-SRGB-FIX
    // round-trip path for non-map hex on the OutputPass path.
    bgHex: 0x18130e,
    fogHex: 0x18130e,
    fogNear: 2.8,
    // VIS-FOG-FAR (Sprint 6 / Iter 3): 7.5 → 9.0. Iter 2 measured adjacent
    // band lum jump of 17 (max) across 10 horizontal bands at the far floor;
    // 7.5m far gave only 4.7m fog ramp vs ~4.73m cam→lookAt — too narrow,
    // far floor read as a hard cut. 9.0m lengthens the ramp by ~32% so
    // adjacent bands soften (target ≤12). fog.near stays 2.8 (still ≤
    // cam→lookAt distance, BUG-FOG-NEAR constraint intact).
    fogFar: 9.0,
    envIntensity: 0.55,
  },

  // --- Light baseline (consumed in createLights) -----------------------------
  // Iter 1 joint rebalance — env 0.18→0.55 carries the IBL fill so these
  // directional/spot intensities only need to RESHAPE on top of that IBL.
  // Color hex values stay numeric literals so light constructors go through
  // the default sRGB→linear PBR path (Iter 2 red-line ③).
  lights: {
    // VIS-TABLE-SYM (Sprint 6 / Iter 3): 0.8 → 0.95. Iter 1 baseline 0.8 left
    // front-left wood lum 73 vs front-right 131 (1.8:1, "重心偏右"); hemi is
    // omnidirectional ambient, lifts the dark side more than the bright side
    // proportionally (ACES roll-off on the bright side), narrowing the ratio.
    // Pool position shift below (-1.1→-0.6 x) does the asymmetric correction.
    hemi: { skyHex: 0xfff4e4, groundHex: 0x171210, intensity: 0.95 },
    key: { hex: 0xffe4c3, intensity: 2.6 },
    pool: { hex: 0xffdfb4, intensity: 28 },
    fill: { hex: 0xd8e8ff, intensity: 0.55 },
    // VIS-RIM-BOOST (Sprint 6 / Iter 3): 0.9 → 1.5. Iter 2 lifted 0.45→0.9
    // (back/above warm rim, Marmoset 3-point baseline). Experience Iter 3
    // measured the gold-edge band at lum 217 max with no peak (rim < 3% of
    // total irradiance); 1.5 (~+67%) is the conservative cheapest path (a)
    // — no position change, no fresnel shader. Rim still lerps to ~5% on
    // runway dim via applyShowDim's 0.95 coefficient (5 lights register in
    // lightLevels lazily on first startShow, the new value is captured
    // automatically — see pitfalls "新增光源必须同步 lightLevels +
    // applyShowDim").
    rim: { hex: 0xfff0d8, intensity: 1.5 },
  },

  // --- envMapIntensity buckets (consumed by 9 material factories) ------------
  // Iter 1 joint rebalance — env 0.18→0.55 means materials now reflect more
  // IBL; these per-bucket values were tuned at the same time so paper / cover
  // / table glints all settled at the same time.
  envMap: {
    printed: 0.55, // createPrintedMaterial (cover front/back + page prints)
    paper: 0.4, // createPaperMaterial (page back, blank pages, expression card frame)
    table: 0.4, // createTable wood
    spine: 0.4, // createPageBlocks spineMaterial
    coverEdge: 0.4, // createCover edgeMaterial (4-edge frame)
    standee: 0.32, // buildStandee figure
    swingTag: 0.2, // buildCommentaryUI tag
    expression: 0.25, // buildExpressionCard photo
    colophon: 0.2, // colophonMaterial (奥付 page)
  },

  // --- Post-processing GrainShader + applyShowDim runway base ----------------
  // STRUCTURAL PAYOFF: GrainShader.uVignette default and applyShowDim's runway
  // base must stay in lockstep (Iter 2 pitfall VIS-VIGNETTE-RIM). Pre-Iter-3
  // they were two literals at lines 172 + 2590 that could silently desync.
  // Now both read `RENDER.grain.vignette` — physical lockout.
  grain: {
    amount: 0.03,
    vignette: 0.2,
    runwayDelta: 0.3, // applyShowDim pulls vignette up by this on runway
  },
};
