# Asset Audit

Generated: 2026-06-23T12:30:38.567Z

## Command

`npm run asset:audit`

## Summary

- Files audited: 558
- Total bytes: 742865882
- Total size: 708.5 MB
- Scope: `assets/`, `public/`, and `dist/` when present.

## Missing Scopes

- None.

## Totals by scope

| Key | Files | Bytes | Size |
|---|---:|---:|---:|
| `source assets` | 444 | 629386791 | 600.2 MB |
| `built dist` | 105 | 98239510 | 93.7 MB |
| `source public` | 9 | 15239581 | 14.5 MB |

## Totals by extension

| Key | Files | Bytes | Size |
|---|---:|---:|---:|
| `.png` | 253 | 469430201 | 447.7 MB |
| `.zip` | 3 | 97161574 | 92.7 MB |
| `.exr` | 1 | 84045970 | 80.2 MB |
| `.webp` | 150 | 79276868 | 75.6 MB |
| `.mp4` | 2 | 7679952 | 7.32 MB |
| `.jpg` | 12 | 3739432 | 3.57 MB |
| `.js` | 1 | 938973 | 917.0 KB |
| `.md` | 90 | 469079 | 458.1 KB |
| `.json` | 30 | 97625 | 95.3 KB |
| `.css` | 1 | 18783 | 18.3 KB |
| `.txt` | 14 | 4298 | 4.20 KB |
| `.html` | 1 | 3127 | 3.05 KB |

## Totals by category

| Key | Files | Bytes | Size |
|---|---:|---:|---:|
| `assets/image-packs/images` | 153 | 256432760 | 244.6 MB |
| `assets/pbr` | 4 | 181207544 | 172.8 MB |
| `assets/backup` | 41 | 87924451 | 83.9 MB |
| `dist/assets` | 95 | 82996802 | 79.2 MB |
| `assets/image` | 24 | 50681424 | 48.3 MB |
| `assets/image-packs/images-webgl` | 75 | 39638434 | 37.8 MB |
| `dist/pbr` | 8 | 13215303 | 12.6 MB |
| `public/pbr` | 8 | 13215303 | 12.6 MB |
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

## Tracked optimizations

| Label | File | Before | Current | Reduction | Note |
|---|---|---:|---:|---:|---|
| Sprint 13b paper normal map runtime source | `public/pbr/paper_0026/paper_0026_normal_opengl_2k.png` | 23597649 (22.5 MB) | 6063774 (5.78 MB) | 17533875 (16.7 MB) | Downsampled from 2048px to 1024px; filename preserved for the existing TextureLoader URL. |
| Sprint 13b paper normal map built copy | `dist/pbr/paper_0026/paper_0026_normal_opengl_2k.png` | 23597649 (22.5 MB) | 6063774 (5.78 MB) | 17533875 (16.7 MB) | Dist copy should match the runtime public source after build. |
| Sprint 13b wood normal map runtime source | `public/pbr/wood_0066/wood_0066_normal_opengl_2k.png` | 20977974 (20.0 MB) | 5281813 (5.04 MB) | 15696161 (15.0 MB) | Downsampled from 2048px to 1024px; filename preserved for the existing TextureLoader URL. |
| Sprint 13b wood normal map built copy | `dist/pbr/wood_0066/wood_0066_normal_opengl_2k.png` | 20977974 (20.0 MB) | 5281813 (5.04 MB) | 15696161 (15.0 MB) | Dist copy should match the runtime public source after build. |

## WebGL display variants

| Label | Files | Canonical PNG | WebP display copy | WebGL import reduction |
|---|---:|---:|---:|---:|
| WebGL background pages | 15 | 34867442 (33.3 MB) | 3490044 (3.33 MB) | 31377398 (29.9 MB) |
| WebGL expression sheets | 15 | 29079536 (27.7 MB) | 3126868 (2.98 MB) | 25952668 (24.8 MB) |
| WebGL figure cutouts | 15 | 10804837 (10.3 MB) | 6481654 (6.18 MB) | 4323183 (4.12 MB) |
| WebGL transparent expression sheets | 15 | 23657324 (22.6 MB) | 14829428 (14.1 MB) | 8827896 (8.42 MB) |
| WebGL action sheets | 15 | 18487843 (17.6 MB) | 11710440 (11.2 MB) | 6777403 (6.46 MB) |

## WebGL variant drift check

- None. Every canonical WebGL-only PNG has a matching, up-to-date `images-webgl/*.webp` display copy.

## Largest files

| Rank | File | Scope | Bytes | Size |
|---:|---|---|---:|---:|
| 1 | `assets/pbr/glasshouse_interior_4k.exr` | source assets | 84045970 | 80.2 MB |
| 2 | `assets/pbr/paper_0026_2k_IqAmFN.zip` | source assets | 52910083 | 50.5 MB |
| 3 | `assets/pbr/wood_0066_2k_dljIUy.zip` | source assets | 43420606 | 41.4 MB |
| 4 | `dist/pbr/paper_0026/paper_0026_normal_opengl_2k.png` | built dist | 6063774 | 5.78 MB |
| 5 | `public/pbr/paper_0026/paper_0026_normal_opengl_2k.png` | source public | 6063774 | 5.78 MB |
| 6 | `dist/pbr/wood_0066/wood_0066_normal_opengl_2k.png` | built dist | 5281813 | 5.04 MB |
| 7 | `public/pbr/wood_0066/wood_0066_normal_opengl_2k.png` | source public | 5281813 | 5.04 MB |
| 8 | `assets/video/1.mp4` | source assets | 3839976 | 3.66 MB |
| 9 | `dist/assets/1-D_Duki9c.mp4` | built dist | 3839976 | 3.66 MB |
| 10 | `assets/image-packs/7/images/main-visual.png` | source assets | 2636119 | 2.51 MB |
| 11 | `dist/assets/main-visual-LP7REmk9.png` | built dist | 2636119 | 2.51 MB |
| 12 | `assets/image-packs/10/images/background-only.png` | source assets | 2596375 | 2.48 MB |
| 13 | `assets/image-packs/9/images/main-visual.png` | source assets | 2565343 | 2.45 MB |
| 14 | `dist/assets/main-visual-bRxTKUA4.png` | built dist | 2565343 | 2.45 MB |
| 15 | `assets/image-packs/8/images/background-only.png` | source assets | 2528710 | 2.41 MB |
| 16 | `assets/image-packs/7/images/background-only.png` | source assets | 2523950 | 2.41 MB |
| 17 | `assets/image-packs/9/images/background-only.png` | source assets | 2515911 | 2.40 MB |
| 18 | `assets/image-packs/7/images/expression-sheet.png` | source assets | 2485984 | 2.37 MB |
| 19 | `assets/image/7.png` | source assets | 2475413 | 2.36 MB |
| 20 | `assets/backup/16_before-no-number-angle-redesign.png` | source assets | 2468215 | 2.35 MB |
| 21 | `assets/image-packs/4/images/background-only.png` | source assets | 2448473 | 2.34 MB |
| 22 | `assets/backup/13_before-no-number-angle-redesign.png` | source assets | 2440453 | 2.33 MB |
| 23 | `assets/image-packs/8/images/main-visual.png` | source assets | 2435105 | 2.32 MB |
| 24 | `dist/assets/main-visual-B8N3Sun-.png` | built dist | 2435105 | 2.32 MB |
| 25 | `assets/image-packs/13/images/main-visual.png` | source assets | 2430709 | 2.32 MB |

