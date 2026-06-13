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

> 备注：窄竖屏「聚焦单页」的更激进取景留作 P2；当前整跨页可见 + Sprint 2 的鑑賞缩放已能正常阅读。

> 备注：发现性提升（立牌起立/换姿/解说/走秀的上下文引导）与初始机位推近属 P2，
> 暂列入下方功能 Roadmap 之后的打磨项，未单独开 Sprint。

---

# 功能 Roadmap（既有规划）

## 1. 吊牌穿搭解说（方案 4）

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
- 各包 commentary.json + voice/ 目录 → 解锁解说系统
- 绿幕 sheet 留作图生视频首帧素材（绿幕走秀视频 → 色键上台，
  替代/补充现有暗场方案，管线已预留色键模式开关位）
- 音效素材仍空缺：public/audio/page-turn-01~03、cover-open、cover-close、
  room-tone、runway（规格见聊天记录，即插即用）
