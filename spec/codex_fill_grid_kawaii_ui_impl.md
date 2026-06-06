# Codex 实现文档：可爱风「填满格子」关卡页

> 目标：让 Codex 在现有游戏项目中，尽量还原参考图的页面结构、交互功能和可爱风视觉。  
> 重点不是像素级复制插画，而是实现：**页面布局 + 游戏信息 + 4×4 棋盘 + 数字圆片 + 底部操作按钮 + 柔和可爱 UI 风格**。  
> 复杂插画、吉祥物、立体图标等由资源文件提供，代码侧做摆放和适配。

---

## 1. 页面目标

实现一个移动端竖屏游戏关卡页面，风格参考图片：粉色/紫色渐变背景、软糖感卡片、圆角、描边、投影、虚线缝线边框、可爱装饰元素。

页面主要区域：

1. 顶部状态栏装饰区
2. 关卡信息大卡片
3. 三个信息卡片：提示 / 本关记录 / 当前进度
4. 4×4 游戏棋盘
5. 规则说明卡片
6. 底部五个操作按钮：关卡、撤销、重开、提示、下一关

---

## 2. Codex 可以直接实现的部分

### 2.1 布局结构

可以用普通前端代码直接实现：

- 竖屏页面容器，推荐宽度 `100vw`，最大宽度可限制在 `430px ~ 480px`
- 背景渐变：粉色到浅紫、浅蓝
- 顶部装饰区占位
- 大关卡卡片
- 三个小信息卡片横向排列
- 中间棋盘区域
- 规则说明区域
- 底部固定操作栏

### 2.2 游戏数据展示

可以直接实现：

- 标题：`填满格子`
- 关卡信息：`第 1 / 30 关`、`4×4 · 5 个数字`、`第 1 关 · 热身`
- 状态按钮：`进行中`
- 当前进度：`已覆盖 0 / 16 格`、`已进入第 1 关`
- 本关记录：未完成显示 `--` 和 `尚未完成这一关。`
- 规则文案显示

### 2.3 棋盘

可以直接实现：

- 4×4 网格
- 每个格子圆角、浅色背景、细描边
- 棋盘外框大圆角、浅粉描边、柔和阴影
- 外框虚线缝线效果：用 `border-style: dashed` 或伪元素实现
- 数字圆片：圆形、阴影、内圈虚线、不同颜色描边
- 数字位置通过关卡数据控制，例如：

```ts
const level = {
  rows: 4,
  cols: 4,
  numbers: [
    { row: 0, col: 0, value: 4, color: 'pink' },
    { row: 0, col: 2, value: 2, color: 'blue' },
    { row: 1, col: 3, value: 2, color: 'purple' },
    { row: 2, col: 0, value: 2, color: 'yellow' },
    { row: 2, col: 2, value: 6, color: 'green' }
  ]
}
```

### 2.4 底部按钮

可以直接实现：

- 五个大圆角按钮
- 每个按钮不同渐变背景
- 图标 + 中文文字
- 点击态、禁用态、hover/pressed 效果
- 底部固定或跟随页面滚动

### 2.5 基础交互

可以直接实现：

- 点击「提示」触发提示逻辑或弹窗
- 点击「撤销」回退一步
- 点击「重开」重置当前关卡
- 点击「下一关」进入下一关，未完成时可以禁用或弹提示
- 点击「关卡」打开关卡选择页/弹窗
- 记录已覆盖格子数量
- 根据进度更新 `已覆盖 x / 16 格`

### 2.6 CSS 可实现的可爱风

可以用 CSS 实现到比较接近：

- 渐变背景
- 玻璃感/软糖感卡片
- 多层 box-shadow
- 圆角卡片
- 粉色描边
- 虚线缝线边框
- 轻微发光
- 按钮按压动画
- 数字圆片内外双圈
- 小星星、小爱心、小云朵的简单 CSS 形状

---

## 3. 已经提供png资源文件 在src/assets/kawaii-grid/目录下


### 3.1 猫咪抱云朵吉祥物

参考图左上角的大猫咪插画、右下角小云朵表情，属于高细节手绘/3D 插画。  
已经提供 PNG/SVG 资源。

### 3.2 顶部太阳、奖杯、灯泡、笔记本、旗帜、清单等立体图标

这些图标有：

- 渐变
- 高光
- 阴影
- 内部细节
- 可爱表情
- 3D 质感

已经提供 SVG/PNG。

### 3.3 背景中的复杂星星、云朵、心形装饰

已经提供一组装饰素材。

### 3.4 字体完全一致

提供授权字体文件 站酷文艺体.ttf ，指定用站酷文艺体。

### 3.5 像素级还原图片质感

---

## 4. 需要我方提供给 Codex 的资源

建议准备以下资源，统一放到：

```txt
src/assets/kawaii-grid/
```

### 4.1 必需资源

如果希望接近参考图，需要提供：

```txt
mascot-cat-cloud.png        # 左侧猫咪抱云朵
icon-sun.png                # 顶部太阳图标
icon-trophy.png             # 顶部奖杯图标
icon-lightbulb.png          # 提示卡片图标
icon-note.png               # 本关记录图标
icon-flag.png               # 当前进度图标
icon-checklist.png          # 规则卡片图标
icon-cloud-face.png         # 棋盘右下角小云朵
icon-star-yellow.png        # 黄色星星装饰
icon-star-pink.png          # 粉色星星装饰
icon-star-blue.png          # 蓝色星星装饰
icon-heart.png              # 爱心装饰
```

### 4.2 可选资源

```txt
bg-cloud-1.png              # 背景云朵
bg-cloud-2.png
icon-grid.png               # 底部“关卡”按钮图标
icon-undo.png               # 底部“撤销”按钮图标
icon-refresh.png            # 底部“重开”按钮图标
icon-hint.png               # 底部“提示”按钮图标
icon-next.png               # 底部“下一关”按钮图标
```
这些统一提供在icon-btn中需要你去裁切需要的对应部分
---

## 5. 推荐组件拆分（尽量保持改动最小）

```txt
KawaiiLevelPage
├── TopDecorBar
├── LevelHeroCard
├── InfoCardRow
│   ├── InfoCard type="hint"
│   ├── InfoCard type="record"
│   └── InfoCard type="progress"
├── PuzzleBoard
│   ├── BoardCell
│   └── NumberChip
├── RuleCard
└── BottomActionBar
    ├── ActionButton type="levels"
    ├── ActionButton type="undo"
    ├── ActionButton type="restart"
    ├── ActionButton type="hint"
    └── ActionButton type="next"
```

---

## 6. 推荐数据结构

```ts
export type ChipColor = 'pink' | 'blue' | 'purple' | 'yellow' | 'green'

export interface LevelNumber {
  row: number
  col: number
  value: number
  color: ChipColor
}

export interface FillGridLevel {
  id: number
  totalLevels: number
  title: string
  subtitle: string
  rows: number
  cols: number
  numbers: LevelNumber[]
  coveredCount: number
  totalCells: number
  bestRecord?: string | null
  status: 'playing' | 'completed' | 'locked'
}
```

示例数据：

```ts
export const mockLevel: FillGridLevel = {
  id: 1,
  totalLevels: 30,
  title: '填满格子',
  subtitle: '第 1 关 · 热身',
  rows: 4,
  cols: 4,
  totalCells: 16,
  coveredCount: 0,
  bestRecord: null,
  status: 'playing',
  numbers: [
    { row: 0, col: 0, value: 4, color: 'pink' },
    { row: 0, col: 2, value: 2, color: 'blue' },
    { row: 1, col: 3, value: 2, color: 'purple' },
    { row: 2, col: 0, value: 2, color: 'yellow' },
    { row: 2, col: 2, value: 6, color: 'green' }
  ]
}
```

---

## 7. 样式方向

### 7.1 色彩变量

```css
:root {
  --page-bg-top: #ff9fc0;
  --page-bg-mid: #f8b7e8;
  --page-bg-bottom: #bfe6ff;

  --card-bg: rgba(255, 252, 247, 0.92);
  --card-border: #ffb7c8;
  --card-border-soft: #ffd3de;

  --text-main: #5b312b;
  --text-sub: #7c4a42;

  --pink: #ff8fb5;
  --orange: #ffb547;
  --yellow: #ffd76a;
  --green: #9add75;
  --blue: #9bd8ff;
  --purple: #c69aff;
  --red: #ff766f;
}
```

### 7.2 页面背景

```css
.kawaii-page {
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 20% 8%, rgba(255,255,255,.65), transparent 18%),
    radial-gradient(circle at 88% 25%, rgba(255,255,255,.45), transparent 15%),
    linear-gradient(180deg, var(--page-bg-top) 0%, var(--page-bg-mid) 48%, var(--page-bg-bottom) 100%);
  color: var(--text-main);
}
```

### 7.3 通用软卡片

```css
.kawaii-card {
  background: var(--card-bg);
  border: 2px solid var(--card-border-soft);
  border-radius: 24px;
  box-shadow:
    0 10px 22px rgba(142, 74, 91, .16),
    inset 0 2px 0 rgba(255,255,255,.9);
}
```

### 7.4 缝线边框

```css
.stitch-frame {
  position: relative;
  border-radius: 28px;
  border: 3px solid #ffb5c4;
}

.stitch-frame::after {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 22px;
  border: 2px dashed rgba(255, 142, 166, .85);
  pointer-events: none;
}
```

### 7.5 棋盘

```css
.puzzle-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 3px;
  padding: 18px;
  aspect-ratio: 1 / 1;
  background: rgba(255, 247, 236, .88);
}

.board-cell {
  position: relative;
  border-radius: 10px;
  background: linear-gradient(180deg, #fff8ef 0%, #fff2e3 100%);
  border: 2px solid rgba(255, 183, 193, .8);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95);
}
```

### 7.6 数字圆片

```css
.number-chip {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 58px;
  height: 58px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,.95);
  font-size: 34px;
  font-weight: 800;
  color: var(--text-main);
  box-shadow: 0 6px 10px rgba(94, 48, 61, .18);
}

.number-chip::after {
  content: '';
  position: absolute;
  inset: 7px;
  border-radius: 999px;
  border: 2px dashed currentColor;
  opacity: .35;
}

.number-chip.pink { border: 4px solid #ffa8c2; color: #5b312b; }
.number-chip.blue { border: 4px solid #a9ddff; color: #5b312b; }
.number-chip.purple { border: 4px solid #cba7ff; color: #5b312b; }
.number-chip.yellow { border: 4px solid #ffd06a; color: #5b312b; }
.number-chip.green { border: 4px solid #aee38c; color: #5b312b; }
```

---

## 8. 响应式要求

### 移动端优先

目标尺寸参考：

- 设计稿宽度：约 `430px`
- 页面最小宽度：`360px`
- 推荐最大宽度：`480px`

### 适配规则

- 页面整体使用 `clamp()` 控制字体和间距
- 棋盘保持正方形：`aspect-ratio: 1 / 1`
- 底部按钮在小屏下仍然一行 5 个，文字不换行
- 如果宽度小于 360px，底部按钮图标缩小，文字字号缩小

---

## 9. 交互要求

### 9.1 按钮行为

```txt
关卡：打开关卡选择弹窗或跳转关卡列表
撤销：撤销最近一步，如果没有可撤销步骤则禁用
重开：弹确认或直接重置当前关卡
提示：显示提示，扣除提示次数或弹出提示内容
下一关：当前关完成后进入下一关，未完成时禁用或提示“请先完成本关”
```

### 9.2 状态展示

```txt
playing：显示“进行中”
completed：显示“已完成”
locked：显示“未解锁”
```

### 9.3 动画

建议加入轻量动画：

- 页面进入：卡片轻微上浮 `translateY(8px -> 0)`
- 按钮点击：`scale(0.96)`
- 数字圆片出现：轻微弹跳
- 提示按钮：可选轻微闪光

不要加入过多动画，避免影响游戏操作手感。

---

## 10. 实现优先级

### P0：必须完成

- 页面整体结构
- 关卡信息卡片
- 3 个信息卡片
- 4×4 棋盘
- 数字圆片
- 规则卡片
- 底部操作按钮
- 基础响应式

### P1：强烈建议完成

- 粉色渐变背景
- 软糖风卡片阴影
- 虚线缝线边框
- 按钮渐变和点击态
- 图标资源接入
- 进度数据更新

### P2：资源齐全后再做

- 猫咪吉祥物
- 顶部太阳/奖杯立体图标
- 云朵、星星、爱心装饰
- 字体完全替换
- 细节级高光和材质还原

---

## 11. 验收标准

完成后需要满足：

1. 页面在手机竖屏下完整显示，不横向溢出。
2. 4×4 棋盘比例正确，数字圆片位置和参考图一致。
3. 页面主色为粉色、浅紫、浅蓝，整体可爱但不要过度花哨。
4. 卡片有圆角、描边、柔和阴影。
5. 底部 5 个按钮可点击，点击态明显。
6. 没有资源时也能运行，有资源后替换为 PNG/SVG。
7. 所有文本从数据结构中读取，不要写死在多个地方。
8. 组件结构清晰，方便后续复用到其他关卡。

---

## 12. 给 Codex 的具体任务描述

请在当前项目中实现一个移动端游戏关卡页面，页面名称可以叫 `KawaiiFillGridLevelPage`。  
参考图风格是粉色可爱风、软糖卡片、圆角、描边、虚线缝线、柔和阴影。

请优先实现以下内容：

1. 页面背景：粉色到紫色再到浅蓝的渐变背景。
2. 顶部关卡信息大卡片：显示标题“填满格子”、关卡数量、棋盘规格、状态按钮“进行中”。
3. 中部三个信息卡片：提示、本关记录、当前进度。
4. 主体 4×4 棋盘：棋盘外框是大圆角软卡片，内部 16 个格子，每个格子圆角浅色背景。
5. 棋盘上的数字圆片：位置和数据绑定，圆片有白底、彩色描边、虚线内圈、阴影。
6. 规则卡片：显示规则文案。
7. 底部操作按钮：关卡、撤销、重开、提示、下一关，使用不同渐变色和图标。
8. 没有图片资源时，先用 CSS/emoji/lucide-react 图标占位；后续我会提供 PNG/SVG 资源替换。
9. 样式要移动端优先，最大宽度建议 430px ~ 480px，棋盘保持正方形。
10. 不要把整张参考图当背景图直接贴上去，要拆成真实 UI 组件，方便后续交互。

请按组件化方式实现，建议拆分为：

```txt
KawaiiFillGridLevelPage
LevelHeroCard
InfoCardRow
InfoCard
PuzzleBoard
BoardCell
NumberChip
RuleCard
BottomActionBar
ActionButton
```

如果项目已有状态管理/路由/样式方案，请沿用项目现有方案；如果没有，先用本地 mock 数据实现静态页和基础按钮回调。

