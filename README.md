# Patch Grid Prototype

一个使用 `TypeScript + Vite + Canvas` 搭建的逻辑益智游戏原型，玩法接近 Play Patches，后续方便迁移到微信小游戏。

## 启动

```bash
npm install
npm run dev
```

构建生产包：

```bash
npm run build
```

## 已实现

- 网格棋盘与数字提示
- 鼠标 / 触摸拖拽创建矩形
- 矩形规则校验
- 通关判定
- 示例关卡
- 撤销、重开、下一关

## 目录结构

```text
src/
  game/
    GameController.ts   # 游戏状态、关卡流转、历史记录
    levels.ts           # 示例关卡
    logic.ts            # 规则校验与通关判定
    types.ts            # 纯数据结构
  input/
    PointerController.ts # 指针输入封装（鼠标/触摸统一）
  render/
    CanvasRenderer.ts    # Canvas 绘制与坐标换算
  main.ts                # DOM 壳层与模块装配
  style.css              # 简洁 UI
```

## 后续迁移到微信小游戏的建议

- `src/game` 保持纯逻辑，不依赖 DOM，可直接复用。
- `src/render/CanvasRenderer.ts` 已经把绘制与点击坐标计算集中到 Canvas 层，后续可替换为小游戏 Canvas API 适配。
- `src/input/PointerController.ts` 目前基于浏览器 Pointer Events，迁移时只需把输入事件映射为 `startDrag / updateDrag / finishDrag`。
- `src/main.ts` 是宿主层，后续主要替换这一层与 UI 控件挂载方式。
