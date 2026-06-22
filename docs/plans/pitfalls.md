# Pitfalls — ATELIER 杂志（踩过的坑知识库）

> 全角色必读。Generator / Evaluator 在 sprint 结束追加新坑。初始条目从 docs/FUTURE.md 的
> 12 个已结案 sprint 与项目记忆中提炼，避免重蹈覆辙。

## 预览 / 验证

- **`preview_screenshot` 会超时**：本应用是持续 rAF 的 three.js canvas，headless 标签页
  `visibilityState=hidden` → rAF 暂停、setTimeout 被节流到 ~1s。不要靠它截图。改用 SPRINT.md
  「如何体验本产品」配方：`window.__magazineScene`（DEV）+ `preview_eval`，`composer.render()` 后
  同步 `drawImage`+`toDataURL`。
- **审计 prompt 里的 `node .claude/scripts/get_page_state.js` 在本仓库不存在**，执行会失败。忽略它，
  用上面的 preview 配方。
- **鑑賞 overlay 是 DOM `<img>` 不在 canvas 上**：canvas 像素捕获看不到它，要用 DOM/getBoundingClientRect 验证。
- `preview_resize` "desktop" 预设重启后可能回 0/native size，**显式传 width/height**（1280×800、375×812）。

## 渲染 / 画质

- **模糊的真因是高清内容欠采样，不是 three.js 慢**：内页是 **941×1672 美术图**（DOC-941 第 6 轮迭代 / Iter 1 校正——此前文档反复误述为 "2048²"，实测全仓 cover/back/1/2/3.png/og-cover 等 PNG 皆 941×1672）、掠射角观看 → 纹理细节多于
  屏幕像素。**MSAA 只修边缘修不了内部细节**；必须 **SSAA**（渲染到原生以上再缩采样）才能同时锐化边缘+内部。
  SSAA 下限 = 原生 DPR（绝不低于屏幕，杜绝放大糊），上限 `min(dpr×2, 2.0)`。**941×1672 是素材层天花板——SSAA 再调高也救不回，提清晰度只能重出更高清素材。**
- **后期管线用离屏 RT 时，渲染器 `antialias:true` 会被忽略**（默认帧缓冲 AA 在管线里无效）。
- **景深 BokehPass 默认关闭**（`enabled=false`）：杂志在对焦面上，DoF 只糊远处地板，却是逐帧最贵、
  随像素数放大。要恢复电影感删那一行即可。自适应控制器现在**只管分辨率档位**，景深不是性能档位。
- 阴影 `shadowMap.autoUpdate=false`，仅在投影体（开合/翻页/立牌）运动时刷新（`shadowsNeedUpdate`+settle 尾帧）。
  静止冻结复用上一张——改动阴影/新增投影体时记得触发刷新，否则阴影不更新。

## 加载 / 纹理

- **内页/封面走 `ImageBitmapLoader` 离主线程解码**（`imageOrientation:'flipY'` + `texture.flipY=false`
  复刻原朝向、消除 flipY 警告）。**立牌相关贴图必须保持 `TextureLoader`（raw，不翻转）**——`buildStandee`
  逐像素分析图/表，bitmap 预翻转会破坏裁剪与网格切分。
- `rasterPageLuma` 对 bitmap 内页分析时要翻回正向，否则「立绘 vs 印刷」匹配坐标系错乱、立牌锚点漂移。
- 立牌 NCC 分析重（`rasterAlphaMask`/`matchFigureToPrint`）：`loadStandees` 每个 `buildStandee` 后
  `await` 让出一帧，把 15 个立牌分散到多帧，否则一次性卡住主线程。

## 取景 / 响应式

- 竖屏取景集中在 `createCamera`（参数化 `portraitAmount/portraitFovGain/portraitPullZ/Y/portraitRecenter`）。
  窄屏优先拉 FOV 而非单纯拉远（省、不至于把杂志缩成小块）。aspect ≥ 0.92 时 `portraitAmount=0`（桌面无回归）。
- **不要做激进的 3D 单页取景**（Sprint 7 已否决）：会破坏「纸艺摊桌」观感与翻页动画。细读走鑑賞 overlay。
- 移动端 375px 验证：关闭态封面完整入框（报头/「08」不被裁）、展开态左右两页全可见不溢出。

## 鑑賞 / 翻页书（StPageFlip）

- **程序化 `turnToPage(i)` 的 `flip` 事件不可跨版本依赖——必须手动兜底同步（G1 + 第 4 轮 eval 实测，page-flip 2.0.7）**：`turnToPage(t)` 内部走 `pages.show(t)`（snap，无翻页动画）。**第 4 轮 Evaluator 亲验（eval.md:101）：在 2.0.7 该 build 下 `turnToPage` 实测会 emit 一次 `flip` 事件**——故 G1 缩略图点击处理里手动 `syncChrome()`+`syncTocActive()` 是**冗余保险**（事件本会触发同步，功能正确无碍）。修正第 4 轮前的早期论断「完全不触发 flip」：那是不成立的。但 page-flip 各版本对 `show()` 是否 emit `flip` 行为不一致，**不可依赖该事件冒泡跨版本稳定** → **任何按 index 跳页（缩略图目录跳页）后仍应手动调 `syncChrome()`+`syncTocActive()` 兜底**（保留即可、无害），不把同步逻辑只挂在 `on("flip")` 上。`show(t)` 内部对 `t<0||t>=count` 早退（不抛），但代码仍应先 `THREE.MathUtils.clamp` 取真实 index。
- **目录"当前页高亮"读 `getCurrentPageIndex()` 夹取后真实 index，不读外部原始参数（G1 红线）**：深链 `?spread=999` 被 `landOnSpread` clamp 但原始值仍越界 → 若用原始值 findIndex 会丢高亮。`syncTocActive` 读 `pageFlip.getCurrentPageIndex()` 再 clamp。**desktop 双页跨页时 `turnToPage(8)` 会归一到该跨页左页 index 7** —— 高亮落 7（label P.08）是正确的"显示了哪个跨页"，非 bug。
- **目录栅格进出守 `this.reducedMotion`（G1 红线）**：`setToc(open)` 在 reducedMotion 下直接 `hidden=false`+同步加 `is-on`（开）/ `hidden=true`（关），不走 deferred setTimeout；scrollIntoView 用 `behavior:'auto'`。styles.css reduced-motion 媒体块同步给 `.gallery-toc` 无过渡。
- **目录寄生于 `.gallery` overlay 内、不另开盖 3D 的层**：`.gallery-toc` 是 `.gallery` 的子层（z-index:7 在 overlay 内部），跳页留鑑賞内、不退回 3D；退出仍复用 D2 `applyGalleryLanding` 回写，零新增落定路径。目录文案勿暗示"鑑賞跟语言变"（鑑賞是烤死双语印刷图，DOC-2）。

- **必须用 `loadFromHTML`（真实 `<img>` 页）而非 `loadFromImages`**：后者画到非 DPR 感知的 canvas，
  高分屏重新变糊；真实 DOM `<img>` 浏览器永远按原生分辨率栅格化，任何 DPR 都清晰。
- 响应式：`usePortrait`+`minWidth:260`（阈值 ~520px）→ 手机单页竖排、平板/桌面双页跨页。
- 换翻页书后**移除了旧的捏合缩放**（StPageFlip 不内置）。要放大细看小字需另加「双击 → 单页缩放灯箱」。
- 鑑賞打开时**跳过 3D 渲染**（场景被全覆盖）省 GPU，关闭即恢复。

## 表情卡 / commentary 联动

- **`EXPRESSION_HINTS` 必须覆盖 commentary 实际用到的全部 hint**：commentary.json 用了
  `neutral`/`smile`/`thinking` 三种；早期 map 只有 `{neutral:0, smile:1}`，`thinking` 经
  `setExpressionHint`（`cell===undefined` 早退）静默 no-op。Sprint 1 已补 `thinking:2`
  （3×2 表情 sheet 的 cell 2，跨包 1/5/8 实测均为「侧目 / 手托腮」的沉思格，语义吻合）。
  **改文案新增表情类别时，记得同步扩 map**，否则又静默失效。
- **表情 sheet 的网格朝向不统一**：代码硬编码 `EXPRESSION_COLS=3, EXPRESSION_ROWS=2`（横 3 竖 2），
  但**包 11 的 expression-sheet 是竖 3 横 2（2 列 3 行）**，会被 UV 切分错位。这是素材层不一致，
  非本轮 FIX-1 范围（FIX-1 只补 hint 映射）。要彻底修需按包检测网格形状或统一重出素材。
- 表情卡眨眼用的是**逐 sheet 动态检测的 `card.blinkCell`**（`detectBlinkCell`），不是静态 hint map；
  若某包检测出的 blinkCell 恰好等于 `thinking` 的 cell 2，该卡在 thinking 姿势下不眨眼——属无害降级，非 bug。

## 鑑賞 退出回写 / 落定状态机（D 组 / E 组，第 3 轮新增）

- **page→spread 反查唯一真相源是 `pageToSpread()`（~994）**：buildStandee 与 D2 退鑑賞回写共用它。它对越界/非数字 page 返回 `null`（而非误判到 spread 0）。任何"按 page 反查跨页"的新代码都走它，别再手抄遍历。
- **鑑賞 entry 的 `.page` 字段缺口**：`galleryEntries()`（~3646）里 **cover / colophon / back 三个 entry 无 `page` 字段**（只 page 类 `p{N}` 有）。盲走 `pageToSpread(entry.page)` 会 `undefined→null→spread 0`（"封底细读完退出却跳回封面"）。**D2 `applyGalleryLanding` 必须前置 `key==='cover'/'colophon'/'back'` 三分支特判**，page 类才走反查。
- **封底/封面落定走专门路径，不可套用 open 态助手**：closedBack 几何在 `enterClosedBack()`（2702，右堆位移 `rightBlock.x=-PAGE_WIDTH/2`、右页隐藏），closed 在 `enterClosedCover()`（2721，右堆位移复位 `+PAGE_WIDTH/2`）。**`restoreStacks`/`applySpread` 只覆盖 open 态不变量**——任何"落定到 closedBack/closed"的新路径（D2 退鑑賞、未来深链落封底）必须调专门路径，否则右堆位移不还原、留隐藏右页。
- **退鑑賞回写前必先 `foldStandees(true)`**（2479，即时折叠全部非 folded 立牌原语）：保不变量"退出后当前跨页立牌全折叠"，不出现旧跨页立牌悬在新跨页上。
- **共用落定内核 `landOnSpread(idx,{persist,snapCamera})`（3316）**：restoreSession（C9）/ D2 退鑑賞回写 / E5 深链恢复都走它，防三份逻辑漂移。`persist` 控制是否写回 lastSpread，`snapCamera` 控制是否跳过 intro 直接 snap 取景。内部 clamp 越界 idx。

## 深链 / 持久化（E5，第 3 轮新增）

- **深链临时态绝不污染持久态（红线）**：`applyDeepLink()`（3369）用 `landOnSpread(spread,{persist:false})` + `setLocale(locale,{persist:false})` 落定，**绝不写回 `lastSpread`/`locale` 到 C6**——否则"点朋友的链接冲掉自己的进度/语言"。用户在深链落定后**自己**继续浏览/切语言才正常 persist。深链优先于 restoreSession（`initialize` 里 `if(!applyDeepLink()) restoreSession()`）。
- **URL↔状态映射纯逻辑隔离在 `src/deeplink.js`**（无 DOM/场景依赖，可 headless 断言）：`parseDeepLink` 对越界/非法参数 per-field 返回 null（永不抛），返 `{spread,locale,item}`（**CODEC-1 第 5 轮加 `item`**，nested 依附 spread）；`buildShareUrl` 丢弃非法 locale、省略空 spread、item 仅在有 spread 时输出。改 URL schema 只动这一个文件。
- **masthead 回访冷启动竞态根因（C9b 已修）**：`void loadStandees()`（fire-and-forget）+ 同步落定路径的顺序，保证落定期 `syncMasthead(true)` 跑在立牌 build 前 → `currentSpreadCharacter()` 遍历空 Map 返 null → 缓存无角色 key（`spread:locale:0:state`）。真机每帧 `animate` 自愈只闪数百 ms，headless rAF 暂停才"卡住"。修法：`loadStandees` 每个 `buildStandee` 后补 `syncMasthead(true)`（立牌就绪即重渲）。**任何依赖 `this.standees` 已填充的初始化期同步调用都有此竞态。**

## F 组素材硬约束（zoom-to-fabric 推迟，第 3 轮归档）

- 全仓**无 fabric/swatch/macro 素材**，最高清 `1-character-transparent.png` 941×1672（且唯一 transparent），garment 锚点映射区仅 ~200px。**zoom-to-fabric 受素材上限，放大到屏宽即清晰极限，再放大即糊**（同"模糊真因是欠采样"）。任何"看清面料"功能在更高清面料素材到位前只能做"印刷特写卡"美学，勿承诺真·微距。`anchorToFlat`（~1775）返**世界坐标**非屏幕矩形——DOM 灯箱要用 `item.anchor[x,y]` 在图像像素系直接裁。

## 传播 / OG meta（H1，第 4 轮归档；N-3/N-4 第 5 轮归档）

- **SPA 静态 `<meta>` 无法按 spread / 按卡片动态化（硬约束）**：`index.html` `<head>` 的 OG/Twitter card meta 是**纯静态**——分享 `?spread=3` 与 `?spread=7`、乃至 `?spread=3&item=2`（卡片深链）抓取到的预览卡完全相同（同封面 `/og-cover.png` + 同标题）。bot 不执行 JS，**per-spread 与 per-card 预览均需服务端渲染 / 预渲染**（超本项目形态，是 localhost 静态站）。**补 meta / 写文档时勿假装 per-spread / per-card 预览**，已在 index.html 注释诚实标注。（卡片 PNG 导出 + QR 是绕过此限制的手动流通，stage B 进阶增量，第 5 轮不做。）
- **og:image 必须放 `public/` 才有稳定 URL**：`assets/image/` 经 Vite 哈希重命名、构建后 URL 不稳；H1 把封面复制到 `public/og-cover.png`（Vite 原样拷到 dist 根），meta 引 `/og-cover.png`。改/换预览图只动 `public/og-cover.png`。
- **OG 竖图黑边素材约束（N-4，OG-FIX 已收）**：`og-cover.png` 是 941×1672 竖图（= cover.png 拷贝），`twitter:card=summary_large_image` 期望 ~1.91:1 横图 → 竖图被信箱化黑边。**全仓无现成 1200×630 横图素材**（皆 941×1672 竖图封面 + 941×1672 内页 — DOC-941 第 6 轮迭代 / Iter 1 校正，此前误述为"2048² 内页"），从竖图裁 1200×630 会丢杂志大部分版面。**OG-FIX 修法（第 5 轮已落）：把 `twitter:card` 降级为 `summary`（小方卡框竖图不黑边）+ index.html 注释诚实标注**——不硬产横图（不为凑横图拉伸/糊化封面，留待有设计环节出 bespoke 横图）。

## コーデ / 角色卡（CARD-1 + CODEC-1，第 5 轮归档）

- **🔴 卡片数据源竞态红线（N-1，头号）**：**卡片/单品深链取数必须走 module-level `spread→commentary` 索引**（`buildSpreadCommentaryIndex(STANDEE_SOURCES, pageToSpread)`，在 `src/lookCard.js`；commentary 原始数据走 `import.meta.glob({eager:true})`（magazineScene.js:31）模块加载即同步就绪），**不走 `this.standees`/`currentSpreadCharacter()`**（后者遍历运行期逐帧 build 的 `this.standees`，深链 `?spread=N&item=M` 直开卡时 `loadStandees` fire-and-forget 未 build 完 → 取空数据，C9b 冷启动竞态翻版，pitfalls C9b 条已记）。索引纯函数、无场景依赖、可 headless 断言。`spreadCommentaryIndex()`（magazineScene.js ~1009）一处建、入口 guard（`syncCardEntry`）与卡数据（`openLookCard`/`renderLookCard`）两处用、防漂移。
- **codec item nested 约束（N-2）**：`?item=M` 是 **optional + nested** 依附 `spread`（deeplink.js `parseDeepLink` 在 `result.spread!==null` 时才解析 item）；孤立 `?item=2`（无 spread）忽略 item；item 越界 → `isItemInRange` false → 落整页不开空卡（`applyDeepLink` 守）；旧 `?spread=N` 缺省 item = 落整页 = 零破坏。**绝不新增 `?char=` 等第三/第四平行参数**（P-4 扁平化退化预警）。`buildShareUrl` 加 item 时 spread null 则不输出 item。
- **卡片寄生 overlay 不污染 3D 落定**：`.look-card`（styles.css，z-index:8）是寄生在 canvas 上方的独立 overlay（同 `.gallery` 范式，非第二张盖 3D 的 canvas）；与鑑賞翻页书互斥（`openLookCard` 先 `closeGallery`，`handleKeyDown` 卡开时吞 Space/Esc 关卡而非开鑑賞）。**卡片/item 状态绝不 persist 到 C6**（backlink 走 `landOnSpread(persist:false)`）；进出动效守 `reducedMotion`（卡开/关、scrollIntoView 均显式守）。鑑賞印刷图烤死双语切不了，**卡片相反是结构化双语 JSON、`setLocale` 时若卡开则 `renderLookCard` 即时重渲**（卡片是第一个真双语细读载体）。

## 通用

- magazineScene.js 单文件 **~4731 行**（第 6 轮 Iter 3 后；Iter 2 末 ~4681 → TECH-1 抽 render-config + 视觉项注释 +~50 行；常量本身已被搬到 `src/render-config.js`，逻辑 0 变化）：改前**先 Read 相关段**（见 docs/project_structure.md 的行号地图），不要盲改。卡片数据层 + codec 纯逻辑抽在 `src/lookCard.js` / `src/deeplink.js`，渲染基线常量集合抽在 `src/render-config.js`（**TECH-1 第 6 轮 Iter 3 抽**，headless 可断言，不进 4731 行巨石）。
- **`volume`（CLEAN-1）+ `muted`（CLEAN-2，第 5 轮）prefs 字段均已删**：preferences.js 现存 `{locale,skipIntro,guidedOnce,lastSpread}`；`muted` 跨 3 轮 0 引用、其铺路对象（静音开关）已定不做（无音频素材），第 5 轮诚实清掉。**注意区分 `video.muted`（magazineScene.js:2501 原生属性，视频静音自动播放需要，未删）**。旧 blob 残留 `volume`/`muted` 由 `sanitize` 静默丢弃（只拷贝已知字段），不报错。
- **I1 承载验收口径校正（DOC-FIX-B，第 5 轮）**：第 4 轮 I1「底部 HUD 承载」验收措辞用「底距 > 改前 12px」，但**实现路径是腾「列顶上方净空」**（收紧底部 `.hud-status` 列 + 折叠装饰行 `.hud-rule`，列高 159px→~124px；eval.md:131 亲验）。两者目标等价（都腾垂直预算），但「底距」口径与「列顶净空」实现路径错位——正确口径应为「**列顶上方净空 ≥ Npx**」。卡片入口在顶部 `.hud-masthead-actions`（top-left），**不占底部 HUD 垂直预算**（故 CARD-1 入口承载实为独立、不与底部 HUD 争地）。
- WebAudio：多数音效文件仍空缺（public/audio/*），`startAudio`/`playSound` 在文件缺失时应静默降级，勿因此抛错。
- 真人声优克隆 TTS 仅限私人 demo；公开发布需换可商用音色或仅保留字幕（法务备忘）。

## 渲染 / 画质（第 6 轮迭代 / Iter 1 新增）

- **加灯必须同步 `this.lightLevels` + `applyShowDim`**（VIS-RIM 同模式坑）：`startShow`（~:2508）首次 lazy 捕获当前灯亮度入 `this.lightLevels`，`applyShowDim`（~:2616）走秀 dim 时按各灯独立衰减系数 lerp 到 0；后续 `finishShow` 走 `applyShowDim(0)` 复位。**新增的任何光源**（如本轮 `rimLight`）若漏注册，走秀时该光不衰减（"走秀里灯还亮着"）、走秀切回不复位（"回来灯没回去"）。本轮模板：`rim: this.rimLight?.intensity ?? 0` 入 lightLevels + `this.rimLight.intensity = L.rim * (1 - 0.95 * eased)` 入 applyShowDim。
- **GrainShader 的 reduced-motion 守优先用 `enabled` 而非 `uAmount`**（BUG-GRAIN-RM 同模式坑）：noise hash 是 `(vUv, uTime)` 的函数，停 uTime（旧路径）让 noise 停在固定 hash → 屏幕长出"静态颗粒"（比动颗粒更显眼，违背 reduced-motion 意图）；改 uAmount=0 仍走着色器。**正解**：`this.grainPass.enabled = !this.reducedMotion` 一次性在 `createPostProcessing` 末尾或 reducedMotion 改变时 set，零着色器成本绕过整个 pass。走秀 `applyShowDim` 对 `uVignette` 的 lerp 在 reduced-motion 下不可见，是可接受代价（reduced-motion 用户接受少特效）。
- **fog.near < cam→lookAt 距离才有效**（BUG-FOG-NEAR 同模式坑）：three.js 雾在相机空间用 `length(viewPos)` 计算渐变，fog.near 是相机空间的"开始有雾的距离"。`cameraOpen=(MAGAZINE_X, 2.96, 3.72)` 望 `targetOpen=(MAGAZINE_X, 0.07, -0.03)`，cam→lookAt ≈ 4.73m；旧 fog.near=5.2 > 4.73 → **整个场景在 fog 起点之前，fog 配色等于摆设**。本轮 fog.near=2.8，留 ~1.9m focused 前景。**改 cameraClosed/cameraOpen 距离时必须同步检查 fog.near 是否仍 < 该距离。**
- **自适应画质升档分支必须重置 backoff**（BUG-QUALITY-STUCK 同模式坑）：`trackFrameQuality` 降档 `q.backoff = min(backoff*2, 16)` 单向涨到上限；旧升档分支只 `q.since=0` 不动 backoff → 一旦降到底，cooldown = `5 * backoff` = 80s/step 且即便升档了 backoff 仍 16，**真实用户切 tab 几次就永久糊化**。修法两件事：(a) 升档加 `q.backoff = max(1, backoff/2)`（对称回落）；(b) `visibilitychange` listener 在 tab 回来时把 `backoff=1; ema=SMOOTH; since=0; lastRawFrame=now`（防 rAF 暂停累积假信号）。**任何"自适应"算法的模式**：降档累积成本应可逆。
- **`.gallery-toc-toggle` 与 `.gallery-close, .gallery-nav` 视觉契约靠 selector 合并**（BUG-TOC-TOGGLE 同模式坑）：CSS 5 轮欠债是因为 `.gallery-toc-toggle` 单独写 `top/right` 却没继承 `position:absolute` → 坐标失效、按钮渲染到 (0,0) 与 `.gallery-label` 重叠（但 z-index 不冲突仍可点 → DOM 状态断言看不出，肉眼独占回归）。本轮把它加入共享 selector 群组。**任何后续新增"右上角浮窗按钮"必须加入同一群组**（`.gallery-close, .gallery-nav, .gallery-toc-toggle`），否则复刻同样的 5 轮欠债。
- **Audit 报告色值不一定准**（VIS-EDGE-COLOR 同模式坑）：第 6 轮产品官 P6 报告写 "edgeMaterial 0x110f0e 太黑"——但代码里 edgeMaterial 是 0xf4eee3 米色（页缘）、spineMaterial 才是 0x171311（书脊条，**这才是太黑的对象**）。报告色值可能来自肉眼推断 / OCR / 局部样区，Generator **务必按变量名定位、不按色值定位**，再核对该变量在代码里的当前值是否与报告口径一致。本轮本来要改 spineMaterial 不是 edgeMaterial。

## 渲染 / 画质（第 6 轮迭代 / Iter 2 新增）

- **非 map hex 色值在 `ColorManagement.enabled=true` 下双转吞色**（VIS-SRGB-FIX 同模式坑，r0.184 默认）：`new THREE.Color(hex)` 把 hex 当 sRGB 输入 → 内部转 linear 存；与 OutputPass 的 sRGB encode 叠加理论 round-trip 恒等，**但 ACES tonemap 在低光值（0x18130e 量级）的 S 曲线压得最狠**，导致 Iter 1 源码写 0x18130e 实测 bg.r×255 ≈ 2（不是期望的 24）。**正解**：`new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace)`（three.js 官方在 `Color.setHex` 第二参数 docs 给的路径），声明 hex 已是 linear、跳过转换。**注意**：map 贴图走 `texture.colorSpace = THREE.SRGBColorSpace` 是**另一条**正确路径（"贴图本身是 sRGB 编码、采样后转回 linear"）——别把这条路径也切 LinearSRGB，会全场回归。**只对 background / fog / material.color 这类"直接被 OutputPass 处理"的色值切**，light.color 不切（详见下条）。
- **light.color hex 与 background/material color hex 在 ColorManagement 下的路径差异**（VIS-SRGB-FIX 红线 ③）：light.color 走 shader uniform 到 PBR 光照计算（已在 linear 空间），双转影响小；切 `LinearSRGBColorSpace` 反而让 light 在感知上"少一档暖"。background / fog / material.color 走 OutputPass，必须切。Iter 2 sRGB 修**只切 background / fog / material.color 子集，不切 light.color**——任何下轮"系统性 sRGB 修补"建议都不要扩到灯色。
- **PCFSoftShadowMap 在 r0.184 已 deprecated**（BUG-SHADOWMAP-DEPRECATED 同模式坑）：常量名 alias 到 `PCFShadowMap` + 控制台每次 fresh load warn ×2（[three.js #32591](https://github.com/mrdoob/three.js/issues/32591)）；新 `PCFShadowMap` 本身已是 soft 实现，所以撤回别名 = 消 warn + 视觉零变化。**任何"shadowMap.type 改 PCFSoft"的建议都先核当前 three.js 版本是否仍支持**；老资料/教程 / 三方 audit 把 PCFSoft 当作"软阴影开关"是落后于 r0.184 的认知。**不要换 VSMShadowMap** —— 视觉漏光风险（需 blurSamples 调）高于"消 warn" 的收益。
- **createCover 内 edgeMaterial 与 createPageBlocks 内 edgeMaterial 同名不同物**（VIS-COVER-EDGE 同模式坑，**Iter 1 漏改的真黑边来源**）：前者（createCover ~:968）是封面四周薄边（旧 0x110f0e 死黑、Iter 2 修到 0x2a2018），后者（createPageBlocks ~:888）是页缘（米色 0xf4eee3，不动）。Iter 1 Generator 改 spineMaterial 时按变量名定位正确，但**漏扫了 createCover 内的同名变量**——本轮补齐。任何"调暗/暗化 magazine 边缘"建议必须按变量 + 文件 location（函数作用域）**双重定位**，不要被 grep 全文同名混淆。
- **toggleGallery / 任何"切层 toggle 路径"必须清在飞的 this.turn**（BUG-GALLERY-RACE-A 同模式坑，5 轮无人 catch 的真状态机 race）：场景"settle turn 在飞 → 用户进鑑賞 → 从鑑賞跳到非 stale-target 跨页退出"下，关 gallery 后第一帧 `updateTurn` 看到 stale settle 已超 duration → 触发 `finishTurn` → `spreadIndex = turn.targetSpread` clobber 刚由 `closeGallery → applyGalleryLanding` 写好的 spread。**复位用"四件套"与 `finishTurn` 完全对齐**（this.turn = null + turningPage.visible=false + turningPage.rotation.z=0 + turningPage.position.y=TURN_BASE_Y），不只 `this.turn = null` —— 只 null 化会留 turningPage 在 stale 旋转/位置（下次开关 gallery 视觉上飞一帧）。`openLookCard` / `startShow` / `startTour` 目前都在 settled-open 状态调用、用户已经历 turn 完结，不命中——但**模式应归档**，未来新增任何"切层 toggle"都要扫一遍 `this.turn` 是否清。
- **dispose 必须清所有 timer**（BUG-DISPOSE-SHARE-TIMER 同模式坑）：`shareFlashTimer` / `cardShareFlashTimer` 模式对称、命名也对称，但 Iter 1 dispose 只清了后者——未来加新 flash timer / 任何 `this.xxxTimer = setTimeout(...)` 字段都必须同步加 dispose 清。**模式扫描**：本轮 Scout 同模式查到 `closeGallery` / `closeLookCard` 内 `setTimeout(() => g.el.remove(), 380/320)` 两处无 id 字段，目前 callback 不引用 this 实际不抛错，**本轮不动避免触碰已稳定路径**——但**未来新增"DOM remove 延时"务必分配 id 字段**供 dispose 清。
- **GrainShader uVignette 默认值与 applyShowDim 走秀起点必须同步改**（VIS-VIGNETTE-RIM 同模式坑）：GrainShader 默认是闲态值、applyShowDim 内是闲态 + 0.3 走秀增量；**只改其中一处会让走秀进入时基底跳一档**（闭态用新值、走秀用旧值 + 0.3 偏移）。Iter 2 0.32 → 0.20 两处一起改、增量 0.3 不动。**TECH-1（第 6 轮 Iter 3）后此规则被物理锁定**：两处都读 `RENDER.grain.vignette` / `RENDER.grain.runwayDelta`，silent desync 物理上不可能再发生。未来调任何"由 applyShowDim 联动的 grain uniform 默认值"只需改 render-config.js 一处。

## 渲染 / 画质（第 6 轮迭代 / Iter 3 新增）

- **render-config.js 抽离边界 = "渲染基线 + 光照 hex/intensity + envMap 桶 + 后期 grain"四层，不含材质 baseColor / 物理布置**（TECH-1 同模式坑 / Scout C-5 边界）：Iter 3 抽 `src/render-config.js` 把散落 17 联调点位集中到一个 ~117 行的常量文件。**应抽**：`renderer.{toneMapping,exposure,outputColorSpace,shadowType}` / `scene.{bgHex,fogHex,fogNear,fogFar,envIntensity}` / `lights.{hemi,key,pool,fill,rim}` 的 `hex` + `intensity` / `envMap.{printed,paper,table,spine,coverEdge,standee,swingTag,expression,colophon}` 9 桶 / `grain.{amount,vignette,runwayDelta}` 3 项。**绝不抽**：① `light.position` / `shadow.camera` 边界 / SpotLight 物理参数 `(distance,angle,penumbra,decay)` —— 属于"光物理布置"非"风格 config"；② 材质 baseColor hex (spineMaterial 0x2a2018 / cover edgeMaterial 0x2a2018) —— 属"材质美术资源"层、扩进 render-config 会让语义边界模糊；③ `applyShowDim` 内 lerp 系数 0.96/0.95/0.78/1/0.95/0.97 —— 是"走秀戏剧化曲线"逻辑、不是数据；④ `lightLevels` lazy 抓机制 / `qualityFloor/Ceil/pixelRatio` 自适应输入 / PMREM `0.04` 模糊度——状态机或算法输入。**任何后续轮次"扩 render-config"的提议必须先把候选数值分门别类、问"是 config 还是逻辑/物理布置/材质"，不能图省事把所有数值一锅烩抽出**。
- **light.color hex 抽离保留 PBR 默认路径**（TECH-1 + Iter 2 红线 ③ 延续）：抽到 `RENDER.lights.{hemi,key,pool,fill,rim}.hex` 的颜色字段是 **numeric literal**（如 `0xfff4e4`），被 `new THREE.HemisphereLight(skyHex, groundHex, intensity)` / `new THREE.DirectionalLight(hex, intensity)` / `new THREE.SpotLight(hex, ...)` 构造函数默认走 sRGB→linear 路径。**绝不包装成 `new THREE.Color().setHex(hex, LinearSRGBColorSpace)`** —— 包装后 rim 会少一档暖（破 Iter 2 红线 ③）。bg/fog hex 是 numeric literal、caller 写 `setHex(hex, LinearSRGBColorSpace)` 走 Iter 2 sRGB-FIX 路径 —— 抽到 render-config 后调用端形态仍是 `new THREE.Color().setHex(RENDER.scene.bgHex, THREE.LinearSRGBColorSpace)`，**第二参 LinearSRGBColorSpace 保留**。
- **`applyShowDim` 内 grain vignette 起点与 GrainShader 默认值被 TECH-1 物理锁定**（Iter 2 VIS-VIGNETTE-RIM 升级版）：两处都引用 `RENDER.grain.vignette` + `RENDER.grain.runwayDelta`，**结构性消除**"两处独立字面量必须同步改"的 Iter 2 反复点名的同模式坑。未来若要再调 vignette 基线，只改 `render-config.js` 一处即可（applyShowDim 自动跟随）。
- **tonemap 切换 timing 延后 Iter 4 决策点**（Iter 3 Planner 2:1 多数派裁决）：本轮（Iter 3）2:1 反对本轮切（Experience 倾向不切 + Evolution 明确不切 vs Research 主张本轮切），Planner 接受多数派。**Iter 4 接力清单**（信息性，留 Iter 4 Reviewer + Planner 真机审）：① 头号决策：`renderer.toneMapping` ACES → Neutral（render-config 一行改）；② **exposure 方向是 Planner 第二决策点（两位 reviewer 方向相反）**：Research 1.02→1.18 补 Neutral ~5% 亮度损失 / Evolution 1.02→0.90 配 envIntensity 全局 -15%——Iter 4 Planner 必须裁决；③ 配套 16 联调点位（envIntensity 全局 -15% / 5 灯 intensity 微调 / 9 envMap 桶 -15% / 2 light color 去暖一档 key 0xffe4c3→0xffeeda + rim 0xfff0d8→0xfff4e0），TECH-1 抽离后这些点位全部集中在 render-config.js 单文件、回归面积可视化；④ 验收门（Evo 给）：avgLum/256 ∈ [0.42,0.50] / darkFrac<0.05 / brightFrac>0.20 / bg.r×255 ∈ [22,26]；⑤ 强烈建议作为独立 git commit（可一键 revert）。**Iter 3 不切**写死避免下轮再议。
- **视觉项必须逐项独立验收**（Iter 3 同模式坑，避免外溢一锅烩教训）：本轮 4 个视觉项（VIS-RIM-BOOST / VIS-TABLE-SYM / VIS-FOG-FAR / DOC-LINEMAP）相互独立、可逐项独立验收，**绝不一组提交一组验收**——任一项回归不应牵连其它项。模式归档：未来"多个视觉项打磨"任务（如 Iter 4 若批量动 16 联调），即使全部要做也应每项独立 commit + 各自 headless 像素层断言，避免"一项有问题 → 全部回滚"的尴尬。
- **VIS-TABLE-SYM "桌面前左右对称"的根因是 SpotLight 位置**（Iter 3 同模式坑）：Iter 2 实测桌面前左 lum 73 vs 前右 131（1.8:1）——根因不是 keyLight（DirectionalLight 对水平地面**均匀光照**，整张桌面亮度同值）也不是 fillLight（同 DirectionalLight），而是 **`poolLight` SpotLight 的 cone 中心偏左**（Iter 2 位置 x=-1.1 偏离 magazine 中心 MAGAZINE_X=-0.36），cone penumbra 落到前左/前右的衰减不对称。Iter 3 把 poolLight.position.x -1.1→-0.6（更接近 MAGAZINE_X）+ hemiLight.intensity 0.8→0.95（uniform 抬底）。**任何"桌面亮度左右不对称"的修法必须先识别哪个光是 finite-range（SpotLight/PointLight 有 cone，DirectionalLight 没有），再调它的 position/target/angle**，不是盲调 fill/hemi。
- **VIS-RIM-BOOST 1.5 与 applyShowDim 走秀复位的物理验证**（Iter 3 同模式坑）：Iter 3 把 rim intensity 0.9→1.5（render-config）；走秀路径走 `lightLevels.rim ??= this.rimLight?.intensity ?? 0`（lazy 抓 `startShow` 时的当前值）+ `applyShowDim` 的 `L.rim * (1 - 0.95 * eased)`——**lazy 抓自动跟新值，不需要重新接线**。但**回归门必须验**：(a) `applyShowDim(0)` 复位后 rimLight.intensity === 1.5（不是 0.9）；(b) lightLevels 在 startShow 后含 `rim: 1.5` 键。**任何调整已注册到 lightLevels 的光强度，都需跑这套复位验证**（不必新增同步逻辑，但需头号验收）。

## 渲染 / 画质 + 状态机 + 文档卫生（第 6 轮迭代 / Iter 4 + Iter 5 新增）

- **fog 远端衰减验收 ROI 必须固定在远端区，不能跨杂志/桌面/背景三材质交界**（VIS-FOG-FAR 验收口径同模式坑，第 6 轮 Iter 3 → Iter 4 暴露）：Iter 3 VIS-FOG-FAR 验收门要求"10 行水平带 bandMaxStep ≤ 12"，但 Iter 4 Experience 论证 bandMaxStep 49.5 远超 12 与 fog 无关——根因是"10 行水平带从画面顶部到底部纵向取样、跨杂志高光/桌面木纹/背景墙三种材质交界"，material 交界处 lum 突跳本就 >12，与 `scene.fog.near/far` 调整毫无因果。**正解**：任何 fog 相关验收 ROI 必须**固定在远端单一材质区**（如桌面深处 z > -3 的窗口、或背景墙顶部、或杂志上方天空区），不能跨整画面纵向 10 行带。**模式归档**：未来任何"全图直方图断言 + 整画面取样"的验收门都要先问"取样区是否跨材质交界"——bandMaxStep / 桌面对称比 / 顶部 dark band 等都可能踩同样的坑（DOC-FOG-ROI 接力）。
- **savePreferences patch 必须 per-field validate 再 merge，blob 级 sanitize 不能替代**（PREF-1 同模式坑，第 6 轮 Iter 4 latent bug 修）：旧路径 `sanitize({...loadPreferences(), ...patch})` 让坏 patch 字段先覆盖 loaded 旧 good 值、再被 blob 级 sanitize 因"类型不对"回默认——结果磁盘上 `lastSpread=7` 被 `savePreferences({lastSpread:"abc"})` 静默 wipe 回 0。当前 3 个 caller 都送 well-typed 值、线上不可达，但**契约不安全**：未来某 race 路径下 caller 不慎传 NaN/null/undefined（如 landOnSpread 在某 race 下读到 spreadIndex 为 NaN），用户的 lastSpread/locale 等持久 good 值会被静默 wipe。**正解**：新增字段级 `sanitizePatch(patch, current)` 函数（per-field validate：locale 走 SUPPORTED_LOCALES 检 / skipIntro+guidedOnce 走 typeof boolean / lastSpread 走 Number.isInteger 且 ≥0），坏字段不污染 next、good 字段 merge 过去；blob 级 `sanitize` 保留给 `loadPreferences` 外部 storage blob 入口（两者并存）。**模式归档**：任何 merge partial update over current 的 API 必须 patch 级 sanitize，blob 级 sanitize 不能替代——否则坏 patch 字段 wipe 旧 good 值，违反 merge 契约。检测脚本可 headless 断言（disk 起点 + patch + disk 终点 三段对比）。
- **新加 overlay / 入口必须扫七问 state-guard 矩阵**（RACE-B 同模式坑，第 6 轮 Iter 4 race B 七问归档）：本产品有七个互斥/串行状态：`state`（封面/封底/打开）/ `turn`（在飞翻页）/ `show`（暗场走秀）/ `tour`（解说巡回）/ `gallery`（鑑賞翻页书）/ `lookCard`（角色档案卡）/ `peel`（拖拽预览翻页）。Iter 4 Evolution §5.2 发现 4 个 race B 候选（同模式坑：A 状态进入时未 guard B 状态在跑）：① `show→openLookCard`（深链直开卡时 show 仍在跑）；② `tour→openLookCard`（hudCard click 时 tour 仍在跑）；③ `lookCard→toggleGallery`（按 G 打开鑑賞时 lookCard 仍在）；④ `turn→openLookCard`（翻页飞行中 raycast 命中报头 card 入口）。**正解**：任何新加 overlay 或入口加入七状态家族时，必须扫七问矩阵——"我开 X 时，state/turn/show/tour/gallery/lookCard/peel 在跑该怎么办"逐项问；与 toggleGallery 内 `if (this.gallery) this.closeGallery()`、`if (this.tour) this.endTour()` 既有模板对称，单行 `if (this.X) return false` 或 `if (this.X) this.closeX()` 防御 guard。**模式归档**：state-guard 不齐的 race B 在 headless 与正常路径都极难暴露（需要构造 cross-state 复现路径），但一旦命中就是 clobber 或 stale data 类故障——本产品 5 轮内 race A（toggleGallery stale turn clobber spreadIndex）+ race B 4 候选都是同模式（5 轮无人 catch 到 Iter 4 才系统性扫一遍）。
- **TONEMAP-1 两阶段方案实际落定 = Stage 1 即 PASS、Stage 2 fallback 未触发**（Iter 4 实测沉淀、给下个 Sprint 类似切换路径参考）：Iter 4 commit `7c08edb` 仅切 `render-config.js` 内 `toneMapping=Neutral` + `exposure 1.02→1.18`（2 字段、~30 bytes、magazineScene.js 0 字面量 delta）。Tier B 6/6 实测：`avgLum/256` 0.467（avgLum 119.4，目标 [0.42, 0.55]）/ `clipFrac` 0.0%（红线 <0.5%）/ rim 顶部 peak < 248（红线 <248、实测 69.5 安全余量极大）/ `brightFrac>180` 19.7%（目标 [15, 28]）/ `darkFrac<32` 0.058%（目标 <5%）/ `bg.r×255` 24（目标 [22, 28]）——全部超额过门、Research 三道红线（clipFrac / rim peak / avgLum）全部安全余量 >50%。**Stage 2 fallback 按 plan §527 禁止启动**（"若阶段 1 PASS 6/6 禁止额外做阶段 2 的预防性改动"）—— rim 1.5 / env 0.55 / envMap 9 桶 / exposure 1.18 全部 Iter 3 末值不动。**接力提示**：① TECH-1（Iter 3）抽 render-config 的红利在本轮 100% 兑现，是"结构性投入二次回报"模板；② 类似 tonemap / colorspace 切换路径建议先尝试 Research A3 风格"最小动作 + 严验收门"路线，再决定是否启动 Experience 风格"预防性降一组"路线；③ Tier A/B/C/D 验收门拆分（runtime 常量 / 像素直方图 / 走秀路径 / 真机肉眼）是本轮三方融合产物，值得复用。
- **dev server stale-module 警告 → 复验前必须 `location.reload()`**（Iter 5 新沉淀，Scout 提议）：Vite HMR 在 `render-config.js` 等数据模块改后，旧 module 仍在内存里直到 reload；`window.__magazineScene` 引用的常量是 stale 值。下个 Sprint Evaluator 在跑 Tier B 像素直方图复验前必须先在 preview_eval 里 `location.reload()` 一次再取 scene 引用，否则会拿到旧 toneMapping/exposure 值，"明明 commit 已生效但 headless 断言失败"。**模式归档**：所有"改了 render-config / 任一被 magazineScene 初始化时一次性读入的常量后跑 headless 验收"路径必须前置 reload。
- **隐喻措辞统一为"深夜印刷间"，不是"晨光"**（Iter 5 新沉淀，Research 提议；A3 落定后设计哲学收口）：5 轮在"晨光印刷间" vs "深夜印刷间"之间反复摇摆，A3（bg=0x18130e 暖暗 + fog 同 hex + Neutral 保色 + rim 1.5 暖描边）落定后 Research Iter 4/5 终判 = 物理结构对应**深夜印刷工作室**，不是晨光。**晨光的物理结构**会要求更高 avgLum、冷白窗光（HemisphereLight 窗光是晨光语言）、更高 fill —— 与现状不符。**模式归档**：未来调任何"时段感"措辞前，先核当前 bg / fog / rim / tonemap 物理参数对应的语义，不要让文案与物理结构脱钩；HemisphereLight 窗光提议 Iter 4 拒绝就是这条规则的应用例。
- **NeutralToneMapping 常量值 id=7 不是 6**（Iter 5 新沉淀，Iter 4 Evaluator 发现）：三方文档（reviewer 报告 + Iter 4 plan）多处把 `THREE.NeutralToneMapping` 写作 6，但 r0.184 源码常量实际是 **7**（`NoToneMapping=0` / `LinearToneMapping=1` / `ReinhardToneMapping=2` / `CineonToneMapping=3` / `ACESFilmicToneMapping=4` / `CustomToneMapping=5` / `AgXToneMapping=6` / `NeutralToneMapping=7`）。Iter 4 落地时用的是 `THREE.NeutralToneMapping` 引用、不是写死数字，故 commit 正确；但**任何文档断言"toneMapping === 6"或"toneMapping === 7"的写法都是脆弱**——升 three.js 版本时常量值可能再变。**模式归档**：① 文档引用 tonemap 常量按 `THREE.NeutralToneMapping` 引用（语义）、不要写死数字（数值）；② Headless 断言用 `renderer.toneMapping === THREE.NeutralToneMapping` 而非 `=== 7`；③ render-config.js 已正确走 `import * as THREE` + `THREE.NeutralToneMapping` 路径，下个 Sprint 不动。
