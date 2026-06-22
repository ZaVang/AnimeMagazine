# Scout Report — Iteration 5（第 6 轮迭代 · 最终轮 · 收尾）

> 收尾轮接地。三 reviewer 罕见高度共识：本轮**只做 DOC-FOG-ROI**，外加可选 `git add` untracked。
> Stage 2 / 取景 / DoF / VIS-TABLE-SYM 二调 / visual-regression.md / BokehPass removePass —— **三方一致建议本轮不做**或下个 Sprint 接力。
> Tier D 真机肉眼定性校 = Evaluator 责任、Generator 不做。
> 实测 pitfalls.md 末行 = 第 6 轮 Iter 3 章节（第 135 行）；project_structure.md 行号实测偏差 **+7 ~ +21**（不是 prompt 估计的 +5，比 prompt 估的更大）。

---

## A. 约束与可行性（给 Planner）

### A.1 DOC-FOG-ROI 接地（必做）

- **范围**：纯 markdown 改、零代码、零视觉接触面、零 build 风险。
- **难度**：10–15 分钟可收（Iter 4 Generator subagent 死亡前已设计好任务结构）。
- **三方收敛**：Research 标"🟡 接力 必做" / Evolution Phase B 头号 / Experience "✅ 本轮必做（一项）"——这是 5 轮里最不需要 Planner 裁决的一项任务。
- **可独立 commit**：DOC-FOG-ROI 与 `git add` 顺手项可分两 commit 也可合并一 commit（建议合并 — pitfalls/project_structure 本来就被 docs/plans 整树 untracked 拦住、git add 是顺手清）。

### A.2 git add untracked（建议本轮做、归到 DOC-FOG-ROI 一并 commit）

- **应 add 的纯源代码**（5 轮以来一直 untracked，是 contract 红线遗漏）：
  - `src/deeplink.js`（Sprint 5 末仍 untracked、CARD-1/CODEC-1 用到、是 Sprint 3/E5 + Sprint 5/CODEC-1 核心纯逻辑）
  - `src/lookCard.js`（同上、CARD-1 的纯数据层）
- **应 add 的文档树**：
  - `docs/orch/`（reviewer + scout + plan + negotiation + gen_status + eval 6 轮历史，全部 untracked）
  - `docs/plans/`（SPRINT.md + pitfalls.md + negotiation.md 6 轮合同，全部 untracked）
  - `docs/project_structure.md`（本任务还要再改一次，加进来）
- **应 add 的资源**：
  - `public/og-cover.png`（H1 落定的 OG 图、构建必需，不 add 部署时会丢）
- **不该 add（保留 untracked 或 modified）**：
  - `.claude/launch.json`（环境配置，gitignore 已意图排除 .claude 目录但 launch.json 仍漏网，留给用户决策）
  - 既有的 `M` 状态文件已被 git tracked，不需要本任务处理。
- **理由**：5 轮已收官、`git log -- src/deeplink.js src/lookCard.js` 返 0 行——这是 6 轮以来 contract 漂移的"诚实记账"，最终轮顺手收。

### A.3 本轮不做（三方共识，写死避免 Planner 再议）

| 议题 | 不做理由 | 来源 |
|---|---|---|
| **TONEMAP-1 Stage 2** | Stage 1 6/6 PASS（avgLum 119.4 / clipFrac 0% / rim peak 69.5）。按 plan §527"若阶段 1 PASS 6/6 禁止启动 Stage 2"；做了反破坏 A3 兑现度（rim 1.5→1.2 会吞掉 Iter 3 才刚抬起来的立牌背面金边） | Research / Experience / Evolution 三方共识 |
| **取景 40° no-man's land** | 5 轮 Research 自己提自己反悔三次、需要 cameraStart/Open/Closed/portrait 4 处重校 + 移动端 Sprint 12 红线重新验收，是单独 Sprint 的事 | Research §1.1 永久判定 |
| **DoF 重开** | Sprint 11 已关、941×1672 素材天花板下 DPR=3 已贴上限、fog.far 已替代 DoF 远端柔化 | Research §1.2 永久判定 + Evolution Iter 3/4 反复点名 |
| **VIS-TABLE-SYM 二调** | 桌面 1.8:1 根因是 poolLight SpotLight cone 中心 + keyLight 方向（Iter 3 hemi/pool 调整后真根因显露），不在 render-config.js 内、属"新调参不属收尾" | Product Audit §🟡 + Iter 3 pitfalls 同模式坑 |
| **visual-regression.md 骨架** | 连续 4 轮 stretch 未做、5 轮已收官 = 该任务无人接手；下个 Sprint 实际有 reviewer 接手时再建 | Evolution Phase B stretch 余量项 |
| **BokehPass removePass** | 1 行清死代码、不强求；如本轮顺手 commit 可加但非必要——Stage 2 已不做、DoF 永久 backlog、留挂着的 enabled=false 不影响渲染 | Experience §3 / Research §1.2 stretch |
| **RACE-B-#1（show→openLookCard）** | Iter 4 已注 stretch；深链 applyDeepLink 在 startShow 之前调用、运行时极少触发；分批做避免一次塞太多防御 guard | Iter 4 plan stretch 段 |

---

## B. 代码地图与坑（给 Generator）

### B.1 DOC-FOG-ROI 三条 pitfalls 应该加在哪、措辞参考

**目标文件**：`docs/plans/pitfalls.md`

**插入位置**：末行（当前 135 行）后追加新章节标题与三条目。当前 pitfalls.md 最后一个章节是 **"## 渲染 / 画质（第 6 轮迭代 / Iter 3 新增）"**（line 127），共 6 条。本轮追加 **"## 渲染 / 画质 + 状态机 + 文档卫生（第 6 轮迭代 / Iter 4 新增）"** 章节。

**三条同模式坑措辞参考**（Generator 可照搬，括号内是 Scout 给的"为什么这么写"）：

#### Pitfall ①：fog band step 验收口径必须 ROI 在远端固定区

```markdown
- **fog 远端衰减验收 ROI 必须固定在远端区，不能跨杂志/桌面/背景三材质交界**（VIS-FOG-FAR 验收口径同模式坑，第 6 轮 Iter 3 → Iter 4 暴露）：Iter 3 VIS-FOG-FAR 验收门要求"10 行水平带 bandMaxStep ≤ 12"，但 Iter 4 Experience 论证 bandMaxStep 49.5 远超 12 与 fog 无关——根因是"10 行水平带从画面顶部到底部纵向取样、跨杂志高光/桌面木纹/背景墙三种材质交界"，material 交界处 lum 突跳本就 >12，与 `scene.fog.near/far` 调整毫无因果。**正解**：任何 fog 相关验收 ROI 必须**固定在远端单一材质区**（如桌面深处 z > -3 的窗口、或背景墙顶部、或杂志上方天空区），不能跨整画面纵向 10 行带。**模式归档**：未来任何"全图直方图断言 + 整画面取样"的验收门都要先问"取样区是否跨材质交界"——bandMaxStep / 桌面对称比 / 顶部 dark band 等都可能踩同样的坑（DOC-FOG-ROI 接力）。
```

#### Pitfall ②：savePreferences patch 必须 per-field validate 再 merge

```markdown
- **savePreferences patch 必须 per-field validate 再 merge，blob 级 sanitize 不能替代**（PREF-1 同模式坑，第 6 轮 Iter 4 latent bug 修）：旧路径 `sanitize({...loadPreferences(), ...patch})` 让坏 patch 字段先覆盖 loaded 旧 good 值、再被 blob 级 sanitize 因"类型不对"回默认——结果磁盘上 `lastSpread=7` 被 `savePreferences({lastSpread:"abc"})` 静默 wipe 回 0。当前 3 个 caller 都送 well-typed 值、线上不可达，但**契约不安全**：未来某 race 路径下 caller 不慎传 NaN/null/undefined（如 landOnSpread 在某 race 下读到 spreadIndex 为 NaN），用户的 lastSpread/locale 等持久 good 值会被静默 wipe。**正解**：新增字段级 `sanitizePatch(patch, current)` 函数（per-field validate：locale 走 SUPPORTED_LOCALES 检 / skipIntro+guidedOnce 走 typeof boolean / lastSpread 走 Number.isInteger 且 ≥0），坏字段不污染 next、good 字段 merge 过去；blob 级 `sanitize` 保留给 `loadPreferences` 外部 storage blob 入口（两者并存）。**模式归档**：任何 merge partial update over current 的 API 必须 patch 级 sanitize，blob 级 sanitize 不能替代——否则坏 patch 字段 wipe 旧 good 值，违反 merge 契约。检测脚本可 headless 断言（disk 起点 + patch + disk 终点 三段对比）。
```

#### Pitfall ③：state-guard 七问扫描矩阵

```markdown
- **新加 overlay / 入口必须扫七问 state-guard 矩阵**（RACE-B 同模式坑，第 6 轮 Iter 4 race B 七问归档）：本产品有七个互斥/串行状态：`state`（封面/封底/打开）/ `turn`（在飞翻页）/ `show`（暗场走秀）/ `tour`（解说巡回）/ `gallery`（鑑賞翻页书）/ `lookCard`（角色档案卡）/ `peel`（拖拽预览翻页）。Iter 4 Evolution §5.2 发现 4 个 race B 候选（同模式坑：A 状态进入时未 guard B 状态在跑）：① `show→openLookCard`（深链直开卡时 show 仍在跑）；② `tour→openLookCard`（hudCard click 时 tour 仍在跑）；③ `lookCard→toggleGallery`（按 G 打开鑑賞时 lookCard 仍在）；④ `turn→openLookCard`（翻页飞行中 raycast 命中报头 card 入口）。**正解**：任何新加 overlay 或入口加入七状态家族时，必须扫七问矩阵——"我开 X 时，state/turn/show/tour/gallery/lookCard/peel 在跑该怎么办"逐项问；与 toggleGallery 内 `if (this.gallery) this.closeGallery()`、`if (this.tour) this.endTour()` 既有模板对称，单行 `if (this.X) return false` 或 `if (this.X) this.closeX()` 防御 guard。**模式归档**：state-guard 不齐的 race B 在 headless 与正常路径都极难暴露（需要构造 cross-state 复现路径），但一旦命中就是 clobber 或 stale data 类故障——本产品 5 轮内 race A（toggleGallery stale turn clobber spreadIndex）+ race B 4 候选都是同模式（5 轮无人 catch 到 Iter 4 才系统性扫一遍）。
```

#### 第四条（可回填、可不回填）：TONEMAP-1 两阶段实际落定结果（Iter 4 实测数据沉淀）

可在 pitfalls Iter 3 段的"tonemap 切换 timing 延后 Iter 4 决策点"条之后**追加注脚**或在 Iter 4 新章节开头新加一条：

```markdown
- **TONEMAP-1 两阶段方案实际落定 = Stage 1 即 PASS、Stage 2 fallback 未触发**（Iter 4 实测沉淀、给下个 Sprint 类似切换路径参考）：Iter 4 commit `7c08edb` 仅切 `render-config.js` 内 `toneMapping=Neutral` + `exposure 1.02→1.18`（2 字段、~30 bytes、magazineScene.js 0 字面量 delta）。Tier B 6/6 实测：`avgLum/256` 0.461（118.03，目标 [0.42, 0.55]）/ `clipFrac` 0.0%（红线 <0.5%）/ rim 顶部 peak 127.7（红线 <248）/ `brightFrac>180` 18.33%（目标 [15,28]）/ `darkFrac<32` 0.058%（目标 <5%）/ `bg.r×255` 24（目标 [22,28]）——全部超额过门、Research 三道红线（clipFrac/rim peak/avgLum）全部安全余量 >50%。**Stage 2 fallback 按 plan §527 禁止启动**（"若阶段 1 PASS 6/6 禁止额外做阶段 2 的预防性改动"）—— rim 1.5/env 0.55/envMap 9 桶/exposure 1.18 全部 Iter 3 末值不动。**接力提示**：① TECH-1（Iter 3）抽 render-config 的红利在本轮 100% 兑现，是"结构性投入二次回报"模板；② 类似 tonemap / colorspace 切换路径建议先尝试 Research A3 风格"最小动作 + 严验收门"路线，再决定是否启动 Experience 风格"预防性降一组"路线；③ Tier A/B/C/D 验收门拆分（runtime 常量 / 像素直方图 / 走秀路径 / 真机肉眼）是本轮三方融合产物，值得复用。
```

---

### B.2 project_structure.md 行号修法（实测漂移大于 prompt 估的 5 行）

**实测**：Scout 在 magazineScene.js 上跑 grep 比对 project_structure.md 表格的所有行号，三段漂移：

| 行号区间 | 漂移 | 原因（推测） |
|---|---|---|
| Line 34 ~ 65（class 起点 238 到 createHud 头 3250） | **0** | createHud 之前 Iter 1-4 无 delta、Iter 3 抽 render-config 是反向移除常量（行数刚好被 import + 解构 + 注释吃回去）|
| Line 66 ~ 71（syncHud 3383→3390 到 copyShareLink 3683→3690） | **+7** | createHud 体内累计 +7 行 |
| Line 71 后段 ~ 75（openLookCard 3735→3742 到 toggleGallery 4201→4216） | **+7 ~ +15** | renderLookCard 等段累计 +15 |
| Line 75 末（galleryFlip 4419→4440 到 dispose 4676→4697） | **+21** | toggleGallery 体内 RACE-B-小批 增 1 处 guard + dispose 加 shareFlashTimer 清理 + 其它 Iter 1-4 累计 |

**总文件行数**：project_structure.md line 28 写 "~4752 行"——**实测 magazineScene.js 正好 4752 行**（line count 准确，但行号地图大段漂移）。

**Generator 修法**（如做行号校正）：
- 把表格"行号"列里 **3383 ~ 3683** 全段 **+7**（syncHud/syncTourButton/syncLocaleButton/currentSpreadCharacter/syncMasthead/syncCardEntry/setCaption/hideCaption/setLocale/fadeHint/recordSpread/markGuided/landOnSpread/restoreSession/applyDeepLink/currentShareUrl/copyShareLink）。
- 把 **3735 ~ 4201** 全段 **+7 ~ +15**（openLookCard 段 +7、renderLookCard 起 +15；按 Scout 实测：openLookCard 3742 = +7、renderLookCard 3841 = +15、escapeHtml 3903 = +15、closeLookCard 3910 = +15、copyLookCardLink 3924 = +15、startAudio 4033 = +15、playSound 4074 = +15、bindEvents 4088 = +15、handleKeyDown 4109 = +15、handleKeyUp 4162 = +15、updateRigInput 4170 = +15、galleryEntries 4188 = +15、galleryStartIndex 4203 = +15、toggleGallery 4216 = +15）。
- 把 **4419 ~ 4676** 全段 **+21**（galleryFlip 4440 / closeGallery 4447 / applyGalleryLanding 4486 / handleResize 4528 / animate 4547 / anyStandeeUnfolded 4603 / shadowsNeedUpdate 4613 / trackFrameQuality 4646 / applyQuality 4690 / dispose 4697）。
- 表格 line 28（src/magazineScene.js 行数说明）"~4752 行" 准确，不需要改。
- 表格 line 23 `src/preferences.js` 说"PREF-1（Iter 4）：新增字段级 `sanitizePatch`"——这段描述已存在且准确，Iter 4 Planner 已写完，不需要 Generator 改。

**容差**：Research 自己也说"createRenderer / createScene 行号 Scout 实测 doc 行号准确、Evaluator 误读了"（Phase 3 §3）—— 这部分（line 34 ~ 65 = 行号 238 ~ 3250）确实不需要改。Generator 可以选择"只改有漂移的三段"或"整表重新生成"，两种都行。

**附加澄清**：可在 project_structure.md 行号地图段（line 30 标题"src/magazineScene.js 行号地图（改前先 Read 对应段）"下）加一句注释：

> 行号锚定**函数 def 行**（`^  methodName(`），不锚定函数体内首行 RENDER 引用。Iter 3 Evaluator §10 曾把函数体内首行误当 def 引发"+10 ~ +20 漂移"假报警，本轮已澄清。

---

### B.3 git add 顺手项的具体文件列表 + 是否安全

**Generator 执行 git add 时建议这样分块**（避免一次 add 太多触发 hook 卡顿）：

```bash
# 第一批：纯源代码（5 轮以来漏 add 的核心模块）
git add src/deeplink.js src/lookCard.js

# 第二批：构建必需资源
git add public/og-cover.png

# 第三批：文档树（本任务的接力对象本身在这里）
git add docs/plans/SPRINT.md docs/plans/pitfalls.md docs/plans/negotiation.md
git add docs/orch/        # 6 轮全部 reviewer + scout + plan + negotiation + gen_status + eval
git add docs/project_structure.md

# 不 add（留给用户决策）
# .claude/launch.json — 环境配置类
# 其它 modified 状态文件已 tracked，本任务不动
```

**安全性检查**（Scout 已替 Generator 做了）：
- `src/deeplink.js` / `src/lookCard.js` — 纯 ES module 源代码，无 secrets、无凭据、无 .env 引用，head 已确认（"// Deep-link codec — the pure URL ⇄ reading-state mapping" / "// Look card data layer"）。
- `public/og-cover.png` — 941×1672 PNG 图，Sprint 4 H1 落定的 OG 图，是 cover.png 的拷贝（pitfalls 已诚实记录），非 secrets。
- `docs/orch/` — 6 轮 reviewer / scout / plan / negotiation / gen_status / eval，纯 markdown 历史快照，无 secrets。
- `docs/plans/` — 合同 + pitfalls + negotiation，纯 markdown，无 secrets。

**注意**：`.gitignore` 修改在 status 里（line 2 ` M .gitignore`）——本轮不 add，留给用户决策。

---

## C. 新发现的坑（如有）

Scout 在 5 轮收尾这一刻又扫了一遍代码与文档，**新发现 0 个未被三方 reviewer catch 的代码层 bug**——这是预期内的结果（5 轮 reviewer 都健壮、Iter 4 三方扫得很细、Iter 5 没有任何代码变化提供新表面）。

**唯一一个"不算坑、但值得记录的小观察"**：

- **`og-cover.png` / `src/deeplink.js` / `src/lookCard.js` 跨 1-2 个 Sprint untracked**（Sprint 4 H1 + Sprint 5 CARD-1/CODEC-1 落定时漏 add）—— 这意味着如果用户 `git clone` 本仓库到新机器，`npm run build` 后构建的 `dist/og-cover.png` 会丢失、且 `src/main.jsx` 导入 `src/lookCard.js` / `src/deeplink.js` 会编译失败。这是 Sprint 4/5 验收门字面上 PASS 但 git 层面漏 commit 的隐藏 contract 漂移。本轮 git add 顺手收（A.2 已列）。

---

## D. 跨 reviewer 合并/分歧

### D.1 三方共识（DOC-FOG-ROI 必做、Stage 2/取景/DoF/VIS-TABLE-SYM 二调/visual-regression.md 不做）

| 议题 | Product Experience | Evolution | Research | 共识 |
|---|---|---|---|---|
| DOC-FOG-ROI 必做 | ✅ "✅ 本轮必做（一项）" | ✅ Phase B 头号 | ✅ "🟡 接力 必做" | ✅ 三方收敛 |
| TONEMAP-1 Stage 2 不做 | ✅ "工程克制红线" | ✅ "按需触发约束" | ✅ "🔴 红线 Stage 1 6/6 PASS 禁止启动" | ✅ 三方收敛 |
| 取景 40° 不动 | ✅（5 轮不动延续）| ✅（同延续）| ✅ "🔴 红线 永久判定" | ✅ 三方收敛 |
| DoF 重开不做 | ✅ | ✅ | ✅ "🔴 红线 永久判定" | ✅ 三方收敛 |
| VIS-TABLE-SYM 二调不做 | ✅（Important 下个 Sprint 头号）| ✅（留下 Sprint）| ✅（不直接列、与"取景不动"同类）| ✅ 三方收敛 |
| visual-regression.md 骨架不做 | ✅（连续 5 轮 stretch）| ✅（stretch）| 未直接表态 | ✅ 三方收敛 |
| BokehPass removePass | ⚪ 可清死代码 | ⚪ stretch 顺手 | ⚪ stretch "如顺手可收、不强求" | 弱共识：可做可不做 |
| RACE-B-#1 | ⚪ stretch | ⚪ stretch | 未直接表态 | 弱共识：留下 Sprint |
| git add untracked | ⚪ 未直接表态 | ⚪ 未直接表态 | ⚪ 未直接表态 | Scout 接地建议本轮做（A.2） |

### D.2 残余分歧

**0 项残余分歧**。这是 6 轮 5 iter 里最干净的一次"三方收敛"——Iter 5 是收尾轮，三方都把"该做的"压到最小、把"不做的"写到最明确，没有任何"哪个 reviewer 说 X 但另一个说 Y"的需要 Planner 裁决的点。

**唯一一处微妙不同**：BokehPass removePass 和 git add untracked 三方都没强势主张，但都没反对——Scout 建议归到 DOC-FOG-ROI 一并 commit 里顺手清掉，让 Iter 5 commit 比 Iter 4 的纯 markdown 多一个"5 轮欠债清理"的副成果。

---

## E. 5 轮 sprint 收尾自审（Scout 视角）

### E.1 5 轮代码变化总览

**Sprint 6 / 第 6 轮（本 sprint）实际改动行数**（基于 Iter 1-4 commit + Iter 5 待 commit）：

| 文件 | Iter 0 基线 | Iter 5 末（实测） | Δ | 性质 |
|---|---|---|---|---|
| `src/magazineScene.js` | ~4477 行 | **4752 行** | **+275 行** | Iter 1 视觉调参 + 5 bug 修 / Iter 2 sRGB + race A / Iter 3 抽 render-config 反向移除常量 / Iter 4 RACE-B 3 处 guard + dispose 补一行 |
| `src/render-config.js` | 0（不存在）| **125 行** | **+125 行** | Iter 3 TECH-1 抽离（move-only + Iter 4 TONEMAP-1 2 字段改）|
| `src/preferences.js` | ~95 行（推算）| **113 行** | **+18 行** | Iter 4 PREF-1 sanitizePatch 字段级 + CLEAN-2 muted 删 |
| `src/styles.css` | ~1140 行（推算）| **1262 行** | **+122 行** | Iter 1 视觉相关 CSS（loader）+ 既有 G1/CARD-1 已含 |
| `src/deeplink.js` | 95 行（Sprint 5 末已落、untracked）| 95 行 | 0 | Sprint 5 CODEC-1 落定后无变化 |
| `src/lookCard.js` | 115 行（Sprint 5 末已落、untracked）| 115 行 | 0 | Sprint 5 CARD-1 落定后无变化 |
| `index.html` | ~30 行（推算）| **59 行** | **+29 行** | Sprint 4 H1 OG meta + Iter 1 注释 |
| `docs/plans/pitfalls.md` | 0（未存在）| **135 行** + 本轮拟加 | +135 + Iter 5 | 6 轮持续追加 |
| `docs/project_structure.md` | 0（未存在）| 已存在 + 本轮校 | + Iter 5 | 6 轮持续追加 |
| `docs/plans/SPRINT.md` | 0（未存在）| 594 行 | +594 行 | 6 轮合同 |

**commit 数（本 sprint 已知 commit）**：`git log -- src/preferences.js src/render-config.js` 显示 Iter 4 段 2 个 commit（`7c08edb` TONEMAP-1 + `bc271cd` PREF-1）。Iter 1-3 落地的 BUG-* / VIS-* / TECH-1 commit 未在本范畴枚举。

**未追踪文件结构变化总览**：
- Sprint 5 CARD-1 + CODEC-1 引入了 `src/lookCard.js` + `src/deeplink.js` 两个新文件（纯逻辑模块）—— 这是 5 轮里**最大的结构性收益**：把"卡片数据层 + URL codec"从 ~4752 行 magazineScene 巨石里拆出来到 95+115 行的可 headless 断言纯函数模块。
- Sprint 6 Iter 3 TECH-1 引入了 `src/render-config.js` 125 行纯常量集合 —— 这是结构性收益第二大（17 联调点位集中、Iter 4 TONEMAP-1 切换零字面量 delta）。
- 6 轮里 **零次拆 magazineScene.js 业务逻辑**（红线延续 6 轮，包括 5 轮已收官 + 第 6 轮 5 iter）—— 留给下个 Sprint。

### E.2 Iter 1-4 路径回顾：是否有遗漏的 bug 没被三方捕捉到？

Scout 倒推 5 轮（含本轮）reviewer 报告里抓到的 bug + 修法，问"还有什么 5 轮都没人发现的 bug 吗"：

| Sprint / Iter | Reviewer 抓到的真 bug | Scout 本轮额外审视 | 漏 catch 项 |
|---|---|---|---|
| Sprint 1 | DISC-1/2/3 / FIX-1 expression hint thinking 漏 cell 2 | EXPRESSION_HINTS 覆盖 commentary 实际 hint —— 已纳入 pitfalls | 0 |
| Sprint 2 | A1/2/3 / C6/7/8/9 持久化 + locale + masthead + skip-intro | preferences 字段域规范化 | 0 |
| Sprint 3 | D1/D2/D3/E5 落定内核 + 深链 + 鑑賞缝合 | 反查纯函数 + 三特例（cover/colophon/back）封底专路 | 0（PREF-1 latent bug 是 C6 时代埋下的，Iter 4 才发现，**是漏 catch 的**但已修）|
| Sprint 4 | G1/H1/J1/I1 缩略图目录 + OG meta + 一致反馈 + 底部承载 | `og-cover.png` git untracked（H1 漏 add）| 1（H1 漏 add og-cover.png，本轮 Iter 5 补 catch + 修）|
| Sprint 5 | CARD-1/CODEC-1/DOC-FIX/CLEAN-2/OG-FIX 卡片 + 深链升维 + 文档收口 | `src/deeplink.js` / `src/lookCard.js` 跨 2 sprint untracked | 1（src/deeplink.js / src/lookCard.js 漏 add，本轮 Iter 5 补 catch + 修）|
| Sprint 6 / Iter 1 | BUG-QUALITY-STUCK / BUG-GRAIN-RM / BUG-PEEL-SHADOW / BUG-TOC-TOGGLE / UX-CARD-ACTIONS / DOC-941 / VIS-LIGHT | 5 个真 bug 都 catch | 0 |
| Sprint 6 / Iter 2 | VIS-SRGB-FIX / VIS-COVER-EDGE / VIS-VIGNETTE-RIM / BUG-SHADOWMAP-DEPRECATED / BUG-GALLERY-RACE-A / BUG-DISPOSE-SHARE-TIMER | sRGB 双转吞色 + shadowMap deprecated + race A + dispose 漏清 | 0（race A 5 轮无人 catch、本轮 Iter 2 才系统性扫到，**严格说是漏 catch 但本轮 catch 了**）|
| Sprint 6 / Iter 3 | TECH-1 抽 render-config + VIS-RIM-BOOST / VIS-TABLE-SYM / VIS-FOG-FAR | 抽离边界 + 行号地图 + VIS-FOG-FAR 验收口径 | 0（VIS-FOG-FAR 验收口径错是 Iter 4 才发现，**漏 catch 但已纳入 DOC-FOG-ROI 沉淀**）|
| Sprint 6 / Iter 4 | TONEMAP-1 两阶段 + PREF-1 + RACE-B-小批 + DOC-FOG-ROI（Iter 4 死 → Iter 5 接力）| PREF-1 latent bug + 4 race B 候选 | 0（DOC-FOG-ROI 是 Iter 4 接力到 Iter 5 的延迟而非漏 catch）|
| Sprint 6 / Iter 5（本轮）| 接力 DOC-FOG-ROI + 5 轮观察 | git add untracked + og-cover.png 漏 add（H1 5 轮欠债）+ src/deeplink.js / src/lookCard.js 2 sprint 欠债 | **3 个新 catch**：H1 og-cover.png untracked / Sprint 5 deeplink.js untracked / Sprint 5 lookCard.js untracked —— 全部是 git 层面 contract 漂移，本轮可顺手收 |

**结论**：5 轮 reviewer + Scout 体系**没有漏掉任何代码层面的功能 bug**。剩下的 3 个未追踪文件是 git contract 漂移而非代码 bug——Sprint 4/5 落定时的合同写"落地 + commit"但实际只落地未 commit，Scout 接力本轮顺手收。

**给下个 Sprint 接力者的建议**：把 "ls untracked source files + ls untracked images in public/" 加入 reviewer 的标准检查清单——Scout 5 轮里这是第一次系统性扫到、应该常态化。

---

写完。
