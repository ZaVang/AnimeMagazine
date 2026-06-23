# Generator Status — Iteration 1

## 完成的任务
- [x] S15-BEAT-1 — 新增 `src/narrativeBeats.js` 纯 primary-event resolver；支持可选 `commentary.json` `beat` / `focus` metadata，缺省时按 runway / commentary / look-card / standee / read fallback，保证每个 spread 恰好一个 primary event。
- [x] S15-HUD-1 — `magazineScene` 接入 `narrativeBeatIndex()` / `syncNarrativeBeat()`；HUD 增加小型 `.hud-beat` primary-event chip，并为 `鑑賞`、look-card、guided tour 控件加主/次视觉状态，控件不因非主事件而消失。
- [x] S15-DISCOVERY-1 — 新增 per-session `tryDiscoveryCue()`；page turn、standee、reader、commentary、look-card、runway cue 均最多出现一次，overlay/show/tour/card 活跃时不打断，reduced-motion 下不加 animated discovery emphasis class。
- [x] S15-STATE-1 — 新增 `docs/state-matrix.md`；补强 `openLookCard` / `startTour` / `startShow` / `toggleGallery` 周边 guard，声明 close/return/clear-peel 策略；新增 `npm run narrative:smoke` 覆盖代表性状态转换。
- [x] S15-VERIFY-1 — 新增 `scripts/narrative-smoke.mjs` 与 package script；更新 `docs/FUTURE.md`、`docs/project_structure.md`、`docs/plans/SPRINT15.md`，并刷新 `docs/asset-audit.md`。

## 未完成的任务（如有）
- 无。

## 验收命令输出

### `npm run build`
Exit 0。

摘要：
- Vite v8.0.16 build completed.
- `✓ built in 906ms`
- 仍有既有 chunk-size warning：`Some chunks are larger than 500 kB after minification.`

### `npm run asset:audit`
Exit 0。

摘要：
- Generated: `2026-06-23T12:13:27.302Z`
- Files audited: 558
- built `dist/`: 93.7 MB
- WebGL variant drift check: None. Every canonical WebGL-only PNG has a matching, up-to-date `images-webgl/*.webp` display copy.

### `npm run visual:smoke`
Exit 0。

摘要：
- desktop 1280x800: `standeeCount=15`, `targetStandee.state=risen`, `materialHasShader=true`, `bokehEnabled=false`, `toneMappingMatchesConfig=true`, `nonBlankFraction=1`, `avgLum=101.19`, `pass=true`
- mobile 375x812: `standeeCount=15`, `targetStandee.state=risen`, `materialHasShader=true`, `bokehEnabled=false`, `toneMappingMatchesConfig=true`, `reducedMotion=true`, `grainEnabled=false`, `nonBlankFraction=1`, `avgLum=101.34`, `pass=true`
- Screenshots:
  - `tmp/visual-smoke/desktop-1280x800.png`
  - `tmp/visual-smoke/mobile-375x812.png`

### `npm run narrative:smoke`
Exit 0。

摘要：
- Pure resolver: 3 mock spreads resolved as `lookCard`, `runway`, `read`; metadata `gentlePrompt` preserved.
- Interactive app: `exactlyOneBeatPerSpread=true`, `beatCount=8`, beat types = `runway` + 7 `commentary`.
- Deep link: `?spread=3&item=0&lang=zh` landed `state=open`, `spreadIndex=3`, `locale=zh`, `lookCard=true`, `activeItem=0`.
- Gallery: opened DOM `鑑賞`, `realImgPages=18`, `hasCanvasFallback=false`, closed cleanly to `state=open`.
- Look-card: opened spread 3 item 0; did not persist temporary state to `lastSpread`.
- Tour/runway: guided tour opened on a risen commentary standee; runway show opened and set `.in-show`.
- Reduced-motion: `reducedMotion=true`, `grainEnabled=false`, `discoveryClassCount=0`, primary beat visible.
- Summary written to `tmp/narrative-smoke/summary.json`.

### `Select-String -Path 'src/magazineScene.js' -Pattern 'this.bokehPass.enabled = false'`

```text
src\magazineScene.js:577:    this.bokehPass.enabled = false;
```

### `Select-String -Path 'src/render-config.js' -Pattern 'NeutralToneMapping'`

```text
src\render-config.js:46:    toneMapping: THREE.NeutralToneMapping,
src\render-config.js:127:  // Sprint 14 keeps renderer.toneMapping on THREE.NeutralToneMapping. This is a
```

### `Select-String -Path 'docs/FUTURE.md' -Pattern 'Sprint 15'`

```text
docs\FUTURE.md:260:## Sprint 15 — 叙事节奏与跨页主事件（P1）
```

### `Select-String -Path 'docs/state-matrix.md' -Pattern 'state','turn','show','tour','gallery','lookCard','peel'`

摘要：命中 `docs/state-matrix.md` 的标题、State Vocabulary、Entry Policy 表、Sprint 15 additions 和 smoke coverage；七个关键词均出现并有策略说明。

### `git diff --check`

Exit 0。仅输出工作区 LF→CRLF warning，无 whitespace error。

### Port cleanup check

`Get-NetTCPConnection -LocalPort 5178` 仅剩 `TimeWait` / `OwningProcess 0`，没有活着的 Vite/Chrome smoke 进程占口。

## 新发现的陷阱（如有）
- [状态 / narrative] primary-event HUD 与 discovery cue 必须是 display-only，不得写 preferences，也不得 queue turn/show/gallery/card；状态活跃时应 close 或 return，具体策略写入 `docs/state-matrix.md`。

## 当前工作区注意事项
- `docs/plans/SPRINT15.md`、`docs/state-matrix.md`、`scripts/narrative-smoke.mjs`、`src/narrativeBeats.js` 是本轮新增未跟踪文件。
- `docs/asset-audit.md` 是由最终 `npm run asset:audit` 刷新的审计报告。
- `tmp/visual-smoke/*` 与 `tmp/narrative-smoke/summary.json` 是 smoke 产物，不在当前 git status 中显示。

## 状态
PASSED
