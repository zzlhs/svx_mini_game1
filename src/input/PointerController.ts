import type { GameController } from '../game/GameController';
import type { CanvasRenderer } from '../render/CanvasRenderer';

export class PointerController {
  private readonly canvas: HTMLCanvasElement;

  private readonly renderer: CanvasRenderer;

  private readonly game: GameController;

  private activePointerId: number | null = null;

  constructor(canvas: HTMLCanvasElement, renderer: CanvasRenderer, game: GameController) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.game = game;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('lostpointercapture', this.handlePointerCancel);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.game.isInteractionLocked()) {
      return;
    }

    if (!event.isPrimary) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const cell = this.renderer.getCellFromClientPoint(event.clientX, event.clientY);
    if (!cell) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.game.startDrag(cell);
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    const cell = this.renderer.getCellFromClientPoint(event.clientX, event.clientY, true);
    if (!cell) {
      return;
    }

    this.game.updateDrag(cell);
    event.preventDefault();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;
    this.game.finishDrag();

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    event.preventDefault();
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.activePointerId = null;
    this.game.cancelDrag();

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };
}
