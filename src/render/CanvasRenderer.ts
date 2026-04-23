import type {
  Cell,
  GameSnapshot,
  GridRect,
  Level,
  Placement,
  PlacementEffectEvent,
} from '../game/types';

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

const PLACEMENT_COLORS = [
  '#f2c572',
  '#9fd0c7',
  '#f4a076',
  '#b5c9f6',
  '#d9b8f3',
  '#f6c3d7',
  '#cce4a7',
];

export class CanvasRenderer {
  private readonly canvas: HTMLCanvasElement;

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

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D context is not available');
    }

    this.canvas = canvas;
    this.context = context;
  }

  render(snapshot: GameSnapshot, labels: RenderLabels): void {
    const now = performance.now();
    this.syncCanvas(snapshot.level);
    this.consumeEffects(snapshot.effects, now);
    this.pruneEffects(now);

    const { level, mode, placements, preview, solved, hintSuggestion } = snapshot;
    const { context } = this;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    context.clearRect(0, 0, width, height);

    this.drawBackdrop(width, height);
    context.save();
    const shakeOffset = this.getShakeOffset(now);
    context.translate(shakeOffset, 0);

    this.drawBoardSurface();
    this.drawPlacements(placements, now);

    if (hintSuggestion) {
      this.drawHint(hintSuggestion.rect);
    }

    if (preview) {
      this.drawPreview(preview.rect, preview.validation.ok);
    }

    this.drawGrid(level);
    this.drawClues(level, placements);
    context.restore();

    if (solved) {
      this.drawSolvedBadge(mode === 'record' ? labels.recordBadge : labels.solvedBadge);
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

  getCellFromClientPoint(clientX: number, clientY: number, clamp = false): Cell | null {
    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

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

  private syncCanvas(level: Level): void {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.canvas.clientWidth));
    const height = Math.max(1, Math.round(this.canvas.clientHeight));
    const displayWidth = Math.round(width * dpr);
    const displayHeight = Math.round(height * dpr);

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }

    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.metrics = this.computeMetrics(level, width, height);
  }

  private computeMetrics(level: Level, width: number, height: number): BoardMetrics {
    const padding = Math.max(18, Math.min(width, height) * 0.05);
    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;
    const cellSize = Math.max(24, Math.floor(Math.min(usableWidth / level.width, usableHeight / level.height)));
    const boardWidth = cellSize * level.width;
    const boardHeight = cellSize * level.height;

    return {
      cellSize,
      offsetX: Math.floor((width - boardWidth) / 2),
      offsetY: Math.floor((height - boardHeight) / 2),
      boardWidth,
      boardHeight,
    };
  }

  private drawBackdrop(width: number, height: number): void {
    const gradient = this.context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#fcf8ef');
    gradient.addColorStop(1, '#efe4d3');

    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, width, height);
  }

  private drawBoardSurface(): void {
    const { context, metrics } = this;

    context.save();
    context.fillStyle = '#fffaf1';
    context.strokeStyle = '#d4c8b6';
    context.lineWidth = 2;
    context.shadowColor = 'rgba(53, 41, 25, 0.12)';
    context.shadowBlur = 18;
    context.shadowOffsetY = 8;
    this.roundRect(
      metrics.offsetX - 10,
      metrics.offsetY - 10,
      metrics.boardWidth + 20,
      metrics.boardHeight + 20,
      18,
    );
    context.fill();
    context.shadowColor = 'transparent';
    context.stroke();
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

  private drawPreview(rect: GridRect, valid: boolean): void {
    const fillColor = valid ? '#6eb59b' : '#d9735c';
    const strokeColor = valid ? '#2f7d61' : '#8f4334';
    this.fillRect(rect, fillColor, strokeColor, 0.45, [10, 6]);
  }

  private drawHint(rect: GridRect): void {
    this.fillRect(rect, '#79aee3', '#2f5f93', 0.24, [8, 6]);
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
    context.fillRect(x + 2, y + 2, width - 4, height - 4);
    context.restore();

    context.save();
    context.strokeStyle = strokeColor;
    context.lineWidth = 3;
    context.setLineDash(dash);
    context.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);
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

  private drawGrid(level: Level): void {
    const { context, metrics } = this;
    context.save();
    context.strokeStyle = '#c7bba9';
    context.lineWidth = 1;

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

  private drawClues(level: Level, placements: Placement[]): void {
    const coveredClues = new Set(placements.map((placement) => `${placement.clue.x},${placement.clue.y}`));

    this.context.save();
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.font = `600 ${Math.max(16, Math.floor(this.metrics.cellSize * 0.34))}px "Avenir Next", "Trebuchet MS", sans-serif`;

    for (const clue of level.clues) {
      const centerX = this.metrics.offsetX + (clue.x + 0.5) * this.metrics.cellSize;
      const centerY = this.metrics.offsetY + (clue.y + 0.5) * this.metrics.cellSize;
      const covered = coveredClues.has(`${clue.x},${clue.y}`);

      this.context.fillStyle = covered ? '#22333f' : '#334f62';
      this.context.beginPath();
      this.context.arc(centerX, centerY, this.metrics.cellSize * 0.24, 0, Math.PI * 2);
      this.context.fillStyle = covered ? 'rgba(255, 250, 241, 0.92)' : 'rgba(255, 255, 255, 0.96)';
      this.context.fill();
      this.context.strokeStyle = covered ? '#22333f' : '#7995a8';
      this.context.lineWidth = 2;
      this.context.stroke();

      this.context.fillStyle = covered ? '#22333f' : '#334f62';
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
    context.fillStyle = '#2f8f62';
    this.roundRect(x, y, badgeWidth, badgeHeight, 16);
    context.fill();

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
    const colors = ['#f2c572', '#9fd0c7', '#f4a076', '#b5c9f6', '#cce4a7'];

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
}
