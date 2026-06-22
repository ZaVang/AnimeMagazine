# Plan — 第 6 轮 / Iter 5（最终轮 · 收尾）

> Planner：product-loop sprint planner（Iter 5/5、最终轮 · 收尾）
> 本轮主线：**DOC-FOG-ROI 接力 + git add untracked 顺手收 + Tier D 真机审（Evaluator 侧）= 5 轮 Sprint 收官**
> 红线延续：3D 氛围装置永久封禁拆 three.js / 最终轮 · 不要新功能 · 不要新方向 · 不要新调参 / Stage 2 不启动（Iter 4 Stage 1 6/6 PASS 后 plan §527 写死）

---

## 三方收敛点（Iter 5 三审 + Scout 全部一致）

| 议题 | Experience（8.7/10）| Evolution（Tech Health 8.9/10）| Research | Scout | 共识 |
|---|---|---|---|---|---|
| **DOC-FOG-ROI 必做** | ✅ "✅ 本轮必做（一项）" | ✅ "🔴 Critical（必做，最终轮收尾红线）" | ✅ "🟡 接力 必做" | ✅ A.1 "必做" | **🟢 收敛** |
| **git add untracked 顺手收** | ✅ §🟢 顺手项 | ✅ "untracked 是收尾杀手" | ✅ §"DOC-FOG-ROI 时把 untracked 处理掉" | ✅ A.2 接地明细 | **🟢 收敛**（合并到 DOC-FOG-ROI commit） |
| **Tier D 真机审 = Evaluator 责任** | ✅（"5 轮 PENDING、Iter 5 必做"）| ✅ "🟡 Important / 强烈建议" | ✅ "🟡 收口 必做" | ✅ "Evaluator 责任、Generator 不做" | **🟢 收敛**（验收任务非 Generator 任务） |
| **TONEMAP-1 Stage 2 不启动** | ✅ "工程克制红线" | ✅ "Stage 2 fallback 按需触发约束" | ✅ "🔴 红线 6/6 PASS 禁止启动" | ✅ A.3 表 1 | **🟢 强收敛 · 永久** |
| **取景 40° 不动** | ✅（5 轮一致延续）| ✅（同延续）| ✅ "🔴 红线 永久判定 → 下个 Sprint 独立头号" | ✅ A.3 表 2 | **🟢 强收敛 · 下个 Sprint 接力** |
| **DoF 重开不做** | ✅ | ✅ | ✅ "🔴 红线 永久判定" | ✅ A.3 表 3 | **🟢 强收敛 · 永久 backlog** |
| **VIS-TABLE-SYM 二次追不做** | ✅（"Important 下个 Sprint 头号、根因在光位置不在强度"） | ✅（留下 Sprint）| 不直接表态 | ✅ A.3 表 4 | **🟢 收敛 · 下个 Sprint 候选** |
| **visual-regression.md 骨架不做** | ✅（连续 5 轮 stretch 未做、低 ROI）| ✅（stretch）| 弱建议顺手做 | ✅ A.3 表 5 | **🟢 收敛 · 不做**（5 轮 stretch 累积低 ROI 信号、下个 Sprint 有 reviewer 接手时再建） |
| **BokehPass removePass** | ⚪ 可清死代码 | ⚪ stretch | ⚪ "如顺手可收、不强求" | ⚪ 不强求 | **弱共识 · 本轮不做**（Stage 2 已不做、DoF 永久 backlog、留挂着的 enabled=false 不影响渲染 / 不让 DOC-FOG-ROI commit 多触一个 src/* 文件） |
| **RACE-B-#1 顺手收** | — | — | — | Iter 4 末 Generator 已顺手收（`if (this.show) return false`、commit `56aa7cb`）| **🟢 已收 / 本轮无新增** |

**残余分歧**：0 项。这是 5 轮里"三方收敛度最高的一次"——最终轮 · 收尾基调 + Iter 4 已 deliver 90%+，无需 Planner 在任何技术分歧上裁决。

---

## 本轮任务（Generator）

### T1（🔴 Critical · 必做）DOC-FOG-ROI：5 轮收尾文档接力 + git add untracked（合并一 commit）

**WHAT**（不写 HOW、只写期望产物）：
1. **`docs/plans/pitfalls.md` 末尾追加新章节**「## 渲染 / 画质 + 状态机 + 文档卫生（第 6 轮迭代 / Iter 4 + Iter 5 新增）」，至少含三条同模式坑沉淀（措辞参考 scout.md B.1）：
   - **Pitfall ①：fog band step 验收口径必须 ROI 在远端固定区**（VIS-FOG-FAR 验收口径同模式坑、Iter 4 暴露——任何 fog 远端衰减验收 ROI 必须**固定在远端单一材质区**，不能跨杂志/桌面/背景三材质交界。bandMaxStep / 桌面对称比 / 顶部 dark band 等都可能踩同样的坑）
   - **Pitfall ②：savePreferences patch 必须 per-field validate 再 merge**（PREF-1 同模式坑、Iter 4 latent bug 修——任何 merge partial update over current 的 API 必须 patch 级 sanitize，blob 级 sanitize 不能替代）
   - **Pitfall ③：state-guard 七问扫描矩阵**（RACE-B 同模式坑、Iter 4 race B 七问归档——七状态 state/turn/show/tour/gallery/lookCard/peel 之间任何新加 overlay 或入口必须扫一遍跨状态 guard）
   - **Pitfall ④（回填）：TONEMAP-1 两阶段方案实际落定 = Stage 1 即 PASS、Stage 2 fallback 未触发**（Iter 4 commit `7c08edb` 实测数据沉淀、给下个 Sprint 类似 colorspace/tonemap 切换路径参考。Tier B 6/6 实测：`avgLum/256` 0.467 / `clipFrac` 0% / rim 顶部 peak < 248 / `brightFrac` 19.7% / `darkFrac` 0.058% / `bg.r×255` 24；TECH-1 红利二次回报、最小动作 + 严验收门 + Tier A/B/C/D 拆分作为复用模板）
   - **Pitfall ⑤（Iter 5 新沉淀，Scout 提议）：dev server stale-module 警告**——`location.reload()` 才能加载新 commit 后的 src/*，下个 Sprint Evaluator 复验前必读
   - **Pitfall ⑥（Iter 5 新沉淀，Research 提议）：隐喻措辞统一为"深夜印刷间"**——bg=0x18130e（暖暗）+ Neutral 保色 + rim 1.5 暖描边 = 标准夜场印刷工作室，不是"晨光"（晨光会要求更高 avgLum、冷白窗光、更高 fill）
   - **Pitfall ⑦（Iter 5 新沉淀，Iter 4 Evaluator 发现）：NeutralToneMapping 常量值 id=7 不是 6**（三方文档均误写 6、源码常量正确；下个 Sprint 引用 tonemap 常量时按 `THREE.NeutralToneMapping` 引用、不要写死数字）

2. **`docs/project_structure.md` 行号小校 + 顺手澄清**（Scout B.2 实测漂移大于 prompt 估的 5 行、实测漂移 +7 ~ +21）：
   - 把表格"行号"列里 **3383 ~ 3683 全段 +7**（createHud 体内累计 +7）
   - 把 **3735 ~ 4201 全段 +7 ~ +15**（openLookCard 段 +7、renderLookCard 起 +15）
   - 把 **4419 ~ 4676 全段 +21**（toggleGallery 体内 + dispose 累计）
   - `src/magazineScene.js` 行数说明"~4752 行" **保持不变**（实测准确）
   - `src/preferences.js` 113 行、`src/render-config.js` 125 行 **保持不变**（已准确）
   - 行号地图段标题下加一句澄清注释："行号锚定**函数 def 行**，不锚定函数体内首行 RENDER 引用。Iter 3 Evaluator §10 曾把函数体内首行误当 def 引发'+10 ~ +20 漂移'假报警，本轮已澄清。"

3. **顺手统一隐喻措辞为"深夜印刷间"**：扫 `docs/plans/pitfalls.md` / `docs/FUTURE.md` / `docs/project_structure.md` 内"晨光印刷间"或"晨光"字眼，统一改为"深夜印刷间"或"温暖印刷间"（A3 落定后 Research Iter 4/5 终审隐喻收口）。**注意**：SPRINT.md 历史轮条目与 docs/orch/ 历史报告**不动**（历史快照红线 5 轮延续）。

4. **git add untracked 顺手收**（Scout A.2 接地明细 + E.2 5 轮欠债补 catch）：合并到 DOC-FOG-ROI 同一 commit 内，分批 add 避免一次塞太多触发 hook 卡顿：
   - **纯源代码**（5 轮以来 contract 漂移，`git log` 返 0 行）：`src/deeplink.js` + `src/lookCard.js`（Sprint 5 CARD-1 + CODEC-1 落定时漏 add、本任务还要 import 它们才能 build PASS）
   - **构建必需资源**：`public/og-cover.png`（Sprint 4 H1 落定的 OG 图，未 add 部署时会丢、是 5 轮里隐藏 contract 漂移最大的一个）
   - **文档树**：`docs/orch/`（6 轮 reviewer/scout/plan/negotiation/gen_status/eval 全部 untracked）+ `docs/plans/`（SPRINT.md + pitfalls.md + negotiation.md）+ `docs/project_structure.md`
   - **不 add 留给用户决策**：`.claude/launch.json`（环境配置）+ `.gitignore`（已 modified、本轮不动）
   - **已 modified 文件不 add**（本任务不动）：`docs/FUTURE.md` / `index.html` / `package-lock.json` / `src/styles.css`（除非顺手统一"晨光→深夜印刷间"措辞触碰 FUTURE.md、视情况一并 add）

**WHY**：
- 5 轮 reviewer + Scout 体系**没有漏掉任何代码层面的功能 bug**（Scout E.2 确认）；剩下的 3 个未追踪文件是 **git contract 漂移**而非代码 bug——Sprint 4/5 落定时合同写"落地 + commit"但实际只落地未 commit，最终轮顺手收是 5 轮欠债清理的诚实归档。
- DOC-FOG-ROI 是 Iter 4 Generator subagent 死亡前已设计好的纯文档任务，三方一致判 "🔴 必做"，是 5 轮里**最不需要 Planner 裁决**的一项——不做会让 5 轮 sprint 留下文档漂移尾巴。
- pitfalls.md 末追加 7 条同模式坑（fog ROI / sanitizePatch / state-guard 七问 / TONEMAP-1 两阶段实测 / dev server stale / 隐喻统一 / Neutral 常量 id=7）是把 Iter 4-5 三方独立点名的同模式坑沉淀进知识库，给下个 Sprint 接力者一份完整地图。
- "深夜印刷间"隐喻统一是 A3 落定后设计哲学的收口——bg + fog + rim + Neutral 物理结构与"夜场印刷工作室"语义一致，"晨光"措辞需要冷白窗光 + 更高 fill 等物理结构，与现状不符。

**验收**（Generator 自验、Evaluator 复验）：
1. `npm run build` PASS（顺手 git add `src/deeplink.js` + `src/lookCard.js` 后，build 不应因 `import` 链未 tracked 而异常——本来也没异常，因 vite 走 fs 不走 git；但 `npm run build` PASS 是"DOC-FOG-ROI 没误改 src/* 触发 build 回归"的兜底验收）
2. `docs/plans/pitfalls.md` 末尾出现新章节（行数从 135 → 165~185 行左右），至少 5 条同模式坑可读 + Pitfall ④含 TONEMAP-1 Stage 1 实测数据 + Pitfall ⑥隐喻收口
3. `docs/project_structure.md` 行号校正三段（3383~3683 / 3735~4201 / 4419~4676）已应用 + 顶部澄清注释已加
4. `git status` 显示：`docs/orch/` + `docs/plans/` + `docs/project_structure.md` + `public/og-cover.png` + `src/deeplink.js` + `src/lookCard.js` 全部从 `??` 转为 `A`（已 staged）或已 commit
5. 顺手 grep "晨光" 应在 `docs/plans/` + `docs/project_structure.md` + `docs/FUTURE.md` 里 0 命中（或所有命中都已替换）；`docs/orch/` 历史报告与 SPRINT.md 历史轮条目不动
6. **零代码接触面**：`src/magazineScene.js` / `src/render-config.js` / `src/preferences.js` / `index.html` / `src/styles.css` / `src/main.jsx` / `src/App.jsx` **0 行 delta**（视觉与运行期完全不变；DOC-FOG-ROI 是纯文档任务）

**来源**：Iter 4 SPRINT.md `DOC-FOG-ROI` 任务 + Iter 4 eval.md:158 + Iter 5 Experience §🔴 + Iter 5 Evolution §🔴 + Iter 5 Research §🔴 + Scout A.1 + A.2 + B.1 + B.2 + E.2。

---

### T2（验收任务 · Evaluator 责任，非 Generator 任务）Tier D 真机肉眼终审

**WHAT**（Evaluator 在 Iter 5 收尾阶段做，Generator 不做）：
- 1280×800 + 375×812 双断点 settled-open 真机肉眼定性校五项：
  1. **封面红显著更深、更接近暗红书皮**（A3 唯一 brand-new 收益、headless 像素直方图测不出来）
  2. **纸高光"米黄色而非纯白"**（Neutral 不卷尾的色温头量、headless rim peak 69.5 反向证明但无法直接抽 hue）
  3. **阴影"有色而非死黑、有油墨湿润感"**（Neutral 不压暗影到 0、darkFrac 0.058% 反向证明但无法直接抽色相）
  4. **走秀 startShow→endShow dim/restore 平滑**、灯复位精确（5 灯/env/vignette 1e-3 内一致）
  5. **立牌起立 + 鑑賞 + 卡片三层一致性**（无色彩偏移、纸质感不破）
- 顺手复跑 Tier A 12 项确认 Stage 2 未启动（rim=1.5 / env=0.55 / exposure=1.18 / envMap 9 桶 Iter 3 末值）

**WHY**：A3 三项 raison d'être 是 5 轮"温暖印刷间→深夜印刷间"收益是否真兑现的**唯一肉眼证据**——Tier B 6/6 PASS 是必要不充分条件，必须真机审兜底。Evaluator 不只跑 headless，**真机肉眼定性校是头号任务**。

**验收**：Evaluator 在 Iter 5 eval.md 记录五项肉眼判定（PASS / FAIL / N/A），破任一项 → 给 Planner 触发 Iter 6 决策（但 Iter 5 是最终轮、5 轮已收官，破亦不再追加 sprint）。

**来源**：Iter 4 plan.md TONEMAP-1 §Tier D + Iter 5 Experience §🟡 + Iter 5 Evolution §🟡 + Iter 5 Research §🔴。

---

## 本轮不做（最终轮 · 写死避免下轮再议）

> 与 Iter 4 SPRINT.md 末尾"本轮明确不做"段 ①~⑭ 全部延续，本轮再加 ⑮~⑱：

| 编号 | 不做项 | 三方共识理由 |
|---|---|---|
| **⑮** | **TONEMAP-1 Stage 2 fallback 不启动** | Iter 4 Stage 1 6/6 PASS（avgLum 119.4 / clipFrac 0% / rim peak 69.5）；按 plan §527 "若阶段 1 PASS 6/6 禁止启动 Stage 2"；做了反破坏 A3 兑现度（rim 1.5→1.2 会吞掉 Iter 3 才刚抬起来的立牌背面金边）。Stage 2 工具箱状态保留——这是"工程克制红线"。 |
| **⑯** | **取景 40° no-man's land 不动** | Research §1.1 永久判定：取景需 cameraStart/Open/Closed/portrait 4 处重校 + 移动端 Sprint 12 两条红线重新验收，是单独 Sprint 的事。5 轮 5 iter 均不动是对的——下个 Sprint 独立头号。 |
| **⑰** | **VIS-TABLE-SYM 二调不做** | Iter 3 hemi 0.95 + pool x=-1.1→-0.6 后实测仍 1.83:1；根因不在强度而在 **poolLight SpotLight cone 中心仍偏左 + keyLight 方向**——属新调参不属"收尾"。留下个 Sprint 跟拆 materials-config.js / state-machine.js 一并做。 |
| **⑱** | **visual-regression.md 骨架不做 / BokehPass removePass 不做 / RACE-B-#1 不再补** | 连续 4-5 轮 stretch 累积未做信号已表明"低 ROI"——5 轮 Evaluator 都用了 ad-hoc preview_eval 跑通了 Tier A/B/C 验收，再建抽象层意义不大；BokehPass 已 Sprint 11 enabled=false 5 轮稳定、留挂着不影响渲染，最终轮收尾不让 DOC-FOG-ROI commit 多触 src/* 文件；RACE-B-#1 Iter 4 Generator 已顺手收（commit `56aa7cb` 头部含 `if (this.show) return false`、Evaluator 已验、无需重做）。 |

**永久红线延续**（Iter 1-4 已写死、最终轮再次延续）：
- ❌ 不动 light.color hex / 不动 fog.color / 不动 fog.near 或 far / 不动取景 / 不动 SSAA / 不动几何架构 / 不动 light.position / SpotLight 物理参数 / RoomEnvironment 替换
- ❌ 不切其它 tonemap（AgX / 自写 LUT）/ 不引 HDR exr
- ❌ 不动剩余 11 处匿名 setTimeout（Evolution Iter 3/4/5 三轮终审一致判定不值得清）
- ❌ 不抽 magazineScene.js 业务逻辑（留下个 Sprint：materials-config.js + state-machine.js 两个子模块候选）
- ❌ 不动 SPRINT.md 历史轮条目 / 不动 docs/orch/ 历史报告（历史快照红线）
- ❌ 不加任何新功能 / 新方向 / 新桌上赌注（远景墙 / 吊灯 / HDR / AgX / 风格化 V2 / 灯光预设切换器 / 设置面板 / 音频层 / 卡片 stage B PNG 导出 / 二维码 / 时段感按钮 / 深链 codec 升维到 `?spread=N&item=M&look=X&time=T`——全部下个 Sprint 候选）
- ❌ 不重新论证拆 three.js（永久红线 keep-three.js）

---

## 5 轮 Sprint 收尾观察（Planner 视角 · 最终一笔）

> 这是 Planner 对 5 轮 sprint "从模糊主诉到收官"的整体观察，回应用户主诉"代码 bug + 视觉效果差"。

### A. 用户主诉两端均实质解决

| 主诉端 | Iter 0 基线 | Iter 5 终态 | 判定 |
|---|---|---|---|
| **"代码层面 bug"** | 三审收敛 9 个 Critical bug 未修 + 11 处匿名 setTimeout 风险 + 7 大项视觉调参 | 9 个 Critical bug 全部 commit + console fresh load 0 error 0 warn + race B 七问扫描矩阵 4/4 candidate 清完 + state-guard 模式归档 + sanitizePatch field-level merge 契约修复 | **✓ 完全解决** |
| **"视觉效果很差"** | avgLum 70.6/256 / darkFrac 38.9% / bg.r×255 ≈ 2（双转吞色）/ 顶部死黑（r×255 ≈ 2）/ tonemap=ACES S 曲线压色相 | avgLum 119.23 / darkFrac 0.025% / bg.r×255=24 / 顶部 sky band r×255=74-81 / Neutral tonemap 保色相 + rim 1.5 暖描边 + paper L 200/202 暖纸不爆 / clipFrac 0% | **✓ 基本解决**（不是完美，但"很差"判定不再适用） |

**视觉评分轨迹**：Iter 1 6.5 → Iter 2 7.0 → Iter 3 8.0 → Iter 4 8.5 → **Iter 5（终态）8.7/10**（Experience）；**Tech Health 8.9/10**（Evolution）。

### B. 还差什么（诚实自审）

- **桌面左右不对称 1:1.83**（VIS-TABLE-SYM 目标 ≤1.4:1）—— 根因不在强度而在 poolLight cone 中心 + keyLight 方向，属新调参不属"收尾"。**留下个 Sprint**。
- **941×1672 素材天花板**（封面 ATELIER "A" 被切）—— DOC-941 已诚实文档化，治本需重出素材属设计环节。**永久 backlog**。
- **取景 40° no-man's land**（Research §1.1 反复识别但 5 轮均无余量）—— 需 cameraStart/Open/Closed/portrait 4 处 + 移动端两条 Sprint 12 红线重新验收。**下个 Sprint 独立头号**。
- **音频层**（编码侧 startAudio/playSound 已就绪、public/audio/* 多数空缺）—— 氛围装置定位最后一格沉浸缺口。**下个 Sprint 第二头号**。
- **拆 magazineScene.js 业务逻辑**（4752 行单文件）—— Iter 3 已抽 render-config 是"渲染基线层"，下个 Sprint 应继续抽"材质 baseColor 层"+"状态机交叉表层"。**下个 Sprint 第三头号**。

### C. 下个 Sprint 该挖什么（三方收敛的接力清单）

**TOP 3 候选**：

1. **拆 `materials-config.js` + `state-machine.js` 两个子模块** —— 把"加新 overlay / 切 tonemap / 调材质"全部走可控回归面积路径；TECH-1（Iter 3）的 ROI 全额兑现模板已成立、下个 Sprint 继续抽离材质 baseColor 层 + 状态机交叉表层（七问扫描矩阵从 pitfalls 文档级升到代码级显式抽象）
2. **音频层落地** —— 编码侧就绪、缺素材；落地后凑够 ≥2 无家偏好、设置面板届时才值得建（5 轮"设置面板"被反复判"空壳"的原因正是无家偏好 < 2）
3. **取景重做（37.6° → 50° 戏剧 3/4 或 60° reader POV）** —— 5 轮反复识别但 5 轮均无余量；需配 Sprint 7+11 同等级别的取景重做规划

**进阶视觉候选**（下下个 Sprint 或之后）：HDR exr 环境贴图 / per-spread tonemap / 远景墙 / 远景剪影 / 吊灯 / 卡片 PNG 导出 + 二维码（CARD stage B）/ HemisphereLight 窗光 / 时段感"夜深一档"按钮 / 深链 codec 升维到 `?spread=N&item=M&look=X&time=T`。

### D. 5 轮最值得记住的 3 件事（沉淀进知识库）

1. **TECH-1 抽 render-config.js 的 ROI 全额兑现**（Iter 3 投入 → Iter 4 兑现）：17 联调点位散落 → 集中到 1 个文件 → Iter 4 TONEMAP-1 只动 2 字段 + bundle +30 bytes + magazineScene.js 0 字面量 delta。**这是 5 轮工程纪律最强的一笔**——"抽离换可控回归面积"范式建议在下个 Sprint 推广（候选：materials.js 抽材质 baseColor）。
2. **TONEMAP-1 两阶段方案 + Stage 1 即 PASS**（Iter 4）：三方观点（Research A3 最小动作 / Experience 预防性降 / Evolution Tier 验收门）方向相反时不"选边站"而是"分阶段执行 + 红线触发器" → Stage 1 6/6 PASS 省下 Stage 2 → 决策框架完美闭环。**这是 5 轮决策框架质量最强的一笔**。
3. **state-guard 七问扫描矩阵从 race A 个例升到模式归档**（Iter 2 race A → Iter 3 我没扫到 → Iter 4 七问扫描矩阵 4/4 candidate 清完 + 模式归档）：把"修一个 race 是局部、扫一遍状态机交叉表是系统性"沉淀进 pitfalls 模板。**这是 5 轮系统性修法纪律的代表**。

### E. 5 轮 Sprint 一句话收官

**Sprint 6 5 轮把"一本会动的暗调 demo"打磨成"一台自洽、有记忆、可分享、可导航、可阅读·可传播、视觉色相忠实、状态机一致、技术健康度 8.9/10 的纸艺 3D 装置"**——5 轮渐进式 + 系统性修法占多数派（8:5）+ 工程纪律级模式归档 + render-config 抽离 ROI 全额兑现 + TONEMAP-1 两阶段方案 Stage 1 PASS 是这个 sprint 的 4 个最高光时刻。**用户主诉两端均实质解决、终态评分 8.7/10、Tech Health 8.9/10，可以收官**。

---

## 给 Generator 的提示（一句话版）

**本轮只做 T1（DOC-FOG-ROI + git add untracked）；T2 Tier D 真机审是 Evaluator 责任、Generator 不做；任何 src/* 与 index.html 与 styles.css 0 行 delta；零视觉接触面 / 零运行期接触面 / 10-15 分钟可收**。

## 给 Evaluator 的提示（一句话版）

**本轮 Evaluator 头号任务是 T2 Tier D 真机肉眼终审（A3 三项 raison d'être 真机审 + Tier A 12 项复跑确认 Stage 2 未启动）；T1 Generator 完成后跑 `npm run build` PASS + grep "晨光" 0 命中 + git status 显示 untracked 全转 staged/committed + pitfalls.md 末尾新章节可读**。
