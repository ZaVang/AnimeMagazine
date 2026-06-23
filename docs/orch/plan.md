# Iteration 1 Plan

## 待完成任务（按依赖顺序）
1. S15-BEAT-1: Primary-event data layer
   - 目标：为每个 spread 建立一个可解析的 primary narrative event，并在缺少 metadata 时稳定降级。
   - 依赖：无
   - 验收：现有 commentary 数据继续有效；可选 beat / focus metadata 能描述 primary event、emphasis 与 gentle prompt；每个 spread 恰好解析出一个 primary event；解析逻辑可在不启动 WebGL 的情况下验证。

2. S15-HUD-1: Primary-event HUD emphasis and noise reduction
   - 目标：让当前 primary event 更容易被注意到，同时让非主事件控件保持可用但视觉上更安静。
   - 依赖：S15-BEAT-1
   - 验收：HUD 以小型、非说明书式方式呈现当前 primary event；鑑賞、look-card、guided tour/commentary 与 runway 控件可用时仍可触达；375px mobile 不出现 primary-event UI、bottom status、standee 与核心控件重叠；reduced-motion 下没有 pulsing、swaying 或 animated discovery emphasis。

3. S15-DISCOVERY-1: First-time discovery cues
   - 目标：让首次用户在不依赖键盘快捷键或长说明文字的情况下发现 page turn、standee、鑑賞、commentary、look-card 与 runway。
   - 依赖：S15-BEAT-1, S15-HUD-1
   - 验收：每个 cue 都符合场景语境，优先使用相机、灯光、柔和热点、tag 或控件强调而不是解释性文案；每个 cue 每会话最多出现一次，或仅在相关 event 可用时出现；cue 尊重 reduced-motion 且不引入静态或动态噪声；deep link、gallery landing、look-card、tour 与 runway flow 不被 discovery cue 打断。

4. S15-STATE-1: Seven-state matrix and guards
   - 目标：复核七状态交互矩阵，明确新增或触碰入口在其他状态活跃时的处理策略。
   - 依赖：S15-BEAT-1, S15-HUD-1, S15-DISCOVERY-1
   - 验收：项目文档列出 state / turn / show / tour / gallery / lookCard / peel 的策略；新增或触碰入口声明在其他状态活跃时是关闭、返回还是排队；存在 repo-local smoke command 覆盖代表性状态转换：deep link、gallery landing、look-card、runway/tour 与 reduced-motion。

5. S15-VERIFY-1: Verification and roadmap closeout
   - 目标：留下可重复证据，证明 Sprint 15 完成且未回归 Sprint 13/14 边界。
   - 依赖：S15-BEAT-1, S15-HUD-1, S15-DISCOVERY-1, S15-STATE-1
   - 验收：build、asset audit、visual smoke 与 narrative smoke 均通过；roadmap 标记 Sprint 15 完成或明确 defer 残余产品 polish；项目结构文档更新新模块、脚本或文档；Bokeh 默认关闭、NeutralToneMapping、DOM 鑑賞真实图片层、WebGL variant drift 等边界不回归。

## 相关陷阱（从 pitfalls.md 筛选）
- [鑑賞 / DOM] 鑑賞 overlay 必须继续是真实 DOM `<img>`，canvas/WebGL smoke 捕获不到它，不能回退到 canvas 或用 canvas 证据替代 DOM 验证。
- [渲染 / 画质] BokehPass 默认关闭，renderer toneMapping 使用 `THREE.NeutralToneMapping`，Sprint 15 不能借 HUD 或 cue 改动重开重型后期或改 tone mapping。
- [commentary / card 数据] 卡片与 commentary 可用性必须来自 module-level 索引，不能依赖运行期 `this.standees` 是否已经 build 完成，避免冷启动竞态。
- [状态机] 新增 overlay 或入口必须扫七状态 guard 矩阵，明确 state、turn、show、tour、gallery、lookCard、peel 交叉时的行为。
- [切层 race] 任何切层 toggle 路径都要防止在飞 turn 或 stale state 覆盖刚落定的 spread/state。
- [reduced-motion] reduced-motion 用户不能收到 animated pulse、静态 frozen noise 或依赖延时动画的发现 cue。
- [移动端 HUD] 375px 窄屏装饰性 HUD 元素可牺牲，核心控件、standee 与阅读内容不可被装饰压住。
- [偏好持久化] 不要把 card、tour、runway 或 discovery 的临时状态持久化到 preferences。

## 上轮失败分析（仅迭代 2+ 有 eval.md 时填写）
- 不适用：这是 Sprint 15 Iteration 1；历史 Sprint 14 eval 不作为失败输入。

## 验收命令（从 SPRINT15.md 的验收命令章节原样复制）
```powershell
npm run build
npm run asset:audit
npm run visual:smoke
npm run narrative:smoke
Select-String -Path 'src/magazineScene.js' -Pattern 'this.bokehPass.enabled = false'
Select-String -Path 'src/render-config.js' -Pattern 'NeutralToneMapping'
Select-String -Path 'docs/FUTURE.md' -Pattern 'Sprint 15'
Select-String -Path 'docs/state-matrix.md' -Pattern 'state','turn','show','tour','gallery','lookCard','peel'
git diff --check
```
