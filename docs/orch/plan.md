# Iteration 1 Plan

## 待完成任务（按依赖顺序）
1. S16-SCHEMA-1: Commentary schema contract and compatibility rules
   - 目标：让 commentary 数据形状、兼容边界和未来可选字段对作者与验证流程都明确。
   - 依赖：无
   - 验收：required/optional/locale/item/expression/beat/focus/voice/emotion/mouth 规则完整；`part` 有有限枚举；现有数据符合或只做语义不变的必要归一化；未知未来可选字段不成为当前 UI 的硬依赖。

2. S16-WORKFLOW-1: Commentary authoring workflow doc
   - 目标：把单个 image pack 从素材检查到 commentary 写作、锚点确认和验证的流程固定为可重复工作法。
   - 依赖：S16-SCHEMA-1
   - 验收：覆盖从 source/prompts 检查、候选时尚单品抽取、视觉确认、双语 commentary 写作到验证的顺序；说明如何选择 4-6 个强单品；说明 normalized anchor 的放置/修订；明确缺 voice 时降级为字幕和标签。

3. S16-VALIDATE-1: Local commentary validation command
   - 目标：给全部 commentary 数据提供一个本地一键验证入口，失败信息可定位到 pack 和字段。
   - 依赖：S16-SCHEMA-1
   - 验收：验证 JSON shape、schemaVersion、双语 locale 完整性、item count、唯一 item ID、part enum、anchor range、expression hints、可选 beat/focus event type、可选 voice 路径存在性；数据有效时退出 0，错误时退出非 0 且输出可读。

4. S16-AUDIT-1: Commentary audit and spot checks
   - 目标：留下轻量的人类可读审计结果，让数据质量不用逐个打开 JSON 也能被看见。
   - 依赖：S16-SCHEMA-1；S16-VALIDATE-1
   - 验收：汇总全部 pack 的文件数、item 数、part distribution、expression usage、optional field usage、voice 空缺状态；至少三包 spot check 覆盖 hotspot 合理性、日文语气、中文含义、expression linkage；记录本 sprint 的数据修正。

5. S16-VERIFY-1: Verification and roadmap closeout
   - 目标：证明 Sprint 16 数据生产管线完成，同时不回归前端、资源和既有叙事状态。
   - 依赖：S16-WORKFLOW-1；S16-SCHEMA-1；S16-VALIDATE-1；S16-AUDIT-1
   - 验收：commentary validation、build、asset audit、narrative smoke 全部通过；roadmap 标记 Sprint 16 状态；项目结构文档纳入新增脚本/文档；Bokeh 默认关闭和 NeutralToneMapping 保持不变。

## 相关陷阱（从 pitfalls.md 筛选）
- [表情卡 / commentary 联动] `EXPRESSION_HINTS` 必须覆盖 commentary 实际用到的全部 hint；新增表情类别时要同步处理，否则会静默失效。
- [コーデ / 角色卡] 卡片/单品深链取数必须走 module-level spread-to-commentary 索引，不走运行期 `this.standees` 或 `currentSpreadCharacter()`。
- [通用] WebAudio 音效文件可能空缺；缺失音频应静默降级，不应抛错。
- [通用] 真人声优克隆 TTS 仅限私人 demo；公开发布需换可商用音色或仅保留字幕。
- [状态 / Narrative beats] Primary-event HUD 与 discovery cue 必须保持 display-only，不写 preferences、不排队状态。

## 上轮失败分析（仅迭代 2+ 有 eval.md 时填写）
- 不适用：这是 Sprint 16 Iteration 1；历史 Sprint 15 eval 不作为失败输入。

## 验收命令（从 SPRINT16.md 的验收命令章节原样复制）
```powershell
npm run commentary:validate
npm run build
npm run asset:audit
npm run narrative:smoke
Select-String -Path 'docs/commentary-pipeline.md' -Pattern 'source.md','main-visual.png','character-transparent.png','anchor','voice'
Select-String -Path 'docs/commentary-audit.md' -Pattern 'Spot checks','part distribution','Corrections'
Select-String -Path 'docs/FUTURE.md' -Pattern 'Sprint 16'
Select-String -Path 'src/magazineScene.js' -Pattern 'this.bokehPass.enabled = false'
Select-String -Path 'src/render-config.js' -Pattern 'NeutralToneMapping'
git diff --check
```
