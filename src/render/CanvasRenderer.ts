import type {
  Cell,
  Clue,
  GameSnapshot,
  GridRect,
  Level,
  Placement,
  PlacementEffectEvent,
} from '../game/types';
import type { CanvasSurface } from './CanvasSurface';

interface BoardMetrics {
  cellSize: number;
  offsetX: number;
  offsetY: number;
  boardWidth: number;
  boardHeight: number;
}

interface PlacementAnimation {
  placementId: string;
  startedAt: number;
}

interface CelebrationParticle {
  x: number;
  y: number;
  size: number;
  velocityX: number;
  velocityY: number;
  color: string;
  drift: number;
}

interface RenderLabels {
  solvedBadge: string;
  recordBadge: string;
}

interface RenderInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface RenderOptions {
  labels: RenderLabels;
  insets?: Partial<RenderInsets>;
  backdropImage?: CanvasImageSource | null;
  theme?: 'default' | 'kawaii';
  showPlacementFills?: boolean;
  selectionAssets?: Partial<SelectionDecorAssets> | null;
}

interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionDecorAssets {
  strawberry: CanvasImageSource | null;
  heartPink: CanvasImageSource | null;
  starYellow: CanvasImageSource | null;
  sparkleWhite: CanvasImageSource | null;
  bubblePink: CanvasImageSource | null;
  bubbleYellow: CanvasImageSource | null;
  dripYellow: CanvasImageSource | null;
}

type KawaiiSelectionTheme = 'pink' | 'yellow' | 'green' | 'blue' | 'purple';

type DecorationAnchor = 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'center';

type DecorationImageKind = keyof SelectionDecorAssets;

interface DecorationSpec {
  kind: DecorationImageKind;
  anchor: DecorationAnchor;
  size: number;
  alpha: number;
  filter?: string;
}

const PLACEMENT_COLORS = [
  '#ffb9cc',
  '#ffc89f',
  '#ffe76b',
  '#a9efcc',
  '#8fd8ff',
  '#cbc4ff',
  '#ffd1ea',
];

const KAWAII_SELECTION_THEMES: readonly KawaiiSelectionTheme[] = [
  'pink',
  'yellow',
  'green',
  'blue',
  'purple',
];

const KAWAII_SELECTION_PALETTE: Record<
  KawaiiSelectionTheme,
  {
    start: string;
    mid: string;
    end: string;
    border: string;
    shadow: string;
    checkerA: string;
    checkerB: string;
    vector: string;
  }
> = {
  pink: {
    start: 'rgba(255, 214, 230, 0.70)',
    mid: 'rgba(255, 181, 209, 0.56)',
    end: 'rgba(255, 157, 193, 0.52)',
    border: 'rgba(255, 236, 243, 0.98)',
    shadow: 'rgba(232, 130, 172, 0.28)',
    checkerA: 'rgba(255, 255, 255, 0.12)',
    checkerB: 'rgba(255, 182, 211, 0.08)',
    vector: '#ff9fc8',
  },
  yellow: {
    start: 'rgba(255, 239, 176, 0.70)',
    mid: 'rgba(255, 220, 122, 0.58)',
    end: 'rgba(255, 200, 94, 0.52)',
    border: 'rgba(255, 247, 221, 0.98)',
    shadow: 'rgba(222, 172, 80, 0.30)',
    checkerA: 'rgba(255, 255, 255, 0.12)',
    checkerB: 'rgba(255, 217, 135, 0.08)',
    vector: '#ffcc62',
  },
  green: {
    start: 'rgba(205, 248, 212, 0.66)',
    mid: 'rgba(165, 232, 179, 0.52)',
    end: 'rgba(130, 216, 155, 0.48)',
    border: 'rgba(239, 255, 241, 0.98)',
    shadow: 'rgba(104, 188, 125, 0.28)',
    checkerA: 'rgba(255, 255, 255, 0.11)',
    checkerB: 'rgba(170, 233, 185, 0.08)',
    vector: '#8ad79c',
  },
  blue: {
    start: 'rgba(201, 235, 255, 0.66)',
    mid: 'rgba(157, 214, 250, 0.52)',
    end: 'rgba(120, 189, 240, 0.48)',
    border: 'rgba(239, 249, 255, 0.98)',
    shadow: 'rgba(112, 162, 224, 0.28)',
    checkerA: 'rgba(255, 255, 255, 0.11)',
    checkerB: 'rgba(166, 214, 247, 0.08)',
    vector: '#88c9ff',
  },
  purple: {
    start: 'rgba(229, 218, 255, 0.66)',
    mid: 'rgba(203, 181, 249, 0.52)',
    end: 'rgba(176, 149, 235, 0.48)',
    border: 'rgba(247, 241, 255, 0.98)',
    shadow: 'rgba(158, 127, 219, 0.30)',
    checkerA: 'rgba(255, 255, 255, 0.11)',
    checkerB: 'rgba(208, 191, 251, 0.08)',
    vector: '#c4adff',
  },
};

function getNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export class CanvasRenderer {
  private readonly surface: CanvasSurface;

  private readonly context: CanvasRenderingContext2D;

  private metrics: BoardMetrics = {
    cellSize: 0,
    offsetX: 0,
    offsetY: 0,
    boardWidth: 0,
    boardHeight: 0,
  };

  private placementAnimations: PlacementAnimation[] = [];

  private shakeStartedAt = -1;

  private celebrationStartedAt = -1;

  private celebrationParticles: CelebrationParticle[] = [];

  private lastPlacementEffectId = 0;

  private lastInvalidEffectId = 0;

  private lastCelebrationEffectId = 0;

  private insets: RenderInsets = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  private backdropImage: CanvasImageSource | null = null;

  private theme: 'default' | 'kawaii' = 'default';

  private selectionAssets: Partial<SelectionDecorAssets> | null = null;

  constructor(surface: CanvasSurface) {
    this.surface = surface;
    this.context = surface.getContext2D();
  }

  render(snapshot: GameSnapshot, options: RenderOptions): void {
    const now = getNow();
    const surfaceSize = this.surface.syncSize();
    this.insets = {
      top: options.insets?.top ?? 0,
      right: options.insets?.right ?? 0,
      bottom: options.insets?.bottom ?? 0,
      left: options.insets?.left ?? 0,
    };
    this.backdropImage = options.backdropImage ?? null;
    this.theme = options.theme ?? 'default';
    this.selectionAssets = options.selectionAssets ?? null;
    this.metrics = this.computeMetrics(snapshot.level, surfaceSize.width, surfaceSize.height);
    this.consumeEffects(snapshot.effects, now);
    this.pruneEffects(now);

    const { level, mode, placements, preview, solved, hintSuggestion, selectedPlacementId } = snapshot;
    const { context } = this;
    const { width, height } = surfaceSize;

    context.clearRect(0, 0, width, height);

    this.drawBackdrop(width, height);
    context.save();
    const shakeOffset = this.getShakeOffset(now);
    context.translate(shakeOffset, 0);

    this.drawBoardSurface();
    this.drawGrid(level);
    if (options.showPlacementFills !== false) {
      this.drawPlacements(placements, now);
    }

    if (hintSuggestion) {
      this.drawHint(hintSuggestion.rect);
    }

    if (preview) {
      this.drawPreview(preview.rect, preview.validation.ok, preview.validation.clue);
    }

    this.drawClues(level, placements);

    const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId) ?? null;
    if (selectedPlacement) {
      this.drawSelectedPlacement(selectedPlacement);
    }
    context.restore();

    if (solved) {
      this.drawSolvedBadge(
        mode === 'record' ? options.labels.recordBadge : options.labels.solvedBadge,
      );
    }

    this.drawCelebration(now);
  }

  hasActiveEffects(): boolean {
    return (
      this.placementAnimations.length > 0 ||
      this.shakeStartedAt >= 0 ||
      this.celebrationStartedAt >= 0
    );
  }

  getBoardSurfaceRect(): SurfaceRect {
    return {
      x: this.metrics.offsetX,
      y: this.metrics.offsetY,
      width: this.metrics.boardWidth,
      height: this.metrics.boardHeight,
    };
  }

  getSurfaceRectForGridRect(rect: GridRect): SurfaceRect {
    return this.getSurfaceRect(rect);
  }

  getCellFromSurfacePoint(point: { x: number; y: number }, clamp = false): Cell | null {
    const localX = point.x;
    const localY = point.y;
    if (this.metrics.cellSize <= 0) {
      return null;
    }

    if (!clamp) {
      if (
        localX < this.metrics.offsetX ||
        localY < this.metrics.offsetY ||
        localX >= this.metrics.offsetX + this.metrics.boardWidth ||
        localY >= this.metrics.offsetY + this.metrics.boardHeight
      ) {
        return null;
      }
    }

    const boundedX = clamp
      ? Math.min(
          Math.max(localX, this.metrics.offsetX),
          this.metrics.offsetX + this.metrics.boardWidth - 1,
        )
      : localX;
    const boundedY = clamp
      ? Math.min(
          Math.max(localY, this.metrics.offsetY),
          this.metrics.offsetY + this.metrics.boardHeight - 1,
        )
      : localY;

    return {
      x: Math.floor((boundedX - this.metrics.offsetX) / this.metrics.cellSize),
      y: Math.floor((boundedY - this.metrics.offsetY) / this.metrics.cellSize),
    };
  }

  isPlacementDeleteBadgeHit(point: { x: number; y: number }, placement: Placement): boolean {
    const badgeRect = this.getPlacementDeleteBadgeRect(placement);
    return (
      point.x >= badgeRect.x &&
      point.x <= badgeRect.x + badgeRect.width &&
      point.y >= badgeRect.y &&
      point.y <= badgeRect.y + badgeRect.height
    );
  }

  private computeMetrics(level: Level, width: number, height: number): BoardMetrics {
    const basePadding =
      this.theme === 'kawaii'
        ? Math.max(10, Math.min(width, height) * 0.03)
        : Math.max(18, Math.min(width, height) * 0.05);
    const availableLeft = basePadding + this.insets.left;
    const availableRight = width - basePadding - this.insets.right;
    const availableTop = basePadding + this.insets.top;
    const availableBottom = height - basePadding - this.insets.bottom;
    const usableWidth = availableRight - availableLeft;
    const usableHeight = availableBottom - availableTop;
    const cellSize = Math.max(24, Math.floor(Math.min(usableWidth / level.width, usableHeight / level.height)));
    const boardWidth = cellSize * level.width;
    const boardHeight = cellSize * level.height;
    const originWidth = Math.max(availableLeft, availableLeft + (usableWidth - boardWidth) / 2);
    const originHeight = Math.max(availableTop, availableTop + (usableHeight - boardHeight) / 2);

    return {
      cellSize,
      offsetX: Math.floor(originWidth),
      offsetY: Math.floor(originHeight),
      boardWidth,
      boardHeight,
    };
  }

  private drawBackdrop(width: number, height: number): void {
    if (this.backdropImage) {
      this.drawImageCover(this.backdropImage, 0, 0, width, height);
      this.context.save();
      const veil = this.context.createLinearGradient(0, 0, 0, height);
      veil.addColorStop(0, 'rgba(255, 210, 230, 0.08)');
      veil.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
      veil.addColorStop(1, 'rgba(196, 231, 255, 0.08)');
      this.context.fillStyle = veil;
      this.context.fillRect(0, 0, width, height);
      this.context.restore();
      return;
    }

    const gradient = this.context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ff968f');
    gradient.addColorStop(0.48, '#f29ac8');
    gradient.addColorStop(1, '#a9e7ff');

    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, width, height);
    this.drawCloudCluster(width * 0.18, height * 0.15, 0.85);
    this.drawCloudCluster(width * 0.87, height * 0.12, 0.7);
    this.drawCloudCluster(width * 0.12, height * 0.92, 1.1);
    this.drawCloudCluster(width * 0.82, height * 0.95, 0.95);
    this.drawSkySparkles(width, height);
  }

  private drawBoardSurface(): void {
    const { context, metrics } = this;
    const frameInset = this.theme === 'kawaii' ? 18 : 14;

    context.save();
    const frameX = metrics.offsetX - frameInset;
    const frameY = metrics.offsetY - frameInset;
    const frameWidth = metrics.boardWidth + frameInset * 2;
    const frameHeight = metrics.boardHeight + frameInset * 2;

    const gradient = context.createLinearGradient(frameX, frameY, frameX, frameY + frameHeight);
    if (this.theme === 'kawaii') {
      gradient.addColorStop(0, 'rgba(255, 252, 248, 0.97)');
      gradient.addColorStop(1, 'rgba(255, 245, 238, 0.92)');
      context.strokeStyle = 'rgba(255, 192, 204, 0.92)';
      context.lineWidth = 3;
      context.shadowColor = 'rgba(162, 111, 148, 0.26)';
      context.shadowBlur = 28;
      context.shadowOffsetY = 12;
    } else {
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
      gradient.addColorStop(1, 'rgba(234, 249, 255, 0.86)');
      context.strokeStyle = 'rgba(255,255,255,0.88)';
      context.lineWidth = 2.8;
      context.shadowColor = 'rgba(167, 123, 165, 0.24)';
      context.shadowBlur = 24;
      context.shadowOffsetY = 10;
    }
    context.fillStyle = gradient;
    this.roundRect(frameX, frameY, frameWidth, frameHeight, this.theme === 'kawaii' ? 26 : 20);
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();

    if (this.theme === 'kawaii') {
      context.save();
      context.setLineDash([6, 5]);
      context.strokeStyle = 'rgba(255, 170, 188, 0.88)';
      context.lineWidth = 1.8;
      this.roundRect(frameX + 8, frameY + 8, frameWidth - 16, frameHeight - 16, 22);
      context.stroke();
      context.restore();
    }
    context.restore();
  }

  private consumeEffects(
    effects: GameSnapshot['effects'],
    now: number,
  ): void {
    const placementEffect = effects.placement;
    if (placementEffect && placementEffect.id !== this.lastPlacementEffectId) {
      this.lastPlacementEffectId = placementEffect.id;
      this.startPlacementAnimation(placementEffect, now);
    }

    if (effects.invalidId !== this.lastInvalidEffectId) {
      this.lastInvalidEffectId = effects.invalidId;
      this.shakeStartedAt = now;
    }

    if (effects.celebrationId !== this.lastCelebrationEffectId) {
      this.lastCelebrationEffectId = effects.celebrationId;
      this.startCelebration(now);
    }
  }

  private pruneEffects(now: number): void {
    this.placementAnimations = this.placementAnimations.filter(
      (animation) => now - animation.startedAt < 220,
    );

    if (this.shakeStartedAt >= 0 && now - this.shakeStartedAt > 260) {
      this.shakeStartedAt = -1;
    }

    if (this.celebrationStartedAt >= 0 && now - this.celebrationStartedAt > 1100) {
      this.celebrationStartedAt = -1;
      this.celebrationParticles = [];
    }
  }

  private drawPlacements(placements: Placement[], now: number): void {
    placements.forEach((placement, index) => {
      if (this.theme === 'kawaii') {
        this.drawKawaiiPlacement(placement, index, now);
        return;
      }

      const color = PLACEMENT_COLORS[index % PLACEMENT_COLORS.length];
      const animation = this.placementAnimations.find(
        (candidate) => candidate.placementId === placement.id,
      );

      if (!animation) {
        this.fillRect(placement.rect, color, '#5a4c3a', 0.92);
        return;
      }

      const progress = Math.min(1, (now - animation.startedAt) / 220);
      const eased = 1 - (1 - progress) * (1 - progress);
      const scale = 0.94 + eased * 0.06;
      const alpha = 0.35 + eased * 0.57;
      this.fillRectAnimated(placement.rect, color, '#5a4c3a', alpha, scale);
    });
  }

  private drawKawaiiPlacement(placement: Placement, index: number, now: number): void {
    const theme = KAWAII_SELECTION_THEMES[index % KAWAII_SELECTION_THEMES.length];
    const animation = this.placementAnimations.find(
      (candidate) => candidate.placementId === placement.id,
    );
    const progress = animation ? Math.min(1, (now - animation.startedAt) / 220) : 1;
    const eased = 1 - (1 - progress) * (1 - progress);
    const scale = animation ? 0.94 + eased * 0.06 : 1;
    const alpha = animation ? 0.42 + eased * 0.5 : 0.92;
    const surfaceRect = this.getSurfaceRect(placement.rect);
    const inset = Math.max(4, this.metrics.cellSize * 0.035);
    const rect: SurfaceRect = {
      x: surfaceRect.x + inset,
      y: surfaceRect.y + inset,
      width: surfaceRect.width - inset * 2,
      height: surfaceRect.height - inset * 2,
    };
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    this.context.save();
    this.context.globalAlpha = alpha;
    this.context.translate(centerX, centerY);
    this.context.scale(scale, scale);
    this.context.translate(-centerX, -centerY);
    this.drawKawaiiPlacementSurface(rect, theme, placement);
    this.context.restore();
  }

  private drawKawaiiPlacementSurface(
    rect: SurfaceRect,
    theme: KawaiiSelectionTheme,
    placement: Placement,
  ): void {
    const palette = KAWAII_SELECTION_PALETTE[theme];
    const radius = Math.max(18, this.metrics.cellSize * 0.22);
    const innerInset = Math.max(6, this.metrics.cellSize * 0.09);
    const checkerSize = Math.max(16, this.metrics.cellSize * 0.48);
    const highlightHeight = Math.max(20, Math.min(rect.height * 0.32, this.metrics.cellSize * 0.9));

    this.context.save();
    this.context.shadowColor = palette.shadow;
    this.context.shadowBlur = Math.max(18, this.metrics.cellSize * 0.46);
    this.context.shadowOffsetY = Math.max(4, this.metrics.cellSize * 0.06);
    const fill = this.context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    fill.addColorStop(0, palette.start);
    fill.addColorStop(0.52, palette.mid);
    fill.addColorStop(1, palette.end);
    this.context.fillStyle = fill;
    this.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
    this.context.fill();
    this.context.restore();

    this.context.save();
    this.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
    this.context.clip();
    for (let y = rect.y; y < rect.y + rect.height; y += checkerSize) {
      for (let x = rect.x; x < rect.x + rect.width; x += checkerSize) {
        const offsetIndex = Math.floor((x - rect.x) / checkerSize) + Math.floor((y - rect.y) / checkerSize);
        this.context.fillStyle = offsetIndex % 2 === 0 ? palette.checkerA : palette.checkerB;
        this.context.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    const topGlow = this.context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + highlightHeight);
    topGlow.addColorStop(0, 'rgba(255,255,255,0.34)');
    topGlow.addColorStop(1, 'rgba(255,255,255,0)');
    this.context.fillStyle = topGlow;
    this.context.fillRect(rect.x, rect.y, rect.width, highlightHeight);

    this.context.globalAlpha = 0.74;
    this.context.fillStyle = 'rgba(255,255,255,0.84)';
    this.roundRect(
      rect.x + innerInset * 0.8,
      rect.y + innerInset * 0.65,
      Math.max(28, rect.width * 0.34),
      Math.max(12, highlightHeight * 0.52),
      Math.max(10, highlightHeight * 0.28),
    );
    this.context.fill();
    this.context.restore();

    this.context.save();
    this.context.strokeStyle = palette.border;
    this.context.lineWidth = 2.6;
    this.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
    this.context.stroke();
    this.context.restore();

    this.context.save();
    this.context.setLineDash([8, 6]);
    this.context.strokeStyle = 'rgba(255,255,255,0.92)';
    this.context.lineWidth = 1.8;
    this.roundRect(
      rect.x + innerInset,
      rect.y + innerInset,
      rect.width - innerInset * 2,
      rect.height - innerInset * 2,
      Math.max(14, radius - innerInset * 0.6),
    );
    this.context.stroke();
    this.context.restore();

    if (
      theme === 'yellow' &&
      placement.rect.width >= 2 &&
      placement.rect.width * placement.rect.height >= 4 &&
      this.selectionAssets?.dripYellow
    ) {
      const dripHeight = Math.min(rect.height * 0.23, this.metrics.cellSize * 0.75);
      this.drawImageClipped(
        this.selectionAssets.dripYellow,
        rect.x,
        rect.y + 1,
        rect.width,
        dripHeight,
        radius,
      );
    }

    this.drawKawaiiPlacementDecorations(rect, theme, placement);
  }

  private drawKawaiiPlacementDecorations(
    rect: SurfaceRect,
    theme: KawaiiSelectionTheme,
    placement: Placement,
  ): void {
    const minSide = Math.min(rect.width, rect.height);
    const baseSize = Math.max(12, Math.min(28, minSide * 0.18));
    const area = placement.rect.width * placement.rect.height;
    const random = this.createPlacementRandom(`${placement.id}:${theme}:${placement.rect.width}x${placement.rect.height}`);
    const specs: DecorationSpec[] = [];
    const themeFilter = this.getSelectionImageFilter(theme);

    if (theme === 'pink') {
      if (area >= 4) {
        specs.push({ kind: 'strawberry', anchor: 'tl', size: baseSize * 1.05, alpha: 0.96 });
      }
      specs.push({ kind: 'heartPink', anchor: 'tr', size: baseSize * 0.9, alpha: 0.88 });
      specs.push({ kind: 'bubblePink', anchor: 'bl', size: baseSize * 0.9, alpha: 0.84 });
      specs.push({ kind: 'sparkleWhite', anchor: 'br', size: baseSize * 0.68, alpha: 0.82 });
    } else if (theme === 'yellow') {
      specs.push({ kind: 'starYellow', anchor: 'tl', size: baseSize * 0.95, alpha: 0.9 });
      specs.push({ kind: 'heartPink', anchor: 'tr', size: baseSize * 0.78, alpha: 0.74 });
      specs.push({ kind: 'bubbleYellow', anchor: 'br', size: baseSize * 0.84, alpha: 0.78 });
      specs.push({ kind: 'sparkleWhite', anchor: 'bl', size: baseSize * 0.66, alpha: 0.8 });
    } else {
      specs.push({ kind: 'starYellow', anchor: 'tl', size: baseSize * 0.88, alpha: 0.76, filter: themeFilter });
      specs.push({ kind: 'heartPink', anchor: 'tr', size: baseSize * 0.8, alpha: 0.72, filter: themeFilter });
      specs.push({ kind: 'bubblePink', anchor: 'br', size: baseSize * 0.78, alpha: 0.7, filter: themeFilter });
      specs.push({ kind: 'sparkleWhite', anchor: 'bl', size: baseSize * 0.62, alpha: 0.76 });
      if (area >= 4 && random() > 0.4) {
        specs.push({ kind: 'bubbleYellow', anchor: 'center', size: baseSize * 0.62, alpha: 0.58, filter: themeFilter });
      }
    }

    specs.forEach((spec) => this.drawKawaiiDecoration(rect, spec, random));
  }

  private drawKawaiiDecoration(rect: SurfaceRect, spec: DecorationSpec, random: () => number): void {
    const point = this.getDecorationPoint(rect, spec.anchor, spec.size, random);
    const image = this.selectionAssets?.[spec.kind];
    if (!image) {
      return;
    }

    this.context.save();
    this.context.globalAlpha = spec.alpha;
    if (spec.filter) {
      this.context.filter = spec.filter;
    }
    this.context.drawImage(image, point.x, point.y, spec.size, spec.size);
    this.context.filter = 'none';
    this.context.restore();
  }

  private getSelectionImageFilter(theme: KawaiiSelectionTheme): string {
    switch (theme) {
      case 'green':
        return 'hue-rotate(86deg) saturate(1.08) brightness(0.96)';
      case 'blue':
        return 'hue-rotate(188deg) saturate(1.08) brightness(0.98)';
      case 'purple':
        return 'hue-rotate(250deg) saturate(1.05) brightness(0.98)';
      default:
        return '';
    }
  }

  private getDecorationPoint(
    rect: SurfaceRect,
    anchor: DecorationAnchor,
    size: number,
    random: () => number,
  ): { x: number; y: number } {
    const insetX = Math.max(12, size * 0.32);
    const insetY = Math.max(10, size * 0.3);
    const jitterX = (random() - 0.5) * Math.min(size * 0.35, rect.width * 0.08);
    const jitterY = (random() - 0.5) * Math.min(size * 0.35, rect.height * 0.08);

    switch (anchor) {
      case 'tl':
        return { x: rect.x + insetX + jitterX, y: rect.y + insetY + jitterY };
      case 'tr':
        return { x: rect.x + rect.width - size - insetX + jitterX, y: rect.y + insetY + jitterY };
      case 'bl':
        return { x: rect.x + insetX + jitterX, y: rect.y + rect.height - size - insetY + jitterY };
      case 'br':
        return { x: rect.x + rect.width - size - insetX + jitterX, y: rect.y + rect.height - size - insetY + jitterY };
      case 'top':
        return { x: rect.x + rect.width * 0.48 - size / 2 + jitterX, y: rect.y + insetY + jitterY };
      case 'bottom':
        return { x: rect.x + rect.width * 0.28 - size / 2 + jitterX, y: rect.y + rect.height - size - insetY + jitterY };
      case 'center':
      default:
        return { x: rect.x + rect.width * 0.56 - size / 2 + jitterX, y: rect.y + rect.height * 0.56 - size / 2 + jitterY };
    }
  }

  private createPlacementRandom(seedText: string): () => number {
    let seed = 2166136261;
    for (let index = 0; index < seedText.length; index += 1) {
      seed ^= seedText.charCodeAt(index);
      seed = Math.imul(seed, 16777619);
    }
    let state = seed >>> 0;
    return () => {
      state = Math.imul(state ^ (state >>> 15), 2246822519);
      state = Math.imul(state ^ (state >>> 13), 3266489917);
      state ^= state >>> 16;
      return (state >>> 0) / 4294967295;
    };
  }

  private drawImageClipped(
    image: CanvasImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    this.context.save();
    this.roundRect(x, y, width, height + radius, radius);
    this.context.clip();
    this.context.drawImage(image, x, y, width, height);
    this.context.restore();
  }

  private drawPreview(rect: GridRect, valid: boolean, clue: Clue | null): void {
    const fillColor = valid ? '#8fe8c2' : '#ffab99';
    const strokeColor = valid ? '#53c793' : '#f26f5b';
    this.fillRect(rect, fillColor, strokeColor, 0.45, [10, 6]);
    this.drawPreviewAccent(rect, strokeColor);
    this.drawPreviewCorners(rect, strokeColor);
    if (clue) {
      this.drawPreviewClueHighlight(clue, strokeColor);
    }
  }

  private drawHint(rect: GridRect): void {
    this.fillRect(rect, '#8fd8ff', '#4ba8e6', 0.24, [8, 6]);
  }

  private drawSelectedPlacement(placement: Placement): void {
    const badgeRect = this.getPlacementDeleteBadgeRect(placement);
    const { context } = this;

    this.drawPreviewAccent(placement.rect, '#ffb627');
    this.drawPreviewCorners(placement.rect, '#ffb627');

    context.save();
    context.fillStyle = '#fff8fb';
    context.strokeStyle = '#f16673';
    context.lineWidth = 2;
    this.roundRect(badgeRect.x, badgeRect.y, badgeRect.width, badgeRect.height, 11);
    context.fill();
    context.stroke();
    context.strokeStyle = '#f16673';
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(badgeRect.x + 7, badgeRect.y + 7);
    context.lineTo(badgeRect.x + badgeRect.width - 7, badgeRect.y + badgeRect.height - 7);
    context.moveTo(badgeRect.x + badgeRect.width - 7, badgeRect.y + 7);
    context.lineTo(badgeRect.x + 7, badgeRect.y + badgeRect.height - 7);
    context.stroke();
    context.restore();
  }

  private fillRect(
    rect: GridRect,
    fillColor: string,
    strokeColor: string,
    alpha: number,
    dash: number[] = [],
  ): void {
    const { context, metrics } = this;
    const x = metrics.offsetX + rect.x * metrics.cellSize;
    const y = metrics.offsetY + rect.y * metrics.cellSize;
    const width = rect.width * metrics.cellSize;
    const height = rect.height * metrics.cellSize;

    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = fillColor;
    this.roundRect(x + 2, y + 2, width - 4, height - 4, Math.max(8, metrics.cellSize * 0.18));
    context.fill();
    context.restore();

    context.save();
    context.strokeStyle = strokeColor;
    context.lineWidth = 2.6;
    context.setLineDash(dash);
    this.roundRect(x + 1.5, y + 1.5, width - 3, height - 3, Math.max(9, metrics.cellSize * 0.2));
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    this.roundRect(x + 4, y + 4, Math.max(10, width * 0.18), Math.max(8, height * 0.12), 8);
    context.fill();
    context.restore();
  }

  private fillRectAnimated(
    rect: GridRect,
    fillColor: string,
    strokeColor: string,
    alpha: number,
    scale: number,
  ): void {
    const { context, metrics } = this;
    const x = metrics.offsetX + rect.x * metrics.cellSize;
    const y = metrics.offsetY + rect.y * metrics.cellSize;
    const width = rect.width * metrics.cellSize;
    const height = rect.height * metrics.cellSize;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    context.save();
    context.translate(centerX, centerY);
    context.scale(scale, scale);
    context.translate(-centerX, -centerY);
    this.fillRect(rect, fillColor, strokeColor, alpha);
    context.restore();
  }

  private drawPreviewAccent(rect: GridRect, strokeColor: string): void {
    const { context, metrics } = this;
    const x = metrics.offsetX + rect.x * metrics.cellSize;
    const y = metrics.offsetY + rect.y * metrics.cellSize;
    const width = rect.width * metrics.cellSize;
    const height = rect.height * metrics.cellSize;

    context.save();
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.shadowColor = strokeColor;
    context.shadowBlur = 14;
    context.strokeRect(x + 3, y + 3, width - 6, height - 6);
    context.restore();
  }

  private drawPreviewCorners(rect: GridRect, strokeColor: string): void {
    const { context, metrics } = this;
    const x = metrics.offsetX + rect.x * metrics.cellSize;
    const y = metrics.offsetY + rect.y * metrics.cellSize;
    const width = rect.width * metrics.cellSize;
    const height = rect.height * metrics.cellSize;
    const length = Math.max(8, Math.min(16, metrics.cellSize * 0.28));

    context.save();
    context.strokeStyle = strokeColor;
    context.lineWidth = 3;
    context.setLineDash([]);
    context.beginPath();
    context.moveTo(x + 3, y + length);
    context.lineTo(x + 3, y + 3);
    context.lineTo(x + length, y + 3);
    context.moveTo(x + width - length, y + 3);
    context.lineTo(x + width - 3, y + 3);
    context.lineTo(x + width - 3, y + length);
    context.moveTo(x + 3, y + height - length);
    context.lineTo(x + 3, y + height - 3);
    context.lineTo(x + length, y + height - 3);
    context.moveTo(x + width - length, y + height - 3);
    context.lineTo(x + width - 3, y + height - 3);
    context.lineTo(x + width - 3, y + height - length);
    context.stroke();
    context.restore();
  }

  private drawPreviewClueHighlight(clue: Clue, strokeColor: string): void {
    const { context, metrics } = this;
    const centerX = metrics.offsetX + (clue.x + 0.5) * metrics.cellSize;
    const centerY = metrics.offsetY + (clue.y + 0.5) * metrics.cellSize;

    context.save();
    context.fillStyle = 'rgba(255, 255, 255, 0.36)';
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.shadowColor = strokeColor;
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(centerX, centerY, metrics.cellSize * 0.34, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  private getPlacementDeleteBadgeRect(placement: Placement): SurfaceRect {
    const surfaceRect = this.getSurfaceRect(placement.rect);
    const size = Math.max(22, Math.min(28, this.metrics.cellSize * 0.55));

    return {
      x: surfaceRect.x + surfaceRect.width - size - 4,
      y: surfaceRect.y + 4,
      width: size,
      height: size,
    };
  }

  private getSurfaceRect(rect: GridRect): SurfaceRect {
    return {
      x: this.metrics.offsetX + rect.x * this.metrics.cellSize,
      y: this.metrics.offsetY + rect.y * this.metrics.cellSize,
      width: rect.width * this.metrics.cellSize,
      height: rect.height * this.metrics.cellSize,
    };
  }

  private drawGrid(level: Level): void {
    if (this.theme === 'kawaii') {
      this.drawKawaiiGrid(level);
      return;
    }

    const { context, metrics } = this;
    context.save();
    context.strokeStyle = 'rgba(255, 244, 252, 0.98)';
    context.shadowColor = 'rgba(47, 118, 214, 0.38)';
    context.shadowBlur = 4;
    context.lineWidth = 1.4;

    for (let x = 0; x <= level.width; x += 1) {
      const lineX = metrics.offsetX + x * metrics.cellSize + 0.5;
      context.beginPath();
      context.moveTo(lineX, metrics.offsetY);
      context.lineTo(lineX, metrics.offsetY + metrics.boardHeight);
      context.stroke();
    }

    for (let y = 0; y <= level.height; y += 1) {
      const lineY = metrics.offsetY + y * metrics.cellSize + 0.5;
      context.beginPath();
      context.moveTo(metrics.offsetX, lineY);
      context.lineTo(metrics.offsetX + metrics.boardWidth, lineY);
      context.stroke();
    }

    context.restore();
  }

  private drawKawaiiGrid(level: Level): void {
    const { context, metrics } = this;
    const gap = Math.max(4, Math.round(metrics.cellSize * 0.05));
    const radius = Math.max(12, Math.round(metrics.cellSize * 0.14));

    context.save();
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const cellX = metrics.offsetX + x * metrics.cellSize + gap / 2;
        const cellY = metrics.offsetY + y * metrics.cellSize + gap / 2;
        const cellSize = metrics.cellSize - gap;
        const fill = context.createLinearGradient(cellX, cellY, cellX, cellY + cellSize);
        fill.addColorStop(0, 'rgba(255, 249, 241, 0.98)');
        fill.addColorStop(1, 'rgba(255, 241, 229, 0.96)');
        context.fillStyle = fill;
        context.strokeStyle = 'rgba(255, 206, 196, 0.92)';
        context.lineWidth = 1.4;
        context.shadowColor = 'rgba(255, 255, 255, 0.85)';
        context.shadowBlur = 6;
        this.roundRect(cellX, cellY, cellSize, cellSize, radius);
        context.fill();
        context.shadowColor = 'transparent';
        context.stroke();
      }
    }
    context.restore();
  }

  private drawClues(level: Level, placements: Placement[]): void {
    const coveredClues = new Set(placements.map((placement) => `${placement.clue.x},${placement.clue.y}`));
    const kawaiiColors = ['#ffaec4', '#acdfff', '#c9a5ff', '#ffd16a', '#b5e58a'];

    this.context.save();
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.font = `600 ${Math.max(16, Math.floor(this.metrics.cellSize * 0.34))}px "Avenir Next", "Trebuchet MS", sans-serif`;

    for (const clue of level.clues) {
      const centerX = this.metrics.offsetX + (clue.x + 0.5) * this.metrics.cellSize;
      const centerY = this.metrics.offsetY + (clue.y + 0.5) * this.metrics.cellSize;
      const covered = coveredClues.has(`${clue.x},${clue.y}`);
      this.context.beginPath();
      this.context.arc(centerX, centerY, this.metrics.cellSize * (this.theme === 'kawaii' ? 0.255 : 0.24), 0, Math.PI * 2);
      this.context.fillStyle = covered ? 'rgba(255, 250, 252, 0.96)' : 'rgba(255, 255, 255, 0.94)';
      this.context.fill();
      this.context.strokeStyle = this.theme === 'kawaii'
        ? kawaiiColors[Math.abs((clue.x + clue.y + clue.value) % kawaiiColors.length)]
        : covered
          ? '#d997b6'
          : '#ffe17a';
      this.context.lineWidth = this.theme === 'kawaii' ? 3 : 2;
      this.context.stroke();

      if (this.theme === 'kawaii') {
        this.context.save();
        this.context.setLineDash([4, 3]);
        this.context.strokeStyle = 'rgba(137, 87, 103, 0.25)';
        this.context.lineWidth = 1.2;
        this.context.beginPath();
        this.context.arc(centerX, centerY, this.metrics.cellSize * 0.19, 0, Math.PI * 2);
        this.context.stroke();
        this.context.restore();
      }

      this.context.fillStyle = covered ? '#6b4258' : '#6a4f5d';
      this.context.fillText(String(clue.value), centerX, centerY + 1);
    }

    this.context.restore();
  }

  private drawSolvedBadge(label: string): void {
    const { context, metrics } = this;
    const badgeWidth = Math.min(180, metrics.boardWidth * 0.55);
    const badgeHeight = 42;
    const x = metrics.offsetX + metrics.boardWidth - badgeWidth;
    const y = Math.max(16, metrics.offsetY - 52);

    context.save();
    const gradient = context.createLinearGradient(x, y, x, y + badgeHeight);
    if (this.theme === 'kawaii') {
      gradient.addColorStop(0, '#ffe78e');
      gradient.addColorStop(1, '#ffc94b');
      context.strokeStyle = 'rgba(255,255,255,0.94)';
      context.lineWidth = 2;
    } else {
      gradient.addColorStop(0, '#a9ef77');
      gradient.addColorStop(1, '#64c949');
    }
    context.fillStyle = gradient;
    this.roundRect(x, y, badgeWidth, badgeHeight, 16);
    context.fill();
    if (this.theme === 'kawaii') {
      context.stroke();
    }

    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 16px "Avenir Next", "Trebuchet MS", sans-serif';
    context.fillText(label, x + badgeWidth / 2, y + badgeHeight / 2 + 1);
    context.restore();
  }

  private drawCelebration(now: number): void {
    if (this.celebrationStartedAt < 0) {
      return;
    }

    const progress = Math.min(1, (now - this.celebrationStartedAt) / 1100);
    const fade = 1 - progress;

    this.context.save();
    this.context.globalAlpha = fade * 0.9;

    for (const particle of this.celebrationParticles) {
      const x = particle.x + particle.velocityX * progress + Math.sin(progress * 7 + particle.drift) * 6;
      const y = particle.y + particle.velocityY * progress;
      const radius = Math.max(1.5, particle.size * (1 - progress * 0.35));

      this.context.fillStyle = particle.color;
      this.context.beginPath();
      this.context.arc(x, y, radius, 0, Math.PI * 2);
      this.context.fill();
    }

    this.context.restore();
  }

  private startPlacementAnimation(effect: PlacementEffectEvent, now: number): void {
    this.placementAnimations = this.placementAnimations.filter(
      (animation) => animation.placementId !== effect.placementId,
    );
    this.placementAnimations.push({
      placementId: effect.placementId,
      startedAt: now,
    });
  }

  private getShakeOffset(now: number): number {
    if (this.shakeStartedAt < 0) {
      return 0;
    }

    const progress = Math.min(1, (now - this.shakeStartedAt) / 260);
    const strength = (1 - progress) * 9;
    return Math.sin(progress * Math.PI * 7) * strength;
  }

  private startCelebration(now: number): void {
    this.celebrationStartedAt = now;
    const centerX = this.metrics.offsetX + this.metrics.boardWidth / 2;
    const topY = this.metrics.offsetY + 24;
    const colors = ['#ffd766', '#8fd8ff', '#ffb9cc', '#a9efcc', '#cbc4ff'];

    this.celebrationParticles = Array.from({ length: 18 }, (_, index) => ({
      x: centerX + (index - 9) * 10,
      y: topY + (index % 3) * 10,
      size: 3 + (index % 4),
      velocityX: (index % 2 === 0 ? -1 : 1) * (24 + (index % 5) * 9),
      velocityY: -70 - (index % 6) * 14,
      color: colors[index % colors.length],
      drift: index * 0.8,
    }));
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.context.beginPath();
    this.context.moveTo(x + radius, y);
    this.context.arcTo(x + width, y, x + width, y + height, radius);
    this.context.arcTo(x + width, y + height, x, y + height, radius);
    this.context.arcTo(x, y + height, x, y, radius);
    this.context.arcTo(x, y, x + width, y, radius);
    this.context.closePath();
  }

  private drawCloudCluster(centerX: number, centerY: number, scale: number): void {
    const puffs = [
      { x: -38, y: 14, r: 22 },
      { x: -10, y: 2, r: 28 },
      { x: 20, y: 8, r: 24 },
      { x: 48, y: 18, r: 18 },
    ];

    this.context.save();
    this.context.fillStyle = 'rgba(255,255,255,0.54)';
    this.context.shadowColor = 'rgba(255,255,255,0.24)';
    this.context.shadowBlur = 16;
    for (const puff of puffs) {
      this.context.beginPath();
      this.context.arc(
        centerX + puff.x * scale,
        centerY + puff.y * scale,
        puff.r * scale,
        0,
        Math.PI * 2,
      );
      this.context.fill();
    }
    this.context.restore();
  }

  private drawSkySparkles(width: number, height: number): void {
    const sparkles = [
      { x: width * 0.26, y: height * 0.24, size: 4 },
      { x: width * 0.78, y: height * 0.3, size: 5 },
      { x: width * 0.18, y: height * 0.74, size: 4 },
      { x: width * 0.86, y: height * 0.84, size: 5 },
    ];

    this.context.save();
    this.context.strokeStyle = 'rgba(255,255,255,0.68)';
    this.context.lineWidth = 1.4;
    this.context.lineCap = 'round';
    for (const sparkle of sparkles) {
      this.context.beginPath();
      this.context.moveTo(sparkle.x - sparkle.size, sparkle.y);
      this.context.lineTo(sparkle.x + sparkle.size, sparkle.y);
      this.context.moveTo(sparkle.x, sparkle.y - sparkle.size);
      this.context.lineTo(sparkle.x, sparkle.y + sparkle.size);
      this.context.stroke();
    }
    this.context.restore();
  }

  private drawImageCover(
    image: CanvasImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const source = image as { width?: number; height?: number };
    const sourceWidth = source.width ?? width;
    const sourceHeight = source.height ?? height;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return;
    }

    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = width / height;
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

    this.context.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  }
}
