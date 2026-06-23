# Iteration 1 Plan

## 待完成任务（按依赖顺序）
1. S13-AUDIT-1: Asset audit command and baseline report
   - 目标：让资源体积基线可重复生成、可审计，并留下当前基线记录。
   - 依赖：无
   - 验收：仓库命令可审计 source assets 和 built `dist/` assets；输出按 extension/category 汇总总量并列出最大文件；持久化 docs report 记录当前 baseline 和 exact command used。

2. S13-DOC-1: Resource pipeline responsibility map
   - 目标：明确 WebGL texture 与 DOM reading image 的职责边界，减少后续资源格式决策的误判。
   - 依赖：S13-AUDIT-1
   - 验收：文档明确 DOM `鑑賞` 保持 real `<img>` 且不得退回 canvas flipbook rendering；明确 WebGL-only textures 才是 KTX2/Basis 或 WebP/AVIF variants 的候选；记录本 sprint 因缺少本地 CLI tooling 暂不生成 KTX2/Basis。

3. S13-PERF-1: Background texture GPU upload queue
   - 目标：避免背景页资源加载完成后一次性触发 GPU texture warmup 造成卡顿。
   - 依赖：S13-DOC-1
   - 验收：background-loaded page textures 会进入 GPU warmup queue；render loop 每帧只 drain 少量 queued textures；初始 visible cover/first spread 行为保持不变；`鑑賞` overlay 打开时仍跳过 3D rendering。

4. S13-VERIFY-1: Verification artifacts
   - 目标：把 Sprint 13 的通过证据落到可复查的产物中，而不是依赖口头记忆。
   - 依赖：S13-AUDIT-1、S13-DOC-1、S13-PERF-1
   - 验收：`npm run build` passes；asset audit command 在 build 后 passes；`docs/orch/gen_status.md` 和 `docs/orch/eval.md` 记录实际 outputs。

## 相关陷阱（从 pitfalls.md 筛选）
- [鑑賞 / DOM] `鑑賞` overlay 是 DOM `<img>`，不在 canvas 上；canvas 像素捕获看不到它，验证时要用 DOM 层可见性口径。
- [鑑賞 / 翻页书] 必须保持真实 `<img>` page path；不要退回 canvas flipbook 读图路径，否则高分屏会重新变糊。
- [鑑賞 / 渲染] `鑑賞` 打开时应跳过 3D rendering，关闭后恢复；本 sprint 的性能改动不能破坏这个省 GPU 不变量。
- [渲染 / 画质] 内页与封面素材上限是 941x1672；不要声称 SSAA、上传队列或格式转换能突破源素材清晰度天花板。
- [渲染 / 后期] BokehPass 默认关闭，不要为了资源或清晰度 baseline 默认重开它。
- [加载 / 纹理] 内页/封面与立牌相关贴图的加载责任不同；资源管线文档要避免把 DOM reading image、WebGL page texture、standee texture 混成同一类资产。
- [通用] 本 sprint 不应借资源 baseline 任务顺手改变取景、tone mapping、page geometry、commentary、TTS 或 visual style。

## 上轮失败分析（仅迭代 2+ 有 eval.md 时填写）
- 不适用

## 验收命令（从 SPRINT13.md 的验收命令章节原样复制）
```powershell
npm run build
npm run asset:audit
Test-Path -LiteralPath 'dist/index.html'
Test-Path -LiteralPath 'docs/asset-audit.md'
Select-String -Path 'docs/asset-audit.md' -Pattern 'Largest files','Totals by extension','Command'
```
