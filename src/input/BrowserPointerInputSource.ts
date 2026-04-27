import type { PointerInputHandlers, PointerInputSource, PointerSample } from './PointerInputSource';

function toPointerSample(event: PointerEvent): PointerSample {
  return {
    pointerId: event.pointerId,
    isPrimary: event.isPrimary,
    button: event.button,
    pointerType: event.pointerType,
    clientX: event.clientX,
    clientY: event.clientY,
  };
}

export class BrowserPointerInputSource implements PointerInputSource {
  constructor(private readonly element: HTMLCanvasElement) {}

  bind(handlers: PointerInputHandlers): void {
    this.element.addEventListener('pointerdown', (event) => {
      handlers.onPointerStart(toPointerSample(event));
      event.preventDefault();

      if (event.isPrimary) {
        this.element.setPointerCapture(event.pointerId);
      }
    });

    this.element.addEventListener('pointermove', (event) => {
      handlers.onPointerMove(toPointerSample(event));
      event.preventDefault();
    });

    this.element.addEventListener('pointerup', (event) => {
      handlers.onPointerEnd(toPointerSample(event));

      if (this.element.hasPointerCapture(event.pointerId)) {
        this.element.releasePointerCapture(event.pointerId);
      }

      event.preventDefault();
    });

    this.element.addEventListener('pointercancel', (event) => {
      handlers.onPointerCancel(toPointerSample(event));

      if (this.element.hasPointerCapture(event.pointerId)) {
        this.element.releasePointerCapture(event.pointerId);
      }
    });

    this.element.addEventListener('lostpointercapture', (event) => {
      handlers.onPointerCancel(toPointerSample(event as PointerEvent));
    });
  }
}
