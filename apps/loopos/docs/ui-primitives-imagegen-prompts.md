# LoopOS UI 原色 · ImageGen 提示词

> 用于 Google ImageGen 生成专业 UI 参考图
> 每个提示词包含：精确色值 + 设计隐喻 + 使用场景 + 画面构图描述

---

## 1. 土壤/文字色系 — Soil & Text

**色值：** 土壤深 `#1F1B16` / 泥土浅 `#2A2520` / 暖米纸 `#FAF6F0` / 亚麻 `#F0E9DC` / 卡片暖白 `#FFFDF9`

**角色：** LoopOS 的基础中性色层——主文字色、背景色、卡片色。不同于 SaaS 产品的冷灰白，这套中性色全部偏暖，模拟纸张和自然泥土的温润质感。

```
Prompt:
A professional SaaS dashboard UI design with a warm, organic earth-tone neutral palette. 
Main background is warm rice-paper cream #FAF6F0, never pure white. 
Cards use slightly warmer off-white #FFFDF9 with subtle linen texture suggestion #F0E9DC. 
Primary text is deep warm soil-brown #1F1B16, never pure black. 
The overall feeling is calm, grounded, natural — like reading on high-quality handmade paper under soft morning light. 
Clean modern layout with generous whitespace, rounded cards (16px radius), soft ambient shadows. 
Subtle 1px borders in rgba(31,27,22,0.08). 
Typography: serif headings, sans-serif body text. 
No cold blues, no pure grays, no harsh contrasts. 
Style: organic-minimalist enterprise software, "living organism" aesthetic, warm and breathing.
Aspect ratio 16:9, 4K resolution, professional UI design mockup.
```

---

## 2. 苔藓绿品牌色系 — Moss Brand

**色值：** 苔藓绿主色 `#4A7C59` / 浅苔藓 `#7FA88E` / 极浅苔藓 `#E8F0EA`

**角色：** 主品牌色、主按钮、活跃状态、选中态背景。绿色选择苔藓色而非荧光绿或翠绿，保持大地色调的有机感。

```
Prompt:
A set of professional UI components showcasing a moss-green brand color system for enterprise software.
Primary brand color is a muted organic moss green #4A7C59 — not bright emerald, not teal, but like forest moss in shade.
Used for: primary action buttons (rounded 10px, solid fill), active navigation indicators, selected states, and key UI accents.
Hover state uses lighter moss #7FA88E. Background accent uses very pale moss #E8F0EA for tags, badges, selection highlights.
Components shown: a primary CTA button "创建组织" in #4A7C59 with white text, pill-shaped status badges in #E8F0EA with #4A7C59 text, a sidebar navigation with moss-green active indicator, and a subtle breathing glow animation ring in moss.
The green feels alive, natural, grounded — like a living plant, not synthetic.
Warm cream background #FAF6F0. Clean, modern, organic-minimalist design.
Aspect ratio 16:9, 4K, UI design mockup, professional quality.
```

---

## 3. 待萌芽状态色系 — Seed (OPEN)

**色值：** 种子暖棕 `#A8927C` / 种子浅底 `#F0E9DC`

**角色：** "待萌芽"状态——张力/阻塞点的初始状态。用暖棕色表达"种子等待发芽"，避免工业感冷灰。

```
Prompt:
A UI status system showing the "Seed / 待萌芽" state for an enterprise governance tool.
Primary state color is a warm earthy brown #A8927C — like a dormant seed waiting to sprout, neither alarming nor cold.
Background accent uses pale linen #F0E9DC for status tags and card highlights.
Show a dashboard card with a "待萌芽" pill badge: background #F0E9DC, text #A8927C, fully rounded pill shape.
Card shows a tension item with title "预训练数据 D3 还未交付", a subtle left border accent in #A8927C, and metadata showing deadline and assignee.
Also show a kanban column header with a circular indicator dot in #A8927C and label "待萌芽 (3)".
The mood: patient, waiting, potential — not urgent, not broken.
Overall warm cream background, organic-minimalist SaaS design, rounded cards.
Aspect ratio 16:9, 4K professional UI mockup.
```

---

## 4. 生长中状态色系 — Growing (IN_PROGRESS)

**色值：** 苔藓绿 `#4A7C59` / 生长浅底 `#E8F0EA`

**角色：** "生长中"状态——正在处理的任务。与主品牌色相同（苔藓绿），表达"正在生长"。

```
Prompt:
A UI status system showing the "Growing / 生长中" in-progress state for an enterprise governance tool.
State color is moss green #4A7C59 — representing active growth, like a sprouting plant gaining strength.
Background accent uses pale moss #E8F0EA for status tags.
Show a dashboard card with a "生长中" pill badge: background #E8F0EA, text #4A7C59, rounded pill shape.
Card shows an active task with a subtle left green border bar, progress indicator, and assignee avatars.
The task card has a gentle float animation on hover (translateY -2px) with deeper shadow.
Also show a circular progress ring in #4A7C59 partially filled, indicating 60% completion.
The mood: active, alive, progressing — positive energy without being aggressive.
Warm cream background, organic-minimalist design, professional quality.
Aspect ratio 16:9, 4K UI design mockup.
```

---

## 5. 受阻状态色系 — Needs-Light (BLOCKED)

**色值：** 陶土红 `#C97B5E` / 需要光照浅底 `#FAEAE3`

**角色：** "受阻"状态——阻塞点需要关注。不叫"error"或"warning"，而叫"需要光照"（needs-light），像植物需要阳光。

```
Prompt:
A UI status system showing the "Needs Light / 受阻" blocked state for an enterprise governance tool.
State color is a warm terracotta red #C97B5E — like sun-baked clay, not alarm-red, suggesting "this plant needs more light" rather than "error".
Background accent uses soft peach #FAEAE3 for status tags and warning callouts.
Show a dashboard card with a "受阻" pill badge: background #FAEAE3, text #C97B5E, rounded pill shape.
Card shows a blocked task with a gentle orange-red left border, a blocker description "等待接口升级", and a subtle breathing glow effect.
Also show a banner/alert component: background #FAEAE3, border 1px #C97B5E/30, icon in #C97B5E, message "3 个阻塞点需要关注".
The mood: needs attention, gentle urgency, organic distress — like a wilting plant, not a system crash.
Warm cream background, organic-minimalist design, professional enterprise UI.
Aspect ratio 16:9, 4K UI design mockup.
```

---

## 6. 已成熟状态色系 — Mature (RESOLVED)

**色值：** 雾绿 `#6B8E7F` / 成熟浅底 `#EBF0ED`

**角色：** "已成熟"状态——已完成的事项。雾绿色更灰更沉静，表达"归于平静的完成"。

```
Prompt:
A UI status system showing the "Mature / 已成熟" resolved state for an enterprise governance tool.
State color is a misty sage green #6B8E7F — softer and more muted than the active moss, suggesting peaceful completion, like leaves that have fully matured and settled.
Background accent uses very pale sage #EBF0ED for status tags.
Show a completed task card with a "已成熟" pill badge: background #EBF0ED, text #6B8E7F, rounded pill shape.
Card appears slightly subdued, with a subtle checkmark icon in #6B8E7F and a resolved timestamp.
Also show an archived items section with items in the mature color, slightly lower opacity.
The mood: calm, settled, complete — like autumn leaves resting, peaceful resolution.
Warm cream background, organic-minimalist design, professional enterprise UI.
Aspect ratio 16:9, 4K UI design mockup.
```

---

## 7. 紧急状态色系 — Urgent (L0.5)

**色值：** 深朱红 `#B85450` / 紧急浅底 `#F8E3E2`

**角色：** "紧急 L0.5"——最严重的阻塞，需要立即照料。深朱红比纯红更暖更深沉。

```
Prompt:
A UI status system showing the "Urgent / 紧急 L0.5" critical escalation state for an enterprise governance tool.
State color is a deep vermillion red #B85450 — rich and serious, like a vital sign alert, not a garish red.
Background accent uses soft rose #F8E3E2 for urgent tags and alert backgrounds.
Show an urgent task card with a "紧急 ⚠" pill badge: background #F8E3E2, text #B85450, rounded pill shape.
Card has a subtle breathing pulse glow animation (slow 2s cycle) in #B85450/20 around its border.
Also show a topbar notification indicator: a small red dot in #B85450 with a subtle ping animation, and a counter badge "2" in #B85450.
The mood: serious attention needed, vital sign alert — like a heartbeat monitor showing concern, not a screaming alarm.
Warm cream background, organic-minimalist design, professional enterprise UI.
Aspect ratio 16:9, 4K UI design mockup.
```

---

## 8. 大脑状态色系 — Brain Status

**色值：** 成功 `#047857` / 信息 `#0E7490` / 警告 `#92400E` / 危险 `#B91C1C`

**角色：** AI 大脑（组织大脑）的运行状态指示器——显示 AI 系统的健康度。

```
Prompt:
A set of four small status indicator components for an AI orchestration dashboard called "组织大脑" (Organizational Brain).
Four states with distinct colors on a warm cream background:

1. Success/Healthy: emerald green #047857 — a checkmark icon with "运行正常" label, background glow #047857/10
2. Info/Processing: deep cyan #0E7490 — a brain icon with "分析中..." label, subtle loading pulse
3. Warning/Degraded: amber brown #92400E — a warning triangle with "部分异常" label, gentle breathing glow
4. Danger/Critical: deep red #B91C1C — an alert icon with "需要介入" label, slow pulse animation

All four indicators shown as compact inline status chips (pill shape, small, 24px height) arranged in a row.
Design style: organic-minimalist, warm earth-tone palette, the indicators feel like vital signs of a living system rather than cold server status lights.
Professional enterprise UI components, 4K quality.
Aspect ratio 16:9.
```

---

## 9. 暗色模式整体 — Dark Mode

**色值：** 土壤深底 `#1F1B16` / 泥土浅卡 `#2A2520` / 暖米文字 `#FAF6F0` / 暗色苔藓 `#7FA88E`

**角色：** 默认模式（长时间盯看暗色更护眼）。背景不用纯黑，用土壤深色。

```
Prompt:
A professional enterprise SaaS dashboard in dark mode with an organic warm-dark aesthetic.
Background is deep warm soil-brown #1F1B16 — never pure black, feels like rich earth at night.
Cards and sidebar use slightly lighter dark brown #2A2520. 
Text and icons use warm cream #FAF6F0 for primary content, muted warm gray #A89E92 for secondary.
Primary brand accent shifts to lighter moss #7FA88E for buttons, active states, and links — glowing softly against the dark soil background.
Status colors are slightly brightened for contrast: seed #D2BDA8, growing #9AC4A7, needs-light #E39A7F, mature #9BBCAF, urgent #F08B86.
Show a full dashboard layout: left sidebar navigation, top bar, main content area with kanban cards showing various states.
Soft ambient shadows in pure black with low opacity. Subtle borders in rgba(250,246,240,0.08).
The mood: calm night workspace, like working by warm lamp light in a study — focused, peaceful, organic.
Typography: serif headings in warm cream, sans-serif body text.
Aspect ratio 16:9, 4K professional UI mockup.
```

---

## 10. 阴影与深度系统 — Shadows & Depth

**色值：** 柔和阴影 `rgba(31,27,22,0.08-0.14)`

**角色：** 三阶阴影系统模拟环境光照，不用 Material Design 锐利阴影。

```
Prompt:
A UI design system showcase demonstrating three levels of soft ambient shadow depth on card components.
All shadows use warm brown-black rgba(31,27,22,0.08-0.14) — never cold gray-black.

Level 1 - Soft: shadow="0 4px 20px -4px rgba(31,27,22,0.08)" — a card sitting gently on the surface, barely lifted. Used for inactive cards, secondary content.
Level 2 - Card: shadow="0 8px 30px -6px rgba(31,27,22,0.10)" — a card slightly elevated, the default card state. Moderate depth.
Level 3 - Hover: shadow="0 12px 40px -8px rgba(31,27,22,0.14)" — a card fully lifted on hover, with subtle translateY(-2px) float effect. Maximum elevation.

Show three cards side by side at each elevation level, against the warm cream #FAF6F0 background.
Cards have 16px rounded corners, 1px warm border rgba(31,27,22,0.08), warm white fill #FFFDF9.
The shadows feel like natural ambient light through a window on an overcast day — soft, diffuse, organic. Not harsh drop shadows.
Professional UI design system documentation style, clean presentation.
Aspect ratio 16:9, 4K.
```

---

## 11. 核心组件质感 — Component Patterns

**色值：** 综合所有上述颜色

**角色：** 卡片、状态徽章、按钮、输入框等核心组件的完整视觉表现。

```
Prompt:
A comprehensive UI component showcase for an organic-minimalist enterprise governance SaaS called "回路OS" (LoopOS).
Warm cream background #FAF6F0. All components shown in a clean design-system layout.

Components displayed:

1. Cards: 16px rounded corners, 1px warm border rgba(31,27,22,0.08), warm white fill #FFFDF9, soft shadow. Show an active task card with moss green #4A7C59 left border accent.

2. Status Badges: Pill-shaped (fully rounded), four variants — 
   "待萌芽" in warm brown #A8927C on linen #F0E9DC,
   "生长中" in moss green #4A7C59 on pale moss #E8F0EA,
   "受阻" in terracotta #C97B5E on peach #FAEAE3,
   "紧急" in vermillion #B85450 on rose #F8E3E2.

3. Primary Button: 10px rounded, solid moss green #4A7C59 fill, white text, hover state slightly lighter.

4. Secondary Button: 10px rounded, 1px warm border, transparent background, soil-deep #1F1B16 text.

5. Input Field: 8px rounded, 1px warm border, warm white fill, placeholder in muted warm gray #6B6259.

6. Sidebar Navigation: Linen background #F0E9DC, active item with moss accent.

Typography: serif (宋体/Fraunces) headings in #1F1B16, sans-serif (黑体/Inter) body in #1F1B16.
No cold colors, no pure white, no pure black. Everything feels warm, alive, organic.
Professional design system documentation, 4K, aspect ratio 16:9.
```

---

## 12. 落地页 Hero — Landing Page Atmosphere

**色值：** 苔藓绿 `#4A7C59` / 暖米 `#FAF6F0` / 土壤 `#1F1B16`

**角色：** LoopOS 首页的整体氛围——AI 原生的组织操作系统，人机协同进化。

```
Prompt:
A hero section of a landing page for "LoopOS — AI原生的组织操作系统", an enterprise SaaS for human-AI collaborative governance.
Warm cream background #FAF6F0 filling the entire canvas.
Center composition:

- A breathing moss-green circular logo mark: concentric circles in #4A7C59 with varying opacity (0.25, 0.4), connected nodes like a neural network or organic circuit, small dots representing human and AI agents.
- The logo has a subtle breathing glow animation (outer ring expanding and contracting).
- Above the logo: a subtle pill badge "AI 原生的组织操作系统" with moss border and pale moss background.
- Below: large serif heading "未来的组织，" on first line, "人类与智能体协同进化。" on second line, with "协同进化" in moss green #4A7C59.
- Subtitle text in muted warm gray #6B6259.
- Two CTA buttons: primary "免费创建组织" solid moss green #4A7C59, secondary "了解运作方式" outlined with warm border.
- Decorative elements: subtle circular rings with dashed strokes (#4A7C59, low opacity), small node dots scattered organically, gentle flowing connection lines.

The atmosphere: calm, warm, alive, futuristic but organic — like a living system breathing, not a cold tech product.
Professional SaaS landing page design, 4K, aspect ratio 16:9.
```

---

## 附录：LoopOS 完整色值速查表

| 分类 | 变量名 | Hex | 用途 |
|------|--------|-----|------|
| **中性色** | soil-deep | `#1F1B16` | 主文字 / 暗色背景 |
| | soil-light | `#2A2520` | 暗色次背景 |
| | paper | `#FAF6F0` | 浅色主背景（暖米） |
| | linen | `#F0E9DC` | 卡片背景 / 分隔区 |
| | card-warm | `#FFFDF9` | 卡片白 |
| **品牌色** | moss | `#4A7C59` | 主品牌色 / 活跃态 |
| | moss-light | `#7FA88E` | hover / 次级强调 |
| | moss-pale | `#E8F0EA` | 标签背景 / 选中态 |
| **状态色** | seed | `#A8927C` | 待萌芽 OPEN |
| | seed-pale | `#F0E9DC` | 种子浅底 |
| | growing | `#4A7C59` | 生长中 IN_PROGRESS |
| | growing-pale | `#E8F0EA` | 生长浅底 |
| | needs-light | `#C97B5E` | 受阻 BLOCKED |
| | needs-light-pale | `#FAEAE3` | 受阻浅底 |
| | mature | `#6B8E7F` | 已成熟 RESOLVED |
| | mature-pale | `#EBF0ED` | 成熟浅底 |
| | urgent | `#B85450` | 紧急 L0.5 |
| | urgent-pale | `#F8E3E2` | 紧急浅底 |
| **大脑状态** | brain-success | `#047857` | AI 正常 |
| | brain-info | `#0E7490` | AI 处理中 |
| | brain-warning | `#92400E` | AI 部分异常 |
| | brain-danger | `#B91C1C` | AI 需介入 |
| **阴影** | shadow-soft | `rgba(31,27,22,0.08)` | 柔和浮起 |
| | shadow-card | `rgba(31,27,22,0.10)` | 卡片深度 |
| | shadow-hover | `rgba(31,27,22,0.14)` | hover 最大高度 |

---

*提示词设计原则：每个提示词完整自包含，可直接粘贴到 Google ImageGen 使用。覆盖了：色值精确值、设计隐喻、使用场景、画面构图、情绪感受、尺寸比例和质量要求。*
