# SPRINT 16 — Commentary Production Pipeline

> Active contract for `multi-ralph` Sprint 16. Use this file with
> `--sprint docs/plans/SPRINT16.md`; do not use the historical
> `docs/plans/SPRINT.md` contract for this sprint.

## Product Context

- Product: ATELIER アトリヱ, a Three.js 3D fashion magazine.
- Stack: Vite 8 + React 19 + Three.js 0.184 + page-flip 2.0.7.
- Current baseline: all image packs already have bilingual `commentary.json`,
  look-card/tour/runway are wired, and Sprint 15 added optional primary-event
  `beat` / `focus` support.
- Sprint 16 goal: turn commentary authoring from one-off hand edits into a
  repeatable data production workflow with validation, audit output, and clear
  compatibility rules.

## Scope

In scope:

- Documentation for creating and maintaining one image pack's commentary data.
- A backward-compatible commentary schema contract, including optional future
  fields: `voice`, `emotion`, `mouth`, `beat`, and `focus`.
- A repo-local validation command for all existing `assets/image-packs/*/commentary.json`.
- Normalization of existing data only where required for the agreed schema
  (for example invalid `part` values).
- A lightweight audit / spot-check artifact for at least three representative
  packs.

Out of scope:

- TTS training, voice generation, or adding actual voice files.
- Rewriting commentary copy across all packs for taste alone.
- Generating new images, anchors, expression sheets, or fashion item imagery.
- Changing `magazineScene.js` just to support commentary edits; the frontend
  must already read data-driven commentary.
- Changing Sprint 13/14/15 boundaries: DOM `鑑賞`, WebGL variants, Bokeh default,
  tone mapping, narrative beats, and state matrix must stay intact.

## Tasks

- [x] S16-WORKFLOW-1: Commentary authoring workflow doc
  - Goal: Document the repeatable path from source material to validated
    `commentary.json`.
  - Acceptance:
    - The doc explains the sequence: inspect `source.md` / prompts, extract
      candidate fashion items, visually confirm against `main-visual.png` and
      `character-transparent.png`, write bilingual commentary, then validate.
    - It explains how to choose 4-6 strong items instead of filling weak
      hotspots.
    - It explains how to place or revise normalized `anchor` coordinates.
    - It explicitly says missing voice files must degrade to subtitles/tags.

- [x] S16-SCHEMA-1: Commentary schema contract and compatibility rules
  - Goal: Make the commentary shape explicit enough for authors and scripts.
  - Acceptance:
    - Required fields, optional fields, locale fields, item fields, expression
      hints, `beat` / `focus`, `voice`, `emotion`, and `mouth` are documented.
    - `part` uses the finite enum:
      `jacket`, `top`, `bottom`, `dress`, `bag`, `shoes`, `accessory`, `hair`,
      `makeup`, `other`.
    - Existing data conforms to the enum or is normalized without changing user
      meaning.
    - Optional fields are backward-compatible: omitted values do not break the
      app, and unknown future optional fields are not required for current UI.

- [x] S16-VALIDATE-1: Local commentary validation command
  - Goal: Add a one-command validator for all commentary files.
  - Acceptance:
    - A repo-local command exists, for example `npm run commentary:validate`.
    - It validates JSON shape, `schemaVersion`, bilingual locale completeness,
      item count, unique item IDs, `part` enum, `anchor` range, supported
      expression hints, optional `beat` / `focus` event types, and optional
      `voice` path existence when present.
    - It prints readable errors with pack ID and field path.
    - It exits non-zero on validation errors and zero when the repository data
      is valid.

- [x] S16-AUDIT-1: Commentary audit and spot checks
  - Goal: Leave a small human-readable audit artifact so data quality is visible
    without opening every JSON file.
  - Acceptance:
    - The audit summarizes all packs: file count, item count, part distribution,
      expression usage, optional field usage, and any missing/empty voice status.
    - At least three representative packs are spot-checked in prose for hotspot
      reasonableness, Japanese tone, Chinese meaning, and expression linkage.
    - The audit records any data corrections made in this sprint.

- [x] S16-VERIFY-1: Verification and roadmap closeout
  - Goal: Prove Sprint 16 completed without frontend or resource regressions.
  - Acceptance:
    - `npm run commentary:validate` passes.
    - `npm run build` passes.
    - `npm run asset:audit` passes and WebGL variant drift remains clean.
    - `npm run narrative:smoke` passes.
    - `docs/FUTURE.md` marks Sprint 16 complete or explicitly defers any
      product-polish residue.
    - `docs/project_structure.md` is updated for new scripts/docs.

## Pitfalls To Respect

- New or modified commentary data must not require editing `magazineScene.js`.
- Do not read card/commentary availability from runtime `this.standees`; use the
  module-level commentary path and pure data helpers.
- Do not make `voice` required. Missing voice files must not break subtitles,
  tags, look-card, tour, or narrative smoke.
- Do not create broad copy churn just to satisfy validation; only normalize data
  needed for the schema or audit.
- Do not add dependencies unless clearly justified; a simple Node validator is
  preferred.
- Keep `part` enum finite and documented. If an item does not fit, use
  `accessory` or `other` intentionally and record the choice.
- Keep optional `beat` / `focus` compatible with Sprint 15 narrative resolver.
- Do not regress DOM `鑑賞`, Bokeh disabled default, or NeutralToneMapping.

## Verification Commands

```powershell
npm run commentary:validate
npm run build
npm run asset:audit
npm run narrative:smoke
Select-String -Path 'docs/commentary-pipeline.md' -Pattern 'source.md','main-visual.png','character-transparent.png','anchor','voice'
Select-String -Path 'docs/commentary-audit.md' -Pattern 'Spot checks','part distribution','Corrections'
Select-String -Path 'docs/FUTURE.md' -Pattern 'Sprint 16'
Select-String -Path 'src/magazineScene.js' -Pattern 'this.bokehPass.enabled = false'
Select-String -Path 'src/render-config.js' -Pattern 'NeutralToneMapping'
git diff --check
```
