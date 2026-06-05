import { FeedbackAudio } from '../audio/FeedbackAudio';
import { GameController } from '../game/GameController';
import { levels } from '../game/levels';
import { getCoveredCellCount } from '../game/logic';
import type {
  GameSnapshot,
  LevelRecord,
} from '../game/types';
import {
  detectLocale,
  formatLevelName,
  formatLocaleDate,
  t,
  tm,
  type Locale,
} from '../i18n';
import { WechatPointerInputSource } from '../input/WechatPointerInputSource';
import { PointerController } from '../input/PointerController';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { WechatCanvasSurface } from '../render/WechatCanvasSurface';
import { BrowserGameStorage, getWeeklyBucketKey } from '../storage/BrowserGameStorage';
import { WechatStorageAdapter } from '../storage/WechatStorageAdapter';

interface OverlayActionApi {
  nextLevel(): void;
  resetLevel(): void;
  undo(): void;
  hint(): void;
  setLevel(index: number): void;
  snapshot(): ReturnType<GameController['getSnapshot']>;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WechatCanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
}

interface ButtonSpec {
  id: 'levels' | 'undo' | 'restart' | 'hint' | 'next';
  label: string;
  rect: Rect;
  enabled: boolean;
}

interface HomeButtonSpec {
  id: 'newGame' | 'leaderboard';
  rect: Rect;
}

interface TopIconButtonSpec {
  id: 'goal' | 'help' | 'settings' | 'leaderboardTop';
  rect: Rect;
}

interface TileSpec {
  index: number;
  rect: Rect;
}

interface LandingAssets {
  background: WechatImage | null;
  newGameButton: WechatImage | null;
  leaderboardButton: WechatImage | null;
  checkIcon: WechatImage | null;
  helpIcon: WechatImage | null;
}

interface UserSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

interface UiLayout {
  headerRect: Rect;
  chipRect: Rect;
  hintRect: Rect;
  recordRect: Rect;
  progressRect: Rect;
  rulesRect: Rect;
  actionsRect: Rect;
  safeTop: number;
  safeBottom: number;
  topInset: number;
  bottomInset: number;
}

interface ScreenMetrics {
  width: number;
  height: number;
  dpr: number;
  safeTop: number;
  safeBottom: number;
}

const THEME = {
  backgroundStart: '#ff958f',
  backgroundMid: '#f39ac9',
  backgroundEnd: '#aae6ff',
  surfaceStrong: 'rgba(255, 255, 255, 0.92)',
  surface: 'rgba(255, 255, 255, 0.84)',
  surfaceSoft: 'rgba(255, 255, 255, 0.76)',
  surfaceMuted: 'rgba(255, 255, 255, 0.46)',
  border: 'rgba(255, 255, 255, 0.82)',
  borderSoft: 'rgba(255, 255, 255, 0.58)',
  borderAccent: 'rgba(255, 214, 74, 0.95)',
  shadow: 'rgba(182, 110, 137, 0.24)',
  overlay: 'rgba(123, 95, 124, 0.20)',
  textPrimary: '#684355',
  textSecondary: '#8d7080',
  textMuted: '#a18899',
  accent: '#ffab27',
  accentStrong: '#ff8315',
  accentSoft: '#fff1b9',
  accentFill: '#ffd54b',
  success: '#7cc95d',
  successSoft: '#ecffd8',
  info: '#55a7e3',
  infoSoft: '#dcf5ff',
  white: '#fffefe',
  disabledText: '#cbbbc4',
  candyPink: '#ffb9cc',
  candyPeach: '#ffc392',
  candyYellow: '#ffe369',
  candyMint: '#8fe8c2',
  candyBlue: '#7cc8ff',
  candyLavender: '#cbc4ff',
} as const;

declare global {
  interface Window {
    __PATCH_GRID_DEBUG__?: OverlayActionApi;
  }
}

let cachedCanvas: WechatCanvasLike | null = null;

const WECHAT_ASSET_PATHS = {
  background: 'assets/wechat/bg.jpg',
  newGameButton: 'assets/wechat/new_game2.png',
  leaderboardButton: 'assets/wechat/rank_cutout.png',
  checkIcon: 'assets/wechat/check_icon.png',
  helpIcon: 'assets/wechat/help_icon.png',
} as const;

const SETTINGS_STORAGE_KEY = 'patch-grid-wechat-settings-v1';

function isWechatCanvasLike(value: unknown): value is WechatCanvasLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getContext' in value &&
    typeof (value as { getContext?: unknown }).getContext === 'function'
  );
}

function resolveWechatCanvas(): WechatCanvasLike {
  if (cachedCanvas) {
    return cachedCanvas;
  }

  const globalCanvas = (globalThis as typeof globalThis & { canvas?: unknown }).canvas;
  cachedCanvas = isWechatCanvasLike(globalCanvas) ? globalCanvas : wx.createCanvas();
  return cachedCanvas;
}

function scheduleFrame(callback: () => void): number {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(() => callback());
  }

  return setTimeout(callback, 16) as unknown as number;
}

function createWechatImage(canvas: WechatCanvasLike): WechatImage | null {
  const canvasWithImage = canvas as WechatCanvasLike & { createImage?: () => WechatImage };
  if (typeof canvasWithImage.createImage === 'function') {
    return canvasWithImage.createImage();
  }

  if (typeof wx.createImage === 'function') {
    return wx.createImage();
  }

  return null;
}

function loadWechatImage(canvas: WechatCanvasLike, source: string): Promise<WechatImage | null> {
  const image = createWechatImage(canvas);
  if (!image) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function resolveLocale(): Locale {
  const systemInfo = wx.getSystemInfoSync();
  const language = systemInfo.language ?? '';
  if (language.startsWith('zh')) {
    return 'zh-CN';
  }

  return detectLocale();
}

function getWindowMetrics(): ScreenMetrics {
  const windowInfo = wx.getWindowInfo?.();
  const systemInfo = wx.getSystemInfoSync();
  const width = windowInfo?.windowWidth ?? systemInfo.windowWidth ?? 375;
  const height = windowInfo?.windowHeight ?? systemInfo.windowHeight ?? 667;
  const dpr = windowInfo?.pixelRatio ?? systemInfo.pixelRatio ?? 2;
  const statusBarHeight = systemInfo.statusBarHeight ?? 0;
  const safeArea = systemInfo.safeArea;
  const menuButtonBottom = wx.getMenuButtonBoundingClientRect?.().bottom ?? 0;

  return {
    width,
    height,
    dpr,
    safeTop: Math.max(statusBarHeight, safeArea?.top ?? 0, menuButtonBottom + 4),
    safeBottom: Math.max(0, height - (safeArea?.bottom ?? height)),
  };
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatCompletedAt(locale: Locale, isoString: string): string {
  return formatLocaleDate(locale, isoString) ?? t(locale, 'fallback.unknownTime');
}

function loadUserSettings(adapter: WechatStorageAdapter): UserSettings {
  try {
    const raw = adapter.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        soundEnabled: true,
        vibrationEnabled: true,
      };
    }

    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      soundEnabled: parsed.soundEnabled !== false,
      vibrationEnabled: parsed.vibrationEnabled !== false,
    };
  } catch {
    return {
      soundEnabled: true,
      vibrationEnabled: true,
    };
  }
}

function saveUserSettings(adapter: WechatStorageAdapter, settings: UserSettings): void {
  adapter.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function wrapLinesByLength(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const lines: string[] = [];
  for (let index = 0; index < text.length; index += maxLength) {
    lines.push(text.slice(index, index + maxLength));
  }
  return lines;
}

function drawBootstrapSplash(): void {
  try {
    const canvas = resolveWechatCanvas();
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const metrics = getWindowMetrics();
    canvas.width = Math.round(metrics.width * metrics.dpr);
    canvas.height = Math.round(metrics.height * metrics.dpr);
    context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);

    const gradient = context.createLinearGradient(0, 0, metrics.width, metrics.height);
    gradient.addColorStop(0, THEME.backgroundStart);
    gradient.addColorStop(0.5, THEME.backgroundMid);
    gradient.addColorStop(1, THEME.backgroundEnd);
    context.fillStyle = gradient;
    context.fillRect(0, 0, metrics.width, metrics.height);

    context.fillStyle = THEME.textPrimary;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 26px sans-serif';
    context.fillText('填满格子', metrics.width / 2, metrics.height / 2 - 16);
    context.font = '500 14px sans-serif';
    context.fillStyle = THEME.textSecondary;
    context.fillText('Loading mini game...', metrics.width / 2, metrics.height / 2 + 18);
  } catch {
    // Ignore splash failures and continue booting.
  }
}

function drawBootstrapError(error: unknown): void {
  try {
    const canvas = resolveWechatCanvas();
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const metrics = getWindowMetrics();
    canvas.width = Math.round(metrics.width * metrics.dpr);
    canvas.height = Math.round(metrics.height * metrics.dpr);
    context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    context.fillStyle = THEME.backgroundStart;
    context.fillRect(0, 0, metrics.width, metrics.height);
    context.fillStyle = THEME.textPrimary;
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.font = '700 20px sans-serif';
    context.fillText('填满格子', 20, 24);
    context.font = '500 14px sans-serif';
    context.fillStyle = THEME.accentStrong;
    context.fillText('Mini game bootstrap failed.', 20, 58);
    context.fillStyle = THEME.textSecondary;
    context.font = '12px sans-serif';

    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? 'Unknown error');
    wrapLinesByLength(message, 36).forEach((line, index) => {
      context.fillText(line, 20, 94 + index * 18);
    });
  } catch {
    // Ignore drawing failures and rely on console output.
  }
}

function roundRect(context: CanvasRenderingContext2D, rect: Rect, radius: number): void {
  context.beginPath();
  context.moveTo(rect.x + radius, rect.y);
  context.arcTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height, radius);
  context.arcTo(
    rect.x + rect.width,
    rect.y + rect.height,
    rect.x,
    rect.y + rect.height,
    radius,
  );
  context.arcTo(rect.x, rect.y + rect.height, rect.x, rect.y, radius);
  context.arcTo(rect.x, rect.y, rect.x + rect.width, rect.y, radius);
  context.closePath();
}

function isPointInsideRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function computeLayout(metrics: ScreenMetrics): UiLayout {
  const padding = 12;
  const gap = 6;
  const headerHeight = 56;
  const infoHeight = 56;
  const rulesHeight = 72;
  const actionsHeight = 42;
  const bottomSafeSpacing = Math.max(16, metrics.safeBottom + 6);
  const headerRect = {
    x: padding,
    y: metrics.safeTop + 14,
    width: metrics.width - padding * 2,
    height: headerHeight,
  };

  const infoY = headerRect.y + headerHeight + 8;
  const hintWidth = Math.max(156, Math.floor((metrics.width - padding * 2 - gap * 2) * 0.42));
  const smallCardWidth = Math.floor((metrics.width - padding * 2 - gap * 2 - hintWidth) / 2);
  const hintRect = {
    x: padding,
    y: infoY,
    width: hintWidth,
    height: infoHeight,
  };
  const recordRect = {
    x: hintRect.x + hintRect.width + gap,
    y: infoY,
    width: smallCardWidth,
    height: infoHeight,
  };
  const progressRect = {
    x: recordRect.x + recordRect.width + gap,
    y: infoY,
    width: metrics.width - padding - (recordRect.x + recordRect.width + gap),
    height: infoHeight,
  };
  const actionsRect = {
    x: padding,
    y: metrics.height - bottomSafeSpacing - padding - actionsHeight,
    width: metrics.width - padding * 2,
    height: actionsHeight,
  };
  const rulesRect = {
    x: padding,
    y: actionsRect.y - gap - rulesHeight,
    width: metrics.width - padding * 2,
    height: rulesHeight,
  };
  const topInset = infoY + infoHeight + 12;
  const bottomInset = metrics.height - (rulesRect.y - 10);

  return {
    headerRect,
    chipRect: {
      x: headerRect.x + headerRect.width - 92,
      y: headerRect.y + 6,
      width: 78,
      height: 26,
    },
    hintRect,
    recordRect,
    progressRect,
    rulesRect,
    actionsRect,
    safeTop: metrics.safeTop,
    safeBottom: metrics.safeBottom,
    topInset,
    bottomInset,
  };
}

function drawCardShell(context: CanvasRenderingContext2D, rect: Rect): void {
  context.save();
  const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  gradient.addColorStop(0, THEME.surfaceStrong);
  gradient.addColorStop(1, THEME.surfaceSoft);
  context.fillStyle = gradient;
  context.strokeStyle = THEME.border;
  context.lineWidth = 1.2;
  context.shadowColor = THEME.shadow;
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  roundRect(context, rect, 14);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();
  context.restore();
}

function drawHudShell(context: CanvasRenderingContext2D, rect: Rect): void {
  context.save();
  const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.72)');
  context.fillStyle = gradient;
  context.strokeStyle = THEME.border;
  context.lineWidth = 1.1;
  context.shadowColor = THEME.shadow;
  context.shadowBlur = 14;
  context.shadowOffsetY = 5;
  roundRect(context, rect, 18);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();
  context.restore();
}

function drawToolbarShell(context: CanvasRenderingContext2D, rect: Rect): void {
  context.save();
  const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.82)');
  context.fillStyle = gradient;
  context.strokeStyle = THEME.border;
  context.shadowColor = THEME.shadow;
  context.shadowBlur = 22;
  context.shadowOffsetY = 10;
  roundRect(context, rect, 22);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();
  context.restore();
}

function drawTextFrame(
  context: CanvasRenderingContext2D,
  rect: Rect,
  options: {
    fill?: string;
    stroke?: string;
    radius?: number;
  } = {},
): void {
  context.save();
  context.fillStyle = options.fill ?? 'rgba(255, 255, 255, 0.56)';
  context.strokeStyle = options.stroke ?? THEME.borderSoft;
  context.lineWidth = 1.1;
  roundRect(context, rect, options.radius ?? 10);
  context.fill();
  context.stroke();
  context.restore();
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: WechatImage,
  rect: Rect,
): void {
  const sourceWidth = image.width ?? rect.width;
  const sourceHeight = image.height ?? rect.height;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = rect.width / rect.height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  context.drawImage(
    image as unknown as CanvasImageSource,
    sx,
    sy,
    sw,
    sh,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  );
}

function drawImageFit(
  context: CanvasRenderingContext2D,
  image: WechatImage,
  rect: Rect,
): void {
  context.drawImage(
    image as unknown as CanvasImageSource,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  );
}

function drawLandingTopIconBar(
  context: CanvasRenderingContext2D,
  metrics: ScreenMetrics,
  assets: LandingAssets,
  buttons: TopIconButtonSpec[],
  pressedId: string | null,
): void {
  const barRect = {
    x: 16,
    y: metrics.safeTop + 6,
    width: 148,
    height: 62,
  };

  context.save();
  context.fillStyle = 'rgba(255,255,255,0.96)';
  context.strokeStyle = 'rgba(255,255,255,0.98)';
  context.lineWidth = 1.2;
  context.shadowColor = 'rgba(144, 118, 153, 0.22)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 6;
  roundRect(context, barRect, 19);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();

  context.strokeStyle = 'rgba(238, 230, 241, 0.82)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(barRect.x + barRect.width / 2, barRect.y + 8);
  context.lineTo(barRect.x + barRect.width / 2, barRect.y + barRect.height - 8);
  context.stroke();

  buttons.forEach((button) => {
    const isPressed = pressedId === `icon:${button.id}`;
    const renderRect = {
      ...button.rect,
      y: button.rect.y + (isPressed ? 1.5 : 0),
    };
    const image = button.id === 'goal' ? assets.checkIcon : assets.helpIcon;
    if (image) {
      drawImageFit(context, image, renderRect);
    }
  });

  context.restore();
}

function drawRoundTopIcon(
  context: CanvasRenderingContext2D,
  rect: Rect,
  palette: { start: string; end: string; outline: string },
  icon: 'gear' | 'trophy',
  pressed: boolean,
): void {
  const renderRect = {
    ...rect,
    y: rect.y + (pressed ? 1.5 : 0),
  };
  const centerX = renderRect.x + renderRect.width / 2;
  const centerY = renderRect.y + renderRect.height / 2;
  const radius = renderRect.width / 2;
  const gradient = context.createLinearGradient(
    renderRect.x,
    renderRect.y,
    renderRect.x,
    renderRect.y + renderRect.height,
  );
  gradient.addColorStop(0, palette.start);
  gradient.addColorStop(1, palette.end);

  context.save();
  context.fillStyle = gradient;
  context.strokeStyle = 'rgba(255,255,255,0.92)';
  context.lineWidth = 1.2;
  context.shadowColor = 'rgba(147, 114, 163, 0.18)';
  context.shadowBlur = 10;
  context.shadowOffsetY = 4;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();

  context.strokeStyle = palette.outline;
  context.fillStyle = palette.outline;
  context.lineWidth = 1.8;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (icon === 'gear') {
    context.beginPath();
    context.arc(centerX, centerY, 4.2, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const inner = 6.3;
      const outer = 8.4;
      context.beginPath();
      context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
      context.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
      context.stroke();
    }
    context.beginPath();
    context.arc(centerX, centerY, 1.4, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(centerX - 5.5, centerY - 6);
    context.lineTo(centerX - 3.8, centerY + 1.5);
    context.lineTo(centerX + 3.8, centerY + 1.5);
    context.lineTo(centerX + 5.5, centerY - 6);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(centerX - 3, centerY + 1.5);
    context.lineTo(centerX - 2.2, centerY + 5.4);
    context.moveTo(centerX + 3, centerY + 1.5);
    context.lineTo(centerX + 2.2, centerY + 5.4);
    context.moveTo(centerX - 4.2, centerY + 6.6);
    context.lineTo(centerX + 4.2, centerY + 6.6);
    context.stroke();
  }

  context.restore();
}

function drawGameTopIconBar(
  context: CanvasRenderingContext2D,
  metrics: ScreenMetrics,
  buttons: TopIconButtonSpec[],
  pressedId: string | null,
): void {
  const barRect = {
    x: 16,
    y: Math.max(0, metrics.safeTop - 14),
    width: 68,
    height: 26,
  };

  context.save();
  const barGradient = context.createLinearGradient(barRect.x, barRect.y, barRect.x, barRect.y + barRect.height);
  barGradient.addColorStop(0, 'rgba(255,255,255,0.98)');
  barGradient.addColorStop(1, 'rgba(248,244,255,0.92)');
  context.fillStyle = barGradient;
  context.strokeStyle = 'rgba(255,255,255,0.98)';
  context.lineWidth = 1;
  context.shadowColor = 'rgba(144, 118, 153, 0.14)';
  context.shadowBlur = 10;
  context.shadowOffsetY = 3;
  roundRect(context, barRect, 13);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();

  context.strokeStyle = 'rgba(238, 230, 241, 0.82)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(barRect.x + barRect.width / 2, barRect.y + 5);
  context.lineTo(barRect.x + barRect.width / 2, barRect.y + barRect.height - 5);
  context.stroke();

  buttons.forEach((button) => {
    const pressed = pressedId === `icon:${button.id}`;
    if (button.id === 'settings') {
      drawRoundTopIcon(
        context,
        button.rect,
        {
          start: '#fff0ba',
          end: '#ffc96a',
          outline: '#de9229',
        },
        'gear',
        pressed,
      );
    } else {
      drawRoundTopIcon(
        context,
        button.rect,
        {
          start: '#fff4c7',
          end: '#ffd987',
          outline: '#cc9a32',
        },
        'trophy',
        pressed,
      );
    }
  });

  context.restore();
}

function getToolbarButtonStyle(
  button: ButtonSpec,
): {
  fillStart: string;
  fillEnd: string;
  textColor: string;
  iconColor: string;
  stroke: string;
} {
  if (!button.enabled) {
    return {
      fillStart: 'rgba(255, 255, 255, 0.78)',
      fillEnd: 'rgba(245, 238, 243, 0.68)',
      textColor: THEME.disabledText,
      iconColor: THEME.disabledText,
      stroke: THEME.borderSoft,
    };
  }

  switch (button.id) {
    case 'levels':
      return {
        fillStart: '#ffe3bd',
        fillEnd: '#ffd18a',
        textColor: '#8d5c2f',
        iconColor: '#e08d31',
        stroke: 'rgba(255,255,255,0.9)',
      };
    case 'undo':
      return {
        fillStart: '#7dc6ff',
        fillEnd: '#539cf4',
        textColor: '#ffffff',
        iconColor: '#ffffff',
        stroke: 'rgba(255,255,255,0.92)',
      };
    case 'restart':
      return {
        fillStart: '#ffb04c',
        fillEnd: '#ff7f19',
        textColor: '#ffffff',
        iconColor: '#ffffff',
        stroke: 'rgba(255,255,255,0.92)',
      };
    case 'hint':
      return {
        fillStart: '#ffc8e5',
        fillEnd: '#f5a7d0',
        textColor: '#ffffff',
        iconColor: '#ffffff',
        stroke: 'rgba(255,255,255,0.92)',
      };
    case 'next':
      return {
        fillStart: '#bdeea7',
        fillEnd: '#7ed466',
        textColor: '#ffffff',
        iconColor: '#ffffff',
        stroke: 'rgba(255,255,255,0.92)',
      };
  }
}

function drawToolbarIcon(
  context: CanvasRenderingContext2D,
  button: ButtonSpec,
  color?: string,
): void {
  const centerX = button.rect.x + button.rect.width / 2;
  const centerY = button.rect.y + 15;
  const iconColor = color ?? (button.enabled ? THEME.accent : THEME.disabledText);

  context.save();
  context.strokeStyle = iconColor;
  context.fillStyle = iconColor;
  context.lineWidth = 1.8;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  switch (button.id) {
    case 'levels': {
      const size = 5;
      const gap = 3;
      const startX = centerX - size - gap / 2;
      const startY = centerY - size - gap / 2;
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          context.strokeRect(
            startX + col * (size + gap),
            startY + row * (size + gap),
            size,
            size,
          );
        }
      }
      break;
    }
    case 'undo': {
      context.beginPath();
      context.moveTo(centerX + 7, centerY - 4);
      context.quadraticCurveTo(centerX - 2, centerY - 9, centerX - 7, centerY - 1);
      context.stroke();
      context.beginPath();
      context.moveTo(centerX - 7, centerY - 1);
      context.lineTo(centerX - 2, centerY - 5);
      context.moveTo(centerX - 7, centerY - 1);
      context.lineTo(centerX - 1, centerY + 2);
      context.stroke();
      break;
    }
    case 'restart': {
      context.beginPath();
      context.arc(centerX, centerY, 7, Math.PI * 0.15, Math.PI * 1.7);
      context.stroke();
      context.beginPath();
      context.moveTo(centerX + 5, centerY - 8);
      context.lineTo(centerX + 9, centerY - 8);
      context.lineTo(centerX + 9, centerY - 4);
      context.stroke();
      break;
    }
    case 'hint': {
      context.beginPath();
      context.arc(centerX, centerY - 2, 5.5, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(centerX - 3, centerY + 5);
      context.lineTo(centerX + 3, centerY + 5);
      context.moveTo(centerX - 2, centerY + 8);
      context.lineTo(centerX + 2, centerY + 8);
      context.stroke();
      break;
    }
    case 'next': {
      context.beginPath();
      context.moveTo(centerX - 6, centerY - 6);
      context.lineTo(centerX, centerY);
      context.lineTo(centerX - 6, centerY + 6);
      context.moveTo(centerX, centerY - 6);
      context.lineTo(centerX + 6, centerY);
      context.lineTo(centerX, centerY + 6);
      context.stroke();
      break;
    }
  }

  context.restore();
}

function measureWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [''];
  }

  const lines: string[] = [];
  let current = '';
  for (const char of normalized) {
    const next = `${current}${char}`;
    if (current && context.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  rect: Rect,
  options: {
    font: string;
    color: string;
    lineHeight: number;
    maxLines: number;
  },
): void {
  context.save();
  context.font = options.font;
  context.fillStyle = options.color;
  context.textAlign = 'left';
  context.textBaseline = 'top';

  const lines = measureWrappedText(context, text, rect.width).slice(0, options.maxLines);
  lines.forEach((line, index) => {
    context.fillText(line, rect.x, rect.y + index * options.lineHeight);
  });

  context.restore();
}

function getRecordSummary(locale: Locale, record: LevelRecord | null): string {
  if (!record) {
    return t(locale, 'record.noneSummary');
  }

  return t(locale, 'record.summary', {
    duration: formatDuration(record.durationMs),
  });
}

function getRecordDetail(
  locale: Locale,
  record: LevelRecord | null,
  mode: GameSnapshot['mode'],
): string {
  if (!record) {
    return t(locale, 'record.noneDetail');
  }

  return t(locale, mode === 'record' ? 'record.detailViewing' : 'record.detailSaved', {
    count: record.placements.length,
    completedAt: formatCompletedAt(locale, record.completedAt),
  });
}

async function bootstrapWechatGame(): Promise<void> {
  const locale = resolveLocale();
  const canvas = resolveWechatCanvas();
  const landingAssets: LandingAssets = {
    background: null,
    newGameButton: null,
    leaderboardButton: null,
    checkIcon: null,
    helpIcon: null,
  };
  const metrics = getWindowMetrics();
  const layout = computeLayout(metrics);
  const storageAdapter = new WechatStorageAdapter();
  const storage = new BrowserGameStorage(storageAdapter);
  let userSettings = loadUserSettings(storageAdapter);
  const loadedGameState = storage.load(levels);
  let campaignState = storage.loadCampaignState();
  let weeklyLeaderboard = storage.loadWeeklyLeaderboard();
  const game = new GameController(levels, {
    initialRecords: loadedGameState.records,
    initialProgress: loadedGameState.progress,
    onRecordsChange: (records) => {
      storage.saveRecords(records);
    },
    onProgressChange: (progress) => {
      storage.saveProgress(progress);
    },
  });

  const surface = new WechatCanvasSurface({
    canvas,
    width: metrics.width,
    height: metrics.height,
    dpr: metrics.dpr,
  });
  const renderer = new CanvasRenderer(surface);
  const audio = new FeedbackAudio();
  audio.setEnabled(userSettings.soundEnabled);
  const inputSource = new WechatPointerInputSource();
  const uiState = {
    levelPanelOpen: false,
    homeOpen: true,
    leaderboardOpen: false,
    helpOpen: false,
    goalOpen: false,
    settingsOpen: false,
    pressedUiId: null as string | null,
  };
  new PointerController(inputSource, surface, renderer, game, {
    shouldIgnoreInput: () =>
      uiState.levelPanelOpen ||
      uiState.homeOpen ||
      uiState.leaderboardOpen ||
      uiState.helpOpen ||
      uiState.goalOpen ||
      uiState.settingsOpen,
  });

  let currentSnapshot = game.getSnapshot();
  let animationFrameId = 0;
  let buttons: ButtonSpec[] = [];
  let homeButtons: HomeButtonSpec[] = [];
  let topIconButtons: TopIconButtonSpec[] = [];
  let gameTopButtons: TopIconButtonSpec[] = [];
  let levelTiles: TileSpec[] = [];
  let leaderboardPanelRect: Rect | null = null;
  let infoDialogPanelRect: Rect | null = null;
  let infoDialogButtonRect: Rect | null = null;
  let settingsDialogPanelRect: Rect | null = null;
  let settingsBackButtonRect: Rect | null = null;
  let settingsContinueButtonRect: Rect | null = null;
  let soundToggleRect: Rect | null = null;
  let vibrationToggleRect: Rect | null = null;
  let lastPlacementEffectId = 0;
  let lastInvalidEffectId = 0;
  let lastCelebrationEffectId = 0;
  let autoAdvanceTimeoutId = 0;
  let lastAutoAdvanceCelebrationId = 0;
  let autoAdvanceBannerUntil = 0;
  let lastCampaignCompletionCelebrationId = 0;

  const [backgroundImage, newGameButtonImage, leaderboardButtonImage, checkIconImage, helpIconImage] = await Promise.all([
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.background),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.newGameButton),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardButton),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.checkIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.helpIcon),
  ]);

  landingAssets.background = backgroundImage;
  landingAssets.newGameButton = newGameButtonImage;
  landingAssets.leaderboardButton = leaderboardButtonImage;
  landingAssets.checkIcon = checkIconImage;
  landingAssets.helpIcon = helpIconImage;

  function drawHeader(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    const textStartX = layout.headerRect.x + 104;
    drawHudShell(context, layout.headerRect);
    gameTopButtons = [
      {
        id: 'settings',
        rect: {
          x: 22,
          y: Math.max(1, metrics.safeTop - 11),
          width: 18,
          height: 18,
        },
      },
      {
        id: 'leaderboardTop',
        rect: {
          x: 46,
          y: Math.max(1, metrics.safeTop - 11),
          width: 18,
          height: 18,
        },
      },
    ];
    drawGameTopIconBar(context, metrics, gameTopButtons, uiState.pressedUiId);

    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = THEME.accent;
    context.font = '600 10px sans-serif';
    context.fillText(t(locale, 'app.eyebrow'), textStartX, layout.headerRect.y + 7);

    context.fillStyle = THEME.textPrimary;
    context.font = '700 19px sans-serif';
    context.fillText(t(locale, 'app.title'), textStartX, layout.headerRect.y + 16);

    context.fillStyle = THEME.textSecondary;
    context.font = '600 10px sans-serif';
    context.fillText(
      t(locale, 'level.progress', {
        current: snapshot.levelIndex + 1,
        total: levels.length,
      }),
      textStartX,
      layout.headerRect.y + 34,
    );
    context.fillText(
      t(locale, 'board.meta', {
        width: snapshot.level.width,
        height: snapshot.level.height,
        clues: snapshot.level.clues.length,
      }),
      textStartX + 74,
      layout.headerRect.y + 34,
    );

    context.fillStyle = THEME.textPrimary;
    context.font = '700 11px sans-serif';
    context.fillText(
      formatLevelName(locale, snapshot.level.number, snapshot.level.titleKey),
      textStartX,
      layout.headerRect.y + 46,
    );
    context.restore();

    context.save();
    const chipGradient = context.createLinearGradient(
      layout.chipRect.x,
      layout.chipRect.y,
      layout.chipRect.x,
      layout.chipRect.y + layout.chipRect.height,
    );
    const chipStart =
      snapshot.mode === 'record'
        ? '#dff5ff'
        : snapshot.solved
          ? '#e4ffd7'
          : snapshot.preview?.validation.ok
            ? '#fff2bb'
            : 'rgba(255,255,255,0.82)';
    const chipEnd =
      snapshot.mode === 'record'
        ? '#c8edff'
        : snapshot.solved
          ? '#c6ffb7'
          : snapshot.preview?.validation.ok
            ? '#ffd96a'
            : 'rgba(255,255,255,0.62)';
    chipGradient.addColorStop(0, chipStart);
    chipGradient.addColorStop(1, chipEnd);
    context.fillStyle = chipGradient;
    context.strokeStyle = THEME.border;
    roundRect(context, layout.chipRect, 13);
    context.fill();
    context.stroke();
    context.fillStyle =
      snapshot.mode === 'record'
        ? THEME.info
        : snapshot.solved
          ? THEME.success
          : THEME.accent;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 12px sans-serif';
    context.fillText(
      snapshot.mode === 'record'
        ? t(locale, 'chip.record')
        : snapshot.solved
          ? t(locale, 'chip.solved')
          : snapshot.preview?.validation.ok
            ? t(locale, 'chip.ready')
            : t(locale, 'chip.active'),
      layout.chipRect.x + layout.chipRect.width / 2,
      layout.chipRect.y + layout.chipRect.height / 2 + 0.5,
    );
    context.restore();
  }

  function drawInfoCards(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    const hintText = snapshot.hintMessage ? tm(locale, snapshot.hintMessage) : t(locale, 'button.hint');
    const covered = getCoveredCellCount(snapshot.level, snapshot.placements);
    const total = snapshot.level.width * snapshot.level.height;
    const progressPrimary = t(
      locale,
      snapshot.mode === 'record' ? 'coverage.record' : 'coverage.play',
      { covered, total },
    );
    const recordSummary = snapshot.currentRecord
      ? formatDuration(snapshot.currentRecord.durationMs)
      : '--';
    const statusSummary = snapshot.mode === 'record' ? t(locale, 'chip.record') : tm(locale, snapshot.status);

    drawHudShell(context, layout.hintRect);
    drawHudShell(context, layout.recordRect);
    drawHudShell(context, layout.progressRect);

    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'top';

    context.fillStyle = THEME.accent;
    context.font = '700 10px sans-serif';
    context.fillText(t(locale, 'section.hints'), layout.hintRect.x + 12, layout.hintRect.y + 8);
    context.fillText(t(locale, 'section.record'), layout.recordRect.x + 12, layout.recordRect.y + 8);
    context.fillText(t(locale, 'section.progress'), layout.progressRect.x + 12, layout.progressRect.y + 8);

    context.fillStyle = THEME.textPrimary;
    context.font = '700 12px sans-serif';
    context.fillText(recordSummary, layout.recordRect.x + 12, layout.recordRect.y + 22);
    context.fillText(progressPrimary, layout.progressRect.x + 12, layout.progressRect.y + 22);

    context.fillStyle = THEME.textSecondary;
    context.font = '11px sans-serif';
    drawWrappedText(
      context,
      hintText,
      {
        x: layout.hintRect.x + 12,
        y: layout.hintRect.y + 22,
        width: layout.hintRect.width - 24,
        height: layout.hintRect.height - 36,
      },
      {
        font: '11px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 14,
        maxLines: 2,
      },
    );
    drawWrappedText(
      context,
      snapshot.currentRecord
        ? getRecordDetail(locale, snapshot.currentRecord, snapshot.mode)
        : getRecordSummary(locale, snapshot.currentRecord),
      {
        x: layout.recordRect.x + 12,
        y: layout.recordRect.y + 34,
        width: layout.recordRect.width - 24,
        height: layout.recordRect.height - 46,
      },
      {
        font: '10px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 12,
        maxLines: 1,
      },
    );
    drawWrappedText(
      context,
      statusSummary,
      {
        x: layout.progressRect.x + 12,
        y: layout.progressRect.y + 34,
        width: layout.progressRect.width - 24,
        height: layout.progressRect.height - 46,
      },
      {
        font: '10px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 12,
        maxLines: 1,
      },
    );
    context.restore();

    drawCardShell(context, layout.rulesRect);
    const ruleInnerRect = {
      x: layout.rulesRect.x + 10,
      y: layout.rulesRect.y + 8,
      width: layout.rulesRect.width - 20,
      height: layout.rulesRect.height - 18,
    };
    drawTextFrame(context, ruleInnerRect, { radius: 10 });

    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = THEME.accent;
    context.font = '700 10px sans-serif';
    context.fillText(t(locale, 'section.rules'), ruleInnerRect.x + 10, ruleInnerRect.y + 7);
    context.restore();

    drawWrappedText(
      context,
      `${t(locale, 'rule.area')}  ·  ${t(locale, 'rule.singleClue')}  ·  ${t(locale, 'rule.cover')}`,
      {
        x: ruleInnerRect.x + 10,
        y: ruleInnerRect.y + 24,
        width: ruleInnerRect.width - 20,
        height: ruleInnerRect.height - 34,
      },
      {
        font: '10px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 12,
        maxLines: 2,
      },
    );
  }

  function drawButtons(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    const gap = 8;
    const buttonHeight = layout.actionsRect.height;
    const levelButtonWidth = 72;
    const actionWidth = Math.floor((layout.actionsRect.width - levelButtonWidth - gap * 4) / 4);

    buttons = [
      {
        id: 'levels',
        label: t(locale, 'section.levels'),
        rect: {
          x: layout.actionsRect.x,
          y: layout.actionsRect.y,
          width: levelButtonWidth,
          height: buttonHeight,
        },
        enabled: true,
      },
      {
        id: 'undo',
        label: t(locale, 'button.undo'),
        rect: {
          x: layout.actionsRect.x + levelButtonWidth + gap,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight,
        },
        enabled: snapshot.canUndo && snapshot.mode !== 'record',
      },
      {
        id: 'restart',
        label: t(locale, snapshot.mode === 'record' ? 'button.retry' : 'button.restart'),
        rect: {
          x: layout.actionsRect.x + levelButtonWidth + gap * 2 + actionWidth,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight,
        },
        enabled: true,
      },
      {
        id: 'hint',
        label: t(locale, 'button.hint'),
        rect: {
          x: layout.actionsRect.x + levelButtonWidth + gap * 3 + actionWidth * 2,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight,
        },
        enabled: !snapshot.solved && snapshot.mode !== 'record',
      },
      {
        id: 'next',
        label: t(locale, 'button.next'),
        rect: {
          x: layout.actionsRect.x + levelButtonWidth + gap * 4 + actionWidth * 3,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight,
        },
        enabled: snapshot.hasNextLevel,
      },
    ];

    context.save();
    drawToolbarShell(context, {
      x: layout.actionsRect.x - 2,
      y: layout.actionsRect.y - 4,
      width: layout.actionsRect.width + 4,
      height: layout.actionsRect.height + 8,
    });
    for (const button of buttons) {
      const isPressed = uiState.pressedUiId === `toolbar:${button.id}`;
      const buttonY = isPressed ? button.rect.y + 1.5 : button.rect.y;
      const buttonRect = { ...button.rect, y: buttonY };
      const style = getToolbarButtonStyle(button);
      const gradient = context.createLinearGradient(
        buttonRect.x,
        buttonRect.y,
        buttonRect.x,
        buttonRect.y + buttonRect.height,
      );
      gradient.addColorStop(0, style.fillStart);
      gradient.addColorStop(1, style.fillEnd);
      context.fillStyle = gradient;
      context.strokeStyle = style.stroke;
      context.lineWidth = 1.2;
      context.shadowColor = 'rgba(255,255,255,0.28)';
      context.shadowBlur = 0;
      roundRect(context, buttonRect, 14);
      context.fill();
      context.stroke();

      drawToolbarIcon(context, { ...button, rect: buttonRect }, style.iconColor);

      context.fillStyle = style.textColor;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '600 10px sans-serif';
      context.fillText(
        button.label,
        buttonRect.x + buttonRect.width / 2,
        buttonRect.y + buttonRect.height - 12,
      );
    }
    context.restore();
  }

  function drawFallbackLandingButton(
    context: CanvasRenderingContext2D,
    rect: Rect,
    label: string,
    palette: 'orange' | 'purple',
  ): void {
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    if (palette === 'orange') {
      gradient.addColorStop(0, '#ffd85f');
      gradient.addColorStop(1, '#ff9f20');
    } else {
      gradient.addColorStop(0, '#dab7ff');
      gradient.addColorStop(1, '#a96df0');
    }

    context.save();
    context.fillStyle = gradient;
    context.strokeStyle = 'rgba(255,255,255,0.92)';
    context.lineWidth = 2;
    context.shadowColor = 'rgba(255, 220, 140, 0.42)';
    context.shadowBlur = 28;
    roundRect(context, rect, 24);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 26px sans-serif';
    context.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 2);
    context.restore();
  }

  function drawLandingScreen(): void {
    const context = surface.getContext2D();
    const buttonSize = Math.min(metrics.width * 0.72, 280);
    const firstButtonTop = metrics.height * 0.58;
    const secondButtonTop = firstButtonTop + buttonSize * 0.52;
    const iconBarY = metrics.safeTop + 6;
    const iconBarX = 16;
    const iconBarWidth = 148;
    const iconBarHeight = 62;
    const iconSize = 48;
    const leftCenterX = iconBarX + iconBarWidth * 0.25;
    const rightCenterX = iconBarX + iconBarWidth * 0.75;
    const iconTop = iconBarY + (iconBarHeight - iconSize) / 2;

    homeButtons = [
      {
        id: 'newGame',
        rect: {
          x: (metrics.width - buttonSize) / 2,
          y: firstButtonTop,
          width: buttonSize,
          height: buttonSize,
        },
      },
      {
        id: 'leaderboard',
        rect: {
          x: (metrics.width - buttonSize) / 2,
          y: secondButtonTop,
          width: buttonSize,
          height: buttonSize,
        },
      },
    ];
    topIconButtons = [
      {
        id: 'goal',
        rect: {
          x: leftCenterX - iconSize / 2,
          y: iconTop,
          width: iconSize,
          height: iconSize,
        },
      },
      {
        id: 'help',
        rect: {
          x: rightCenterX - iconSize / 2,
          y: iconTop,
          width: iconSize,
          height: iconSize,
        },
      },
    ];

    context.save();
    context.clearRect(0, 0, metrics.width, metrics.height);
    if (landingAssets.background) {
      drawImageCover(context, landingAssets.background, {
        x: 0,
        y: 0,
        width: metrics.width,
        height: metrics.height,
      });
    } else {
      const gradient = context.createLinearGradient(0, 0, 0, metrics.height);
      gradient.addColorStop(0, THEME.backgroundStart);
      gradient.addColorStop(0.5, THEME.backgroundMid);
      gradient.addColorStop(1, THEME.backgroundEnd);
      context.fillStyle = gradient;
      context.fillRect(0, 0, metrics.width, metrics.height);
    }

    const newGameRect = homeButtons[0].rect;
    const leaderboardRect = homeButtons[1].rect;
    const newGamePressed = uiState.pressedUiId === 'home:newGame';
    const leaderboardPressed = uiState.pressedUiId === 'home:leaderboard';
    const newGameRenderRect = {
      ...newGameRect,
      y: newGameRect.y + (newGamePressed ? 3 : 0),
    };
    const leaderboardRenderRect = {
      ...leaderboardRect,
      y: leaderboardRect.y + (leaderboardPressed ? 3 : 0),
    };

    if (landingAssets.newGameButton) {
      drawImageFit(context, landingAssets.newGameButton, newGameRenderRect);
    } else {
      drawFallbackLandingButton(context, newGameRenderRect, t(locale, 'home.start'), 'orange');
    }

    if (landingAssets.leaderboardButton) {
      drawImageFit(context, landingAssets.leaderboardButton, leaderboardRenderRect);
    } else {
      drawFallbackLandingButton(
        context,
        leaderboardRenderRect,
        t(locale, 'landing.weeklyLeaderboard'),
        'purple',
      );
    }

    drawLandingTopIconBar(context, metrics, landingAssets, topIconButtons, uiState.pressedUiId);

    context.restore();
  }

  function drawInfoDialog(mode: 'help' | 'goal'): void {
    const context = surface.getContext2D();
    const panelWidth = Math.min(metrics.width - 40, 336);
    const panelHeight = mode === 'help' ? 490 : 398;
    const panelRect = {
      x: (metrics.width - panelWidth) / 2,
      y: Math.max(metrics.safeTop + 54, (metrics.height - panelHeight) / 2),
      width: panelWidth,
      height: panelHeight,
    };
    const actionRect = {
      x: panelRect.x + 84,
      y: panelRect.y + panelRect.height - 58,
      width: panelRect.width - 168,
      height: 42,
    };
    infoDialogPanelRect = panelRect;
    infoDialogButtonRect = actionRect;

    context.save();
    context.fillStyle = 'rgba(83, 62, 95, 0.22)';
    context.fillRect(0, 0, metrics.width, metrics.height);

    const panelGradient = context.createLinearGradient(
      panelRect.x,
      panelRect.y,
      panelRect.x,
      panelRect.y + panelRect.height,
    );
    panelGradient.addColorStop(0, 'rgba(255,255,255,0.98)');
    panelGradient.addColorStop(1, 'rgba(252,247,255,0.96)');
    context.fillStyle = panelGradient;
    context.strokeStyle = 'rgba(255,255,255,0.96)';
    context.lineWidth = 1.2;
    context.shadowColor = 'rgba(123, 97, 147, 0.22)';
    context.shadowBlur = 24;
    context.shadowOffsetY = 10;
    roundRect(context, panelRect, 22);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();

    const titleChipRect = {
      x: panelRect.x + 68,
      y: panelRect.y + 18,
      width: panelRect.width - 136,
      height: 38,
    };
    const titleChipGradient = context.createLinearGradient(
      titleChipRect.x,
      titleChipRect.y,
      titleChipRect.x,
      titleChipRect.y + titleChipRect.height,
    );
    titleChipGradient.addColorStop(0, '#fff4fa');
    titleChipGradient.addColorStop(1, '#ffe3ef');
    context.fillStyle = titleChipGradient;
    context.strokeStyle = 'rgba(255,255,255,0.95)';
    context.lineWidth = 1;
    roundRect(context, titleChipRect, 18);
    context.fill();
    context.stroke();

    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#ff8e9c';
    context.font = '700 24px sans-serif';
    context.fillText(
      mode === 'help' ? t(locale, 'landing.helpTitle') : t(locale, 'landing.goalTitle'),
      panelRect.x + panelRect.width / 2,
      panelRect.y + 24,
    );

    context.textAlign = 'left';
    context.fillStyle = '#4f63c6';
    context.font = '700 18px sans-serif';
    context.fillText(
      mode === 'help' ? t(locale, 'landing.ruleSection') : t(locale, 'landing.goalSection'),
      panelRect.x + 20,
      panelRect.y + 74,
    );

    const bodyLines =
      mode === 'help'
        ? [
            t(locale, 'landing.helpRule1'),
            t(locale, 'landing.helpRule2'),
            t(locale, 'landing.helpRule3'),
            t(locale, 'landing.helpRule4'),
          ]
        : [
            t(locale, 'landing.goalRule1'),
            t(locale, 'landing.goalRule2'),
            t(locale, 'landing.goalRule3'),
          ];

    const ruleCardRect = {
      x: panelRect.x + 18,
      y: panelRect.y + 104,
      width: panelRect.width - 36,
      height: mode === 'help' ? 152 : 132,
    };
    drawTextFrame(context, ruleCardRect, {
      radius: 16,
      fill: 'rgba(255,255,255,0.72)',
      stroke: 'rgba(236, 226, 246, 0.95)',
    });

    context.fillStyle = THEME.textPrimary;
    context.font = '13px sans-serif';
    bodyLines.forEach((line, index) => {
      const rowY = ruleCardRect.y + 16 + index * 34;
      context.fillStyle = '#7b8cff';
      context.font = '700 13px sans-serif';
      context.fillText(`${index + 1}.`, ruleCardRect.x + 14, rowY);
      drawWrappedText(
        context,
        line,
        {
          x: ruleCardRect.x + 34,
          y: rowY,
          width: ruleCardRect.width - 50,
          height: 28,
        },
        {
          font: '13px sans-serif',
          color: THEME.textPrimary,
          lineHeight: 17,
          maxLines: 2,
        },
      );
    });

    const toolsTop = ruleCardRect.y + ruleCardRect.height + 18;
    if (mode === 'help') {
      context.fillStyle = '#4f63c6';
      context.font = '700 18px sans-serif';
      context.fillText(t(locale, 'landing.toolSection'), panelRect.x + 20, toolsTop);

      const toolCardRect = {
        x: panelRect.x + 18,
        y: toolsTop + 26,
        width: panelRect.width - 36,
        height: 102,
      };
      drawTextFrame(context, toolCardRect, {
        radius: 16,
        fill: 'rgba(255,255,255,0.72)',
        stroke: 'rgba(236, 226, 246, 0.95)',
      });

      const toolRows = [
        { colorStart: '#7cc8ff', colorEnd: '#4ba4ea', text: t(locale, 'landing.toolHint') },
        { colorStart: '#ffc878', colorEnd: '#ff9e34', text: t(locale, 'landing.toolUndo') },
        { colorStart: '#ffb2d4', colorEnd: '#ef7bb0', text: t(locale, 'landing.toolRestart') },
      ];

      toolRows.forEach((tool, index) => {
        const iconRect = {
          x: toolCardRect.x + 14,
          y: toolCardRect.y + 14 + index * 28,
          width: 20,
          height: 20,
        };
        const iconGradient = context.createLinearGradient(
          iconRect.x,
          iconRect.y,
          iconRect.x,
          iconRect.y + iconRect.height,
        );
        iconGradient.addColorStop(0, tool.colorStart);
        iconGradient.addColorStop(1, tool.colorEnd);
        context.fillStyle = iconGradient;
        roundRect(context, iconRect, 6);
        context.fill();
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = '700 13px sans-serif';
        context.fillText(index === 0 ? '?' : index === 1 ? '↶' : '↺', iconRect.x + 10, iconRect.y + 10.5);
        context.textAlign = 'left';
        context.textBaseline = 'top';
        drawWrappedText(
          context,
          tool.text,
          {
            x: iconRect.x + 30,
            y: iconRect.y + 1,
            width: toolCardRect.width - 50,
            height: 24,
          },
          {
            font: '12px sans-serif',
            color: THEME.textPrimary,
            lineHeight: 16,
            maxLines: 1,
          },
        );
      });
    }

    const buttonGradient = context.createLinearGradient(
      actionRect.x,
      actionRect.y,
      actionRect.x,
      actionRect.y + actionRect.height,
    );
    buttonGradient.addColorStop(0, '#57b9ff');
    buttonGradient.addColorStop(1, '#2c89f3');
    context.fillStyle = buttonGradient;
    context.strokeStyle = 'rgba(255,255,255,0.92)';
    context.lineWidth = 1.2;
    roundRect(context, actionRect, 14);
    context.fill();
    context.stroke();

    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 16px sans-serif';
    context.fillText(t(locale, 'landing.gotIt'), actionRect.x + actionRect.width / 2, actionRect.y + actionRect.height / 2 + 1);
    context.restore();
  }

  function drawSettingsDialog(): void {
    const context = surface.getContext2D();
    const panelRect = {
      x: (metrics.width - 248) / 2,
      y: Math.max(metrics.safeTop + 54, (metrics.height - 244) / 2),
      width: 248,
      height: 244,
    };
    settingsDialogPanelRect = panelRect;
    soundToggleRect = {
      x: panelRect.x + panelRect.width - 62,
      y: panelRect.y + 70,
      width: 40,
      height: 22,
    };
    vibrationToggleRect = {
      x: panelRect.x + panelRect.width - 62,
      y: panelRect.y + 112,
      width: 40,
      height: 22,
    };
    settingsBackButtonRect = {
      x: panelRect.x + 22,
      y: panelRect.y + panelRect.height - 52,
      width: 92,
      height: 34,
    };
    settingsContinueButtonRect = {
      x: panelRect.x + panelRect.width - 114,
      y: panelRect.y + panelRect.height - 52,
      width: 92,
      height: 34,
    };

    const drawToggleRow = (
      y: number,
      iconColorStart: string,
      iconColorEnd: string,
      label: string,
      enabled: boolean,
      toggleRect: Rect,
      glyph: string,
    ): void => {
      const iconRect = {
        x: panelRect.x + 24,
        y,
        width: 22,
        height: 22,
      };
      const iconGradient = context.createLinearGradient(
        iconRect.x,
        iconRect.y,
        iconRect.x,
        iconRect.y + iconRect.height,
      );
      iconGradient.addColorStop(0, iconColorStart);
      iconGradient.addColorStop(1, iconColorEnd);
      context.fillStyle = iconGradient;
      roundRect(context, iconRect, 7);
      context.fill();
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '700 13px sans-serif';
      context.fillText(glyph, iconRect.x + 11, iconRect.y + 11.5);

      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.fillStyle = THEME.textPrimary;
      context.font = '700 15px sans-serif';
      context.fillText(label, iconRect.x + 32, iconRect.y + 11);

      const toggleGradient = context.createLinearGradient(
        toggleRect.x,
        toggleRect.y,
        toggleRect.x,
        toggleRect.y + toggleRect.height,
      );
      if (enabled) {
        toggleGradient.addColorStop(0, '#6dd66c');
        toggleGradient.addColorStop(1, '#3eaf47');
      } else {
        toggleGradient.addColorStop(0, '#e9e3ea');
        toggleGradient.addColorStop(1, '#cfc3d1');
      }
      context.fillStyle = toggleGradient;
      context.strokeStyle = 'rgba(255,255,255,0.92)';
      context.lineWidth = 1;
      roundRect(context, toggleRect, toggleRect.height / 2);
      context.fill();
      context.stroke();

      const knobX = enabled
        ? toggleRect.x + toggleRect.width - 11
        : toggleRect.x + 11;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(knobX, toggleRect.y + toggleRect.height / 2, 8.5, 0, Math.PI * 2);
      context.fill();
    };

    context.save();
    context.fillStyle = 'rgba(77, 60, 89, 0.22)';
    context.fillRect(0, 0, metrics.width, metrics.height);

    const panelGradient = context.createLinearGradient(
      panelRect.x,
      panelRect.y,
      panelRect.x,
      panelRect.y + panelRect.height,
    );
    panelGradient.addColorStop(0, 'rgba(255,255,255,0.98)');
    panelGradient.addColorStop(1, 'rgba(248,244,255,0.95)');
    context.fillStyle = panelGradient;
    context.strokeStyle = 'rgba(255,255,255,0.96)';
    context.lineWidth = 1.2;
    context.shadowColor = 'rgba(123, 97, 147, 0.2)';
    context.shadowBlur = 24;
    context.shadowOffsetY = 10;
    roundRect(context, panelRect, 22);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();

    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#4f63c6';
    context.font = '700 22px sans-serif';
    context.fillText(t(locale, 'settings.title'), panelRect.x + panelRect.width / 2, panelRect.y + 20);

    drawToggleRow(
      panelRect.y + 66,
      '#82db78',
      '#46b957',
      t(locale, 'settings.sound'),
      userSettings.soundEnabled,
      soundToggleRect,
      '♪',
    );
    drawToggleRow(
      panelRect.y + 108,
      '#c57fff',
      '#9b5ce5',
      t(locale, 'settings.vibration'),
      userSettings.vibrationEnabled,
      vibrationToggleRect,
      '≈',
    );

    const backGradient = context.createLinearGradient(
      settingsBackButtonRect.x,
      settingsBackButtonRect.y,
      settingsBackButtonRect.x,
      settingsBackButtonRect.y + settingsBackButtonRect.height,
    );
    backGradient.addColorStop(0, '#f7f7f7');
    backGradient.addColorStop(1, '#dddddd');
    context.fillStyle = backGradient;
    context.strokeStyle = 'rgba(255,255,255,0.95)';
    roundRect(context, settingsBackButtonRect, 12);
    context.fill();
    context.stroke();
    context.fillStyle = '#7c727f';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 14px sans-serif';
    context.fillText(
      t(locale, 'settings.backHome'),
      settingsBackButtonRect.x + settingsBackButtonRect.width / 2,
      settingsBackButtonRect.y + settingsBackButtonRect.height / 2 + 1,
    );

    const continueGradient = context.createLinearGradient(
      settingsContinueButtonRect.x,
      settingsContinueButtonRect.y,
      settingsContinueButtonRect.x,
      settingsContinueButtonRect.y + settingsContinueButtonRect.height,
    );
    continueGradient.addColorStop(0, '#58bcff');
    continueGradient.addColorStop(1, '#2d89f4');
    context.fillStyle = continueGradient;
    context.strokeStyle = 'rgba(255,255,255,0.95)';
    roundRect(context, settingsContinueButtonRect, 12);
    context.fill();
    context.stroke();
    context.fillStyle = '#ffffff';
    context.fillText(
      t(locale, 'settings.continue'),
      settingsContinueButtonRect.x + settingsContinueButtonRect.width / 2,
      settingsContinueButtonRect.y + settingsContinueButtonRect.height / 2 + 1,
    );

    context.restore();
  }

  function drawLeaderboardPanel(): void {
    const context = surface.getContext2D();
    const panelWidth = Math.min(metrics.width - 30, 340);
    const panelHeight = Math.min(metrics.height - 110, 446);
    const panelRect = {
      x: (metrics.width - panelWidth) / 2,
      y: Math.max(metrics.safeTop + 36, (metrics.height - panelHeight) / 2),
      width: panelWidth,
      height: panelHeight,
    };
    leaderboardPanelRect = panelRect;

    context.save();
    context.fillStyle = 'rgba(71, 49, 82, 0.22)';
    context.fillRect(0, 0, metrics.width, metrics.height);

    const panelGradient = context.createLinearGradient(
      panelRect.x,
      panelRect.y,
      panelRect.x,
      panelRect.y + panelRect.height,
    );
    panelGradient.addColorStop(0, 'rgba(255,255,255,0.96)');
    panelGradient.addColorStop(1, 'rgba(249,239,255,0.92)');
    context.fillStyle = panelGradient;
    context.strokeStyle = 'rgba(255,255,255,0.92)';
    context.lineWidth = 1.4;
    context.shadowColor = 'rgba(116, 77, 143, 0.26)';
    context.shadowBlur = 28;
    context.shadowOffsetY = 12;
    roundRect(context, panelRect, 24);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();

    const headerChipRect = {
      x: panelRect.x + 72,
      y: panelRect.y + 16,
      width: panelRect.width - 144,
      height: 38,
    };
    const headerChipGradient = context.createLinearGradient(
      headerChipRect.x,
      headerChipRect.y,
      headerChipRect.x,
      headerChipRect.y + headerChipRect.height,
    );
    headerChipGradient.addColorStop(0, '#f7ecff');
    headerChipGradient.addColorStop(1, '#eddcff');
    context.fillStyle = headerChipGradient;
    context.strokeStyle = 'rgba(255,255,255,0.95)';
    context.lineWidth = 1;
    roundRect(context, headerChipRect, 18);
    context.fill();
    context.stroke();

    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = '#9b61db';
    context.font = '700 20px sans-serif';
    context.textAlign = 'center';
    context.fillText(
      t(locale, 'landing.weeklyLeaderboard'),
      panelRect.x + panelRect.width / 2,
      panelRect.y + 22,
    );

    drawWrappedText(
      context,
      t(locale, 'landing.localWeeklyNote'),
      {
        x: panelRect.x + 22,
        y: panelRect.y + 66,
        width: panelRect.width - 44,
        height: 36,
      },
      {
        font: '11px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 14,
        maxLines: 2,
      },
    );

    const listTop = panelRect.y + 110;
    const listLeft = panelRect.x + 18;
    const rowWidth = panelRect.width - 36;
    const rowHeight = 56;
    const rowGap = 10;
    const entries = weeklyLeaderboard.slice(0, 6);

    if (entries.length === 0) {
      drawHudShell(context, {
        x: listLeft,
        y: listTop + 18,
        width: rowWidth,
        height: 104,
      });
      drawWrappedText(
        context,
        t(locale, 'landing.emptyLeaderboard'),
        {
          x: listLeft + 18,
          y: listTop + 48,
          width: rowWidth - 36,
          height: 40,
        },
        {
          font: '13px sans-serif',
          color: THEME.textPrimary,
          lineHeight: 18,
          maxLines: 2,
        },
      );
    } else {
      entries.forEach((entry, index) => {
        const rowRect = {
          x: listLeft,
          y: listTop + index * (rowHeight + rowGap),
          width: rowWidth,
          height: rowHeight,
        };

        drawHudShell(context, rowRect);
        const badgeRect = {
          x: rowRect.x + 14,
          y: rowRect.y + 12,
          width: 26,
          height: 26,
        };
        const badgeGradient = context.createLinearGradient(
          badgeRect.x,
          badgeRect.y,
          badgeRect.x,
          badgeRect.y + badgeRect.height,
        );
        if (index === 0) {
          badgeGradient.addColorStop(0, '#ffd56d');
          badgeGradient.addColorStop(1, '#ff9e1a');
        } else if (index === 1) {
          badgeGradient.addColorStop(0, '#d9c9ff');
          badgeGradient.addColorStop(1, '#8a77ff');
        } else {
          badgeGradient.addColorStop(0, '#a8e0ff');
          badgeGradient.addColorStop(1, '#53b7ff');
        }
        context.fillStyle = badgeGradient;
        roundRect(context, badgeRect, 9);
        context.fill();
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = '700 15px sans-serif';
        context.fillText(String(index + 1), badgeRect.x + badgeRect.width / 2, badgeRect.y + badgeRect.height / 2 + 0.5);

        context.fillStyle = THEME.textPrimary;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.font = '700 14px sans-serif';
        context.fillText(
          t(locale, 'landing.bestTime', { duration: formatDuration(entry.durationMs) }),
          rowRect.x + 52,
          rowRect.y + 10,
        );
        context.fillStyle = THEME.textSecondary;
        context.font = '11px sans-serif';
        context.fillText(
          t(locale, 'landing.completedAt', {
            completedAt: formatCompletedAt(locale, entry.completedAt),
          }),
          rowRect.x + 52,
          rowRect.y + 32,
        );
      });
    }

    context.fillStyle = THEME.textMuted;
    context.font = '10px sans-serif';
    context.textAlign = 'center';
    context.fillText(
      t(locale, 'landing.close'),
      panelRect.x + panelRect.width / 2,
      panelRect.y + panelRect.height - 24,
    );
    context.restore();
  }

  function drawLevelPanel(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    const panelMargin = 18;
    const panelWidth = metrics.width - panelMargin * 2;
    const panelHeight = Math.min(metrics.height - layout.topInset - 28, 440);
    const panelX = panelMargin;
    const panelY = Math.max(layout.topInset - 8, (metrics.height - panelHeight) / 2);
    const innerPadding = 16;
    const columns = 6;
    const rows = 6;
    const gap = 6;
    const gridWidth = panelWidth - innerPadding * 2;
    const tileSize = Math.floor((gridWidth - gap * (columns - 1)) / columns);
    const gridStartX = panelX + innerPadding;
    const gridStartY = panelY + 56;

    levelTiles = [];

    context.save();
    context.fillStyle = THEME.overlay;
    context.fillRect(0, 0, metrics.width, metrics.height);

    const panelGradient = context.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    panelGradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    panelGradient.addColorStop(1, 'rgba(255,255,255,0.84)');
    context.fillStyle = panelGradient;
    context.strokeStyle = THEME.border;
    context.lineWidth = 1.2;
    roundRect(context, { x: panelX, y: panelY, width: panelWidth, height: panelHeight }, 20);
    context.fill();
    context.stroke();

    context.fillStyle = THEME.textPrimary;
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.font = '700 17px sans-serif';
    context.fillText(t(locale, 'section.levels'), panelX + innerPadding, panelY + 16);
    context.font = '500 12px sans-serif';
    context.fillStyle = THEME.textSecondary;
    context.fillText(
      t(locale, 'level.collectionMeta', {
        completed: Object.keys(snapshot.records).length,
        total: levels.length,
      }),
      panelX + innerPadding,
      panelY + 36,
    );

    for (let slot = 0; slot < rows * columns; slot += 1) {
      const col = slot % columns;
      const row = Math.floor(slot / columns);
      const x = gridStartX + col * (tileSize + gap);
      const y = gridStartY + row * (tileSize + gap);

      if (slot >= levels.length) {
        context.fillStyle = 'rgba(255,255,255,0.42)';
        roundRect(context, { x, y, width: tileSize, height: tileSize }, 10);
        context.fill();
        continue;
      }

      const level = levels[slot];
      const completed = Boolean(snapshot.records[level.id]);
      const isCurrent = snapshot.levelIndex === slot;
      const isViewing = isCurrent && snapshot.mode === 'record';

      context.fillStyle = completed ? 'rgba(204,255,212,0.92)' : 'rgba(255,255,255,0.94)';
      if (isCurrent) {
        context.fillStyle = isViewing ? THEME.infoSoft : 'rgba(255, 238, 183, 0.98)';
      }
      context.strokeStyle = isCurrent ? THEME.borderAccent : THEME.border;
      context.lineWidth = isCurrent ? 2 : 1;
      roundRect(context, { x, y, width: tileSize, height: tileSize }, 10);
      context.fill();
      context.stroke();

      if (isCurrent) {
        context.fillStyle = isViewing ? THEME.info : THEME.accentFill;
        roundRect(context, { x: x + 6, y: y + 4, width: tileSize - 12, height: 5 }, 3);
        context.fill();
      }

      context.fillStyle = isCurrent ? THEME.accentStrong : THEME.textPrimary;
      if (isViewing) {
        context.fillStyle = THEME.info;
      }
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '700 15px sans-serif';
      context.fillText(String(slot + 1), x + tileSize / 2, y + tileSize / 2 + 3);

      if (completed) {
        context.fillStyle = THEME.success;
        context.beginPath();
        context.arc(x + tileSize - 10, y + 10, 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = THEME.white;
        context.font = '700 10px sans-serif';
        context.fillText('✓', x + tileSize - 10, y + 10.5);
      }

      if (isViewing) {
        context.fillStyle = THEME.infoSoft;
        roundRect(context, { x: x + 6, y: y + tileSize - 14, width: tileSize - 12, height: 8 }, 4);
        context.fill();
      }

      levelTiles.push({
        index: slot,
        rect: { x, y, width: tileSize, height: tileSize },
      });
    }

    context.restore();
  }

  function drawOverlay(snapshot: ReturnType<GameController['getSnapshot']>): void {
    if (uiState.homeOpen) {
      drawLandingScreen();
      if (uiState.leaderboardOpen) {
        drawLeaderboardPanel();
      }
      if (uiState.helpOpen) {
        drawInfoDialog('help');
      }
      if (uiState.goalOpen) {
        drawInfoDialog('goal');
      }
      return;
    }

    drawHeader(snapshot);
    drawInfoCards(snapshot);
    drawButtons(snapshot);
    drawAutoAdvanceBanner(snapshot);

    if (uiState.levelPanelOpen) {
      drawLevelPanel(snapshot);
    }

    if (uiState.leaderboardOpen) {
      drawLeaderboardPanel();
    }

    if (uiState.settingsOpen) {
      drawSettingsDialog();
    }
  }

  function render(): void {
    if (!uiState.homeOpen) {
      renderer.render(currentSnapshot, {
        labels: {
          solvedBadge: t(locale, 'renderer.badgeSolved'),
          recordBadge: t(locale, 'renderer.badgeRecord'),
        },
        insets: {
          top: layout.topInset,
          bottom: layout.bottomInset,
        },
      });
    }
    drawOverlay(currentSnapshot);
    syncFeedbackAudio(currentSnapshot);
    syncWeeklyLeaderboard(currentSnapshot);
    scheduleAutoAdvance(currentSnapshot);
  }

  function ensureAnimationLoop(): void {
    if (animationFrameId !== 0 || (!renderer.hasActiveEffects() && !hasOverlayEffects())) {
      return;
    }

    animationFrameId = scheduleFrame(tick);
  }

  function tick(): void {
    animationFrameId = 0;
    render();

    if (renderer.hasActiveEffects() || hasOverlayEffects()) {
      animationFrameId = scheduleFrame(tick);
    }
  }

  function hasOverlayEffects(): boolean {
    return Date.now() < autoAdvanceBannerUntil;
  }

  function syncWeeklyLeaderboard(snapshot: GameSnapshot): void {
    if (
      snapshot.mode !== 'play' ||
      !snapshot.solved ||
      snapshot.hasNextLevel ||
      Object.keys(snapshot.records).length !== levels.length ||
      snapshot.effects.celebrationId === 0 ||
      snapshot.effects.celebrationId === lastCampaignCompletionCelebrationId
    ) {
      return;
    }

    lastCampaignCompletionCelebrationId = snapshot.effects.celebrationId;
    if (!campaignState) {
      return;
    }

    const completedAt = new Date().toISOString();
    const durationMs = Math.max(0, Date.now() - campaignState.startedAt);
    weeklyLeaderboard = storage.recordWeeklyLeaderboardEntry(durationMs, completedAt);
    campaignState = null;
    storage.saveCampaignState(null);
  }

  function triggerVibration(type: 'light' | 'medium' | 'heavy'): void {
    if (!userSettings.vibrationEnabled) {
      return;
    }

    try {
      wx.vibrateShort?.({ type });
    } catch {
      // Ignore vibration failures in unsupported runtimes.
    }
  }

  function syncFeedbackAudio(snapshot: GameSnapshot): void {
    const placementEffectId = snapshot.effects.placement?.id ?? 0;
    if (placementEffectId !== lastPlacementEffectId) {
      lastPlacementEffectId = placementEffectId;
      if (placementEffectId > 0) {
        audio.playPlacement();
        triggerVibration('light');
      }
    }

    if (snapshot.effects.invalidId !== lastInvalidEffectId) {
      lastInvalidEffectId = snapshot.effects.invalidId;
      if (snapshot.effects.invalidId > 0) {
        audio.playInvalid();
        triggerVibration('medium');
      }
    }

    if (snapshot.effects.celebrationId !== lastCelebrationEffectId) {
      lastCelebrationEffectId = snapshot.effects.celebrationId;
      if (snapshot.effects.celebrationId > 0) {
        audio.playCelebration();
        triggerVibration('heavy');
      }
    }
  }

  function scheduleAutoAdvance(snapshot: GameSnapshot): void {
    if (
      snapshot.mode !== 'play' ||
      !snapshot.solved ||
      !snapshot.hasNextLevel ||
      snapshot.effects.celebrationId === 0 ||
      snapshot.effects.celebrationId === lastAutoAdvanceCelebrationId
    ) {
      return;
    }

    if (autoAdvanceTimeoutId !== 0) {
      globalThis.clearTimeout(autoAdvanceTimeoutId);
      autoAdvanceTimeoutId = 0;
    }

    lastAutoAdvanceCelebrationId = snapshot.effects.celebrationId;
    autoAdvanceBannerUntil = Date.now() + 1200;
    autoAdvanceTimeoutId = globalThis.setTimeout(() => {
      autoAdvanceTimeoutId = 0;
      const latest = game.getSnapshot();
      if (latest.mode === 'play' && latest.solved && latest.hasNextLevel) {
        game.nextLevel();
      }
    }, 1200) as unknown as number;
  }

  function drawAutoAdvanceBanner(snapshot: GameSnapshot): void {
    if (!snapshot.solved || Date.now() >= autoAdvanceBannerUntil) {
      return;
    }

    const context = surface.getContext2D();
    const width = Math.min(metrics.width - 52, 248);
    const height = 62;
    const rect = {
      x: (metrics.width - width) / 2,
      y: layout.topInset + 10,
      width,
      height,
    };

    context.save();
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    gradient.addColorStop(0, '#fff9da');
    gradient.addColorStop(1, 'rgba(255,255,255,0.92)');
    context.fillStyle = gradient;
    context.strokeStyle = THEME.borderAccent;
    context.lineWidth = 1.2;
    context.shadowColor = THEME.shadow;
    context.shadowBlur = 22;
    context.shadowOffsetY = 10;
    roundRect(context, rect, 18);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();

    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = THEME.accent;
    context.font = '700 12px sans-serif';
    context.fillText(
      snapshot.hasNextLevel ? t(locale, 'banner.nextLevel') : t(locale, 'banner.allCleared'),
      rect.x + rect.width / 2,
      rect.y + 22,
    );
    context.fillStyle = THEME.textPrimary;
    context.font = '700 18px sans-serif';
    context.fillText(
      snapshot.hasNextLevel ? t(locale, 'renderer.badgeSolved') : t(locale, 'banner.allCleared'),
      rect.x + rect.width / 2,
      rect.y + 42,
    );
    context.restore();
  }

  function handleUiTap(x: number, y: number): boolean {
    if (uiState.homeOpen) {
      uiState.pressedUiId = null;
      if (uiState.helpOpen || uiState.goalOpen) {
        const closeButtonHit = infoDialogButtonRect
          ? isPointInsideRect(x, y, infoDialogButtonRect)
          : false;
        const insidePanel = infoDialogPanelRect
          ? isPointInsideRect(x, y, infoDialogPanelRect)
          : false;
        if (closeButtonHit || !insidePanel) {
          uiState.helpOpen = false;
          uiState.goalOpen = false;
        }
        render();
        return true;
      }

      if (uiState.leaderboardOpen) {
        if (!leaderboardPanelRect || !isPointInsideRect(x, y, leaderboardPanelRect)) {
          uiState.leaderboardOpen = false;
        }
        render();
        return true;
      }

      const topIconButton = topIconButtons.find((item) => isPointInsideRect(x, y, item.rect));
      if (topIconButton) {
        if (topIconButton.id === 'help') {
          uiState.helpOpen = true;
          uiState.goalOpen = false;
        } else {
          uiState.goalOpen = true;
          uiState.helpOpen = false;
        }
        render();
        return true;
      }

      const homeButton = homeButtons.find((item) => isPointInsideRect(x, y, item.rect));
      if (!homeButton) {
        render();
        return true;
      }

      if (homeButton.id === 'newGame') {
        game.resetCampaign();
        campaignState = {
          startedAt: Date.now(),
          weekKey: getWeeklyBucketKey(),
        };
        storage.saveCampaignState(campaignState);
        uiState.homeOpen = false;
        uiState.leaderboardOpen = false;
        uiState.helpOpen = false;
        uiState.goalOpen = false;
        render();
        return true;
      }

      uiState.leaderboardOpen = true;
      render();
      return true;
    }

    if (uiState.settingsOpen) {
      uiState.pressedUiId = null;
      const insidePanel = settingsDialogPanelRect
        ? isPointInsideRect(x, y, settingsDialogPanelRect)
        : false;
      if (soundToggleRect && isPointInsideRect(x, y, soundToggleRect)) {
        userSettings = {
          ...userSettings,
          soundEnabled: !userSettings.soundEnabled,
        };
        audio.setEnabled(userSettings.soundEnabled);
        saveUserSettings(storageAdapter, userSettings);
        render();
        return true;
      }

      if (vibrationToggleRect && isPointInsideRect(x, y, vibrationToggleRect)) {
        userSettings = {
          ...userSettings,
          vibrationEnabled: !userSettings.vibrationEnabled,
        };
        saveUserSettings(storageAdapter, userSettings);
        if (userSettings.vibrationEnabled) {
          triggerVibration('light');
        }
        render();
        return true;
      }

      if (settingsBackButtonRect && isPointInsideRect(x, y, settingsBackButtonRect)) {
        uiState.settingsOpen = false;
        uiState.leaderboardOpen = false;
        uiState.levelPanelOpen = false;
        uiState.homeOpen = true;
        render();
        return true;
      }

      if (settingsContinueButtonRect && isPointInsideRect(x, y, settingsContinueButtonRect)) {
        uiState.settingsOpen = false;
        render();
        return true;
      }

      if (!insidePanel) {
        uiState.settingsOpen = false;
        render();
        return true;
      }

      render();
      return true;
    }

    if (uiState.leaderboardOpen) {
      if (!leaderboardPanelRect || !isPointInsideRect(x, y, leaderboardPanelRect)) {
        uiState.leaderboardOpen = false;
      }
      render();
      return true;
    }

    const gameTopButton = gameTopButtons.find((item) => isPointInsideRect(x, y, item.rect));
    if (gameTopButton) {
      uiState.pressedUiId = null;
      if (gameTopButton.id === 'settings') {
        uiState.settingsOpen = true;
      } else {
        uiState.leaderboardOpen = true;
      }
      render();
      return true;
    }

    if (uiState.levelPanelOpen) {
      const tile = levelTiles.find((item) => isPointInsideRect(x, y, item.rect));
      uiState.pressedUiId = null;
      if (tile) {
        const snapshot = game.getSnapshot();
        const level = levels[tile.index];
        if (snapshot.records[level.id]) {
          game.viewRecordedLevel(tile.index);
        } else {
          game.setLevel(tile.index);
        }
        uiState.levelPanelOpen = false;
        render();
        return true;
      }

      uiState.levelPanelOpen = false;
      render();
      return true;
    }

    const button = buttons.find((item) => item.enabled && isPointInsideRect(x, y, item.rect));
    uiState.pressedUiId = null;
    if (!button) {
      render();
      return false;
    }

    switch (button.id) {
      case 'levels':
        uiState.levelPanelOpen = true;
        render();
        return true;
      case 'undo':
        game.undo();
        return true;
      case 'restart':
        game.resetLevel();
        return true;
      case 'hint':
        game.requestHint();
        return true;
      case 'next':
        game.nextLevel();
        return true;
    }
  }

  function updatePressedUi(x: number, y: number): void {
    if (uiState.homeOpen) {
      if (uiState.leaderboardOpen || uiState.helpOpen || uiState.goalOpen) {
        uiState.pressedUiId = null;
        render();
        return;
      }

      const topIconButton = topIconButtons.find((item) => isPointInsideRect(x, y, item.rect));
      if (topIconButton) {
        uiState.pressedUiId = `icon:${topIconButton.id}`;
        render();
        return;
      }

      const homeButton = homeButtons.find((item) => isPointInsideRect(x, y, item.rect));
      uiState.pressedUiId = homeButton ? `home:${homeButton.id}` : null;
      render();
      return;
    }

    if (uiState.levelPanelOpen || uiState.leaderboardOpen || uiState.settingsOpen) {
      uiState.pressedUiId = null;
      render();
      return;
    }

    const gameTopButton = gameTopButtons.find((item) => isPointInsideRect(x, y, item.rect));
    if (gameTopButton) {
      uiState.pressedUiId = `icon:${gameTopButton.id}`;
      render();
      return;
    }

    const button = buttons.find((item) => item.enabled && isPointInsideRect(x, y, item.rect));
    uiState.pressedUiId = button ? `toolbar:${button.id}` : null;
    render();
  }

  game.subscribe((snapshot) => {
    currentSnapshot = snapshot;
    render();
    ensureAnimationLoop();
  });

  wx.onTouchStart((event) => {
    audio.prime();

    const touch = event.changedTouches?.[0] ?? event.touches?.[0];
    if (!touch) {
      return;
    }

    const x = touch.clientX ?? touch.x ?? touch.pageX;
    const y = touch.clientY ?? touch.y ?? touch.pageY;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return;
    }

    updatePressedUi(x, y);
  });

  wx.onTouchEnd((event) => {
    const touch = event.changedTouches?.[0] ?? event.touches?.[0];
    if (!touch) {
      return;
    }

    const x = touch.clientX ?? touch.x ?? touch.pageX;
    const y = touch.clientY ?? touch.y ?? touch.pageY;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return;
    }

    handleUiTap(x, y);
  });

  wx.onTouchCancel(() => {
    if (uiState.pressedUiId) {
      uiState.pressedUiId = null;
      render();
    }
  });

  const debugApi: OverlayActionApi = {
    nextLevel: () => game.nextLevel(),
    resetLevel: () => game.resetLevel(),
    undo: () => game.undo(),
    hint: () => game.requestHint(),
    setLevel: (index: number) => game.setLevel(index),
    snapshot: () => game.getSnapshot(),
  };

  (globalThis as typeof globalThis & { __PATCH_GRID_DEBUG__?: OverlayActionApi }).__PATCH_GRID_DEBUG__ =
    debugApi;

  render();
}

try {
  drawBootstrapSplash();
  void bootstrapWechatGame().catch((error) => {
    console.error('[Fill Grid] WeChat bootstrap failed:', error);
    drawBootstrapError(error);
  });
} catch (error) {
  console.error('[Fill Grid] WeChat bootstrap failed:', error);
  drawBootstrapError(error);
}
