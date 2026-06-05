declare interface WechatTouch {
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  x?: number;
  y?: number;
}

declare interface WechatTouchEvent {
  touches?: WechatTouch[];
  changedTouches?: WechatTouch[];
}

declare interface WechatWindowInfo {
  windowWidth: number;
  windowHeight: number;
  pixelRatio: number;
}

declare interface WechatSafeArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

declare interface WechatMenuButtonRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

declare interface WechatSystemInfo {
  language?: string;
  windowWidth?: number;
  windowHeight?: number;
  pixelRatio?: number;
  statusBarHeight?: number;
  safeArea?: WechatSafeArea;
}

declare interface WechatCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
  createImage?(): WechatImage;
}

declare interface WechatImage {
  src: string;
  onload: (() => void) | null;
  onerror: ((error?: unknown) => void) | null;
  width?: number;
  height?: number;
}

declare interface WechatInnerAudioContext {
  autoplay: boolean;
  src: string;
  volume: number;
  obeyMuteSwitch?: boolean;
  play(): void;
  stop?(): void;
  destroy?(): void;
  onEnded?(callback: () => void): void;
  onStop?(callback: () => void): void;
  onError?(callback: () => void): void;
}

declare interface WechatApi {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, data: string): void;
  removeStorageSync(key: string): void;
  vibrateShort?(options?: { type?: 'light' | 'medium' | 'heavy' }): void;
  onTouchStart(callback: (event: WechatTouchEvent) => void): void;
  onTouchMove(callback: (event: WechatTouchEvent) => void): void;
  onTouchEnd(callback: (event: WechatTouchEvent) => void): void;
  onTouchCancel(callback: (event: WechatTouchEvent) => void): void;
  createCanvas(): WechatCanvas;
  createImage?(): WechatImage;
  createInnerAudioContext?(): WechatInnerAudioContext;
  getWindowInfo?(): WechatWindowInfo;
  getSystemInfoSync(): WechatSystemInfo;
  getMenuButtonBoundingClientRect?(): WechatMenuButtonRect;
}

declare const wx: WechatApi;
