# Iteration 1 Plan

## 待完成任务（按依赖顺序）
1. S14-PAPER-1: Printed paper material layer
   - 目标：让印刷页与封面表面呈现更可信的纸张、油墨和页缘质感，同时保持现有资源边界。
   - 依赖：无
   - 验收：页面和封面仍使用现有纹理与 PBR 纸张资源；视觉读感是纸和印刷油墨而非塑料、玻璃、发光界面或屏幕遮罩；效果可控且不引入大型新资产。

2. S14-TURN-1: Bend-dependent page highlight/shadow
   - 目标：让正在剥离或翻动的纸页出现轻微的弯折相关明暗线索，增强纸张厚度与受力感。
   - 依赖：S14-PAPER-1
   - 验收：明暗线索只出现在剥离、翻页或活动翻页叶片上；静止页面保持稳定阅读观感；现有翻页状态行为、页面尺寸和相机取景不变；页面内容不被明暗效果遮蔽到不可读。

3. S14-STANDEE-1: Standee rim and soft cutout integration
   - 目标：降低立牌像平面贴纸的感觉，增加轻微边缘融合，同时保留纸质切片角色。
   - 依赖：S14-PAPER-1
   - 验收：立牌匹配、锚点、点击目标、commentary UI、透明行为和动作逻辑继续正常；透明边缘没有明显 halo 或黑边；reduced-motion 用户不会看到快速脉冲或嘈杂边缘动画。

4. S14-GRADE-1: Lightweight color grade and reduced-motion guard
   - 目标：加入轻量、可控的色彩层次调整，并确保所有时间驱动视觉效果尊重 reduced-motion。
   - 依赖：S14-PAPER-1、S14-TURN-1、S14-STANDEE-1
   - 验收：BokehPass 默认保持关闭；renderer tone mapping 仍为 THREE.NeutralToneMapping；所有时间驱动 shader 或 postprocess 在 reduced-motion 下禁用或冻结，静态纸张纹理允许保留；属于渲染基线的视觉常量保持集中，非相关物理或材质逻辑不混入其中。

5. S14-VERIFY-1: Visual verification and documentation
   - 目标：留下可重复的构建、资源审计、视觉 smoke 与文档证据，证明 Sprint 14 完成且未突破 Sprint 13b 的资源和阅读器边界。
   - 依赖：S14-PAPER-1、S14-TURN-1、S14-STANDEE-1、S14-GRADE-1
   - 验收：构建通过；资源审计通过且 WebGL 变体漂移检查保持干净；存在 repo-local visual smoke 且通过；visual smoke 覆盖桌面 1280x800 与移动端 375x812，确认 WebGL 非空并记录截图路径或摘要指标；docs/FUTURE.md 标记 Sprint 14 完成或明确 defer；如引入新脚本、文件或材质模块，项目结构文档同步更新。

## 相关陷阱（从 pitfalls.md 筛选）
- [预览 / 验证] 本应用是持续 rAF 的 three.js canvas，preview_screenshot 容易超时；视觉 smoke 应使用项目既有可重复验证路径，并显式覆盖 1280x800 与 375x812。
- [预览 / 验证] 鑑賞 overlay 是 DOM `<img>`，不在 canvas 像素捕获里；不能用 canvas 像素结论替代 DOM 阅读器边界验证。
- [渲染 / 画质] 941x1672 是当前印刷源图清晰度天花板；shader、SSAA 或材质增强不能被表述为突破源素材小字清晰度上限。
- [渲染 / 画质] BokehPass 默认关闭；本 sprint 不能把景深重新作为默认开启效果。
- [加载 / 纹理] 内页和封面可以使用现有 bitmap 解码路径；立牌相关贴图必须保持 raw、不预翻转，否则会破坏像素分析、裁剪和匹配。
- [渲染 / 画质] Grain 或其他时间驱动视觉效果在 reduced-motion 下应被整体禁用或冻结，避免静态颗粒、快速脉冲或额外 shader 成本。
- [渲染 / 画质] light color hex 不要套用 LinearSRGBColorSpace；该规则只适用于 background、fog、material color 等特定色值路径。
- [渲染 / 画质] render-config.js 的边界是渲染基线、光照、环境桶和后期基线；不要把材质美术、物理布置或状态机逻辑混入其中。
- [渲染 / 画质] NeutralToneMapping 应按 THREE.NeutralToneMapping 语义引用，不写死常量数值。
- [通用] magazineScene.js 体量大，任何视觉改动都应避免无关大重构，尤其不要为了本轮材质 pass 扩散到导航、页数、阅读器或 TTS 领域。

## 上轮失败分析（仅迭代 2+ 有 eval.md 时填写）
- 不适用：这是 Sprint 14 Iteration 1；当前 docs/orch/eval.md 来自 Sprint 13，旧报告不作为本轮失败输入。

## 验收命令（从 SPRINT14.md 的验收命令章节原样复制）
```powershell
npm run build
npm run asset:audit
npm run visual:smoke
Select-String -Path 'src/magazineScene.js' -Pattern 'this.bokehPass.enabled = false'
Select-String -Path 'src/render-config.js' -Pattern 'NeutralToneMapping'
Select-String -Path 'docs/FUTURE.md' -Pattern 'Sprint 14'
```
