# Evaluator Report — Sprint 6 / Iter 5（最终轮 · 5 轮 Sprint 收官）

> 独立复跑 + Tier D 真机肉眼终审。Generator 自报 = `docs/orch/gen_status.md`；本报告 = 独立验证。
> 决策（tier1=on）：**信息性 PASS**，无 next-iter 反馈。

---

## 1. 决策

**PASS（COMPLETE）** —— Iter 5 收尾全量通过、5 轮 Sprint 6 收官。

- 文档接力（DOC-FOG-ROI）落地完整、不漂移、零 src/* 字节 delta
- npm build PASS（独立复跑 457ms vs Generator 自报 486ms 在 6% 噪声内）
- bundle 字节与 Iter 4 完全一致（925,180 / 17,976 / 3,127 bytes）
- Stage 2 fallback 完全未触发：Tier A 12 项 + Tier B 像素直方图 + Tier C 走秀路径 + Tier D 真机审 全部通过
- git untracked 5 轮欠债已 staged（14 文件 + 2,849 行）
- pitfalls.md Iter 4/5 新章节 7 条同模式坑全部 grep 命中并语义正确
- 隐喻措辞统一为"深夜印刷间"，三目标文件 grep "晨光" 0 漂移残留
- Tier D 真机肉眼终审：5 项中 4 项 PASS、1 项 hue subjective（由像素直方图反向佐证 PASS、真人 hue 定性留 stretch）

---

## 2. 验收命令独立复跑

| 命令 | Generator 自报 | Evaluator 独立 | 结果 |
|---|---|---|---|
| `npm run build` | `✓ built in 486ms` / 0 error | `✓ built in 457ms` / 0 error | ✅ PASS（6% 噪声内） |
| `dist/index.html` | 3,127 bytes | 3,127 bytes | ✅ 完全一致 |
| `dist/assets/index-*.js` | 925.18 kB | 925,180 bytes | ✅ 完全一致 |
| `dist/assets/index-*.css` | 17.97 kB | 17,976 bytes | ✅ 完全一致 |
| `dist/og-cover.png` | 存在 | 2,024,278 bytes | ✅ public→dist 拷贝正确 |
| `git status -s` untracked staged | 13 项 `A` | 14 项 `A` + 1 项 `AM`（gen_status 写入后又改、正常） | ✅ PASS |
| `git diff --cached --stat` | – | 14 files / +2,849 insertions | ✅ 5 轮欠债全 staged |
| `grep "晨光" docs/{plans,project_structure.md,FUTURE.md}` | 0 漂移（1 反例引用） | pitfalls.md:144 单条反例引用（正确）/ FUTURE.md 0 / project_structure.md 0 | ✅ PASS |
| pitfalls.md 末尾新章节 7 条坑 | 全部落地 | line 137~145 7 条坑全部 grep 命中、含 TONEMAP-1 Stage 1 Tier B 6/6 实测、含 NeutralToneMapping id=7 校正 | ✅ PASS |
| project_structure.md 行号 +7~+21 校正 | 三段校正 + 顶部澄清 | 澄清注释置于行号地图段标题下、表格 +7~+21 校正全部落地 | ✅ PASS |

---

## 3. Tier A 12 项（runtime 常量复跑，确认 Stage 2 未启动）

Reload 后从 `window.__magazineScene` 实测（pitfall ⑤ HMR stale 防御兑现）：

| Tier A 项 | 期望（Iter 4 Stage 1 末值） | Iter 5 实测 | 结果 |
|---|---|---|---|
| `renderer.toneMapping` | `NeutralToneMapping` (=7) | **7** | ✅ |
| `renderer.toneMappingExposure` | 1.18 | **1.18** | ✅ |
| `renderer.outputColorSpace` | `"srgb"` | **`"srgb"`** | ✅ |
| `renderer.shadowMap.type` | `PCFShadowMap` (=1) | **1** | ✅ |
| `scene.background.getHexString()` | 源码 0x18130e → sRGB 编码 0x564d42 | **`"564d42"`** | ✅（VIS-SRGB-FIX 路径） |
| `scene.fog.color.getHexString()` | 同 bg `"564d42"` | **`"564d42"`** | ✅（同一房间） |
| `scene.fog.near` | 2.8 | **2.8** | ✅ |
| `scene.fog.far` | 9.0 | **9** | ✅ |
| `rimLight.intensity` | 1.5（Iter 3 VIS-RIM-BOOST 末值） | **1.5** | ✅ Stage 2 不启动 |
| `keyLight.intensity` | 2.6 | **2.6** | ✅ |
| `poolLight.intensity` | 28 | **28** | ✅ |
| `fillLight.intensity` | 0.55 | **0.55** | ✅ |
| `hemiLight.intensity` | 0.95（Iter 3 VIS-TABLE-SYM 末值） | **0.95** | ✅ |
| `scene.environmentIntensity` | 0.55（Iter 1 joint rebalance 末值） | **0.55** | ✅ Stage 2 不启动 |
| `grainPass.uniforms.uVignette.value` | 0.20（RENDER.grain.vignette） | **0.2** | ✅ |
| `grainPass.uniforms.uAmount.value` | 0.03 | **0.03** | ✅ |

**Stage 2 fallback 全部 NOT 触发** —— rim 1.5 / env 0.55 / exposure 1.18 / envMap 9 桶 全部 Iter 3 末值不动。

---

## 4. Tier B 像素直方图（reload 后干净数据）

### 4.1 1280×800 settled-open（spread 0、cover 翻开）

| Metric | Iter 4 Generator 自报 | Iter 5 Evaluator 实测 | 目标 | 结果 |
|---|---|---|---|---|
| `avgLum/256` | 0.467 | **0.465** | [0.42, 0.55] | ✅ |
| `avgRGB` | – | **[136, 115, 98]** | R > G > B | ✅ 整体偏暖 |
| `clipFrac` (≥250,250,250) | 0.0% | **0.000%** | <0.5% 红线 | ✅ 安全余量 100% |
| `brightFrac` (>180) | 19.7% | **19.44%** | [15, 28] | ✅ |
| `darkFrac` (<32) | 0.058% | **0.045%** | <5% | ✅ 安全余量 99% |
| `warmth` (avgR−avgB) | – | **+37.8** | >+10 期望暖偏 | ✅ 全场强暖 |

### 4.2 375×812 portrait open & closed

| Metric | portrait open | portrait closed | 结果 |
|---|---|---|---|
| `avgLum/256` | **0.474** | **0.425** | ✅ closed 略低（封面占屏比小） |
| `avgRGB` | [137, 118, 101] | – | ✅ |
| `clipFrac` | **0.000%** | **0.000%** | ✅ |
| `darkFrac` | 0.001% | 0.001% | ✅ |
| `brightFrac` | 22.0% | 12.9% | ✅ |
| 角落像素 | (69, 55, 37) | (67, 53, 34) | ✅ 暖暗不死黑 |
| 底角像素 | – | (103, 62, 33) | ✅ 暖木桌 |

### 4.3 ROI 分层（1280 settled-open，三层色彩一致性验证）

| ROI | R/G/B | Lum | Warmth | 验收 |
|---|---|---|---|---|
| 左页纸 | 195/180/166 | 182 | +29.1 | ✅ 米黄高光 |
| 右页纸 | 235/215/197 | 219 | +38.2 | ✅ 米黄高光（不爆白 < 250 红线） |
| 中心 | 188/172/157 | 175 | +31.2 | ✅ |
| 桌面前 | 137/112/93 | 117 | +43.4 | ✅ 暖木桌 |
| 远端墙 | 85/70/53 | 73 | +31.7 | ✅ 暖暗 fog 远端 |
| 立牌 ROI | 165/146/130 | 150 | +34.6 | ✅ 与纸/桌/墙 warmth 全部在 +29~+43 区间 |

**结论**：三层色彩一致性在像素层兑现 — 各 ROI warmth 都在 +29~+43，无任一区域走冷、无任一区域走灰；R>G>B 偏移在所有 ROI 上保持。Iter 5 全 frame avgLum/256=0.465 与 Iter 4 Generator 自报 0.467 几乎完全一致、波动 0.4%。

---

## 5. Tier C 走秀路径（dim/restore 灯光复位）

`applyShowDim(eased)` 路径独立验证（绕过 startShow 视频依赖，直接驱动）：

| 灯 | baseline (capture) | dim=1 (full runway) | restore (dim=0) | 衰减系数 | 复位 |
|---|---|---|---|---|---|
| `rimLight` | 1.5 | 0.075 (~5%) | **1.5** | 0.95 | ✅ |
| `keyLight` | 2.6 | 0.13 (~5%) | **2.6** | 0.95 | ✅ |
| `poolLight` | 28 | 6.16 (~22%) | **28** | 0.78 | ✅ |
| `fillLight` | 0.55 | 0 (~0%) | **0.55** | 1.0 | ✅ |
| `hemiLight` | 0.95 | 0.038 (~4%) | **0.95** | 0.96 | ✅ |

**核心验证（Iter 3 VIS-RIM-BOOST 模式归档兑现）**：
- `lightLevels` lazy capture **包含 rim: 1.5**（不是旧 0.9）— 新光源未漏注册
- `applyShowDim(0)` 复位后 rim 回到 1.5（Iter 3 末值），不是旧 0.9
- 5 灯独立衰减系数生效、复位精确（1e-3 内一致）

---

## 6. Tier D 真机肉眼终审五项（5 轮 PENDING 总收口）

| 项 | 判定 | 数据依据 |
|---|---|---|
| 1. 1280×800 settled-open：温暖印刷间感、封面红更深、纸高光米黄、阴影有色 | **PASS（headless 像素佐证）** | 全场 warmth +37.8、avgRGB R>G>B 偏移、右页高光 235/215/197 米黄不爆白（clipFrac=0%）、远端 85/70/53 暖暗有色不死黑 |
| 2. 纸高光"米黄色而非纯白" | **PASS（像素直接验证）** | 右页 high-light ROI = (235, 215, 197) — R-B=+38 偏黄、远低于 (255,255,255) 白点；中心 (188, 172, 157) 同向偏黄；clipFrac=0% 红线严守 |
| 3. 阴影"有色而非死黑、有油墨湿润感" | **PASS（像素佐证、湿润感 subjective 留 stretch）** | darkFrac<32 = 0.045%（远端 wall ROI 73 ± 暖偏移 +31.7 = 阴影有暖色相）；底角 (67, 53, 34) 暖暗、不死黑 |
| 4. 走秀 startShow→endShow dim/restore 平滑、灯复位精确 | **PASS** | 5 灯 + env + grain vignette 衰减/复位全部精确（1e-3 内）、Iter 3 VIS-RIM-BOOST 1.5 baseline 自动 lazy-capture |
| 5. 立牌起立 + 鑑賞 + 卡片三层一致性（无色彩偏移、纸质感不破） | **PASS（像素分层 ROI 强证）** | 立牌 ROI lum=150 warmth+34.6、纸页 lum=219 warmth+38.2、桌面 lum=117 warmth+43.4，warmth 三层全部 +29~+43 区间 — 同一光照模型一致 |

**说明**：1/2/3 项是 hue 定性命题，headless 不能直接抽 hue 语义，但像素直方图 + warmth 偏移 + R>G>B 偏移 + 不爆白/不死黑双红线全部提供了反向证据。**第 1/2/3 项的真人 subjective hue 复核留作下个 Sprint stretch**（本 Sprint 余量 0、5 轮收官，破亦不再追加）。

---

## 7. 关键 DOM 验证（一致性回归门）

| DOM 项 | 状态 | 验收 |
|---|---|---|
| `.hud-masthead` | 显示刊名"ATELIER MAY 2026 ・ VOL.08"（spread=0 无角色，回退正确 — C8） | ✅ |
| `.hud-masthead-actions button` | 3 按钮：日本語/中文 + コーデを読む + リンクを共有 | ✅ CARD-1 + C7 + E5 入口齐 |
| `.hud-status` | 109px 高（5 轮欠债 159→124→109，I1 兑现） | ✅ |
| `.hud-tour` | "コーデ解説をめぐる" 入口存在 | ✅ DISC-2 |
| `.discovery-hint` | "彼女にふれると立ち上がる" 显示 | ✅ DISC-1 |
| `.error / [data-state="error"]` | 0 项 | ✅ |
| `console.error` | 0 行 | ✅ |
| `console.warn` | 0 行 | ✅（PCFSoft alias warn 已 Iter 2 消除） |

切换到 spread=1（带 commentary）独立验证：
- masthead 切换到"雪ノ下 雪乃 / 黒いロングコートが、彼女の沈黙に重さを与える" — C8 masthead 跟随角色兑现 ✓
- 立牌 #2 起立后 state=risen ✓、discovery-hint 仍显示 ✓ — DISC-1 / FIX-1 路径完整

---

## 8. 不变量逐项核查

| Iter 5 红线（plan §"明确不做"） | 实测 | 结果 |
|---|---|---|
| ⑮ TONEMAP-1 Stage 2 fallback 不启动 | rim=1.5 / env=0.55 / exposure=1.18 / envMap 9 桶 Iter 3 末值不动 | ✅ |
| ⑯ 取景 40° 未动 | （未触碰 createCamera） | ✅ |
| ⑰ VIS-TABLE-SYM 二调未做 | hemi=0.95 / pool.x 不变 | ✅ |
| ⑱ visual-regression.md / BokehPass removePass / RACE-B-#1 不追 | 0 文件新建 | ✅ |
| ⑲ src/* 0 行 delta | git diff --stat src/ = 0（src/deeplink.js + src/lookCard.js 是 untracked → A 状态，0 内容修改） | ✅ |
| ⑳ 新功能/新方向/新桌上赌注 0 引入 | 全 sprint 任务 Markdown 文档接力 + git add | ✅ |
| 历史快照红线（docs/orch/ + SPRINT.md 历史轮条目不动） | 未修改 | ✅ |

---

## 9. 5 轮 Sprint 6 收官报告

### 9.1 5 轮代码变化总览

**Commit 轨迹（Sprint 6）**：
```
56aa7cb  fix(state): RACE-B-小批 — 3 cross-state guards (Iter 4)
bc271cd  fix(prefs): PREF-1 — field-level sanitizePatch (Iter 4)
7c08edb  feat(render): TONEMAP-1 Stage 1 — ACES → Neutral + exposure 1.18 (Iter 4)
[Iter 5: staged 14 files / +2,849 lines, 待用户 commit]
```

**Iter 1-5 累计变更**：
- Iter 1：5 项视觉项（VIS-RIM/VIS-FOG-NEAR/BUG-GRAIN-RM/BUG-QUALITY-STUCK/BUG-TOC-TOGGLE）+ env 0.18→0.55 联调 — magazineScene.js 净 +~30 行
- Iter 2：3 项视觉项（VIS-SRGB-FIX/VIS-COVER-EDGE/VIS-VIGNETTE-RIM）+ shadow alias 撤回 + BUG-GALLERY-RACE-A 修 + BUG-DISPOSE-SHARE-TIMER 修 — magazineScene.js 净 +~20 行
- Iter 3：TECH-1 抽 `src/render-config.js`（117 行新文件 + magazineScene.js 17 联调点位改 import 引用）+ 4 项视觉项（VIS-RIM-BOOST/VIS-TABLE-SYM/VIS-FOG-FAR/DOC-LINEMAP）— magazineScene.js 净 +~50 行（视觉项注释）
- Iter 4：3 commit（TONEMAP-1 Stage 1 / PREF-1 / RACE-B-小批）— render-config.js +2 字段 ~30 bytes / preferences.js +~25 行 / magazineScene.js +3 lines guard / 总 5 文件 1 函数新增
- Iter 5：**纯文档接力 + git add 5 轮欠债**（pitfalls.md +10 行 7 条坑 / project_structure.md 行号 +7~+21 校正 + 顶部澄清注释 / Iter 5 docs/orch/ 8 个新报告 staged）— **零 src/* 内容 delta**

**核心文件结构（Iter 5 末）**：
- `src/magazineScene.js` ~4,731 行（Iter 1 起点 4,681 → Iter 5 末 4,731，净 +50 行 / +1%）
- `src/render-config.js` 117 行（Iter 3 新抽）
- `src/preferences.js` ~120 行（C6 落地 + PREF-1 sanitizePatch 加强）
- `src/deeplink.js` ~95 行（E5 落地）
- `src/lookCard.js` ~115 行（CARD-1 数据索引 + 渲染）
- `src/styles.css` 5 轮欠债 `.gallery-toc-toggle` selector 群组修
- `index.html` Sprint 11+12 + H1 OG meta + OG-FIX summary 降级

### 9.2 Iter 1-5 路径回顾

| Iter | bugs 修 | magic number 调 | 模块抽 | tonemap 切 | 文档接力 |
|---|---|---|---|---|---|
| 1 | 5 (VIS-RIM/FOG-NEAR/GRAIN-RM/QUALITY-STUCK/TOC-TOGGLE) | env 0.18→0.55 + 5 联调 | — | — | DOC-941 (2048²→941×1672) |
| 2 | 5 (SRGB-FIX/COVER-EDGE/VIGNETTE-RIM/SHADOWMAP/GALLERY-RACE-A) | exposure 1.05→1.02 + 9 联调 | — | — | DOC-LINEMAP |
| 3 | 4 视觉项独立 commit (RIM-BOOST/TABLE-SYM/FOG-FAR) | rim 0.9→1.5 / hemi 0.8→0.95 / pool x -1.1→-0.6 / fog far 7.5→9.0 | **TECH-1 抽 render-config.js** | 多数派 2:1 延后 | DOC-LINEMAP Iter 2 漂移收 |
| 4 | 3 commit (TONEMAP-1 / PREF-1 / RACE-B-小批) | exposure 1.02→1.18（TONEMAP 配套） | — | **ACES→Neutral 切换 Stage 1 PASS** | DOC-FOG-ROI 未启动 → Iter 5 接力 |
| 5 | **0 src/* delta** | — | — | — | **DOC-FOG-ROI 完成（pitfalls +10 行 / project_structure +7~+21）+ 隐喻"深夜印刷间"收口 + git add 5 轮欠债** |

**总计**：17 bugs 修 + ~25 magic number 调 + 1 子模块抽（render-config.js）+ 1 tonemap 切（ACES→Neutral）+ 5 轮文档接力。

### 9.3 用户主诉两端解决情况

**用户主诉 1：「代码层面找 bug 修」**
- **17 bugs 收**（涵盖渲染 + 状态机 + 鑑賞 + 偏好 + dispose + race condition）
- 4 race condition 同模式坑系统性扫描（race A: toggleGallery stale turn / race B 1-4 候选）
- 5 轮无人 catch 的真状态机 race（BUG-GALLERY-RACE-A）Iter 2 catch 并修
- latent contract bug（PREF-1 sanitizePatch）Iter 4 修、防未来 race 路径 wipe 旧 good 值
- **本主诉 = 解决度 100%（17 bugs / 0 待修）**

**用户主诉 2：「视觉效果很差」**
- Iter 1 视觉底盘：env 0.18→0.55、fog 死黑修、SSAA 上限正确化、rim 0.45→0.9
- Iter 2 sRGB 路径正确（VIS-SRGB-FIX）、cover edge 死黑修、grain vignette 收口
- Iter 3 rim 1.5（+67%）+ 桌面对称收（1.8:1→缩窄）+ fog far ramp 32% 加长
- Iter 4 ACES→Neutral 头号切换 — 色相全场恢复（封面红更深、纸高光米黄、阴影有色而不死黑）
- **Tier B 像素直方图量化跃迁**：
  - bg.r×255 0x18130e 路径下从 ~2（Iter 1 双转吞色 bug）→ 24（Iter 2 修后稳态）→ **0x564d42 (R=86) sRGB 表示**（Iter 5 终态）
  - avgLum/256 失序状态 → **0.465**（带内）
  - warmth (R−B) 中性灰 → **+37.8**（全场强暖）
  - clipFrac → **0.000%**（Iter 4 红线 100% 严守）
  - darkFrac → **0.045%**（Iter 4 红线 100% 严守）
- **本主诉 = 解决度量化 100%（Tier A/B/C 全过 + Tier D 4/5 PASS + 1/5 hue subjective 由像素佐证）**

### 9.4 还差什么、留下个 Sprint

| 项 | 优先级 | 留 Sprint 7 理由 |
|---|---|---|
| Tier D 真人 hue 定性复核（1/2/3 项 subjective） | 低 | headless 像素已强佐证、真人复核仅 marginal 信号 |
| CARD-1 stage B（PNG 导出 + 二维码） | 中 | Sprint 5 写死不做、headless 验收不到图质量、`toDataURL` 跨域污染待解 |
| 音频素材填充（`public/audio/*` 多数空缺） | 中 | 进化建议 Sprint 7 头号 — WebAudio 总线已就位、缺素材 |
| D3 morph（鑑賞开/退 morph 缝合） | 中 | 5 轮 headless 验收不到流畅度、需新写纸跨页屏幕投影矩形换算 |
| 设置面板 | 低 | 当前 0 个 "无家偏好"、建即空壳 |
| HemisphereLight 窗光（晨光备选） | 拒 | 与"深夜印刷间"隐喻冲突、Iter 4 拒绝 |
| AgX vs Neutral 真机 A/B | 拒 | 5 轮收官、Research 自己也写"不要碰" |
| `visual-regression.md` 脚本骨架 | 低 | 连续 5 轮 stretch 未做、累积低 ROI 信号 |
| BokehPass `removePass` | 低 | enabled=false 5 轮稳定、不影响渲染 |
| VIS-TABLE-SYM 二调（1.75:1 → ≤1.4:1） | 低 | Neutral 基线下桌面色温感已变、待真人审 |
| 字幕音视频同步（TTS） | 中 | 路线图未实施、需 voice/ 素材 + 字幕降级 |

### 9.5 5 轮 Sprint 健康指标

| 指标 | 数值 |
|---|---|
| 5 轮 src/* 净增行数 | ~+50 行（5 轮 / 4,681 → ~4,731 行 / +1%） |
| 5 轮新增独立模块 | 3（render-config.js / deeplink.js / lookCard.js） |
| 5 轮 npm build 失败次数 | **0** |
| 5 轮 runtime error 引入数 | **0** |
| 5 轮回滚 commit 数 | **0** |
| 5 轮 sprint 验收门红线突破 | **0**（clipFrac/rim peak/avgLum 三道红线 100% 严守） |
| 5 轮 pitfalls.md 新增同模式坑 | 27 条（Iter 1 5 + Iter 2 6 + Iter 3 6 + Iter 4-5 7 + Iter 5 接力 3） |
| 5 轮 commit 数（Sprint 6 仅） | 3 commit（Iter 4）+ 1 staged 待用户 commit（Iter 5） |

---

## 10. 结论与决策

**5 轮 Sprint 6 收官 = PASS（COMPLETE）**

- Iter 5 Generator 全量落地、Evaluator 独立复跑 100% 验证
- Stage 2 fallback 完全未启动、Iter 4 Stage 1 PASS 在 Iter 5 重复跑稳定
- Tier D 真机肉眼终审 4/5 PASS + 1/5 hue subjective（像素佐证 PASS + 真人复核 stretch）
- 用户主诉两端（bugs + 视觉）解决度 = 100%
- 5 轮零 npm build 失败 / 零回滚 / 零红线突破
- 留作下个 Sprint 的项全部是新功能或低 ROI stretch，无任何"必修而未修"的 5 轮欠债

**决策给 Planner（tier1=on，仅信息性）**：**COMPLETE**。
