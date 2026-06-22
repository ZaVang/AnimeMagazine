# Project Structure — ATELIER 杂志（持久文件落点地图 / 防漂移）

> Scout 的导航起点；Generator 改代码后**同步更新**此表；Evaluator 守它防漂移。
> 若发现与实际代码不符，在 scout.md B 段记一条漂移，由 Generator 修正。

## 顶层

| 路径 | 角色 |
|------|------|
| `index.html` | 入口 HTML，标题 `ATELIER アトリヱ MAY 2026`，挂 Google Fonts（Italiana / Shippori Mincho），`#root` + `/src/main.jsx`。**H1：`<head>` 含静态 OG/Twitter card meta（og:title/description/image=`/og-cover.png`/type、twitter:card=summary——OG-FIX 后由 summary_large_image 降级，因封面 og-cover.png 是 941×1672 竖图，large 卡会黑边，summary 用方形缩略更稳，且无横图素材故不硬产）+ description。硬约束（注释已写明）：SPA 静态站，meta 无法按 spread 动态化——所有深链分享的预览卡相同，per-spread 需 SSR，超本项目形态** |
| `vite.config.js` | Vite 配置：React 插件、`assetsInclude **/*.exr`、**端口固定 5178** |
| `package.json` | 依赖：three 0.184、page-flip 2.0.7、react 19、vite 8。脚本 dev/build/preview |
| `README.md` | 仅标题（信息少，背景看 docs/） |
| `docs/FUTURE.md` | Roadmap + 12 个已结案 sprint 的完整记录（审计修复史 + 未实施功能规划） |
| `dist/` | 构建产物（`npm run build` 输出） |

## src/（应用代码）

| 文件 | 行数 | 角色 |
|------|------|------|
| `src/main.jsx` | 8 | React 挂载入口，import styles.css |
| `src/App.jsx` | 17 | 薄壳：`useEffect` 里 `new MagazineScene(host).start()`，卸载 `dispose()` |
| `src/preferences.js` | ~113 | **持久化偏好底座（C6）**：单一版本化命名空间键 `atelier.prefs.v1`（`{locale,skipIntro,guidedOnce,lastSpread}`，**CLEAN-1 删 `volume` / CLEAN-2 第 5 轮删 0 引用的 `muted`**）；`loadPreferences`/`savePreferences`/`DEFAULT_PREFERENCES`；缺键/损坏值/存储不可用安全回退默认、不抛错（probe localStorage；旧 blob 残留 `volume`/`muted` 由 sanitize 静默丢弃）。**PREF-1（Iter 4）：新增字段级 `sanitizePatch(patch, current)` 用于 savePreferences merge 路径——坏 patch 字段不再 wipe caller 已存 good 值；blob 级 `sanitize` 保留给 loadPreferences 外部 storage 入口（两者并存）**。被 C7 locale / C9 skip-intro / E5 深链接入。**注意区分 `video.muted`（magazineScene.js 原生属性，未删）** |
| `src/deeplink.js` | ~95 | **深链编解码纯逻辑（E5 + CODEC-1）**：`parseDeepLink(search)→{spread,locale,item}`（越界/非法→null，per-field 回退，永不抛）、`buildShareUrl(base,{spread,locale,item})`、`hasDeepLinkState`。无 DOM/场景依赖、可 headless 断言。URL 参数 `spread`（非负整数锚）+ `lang`（ja\|zh）+ **`item`（CODEC-1：非负整数，optional + nested 依附 spread——孤立 item 忽略、spread null 时 item 一律 null/不输出）** |
| `src/lookCard.js` | ~115 | **CARD-1 卡片数据层纯逻辑**：`buildSpreadCommentaryIndex(STANDEE_SOURCES, pageToSpread)→Map<spread,commentary>`（**R-CARD-DATASOURCE 头号红线：源自 module-level eager commentary + pageToSpread 反查，绝不碰 this.standees**）、`spreadHasCommentary(index,spread)`（入口 guard + 卡数据共用判定）、`buildCardViewModel(index,spread,locale,activeItem)→{title,character,runwayIntro,items[],activeItem}`（per-locale，越界 item→activeItem null）、`isItemInRange`。无 DOM/场景依赖、可 headless 断言 |
| `src/render-config.js` | ~125 | **TECH-1（第 6 轮 Iter 3 抽离）渲染基线常量集合**：`export const RENDER = {renderer:{outputColorSpace,toneMapping,exposure,shadowType}, scene:{bgHex,fogHex,fogNear,fogFar,envIntensity}, lights:{hemi,key,pool,fill,rim}, envMap:{printed,paper,table,spine,coverEdge,standee,swingTag,expression,colophon}, grain:{amount,vignette,runwayDelta}}`。**纯数据 / 0 this 依赖 / 0 异步**；为 tonemap 切换把回归面积从"散落 17 处 grep"压缩到"看一个文件"。**TONEMAP-1 Stage 1（Iter 4）落定**：`toneMapping = NeutralToneMapping`（ACES→Neutral）+ `exposure = 1.18`（补 Neutral 5% 亮度损失）—— Stage 2 fallback (rim/envMap/envIntensity/exposure 降配) NOT 执行（Stage 1 已过 Tier B：avgLum 118 / clipFrac 0 / rim peak 127.7）。**绝不抽**：light.position / shadow.camera / SpotLight 物理参数 (distance/angle/penumbra/decay) / 材质 baseColor hex (spineMaterial / coverEdge 0x2a2018 留在 magazineScene.js)。**绝不包装 light.color**：hex 必须是 numeric literal，由 light 构造函数走默认 sRGB→linear 路径（Iter 2 红线 ③，Iter 4 三方再次延续） |
| `src/styles.css` | ~1233 | 全部 UI 样式：HUD（`.hud-read`/`.hud-tour`/`.hud-locale`/`.hud-share`/**`.hud-card`=CARD-1** pill、`.hud-masthead-actions` 报头动作行、`.hud-character` 报头跟随块）、loader、cursor、鑑賞 overlay、触控/键盘提示（`pointer:coarse` **或** `max-width:640px` 切换；窄屏 `.hud-touch` 上抬 = A1）、响应式。**G1：`.gallery-toc`/`.gallery-thumb` 等。I1：`@media(max-width:640px)` 收口底部 HUD 列（列高 159px→~124px）。CARD-1：`.look-card`（z-index:8 寄生 overlay、scrim+paper sheet、纸色 #f6efe0/墨 rgba(30,24,18,*)/Shippori Mincho 纸艺语汇）/`.look-card-sheet`(375px 全屏可滚 sheet / 1280px 居中 max 560px)/`.look-card-item`(`.is-active` 高亮)/`.look-card-backlink`/`.look-card-share`，reduced-motion 媒体块补 `.look-card` 无过渡** |
| `src/magazineScene.js` | ~4752 | **核心**：three.js 场景 + 全部交互逻辑（下表为行号地图）。TECH-1（Iter 3）后顶部 import 增加 `./render-config.js`；Iter 4 RACE-B-小批 +21 行（3 guards + 解释性注释，openLookCard 头 / hudCard click / toggleGallery 头各 1 处）；行数净 +71 vs Iter 2 末。常量已搬到 render-config.js，逻辑 0 变化 |

## src/magazineScene.js 行号地图（改前先 Read 对应段）

> 行号锚定**函数 def 行**（`^  methodName(`），不锚定函数体内首行 RENDER 引用。Iter 3 Evaluator §10 曾把函数体内首行误当 def 引发"+10 ~ +20 漂移"假报警，本轮已澄清。Iter 5 Scout 实测漂移 +7 ~ +21（createHud 体内 +7 / openLookCard 段 +7~+15 / toggleGallery 体内 + dispose 累计 +21），已批量校正。

| 行号 | 方法 / 段 | 职责 |
|------|-----------|------|
| 238 | `class MagazineScene` | 主类起点（构造器载入 C6 偏好：`this.prefs = loadPreferences()`、`this.locale`） |
| 317 | `initialize`（异步装配） | 装配顺序：…→`loadStandees`（fire-and-forget）→**`applyDeepLink()`（E5，深链优先）→ 否则 `restoreSession()`（C9）**→`animate` |
| 362 | `createRenderer` | WebGLRenderer、DPR/SSAA 上下限（qualityCeil/Floor）。**TECH-1（Iter 3）：outputColorSpace/toneMapping/exposure/shadowMap.type 全部读 `RENDER.renderer.*`** |
| 416 | `createScene` | 场景、雾、环境。**TECH-1：bg/fog hex + fogNear/fogFar/envIntensity 读 `RENDER.scene.*`；bg/fog 仍走 `setHex(LinearSRGBColorSpace)` 路径（Iter 2 红线）** |
| 460 | `createCamera` | 相机 + **竖屏响应式取景**（portraitAmount 等参数化） |
| 497 | `createPostProcessing` | EffectComposer、HalfFloat RT、**BokehPass（默认 enabled=false）**、grainPass |
| 628 | `createPrintedMaterial` / `createPaperMaterial`(658) | 印刷/纸张 PBR 材质。**TECH-1：envMapIntensity 读 `RENDER.envMap.printed/.paper`** |
| 680 | `createLights` | 灯光 + 阴影贴图。**TECH-1：5 光的 color hex + intensity 读 `RENDER.lights.{hemi,key,pool,fill,rim}`；position/SpotLight 物理参数留字面量（Scout C-5 边界）。VIS-RIM-BOOST（Iter 3）：rim.intensity 0.9→1.5 经 render-config 锁定。VIS-TABLE-SYM（Iter 3）：hemi.intensity 0.8→0.95（render-config）+ poolLight.position.x -1.1→-0.6（magazineScene.js 内）** |
| 772 | `createTable` / `createDust`(801) / `updateDust`(848) | 木桌、灰尘微粒。**TECH-1：木桌 envMapIntensity 读 `RENDER.envMap.table`** |
| 863 | `createMagazine` | 杂志总装 |
| 888 | `createPageBlocks` | 页块 + 书脊。**TECH-1：spineMaterial envMapIntensity 读 `RENDER.envMap.spine`；color 0x2a2018 留字面量（材质 baseColor 不抽，Scout C-5）** |
| 943 | `createStaticPages` / `createFlatPage` / `createCover`(968) | 静态页/封面几何。**TECH-1：封面 edgeMaterial envMapIntensity 读 `RENDER.envMap.coverEdge`；color 0x2a2018 留字面量** |
| 1025 | `createTurningLeaf` / `createLeafGeometry` / `updateLeafShape` | 翻页叶片几何与形变 |
| 1162-1223 | `spreadLeftPage`(1162)/`spreadRightPage`(1166)/`pageToSpread`(1178)/`spreadCommentaryIndex`(1194)/`applySpread`(1223) | 正向 spread→page + **反向 `pageToSpread()` 单一真相源（D1，buildStandee 与 D2 退鑑賞回写共用，越界返 null）** + **CARD-1 `spreadCommentaryIndex()`：lazily memoize `buildSpreadCommentaryIndex(STANDEE_SOURCES, pageToSpread)`（一处建、入口 guard + 卡数据两处用、绝不碰 this.standees）** + open 态材质落定 |
| 1508 | `updateParallax` | 鼠标视差 |
| 1562/1623 | `updatePeel`(1562)/`loadStandees`(1623) | 立牌逐帧 build（**C9b：每 build 后补 `syncMasthead(true)`**）/ 翻页掀起手感 |
| 1774 | `buildStandee` | **立牌构建**（逐像素 NCC 分析图/表，依赖未翻转贴图；挂 `commentary`+`spread`，**spread 归属调 `pageToSpread()`**=D1，C8 报头按 `spread` 查角色）。**TECH-1：figure envMapIntensity 读 `RENDER.envMap.standee`** |
| 1901 | `buildCommentaryUI` | 解说 UI（commentary.json 驱动，**已实现并接线**：热点圆点 + swing tag + 纸绳，含发现性 bloom）。**TECH-1：tag envMapIntensity 读 `RENDER.envMap.swingTag`** |
| 2004 | `drawTag` | 立牌 swing tag 画到 canvas 纹理（单品名 + tags，**按 `this.locale` 择一** = C7；locale 切换时 `setLocale` 对可见 tag 重画） |
| 2040 | `showCommentaryItem` | 单件解说（设字幕 + 画 tag），入口 `fadeHint()` 让位字幕（A2） |
| 2088-2133 | `startTour`(2088)/`endTour`(2107)/`currentSpreadTourStandee`(2118)/`toggleTourOnCurrentSpread`(2133) | 巡回开始（入口 `fadeHint()` = A2）/收尾 + 当前跨页解说立牌查询 + 巡回开关（键盘 C 与 HUD 按钮共用） |
| 2142 | `updateTour` | コーデ解説巡回模式 |
| 2333 | `buildExpressionCard` | 表情卡构建。**TECH-1：photo envMapIntensity 读 `RENDER.envMap.expression`** |
| 2467-2488 | `maybeShowStandeeHint`(2467)/`maybeShowStandeeGuide`(2488) | 起立前「点她」一次性提示 / 起立后「服にふれると、コーデ解説」发现性引导（once-guard `standeeGuideShown`；**A3：文案无条件出、bloom 脉冲仅 `!reducedMotion` 时设**） |
| 2508-2616 | `startShow`(2508)/`endShow`(2589)/`finishShow`(2600)/`applyShowDim`(2616) | 暗场走秀状态机。**TECH-1：applyShowDim 中 `grainPass.uniforms.uVignette.value = RENDER.grain.vignette + RENDER.grain.runwayDelta * eased`，与 GrainShader 默认共用同一 `RENDER.grain.vignette`，物理上锁死 Iter 2 同步规则** |
| 2643 | `updateShow` | 走秀每帧推进 |
| 2688/2717 | `foldStandees`(2688)/`updateStandees`(2717) | 立牌起立/折叠（delta 驱动，可确定性推进）；含解说热点 bloom 发现性强调（DISC-1）。**`foldStandees(true)` = 即时折叠全部非 folded 立牌原语，D2 退鑑賞回写前置调它保「退出后当前跨页立牌全折叠」** |
| 2922/2941 | `enterClosedBack`(2922)/`enterClosedCover`(2941) | **封底/封面专门落定路径**（含右堆位移复位）。closedBack/closed 几何不变量，D2 退鑑賞回写对应分支调它，**不可套用 open 态 restoreStacks/applySpread** |
| 2956-3027 | `finishTurn`(2956)/`updateTurn`(2989)/`openMagazine`(3013)/`closeMagazine`(3027) | 翻页与开合状态机（settle-open 处调 `recordSpread()`=C9；open 完成态调 `markGuided()`=C9；close 完成态几何 = `enterClosedCover` 参考） |
| 3096 | `updateCamera` | 相机缓动 + 响应式应用 + DoF 联动（intro 段 `introComplete` gate；C9/E5 `landOnSpread(snapCamera)` 跳过它直接置 `introComplete=true`） |
| 3177-3198 | `portraitAmount`(3177)/`applyResponsiveCamera`(3186)/`applyResponsiveTarget`(3198) | 竖屏取景计算 |
| 3218-3239 | `createLoader`(3218)/`setLoaderProgress`(3232)/`finishLoader`(3239) | 加载动画 |
| 3250/3390/3414 | `createHud`(3250)/`syncHud`(3390)/`syncTourButton`(3414) | HUD 构建（含 `.hud-read` 鑑賞、`.hud-tour` 解说巡回、`.hud-locale` 语言切换 = C7、`.hud-share` 分享 + `.hud-masthead-actions` 行 = E5、`.hud-character` 报头跟随块 = C8）/ 页码同步 / 巡回 pill 逐帧显隐 |
| 3423-3480 | `syncLocaleButton`(3423)/`currentSpreadCharacter`(3435)/`syncMasthead`(3450)/`syncCardEntry`(3480) | C7 语言按钮态同步 / C8 当前跨页角色查询 + 报头跟随（按 locale 显示人物，无角色回退固定刊名，diff-guard 每帧跑；**C9b：`loadStandees` 每立牌 build 后补 `syncMasthead(true)`**）/ **CARD-1 `syncCardEntry()`：`.hud-card` pill 显隐 guard，state==open && 有 commentary（走 `spreadCommentaryIndex`，不碰 this.standees）才显，由 `syncMasthead` 末尾调** |
| 3494-3547 | `setCaption`(3494)/`hideCaption`(3502)/`setLocale`(3511)/`fadeHint`(3547) | 字幕（**单 locale 渲染 + 记住源字段**=C7）/ locale 切换（**`setLocale(locale,{persist})`：persist=false 给 E5 深链临时应用语言不写 C6**，重渲字幕+tag+masthead+按钮）/ hint 淡出 |
| 3555-3617 | `recordSpread`(3555)/`markGuided`/`landOnSpread`(3581)/`restoreSession`(3617) | **C9 会话连续性 + E-kernel**：记录上次跨页 / 标记已引导 / **`landOnSpread(idx,{persist,snapCamera})` = 共用落定内核**（restoreSession / D2 退鑑賞回写 / E5 深链共用一套 open 态不变量，persist 开关控制是否写回 lastSpread）/ 回访跳过 intro 落 last spread（委托 landOnSpread，`initialize` 末尾调用） |
| 3634-3690 | `applyDeepLink`(3634)/`currentShareUrl`(3667)/`copyShareLink`(3690) | **E5 深链 + CODEC-1**：`applyDeepLink` 解析 URL→临时落定 spread+locale（persist:false 不污染本地进度/语言，深链优先于 restoreSession）→ **`item!==null && isItemInRange` 时直开卡（`openLookCard(landed,item)`，取数走 module-level 索引不依赖 standee build；越界 item 不开空卡）** / `currentShareUrl` 生成分享链接（closed→spread0、closedBack→末跨页，**卡开时带当前 item**）/ `copyShareLink` 复制 + flash 兜底 |
| 3742-3924 | `openLookCard`(3742)/`renderLookCard`(3841)/`escapeHtml`(3903)/`closeLookCard`(3910)/`copyLookCardLink`(3924) | **CARD-1 看卡**：`openLookCard(spread,item)`（寄生 overlay 挂载、与鑑賞互斥先 closeGallery、guard 走索引、reduced-motion 守、backlink 走 `landOnSpread(persist:false)`、卡/item 不 persist）/ `renderLookCard`（按 locale 渲染字段，setLocale 时若卡开则重渲=per-locale 红线）/ `closeLookCard`（reduced-motion 同步移除）/ `copyLookCardLink`（卡内分享，带 item）。键盘：卡开时 Esc/Space 关卡、吞其它键（`handleKeyDown` 顶部） |
| 4033/4074 | `startAudio`(4033)/`playSound`(4074) | WebAudio 总线（音频文件缺失时应静默降级） |
| 4088-4162 | `bindEvents`(4088)/`handleKeyDown`(4109)/`handleKeyUp`(4162) | 事件绑定（Space=鑑賞、Esc=退出、方向键=翻页/视角） |
| 4170 | `updateRigInput` | 键盘自由视角 rig |
| 4188-4486 | `galleryEntries`(4188)/`galleryStartIndex`(4203)/`toggleGallery`(4216)/`galleryFlip`(4440)/`closeGallery`(4447)/`applyGalleryLanding`(4486) | **鑑賞 DOM 翻页书**（StPageFlip，loadFromHTML 真实 img 页）。**G1（缩略图目录）：`toggleGallery` 内建 `.gallery-toc`（全屏栅格，复用每 entry 的 `.src`/`.label`）+ `⊞` 切换按钮 `.gallery-toc-toggle`；闭包 `setToc(open)`（守 reducedMotion 直接显隐，否则 deferred is-on）/`syncTocActive`（高亮读 `getCurrentPageIndex()` 夹取后真实 index）；点缩略图→`pageFlip.turnToPage(i)`（DOC-FIX：page-flip 2.0.7 实测**会** emit 一次 flip 事件，已绑的 flip 监听本可同步 chrome；手动 `syncChrome()` 是冗余保险，保留无害）→`syncChrome()`+`syncTocActive()`+`setToc(false)`。`g` 上挂 `tocOpen`/`setToc`。键盘：TOC 开时 Esc/Space 关 TOC（非关鑑賞）、方向键被 TOC 吞。** **D2：`closeGallery` 退出读当前页→`applyGalleryLanding` 按 entry.key 前置三特判（cover→closed / colophon→末跨页 open / back→closedBack）+ page 类走 `pageToSpread`→`landOnSpread`，回写前先 `foldStandees(true)`。J1：cover/back 专路分支补 `syncHud()`（原只 recordSpread+syncMasthead，漏页码标签同步）** |
| 4528/4547 | `handleResize`(4528) / `animate`(4547) | resize / 主循环（animate 内每帧调 `syncTourButton`+`syncMasthead`） |
| 4603/4613 | `anyStandeeUnfolded`(4603)/`shadowsNeedUpdate`(4613) | 阴影按需刷新判定 |
| 4646/4690 | `trackFrameQuality`(4646)/`applyQuality`(4690) | 自适应画质（持续掉帧→降分辨率档位） |
| 4697 | `dispose` | 清理（含 `window.__magazineScene` 注销） |
| **render-config.js** | — | TECH-1 抽离的渲染基线常量集合（见上方表格） |

## assets/ 与 public/

| 路径 | 内容 |
|------|------|
| `assets/image/` | 封面/封底/内页 1-20 png + 角色 transparent/chromakey/background-only 分层 |
| `assets/image-packs/N/`（1–15） | 每包：`commentary.json`、`images/`、`manifest.json`、`prompts/`、`source.md`（**15 包全有 commentary.json**，schema `commentary-bilingual-v1`；解说系统已实现并接线，见 buildCommentaryUI/startTour） |
| `assets/image-packs/overview-*.png` | 总览/动作/表情/透明 sheet |
| `assets/pbr/`、`public/pbr/` | 纸张 paper_0026 / 木桌 wood_0066 的 color/normal/roughness/ao 2k 贴图 |
| `assets/backup/` | 备份素材（如 cover-extra-2026.png） |
| `public/audio/`（规划） | 音效：page-turn-01~03、cover-open/close、room-tone、runway —— **多数仍空缺** |
| `scripts/` | Python 素材脚本（create_live2d_draft_psd.py、create_popup_psd.py） |
| `prompts/` | 各包生成 prompt（1.md~18.md） |

## docs/（product-loop 通信，见 SPRINT.md 表）

`docs/plans/SPRINT.md`（合同）、`docs/plans/pitfalls.md`（坑）、`docs/project_structure.md`（本文件）、
`docs/orch/*`（reviewer 报告 / scout / plan / negotiation / gen_status / eval）。
