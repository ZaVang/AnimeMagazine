# SPRINT 15 — Narrative Beats and Primary Spread Events

> Active contract for `multi-ralph` Sprint 15. Use this file with
> `--sprint docs/plans/SPRINT15.md`; do not use the historical
> `docs/plans/SPRINT.md` contract for this sprint.

## Product Context

- Product: ATELIER アトリヱ, a Three.js 3D fashion magazine.
- Stack: Vite 8 + React 19 + Three.js 0.184 + page-flip 2.0.7.
- Current baseline: Sprint 13 closed the resource budget and Sprint 14 added the
  printed material / light grade layer.
- Sprint 15 goal: make the magazine read more like an editorial tour. Each
  spread should have one primary event in focus, while secondary controls remain
  available but visually quieter.

## Scope

In scope:

- A backward-compatible narrative beat/focus layer for spreads.
- Primary-event emphasis for the HUD and scene affordances.
- First-time discovery for page turn, standee, reading mode, commentary, look
  card, and runway without adding large instruction text.
- A documented seven-state interaction matrix:
  `state` / `turn` / `show` / `tour` / `gallery` / `lookCard` / `peel`.
- Repeatable command-line smoke evidence for narrative state and reduced-motion
  behavior.

Out of scope:

- Voice/TTS training or audio playback.
- Resource format work, image generation, KTX2/WebP/AVIF changes, or new large
  assets.
- Rewriting gallery/DOM `鑑賞`; it must remain real `<img>` pages.
- Changing camera framing, page dimensions, page count, tone mapping, or Bokeh
  default.
- Forcing every image pack to have hand-authored final editorial copy. The data
  layer must allow optional metadata, and missing metadata must degrade cleanly.

## Tasks

- [x] S15-BEAT-1: Primary-event data layer
  - Goal: Establish one primary narrative event per spread or a deterministic
    fallback when metadata is absent.
  - Acceptance:
    - Existing `commentary.json` files remain valid without new required fields.
    - Optional `beat` / `focus` metadata can describe the primary event, emphasis,
      and gentle prompt behavior.
    - Every spread receives exactly one resolved primary event from metadata or
      fallback.
    - The event resolver is testable without booting WebGL.

- [x] S15-HUD-1: Primary-event HUD emphasis and noise reduction
  - Goal: Make the primary event easier to notice while keeping secondary
    controls reachable.
  - Acceptance:
    - The HUD exposes the current primary event in a small, non-instructional
      way and visually deemphasizes unrelated controls.
    - `鑑賞`, look-card, guided tour/commentary, and runway controls remain usable
      when available; no control disappears permanently because a different event
      is primary.
    - Mobile 375px has no overlap between primary-event UI, bottom status,
      standee, and core controls.
    - Reduced-motion does not receive pulsing, swaying, or animated discovery
      emphasis.

- [x] S15-DISCOVERY-1: First-time discovery cues
  - Goal: Help a first-time user discover page turn, standee, `鑑賞`, commentary,
    look-card, and runway without relying on keyboard shortcuts or long HUD text.
  - Acceptance:
    - Each cue is scene-appropriate: camera/light/soft hotspot/tag/control
      emphasis is preferred over explanatory copy.
    - Each cue is shown at most once per session or only when the relevant event
      is actually available.
    - Cues respect reduced-motion and do not reintroduce static/dynamic noise.
    - Existing deep link, gallery landing, look-card, tour, and runway flows are
      not interrupted by discovery cues.

- [x] S15-STATE-1: Seven-state matrix and guards
  - Goal: Recheck the seven-state interaction matrix and document what each new
    or touched entry point does when another state is active.
  - Acceptance:
    - `docs/state-matrix.md` or an equivalent project doc lists the policy for
      `state` / `turn` / `show` / `tour` / `gallery` / `lookCard` / `peel`.
    - Any new or touched entry point declares whether it closes, returns, or
      queues when another state is active.
    - There is a repo-local smoke command or test that exercises representative
      state transitions: deep link, gallery landing, look-card, runway/tour, and
      reduced-motion.

- [x] S15-VERIFY-1: Verification and roadmap closeout
  - Goal: Leave repeatable evidence that Sprint 15 works without regressing the
    Sprint 13/14 boundaries.
  - Acceptance:
    - `npm run build` passes.
    - `npm run asset:audit` passes and WebGL variant drift remains clean.
    - `npm run visual:smoke` passes.
    - A repo-local narrative smoke command exists and passes.
    - `docs/FUTURE.md` marks Sprint 15 complete or explicitly defers any
      product-polish residue.
    - `docs/project_structure.md` is updated for new modules/scripts/docs.

## Pitfalls To Respect

- Do not regress DOM `鑑賞`: it must remain real `<img>` pages, not canvas.
- Do not reopen BokehPass by default or change `THREE.NeutralToneMapping`.
- Do not turn decorative HUD text into required instructions.
- Do not put persistent card/tour/runway state into preferences.
- Do not read card/commentary availability from runtime `this.standees` when the
  module-level commentary index is the correct source.
- New or touched entry points must pass the seven-state guard matrix.
- Reduced-motion users must not get animated pulses, static frozen noise, or
  delayed scroll/animation dependencies.
- Mobile decorations are expendable; core controls and content are not.

## Verification Commands

```powershell
npm run build
npm run asset:audit
npm run visual:smoke
npm run narrative:smoke
Select-String -Path 'src/magazineScene.js' -Pattern 'this.bokehPass.enabled = false'
Select-String -Path 'src/render-config.js' -Pattern 'NeutralToneMapping'
Select-String -Path 'docs/FUTURE.md' -Pattern 'Sprint 15'
Select-String -Path 'docs/state-matrix.md' -Pattern 'state','turn','show','tour','gallery','lookCard','peel'
git diff --check
```
