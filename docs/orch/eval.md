# Evaluator Report — Sprint 16 Iteration 1

## Scope Read

I independently read the Sprint 16 contract and required review surface:

- `docs/plans/SPRINT16.md`
- `docs/FUTURE.md` Sprint 16 section
- `docs/commentary-pipeline.md`
- `docs/commentary-audit.md`
- `scripts/commentary-validate.mjs`
- `package.json`
- `docs/orch/gen_status.md`
- current `assets/image-packs/*/commentary.json` diff

The working tree is on `main...origin/main` with Sprint 16 commentary/schema
docs, validator, audit output, roadmap/project docs, and enum-only commentary
JSON changes. I did not commit.

## Contract Findings

### 1. Validator coverage

PASS. `scripts/commentary-validate.mjs` validates:

- `schemaVersion === commentary-bilingual-v1`
- `defaultLocale` in `ja` / `zh`
- bilingual `title`, `character.name`, `character.intro`, `intro`,
  `runwayIntro`, item `name`, item `tags`, and item `text`
- item count in the required 4-6 range
- unique kebab-case item IDs
- finite `part` enum:
  `jacket`, `top`, `bottom`, `dress`, `bag`, `shoes`, `accessory`, `hair`,
  `makeup`, `other`
- normalized `anchor` as two finite numbers in `[0, 1]`
- expression hints limited to `neutral`, `smile`, `thinking`
- optional `voice` path as a non-empty pack-relative path that stays inside the
  pack and exists when present
- optional `emotion`, `mouth`, root/item `beat`, and root/item `focus`
- optional `beat` / `focus` event strings and typed metadata against
  `NARRATIVE_EVENT_TYPES` from `src/narrativeBeats.js`

Errors are readable and include pack plus field path, for example
`[pack 7] items[1].part: expected one of ...`. The command exits non-zero on
validation errors by setting `process.exitCode = 1`.

### 2. Commentary JSON diff

PASS. The commentary diffs are semantic enum normalization only:

- `coat` / `outer` -> `jacket`
- `prop` / `umbrella` -> `other`

The diff does not change item IDs, anchors, expressions, names, tags, text, or
item order.

### 3. Production workflow docs

PASS. `docs/commentary-pipeline.md` documents the path from `source.md` and
prompts to candidate item extraction, then visual confirmation against
`images/main-visual.png` and `images/character-transparent.png`, then bilingual
commentary writing and `npm run commentary:validate`.

It also documents the 4-6 strong-item rule, normalized `anchor` placement,
finite `part` enum, expression hints, optional future fields, and missing voice
fallback behavior.

### 4. No-voice compatibility

PASS. Current data has zero `voice` fields and no voice directories. This is
valid under the docs and validator. `npm run narrative:smoke` passed with
subtitles/tags/look-card/tour/runway still functioning, and
`docs/commentary-audit.md` explicitly records the no-voice fallback as valid.

### 5. Sprint 13/14/15 regression checks

PASS.

- No diff in `src/magazineScene.js`, `src/render-config.js`, or
  `src/narrativeBeats.js`.
- DOM `鑑賞` remains real image pages per `npm run narrative:smoke`:
  `realImgPages=18`, `hasCanvasFallback=false`.
- Bokeh remains disabled by default:
  `src\magazineScene.js:577:    this.bokehPass.enabled = false;`
- Tone mapping remains Neutral:
  `src\render-config.js:46:    toneMapping: THREE.NeutralToneMapping,`
- Narrative smoke passed, including deep link, gallery landing, look-card,
  tour, runway, and reduced-motion checks.

### 6. Repeatability

PASS. The package script is present:

- `commentary:validate`: `node scripts/commentary-validate.mjs`

Build, asset audit, narrative smoke, documentation grep checks, and
`git diff --check` all ran successfully in this evaluator pass.

## Commands Rerun

### `npm run commentary:validate`

Exit 0.

Key output:

- `Commentary validation passed.`
- `Packs: 15/15`
- `Items: 75`
- `Part distribution: top=16, jacket=14, bottom=11, accessory=10, other=10, shoes=8, bag=6`
- `Expression usage: neutral=37, smile=29, thinking=9`
- `Voice fields: 0`
- `Audit: docs/commentary-audit.md`

### `npm run build`

Exit 0.

Key output:

- Vite v8.0.16 production build completed.
- `142 modules transformed.`
- Existing large chunk warning remains for `dist/assets/index-*.js`; no build
  error.

### `npm run asset:audit`

Exit 0.

Key output:

- Files audited: `558`
- Total size: `708.5 MB`
- Built `dist`: `93.7 MB`
- `assets/image-packs/commentary.json`: 15 files / `55.1 KB`
- WebGL variant drift check: `None. Every canonical WebGL-only PNG has a
  matching, up-to-date images-webgl/*.webp display copy.`

### `npm run narrative:smoke`

Exit 0.

Key output:

- `exactlyOneBeatPerSpread=true`
- `beatCount=8`
- Deep link: `state=open`, `spreadIndex=3`, `locale=zh`, `lookCard=true`,
  `activeItem=0`
- Gallery: `realImgPages=18`, `hasCanvasFallback=false`
- Tour and runway open successfully.
- Reduced motion: `grainEnabled=false`, `discoveryClassCount=0`
- Summary: `D:\work\AnimeMagazine\tmp\narrative-smoke\summary.json`

### Required `Select-String` checks

All exit 0.

- `docs/commentary-pipeline.md` matched `source.md`, `main-visual.png`,
  `character-transparent.png`, `anchor`, and `voice`.
- `docs/commentary-audit.md` matched `part distribution`, `Spot checks`, and
  `Corrections`.
- `docs/FUTURE.md` matched Sprint 16 heading and result section.
- `src/magazineScene.js` matched `this.bokehPass.enabled = false`.
- `src/render-config.js` matched `NeutralToneMapping`.

### `git diff --check`

Exit 0.

No whitespace errors. PowerShell/Git printed LF-to-CRLF working-copy warnings for
touched files only.

## Remaining Gaps

These are documentation/process-layer gaps, not blockers for Sprint 16:

- The audit spot checks are prose records, not machine-verifiable visual tests.
- The validator has no committed negative fixture suite proving each readable
  error path, although the implementation is direct and the happy path passes.
- `voice` is only schema/documentation-compatible in this sprint; actual voice
  file production and playback are intentionally deferred to later sprints.
- The validator allows unknown future optional metadata fields by design, so
  author discipline still depends on `docs/commentary-pipeline.md` for fields
  beyond the current UI contract.

## Decision

Sprint 16 satisfies `docs/plans/SPRINT16.md` and the Sprint 16 goals in
`docs/FUTURE.md`. No minimum corrective patch is required before closing this
sprint.

DECISION: COMPLETE
