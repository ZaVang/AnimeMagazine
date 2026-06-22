# Product Audit — ATELIER アトリヱ（第 6 轮 / Iter 5 / 最终轮 · 收尾）

> Reviewer：product-experience-reviewer。本轮是 5 轮 Sprint 的最后一轮 · 收尾基调。
> 报告写给 Planner，**精简**：Iter 4 已硬落 Stage 1 PASS（avgLum 119.23 / clipFrac 0% / bg.r×255=24 / 顶部行 lum 61-68 不再死黑），本轮再做就是"打磨之上的打磨"，必须谨慎选。

---

## Iter 4 后视觉终态评估 + 最终评分

**评分轨迹**：Iter 1 6.5 → Iter 2 7.0 → Iter 3 8.0 → Iter 4 8.5 → **Iter 5（终态）8.7 / 10**。

**+0.2 的来源不是视觉再变化**（Iter 4→Iter 5 之间 Generator 没动渲染），而是 Reviewer 第 5 次真机审后对"已落定"的肯定补足：

- 跨 4 轮"黑天空 / 死黑桌面 / 塑料感"三个根因都已被结构性消除（VIS-SRGB-FIX 红线落地、IBL 主光底盘 env=0.55、Neutral tonemap 色相保留）；
- Iter 5 真机抽测确认 Iter 4 commit 后**视觉无回归、无新坑**——Stage 2 fallback 未启动是正确的工程克制（rim 仍 1.5、env 仍 0.55、exposure 仍 1.18 全部按 plan 守住）；
- 唯一仍偏离 Iter 3 目标的是 VIS-TABLE-SYM 的 1.8:1 桌面左右比未收敛到 ≤1.4:1（本轮实测 1:1.83 = 0.548）——但**这是已知 backlog 不是新发现**，且其根因（poolLight SpotLight cone 中心仍偏左 + keyLight 方向）需调位置而非调强度，已超出"收尾打磨"边界。

**没到 9.5+ 的天花板**来自三个产品级而非视觉级因素（5 轮内本就无法处理）：① 941×1672 印刷素材天花板（DOC-941 已诚实文档化）；② 远景墙 / 吊灯 / HDR / AgX 全部主动延后（属新方向，5 轮收官不开新桌上赌注）；③ 桌面左右非对称这个 1.8:1（VIS-TABLE-SYM 在 Iter 3 落了 hemi 0.95 + pool x=-1.1→-0.6 后实测仍 1.8:1，根因比 Iter 3 假设更深，留下个 Sprint）。

---

## 用户主诉是否被解决（诚实自审）

用户原话："**主要从代码层面还有视角效果方面检查代码漏洞并修复。现在的视觉效果很差**"。两个诉求分开判：

### A. "代码层面 bug" — **完全解决 ✓**

5 轮里收掉了 Reviewer/Scout/Researcher 三审收敛点名的全部 Critical bug：

| Iter | bug | 状态 |
|---|---|---|
| 1 | BUG-QUALITY-STUCK（自适应画质卡 floor 永久糊化）| ✓ |
| 1 | BUG-GRAIN-RM（reduced-motion 下静态颗粒锁住）| ✓ |
| 1 | BUG-PEEL-SHADOW（peel 中阴影冻结）| ✓ |
| 1 | BUG-TOC-TOGGLE（缩略图按钮 position 失效）| ✓ |
| 2 | BUG-SHADOWMAP-DEPRECATED（fresh load warn ×2）| ✓ |
| 2 | BUG-GALLERY-RACE-A（stale turn clobber spread）| ✓ |
| 2 | BUG-DISPOSE-SHARE-TIMER（dispose timer 漏清）| ✓ |
| 4 | PREF-1（坏 patch wipe 用户偏好）| ✓ |
| 4 | RACE-B-小批（openLookCard 7 问 cross-state guard）| ✓ |

console 真机审 fresh load **0 error / 0 warn**（preview_console_logs 复跑 confirm）；build PASS / dispose 无悬挂 timer / dispose 无 listener 泄漏（visibilitychange 在 dispose 内 removeEventListener）。

### B. "视觉效果很差" — **基本解决 ✓（不是完美）**

| 验收维度 | Iter 0 基线（"很差"主诉那一刻）| Iter 5 终态实测 | 判定 |
|---|---|---|---|
| 整体 avgLum/256 | ~0.276（70.6/256）| **0.466（119.23/256）** | ✓ 跃迁 |
| darkFrac < 32 | 38.9% | **0.025%** | ✓ 死黑消失 |
| brightFrac > 180 | 18.9% | **19.7%** | ✓ 持平 |
| clipFrac > 250（红线 #1）| n/a | **0.0%** | ✓ |
| 顶部 sky band r×255 | ~2（99.9% 死黑，Iter 1 实测）| **74-81**（暖暗，肉眼可读为印刷间天花板）| ✓ |
| bg.r×255 期望 | 期望 24 / 实测 ~2 | **24** | ✓ 双转吞色已解 |
| 杂志页面 paper lum | n/a | **L 200 / R 202 / mid 187** | ✓ 暖纸不爆 |
| 顶部行 rim peak（红线 #2）| n/a | < 248 | ✓ |
| Neutral 色相保留（封面红、纸高光）| ACES S 曲线压暗 | Neutral 暖创色 hold 住 | ✓ |

**仍未完美的两点（已是已知 backlog 不是新发现）**：

1. **桌面左右不对称 1:1.83**（VIS-TABLE-SYM 目标是 ≤ 1.4:1）—— 前左 lum 69 vs 前右 lum 126。Iter 3 的 hemi 0.95 + pool x 调整未足额收敛，根因不在强度而在 poolLight cone 中心仍偏左 + keyLight 方向。**本轮收尾不再触动**（调光位置不算"打磨"是新调参）。
2. **941×1672 素材天花板**（封面 ATELIER "A" 被切等的根因）—— DOC-941 已诚实文档化，治本需重出 cover.png 属设计环节。

**结论**：用户主诉两端都被 5 轮 Sprint 实质解决。视觉从"屏幕没打开"跨到"温暖印刷间"是**可见的、可机器复跑的跃迁**（avgLum 70 → 119 / dark 38.9% → 0.025%）。**"很差"的判定不再适用**——现在只剩"很好但不是完美"的细节，属于产品成熟度的正常 backlog。

---

## 本轮该做什么、不做什么（Planner 直接取舍提示）

### ✅ 本轮必做（一项）

- **DOC-FOG-ROI**（Iter 4 留下未做的纯文档接力）—— pitfalls 三条新坑沉淀 + project_structure 行号小校 + git add 落定。具体内容已在 Iter 4 eval.md:158 列齐：
  1. fog band step 验收口径必须 ROI 在远端固定区；
  2. savePreferences patch 必须 per-field validate 再 merge（PREF-1 contract）；
  3. state-guard 七问扫描矩阵（race B 模式归档）；
  4. TONEMAP-1 Stage 1 PASS 6/6 实测沉淀 + Stage 2 未启动写明；
  5. **+ Iter 5 新沉淀**：dev server stale-module 警告（Iter 4 Evaluator 亲踩——`location.reload()` 才能加载新 commit 后的 src/*；下个 Sprint Evaluator 复验前必读）；
  6. project_structure.md 行号校正：magazineScene.js 实测 **4752 行**（不是任务 prompt 说的 ~4736）/ preferences.js 113 行 / render-config.js 125 行；
  7. **untracked 文件 git add**：project_structure.md / pitfalls.md 当前都是 untracked，DOC-FOG-ROI 必须包含 `git add` + commit，否则 working tree 内容跨 Sprint 容易 reset 丢失（这是 Iter 4 Evaluator 已亲指出的红线）。

### ❌ 本轮不该做（三项，写死省得下轮再议）

- **Stage 2 不要启动**。Iter 4 阶段 1 Tier A 10/10 + Tier B 6/6 全部 PASS：avgLum 119.23 ∈ [107,141] / clipFrac 0% / rim 顶部 peak < 248 / brightFrac 19.7% ∈ [15,28] / darkFrac 0.025% < 5% / bg.r×255=24 ∈ [22,28]。Stage 2 的 "rim 1.5→1.2 + env 0.55→0.45 + envMap ×0.85 + exposure 1.18→0.90" 是为 Tier B 跳门时准备的 fallback——**没跳门、就不动**。这是"工程克制"红线，违反它就是 over-tweak。
- **不补 BokehPass 删除 / VIS-TABLE-SYM 二次调参 / visual-regression.md 骨架** —— Iter 4 SPRINT.md 末尾列的 4 个 stretch，**全部跳过**。理由：① BokehPass 已 Sprint 11 决策"默认关 + 不开"，再做 removePass 是清理代码不是修视觉，价值低且不属于本轮"收尾"；② VIS-TABLE-SYM 1.8:1 → ≤1.4:1 是真问题但**根因是光位置**（poolLight cone + keyLight 方向），不是调强度能解的，已超出"打磨"边界，留下个 Sprint；③ visual-regression.md 骨架在跨 3 轮 stretch 未做后已基本判定为"低 ROI"——5 轮 Evaluator 都用了 ad-hoc preview_eval 跑通了 Tier A/B/C 验收，再建一个抽象层意义不大。
- **不开任何新功能 / 新方向 / 新桌上赌注** —— 远景墙 / 吊灯 / HDR / AgX / 风格化 V2 / 卡片 stage B PNG 导出 / 音频层 / 设置面板，全部留下个 Sprint。

### 关于 RACE-B-#1 的澄清

Iter 4 任务 prompt 提到"RACE-B-#1 已在 Iter 4 顺手收（实际 commit 含了 #1+#4）"——这是对的，commit `56aa7cb` 的 message 与 eval.md 反测都确认 `openLookCard` 头部含 `if (this.show) return false`（#1）+ `if (this.turn) return false`（#4）+ `hudCard click` 内 `endTour()`（#2）+ `toggleGallery` 内 `closeLookCard()`（#3）四处 guard，覆盖了 race B 七问中实际能复现的全部入口。剩下三问（peel / state / gallery 互斥）属于"模式归档不需 guard"那一类。**RACE-B 已收完，不再追加**。

---

## Executive Summary

5 轮 Sprint 把"会动的封面 demo"打磨成**一台自洽、有记忆、可分享、可导航、可阅读·可传播、视觉跃迁的 3D 纸艺装置**。用户主诉两端（代码 bug + 视觉效果）均实质解决：9 个三审收敛的 Critical bug 全部 commit / fresh load 0 warn 0 error / 视觉直方图 avgLum 70.6 → 119.23 / 顶部死黑消失（r×255 从 ~2 → 74-81）/ Neutral tonemap 保色相 / paper 不爆、bg 暖暗。终态评分 **8.7/10**（轨迹 6.5 → 7.0 → 8.0 → 8.5 → 8.7），未到 10 来自三个产品级因素（素材天花板 / 桌面左右不对称根因在光位置 / 主动延后的新方向）—— **均非视觉打磨能解，本轮收尾不动**。

本轮（Iter 5）只做一件事：**DOC-FOG-ROI 接力**——把 Iter 4 留下的纯文档收尾收掉、把 untracked 的 pitfalls / project_structure git add 落定。其余一切（Stage 2 / VIS-TABLE-SYM 二调 / 4 个 stretch / 任何新功能）**全部不做**。

---

## Phase 1：功能体验（Iter 5 实测，与 Iter 4 对比）

- **首次印象**：`preview_start` → dev server 5179 → fresh load 控制台 0 warn / 0 error，devicePixelRatio=1 → pixelRatio=2 报告一次正常，无 PCFSoftShadow deprecated warn（Iter 2 BUG-SHADOWMAP-DEPRECATED 仍 hold）。
- **核心流程**：`landOnSpread(4, { persist:false, immediate:true })` 在 200 帧确定性 update 后落定 `state="open" / spreadIndex=4`，camera 落 (-0.36, 2.96, 3.72) 正确，HUD masthead / share / actions 三个顶部列表全部可见且布局未漂移（375px / 1280px 双断点 Iter 4 eval.md 已验、本轮未再回归）。
- **错误处理**：try/catch landOnSpread 无 throw；savePreferences 反测（Iter 4 PREF-1 7/7 PASS）继续 hold——本轮不再追加。
- **DOM 探针**：`.hud-masthead`(123×661) / `.hud-masthead-actions`(123×97) / `.hud-share`(102×27) 全部可见，`.hud-status`(0×345, x=0 y=-357) hidden-default（无立牌起立场景下不显，合规——I1 互斥结构 hold）。

## Phase 2：审美品味（Iter 4 切 Neutral 后真的好看了吗？）

- **配色**：Iter 4 Neutral tonemap 实测把封面红 hue 拉回偏酒红（ACES 时被压成偏粉橙）；paper L=200/202 是"暖纸"不是"医院白"；bg+fog 同 hex 0x18130e（r×255=24）形成统一的木桌暖暗调；rim 仍 1.5（gold edge 在背光位置生效）。配色协调度 vs Iter 3：**+0.5**。
- **字体**：HUD masthead / share pill / actions row 字号层级 Iter 2 落地后未动，韵律仍 OK。
- **间距与留白**：Iter 4 I1 之后底部 HUD 列 124px（从 159px 腾下来）依然 hold，masthead-actions 与 share 之间有可感呼吸感。
- **动效**：grain reduced-motion 关 / 走秀 dim→restore 1e-3 内 / openLookCard 跨态 guard——全部 commit 后行为不变。**视觉性格**：从"屏幕没打开"跨到"温暖印刷间"是 5 轮最大的可见变化，**这条主诉跑完了**。

## Phase 3：产品想象力（收尾轮不开新桌上赌注，本段精简）

收官小结：从 Iter 1 起 5 轮主动延后的 backlog（远景墙 / 吊灯 / HDR / AgX / 风格化 V2 / 音频层 / 卡片 stage B / 设置面板 / VIS-TABLE-SYM 根因调位置）都归档到 SPRINT.md 第 5 轮预告 + Iter 1-4 的"明确不做"段，下个 Sprint 接力者**不需要本 reviewer 再列一遍**。

## Phase 4：一致性与对比

- **跨视图一致**：3D 杂志 / 鑑賞 DOM 翻页书 / look-card 三层视觉语言（纸色 / 明朝 / 墨色 / hairline）保持一致；Iter 4 Neutral 切换后三层都受益于同一 OutputPass 的色相保留。
- **与同类产品对比**：Iter 2 进化 reviewer 已给过——本产品的差异化（3D 纸艺氛围装置 + 双语印刷烤死 + 缩略图目录 + per-item 深链）在 demo 范畴内仍是市场上罕见组合。**收尾轮不再展开**。

---

## Prioritized Recommendations（精简 / 收尾基调）

### 🔴 Critical — 必做（1 项）

- **DOC-FOG-ROI**（Iter 4 留下的纯文档接力）—— 内容见上"本轮必做"段第 1-7 点。零代码 / 零视觉接触面 / 10-15 分钟可收 / 必须含 `git add` + commit。

### 🟡 Important — 本轮不做但下个 Sprint 头号候选

- **VIS-TABLE-SYM 真根因修**：桌面左右 1.8:1 不对称的根因是 poolLight SpotLight cone 中心 + keyLight 方向，不是调强度。修法在 magazineScene.js 内调 poolLight.position 与 keyLight.position（不是 render-config.js 内调强度）。**本轮不动**——属新调参不属"收尾"。

### 🟢 Nice-to-have — 全部跳过

- BokehPass 彻底 removePass / visual-regression.md 骨架 / project_structure.md 之外的所有"打磨之上的打磨"——5 轮已收官，**全部不做**。

### 💡 Feature Idea — 不进任何 Sprint backlog（已在 SPRINT.md 第 6 轮预告里写过）

- 音频层 / 卡片 stage B PNG 导出 + 二维码 / 全刊 look 全家福海报——下个 Sprint 决定。本轮不重复列。

---

## 5 轮 Sprint 收尾观察

1. **三审收敛点是高杠杆判定的最强信号**：5 轮里 9 个 Critical bug + 视觉根因（双转吞色 / IBL 主光底盘 / Neutral 色相）全部被 Experience + Evolution + Research 三方独立点名收敛——三审独立收敛点是"必修不可议"的最强判定，本 Sprint 后建议作为"红线规则"沉淀。
2. **工程克制 = 工程价值的一部分**：Iter 4 Stage 1 PASS 后 Generator 守住"不预防性做 Stage 2"是本 Sprint 最聪明的决策之一；同样 Iter 3 不切 tonemap、Iter 5 不动 VIS-TABLE-SYM 二调，都是"克制"。**反例：5 轮内多次有 reviewer 提议扩展光位置 / 加新光源 / 切 AgX / 抽 vizConfig，最终都被 negotiation.md 多数派否决——这条 trail 比代码本身值得记录**。
3. **untracked 文件是收尾杀手**：project_structure.md / pitfalls.md 跨 4 轮都是 untracked 文件——Iter 4 eval.md 亲指出 working tree 内容容易跨 Sprint reset 丢。**DOC-FOG-ROI 本轮必须 git add + commit 落定**——这是结构性预防、不是文档洁癖。
4. **headless 验收的天花板**：5 轮里 Tier D（真人肉眼定性校 / 走秀 startShow 端到端 / D3 morph 流畅度）多次成为 PASS 判定的盲区，全部留给"真机审兜底"。下个 Sprint 若有视觉打磨，建议在 Sprint kickoff 就明确"哪些项 headless 验得到 / 哪些必须真机审"——避免在末轮才发现验收盲区。
5. **render-config.js 抽离（Iter 3 TECH-1）是 5 轮最高 ROI 的结构性投入**：Iter 4 TONEMAP-1 把 17 联调点位的回归面积从"全文搜散落"压缩到"看一个 125 行的文件"，commit `7c08edb` 的 stat 是单文件改 2 字段——这种"抽离换可控回归面积"的范式建议在下个 Sprint 推广（候选：materials.js 抽材质 baseColor）。

---

## 给 Planner 的取舍提示（一句话版）

**本轮（Iter 5）只做 DOC-FOG-ROI（含 git add）；Stage 2 不动 / 4 个 stretch 全跳 / 任何新功能或新调参延后下个 Sprint；用户主诉两端均实质解决，终态评分 8.7/10，可以收官**。
