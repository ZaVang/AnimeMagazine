# Generator Status — Sprint 18 / Iteration 1

## 完成的任务

- [x] S18-BUS-1 — 在现有 WebAudio 总线上加语音通道。新增 `src/voice.js`（build-time
  `import.meta.glob('../assets/image-packs/*/voice/*')` 解析 `voiceUrl`，缺文件→null，绝不运行期
  手拼路径 fetch）。`magazineScene.js` 顶部 `decorateCommentaryVoice`/`resolveLineVoice` 把
  `intro`/`item`/`runwayIntro` 一次性解析为 `voiceUrl`（浅拷贝行、不改共享 eager-glob JSON；**声明
  在 PAGE_PACKS IIFE 之前避免 TDZ**）。`startAudio` 复用既有总线新增 `voiceGain`→`voiceAnalyser`→
  destination；`playVoice`/`stopVoice` 单一进出口（新一条停上一条、同热点 280ms 去抖、缺 voiceUrl
  退化为纯字幕）；`duckRoomTone` 在活跃时压 room tone 到 0.35×、结束/打断后线性还原；dispose 停活跃
  语音 + 断节点 + 清 voiceUrlCache（无 timer/AudioContext 泄漏）。
- [x] S18-AUTOPLAY-1 — 复用既有 `startAudio` 单一解锁路径（首 pointerdown 调用），首手势 resume
  AudioContext；重入（已解锁后的语音 tap）也 resume suspended ctx；首手势前 `playVoice` 检查
  `this.audio.ctx` 缺失即退化为字幕、绝不抛错。不新增第二个竞争解锁处理。
- [x] S18-SUBTITLE-1 — 字幕绑定语音起止：`setCaption` 立即显示并取消旧淡出 timer；语音自然结束走
  `onVoiceEnded`→`scheduleCaptionFade`（900ms，落在 0.6–1.2s 窗口内）。`stopVoice`+`hideCaption`
  接到全部七状态拆字幕点：beginTurn（经 foldStandees）/toggleGallery/openLookCard/startShow/
  finishShow/foldStandees/endTour/hideCommentary。无语音时 `setCaption` 行为与今天一致（零回归，
  narrative:smoke 验证）。
- [x] S18-LIPSYNC-1 — `updateLipSync`（animate 每帧调）读 AnalyserNode 时域 RMS；仅当 item 提供合法
  `mouth:{closed,open}`（cell 在范围内）且非 reduced-motion 时，越过阈值切换 mouth-open/closed
  UV；写瞬时 mouth UV、不动 `card.cell`，并跳过该卡的眨眼循环（`activeMouthCard !== card`）避免打架。
  无 mouth 映射（当前全部素材）→ `session.mouth=null`→纯 no-op，卡显示正常表情。reduced-motion 下
  音频照常播放但口型冻结。
- [x] S18-DEGRADE-1 — 零语音资源下：`commentary:validate` 报 `Voice fields: 0`；默认加载控制台无语音层
  报错（探针实测仅 React DevTools info + render log）；`narrative:smoke` 继续通过（字幕/标签/look-card/
  tour/runway/叙事节拍全部不变）。
- [x] S18-VERIFY-1 — 新增 `scripts/voice-smoke.mjs` + `npm run voice:smoke`（真实 Chrome via CDP，
  沿用 narrative-smoke 的 Vite+Chrome+CDP 范式）。页内合成 AudioBuffer（4s 220Hz 正弦，不提交二进制）
  预置进 `voiceUrlCache` 喂真实 `playVoice` 路径。显式关 target + kill 子进程 + `process.exit(0)`，
  验收后端口只剩 TimeWait。更新 `docs/FUTURE.md`（Sprint 18 标记完成 + 遗留：可见口型同步待 mouth-cell
  素材轮次）、`docs/project_structure.md`（src/voice.js、voice-smoke.mjs、magazineScene 语音方法群）。

## 未完成的任务（如有）

- 无。所有 6 项任务完成。
- 设计内遗留（非未完成，已在 FUTURE.md 诚实记录）：当前表情 sheet 无专用 mouth-open/closed 格，
  口型同步机制已就绪并在合成 buffer 上端到端验证，但**可见口型同步待 Sprint 17 素材产出后的
  mouth-cell 素材轮次**——本轮按合同红线降级为「无 mouth 映射时不可见」是预期行为。

## 验收命令输出

### `npm run build`
- 通过（EXIT=0）。仅 chunk >500kB 体积告警（既有，非本轮引入）。

### `npm run voice:smoke`
- 通过（EXIT=0）。端口验收后只剩 TIME_WAIT，无 LISTENING / 活进程。
- voice 子测试：`ctxAfter="running"`（手势解锁）、`captionOnAtStart=true`、`sourceStarted=true`、
  `maxRms=0.5398`（analyser 非零 RMS）、`mouthToggled=true`（有 mouth 映射时口型切换）、
  `voiceClearedAfterTurn=true` + `captionAfterTurn=false`（行中途翻页停音停字幕）、
  `noMouthMappingPresent=false` + `cellBeforeNoMouth==cellAfterNoMouth==0`（无 mouth 映射不切口型）、
  `captionAfterFade=false` + `fadeTimerCleared=true`（字幕淡出且无 timer 泄漏）。
- reduced-motion 子测试：`reducedMotion=true`、`audioPlayed=true`（音频照常）、`maxRms=0.5398`、
  `cellUnchanged=true` + `mouthToggled=false`（口型冻结）。

### `npm run narrative:smoke`
- 通过（EXIT=0）。深链/gallery landing/look-card/tour/runway/reduced-motion 全部不变（零回归）。

### `npm run commentary:validate`
- 通过（EXIT=0）。`Packs: 15/15`、`Items: 75`、`Voice fields: 0`（确认零语音资源、降级路径）。

### `npm run asset:audit`
- 通过（EXIT=0）。`## WebGL variant drift check` → `None. Every canonical WebGL-only PNG has a
  matching, up-to-date images-webgl/*.webp display copy.`（WebGL variant drift 干净）。

### `Select-String 'this.bokehPass.enabled = false'`
- `src\magazineScene.js:643:    this.bokehPass.enabled = false;`（Bokeh 默认关闭，不回归）。

### `Select-String 'NeutralToneMapping'`
- `src\render-config.js:46:    toneMapping: THREE.NeutralToneMapping,`（NeutralToneMapping，不回归）。

### `Select-String 'Sprint 18' docs/FUTURE.md`
- 命中 `## Sprint 18 — 语音前端接入与口型同步（P1，已完成）`。

### `git diff --check`
- 通过（EXIT=0）。无尾空白/冲突标记错误（仅 LF→CRLF 行尾通知，非错误）。

## 新发现的陷阱（如有）

- [TDZ/模块加载] **build-time glob 解析的 commentary 装饰器必须声明在调用它的 module-level IIFE
  之前**：`PAGE_PACKS`（IIFE，模块求值即运行）调用 `decorateCommentaryVoice`，而后者若按「就近
  归类」放到 `localeText` 旁（IIFE 之后）会触发 `ReferenceError: Cannot access
  'decorateCommentaryVoice' before initialization`——`const` 不提升进可访问态。Vite 构建期
  此 TDZ 会让整个 `magazineScene` 模块 throw，scene 永不 `assetsReady`，headless smoke 直接 60s
  超时在 `waitForExpression(assetsReady)`，错误信息不指向真因。正解：任何被 module-level 数据 IIFE
  调用的 helper 必须声明在 IIFE 之前（本轮把 `resolveLineVoice`/`decorateCommentaryVoice` 移到
  `backCoverUrl` 之后、`packReaderFileUrls` glob 之前）。
- [验证/headless 音频] **headless Chrome 的实时 AudioContext 时钟在推进，但 AnalyserNode 只有在
  source 当前正在播放的帧才读到非零信号**：voice smoke 早期用 0.5s 合成 buffer，source-wait 循环
  （最长 1.9s）+ buffer 在采样窗口前就 `onended`→`onVoiceEnded` 置 `this.voice=null`→
  `updateLipSync` 返回 0、analyser 读纯静默（rawByteSpread=0）。误判为「analyser 不工作」。正解：
  合成 buffer 拉长到 4s 让语音覆盖整个采样窗口；启动 Chrome 加 `--autoplay-policy=
  no-user-gesture-required`。**模式归档**：任何「headless 验 analyser/实时音频」的 smoke 必须保证
  被测 source 在采样期间仍在播放，且断言「过程中是否出现过」而非「采样结束时的瞬时值」（口型
  open/closed 逐帧切换，末帧值是 racy 的）。

## 状态

PASSED

## 注意事项

- 红线全部守住：voice 永不变必需（缺 voiceUrl→纯字幕）；缺资产/自动播放受限均静默降级不报错；
  当前表情 sheet 无 mouth 格→口型在现资产上降级为不可见（预期）；voice URL 走 build-time glob
  解析（src/voice.js）不手拼 fetch；复用现有 `this.audio` 总线 + 既有 `startAudio` 解锁路径；
  七状态切换都接 `stopVoice`+`hideCaption` 清字幕停音；未回退 DOM 鑑賞/Bokeh 默认关/
  NeutralToneMapping/WebGL variant/narrative beats（验收命令逐项确认）。
- 纯逻辑（voice URL 解析）按既有范式抽到独立可 headless 断言的 `src/voice.js`（参考
  lookCard.js / deeplink.js / render-config.js）。
- 未提交任何语音/音频二进制；合成 AudioBuffer 在页内生成喂真实路径。
