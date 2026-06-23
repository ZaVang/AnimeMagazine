# Resource Pipeline Responsibility Map

Sprint 13a/13b separates three concerns that are easy to mix up: DOM reading
images, WebGL textures, and source art kept for editing or analysis. Format
changes must start from this ownership map instead of treating every PNG as the
same kind of asset.

## Non-Negotiable Reading Path

The `鑑賞` overlay is the reader. It stays a DOM layer built from real `<img>`
elements through `PageFlip.loadFromHTML`. Do not regress it to canvas flipbook
rendering and do not validate it with canvas pixel captures; canvas screenshots
cannot see this DOM layer.

The DOM reader may keep using the canonical page image paths. Any future reader
format experiment must preserve browser-native `<img>` rasterization and visual
clarity on high-DPR screens.

## Ownership Table

| Asset family | Runtime owner | Current path | Future format candidates | Notes |
|---|---|---|---|---|
| Cover, back cover, and page prints (`assets/image/cover.png`, `assets/image/back-cover.png`, `assets/image-packs/*/images/main-visual.png`) | DOM reader and WebGL magazine | DOM `鑑賞` uses real `<img>` pages; WebGL uses `ImageBitmapLoader` textures for the cover, first spread, and background page loads | WebGL-only variants may use KTX2/Basis or WebP/AVIF with source PNG fallback | DOM reader remains real `<img>`. WebGL variants must not replace the reader contract. |
| Background-loaded page textures | WebGL magazine | Loaded after the first spread, then assigned into `pageMaterials` | KTX2/Basis or WebP/AVIF variants are candidates after visual QA | Upload scheduling is a runtime performance concern; Sprint 13a queues warmup instead of uploading all completed loads immediately. |
| Standee cutouts, background-only art, expression sheets, action sheets | WebGL standees and analysis code | Canonical PNG sources stay in `images/`; generated WebP display copies live in `images-webgl/` and are loaded by raw `TextureLoader` | Current variants use q90 WebP for opaque background/expression sheets and lossless WebP for alpha-heavy figure/expression/action sheets | Do not feed these WebP display copies into DOM `鑑賞`. If future anchor/pixel analysis needs stricter fidelity, switch the specific family back to lossless/canonical and record the tradeoff. |
| PBR paper and wood maps (`public/pbr/*`) | WebGL materials | Public URL textures loaded by `TextureLoader` | Runtime copies may be downsampled first; KTX2/Basis remains a later candidate with normal-map compression chosen carefully | These do not participate in DOM reading. The paper/wood normal maps are now 1024px runtime variants even though the upstream filenames still contain `_2k`; canonical source archives remain in `assets/pbr/`. |
| OG image (`public/og-cover.png`) | HTML metadata and social bots | Static public file copied to `dist/` | Not a KTX2/Basis target | Bot preview assets are not WebGL textures. |
| Video and audio (`assets/video/*`, `public/audio/*`) | Runway/WebAudio | Native media elements and WebAudio decode | Separate media pipeline | Not part of texture packaging decisions. |

## Format Rules

- KTX2/Basis is only a candidate for WebGL texture consumers. It is not a DOM
  reader format and must not be used to replace `鑑賞` page `<img>` elements.
- WebP/AVIF variants are candidates for WebGL-only texture imports where Vite and
  browser support are verified. If they are ever considered for DOM reading, the
  implementation must still use real `<img>` or `<picture>` elements and must be
  visually checked at high DPR.
- Keep canonical PNG sources. Generated variants should be additive, auditable,
  and reversible.
- Do not claim any format change can exceed the source art ceiling. Current page
  art is bounded by the available source resolution.

## Sprint 13a Tooling Status

KTX2/Basis generation was intentionally not performed in Sprint 13a. Local CLI
checks for `toktx`, `basisu`, and `ktxsc` returned no installed command, and that
sprint did not add texture-compressor dependencies. The 13a work was limited to
auditability, documentation, and queued WebGL warmup.

## Sprint 13b PBR Downsample Record

The first post-review slimming pass downsampled only runtime PBR normal maps.
Paths were preserved so `TextureLoader` URLs and material setup did not change.
The source PBR zip/exr assets in `assets/pbr/` were not edited.

| File | Before | Current | Reduction |
|---|---:|---:|---:|
| `public/pbr/paper_0026/paper_0026_normal_opengl_2k.png` | 23,597,649 bytes (22.5 MB) | 6,063,774 bytes (5.78 MB) | 17,533,875 bytes (16.7 MB) |
| `public/pbr/wood_0066/wood_0066_normal_opengl_2k.png` | 20,977,974 bytes (20.0 MB) | 5,281,813 bytes (5.04 MB) | 15,696,161 bytes (15.0 MB) |

Combined public runtime reduction: 33,230,036 bytes (31.7 MB). After
`npm run build`, the same reduction should be visible in `dist/pbr/` and in
`docs/asset-audit.md`.

Use `npm run asset:audit` to refresh the size baseline in
`docs/asset-audit.md` after `npm run build`.

## Sprint 13b WebGL Display Variants

WebGL-only pack art now has generated display copies under
`assets/image-packs/*/images-webgl/*.webp`. The DOM reader still imports
canonical `main-visual.png` files and real `<img>` pages.

Generation command:

```powershell
npm run asset:webgl-variants
```

Tooling dependency: this command requires local `ffmpeg` with `libwebp` encoder
support. It is deliberately not wired into `npm run build`; generation is a
source-asset step, not a per-build transform.

Drift guard:

```powershell
npm run asset:audit
```

The audit fails if a canonical WebGL-only PNG is missing its
`images-webgl/*.webp` display copy, if a display copy has no source PNG, or if
the source PNG is newer than the generated WebP. Regenerate with
`npm run asset:webgl-variants`, then rerun the audit.

Observed generation summary:

| Family | Files | Source PNG | WebP display copy | Reduction |
|---|---:|---:|---:|---:|
| `background-only.png` | 15 | 33.3 MB | 3.33 MB | 29.9 MB |
| `expression-sheet.png` | 15 | 27.7 MB | 2.98 MB | 24.8 MB |
| `character-transparent.png` | 15 | 10.3 MB | 6.18 MB | 4.12 MB |
| `expression-sheet-transparent.png` | 15 | 22.6 MB | 14.1 MB | 8.42 MB |
| `action-sheet-transparent.png` | 15 | 17.6 MB | 11.2 MB | 6.46 MB |

After this split, `dist/assets` fell from 152.8 MB to 79.1 MB, and total
`dist/` fell from 167.4 MB to 93.7 MB. Source assets grow because canonical PNG
sources and generated WebP display copies both stay in the repo; the runtime
build no longer imports the WebGL-only PNG families.

## Sprint 13b Visual Smoke

Automated smoke used Playwright with system Chrome against the local Vite server
at `http://127.0.0.1:5174/`. The test waited for `window.__magazineScene`,
waited for all 15 standees to build, landed on spread 3, and raised the page 7
standee.

Observed:

- Desktop 1280x800: `standeeCount=15`, `entriesWithWebp=15`, target page 7
  reached `state=rising`, `visible=true`, `angle=1.22`.
- Mobile 375x812 at DPR 2: `standeeCount=15`, `entriesWithWebp=15`, target page
  7 reached `state=risen`, `visible=true`, `angle=1.47`.
- Target standee fit stayed inspectable: `scale=0.905`, `feetY=0.897`,
  `score=0.713`.
- Target figure/background/expression/action texture URLs all resolved to
  `assets/image-packs/7/images-webgl/*.webp`.
- Follow-up network capture reported no 4xx or failed requests.

Screenshots were written to local temp files:

- `tmp/visual-desktop-1280x800.png`
- `tmp/visual-mobile-375x812.png`
