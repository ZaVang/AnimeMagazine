# ATELIER 杂志 — Roadmap

未实施的已规划功能。当前已完成的系统（翻页、立牌、表情卡、暗场走秀、观赏模式、键盘视角等）不在此列。

---

# 体验审计修复 Roadmap（2026-06 审计）

一次完整的可视/美观/便利审计后整理的修复计划，按 Sprint 拆分，逐个完成并提交。
评分：可视程度 5.5/10、美观程度 8.5/10、便利度 4/10。
核心矛盾：平面页排版精良，但默认 3D 斜视取景牺牲了可读性，且关键交互（阅读缩放、相机）仅绑键盘，触屏几乎不可用。

## Sprint 1 — 品牌一致性（P0，已完成）

- [x] `assets/image/cover.png` 是旧版 **SO-EN / 装苑 / MAY 2025 / VOL.72** 封面，
      与 HUD、网页标题、特集文案的 **ATELIER / アトリヱ / MAY 2026 / VOL.08** 身份自相矛盾。
- [x] 用 `assets/backup/cover-extra-2026.png`（正确的 ATELIER 2026 封面，主题与
      「白と海軍紺の構造美 / THE ART OF RESTRAINT」一致）替换在用封面。
- [x] 封底 `back-cover.png` 经核对已是 ATELIER 2026 版本（Vol.08 / atelier press /
      NEXT ISSUE Vol.09 JULY 2026），无需替换。

## Sprint 2 — 触控可用性（P0/P1，已完成）

- [x] 新增可点击的「鑑賞モード」HUD 按钮（`.hud-read`，pointer-events:auto），触屏与鼠标
      都能进入阅读/缩放模式（此前仅 Space 键，触屏无法进入）。
- [x] 鑑賞 overlay 内补齐触控闭环：右上「✕」关闭按钮、双指捏合缩放（多指 pointer 追踪）、
      左右「‹ ›」切换跨页左右两页（`galleryShowSide` + `reloadGalleryImage`）。
      此前 overlay 仅支持滚轮缩放 + Space/Esc 退出，触屏会被困住。
- [x] `pointer: coarse` 时隐藏键盘提示 `.hud-keys`，改显触屏提示 `.hud-touch`
      （ドラッグ・めくる / タップ・立たせる），避免无用且换行铺满底部的快捷键文本。
- [x] 已验证：入口/关闭/翻页/捏合缩放均生效；移动端 375px 下控件全部在视口内且互不重叠。

> 后续（P2）：鑑賞 overlay 的左右翻页目前限定在当前跨页内；可扩展为整本顺序浏览。

## Sprint 3 — HUD 可读性（P1，已完成）

- [x] 给 `.hud` 整层加细微墨色 text-shadow（dark-on-dark 时不可见，仅在亮色页面
      移到文字下方时生效），并给底部字幕 `.cap-ja/.cap-zh` 叠加更强的描边，
      解决压到亮色页面（实测背景亮度峰值 205）时白字糊掉的问题。
- [x] `--paper-faint` 由 `rgba(...,0.28)`（接近不可见）提升到 `0.42`，
      特集竖排文字与键盘提示更可读，仍弱于 `--paper-dim` 保持克制。

## Sprint 4 — 移动端取景（P1/P2，已完成）

- [x] 重写竖屏响应式取景（参数化，集中在 `createCamera`）：窄屏时按 `portraitAmount`
      渐进地 ① 拉大 FOV（`portraitFovGain`，比单纯拉远更省、不至于把杂志缩成小块）、
      ② 适度拉远拉高（`portraitPullZ/Y`）、③ 把 look-at 横向滑向杂志中线（`portraitRecenter`）。
- [x] 已验证：375px 下关闭态封面完整入框（报头与「08」不再被裁），展开态左右两页
      全部可见、不再溢出；横屏/桌面（aspect ≥ 0.92）`portraitAmount=0`，取景与原版一致无回归。

## Sprint 5 — 鑑賞整本顺序浏览（P2-A，已完成）

- [x] 鑑賞 overlay 从「只在当前跨页左右翻」升级为「整本顺序浏览」：
      构建阅读顺序线性页表（封面 → 全部内页 → 奥付 → 封底，页面 URL 为 eager，
      无需等 3D 贴图流式加载即可寻址），`‹ ›` 按钮 / `← →`（及 `↑ ↓`）方向键逐页翻，
      两端自动隐藏对应箭头并夹取。
- [x] 打开时落在「当前正在看的那一页」（关闭态→封面、封底态→封底、展开态→悬停侧页），
      页码沿用 HUD 的 `P.{page+2}` 编号，二者一致。
- [x] 已验证：从封面可一路读到封底（18 项：封面+15 内页+奥付+封底），逐页图片正常加载，
      首尾夹取、箭头隐藏、方向键、从跨页打开落点均正确。

## Sprint 6 — 发现性 + 初始取景打磨（P2-C，已完成）

- [x] 一次性发现性引导：杂志首次展开到带立牌的跨页时，把底部提示改成
      「彼女にふれると立ち上がる」（`maybeShowStandeeHint`，每会话一次、翻页后照常淡出）。
      翻页可读性已由光标 chevron 暗示，故优先把隐藏的签名玩法（立牌）浮出来。
      顺手把走秀提示「クリック」改为设备中性的「ふれる」。
- [x] 初始机位略推近：关闭态取景 z 3.08→2.86、y 2.32→2.28、look y 0.06→0.10，
      封面在第一屏更有体量、报头仍完整留白（intro 也随之落到更近的定格）。
- [x] 已验证：桌面封面更有存在感且报头不裁；移动端 375px 封面仍完整入框无回归；
      首次展开提示正确切换为立牌引导。

> 说明：审计里「空旷地板」的观感主要来自 intro 的远景推入（刻意的电影化开场），
> 落定后的取景本就饱满；故只做克制推近，未改 intro 时长。

## Sprint 7 — 窄竖屏「聚焦单页」取景（P2-B，已结案：由 Sprint 5 取代）

- [x] 评估结论：**不做**激进的 3D 单页取景。理由：
      ① 它会破坏「纸艺杂志摊在桌面」的核心观感与翻页动画；
      ② Sprint 5 的鑑賞 overlay 已提供设备中性、可缩放、逐页的阅读，且能整本浏览，
         在「单页聚焦阅读」这件事上严格优于把相机怼到一页上；
      ③ Sprint 4 已保证 3D 视图里整跨页完整入框，浏览态本就够用。
- [x] 决策已写入代码注释（`createCamera` 竖屏取景段，标注 P2-B），便于后人理解为何
      竖屏选择「整跨页 + 鑑賞」而非单页取景。

> 阅读路径定论：3D 浏览（整跨页入框）→ 想细读时进鑑賞（逐页 / 捏合缩放 / 整本翻）。

## Sprint 8 — 渲染清晰度与性能（自适应画质，已完成）

根因（实测，**不是 three.js 本身**：整场景仅 12 draw call / 82 三角形，直渲 <1ms）：
- 模糊：`pixelRatio` 硬封顶 1.5 → 高分屏欠采样后被浏览器拉伸；后期管线用了 `samples:0`
  的离屏 target，渲染器 `antialias:true` 被忽略，边缘发软。
- 卡顿：BokehPass 逐帧（中位 2.2ms / p90 6.8ms，随像素放大）+ 2048² 阴影图 `autoUpdate`
  每帧重渲；加载期 ~85 张纹理解码/上传 + 立牌 NCC 主线程分析。
  > **DOC-941 校正（第 6 轮迭代 / Iter 1）**：2048² 这里指**阴影贴图分辨率**（shadowMap 边长，对），不是素材尺寸；当时连带说"内页是 2048² 美术图"是错——实测全仓所有印刷/封面/立绘 PNG 均为 **941×1672**。

- [x] 解除 DPR 封顶：原生渲染、上限 2、下限 1（`qualityCeil/Floor`），dev 控制台打印实际 DPR。
- [x] 后期补回抗锯齿：EffectComposer 改用多重采样 HalfFloat RT（`samples:4`），
      渲染器 `antialias` 关掉（管线里本就无效，省默认帧缓冲 AA 开销）。
- [x] 阴影按需：`shadowMap.autoUpdate=false`，仅在投影体（开合/翻页/立牌）运动时刷新
      （`shadowsNeedUpdate` + settle 尾帧），静止时冻结复用上一张。
- [x] 自适应画质（`trackFrameQuality`）：持续掉帧时**先关景深、再逐级降分辨率到下限**；
      长时间平稳后**先升回分辨率、再开景深**。带 1s 冷却 + 指数回退，避免分辨率抖动。
- [x] 已验证：MSAA/HalfFloat 生效、色彩与色调映射无变化、降/升档阶梯逻辑正确、
      dev DPR 日志正常、无报错。

> ⚠️ 上线后修正：用户实测 `devicePixelRatio=1.5`（笔记本）/ `1`（外接屏），即**本就按原生渲染、
> 封顶并未欠采样**——所以「模糊」不是 DPR 封顶。MSAA 也被实测证伪（开着 MSAA 内部仍糊）。
> 真因见 Sprint 9。本 sprint 的阴影按需 + 自适应控制器仍然有效并保留。

## Sprint 9 — SSAA 超采样消除模糊（修正根因，已完成）

修正后的根因：模糊是**高清内容的欠采样**。内页是 **941×1672 美术图**（DOC-941 第 6 轮迭代 / Iter 1 校正——此前文档反复误述为 "2048² 美术图"，实测全仓 cover/back/1/2/3.png/og-cover 等 PNG 皆 941×1672），在桌面上被缩小、且以掠射角
观看 → 纹理细节多于屏幕像素，原生分辨率下小字发糊。pr1 vs pr2 截图实测证实：**MSAA 修不了
内部细节（只管边缘），超采样（渲染到原生以上再缩采样）才能同时锐化边缘与内部。**

> **DOC-941 注**：941×1672 是**素材层分辨率天花板**——SSAA 上限 2.0 在 1280×800 桌面整跨页占屏 ~60% 下采样比已 ~0.82×；4K + DPR 2 已是天花板，**SSAA 再调高也救不回**。任何"提高内页清晰度"的方向必须先重出更高清素材，纯渲染侧无解。

- [x] 用 **SSAA 取代 MSAA**：下限 = 原生 DPR（绝不低于屏幕，杜绝放大糊），
      上限 = `min(dpr×2, 2.5)`，起始即上限（开场就清晰）。
- [x] 后期 target 退回普通 HalfFloat（`samples:0`）：在高 pixelRatio 上再叠 MSAA 显存代价过大，
      超采样本身已是更优的抗锯齿（边缘+内部全覆盖）。
- [x] 复用 Sprint 8 的自适应控制器：弱机持续掉帧时先关景深、再从上限逐级回落到原生下限。
- [x] 已验证：预览 DPR=1 下起始 pixelRatio=2（2× 超采样）、裁切清晰度对齐 pr2、
      色彩无变化、dev 日志 `pixelRatio 2 (native 1, ceil 2)`、无报错。
      笔记本 DPR=1.5 → 上限 2.5（1.67× 超采样）；外接屏 DPR=1 → 上限 2（2× 超采样）。

> 注意：3D 视图里正文本就很小，超采样让它更清晰但不等于"能舒服阅读"——细读仍走 Sprint 5 的鑑賞缩放。

## Sprint 10 — 加载期卡顿（离主线程解码 + 分帧，已完成）

「打开卡顿」是主线程的 CPU 加载工作：~85 张内页/封面图用 `TextureLoader`（HTMLImage 主线程解码）
+ 15 个立牌的同步 NCC 分析（`rasterAlphaMask` / `matchFigureToPrint`）在 `buildStandee` 里一次性堆叠。

- [x] 内页/封面走 `ImageBitmapLoader` 离主线程解码（`imageOrientation:'flipY'` + `texture.flipY=false`
      复刻原朝向、消除 flipY 警告）。**立牌相关贴图保持 `raw`（`TextureLoader` 不翻转）**，
      因为 `buildStandee` 会逐像素分析图/表，bitmap 的预翻转会破坏裁剪与网格切分。
- [x] `rasterPageLuma` 对 bitmap 内页在分析时翻回正向，保证「立绘 vs 印刷」相关匹配仍在原坐标系，
      立牌锚定位置不变。
- [x] `loadStandees` 在每个 `buildStandee` 后 `await` 让出一帧，15 个立牌的 NCC 分散到多帧，
      不再一次性卡住主线程。
- [x] 已验证：内页/封面朝向与配色不变、立牌正确起立并锚定到印刷人物（fit score 0.48~0.89、
      feetY≈页面底部）、无 flipY 警告、无报错。

> 注：本 sprint 治的是「打开/翻页时的解码与立牌分析卡顿」。Sprint 9 的超采样带来的稳态 GPU 负载
> 由自适应控制器兜底（持续掉帧→先关景深、再回落到原生）。若稳态仍偏卡，可下调超采样上限或更早关景深。

> 仍可继续（候选）：纹理 GPU 上传分帧（`initTexture` 队列化，每帧 1~2 张）、立牌 NCC 移至 Web Worker。

## Sprint 11 — 稳态减负（默认关景深 + 降超采样上限，已完成）

用户反馈 Sprint 9 超采样后稳态更卡，选择「按建议来」。

- [x] **默认关闭景深 BokehPass**：杂志在对焦面上，DoF 只糊远处地板（开关画面几乎一样），
      却是逐帧最贵、且随超采样像素数放大的一项。保留在管线里但 `enabled=false`（disabled pass 被跳过），
      一行即可恢复。
- [x] **超采样上限 2.5→2.0**：`qualityCeil = min(dpr×2, 2.0)`。笔记本 DPR1.5 由 2.5 降到 2.0
      （像素数 -36%，明显更轻；仍是 1.33× 超采样，远好于原生）；外接屏 DPR1 仍为 2.0。
- [x] 自适应控制器**只管分辨率**（景深不再是性能档位）：持续掉帧 → 逐级降到原生下限；平稳 → 升回上限。
- [x] 已验证：景深默认关、画面正常渲染（非黑）、自适应阶梯纯分辨率（2.25↔1.0，全程 bokeh=0）、无报错。

> 如果关掉景深后觉得"少了点电影感"，把 `createPostProcessing` 里的 `this.bokehPass.enabled = false` 删掉即可恢复。

## Sprint 12 — 鑑賞阅读层 → DOM 翻页器（StPageFlip，已完成）

架构决策（见记忆 keep-threejs-3d-installation）：3D 主体保留，只把阅读层升级。
鑑賞 overlay 从「单图平移/缩放」换成 **StPageFlip DOM 翻页书**：真实翻页动画 + 原生清晰。

- [x] 引入 `page-flip` 依赖。鑑賞打开时用既有线性页表（封面→内页→奥付→封底）构建翻页书。
- [x] **关键：用 `loadFromHTML`（真实 `<img>` 页）而非 `loadFromImages`**。后者画到一张
      **非 DPR 感知的 canvas**，在高分屏会重新变糊；真实 DOM `<img>` 浏览器永远按原生分辨率栅格化，
      任何 DPR 都清晰（实测 hasCanvas=false、18 张真 img、cover 原生 941×1672）。
- [x] 响应式：`usePortrait` + `minWidth:260`（阈值 ~520px）→ 手机单页竖排、平板/桌面双页跨页。
      实测 375px=portrait/单页满宽，1280px=landscape/居中跨页。
- [x] 入口/退出保留（鑑賞按钮 / Space / Esc / ✕）；`‹ ›` 与方向键映射到 `flipPrev/flipNext`；
      翻页时同步页码标签与箭头显隐。
- [x] 鑑賞打开时**跳过 3D 渲染**（场景被全覆盖），关闭即恢复——省 GPU。
- [x] 已验证：构建/页数(18)/起始页/翻页/标签同步/响应式/无报错。**翻页曲卷动画为库驱动，
      无头环境（WebGL rAF 占用）截不到动画，需在真实浏览器肉眼确认顺滑度。**

> 取舍：换用翻页书后**移除了旧的捏合缩放**（StPageFlip 不内置）。当前单页满屏已比 3D 视图清晰得多；
> 若仍需放大细看小字，后续可加「双击页面 → 单页缩放灯箱」（候选）。

## 后续优化 Roadmap — Messenger 视觉系统 + editorial voice（待实施）

外部参考已沉淀到 `docs/messenger-visual-reference.md`。结论：不要照搬星球/水面/低多边形题材，
但应借鉴其 **shader-first 视觉系统、GPU 友好资源格式、可选后处理、真实浏览器验证、叙事节奏**。

这些优化按“先减负和提清晰度 → 再补视觉质感 → 再补叙事和语音”的顺序排。每个 sprint 应独立可合并，
不要把资源管线、shader、TTS、前端交互塞进同一个大改。

## Sprint 13a — 资源基线 + 后台上传分帧（P0，已完成）

目标：把“重、糊、加载慢”的问题先变成可审计对象，并先移除一个已知 jank 来源。
说明：这是 `docs/plans/SPRINT13.md` 实际完成的范围，不等于原 roadmap 里完整的资源瘦身承诺。

- [x] 建立资产体检表：记录 `dist/` 总大小、最大文件、PNG/PBR/MP4 分类体积，并可用 `npm run asset:audit` 重复生成。
- [x] WebGL / DOM 资源职责图：明确 3D 场景页图、立牌、PBR 与 DOM 鑑賞层用图的边界；`鑑賞` 不退回 canvas。
- [x] 把后台页图的 `renderer.initTexture(texture)` GPU 上传做成小队列，渲染循环每帧只预热 1 张。
- [x] `npm run build` 与 `npm run asset:audit` 作为 Sprint 13a 验收命令保留到文档。

已知缺口：

- 13a 没有真正腾出主要下载预算；它只是建立 baseline、职责边界和一个小的帧时间修复。
- PERF-1 的收益来自机制判断，尚没有帧时长/FCP/TTI 的前后实测。
- 后续依赖性能预算的 shader、语音、叙事动效不能默认把 13a 当作完整资源优化完成。

## Sprint 13b — 资源瘦身 + 可测探针（P0，已完成）

目标：真正减少 runtime 下载/解码/GPU 压力，并把“体感流畅”变成可复查数字。

- [x] 下采样过重 runtime PBR 法线贴图：`paper_0026_normal_opengl_2k.png` 与
      `wood_0066_normal_opengl_2k.png` 保持路径不变，运行时版本从 2048px 降到 1024px；源素材包仍保留在 `assets/pbr/`。
- [x] WebGL-only display assets 生成 WebP 变体并接入 Three.js：`background-only` 与 sheet/透明立牌改走
      `images-webgl/*.webp`，DOM 鑑賞层仍使用 canonical `main-visual.png`。
- [x] WebGL-only 纹理分层落到代码：立牌、背景、表情/动作 sheet 不再从 canonical PNG 进入构建。
- [x] 资产体积探针可跑：`npm run asset:audit` 固定记录 PBR 前后体积与 WebGL display variant family reduction。
- [x] WebGL display variant 漂移校验：`npm run asset:audit` 检查缺失、孤儿、源图更新后未重生的 WebP。

defer（不阻塞 13b 合并）：

- defer：KTX2/Basis 工具链装好后，再比较 KTX2/Basis 与 WebP/AVIF 的体积、清晰度和兼容性。
- defer：DOM 鑑賞层高分源图与响应式 `srcset`；这依赖更高清的源素材，纯前端无法突破当前素材天花板。
- defer：主页面 `main-visual` 分层；阅读层要高分清晰，WebGL 页面材质可以另走 display copy，但需要更完整视觉 QA。
- defer：FCP/TTI 或近似可交互时间、后台纹理上传计数；现阶段已有体积探针与 drift guard，精细时序观测放到后续 perf pass。

验收：

- `npm run build` 通过，`npm run asset:audit` 记录 PBR 前后体积、WebGL display variant 体积与当前 `dist/` 总体积。
- 最大 runtime 文件清单不再被 20MB 级 PBR 法线图占据。
- WebGL-only image-pack PNG 不再进入 `dist/assets`；阅读层 `main-visual.png` 仍保留 DOM `<img>` 路线。
- 已做 1280x800 与 375x812 的 WebGL smoke：page 7 立牌可起立、贴图走 `images-webgl/*.webp`、无 4xx；更广覆盖的肉眼 QA 仍保留。
- 鑑賞层仍是 DOM `<img>`，不退回 canvas flipbook。

## Sprint 14 — 纸张/印刷 shader 与轻量色彩分级（P1，已完成）

目标：学习 Messenger 的 shader-first 思路，把“高级感”更多放到 GPU 规则里，而不是继续堆 PNG。

- [x] 做一个 `PrintedPaperShader` 或等价材质层：纸纤维、墨色微对比、页面边缘轻微暗角、受光方向高光 breakup。
- [x] 翻页叶片加入 bend-dependent 高光/阴影，让页面弯折时有纸张厚度和受力感。
- [x] 立牌材质加入克制的 rim/soft cutout 融合，减少“平贴纸片”的观感；不改变现有锚点和 commentary 数据源。
- [x] 统一轻量 color grade：优先做小型 ShaderPass/LUT 风格映射，配置仍收敛到 `render-config.js`。
- [x] reduced-motion 下禁用所有时间驱动装饰；静态纸纹可以保留，动态噪声必须关闭或冻结到不可感知。
- [x] 不默认重开 BokehPass。DoF 仍是永久 backlog，除非有新的像素/真机证据证明收益大于帧成本。

完成记录：

- 印刷页/封面/纸背继续使用现有 page/cover texture 与 paper PBR maps；材质层通过 `onBeforeCompile` 加入静态纸纤维、墨色微对比与边缘压暗，不新增 raster asset。
- 活动翻页叶片增加独立透明 bend cue overlay，只随 peel/turn 可见；settled pages 不共享动态 uniform。
- 立牌材质保留 raw `TextureLoader` 贴图和 NCC/锚点路径，仅在渲染材质里做 alpha edge softening 与克制 rim。
- 轻量 color grade 接入既有 GrainShader，参数集中在 `render-config.js`；BokehPass 默认仍关闭，tone mapping 仍为 `THREE.NeutralToneMapping`。
- `npm run visual:smoke` 覆盖 1280x800 desktop 与 375x812 mobile：截图写入 `tmp/visual-smoke/`，两端 WebGL 非空、page 7 standee 可起立；mobile 以 reduced-motion 模拟运行且 grain pass disabled。

验收：

- 纸张仍读作“印刷品”，不能变成塑料、玻璃或游戏 UI 面板。
- 像素检查覆盖 avgLum、clipFrac、暗部比例、封面高光、立牌 rim，不破坏当前 NeutralToneMapping 基线。
- 桌面/移动端截图方向一致，不卡顿，不出现静态噪声锁屏感。

## Sprint 15 — 叙事节奏与跨页主事件（P1）

目标：让杂志像一段可交互 editorial tour，而不是功能按钮并列的 3D demo。

- [x] 为每个 spread 标一个主视觉事件：安静阅读、立牌起立、单品解说、look-card、runway、封面/封底仪式感。
- [x] 每个跨页默认只强调一个主事件；其它入口保留但降噪，避免 HUD 同时抢戏。
- [x] 首次进入某类事件时用场景内动势引导，优先通过镜头、光、热点呼吸、纸质吊牌出现来提示，少加说明文字。
- [x] 给 `commentary.json` 增加可选 `beat`/`focus` 元数据（不影响现有 schema）：用于决定镜头轻推、字幕节奏、
      是否自动提示 look-card 或 runway。
- [x] 复查七状态互斥矩阵：`state` / `turn` / `show` / `tour` / `gallery` / `lookCard` / `peel`。新入口必须说明遇到其它状态时是
      close、return 还是 queue。

交付：

- `src/narrativeBeats.js` 作为纯 primary-event resolver；现有 `commentary.json` 无需改动，未来可选补 `beat` / `focus`。
- HUD 增加小型 primary-event chip 与主次按钮状态；`鑑賞`、look-card、tour/commentary、runway 均保留可触达。
- `docs/state-matrix.md` + `npm run narrative:smoke` 覆盖 deep link、gallery landing、look-card、runway/tour、reduced-motion。

验收：

- 首次用户不用键盘也能发现翻页、立牌、鑑賞、单品解说。
- deep link、gallery landing、look-card、runway、reduced-motion 均无状态串扰。
- 每个 spread 的主事件能在 5-10 秒内被理解，不靠读一大段 HUD 文案。

## Sprint 16 — commentary 数据生产闭环（P0）

目标：把“每张图有哪些时尚单品、对应解说、人物对话”做成可重复生产流程，而不是一次性手写。

- [x] 固化 `commentary.json` 生产流程：从 `source.md` / prompt 抽候选单品 → 看 `main-visual.png` 与
      `character-transparent.png` 人工确认 → 写入双语 commentary → 前端读取。
- [x] 每包保留 4-6 个 item，避免为填满热点而写弱单品；宁可少而准。
- [x] `part` 继续使用有限枚举：`jacket` / `top` / `bottom` / `dress` / `bag` / `shoes` / `accessory` /
      `hair` / `makeup` / `other`。前端可按 part 给默认锚点，人工 anchor 只修偏差大处。
- [x] 增加 `voice`、`emotion`、`mouth`、`beat` 等可选字段时必须向后兼容；无语音时系统退化为字幕和吊牌。
- [x] 写一个轻量校验脚本：检查 JSON schema、voice 路径是否存在、item 数量、part 枚举、anchor 范围、locale 字段完整性。
- [x] 随机抽查 3 包：每包肉眼确认热点位置、日文语气、中文释义、表情联动是否合理。

结果（Sprint 16）：

- `docs/commentary-pipeline.md` 固化 schema、authoring workflow、4-6 个强单品策略、normalized `anchor`
  放置规则，以及 `voice` 缺失时的字幕/吊牌降级。
- `npm run commentary:validate` 覆盖 15 包 `commentary.json`：schemaVersion、双语 locale、item 数量、唯一 ID、
  part enum、anchor 范围、expression hint、可选 `beat`/`focus` event type、可选 `voice` 路径存在性。
- `docs/commentary-audit.md` 由 validator 刷新，记录 15 包 / 75 items、part distribution、expression usage、
  optional field usage、voice 空缺状态和 3 包 spot checks。
- 已做语义不变的 enum 归一化：`coat` / `outer` -> `jacket`，`prop` / `umbrella` -> `other`；未改文案、锚点或 item 顺序。

验收：

- 新增/修改 commentary 不需要改 `magazineScene.js`。
- 缺 voice 文件不报错，仍能完整跑字幕、吊牌、巡回。
- schema 校验可以在本地一条命令跑完，并给出可读错误。

## Sprint 17 — 语音数据与 GPT-SoVITS 云端训练（P1，私人 demo）

目标：为杂志解说生成离线语音素材；只服务私人本地 demo，不把真人声优音色作为可发布资产。

- [ ] 数据来源只记录用户自有或可明确授权的素材：已购买/拥有的游戏语音、Drama CD / character voice CD、
      BD/DVD 中足够干净的单人对白、官方广播/访谈片段。避免来源不明的网盘包、二次整理包、盗版合集。
- [ ] 建 `voice-dataset/README`（可放在私有目录，不进仓库）：记录来源、购买/拥有状态、用途限制、是否可公开、处理日期。
- [ ] 切片标准：每句 2-8 秒，单人、无 BGM/SE/混响/重叠对白；爆音、笑声、尖叫、喘息、强情绪噪声直接删。
- [ ] 标注标准：GPT-SoVITS `.list` 格式 `vocal_path|speaker_name|ja|text`；日语 ASR 可用 Faster Whisper，
      但必须手工校对人名、语气词、片假名、标点。
- [ ] 数据量优先级：1-3 分钟跑通管线；10-20 分钟做角色感初版；30-60 分钟做稳定 demo；不要用 1 小时脏数据换表面规模。
- [ ] 训练路线：本机只做清洗/标注/试听；AutoDL/RunPod/Colab 租 NVIDIA 12GB-16GB 显存训练或微调。
- [ ] 旧模型处理：三年前的 `G_*.pth / D_*.pth / config.json` 更像传统 VITS/MoeGoe/CJK VITS，不直接兼容当前
      GPT-SoVITS。可用于临时生成参考音，但正式路线应优先用原始音频重新训 GPT-SoVITS。
- [ ] 输出只落离线音频：生成 `assets/image-packs/N/voice/*.ogg`，不在前端接在线 TTS 服务。

验收：

- 生成 1 个包的完整 voice：`intro` + 4-6 个 item + `runwayIntro`。
- 每条音频响度和尾部静音一致，听感不突兀。
- 仓库不提交原始训练素材、不提交模型权重、不公开真人声优克隆音频。

## Sprint 18 — 语音前端接入与口型同步（P1，已完成）

目标：让语音成为 commentary 的增强层，而不是阻塞功能的依赖。

- [x] 前端按 `commentary.json` 的 `voice` 字段查找音频；不存在则静默退化为字幕。
      （build-time glob `src/voice.js`，缺文件解析为 null，绝不运行期手拼路径 fetch；
      `intro`/`item`/`runwayIntro` 在 `decorateCommentaryVoice` 一次性解析为 `voiceUrl`。）
- [x] WebAudio 总线补齐：语音播放、room tone ducking、打断/切页停止、重复点击去抖。
      （复用既有 `this.audio` 总线，新增 `voiceGain`→`voiceAnalyser`→destination 节点；
      `playVoice`/`stopVoice` 单一进出口，room tone 在活跃时 duck、结束/打断后还原；
      新一条语音 `stopVoice` 上一条，同热点重复点击在 280ms 内去抖。）
- [x] 口型同步先用 `AnalyserNode` 的 RMS 振幅驱动 mouth-open / mouth-closed 两格；没有 mouth 格时只做字幕，不强行闪动。
      （`updateLipSync` 每帧读 RMS；仅当 item 提供合法 `mouth:{closed,open}` 映射且非
      reduced-motion 时切换，写瞬时 mouth UV、不动 `card.cell`，且跳过该卡的眨眼循环避免打架。）
- [ ] 下一轮素材生成 prompt 明确要求 expression sheet 包含闭嘴/张嘴两格，避免用不匹配表情硬凑口型。
      （遗留：当前表情 sheet 无专用 mouth 格，机制已就绪但**可见口型同步待后续 mouth-cell 素材轮次**，
      属 Sprint 17 素材产出后的下一轮；本轮在合成 buffer 上验证机制端到端可用。）
- [x] 每句字幕与音频起止绑定：语音开始显示字幕，结束后按 0.6-1.2 秒淡出；用户翻页/退出 gallery/look-card 时立即清理。
      （`scheduleCaptionFade` 900ms；`stopVoice`+`hideCaption` 接到 beginTurn/foldStandees/
      toggleGallery/openLookCard/startShow/finishShow/endTour 全部七状态拆字幕点。）
- [x] 声音设置暂不做复杂 UI。第一版只提供“有音频则播放 / 用户首次交互后解锁音频 / 无音频退化”。
      （复用既有 `startAudio` 解锁路径，首手势 resume AudioContext，不新增第二个解锁处理。）

验收：`npm run voice:smoke`（真实 Chrome via CDP，合成 AudioBuffer 喂真实语音路径，不提交二进制）
断言手势解锁、字幕显示后清除、analyser 非零 RMS、有 mouth 映射时口型切换/无则不切、行中途翻页停音停字幕、
reduced-motion 音频照常但口型冻结。`npm run build`/`commentary:validate`/`asset:audit`（WebGL drift 干净）/
`narrative:smoke` 全过。详见 `docs/orch/gen_status.md`。

- 浏览器自动播放限制下不会报错；首次点击后可正常出声。
- 语音播放中翻页、打开鑑賞、打开 look-card、startShow/endShow 都不会残留旧字幕或旧音频。
- reduced-motion 不影响音频，但禁用嘴型/表情的快速抖动。

## 沉淀为 skill 的门槛

暂不做全局 Codex skill。等至少完成一轮真实实现并跑过验证后，再把可复用部分提升为
`threejs-visual-system-audit` 或 `magazine-editorial-voice-pipeline` 类 skill。

可提升的只有通用流程：资源体检、shader 机会识别、可选后处理门槛、commentary schema 校验、语音切片标注清单、
真实浏览器视觉验证。不要把 ATELIER 的路径、行号、私有常量、真人声线来源写进全局 skill。

---

# 功能 Roadmap（既有规划）

## 1. 吊牌穿搭解说（方案 4）— ✅ 已实现并接线

> **状态更新（2026-06，第 1 轮亲验）**：本方案**已全量实现并接线**，不再是 Roadmap 待做项。
> 15 包 commentary.json 齐全（schema `commentary-bilingual-v1`），`buildCommentaryUI`（magazineScene.js）
> 建热点圆点 + 纸质 swing tag + 纸绳，点圆点 → `showCommentaryItem` 弹吊牌 + 双语字幕 + 表情联动；
> 「コーデ解説」巡回模式 `startTour`/`updateTour` 自动逐件介绍（每件 ~3.8s）。
> 第 1 轮补齐了曾缺的**发现性引导**（起立后一次性提示「服にふれると、コーデ解説」+ 热点圆点 bloom 强调）
> 与**触屏巡回入口**（HUD `.hud-tour` 按钮，键盘 C 与按钮共用 `toggleTourOnCurrentSpread`）。
> **仍未做**：zoom-to-fabric（点单品推近看面料细节）、TTS 语音（见下「3. TTS 语音」）。

原始设计（保留供参考）：

立牌立起后，身上的时尚单品（西装、针织、长裤、皮包、鞋）浮出热点圆点。
点击圆点弹出**纸质吊牌**（swing tag）显示单品名 + 面料/剪裁点评。
提供「コーデ解説」巡回模式：自动逐件介绍，相机焦点微移到单品、吊牌弹出、
特写卡同步说话，每件 3~4 秒，像一段时装周解说。

- 吊牌是纸艺世界观的原生元素，避免 UI 浮窗
- 文案来源：各包生成 prompt 的第 4、5 节本来就是单品清单，改写即可
- 锚点：按 `part` 字段自动估算（jacket/top/bottom/bag/shoes/accessory），
  manifest 提供 `anchor: [u, v]`（透明立绘画布归一化坐标）时精确放置

## 2. 面部特写立牌（方案 5）

点击立牌人物的脸部区域，弹出半身大特写（第二张立牌，素材用
expression-sheet-transparent 的格子），表情轮播发生在大特写上。
作为解说系统的"讲述者"载体：说话时切换张嘴格，按台词配置表情。

## 3. TTS 语音

用户有雪乃声优的自训 TTS 模型。集成方式：

- 离线生成音频 → 放入 `assets/image-packs/N/voice/`，文件名与 commentary.json 对应
- 播放走现有 WebAudio 总线（音量、与房间底噪的 ducking）
- **口型同步**：AnalyserNode 实时 RMS 振幅驱动特写卡的张嘴/闭嘴格切换
- 台词文本兼作 HUD 字幕；无语音文件时退化为纯字幕，系统不依赖语音
- 生成规格：单声道 ogg/mp3、每句 2~6 秒、响度约 -16 LUFS、采样率 ≥22kHz
- ⚠️ 法务备忘：真人声优克隆音色仅限私人 demo；公开发布需换可商用音色或仅保留字幕

## commentary.json schema（每包一份）

```json
{
  "intro":  { "text": "今日のコーデ、紹介するわね", "voice": "voice/intro.ogg" },
  "items": [
    {
      "name": "アイボリー構造ジャケット",
      "text": "肩線を立体的に見せる構造仕立て。ウール混の張りのある生地よ。",
      "part": "jacket",
      "expression": "smile",
      "voice": "voice/item-01.ogg",
      "anchor": [0.52, 0.30]
    }
  ],
  "runwayIntro": { "text": "…見てて", "voice": "voice/runway.ogg" }
}
```

`part`/`expression`/`voice`/`anchor` 均可选。文案日文为主（与 HUD 同世界观），每包 4~6 件。

## 纸偶走路（已搁置）

曾实现"立牌沿桌面散步 + 两帧定格切换"，但现有动作表是**独立摆拍姿势**，
不构成连续步态帧，逐帧交替观感鬼畜，已移除。恢复条件（二选一）：

- 生成真正的行走循环 sheet：同机位、同景别的连续 2~4 帧步态
- 从可灵走秀视频抽帧制作行走序列（视频本身有连续步态）

引擎侧的滑移+换帧逻辑已删除，设计要点：pivot.x 缓动位移、帧率约 5fps、
步点音效、行进中隐藏表情卡、点击叫停回位。

## 素材待办

- 包 2~5 各补 `action-sheet-transparent.png`（横排姿势、姿势间留整列透明间隙、
  含 1~2 个行走帧）→ 自动解锁全员纸偶走路/姿势轮换
- 包 2~5 各补 `expression-sheet-transparent.png`（3×2 网格）→ 表情卡换透明格
- ~~各包 commentary.json~~（**15 包已全部就位、解说系统已接线**）；仅 voice/ 目录待补 → 解锁 TTS 语音
- 绿幕 sheet 留作图生视频首帧素材（绿幕走秀视频 → 色键上台，
  替代/补充现有暗场方案，管线已预留色键模式开关位）
- 音效素材仍空缺：public/audio/page-turn-01~03、cover-open、cover-close、
  room-tone、runway（规格见聊天记录，即插即用）
