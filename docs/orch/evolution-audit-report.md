# Evolution Audit — Sprint 6 / Iter 5（第 6 轮迭代 / Iter 5 · **最终轮 · 收尾**）

> **报告头部（用户要求）**：Iter 4 后 Tech Health 终态 + 5 轮 sprint 整体观察
>
> **Iter 4 后 Tech Health 一句话快照**：TONEMAP-1 Stage 1（ACES→Neutral + exposure 1.18）落定 + Tier B 6/6 PASS（avgLum=119.44 ∈ [107,141] / clipFrac=0.0% < 0.5% / rim peak=69.5 << 248 / brightFrac=19.80% / darkFrac=0.058% / bg.r×255=24）+ PREF-1 latent bug 修（sanitizePatch field-level）+ RACE-B 3 处 1 行 cross-state guard。Iter 3 抽 render-config 的红利**在 Iter 4 全额兑现**：TONEMAP-1 只动 1 个文件 × 2 字段、magazineScene.js 0 字面量 delta、bundle 仅 +401 bytes，是 6 轮里"结构性投入二次回报"的最干净一次。技术健康度 **8.9/10**（Iter 4 我给 8.6 → +0.3：render-config 红利兑现 + race B 七问归档 + sanitizePatch 契约修复 latent bug；扣的 1.1 来自 4752 行 single-file 仍是结构债 + 11 处匿名 setTimeout 仍在虽已判定不值得清 + DOC-FOG-ROI 仍未沉淀）。
>
> **5 轮 sprint 整体观察 · 一句话**：第 6 轮起手是"主诉视觉差 + 代码漏洞"的双线模糊命题，5 轮把它拆成"Iter 1 大手术（一次 7 大项 / 数值调参 + 5 个真 bug）→ Iter 2 sRGB 系统性修（Iter 1 暴露的子弹）→ Iter 3 TECH-1 结构性抽离（为 Iter 4 铺路、视觉 4 项独立验收）→ Iter 4 tonemap 切换两阶段方案（render-config 红利 + Stage 1 即 PASS 省下 Stage 2）→ Iter 5 收尾（DOC-FOG-ROI + 两项 stretch + 5 轮观察）"——**系统性 vs 局部修法的比例 5 轮整体 7:3**（Iter 2 sRGB 是最系统化的一次、Iter 3 TECH-1 抽离是最结构化的一次、Iter 4 PREF-1+RACE-B 都是"模式归档级"的小批量系统修法）。视觉路径回头看**合理**：Iter 1 调参 → Iter 2 修双转 → Iter 3 抽 render-config → Iter 4 切 tonemap 是"先调参摸地基 → 修地基本身 bug → 抽出 config → 用 config 做大切换"的渐进路径，每轮都为下一轮铺路、没有一轮"走偏"。还差什么 = **真机肉眼终审**（Tier D 5 轮都未做、Iter 5 必须做）+ **拆 magazineScene.js 业务逻辑**（合同红线写死不做、留给下个 Sprint）。

---

## Executive Summary

**产品进化成熟度评分 7.7/10**（Iter 4: 7.6/10，+0.1 来自 Iter 4 TONEMAP-1 Stage 1 PASS 把"温暖印刷间"色相忠实度从 ACES S 曲线压低光的状态升到 Neutral 自然平直，+ PREF-1 修了一个真存的 latent bug + RACE-B 把 4 race 候选清掉 3 个）。

5 轮已收官、Iter 4 三任务全部 commit 落地 + 独立 Evaluator 复跑 PASS、Stage 2 fallback 正确遵守"按需触发"约束保持 backlog 工具箱状态。**Iter 5 不是产品功能轮也不是技术大手术轮——是收尾轮**：(a) 接力 Iter 4 漏的 DOC-FOG-ROI（pitfalls 三条新坑沉淀 + project_structure 行号小校 + git add commit untracked 文件）；(b) 顺手 stretch 视余量（BokehPass removePass / RACE-B-#1 / visual-regression.md 骨架 / VIS-TABLE-SYM Neutral 基线下重观察）；(c) 给出 5 轮整体观察作为"sprint 收尾"的最后一笔。

**四维度判定（Iter 5 最终视角，不变 = 与 Iter 4 同）**：
- **核心完整性** 9/10（不变）：5 轮完整链路全部就位、五条到达路径反馈统一。**无新机会**。
- **竞争差距** 7.5/10（不变）：纸艺 flipbook 桌上赌注全齐。**无新机会**。
- **功能深度** 7/10（不变）：CARD-1 + CODEC-1 把 15 包社论做成可停留细读 + 可分享单元。**无新机会**。
- **差异化** 8/10（不变）：3D 木桌 + 翻页 + 立牌 + DOM 鑑賞混合在同类中独一份。**最终轮 · 不要新功能 / 新桌上赌注**（红线）。
- **Technical Health（本轮最高权重）** 8.9/10：见 §Technical Health（Iter 4 后终态 + 5 轮走向）。

**最大的进化机会在哪个维度（最终轮答案）**：**全部维度的"产品进化机会"=0**，5 轮已合同收官。**Iter 5 唯一的工作**是把 Iter 4 留下的文档欠债（DOC-FOG-ROI）收掉、把 5 轮经验沉淀进 pitfalls.md 给下个 Sprint 一份完整地图，外加视余量动两个 stretch（BokehPass removePass / visual-regression.md 骨架）。

---

## Phase 1: 核心完整性

> 本轮无产品维度新发现。**5 轮收尾结论**：核心循环已**完全闭环**，连续 3 轮（Iter 3/4/5）均判定"缺失环节 = 0"，是 6 个 sprint 里第一次跨多轮稳定在"无功能性 todo"状态。

- 当前核心循环：3D 杂志开合 → 拖拽翻页 → 立牌起立 → 解说热点 / 巡回 → 走秀 → 鑑賞模式 → 缩略图目录 → 深链 / 分享 → 卡片细读 → 回环回杂志。**循环 5 轮稳定闭环**。
- 缺失环节扫描：**0 个**（与 Iter 3/4 一致）。
- **5 轮走向**：从 Iter 1 末的"7 个外壳级桌上赌注未补"→ Iter 4 末的"0 个外壳级 todo"——这条路径是 onboarding（DISC-1）/ 持久化（C6）/ locale（C7）/ masthead（C8）/ skip-intro（C9）/ 鑑賞缝合（D 组）/ 深链（E5/CODEC-1）/ 目录（G1）/ OG（H1）/ 反馈统一（J1）/ HUD 承载（I1）/ 卡片（CARD-1）一笔一笔补齐的，没有任何一项"半成品落地"——**这点是这个 sprint 最值得称道的执行质量**。
- 空状态 / 边界覆盖（最终轮快照）：3 个无 page 字段特例（cover / colophon / back）专门特判路径 5 轮稳定 / 越界 spread / item 安全回退稳定 / reduced-motion 多处显式守 / **Iter 4 PREF-1 修了第 5 轮才被发现的 latent bug**（坏 patch 字段静默 wipe 旧 good 值）—— sanitizePatch 字段级 merge 现已成为 prefs 层的契约模板。**Phase 1 终审 PASS**。

---

## Phase 2: 竞争差距

> 本轮无新发现。**5 轮收尾结论**：vs StPageFlip 标准实现 / Issuu / Flipsnack / 同类纸艺 demo 的桌上赌注 5 轮全部补齐，连续 2 轮（Iter 4/5）判定"无新机会"。

- vs StPageFlip 标准实现：功能差距 = 0（缩略图 / 键盘 / 双硬页 / 目录 / 动效降级齐全）。
- vs Issuu / Flipsnack：本产品**胜在** 3D 氛围 + 立牌 + 走秀；**劣在**无搜索 / 无评论（5 轮已写死不做，氛围装置定位与"内容平台"是错位需求）。
- vs 同类纸艺 demo：本产品在"角色档案卡 + 双语 + 深链精度到 item"维度领先。
- **5 轮走向**：Iter 1 的"轻量电子书桌上赌注差 5 项" → Iter 2-3 的"缺 3 项" → Iter 4 的"差距 = 0" → Iter 5 维持 0。**Phase 2 终审 PASS**。

---

## Phase 3: 功能深度

> 本轮无新发现。**5 轮收尾结论**：内容深度的兑现路径 = 15 包社论从 Iter 1 末"被 hover/tour 一闪而过"→ Iter 4 末"可停留细读 + 可分享单元"，是 sprint 6 里**单项产品价值兑现度最高的一笔**（CARD-1 + CODEC-1 同轮做、互为落地对象）。

- power-user 路径：键盘 G/Esc/方向键/SPACE/Enter/Tab + 深链 `?spread=N&item=M&locale=X` + 缩略图直跳——5 轮饱和。
- 数据导入导出：分享深链 + 复制链接 + 卡片回环——5 轮饱和；PNG 导出 + 二维码（卡片 stage B）合同写死留下个 Sprint，理由 5 轮已稳定（headless 验收不到图质量 + `toDataURL` 跨域污染 + 最终轮无后续兜质量）。
- 协作 / 社交：OG card + 深链 codec 5 轮已饱和。
- **5 轮走向**：Iter 1 末"social 0 沉淀" → Iter 3 E5 深链落地 → Iter 4 CODEC-1 升维 `?spread=N&item=M` + CARD-1 卡片本体 → Iter 5 收尾，是连续 3 轮平滑收敛。**Phase 3 终审 PASS**。

---

## Phase 4: 差异化与 Wow Factor

> 本轮无新发现。**5 轮收尾结论**：**5 轮已收官 / 最终轮 · 不要新功能** — 合同红线我接受。

- 不提"如果能 XXX 就太酷了"——任何新功能（远景墙 / 远景剪影 / 吊灯 / 视觉一键切换 / 灯光预设 / 音频层 / 全家福海报 / 卡片 PNG 导出 / 二维码 / 时段感"夜深一档"按钮 / 深链 codec 升维到 `?spread=N&item=M&look=X`）全部留下个 Sprint。**5 轮已收官 + 最终轮 · 不要新功能** —— Reviewer 红线写死。
- 值得删的：0 个新发现（Iter 3 已删 `volume`、Iter 5 计划之前已删 `muted`、Iter 5 stretch 候选 BokehPass removePass 是"清挂着的死代码"不是"删未来用得着的字段"）。
- **5 轮走向**：Iter 1 想"加新功能 / 重启世界观"的冲动被合同压住、Iter 2 sRGB 修是"内功不是噱头"、Iter 3 抽离 + 视觉 4 项独立验收是"工程纪律不是新功能"、Iter 4 TONEMAP-1 两阶段方案是"决策框架不是新模式"、Iter 5 收尾——**整个 sprint 没有引入任何新差异化点也没有失去任何已有差异化点**，这是"最终轮 · 不要新功能"红线最严格执行的一轮 sprint。**Phase 4 终审 PASS**。

---

## Technical Health（本轮最高权重 · Iter 4 后终态 + 5 轮 sprint 整体走向）

### 5.1 Iter 4 后 Tech Health 终态（独立复跑）

> Iter 4 三任务全部 commit 落地（`7c08edb` TONEMAP-1 / `bc271cd` PREF-1 / `56aa7cb` RACE-B-小批），Evaluator 独立复验 PASS 全部硬验收门。Iter 5 不再复跑硬验收门，仅做终态盘点：

| 维度 | Iter 4 后实测 | Iter 5 评估 |
|---|---|---|
| **bundle** | 925,180 bytes（Iter 3 基线 924,779 → +401 bytes，与"PREF-1 +250 + RACE-B +120 + TONEMAP-1 +30"算账一致） | ✅ 健康（5 轮净 +1.2KB，bundle 控制极佳） |
| **render-config 红利兑现** | TONEMAP-1 只动 render-config.js 2 字段；magazineScene.js 0 字面量 delta | ✅ Iter 3 TECH-1 的预言成立——"租给 Iter 4 + 用一次"的投入产出比理想 |
| **Tier B 像素直方图（红线）** | avgLum=119.44/256=0.467 ∈ [0.42,0.55]；clipFrac=0.0% < 0.5%；rim peak=69.5 << 248；brightFrac=19.80%；darkFrac=0.058%；bg.r×255=24 | ✅ 6/6 PASS，Stage 2 fallback 不需启动 |
| **PREF-1 反测** | sanitizePatch field-level merge / 坏 `{lastSpread:"abc"}` 不再 wipe 旧 7 / 坏 `{locale:"fr"}` 不再 wipe 旧 "zh" / null/undefined/empty patch no-op 不抛 | ✅ 7/7 PASS，blob-level sanitize 路径保留给 loadPreferences |
| **RACE-B 反测** | 3 处 1 行 guard 全部接入 compiled function：`if (this.show) return false`（race B #1）/ `if (this.turn) return false`（race B #4）/ `if (this.tour) this.endTour()`（race B #2）/ `if (this.lookCard) this.closeLookCard()`（race B #3） | ✅ 5/5 PASS（含 race B #1 stretch 也顺手收，4/4 race B 候选只剩 0） |
| **走秀路径 dim→restore lazy capture** | `applyShowDim(0)` 复位后 5 灯 + env + vignette 与 baseline 7/7 全部 1e-3 内一致 | ✅ Iter 3 lazy capture 物理消除"同步漏接线"模式 |
| **控制台** | fresh load 0 error / 0 warn | ✅ |
| **双断点 DOM** | 1280×800 + 375×812 均无回归（masthead 38/117 不溢出、hud-masthead-actions 128/27 与 masthead 不相交） | ✅ |

### 5.2 5 轮 sprint 整体观察（**用户要求段**）

#### 5.2.1 三个 bug 的修复总账（Iter 1/2/3/4 一共修了多少个？修法系统性 vs 局部比例？）

**5 轮真 bug 修复总账（按 commit + 验收硬门口径口径）**：

| Iter | bug 修复总数 | 修法分类 | 系统性 vs 局部 比例 |
|---|---|---|---|
| **Iter 1** | **5 个**（BUG-QUALITY-STUCK / BUG-GRAIN-RM / BUG-PEEL-SHADOW / BUG-TOC-TOGGLE / BUG-FOG-NEAR） + DOC-941 | QUALITY-STUCK 是"自适应算法对称性 + visibilitychange 防御"= 系统性；GRAIN-RM 是 a11y 契约修法 = 系统性；PEEL-SHADOW + TOC-TOGGLE + FOG-NEAR = 局部值改 | **3:2**（系统性 60%） |
| **Iter 2** | **6 个**（VIS-SRGB-FIX / VIS-COVER-EDGE / BUG-SHADOWMAP-DEPRECATED / BUG-GALLERY-RACE-A / BUG-DISPOSE-SHARE-TIMER / VIS-VIGNETTE-RIM） | SRGB-FIX 是"全场 ColorManagement 路径系统性修补"= 极系统性；GALLERY-RACE-A 是"切层 toggle 必须清在飞 turn"= 模式级；DISPOSE-SHARE-TIMER 是"timer 配对" = 局部；SHADOWMAP-DEPRECATED 是 deprecated 别名撤回 = 局部；COVER-EDGE + VIGNETTE-RIM = 局部 | **3:3**（系统性 50%） |
| **Iter 3** | **0 个真 bug 修**（TECH-1 是 move-only 重构，不是 bug 修；VIS-RIM-BOOST/TABLE-SYM/FOG-FAR 是视觉打磨不是 bug） | 全部"结构性投入"——TECH-1 抽离 17 联调点位、为 Iter 4 切 tonemap 铺路 | — |
| **Iter 4** | **2 个**（PREF-1 latent bug / RACE-B 4 处候选清掉 3 + Iter 5 stretch 已顺手清掉 #1 = 全部 4 个清完） | PREF-1 是"blob-level sanitize 不能替代 patch-level，merge 契约违反"= 系统性 + 模式级；RACE-B = state-guard 七问扫描矩阵 = 系统性 | **2:0**（系统性 100%） |
| **Iter 5** | **0 个新 bug 修** | DOC-FOG-ROI = 文档沉淀；BokehPass removePass / visual-regression.md 骨架 = 收尾打磨 | — |

**5 轮真 bug 修复总数 = 13 个**（Iter 1: 5 + Iter 2: 6 + Iter 4: 2，Iter 3/5 0 个）。**系统性 vs 局部比例约 8:5（62% : 38%）**，**系统性占多数派**——这点超出我对"主诉模糊命题 sprint"的常规预期（同类常 50:50 甚至局部派占多），归因于：(a) Iter 2 SRGB-FIX 是一次性把"非 map hex 色值双转吞色"全场系统性扫一遍；(b) Iter 4 PREF-1 + RACE-B 都是"模式归档级"的小批量但每一处都填进 pitfalls 模板。

**5 轮 bug 修复路径的执行质量**：每一个修都伴随 pitfalls.md 模式归档（Iter 1 BUG-FOG-NEAR 同模式坑、Iter 2 GALLERY-RACE-A 同模式坑、Iter 4 PREF-1 sanitizePatch 契约 + RACE-B 七问扫描矩阵），**没有"修一个 bug 不沉淀模式"的孤立修法**——这是这个 sprint 在工程纪律上最值得归档的一点。

#### 5.2.2 视觉路径回头看（Iter 1 调参 → Iter 2 修双转 → Iter 3 抽 render-config → Iter 4 切 tonemap）

**回头看路径合理性 = 高（5/5）**。每一步都为下一步铺路、没有"走偏"：

| Iter | 视觉动作 | 为下一轮铺什么路 | 回头看的判断 |
|---|---|---|---|
| **Iter 1** | 7 大项联调（VIS-LIGHT IBL + rim 0.9 + bg/fog hex + spineMaterial 暖色 + grain.amount 0.04→0.03 + vignette 0.32→0.20 + WebGL shadowMap.type 重设） | 暴露 Iter 2 必须修的"非 map hex 双转吞色"真问题（bg.r×255 实测 ≈ 2，源码写 0x18130e 期望 24） | ✅ **必要的"探测一遍"**——没有 Iter 1 调参 就不会暴露 ColorManagement 双转 bug |
| **Iter 2** | SRGB-FIX 系统性修（bg/fog/书脊/封面四边 4 处显式 `setHex(..., LinearSRGBColorSpace)`）+ vignette/rim 与"bg 真亮起来"联调 | 把 Iter 1 的"调参看到的色"变成"真出现在屏幕的色"——为 Iter 3/4 真机判断奠定**色值真值**前提 | ✅ **不修这一层 Iter 3/4 全部建在沙地上**——SRGB-FIX 是 5 轮最系统化的一次 |
| **Iter 3** | TECH-1 抽 render-config + 4 视觉项独立验收（rim 0.9→1.5 / hemi 0.8→0.95 / poolLight.x -1.1→-0.6 / fogFar 7.5→9.0）+ DOC-LINEMAP 行号校 | 把 Iter 4 tonemap 切换的回归面积从"散落 17 处 grep"压到"看一个文件"——render-config.js 28 处 RENDER.* 引用是单一真相源 | ✅ **5 轮里结构性投入产出比最高的一笔**——一次抽离 + Iter 4 一次切换全额兑现 |
| **Iter 4** | TONEMAP-1 两阶段方案（Stage 1 = Research A3 最小动作 / Stage 2 = Experience 预防性降）+ Tier A/B/C/D 验收门 + PREF-1 + RACE-B | 留 Iter 5 兜底（Stage 2 fallback 工具箱状态 + 真机肉眼 Tier D 终审） | ✅ **三方观点都被尊重 + Stage 1 PASS 省下 Stage 2 = 决策框架完美闭环** |

**Iter 4 的 Stage 1 PASS 是 5 轮视觉链路最关键的一次正反馈**——证明 Iter 1-3 的渐进路径是对的（如果 Iter 2 没修 SRGB 双转、Iter 3 没抽 render-config，Iter 4 TONEMAP-1 会落 Stage 2 fallback、需要降 rim 1.5→1.2 / envMap 9 桶 ×0.85 / envIntensity 0.55→0.45 / exposure 1.18→0.90 全部联动）。

#### 5.2.3 还差什么？sprint 余量不够 vs 定位本身决定的天花板

**还差什么 = 3 项 + 1 个边界**：

1. **真机肉眼 Tier D 终审**（Iter 4 漏的、Iter 5 必须做）—— 封面红是否真的更深更接近书皮 / 纸高光是否真的"米黄色而非纯白" / 阴影是否真的"有色而非死黑、有油墨湿润感" —— 这三项 A3 唯一的 brand-new 收益是 headless 像素直方图测不出来的，**5 轮 Tier D 全部 PENDING、Iter 5 必须真机审一次给 5 轮收尾画句号**。
2. **拆 magazineScene.js 业务逻辑**（合同红线写死不做） —— 4752 行单文件随 Iter 4 RACE-B 又涨 21 行，5 轮净 +71 行 vs Iter 2 末，虽然 TECH-1 已经抽了 render-config 让"调参点位"集中、但 4752 行的业务逻辑（startShow / openLookCard / toggleGallery / landOnSpread / applyDeepLink 等）**仍是单个文件**，下个 Sprint 头号建议项 = 拆 `materials-config.js`（材质 baseColor / spineMaterial / coverEdge）+ `state-machine.js`（state/turn/show/tour/gallery/lookCard 状态机）两个子模块。
3. **真机视觉 A/B 对比基线**（visual-regression.md 骨架，5 轮连续 stretch 未做） —— 连续 5 轮 stretch 不做累积成 evaluator 工作量复跑的负担，Iter 5 是最后一轮机会、视余量做。
4. **边界（非 todo）**：3D 装置定位本身的天花板 —— 无搜索 / 无评论 / 无社交评论流 / 无内容流推荐 —— 这些**不是"差什么"而是"定位不要什么"**，5 轮已写死、合同明确。

**判定**：**还差的 3 项里 2 项是 sprint 余量问题（Tier D 真机审 + visual-regression 骨架）、1 项是定位决定的天花板下另一层 sprint 决策（拆 4752 行 = 下个 Sprint 头号）**——不是定位本身的天花板。**5 轮已收官、剩余项留 Iter 5 + 下个 Sprint 自然消化**。

### 5.3 dispose 完整性（5 轮终审）

> Iter 2 补 shareFlashTimer / Iter 3 我提了"11 处匿名 setTimeout 微泄漏"判定不值得清 / Iter 4 再扫不动（已 guard + detached DOM no-op）—— **Iter 5 是否要顺手清？**

**Iter 5 终审：仍判定不值得清 11 处匿名 setTimeout**。

理由（与 Iter 3/4 一致 + 最终轮收尾视角的补充）：

- 11 处中 9 处已显式 guard（`this.disposed` / `this.gallery === g` / `this.lookCard && el === ...`），dispose 后 callback 立即变 no-op；
- 剩 2 处（3903 / 4453）是"detached node 上调 .remove()"，浏览器自动 GC、no-op；
- 修复成本：每处 命名为实例字段 + dispose 清 = 11 行新代码 + 11 个新实例字段 + **0 个真实可观察的内存泄漏修复**；
- **最终轮收尾视角**：最终轮的工作量预算应优先给 DOC-FOG-ROI 文档沉淀（5 轮未做 / Iter 4 漏的）+ Tier D 真机终审（5 轮未做），而不是 11 行无可观察收益的命名化清理。

**5 轮 dispose 完整性走向**：Iter 1 = 11 处匿名 setTimeout，无判定 / Iter 2 修 share timer + 模式归档 "dispose 必须清所有 timer" / Iter 3 = 我做了 11 处完整扫描表（行号 + 用途 + guard + 风险评估）判定不值得清 / Iter 4 维持 / Iter 5 终审维持。**这套判定模板沉淀进 pitfalls 已 Iter 3 完成、5 轮稳定 = 工程纪律级模式归档成功**。

### 5.4 状态机一致性（5 轮终审）

> Iter 2 修了 race A（toggleGallery 入口清在飞 turn）/ Iter 3 我没扫到 race B / Iter 4 §5.2 扫到 race B 4 候选（#1 show→openLookCard / #2 tour→openLookCard / #3 lookCard→toggleGallery / #4 turn→openLookCard）— **Iter 5 终审**：

**Iter 4 RACE-B-小批 commit `56aa7cb` 落地 3 处 + 我看到 Iter 4 末 Evaluator 复验显示 Iter 4 Generator 顺手把 stretch race B #1 也收掉了**（`openLookCard` 头部加 `if (this.show) return false`，Evaluator §5 reproduction 实测命中 guard 返回 `false`）。**Iter 4 末 4/4 race B 候选清完 = state-guard 七问扫描矩阵到位**。

**Iter 5 扫一遍剩余状态机风险**：

| 状态对 | 入口 guard | 评估 |
|---|---|---|
| turn → toggleGallery | Iter 2 race A 四件套复位 | ✅ |
| show → toggleGallery | `if (this.show) return` 直接拦截 | ✅ |
| tour → toggleGallery | `if (this.tour) this.endTour()` 主动结束 | ✅ |
| gallery → openLookCard | `if (this.gallery) this.closeGallery()` 主动关 | ✅ |
| **show → openLookCard** | **Iter 4 顺手收 stretch：`if (this.show) return false`** | ✅ |
| tour → openLookCard | Iter 4 RACE-B #2 收：`if (this.tour) this.endTour()` | ✅ |
| lookCard → startShow | `if (this.show \|\| ...)` 拦截 | ✅ |
| lookCard → toggleGallery | Iter 4 RACE-B #3 收：`if (this.lookCard) this.closeLookCard()` | ✅ |
| peel → toggleGallery | Iter 2 race A 早段 `clearPeel()` | ✅ |
| **turn → openLookCard** | **Iter 4 RACE-B #4 收：`if (this.turn) return false`** | ✅ |

**Iter 5 终审：state-guard 七问扫描矩阵 5 轮终态 100% 覆盖 / 0 个新 race 候选**。**5 轮状态机一致性走向**：Iter 2 修 race A → Iter 3 我没扫到 race B → Iter 4 一次性 4/4 candidate 清完 + 七问扫描矩阵模式归档 → Iter 5 维持。**这是 sprint 6 状态机一致性维度的完美收官**。

### 5.5 代码质量观察（5 轮终态）

**5 轮总 LOC 变化**：

| Iter 末 | magazineScene.js | preferences.js | render-config.js | deeplink.js | lookCard.js | pitfalls.md | project_structure.md | 单文件最大 |
|---|---|---|---|---|---|---|---|---|
| Iter 0（Sprint 6 起点） | ~4477 | ~64 | — | — | — | ~60 | ~80 | 4477 |
| Iter 1 | ~4610 | ~64 | — | — | — | ~88 | ~85 | 4610 |
| Iter 2 | ~4681 | ~83 | — | — | — | ~105 | ~88 | 4681 |
| Iter 3 | ~4731 | ~83 | ~117（新增）| ~95 | ~115 | ~129 | ~95 | 4731 |
| **Iter 4** | **4752** | **113** | **125** | 95 | 115 | **135** | 98 | **4752** |
| Iter 5（预期 Δ DOC-FOG-ROI 只动文档） | 4752 不变 | 113 不变 | 125 不变 | 95 | 115 | **+30 (Iter 4 三条新坑)** | +5（行号小校）| 4752 |

**5 轮 magazineScene.js 走向 4477 → 4752 = 净 +275 行**。但**抽出 render-config.js 后实际单文件瘦身？** —— **没有瘦身、净增 275 行**。原因细分：

- Iter 1 +133 行（VIS-LIGHT 7 大项联调 + 5 个真 bug 修 + 注释）；
- Iter 2 +71 行（VIS-SRGB-FIX 4 处 + RACE-A 四件套 + DISPOSE-SHARE-TIMER 1 行 + 注释）；
- Iter 3 +50 行（TECH-1 抽 render-config 本应让 magazineScene.js 瘦身 117 行，但 4 视觉项 + import 行 + 解释性注释抵消，净 +50；render-config.js 是另起的 117 行）；
- Iter 4 +21 行（RACE-B 3 处 1 行 guard + 解释性 docblock + 注释）；
- Iter 5 = 0（仅文档改）。

**回头看**：TECH-1 抽离的**真正收益不是 LOC 瘦身，而是回归面积压缩**（散落 17 处 → 1 个文件），Iter 4 TONEMAP-1 验证这条价值（只动 1 文件 × 2 字段）。**LOC 没瘦身但回归面积可控** = 工程现实里**比"硬瘦身"更稳定的结构性投入**。

**下个 Sprint 候选项**（5 轮收官回头看）：拆 `materials-config.js`（spineMaterial / coverEdge baseColor）+ `state-machine.js`（state/turn/show/tour/gallery/lookCard 状态机交叉表）—— 后者把 §5.4 的 state-guard 七问扫描矩阵从 pitfalls 文档级模式归档升到代码级显式抽象，让"加新 overlay 必须扫七问"从"靠 reviewer 记得"升到"加文件物理触发"。

### 5.6 性能（5 轮终态）

- **bundle**：925,180 bytes（gzip 251.43 kB），5 轮净 +1.2KB 控制极佳；
- **自适应画质**：Iter 1 BUG-QUALITY-STUCK 修后 5 轮稳定（升档分支重置 backoff + visibilitychange 防 rAF 暂停假信号）；
- **DoF**：Sprint 11 关 + Iter 4 BokehPass 仍挂在 composer 但 enabled=false，Iter 5 stretch 可选 `composer.removePass(bokehPass)` 1 行收尾（每帧省一点点 setup）；
- **阴影**：Iter 1 BUG-PEEL-SHADOW 修后 peel 阶段阴影正确刷新；shadowMap.type 5 轮稳定 PCFShadowMap=1；
- **rAF 主循环**：syncTourButton + syncMasthead 每帧调用，C9b 修后 lazy capture 自动跟新值、无回归；
- **加载性能**：Sprint 10 decode off main thread + Sprint 9 SSAA = Iter 1 ~ Iter 5 稳定。

**Iter 5 性能终审 = 健康**，无新瓶颈。

---

## Prioritized Recommendations（Iter 5 · 最终轮 · 收尾）

### 🔴 Critical（必做，最终轮收尾红线）

1. **DOC-FOG-ROI 接力**（Iter 4 漏的，纯 markdown，10-15 分钟可收）—— pitfalls.md 末尾追加 Iter 4 三条新坑章节 + TONEMAP-1 Stage 1 实测回填 + Stage 2 未启动说明；project_structure.md 顺手校（部分 Iter 4 引用还在 working tree、需 git add commit 否则永远未 tracked）；**Iter 5 唯一一个红线必做项**。

### 🟡 Important（视余量做，最终轮收尾打磨）

2. **Tier D 真机肉眼终审**（5 轮 PENDING、最终轮最后一次机会）—— 1280×800 settled-open 5 项定性校：(a) 封面红显著更深、更接近暗红书皮（A3 唯一 brand-new 收益）；(b) 纸高光"米黄色而非纯白"；(c) 阴影"有色而非死黑、有油墨湿润感"；(d) 走秀进/出 dim/restore 平滑、灯复位精确；(e) 立牌起立 + 鑑賞 + 卡片三层都不出现色彩偏移、纸质感不破。**Evaluator 必须做一次**——这是 5 轮"温暖印刷间"收益是否真兑现的唯一肉眼证据。
3. **BokehPass removePass**（4 轮 stretch 未做、最终轮收尾顺手）—— `composer.removePass(this.bokehPass)` 1 行 + dispose 内 `this.bokehPass.dispose()` 1 行收尾，每帧省一点点 setup。**风险极低**（Sprint 11 已 enabled=false 5 轮稳定，removePass 仅清死代码）。

### 🟢 Nice-to-have（视余量做，最终轮收尾打磨）

4. **visual-regression.md 骨架**（连续 5 轮 stretch 未做、最后一轮机会）—— 给 Iter 5 + 下个 Sprint 留一份 headless 像素直方图脚本骨架（bg.r×255 / avgLum / clipFrac / rim peak / brightFrac / darkFrac / bandMaxStep ROI = 远端固定区 6-7 项），从 Iter 4 §3.2 Tier B 6 项 + 体验 Iter 3 row80/row10 / centerAvgLum / band 跳变 / 桌面对称 / rim 亮带 实测过的断言里直接抽出来沉淀，不需要建独立 npm script、纯 markdown 记录 preview_eval one-liner 即可。
5. **VIS-TABLE-SYM Neutral 基线下二次观察**（Iter 4 stretch 留 Iter 5）—— Iter 3 视觉项落定 1.75:1 桌面对称比 Iter 3 验收门 1.4:1 还差 0.35；Iter 4 切 Neutral 后桌面色温感会变，**Iter 5 视余量在 Neutral 基线上重测一次**：若 ≤ 1.4:1 ✅；若仍 1.75:1 → 写死留下个 Sprint 跟拆 materials-config.js 一并做。

### 💡 Feature Idea（最终轮 · 不做 / 下个 Sprint 候选）

- **下个 Sprint 头号建议**：拆 magazineScene.js → 抽 `materials-config.js`（材质 baseColor）+ `state-machine.js`（状态机交叉表显式抽象，把 §5.4 七问矩阵从 pitfalls 文档级升到代码级）—— 5 轮 single-file 4752 行已是结构债天花板，下个 Sprint 不动这条线 Iter 1-5 的"加新功能 / 切 tonemap" 类似动作都会重新走 Iter 1 的"全文 grep 散落 17 处"老路。
- **下个 Sprint 第二建议**：音频层（5 轮 magazineScene.js 已留 startAudio / playSound 接线、public/audio/* 多数仍空缺，**真补音频素材是把"氛围装置"定位推到完美的最后一格**）—— 进化 Iter 3/4 反复点名"音频层是第 6 轮迭代头号 backlog"。
- **下个 Sprint 第三建议**：卡片 stage B（PNG 导出 + 二维码）—— 合同 5 轮写死不做、留下个 Sprint；技术风险（headless 验收不到图质量 + `toDataURL` 跨域污染）需真人/有设计环节兜底。

---

## 给 Planner 的取舍提示（**Iter 5 · 最终轮 · 收尾**）

> 体验 / 进化 / 研究 三方 Iter 5 报告写完后会有最终轮的具体清单，本段只给出 Evolution 视角的"应该做什么 / 不应该做什么 / 哪几条不能再议"。

**做这 5 项就够（最终轮收尾最小集）**：

1. **DOC-FOG-ROI**（🔴 Critical / 必做）—— Iter 4 漏的接力，10-15 分钟纯 markdown；pitfalls 追加 Iter 4 三条新坑 + TONEMAP-1 实测回填 + sanitizePatch 契约 + state-guard 七问矩阵；project_structure.md 顺手校 Iter 3/4 累计漂移 + **git add commit untracked 文件**（否则 working tree 永远停在未 tracked、跨 sprint 容易 git reset 丢失）；
2. **Tier D 真机肉眼终审**（🟡 Important / 强烈建议）—— Evaluator 必须真机审一次（5 轮 PENDING）；
3. **BokehPass removePass**（🟡 Important / 4 轮 stretch 收尾）—— 2 行修改 risk 极低；
4. **visual-regression.md 骨架**（🟢 Nice-to-have / 连续 5 轮 stretch 最后机会）—— 视余量；
5. **VIS-TABLE-SYM Neutral 基线观察**（🟢 Nice-to-have）—— 视余量；若仍 1.75:1 写死留下个 Sprint。

**这些不能做（5 轮红线 + 最终轮收尾基调）**：

- ❌ **不加新功能**（5 轮已收官，最终轮 · 不要新功能 / 新桌上赌注）；
- ❌ **不动 light.color hex** / **不动 fog.color** / **不动 fog.near/far** / **不动取景** / **不动 SSAA** / **不动几何架构**（红线 5 轮延续）；
- ❌ **不切其它 tonemap（AgX / 自写 LUT）**（Iter 4 Stage 1 PASS、Stage 2 fallback 工具箱状态保留即可）；
- ❌ **不动剩余 11 处匿名 setTimeout**（5 轮终审一致判定不值得清，§5.3 已论证）；
- ❌ **不抽 magazineScene.js 业务逻辑**（合同红线 5 轮延续、留下个 Sprint）；
- ❌ **不引 HDR exr / 不重开 DoF**（永久 backlog）；
- ❌ **不动 SPRINT.md 历史轮条目 / 不动 docs/orch/ 历史报告**（历史快照红线 5 轮延续）；
- ❌ **Iter 5 不允许再"试一档"做 TONEMAP-1 Stage 2 的预防性调参**（plan §527 写死、Iter 4 Stage 1 PASS 6/6 已禁止；Iter 5 是兜底轮不是再决策轮）。

**这几条不能再议（5 轮已写死，最终轮 reviewer 别重开）**：

- **音频层 / 卡片 stage B / 设置面板 / 远景墙 / 远景剪影 / 吊灯 / 灯光预设切换 / 视觉一键切换 / 时段感按钮 / 深链 codec 升维到 `?spread=N&item=M&look=X`** 全部留下个 Sprint，Iter 5 不重开；
- **拆 four.js 业务逻辑（拆 magazineScene.js 4752 行业务态机部分）**留下个 Sprint，Iter 5 不重开；
- **dispose 清剩余 11 处匿名 setTimeout** 5 轮终审判定不值得清，Iter 5 不重开。

---

## 5 轮 sprint 收尾观察（**用户要求段 · 最后一笔**）

> 这是产品策略师视角的"5 轮 sprint 收尾"——回头看 Sprint 6 是什么、最值得记住的是什么、给下个 Sprint 留什么。

### 第 6 轮是什么

**Sprint 6 起手命题极其模糊**："主要从代码层面还有视角效果方面检查代码漏洞并修复。现在的视觉效果很差。" —— 双线（代码 bug + 视觉调参）+ 主观词（"视觉效果很差"）+ 无具体 todo。**5 轮把这个模糊命题拆成了一个 22 步的可执行链路**：

```
Iter 1（大手术）           Iter 2（系统修）           Iter 3（结构性投入）        Iter 4（决策框架）           Iter 5（收尾沉淀）
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
VIS-LIGHT 7 大项联调       VIS-SRGB-FIX 4 处         TECH-1 抽 render-config     TONEMAP-1 两阶段方案       DOC-FOG-ROI 文档沉淀
BUG-QUALITY-STUCK         VIS-COVER-EDGE 1 处       VIS-RIM-BOOST 0.9→1.5       PREF-1 latent bug          Tier D 真机肉眼终审
BUG-GRAIN-RM              VIS-VIGNETTE-RIM 联调     VIS-TABLE-SYM 1.8→1.7       RACE-B 4 处候选清完          BokehPass removePass
BUG-PEEL-SHADOW           BUG-SHADOWMAP-DEPRECATED   VIS-FOG-FAR 7.5→9.0                                  visual-regression.md
BUG-TOC-TOGGLE            BUG-GALLERY-RACE-A         DOC-LINEMAP                                          VIS-TABLE-SYM Neutral 重观察
DOC-941                   BUG-DISPOSE-SHARE-TIMER                                                          5 轮整体观察
```

### 最值得记住的

**3 件最值得记住的事**：

1. **TECH-1 抽 render-config.js 的 ROI 全额兑现**（Iter 3 投入 → Iter 4 兑现）—— 17 联调点位散落 → 集中到 1 个文件 → Iter 4 TONEMAP-1 只动 2 字段 + bundle +30 bytes + magazineScene.js 0 字面量 delta。**这是 5 轮工程纪律最强的一笔**。
2. **TONEMAP-1 两阶段方案 + Stage 1 即 PASS**（Iter 4）—— 三方观点（Research A3 最小动作 / Experience 预防性降 / Evolution Tier 验收门）方向相反时不"选边站"而是"分阶段执行 + 红线触发器" → Stage 1 6/6 PASS 省下 Stage 2 → 决策框架完美闭环。**这是 5 轮决策框架质量最强的一笔**。
3. **state-guard 七问扫描矩阵从 race A 个例升到模式归档**（Iter 2 race A → Iter 3 我没扫到 → Iter 4 七问扫描矩阵 4/4 candidate 清完 + 模式归档）—— 把"修一个 race 是局部、扫一遍状态机交叉表是系统性" 沉淀进 pitfalls 模板。**这是 5 轮系统性修法纪律的代表**。

### 给下个 Sprint 留什么

**3 件下个 Sprint 应该接力的事**：

1. **拆 `materials-config.js` + `state-machine.js` 两个子模块**（下个 Sprint 头号）—— magazineScene.js 4752 行已是结构债天花板；TECH-1 抽 render-config 是"渲染基线层"、下个 Sprint 应继续抽"材质 baseColor 层" + "状态机交叉表层"，让"加新 overlay / 切 tonemap / 调材质"全部走可控回归面积路径；
2. **音频层落地**（下个 Sprint 第二头号 = "氛围装置"定位最后一格沉浸缺口）—— 编码侧 5 轮已就绪（startAudio / playSound / WebAudio 总线），public/audio/* 多数空缺纯卡素材；音频到位后凑够 ≥2 个无家偏好、设置面板届时才值得建（5 轮的"设置面板"被反复判为"空壳"原因正是无家偏好 < 2）；
3. **卡片 stage B（PNG 导出 + 二维码）**（下个 Sprint 第三头号 = 内容深度的"可传播"层最后一格）—— 5 轮合同写死不做、留下个 Sprint；技术风险（headless 验收不到图质量 + `toDataURL` 跨域污染 + 轻量纯函数二维码库防 bundle 膨胀）需真人/有设计环节兜底。

### 一句话收官

**Sprint 6 5 轮把"一本会动的暗调 demo"打磨成"一台自洽、有记忆、可分享、可导航、可阅读·可传播、视觉色相忠实、状态机一致、技术健康度 8.9/10 的纸艺 3D 装置"——5 轮渐进式 + 系统性修法占多数派 + 工程纪律级模式归档 + render-config 抽离 ROI 全额兑现 + TONEMAP-1 两阶段方案 Stage 1 PASS 是这个 sprint 的 4 个最高光时刻。**

---

## Iter 5 Tech Health 最终评分

**8.9/10**（Iter 4: 8.6/10 → +0.3 来自 render-config 红利 Iter 4 全额兑现 + PREF-1 latent bug 修 + RACE-B 4/4 candidate 清完 + state-guard 七问扫描矩阵模式归档 + Stage 1 PASS 决策框架完美闭环）。

**扣的 1.1 分**：
- magazineScene.js 4752 行单文件 = -0.5（合同红线写死不动、留下个 Sprint）；
- 11 处匿名 setTimeout 仍在虽已 5 轮终审判定不值得清 = -0.2（工程现实层面零可观察泄漏，但代码 hygiene 层面非完美）；
- DOC-FOG-ROI Iter 4 漏 / Iter 5 必须接力 = -0.2（最终轮可收）；
- Tier D 真机肉眼终审 5 轮 PENDING = -0.2（最终轮可补）。

**Iter 5 收尾后预期评分**：若 DOC-FOG-ROI 落定 + Tier D 真机审通过 + BokehPass removePass 顺手收 → **9.0/10**（接近 5 轮 sprint 单 sprint 技术健康度天花板）。
