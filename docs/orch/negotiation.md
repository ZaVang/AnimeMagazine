# Negotiation — 第 6 轮 / Iter 5（最终轮 · 收尾）三审报告逐条回应

> Planner 对 Experience Iter 5（8.7/10）+ Evolution Iter 5（Tech Health 8.9/10）+ Research Iter 5 三份审计 + Scout Iter 5 接地的逐条裁决。
> **本轮基调**：最终轮 · 收尾。三方收敛度 5 轮里最高、无残余分歧、Planner 无需任何技术裁决。Iter 4 已 deliver 90%+，Iter 5 只做 DOC-FOG-ROI 接力 + git add untracked + Tier D 真机审兜底。
> 红线：3D 氛围装置永久封禁拆 three.js / 最终轮 · 不要新功能 / Stage 2 不启动 / 取景 / DoF / VIS-TABLE-SYM 二调 / visual-regression.md 骨架 — **全部明确拒绝**（详见末段）。

---

## 总体框架：5 轮里三方收敛度最高的一次

5 轮里前 4 轮三方都至少在 1-2 项上方向相反（Iter 1 视觉调参组合 / Iter 2 sRGB 是否系统修 / Iter 3 是否本轮切 tonemap / Iter 4 exposure 与 envMap 方向），**Iter 5 是第一次（也是唯一一次）三方全部对齐**：

- **必做项**：DOC-FOG-ROI（三方一致 🔴 Critical / 必做） + git add untracked（三方一致 顺手收）+ Tier D 真机审（三方一致 🟡 Evaluator 责任）
- **不做项**：Stage 2 / 取景 / DoF / VIS-TABLE-SYM 二调 / visual-regression.md 骨架 / 新功能（三方一致拒绝）

Planner 不需要在两阶段方案 / exposure 方向 / 红线触发器 / 验收门拆分等任何技术问题上裁决——Iter 4 决策框架已完美闭环、Iter 5 只是兜底归档轮。

下面对三方逐项 🔴/🟡/🟢 回应。

---

## A. Experience Iter 5 逐条回应（8.7 / 10 入场）

### A.1 🔴 Critical：DOC-FOG-ROI（Iter 4 留下的纯文档接力）

**Planner 立场：完全接受 · 本轮 T1 主线**。Experience §🔴 "必做（一项）" 列了 7 个具体子项（fog band step ROI / sanitizePatch 契约 / state-guard 七问 / TONEMAP-1 Stage 1 实测沉淀 + Stage 2 未启动写明 / Iter 5 新沉淀 dev server stale-module / project_structure 行号校 +7~+21 / untracked 文件 git add）—— Planner 全部纳入 T1 任务描述。

落地路径：
- pitfalls.md 末尾追加 7 条同模式坑（含 Experience 列的 5 条 + Research 提的"深夜印刷间"隐喻统一 + Iter 4 Evaluator 发现的 NeutralToneMapping id=7 不是 6）
- project_structure.md 行号小校三段（3383~3683 +7 / 3735~4201 +7~+15 / 4419~4676 +21）
- git add untracked 顺手收（src/deeplink.js / src/lookCard.js / public/og-cover.png / docs/orch/ / docs/plans/ / docs/project_structure.md）
- 合并 DOC-FOG-ROI 一个 commit

### A.2 🟡 Important：VIS-TABLE-SYM 真根因修 = 下个 Sprint 头号

**Planner 立场：完全接受 · 本轮不做、下个 Sprint 接力**。Experience 论证非常清晰：1.83:1 桌面对称根因不在强度而在 poolLight SpotLight cone 中心 + keyLight 方向，属新调参不属"收尾"——超出最终轮边界。落地：本轮明确不做 ⑰（见 plan.md），留下个 Sprint 跟拆 materials-config.js / state-machine.js 一并做。

### A.3 🟢 Nice-to-have：全部跳过（BokehPass removePass / visual-regression.md 骨架 / 其它"打磨之上的打磨"）

**Planner 立场：完全接受 · 全部跳过**。Experience §🟢 已写"5 轮已收官，全部不做"——5 轮 stretch 累积未做信号已表明"低 ROI"，Planner 接受并写死 ⑱。

### A.4 💡 Feature Idea：音频层 / 卡片 stage B PNG 导出 + 二维码 / 全刊 look 全家福海报

**Planner 立场：永久 backlog · 本轮不做 · 下个 Sprint 决定**。Experience 自己也写"不进任何 Sprint backlog，已在 SPRINT.md 第 6 轮预告里写过"——Planner 延续。

---

## B. Evolution Iter 5 逐条回应（Tech Health 8.9 / 10 入场）

### B.1 🔴 Critical（必做，最终轮收尾红线）：DOC-FOG-ROI 接力

**Planner 立场：完全接受**（与 A.1 同口径）。Evolution 强调"git add commit untracked 文件，否则 working tree 内容跨 Sprint 容易 reset 丢失（这是 Iter 4 Evaluator 已亲指出的红线）"——这点 Planner 写进 T1 验收门第 4 项。

### B.2 🟡 Important（视余量做，最终轮收尾打磨）

**B.2.1 Tier D 真机肉眼终审（5 轮 PENDING、最终轮最后一次机会）**

**Planner 立场：完全接受 · 列为 T2 任务（Evaluator 责任，非 Generator 任务）**。Evolution 列了 5 项定性校（封面红显著更深 / 纸高光米黄色 / 阴影有色不死黑 / 走秀进/出 dim/restore 平滑灯复位精确 / 立牌起立 + 鑑賞 + 卡片三层不出色彩偏移）—— Planner 全部纳入 T2 验收范围。

**B.2.2 BokehPass removePass（4 轮 stretch 未做、最终轮收尾顺手）**

**Planner 立场：本轮不做**（与 Experience §🟢 + Research §1.2 stretch 弱共识对齐）。理由：① Scout D.1 表明这是"弱共识"项；② 让 DOC-FOG-ROI commit 保持"零代码接触面"更干净；③ BokehPass 已 Sprint 11 enabled=false 5 轮稳定、留挂着不影响渲染。

### B.3 🟢 Nice-to-have：visual-regression.md 骨架 / VIS-TABLE-SYM Neutral 重观察

**Planner 立场：全部跳过**。Evolution 自己也写"视余量做、不强求"——Planner 写死 ⑱（不做）。连续 5 轮 stretch 累积未做信号已表明"低 ROI"。VIS-TABLE-SYM 根因在光位置（Experience §🟡 已点明），Neutral 基线下重观察也无法不调位置就收敛——留下个 Sprint。

### B.4 💡 下个 Sprint 头号建议（拆 materials-config.js + state-machine.js / 音频层 / 卡片 stage B）

**Planner 立场：完全接受 · 写入 plan.md §5 轮 Sprint 收尾观察 §C TOP 3 候选**。这是 Evolution 最有价值的 5 轮收尾贡献——把 TECH-1 的"抽离换可控回归面积"范式推广为下个 Sprint 头号。

### B.5 5 轮 sprint 整体观察（用户要求段）

**Planner 立场：致谢 + 全部纳入 plan.md §5 轮 Sprint 收尾观察**。Evolution 给的"5 轮 bug 修复总账 13 个 / 系统性 vs 局部 8:5 / TECH-1 ROI 二次回报模板 / state-guard 七问扫描矩阵模式归档"是 5 轮里最有沉淀价值的整体反思，已 1:1 翻译进 plan.md §D"5 轮最值得记住的 3 件事"。

---

## C. Research Iter 5 逐条回应

### C.1 🔴 本轮必做（最终轮收口动作）

**C.1.1 DOC-FOG-ROI 接力** —— **Planner 立场：完全接受**（与 A.1 + B.1 同口径，三方一致 🔴）。

**C.1.2 真机 Tier D 终审** —— **Planner 立场：完全接受 · 列为 T2 任务**（与 B.2.1 同口径）。Research 强调"A3 三项 raison d'être 唯一定性校时机"是头号语义判定。

**C.1.3 隐喻措辞统一为"深夜印刷间"** —— **Planner 立场：完全接受 · 纳入 T1 子项 3**。Research §1.5 论证非常清晰：bg=0x18130e（暖暗）+ Neutral 保色 + rim 1.5 暖描边 = 标准夜场印刷工作室，"晨光"措辞需要冷白窗光 + 更高 fill 等物理结构与现状不符。落地：扫 `docs/plans/` + `docs/project_structure.md` + `docs/FUTURE.md`（**不动 docs/orch/ 历史报告 + SPRINT.md 历史轮条目**——历史快照红线）。

### C.2 🟡 本轮顺手（视余量）

**C.2.1 BokehPass.removePass** —— **Planner 立场：本轮不做**（与 A.3 + B.2.2 同口径，弱共识不做）。

**C.2.2 VIS-TABLE-SYM 二次观察** —— **Planner 立场：本轮不做**（与 A.2 同口径）。Research 自己也写"与 tonemap 切换耦合本轮在 Neutral 基线上重新观察、再决定收不收"，但 Experience §🟡 + Evolution §B.3 都已指明根因在光位置不在 tonemap，**Neutral 下重观察也不会自发收敛**。留下个 Sprint。

**C.2.3 visual-regression.md 沉淀** —— **Planner 立场：本轮不做**（与 A.3 + B.3 同口径，连续 5 轮 stretch 累积低 ROI）。

**C.2.4 RACE-B #1（show→openLookCard）** —— **Planner 立场：本轮无需重做**。Research 自己也写"Iter 4 PARTIAL 时已被 Generator 顺手收（commit `56aa7cb` 实测含此 guard）"，Evaluator 已反测确认。

**C.2.5 Iter 4 Stage 2 未启动状态确认** —— **Planner 立场：完全接受 · 纳入 T2 Evaluator 复跑 Tier A 12 项**。

### C.3 🟡 高影响 / 高工作量（下个 Sprint backlog）

**C.3.1 取景重做** + **C.3.2 音频层** + **C.3.3 抽 magazineScene.js 业务层** —— **Planner 立场：完全接受 · 全部留下个 Sprint**。已写入 plan.md §C TOP 3 候选。

### C.4 🟢 有价值但不紧急（HemisphereLight 窗光 / 灯光预设切换器 / tonemap per-spread / CSS token 抽离）

**Planner 立场：全部下个 Sprint 候选、本轮不动**。最终轮 · 不要新功能红线延续。

### C.5 💡 Wild idea（深链 codec 升维 / 杂志变身档案柜）

**Planner 立场：永久 backlog**。两条都是"重启世界观"级别的新方向，最终轮 · 不要新方向红线写死。

### C.6 5 轮 sprint 设计研究反思（一句话总结）

**Planner 立场：致谢 + 全部纳入 plan.md 收尾观察**。Research 的"5 轮路径 = 假设逐层剥离的洁净轨迹"判定是这本"会动的 3D 数字时尚杂志"5 轮升格为"有 taste 的 3D 装置作品"的核心评价。已 1:1 翻译进 plan.md §A"用户主诉两端均实质解决"。

---

## D. 明确拒绝（5 轮已写死 · 三方共识 · 最终轮不再 revisit）

| 拒绝项 | 三方共识理由 | 状态 |
|---|---|---|
| **❌ TONEMAP-1 Stage 2 fallback 启动** | **三方一致拒绝** — Stage 1 Tier B 6/6 PASS（avgLum 119.4 / clipFrac 0% / rim peak 69.5 远低于 248 / brightFrac 19.7% / darkFrac 0.058% / bg.r×255=24）；plan §527 写死"若阶段 1 PASS 6/6 禁止启动 Stage 2"；rim 1.5→1.2 会吞掉 Iter 3 才刚抬起来的立牌背面金边、envMap 9 桶 ×0.85 会让纸面读作"哑光纸"丢失印刷品光泽 —— Stage 2 fallback 留 backlog 工具箱状态、不预防性触发是"工程克制"红线。**留下个 Sprint：永久 backlog（如未来出现真破红线场景再启动）**。 | 🔴 永久红线 |
| **❌ 取景 40° no-man's land 重做** | **三方一致拒绝** — Research §1.1 反复立场摇摆 5 轮终判"永久不动 · 下个 Sprint 独立头号"；Evolution / Experience 5 轮一致延续；取景需 cameraStart/Open/Closed/portrait 4 处重校 + portraitFovGain/pullZ/Y/recenter 参数体系联调 + 375px 移动端 Sprint 12 两条红线重新验收 —— 这是单独 Sprint 的事，5 轮收尾轮无余量。**留下个 Sprint：独立头号 backlog（配 Sprint 7+11 同等级别规划）**。 | 🔴 永久红线 |
| **❌ DoF 重开** | **三方一致拒绝** — Sprint 11 决策 + Research §1.2 永久判定 + Evolution Iter 3/4/5 反复点名"941×1672 素材天花板下 DPR=3 已贴上限、DoF 重开 perf 风险大于美学收益、fog.far 已替代 DoF 远端柔化"；BokehPass 仍挂在 composer enabled=false 也是 5 轮稳定 — **永久 backlog**。 | 🔴 永久红线 |
| **❌ VIS-TABLE-SYM 二次追**（1.83:1 → ≤1.4:1）| **三方收敛拒绝本轮做** — 根因不在强度而在 **poolLight SpotLight cone 中心 + keyLight 方向**（Iter 3 hemi 0.95 + pool x=-1.1→-0.6 后仍 1.83:1 已证伪"调强度可收"假设）；属新调参不属"收尾"边界。**留下个 Sprint：跟拆 materials-config.js / state-machine.js 一并做**。 | 🟡 下个 Sprint |
| **❌ visual-regression.md 骨架沉淀** | **弱共识 + 累积低 ROI 信号** — 连续 5 轮 stretch 未做、5 轮 Evaluator 都用了 ad-hoc preview_eval 跑通 Tier A/B/C 验收，再建抽象层意义不大；下个 Sprint 有 reviewer/evaluator 实际接手时再建。 | 🟢 下下个 Sprint 视需求 |
| **❌ 新功能 / 新方向 / 新桌上赌注** | **三方一致 5 轮已写死红线** — 远景墙 / 远景剪影 / 吊灯 / HDR exr / AgX / 风格化 V2 / 灯光预设切换器 / 设置面板 / 音频层 / 卡片 stage B PNG 导出 / 二维码 / 时段感"夜深一档"按钮 / 深链 codec 升维到 `?spread=N&item=M&look=X&time=T` / 杂志变身档案柜 —— 全部留下个 Sprint 候选。 | 🔴 永久红线（本 sprint 内） |
| **❌ 拆 magazineScene.js 业务逻辑** | **5 轮合同红线** — 4752 行单文件已是结构债天花板；TECH-1（Iter 3）抽 render-config 是"渲染基线层"，业务层（landOnSpread / openLookCard / toggleGallery / startShow / applyDeepLink 等）拆离需独立 Sprint 规划与抽离边界判定。**留下个 Sprint：头号建议（materials-config.js + state-machine.js）**。 | 🟡 下个 Sprint |
| **❌ 动 light.color hex** | **5 轮永久红线 ② 延续** — Iter 2 反复点名"不动 light.color"物理路径 + Research Iter 4/5 否决"Neutral 下色相还原好、去暖反让'印刷间'读作'医院'" + render-config.js:11-28 顶部红线注释三重把关。 | 🔴 永久红线 |
| **❌ 动 fog.color / fog.near / fog.far / 不脱钩 bg** | **5 轮永久判定** — Research Phase 1.3 论证"深夜印刷间"隐喻下 fog 与 bg 同 0x18130e 是写实的，脱钩会破坏单一氛围。 | 🔴 永久红线 |
| **❌ 动 SSAA / 几何架构 / 取景 / 光位置 / SpotLight 物理参数 / RoomEnvironment 替换** | **5 轮永久红线延续**。 | 🔴 永久红线 |
| **❌ 动剩余 11 处匿名 setTimeout** | **5 轮终审一致** — Evolution Iter 3/4/5 三轮终审判定"已 guard + detached node no-op、不值得清"——本轮不再回归讨论。 | 🔴 永久 |
| **❌ 动 SPRINT.md 历史轮条目 / docs/orch/ 历史报告** | **5 轮历史快照红线延续**。 | 🔴 永久 |
| **❌ 重新论证拆 three.js** | **永久红线 keep-three.js**。 | 🔴 永久 |

---

## E. 5 轮 Sprint 收尾自审（Planner 视角 · 回应用户主诉）

> 用户原话（Sprint 6 起手）：**"主要从代码层面还有视角效果方面检查代码漏洞并修复。现在的视觉效果很差。"**
>
> 这是双线主诉（代码 bug + 视觉调参）+ 主观词（"视觉效果很差"）+ 无具体 todo —— **5 轮把这个模糊命题拆成了一个 22 步的可执行链路**。

### E.1 用户主诉是否被解决（诚实自审）

**答**：两端均实质解决。

| 主诉端 | 5 轮收尾终态判定 | 证据 |
|---|---|---|
| **"代码层面 bug"** | ✅ 完全解决 | 9 个 Critical bug（BUG-QUALITY-STUCK / BUG-GRAIN-RM / BUG-PEEL-SHADOW / BUG-TOC-TOGGLE / BUG-SHADOWMAP-DEPRECATED / BUG-GALLERY-RACE-A / BUG-DISPOSE-SHARE-TIMER / PREF-1 / RACE-B-4/4）全部 commit；console fresh load 0 error 0 warn；build PASS；dispose 无悬挂 timer 无 listener 泄漏；race B 七问扫描矩阵 4/4 candidate 清完（含 stretch RACE-B-#1 Iter 4 顺手收） |
| **"视觉效果很差"** | ✅ 基本解决（不是完美） | avgLum 70.6→119.23（+69%）/ darkFrac 38.9%→0.025% / bg.r×255 ≈ 2→24（双转吞色解）/ 顶部 sky band r×255 ≈ 2→74-81（死黑消失）/ tonemap ACES→Neutral 保色相 / paper L 200/202 暖纸不爆 / clipFrac 0% / rim peak < 248；视觉评分轨迹 6.5→7.0→8.0→8.5→8.7 ；"很差"判定不再适用、剩"很好但不是完美"细节 |

### E.2 还差什么（5 项 + 1 个边界）

1. **桌面左右不对称 1:1.83**（VIS-TABLE-SYM 目标 ≤1.4:1）—— 根因不在强度而在光位置 / 下个 Sprint
2. **941×1672 素材天花板**（封面 ATELIER "A" 被切）—— 治本需重出素材属设计环节 / 永久 backlog
3. **取景 40° no-man's land** —— Research 5 轮反复识别但 5 轮均无余量 / 下个 Sprint 独立头号
4. **音频层**（编码侧就绪、素材空缺）—— 氛围装置定位最后一格沉浸缺口 / 下个 Sprint 第二头号
5. **拆 magazineScene.js 业务逻辑**（4752 行）—— Iter 3 已抽渲染基线层、业务层留下 Sprint / 下个 Sprint 第三头号
6. **边界（非 todo）**：3D 装置定位本身的天花板（无搜索 / 无评论 / 无社交评论流 / 无内容流推荐）—— 这些**不是"差什么"而是"定位不要什么"**，5 轮已写死、合同明确

### E.3 下个 Sprint 该挖什么（三方收敛接力清单）

**TOP 3 头号候选**（按对"从 A 升 S 的贡献度"）：

1. **拆 materials-config.js + state-machine.js 两个子模块**（结构性投入二次回报模板推广）—— Evolution + Experience + Research 三方一致
2. **音频层落地**（"氛围装置"定位最后一格）—— Evolution / Research 一致点名"下个 Sprint 头号"
3. **取景重做（37.6° → 50° 戏剧 3/4 或 60° reader POV）**（配 Sprint 7+11 同等级别规划）—— Research §1.1 5 轮反复识别、5 轮均无余量

**进阶视觉候选**（下下个 Sprint 或之后）：HDR exr 环境贴图 / per-spread tonemap / 远景墙 / 远景剪影 / 吊灯 / 卡片 PNG 导出 + 二维码（CARD stage B）/ HemisphereLight 窗光 / 时段感按钮 / 深链 codec 升维到 `?spread=N&item=M&look=X&time=T`。

### E.4 5 轮 Sprint 一句话收官

**Sprint 6 5 轮把"一本会动的暗调 demo"打磨成"一台自洽、有记忆、可分享、可导航、可阅读·可传播、视觉色相忠实、状态机一致、技术健康度 8.9/10 的纸艺 3D 装置"**——5 轮渐进式 + 系统性修法占多数派（8:5）+ 工程纪律级模式归档 + render-config 抽离 ROI 全额兑现 + TONEMAP-1 两阶段方案 Stage 1 PASS 是这个 sprint 的 4 个最高光时刻。**用户主诉两端均实质解决、终态评分 8.7/10、Tech Health 8.9/10，可以收官**。

### E.5 给 Sprint 7 接力者的一句话

**Sprint 6 5 轮收官 = 视觉地基已稳 + 状态机交叉表已扫齐 + 知识库已沉淀**；Sprint 7 该挖的是 **"地基之上的建筑"**——拆 materials-config.js + state-machine.js 把渲染基线层 ROI 推广到材质 + 状态机层 / 音频层把氛围装置最后一格补上 / 取景重做让"温暖印刷间"语义升格为"戏剧 3/4 / reader POV"。三件事择一头号即可，不要再起多线程并行。
