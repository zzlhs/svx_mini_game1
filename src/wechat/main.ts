import { FeedbackAudio } from '../audio/FeedbackAudio';
import { GameController } from '../game/GameController';
import { levels } from '../game/levels';
import { getCoveredCellCount } from '../game/logic';
import type { GameSnapshot, LevelRecord } from '../game/types';
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
import { BrowserGameStorage } from '../storage/BrowserGameStorage';
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
  id: 'continue' | 'start';
  label: string;
  rect: Rect;
  primary: boolean;
}

interface TileSpec {
  index: number;
  rect: Rect;
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
  backgroundStart: '#fcf8ef',
  backgroundEnd: '#efe4d3',
  surfaceStrong: 'rgba(255, 250, 242, 0.98)',
  surface: 'rgba(255, 250, 242, 0.90)',
  surfaceSoft: 'rgba(255, 250, 242, 0.78)',
  surfaceMuted: 'rgba(239, 231, 219, 0.82)',
  border: 'rgba(94, 77, 52, 0.10)',
  borderSoft: 'rgba(94, 77, 52, 0.08)',
  borderAccent: 'rgba(143, 91, 43, 0.14)',
  shadow: 'rgba(53, 41, 25, 0.12)',
  overlay: 'rgba(33, 27, 20, 0.24)',
  textPrimary: '#24313b',
  textSecondary: '#667785',
  textMuted: '#7b6a57',
  accent: '#8f5b2b',
  accentStrong: '#8f4a22',
  accentSoft: '#fff0df',
  accentFill: '#e5a15b',
  success: '#2f8f62',
  successSoft: '#e9f8ef',
  info: '#31507f',
  infoSoft: '#e7f0ff',
  white: '#fffaf1',
  disabledText: '#9a8b76',
} as const;

declare global {
  interface Window {
    __PATCH_GRID_DEBUG__?: OverlayActionApi;
  }
}

let cachedCanvas: WechatCanvasLike | null = null;

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
    gradient.addColorStop(1, THEME.backgroundEnd);
    context.fillStyle = gradient;
    context.fillRect(0, 0, metrics.width, metrics.height);

    context.fillStyle = THEME.textPrimary;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 26px sans-serif';
    context.fillText('填充格子', metrics.width / 2, metrics.height / 2 - 16);
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
    context.fillText('填充格子', 20, 24);
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
  context.fillStyle = THEME.surface;
  context.strokeStyle = THEME.borderSoft;
  context.lineWidth = 1;
  roundRect(context, rect, 14);
  context.fill();
  context.stroke();
  context.restore();
}

function drawHudShell(context: CanvasRenderingContext2D, rect: Rect): void {
  context.save();
  context.fillStyle = THEME.surfaceSoft;
  context.strokeStyle = THEME.borderSoft;
  context.lineWidth = 1;
  roundRect(context, rect, 18);
  context.fill();
  context.stroke();
  context.restore();
}

function drawToolbarShell(context: CanvasRenderingContext2D, rect: Rect): void {
  context.save();
  context.fillStyle = THEME.surface;
  context.strokeStyle = THEME.borderSoft;
  context.shadowColor = THEME.shadow;
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
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
  context.fillStyle = options.fill ?? 'rgba(255, 250, 242, 0.52)';
  context.strokeStyle = options.stroke ?? THEME.borderSoft;
  context.lineWidth = 1;
  roundRect(context, rect, options.radius ?? 10);
  context.fill();
  context.stroke();
  context.restore();
}

function drawToolbarIcon(
  context: CanvasRenderingContext2D,
  button: ButtonSpec,
): void {
  const centerX = button.rect.x + button.rect.width / 2;
  const centerY = button.rect.y + 15;
  const iconColor = button.enabled ? THEME.accent : THEME.disabledText;

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

function bootstrapWechatGame(): void {
  const locale = resolveLocale();
  const canvas = resolveWechatCanvas();
  const metrics = getWindowMetrics();
  const layout = computeLayout(metrics);
  const storage = new BrowserGameStorage(new WechatStorageAdapter());
  const loadedGameState = storage.load(levels);
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
  const inputSource = new WechatPointerInputSource();
  const uiState = {
    levelPanelOpen: false,
    homeOpen: true,
    pressedUiId: null as string | null,
  };
  new PointerController(inputSource, surface, renderer, game, {
    shouldIgnoreInput: () => uiState.levelPanelOpen || uiState.homeOpen,
  });

  let currentSnapshot = game.getSnapshot();
  let animationFrameId = 0;
  let buttons: ButtonSpec[] = [];
  let homeButtons: HomeButtonSpec[] = [];
  let levelTiles: TileSpec[] = [];
  let lastPlacementEffectId = 0;
  let lastInvalidEffectId = 0;
  let lastCelebrationEffectId = 0;
  let autoAdvanceTimeoutId = 0;
  let lastAutoAdvanceCelebrationId = 0;
  let autoAdvanceBannerUntil = 0;

  function drawHeader(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    drawHudShell(context, layout.headerRect);

    context.save();
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = THEME.accent;
    context.font = '600 10px sans-serif';
    context.fillText(t(locale, 'app.eyebrow'), layout.headerRect.x + 14, layout.headerRect.y + 7);

    context.fillStyle = THEME.textPrimary;
    context.font = '700 19px sans-serif';
    context.fillText(t(locale, 'app.title'), layout.headerRect.x + 14, layout.headerRect.y + 16);

    context.fillStyle = THEME.textSecondary;
    context.font = '600 10px sans-serif';
    context.fillText(
      t(locale, 'level.progress', {
        current: snapshot.levelIndex + 1,
        total: levels.length,
      }),
      layout.headerRect.x + 14,
      layout.headerRect.y + 34,
    );
    context.fillText(
      t(locale, 'board.meta', {
        width: snapshot.level.width,
        height: snapshot.level.height,
        clues: snapshot.level.clues.length,
      }),
      layout.headerRect.x + 102,
      layout.headerRect.y + 34,
    );

    context.fillStyle = THEME.textPrimary;
    context.font = '700 11px sans-serif';
    context.fillText(
      formatLevelName(locale, snapshot.level.number, snapshot.level.titleKey),
      layout.headerRect.x + 14,
      layout.headerRect.y + 46,
    );
    context.restore();

    context.save();
    context.fillStyle =
      snapshot.mode === 'record'
        ? THEME.infoSoft
        : snapshot.solved
          ? THEME.successSoft
          : snapshot.preview?.validation.ok
            ? THEME.accentSoft
            : THEME.surfaceMuted;
    context.strokeStyle =
      snapshot.mode === 'record'
        ? THEME.borderSoft
        : snapshot.solved
          ? THEME.borderSoft
          : THEME.borderSoft;
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
      context.fillStyle = button.enabled ? THEME.surfaceStrong : THEME.surfaceMuted;
      context.strokeStyle = button.enabled
        ? THEME.border
        : THEME.borderSoft;
      context.lineWidth = 1;
      roundRect(context, buttonRect, 14);
      context.fill();
      context.stroke();

      drawToolbarIcon(context, { ...button, rect: buttonRect });

      context.fillStyle = button.enabled ? THEME.textPrimary : THEME.disabledText;
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

  function drawHomeScreen(snapshot: ReturnType<GameController['getSnapshot']>): void {
    const context = surface.getContext2D();
    const panelWidth = Math.min(metrics.width - 36, 320);
    const panelHeight = 300;
    const panelRect = {
      x: (metrics.width - panelWidth) / 2,
      y: Math.max(layout.headerRect.y + 18, (metrics.height - panelHeight) / 2 - 18),
      width: panelWidth,
      height: panelHeight,
    };
    const completed = Object.keys(snapshot.records).length;
    const hasProgress = snapshot.levelIndex > 0 || snapshot.placements.length > 0;
    const buttonWidth = panelWidth - 44;
    const startButtonRect = {
      x: panelRect.x + 22,
      y: panelRect.y + panelRect.height - 74,
      width: buttonWidth,
      height: 44,
    };
    const continueButtonRect = {
      x: panelRect.x + 22,
      y: startButtonRect.y - 54,
      width: buttonWidth,
      height: 44,
    };

    homeButtons = [
      {
        id: 'continue',
        label: t(locale, 'home.continue'),
        rect: continueButtonRect,
        primary: true,
      },
      {
        id: 'start',
        label: t(locale, 'home.start'),
        rect: startButtonRect,
        primary: false,
      },
    ];

    context.save();
    context.fillStyle = THEME.overlay;
    context.fillRect(0, 0, metrics.width, metrics.height);

    context.fillStyle = THEME.surfaceStrong;
    context.strokeStyle = THEME.border;
    context.lineWidth = 1;
    context.shadowColor = THEME.shadow;
    context.shadowBlur = 24;
    context.shadowOffsetY = 10;
    roundRect(context, panelRect, 26);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = THEME.accent;
    context.font = '700 11px sans-serif';
    context.fillText(t(locale, 'app.eyebrow'), panelRect.x + 22, panelRect.y + 20);
    context.fillStyle = THEME.textPrimary;
    context.font = '700 28px sans-serif';
    context.fillText(t(locale, 'app.title'), panelRect.x + 22, panelRect.y + 38);

    drawWrappedText(
      context,
      t(locale, 'home.subtitle'),
      {
        x: panelRect.x + 22,
        y: panelRect.y + 78,
        width: panelRect.width - 44,
        height: 44,
      },
      {
        font: '12px sans-serif',
        color: THEME.textSecondary,
        lineHeight: 16,
        maxLines: 2,
      },
    );

    drawHudShell(context, {
      x: panelRect.x + 22,
      y: panelRect.y + 126,
      width: panelRect.width - 44,
      height: 68,
    });
    context.fillStyle = THEME.accent;
    context.font = '700 10px sans-serif';
    context.fillText(
      t(locale, 'home.progress', { completed, total: levels.length }),
      panelRect.x + 36,
      panelRect.y + 140,
    );
    context.fillStyle = THEME.textPrimary;
    context.font = '700 15px sans-serif';
    context.fillText(
      t(locale, 'home.currentLevel', { level: snapshot.levelIndex + 1 }),
      panelRect.x + 36,
      panelRect.y + 158,
    );

    for (const button of homeButtons) {
      const isPressed = uiState.pressedUiId === `home:${button.id}`;
      const buttonRect = { ...button.rect, y: button.rect.y + (isPressed ? 1.5 : 0) };
      context.fillStyle = button.primary ? THEME.textPrimary : THEME.surfaceStrong;
      context.strokeStyle = button.primary ? THEME.textPrimary : THEME.border;
      context.lineWidth = 1;
      roundRect(context, buttonRect, 18);
      context.fill();
      context.stroke();

      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '700 13px sans-serif';
      context.fillStyle = button.primary ? THEME.white : THEME.textPrimary;
      context.fillText(
        button.label,
        buttonRect.x + buttonRect.width / 2,
        buttonRect.y + buttonRect.height / 2,
      );
    }

    context.fillStyle = THEME.textMuted;
    context.font = '10px sans-serif';
    context.fillText(
      hasProgress ? t(locale, 'home.resumeTip') : t(locale, 'home.freshTip'),
      panelRect.x + 26,
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

    context.fillStyle = THEME.surfaceStrong;
    context.strokeStyle = THEME.border;
    context.lineWidth = 1;
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
        context.fillStyle = THEME.surfaceMuted;
        roundRect(context, { x, y, width: tileSize, height: tileSize }, 10);
        context.fill();
        continue;
      }

      const level = levels[slot];
      const completed = Boolean(snapshot.records[level.id]);
      const isCurrent = snapshot.levelIndex === slot;
      const isViewing = isCurrent && snapshot.mode === 'record';

      context.fillStyle = completed ? THEME.successSoft : THEME.surfaceStrong;
      if (isCurrent) {
        context.fillStyle = isViewing ? THEME.infoSoft : THEME.accentSoft;
      }
      context.strokeStyle = THEME.border;
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
    drawHeader(snapshot);
    drawInfoCards(snapshot);
    drawButtons(snapshot);
    drawAutoAdvanceBanner(snapshot);

    if (uiState.levelPanelOpen) {
      drawLevelPanel(snapshot);
    }

    if (uiState.homeOpen) {
      drawHomeScreen(snapshot);
    }
  }

  function render(): void {
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
    drawOverlay(currentSnapshot);
    syncFeedbackAudio(currentSnapshot);
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

  function syncFeedbackAudio(snapshot: GameSnapshot): void {
    const placementEffectId = snapshot.effects.placement?.id ?? 0;
    if (placementEffectId !== lastPlacementEffectId) {
      lastPlacementEffectId = placementEffectId;
      if (placementEffectId > 0) {
        audio.playPlacement();
      }
    }

    if (snapshot.effects.invalidId !== lastInvalidEffectId) {
      lastInvalidEffectId = snapshot.effects.invalidId;
      if (snapshot.effects.invalidId > 0) {
        audio.playInvalid();
      }
    }

    if (snapshot.effects.celebrationId !== lastCelebrationEffectId) {
      lastCelebrationEffectId = snapshot.effects.celebrationId;
      if (snapshot.effects.celebrationId > 0) {
        audio.playCelebration();
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
    context.fillStyle = THEME.surfaceStrong;
    context.strokeStyle = THEME.borderAccent;
    context.lineWidth = 1;
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
      const homeButton = homeButtons.find((item) => isPointInsideRect(x, y, item.rect));
      uiState.pressedUiId = null;
      if (!homeButton) {
        render();
        return true;
      }

      if (homeButton.id === 'continue') {
        uiState.homeOpen = false;
        render();
        return true;
      }

      uiState.homeOpen = false;
      game.setLevel(0);
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
      const homeButton = homeButtons.find((item) => isPointInsideRect(x, y, item.rect));
      uiState.pressedUiId = homeButton ? `home:${homeButton.id}` : null;
      render();
      return;
    }

    if (uiState.levelPanelOpen) {
      uiState.pressedUiId = null;
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
  bootstrapWechatGame();
} catch (error) {
  console.error('[Fill Grid] WeChat bootstrap failed:', error);
  drawBootstrapError(error);
}
