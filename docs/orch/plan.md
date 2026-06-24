# Iteration 1 Plan

## 待完成任务（按依赖顺序）

1. S18-BUS-1: 现有 WebAudio 总线上的语音通道
   - 目标：让每条解说可选的语音通过现有音频总线播放，播放时压低环境底噪，结束后干净恢复。
   - 依赖：无
   - 验收：item / intro / runwayIntro 的可选语音在构建期解析为 URL，缺文件解析为 null 而非发起会 404 的请求；语音走独立增益节点，活跃时环境底噪被 duck、结束后还原；新一条语音会停掉上一条，连续重复触发被去抖、绝不叠加；dispose 停掉活跃语音、断开节点、不留计时器或 AudioContext 泄漏。

2. S18-AUTOPLAY-1: 自动播放安全解锁
   - 目标：在不产生控制台报错的前提下尊重浏览器自动播放限制。
   - 依赖：S18-BUS-1
   - 验收：首个用户手势之前尝试播放语音绝不抛错（no-op 或排队到手势）；首个用户手势上 AudioContext 被 resume / 解锁，此后语音正常播放；复用现有的音频解锁路径，不新增第二个相互竞争的解锁处理。

3. S18-SUBTITLE-1: 字幕绑定与清理
   - 目标：把字幕与语音的开始/结束绑定，绝不残留过期字幕。
   - 依赖：S18-BUS-1
   - 验收：字幕在语音开始时出现（无语音时立即出现），并在该行结束后 0.6–1.2 s 淡出；翻页、鑑賞打开、look-card 打开、startShow、endShow、立牌折叠、tour 推进时，字幕及任何待执行的淡出计时器立即清除；无语音时字幕/标签时序与今天一致（零回归）。

4. S18-LIPSYNC-1: 振幅驱动的口型切换（可降级）
   - 目标：当存在 mouth 单元映射时由语音振幅驱动两帧口型切换，否则不产生任何可见动作。
   - 依赖：S18-BUS-1
   - 验收：item 提供可选 mouth 单元映射时，AnalyserNode 的 RMS 越过阈值在表情卡上切换 mouth-closed / mouth-open，且不与眨眼/表情提示打架；无 mouth 映射时表情卡显示正常表情、不强加口型抖动；reduced-motion 下语音照常播放，但口型/表情的快速切换被禁用（冻结帧）。

5. S18-DEGRADE-1: 语音缺失降级
   - 目标：证明在没有任何语音文件时（今天的状态）系统行为完全不变。
   - 依赖：S18-BUS-1, S18-AUTOPLAY-1, S18-SUBTITLE-1, S18-LIPSYNC-1
   - 验收：零语音资源时，字幕、摆动标签、look-card、tour、runway、叙事节拍全部与之前完全一致工作；资源缺失或自动播放被阻止时，语音层不产生任何控制台报错；`npm run narrative:smoke` 继续通过。

6. S18-VERIFY-1: 语音 smoke 与路线图收口
   - 目标：留下可复现的证据，证明语音管线在没有真实资源的情况下端到端可用。
   - 依赖：S18-BUS-1, S18-AUTOPLAY-1, S18-SUBTITLE-1, S18-LIPSYNC-1, S18-DEGRADE-1
   - 验收：一条可复现命令（如 `npm run voice:smoke`，沿用现有 smoke 的真实 Chrome via CDP 方式）把一段在页内生成的合成 AudioBuffer（不提交任何二进制）喂入真实语音路径，并断言：手势解锁生效、字幕显示后清除、analyser 产出非零 RMS、有 mouth 映射时口型切换/无则不切、行中途翻页停掉音频并清除字幕；`npm run build`、`npm run commentary:validate`、`npm run asset:audit`（WebGL variant drift 干净）、`npm run narrative:smoke` 全部通过；`docs/FUTURE.md` 标记 Sprint 18 完成或明确记录任何遗留（如可见口型同步待后续 mouth-cell 素材轮次）；`docs/project_structure.md` 为任何新脚本更新。

## 相关陷阱（从 pitfalls.md 筛选）

- 预览/验证：`preview_screenshot` 会超时（持续 rAF 的 three.js canvas，headless 标签页 rAF 暂停）。验证语音 smoke 时改用 `window.__magazineScene`（DEV）+ `preview_eval` 配方，不靠截图。
- 预览/验证：CDP visual smoke 必须显式清理 target + 子进程，否则可能在截图/断言写出后卡住退出（S14-VERIFY-1）。新的 voice smoke 应 best-effort 关闭 Chrome target/WebSocket、kill 自己启动的 Chrome/Vite 子进程、summary 后显式 `process.exit(code)`，验收后查端口不留活进程。
- 验证：dev server stale-module 警告——改了被 magazineScene 初始化时一次性读入的常量后跑 headless 验收前必须先 `location.reload()` 再取 scene 引用，否则拿到旧值导致"commit 已生效但断言失败"。
- 通用/音频：多数音效文件仍空缺（public/audio/*），`startAudio`/`playSound` 在文件缺失时应静默降级、勿因此抛错——语音层必须遵循同样的静默降级契约。
- 通用/音频：真人声优克隆 TTS 仅限私人 demo；公开发布需换可商用音色或仅保留字幕（法务备忘）。本轮不提交任何真实/占位语音二进制。
- 状态机：新加 overlay / 入口必须扫七问 state-guard 矩阵（`state` / `turn` / `show` / `tour` / `gallery` / `lookCard` / `peel`，RACE-B 同模式坑）。语音/字幕必须在每一个今天就会拆除字幕的状态转换上被拆除；与 toggleGallery 内既有 close/return 模板对称。
- 状态机：toggleGallery / 任何"切层 toggle 路径"必须清在飞的 `this.turn`，复位用与 finishTurn 对齐的"四件套"而非只 `this.turn = null`（BUG-GALLERY-RACE-A）。
- 状态机：primary-event HUD 与 discovery cue 保持 display-only、不写 preferences、不排队状态（S15-STATE-1）；语音/字幕层同理不得在 overlay/show/tour/card 活跃时延迟执行隐藏动作。
- dispose：dispose 必须清所有 timer（BUG-DISPOSE-SHARE-TIMER 同模式坑）；任何新增 `this.xxxTimer = setTimeout(...)` 字段（字幕淡出计时器等）都必须同步加 dispose 清，并停掉活跃语音源、断开新增节点。
- 表情卡：表情卡眨眼用逐 sheet 动态检测的 `card.blinkCell`（`detectBlinkCell`），口型切换不可与眨眼/表情 hint 打架；当前表情 sheet 无专用 mouth-open/closed 单元（仅 `BLINK_CELL = 2`），无 mouth 映射时必须降级为不动。
- 表情卡：reduced-motion 守口型/表情快速切换（同 GrainShader RM、目录栅格 RM 模式），但绝不禁用音频本身。
- 渲染/状态护栏（不可回归）：DOM `鑑賞` 真 `<img>`、Bokeh 默认关闭、NeutralToneMapping、WebGL variant drift、Sprint 15 叙事节拍均不得回归——语音层是增强层，不触碰这些基线。
- 通用：`magazineScene.js` 单文件巨大，改前先 Read 相关段（见 `docs/project_structure.md` 行号地图），不要盲改；纯逻辑（如 URL/索引解析）优先放可 headless 断言的独立模块，参考 `src/lookCard.js` / `src/deeplink.js` / `src/render-config.js` 既有抽离范式。
- 数据源竞态：构建期资源解析参考 commentary / page image 的 `import.meta.glob` 范式（commentary 走 eager glob 模块加载即就绪）；语音 URL 在构建期 glob 解析，缺文件 → null，不走运行期手拼路径 fetch。

## 上轮失败分析

本轮为 Sprint 18 Iteration 1。现存 `docs/orch/eval.md` 是 Sprint 16 的评估报告，与本 Sprint 无关，无需失败分析与策略调整。

## 验收命令（从 SPRINT18.md 原样复制）

```powershell
npm run build
npm run voice:smoke
npm run narrative:smoke
npm run commentary:validate
npm run asset:audit
Select-String -Path 'src/magazineScene.js' -Pattern 'this.bokehPass.enabled = false'
Select-String -Path 'src/render-config.js' -Pattern 'NeutralToneMapping'
Select-String -Path 'docs/FUTURE.md' -Pattern 'Sprint 18'
git diff --check
```
