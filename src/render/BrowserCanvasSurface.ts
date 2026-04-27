import type { CanvasSurface, SurfacePoint, SurfaceSize } from './CanvasSurface';

export class BrowserCanvasSurface implements CanvasSurface {
  readonly element: HTMLCanvasElement;

  private readonly context: CanvasRenderingContext2D;

  constructor(element: HTMLCanvasElement) {
    const context = element.getContext('2d');
    if (!context) {
      throw new Error('2D context is not available');
    }

    this.element = element;
    this.context = context;
  }

  getContext2D(): CanvasRenderingContext2D {
    return this.context;
  }

  syncSize(): SurfaceSize {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.element.clientWidth));
    const height = Math.max(1, Math.round(this.element.clientHeight));
    const displayWidth = Math.round(width * dpr);
    const displayHeight = Math.round(height * dpr);

    if (this.element.width !== displayWidth || this.element.height !== displayHeight) {
      this.element.width = displayWidth;
      this.element.height = displayHeight;
    }

    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { width, height, dpr };
  }

  clientToSurfacePoint(clientX: number, clientY: number): SurfacePoint | null {
    const rect = this.element.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }
}
