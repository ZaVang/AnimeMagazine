# SPRINT 13a — Resource Baseline and Background Warmup

> This was the active contract for `multi-ralph` Sprint 13. Post-review, it is
> labeled Sprint 13a because it completed the baseline/warmup subset, not the
> full roadmap resource-slimming commitment. Remaining runtime slimming work now
> lives in `docs/FUTURE.md` Sprint 13b. This contract also intentionally isolates
> the work from the historical `docs/plans/SPRINT.md` contract, whose old
> optional D3 item is not part of this sprint.

## Product Context

- Product: ATELIER アトリヱ, a Three.js 3D fashion magazine.
- Stack: Vite 8 + React 19 + Three.js 0.184 + page-flip 2.0.7.
- Current visual baseline: 3D paper installation plus DOM `鑑賞` reading layer.
- Reference direction: `docs/messenger-visual-reference.md` and `docs/FUTURE.md`
  Sprint 13a and `docs/FUTURE.md` Sprint 13b.

## Scope

Sprint 13a is the resource/clarity baseline pass. It reduces future guesswork
and removes one known jank source without changing the art direction. It does
not by itself deliver the full "heavy/blurred/slow" runtime budget reduction.

In scope:

- Asset audit command and persisted report.
- Clear documentation of WebGL texture vs DOM reading image responsibilities.
- A concrete first performance fix: background GPU texture upload must be
  queued and drained over frames instead of warmed all at once as page loads
  finish.
- Build verification and audit verification.

Out of scope:

- Generating KTX2/Basis production assets. No KTX2 CLI is currently installed.
- Replacing all PNG pages with WebP/AVIF in this sprint.
- Reopening BokehPass or changing tone mapping.
- Changing camera framing, page geometry, commentary, TTS, or visual style.

## Tasks

- [x] S13-AUDIT-1: Asset audit command and baseline report
  - Goal: Make asset weight visible and repeatable instead of relying on ad hoc shell commands.
  - Acceptance:
    - A repo command can audit source assets and built `dist/` assets.
    - The command reports totals by extension/category and a largest-file list.
    - A persisted docs report records the current baseline and the exact command used.

- [x] S13-DOC-1: Resource pipeline responsibility map
  - Goal: Document which assets are WebGL textures, which assets are DOM reading images, and which future formats fit each path.
  - Acceptance:
    - The doc states that DOM `鑑賞` stays real `<img>` and must not regress to canvas flipbook rendering.
    - The doc states that WebGL-only textures are candidates for KTX2/Basis or WebP/AVIF variants.
    - The doc records that KTX2/Basis generation is blocked by missing local CLI tooling in this sprint.

- [x] S13-PERF-1: Background texture GPU upload queue
  - Goal: Avoid uploading every background page texture to the GPU immediately as async image loads finish.
  - Acceptance:
    - Background-loaded page textures are queued for GPU warmup.
    - The render loop drains only a small number of queued textures per frame.
    - Initial visible cover/first spread behavior remains unchanged.
    - `鑑賞` overlay still skips 3D rendering while open.

- [x] S13-VERIFY-1: Verification artifacts
  - Goal: Leave evidence that Sprint 13a passed without relying on memory.
  - Acceptance:
    - `npm run build` passes.
    - The asset audit command passes after build.
    - `docs/orch/gen_status.md` and `docs/orch/eval.md` record actual outputs.

## Pitfalls To Respect

- Do not regress DOM `鑑賞`: it must remain real `<img>` pages, not a canvas path.
- Do not claim SSAA can fix page clarity beyond the 941x1672 source asset ceiling.
- Do not reopen BokehPass by default.
- Do not move visual constants out of `render-config.js` or change tone mapping in this sprint.
- Do not modify user-owned unrelated dirty files, especially the existing
  `package-lock.json` change unless npm itself updates it for a justified reason.

## Verification Commands

```powershell
npm run build
npm run asset:audit
Test-Path -LiteralPath 'dist/index.html'
Test-Path -LiteralPath 'docs/asset-audit.md'
Select-String -Path 'docs/asset-audit.md' -Pattern 'Largest files','Totals by extension','Command'
```
