# SPRINT — ATELIER アトリヱ（product-loop 合同）

> 本文件是 product-loop 全角色的共享合同。Tier1 on（mode=all）：每轮三审产出审计报告 →
> Planner 在此追加本轮任务 → Generator 实现并勾选 → Evaluator 独立复验。
> 终止语义：tier1 on = 跑满 max_iter（5 轮），Evaluator 决策仅信息性。

## 产品背景

- **产品名称**：ATELIER アトリヱ（MAY 2026 / VOL.08）—— 一本「会动的 3D 数字时尚杂志」。
- **产品简介**：three.js 渲染的纸艺杂志摊在木桌上，可拖拽翻页、点击让纸片立牌从页面立起（招牌交互）、
  暗场走秀、表情卡；想细读时进「鑑賞モード」DOM 翻页书（StPageFlip，原生清晰 + 真实翻页）。
  定位是**3D 氛围装置**而非轻量电子书（架构决策见记忆 keep-threejs-3d-installation，**勿重新论证拆掉 three.js**）。
- **技术栈**：Vite 8 + React 19 + three.js 0.184 + page-flip 2.0.7。核心逻辑集中在 `src/magazineScene.js`（~3543 行）。
- **启动方式**：`npm run dev`（Vite，**端口 5178**，见 vite.config.js）。构建：`npm run build`。
- **访问地址**：http://localhost:5178

## ⚠️ 如何"体验"本产品（关键 —— 替代审计 prompt 里那条不存在的脚本）

**注意**：审计 prompt 里写的 `node .claude/scripts/get_page_state.js` **在本仓库不存在**，不要执行它。
本产品是**持续 rAF 的 three.js canvas**，`preview_screenshot` 会超时（headless 标签页 `visibilityState=hidden`，
rAF 被暂停、setTimeout 被节流）。请改用下面这套已验证的配方：

1. **起服务**：用 `preview_start`（或确认已有 dev server 在 5178）。如端口被占，Vite 会自增端口——以实际端口为准。
2. **DOM 层可直接看**：HUD、鑑賞 overlay（鑑賞モード 的 DOM 翻页书 `<img>` 页）、loader 都是真实 DOM，
   用 `preview_snapshot` / `preview_inspect` / `getBoundingClientRect` 读取，不依赖 canvas 截图。
3. **驱动 3D 场景**：DEV 下场景实例暴露为 `window.__magazineScene`（`preview_eval` 可访问）。
   - 取像素需在**同一同步 tick** 内：`s.composer.render()` 后立刻 `drawImage(canvas,...)` 到离屏 canvas 再 `toDataURL()`
     （canvas 未开 `preserveDrawingBuffer`）。
   - 时间驱动动画（`openMagazine`~1.55s、`closeMagazine`~1.25s、翻页 settle）需真实流逝时间：`await` 真实延迟后
     调 `s.animate()` 几次。delta 驱动动画（立牌 `updateStandees(0.05, t)`）可用固定 0.05 delta 循环确定性推进。
     相机缓动：`s.updateCamera(0.05, performance.now())` 循环 ~60 次落定。
   - 要把帧落盘：可临时在 vite.config.js 加 `/__cap` POST 中间件写 dataURL 到 `tmp/`，**用完务必还原、勿提交**。
4. **审美评估的现实**：headless 下逐帧视觉极难拿全。请以 **源码（styles.css / magazineScene.js 的取景/配色/排版段）+ DOM 状态 + 能抓到的少量帧** 为依据做审美判断，不要假装看过流畅动画。
5. `preview_resize` 的 "desktop" 预设重启后可能回 0/native，显式传 `width`/`height`（如 1280×800、375×812）。

## 当前状态（已完成，**不要重复造**）

12 个 sprint 已结案（详见 docs/FUTURE.md，逐条核对再下结论）：品牌一致性、触控可用性、HUD 可读性、
移动端取景、鑑賞整本顺序浏览、发现性引导、渲染清晰度（SSAA 自适应画质）、加载期离主线程解码、
稳态减负（默认关景深）、鑑賞 → StPageFlip DOM 翻页书。已有系统：拖拽翻页、立牌、表情卡、暗场走秀、
观赏/鑑賞模式、键盘视角、自适应画质、WebAudio 音效总线（音频文件多数仍空缺）。

## Roadmap 上未实施的方向（仅供参考，最终以审计报告为准）

见 docs/FUTURE.md「功能 Roadmap」：① 吊牌穿搭解说（热点圆点 → 纸质 swing tag → コーデ解説巡回）
**已实现并接线**（15 包 commentary.json 齐全、schema `commentary-bilingual-v1`、buildCommentaryUI/startTour 工作中），
第 1 轮补上了发现性引导与触屏巡回入口，仍缺 zoom-to-fabric；② 面部特写立牌（点脸 → 半身大特写、表情轮播、解说载体）；
③ TTS 语音（自训声优模型，口型同步 + 字幕降级）。素材待办：音效文件、voice/。

## 验收命令（Generator 跑 / Evaluator 独立复跑）

> 本产品无单测；验收以「构建通过 + 运行期无报错 + 关键 DOM/场景状态符合预期」为准。

```bash
# 1) 生产构建必须通过（最硬的回归门）
npm run build

# 2) 构建产物存在
ls -la dist/index.html dist/assets 2>/dev/null

# 3) 运行期验证（按上面「如何体验」配方，用 preview_eval 驱动 __magazineScene / 读 DOM）：
#    - 控制台无 error / 无 WebGL 报错（preview_console_logs / preview_logs）
#    - 本轮改动涉及的功能：对应 DOM 出现且布局不重叠（375px 与 1280px 都查）
#    - 若动了 3D 场景：__magazineScene 能 new + start 不抛错，关键方法可调用
```

## 任务清单

> Planner 每轮在此**追加** `## 第 N 轮追加任务`，Generator 完成后把 `[ ]` 勾成 `[x]`。

（首轮尚无任务——等 Reviewer 审计 + Planner 规划后填充。）

## 第 1 轮追加任务（基于 Reviewer 审计）

> 本轮主线：**让已建好的解说深度被发现、被触屏用户够到**（三审 + Scout 一致的最高杠杆）。
> 外加顺手修文档漂移与 EXPRESSION_HINTS 既存 bug。不碰 three.js 渲染管线，低回归。

- [x] DISC-1: 解说发现性引导
  - 目标：立牌起立后，让用户第一时间知道"身上能点、有穿搭解说"，不再让全量实现的解说系统埋没。
  - 验收：`npm run build` 通过且运行期 0 error；立牌起立落定后出现一次性引导（提示文案 + 解说热点的更醒目可视强调），可被用户的下一次交互正常打断/消解；reduced-motion 与"本会话已引导过"下不重复打扰；375px 与 1280px 下引导元素均正确显示、不与既有 HUD/表情卡重叠。

- [x] DISC-2: 解说巡回（tour）触屏入口
  - 目标：把当前仅键盘可达的解说巡回，变成触屏与桌面都能点的屏上入口。
  - 验收：`npm run build` 通过且运行期 0 error；当前跨页存在已起立且带解说的立牌时，HUD 出现可点的解说巡回入口，点击即进入巡回，与键盘入口行为一致；无可巡回对象 / 鑑賞中 / 走秀中时入口不出现；点击该入口不会穿透触发翻页或立牌交互；375px 与 1280px 均正确显示且不与其它 HUD 元素重叠。

- [x] DISC-3: HUD 提示按视口宽度而非仅指针类型切换
  - 目标：窄屏但被报为精确指针的环境，不再铺满无用的键盘快捷键提示。
  - 验收：`npm run build` 通过；在窄视口（含被报为 fine 指针的情形）下展示触屏向提示而非整行键盘快捷键，宽桌面视口仍展示键盘提示；375px 与 1280px 两档表现符合预期、无空行/重叠。

- [x] FIX-1: EXPRESSION_HINTS 表情联动修复
  - 目标：修复 commentary 中使用的表情线索因映射残缺而静默失效的既存 bug，让解说/巡回时的表情联动按数据生效。
  - 验收：`npm run build` 通过且运行期 0 error；commentary/巡回触发各表情线索时表情卡按预期切换、不再静默无反应；表情格映射经实际素材核对正确，无越界取格。

- [x] DOC-1: 修正文档漂移（解说系统已实现）
  - 目标：把"吊牌穿搭解说仅包 1 / 未实施"的过期描述，更正为"15 包 commentary 齐全、解说系统已实现并接线，缺的是发现性/触屏入口"。
  - 验收：FUTURE.md、project_structure.md、SPRINT.md 中关于 commentary 覆盖范围与解说系统实施状态的描述与现状一致，不再把已实现的当待做。

## 第 2 轮追加任务（基于 Reviewer 审计）

> 本轮主线：**先修第 1 轮自己引入的三处回归（便宜、属正确性，必做），再落地"产品外壳"依赖链——持久化底座解锁 locale 切换、masthead 跟随角色、skip-intro**。
> 不碰 three.js 渲染/相机/取景管线，低回归。B 组（鑑賞缝合 / View Transitions）、zoom-to-fabric、音频素材留到第 3 轮起。

- [x] A1: 窄屏底部 HUD 元素重叠修复
  - 目标：立牌起立后，窄屏下解说巡回入口不再与触屏操作提示重叠，让用户两条提示都能完整读到。
  - 验收：`npm run build` 通过；375px 立牌 risen 时，解说巡回入口与触屏操作提示的 `getBoundingClientRect` 不相交；1280px 仍不重叠（无回归）；元素配色/字体/间距与既有 HUD 语言一致。

- [x] A2: 巡回/解说开始时发现 hint 让位
  - 目标：进入解说或巡回后，已完成使命的发现性引导提示淡出，不再与正在显示的解说字幕在底部中央堆叠。
  - 验收：`npm run build` 通过且运行期 0 error；点热点进入单件解说、或启动巡回后，发现 hint 的 opacity 趋 0、不与解说字幕同区重叠；后续引导（再次起立/走秀等）仍能正常复显该 hint（fade 非单向死锁）。

- [x] A3: reduced-motion 不再吞掉解说发现文案
  - 目标：开启减弱动态的用户，立牌起立后仍能拿到"衣服可点、有穿搭解说"的静态引导文案，只是不播放热点脉冲动效。
  - 验收：`npm run build` 通过且运行期 0 error；reduced-motion=true 时立牌起立后发现 hint 文案正确出现、热点无脉冲；reduced-motion=false 时文案与脉冲均如常；一次性引导守卫不受影响（不重复打扰）。

- [x] C6: 持久化偏好底座
  - 目标：建立全产品第一个偏好持久化层（默认值 + 读写 + 版本化命名空间），作为 locale / masthead / skip-intro 等外壳功能的共享地基。
  - 验收：`npm run build` 通过且运行期 0 error；偏好以单一版本化命名空间键持久化、刷新后保留、缺键/损坏值时安全回退默认；无文件 / localStorage 不可用时静默降级不抛错；该底座至少被一个可见功能（C7 或 C9）实际接入而非空壳。

- [x] C7: locale 切换 + 默认单语
  - 目标：把当前"日文+中文字幕永远同屏硬堆"改为按偏好显示单一主语言（默认日文）、可一键切换中文，并记住选择。
  - 验收：`npm run build` 通过且运行期 0 error；默认仅显示主语言字幕（不再双语同屏）；提供可点的语言切换入口，切换后当前字幕、吊牌（立牌单品名/标签）、随角色文案即时按新语言一致呈现，无"字幕切了、吊牌还旧语言"的半切态；语言偏好刷新后保留；375px 与 1280px 下切换入口正确显示、不与其它 HUD 元素重叠。

- [x] C8: masthead 跟随当前角色
  - 目标：让 HUD 报头随当前跨页的角色变化（按所选语言显示人物信息），把已有的双语人物元数据曝光出来，合页无角色时回退到固定刊名文案。
  - 验收：`npm run build` 通过且运行期 0 error；切换到带解说立牌的跨页时，报头按当前 locale 呈现该角色信息；切到无 commentary 立牌的跨页回退固定刊名文案、不残留上一角色；与 C7 的语言选择一致联动；375px 与 1280px 显示均不溢出/不重叠。

- [x] C9: skip-intro 回访恢复
  - 目标：曾访问过的回访者再次进入时，跳过电影化 intro 直接落到上次阅读的跨页；首次访问仍完整播放 intro。
  - 验收：`npm run build` 通过且运行期 0 error；首次访问（无持久化记录）完整播放 intro；带"已引导/上次页码"记录的回访直接落到上次跨页的开合定态、不重放 intro、关键几何/状态不变量正确（不出现错页立牌悬空、页材质/可见性错位）；上次页码刷新后保留。

## 第 3 轮追加任务（基于三审审计 + Scout 接地）

> 本轮主线：**统一"阅读/落定"状态机 + 让杂志可传阅**——把鑑賞从"用完即焚的弹窗"缝回 3D 状态（D 组），
> 并把"停在哪一跨 + 什么语言"编码进 URL 让杂志可分享（E 组），外加两处小修。
> 围绕一个共享的"落定内核"（`landOnSpread` 思路）让 D2 退鑑賞回写与 E5 深链恢复走同一套不变量、不各写一份。
> **全程不碰 three.js 渲染/相机/取景管线**（守 keep-three.js 红线 + 低回归基调）。
> F 组 zoom-to-fabric 本轮**推迟**（全仓无 fabric 宏观素材，最高 941×1672，放大即糊——定位待更高清素材）；
> 设置面板留第 4 轮，音频留素材批次。理由逐条见 negotiation.md。
>
> 依赖顺序：D1（纯函数）→ E 落定内核重构（persist-aware）→ D2（退鑑賞回写，复用内核）→ E5（深链核心，复用内核）→ D3（morph，可选）→ 小修。

- [x] D1: 抽 page→spread 反查纯函数
  - 目标：把当前散落在立牌构建里的"page→spread/side 反查"收敛成一个单一真相源的纯函数，供立牌构建与退鑑賞回写共用；正向 spread→page 映射已有，本任务只统一反向那一份。
  - 验收：`npm run build` 通过且运行期 0 error；立牌构建行为完全不变（零回归，立牌锚点/起立 spread 归属与改前一致）；该纯函数对每个合法 spread 满足"正反互逆"（对任意 spread s，反查其左页与右页都应映射回同一个 s）；对不存在的 page 返回明确的"无"而非误判到某个 spread。
  - 来源：研究 R1/Phase 3.1、Scout D1、进化 Technical Health。

- [x] D2: 退鑑賞回写阅读位置（修两层 desync，硬验收）
  - 目标：用户在鑑賞翻页书里翻到任意页后退出，3D 杂志要落到鑑賞当前页对应的那一跨（含正确的开合态），不再退回进鑑賞前的旧位置；并把这个落定位置记进"上次阅读"持久化，让"它记得你"在鑑賞层不再失忆。
  - 依赖：D1（用反查纯函数定位 page 类 entry 的 spread）+ E 落定内核（复用同一套落定不变量，不另写一份）。
  - 验收（**硬验收 + 关键不变量**）：`npm run build` 通过且运行期 0 error；
    1. **page 类页**：退出后 3D 落到该页所在跨页、`state` 为打开态、左右页材质与可见性正确。
    2. **三个无 page 字段的特例必须前置特判**（cover / colophon / back 三个鑑賞条目没有 page 字段）——
       - **封面**：退出落到关闭态（不是打开态的第 0 跨页）。
       - **奥付（colophon）**：退出落到末尾跨页的打开态。
       - **封底（back）**：退出落到"合上封底"态，且**必须走专门的封底落定路径**（含右页堆位移复位），**不得套用打开态的落定助手**（否则右堆位移不还原、留隐藏右页）。
       - **反例红线**：盲目对所有条目走 page 反查会让这三个特例反查失败、退回第 0 跨页（"在封底细读完退出却跳回封面"），**必须前置三分支特判，禁止**。
    3. **立牌不变量**：回写跨页"之前"必须把旧跨页上已起立的立牌全部即时折叠，使任意退出后"当前跨页上的立牌全部处于折叠态"（不出现属于旧跨页的立牌悬在新跨页上）。
    4. 375px 与 1280px 下退鑑賞落定后 DOM/场景状态均正确、无错页。
  - 来源：研究 R1/Phase 3.1/3.3、体验官 1.2 desync/💡#4、进化 Phase 1 闭环、Scout D2。

- [x] E5: 深链分享核心版（含落定内核 persist-aware 重构）
  - 目标：让"我停在哪一跨、用什么语言"能编码进地址、被第二个人按同样状态打开；并提供一个屏上入口生成/复制当前状态的分享链接。打开深链的人直接落到指定跨页与语言，而本地"上次阅读"与"语言偏好"**不被深链污染**。
  - 依赖：落定内核 persist-aware 重构（与 D2 共用同一个"落到指定跨页"内核，用一个"是否持久化"开关区分"自己浏览（写回）"与"打开别人深链（临时）"）。
  - 验收（**硬验收 + 关键不变量**）：`npm run build` 通过且运行期 0 error；
    1. 地址里带的状态（至少跨页 + 语言）在初始化时被解析并落定：打开深链直接落到指定跨页、应用指定语言。
    2. **临时态不污染持久态（红线）**：打开深链后，本地"上次阅读位置"与"语言偏好"持久化值**不被深链覆盖写回**（点别人的链接不改自己的进度/语言）；用户在深链落定后**自己**继续浏览/切换语言时，才正常写回。
    3. 越界/非法的链接参数安全回退（落到合法范围、不抛错、不卡死）。
    4. 屏上有可点的分享入口，点击能产出对应当前状态的链接（生成/复制其一即可）；入口不与既有 HUD 元素重叠、不穿透触发翻页或立牌交互；375px 与 1280px 均正确显示。
    5. URL↔状态映射这层纯逻辑**可被 headless 断言**（给定参数 → 落定到预期跨页/语言；非法参数 → 安全回退）。
  - 来源：进化 🔴#1/提议 A/Technical Health 数据模型、体验官 4.2/💡、Scout E5。

- [ ] D3: 鑑賞开/退 morph 缝合（**可选**，视本轮余量）— **本轮未做，留下轮**（headless 验收不到流畅度 + 需新写纸跨页屏幕投影矩形换算/2D 代理；D1/D2/E5/C9b/CLEAN-1 硬落已完成，D3 纯视觉增强且与 D2 解耦，不影响本轮 PASS）
  - 目标：进/退鑑賞时，让"3D 那张纸"与"鑑賞那张纸"在视觉上 morph 成连续的同一张纸（推近/退远的一镜到底），而非当前的硬切淡入；不支持的浏览器与减弱动态偏好下优雅降回现有淡入，零回归。
  - 依赖：D2 先落（D3 与 D2 解耦——morph 是视觉增强，回写是正确性；D2 不依赖 D3）。
  - 验收：`npm run build` 通过且运行期 0 error；支持该能力的新版浏览器进/退鑑賞呈现平移+缩放的连续 morph；**不支持该能力或开启减弱动态时优雅降回现有淡入**（降级路径不得依赖该能力自动处理减弱动态，须显式守卫）；状态回写（D2）在 morph 不可用时**照常执行**（视觉缝合与状态缝合解耦）；进鑑賞前先折叠当前跨页已起立立牌再取 morph 起点（避免半起立立牌混入）；375px 与 1280px 均不破版。
  - 来源：研究 R2/Phase 2.1/4.1 方案 A、体验官 💡#4、Scout D3（标注 headless 验收不到流畅度，需真实浏览器肉眼确认）。

- [x] C9b: masthead 回访冷启动竞态修复（小修）
  - 目标：回访恢复落到带角色的跨页时，报头不再先闪一下固定刊名再切到角色名——让角色信息在立牌就绪后立即正确呈现。
  - 验收：`npm run build` 通过且运行期 0 error；构造"回访落到带角色跨页"场景，报头最终稳定显示该跨页角色信息、不残留"无角色"的缓存态；不引入额外每帧开销、不破坏 C8 既有的"无角色跨页回退刊名、不残留上一角色"行为。
  - 来源：体验官 🟢#1、进化、Scout C9。

- [x] CLEAN-1: 删除 0 引用的 volume 预留字段（小修）
  - 目标：移除偏好层里 0 曝光 0 调用的连续音量预留字段及其范围校验，保持持久化底座"小而稳"；保留布尔静音字段为未来静音开关铺路。
  - 验收：`npm run build` 通过且运行期 0 error；该字段及其默认值/校验分支被一并移除、无悬挂引用；既有偏好读写、损坏/缺键安全回退行为不变（旧持久化数据里残留该字段时不报错）。
  - 来源：体验官 ✂️3.4/💡#3、进化、Scout 小修。

- [x] DOC-2: 顺手校正文档行号漂移（小修）
  - 目标：把项目结构文档与 pitfalls 里关于核心单文件总行数与若干方法行号的过期数字更新到当前实测，避免行号地图误导后续改动。
  - 验收：项目结构/ pitfalls 文档中核心单文件总行数与漂移方法的行号与当前实测一致；新增本轮相关的坑（无 page 字段特例、封底落定专路、masthead 竞态根因、深链临时态不污染持久态、F 组素材硬约束）已归档。
  - 来源：Evaluator 第 2 轮结构漂移、Scout C 段文档漂移。

## 第 4 轮追加任务（基于三审审计 + Scout 接地）

> 本轮主线：**导航完整性 + 传播闭环 + 为第 5 轮收尾铺路**——补齐 flipbook 桌上赌注里本产品唯一还缺的两块
> （目录导航 + 社交预览），全程**纯 DOM / 静态 HTML，零碰 three.js 渲染/相机/取景管线**（守 keep-three.js 红线）。
> G 组（鑑賞内缩略图目录）是本轮头号——三审罕见三方收敛同一落点、架构已 95% 就位、零新素材；
> H1（OG/social meta）焊死传播下半环；J（统一到达反馈）是 XS 顺手收口；I（底部 HUD 承载收口）为第 5 轮卡图入口铺路。
> **明确不做**：D3 morph（headless 验收不到流畅度，本轮+第 5 轮均不做）、设置面板（现 0 个"无家偏好"，建即空壳）。理由逐条见 negotiation.md。
> **第 5 轮预告**：コーデ/角色卡图（数据已全、依赖本轮 I 组承载）为收尾头号——把躺着的 commentary 内容做成可停留、可分享的社交货币。
>
> 依赖顺序：I 组（HUD 承载收口，为底部入口腾地）→ G 组（缩略图目录，独立可并行）→ H1（OG meta，独立）→ J（统一反馈，独立 XS）。
> G/H1/J 三者互不依赖，可任意顺序；I 组先做以免与 G 组目录入口（若放底部）争地，但 G 组目录入口在鑑賞层内、不挤底部 HUD，故 I 组实为独立铺路项。

- [x] G1: 鑑賞内缩略图目录导航（本轮头号，纯 DOM）
  - 目标：在鑑賞翻页书内加一个可开合的缩略图目录，让用户从全刊任意位置一眼看全 15 包 + 封面/奥付/封底并一步跳到任意一页，补齐"15 包只能顺翻"这个 flipbook 桌上赌注，同时解掉深链"导航不对称"（陌生人深链能一步到位、主人却要顺翻爬）。**目录与跳页全程留在鑑賞层内，绝不退出鑑賞回到 3D**；退出鑑賞时复用现成的退鑑賞回写（D2）做善后落定，不另开任何新的落定/跳页路径。
  - 依赖：无（复用现成全刊页表 + 现成缩略图源 + 现成退鑑賞回写；纯 DOM + CSS + 一个翻页书跳页调用，零碰 three.js）。
  - 验收（**硬验收 + 三条红线**）：`npm run build` 通过且运行期 0 error；
    1. **目录正确性**：鑑賞内出现可开合的缩略图目录，覆盖全刊每一个条目（封面 / 15 内页包 / 奥付 / 封底）；每个缩略图用现成页面图源、带可读标签；点击任一缩略图跳到对应页并关闭目录回到书。
    2. **红线①——跳后主动同步页码/箭头**：程序化按 index 跳页在本翻页书库的部分版本**不触发翻页事件**，会导致页码标签 / 上一页·下一页箭头显隐不更新——目录跳页后**必须主动调用同步逻辑刷新页码与箭头**，不得依赖翻页事件冒泡。**验收覆盖"从封面缩略图直跳奥付/封底"**（最远跳 + 双硬页跨页），跳后页码标签与箭头显隐均正确。
    3. **红线②——当前页高亮读夹取后真实页**：目录里"当前页"高亮**必须读翻页书夹取后的真实当前页索引**，不得读深链/外部传入的原始参数（越界原始值会 findIndex 找不到 → 高亮丢失）。验收：深链越界参数落定后打开目录，高亮仍正确落在夹取后的真实页上。
    4. **红线③——栅格进出守 reduced-motion**：目录栅格的进出动画**必须显式守 reduced-motion**（开启减弱动态时直接显隐、不播放淡入/缩放），与产品既有 reduced-motion 守卫一致，别只在别处守而此处漏。
    5. **退出回写自洽**：从目录跳到任意条目（含封面/奥付/封底三个无 page 特例）后退出鑑賞，3D 落点仍由现成退鑑賞回写正确处理（封面→关闭态、奥付→末跨页、封底→封底专路），零回归。
    6. **不破氛围 / 不破版**：目录栅格只存在于鑑賞 overlay 内部（已合法离开 3D 氛围），**不盖在 3D 场景上、不在底部 HUD 加常驻入口**；375px 与 1280px 下目录栅格与缩略图均正确显示、不溢出、不重叠。
    7. **文案诚实**：鑑賞页是烤死双语印刷图、locale 不影响它——目录文案**不得暗示"鑑賞会跟随语言变"**。
  - 来源：研究 R-NAV🔴/Phase 2.2/3.1/4.2、进化🔴#3、体验💡2、Scout G 组。

- [x] H1: 分享链接补 OG / 社交预览 meta（焊死传播下半环，纯静态 HTML）
  - 目标：当前把深链贴进微信/Twitter/Discord，对方看到的是一行裸 localhost 链接（无缩略图、无标题、无钩子）——补静态 OG / Twitter card meta + 一张代表封面预览图，让分享出去的链接有视觉钩子、闭合第 3 轮只闭一半的传播下半环。
  - 依赖：无（纯 HTML 加 meta + 一张 public 可访问的预览图）。
  - 验收（**硬验收 + 静态约束诚实**）：`npm run build` 通过且运行期 0 error；
    1. 页面 `<head>` 出现完整的社交预览 meta（标题 / 描述 / 预览图 / Twitter 大图卡类型），构建产物的 HTML 里这些 meta 存在。
    2. 预览图素材是一张 public 可访问、构建后 URL 稳定的图（不引用构建后 URL 不稳定的非 public 资源）；图存在且能被 meta 正确引用。
    3. **静态约束诚实（硬约束 → 文档）**：本产品是 SPA 静态站，静态 meta **无法按 spread 动态化**——分享 `?spread=3` 与 `?spread=7` 的预览卡完全相同（同一封面 + 同一标题）；动态 per-spread 预览需服务端渲染、超本项目形态。此约束**必须在文档（FUTURE.md / pitfalls.md）诚实标注**，不得暗示分享卡会随页变化。
    4. 不引入运行期 JS、不改任何场景逻辑；现有页面行为零回归。
  - 来源：进化🔴#2、Scout H 组下半环#1、研究 Phase 2.4。

- [x] J1: 统一到达反馈收口（XS 顺手，补一致性）
  - 目标：让"到达某一页"的多种方式（回访恢复 / 退鑑賞 / 深链 / 目录跳页退出）落定后给出一致的页码/报头反馈，使"这几扇门通向同一本书的同一个位置"在心智上成立。当前唯一不一致点：退鑑賞落到封面/封底时走专路、漏刷页码标签同步（靠逐帧动画兜底），与走统一落定内核的其它分支不一致。
  - 依赖：无（现有落定内核末尾已统一刷页码 + 报头；本任务只补齐封面/封底专路分支的同一次刷新，复用现成同步逻辑，不新增机制）。
  - 验收（**硬验收**）：`npm run build` 通过且运行期 0 error；
    1. **一致性补齐**：退鑑賞落到封面/封底（走专路的两个分支）后，页码标签与报头的刷新**与走统一落定内核的其它到达路径一致**（不再缺一次页码同步、不靠逐帧动画兜底才追上）。
    2. **零回归**：封面退出仍落关闭态、封底退出仍走封底专路（右堆复位、无隐藏右页残留）、奥付/内页退出落点不变；回访/深链落定行为不变。
    3. （可选增强，若顺手）落定时复用现成的页码确认微动效，让"到达"被用户轻感知；reduced-motion 下不播放该动效。
  - 来源：研究 R-FEEDBACK/Phase 4.3 炸弹一、体验🟢#2、Scout J 组。

- [x] I1: 底部 HUD 承载收口（为第 5 轮卡图入口铺路）
  - 目标：底部中央 HUD 列在 375px worst-case 已达 159px、最底元素底触视口边 12px，线性纵向堆叠已无向上生长余量——任何第 5 轮想上的新底部入口（卡图/角色卡）都会撞墙。本轮把承载策略从"线性堆叠"改为"二段/互斥"（鑑賞与解说入口互斥显示，或折叠进一个展开器），为新入口腾出垂直预算。**本任务是结构性腾地，不引入新用户可感知功能**。
  - 依赖：无（纯 CSS 承载结构 + 既有逐帧显隐控制点的互斥逻辑；不碰 three.js）。
  - 验收（**硬验收**）：`npm run build` 通过且运行期 0 error；
    1. **腾地达成**：375px worst-case（鑑賞入口 + 解说入口本应同显的场景）下，底部中央 HUD 列的总高度**显著低于改前的 159px**、最底元素与视口下边的间距**大于改前的 12px**，为新入口留出可见垂直预算。
    2. **互斥/二段不丢功能**：原本可达的两个入口（鑑賞 / 解说）在新承载下仍**都能被用户到达并触发**，行为与改前一致（互斥则有明确的切换方式，不能让某个入口永久不可达）。
    3. **不破既有规则**：鑑賞中 / 走秀中隐藏底部入口的现有规则不被破坏；触屏避让（窄屏上抬）等现有布局不回归。
    4. 375px 与 1280px 两档下底部 HUD 均不溢出、不重叠、配色/字体/间距与既有 HUD 语言一致。
  - 来源：体验🟡#1（第 4 轮重复点名）、研究 Phase 2.2 锚定 UI、Scout I 组（定位为第 5 轮卡图前置）。

> **第 5 轮预告（收尾，头号已定）**：**H3 コーデ / 角色档案卡（社交货币 + 内容深度临门一脚）**——
> 数据 100% 就绪（15 包 commentary 全双语：title / character{name,intro} / items[5]{name,part,tags[3],text} / runwayIntro），
> 依赖本轮 I 组腾出的底部承载来安放入口。第 5 轮把报头角色块或一个新入口做成"可点 → 弹出可停留细读的纸质档案卡"
> （复用鑑賞 overlay 壳 + 纸质 swing-tag 视觉语言），卡上复用深链生成"分享这张卡"——把深链从"分享到某页"升级为"分享一个人/一套穿搭"。
> 卡片"数据→字段"层做成纯函数 + headless 断言（延续 deeplink.js 好习惯）。**PNG 导出 / 二维码为卡片之上的进阶增量**（注意离屏 + 控尺寸防卡帧、选轻量纯函数二维码库防 bundle 膨胀），视第 5 轮余量。
> **第 5 轮明确不做**：D3 morph（机器验收不到流畅度）、设置面板（仍无 ≥2 个无家偏好）。

## 第 5 轮追加任务（基于三审审计 + Scout 接地，**最终轮 · 收尾**）

> 本轮主线：**把躺着的 15 篇双语社论做成"可停留细读 + 可分享"的纸质档案卡——产品从"被观赏"跨进"被阅读·被传播"的临门一脚**。
> 三审罕见高度收敛同一落点（体验💡1「如果只能再做一件事就做这张卡」+ 进化🔴#1「上线前最该收的一件事」+ 研究 R-CARD 全组）。
> 头号 = **CARD-1（纯 DOM 角色/コーデ卡，stage A）**；与之天然协同的 **CODEC-1（深链 `?item=M` 升维，使"分享某角色/造型"成立）** 同轮做。
> 外加三个便宜顺手清的收尾打磨（DOC-FIX / CLEAN-2 / OG-FIX）。
> **全程纯 DOM / 纯逻辑 / 文档·HTML·prefs，零碰 three.js 渲染/相机/取景管线**（守 keep-three.js 红线 + 延续 5 轮低回归基调）。
>
> **明确不做（写死省得议）**：stage B（卡片 PNG 导出 + 二维码）——留第 6 轮（headless 验收不到图质量 + `toDataURL` 跨域污染 + 最终轮无后续兜质量）；D3 morph、设置面板（前几轮已定）；音频（卡素材，进化建议作第 6 轮头号）。
>
> 依赖顺序：CODEC-1（纯逻辑深链 codec，先落 → CARD-1 的 item 深链有落地对象）→ CARD-1（卡片本体，含数据源索引 + 入口 guard + locale 联动 + 回环）；三个清理项独立可并行。CARD-1 与 CODEC-1 天然协同（卡是 item 深链的落地对象），可交错做。

- [x] CARD-1: コーデ / 角色档案卡（纯 DOM 卡，stage A，**本轮头号**）
  - 目标：把每个带角色的跨页的完整社论（title + character.{name,intro} + items[5]{name,part,tags} + runwayIntro）做成一张"杂志人物特辑内页"风格的纸质档案卡，让用户从报头入口一点即弹出、可停留细读、可分享。把当前 80% 只在 hover/tour 一闪而过的内容深度，第一次做成"可停留、可引用、可传播"的内容单元。卡 = 复用鑑賞 overlay 壳 + swing-tag 纸艺纸质语汇（纸色/明朝/墨色/hairline 分栏），视觉 100% 纸艺，**不做通用 social card 样式**。
  - 依赖：CODEC-1（item 深链直开卡的落地对象，可交错做）；入口承载（第 4 轮 I1 已腾，无需再争底部 HUD 地）。
  - 验收（**硬验收 + 五条红线**）：`npm run build` 通过且运行期 0 error；
    1. **数据源红线（头号，R-CARD-DATASOURCE）**：卡片取数必须走一个 **module-level `spread→commentary` 索引**（用现成 `STANDEE_SOURCES` 的 `page`+`commentary` + 现成 `pageToSpread` 单一真相源反查），**绝不复用 `currentSpreadCharacter()` / 不遍历 `this.standees`**（后者是运行期逐帧 build、有 C9b 冷启动竞态）。验收必须含：**深链 `?spread=N&item=M` 直开卡（此刻 `loadStandees` 可能未 build 完）数据非空、正确呈现**——索引是纯函数、无场景依赖，可 headless 断言（如 deeplink.js）。
    2. **入口 guard 红线（R-CARD-ENTRY-GUARD）**：卡片入口在报头 `.hud-masthead-actions` 行（照抄 share pill 范式：pointerdown stopPropagation 防 canvas raycast + click handler），入口显隐复用 C8「当前跨页有无角色」语义，但 guard 取数走**同一个 module-level `spread→commentary` 索引**（一处建、两处用，防漂移、避开 `this.standees` 依赖）——封面/奥付/封底/无立牌内页**不出卡片入口**（不弹空卡）。
    3. **per-locale 真联动红线（R-CARD-LOCALE）**：卡片字段全部按当前 locale 渲染（卡片是第一个真双语联动的细读载体，鑑賞印刷图烤死双语切不了）；**卡片打开时切语言（setLocale）必须重渲卡片字段**（title/intro/items/tags 全部即时联动），不留半切态。
    4. **回环红线（R-CARD-BACKLINK）**：卡上提供"在杂志里看这页"回环按钮，复用现成 `turnToPage` / `landOnSpread` 落定，避免卡片成死胡同。
    5. **不破氛围 / 不破版**：卡片寄生鑑賞 overlay 壳内（不盖 3D 场景、不新开盖 3D 的层）；与鑑賞翻页书互斥（不同时显、不互相盖）；卡片进出动效**显式守 reduced-motion**（延续 G1 红线③）；375px 卡是**可纵向滚动的全屏 sheet**（窄屏 5 件单品双语正文会很长，不做挤底部的小弹窗）；375px 与 1280px 下卡片 DOM 正确、不溢出、不重叠；退卡片**不污染 3D 落定状态**（卡片/item 状态绝不 persist 到 C6）；卡上若嵌印刷图局部**不暗示"看清面料质地"**（落"印刷特写"语义，F 组素材硬约束）。
  - 来源：体验💡1/Phase 3.1（"收尾头号、可直接落地方案"）、进化🔴#1/Phase 3、研究 R-CARD-DATASOURCE/ENTRY-GUARD/LOCALE/BACKLINK + Phase 2.3 字段→版式映射、Scout K 组 K-1~K-4。

- [x] CODEC-1: 深链 codec 升维 `?spread=N` → `?spread=N&item=M`（**与 CARD-1 同轮，使"分享某角色/造型"成立**）
  - 目标：把深链从"分享到某页"升维为"分享某角色/某件单品"——`?spread=N` 升 `?spread=N&item=M`，spread 必选锚 + item 可选偏移（nested 子参数）；applyDeepLink 落定时 item 用于直开对应卡。**这是 CARD-1 的 item 深链能成立的前提**。
  - 依赖：无（deeplink.js 纯逻辑）。CARD-1 是其落地对象。
  - 验收（**硬验收 + 旧链接零破坏红线，可 headless 断言**）：`npm run build` 通过且运行期 0 error；
    1. **旧链接零破坏（红线）**：`?spread=3`（无 item）→ `{spread:3, item:null}` → 落第 3 跨整页，**旧行为完全不变**。
    2. **新链接生效**：`?spread=3&item=2` → `{spread:3, item:2}` → 落第 3 跨 + 直开第 2 件单品卡（取数走 CARD-1 的 module-level 索引，不依赖 standee build，深链直开卡数据非空）。
    3. **per-field 安全回退（沿用现有习惯）**：`?spread=3&item=99`（越界）→ item 回退 null → 落整页**不开空卡**（越界 item 不打开卡片）；`?item=2`（无 spread，孤立）→ item 被忽略（nested：item 依附 spread，孤立 item 无意义）。
    4. **纯逻辑可 headless 断言**：parse/build 这层 URL↔状态映射无 DOM/场景依赖，给定参数 → 预期 `{spread,item}`；上述四案例（合法 / 越界回退 / 孤立忽略 / 旧链接）可 ad-hoc headless eval 断言（仓库现无 `.test.js`）。
    5. **绝不平铺退化**：item 必须 **optional + nested** 依附 spread，**绝不**新增 `?char=` 等第三/第四平行参数（P-4 已预警扁平化退化）。buildShareUrl 加 item 时 spread null 则不输出 item，缺省 item 不输出（保持 clean snapshot 现有契约）。
  - 来源：研究 R-CARD-CODEC🔴/Phase 3.2/4.2 方案 A、进化（深链精度回流）、Scout L 组 L-5、negotiation P-4。

- [x] DOC-FIX: 校正两处文档措辞（便宜顺手，第 4 轮 Evaluator 已亲验确认两处都不准）
  - 目标：校正 pitfalls/验收里两处已被第 4 轮 Evaluator 实测确认不准的文档表述，避免误导本轮/后续改动者。纯文档改、零代码、零风险。
  - 验收：
    1. **DOC-FIX-A（turnToPage）**：pitfalls.md「程序化 `turnToPage(i)` **不触发** flip 事件」表述校正——eval.md:101 亲验 `turnToPage`（page-flip 2.0.7）**实测确触发一次 flip 事件**，G1 缩略图点击的手动 `syncChrome()`+`syncTocActive()` 是**冗余保险**（功能正确无碍），表述应改为"不可**依赖**事件冒泡跨版本稳定、需手动兜底"而非"完全不触发"。
    2. **DOC-FIX-B（I1 口径）**：把 I1「腾底部 / 底距 > 改前 12px」措辞校正为"**列顶上方净空 ≥ Npx**"（实现路径 = 收紧底部 `.hud-status` 列 + 折叠装饰行，列高 159px→128px）——卡片入口在顶部 `.hud-masthead-actions` 行（top-left），不占底部 HUD 垂直预算；两者目标等价但字面口径与实现路径错位（eval.md:131）。
  - 来源：第 4 轮 eval.md 提醒 a/b（信息性已确认）、Scout M-7 / C 段 DOC-FIX-A/B。

- [x] CLEAN-2: 删 0 引用的 `muted` 预留字段（便宜顺手，最终轮诚实清掉）
  - 目标：移除偏好层里跨 3 轮 0 引用 0 UI 的 `muted` 字段——其铺路对象（静音开关）已明确判为"不做"（无音频素材、不建空壳静音开关、不建设置面板），最终轮宜诚实清掉，别让永不会被接的接口继续假装有计划。
  - 验收：`npm run build` 通过且运行期 0 error；`muted` 字段及其默认值/sanitize 拷贝被一并移除、无悬挂引用（注意区分 `video.muted` 的 HTMLVideoElement 原生属性——那是视频静音自动播放需要，**不删**）；既有偏好读写、损坏/缺键安全回退行为不变（旧 blob 残留 `muted` 由 sanitize 静默丢弃、不报错）；同步 pitfalls / project_structure 的字段列表（剩 `{locale,skipIntro,guidedOnce,lastSpread}`）。
  - 来源：体验✂️3.3/🟢CLEAN、进化（铺路对象已不做）、Scout M-8、negotiation #7/#9。

- [x] OG-FIX: OG 竖图黑边收尾（**card 类型降级 / 诚实标注，不硬产横图**）
  - 目标：`og-cover.png` 是 941×1672 竖图，`twitter:card=summary_large_image` 期望 ~1.91:1 横图 → 竖图被信箱化黑边，分享卡第一印象打折。**无现成 1200×630 横图素材**（全仓竖图 + 2048² 内页，从竖图裁会丢杂志版面）——本轮做"降级 card 类型 / 诚实标注"，**不硬产横图**（超便宜顺手范畴，需设计环节，留待有设计环节时做）。
  - 验收：`npm run build` 通过且运行期 0 error；二选一：(a) 把 `twitter:card` 从 `summary_large_image` 降级为 `summary`（小方图卡，竖图不黑边）——一行改动零素材零风险；或 (b) 保持现状并在 index.html 注释 + 文档诚实标注"竖图在 large_image 下有信箱黑边、受素材限制、待设计环节出横图"；现有页面行为零回归、不引入运行期 JS。
  - 来源：第 4 轮 eval.md 提醒 a（信息性）、体验🟡OG-FIX、Scout M-6 / C 段新坑 N-4。

> **5 轮收官小结**：五轮把"一个会动的封面"打磨成**一台自洽、有记忆、可分享、可导航、可阅读·可传播的纸艺装置**——发现性（轮1）→ 外壳与持久化（轮2）→ 可传阅 + 状态机缝合（轮3）→ 导航完整 + 传播下半环（轮4）→ **内容深度兑现 + 分享语义升维（本轮）**。本轮 CARD-1 把躺在 15 个 JSON 里的双语社论第一次做成可停留、可分享的内容单元，CODEC-1 让"分享一个人/一套穿搭"与"分享一页"走同一个 codec。
> **第 6 轮预告（若有）**：① **音频层**（翻页声 + 室内底噪 + 走秀 BGM，进化判定第 6 轮头号——编码侧全就绪、纯卡素材、是"氛围装置"定位下最后一格沉浸缺口，到位后凑够 ≥2 无家偏好、设置面板届时才值得建）；② **卡片 stage B**（PNG 导出 + 深链二维码——离屏控尺寸防卡帧 + 轻量纯函数二维码库 + `SecurityError` 跨域污染兜底，真人/有设计环节验收图质量时做）；③ 全刊 look 全家福海报（卡片 Canvas 能力的自然延伸）。

## 第 6 轮追加任务（基于 Reviewer 审计 / Iter 1）

> 本轮（Iter 1/5）主线：**把"屏幕没打开"的暗调 demo 调成"温暖印刷间"的纸艺装置——统一收口 PBR 光照基线 + 黑天空消失 + 5 个真 bug 一并修**。
> 本轮策略：用户主诉"代码层面找 bug + 视觉效果很差"——只做视觉调参 + 真 bug 修复，**不动取景、不动几何架构、不引新素材、不重构 4477 行单文件**；5 轮已收官，**不加新功能**，新方向（远景剪影 / 吊灯 / 视觉一键切换 / HDR / AgX / 远景墙 / 抽 render.js）一律延后到 Iter 2-5 或下一 Sprint。视觉调参与真 bug 修是本轮高优先级、其它（DoF 回归 / 封面 ATELIER "A" 切 / UX 折叠快捷键 / CSS 小重构）全部降级为 stretch 或拒绝。
> 不碰 three.js 架构（keep-three.js 红线），数值调参与 bug 修复都在现有管线内做。
>
> 依赖顺序：BUG-QUALITY-STUCK 先修（避免调参期间被自适应误降档干扰真机判断）→ 然后 VIS-LIGHT（联合调参主任务，含 BUG-FOG-NEAR / spineMaterial 色 / rim light / shadowMap.type / wood normal / envMap 子项）→ BUG-GRAIN-RM / BUG-PEEL-SHADOW / BUG-TOC-TOGGLE / UX-CARD-ACTIONS / DOC-941 五项相互独立，可并行。

- [x] BUG-QUALITY-STUCK: 修自适应画质永久卡 floor 的真 bug
  - 目标：trackFrameQuality 降档时 backoff 单向涨到上限、升档分支只重置 since 不动 backoff——一旦降到底，需要长冷却才能尝试升档且 backoff 永不重置，真实用户切 tab / 网络面板几次就可能进入"永久糊化"。修法两件事：(a) 升档分支让 backoff 与降档分支对称回落；(b) visibilitychange 切回时重置 backoff / ema / since，防 headless rAF 暂停累积假"slow"信号。
  - 依赖：无（应在 VIS-LIGHT 之前修，避免调参期间被自适应误降档干扰真机判断）。
  - 验收（**硬验收**）：`npm run build` 通过且运行期 0 error；headless `__magazineScene.pixelRatio` 在长时间稳态（≥ 60s）或切 tab 回来后能从 floor 回升（机器可断言）；正常使用路径下自适应行为无回归（短期掉帧仍能降档保流畅）；visibilitychange listener 在 dispose 时正确移除（不留泄漏）；375px 与 1280px 双断点行为一致。
  - 来源：体验 P4 / 进化 A.3 / R8 / 研究 R8 + Phase 4 BUG α / Scout BUG-QUALITY-STUCK。

- [x] VIS-LIGHT: 渲染光照与背景基线重平衡（**本轮主任务**）
  - 目标：把 IBL 当主光底盘、directional 当塑形光，背景与 fog 离开"死黑"调子，整体观感从"屏幕没打开"跃迁到"温暖印刷间"。**联合调动**环境光照度 / 主光 / 半球补光 / 填充光 / 聚光 / 背景色 / 雾色与雾起止 / 阴影柔化方式 / 木桌 normal 强度 / 印刷与纸材质 envMap 反射 / 后期 grain 与 vignette 基线，并按"行业三点光基线"补一束 rim/back 轮廓光；同时把书脊（spineMaterial，**不是 edgeMaterial**——按变量名定位）的死黑色顺手抬到不像"涂黑盗版书边"的暖暗色。这些参数互相耦合，必须作为一组联合提交、联合验收。**禁止动取景**（cameraStart/Open/Closed/portrait 系列 Sprint 7+11 已收口）。数值由 Generator 按 Scout D 段保守值表实测调（Planner 不写死数）。
  - 依赖：BUG-QUALITY-STUCK 先修。
  - 验收（**硬验收**）：`npm run build` 通过且运行期 0 error；
    1. **像素直方图回归门**（headless 可机器复跑）：force render 后 1280×800 桌面截帧 `avgLum/256` 显著高于第 5 轮基线 70.6、`darkFrac(lum<32)` 显著低于第 5 轮基线 38.9%、`brightFrac(lum>180)` 不低于第 5 轮基线 18.9%——具体数值由 Generator 实测后写入完成注（容差由实测稳态决定，不预先设死）。
    2. **黑天空消失**：375×812 portrait closed 与 open 两态截图，画面上方区域不再外露未渲染的死黑底（容差 ±3 of bg 新色）；1280×800 桌面帧无回归（取景与构图不变）。
    3. **真机肉眼校**（1280px 与 375px 双断点）：杂志页面"通透感"明显改善（不再读作"塑料感"）、立牌侧面有可见的轮廓光或填充光、桌面木纹周期感减弱（tile seam 不再"看着碍眼"）、四角不再 100% 死黑、书脊不再死黑像盗版书边。
    4. **走秀路径无回归**：进入暗场走秀（startShow）→ 退出走秀，光照能 lerp 回新基线（不出现"走秀回来灯没复位"）；**新增的任何光源必须同步 `this.lightLevels` 与 `applyShowDim`**，否则视为不合格。
    5. **fog 真实参与渲染**：fog.near 调整后桌面远端在 force render 帧下亮度低于近端（连带修 BUG-FOG-NEAR），远端不再硬切到 bg 死黑。
    6. **控制台无 error / 无 WebGL 报错**；自适应画质档位在帧率稳定时不持续降档。
  - 来源：体验官 P1/P5/P6/P7/2.1/2.3/2.4 / 进化 R1/R3/R4/A.1 表 / 研究 R1-R7/H-2/H-3/Phase 2.2-2.4/M-1~M-4 / Scout VIS-LIGHT/VIS-RIM/VIS-BG/VIS-GRAIN/VIS-ENVMAP/VIS-SHADOWSOFT/VIS-WOODSEAM/VIS-EDGE-COLOR/BUG-FOG-NEAR/D 段冲突裁决。

- [x] BUG-GRAIN-RM: 修 a11y bug —— reduced-motion 下 grainPass 仍每帧叠固定噪点
  - 目标：reduced-motion=true 时彻底关闭 grainPass，而不只是停 uTime（停 uTime 后 noise 是固定 hash，呈现为"静态颗粒锁住"的疹状画面，比"动颗粒"更突兀，违背 reduced-motion 意图）。
  - 依赖：无（独立修，但应在 VIS-LIGHT 同提交内一起验收 grain 基线变化）。
  - 验收（**硬验收**）：`npm run build` 通过且运行期 0 error；reduced-motion=true 时同一视点连续两帧 pixel-perfect 一致（grain 不再叠）；reduced-motion=false 时 grain 仍按 VIS-LIGHT 新基线推进；走秀路径中 applyShowDim 对 grainPass.uVignette 的 lerp 在 reduced-motion 关闭 grainPass 时不可见（可接受代价）；375px 与 1280px 双断点行为一致。
  - 来源：进化 A.5 / R2 / 研究 R4 / H-5 / Scout BUG-GRAIN-RM。

- [x] BUG-PEEL-SHADOW: 修 peel 过程中阴影冻结的小 bug
  - 目标：拖拽预览翻页（peel 状态）属几何在动，shadowsNeedUpdate 的 casterMoving 表达式漏算 peel.amount——理论上 peel 中阴影冻结在 peel 开始那一帧。属正确性。
  - 依赖：无。
  - 验收（**硬验收**）：`npm run build` 通过且运行期 0 error；peel 拖拽过程中 shadowMap.needsUpdate 的 frame 数 > 0（机器可断言）；常态翻页与立牌动作的阴影刷新行为无回归；375px 与 1280px 双断点行为一致。
  - 来源：进化 A.4 / R5 / Scout BUG-PEEL-SHADOW。

- [x] BUG-TOC-TOGGLE: 修 5 轮欠债 CSS bug —— 鑑賞 TOC 切换按钮 position 失效
  - 目标：`.gallery-toc-toggle` 缺失 position:absolute 继承，写在它身上的 top/right 坐标失效 → 按钮渲染在 (0,0) 与 `.gallery-label` 重叠。功能上可点（z-index 不冲突），但视觉上发现性归零——5 轮 Evaluator 都漏掉的"DOM 断言看不出、肉眼独占"回归。修法是把它加入 `.gallery-close, .gallery-nav` 的共享 position/z-index/视觉块的选择器列表（个性化覆盖如 top/right 留在原 block 内）。
  - 依赖：无。
  - 验收（**硬验收**）：`npm run build` 通过；1280×800 与 375×812 下 `.gallery-toc-toggle` 的 `getBoundingClientRect` 落在右上角（接近 viewport.width - 68, 20 量级，不再在 0,0）、不与 `.gallery-label` 相交；is-active 状态视觉胜过 hover；点击仍能开关 TOC（功能无回归）。**Evaluator 必须真机肉眼校，不只信 DOM rect 断言**——这是 5 轮欠债的根因模式。
  - 来源：体验 P3 / 研究 Phase 4 BUG β / Scout BUG-TOC-TOGGLE。

- [x] UX-CARD-ACTIONS: look-card 桌面默认下 backlink/share 按钮折叠线外的 sticky 修复
  - 目标：桌面默认 1280×800 viewport 下，look-card sheet 内 `.look-card-actions`（回杂志 + 分享卡片两个最关键 CTA）滚不到才看得见。把 actions sticky 到 sheet 底部、加渐变蒙底，让两个 CTA 永远在折叠线内。
  - 依赖：无（纯 CSS）。
  - 验收（**硬验收**）：`npm run build` 通过；1280×800 默认 viewport 下卡片打开后，`.look-card-actions` 的 `getBoundingClientRect().bottom` ≤ viewport.height - 一定边距、两个 CTA 可见；375px 全屏 sheet 路径下从"滚到底才显"变成"永远显"——视觉改进无回归；reduced-motion 路径下不出现 actions 漂浮的奇怪过渡；双断点配色/字体/间距与既有 HUD/卡片语言一致。
  - 来源：体验 P9 / Scout UX-CARD-ACTIONS。

- [x] DOC-941: 文档卫生 —— 校正"2048² 美术图"的事实错误
  - 目标：pitfalls.md / FUTURE.md / project_structure.md 多处把素材描述为"2048² 美术图"，**实测全仓所有印刷/封面/立绘 PNG 均为 941×1672**。5 轮反复被错误数据污染的认知，影响"提分辨率能解决模糊吗"的判断，本轮顺手收。
  - 依赖：无（纯 Markdown）。
  - 验收：相关权威文档中 "2048²" 措辞被校正为正确的素材分辨率，并标注"这是素材层分辨率天花板，SSAA 再调高也救不回"；SPRINT.md 历史轮条目与 docs/orch/ 历史报告**不动**，只改 pitfalls / FUTURE / project_structure 三个权威文档。
  - 来源：进化 R4 / B.1 / 研究 R17 / Scout DOC-2048。

> **Stretch（视余量做，不强制）**：
> - **VIS-COVER-A**（封面 ATELIER "A" 被切）—— Scout 建议先做 VIS-LIGHT + spineMaterial 色后真机看 "A" 是否仍被切，再决定是否动 cameraClosed.x 或 cover 几何 UV（治本要重出 cover.png，属设计环节）。
> - **VIS-DOF-BACK**（DoF 回归）—— 如果 VIS-LIGHT 的 fog 调整已让远处地板 tile seam 自然柔化，就不必再开 BokehPass（省 GPU，保持 Sprint 11 决策）。
> 两项都依赖 VIS-LIGHT 完成后的真机截图判断，**本轮不预先承诺**。

> **本轮明确不做**：① UX-HUD-KEYS 折叠快捷键到 ? pill（UX 折叠是次要打磨，需新 DOM + 状态机，留 Iter 2-5）；② NICE-VIGNETTE 强 cinematic 方向（与"提亮整体"主诉冲突）/ NICE-SCRIM-TOKEN / NICE-PILL-BASE / NICE-CARD-ENTRY 等低风险 CSS 重构（本轮主诉不在此）；③ 抽 src/render.js / vizConfig 架构重构（进化 R6 / 研究 R10 自己也说"独立 PR、不与视觉调参合并"，留 Iter 2-5 单独轮次）；④ 引入 HDR / 切 AgX tonemap（方案 B / R14，本轮调参已能 deliver，留 Iter 2-5 或下一 Sprint）；⑤ 远景墙 / 远景剪影 / 吊灯 / 视觉一键切换 / 立牌色温随翻页 / 纸张应力高光 / 动态时间轴 lighting / 风格化 V2（全部"加新功能"或"重启世界观"，5 轮已收官、本轮专攻打磨）；⑥ 音频层（用户主诉是视觉，音频继续等素材）。

> **第 6 轮迭代后续预告（Iter 2-5）**：① Iter 2-3 视 VIS-LIGHT 真机效果决定是否做 VIS-COVER-A / VIS-DOF-BACK / 远景墙 / rim 微调；② 抽 render.js / vizConfig 作独立结构化任务；③ 如有余量再上 UX-HUD-KEYS 折叠 / 全局 CSS token 收口。本轮（Iter 1）的目标是**用最低风险、最高杠杆的一组动作把视觉底盘搬正、把 5 个真 bug 收掉**，给后续 Iter 留余地与真机基线。

## 第 6 轮 Iter 2 追加任务（基于 Reviewer 审计）

> 本轮（Iter 2/5）主线：**收 Iter 1 暴露出来的尾巴——一组系统性 sRGB 显式声明 + 撤回 deprecated shadowMap 别名 + 一处状态机 race 防御 + 一处漏改的封面边色 + 一处 dispose 漏清 + 一组与"bg 真亮起来"联调的 vignette/rim 微调**。
> 三审高度收敛在 7 项 Critical（体验 / 进化 / 研究 三方点名相同根因）；Scout 已裁决两项分歧（shadowMap 撤回别名而非换 VSM；vignette 0.20、rim 0.9 保位置）。
> 一项 Research 单方深层提案（tonemap ACES → Neutral 切换 + 配套色温/曝光/envMapIntensity ~80 行联调）**留 Iter 3**——理由见 negotiation.md F.5 段；本轮（Iter 2）完成 sRGB + vignette + rim 联动效果是 tonemap 切换是否值得做的前置必要条件。
> **红线**：3D 氛围装置不动技术栈（keep-three.js）；不动取景 / SSAA / 几何架构；不引新素材；不重构 4610 行单文件；不加新功能（5 轮已收官）；不切 tonemap（留 Iter 3）；不动 light.color 的 LinearSRGB 显式声明（PBR 路径不适用）；不动 rim 位置（Iter 1 位置与 keyLight 夹角已是正常背光）。
>
> 依赖顺序：VIS-SRGB-FIX 先做（其它视觉项是它的下游）→ VIS-COVER-EDGE 随同 sRGB 一并落（共用 LinearSRGBColorSpace 路径）→ BUG-SHADOWMAP-DEPRECATED / BUG-GALLERY-RACE-A / BUG-DISPOSE-SHARE-TIMER / VIS-VIGNETTE-RIM 四项独立可并行。

- [x] VIS-SRGB-FIX: 修非 map hex 色值 sRGB 双转吞色
  - 目标：bg / fog / 书脊 / 封面四边四处 hex 色值显式声明为 linear-sRGB 输入，跳过 r0.184 默认 `ColorManagement` 的 sRGB→linear 转换，让源码写的暖暗值真正出现在画面上、解掉 Iter 1 "黑天空消失"验收实际未通过的根因。
  - 验收（**硬验收**）：`npm run build` 通过且运行期 0 error；headless `__magazineScene.scene.background` 的 r 通道（×255）显著高于 Iter 1 实测的 ~2、回到接近源码 hex 期望的 24 量级；真机肉眼 1280×800 与 375×812 双断点下 portrait 画面上方区域不再 ≈ 100% 死黑（仍可能有黑，但不是 Iter 1 测出的 99.9% 死黑）。
  - 来源：体验 REC-1 / 进化 R1 / 研究 R2-1 + H2-6 / Scout A.1 + B.1。

- [x] VIS-COVER-EDGE: 封面四周薄边色补齐到与书脊看齐（Iter 1 漏改）
  - 目标：Iter 1 把书脊（spineMaterial）抬到暖巧克力色是对的，但同名不同物的封面外框 edgeMaterial（createCover 段，不是 createPageBlocks 段）仍是 Iter 0 死黑色 + 低 envMapIntensity——本轮把它抬到与书脊同色同 envMap，让封面四周不再读作"涂黑书边"。**必须按 createCover 段定位，不要被同名变量混淆**。
  - 验收（**硬验收**）：`npm run build` 通过；runtime 遍历 magazine 中封面四周薄边 mesh 的材质 color 不再是死黑（与书脊视觉一致）；真机肉眼封面四周不再有死黑收边、与新的暖巧克力书脊视觉连续。
  - 来源：进化 R4 + B.4 / 研究 R2-3 / Scout A.4 + B.4。

- [x] VIS-VIGNETTE-RIM: vignette 量级与 rim 强度与"bg 真亮起来"联调
  - 目标：bg sRGB 修后画面有真实亮度头量，原 Iter 1 偏强的 vignette 会把刚亮起来的四角又收回去；同时 Iter 1 新加的 rim 强度偏弱（被 env / key / fill / pool 主导，占总光照 < 3%，立牌背面金边不可见）——本轮把 vignette 降一档、rim 抬一档，两项与 sRGB 修联调成一组。**vignette 默认值与走秀 dim 起点必须同步改**（applyShowDim 两处一致），否则走秀进入时基底跳一档。**rim 不动位置**（Iter 1 位置与 keyLight 夹角已是正常背光，体验官"夹角太小"是误判）。
  - 验收（**硬验收**）：`npm run build` 通过；runtime grainPass 的 vignette uniform 默认值与 applyShowDim 走秀 dim 起点同步落到新值（两处必须一致）；rim 强度抬到新值；真机肉眼 1280×800 行 80% / 行 10% 亮度比从 Iter 1 实测的 ~11:1 显著收窄、立牌起立时背面有可见的暖色描边。
  - 来源：体验 REC-4 + REC-5 / 进化 R6 / 研究 R2-6 / Scout A.6 + A.7 + B.6 + B.7。

- [x] BUG-SHADOWMAP-DEPRECATED: 撤回 PCFSoftShadowMap 别名
  - 目标：r0.184 起 `PCFSoftShadowMap` 是 deprecated 别名静默 fallback 到 `PCFShadowMap`，新 PCFShadowMap 本身已是 soft 实现——撤回别名让 console fresh load 不再每次 warn ×2，与代码意图对齐。**不换 VSMShadowMap**（视觉漏光风险高于收益，详见 negotiation.md F.1）。
  - 验收（**硬验收**）：`npm run build` 通过；console fresh load 0 warn（PCFSoft deprecated warn 消失，复跑两次确认）；runtime `shadowMap.type` 与之前 silent fallback 值一致（视觉零回归，新 PCF 已是 soft 实现）。
  - 来源：体验 REC-2（修法不采用 VSM）/ 进化 R2 + A.2 / 研究 R2-2 + H2-2 / Scout A.2 + B.2 + D.2。

- [x] BUG-GALLERY-RACE-A: toggleGallery 入口清掉在飞 turn
  - 目标：构造"页面 settle turn 在飞 → 用户进鑑賞 → 从鑑賞跳到其它跨页退出"场景时，关 gallery 后下一帧 updateTurn 看到 stale settle 已超 duration 触发 finishTurn，把刚由 closeGallery 写好的 spreadIndex clobber 回 stale turn.targetSpread——这是 5 轮无人 catch、headless 100% 可复现的真状态机 race。修法在 toggleGallery 早段加复位四件套（this.turn=null + turningPage 三状态复位，与 finishTurn 完全对齐）。
  - 验收（**硬验收**）：`npm run build` 通过且运行期 0 error；headless 构造 race A 复现脚本（stale settle → toggleGallery → closeGallery → 模拟用户跳到任意非 stale-target spread → 下一帧 updateTurn）后，spreadIndex 保持用户设值不被 clobber 回 stale targetSpread；既有 turn → finishTurn 正常路径无回归（正常翻页落定行为不变）。
  - 来源：体验 REC-3 / 进化 R3 + B.1 / 研究 R2-4 / Scout A.3 + B.3。

- [x] BUG-DISPOSE-SHARE-TIMER: dispose 补清漏掉的 share flash timer
  - 目标：dispose 内只清了 cardShareFlashTimer 没清 shareFlashTimer（命名对称但实现不对称的微泄漏，亲跑 dispose.toString 已实证）——补一行 clearTimeout。
  - 验收（**硬验收**）：`npm run build` 通过；runtime `s.dispose.toString()` 含对 shareFlashTimer 的 clearTimeout 调用；dispose 后无悬挂 timer。
  - 来源：体验 REC-6 / 进化 R5 + C 段 / 研究 R2-5 / Scout A.5 + B.5。

> **Stretch（视余量做，不阻塞 PASS）**：
> - 把"bg sRGB 实测 / shadowMap.type 真值 / race A 反测脚本"沉淀到 `docs/orch/visual-regression.md`，给 Iter 3-5 Evaluator 用同一套 headless 断言（进化杠杆 #5 / 研究 R2-9 / Scout A.9）。
> - project_structure.md 行号同步（Iter 1 Evaluator 已 confirm 漂移 +6 ~ +130，本轮再加 ~25 行；与 DOC-2 / DOC-FIX 同模式的"顺手收"）。

> **本轮明确不做（写死避免下轮再议）**：① 切 tonemap（ACES → Neutral 留 Iter 3，与配套色温/exposure/envMap 一组联调；详见 negotiation.md F.5）；② 换 VSMShadowMap（视觉漏光风险）；③ 动 light.color 的 LinearSRGB 显式声明（PBR 光照路径不适用，会让 rim 感知少一档暖）；④ 动 rim 位置（夹角已是正常背光）；⑤ 动取景 / SSAA / 几何架构 / RoomEnvironment 替换 / 新加光源；⑥ 加新功能（5 轮已收官；远景剪影 / 吊灯 / 色温随时间漂移 / 视觉一键切换 / HemisphereLight 窗光 / 灯光预设切换 / 设置面板等全部 backlog）；⑦ 改 closeGallery / closeLookCard 两处 DOM remove 延时 setTimeout 的实现（模式归档但本轮不触碰已稳定路径）；⑧ 抽 render.js / materials.js（独立 PR、Iter 3+）；⑨ 动 SPRINT.md 历史轮条目与 docs/orch/ 历史报告（历史快照不动）。

> **Iter 3+ 候选预告**：① **Iter 3 头号杠杆候选**：tonemap ACES → Neutral + exposure 重校 + envMapIntensity 9 处校 + 色温 3200K → 4500K + fill 改暖（~80 行联调）——本轮（Iter 2）完成后真机判这一组是否仍有杠杆；② **Iter 3 同步收口**：抽 render.js + materials.js move-only 重构（与视觉调参分开 PR）；③ Iter 4-5 候选：远景剪影 / HemisphereLight 窗光 / AgX vs Neutral 真机 A/B / dev-only 视觉调试面板。

## 第 6 轮 Iter 3 追加任务（基于 Reviewer 审计）

> 本轮（Iter 3/5）主线：**抽 render-config 为 Iter 4 tonemap 切换铺路 + 顺手收 Iter 1/2 漂移与 4 个便宜视觉项**；tonemap 切换延后 Iter 4。
> 三 reviewer 在 tonemap 切换 timing 上 2:1 反对本轮做（Experience 倾向不做 / Evolution 明确不切 / Research 主张本轮切）——Planner 接受多数派意见：**本轮（Iter 3）不切 tonemap**，先做 TECH-1（抽 render-config.js move-only）把 17 联调点位集中到一处，为 Iter 4 可能的 tonemap 切换把"全文搜散落 17 处"压缩成"看一个文件"的可控回归面积；同步收 Iter 1/2 累计漂移的行号地图（TECH-2），再顺手做 4 个 Experience 推荐的便宜视觉项（rim 抬一档 / 桌面对称 / fog.far 远端拉远 / 文档行号校正——视觉项 4 项之间相互独立、可逐项独立验收，不与 TECH-1/TECH-2 一锅烩）。
> **红线**：3D 氛围装置不动技术栈（keep-three.js）；不动取景 / SSAA / 几何架构；不引新素材；不重构 4681 行单文件（TECH-1 是抽 render config 子模块，不是拆 magazineScene.js 业务逻辑）；不加新功能（5 轮已收官）；**本轮不切 tonemap**（延后 Iter 4，详见 negotiation.md "tonemap 切换 timing"）；不动 light.color 的 LinearSRGB 显式声明（PBR 路径不适用）；不新增光源。
>
> 依赖顺序：TECH-1（render-config 抽离 move-only）先做（其它视觉项是它的下游，抽完后视觉项的数值改动落在新文件、不与 magazineScene.js 大文件耦合）→ TECH-2（行号地图同步）与 TECH-1 同提交（TECH-1 落后 magazineScene.js 行数本身要变、行号本就要重写、一并收两笔）→ VIS-RIM-BOOST / VIS-TABLE-SYM / VIS-FOG-FAR / DOC-LINEMAP 四项独立可并行，可在 TECH-1/TECH-2 落定后逐项独立验收。

- [x] TECH-1: 抽 render-config.js 子模块（move-only，**本轮头号**）
  - 目标：把分散在 magazineScene.js 单文件内的渲染基线视觉调参点位（tonemap / exposure / outputColorSpace / shadowType / bg hex / fog hex+near+far / envIntensity / 5 处光强度 + 5 处灯色 hex / 9 处 envMapIntensity 桶 / GrainShader 默认 + applyShowDim 走秀起点联动常数）集中到一个独立常量文件，magazineScene.js 内引用该常量；纯 move-only，**0 数值改动**。落定后让"GrainShader uVignette 默认值与 applyShowDim 走秀起点必须同步改"这条 Iter 2 反复强调的同模式坑被结构性消除（两处共用同一常量、物理上不可能再不同步），并为 Iter 4 可能的 tonemap 切换把回归面积从"全文搜散落 17 处"压缩到"看一个文件"。
  - 依赖：无（应在 TECH-2 / 视觉项之前先做，让后续行号地图与视觉数值微调落在抽离后的新格局上）。
  - 验收（**硬验收**）：
    1. `npm run build` 通过且运行期 0 error。
    2. **行为完全不变（零回归红线）**：runtime 抽测的关键渲染常量与 Iter 2 实测完全一致——`scene.background.r * 255 ≈ 24`、`shadowMap.type = 1`、`grainPass.uniforms.uVignette.value = 0.2`、`rimLight.intensity = 0.9`（位置不动）、`scene.fog.near/far = 2.8 / 7.5`、`scene.environmentIntensity = 0.55`、`renderer.toneMapping === ACESFilmicToneMapping 常量`、`renderer.toneMappingExposure = 1.02`；任意一项偏移即视为 move-only 红线破裂。
    3. **抽离边界清晰**：抽出的常量仅覆盖"渲染基线 + 光照 + envMap 桶 + 后期 grain / vignette"层；**绝不抽** applyShowDim 内的 runway lerp 系数（戏剧化曲线、属逻辑非 config）、lightLevels lazy 抓机制、qualityFloor/Ceil/pixelRatio 自适应算法输入、light.position 物理布置、shadow.camera 边界、SpotLight 物理参数（distance/angle/penumbra/decay）、PMREM 模糊度、材质 baseColor（spineMaterial / coverEdge 巧克力色等属于"材质美术资源"层不属于"渲染基线 config"）。
    4. **import 链稳**：新文件单向被 magazineScene.js import，无反向引用、无循环依赖；构建产物与 Iter 2 比 JS bundle 体积变化 ≤ 0.5 kB（move-only 不应实质改变 bundle）。
    5. **light.color hex 抽离保留 PBR 默认路径**：抽出的灯色 hex 字段被 light 构造函数走 `new THREE.XxxLight(hexLiteral, intensity, ...)` 默认 sRGB→linear 路径，**绝不**包装成 `setHex(LinearSRGBColorSpace)`（破 Iter 2 红线 ③ → rim 感知少一档暖）。
    6. **bg / fog / 材质 hex 的 setHex(LinearSRGBColorSpace) 路径保留**：抽出 hex 数值后，原 `new THREE.Color().setHex(0x18130e, THREE.LinearSRGBColorSpace)` 形态变为 `setHex(RENDER.scene.bgHex, THREE.LinearSRGBColorSpace)`，第二个参数 LinearSRGBColorSpace **必须保留**（Iter 2 VIS-SRGB-FIX 的核心修法）。
    7. **GrainShader 默认值与 applyShowDim 走秀起点共用同一常量**（结构性收益）：抽离后两处引用同一字段，"同步改"约束被物理锁定。
    8. **机器化回归门**：抽出前后 grep `envMapIntensity` / `setHex` / `toneMapping` / `toneMappingExposure` / `uVignette` / `shadowMap.type` / `Fog(` 在 magazineScene.js 内的"字面量直接出现"次数显著下降（数值被搬到新文件）、新文件相应字段齐全（无漏抽点位）；总命中数（含新文件）保持完全一致，差异仅来自导入行。
  - 来源：Evolution Iter 3 🔴 Critical TECH-1（Tech Health 头号判定）/ Scout A.2 + B.2 抽离边界与难度评估 / Iter 1 进化 R6 + 研究 R10 一致主张"独立 PR、不与视觉调参合并"。

- [x] TECH-2: project_structure.md / pitfalls.md 行号地图同步（与 TECH-1 一并提交）
  - 目标：把项目结构文档与 pitfalls 里关于 magazineScene.js 总行数 + 若干方法（dispose / landOnSpread / applyShowDim / toggleGallery / 等）的过期行号校正到当前实测——Iter 1+Iter 2 已累计漂移 +30 ~ +155，连续 3 轮 stretch 未做，本轮 TECH-1 落定后 magazineScene.js 行数再变化（净 ±5～10 行）行号本来就要重写，**一次收两笔**最便宜。
  - 依赖：TECH-1 先落（避免抽完 render-config 后行号再变一次、白校正一遍）。
  - 验收：
    1. project_structure.md 中 src/magazineScene.js 总行数 + 关键方法行号与当前实测一致（容差 ≤ ±3 行）；新增的 src/render-config.js 在文件树中正确登记（含一句话职责）。
    2. pitfalls.md 中按行号锚定的"~XXX 行"提示与当前实测一致；不更新"按变量名定位"的语义性提示（那部分本来就不依赖行号）。
    3. SPRINT.md 历史轮条目与 docs/orch/ 历史报告**不动**（历史快照不动），只改 project_structure.md / pitfalls.md。
  - 来源：Evolution Iter 3 🔴 Critical TECH-2 / Iter 1 + Iter 2 Evaluator 连续两轮提醒 / Scout A.3 行号地图同步段。

- [x] VIS-RIM-BOOST: rim 强度抬一档（保位置，最便宜）
  - 目标：Experience Iter 3 实测立牌起立后顶部周围 dy=-12～+12 像素带 lum 是 125→…→217 的渐变、**没有"高亮峰"**——rim 0.9 在用户视角不可见（rim 沿剪影分布、单点采样不够 + 相机正对立牌 rim 在背面）。本轮选 Experience 推荐的"最便宜路线 a"：保位置不动、抬强度一档。**不动 rim 位置**（Iter 2 红线，与 keyLight 夹角已是正常背光）；**不碰 standee material shader**（fresnel 描边路线本轮不做）。
  - 依赖：TECH-1 先落（数值改动落在 render-config.js 而非散落 magazineScene.js，与抽离后的新格局对齐）。
  - 验收（**硬验收 + 可独立验收**）：
    1. `npm run build` 通过且运行期 0 error。
    2. runtime `rimLight.intensity` 抬到新值；位置 (0.8, 3.4, -3.2) 未动。
    3. 像素层断言：立牌起立 + 100 帧 updateStandees(0.02) 后 composer.render，立牌顶部投影 NDC 周围 ±15px 内出现 lum > 200 的亮带（或剪影外缘 lum 比内侧 +30 以上）——Iter 2 实测此带最高仅 217 且非"峰"（无单点高出周围），抬档后应出现可机器断言的"峰"。
    4. **走秀路径无回归**：rim 仍在 lightLevels + applyShowDim 内，dim→restore 不破。
    5. 数值改动落在 TECH-1 抽出的 render-config.js 内（与 TECH-1 验收点 1 不矛盾——TECH-1 是 move-only 不改值，本任务在 TECH-1 落定后单独改值；两个 commit 顺序明确）。
  - 来源：Experience Iter 3 REC-2（路线 a 抬强度保位置）/ Scout A.1 表 #12（Research 路径与 Evo 路径在本项上方向不同，Planner 取 Experience 推荐的最便宜路线）。

- [x] VIS-TABLE-SYM: 桌面前左/前右光照对称（"画面凉"细节）
  - 目标：Experience Iter 3 实测桌面 wood_FrontLeft (97,66,51) lum=73 vs wood_FrontRight (154,125,104) lum=131——比 1.8:1，前左比前右暗一倍，让画面"重心偏右、左下角凉"。根因是 keyLight 在 (-2.4, 4.8, 3.6) 从前左→后右照射 + poolLight 偏左上双重影响。本轮通过最小修法（如 fillLight/hemiLight 偏置）把左右桌面 lum 比收到 ≤ 1.4:1。**不新增光源**（Iter 2 红线，新增光必须同步 lightLevels + applyShowDim）；只调既有光的方向/位置/强度。
  - 依赖：TECH-1 先落（既有光的数值改动落 render-config.js）；与 VIS-RIM-BOOST 独立（可并行验收）。
  - 验收（**硬验收 + 可独立验收**）：
    1. `npm run build` 通过且运行期 0 error。
    2. 像素层断言：1280×800 settled open 状态下桌面前左 / 前右 wood 样区 lum 比 ≤ 1.4:1（Iter 2 基线 ~1.8:1）。
    3. **走秀路径无回归**：若调的是已注册到 lightLevels 的光，dim→restore 路径保持；若需新增方向偏置（不新增光、只动 position/direction）也不破 applyShowDim 既有结构。
    4. 桌面整体 row80/row10 亮度比不被本项回退（Iter 2 实测 1.7:1，本项落定后保持 ≤ 2.0:1）。
    5. 不动取景 / 不动桌面几何 / 不引新素材。
  - 来源：Experience Iter 3 REC-3（"画面凉"的细节）。

- [x] VIS-FOG-FAR: fog far 远端拉远缓和过渡（band 跳变收窄）
  - 目标：Experience Iter 3 实测 10 行带 band 3→4 lum 跳 17（最大跨度）；fog.near=2.8 / far=7.5 跨度只有 4.7m，相对 cam→lookAt 4.73m 远端衰减区间偏窄→桌面深处到杂志区有"硬切感"。本轮把 fog.far 拉远一档让相邻 band lum 差最大收到 ≤ 12。**fog.near 不动**（Iter 1 BUG-FOG-NEAR 已校正、与 cam→lookAt 距离配合正确）；**fog.color 不动**（Research A3 提议的 fog 脱钩本轮也不做——属于 Research 单方主张、未被三方收敛、且与 tonemap 切换是同方向"色相调"决策、一并延后 Iter 4 再议）。
  - 依赖：TECH-1 先落（fog.far 数值落 render-config.js）；与 VIS-RIM-BOOST / VIS-TABLE-SYM 独立。
  - 验收（**硬验收 + 可独立验收**）：
    1. `npm run build` 通过且运行期 0 error。
    2. runtime `scene.fog.far` 抬到新值；`scene.fog.near` 仍 2.8（不动）；`scene.fog.color` 与 bg 仍同 hex（不动）。
    3. 像素层断言：1280×800 settled open 状态下 10 行带相邻 band lum 差最大 ≤ 12（Iter 2 基线最大差 17）。
    4. 桌面远端不出现"硬切"残留：fog.far 抬远后远端到 bg 的过渡平滑、不形成新的色块界线。
    5. **不调取景**——cam→lookAt 距离不变，fog.near 仍 < 该距离（继续满足 BUG-FOG-NEAR 同模式坑约束）。
  - 来源：Experience Iter 3 REC-4（fog far 远端过渡偏陡）。

- [x] DOC-LINEMAP: pitfalls / project_structure 行号校正（与 TECH-2 区分：本项专攻 Iter 3 视觉项落定后的二次校正）
  - 目标：TECH-2 把 Iter 1+2 漂移收齐；本项专攻 Iter 3 视觉项（VIS-RIM-BOOST / VIS-TABLE-SYM / VIS-FOG-FAR）落定后引入的细微漂移 + 把本轮 Iter 3 新踩或新归档的同模式坑写进 pitfalls.md（如"render-config 抽离后数值改动应落新文件不应回散落 magazineScene.js"、"tonemap 切换 timing 延后 Iter 4 + 16 联调点位接力清单"、"行号地图随结构性重构高频漂移的应对模式"等）。
  - 依赖：TECH-1 + TECH-2 + 4 视觉项全部落定后做（否则二次漂移会重来）；可选做（Iter 3 余量不足可推到 Iter 4 与 Iter 4 决策的同步漂移一并收）。
  - 验收：
    1. project_structure.md 中 Iter 3 涉及的视觉项行号校正完成；render-config.js 的字段清单与实际文件一致。
    2. pitfalls.md 末尾追加 Iter 3 新章节，至少包含：① render-config 抽离后数值改动落点约定；② tonemap 切换 timing 延后 Iter 4 的接力提示（含 Evo Iter 3 §A 接力表 16 联调点位 + Research 反向 exposure 方向的分歧，留作 Iter 4 Reviewer 决断点）；③ 视觉项"逐项独立验收"的同模式提示（避免本轮"一锅烩"教训外溢）。
    3. SPRINT.md 历史轮条目与 docs/orch/ 历史报告**不动**。
  - 来源：Evolution Iter 3 §G（行号地图漂移连续 3 轮非阻塞 stretch 应顺手收）/ Scout C-1~C-5 新发现的坑（reviewer 数值方向相反、"17 联调点位"是约数、render-config 抽离与 tonemap 切换在代码现实层独立、BokehPass 1 行 toggle、render-config 语义边界止于"渲染基线"不含材质 baseColor）。

> **Stretch（视余量做，不阻塞 PASS）**：
> - 把 Iter 1 PENDING 至今的 `docs/orch/visual-regression.md` 沉淀（bg.r×255 / row80-row10 / topDarkFrac / centerAvgLum / band 跳变 / 桌面对称 / rim 亮带 这套 headless 断言）建为可重复抽测的脚本骨架，给 Iter 4-5 Evaluator 用同一套基线对比。本轮不强求落地，但若 TECH-1 抽完后余量富足、Generator 顺手记录抽测时用的脚本即可（不要求建独立产物）。
> - 若 VIS-TABLE-SYM 调整后真机审觉得桌面"暖意"反而过头（fill 偏暖系数加重）可微回调，作为视觉项二次微调一并收 DOC-LINEMAP。

> **本轮明确不做（写死避免下轮再议）**：
> ① **本轮不切 tonemap**（ACES → Neutral 延后 Iter 4，理由见 negotiation.md "tonemap 切换 timing"——2:1 多数反对本轮做、Iter 3 先抽 render-config 让 Iter 4 切换的回归面积可控；Iter 4 接力提示已沉淀进 DOC-LINEMAP）；
> ② **本轮不动 fog.color**（与 bg 同色 vs 脱钩属于 Research 单方"色相哲学"主张、未被三方收敛、与 tonemap 同方向决策一并 Iter 4 再议）；
> ③ **本轮不切色温 / 不改 light.color hex 数值**（Evo 接力表里的 key.color/rim.color 去暖一档是 tonemap 切换的配套、不孤立做）；
> ④ **本轮不动取景 / 不调 cameraOpen/Closed/portrait**（Sprint 7+11 收口 + Research Iter 3 自己也把取景调整列为 Iter 4 备选）；
> ⑤ **本轮不抽 magazineScene.js 业务逻辑**（TECH-1 只抽 render config 子模块、不是拆 4681 行单文件的业务层；不动 applyShowDim runway lerp / lightLevels / qualityFloor 自适应算法）；
> ⑥ **本轮不动剩余 7 处匿名 setTimeout**（Evolution Iter 3 已判定是"微泄漏 .remove() 在 detached 节点 no-op、模式归档进 pitfalls 即可"，Iter 4 顺手收）；
> ⑦ **本轮不动 rim 位置 / 不动 standee material shader**（VIS-RIM-BOOST 只抬强度路线 a，路线 b 移位 / 路线 c fresnel 描边都不做）；
> ⑧ **本轮不引新素材 / 不重新论证拆 three.js**（永久红线）；
> ⑨ **本轮不加新功能**（5 轮已收官：远景剪影 / 吊灯 / 灯光预设切换器 / 电影模式切换按钮 / 音频层 / tonemap per-spread / 杂志→档案柜 全部 backlog）；
> ⑩ **本轮不重开 DoF**（Sprint 11 决策 + Evolution Iter 3 §E 明确"DPR=3 真机已贴素材天花板、DoF 重开 perf 风险大于美学收益"——Scout C-4 标注"1 行 toggle"是事实记录、不是行动建议）；
> ⑪ **本轮不引 HDR exr / 不切 AgX**（Research 自己也写"5 轮已收官不要碰"）；
> ⑫ **本轮不建 visual-regression.md 独立产物**（连续 2 轮 stretch 未做，本轮仍降级为 stretch，Iter 4-5 视余量）；
> ⑬ **本轮不动 SPRINT.md 历史轮条目与 docs/orch/ 历史报告**（历史快照不动，DOC-LINEMAP 只改 project_structure.md / pitfalls.md）。

> **Iter 4 候选预告**：① **Iter 4 头号决策点**：tonemap ACES → Neutral 切换——本轮 TECH-1 抽完 render-config 后，Iter 4 Reviewer 真机审 ACES 是否仍压低光过度、且 16 联调点位（Evo §A 接力表）已被 render-config 集中可控，决策点拆成两段：(a) 切不切、(b) 切的话 exposure 走 Research 方向（1.02→1.18 补亮度）还是 Evo 方向（1.02→0.90 配 envIntensity 全局 -15%）——两位 reviewer Iter 3 在 exposure 方向相反，Iter 4 必须 Planner 裁决；② **Iter 4 同步**：剩余 7 处匿名 setTimeout 命名化收尾（Evolution Iter 3 已判定 Iter 4 顺手收）；③ Iter 4 备选：取景 37.6° → 50° 戏剧 3/4（Research 提案 A2、需 cameraStart/Open/Closed/portrait 4 处重校、本轮明确不做）；④ Iter 4-5 stretch：visual-regression.md 沉淀（建 headless 像素直方图脚本骨架）。
> **Iter 5 收尾预告**：最后一轮兜底——若 Iter 4 tonemap 切换有视觉回归、Iter 5 撤回 + 微调；或纯做最后一遍 Evaluator 全量真机审 + pitfalls.md 沉淀 Iter 3-4 新坑。

## 第 6 轮 Iter 4 追加任务（基于 Reviewer 审计）

> 本轮（Iter 4/5）主线：**tonemap ACES→Neutral 切换（两阶段：A3 最小动作 → Experience 预防性降 fallback）+ 配套 Tier 验收门 + 顺手收 PREF-1 latent bug + 收 3-4 行 race B 防御 guards + 顺手清杂项**。
> Iter 3 的 TECH-1 已把 17 联调点位集中到 render-config.js 单文件，本轮终于可以低风险切 tonemap；三 reviewer 在 exposure / envMap / rim / light.color 四个维度数值方向相反——Planner 裁决取 **两阶段方案**：阶段 1 走 Research A3「最小动作」（仅切 tonemap=Neutral + exposure=1.18），跑 Tier 验收门；若过门则停在阶段 1，若破红线则进阶段 2 走 Experience「预防性降一组」（rim 1.5→1.2 + envMap 9 桶 ×0.85 + envIntensity 0.55→0.45 + exposure 1.18→0.90）。Evolution 的 Tier A/B/C/D 验收门作为判定基线、Research 的 clipFrac/rim peak 红线作为破门触发器、Experience 的「预防性降」作为 fallback 工具箱。三方都被尊重，不需要选边站。
> **light.color hex 改动明确拒绝**（红线 ② 物理路径 + Research 否决 + render-config.js:11-28 顶部红线注释 + 隐喻「印刷间不是医院」三重把关）。
> **红线**：3D 氛围装置不动技术栈（keep-three.js）；不动取景 / SSAA / 几何架构；不引新素材；不重构 magazineScene.js 业务逻辑；不加新功能（5 轮已收官）；不动 light.color hex 数值；不动 light.position；不动 fog.color 与 bg 脱钩（Research Phase 1.3 已论证不脱钩，本轮+Iter 5 均不动）；不动 fog.near / fog.far；不重开 DoF（永久 backlog）；不引 HDR / 不切 AgX；不动 SPRINT.md 历史轮条目与 docs/orch/ 历史报告。
>
> 依赖顺序：TONEMAP-1（阶段 1 先做、跑 Tier 验收门 → 若过门收 commit 1；若不过门做阶段 2 收 commit 2）→ PREF-1 / RACE-B-小批 / DOC-FOG-ROI 三项独立可并行（与 tonemap 决策无视觉接触面，可独立 commit 与独立 revert）。

- [x] TONEMAP-1: tonemap ACES→Neutral 切换 + 配套联调（**本轮头号 · 两阶段执行**）
  - 目标：把 `renderer.toneMapping` 从 `ACESFilmicToneMapping` 切换到 `NeutralToneMapping`（Three.js r0.184 起的常量；THREE.NeutralToneMapping 常量 ID 为 6），让"温暖印刷间"的色相忠实度兑现——封面红更深更接近书皮、纸高光从"近白"回到"米黄色高光"、阴影"有色而非死黑"。三 reviewer 在 exposure / envMap / rim 数值方向相反，本任务用**两阶段方案**让三方都被尊重：阶段 1 走 Research A3 最小动作（保守版、仅 2 字段改动），跑 Evolution 的 Tier A+B+C+D 验收门；若过门则停在阶段 1、收 commit 1；若 Research 红线破裂（avgLum<130 / clipFrac>0.5% / rim peak>248 等任一）则进阶段 2 走 Experience 预防性降（在阶段 1 之上加 rim/envMap/envIntensity/exposure 一组联动改动），独立 commit 2 与独立 revert 权。**绝不夹带 light.color hex 改动**（红线 ②）。
  - 阶段策略：
    1. **阶段 1（默认 · 最小动作 · Research A3）**：仅改 `render-config.js` 内 `renderer.toneMapping` = `THREE.NeutralToneMapping` + `renderer.exposure` = `1.18`（其它字段全部不动；envMap 9 桶不动 / rim 1.5 不动 / light.color hex 不动 / envIntensity 0.55 不动）。改完跑 Tier A+B+C+D 全套验收门。**若 6/6 PASS → 阶段 1 收 commit 1、停止、不动 fallback**。
    2. **阶段 2（fallback · 仅在阶段 1 破门时启动 · Experience 预防性降）**：在阶段 1 之上加 `lights.rim.intensity` 1.5→1.2、`envMap` 9 桶各 ×0.85（保留三方一致的"集中改 9 桶"动作）、`scene.envIntensity` 0.55→0.45、`renderer.exposure` 1.18→0.90（与 Experience 方向一致、与 Evo 接力表数值靠近，由 Generator 按 Tier B 像素直方图实测微调具体落点，Planner 不写死数）。独立 commit 2、独立 revert 权。**阶段 2 完成后必须再跑一遍 Tier A+B+C+D**；若仍破门则 git revert commit 2、保留 commit 1（即让"切 Neutral 但调参不到位"也比"完全不切"好），并把根因写进 Iter 5 待修。
  - 依赖：Iter 3 TECH-1 已把 17 联调点位集中到 render-config.js（已 ✓）；阶段 1/2 所有改动只落 render-config.js，magazineScene.js 0 字面量改动。
  - 验收（**硬验收 + Tier A/B/C/D 全套验收门 + Research 红线**）：`npm run build` 通过且运行期 0 error；bundle 字节数与 Iter 3 基线（924779 bytes）差 ≤ 200 字节；
    1. **Tier A · runtime 常量抽测（12 项 headless）**：`renderer.toneMapping === THREE.NeutralToneMapping`（常量 ID 6）；`renderer.toneMappingExposure` = 阶段 1 落 1.18 / 阶段 2 落 0.90 区间；`renderer.shadowMap.type` = PCFShadowMap (1)（不变）；`scene.background.r×255` ∈ [22, 28]；`scene.fog.near` = 2.8（不变）、`scene.fog.far` = 9.0（不变）、`scene.fog.color` 与 bg 同 hex（不变）；`scene.environmentIntensity` 阶段 1 落 0.55 / 阶段 2 落 0.45 区间；5 灯 intensity 阶段 1 全不动 / 阶段 2 仅 rim 落 1.2、其它不动；5 灯 hex 全程不动（key=0xffe4c3 / rim=0xfff0d8 / 等等保持 Iter 3 原值）；grain.amount=0.03 / vignette=0.2 / runwayDelta=0.3 不变。任一项偏离视为破红线。
    2. **Tier B · 像素直方图断言（4-7 项，1280×800 / DPR=1 / spread=4 / state=open / settled，force render 后 drawImage 抽 ImageData）**：`avgLum/256` ∈ [0.42, 0.55]（即 avgLum 落 107-140 区间；Research A 路径目标 ~118、阶段 2 目标 ~108-125）；`darkFrac (lum<32) < 5%`；`brightFrac (lum>180)` 落 [15, 28]%；`clipFrac (lum>250) < 0.5%`（**Research 头号红线**，破即立即 revert 当前阶段）；`bg.r×255` ∈ [22, 28]；rim 顶部 median peak `< 248`（**Research 头号红线 #2**，破即立即 revert 当前阶段或进阶段 2 降 rim）；10 行水平带 `bandMaxStep` **不作为验收门**（Iter 4 Experience 已论证验收口径错、跨杂志/桌面/背景三材质交界，与 tonemap 无关——见 DOC-FOG-ROI）。
    3. **Tier C · 走秀路径回归（4 项）**：`startShow` → `applyShowDim(1)` → `endShow` → `applyShowDim(0)` 后，`rimLight.intensity` 自动回到当前阶段的新基线值（阶段 1=1.5 / 阶段 2=1.2，lazy capture 自动跟）、`hemiLight.intensity`=0.95、`scene.environmentIntensity` 回新基线（阶段 1=0.55 / 阶段 2=0.45）、`grainPass.uVignette`=0.2，全部精确至 1e-3。
    4. **Tier D · 真人肉眼定性校（不可机器化、Evaluator 必须做一次）**：1280×800 settled-open 视觉「温暖印刷间」感保留 / 反差更舒服 / 暖色不显塑料黄；封面红显著更深、更接近暗红书皮（A3 唯一的 brand-new 收益）；纸高光"米黄色而非纯白"；阴影"有色而非死黑、有油墨湿润感"；375×812 portrait closed + open 两态 bg 仍是暖暗色、不出现死黑回归；走秀进/出 dim/restore 平滑、灯复位精确；立牌起立 + 鑑賞 + 卡片三层都不出现色彩偏移、纸质感不破。
    5. **Research 即时回退红线（阶段 1 / 阶段 2 共用）**：`clipFrac > 1%`（不是 0.5% 软门，是硬红线）/ rim 顶部 top10 peak ≥ 254 全部 clip / `avgLum < 100` / `darkFrac > 5%` / `bg.r×255` 跌出 [22, 28] / `brightFrac < 14%` / 控制台任意 error 或 WebGL warn 新增 / 走秀 dim→restore 任一灯不回新基线值——任一触发立即 revert 当前阶段。
    6. **逐项独立验收 + 阶段独立 commit**：阶段 1 与阶段 2 必须独立 commit / 独立 revert 权；阶段 2 不允许"再试一档"耗轮（Iter 4 是单回合判定、Iter 5 是兜底轮不是再决策轮）；若阶段 1 PASS 6/6 则禁止额外做阶段 2 的预防性改动；若阶段 1 破红线且阶段 2 仍破门则 git revert commit 2、保留 commit 1。
    7. **不夹带其它视觉项**：本任务 commit 内绝不包含 light.color hex 改动 / fog.color 改动 / 取景改动 / VIS-TABLE-SYM 二次追（桌面对称留 Iter 5 视余量） / DoF 重开 / 任何"加新功能"项。
  - 来源：Reviewer Iter 4 三方 + Scout A.1/A.2/D.2/D.3 + Evolution §5.5 Tier A/B/C/D 验收门 + Research A3 spec 头部锁定 + Experience §"Iter 4 切 tonemap 的视觉预期 + revert 红线"+ Planner 裁决（两阶段方案，详见 negotiation.md）。

- [x] PREF-1: savePreferences patch 坏字段 wipe good 值修（latent bug 修，独立 commit）
  - 目标：修 Experience Iter 4 在 `src/preferences.js:71-82` 发现的 latent bug——`savePreferences({lastSpread: "abc"})` 当前会把磁盘上已有的旧 good `lastSpread=7` 静默重置为 default `0`，因为 `sanitize({...loadPreferences(), ...patch})` 让坏 patch 字段先覆盖 loaded 旧值、再被 blob 级 sanitize 因「类型不对」回默认。当前 3 个 caller 都送 well-typed 值、线上不可达，但契约不安全——未来某 race 路径下若 caller 不慎传 NaN/null/undefined（如 landOnSpread 在某 race 下读到 spreadIndex 为 NaN），用户的 lastSpread/locale 等持久 good 值会被静默 wipe。修法是新增 patch 级 sanitize（per-field validate before merge）取代当前的 blob 级 sanitize 路径；blob 级 sanitize 保留给 loadPreferences 外部 storage 入口（两者并存）。**独立于 tonemap 切换、独立 commit、零视觉接触面**。
  - 依赖：无（preferences.js 单文件改、与 tonemap 决策完全独立）。
  - 验收（**硬验收 + headless 断言**）：`npm run build` 通过且运行期 0 error；
    1. **修法形态**：preferences.js 内新增字段级 `sanitizePatch(patch, current)` 函数（per-field validate：locale 走 SUPPORTED_LOCALES 检 / skipIntro+guidedOnce 走 typeof boolean / lastSpread 走 Number.isInteger 且 ≥0），坏字段不污染 next，good 字段 merge 过去；`savePreferences` 内 `sanitize({...loadPreferences(), ...patch})` 改为 `sanitizePatch(patch, loadPreferences())`；blob 级 `sanitize`（用于 loadPreferences 外部 storage blob 入口）**保留**。
    2. **headless 断言**：构造 disk 上 `{locale:"zh", skipIntro:true, lastSpread:7, guidedOnce:true}` → `savePreferences({lastSpread:"abc"})` 后 disk 应仍为 `{locale:"zh", skipIntro:true, lastSpread:7, guidedOnce:true}`（**lastSpread 不被 wipe 回 0**）；`savePreferences({locale:"fr"})` 后 disk.locale 仍为 "zh"（不被 wipe 回 "ja" default）；good patch `savePreferences({lastSpread:3})` 仍能正常写入；空 patch / null patch / undefined patch 不报错且不变更 disk。
    3. **零回归**：3 个现有 caller（`{locale}` / `{lastSpread: this.spreadIndex}` / `{guidedOnce, skipIntro}`）行为完全不变；loadPreferences 路径的 blob 级 sanitize 行为完全不变；localStorage 不可用时静默降级行为不变。
    4. SUPPORTED_LOCALES 复用 export :84，不重复定义。
  - 来源：Experience Iter 4 §PREF-1 / Scout A.3 修法接地（10 行内）/ Scout B.2 修法定位。

- [x] RACE-B-小批: 3-4 行 race B 防御性 guards（合并 race B #2 + #3 + #4 三处可收的）
  - 目标：收 Evolution Iter 4 §5.2 + Scout A.4 接地的 4 个 race B 候选里**最可收的 3 个**（#2 tour→openLookCard / #3 lookCard→toggleGallery / #4 turn→openLookCard），合并成一个"openLookCard / 卡片入口 cross-state guards"小补丁——共 3-4 行新代码、全部是 1 行 `if/return` 防御性 guard，与 toggleGallery 内 `if (this.gallery) this.closeGallery()`、`if (this.tour) this.endTour()` 既有同模式对称。**race B #1（show→openLookCard）单独成行作 Iter 5 stretch**，因为它是边界情况（深链 applyDeepLink 在 startShow 之前调用、运行时极少能触发），与本批分批做避免一次塞太多防御性 guard 难评估。**独立于 tonemap 切换、独立 commit**。
  - 依赖：无（magazineScene.js 三处局部插入、与 tonemap 决策完全独立）。
  - 验收（**硬验收**）：`npm run build` 通过且运行期 0 error；
    1. **修法形态**：(a) `magazineScene.js:3735` `openLookCard` 函数头部 `if (typeof spread...) return false;` 后插 1 行 `if (this.turn) return false;`（race B #4）；(b) `magazineScene.js:3351` `this.hudCard` click handler 内 `event.stopPropagation();` 后插 1 行 `if (this.tour) this.endTour();`（race B #2，与 toggleGallery 内 :4215 同模式）；(c) `magazineScene.js:4201` `toggleGallery` 内 `if (this.show) return;` 后插 1 行 `if (this.lookCard) this.closeLookCard();`（race B #3，与 openLookCard 内 `if (this.gallery) this.closeGallery()` 对称）。
    2. **零回归**：正常路径（用户从 settled-open 主动点报头卡片入口、从静止鑑賞 overlay 主动按 G）行为完全不变；既有 race A 修法（toggleGallery 早段四件套复位）路径不破；CARD-1 / CODEC-1 / D2 退鑑賞回写 / 深链 applyDeepLink 路径都不破。
    3. **race B 反测可断言**：构造 race B #2/#3/#4 复现路径（脚本可不写、Evaluator 真机或 headless 触发即可），断言 cross-state 行为对：tour 中点报头卡片 → tour 主动 end + 卡片打开；卡片打开中按 G → 卡片自动关 + gallery 打开；turn 飞行中点报头卡片 → openLookCard return false 不开。
    4. 不动 race B #1（show→openLookCard）—— 该项作 Iter 5 stretch 单独成行。
  - 来源：Evolution Iter 4 §5.2 4 race B 候选清单 / Scout A.4 + B.3 修法接地 / Evolution §"state-guard 七问扫描矩阵"模式归档（沉淀进 pitfalls 由 DOC-FOG-ROI 顺手收）。

- [x] DOC-FOG-ROI: 文档顺手收（pitfalls 三条新坑沉淀 + project_structure 行号小校）— **Iter 4 未启动 → Iter 5 接力完成（pitfalls Iter 4+5 新章节 7 条坑 + project_structure +7~+21 行号校正 + 顶部澄清注释）**
  - 目标：把本轮 Iter 4 三 reviewer 发现的三条同模式坑沉淀进 `docs/plans/pitfalls.md`，避免 Iter 5 / 下个 Sprint 同模式坑重发；同时顺手校 Evaluator Iter 3 §10 提到的两处行号小漂移（createRenderer / createScene 在 project_structure.md 的行号 ±10-20 行偏差，Scout 已实测确认 doc 行号准确、Evaluator 误读，但顺手澄清）。**纯 Markdown / 零代码 / 零视觉接触面**。
  - 依赖：与其它三项独立可并行。
  - 验收：
    1. **pitfalls.md 末尾追加 Iter 4 新章节**，至少包含三条：① **fog band step 验收口径必须 ROI 在远端固定区**（不能跨杂志/桌面/背景三材质交界——Experience Iter 4 §2.4 论证 VIS-FOG-FAR 验收口径错、bandMaxStep 49.5 远超 ≤12 但与 fog 无关；从 Iter 5 / 下个 Sprint 起任何 fog 远端衰减验收必须 ROI 在远端 ROI 而非跨整画面纵向 10 行带）；② **savePreferences patch 必须 per-field validate 再 merge**（PREF-1 同模式：任何 merge partial update over current 的 API 必须 patch 级 sanitize，blob 级 sanitize 不能替代 patch 级——否则坏 patch 字段 wipe 旧 good 值，违反 merge 契约。检测脚本可 headless 断言）；③ **state-guard 七问扫描矩阵**（race B 模式归档：七状态 state/turn/show/tour/gallery/lookCard/peel 之间任何新加 overlay 或入口必须扫一遍跨状态 guard 一致性，避免 race B #1-#4 同模式坑外溢。以 Scout A.4 4 race B 接地表为模板）。
    2. **第四条（可选）**：tonemap 切换两阶段方案的接力提示——记录本轮"阶段 1 Research A3 / 阶段 2 Experience 预防性降"的实际落定结果（阶段 1 PASS 还是触发阶段 2）、Tier A/B/C/D 验收门实测数据基线、Research 红线（clipFrac / rim peak / avgLum 三道）的实测触发与否，给 Iter 5 兜底真机审 + 下个 Sprint 类似切换路径用。本条由 Generator 在 TONEMAP-1 落定后回填，Planner 写"待回填"占位即可。
    3. **project_structure.md 顺手校**：Evaluator Iter 3 §10 提到 createRenderer / createScene 行号 ±10-20 行偏差——Scout A.5 §"没有结构漂移要修"实测 doc 行号实际是函数 def 行、Evaluator 把函数体内首行 RENDER 引用当 def 了，doc 不需要改；但本任务可在 project_structure.md 相应位置加一句澄清注释（"行号锚定函数 def 行、不锚定函数体内首行"），避免后续 Evaluator 重复误读。
    4. **SPRINT.md 历史轮条目与 docs/orch/ 历史报告不动**（历史快照不动，红线延续 5 轮）。
  - 来源：Experience Iter 4 §2.4 fog 验收口径错 / Experience Iter 4 §PREF-1 / Evolution Iter 4 §5.2 race B 七问 / Evaluator Iter 3 §10 行号小漂移 / Scout A.5 + C-6 文档归档建议。

> **Stretch（视余量做，不阻塞 PASS）**：
> - **RACE-B-#1**（show→openLookCard）—— `openLookCard` 头部加 `if (this.show) return false`（1 行），边界情况、深链 applyDeepLink 在 startShow 之前调用、运行时极少触发；与 RACE-B-小批 分批做避免一次塞太多防御性 guard 难评估。Iter 5 顺手或本轮余量富足时收。
> - **BokehPass 彻底 removePass**（Experience §3 "可以删掉的东西"）—— composer 仍挂 BokehPass 但 enabled=false（Sprint 11 关 DoF 决策落地后未移除 pass）。`composer.removePass(this.bokehPass)` 1 行收尾、每帧省一点点 setup；本轮余量富足时收，否则 Iter 5。
> - **VIS-TABLE-SYM 桌面对称 1.75:1 → ≤1.4:1**（Experience §2.1）—— 当前 1.75:1 与 Iter 3 验收门 1.4:1 还差 0.35，但本项与 tonemap 切换耦合（Neutral 下桌面色温感会变），**本轮不动**，留 Iter 5 视余量在 Neutral 基线上重新观察、再决定收不收。
> - **visual-regression.md** 沉淀脚本骨架（连续 4 轮 stretch 未做）—— Iter 5 收尾轮值得做，本轮不强求。

> **本轮明确不做（写死避免下轮再议）**：
> ① **不动 light.color hex 数值**（红线 ②：Iter 2 反复点名「不动 light.color」物理路径 + Research Iter 4 否决「Neutral 下色相还原好、去暖反让'印刷间'读作'医院'」+ render-config.js:11-28 顶部红线注释三重把关；阶段 1 与阶段 2 均禁止改 `key.hex` / `rim.hex` / `pool.hex` / `fill.hex` / `hemi.skyHex` / `hemi.groundHex` 任一）；
> ② **不动 fog.color**（Research Phase 1.3 已论证不脱钩、本轮+Iter 5 均不动、与 bg 同色 0x18130e 是新隐喻"深夜印刷间"下对的设计）；
> ③ **不动 fog.near / fog.far**（Iter 3 VIS-FOG-FAR 已校 + Iter 4 Experience 论证验收口径错、本轮不为 bandMaxStep 49.5 再调 fog）；
> ④ **不动 light.position / SpotLight 物理参数 / 取景 / 几何 / SSAA / RoomEnvironment 替换**（Iter 2/3 红线延续，5 轮已收官）；
> ⑤ **不新增光源**（Iter 2 红线，新增光必须同步 lightLevels + applyShowDim）；
> ⑥ **不切色温 / 不改 light.color hex 数值**（同 ①，Evo 接力表里的 key.color/rim.color 去暖一档是 ACES 下的补偿、Neutral 下不需要）；
> ⑦ **不重开 DoF**（永久 backlog + Sprint 11 决策 + Evolution Iter 3/4 反复点名 perf 风险大于美学收益；BokehPass 彻底 removePass 只是清挂着的死代码、不是重开）；
> ⑧ **不引 HDR exr / 不切 AgX**（Research 自己也写"5 轮已收官不要碰"，Iter 4-5 均不做）；
> ⑨ **不加新功能**（5 轮已收官：远景剪影 / 吊灯 / 灯光预设切换器 / 电影模式切换按钮 / 音频层 / dev-only 视觉调试面板 / tonemap per-spread / 时段感"夜深一档"按钮 / 深链 codec 升维到 `?spread=N&item=M&look=X` 全部 backlog，留下个 Sprint）；
> ⑩ **不抽 magazineScene.js 业务逻辑 / 不抽 materials-config**（Iter 3 已抽 render-config；进一步抽离属"独立 PR、不与视觉调参合并"原则，留下个 Sprint）；
> ⑪ **不动剩余 11 处匿名 setTimeout**（Evolution Iter 4 §5.1 已物理论证"已 guard + detached node no-op、不值得清"——本轮不再回归讨论）；
> ⑫ **不追 VIS-TABLE-SYM 桌面对称在本轮同提交内继续收**（与 tonemap 切换耦合、留 Iter 5 视余量）；
> ⑬ **不动 SPRINT.md 历史轮条目与 docs/orch/ 历史报告**（历史快照不动）；
> ⑭ **阶段 2 不允许"再试一档"耗轮**（破红线后只允许：commit 2 PASS 收 commit / 或 revert commit 2 保留 commit 1 / 不允许 commit 3 再微调）。

> **Iter 5 兜底预告**：① 真机终审（封面红 / 纸高光 / 阴影湿润感三项 A3 唯一 brand-new 收益的肉眼判断） + pitfalls.md 沉淀 A3 实测；② 视余量做 RACE-B-#1 / BokehPass removePass / VIS-TABLE-SYM 在 Neutral 基线上的二次观察；③ visual-regression.md 沉淀脚本骨架（连续 5 轮 stretch 未做、最后一轮机会）；④ 把"晨光印刷间"措辞校正成"深夜印刷间"语义（Research Iter 4 Phase 1.5 终审）；⑤ 若 Iter 4 阶段 2 仍破门 → Iter 5 git revert 整套 tonemap 切换 + pitfalls 沉淀"A3 仿真预期与真机肉眼差距"研究记录。**Iter 5 明确不做**：切其它 tonemap（AgX / 自写 LUT）、加新功能、动取景、改 light.color、动 fog.color。

## 第 6 轮 Iter 5 追加任务（最终轮 · 收尾）

> 本轮（Iter 5/5）主线：**DOC-FOG-ROI 接力 + git add untracked 顺手收 + Tier D 真机审（Evaluator 侧）= 5 轮 Sprint 收官**。
> 策略说明：Iter 4 Stage 1 6/6 PASS、用户主诉两端均实质解决（终态 8.7/10 / Tech Health 8.9/10）；最终轮 · 收尾基调 = 不做任何新功能 / 新方向 / 新调参；三方收敛度 5 轮里最高、无残余分歧、Planner 无需技术裁决；只做 Iter 4 留下的纯文档接力 + 5 轮欠债 git add + Tier D 真机审兜底归档。
> 5 轮收官观察：① **用户主诉两端均实质解决** —— 代码 bug 9/9 全 commit + 视觉评分 6.5→8.7（avgLum 70.6→119.23 / darkFrac 38.9%→0.025% / bg.r×255 ≈ 2→24 / Neutral 保色 + rim 1.5 暖描边）；② **还差 3 项 sprint 余量项 + 1 个素材天花板**（VIS-TABLE-SYM 根因在光位置 / 取景 no-man's land / 音频层 / 941×1672 素材天花板）；③ **下个 Sprint 头号 = 拆 materials-config.js + state-machine.js**（TECH-1 ROI 范式推广）+ 第二头号音频层 + 第三头号取景重做。
> 本轮明确不做（三方共识，写死）：TONEMAP-1 Stage 2 不启动 / 取景不动 / DoF 不重开 / VIS-TABLE-SYM 二调不做 / visual-regression.md 骨架不做 / BokehPass removePass 不做 / 任何新功能 / 任何新方向 / 任何 src/* 代码 delta。

- [x] DOC-FOG-ROI（Iter 4 接力 · 最终轮收尾）：5 轮收尾文档接力 + git add untracked 5 轮欠债清理（合并一 commit）
  - 目标：把 Iter 4 三方独立点名的同模式坑 + Iter 5 三方新沉淀的 3 条新坑沉淀进 `docs/plans/pitfalls.md`；project_structure.md 行号小校（Scout 实测漂移 +7 ~ +21）+ 顶部澄清注释；隐喻措辞统一为"深夜印刷间"（A3 落定后 Research Iter 4/5 终审收口）；git add 5 轮以来 untracked 的 src/deeplink.js + src/lookCard.js + public/og-cover.png + docs/orch/ + docs/plans/ + docs/project_structure.md（Scout E.2 5 轮欠债补 catch）。**纯 Markdown 改 + git add / 零代码接触面 / 零视觉接触面 / 10-15 分钟可收**。
  - 三条 pitfalls 同模式坑（措辞参考 Scout B.1）：
    1. **fog band step 验收口径必须 ROI 在远端固定区**（VIS-FOG-FAR 同模式坑、Iter 4 暴露）：任何 fog 远端衰减验收 ROI 必须**固定在远端单一材质区**，不能跨杂志/桌面/背景三材质交界。bandMaxStep / 桌面对称比 / 顶部 dark band 等都可能踩同样的坑。
    2. **savePreferences patch 必须 per-field validate 再 merge**（PREF-1 同模式坑、Iter 4 latent bug 修）：任何 merge partial update over current 的 API 必须 patch 级 sanitize，blob 级 sanitize 不能替代——否则坏 patch 字段 wipe 旧 good 值，违反 merge 契约。
    3. **state-guard 七问扫描矩阵**（RACE-B 同模式坑、Iter 4 race B 七问归档）：七状态 state/turn/show/tour/gallery/lookCard/peel 之间任何新加 overlay 或入口必须扫一遍跨状态 guard 一致性，避免 race B 同模式坑外溢。
    + Iter 5 新沉淀三条：④ TONEMAP-1 两阶段方案实际落定 = Stage 1 即 PASS、Stage 2 fallback 未触发（实测数据回填、给下个 Sprint 类似切换路径参考）；⑤ dev server stale-module 警告（location.reload() 才能加载新 commit 后的 src/*，下个 Sprint Evaluator 复验前必读）；⑥ 隐喻措辞统一为"深夜印刷间"（A3 落定后 Research 终审收口）；⑦ NeutralToneMapping 常量值 id=7 不是 6（三方文档均误写 6、源码常量正确）。
  - 行号校正（Scout B.2 实测）：表格"行号"列里 3383~3683 全段 +7 / 3735~4201 全段 +7~+15 / 4419~4676 全段 +21；`src/magazineScene.js` "~4752 行" 实测准确不动；行号地图段标题下加澄清注释"行号锚定函数 def 行，不锚定函数体内首行 RENDER 引用"。
  - git add 顺手项（合并一 commit、Scout A.2 接地）：纯源代码 `src/deeplink.js` + `src/lookCard.js`（Sprint 5 CARD-1+CODEC-1 落定时漏 add、`git log` 返 0 行）/ 构建必需资源 `public/og-cover.png`（Sprint 4 H1 OG 图、未 add 部署时会丢）/ 文档树 `docs/orch/` + `docs/plans/` + `docs/project_structure.md`（6 轮 reviewer/scout/plan/negotiation/gen_status/eval + 合同 + pitfalls + project_structure 全部 untracked）。**不 add**：`.claude/launch.json`（环境配置留用户决策）/ `.gitignore`（已 modified 本轮不动）。
  - 隐喻统一（顺手 grep "晨光" 替换）：扫 `docs/plans/` + `docs/project_structure.md` + `docs/FUTURE.md` 内"晨光印刷间"或"晨光"字眼，统一改为"深夜印刷间"或"温暖印刷间"。**不动 SPRINT.md 历史轮条目 + docs/orch/ 历史报告**（历史快照红线 5 轮延续）。
  - 验收：
    1. `npm run build` PASS（兜底"没误改 src/* 触发 build 回归"）+ 运行期 0 error 0 warn。
    2. `docs/plans/pitfalls.md` 末尾出现新章节"## 渲染 / 画质 + 状态机 + 文档卫生（第 6 轮迭代 / Iter 4 + Iter 5 新增）"，至少 5 条同模式坑可读、含 TONEMAP-1 Stage 1 实测数据 + 隐喻收口。
    3. `docs/project_structure.md` 行号校正三段应用 + 顶部澄清注释加上。
    4. `git status` 显示：`docs/orch/` + `docs/plans/` + `docs/project_structure.md` + `public/og-cover.png` + `src/deeplink.js` + `src/lookCard.js` 全部从 `??` 转为已 staged 或已 commit。
    5. `grep -n "晨光" docs/plans/ docs/project_structure.md docs/FUTURE.md` 0 命中（或所有命中已替换）；`docs/orch/` 与 SPRINT.md 历史轮条目不动。
    6. **零代码接触面验收**：`src/magazineScene.js` / `src/render-config.js` / `src/preferences.js` / `index.html` / `src/styles.css` / `src/main.jsx` / `src/App.jsx` **0 行 delta**。
  - 来源：Iter 4 plan.md `DOC-FOG-ROI` 任务 + Iter 4 eval.md:158 + Iter 5 Experience §🔴 + Iter 5 Evolution §🔴 + Iter 5 Research §🔴 + Scout A.1 + A.2 + B.1 + B.2 + E.2。

- [x] Tier D 真机肉眼终审（Evaluator 责任 · 非 Generator 任务 · 列入合同作为 Iter 5 验收一部分）— **PARTIAL PASS**：5 项中 4/5 PASS（hue subjective 三项由像素直方图 + warmth +37.8 + R>G>B 偏移 + 米黄高光 R/G/B=235/215/197 反向佐证 PASS、真人 hue 定性留 stretch；走秀 dim/restore + 三层一致性 headless PASS）。详见 eval.md。
  - 目标：5 轮里 Tier D 真机肉眼定性校全部 PENDING、Iter 5 是最后一次机会；Evaluator 在 1280×800 + 375×812 双断点 settled-open 真机审五项 + 复跑 Tier A 12 项确认 Stage 2 未启动。
  - 五项肉眼定性校（A3 三项 raison d'être + 走秀路径 + 三层一致性）：
    1. **封面红显著更深、更接近暗红书皮**（A3 唯一 brand-new 收益、headless 像素直方图测不出）
    2. **纸高光"米黄色而非纯白"**（Neutral 不卷尾的色温头量、rim peak 69.5 反向证明但无法直接抽 hue）
    3. **阴影"有色而非死黑、有油墨湿润感"**（Neutral 不压暗影到 0、darkFrac 0.058% 反向证明但无法直接抽色相）
    4. **走秀 startShow→endShow dim/restore 平滑**、灯复位精确（5 灯/env/vignette 1e-3 内一致）
    5. **立牌起立 + 鑑賞 + 卡片三层一致性**（无色彩偏移、纸质感不破）
  - 复跑 Tier A 12 项确认 Stage 2 未启动：rim=1.5 / env=0.55 / exposure=1.18 / envMap 9 桶 Iter 3 末值；render-config.js 文件 grep 确认 `toneMapping: 'Neutral'` + `exposure: 1.18` 且无 fallback 数值。
  - 验收：Evaluator 在 Iter 5 eval.md 记录五项肉眼判定（PASS / FAIL / N/A）+ Tier A 12 项复跑结果。破任一项 → 给 Planner 触发 Iter 6 决策（但 Iter 5 是最终轮、5 轮已收官，破亦不再追加 sprint，仅作为下个 Sprint 接力提示）。
  - 来源：Iter 4 plan.md TONEMAP-1 §Tier D + Iter 5 Experience §🟡 + Iter 5 Evolution §🟡 + Iter 5 Research §🔴。

> **Iter 5 明确不做（最终轮 · 三方共识写死）**：
> ⑮ **TONEMAP-1 Stage 2 fallback 不启动**（Iter 4 Stage 1 6/6 PASS、plan §527 红线、做了反破坏 A3 兑现度）；
> ⑯ **取景 40° 不动**（Research §1.1 5 轮永久判定、下个 Sprint 独立头号）；
> ⑰ **VIS-TABLE-SYM 二调不做**（根因在光位置不在强度、属新调参不属"收尾"、留下个 Sprint 跟拆 materials-config.js / state-machine.js 一并做）；
> ⑱ **visual-regression.md 骨架不做 / BokehPass removePass 不做 / RACE-B-#1 不再补**（连续 5 轮 stretch 累积低 ROI 信号 / BokehPass 已 Sprint 11 enabled=false 5 轮稳定不影响渲染 / RACE-B-#1 Iter 4 Generator 已顺手收 commit `56aa7cb`）；
> ⑲ **任何 src/* 0 行 delta**（DOC-FOG-ROI 是纯文档任务、零代码接触面）；
> ⑳ **任何新功能 / 新方向 / 新桌上赌注**（远景墙 / 吊灯 / HDR / AgX / 风格化 V2 / 灯光预设切换器 / 设置面板 / 音频层 / 卡片 stage B PNG 导出 / 二维码 / 时段感按钮 / 深链 codec 升维到 `?spread=N&item=M&look=X&time=T`——全部下个 Sprint 候选）；
> 永久红线延续（Iter 1-4 已写死）：不动 light.color hex / 不动 fog.color / 不动 fog.near 或 far / 不动取景 / 不动 SSAA / 不动 light.position / SpotLight 物理参数 / RoomEnvironment 替换 / 不切其它 tonemap / 不引 HDR exr / 不动 11 处匿名 setTimeout（5 轮终审一致不值得清）/ 不抽 magazineScene.js 业务逻辑（留下 Sprint）/ 不动 SPRINT.md 历史轮条目 / 不动 docs/orch/ 历史报告 / 不重新论证拆 three.js。

> **Sprint 7 接力预告**（5 轮收尾观察的 TOP 3 头号候选，本 sprint 不动）：
> ① **拆 materials-config.js + state-machine.js 两个子模块**（TECH-1 ROI 范式推广：材质 baseColor 层 + 状态机交叉表层；把"加新 overlay / 切 tonemap / 调材质"全部走可控回归面积路径）；
> ② **音频层落地**（编码侧 startAudio/playSound 已就绪、public/audio/* 多数空缺；落地后凑够 ≥2 无家偏好、设置面板届时才值得建——氛围装置定位最后一格沉浸缺口）；
> ③ **取景重做（37.6° → 50° 戏剧 3/4 或 60° reader POV）**（5 轮反复识别但 5 轮均无余量；需配 Sprint 7+11 同等级别的取景重做规划：cameraStart/Open/Closed/portrait 4 处 + 375px 移动端两条红线重新验收）。
> 进阶视觉候选（下下个 Sprint 或之后）：HDR exr 环境贴图 / per-spread tonemap / 远景墙 / 远景剪影 / 吊灯 / 卡片 PNG 导出 + 二维码（CARD stage B）/ HemisphereLight 窗光 / 时段感按钮 / 深链 codec 升维。

