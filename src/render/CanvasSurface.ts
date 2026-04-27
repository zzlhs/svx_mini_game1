export interface SurfacePoint {
  x: number;
  y: number;
}

export interface SurfaceSize {
  width: number;
  height: number;
  dpr: number;
}

export interface CanvasSurface {
  getContext2D(): CanvasRenderingContext2D;
  syncSize(): SurfaceSize;
  clientToSurfacePoint(clientX: number, clientY: number): SurfacePoint | null;
}
