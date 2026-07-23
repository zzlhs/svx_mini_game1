# Web 端可爱风 UI 移植改造方案

## 1. 文档说明

- 文档状态：待评审
- 改造目标：将微信小游戏关卡页的整体布局、装饰素材和视觉状态移植到 Web 端，使两端的关卡页美术效果保持一致。
- 本次重点：设置、排行榜、标题区、提示、本关记录、当前进度、关卡面板、规则区、棋盘周边装饰和底部 5 个按钮。
- 本次不包含：代码修改、构建产物修改、微信小游戏首页重做、微信好友关系链排行榜开发。
- 视觉基准：以 `src/wechat/main.ts` 当前关卡页和弹层实现为准，以 `assets/wechat/` 中的源素材为准，不以 `dist-wechat/` 构建产物作为 Web 源码依赖。

## 2. 结论与推荐路线

推荐采用“DOM/CSS 外层 UI + 现有 Canvas 棋盘”的混合方案：

1. 保留 `CanvasRenderer`、`GameController`、输入、存储和关卡逻辑。
2. 保留 Web 已经接入的 `kawaii` 棋盘主题、背景和选区装饰。
3. 使用 DOM/CSS 重建小游戏的标题卡、三联信息卡、规则卡、底部工具栏和三个弹层。
4. 复用小游戏现有 PNG/SVG 素材，不重新绘制同类图标。
5. Web 关卡页采用以 375px 设计宽度为基准的单列游戏壳，桌面端居中展示，不再延续当前桌面双栏、移动端长页面的布局。

不建议直接把 `src/wechat/main.ts` 中的全 Canvas UI 绘制函数原样复制到 Web。那种方式虽然初期看起来更接近，但会降低 Web 的可访问性、键盘操作能力、文本清晰度和响应式维护性，也会让 DOM 按钮、弹窗焦点与 Canvas 点击热区形成两套交互体系。

## 3. 当前实现与目标差异

### 3.1 当前 Web 端

Web 入口为 `src/main.ts`，页面样式集中在 `src/style.css`：

- 页面使用米白色背景和 1180px 桌面容器。
- 桌面端为棋盘 + 右侧栏双列布局。
- 移动端依次纵向展示标题、棋盘、30 个关卡、提示、记录、进度、4 个操作按钮和规则。
- 设置入口、排行榜入口和对应弹层尚未接入。
- 关卡选择始终显示在侧栏中，没有使用弹层。
- 操作区只有撤销、重开、提示、下一关，缺少“关卡”按钮。
- 标题、信息卡和操作按钮仍是通用 Web 卡片风格。
- 棋盘已经使用 `bg_kawaii.png`、`theme: 'kawaii'` 和选区装饰素材，是目前两端最接近的部分。

本地页面实测：

- 390 × 844 窄屏下，页面内容高度约 2448px。
- 关卡网格和信息卡全部堆叠，用户需要长距离滚动才能到达操作区。
- 1280px 桌面视口下仍是 Web 双栏结构，与小游戏的单屏关卡页信息层级不同。

### 3.2 目标 Web 端

| 区域 | 当前 Web | 目标效果 |
| --- | --- | --- |
| 页面背景 | 米白渐变 | 与小游戏一致的粉、紫、蓝星云背景 |
| 顶部入口 | 语言选择 + 状态胶囊 | 左上设置、排行榜圆形图标 |
| 标题 | 页面外独立 Hero | 猫咪云朵 + 标题 + 关卡信息 + 状态胶囊的缝线卡片 |
| 提示/记录/进度 | 右侧栏或纵向卡片 | 标题下方横向三联小卡 |
| 棋盘 | 已有可爱风 Canvas | 保留，并补齐周边云朵、星星、爱心装饰 |
| 规则 | 侧栏独立大卡 | 棋盘下方横向紧凑规则卡 |
| 操作区 | 4 个普通按钮 | 关卡、撤销、重开、提示、下一关 5 个糖果按钮 |
| 关卡选择 | 常驻 30 格网格 | 点击“关卡”打开装饰弹层 |
| 设置 | 无 | 与小游戏一致的粉色装饰弹层 |
| 排行榜 | 无 | 与小游戏一致的紫色丝带周榜弹层 |

## 4. 目标页面结构

```text
KawaiiWebGamePage
├── TopQuickActions
│   ├── SettingsButton
│   └── LeaderboardButton
├── LevelHeroCard
│   ├── CatCloudMascot
│   ├── GameTitle
│   ├── LevelProgressAndMeta
│   ├── LevelName
│   └── StatusChip
├── InfoCardRow
│   ├── HintCard
│   ├── LevelRecordCard
│   └── CurrentProgressCard
├── PuzzleBoardStage
│   ├── ExistingCanvas
│   ├── ExistingSelectionLayer
│   └── BoardEdgeDecorations
├── RulesCard
├── BottomActionBar
│   ├── LevelsButton
│   ├── UndoButton
│   ├── RestartButton
│   ├── HintButton
│   └── NextButton
└── OverlayRoot
    ├── LevelPickerDialog
    ├── SettingsDialog
    └── LeaderboardDialog
```

页面主内容顺序与小游戏的 `drawOverlay()` 保持一致：

1. 标题卡
2. 提示 / 本关记录 / 当前进度
3. 棋盘及其周边装饰
4. 规则卡
5. 底部 5 个操作按钮
6. 按需覆盖显示弹层

## 5. 布局与响应式策略

### 5.1 基准尺寸

- 以 375px 宽竖屏为设计基准。
- 游戏壳建议 `width: min(100%, 430px)`。
- 页面背景覆盖整个浏览器视口，游戏壳在桌面端水平居中。
- 使用 `min-height: 100dvh`，同时保留 `100vh` 回退。
- 顶部和底部使用 `env(safe-area-inset-top)`、`env(safe-area-inset-bottom)`。

### 5.2 高度模式

与小游戏 `metrics.height < 780` 的紧凑逻辑对应，Web 建议定义两档：

- 标准模式：视口高度不小于 780px。
- 紧凑模式：视口高度小于 780px，缩小卡片高度、间距、字号和按钮高度。

Web 浏览器还需增加一项安全回退：

- 当可用高度不足以容纳棋盘与操作栏时允许页面纵向滚动。
- 操作栏不能被浏览器底部工具栏遮挡。
- 不通过压缩棋盘到不可操作的尺寸来强行保持单屏。

### 5.3 桌面端

桌面端不再恢复双栏侧边栏，保持和小游戏一致的单列信息层级：

- 1366px 或 1440px 宽屏下，游戏壳居中。
- 壳外仍显示连续的星云背景，可增加轻微暗角或模糊光晕聚焦主区域。
- 最大宽度不宜超过 480px，否则三联信息卡、装饰素材和按钮比例会偏离小游戏。

如果后续需要“桌面增强模式”，应作为独立需求，不与本轮视觉一致性改造混合。

## 6. 视觉规范

### 6.1 颜色

以小游戏 `THEME` 为基准，Web 使用 CSS 变量表达：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--kawaii-bg-start` | `#ff958f` | 启动或无背景图时的顶部渐变 |
| `--kawaii-bg-mid` | `#f39ac9` | 中段粉紫色 |
| `--kawaii-bg-end` | `#aae6ff` | 底部浅蓝色 |
| `--kawaii-surface-strong` | `rgba(255,255,255,.92)` | 强调卡片 |
| `--kawaii-surface` | `rgba(255,255,255,.84)` | 普通卡片 |
| `--kawaii-text-primary` | `#684355` | 主文字 |
| `--kawaii-text-secondary` | `#8d7080` | 次级文字 |
| `--kawaii-accent` | `#ffab27` | 主强调色 |
| `--kawaii-success` | `#7cc95d` | 完成态 |
| `--kawaii-info` | `#55a7e3` | 记录查看态 |
| `--kawaii-candy-pink` | `#ffb9cc` | 糖果按钮/装饰 |
| `--kawaii-candy-yellow` | `#ffe369` | 糖果按钮/装饰 |
| `--kawaii-candy-mint` | `#8fe8c2` | 糖果按钮/装饰 |
| `--kawaii-candy-blue` | `#7cc8ff` | 糖果按钮/装饰 |
| `--kawaii-candy-lavender` | `#cbc4ff` | 糖果按钮/装饰 |

### 6.2 卡片

所有主卡片统一具备：

- 米白到浅粉的轻渐变填充。
- 2px 左右的浅粉描边。
- 20px～30px 圆角。
- 外层柔和粉色投影。
- 内层白色高光。
- 距边缘约 7px 的虚线缝线。

不继续使用当前 Web 的灰褐色边框、通用毛玻璃卡片和深色投影。

### 6.3 字体

- 优先使用项目已有且有授权的可爱字体；若实际工程未包含字体文件，先使用系统圆体回退，不从外部 CDN 临时加载。
- 建议字体栈：可爱中文字体、`"PingFang SC"`、`"Microsoft YaHei"`、`"Avenir Next"`、sans-serif。
- 标题与弹层标题使用 700～900 字重，并使用白色描边或 `text-shadow` 模拟小游戏 Canvas 的描边效果。
- 正文保持足够对比度，不为追求浅色效果牺牲可读性。

## 7. 素材复用清单

### 7.1 主关卡页

| 目标区域 | 素材 |
| --- | --- |
| 页面背景 | `assets/wechat/bg_kawaii.png` |
| 标题卡吉祥物 | `assets/wechat/kawaii/mascot-cat-cloud.png` |
| 设置入口 | `assets/wechat/kawaii/icon-sun.png` |
| 排行榜入口 | `assets/wechat/kawaii/icon-trophy.png` |
| 提示卡 | `assets/wechat/kawaii/icon-lightbulb.png` |
| 本关记录卡 | `assets/wechat/kawaii/icon-note.png` |
| 当前进度卡 | `assets/wechat/kawaii/icon-flag.png` |
| 规则卡 | `assets/wechat/kawaii/icon-checklist.png` |
| 棋盘右下装饰 | `assets/wechat/kawaii/icon-cloud-face.png` |
| 棋盘周边星/心/云 | `assets/wechat/kawaii/icon-star-heart-cloud.png` |
| 底部 5 个图标 | `assets/wechat/kawaii/bottom-btn.png` |

`bottom-btn.png` 为 760 × 134 的横向精灵图，可按 5 帧、每帧 152 × 134 使用。Web 可使用 `background-position`，也可在初始化时生成 5 个 `object-position` 视窗；不要把裁切结果复制成 5 份重复资源。

### 7.2 设置弹层

复用 `assets/wechat/settings/` 下全部装饰：

- `decor_cloud_smile_heart.png`
- `decor_star_pink_big.png`
- `icon_music_badge.png`
- `icon_vibration_badge.png`
- `decor_cloud_cluster_left.png`
- `decor_heart_corner.png`
- `decor_heart_small.png`
- `decor_sparkle_white.png`
- `decor_star_yellow_small_transparent.png`

### 7.3 排行榜弹层

复用：

- `assets/wechat/leaderboard/decor_ribbon_leaderboard_purple.svg`
- `assets/wechat/leaderboard/decor_bunny_peek_left.svg`
- `assets/wechat/leaderboard/decor_rainbow_cloud.svg`
- `assets/wechat/leaderboard/empty_trophy_bunny.svg`

Web 可由 Vite 直接加载源 SVG。需要在 Chrome、Safari 和高 DPR 屏幕上确认 SVG 阴影、透明边缘和缩放效果与微信构建后的 PNG 一致。

### 7.4 关卡弹层

复用 `assets/wechat/level-panel/` 下的：

- 左右云朵
- 笑脸云与爱心
- 粉色丝带
- 黄、蓝、粉色星星
- 粉色爱心
- 白色闪光

### 7.5 棋盘与选区

Web 已经加载 `assets/wechat/selection/` 的 7 个素材并使用 `theme: 'kawaii'`。这部分以回归验证为主，不做重复实现。

## 8. 各区域改造要求

### 8.1 页面背景

- `body` 和游戏壳使用 `bg_kawaii.png` 的中心覆盖效果。
- 图片加载前显示粉紫蓝渐变，避免白屏。
- 桌面宽屏下背景应覆盖整个视口，而不是只出现在棋盘内部。
- 对低性能设备可关闭额外模糊滤镜，但不能移除背景图和核心装饰。

### 8.2 设置与排行榜快捷入口

- 放在标题卡上方左侧，顺序与小游戏一致：设置、排行榜。
- 标准模式按钮 36px，紧凑模式 34px。
- 使用太阳和奖杯原素材。
- 具备默认、悬停、键盘聚焦、按下四种状态。
- 点击范围至少 44 × 44px；视觉图标可以保持 34～36px。
- 提供 `aria-label`，不能只依赖图片表达功能。

### 8.3 标题卡

标题卡包含：

- 左侧猫咪云朵吉祥物。
- `填满格子` 标题。
- `第 x / 30 关`。
- `宽 × 高 · 数字数量`。
- 当前关卡名称。
- 右侧状态胶囊。

状态胶囊映射：

| 游戏状态 | 文案 | 配色 |
| --- | --- | --- |
| 普通进行中 | 进行中 | 黄橙渐变 |
| 合法预览 | 就绪 | 黄橙渐变 |
| 已完成 | 已完成 | 绿色渐变 |
| 查看记录 | 查看记录 | 浅蓝渐变 |

Web 当前 Hero 中的说明长文移出主视觉区域。规则说明保留在规则卡，语言切换移动到设置弹层。

### 8.4 提示、本关记录、当前进度

三张卡横向排列，每张卡宽度接近三等分：

- 提示卡：灯泡徽章、粉色标题、最多 3 行提示文本。
- 本关记录：笔记徽章、橙色标题、主值显示最佳时间或 `--`，下方显示完成详情。
- 当前进度：旗帜徽章、绿色标题、主值显示 `已覆盖 x / y 格`，下方显示当前状态。

要求：

- 标题和图标不能挤压主要数据。
- 中文、英文都要限制行数并显示合理换行。
- 不使用固定字符串，继续通过 `i18n.ts` 获取文本。
- “本关记录”对应 `snapshot.currentRecord`。
- “当前进度”对应覆盖格数和 `snapshot.status`。

### 8.5 棋盘与周边装饰

- 继续使用现有 `CanvasRenderer` 和 `BrowserCanvasSurface`。
- 继续传入 `theme: 'kawaii'`、背景图和选区装饰。
- Web 页面只负责棋盘外围的 DOM 装饰，不复制棋盘网格绘制逻辑。
- 在棋盘左上、右上、左下增加星星/爱心装饰，右下增加笑脸云。
- 装饰层必须 `pointer-events: none`，不能影响拖拽。
- Canvas 与装饰层使用同一个相对定位容器。
- Canvas 尺寸变化后，外围装饰仍按容器边缘定位，不依赖棋盘内部像素坐标。

### 8.6 规则卡

- 位于棋盘和底部工具栏之间。
- 左侧使用清单图标徽章。
- 标题使用粉色。
- 正文将面积规则、单数字规则、完整覆盖规则压缩为 1～2 行。
- 详细输入说明可保留给帮助弹层或无障碍说明，不占用主页面高度。

### 8.7 底部 5 个操作按钮

固定顺序：

1. 关卡
2. 撤销
3. 重开
4. 提示
5. 下一关

每个按钮包含：

- 独立糖果渐变色。
- 精灵图对应图标。
- 中文/英文标签。
- 顶部白色高光。
- 粉色柔和投影。
- 20px 左右圆角。
- 默认、hover、focus-visible、pressed、disabled 状态。

行为映射：

| 按钮 | 行为 | 禁用条件 |
| --- | --- | --- |
| 关卡 | 打开关卡弹层 | 不禁用 |
| 撤销 | `game.undo()` | 无历史或记录查看模式 |
| 重开 | `game.resetLevel()`；记录模式下为重试 | 不禁用 |
| 提示 | `game.showHint()` | 已完成或记录查看模式 |
| 下一关 | `game.nextLevel()` | 没有下一关 |

当前 Web 的 4 按钮区将被替换，不在页面其他位置保留重复入口。

### 8.8 关卡弹层

- 使用全屏半透明粉色遮罩。
- 面板为粉白渐变、圆角、描边、缝线和多层阴影。
- 顶部显示关卡标题和 `已完成 x / 30`。
- 6 列展示 30 个关卡。
- 当前、已完成、记录查看、锁定四种状态必须与小游戏一致。
- 已完成关卡显示勾选标记，锁定关卡降低对比度。
- 面板周边摆放云朵、星星、丝带、爱心和闪光素材。
- 点击遮罩关闭；按 `Escape` 关闭；打开时焦点进入弹层，关闭后归还“关卡”按钮。

### 8.9 设置弹层

视觉上复刻小游戏设置弹层：

- 粉色遮罩和粉白主面板。
- 紫色描边标题。
- 音效、震动两张独立设置卡。
- 绿色开关开启态和灰色关闭态。
- 返回首页、继续游戏两个底部按钮。
- 周边云朵、星星、爱心和闪光装饰。

Web 平台行为建议：

- 音效：控制 Web 反馈音效和组合语音。
- 震动：检测 `navigator.vibrate`。支持时正常使用；不支持时保持同样布局但显示为关闭/不可用，并提供可读说明。
- 语言：将当前页面顶部语言选择移动到设置弹层，作为第三行或设置弹层中的次级选项。
- “返回首页”：本轮仅在 Web 已有明确首页流程时启用；若仍直接进入关卡页，先将按钮文案改为“关闭”或暂不显示，不能绑定成清空进度。

最后一项是实现前需要产品确认的唯一明显行为差异，不影响弹层美术搭建。

### 8.10 排行榜弹层

视觉上复刻小游戏本机周榜：

- 紫色丝带标题。
- 左侧兔子探头、右侧彩虹云。
- 本周说明文本。
- 粉白列表容器和虚线内框。
- 最多展示 6 条成绩。
- 前三名使用黄、紫、蓝配色。
- 空状态使用奖杯兔子素材。
- 点击遮罩或按 `Escape` 关闭。

数据建议直接复用 `BrowserGameStorage` 已有能力：

- `loadWeeklyLeaderboard()`
- `recordWeeklyLeaderboardEntry()`
- `loadCampaignState()` / `saveCampaignState()`

当前 Web 入口尚未接入整轮计时和周榜写入。视觉改造时可以先完成“读取 + 空状态 + 有数据列表”，整轮计时写入应作为同一阶段的行为验收项，避免出现只有入口但永远没有成绩的排行榜。

本轮 Web 排行榜仍是本机周榜，不宣称为微信好友榜。

## 9. 状态与数据流

建议在 Web 宿主层增加单一 UI 状态：

```ts
interface WebUiState {
  activeOverlay: 'levels' | 'settings' | 'leaderboard' | null;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}
```

原则：

- 游戏状态继续来自 `GameController.getSnapshot()`。
- 弹层开关和平台设置属于 Web UI 状态，不塞入 `GameSnapshot`。
- 记录、进度、按钮禁用态只从当前 `snapshot` 派生，避免 DOM 层保存重复业务状态。
- 每次游戏快照变化只更新动态文本、状态属性和按钮禁用态，不重建 Canvas 或整个页面 DOM。
- 所有弹层共享一个 Overlay Root，任意时刻只允许一个弹层打开。

## 10. 推荐代码组织

后续实施时建议按职责拆分，但继续使用当前原生 TypeScript，不引入 React/Vue：

```text
src/
├── main.ts
├── style.css
└── web/
    └── kawaii/
        ├── KawaiiGamePage.ts
        ├── KawaiiOverlayController.ts
        ├── kawaii-assets.ts
        ├── kawaii-theme.ts
        └── kawaii-ui.types.ts

src/styles/
├── kawaii-tokens.css
├── kawaii-game-page.css
├── kawaii-toolbar.css
└── kawaii-overlays.css
```

职责建议：

- `src/main.ts`：创建平台适配器、游戏控制器、订阅快照和连接事件。
- `KawaiiGamePage.ts`：生成关卡页 DOM，提供动态节点引用。
- `KawaiiOverlayController.ts`：关卡、设置、排行榜弹层及焦点管理。
- `kawaii-assets.ts`：通过 `new URL(..., import.meta.url)` 管理 Web 素材 URL。
- `kawaii-theme.ts`：保存与小游戏 `THEME` 对齐的颜色和状态映射。
- CSS 文件：只负责布局和视觉，不包含游戏业务判断。

第一轮不要求改造小游戏文件。完成 Web 对齐并稳定后，再评估是否将两端共同的主题 token、素材 key 和 ViewModel 提取为共享模块。

## 11. 分阶段实施计划

### 阶段 0：基线与验收样例

- 固定小游戏视觉基准截图。
- 固定 Web 当前桌面和移动端截图。
- 准备无记录、有记录、合法预览、通关、记录查看五种快照。
- 确定基准视口：375 × 667、390 × 844、430 × 932、1366 × 768。

交付：视觉对比基线和状态清单。

### 阶段 1：素材与主题基础

- 建立 Web 素材清单和预加载策略。
- 建立糖果色、卡片、阴影、圆角、缝线等 CSS token。
- 将页面背景替换为 `bg_kawaii.png`。
- 建立单列居中游戏壳和标准/紧凑高度模式。

交付：空壳布局、背景、卡片基础样式。

### 阶段 2：主关卡页

- 实现顶部设置/排行榜入口。
- 实现标题卡和状态胶囊。
- 实现三联信息卡。
- 将现有 Canvas 棋盘嵌入新布局。
- 补充棋盘外围装饰。
- 实现规则卡。
- 替换为底部 5 按钮工具栏。

交付：不打开弹层时，主关卡页与小游戏保持一致。

### 阶段 3：三个弹层

- 关卡弹层。
- 设置弹层。
- 排行榜弹层。
- 遮罩关闭、`Escape`、焦点锁定、焦点归还。

交付：三个弹层的空状态和主要状态完整。

### 阶段 4：行为接线

- 将现有 Web 关卡、撤销、重开、提示、下一关行为连接到新按钮。
- 连接关卡记录查看和锁定逻辑。
- 连接音效、震动能力检测、语言设置。
- 接入本机周榜读取、整轮计时和成绩写入。
- 保持自动下一关、音效和 Canvas 动画行为不回退。

交付：视觉与行为均可用。

### 阶段 5：视觉回归和性能优化

- 对比小游戏和 Web 的间距、比例、字体、阴影、装饰位置。
- 检查不同 DPR 下的图片和 Canvas 清晰度。
- 弹层素材按需加载，首屏素材预加载。
- 检查低高度设备的滚动和底部安全区。
- 检查中文和英文长文本。

交付：验收截图、问题清单清零、构建通过。

## 12. 验收标准

### 12.1 视觉

- Web 使用与小游戏相同的背景和核心装饰素材。
- 375px 或 390px 宽度下，模块顺序、卡片比例和图标位置与小游戏一致。
- 标题卡、三联信息卡、规则卡和底部工具栏均具备粉白渐变、描边、缝线、圆角和柔和阴影。
- 设置、排行榜和关卡弹层的主题色、标题装饰、空状态与小游戏一致。
- 桌面端居中展示同一套游戏壳，不出现旧的右侧栏。

### 12.2 功能

- 棋盘拖拽、选择、删除、提示和动画行为不回退。
- 5 个底部按钮行为和禁用条件正确。
- 已完成关卡可查看记录，锁定关卡不可进入。
- 设置状态刷新后可按产品决定保留。
- 排行榜能正确展示空状态和本机本周成绩。
- 弹层打开时不会误触棋盘。

### 12.3 响应式

- 375 × 667：紧凑模式可操作，按钮不被遮挡。
- 390 × 844、430 × 932：尽量保持单屏主操作区。
- 768 × 1024：游戏壳居中，不被拉伸成平板双栏。
- 1366 × 768、1440 × 900：背景铺满，游戏壳居中，必要时允许纵向滚动。
- DPR 1、2、3 下 Canvas、SVG、PNG 边缘清晰。

### 12.4 可访问性

- 所有按钮可通过键盘访问，并有清晰 `focus-visible`。
- 图标按钮提供可读名称。
- 弹层具有 `role="dialog"`、标题关联和焦点管理。
- 禁用态不只依靠颜色区分。
- 正文和按钮文字满足基本对比度要求。
- 在 `prefers-reduced-motion: reduce` 下减少位移、弹跳和持续动画。

### 12.5 工程质量

- `npm run build` 通过。
- 不从 Web 源码引用 `dist-wechat/`。
- 不复制游戏规则和棋盘绘制逻辑。
- 不引入新的前端框架。
- 核心图片有加载失败回退，不因单个装饰素材失败阻断游戏。

## 13. 风险与处理

| 风险 | 影响 | 处理方式 |
| --- | --- | --- |
| 小游戏 UI 坐标大量硬编码 | Web 直接照搬后响应式困难 | 使用 DOM/CSS 重建结构，只对齐视觉比例 |
| 资源数量增加 | 首屏加载变慢 | 主页面素材预加载，三个弹层素材懒加载 |
| SVG 与微信 PNG 转换结果不同 | 弹层细节有偏差 | 在 Safari/Chrome 做截图对比，必要时统一导出 Web PNG |
| 中英文长度差异 | 三联卡和按钮溢出 | 限行、动态字号、英文短文案验收 |
| 浏览器高度受地址栏影响 | 底部按钮被遮挡 | 使用 `100dvh`、安全区和短屏滚动回退 |
| DOM 装饰覆盖 Canvas | 棋盘拖拽失效 | 装饰层统一 `pointer-events: none` |
| 弹层打开仍触发棋盘 | 产生误操作 | Overlay 打开时暂停棋盘输入或在输入入口短路 |
| Web 不支持震动 | 设置项与小游戏不一致 | 保留同一视觉行，显示不可用状态和说明 |
| 排行榜只有 UI 没有数据 | 用户误解功能 | 同阶段接入本机周榜计时写入，明确“本机本周” |

## 14. 预计改动范围

实施阶段预计涉及：

- 修改：`src/main.ts`
- 修改：`src/style.css`，或将其拆分为多份样式后由 `main.ts` 引入
- 可能修改：`src/audio/FeedbackAudio.ts`，用于暴露 Web 音效开关
- 可能修改：`src/i18n.ts`，补充设置、排行榜和弹层文案
- 新增：`src/web/kawaii/` 下的 UI、素材和弹层模块
- 新增：`src/styles/` 下的可爱风样式文件
- 复用：`assets/wechat/` 现有素材
- 不修改：`src/game/` 的关卡、规则和状态核心
- 原则上不修改：`src/wechat/main.ts`
- 不直接修改：`dist-wechat/`

## 15. 推荐验收顺序

1. 先确认 390 × 844 下主关卡页结构与小游戏一致。
2. 再确认 375 × 667 的短屏可操作性。
3. 再确认设置、排行榜、关卡三个弹层。
4. 然后检查所有游戏状态和中英文。
5. 最后检查桌面居中效果、构建、性能和无障碍。

按此顺序可以先锁定移动端视觉基准，再处理 Web 平台差异，避免桌面布局反向影响小游戏风格的一致性。
