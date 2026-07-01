# 填满格子

一个使用 `TypeScript + Vite + Canvas` 实现的逻辑益智游戏，同时支持 Web 和微信小游戏。两端共用关卡、玩法状态、规则校验与棋盘渲染逻辑，并通过平台适配层接入各自的输入、Canvas 和本地存储能力。

## 已实现

- 网格棋盘与数字提示
- 鼠标或触摸拖拽创建矩形
- 矩形规则校验与通关判定
- 30 个关卡、提示、撤销、重开和关卡记录
- Web 端响应式界面与中英文切换
- 微信小游戏主页、关卡面板、设置、震动、背景音乐和本机周排行榜
- Web `localStorage` 与微信本地存储适配

## 启动与构建

安装依赖并启动 Web 开发环境：

```bash
npm install
npm run dev
```

构建 Web 生产版本：

```bash
npm run build
```

构建微信小游戏版本：

```bash
npm run build:wechat
```

微信构建结果位于 `dist-wechat/`。也可以在微信开发者工具中直接导入仓库根目录，根目录的 `game.js` 会转发到 `dist-wechat/game.js`。

## 项目结构

```text
svx_mini_game1/
├── src/                              # TypeScript 源码
│   ├── game/                         # 两端共用的纯游戏核心
│   │   ├── GameController.ts         # 游戏状态、拖拽流程、关卡流转、历史与记录
│   │   ├── levels.ts                 # 关卡模板和关卡数据生成
│   │   ├── logic.ts                  # 矩形校验、覆盖判定与提示计算
│   │   └── types.ts                  # 游戏数据结构与快照类型
│   ├── input/                        # 输入抽象与平台实现
│   │   ├── PointerInputSource.ts     # 统一指针输入接口
│   │   ├── PointerController.ts      # 输入坐标到游戏操作的转换
│   │   ├── BrowserPointerInputSource.ts
│   │   └── WechatPointerInputSource.ts
│   ├── render/                       # Canvas 渲染抽象与平台实现
│   │   ├── CanvasSurface.ts          # Canvas 宿主接口
│   │   ├── CanvasRenderer.ts         # 共用棋盘、选区和反馈动画渲染器
│   │   ├── BrowserCanvasSurface.ts
│   │   └── WechatCanvasSurface.ts
│   ├── storage/                      # 存档抽象与平台实现
│   │   ├── GameStorage.ts            # 游戏存档接口
│   │   ├── StorageAdapter.ts         # Key-Value 存储接口
│   │   ├── BrowserGameStorage.ts     # 关卡记录、进度和排行榜数据管理
│   │   ├── BrowserLocalStorageAdapter.ts
│   │   └── WechatStorageAdapter.ts
│   ├── audio/
│   │   ├── FeedbackAudio.ts          # 放置、无效操作和通关反馈音效
│   │   └── BackgroundMusic.ts        # 微信小游戏背景音乐
│   ├── wechat/
│   │   └── main.ts                   # 微信小游戏入口与全 Canvas 界面
│   ├── main.ts                       # Web 入口、DOM 界面和模块装配
│   ├── style.css                     # Web 页面与选区样式
│   ├── i18n.ts                       # 中英文文案、语言检测和格式化
│   ├── wechat-env.d.ts               # 微信小游戏 API 类型声明
│   └── vite-env.d.ts                 # Vite 环境类型声明
├── assets/wechat/                    # 微信小游戏源图片、SVG 和音频资源
│   ├── audio/                        # 背景音乐源文件
│   ├── kawaii/                       # 主界面和工具栏素材
│   ├── leaderboard/                  # 排行榜素材
│   ├── level-panel/                  # 关卡面板素材
│   ├── selection/                    # 棋盘选区装饰素材
│   └── settings/                     # 设置面板素材
├── scripts/
│   └── build-wechat.mjs              # 打包小游戏并处理、复制运行时资源
├── dist-wechat/                      # 微信小游戏构建产物，不是源代码
├── docs/
│   └── wechat-minigame-adaptation.md # 微信小游戏适配说明
├── spec/                             # UI 实现规格与设计记录
├── index.html                        # Web HTML 入口
├── game.js                           # 根目录小游戏入口，转发到构建产物
├── game.json                         # 微信小游戏运行配置
├── project.config.json               # 微信开发者工具项目配置
├── project.private.config.json       # 本机微信开发者工具私有配置
├── vite.config.ts                    # Web 构建配置
├── tsconfig.json                     # TypeScript 配置
└── package.json                      # 依赖和 npm 脚本
```

## 架构关系

```text
Web 入口 src/main.ts
  ├── BrowserPointerInputSource
  ├── BrowserCanvasSurface
  └── BrowserLocalStorageAdapter
                 │
                 ▼
     共享游戏核心与渲染逻辑
  GameController / logic / levels
  PointerController / CanvasRenderer
                 ▲
                 │
微信入口 src/wechat/main.ts
  ├── WechatPointerInputSource
  ├── WechatCanvasSurface
  └── WechatStorageAdapter
```

`src/game/` 不依赖 DOM 或微信 API，是两端行为一致的基础。`src/input/`、`src/render/` 和 `src/storage/` 通过接口隔离平台差异；`src/main.ts` 与 `src/wechat/main.ts` 分别负责两端的界面、平台能力和应用流程。

## 构建产物说明

- `npm run build` 由 TypeScript 和 Vite 构建 Web 版本。
- `npm run build:wechat` 将 `src/wechat/main.ts` 打包为 `dist-wechat/game.js`，同时复制并压缩微信运行时资源。
- 根目录 `game.js`、`game.json` 以及 `dist-wechat/` 会由微信构建脚本生成或更新，不应作为业务源码直接编辑。
