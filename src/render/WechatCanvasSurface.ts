import type { CanvasSurface, SurfacePoint, SurfaceSize } from './CanvasSurface';

interface WechatCanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
}

interface WechatCanvasSurfaceOptions {
  canvas: WechatCanvasLike;
  width: number;
  height: number;
  dpr: number;
}

export class WechatCanvasSurface implements CanvasSurface {
  private readonly canvas: WechatCanvasLike;

  private readonly context: CanvasRenderingContext2D;

  private readonly width: number;

  private readonly height: number;

  private readonly dpr: number;

  constructor(options: WechatCanvasSurfaceOptions) {
    const context = options.canvas.getContext('2d');
    if (!context) {
      throw new Error('WeChat 2D context is not available');
    }

    this.canvas = options.canvas;
    this.context = context;
    this.width = options.width;
    this.height = options.height;
    this.dpr = options.dpr;
  }

  getContext2D(): CanvasRenderingContext2D {
    return this.context;
  }

  syncSize(): SurfaceSize {
    const displayWidth = Math.round(this.width * this.dpr);
    const displayHeight = Math.round(this.height * this.dpr);

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }

    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    return {
      width: this.width,
      height: this.height,
      dpr: this.dpr,
    };
  }

  clientToSurfacePoint(clientX: number, clientY: number): SurfacePoint | null {
    return {
      x: clientX,
      y: clientY,
    };
  }
}
