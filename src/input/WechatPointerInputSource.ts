import type { PointerInputHandlers, PointerInputSource, PointerSample } from './PointerInputSource';

interface WechatTouchLike {
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  x?: number;
  y?: number;
}

interface WechatTouchEventLike {
  touches?: WechatTouchLike[];
  changedTouches?: WechatTouchLike[];
}

function readTouchPoint(event: WechatTouchEventLike): { x: number; y: number } | null {
  const touch = event.touches?.[0] ?? event.changedTouches?.[0];
  if (!touch) {
    return null;
  }

  const x = touch.clientX ?? touch.x ?? touch.pageX;
  const y = touch.clientY ?? touch.y ?? touch.pageY;

  if (typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }

  return { x, y };
}

function toPointerSample(event: WechatTouchEventLike): PointerSample | null {
  const point = readTouchPoint(event);
  if (!point) {
    return null;
  }

  return {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    pointerType: 'touch',
    clientX: point.x,
    clientY: point.y,
  };
}

export class WechatPointerInputSource implements PointerInputSource {
  bind(handlers: PointerInputHandlers): void {
    wx.onTouchStart((event) => {
      const sample = toPointerSample(event);
      if (sample) {
        handlers.onPointerStart(sample);
      }
    });

    wx.onTouchMove((event) => {
      const sample = toPointerSample(event);
      if (sample) {
        handlers.onPointerMove(sample);
      }
    });

    wx.onTouchEnd((event) => {
      const sample = toPointerSample(event);
      if (sample) {
        handlers.onPointerEnd(sample);
      }
    });

    wx.onTouchCancel((event) => {
      const sample = toPointerSample(event);
      if (sample) {
        handlers.onPointerCancel(sample);
      }
    });
  }
}
