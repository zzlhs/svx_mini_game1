# 微信小游戏适配说明

这份原型已经做了第一轮平台解耦，目的是让核心玩法逻辑尽量不依赖浏览器 DOM，后续迁移到微信小游戏时只替换宿主层和平台实现。

## 当前已完成的准备

### 1. 输入层与平台 API 解耦

- 通用输入接口：[src/input/PointerInputSource.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/input/PointerInputSource.ts)
- 浏览器实现：[src/input/BrowserPointerInputSource.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/input/BrowserPointerInputSource.ts)
- 微信小游戏实现：[src/input/WechatPointerInputSource.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/input/WechatPointerInputSource.ts)
- 通用输入控制器：[src/input/PointerController.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/input/PointerController.ts)

现在 `PointerController` 不再直接监听 DOM 事件，只依赖 `PointerInputSource` 提供的统一输入数据。

### 2. 存储层抽象

- 存储接口：[src/storage/GameStorage.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/storage/GameStorage.ts)
- 底层 key-value 适配器接口：[src/storage/StorageAdapter.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/storage/StorageAdapter.ts)
- 浏览器 `localStorage` 实现：[src/storage/BrowserLocalStorageAdapter.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/storage/BrowserLocalStorageAdapter.ts)
- 微信小游戏存储实现：[src/storage/WechatStorageAdapter.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/storage/WechatStorageAdapter.ts)
- 浏览器游戏存档实现：[src/storage/BrowserGameStorage.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/storage/BrowserGameStorage.ts)

现在已经支持：

- 已通关关卡记录
- 当前关卡进度记录
- 启动时恢复当前关卡进度

### 3. 渲染层尽量不依赖 DOM

- Surface 接口：[src/render/CanvasSurface.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/render/CanvasSurface.ts)
- 浏览器 Canvas 实现：[src/render/BrowserCanvasSurface.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/render/BrowserCanvasSurface.ts)
- 微信小游戏 Canvas 实现：[src/render/WechatCanvasSurface.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/render/WechatCanvasSurface.ts)
- 通用渲染器：[src/render/CanvasRenderer.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/render/CanvasRenderer.ts)

现在 `CanvasRenderer` 只依赖 `CanvasSurface`，不直接依赖 `HTMLCanvasElement`。

### 4. 微信小游戏入口已补齐

- 小游戏入口：[src/wechat/main.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/wechat/main.ts)
- 构建脚本：[scripts/build-wechat.mjs](/Users/zhengyuan/ideaProjects/svx_mini_game1/scripts/build-wechat.mjs)

运行：

```bash
npm run build:wechat
```

会产出：

- [dist-wechat/game.js](/Users/zhengyuan/ideaProjects/svx_mini_game1/dist-wechat/game.js)
- [dist-wechat/game.json](/Users/zhengyuan/ideaProjects/svx_mini_game1/dist-wechat/game.json)
- [game.js](/Users/zhengyuan/ideaProjects/svx_mini_game1/game.js)
- [game.json](/Users/zhengyuan/ideaProjects/svx_mini_game1/game.json)

现在有两种导入方式：

- 直接导入仓库根目录 `/Users/zhengyuan/ideaProjects/svx_mini_game1`
- 或者导入纯构建目录 `/Users/zhengyuan/ideaProjects/svx_mini_game1/dist-wechat`

如果导入仓库根目录，根目录下的 `game.js` 会转发到 `dist-wechat/game.js`，这样就不会再出现“找不到 game.json”的预览错误。

## 当前小游戏验证方式

这版已经可以在小游戏环境里验证：

- Canvas 棋盘渲染
- 触摸拖拽创建矩形
- 本地存档记录与当前进度恢复
- 通关与基础反馈
- Canvas 内操作按钮
- Canvas 内关卡选择面板

当前小游戏入口为了尽快验证核心玩法，采用的是“Canvas 主界面 + Canvas 内轻量 UI”的方式。

可直接操作：

- 底部按钮：`关卡 / 撤销 / 重开 / 提示 / 下一关`
- 点击 `关卡` 会弹出 `6 × 6` 的关卡面板
- 已完成关卡依然支持直接查看记录解法

在微信开发者工具里可以使用：

```js
__PATCH_GRID_DEBUG__.undo()
__PATCH_GRID_DEBUG__.resetLevel()
__PATCH_GRID_DEBUG__.hint()
__PATCH_GRID_DEBUG__.nextLevel()
__PATCH_GRID_DEBUG__.setLevel(5)
__PATCH_GRID_DEBUG__.snapshot()
```

## 后续真正上线微信小游戏时仍建议替换/完善的模块

### 当前已经有微信实现

1. `WechatPointerInputSource`
2. `WechatStorageAdapter`
3. `WechatCanvasSurface`

这三块已经可以用于第一轮真机/开发者工具验证。

### 可能需要调整

1. [src/main.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/main.ts)
   当前是浏览器入口，负责创建 DOM、按钮和浏览器适配器。在微信小游戏中通常需要改成小游戏启动入口，并替换页面 UI 的挂载方式。

2. [src/wechat/main.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/wechat/main.ts)
   当前小游戏入口为了快速验证，只做了简洁的 Canvas 覆盖层和调试 API，还没有把浏览器侧的完整侧边栏、关卡格子和语言切换 UI 迁过去。

3. [src/audio/FeedbackAudio.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/audio/FeedbackAudio.ts)
   当前使用 Web Audio API。微信小游戏里可以继续用兼容方案，或者替换成小游戏音频 API。

4. [src/i18n.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/i18n.ts)
   本身不强依赖浏览器，但 `loadLocale / saveLocale / detectLocale` 里目前带有浏览器环境逻辑。如果希望完全平台统一，可以再抽一个设置存储和语言检测适配层。

## 不需要重写的核心模块

这些模块基本可以原样复用：

- [src/game/GameController.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/game/GameController.ts)
- [src/game/logic.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/game/logic.ts)
- [src/game/levels.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/game/levels.ts)
- [src/game/types.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/game/types.ts)
- [src/i18n.ts](/Users/zhengyuan/ideaProjects/svx_mini_game1/src/i18n.ts) 的文本结构

## 推荐的微信小游戏替换映射

### 输入

- 浏览器：`BrowserPointerInputSource`
- 微信小游戏：`WechatPointerInputSource`

职责保持一致，只输出统一的 `PointerSample` 数据。

### 存储

- 浏览器：`BrowserLocalStorageAdapter`
- 微信小游戏：`WechatStorageAdapter`

职责保持一致，只提供：

- `getItem(key)`
- `setItem(key, value)`
- `removeItem(key)`

### 渲染宿主

- 浏览器：`BrowserCanvasSurface`
- 微信小游戏：`WechatCanvasSurface`

职责保持一致，只提供：

- `getContext2D()`
- `syncSize()`
- `clientToSurfacePoint(x, y)`

## 建议的下一步

如果下一阶段就是直接做微信小游戏适配，建议按这个顺序进行：

1. 先新增 `WechatStorageAdapter`
2. 再新增 `WechatCanvasSurface`
3. 然后新增 `WechatPointerInputSource`
4. 最后重写小游戏环境下的 `main.ts` 宿主入口

这样能保证核心玩法逻辑完全不动，只替换平台壳层。
