# Generator Status — Iteration 1

## 完成的任务
- [x] S13-AUDIT-1: Asset audit command and baseline report — 新增 `npm run asset:audit` / `scripts/asset-audit.mjs`，审计 `assets/`、`public/`、`dist/`，并生成 `docs/asset-audit.md` baseline。
- [x] S13-DOC-1: Resource pipeline responsibility map — 新增 `docs/resource-pipeline.md`，明确 DOM `鑑賞` real `<img>` 红线、WebGL-only texture 候选格式，以及本轮不生成 KTX2/Basis 的 tooling 原因。
- [x] S13-PERF-1: Background texture GPU upload queue — `startBackgroundPageLoads()` 不再立即 `renderer.initTexture()`；后台页 texture 入队，`animate()` 在非 `鑑賞` 状态下每帧 drain 1 个。
- [x] S13-VERIFY-1: Verification artifacts — `npm run build` 和 build 后 `npm run asset:audit` 均已运行，`docs/orch/gen_status.md` 与 `docs/orch/eval.md` 记录实际输出。

## 未完成的任务（如有）
- 无。

## 验收命令输出

### `npm run build`

```text
> build
> vite build

vite v8.0.16 building client environment for production...
transforming...✓ 141 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                            3.12 kB │ gzip:   1.26 kB
dist/assets/character-transparent-DzC2eXJ7.png           545.63 kB
dist/assets/character-transparent-ogtor0mY.png           592.49 kB
dist/assets/character-transparent-Bn5xM7m4.png           637.08 kB
dist/assets/character-transparent-DUcoKlZP.png           651.74 kB
dist/assets/character-transparent-BuafgYHq.png           655.51 kB
dist/assets/character-transparent-MuIn2DeU.png           688.47 kB
dist/assets/character-transparent-CGvwRk66.png           689.86 kB
dist/assets/character-transparent-CTAxnUbZ.png           693.15 kB
dist/assets/character-transparent-5B2fJcX6.png           702.98 kB
dist/assets/character-transparent-BaVzFevz.png           743.38 kB
dist/assets/character-transparent-UX0ykrm0.png           746.97 kB
dist/assets/character-transparent-Blp8k4I3.png           762.53 kB
dist/assets/character-transparent-CR3OLnbD.png           798.48 kB
dist/assets/character-transparent-BspBRIoI.png           818.84 kB
dist/assets/action-sheet-transparent-Du0GTp2G.png      1,014.48 kB
dist/assets/action-sheet-transparent-BYIBG9Jd.png      1,032.10 kB
dist/assets/action-sheet-transparent-utr3jiKd.png      1,050.94 kB
dist/assets/character-transparent-Cbl8v6CR.png         1,077.67 kB
dist/assets/expression-sheet-CZnjou6L.png              1,119.42 kB
dist/assets/action-sheet-transparent-C1BVuCiB.png      1,124.55 kB
dist/assets/action-sheet-transparent-_3VWQ-ar.png      1,128.40 kB
dist/assets/action-sheet-transparent-_D7jLf7-.png      1,195.30 kB
dist/assets/action-sheet-transparent-BKV0Im0C.png      1,199.11 kB
dist/assets/action-sheet-transparent-_Rcd2URO.png      1,215.49 kB
dist/assets/action-sheet-transparent-CyhWGTgZ.png      1,262.80 kB
dist/assets/expression-sheet-CAFYNSsu.png              1,267.83 kB
dist/assets/expression-sheet-transparent-C3TwYT41.png  1,315.74 kB
dist/assets/action-sheet-transparent-C1UG-ggn.png      1,324.66 kB
dist/assets/action-sheet-transparent-CPdza5oT.png      1,329.25 kB
dist/assets/action-sheet-transparent-VBU9AUmm.png      1,353.15 kB
dist/assets/expression-sheet-CVjYIS-w.png              1,356.80 kB
dist/assets/action-sheet-transparent-SJyr4DXL.png      1,397.66 kB
dist/assets/action-sheet-transparent-CP-ScxE1.png      1,418.16 kB
dist/assets/expression-sheet-mKwEWimq.png              1,424.19 kB
dist/assets/action-sheet-transparent-BkC0lk1L.png      1,441.75 kB
dist/assets/expression-sheet-transparent-DMXaAktw.png  1,443.84 kB
dist/assets/expression-sheet-NH_-cXWq.png              1,470.63 kB
dist/assets/expression-sheet-transparent-BS39pFmd.png  1,510.89 kB
dist/assets/expression-sheet-transparent-DOcQ9ruR.png  1,530.39 kB
dist/assets/expression-sheet-transparent-C6865TUX.png  1,546.12 kB
dist/assets/expression-sheet-transparent-BGeKSGaw.png  1,547.88 kB
dist/assets/expression-sheet-transparent-caFN3rrm.png  1,554.01 kB
dist/assets/expression-sheet-transparent-7qoRduXN.png  1,584.27 kB
dist/assets/expression-sheet-transparent-Cz-3xLiV.png  1,587.46 kB
dist/assets/expression-sheet-transparent-CcgH0vQc.png  1,628.01 kB
dist/assets/expression-sheet-transparent-DasQR07O.png  1,661.36 kB
dist/assets/expression-sheet-transparent-Du8p48te.png  1,666.79 kB
dist/assets/expression-sheet-transparent-6GpRnGWI.png  1,675.26 kB
dist/assets/expression-sheet-transparent-Bh_rAER0.png  1,696.99 kB
dist/assets/expression-sheet-transparent-D3edBN7S.png  1,708.25 kB
dist/assets/main-visual-CSV-prsj.png                   1,892.23 kB
dist/assets/background-only-DCMH3cpW.png               2,000.61 kB
dist/assets/back-cover-CkOUoEH3.png                    2,006.52 kB
dist/assets/main-visual-BGy0C4e2.png                   2,023.20 kB
dist/assets/cover-jiBCycv8.png                         2,024.27 kB
dist/assets/expression-sheet-8GIS8MEA.png              2,055.06 kB
dist/assets/background-only-GHy3TDjP.png               2,081.50 kB
dist/assets/background-only-BwIHKwT1.png               2,093.49 kB
dist/assets/expression-sheet-C-Qra5FH.png              2,098.13 kB
dist/assets/main-visual-CEelqdFq.png                   2,132.30 kB
dist/assets/expression-sheet-BFLNd7fy.png              2,141.02 kB
dist/assets/expression-sheet-D18KtDQ8.png              2,163.52 kB
dist/assets/background-only-q4sFJT4z.png               2,168.21 kB
dist/assets/background-only-FWZv4cLP.png               2,193.41 kB
dist/assets/expression-sheet-OEC7v-C0.png              2,195.96 kB
dist/assets/main-visual-Df8POoDU.png                   2,214.68 kB
dist/assets/background-only-BIWpqoqn.png               2,244.22 kB
dist/assets/main-visual-pUMRLqAZ.png                   2,252.12 kB
dist/assets/background-only-CYnG7EpM.png               2,275.99 kB
dist/assets/main-visual-Cc8YaCCs.png                   2,276.53 kB
dist/assets/main-visual-BpfQyWXm.png                   2,277.01 kB
dist/assets/main-visual-CApsDB4R.png                   2,284.03 kB
dist/assets/expression-sheet-DvIRtMxi.png              2,286.22 kB
dist/assets/main-visual-B1WOGzaA.png                   2,323.13 kB
dist/assets/expression-sheet-rJiZQoyy.png              2,327.40 kB
dist/assets/expression-sheet-BubSr7zv.png              2,340.46 kB
dist/assets/expression-sheet-BvvmwvXH.png              2,346.86 kB
dist/assets/main-visual-CCNrHOHY.png                   2,369.70 kB
dist/assets/background-only-0t122xTc.png               2,384.59 kB
dist/assets/background-only-BvY2Bnxv.png               2,401.37 kB
dist/assets/background-only-BU4G1n3K.png               2,410.57 kB
dist/assets/main-visual-skVoiDGQ.png                   2,417.57 kB
dist/assets/main-visual-CSTGAWkG.png                   2,430.70 kB
dist/assets/main-visual-B8N3Sun-.png                   2,435.10 kB
dist/assets/background-only-BlFTV7we.png               2,448.47 kB
dist/assets/expression-sheet-C89JlMW1.png              2,485.98 kB
dist/assets/background-only-CYl6RUy1.png               2,515.91 kB
dist/assets/background-only-CBQeBewo.png               2,523.95 kB
dist/assets/background-only-CpAnTnbH.png               2,528.71 kB
dist/assets/main-visual-bRxTKUA4.png                   2,565.34 kB
dist/assets/background-only-D-qUpkKs.png               2,596.37 kB
dist/assets/main-visual-LP7REmk9.png                   2,636.11 kB
dist/assets/1-D_Duki9c.mp4                             3,839.97 kB
dist/assets/index-C-v7uOub.css                            17.97 kB │ gzip:   3.79 kB
dist/assets/index-ySlRe3Dq.js                            925.71 kB │ gzip: 251.59 kB

✓ built in 1.60s
[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

### `npm run asset:audit`

```text
> asset:audit
> node scripts/asset-audit.mjs

# Asset Audit

Generated: 2026-06-23T07:57:11.514Z

## Command

`npm run asset:audit`

## Summary

- Files audited: 483
- Total bytes: 846932007
- Total size: 807.7 MB
- Scope: `assets/`, `public/`, and `dist/` when present.

## Missing Scopes

- None.

## Totals by scope

| Key | Files | Bytes | Size |
|---|---:|---:|---:|
| `source assets` | 369 | 589748357 | 562.4 MB |
| `built dist` | 105 | 208714033 | 199.0 MB |
| `source public` | 9 | 48469617 | 46.2 MB |

## Totals by extension

| Key | Files | Bytes | Size |
|---|---:|---:|---:|
| `.png` | 328 | 652787255 | 622.5 MB |
| `.zip` | 3 | 97161574 | 92.7 MB |
| `.exr` | 1 | 84045970 | 80.2 MB |
| `.mp4` | 2 | 7679952 | 7.32 MB |
| `.jpg` | 12 | 3739432 | 3.57 MB |
| `.js` | 1 | 925719 | 904.0 KB |
| `.md` | 90 | 469079 | 458.1 KB |
| `.json` | 30 | 97625 | 95.3 KB |
| `.css` | 1 | 17976 | 17.6 KB |
| `.txt` | 14 | 4298 | 4.20 KB |
| `.html` | 1 | 3127 | 3.05 KB |

## Totals by category

| Key | Files | Bytes | Size |
|---|---:|---:|---:|
| `assets/image-packs/images` | 153 | 256432760 | 244.6 MB |
| `assets/pbr` | 4 | 181207544 | 172.8 MB |
| `dist/assets` | 95 | 160241289 | 152.8 MB |
| `assets/backup` | 41 | 87924451 | 83.9 MB |
| `assets/image` | 24 | 50681424 | 48.3 MB |
| `dist/pbr` | 8 | 46445339 | 44.3 MB |
| `public/pbr` | 8 | 46445339 | 44.3 MB |
| `assets/image-packs` | 11 | 7573774 | 7.22 MB |
| `assets/video` | 1 | 3839976 | 3.66 MB |
| `dist/og-cover.png` | 1 | 2024278 | 1.93 MB |
| `public/og-cover.png` | 1 | 2024278 | 1.93 MB |
| `assets/reference` | 1 | 1517426 | 1.45 MB |
| `assets/image-packs/prompts` | 75 | 402393 | 393.0 KB |
| `assets/image-packs/source.md` | 15 | 66686 | 65.1 KB |
| `assets/image-packs/commentary.json` | 15 | 56402 | 55.1 KB |
| `assets/image-packs/manifest.json` | 15 | 41223 | 40.3 KB |
| `assets/image-packs/reference-used.txt` | 14 | 4298 | 4.20 KB |
| `dist/index.html` | 1 | 3127 | 3.05 KB |

## Largest files

| Rank | File | Scope | Bytes | Size |
|---:|---|---|---:|---:|
| 1 | `assets/pbr/glasshouse_interior_4k.exr` | source assets | 84045970 | 80.2 MB |
| 2 | `assets/pbr/paper_0026_2k_IqAmFN.zip` | source assets | 52910083 | 50.5 MB |
| 3 | `assets/pbr/wood_0066_2k_dljIUy.zip` | source assets | 43420606 | 41.4 MB |
| 4 | `dist/pbr/paper_0026/paper_0026_normal_opengl_2k.png` | built dist | 23597649 | 22.5 MB |
| 5 | `public/pbr/paper_0026/paper_0026_normal_opengl_2k.png` | source public | 23597649 | 22.5 MB |
| 6 | `dist/pbr/wood_0066/wood_0066_normal_opengl_2k.png` | built dist | 20977974 | 20.0 MB |
| 7 | `public/pbr/wood_0066/wood_0066_normal_opengl_2k.png` | source public | 20977974 | 20.0 MB |
| 8 | `assets/video/1.mp4` | source assets | 3839976 | 3.66 MB |
| 9 | `dist/assets/1-D_Duki9c.mp4` | built dist | 3839976 | 3.66 MB |
| 10 | `assets/image-packs/7/images/main-visual.png` | source assets | 2636119 | 2.51 MB |
| 11 | `dist/assets/main-visual-LP7REmk9.png` | built dist | 2636119 | 2.51 MB |
| 12 | `assets/image-packs/10/images/background-only.png` | source assets | 2596375 | 2.48 MB |
| 13 | `dist/assets/background-only-D-qUpkKs.png` | built dist | 2596375 | 2.48 MB |
| 14 | `assets/image-packs/9/images/main-visual.png` | source assets | 2565343 | 2.45 MB |
| 15 | `dist/assets/main-visual-bRxTKUA4.png` | built dist | 2565343 | 2.45 MB |
| 16 | `assets/image-packs/8/images/background-only.png` | source assets | 2528710 | 2.41 MB |
| 17 | `dist/assets/background-only-CpAnTnbH.png` | built dist | 2528710 | 2.41 MB |
| 18 | `assets/image-packs/7/images/background-only.png` | source assets | 2523950 | 2.41 MB |
| 19 | `dist/assets/background-only-CBQeBewo.png` | built dist | 2523950 | 2.41 MB |
| 20 | `assets/image-packs/9/images/background-only.png` | source assets | 2515911 | 2.40 MB |
| 21 | `dist/assets/background-only-CYl6RUy1.png` | built dist | 2515911 | 2.40 MB |
| 22 | `assets/image-packs/7/images/expression-sheet.png` | source assets | 2485984 | 2.37 MB |
| 23 | `dist/assets/expression-sheet-C89JlMW1.png` | built dist | 2485984 | 2.37 MB |
| 24 | `assets/image/7.png` | source assets | 2475413 | 2.36 MB |
| 25 | `assets/backup/16_before-no-number-angle-redesign.png` | source assets | 2468215 | 2.35 MB |
```

### `Test-Path -LiteralPath 'dist/index.html'`

```text
True
```

### `Test-Path -LiteralPath 'docs/asset-audit.md'`

```text
True
```

### `Select-String -Path 'docs/asset-audit.md' -Pattern 'Largest files','Totals by extension','Command'`

```text
docs\asset-audit.md:5:## Command
docs\asset-audit.md:28:## Totals by extension
docs\asset-audit.md:67:## Largest files
```

## 新发现的陷阱（如有）
- 无。

## 状态
PASSED

## 注意事项
- `npm run build` exit 0；Vite 仍提示 bundle chunk >500 kB，这是当前资源/打包体积现状，不是本轮新增失败。
- 额外运行 `git diff --check` exit 0，仅输出已有工作区的 LF→CRLF warning；未发现 whitespace error。
- 未修改 `package-lock.json`；它在本轮开始前已是 dirty 状态，保持原样。
