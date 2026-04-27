# Agent Notes

## Project

- Name: `填充格子`
- Stack: `TypeScript + Vite + Canvas`
- Targets:
  - Browser web build
  - WeChat Mini Game build

## Core Gameplay

- Grid-based logic puzzle.
- Some cells contain clue numbers.
- Player drags to create rectangles.
- Each rectangle must:
  - contain exactly one clue
  - have area equal to that clue
- The full board must be covered with no overlap and no gaps.

## Current Implemented Scope

- Vite + TypeScript project bootstrap
- Canvas board rendering
- Mouse and touch drag interaction
- Placement validation
- Win detection
- 30 levels with progression
- Hint system
- Undo / restart / next level
- Local save:
  - cleared level records
  - current progress
- i18n:
  - `zh-CN`
  - `en-US`
- Lightweight animation and audio
- WeChat Mini Game adaptation

## WeChat Mini Game Status

- Root import for WeChat DevTools is supported.
- `game.js` and `game.json` are generated at repo root.
- Canvas-only mini game UI is implemented.
- Safe-area-aware top layout is in place.
- Current WeChat UI includes:
  - home / entry screen
  - HUD-style top info
  - floating toolbar
  - level selection panel
  - clear banner before auto-advance

## Recent Collaboration Summary

The user requested a Play Patches-like logic puzzle prototype and later expanded the scope toward a WeChat Mini Game-ready experience.

Main collaborative milestones:

1. Built the playable prototype with:
   - board rendering
   - drag placement
   - validation
   - win check
   - sample levels

2. Added progression and utility systems:
   - 30 levels
   - level record grid
   - level completion time
   - saved solutions
   - undo / restart / next
   - hint system

3. Added polish features:
   - lightweight animation
   - placement / invalid / celebration audio
   - i18n
   - local persistence

4. Refactored for WeChat Mini Game portability:
   - input abstraction
   - storage abstraction
   - canvas surface abstraction
   - dedicated WeChat entry

5. Fixed WeChat import and preview issues:
   - missing `game.json`
   - invalid `showStatusBar`
   - root-level mini game bundle output
   - startup / canvas compatibility fixes

6. Iterated heavily on WeChat UI:
   - moved from a simple validation shell to a fuller mini game layout
   - adjusted safe area behavior
   - reorganized HUD and toolbar
   - added home screen
   - unified theme colors and border language
   - reduced excessive bubble frames
   - kept rules text inside a dedicated bordered area

7. Updated branding:
   - game name changed from `Patch Grid` to `填充格子` / `Fill Grid`

8. Latest interaction change:
   - placed rectangles can now be removed with a red `X`
   - desktop behavior:
     - moving the mouse onto an existing rectangle shows the red `X`
     - clicking the red `X` removes that rectangle
   - touch behavior:
     - tap rectangle to reveal delete affordance
     - tap red `X` to remove

## Important Current Behavior

- After solving a level, the game shows a short celebration banner and then auto-advances to the next level.
- Browser and WeChat builds both compile successfully.
- Rules text must remain inside a bordered area.
- Page text/border styling has been unified through a theme layer in `src/wechat/main.ts`.

## Key Files

- Browser entry: `/Users/zhengyuan/ideaProjects/svx_mini_game1/src/main.ts`
- WeChat entry: `/Users/zhengyuan/ideaProjects/svx_mini_game1/src/wechat/main.ts`
- Game state: `/Users/zhengyuan/ideaProjects/svx_mini_game1/src/game/GameController.ts`
- Rules logic: `/Users/zhengyuan/ideaProjects/svx_mini_game1/src/game/logic.ts`
- Shared types: `/Users/zhengyuan/ideaProjects/svx_mini_game1/src/game/types.ts`
- Renderer: `/Users/zhengyuan/ideaProjects/svx_mini_game1/src/render/CanvasRenderer.ts`
- Input controller: `/Users/zhengyuan/ideaProjects/svx_mini_game1/src/input/PointerController.ts`
- i18n: `/Users/zhengyuan/ideaProjects/svx_mini_game1/src/i18n.ts`

## Next Suggested Directions

- Continue refining deletion UX so touch and mouse feel equally natural.
- Add a more polished start / transition flow for mini game launch.
- Add final visual cleanup for HUD, level panel, and toolbar consistency.
- If needed, add a dedicated tutorial / onboarding first level.
