import type { GameController } from '../game/GameController';
import type { PointerInputSource } from './PointerInputSource';
import type { PointerSample } from './PointerInputSource';
import type { CanvasSurface } from '../render/CanvasSurface';
import type { CanvasRenderer } from '../render/CanvasRenderer';

export class PointerController {
  private readonly renderer: CanvasRenderer;

  private readonly game: GameController;

  private readonly surface: CanvasSurface;

  private readonly shouldIgnoreInput: () => boolean;

  private activePointerId: number | null = null;

  constructor(
    inputSource: PointerInputSource,
    surface: CanvasSurface,
    renderer: CanvasRenderer,
    game: GameController,
    options: { shouldIgnoreInput?: () => boolean } = {},
  ) {
    this.surface = surface;
    this.renderer = renderer;
    this.game = game;
    this.shouldIgnoreInput = options.shouldIgnoreInput ?? (() => false);

    inputSource.bind({
      onPointerStart: this.handlePointerStart,
      onPointerMove: this.handlePointerMove,
      onPointerEnd: this.handlePointerEnd,
      onPointerCancel: this.handlePointerCancel,
    });
  }

  private toSurfacePoint(clientX: number, clientY: number): { x: number; y: number } | null {
    return this.surface.clientToSurfacePoint(clientX, clientY);
  }

  private readonly handlePointerStart = (sample: PointerSample): void => {
    if (this.game.isInteractionLocked() || this.shouldIgnoreInput()) {
      return;
    }

    if (!sample.isPrimary) {
      return;
    }

    if (sample.pointerType === 'mouse' && sample.button !== 0) {
      return;
    }

    const point = this.toSurfacePoint(sample.clientX, sample.clientY);
    if (!point) {
      return;
    }

    const cell = this.renderer.getCellFromSurfacePoint(point);
    if (!cell) {
      this.game.clearSelectedPlacement();
      return;
    }

    const snapshot = this.game.getSnapshot();
    const selectedPlacement = snapshot.selectedPlacementId
      ? snapshot.placements.find((placement) => placement.id === snapshot.selectedPlacementId) ?? null
      : null;
    if (selectedPlacement && this.renderer.isPlacementDeleteBadgeHit(point, selectedPlacement)) {
      this.game.removeSelectedPlacement();
      return;
    }

    const placement = this.game.getPlacementAtCell(cell);
    if (placement) {
      this.game.selectPlacement(placement.id);
      return;
    }

    this.activePointerId = sample.pointerId;
    this.game.startDrag(cell);
  };

  private readonly handlePointerMove = (sample: PointerSample): void => {
    if (this.shouldIgnoreInput()) {
      return;
    }

    if (sample.pointerId !== this.activePointerId) {
      const point = this.toSurfacePoint(sample.clientX, sample.clientY);
      if (!point) {
        this.game.clearSelectedPlacement();
        return;
      }

      const cell = this.renderer.getCellFromSurfacePoint(point);
      if (!cell) {
        this.game.clearSelectedPlacement();
        return;
      }

      const placement = this.game.getPlacementAtCell(cell);
      if (placement) {
        this.game.selectPlacement(placement.id);
      } else {
        this.game.clearSelectedPlacement();
      }
      return;
    }

    const point = this.toSurfacePoint(sample.clientX, sample.clientY);
    if (!point) {
      return;
    }

    const cell = this.renderer.getCellFromSurfacePoint(point, true);
    if (!cell) {
      return;
    }

    this.game.updateDrag(cell);
  };

  private readonly handlePointerEnd = (sample: PointerSample): void => {
    if (sample.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;
    this.game.finishDrag();
  };

  private readonly handlePointerCancel = (sample: PointerSample): void => {
    if (sample.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;
    this.game.cancelDrag();
  };
}
