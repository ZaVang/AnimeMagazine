# Evaluator Report — Iteration 1 (Sprint 18)

> 合同：`docs/plans/SPRINT18.md`（语音前端接入与口型同步）。
> 本报告所有验收命令均由 Evaluator 在 Windows + PowerShell 环境**亲自重跑**，非复制 gen_status.md。

## Checkbox 状态

SPRINT18.md「## Tasks」全部 6 项均为 `[x]`，逐项独立核查源码后确认勾选属实：

- [x] **S18-BUS-1**（语音通道）— `src/voice.js` build-time glob (`import.meta.glob('../assets/image-packs/*/voice/*')`)；`magazineScene.js:35 resolveLineVoice`/`:39 decorateCommentaryVoice` 在 `PAGE_PACKS` IIFE 之前声明（避 TDZ）；`startAudio`（:4535）建 `voiceGain→voiceAnalyser→destination`；`playVoice`（:4653）/`stopVoice`（:4755）单一进出口，新一条停上一条 + 280ms 去抖（`VOICE_RETAP_DEBOUNCE_MS`）；`duckRoomTone`（:4586）压 room tone；`dispose`（:5516）停语音 + 断节点 + 清 `voiceUrlCache`。✔
- [x] **S18-AUTOPLAY-1**（自动播放安全解锁）— `startAudio`（:4511）是唯一解锁路径，从 `handlePointerDown`（:1641，首手势）调用；`if (this.audio.started)` 守重入并 resume suspended ctx；全仓仅一处 `new Ctx()`（:4525），无第二个 AudioContext / 第二个 unlock。✔
- [x] **S18-SUBTITLE-1**（字幕绑定与清理）— `setCaption`（:3957）即时显示并 `clearCaptionFade`；`scheduleCaptionFade`（:4803）900ms（落 0.6–1.2s 窗口）；`stopVoice`+`hideCaption` 接到七状态拆字幕点（见下「七状态」）。✔
- [x] **S18-LIPSYNC-1**（振幅驱动口型，可降级）— `updateLipSync`（:4825）每帧读 RMS；仅当合法 `mouth:{closed,open}`（`resolveMouthCells`:4727 范围校验）且非 reduced-motion 才切 UV（:4850 `if (!mouth || !card || this.reducedMotion) return rms`）；无 mouth 映射 → no-op；写瞬时 UV 不动 `card.cell`，并跳过该卡眨眼循环（:3165 `this.activeMouthCard !== card`）。✔
- [x] **S18-DEGRADE-1**（语音缺失降级）— `commentary:validate` 报 `Voice fields: 0`；`narrative:smoke` 通过；无语音资源时 `playVoice`（:4678）`if (!url || !this.audio.ctx)` 退化为纯字幕、不抛错。✔
- [x] **S18-VERIFY-1**（voice smoke + 路线图收口）— `scripts/voice-smoke.mjs` + `npm run voice:smoke`（真实 Chrome via CDP）；页内合成 AudioBuffer 喂真实路径；`docs/FUTURE.md`（:335 Sprint 18 已完成，1 个诚实遗留 `[ ]`）；`docs/project_structure.md`（:12 列 voice:smoke 脚本）。✔

FUTURE.md 中 `[ ]`（:349「下一轮素材生成 prompt …闭嘴/张嘴两格」）是 S18-VERIFY-1 合同允许的「explicitly defer residue（可见口型同步待 mouth-cell 素材轮次）」，**不是未完成的本轮任务**，符合 Reality Constraints（当前零 mouth 格素材）。

## 验收命令重跑结果

全部来自本机实跑（PowerShell）：

| 命令 | 实际结果 |
|---|---|
| `npm run build` | **EXIT=0** ✓ built in 1.32s。仅 chunk >500kB 体积告警（既有，非本轮引入）。PowerShell 把 Vite 这条 stderr 警告包成 `NativeCommandError` 是显示噪声，非真失败（EXIT=0）。 |
| `npm run voice:smoke` | **EXIT=0**。`ctxAfter="running"`、`hasVoiceGraph=true`、`captionOnAtStart=true`、`sourceStarted=true`、`rawByteSpread=185`、`maxRms=0.5398`、`mouthToggled=true`、`voiceClearedAfterTurn=true` + `captionAfterTurn=false`、`noMouthMappingPresent=false` + `cellBeforeNoMouth==cellAfterNoMouth==0`、`captionAfterFade=false` + `fadeTimerCleared=true`；reduced-motion 子测试 `audioPlayed=true`、`maxRms=0.5398`、`cellUnchanged=true`、`mouthToggled=false`。 |
| `npm run narrative:smoke` | **EXIT=0**。gallery/landing/tour/runway/HUD beat/reduced-motion 全部不变（零回归）。 |
| `npm run commentary:validate` | **EXIT=0**。`Packs: 15/15`、`Items: 75`、**`Voice fields: 0`**。 |
| `npm run asset:audit` | **EXIT=0**。`## WebGL variant drift check → None. Every canonical WebGL-only PNG has a matching, up-to-date images-webgl/*.webp display copy.` |
| `Select-String 'this.bokehPass.enabled = false'` | 命中 `src\magazineScene.js:643`（Bokeh 默认关，不回归）。 |
| `Select-String 'NeutralToneMapping'` | 命中 `src\render-config.js:46: toneMapping: THREE.NeutralToneMapping,`（不回归）。 |
| `Select-String 'Sprint 18' docs/FUTURE.md` | 命中 `docs\FUTURE.md:335: ## Sprint 18 — 语音前端接入与口型同步（P1，已完成）`。 |
| `git diff --check` | **EXIT=0**。仅 LF→CRLF 行尾通知（非错误），无尾空白/冲突标记。 |

补充独立核查：
- **端口卫生**：`Get-NetTCPConnection -LocalPort 5178` 仅剩 6 条 `TimeWait`（OwningProcess 0），无 LISTENING / 活 Chrome / 活 Vite 子进程（S14-VERIFY-1 卫生达标）。
- **无音频二进制**：`git status --porcelain | Select-String '\.(ogg|mp3|wav|m4a|aac|flac|opus)$'` → `AUDIO_BINARY_COUNT=0`。`assets/image-packs/*/voice/**` 与 `public/audio/**` 均不存在（零语音资源，符合 Reality Constraints）。

## Generator 报告 vs 实际对比

完全一致。Generator gen_status.md 自报的每一项数值与开关均被本机重跑复现：

- `voice:smoke` 全部 13 个 voice 子断言 + 5 个 reduced-motion 子断言数值逐一吻合（`maxRms=0.5397518…` 精确到小数、`mouthToggled`/`cellUnchanged` 等布尔全对）。
- `commentary:validate` `Voice fields: 0`、`asset:audit` drift None、三条 Select-String、`git diff --check` EXIT=0 均一致。
- 无任何夸大或遗漏。Generator 报告的「设计内遗留（FUTURE.md `[ ]`）」与合同 S18-VERIFY-1「explicitly defer residue」口径一致，非未完成。

## pitfalls 合规检查

逐条核对 pitfalls.md（含「语音前端 / 口型同步（Sprint 18 新增）」三条与既有红线），无违反：

- **TDZ（S18-BUS-1 同模式坑）**：`resolveLineVoice`/`decorateCommentaryVoice`（:35/:39）声明在 `PAGE_PACKS` IIFE（:110 调用点）之前。✔ 且 build + smoke 均未在 `assetsReady` 超时，反证模块求值无 throw。
- **headless analyser（S18-VERIFY-1 同模式坑）**：harness 用 4s 合成 buffer（voice-smoke.mjs:578）+ Chrome `--autoplay-policy=no-user-gesture-required`，断言「过程中是否出现过 open」（`mouth.lastOpen` / `sawOpenCell`）而非末帧 `card.cell`。✔
- **单一 stopVoice+hideCaption 接七状态（S18-SUBTITLE-1 / RACE-B）**：见下「七状态」，七个拆字幕点全接。✔ `scheduleCaptionFade`（:4805）在 tour 活跃时 `if (this.tour) return` no-op。✔
- **口型不与眨眼打架（S18-LIPSYNC-1）**：眨眼分支（:3165）加 `this.activeMouthCard !== card` 守。✔
- **build-time glob 不手拼 fetch**：voice URL 仅经 `src/voice.js` 的 `import.meta.glob` 解析；全仓无 `fetch('…/voice/…')` 手拼路径（仅 voice.js 注释含 `/voice/` 字样）。✔
- **复用既有 this.audio 总线 + 既有 unlock**：仅一处 `new Ctx()`；`startAudio` 单解锁路径；voice 节点挂在既有 ctx.destination。✔
- **reduced-motion 关口型不关音频**：smoke 实测 `audioPlayed=true` + `cellUnchanged=true`（:4850 守 reducedMotion 仅冻 UV、不拦 source.start）。✔
- **dispose 清所有 timer（BUG-DISPOSE-SHARE-TIMER）**：dispose（:5516-5527）`stopVoice` + `clearCaptionFade` + 断 voiceGain/voiceAnalyser + 清 voiceUrlCache。✔
- **渲染基线不回归**：Bokeh `enabled=false`（:643）、NeutralToneMapping（render-config:46）、WebGL variant drift None、narrative beats（narrative:smoke 过）、DOM 鑑賞真 `<img>`（narrative summary `realImgPages:18, hasCanvasFallback:false`）。✔
- **不提交任何语音/音频二进制**：AUDIO_BINARY_COUNT=0，合成 buffer 在页内生成。✔

## 失败原因分析

无失败项。所有 checkbox 已勾选、所有验收命令 EXIT=0、所有红线独立确认。

## 新陷阱待追加

Generator gen_status.md 提出的两条新陷阱（TDZ helper 声明顺序、headless analyser 需 source 持续播放 + 长 buffer）**已被本轮 Planner 写入 pitfalls.md「语音前端 / 口型同步（Sprint 18 新增）」三条**（pitfalls.md:160-165），无需再次追加。Evaluator 验证过程未发现额外新陷阱。

## 额外核查（本 Sprint 关键红线，逐项独立确认）

1. **voice 缺失/自动播放受限不报错** — `commentary:validate` 报 `Voice fields: 0`；`build` 与 `narrative:smoke` 均 EXIT=0；`playVoice`（:4678）无 url/ctx 时退化纯字幕、不抛错。✔
2. **voice URL 走 build-time glob（不手拼 fetch）** — 源码 `src/voice.js:19 import.meta.glob`，全仓无手拼 voice fetch 路径。✔
3. **复用既有 this.audio 总线 + 既有解锁路径** — 仅一处 `new Ctx()`（:4525）；`startAudio` 单解锁路径（:4511，handlePointerDown:1641 调用）；无第二个 AudioContext / unlock。✔
4. **七状态切换都停音清字幕** — `stopVoice()` 接入点逐一确认：
   - 翻页/立牌折叠 → `foldStandees`（:3035，beginTurn 经此）
   - 鑑賞 open → `openGallery`（:5011，+:5012 hideCaption）
   - look-card open → `openLookCard`（:4226，+:4227 hideCaption，且前置 RACE-B 七问守 :4220-4222）
   - startShow → :2849
   - endShow/finishShow → :2945
   - tour 推进/结束 → :2400（hideCommentary）/ :2443（endTour）
   - hideCommentary → :2400
   ✔ 七个今天拆字幕的转换全接。
5. **口型在无 mouth 格资产上降级为不可见；reduced-motion 关口型不关音频** — smoke 实测无 mouth 映射 `cellBefore==cellAfter==0`（不可见）；reduced-motion `audioPlayed=true` + `cellUnchanged=true`。**未因「看不到嘴动」判失败**。✔
6. **未回退基线** — DOM 鑑賞真 `<img>`（narrative `realImgPages:18, hasCanvasFallback:false`）、Bokeh 默认关（:643）、NeutralToneMapping（render-config:46）、WebGL variant drift None、narrative beats（narrative:smoke 过）。✔
7. **未提交任何 voice/音频二进制** — AUDIO_BINARY_COUNT=0；voice/ 与 public/audio/ 目录不存在。✔

## 决策

COMPLETE

DECISION: COMPLETE
