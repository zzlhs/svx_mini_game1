export interface PointerSample {
  pointerId: number;
  isPrimary: boolean;
  button: number;
  pointerType: string;
  clientX: number;
  clientY: number;
}

export interface PointerInputHandlers {
  onPointerStart(sample: PointerSample): void;
  onPointerMove(sample: PointerSample): void;
  onPointerEnd(sample: PointerSample): void;
  onPointerCancel(sample: PointerSample): void;
}

export interface PointerInputSource {
  bind(handlers: PointerInputHandlers): void;
}
