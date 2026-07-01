import { FeedbackAudio } from '../audio/FeedbackAudio';
import { BackgroundMusic } from '../audio/BackgroundMusic';
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
  gameplayBackground: WechatImage | null;
  newGameButton: WechatImage | null;
  leaderboardButton: WechatImage | null;
  checkIcon: WechatImage | null;
  helpIcon: WechatImage | null;
  sunIcon: WechatImage | null;
  trophyIcon: WechatImage | null;
  lightbulbIcon: WechatImage | null;
  noteIcon: WechatImage | null;
  flagIcon: WechatImage | null;
  checklistIcon: WechatImage | null;
  cloudFaceIcon: WechatImage | null;
  mascotCatCloud: WechatImage | null;
  bottomButtonIcons: WechatImage | null;
  decorSheet: WechatImage | null;
  selectionStrawberry: WechatImage | null;
  selectionHeartPink: WechatImage | null;
  selectionStarYellow: WechatImage | null;
  selectionSparkleWhite: WechatImage | null;
  selectionBubblePink: WechatImage | null;
  selectionBubbleYellow: WechatImage | null;
  selectionDripYellow: WechatImage | null;
  settingsCloudSmileHeart: WechatImage | null;
  settingsStarPinkBig: WechatImage | null;
  settingsMusicBadge: WechatImage | null;
  settingsVibrationBadge: WechatImage | null;
  settingsCloudClusterLeft: WechatImage | null;
  settingsHeartCorner: WechatImage | null;
  settingsHeartSmall: WechatImage | null;
  settingsSparkleWhite: WechatImage | null;
  settingsStarYellowSmall: WechatImage | null;
  levelPanelCloudLeft: WechatImage | null;
  levelPanelCloudRight: WechatImage | null;
  levelPanelCloudSmileHeart: WechatImage | null;
  levelPanelHeartPink: WechatImage | null;
  levelPanelRibbonPink: WechatImage | null;
  leaderboardRibbonPurple: WechatImage | null;
  leaderboardBunnyPeekLeft: WechatImage | null;
  leaderboardRainbowCloud: WechatImage | null;
  leaderboardEmptyTrophyBunny: WechatImage | null;
  levelPanelStarBigYellow: WechatImage | null;
  levelPanelStarBlue: WechatImage | null;
  levelPanelStarFaceYellow: WechatImage | null;
  levelPanelStarPink: WechatImage | null;
  levelPanelSparkleWhite: WechatImage | null;
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
  background: 'dist-wechat/assets/wechat/bg.jpg',
  gameplayBackground: 'dist-wechat/assets/wechat/bg_kawaii.png',
  backgroundMusic: 'dist-wechat/assets/wechat/audio/perfect_match_bloom.mp3',
  newGameButton: 'dist-wechat/assets/wechat/new_game2.png',
  leaderboardButton: 'dist-wechat/assets/wechat/rank_cutout.png',
  checkIcon: 'dist-wechat/assets/wechat/check_icon.png',
  helpIcon: 'dist-wechat/assets/wechat/help_icon.png',
  sunIcon: 'dist-wechat/assets/wechat/kawaii/icon-sun.png',
  trophyIcon: 'dist-wechat/assets/wechat/kawaii/icon-trophy.png',
  lightbulbIcon: 'dist-wechat/assets/wechat/kawaii/icon-lightbulb.png',
  noteIcon: 'dist-wechat/assets/wechat/kawaii/icon-note.png',
  flagIcon: 'dist-wechat/assets/wechat/kawaii/icon-flag.png',
  checklistIcon: 'dist-wechat/assets/wechat/kawaii/icon-checklist.png',
  cloudFaceIcon: 'dist-wechat/assets/wechat/kawaii/icon-cloud-face.png',
  mascotCatCloud: 'dist-wechat/assets/wechat/kawaii/mascot-cat-cloud.png',
  bottomButtonIcons: 'dist-wechat/assets/wechat/kawaii/bottom-btn.png',
  decorSheet: 'dist-wechat/assets/wechat/kawaii/icon-star-heart-cloud.png',
  selectionStrawberry: 'dist-wechat/assets/wechat/selection/selection_decor_strawberry.png',
  selectionHeartPink: 'dist-wechat/assets/wechat/selection/selection_decor_heart_pink.png',
  selectionStarYellow: 'dist-wechat/assets/wechat/selection/selection_decor_star_yellow.png',
  selectionSparkleWhite: 'dist-wechat/assets/wechat/selection/selection_decor_sparkle_white.png',
  selectionBubblePink: 'dist-wechat/assets/wechat/selection/selection_decor_bubble_pink.png',
  selectionBubbleYellow: 'dist-wechat/assets/wechat/selection/selection_decor_bubble_yellow.png',
  selectionDripYellow: 'dist-wechat/assets/wechat/selection/selection_top_drip_yellow.png',
  settingsCloudSmileHeart: 'dist-wechat/assets/wechat/settings/decor_cloud_smile_heart.png',
  settingsStarPinkBig: 'dist-wechat/assets/wechat/settings/decor_star_pink_big.png',
  settingsMusicBadge: 'dist-wechat/assets/wechat/settings/icon_music_badge.png',
  settingsVibrationBadge: 'dist-wechat/assets/wechat/settings/icon_vibration_badge.png',
  settingsCloudClusterLeft: 'dist-wechat/assets/wechat/settings/decor_cloud_cluster_left.png',
  settingsHeartCorner: 'dist-wechat/assets/wechat/settings/decor_heart_corner.png',
  settingsHeartSmall: 'dist-wechat/assets/wechat/settings/decor_heart_small.png',
  settingsSparkleWhite: 'dist-wechat/assets/wechat/settings/decor_sparkle_white.png',
  settingsStarYellowSmall: 'dist-wechat/assets/wechat/settings/decor_star_yellow_small_transparent.png',
  levelPanelCloudLeft: 'dist-wechat/assets/wechat/level-panel/decor_cloud_cluster_left.png',
  levelPanelCloudRight: 'dist-wechat/assets/wechat/level-panel/decor_cloud_cluster_right.png',
  levelPanelCloudSmileHeart: 'dist-wechat/assets/wechat/level-panel/decor_cloud_smile_heart.png',
  levelPanelHeartPink: 'dist-wechat/assets/wechat/level-panel/decor_heart_pink.png',
  levelPanelRibbonPink: 'dist-wechat/assets/wechat/level-panel/decor_ribbon_pink.png',
  leaderboardRibbonPurple: 'dist-wechat/assets/wechat/leaderboard/decor_ribbon_leaderboard_purple.png',
  leaderboardBunnyPeekLeft: 'dist-wechat/assets/wechat/leaderboard/decor_bunny_peek_left.png',
  leaderboardRainbowCloud: 'dist-wechat/assets/wechat/leaderboard/decor_rainbow_cloud.png',
  leaderboardEmptyTrophyBunny: 'dist-wechat/assets/wechat/leaderboard/empty_trophy_bunny.png',
  levelPanelStarBigYellow: 'dist-wechat/assets/wechat/level-panel/decor_star_big_yellow.png',
  levelPanelStarBlue: 'dist-wechat/assets/wechat/level-panel/decor_star_blue.png',
  levelPanelStarFaceYellow: 'dist-wechat/assets/wechat/level-panel/decor_star_face_yellow.png',
  levelPanelStarPink: 'dist-wechat/assets/wechat/level-panel/decor_star_pink.png',
  levelPanelSparkleWhite: 'dist-wechat/assets/wechat/level-panel/decor_sparkle_white.png',
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
  const compact = metrics.height < 780;
  const padding = compact ? 12 : 14;
  const gap = compact ? 8 : 9;
  const topBarHeight = compact ? 30 : 32;
  const headerHeight = compact ? 96 : 104;
  const infoHeight = compact ? 74 : 82;
  const rulesHeight = compact ? 78 : 84;
  const actionsHeight = compact ? 86 : 94;
  const bottomSafeSpacing = Math.max(18, metrics.safeBottom + 10);
  const topBarY = Math.max(2, metrics.safeTop - (compact ? 22 : 24));
  const headerRect = {
    x: padding,
    y: topBarY + topBarHeight + 2,
    width: metrics.width - padding * 2,
    height: headerHeight,
  };

  const infoY = headerRect.y + headerHeight + gap;
  const cardWidth = Math.floor((metrics.width - padding * 2 - gap * 2) / 3);
  const hintRect = {
    x: padding,
    y: infoY,
    width: cardWidth,
    height: infoHeight,
  };
  const recordRect = {
    x: hintRect.x + hintRect.width + gap,
    y: infoY,
    width: cardWidth,
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
  const topInset = infoY + infoHeight + 8;
  const bottomInset = Math.max(106, metrics.height - rulesRect.y + 10);

  return {
    headerRect,
    chipRect: {
      x: headerRect.x + headerRect.width - (compact ? 108 : 116),
      y: headerRect.y + (compact ? 18 : 22),
      width: compact ? 94 : 102,
      height: compact ? 42 : 46,
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
  const radius = 22;
  context.save();
  const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  gradient.addColorStop(0, 'rgba(255, 252, 248, 0.97)');
  gradient.addColorStop(1, 'rgba(255, 247, 241, 0.92)');
  context.fillStyle = gradient;
  context.strokeStyle = 'rgba(255, 203, 214, 0.95)';
  context.lineWidth = 2.2;
  context.shadowColor = 'rgba(188, 115, 149, 0.2)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  roundRect(context, rect, radius);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();

  context.save();
  context.setLineDash([5, 4]);
  context.strokeStyle = 'rgba(255, 174, 189, 0.88)';
  context.lineWidth = 1.3;
  roundRect(context, {
    x: rect.x + 7,
    y: rect.y + 7,
    width: rect.width - 14,
    height: rect.height - 14,
  }, Math.max(10, radius - 6));
  context.stroke();
  context.restore();
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

function drawCatCloudMascot(
  context: CanvasRenderingContext2D,
  rect: Rect,
  image: WechatImage | null,
): void {
  if (image) {
    drawImageFit(context, image, rect);
    return;
  }

  const cloud = {
    x: rect.x + 4,
    y: rect.y + rect.height - 52,
    width: 86,
    height: 58,
  };

  context.save();
  const cloudGradient = context.createLinearGradient(cloud.x, cloud.y, cloud.x, cloud.y + cloud.height);
  cloudGradient.addColorStop(0, '#ffb3d0');
  cloudGradient.addColorStop(1, '#ff8db8');
  context.fillStyle = cloudGradient;
  context.shadowColor = 'rgba(255, 154, 191, 0.28)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 6;
  roundRect(context, cloud, 28);
  context.fill();
  context.shadowColor = 'transparent';

  context.fillStyle = '#fff8f4';
  context.beginPath();
  context.arc(rect.x + 34, rect.y + 28, 18, Math.PI * 0.2, Math.PI * 1.95);
  context.arc(rect.x + 52, rect.y + 30, 18, Math.PI * 1.1, Math.PI * 0.1, true);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(rect.x + 25, rect.y + 18);
  context.lineTo(rect.x + 19, rect.y + 7);
  context.lineTo(rect.x + 31, rect.y + 12);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(rect.x + 55, rect.y + 12);
  context.lineTo(rect.x + 66, rect.y + 8);
  context.lineTo(rect.x + 61, rect.y + 20);
  context.closePath();
  context.fill();

  context.strokeStyle = '#7a4858';
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(rect.x + 31, rect.y + 31);
  context.lineTo(rect.x + 35, rect.y + 28);
  context.moveTo(rect.x + 49, rect.y + 28);
  context.lineTo(rect.x + 53, rect.y + 31);
  context.stroke();
  context.beginPath();
  context.moveTo(rect.x + 40, rect.y + 36);
  context.quadraticCurveTo(rect.x + 43, rect.y + 40, rect.x + 46, rect.y + 36);
  context.stroke();
  context.fillStyle = '#ffb1ba';
  context.beginPath();
  context.arc(rect.x + 28, rect.y + 37, 4, 0, Math.PI * 2);
  context.arc(rect.x + 57, rect.y + 37, 4, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#fff8f4';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(cloud.x + 22, cloud.y + 10);
  context.lineTo(cloud.x + 14, cloud.y + 24);
  context.moveTo(cloud.x + 64, cloud.y + 10);
  context.lineTo(cloud.x + 72, cloud.y + 24);
  context.stroke();
  context.restore();
}

function drawRuleBunnyPeek(context: CanvasRenderingContext2D, rect: Rect): void {
  const bodyRect = {
    x: rect.x + rect.width * 0.10,
    y: rect.y + rect.height * 0.34,
    width: rect.width * 0.80,
    height: rect.height * 0.54,
  };
  const earWidth = rect.width * 0.24;
  const earHeight = rect.height * 0.54;

  context.save();
  context.shadowColor = 'rgba(255, 170, 195, 0.24)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 4;

  const faceGradient = context.createLinearGradient(
    bodyRect.x,
    bodyRect.y,
    bodyRect.x,
    bodyRect.y + bodyRect.height,
  );
  faceGradient.addColorStop(0, '#fffdf8');
  faceGradient.addColorStop(1, '#fff2e8');
  context.fillStyle = faceGradient;
  roundRect(context, bodyRect, bodyRect.height / 2);
  context.fill();
  context.shadowColor = 'transparent';

  const drawEar = (ear: Rect, leanLeft: boolean): void => {
    context.save();
    const earGradient = context.createLinearGradient(ear.x, ear.y, ear.x, ear.y + ear.height);
    earGradient.addColorStop(0, '#fffdf8');
    earGradient.addColorStop(1, '#ffe9f0');
    context.fillStyle = earGradient;
    context.strokeStyle = 'rgba(255, 196, 212, 0.92)';
    context.lineWidth = 2;
    roundRect(context, ear, ear.width / 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#ffb7ca';
    context.beginPath();
    context.ellipse(
      ear.x + ear.width * 0.55,
      ear.y + ear.height * 0.54,
      ear.width * 0.22,
      ear.height * 0.30,
      leanLeft ? -0.18 : 0.18,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();
  };

  drawEar(
    {
      x: rect.x + rect.width * 0.18,
      y: rect.y + rect.height * 0.02,
      width: earWidth,
      height: earHeight,
    },
    true,
  );
  drawEar(
    {
      x: rect.x + rect.width * 0.47,
      y: rect.y,
      width: earWidth,
      height: earHeight,
    },
    false,
  );

  context.fillStyle = '#7a4b3d';
  context.beginPath();
  context.arc(bodyRect.x + bodyRect.width * 0.38, bodyRect.y + bodyRect.height * 0.42, 2.6, 0, Math.PI * 2);
  context.arc(bodyRect.x + bodyRect.width * 0.62, bodyRect.y + bodyRect.height * 0.42, 2.6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#ff8fa8';
  context.beginPath();
  context.arc(bodyRect.x + bodyRect.width * 0.25, bodyRect.y + bodyRect.height * 0.54, 4.5, 0, Math.PI * 2);
  context.arc(bodyRect.x + bodyRect.width * 0.75, bodyRect.y + bodyRect.height * 0.54, 4.5, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#7a4b3d';
  context.lineWidth = 1.8;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(bodyRect.x + bodyRect.width * 0.50, bodyRect.y + bodyRect.height * 0.46);
  context.quadraticCurveTo(
    bodyRect.x + bodyRect.width * 0.47,
    bodyRect.y + bodyRect.height * 0.54,
    bodyRect.x + bodyRect.width * 0.50,
    bodyRect.y + bodyRect.height * 0.61,
  );
  context.stroke();

  context.fillStyle = '#fff2e8';
  context.beginPath();
  context.arc(bodyRect.x + bodyRect.width * 0.14, bodyRect.y + bodyRect.height * 0.88, 5, 0, Math.PI * 2);
  context.arc(bodyRect.x + bodyRect.width * 0.86, bodyRect.y + bodyRect.height * 0.88, 5, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawCardBadge(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  palette: { start: string; end: string; outline: string },
  icon: 'hint' | 'note' | 'flag' | 'rules',
  image: WechatImage | null,
  size = 36,
): void {
  const half = size / 2;
  const scale = size / 36;
  if (image) {
    drawImageFit(context, image, {
      x: centerX - half,
      y: centerY - half,
      width: size,
      height: size,
    });
    return;
  }

  const gradient = context.createLinearGradient(centerX, centerY - half, centerX, centerY + half);
  gradient.addColorStop(0, palette.start);
  gradient.addColorStop(1, palette.end);

  context.save();
  context.fillStyle = gradient;
  context.strokeStyle = 'rgba(255,255,255,0.92)';
  context.lineWidth = 2;
  context.shadowColor = 'rgba(178, 116, 145, 0.16)';
  context.shadowBlur = 10;
  context.shadowOffsetY = 4;
  context.beginPath();
  context.arc(centerX, centerY, half, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();

  context.strokeStyle = palette.outline;
  context.fillStyle = palette.outline;
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (icon === 'hint') {
    context.beginPath();
    context.arc(centerX, centerY - 2 * scale, 5 * scale, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(centerX - 3 * scale, centerY + 6 * scale);
    context.lineTo(centerX + 3 * scale, centerY + 6 * scale);
    context.moveTo(centerX - 1.5 * scale, centerY + 9 * scale);
    context.lineTo(centerX + 1.5 * scale, centerY + 9 * scale);
    context.stroke();
  } else if (icon === 'note') {
    roundRect(context, {
      x: centerX - 7 * scale,
      y: centerY - 8 * scale,
      width: 14 * scale,
      height: 16 * scale,
    }, 4 * scale);
    context.stroke();
    context.beginPath();
    context.moveTo(centerX - 3 * scale, centerY - 10 * scale);
    context.lineTo(centerX - 3 * scale, centerY - 6 * scale);
    context.moveTo(centerX + 3 * scale, centerY - 10 * scale);
    context.lineTo(centerX + 3 * scale, centerY - 6 * scale);
    context.moveTo(centerX - 4 * scale, centerY - 2 * scale);
    context.lineTo(centerX + 4 * scale, centerY - 2 * scale);
    context.moveTo(centerX - 4 * scale, centerY + 2 * scale);
    context.lineTo(centerX + 2 * scale, centerY + 2 * scale);
    context.stroke();
  } else if (icon === 'flag') {
    context.beginPath();
    context.moveTo(centerX - 4 * scale, centerY + 9 * scale);
    context.lineTo(centerX - 4 * scale, centerY - 9 * scale);
    context.lineTo(centerX + 7 * scale, centerY - 5 * scale);
    context.lineTo(centerX - 4 * scale, centerY - 1 * scale);
    context.stroke();
  } else {
    roundRect(context, {
      x: centerX - 7 * scale,
      y: centerY - 9 * scale,
      width: 14 * scale,
      height: 18 * scale,
    }, 4 * scale);
    context.stroke();
    context.beginPath();
    context.moveTo(centerX - 3 * scale, centerY - 11 * scale);
    context.lineTo(centerX - 3 * scale, centerY - 7 * scale);
    context.moveTo(centerX + 3 * scale, centerY - 11 * scale);
    context.lineTo(centerX + 3 * scale, centerY - 7 * scale);
    context.moveTo(centerX - 4 * scale, centerY - 1 * scale);
    context.lineTo(centerX - 1 * scale, centerY + 3 * scale);
    context.lineTo(centerX + 4 * scale, centerY - 5 * scale);
    context.stroke();
  }
  context.restore();
}

function drawDecorSprite(
  context: CanvasRenderingContext2D,
  sheet: WechatImage | null,
  index: number,
  rect: Rect,
): boolean {
  if (!sheet) {
    return false;
  }

  const frameWidth = (sheet.width ?? 2172) / 7;
  const frameHeight = sheet.height ?? 724;
  drawImageFrame(context, sheet, {
    x: frameWidth * index,
    y: 0,
    width: frameWidth,
    height: frameHeight,
  }, rect);
  return true;
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

function drawSticker(
  context: CanvasRenderingContext2D,
  image: WechatImage | null,
  rect: Rect,
  options: {
    rotation?: number;
    alpha?: number;
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetY?: number;
  } = {},
): boolean {
  if (!image) {
    return false;
  }

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  context.save();
  context.globalAlpha = options.alpha ?? 1;
  context.shadowColor = options.shadowColor ?? 'rgba(255, 255, 255, 0.34)';
  context.shadowBlur = options.shadowBlur ?? 16;
  context.shadowOffsetY = options.shadowOffsetY ?? 4;
  context.translate(centerX, centerY);
  context.rotate(((options.rotation ?? 0) * Math.PI) / 180);
  context.drawImage(
    image as unknown as CanvasImageSource,
    -rect.width / 2,
    -rect.height / 2,
    rect.width,
    rect.height,
  );
  context.restore();
  return true;
}

function drawImageFrame(
  context: CanvasRenderingContext2D,
  image: WechatImage,
  sourceRect: Rect,
  targetRect: Rect,
): void {
  context.drawImage(
    image as unknown as CanvasImageSource,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    targetRect.x,
    targetRect.y,
    targetRect.width,
    targetRect.height,
  );
}

function drawLandingTopIconBar(
  context: CanvasRenderingContext2D,
  assets: LandingAssets,
  buttons: TopIconButtonSpec[],
  pressedId: string | null,
): void {
  const minX = Math.min(...buttons.map((button) => button.rect.x));
  const minY = Math.min(...buttons.map((button) => button.rect.y));
  const maxX = Math.max(...buttons.map((button) => button.rect.x + button.rect.width));
  const maxY = Math.max(...buttons.map((button) => button.rect.y + button.rect.height));
  const barRect = {
    x: minX - 10,
    y: Math.max(2, minY - 8),
    width: maxX - minX + 20,
    height: maxY - minY + 16,
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
  buttons: TopIconButtonSpec[],
  pressedId: string | null,
  assets: LandingAssets,
): void {
  const minX = Math.min(...buttons.map((button) => button.rect.x));
  const minY = Math.min(...buttons.map((button) => button.rect.y));
  const maxX = Math.max(...buttons.map((button) => button.rect.x + button.rect.width));
  const maxY = Math.max(...buttons.map((button) => button.rect.y + button.rect.height));
  const barRect = {
    x: minX - 8,
    y: Math.max(0, minY - 10),
    width: maxX - minX + 16,
    height: maxY - minY + 14,
  };

  context.save();
  const barGradient = context.createLinearGradient(barRect.x, barRect.y, barRect.x, barRect.y + barRect.height);
  barGradient.addColorStop(0, 'rgba(255,255,255,0.36)');
  barGradient.addColorStop(1, 'rgba(255,255,255,0.18)');
  context.fillStyle = barGradient;
  context.strokeStyle = 'rgba(255,255,255,0.95)';
  context.lineWidth = 1.6;
  context.shadowColor = 'rgba(255,255,255,0.9)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 0;
  roundRect(context, barRect, barRect.height / 2);
  context.fill();
  context.stroke();
  context.shadowColor = 'transparent';

  context.strokeStyle = 'rgba(255,255,255,0.28)';
  context.lineWidth = 1.1;
  context.beginPath();
  context.moveTo(barRect.x + barRect.width / 2, barRect.y + 7);
  context.lineTo(barRect.x + barRect.width / 2, barRect.y + barRect.height - 7);
  context.stroke();

  buttons.forEach((button) => {
    const pressed = pressedId === `icon:${button.id}`;
    const renderRect = {
      ...button.rect,
      y: button.rect.y + (pressed ? 1.5 : 0),
    };
    if (button.id === 'settings' && assets.sunIcon) {
      drawImageFit(context, assets.sunIcon, renderRect);
    } else if (button.id === 'leaderboardTop' && assets.trophyIcon) {
      drawImageFit(context, assets.trophyIcon, renderRect);
    } else if (button.id === 'settings') {
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

function drawInfoMenuPill(
  context: CanvasRenderingContext2D,
  rect: Rect,
  pressed: boolean,
): void {
  const renderRect = {
    ...rect,
    y: rect.y + (pressed ? 1.5 : 0),
  };
  const gradient = context.createLinearGradient(
    renderRect.x,
    renderRect.y,
    renderRect.x,
    renderRect.y + renderRect.height,
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.24)');

  context.save();
  context.fillStyle = gradient;
  context.strokeStyle = 'rgba(255,255,255,0.96)';
  context.lineWidth = 1.2;
  context.shadowColor = 'rgba(145, 112, 153, 0.18)';
  context.shadowBlur = 14;
  context.shadowOffsetY = 4;
  roundRect(context, renderRect, renderRect.height / 2);
  context.fill();
  context.shadowColor = 'transparent';
  context.stroke();

  context.strokeStyle = 'rgba(255,255,255,0.88)';
  context.lineWidth = 1.1;
  context.beginPath();
  context.moveTo(renderRect.x + renderRect.width * 0.58, renderRect.y + 6);
  context.lineTo(renderRect.x + renderRect.width * 0.58, renderRect.y + renderRect.height - 6);
  context.stroke();

  context.fillStyle = '#ffffff';
  const dotY = renderRect.y + renderRect.height / 2;
  [renderRect.x + 20, renderRect.x + 30, renderRect.x + 40].forEach((dotX) => {
    context.beginPath();
    context.arc(dotX, dotY, 3.2, 0, Math.PI * 2);
    context.fill();
  });

  const ringX = renderRect.x + renderRect.width - 20;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2.2;
  context.beginPath();
  context.arc(ringX, dotY, 10, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 1.4;
  context.beginPath();
  context.arc(ringX, dotY, 4.5, 0, Math.PI * 2);
  context.stroke();
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
        fillStart: '#ffd469',
        fillEnd: '#ffb649',
        textColor: '#ffffff',
        iconColor: '#ffffff',
        stroke: 'rgba(255,255,255,0.9)',
      };
    case 'undo':
      return {
        fillStart: '#cba6ff',
        fillEnd: '#9c7bf1',
        textColor: '#ffffff',
        iconColor: '#ffffff',
        stroke: 'rgba(255,255,255,0.92)',
      };
    case 'restart':
      return {
        fillStart: '#ff938d',
        fillEnd: '#ff6b74',
        textColor: '#ffffff',
        iconColor: '#ffffff',
        stroke: 'rgba(255,255,255,0.92)',
      };
    case 'hint':
      return {
        fillStart: '#ffb6df',
        fillEnd: '#f48ec8',
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
  spriteSheet?: WechatImage | null,
): void {
  if (spriteSheet) {
    const frameWidth = (spriteSheet.width ?? 2172) / 5;
    const frameHeight = spriteSheet.height ?? 724;
    const frameIndexMap: Record<ButtonSpec['id'], number> = {
      levels: 0,
      undo: 1,
      restart: 2,
      hint: 3,
      next: 4,
    };
    const frameIndex = frameIndexMap[button.id];
    const iconRect = {
      x: button.rect.x + button.rect.width * 0.18,
      y: button.rect.y + button.rect.height * 0.12,
      width: button.rect.width * 0.64,
      height: button.rect.height * 0.42,
    };
    drawImageFrame(context, spriteSheet, {
      x: frameWidth * frameIndex,
      y: 0,
      width: frameWidth,
      height: frameHeight,
    }, iconRect);
    return;
  }

  const centerX = button.rect.x + button.rect.width / 2;
  const centerY = button.rect.y + button.rect.height * 0.38;
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
    gameplayBackground: null,
    newGameButton: null,
    leaderboardButton: null,
    checkIcon: null,
    helpIcon: null,
    sunIcon: null,
    trophyIcon: null,
    lightbulbIcon: null,
    noteIcon: null,
    flagIcon: null,
    checklistIcon: null,
    cloudFaceIcon: null,
    mascotCatCloud: null,
    bottomButtonIcons: null,
    decorSheet: null,
    selectionStrawberry: null,
    selectionHeartPink: null,
    selectionStarYellow: null,
    selectionSparkleWhite: null,
    selectionBubblePink: null,
    selectionBubbleYellow: null,
    selectionDripYellow: null,
    settingsCloudSmileHeart: null,
    settingsStarPinkBig: null,
    settingsMusicBadge: null,
    settingsVibrationBadge: null,
    settingsCloudClusterLeft: null,
    settingsHeartCorner: null,
    settingsHeartSmall: null,
    settingsSparkleWhite: null,
    settingsStarYellowSmall: null,
    levelPanelCloudLeft: null,
    levelPanelCloudRight: null,
    levelPanelCloudSmileHeart: null,
    levelPanelHeartPink: null,
    levelPanelRibbonPink: null,
    leaderboardRibbonPurple: null,
    leaderboardBunnyPeekLeft: null,
    leaderboardRainbowCloud: null,
    leaderboardEmptyTrophyBunny: null,
    levelPanelStarBigYellow: null,
    levelPanelStarBlue: null,
    levelPanelStarFaceYellow: null,
    levelPanelStarPink: null,
    levelPanelSparkleWhite: null,
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
  const backgroundMusic = new BackgroundMusic(WECHAT_ASSET_PATHS.backgroundMusic);
  audio.setEnabled(userSettings.soundEnabled);
  backgroundMusic.setEnabled(userSettings.soundEnabled);
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
  let infoDialogLeaderboardButtonRect: Rect | null = null;
  let infoDialogMenuRect: Rect | null = null;
  let infoDialogTopButtons: TopIconButtonSpec[] = [];
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
  let infoDialogOpenAt = 0;

  const [
    backgroundImage,
    gameplayBackgroundImage,
    newGameButtonImage,
    leaderboardButtonImage,
    checkIconImage,
    helpIconImage,
    sunIconImage,
    trophyIconImage,
    lightbulbIconImage,
    noteIconImage,
    flagIconImage,
    checklistIconImage,
    cloudFaceIconImage,
    mascotCatCloudImage,
    bottomButtonIconsImage,
    decorSheetImage,
    selectionStrawberryImage,
    selectionHeartPinkImage,
    selectionStarYellowImage,
    selectionSparkleWhiteImage,
    selectionBubblePinkImage,
    selectionBubbleYellowImage,
    selectionDripYellowImage,
    settingsCloudSmileHeartImage,
    settingsStarPinkBigImage,
    settingsMusicBadgeImage,
    settingsVibrationBadgeImage,
    settingsCloudClusterLeftImage,
    settingsHeartCornerImage,
    settingsHeartSmallImage,
    settingsSparkleWhiteImage,
    settingsStarYellowSmallImage,
    levelPanelCloudLeftImage,
    levelPanelCloudRightImage,
    levelPanelCloudSmileHeartImage,
    levelPanelHeartPinkImage,
    levelPanelRibbonPinkImage,
    leaderboardRibbonPurpleImage,
    leaderboardBunnyPeekLeftImage,
    leaderboardRainbowCloudImage,
    leaderboardEmptyTrophyBunnyImage,
    levelPanelStarBigYellowImage,
    levelPanelStarBlueImage,
    levelPanelStarFaceYellowImage,
    levelPanelStarPinkImage,
    levelPanelSparkleWhiteImage,
  ] = await Promise.all([
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.background),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.gameplayBackground),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.newGameButton),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardButton),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.checkIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.helpIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.sunIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.trophyIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.lightbulbIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.noteIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.flagIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.checklistIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.cloudFaceIcon),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.mascotCatCloud),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.bottomButtonIcons),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.decorSheet),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionStrawberry),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionHeartPink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionStarYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionSparkleWhite),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionBubblePink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionBubbleYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.selectionDripYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsCloudSmileHeart),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsStarPinkBig),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsMusicBadge),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsVibrationBadge),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsCloudClusterLeft),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsHeartCorner),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsHeartSmall),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsSparkleWhite),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.settingsStarYellowSmall),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelCloudLeft),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelCloudRight),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelCloudSmileHeart),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelHeartPink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelRibbonPink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardRibbonPurple),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardBunnyPeekLeft),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardRainbowCloud),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.leaderboardEmptyTrophyBunny),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelStarBigYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelStarBlue),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelStarFaceYellow),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelStarPink),
    loadWechatImage(canvas, WECHAT_ASSET_PATHS.levelPanelSparkleWhite),
  ]);

  landingAssets.background = backgroundImage;
  landingAssets.gameplayBackground = gameplayBackgroundImage;
  landingAssets.newGameButton = newGameButtonImage;
  landingAssets.leaderboardButton = leaderboardButtonImage;
  landingAssets.checkIcon = checkIconImage;
  landingAssets.helpIcon = helpIconImage;
  landingAssets.sunIcon = sunIconImage;
  landingAssets.trophyIcon = trophyIconImage;
  landingAssets.lightbulbIcon = lightbulbIconImage;
  landingAssets.noteIcon = noteIconImage;
  landingAssets.flagIcon = flagIconImage;
  landingAssets.checklistIcon = checklistIconImage;
  landingAssets.cloudFaceIcon = cloudFaceIconImage;
  landingAssets.mascotCatCloud = mascotCatCloudImage;
  landingAssets.bottomButtonIcons = bottomButtonIconsImage;
  landingAssets.decorSheet = decorSheetImage;
  landingAssets.selectionStrawberry = selectionStrawberryImage;
  landingAssets.selectionHeartPink = selectionHeartPinkImage;
  landingAssets.selectionStarYellow = selectionStarYellowImage;
  landingAssets.selectionSparkleWhite = selectionSparkleWhiteImage;
  landingAssets.selectionBubblePink = selectionBubblePinkImage;
  landingAssets.selectionBubbleYellow = selectionBubbleYellowImage;
  landingAssets.selectionDripYellow = selectionDripYellowImage;
  landingAssets.settingsCloudSmileHeart = settingsCloudSmileHeartImage;
  landingAssets.settingsStarPinkBig = settingsStarPinkBigImage;
  landingAssets.settingsMusicBadge = settingsMusicBadgeImage;
  landingAssets.settingsVibrationBadge = settingsVibrationBadgeImage;
  landingAssets.settingsCloudClusterLeft = settingsCloudClusterLeftImage;
  landingAssets.settingsHeartCorner = settingsHeartCornerImage;
  landingAssets.settingsHeartSmall = settingsHeartSmallImage;
  landingAssets.settingsSparkleWhite = settingsSparkleWhiteImage;
  landingAssets.settingsStarYellowSmall = settingsStarYellowSmallImage;
  landingAssets.levelPanelCloudLeft = levelPanelCloudLeftImage;
  landingAssets.levelPanelCloudRight = levelPanelCloudRightImage;
  landingAssets.levelPanelCloudSmileHeart = levelPanelCloudSmileHeartImage;
  landingAssets.levelPanelHeartPink = levelPanelHeartPinkImage;
  landingAssets.levelPanelRibbonPink = levelPanelRibbonPinkImage;
  landingAssets.leaderboardRibbonPurple = leaderboardRibbonPurpleImage;
  landingAssets.leaderboardBunnyPeekLeft = leaderboardBunnyPeekLeftImage;
  landingAssets.leaderboardRainbowCloud = leaderboardRainbowCloudImage;
  landingAssets.leaderboardEmptyTrophyBunny = leaderboardEmptyTrophyBunnyImage;
  landingAssets.levelPanelStarBigYellow = levelPanelStarBigYellowImage;
  landingAssets.levelPanelStarBlue = levelPanelStarBlueImage;
  landingAssets.levelPanelStarFaceYellow = levelPanelStarFaceYellowImage;
  landingAssets.levelPanelStarPink = levelPanelStarPinkImage;
  landingAssets.levelPanelSparkleWhite = levelPanelSparkleWhiteImage;

  function drawHeader(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    const compact = metrics.height < 780;
    const textStartX = layout.headerRect.x + (compact ? 126 : 138);
    drawCardShell(context, layout.headerRect);
    const topButtonSize = compact ? 34 : 36;
    const topButtonGap = compact ? 10 : 12;
    const topButtonY = Math.max(0, metrics.safeTop - (compact ? 38 : 40));
    gameTopButtons = [
      {
        id: 'settings',
        rect: {
          x: 22,
          y: topButtonY,
          width: topButtonSize,
          height: topButtonSize,
        },
      },
      {
        id: 'leaderboardTop',
        rect: {
          x: 22 + topButtonSize + topButtonGap,
          y: topButtonY,
          width: topButtonSize,
          height: topButtonSize,
        },
      },
    ];
    drawGameTopIconBar(context, gameTopButtons, uiState.pressedUiId, landingAssets);
    drawCatCloudMascot(context, {
      x: layout.headerRect.x + (compact ? 10 : 12),
      y: layout.headerRect.y + (compact ? 12 : 14),
      width: compact ? 92 : 100,
      height: compact ? 92 : 100,
    }, landingAssets.mascotCatCloud);

    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = THEME.textPrimary;
    context.font = `${compact ? '700 24px' : '700 28px'} sans-serif`;
    context.fillText(t(locale, 'app.title'), textStartX, layout.headerRect.y + 18);

    context.fillStyle = THEME.textSecondary;
    context.font = `${compact ? '600 11px' : '600 12px'} sans-serif`;
    context.fillText(
      t(locale, 'level.progress', {
        current: snapshot.levelIndex + 1,
        total: levels.length,
      }),
      textStartX,
      layout.headerRect.y + 50,
    );
    context.fillText(
      t(locale, 'board.meta', {
        width: snapshot.level.width,
        height: snapshot.level.height,
        clues: snapshot.level.clues.length,
      }),
      textStartX + (compact ? 92 : 102),
      layout.headerRect.y + 50,
    );

    context.fillStyle = THEME.textPrimary;
    context.font = `${compact ? '700 15px' : '700 16px'} sans-serif`;
    context.fillText(
      formatLevelName(locale, snapshot.level.number, snapshot.level.titleKey),
      textStartX,
      layout.headerRect.y + 70,
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
            ? '#ffe78f'
            : '#ffe78f';
    const chipEnd =
      snapshot.mode === 'record'
        ? '#c8edff'
        : snapshot.solved
          ? '#c6ffb7'
          : snapshot.preview?.validation.ok
            ? '#ffc948'
            : '#ffc948';
    chipGradient.addColorStop(0, chipStart);
    chipGradient.addColorStop(1, chipEnd);
    context.fillStyle = chipGradient;
    context.strokeStyle = 'rgba(255,255,255,0.94)';
    context.lineWidth = 2;
    roundRect(context, layout.chipRect, layout.chipRect.height / 2);
    context.fill();
    context.stroke();
    context.save();
    context.setLineDash([5, 4]);
    context.strokeStyle = 'rgba(255,255,255,0.9)';
    context.lineWidth = 1.2;
    roundRect(context, {
      x: layout.chipRect.x + 6,
      y: layout.chipRect.y + 5,
      width: layout.chipRect.width - 12,
      height: layout.chipRect.height - 10,
    }, Math.max(10, layout.chipRect.height / 2 - 6));
    context.stroke();
    context.restore();
    context.fillStyle =
      snapshot.mode === 'record'
        ? THEME.info
        : snapshot.solved
          ? THEME.success
          : '#9a5b00';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `${compact ? '700 17px' : '700 19px'} sans-serif`;
    context.fillText(
      snapshot.mode === 'record'
        ? t(locale, 'chip.record')
        : snapshot.solved
          ? t(locale, 'chip.solved')
          : snapshot.preview?.validation.ok
            ? t(locale, 'chip.ready')
            : t(locale, 'chip.active'),
      layout.chipRect.x + layout.chipRect.width / 2,
      layout.chipRect.y + layout.chipRect.height / 2 + 1,
    );
    context.restore();
  }

  function drawInfoCards(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    const compact = metrics.height < 780;
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

    drawCardShell(context, layout.hintRect);
    drawCardShell(context, layout.recordRect);
    drawCardShell(context, layout.progressRect);

    drawCardBadge(context, layout.hintRect.x + 18, layout.hintRect.y + 16, {
      start: '#ffe18d',
      end: '#ffb85f',
      outline: '#ea7e2b',
    }, 'hint', landingAssets.lightbulbIcon);
    drawCardBadge(context, layout.recordRect.x + 18, layout.recordRect.y + 16, {
      start: '#ffd59a',
      end: '#ffb65a',
      outline: '#e5852f',
    }, 'note', landingAssets.noteIcon);
    drawCardBadge(context, layout.progressRect.x + 18, layout.progressRect.y + 16, {
      start: '#bff0b5',
      end: '#93dc86',
      outline: '#57a856',
    }, 'flag', landingAssets.flagIcon);

    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'top';

    context.fillStyle = '#ff4f8d';
    context.font = '700 11px sans-serif';
    context.fillText(t(locale, 'section.hints'), layout.hintRect.x + 42, layout.hintRect.y + 10);
    context.fillStyle = '#ef8f2f';
    context.fillText(t(locale, 'section.record'), layout.recordRect.x + 42, layout.recordRect.y + 10);
    context.fillStyle = '#51a24e';
    context.fillText(t(locale, 'section.progress'), layout.progressRect.x + 42, layout.progressRect.y + 10);

    context.fillStyle = THEME.textPrimary;
    context.font = '700 13px sans-serif';
    context.fillText(recordSummary, layout.recordRect.x + 14, layout.recordRect.y + 34);
    context.fillText(progressPrimary, layout.progressRect.x + 14, layout.progressRect.y + 34);

    context.fillStyle = THEME.textSecondary;
    context.font = '11px sans-serif';
    drawWrappedText(
      context,
      hintText,
      {
        x: layout.hintRect.x + 14,
        y: layout.hintRect.y + 34,
        width: layout.hintRect.width - 24,
        height: layout.hintRect.height - 42,
      },
      {
        font: '11px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 14,
        maxLines: 3,
      },
    );
    drawWrappedText(
      context,
      snapshot.currentRecord
        ? getRecordDetail(locale, snapshot.currentRecord, snapshot.mode)
        : getRecordSummary(locale, snapshot.currentRecord),
      {
        x: layout.recordRect.x + 14,
        y: layout.recordRect.y + 50,
        width: layout.recordRect.width - 24,
        height: layout.recordRect.height - 58,
      },
      {
        font: '10px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 12,
        maxLines: 2,
      },
    );
    drawWrappedText(
      context,
      statusSummary,
      {
        x: layout.progressRect.x + 14,
        y: layout.progressRect.y + 50,
        width: layout.progressRect.width - 24,
        height: layout.progressRect.height - 58,
      },
      {
        font: '10px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 12,
        maxLines: 2,
      },
    );
    context.restore();

    drawCardShell(context, layout.rulesRect);
    const rulesCenterY = layout.rulesRect.y + layout.rulesRect.height / 2;
    const rulesBadgeSize = compact ? 44 : 48;
    const rulesBadgeCenterX = layout.rulesRect.x + (compact ? 34 : 38);
    const rulesTitleX = layout.rulesRect.x + (compact ? 62 : 70);
    const rulesBodyX = layout.rulesRect.x + (compact ? 118 : 128);
    drawCardBadge(context, rulesBadgeCenterX, rulesCenterY, {
      start: '#ffd8dc',
      end: '#ffb0bb',
      outline: '#ef7f8e',
    }, 'rules', landingAssets.checklistIcon, rulesBadgeSize);
    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = '#ff4f8d';
    context.font = '700 12px sans-serif';
    context.fillText(t(locale, 'section.rules'), rulesTitleX, rulesCenterY - 9);
    context.restore();
    drawWrappedText(
      context,
      `${t(locale, 'rule.area')}  ·  ${t(locale, 'rule.singleClue')}  ·  ${t(locale, 'rule.cover')}`,
      {
        x: rulesBodyX,
        y: rulesCenterY - 16,
        width: layout.rulesRect.width - (rulesBodyX - layout.rulesRect.x) - 16,
        height: 34,
      },
      {
        font: '11px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 16,
        maxLines: 2,
      },
    );
  }

  function drawButtons(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    const gap = 6;
    const buttonHeight = layout.actionsRect.height;
    const actionWidth = Math.floor((layout.actionsRect.width - gap * 4) / 5);

    buttons = [
      {
        id: 'levels',
        label: t(locale, 'section.levels'),
        rect: {
          x: layout.actionsRect.x,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight,
        },
        enabled: true,
      },
      {
        id: 'undo',
        label: t(locale, 'button.undo'),
        rect: {
          x: layout.actionsRect.x + (actionWidth + gap),
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
          x: layout.actionsRect.x + (actionWidth + gap) * 2,
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
          x: layout.actionsRect.x + (actionWidth + gap) * 3,
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
          x: layout.actionsRect.x + (actionWidth + gap) * 4,
          y: layout.actionsRect.y,
          width: actionWidth,
          height: buttonHeight,
        },
        enabled: snapshot.hasNextLevel,
      },
    ];

    context.save();
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
      context.lineWidth = 2;
      context.shadowColor = 'rgba(177, 113, 143, 0.18)';
      context.shadowBlur = 12;
      context.shadowOffsetY = 5;
      roundRect(context, buttonRect, 20);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();

      context.fillStyle = 'rgba(255,255,255,0.26)';
      roundRect(context, {
        x: buttonRect.x + 8,
        y: buttonRect.y + 6,
        width: buttonRect.width - 16,
        height: Math.max(14, buttonRect.height * 0.22),
      }, 10);
      context.fill();

      drawToolbarIcon(
        context,
        { ...button, rect: buttonRect },
        style.iconColor,
        landingAssets.bottomButtonIcons,
      );

      context.fillStyle = style.textColor;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '700 12px sans-serif';
      context.fillText(
        button.label,
        buttonRect.x + buttonRect.width / 2,
        buttonRect.y + buttonRect.height - 18,
      );
    }
    context.restore();
  }

  function drawBoardDecorations(): void {
    const context = surface.getContext2D();
    const boardRect = renderer.getBoardSurfaceRect();

    if (landingAssets.cloudFaceIcon) {
      drawImageFit(context, landingAssets.cloudFaceIcon, {
        x: boardRect.x + boardRect.width - 66,
        y: boardRect.y + boardRect.height - 34,
        width: 72,
        height: 54,
      });
    }

    if (landingAssets.decorSheet) {
      drawDecorSprite(context, landingAssets.decorSheet, 0, {
        x: boardRect.x - 22,
        y: boardRect.y - 18,
        width: 28,
        height: 28,
      });
      drawDecorSprite(context, landingAssets.decorSheet, 1, {
        x: boardRect.x + boardRect.width - 10,
        y: boardRect.y + 8,
        width: 22,
        height: 22,
      });
      drawDecorSprite(context, landingAssets.decorSheet, 2, {
        x: boardRect.x - 18,
        y: boardRect.y + boardRect.height - 14,
        width: 30,
        height: 30,
      });
      drawDecorSprite(context, landingAssets.decorSheet, 4, {
        x: layout.rulesRect.x + layout.rulesRect.width - 20,
        y: layout.rulesRect.y + 8,
        width: 16,
        height: 16,
      });
    }
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
    const iconBarY = Math.max(2, metrics.safeTop - 24);
    const iconBarX = 14;
    const iconBarWidth = 148;
    const iconBarHeight = 62;
    const iconSize = 50;
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

    drawLandingTopIconBar(context, landingAssets, topIconButtons, uiState.pressedUiId);

    context.restore();
  }

  function drawInfoDialog(mode: 'help' | 'goal'): void {
    const context = surface.getContext2D();
    const compact = metrics.height < 780;
    const openProgress = infoDialogOpenAt > 0 ? Math.min(1, (Date.now() - infoDialogOpenAt) / 240) : 1;
    const pop = 0.96 + 0.04 * (1 - Math.pow(1 - openProgress, 3));
    const topButtonY = Math.max(0, metrics.safeTop - (compact ? 38 : 40));
    infoDialogTopButtons = [];

    const menuRect = {
      x: metrics.width - (compact ? 136 : 144),
      y: topButtonY,
      width: compact ? 118 : 126,
      height: compact ? 34 : 36,
    };
    infoDialogMenuRect = menuRect;

    const panelWidth = Math.min(metrics.width - (compact ? 24 : 30), compact ? 340 : 368);
    const panelHeight = mode === 'help' ? (compact ? 576 : 624) : (compact ? 514 : 560);
    const panelRect = {
      x: (metrics.width - panelWidth) / 2,
      y: topButtonY + menuRect.height + (compact ? 20 : 24),
      width: panelWidth,
      height: panelHeight,
    };
    infoDialogPanelRect = panelRect;

    const renderPanelRect = {
      x: panelRect.x + (1 - pop) * panelRect.width / 2,
      y: panelRect.y + (1 - pop) * panelRect.height / 2 - (1 - pop) * 10,
      width: panelRect.width * pop,
      height: panelRect.height * pop,
    };

    const ruleHeaderHeight = compact ? 36 : 38;
    const ruleCardHeight = mode === 'help' ? (compact ? 198 : 214) : (compact ? 168 : 182);
    const toolHeaderHeight = compact ? 36 : 38;
    const toolCardHeight = compact ? 130 : 142;
    const buttonHeight = compact ? 48 : 50;
    const buttonWidth = Math.min(renderPanelRect.width - 84, compact ? 176 : 188);
    const closeButtonRect = {
      x: renderPanelRect.x + (renderPanelRect.width - buttonWidth) / 2,
      y: renderPanelRect.y + renderPanelRect.height - buttonHeight - (compact ? 18 : 20),
      width: buttonWidth,
      height: buttonHeight,
    };
    infoDialogButtonRect = closeButtonRect;
    infoDialogLeaderboardButtonRect = null;

    const drawPillLabel = (
      rect: Rect,
      fillStart: string,
      fillEnd: string,
      text: string,
      textColor: string,
      iconColor: string,
    ): void => {
      const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
      gradient.addColorStop(0, fillStart);
      gradient.addColorStop(1, fillEnd);
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = 'rgba(255,255,255,0.95)';
      context.lineWidth = 1.2;
      context.shadowColor = 'rgba(188, 115, 149, 0.16)';
      context.shadowBlur = 10;
      context.shadowOffsetY = 4;
      roundRect(context, rect, rect.height / 2);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();
      context.fillStyle = iconColor;
      context.beginPath();
      context.arc(rect.x + 18, rect.y + rect.height / 2, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = '700 11px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('✿', rect.x + 18, rect.y + rect.height / 2 + 0.2);
      context.fillStyle = textColor;
      context.font = '700 16px sans-serif';
      context.textAlign = 'left';
      context.fillText(text, rect.x + 32, rect.y + rect.height / 2 + 0.5);
      context.restore();
    };

    const drawNumberBadge = (centerX: number, centerY: number, value: number): void => {
      const size = compact ? 26 : 28;
      const gradient = context.createLinearGradient(centerX, centerY - size / 2, centerX, centerY + size / 2);
      gradient.addColorStop(0, '#fff3f7');
      gradient.addColorStop(1, '#ffd7e5');
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = 'rgba(255, 166, 189, 0.92)';
      context.lineWidth = 2;
      context.shadowColor = 'rgba(188, 115, 149, 0.12)';
      context.shadowBlur = 8;
      context.shadowOffsetY = 3;
      context.beginPath();
      context.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();
      context.fillStyle = '#ff5b8f';
      context.font = `700 ${compact ? 14 : 15}px sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(value), centerX, centerY + 0.5);
      context.restore();
    };

    const drawFeatureBadge = (
      rect: Rect,
      fillStart: string,
      fillEnd: string,
      glyph: string,
    ): void => {
      const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
      gradient.addColorStop(0, fillStart);
      gradient.addColorStop(1, fillEnd);
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = 'rgba(255,255,255,0.92)';
      context.lineWidth = 1.4;
      context.shadowColor = 'rgba(188, 115, 149, 0.16)';
      context.shadowBlur = 10;
      context.shadowOffsetY = 4;
      roundRect(context, rect, 8);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '700 13px sans-serif';
      context.fillText(glyph, rect.x + rect.width / 2, rect.y + rect.height / 2 + 0.5);
      context.restore();
    };

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

    context.save();
    const overlayGradient = context.createLinearGradient(0, 0, 0, metrics.height);
    overlayGradient.addColorStop(0, 'rgba(255, 199, 222, 0.34)');
    overlayGradient.addColorStop(0.55, 'rgba(255, 250, 252, 0.18)');
    overlayGradient.addColorStop(1, 'rgba(161, 210, 255, 0.18)');
    context.fillStyle = overlayGradient;
    context.fillRect(0, 0, metrics.width, metrics.height);
    context.restore();

    drawInfoMenuPill(context, menuRect, uiState.pressedUiId === 'dialog:menu');

    context.save();
    const panelGradient = context.createLinearGradient(
      renderPanelRect.x,
      renderPanelRect.y,
      renderPanelRect.x,
      renderPanelRect.y + renderPanelRect.height,
    );
    panelGradient.addColorStop(0, 'rgba(255, 252, 244, 0.96)');
    panelGradient.addColorStop(1, 'rgba(255, 244, 231, 0.96)');
    context.fillStyle = panelGradient;
    context.strokeStyle = 'rgba(255, 184, 198, 0.90)';
    context.lineWidth = 3.8;
    context.shadowColor = 'rgba(120, 70, 100, 0.22)';
    context.shadowBlur = 24;
    context.shadowOffsetY = 10;
    roundRect(context, renderPanelRect, compact ? 38 : 42);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();
    context.save();
    context.setLineDash([7, 6]);
    context.strokeStyle = 'rgba(255, 165, 188, 0.66)';
    context.lineWidth = 1.5;
    roundRect(context, {
      x: renderPanelRect.x + 8,
      y: renderPanelRect.y + 8,
      width: renderPanelRect.width - 16,
      height: renderPanelRect.height - 16,
    }, compact ? 32 : 36);
    context.stroke();
    context.restore();
    context.restore();

    if (landingAssets.levelPanelCloudLeft) {
      drawSticker(context, landingAssets.levelPanelCloudLeft, {
        x: renderPanelRect.x - 18,
        y: renderPanelRect.y + renderPanelRect.height - (compact ? 52 : 58),
        width: compact ? 60 : 66,
        height: compact ? 46 : 52,
      }, { shadowBlur: 6, alpha: 0.98 });
    }
    if (landingAssets.levelPanelCloudRight) {
      drawSticker(context, landingAssets.levelPanelCloudRight, {
        x: renderPanelRect.x + renderPanelRect.width - (compact ? 52 : 58),
        y: renderPanelRect.y + renderPanelRect.height - (compact ? 50 : 56),
        width: compact ? 58 : 64,
        height: compact ? 50 : 56,
      }, { shadowBlur: 6, alpha: 0.98 });
    }
    if (landingAssets.levelPanelStarBigYellow) {
      drawSticker(context, landingAssets.levelPanelStarBigYellow, {
        x: renderPanelRect.x - 26,
        y: renderPanelRect.y + 12,
        width: compact ? 50 : 56,
        height: compact ? 50 : 56,
      }, { shadowBlur: 4, alpha: 0.92 });
    }
    if (landingAssets.levelPanelStarPink) {
      drawSticker(context, landingAssets.levelPanelStarPink, {
        x: renderPanelRect.x + renderPanelRect.width - (compact ? 34 : 38),
        y: renderPanelRect.y + 82,
        width: compact ? 28 : 32,
        height: compact ? 28 : 32,
      }, { shadowBlur: 4, alpha: 0.94 });
    }
    if (landingAssets.levelPanelSparkleWhite) {
      drawSticker(context, landingAssets.levelPanelSparkleWhite, {
        x: renderPanelRect.x + 18,
        y: renderPanelRect.y + 58,
        width: 16,
        height: 16,
      }, { shadowBlur: 3, alpha: 0.88 });
    }

    const ribbonRect = {
      x: renderPanelRect.x + 28,
      y: renderPanelRect.y - (compact ? 24 : 28),
      width: renderPanelRect.width - 56,
      height: compact ? 68 : 72,
    };
    if (landingAssets.levelPanelRibbonPink) {
      drawSticker(context, landingAssets.levelPanelRibbonPink, ribbonRect, {
        shadowBlur: 10,
        shadowOffsetY: 4,
        alpha: 0.98,
      });
    } else {
      const ribbonGradient = context.createLinearGradient(ribbonRect.x, ribbonRect.y, ribbonRect.x, ribbonRect.y + ribbonRect.height);
      ribbonGradient.addColorStop(0, '#ffa6c7');
      ribbonGradient.addColorStop(1, '#ff7fb1');
      context.save();
      context.fillStyle = ribbonGradient;
      context.strokeStyle = 'rgba(255,255,255,0.92)';
      context.lineWidth = 1.4;
      context.shadowColor = 'rgba(186, 88, 132, 0.25)';
      context.shadowBlur = 14;
      context.shadowOffsetY = 5;
      roundRect(context, ribbonRect, ribbonRect.height / 2);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();
      context.beginPath();
      context.moveTo(ribbonRect.x + 14, ribbonRect.y + 8);
      context.lineTo(ribbonRect.x - 18, ribbonRect.y + ribbonRect.height / 2);
      context.lineTo(ribbonRect.x + 14, ribbonRect.y + ribbonRect.height - 8);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(ribbonRect.x + ribbonRect.width - 14, ribbonRect.y + 8);
      context.lineTo(ribbonRect.x + ribbonRect.width + 18, ribbonRect.y + ribbonRect.height / 2);
      context.lineTo(ribbonRect.x + ribbonRect.width - 14, ribbonRect.y + ribbonRect.height - 8);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }

    drawRuleBunnyPeek(context, {
      x: ribbonRect.x + ribbonRect.width - (compact ? 82 : 92),
      y: ribbonRect.y - (compact ? 8 : 10),
      width: compact ? 78 : 88,
      height: compact ? 78 : 88,
    });

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 6;
    context.strokeStyle = '#ffffff';
    context.fillStyle = '#ff5fa3';
    context.font = `${compact ? '900 31px' : '900 34px'} sans-serif`;
    const titleText = mode === 'help' ? t(locale, 'landing.helpTitle') : t(locale, 'landing.goalTitle');
    context.strokeText(titleText, ribbonRect.x + ribbonRect.width / 2 - 8, ribbonRect.y + ribbonRect.height / 2 + 2);
    context.fillText(titleText, ribbonRect.x + ribbonRect.width / 2 - 8, ribbonRect.y + ribbonRect.height / 2 + 2);
    context.restore();

    const sectionTop = renderPanelRect.y + (compact ? 76 : 82);
    const sectionTitleRect = {
      x: renderPanelRect.x + 16,
      y: sectionTop,
      width: compact ? 160 : 172,
      height: ruleHeaderHeight,
    };
    drawPillLabel(
      sectionTitleRect,
      mode === 'help' ? '#ffe7ee' : '#efe4ff',
      mode === 'help' ? '#ffd0df' : '#dac8ff',
      mode === 'help' ? t(locale, 'landing.ruleSection') : t(locale, 'landing.goalSection'),
      mode === 'help' ? '#ff5fa3' : '#8b67df',
      mode === 'help' ? '#ff9dbc' : '#b79aff',
    );

    const ruleCardRect = {
      x: renderPanelRect.x + 16,
      y: sectionTitleRect.y + (compact ? 36 : 40),
      width: renderPanelRect.width - 32,
      height: ruleCardHeight,
    };
    drawTextFrame(context, ruleCardRect, {
      radius: 18,
      fill: 'rgba(255,255,255,0.72)',
      stroke: 'rgba(236, 226, 246, 0.95)',
    });

    const maxRules = mode === 'help' ? 4 : 3;
    const ruleRowStep = mode === 'help' ? (compact ? 42 : 46) : (compact ? 50 : 54);
    const ruleRowTop = compact ? 24 : 26;
    bodyLines.slice(0, maxRules).forEach((line, index) => {
      const rowY = ruleCardRect.y + ruleRowTop + index * ruleRowStep;
      drawNumberBadge(ruleCardRect.x + 20, rowY + 11, index + 1);
      drawWrappedText(
        context,
        line,
        {
          x: ruleCardRect.x + 42,
          y: rowY,
          width: ruleCardRect.width - 58,
          height: ruleRowStep - 6,
        },
        {
          font: `${compact ? '12px' : '13px'} sans-serif`,
          color: THEME.textPrimary,
          lineHeight: compact ? 15 : 16,
          maxLines: 2,
        },
      );
    });

    if (mode === 'help') {
      const toolHeaderRect = {
        x: renderPanelRect.x + 16,
        y: ruleCardRect.y + ruleCardRect.height + (compact ? 24 : 26),
        width: compact ? 166 : 178,
        height: toolHeaderHeight,
      };
      drawPillLabel(
        toolHeaderRect,
        '#f1e7ff',
        '#e4d3ff',
        t(locale, 'landing.toolSection'),
        '#8f61df',
        '#b892ff',
      );

      const toolCardRect = {
        x: renderPanelRect.x + 16,
        y: toolHeaderRect.y + (compact ? 36 : 38),
        width: renderPanelRect.width - 32,
        height: toolCardHeight,
      };
      drawTextFrame(context, toolCardRect, {
        radius: 18,
        fill: 'rgba(255,255,255,0.72)',
        stroke: 'rgba(236, 226, 246, 0.95)',
      });

      const toolRows = [
        { fillStart: '#7cc8ff', fillEnd: '#4ba4ea', glyph: '?', text: t(locale, 'landing.toolHint') },
        { fillStart: '#ffc878', fillEnd: '#ff9e34', glyph: '↶', text: t(locale, 'landing.toolUndo') },
        { fillStart: '#ffb2d4', fillEnd: '#ef7bb0', glyph: '↺', text: t(locale, 'landing.toolRestart') },
      ];

      toolRows.forEach((tool, index) => {
        const rowTop = toolCardRect.y + (compact ? 16 : 18) + index * (compact ? 36 : 38);
        const iconRect = {
          x: toolCardRect.x + 14,
          y: rowTop,
          width: compact ? 24 : 26,
          height: compact ? 24 : 26,
        };
        drawFeatureBadge(iconRect, tool.fillStart, tool.fillEnd, tool.glyph);
        drawWrappedText(
          context,
          tool.text,
          {
            x: iconRect.x + (compact ? 34 : 38),
            y: rowTop - 1,
            width: toolCardRect.width - (compact ? 52 : 56),
            height: 26,
          },
          {
            font: `${compact ? '12px' : '13px'} sans-serif`,
            color: THEME.textPrimary,
            lineHeight: compact ? 15 : 16,
            maxLines: 1,
          },
        );
      });
    }

    const closeGradient = context.createLinearGradient(
      closeButtonRect.x,
      closeButtonRect.y,
      closeButtonRect.x,
      closeButtonRect.y + closeButtonRect.height,
    );
    closeGradient.addColorStop(0, '#5fbaf6');
    closeGradient.addColorStop(1, '#2c89f3');
    context.save();
    context.fillStyle = closeGradient;
    context.strokeStyle = 'rgba(255,255,255,0.95)';
    context.lineWidth = 1.2;
    context.shadowColor = 'rgba(83, 143, 232, 0.24)';
    context.shadowBlur = 14;
    context.shadowOffsetY = 6;
    roundRect(context, closeButtonRect, closeButtonRect.height / 2);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();
    context.save();
    context.setLineDash([5, 4]);
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    context.lineWidth = 1.1;
    roundRect(context, {
      x: closeButtonRect.x + 6,
      y: closeButtonRect.y + 6,
      width: closeButtonRect.width - 12,
      height: closeButtonRect.height - 12,
    }, closeButtonRect.height / 2 - 5);
    context.stroke();
    context.restore();
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 16px sans-serif';
    context.fillText(
      t(locale, 'landing.gotIt'),
      closeButtonRect.x + closeButtonRect.width / 2,
      closeButtonRect.y + closeButtonRect.height / 2 + 1,
    );
    context.restore();
  }

  function drawSettingsDialog(): void {
    const context = surface.getContext2D();
    const panelWidth = Math.min(metrics.width - 32, 286);
    const panelHeight = Math.min(metrics.height - 88, 430);
    const panelRect = {
      x: (metrics.width - panelWidth) / 2,
      y: Math.max(metrics.safeTop + 42, (metrics.height - panelHeight) / 2 + 2),
      width: panelWidth,
      height: panelHeight,
    };
    settingsDialogPanelRect = panelRect;

    const rowX = panelRect.x + 16;
    const rowWidth = panelRect.width - 32;
    const rowHeight = 72;
    const rowGap = 10;
    const row1Rect = {
      x: rowX,
      y: panelRect.y + 96,
      width: rowWidth,
      height: rowHeight,
    };
    const row2Rect = {
      x: rowX,
      y: row1Rect.y + rowHeight + rowGap,
      width: rowWidth,
      height: rowHeight,
    };
    const buttonY = panelRect.y + panelRect.height - 62;
    const buttonWidth = 107;
    const buttonGap = 14;
    const buttonX = panelRect.x + (panelRect.width - buttonWidth * 2 - buttonGap) / 2;
    soundToggleRect = {
      x: row1Rect.x + row1Rect.width - 72,
      y: row1Rect.y + 22,
      width: 54,
      height: 28,
    };
    vibrationToggleRect = {
      x: row2Rect.x + row2Rect.width - 72,
      y: row2Rect.y + 22,
      width: 54,
      height: 28,
    };
    settingsBackButtonRect = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: 42,
    };
    settingsContinueButtonRect = {
      x: buttonX + buttonWidth + buttonGap,
      y: buttonY,
      width: buttonWidth,
      height: 42,
    };

    const drawToggleRow = (
      rowRect: Rect,
      label: string,
      enabled: boolean,
      toggleRect: Rect,
      icon: WechatImage | null,
    ): void => {
      const cardGradient = context.createLinearGradient(
        rowRect.x,
        rowRect.y,
        rowRect.x,
        rowRect.y + rowRect.height,
      );
      cardGradient.addColorStop(0, 'rgba(255, 255, 255, 0.82)');
      cardGradient.addColorStop(1, 'rgba(255, 247, 250, 0.72)');
      context.save();
      context.fillStyle = cardGradient;
      context.strokeStyle = 'rgba(255, 224, 232, 0.96)';
      context.lineWidth = 1.1;
      context.shadowColor = 'rgba(194, 126, 165, 0.16)';
      context.shadowBlur = 14;
      context.shadowOffsetY = 6;
      roundRect(context, rowRect, 18);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();
      context.save();
      context.setLineDash([5, 4]);
      context.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      context.lineWidth = 1;
      roundRect(context, {
        x: rowRect.x + 6,
        y: rowRect.y + 6,
        width: rowRect.width - 12,
        height: rowRect.height - 12,
      }, 14);
      context.stroke();
      context.restore();

      if (icon) {
        drawSticker(context, icon, {
          x: rowRect.x + 10,
          y: rowRect.y + 10,
          width: 42,
          height: 42,
        }, { shadowBlur: 10, shadowOffsetY: 3 });
      }

      context.fillStyle = THEME.textPrimary;
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.font = '700 18px sans-serif';
      context.fillText(label, rowRect.x + 60, rowRect.y + rowRect.height / 2 + 0.5);

      const toggleGradient = context.createLinearGradient(
        toggleRect.x,
        toggleRect.y,
        toggleRect.x,
        toggleRect.y + toggleRect.height,
      );
      if (enabled) {
        toggleGradient.addColorStop(0, '#88df78');
        toggleGradient.addColorStop(1, '#3eaf47');
      } else {
        toggleGradient.addColorStop(0, '#ebe4eb');
        toggleGradient.addColorStop(1, '#d1c7d2');
      }
      context.save();
      context.fillStyle = toggleGradient;
      context.strokeStyle = 'rgba(255,255,255,0.96)';
      context.lineWidth = 1;
      context.shadowColor = enabled ? 'rgba(69, 169, 76, 0.18)' : 'rgba(160, 148, 161, 0.14)';
      context.shadowBlur = 10;
      context.shadowOffsetY = 4;
      roundRect(context, toggleRect, toggleRect.height / 2);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();

      const knobX = enabled
        ? toggleRect.x + toggleRect.width - 12
        : toggleRect.x + 12;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(knobX, toggleRect.y + toggleRect.height / 2, 9, 0, Math.PI * 2);
      context.fill();
      context.restore();

      drawSticker(context, landingAssets.settingsHeartSmall, {
        x: rowRect.x + rowRect.width - 14,
        y: rowRect.y + 20,
        width: 18,
        height: 18,
      }, { shadowBlur: 4, alpha: 0.95 });
    };

    const drawSettingsButton = (
      rect: Rect,
      kind: 'back' | 'continue',
      label: string,
    ): void => {
      const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
      if (kind === 'back') {
        gradient.addColorStop(0, 'rgba(245, 236, 246, 0.98)');
        gradient.addColorStop(1, 'rgba(223, 208, 236, 0.98)');
      } else {
        gradient.addColorStop(0, '#7cc7ff');
        gradient.addColorStop(1, '#4c97f0');
      }

      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = 'rgba(255,255,255,0.96)';
      context.lineWidth = 1.2;
      context.shadowColor = kind === 'back' ? 'rgba(170, 141, 182, 0.18)' : 'rgba(84, 145, 230, 0.24)';
      context.shadowBlur = 14;
      context.shadowOffsetY = 6;
      roundRect(context, rect, 16);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();

      context.save();
      context.setLineDash([5, 4]);
      context.strokeStyle = kind === 'back' ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.92)';
      context.lineWidth = 1.1;
      roundRect(context, {
        x: rect.x + 6,
        y: rect.y + 6,
        width: rect.width - 12,
        height: rect.height - 12,
      }, 12);
      context.stroke();
      context.restore();

      context.fillStyle = kind === 'back' ? '#8a7797' : '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '700 15px sans-serif';
      context.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 0.5);
      context.restore();
    };

    const drawSimpleSparkle = (image: WechatImage | null, x: number, y: number, width: number, height: number, alpha = 1): void => {
      drawSticker(context, image, { x, y, width, height }, { shadowBlur: 5, alpha });
    };

    const drawPanelShell = (): void => {
      const overlayGradient = context.createLinearGradient(0, 0, 0, metrics.height);
      overlayGradient.addColorStop(0, 'rgba(255, 188, 214, 0.38)');
      overlayGradient.addColorStop(0.6, 'rgba(247, 219, 233, 0.30)');
      overlayGradient.addColorStop(1, 'rgba(255, 245, 249, 0.24)');
      context.fillStyle = overlayGradient;
      context.fillRect(0, 0, metrics.width, metrics.height);

      const panelGradient = context.createLinearGradient(
        panelRect.x,
        panelRect.y,
        panelRect.x,
        panelRect.y + panelRect.height,
      );
      panelGradient.addColorStop(0, 'rgba(255, 253, 252, 0.98)');
      panelGradient.addColorStop(1, 'rgba(255, 241, 245, 0.95)');
      context.fillStyle = panelGradient;
      context.strokeStyle = 'rgba(255, 213, 225, 0.98)';
      context.lineWidth = 2;
      context.shadowColor = 'rgba(226, 142, 175, 0.26)';
      context.shadowBlur = 28;
      context.shadowOffsetY = 12;
      roundRect(context, panelRect, 28);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();

      context.save();
      context.setLineDash([6, 5]);
      context.strokeStyle = 'rgba(255,255,255,0.92)';
      context.lineWidth = 1.3;
      roundRect(context, {
        x: panelRect.x + 8,
        y: panelRect.y + 8,
        width: panelRect.width - 16,
        height: panelRect.height - 16,
      }, 22);
      context.stroke();
      context.restore();

      drawSimpleSparkle(landingAssets.settingsCloudSmileHeart, panelRect.x - 36, panelRect.y - 28, 96, 74, 0.98);
      drawSimpleSparkle(landingAssets.settingsStarPinkBig, panelRect.x + panelRect.width - 76, panelRect.y - 18, 58, 58, 0.96);
      drawSimpleSparkle(landingAssets.settingsCloudClusterLeft, panelRect.x - 22, panelRect.y + panelRect.height - 78, 84, 66, 0.94);
      drawSimpleSparkle(landingAssets.settingsHeartCorner, panelRect.x + panelRect.width - 32, panelRect.y + panelRect.height - 38, 38, 38, 0.98);
      drawSimpleSparkle(landingAssets.settingsSparkleWhite, panelRect.x + 18, panelRect.y + 74, 18, 18, 0.92);
      drawSimpleSparkle(landingAssets.settingsSparkleWhite, panelRect.x + panelRect.width - 34, panelRect.y + 94, 14, 14, 0.84);
      drawSimpleSparkle(landingAssets.settingsSparkleWhite, panelRect.x + 38, panelRect.y + panelRect.height - 84, 12, 12, 0.76);
    };

    context.save();
    drawPanelShell();

    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.lineWidth = 5;
    context.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    context.fillStyle = '#6a63d8';
    context.font = '700 28px sans-serif';
    context.shadowColor = 'rgba(255, 194, 220, 0.56)';
    context.shadowBlur = 6;
    context.strokeText(t(locale, 'settings.title'), panelRect.x + panelRect.width / 2, panelRect.y + 18);
    context.fillText(t(locale, 'settings.title'), panelRect.x + panelRect.width / 2, panelRect.y + 18);

    drawToggleRow(
      row1Rect,
      t(locale, 'settings.sound'),
      userSettings.soundEnabled,
      soundToggleRect,
      landingAssets.settingsMusicBadge,
    );
    drawToggleRow(
      row2Rect,
      t(locale, 'settings.vibration'),
      userSettings.vibrationEnabled,
      vibrationToggleRect,
      landingAssets.settingsVibrationBadge,
    );

    context.save();
    context.strokeStyle = 'rgba(245, 205, 148, 0.88)';
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(panelRect.x + 22, panelRect.y + 252);
    context.lineTo(panelRect.x + panelRect.width - 22, panelRect.y + 252);
    context.stroke();
    context.restore();

    drawSimpleSparkle(
      landingAssets.settingsStarYellowSmall,
      panelRect.x + panelRect.width / 2 - 8,
      panelRect.y + 242,
      16,
      16,
      1,
    );

    drawSettingsButton(settingsBackButtonRect, 'back', t(locale, 'settings.backHome'));
    drawSettingsButton(settingsContinueButtonRect, 'continue', t(locale, 'settings.continue'));

    context.restore();
  }

  function drawLeaderboardPanel(): void {
    const context = surface.getContext2D();
    const compact = metrics.height < 780;
    const panelWidth = Math.min(metrics.width - (compact ? 36 : 48), compact ? 336 : 360);
    const panelHeight = Math.min(metrics.height - (compact ? 108 : 128), compact ? 548 : 590);
    const modalTopExtra = compact ? 48 : 52;
    const modalBottomExtra = compact ? 12 : 16;
    const modalVisualHeight = panelHeight + modalTopExtra + modalBottomExtra;
    const panelRect = {
      x: (metrics.width - panelWidth) / 2,
      y: Math.max(
        layout.topInset + modalTopExtra - (compact ? 6 : 8),
        (metrics.height - modalVisualHeight) / 2 + modalTopExtra,
      ),
      width: panelWidth,
      height: panelHeight,
    };
    leaderboardPanelRect = {
      x: panelRect.x - 18,
      y: panelRect.y - modalTopExtra,
      width: panelRect.width + 36,
      height: panelRect.height + modalTopExtra + modalBottomExtra,
    };

    context.save();
    const overlayGradient = context.createLinearGradient(0, 0, 0, metrics.height);
    overlayGradient.addColorStop(0, 'rgba(255, 179, 210, 0.38)');
    overlayGradient.addColorStop(0.55, 'rgba(255, 232, 240, 0.28)');
    overlayGradient.addColorStop(1, 'rgba(255, 245, 250, 0.20)');
    context.fillStyle = overlayGradient;
    context.fillRect(0, 0, metrics.width, metrics.height);
    context.restore();

    const panelGradient = context.createLinearGradient(panelRect.x, panelRect.y, panelRect.x, panelRect.y + panelRect.height);
    panelGradient.addColorStop(0, 'rgba(255, 252, 247, 0.98)');
    panelGradient.addColorStop(1, 'rgba(255, 241, 247, 0.95)');
    context.save();
    context.fillStyle = panelGradient;
    context.strokeStyle = 'rgba(255, 210, 224, 0.98)';
    context.lineWidth = 2.2;
    context.shadowColor = 'rgba(226, 142, 175, 0.26)';
    context.shadowBlur = 30;
    context.shadowOffsetY = 12;
    roundRect(context, panelRect, compact ? 30 : 34);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();
    context.save();
    context.setLineDash([6, 5]);
    context.strokeStyle = 'rgba(255,255,255,0.94)';
    context.lineWidth = 1.3;
    roundRect(context, {
      x: panelRect.x + 8,
      y: panelRect.y + 8,
      width: panelRect.width - 16,
      height: panelRect.height - 16,
    }, compact ? 24 : 28);
    context.stroke();
    context.restore();
    context.restore();

    const drawRibbon = (rect: Rect): void => {
      if (landingAssets.leaderboardRibbonPurple) {
        drawSticker(context, landingAssets.leaderboardRibbonPurple, rect, {
          shadowColor: 'rgba(167, 118, 214, 0.22)',
          shadowBlur: 18,
          shadowOffsetY: 6,
          alpha: 0.98,
        });
        return;
      }

      const gradient = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
      gradient.addColorStop(0, '#dca8ff');
      gradient.addColorStop(1, '#b77bf2');
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = 'rgba(255,255,255,0.96)';
      context.lineWidth = 1.4;
      context.shadowColor = 'rgba(167, 118, 214, 0.24)';
      context.shadowBlur = 18;
      context.shadowOffsetY = 6;
      roundRect(context, rect, rect.height / 2);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();
      context.beginPath();
      context.moveTo(rect.x + 16, rect.y + 10);
      context.lineTo(rect.x - 20, rect.y + rect.height * 0.46);
      context.lineTo(rect.x + 16, rect.y + rect.height - 10);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(rect.x + rect.width - 16, rect.y + 10);
      context.lineTo(rect.x + rect.width + 20, rect.y + rect.height * 0.46);
      context.lineTo(rect.x + rect.width - 16, rect.y + rect.height - 10);
      context.closePath();
      context.fill();
      context.stroke();
      context.save();
      context.setLineDash([7, 5]);
      context.strokeStyle = 'rgba(255,255,255,0.46)';
      context.lineWidth = 1;
      roundRect(context, {
        x: rect.x + 8,
        y: rect.y + 8,
        width: rect.width - 16,
        height: rect.height - 16,
      }, rect.height / 2 - 8);
      context.stroke();
      context.restore();
      context.restore();
    };

    const drawEmptyTrophy = (centerX: number, topY: number, scale: number): void => {
      const cupW = 96 * scale;
      const cupH = 90 * scale;
      const cupX = centerX - cupW / 2;
      const cupY = topY;
      const gradient = context.createLinearGradient(cupX, cupY, cupX, cupY + cupH);
      gradient.addColorStop(0, '#fff3aa');
      gradient.addColorStop(0.55, '#ffd85c');
      gradient.addColorStop(1, '#f4ab12');

      context.save();
      context.shadowColor = 'rgba(255, 193, 72, 0.24)';
      context.shadowBlur = 16;
      context.shadowOffsetY = 6;
      context.fillStyle = gradient;
      context.strokeStyle = 'rgba(255,255,255,0.82)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(cupX + 14 * scale, cupY + 10 * scale);
      context.lineTo(cupX + cupW - 14 * scale, cupY + 10 * scale);
      context.quadraticCurveTo(cupX + cupW - 6 * scale, cupY + 34 * scale, cupX + cupW - 22 * scale, cupY + 46 * scale);
      context.lineTo(cupX + cupW - 28 * scale, cupY + 60 * scale);
      context.lineTo(cupX + cupW - 40 * scale, cupY + 70 * scale);
      context.lineTo(cupX + cupW - 56 * scale, cupY + 70 * scale);
      context.lineTo(cupX + cupW - 58 * scale, cupY + 62 * scale);
      context.lineTo(cupX + cupW - 34 * scale, cupY + 58 * scale);
      context.quadraticCurveTo(cupX + cupW - 10 * scale, cupY + 46 * scale, cupX + cupW - 12 * scale, cupY + 28 * scale);
      context.lineTo(cupX + cupW - 12 * scale, cupY + 16 * scale);
      context.lineTo(cupX + 12 * scale, cupY + 16 * scale);
      context.lineTo(cupX + 12 * scale, cupY + 28 * scale);
      context.quadraticCurveTo(cupX + 10 * scale, cupY + 46 * scale, cupX + 34 * scale, cupY + 58 * scale);
      context.lineTo(cupX + 58 * scale, cupY + 62 * scale);
      context.lineTo(cupX + 56 * scale, cupY + 70 * scale);
      context.lineTo(cupX + 40 * scale, cupY + 70 * scale);
      context.lineTo(cupX + 28 * scale, cupY + 60 * scale);
      context.lineTo(cupX + 22 * scale, cupY + 46 * scale);
      context.quadraticCurveTo(cupX + 6 * scale, cupY + 34 * scale, cupX + 14 * scale, cupY + 10 * scale);
      context.closePath();
      context.fill();
      context.stroke();

      context.lineWidth = 10 * scale;
      context.strokeStyle = 'rgba(255, 226, 118, 0.88)';
      context.beginPath();
      context.moveTo(cupX + 16 * scale, cupY + 18 * scale);
      context.lineTo(cupX + cupW - 16 * scale, cupY + 18 * scale);
      context.stroke();

      context.lineWidth = 2.5 * scale;
      context.strokeStyle = '#f3a61a';
      context.beginPath();
      context.arc(cupX - 8 * scale, cupY + 34 * scale, 16 * scale, -Math.PI * 0.18, Math.PI * 0.75);
      context.stroke();
      context.beginPath();
      context.arc(cupX + cupW + 8 * scale, cupY + 34 * scale, 16 * scale, Math.PI * 0.25, Math.PI * 1.18);
      context.stroke();

      const baseRect = {
        x: centerX - 22 * scale,
        y: cupY + cupH + 6 * scale,
        width: 44 * scale,
        height: 14 * scale,
      };
      const baseGradient = context.createLinearGradient(baseRect.x, baseRect.y, baseRect.x, baseRect.y + baseRect.height);
      baseGradient.addColorStop(0, '#c07cff');
      baseGradient.addColorStop(1, '#8a56ef');
      context.fillStyle = baseGradient;
      context.strokeStyle = 'rgba(255,255,255,0.84)';
      context.lineWidth = 2;
      roundRect(context, baseRect, 6 * scale);
      context.fill();
      context.stroke();
      context.restore();
    };

    const drawEmptyState = (rect: Rect): void => {
      const illustrationRect = {
        x: rect.x + 16,
        y: rect.y + 12,
        width: rect.width - 32,
        height: rect.height * 0.56,
      };
      if (landingAssets.leaderboardEmptyTrophyBunny) {
        const sourceWidth = landingAssets.leaderboardEmptyTrophyBunny.width ?? 1710;
        const sourceHeight = landingAssets.leaderboardEmptyTrophyBunny.height ?? 611;
        const sourceRatio = sourceWidth / sourceHeight;
        const maxWidth = illustrationRect.width - (compact ? 8 : 12);
        const maxHeight = illustrationRect.height * 0.82;
        let drawWidth = maxWidth;
        let drawHeight = drawWidth / sourceRatio;
        if (drawHeight > maxHeight) {
          drawHeight = maxHeight;
          drawWidth = drawHeight * sourceRatio;
        }
        drawSticker(context, landingAssets.leaderboardEmptyTrophyBunny, {
          x: illustrationRect.x + (illustrationRect.width - drawWidth) / 2,
          y: illustrationRect.y + 4,
          width: drawWidth,
          height: drawHeight,
        }, { shadowBlur: 8, alpha: 0.98 });
      } else {
        if (landingAssets.levelPanelCloudSmileHeart) {
          drawSticker(context, landingAssets.levelPanelCloudSmileHeart, {
            x: illustrationRect.x + illustrationRect.width * 0.10,
            y: illustrationRect.y + 14,
            width: 64,
            height: 48,
          }, { shadowBlur: 8, alpha: 0.94 });
        }
        if (landingAssets.levelPanelCloudLeft) {
          drawSticker(context, landingAssets.levelPanelCloudLeft, {
            x: illustrationRect.x + illustrationRect.width * 0.04,
            y: illustrationRect.y + illustrationRect.height * 0.50,
            width: 54,
            height: 42,
          }, { shadowBlur: 6, alpha: 0.86 });
        }
        if (landingAssets.levelPanelCloudRight) {
          drawSticker(context, landingAssets.levelPanelCloudRight, {
            x: illustrationRect.x + illustrationRect.width - 58,
            y: illustrationRect.y + illustrationRect.height * 0.48,
            width: 54,
            height: 42,
          }, { shadowBlur: 6, alpha: 0.86 });
        }

        drawEmptyTrophy(illustrationRect.x + illustrationRect.width / 2 - 8, illustrationRect.y + 10, compact ? 1.0 : 1.04);
        drawRuleBunnyPeek(context, {
          x: illustrationRect.x + illustrationRect.width * 0.54,
          y: illustrationRect.y + illustrationRect.height * 0.25,
          width: compact ? 84 : 92,
          height: compact ? 84 : 92,
        });
      }
      if (landingAssets.levelPanelSparkleWhite) {
        drawSticker(context, landingAssets.levelPanelSparkleWhite, {
          x: illustrationRect.x + 10,
          y: illustrationRect.y + 28,
          width: 14,
          height: 14,
        }, { shadowBlur: 2, alpha: 0.92 });
        drawSticker(context, landingAssets.levelPanelSparkleWhite, {
          x: illustrationRect.x + illustrationRect.width - 26,
          y: illustrationRect.y + 34,
          width: 12,
          height: 12,
        }, { shadowBlur: 2, alpha: 0.84 });
      }

      context.save();
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#7f5c69';
      context.font = `${compact ? '700 18px' : '700 20px'} sans-serif`;
      const emptyMessage = t(locale, 'landing.emptyLeaderboard');
      const lines = measureWrappedText(context, emptyMessage, rect.width - 44).slice(0, 2);
      const lineHeight = compact ? 24 : 27;
      const startY = rect.y + rect.height * 0.62;
      lines.forEach((line, index) => {
        context.fillText(line, rect.x + rect.width / 2, startY + index * lineHeight);
      });
      context.restore();
    };

    const drawCenteredNote = (text: string, x: number, y: number, width: number): void => {
      context.save();
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillStyle = 'rgba(156, 105, 124, 0.76)';
      context.font = `${compact ? '600 12px' : '600 13px'} sans-serif`;
      const lines = measureWrappedText(context, text, width).slice(0, 2);
      const lineHeight = compact ? 15 : 16;
      lines.forEach((line, index) => {
        context.fillText(line, x, y + index * lineHeight);
      });
      context.restore();
    };

    const drawCurvedTitle = (text: string, centerX: number, centerY: number): void => {
      const chars = Array.from(text);
      context.save();
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.lineWidth = compact ? 6 : 6.5;
      context.strokeStyle = 'rgba(255,255,255,0.98)';
      context.fillStyle = '#8457ee';
      context.shadowColor = 'rgba(143, 101, 229, 0.30)';
      context.shadowBlur = compact ? 8 : 10;
      context.shadowOffsetY = compact ? 2 : 3;
      context.font = `${compact ? '900 28px' : '900 31px'} sans-serif`;

      const charWidths = chars.map((char) => context.measureText(char).width);
      const totalTextWidth = charWidths.reduce((sum, value) => sum + value, 0);
      const letterSpacing = compact ? 0.5 : 0.8;
      const totalWidth = totalTextWidth + letterSpacing * Math.max(0, chars.length - 1);
      const arcStrength = compact ? 7.2 : 8.4;
      const startX = centerX - totalWidth / 2;

      let cursorX = startX;
      chars.forEach((char, index) => {
        const width = charWidths[index];
        const progress = chars.length <= 1 ? 0 : index / (chars.length - 1);
        const curve = Math.sin(progress * Math.PI) * arcStrength;
        const charX = cursorX + width / 2;
        context.save();
        context.translate(charX, centerY - curve);
        context.rotate((progress - 0.5) * 0.05);
        context.strokeText(char, 0, 0);
        context.fillText(char, 0, 0);
        context.restore();
        cursorX += width + letterSpacing;
      });

      context.restore();
    };

    const titleRibbonWidth = panelRect.width - (compact ? 26 : 32);
    const titleRibbonRect = {
      x: panelRect.x + (panelRect.width - titleRibbonWidth) / 2,
      y: panelRect.y - (compact ? 22 : 24),
      width: titleRibbonWidth,
      height: Math.round(titleRibbonWidth / (2074 / 571)),
    };
    const titleAreaHeight = compact ? 152 : 166;
    const contentRect = {
      x: panelRect.x + (compact ? 16 : 18),
      y: panelRect.y + titleAreaHeight,
      width: panelRect.width - (compact ? 32 : 36),
      height: panelRect.height - titleAreaHeight - (compact ? 56 : 60),
    };

    drawSticker(context, landingAssets.levelPanelStarBigYellow, {
      x: panelRect.x - (compact ? 16 : 20),
      y: panelRect.y + (compact ? 14 : 18),
      width: compact ? 44 : 50,
      height: compact ? 44 : 50,
    }, { shadowBlur: 4, alpha: 0.94 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + 18,
      y: panelRect.y + 92,
      width: 16,
      height: 16,
    }, { shadowBlur: 3, alpha: 0.9 });
    drawSticker(context, landingAssets.levelPanelHeartPink, {
      x: panelRect.x + panelRect.width - (compact ? 38 : 42),
      y: panelRect.y + 72,
      width: compact ? 24 : 28,
      height: compact ? 24 : 28,
    }, { shadowBlur: 4, alpha: 0.96 });
    drawSticker(context, landingAssets.settingsCloudClusterLeft, {
      x: panelRect.x - (compact ? 8 : 10),
      y: panelRect.y + panelRect.height - (compact ? 46 : 54),
      width: compact ? 70 : 78,
      height: compact ? 56 : 62,
    }, { shadowBlur: 6, alpha: 0.94 });
    if (landingAssets.levelPanelCloudRight) {
      drawSticker(context, landingAssets.levelPanelCloudRight, {
        x: panelRect.x + panelRect.width - (compact ? 58 : 66),
        y: panelRect.y + panelRect.height - (compact ? 58 : 64),
        width: compact ? 58 : 66,
        height: compact ? 58 : 66,
      }, { shadowBlur: 6, alpha: 0.92 });
    }

    drawRibbon(titleRibbonRect);
    if (landingAssets.leaderboardBunnyPeekLeft) {
      drawSticker(context, landingAssets.leaderboardBunnyPeekLeft, {
        x: titleRibbonRect.x - (compact ? 6 : 8),
        y: titleRibbonRect.y - (compact ? 26 : 30),
        width: compact ? 90 : 98,
        height: compact ? 94 : 102,
      }, { shadowBlur: 8, alpha: 0.98 });
    } else {
      drawRuleBunnyPeek(context, {
        x: titleRibbonRect.x + (compact ? 4 : 6),
        y: titleRibbonRect.y - (compact ? 10 : 12),
        width: compact ? 84 : 92,
        height: compact ? 84 : 92,
      });
    }
    if (landingAssets.leaderboardRainbowCloud) {
      drawSticker(context, landingAssets.leaderboardRainbowCloud, {
        x: titleRibbonRect.x + titleRibbonRect.width - (compact ? 54 : 64),
        y: titleRibbonRect.y + titleRibbonRect.height - (compact ? 18 : 22),
        width: compact ? 72 : 82,
        height: compact ? 40 : 46,
      }, { shadowBlur: 6, alpha: 0.96 });
    }
    drawSticker(context, landingAssets.levelPanelHeartPink, {
      x: titleRibbonRect.x + titleRibbonRect.width - (compact ? 34 : 38),
      y: titleRibbonRect.y + (compact ? 20 : 24),
      width: compact ? 22 : 24,
      height: compact ? 22 : 24,
    }, { shadowBlur: 4, alpha: 0.96 });

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 5;
    context.strokeStyle = '#ffffff';
    context.fillStyle = '#7d5ae6';
    context.font = `${compact ? '900 27px' : '900 30px'} sans-serif`;
    const leaderboardTitle = t(locale, 'landing.weeklyLeaderboard');
    if (/^[\u4e00-\u9fff]+$/.test(leaderboardTitle) && leaderboardTitle.length <= 8) {
      drawCurvedTitle(leaderboardTitle, titleRibbonRect.x + titleRibbonRect.width / 2, titleRibbonRect.y + titleRibbonRect.height / 2 + 1);
    } else {
      context.strokeText(leaderboardTitle, titleRibbonRect.x + titleRibbonRect.width / 2, titleRibbonRect.y + titleRibbonRect.height / 2 + 1);
      context.fillText(leaderboardTitle, titleRibbonRect.x + titleRibbonRect.width / 2, titleRibbonRect.y + titleRibbonRect.height / 2 + 1);
    }
    context.restore();

    drawCenteredNote(
      t(locale, 'landing.localWeeklyNote'),
      panelRect.x + panelRect.width / 2,
      panelRect.y + (compact ? 108 : 114),
      panelRect.width - (compact ? 68 : 80),
    );
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + (compact ? 44 : 52),
      y: panelRect.y + (compact ? 112 : 118),
      width: 10,
      height: 10,
    }, { shadowBlur: 2, alpha: 0.82 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + panelRect.width - (compact ? 54 : 62),
      y: panelRect.y + (compact ? 112 : 118),
      width: 10,
      height: 10,
    }, { shadowBlur: 2, alpha: 0.82 });

    drawTextFrame(context, contentRect, {
      radius: compact ? 24 : 26,
      fill: 'rgba(255,255,255,0.82)',
      stroke: 'rgba(255, 206, 221, 0.95)',
    });
    context.save();
    context.setLineDash([7, 6]);
    context.strokeStyle = 'rgba(255, 168, 194, 0.52)';
    context.lineWidth = 1.2;
    roundRect(context, {
      x: contentRect.x + 8,
      y: contentRect.y + 8,
      width: contentRect.width - 16,
      height: contentRect.height - 16,
    }, (compact ? 24 : 26) - 6);
    context.stroke();
    context.restore();

    const entries = weeklyLeaderboard.slice(0, 6);
    if (entries.length === 0) {
      drawEmptyState(contentRect);
    } else {
      const rowCount = entries.length;
      const rowGap = compact ? 8 : 10;
      const rowArea = {
        x: contentRect.x + (compact ? 10 : 12),
        y: contentRect.y + (compact ? 12 : 14),
        width: contentRect.width - (compact ? 20 : 24),
        height: contentRect.height - (compact ? 24 : 28),
      };
      const rowHeight = Math.max(
        compact ? 40 : 44,
        Math.min(
          compact ? 48 : 52,
          Math.floor((rowArea.height - rowGap * (rowCount - 1)) / rowCount),
        ),
      );
      const totalRowsHeight = rowCount * rowHeight + rowGap * (rowCount - 1);
      const rowStartY = rowArea.y + Math.max(0, (rowArea.height - totalRowsHeight) / 2);

      entries.forEach((entry, index) => {
        const rowRect = {
          x: rowArea.x,
          y: rowStartY + index * (rowHeight + rowGap),
          width: rowArea.width,
          height: rowHeight,
        };
        const topThree = index < 3;
        const rowGradient = context.createLinearGradient(rowRect.x, rowRect.y, rowRect.x, rowRect.y + rowRect.height);
        if (index === 0) {
          rowGradient.addColorStop(0, 'rgba(255, 248, 220, 0.96)');
          rowGradient.addColorStop(1, 'rgba(255, 233, 181, 0.92)');
        } else if (index === 1) {
          rowGradient.addColorStop(0, 'rgba(245, 236, 255, 0.96)');
          rowGradient.addColorStop(1, 'rgba(229, 216, 255, 0.92)');
        } else if (index === 2) {
          rowGradient.addColorStop(0, 'rgba(236, 247, 255, 0.96)');
          rowGradient.addColorStop(1, 'rgba(211, 236, 255, 0.92)');
        } else {
          rowGradient.addColorStop(0, 'rgba(255,255,255,0.74)');
          rowGradient.addColorStop(1, 'rgba(255,247,250,0.58)');
        }

        context.save();
        context.fillStyle = rowGradient;
        context.strokeStyle = topThree ? 'rgba(255, 208, 221, 0.96)' : 'rgba(255, 225, 233, 0.94)';
        context.lineWidth = 1.2;
        context.shadowColor = topThree ? 'rgba(180, 128, 158, 0.16)' : 'rgba(180, 128, 158, 0.10)';
        context.shadowBlur = topThree ? 10 : 8;
        context.shadowOffsetY = 4;
        roundRect(context, rowRect, compact ? 15 : 16);
        context.fill();
        context.shadowColor = 'transparent';
        context.stroke();
        context.save();
        context.setLineDash([5, 4]);
        context.strokeStyle = 'rgba(255,255,255,0.88)';
        context.lineWidth = 1;
        roundRect(context, {
          x: rowRect.x + 6,
          y: rowRect.y + 6,
          width: rowRect.width - 12,
          height: rowRect.height - 12,
        }, (compact ? 15 : 16) - 5);
        context.stroke();
        context.restore();

        if (index < rowCount - 1) {
          context.save();
          context.setLineDash([4, 5]);
          context.strokeStyle = 'rgba(250, 194, 213, 0.74)';
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(rowRect.x + 18, rowRect.y + rowRect.height + 4);
          context.lineTo(rowRect.x + rowRect.width - 18, rowRect.y + rowRect.height + 4);
          context.stroke();
          context.restore();
        }

        const badgeSize = compact ? 30 : 32;
        const badgeRect = {
          x: rowRect.x + 14,
          y: rowRect.y + (rowRect.height - badgeSize) / 2,
          width: badgeSize,
          height: badgeSize,
        };
        const badgeGradient = context.createLinearGradient(badgeRect.x, badgeRect.y, badgeRect.x, badgeRect.y + badgeRect.height);
        if (index === 0) {
          badgeGradient.addColorStop(0, '#ffd86e');
          badgeGradient.addColorStop(1, '#ffae19');
        } else if (index === 1) {
          badgeGradient.addColorStop(0, '#d9c8ff');
          badgeGradient.addColorStop(1, '#a278ff');
        } else if (index === 2) {
          badgeGradient.addColorStop(0, '#c9eeff');
          badgeGradient.addColorStop(1, '#66bfff');
        } else {
          badgeGradient.addColorStop(0, '#fff6f3');
          badgeGradient.addColorStop(1, '#ffe4eb');
        }
        context.save();
        context.fillStyle = badgeGradient;
        context.strokeStyle = topThree ? 'rgba(255,255,255,0.95)' : 'rgba(255, 216, 227, 0.95)';
        context.lineWidth = 1.4;
        context.shadowColor = topThree ? 'rgba(178, 117, 146, 0.20)' : 'rgba(178, 117, 146, 0.10)';
        context.shadowBlur = 8;
        context.shadowOffsetY = 3;
        roundRect(context, badgeRect, badgeRect.height / 2 - 2);
        context.fill();
        context.shadowColor = 'transparent';
        context.stroke();
        context.fillStyle = index < 3 ? '#ffffff' : '#7b5364';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `700 ${compact ? 15 : 16}px sans-serif`;
        context.fillText(String(index + 1), badgeRect.x + badgeRect.width / 2, badgeRect.y + badgeRect.height / 2 + 0.5);
        context.restore();

        context.save();
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        context.fillStyle = topThree ? '#7a4b61' : '#8a6573';
        context.font = `${compact ? '700 16px' : '700 18px'} sans-serif`;
        context.fillText(
          formatDuration(entry.durationMs),
          badgeRect.x + badgeRect.width + (compact ? 12 : 14),
          rowRect.y + rowRect.height / 2 + 0.5,
        );
        context.restore();
      });
    }

    if (landingAssets.levelPanelSparkleWhite) {
      drawSticker(context, landingAssets.levelPanelSparkleWhite, {
        x: panelRect.x + 14,
        y: panelRect.y + panelRect.height - (compact ? 30 : 32),
        width: 12,
        height: 12,
      }, { shadowBlur: 2, alpha: 0.82 });
      drawSticker(context, landingAssets.levelPanelSparkleWhite, {
        x: panelRect.x + panelRect.width - 26,
        y: panelRect.y + panelRect.height - (compact ? 32 : 34),
        width: 12,
        height: 12,
      }, { shadowBlur: 2, alpha: 0.82 });
    }

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(185, 140, 159, 0.62)';
    context.font = `${compact ? '600 12px' : '600 13px'} sans-serif`;
    context.fillText(
      t(locale, 'landing.close'),
      panelRect.x + panelRect.width / 2,
      panelRect.y + panelRect.height - (compact ? 24 : 26),
    );
    context.restore();
  }

  function drawLevelPanel(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    const totalLevels = levels.length;
    const columns = 6;
    const rows = Math.ceil(totalLevels / columns);
    const completedCount = Object.keys(snapshot.records).length;
    const unlockedCount = Math.min(totalLevels, Math.max(1, completedCount + 1));
    const gap = Math.max(8, Math.round(Math.min(metrics.width, metrics.height) * 0.018));
    const panelWidth = Math.min(metrics.width - 20, 388);
    const tileSizeByWidth = Math.floor((panelWidth - 32 - gap * (columns - 1)) / columns);
    const tileSizeByHeight = Math.floor(
      (metrics.height - layout.safeTop - layout.safeBottom - 190 - gap * (rows - 1)) / rows,
    );
    const tileSize = Math.max(40, Math.min(tileSizeByWidth, tileSizeByHeight));
    const gridWidth = columns * tileSize + gap * (columns - 1);
    const gridHeight = rows * tileSize + gap * (rows - 1);
    const titleAreaHeight = 92;
    const panelHeight = titleAreaHeight + gridHeight + 28;
    const panelX = (metrics.width - panelWidth) / 2;
    const panelY = Math.max(layout.topInset + 18, (metrics.height - panelHeight) / 2 - 4);
    const panelRect = {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
    };
    const gridShellRect = {
      x: panelX + 12,
      y: panelY + titleAreaHeight - 4,
      width: panelWidth - 24,
      height: gridHeight + 24,
    };
    const gridStartX = gridShellRect.x + Math.max(0, (gridShellRect.width - gridWidth) / 2);
    const gridStartY = gridShellRect.y + 10;

    levelTiles = [];

    context.save();
    const overlayGradient = context.createLinearGradient(0, 0, 0, metrics.height);
    overlayGradient.addColorStop(0, 'rgba(255, 185, 211, 0.42)');
    overlayGradient.addColorStop(0.52, 'rgba(255, 214, 228, 0.30)');
    overlayGradient.addColorStop(1, 'rgba(255, 243, 249, 0.24)');
    context.fillStyle = overlayGradient;
    context.fillRect(0, 0, metrics.width, metrics.height);
    const glow = context.createRadialGradient(
      metrics.width / 2,
      panelRect.y + panelRect.height * 0.45,
      24,
      metrics.width / 2,
      panelRect.y + panelRect.height * 0.45,
      metrics.width * 0.72,
    );
    glow.addColorStop(0, 'rgba(255,255,255,0.18)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, metrics.width, metrics.height);

    const panelGradient = context.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    panelGradient.addColorStop(0, 'rgba(255, 252, 250, 0.98)');
    panelGradient.addColorStop(0.6, 'rgba(255, 244, 247, 0.96)');
    panelGradient.addColorStop(1, 'rgba(255, 239, 245, 0.94)');
    context.fillStyle = panelGradient;
    context.strokeStyle = 'rgba(255, 208, 221, 0.98)';
    context.lineWidth = 2;
    context.shadowColor = 'rgba(228, 132, 172, 0.24)';
    context.shadowBlur = 30;
    context.shadowOffsetY = 12;
    roundRect(context, panelRect, 30);
    context.fill();
    context.stroke();
    context.shadowColor = 'transparent';

    context.save();
    context.setLineDash([6, 5]);
    context.strokeStyle = 'rgba(255,255,255,0.92)';
    context.lineWidth = 1.4;
    roundRect(context, {
      x: panelRect.x + 8,
      y: panelRect.y + 8,
      width: panelRect.width - 16,
      height: panelRect.height - 16,
    }, 22);
    context.stroke();
    context.restore();

    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#dc4b79';
    context.font = '700 28px sans-serif';
    context.shadowColor = 'rgba(255,255,255,0.52)';
    context.shadowBlur = 2;
    context.fillText(t(locale, 'section.levels'), panelRect.x + panelRect.width / 2, panelRect.y + 24);
    const subtitleText = t(locale, 'level.collectionMeta', {
      completed: completedCount,
      total: totalLevels,
    });
    drawWrappedText(
      context,
      subtitleText,
      {
        x: panelRect.x + 30,
        y: panelRect.y + 58,
        width: panelRect.width - 60,
        height: 28,
      },
      {
        font: '500 12px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 15,
        maxLines: 2,
      },
    );
    context.shadowColor = 'transparent';

    context.save();
    const gridShellGradient = context.createLinearGradient(
      gridShellRect.x,
      gridShellRect.y,
      gridShellRect.x,
      gridShellRect.y + gridShellRect.height,
    );
    gridShellGradient.addColorStop(0, 'rgba(255, 255, 255, 0.93)');
    gridShellGradient.addColorStop(1, 'rgba(255, 244, 247, 0.90)');
    context.fillStyle = gridShellGradient;
    context.strokeStyle = 'rgba(255, 211, 223, 0.96)';
    context.lineWidth = 1.8;
    context.shadowColor = 'rgba(224, 133, 168, 0.18)';
    context.shadowBlur = 20;
    context.shadowOffsetY = 8;
    roundRect(context, gridShellRect, 24);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();
    context.save();
    context.setLineDash([6, 6]);
    context.strokeStyle = 'rgba(255,255,255,0.92)';
    context.lineWidth = 1.2;
    roundRect(context, {
      x: gridShellRect.x + 8,
      y: gridShellRect.y + 8,
      width: gridShellRect.width - 16,
      height: gridShellRect.height - 16,
    }, 18);
    context.stroke();
    context.restore();
    context.restore();

    for (let slot = 0; slot < totalLevels; slot += 1) {
      const col = slot % columns;
      const row = Math.floor(slot / columns);
      const x = gridStartX + col * (tileSize + gap);
      const y = gridStartY + row * (tileSize + gap);

      const level = levels[slot];
      const record = snapshot.records[level.id] ?? null;
      const completed = Boolean(record);
      const isCurrent = snapshot.levelIndex === slot;
      const isViewing = isCurrent && snapshot.mode === 'record';
      const isLocked = !completed && slot >= unlockedCount && !isCurrent;
      const tileRect = { x, y, width: tileSize, height: tileSize };
      const tileRadius = 14;
      const tileGradient = context.createLinearGradient(x, y, x, y + tileSize);
      if (isCurrent) {
        if (isViewing) {
          tileGradient.addColorStop(0, '#e8f8ff');
          tileGradient.addColorStop(1, '#c9eeff');
        } else {
          tileGradient.addColorStop(0, '#fff2a5');
          tileGradient.addColorStop(1, '#ffc84e');
        }
      } else if (completed) {
        tileGradient.addColorStop(0, '#fffdf9');
        tileGradient.addColorStop(1, '#fff1e8');
      } else if (isLocked) {
        tileGradient.addColorStop(0, 'rgba(255,255,255,0.58)');
        tileGradient.addColorStop(1, 'rgba(245, 239, 243, 0.44)');
      } else {
        tileGradient.addColorStop(0, '#fffdf9');
        tileGradient.addColorStop(1, '#fff8f1');
      }

      context.save();
      context.fillStyle = tileGradient;
      context.strokeStyle = isCurrent
        ? (isViewing ? 'rgba(121, 191, 255, 0.98)' : 'rgba(255, 211, 102, 0.98)')
        : completed
          ? 'rgba(244, 208, 182, 0.92)'
          : isLocked
            ? 'rgba(222, 211, 219, 0.78)'
            : 'rgba(248, 211, 204, 0.92)';
      context.lineWidth = isCurrent ? 2.4 : 1.5;
      context.shadowColor = isCurrent
        ? (isViewing ? 'rgba(113, 184, 255, 0.28)' : 'rgba(255, 198, 81, 0.50)')
        : completed
          ? 'rgba(221, 156, 119, 0.18)'
          : isLocked
            ? 'rgba(0,0,0,0.04)'
            : 'rgba(226, 133, 158, 0.14)';
      context.shadowBlur = isCurrent ? 18 : 10;
      context.shadowOffsetY = 4;
      roundRect(context, tileRect, tileRadius);
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();
      context.restore();

      context.save();
      context.setLineDash([4, 4]);
      context.strokeStyle = isCurrent
        ? (isViewing ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.96)')
        : isLocked
          ? 'rgba(255,255,255,0.54)'
          : 'rgba(255,255,255,0.86)';
      context.lineWidth = 1.2;
      roundRect(context, {
        x: x + 4,
        y: y + 4,
        width: tileSize - 8,
        height: tileSize - 8,
      }, Math.max(8, tileRadius - 4));
      context.stroke();
      context.restore();

      context.save();
      context.fillStyle = 'rgba(255,255,255,0.26)';
      roundRect(context, { x: x + 4, y: y + 4, width: tileSize - 8, height: Math.max(4, tileSize * 0.16) }, 8);
      context.fill();
      context.restore();

      if (isCurrent) {
        context.save();
        context.fillStyle = isViewing ? 'rgba(121, 191, 255, 0.28)' : 'rgba(255, 244, 180, 0.44)';
        roundRect(context, { x: x + 5, y: y + 5, width: tileSize - 10, height: 7 }, 4);
        context.fill();
        context.restore();
      }

      context.save();
      if (isLocked) {
        context.globalAlpha = 0.62;
      }
      context.fillStyle = isCurrent
        ? (isViewing ? '#5aa9ef' : '#9a5b00')
        : completed
          ? '#5d4351'
          : isLocked
            ? '#b49ea6'
            : THEME.textPrimary;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = isCurrent ? '800 18px sans-serif' : '700 17px sans-serif';
      context.fillText(String(slot + 1), x + tileSize / 2, y + tileSize / 2 + 1);
      context.restore();

      if (completed) {
        context.save();
        context.fillStyle = 'rgba(122, 205, 90, 0.98)';
        context.beginPath();
        context.arc(x + tileSize - 11, y + 11, 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = THEME.white;
        context.font = '700 10px sans-serif';
        context.fillText('✓', x + tileSize - 11, y + 11.5);
        context.restore();
      }

      if (isViewing) {
        context.save();
        context.fillStyle = THEME.infoSoft;
        roundRect(context, { x: x + 6, y: y + tileSize - 14, width: tileSize - 12, height: 8 }, 4);
        context.fill();
        context.restore();
      }

      if (isCurrent && !isViewing) {
        drawSticker(context, landingAssets.levelPanelStarFaceYellow, {
          x: x - 12,
          y: y - 12,
          width: Math.min(32, tileSize * 0.44),
          height: Math.min(32, tileSize * 0.44),
        }, { rotation: -8, shadowBlur: 8 });
      }

      if (isLocked) {
        context.save();
        const lockW = Math.max(9, Math.round(tileSize * 0.18));
        const lockH = Math.max(10, Math.round(tileSize * 0.18));
        const lockX = x + tileSize - lockW - 10;
        const lockY = y + 8;
        context.fillStyle = 'rgba(255,255,255,0.78)';
        context.strokeStyle = 'rgba(182, 164, 176, 0.70)';
        context.lineWidth = 1.1;
        roundRect(context, {
          x: lockX,
          y: lockY + 4,
          width: lockW,
          height: lockH,
        }, 3);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(lockX + lockW / 2, lockY + 4, lockW / 3.2, Math.PI, 0);
        context.stroke();
        context.restore();
      }

      levelTiles.push({
        index: slot,
        rect: tileRect,
      });
    }

    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + 14,
      y: panelRect.y + panelRect.height - 44,
      width: 16,
      height: 16,
    }, { shadowBlur: 6, alpha: 0.92 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + panelRect.width - 28,
      y: panelRect.y + panelRect.height - 42,
      width: 14,
      height: 14,
    }, { shadowBlur: 6, alpha: 0.86 });

    drawSticker(context, landingAssets.levelPanelStarBigYellow, {
      x: panelRect.x - 8,
      y: panelRect.y - 18,
      width: 56,
      height: 56,
    }, { rotation: -10, shadowBlur: 12 });
    drawSticker(context, landingAssets.levelPanelRibbonPink, {
      x: panelRect.x + 52,
      y: panelRect.y - 14,
      width: 56,
      height: 68,
    }, { rotation: 4, shadowBlur: 12 });
    drawSticker(context, landingAssets.levelPanelCloudSmileHeart, {
      x: panelRect.x + panelRect.width - 112,
      y: panelRect.y - 18,
      width: 110,
      height: 84,
    }, { rotation: 0, shadowBlur: 14 });
    drawSticker(context, landingAssets.levelPanelCloudLeft, {
      x: panelRect.x - 16,
      y: panelRect.y + panelRect.height - 62,
      width: 88,
      height: 66,
    }, { rotation: -4, shadowBlur: 10 });
    drawSticker(context, landingAssets.levelPanelCloudRight, {
      x: panelRect.x + panelRect.width - 82,
      y: panelRect.y + panelRect.height - 58,
      width: 96,
      height: 64,
    }, { rotation: 2, shadowBlur: 10 });
    drawSticker(context, landingAssets.levelPanelStarPink, {
      x: panelRect.x - 4,
      y: panelRect.y + panelRect.height - 104,
      width: 28,
      height: 28,
    }, { rotation: -10, shadowBlur: 8 });
    drawSticker(context, landingAssets.levelPanelStarBlue, {
      x: panelRect.x + panelRect.width - 22,
      y: panelRect.y + 162,
      width: 26,
      height: 26,
    }, { rotation: 8, shadowBlur: 8 });
    drawSticker(context, landingAssets.levelPanelHeartPink, {
      x: panelRect.x + panelRect.width - 30,
      y: panelRect.y + panelRect.height / 2 + 8,
      width: 34,
      height: 34,
    }, { rotation: 10, shadowBlur: 8 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + 22,
      y: panelRect.y + 82,
      width: 18,
      height: 18,
    }, { shadowBlur: 6, alpha: 0.95 });
    drawSticker(context, landingAssets.levelPanelSparkleWhite, {
      x: panelRect.x + panelRect.width - 42,
      y: panelRect.y + 86,
      width: 16,
      height: 16,
    }, { shadowBlur: 6, alpha: 0.88 });

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
    drawBoardDecorations();
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
        backdropImage: (landingAssets.gameplayBackground ?? landingAssets.background) as unknown as CanvasImageSource | null,
        theme: 'kawaii',
        selectionAssets: {
          strawberry: landingAssets.selectionStrawberry as unknown as CanvasImageSource | null,
          heartPink: landingAssets.selectionHeartPink as unknown as CanvasImageSource | null,
          starYellow: landingAssets.selectionStarYellow as unknown as CanvasImageSource | null,
          sparkleWhite: landingAssets.selectionSparkleWhite as unknown as CanvasImageSource | null,
          bubblePink: landingAssets.selectionBubblePink as unknown as CanvasImageSource | null,
          bubbleYellow: landingAssets.selectionBubbleYellow as unknown as CanvasImageSource | null,
          dripYellow: landingAssets.selectionDripYellow as unknown as CanvasImageSource | null,
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
        const insidePanel = infoDialogPanelRect
          ? isPointInsideRect(x, y, infoDialogPanelRect)
          : false;
        const topButton = infoDialogTopButtons.find((item) => isPointInsideRect(x, y, item.rect));
        if (topButton) {
          infoDialogOpenAt = Date.now();
          uiState.helpOpen = topButton.id === 'help';
          uiState.goalOpen = topButton.id === 'goal';
          render();
          return true;
        }

        if (infoDialogMenuRect && isPointInsideRect(x, y, infoDialogMenuRect)) {
          uiState.helpOpen = false;
          uiState.goalOpen = false;
          infoDialogPanelRect = null;
          infoDialogButtonRect = null;
          infoDialogLeaderboardButtonRect = null;
          infoDialogMenuRect = null;
          infoDialogTopButtons = [];
          render();
          return true;
        }

        const closeButtonHit = infoDialogButtonRect
          ? isPointInsideRect(x, y, infoDialogButtonRect)
          : false;
        if (closeButtonHit) {
          uiState.helpOpen = false;
          uiState.goalOpen = false;
          infoDialogPanelRect = null;
          infoDialogButtonRect = null;
          infoDialogLeaderboardButtonRect = null;
          infoDialogMenuRect = null;
          infoDialogTopButtons = [];
          render();
          return true;
        }

        if (infoDialogLeaderboardButtonRect && isPointInsideRect(x, y, infoDialogLeaderboardButtonRect)) {
          uiState.helpOpen = false;
          uiState.goalOpen = false;
          infoDialogPanelRect = null;
          infoDialogButtonRect = null;
          infoDialogLeaderboardButtonRect = null;
          infoDialogMenuRect = null;
          infoDialogTopButtons = [];
          uiState.leaderboardOpen = true;
        }

        if (closeButtonHit || !insidePanel) {
          uiState.helpOpen = false;
          uiState.goalOpen = false;
          infoDialogPanelRect = null;
          infoDialogButtonRect = null;
          infoDialogLeaderboardButtonRect = null;
          infoDialogMenuRect = null;
          infoDialogTopButtons = [];
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
        infoDialogOpenAt = Date.now();
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
        backgroundMusic.setEnabled(userSettings.soundEnabled);
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
        const completed = Boolean(snapshot.records[level.id]);
        const unlockedCount = Math.min(levels.length, Math.max(1, Object.keys(snapshot.records).length + 1));
        const isLocked = !completed && tile.index >= unlockedCount && snapshot.levelIndex !== tile.index;
        if (completed) {
          game.viewRecordedLevel(tile.index);
          uiState.levelPanelOpen = false;
          render();
          return true;
        }

        if (!isLocked) {
          game.setLevel(tile.index);
          uiState.levelPanelOpen = false;
          render();
          return true;
        }

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
      if (uiState.helpOpen || uiState.goalOpen) {
        const topButton = infoDialogTopButtons.find((item) => isPointInsideRect(x, y, item.rect));
        if (topButton) {
          uiState.pressedUiId = `icon:${topButton.id}`;
        } else if (infoDialogMenuRect && isPointInsideRect(x, y, infoDialogMenuRect)) {
          uiState.pressedUiId = 'dialog:menu';
        } else if (infoDialogButtonRect && isPointInsideRect(x, y, infoDialogButtonRect)) {
          uiState.pressedUiId = 'dialog:close';
        } else if (infoDialogLeaderboardButtonRect && isPointInsideRect(x, y, infoDialogLeaderboardButtonRect)) {
          uiState.pressedUiId = 'dialog:leaderboard';
        } else {
          uiState.pressedUiId = null;
        }
        render();
        return;
      }

      if (uiState.leaderboardOpen) {
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
    backgroundMusic.prime();

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
