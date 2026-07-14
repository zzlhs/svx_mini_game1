import './style.css';

import { FeedbackAudio } from './audio/FeedbackAudio';
import { GameController } from './game/GameController';
import { levels } from './game/levels';
import { getCoveredCellCount } from './game/logic';
import type { GameSnapshot, LevelRecord } from './game/types';
import {
  detectLocale,
  formatLevelName,
  formatLocaleDate,
  getSupportedLocales,
  loadLocale,
  saveLocale,
  t,
  tm,
  type Locale,
} from './i18n';
import { BrowserPointerInputSource } from './input/BrowserPointerInputSource';
import { PointerController } from './input/PointerController';
import { BrowserCanvasSurface } from './render/BrowserCanvasSurface';
import { CanvasRenderer } from './render/CanvasRenderer';
import { BrowserGameStorage } from './storage/BrowserGameStorage';
import { BrowserLocalStorageAdapter } from './storage/BrowserLocalStorageAdapter';

interface VisualAssets {
  background: HTMLImageElement;
  gameplayBackground: HTMLImageElement;
  selectionStrawberry: HTMLImageElement;
  selectionHeartPink: HTMLImageElement;
  selectionStarYellow: HTMLImageElement;
  selectionSparkleWhite: HTMLImageElement;
  selectionBubblePink: HTMLImageElement;
  selectionBubbleYellow: HTMLImageElement;
  selectionDripYellow: HTMLImageElement;
}

const WECHAT_ASSET_URLS = {
  background: new URL('../assets/wechat/bg.jpg', import.meta.url).href,
  gameplayBackground: new URL('../assets/wechat/bg_kawaii.png', import.meta.url).href,
  selectionStrawberry: new URL('../assets/wechat/selection/selection_decor_strawberry.png', import.meta.url).href,
  selectionHeartPink: new URL('../assets/wechat/selection/selection_decor_heart_pink.png', import.meta.url).href,
  selectionStarYellow: new URL('../assets/wechat/selection/selection_decor_star_yellow.png', import.meta.url).href,
  selectionSparkleWhite: new URL('../assets/wechat/selection/selection_decor_sparkle_white.png', import.meta.url).href,
  selectionBubblePink: new URL('../assets/wechat/selection/selection_decor_bubble_pink.png', import.meta.url).href,
  selectionBubbleYellow: new URL('../assets/wechat/selection/selection_decor_bubble_yellow.png', import.meta.url).href,
  selectionDripYellow: new URL('../assets/wechat/selection/selection_top_drip_yellow.png', import.meta.url).href,
} as const;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <div class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow" id="app-eyebrow"></p>
        <h1 id="app-title"></h1>
        <p class="hero-copy" id="app-hero-copy"></p>
      </div>
      <div class="hero-side">
        <label class="locale-switcher">
          <span id="locale-label"></span>
          <select id="locale-select"></select>
        </label>
        <div class="status-chip" id="status-chip"></div>
      </div>
    </header>

    <main class="layout">
      <section class="board-panel">
        <div class="panel-head">
          <div>
            <p class="panel-label" id="level-progress"></p>
            <h2 id="level-name"></h2>
          </div>
          <p class="panel-meta" id="board-meta"></p>
        </div>

        <div class="canvas-stage">
          <canvas id="game-canvas" aria-label="Fill Grid game board"></canvas>
          <div id="selection-layer" class="selection-layer" aria-hidden="true"></div>
        </div>
      </section>

      <aside class="sidebar">
        <section class="info-card">
          <h3 id="section-levels"></h3>
          <p id="level-collection-meta"></p>
          <div id="level-grid" class="level-grid"></div>
        </section>

        <section class="info-card">
          <h3 id="section-hints"></h3>
          <p id="level-hint"></p>
        </section>

        <section class="info-card">
          <h3 id="section-record"></h3>
          <p id="record-summary"></p>
          <p id="record-detail" class="status-text"></p>
        </section>

        <section class="info-card">
          <h3 id="section-progress"></h3>
          <p id="coverage-text"></p>
          <p id="status-text" class="status-text"></p>
        </section>

        <section class="info-card controls-card">
          <h3 id="section-actions"></h3>
          <div class="controls">
            <button id="undo-button" type="button"></button>
            <button id="restart-button" type="button"></button>
            <button id="hint-button" type="button"></button>
            <button id="next-button" type="button"></button>
          </div>
        </section>

        <section class="info-card compact-card">
          <h3 id="section-rules"></h3>
          <ul class="rules-list">
            <li id="rule-area"></li>
            <li id="rule-single"></li>
            <li id="rule-cover"></li>
            <li id="rule-input"></li>
          </ul>
        </section>
      </aside>
    </main>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const selectionLayer = document.querySelector<HTMLDivElement>('#selection-layer');
const appEyebrow = document.querySelector<HTMLParagraphElement>('#app-eyebrow');
const appTitle = document.querySelector<HTMLHeadingElement>('#app-title');
const appHeroCopy = document.querySelector<HTMLParagraphElement>('#app-hero-copy');
const localeLabel = document.querySelector<HTMLSpanElement>('#locale-label');
const localeSelect = document.querySelector<HTMLSelectElement>('#locale-select');
const statusChip = document.querySelector<HTMLDivElement>('#status-chip');
const sectionLevels = document.querySelector<HTMLHeadingElement>('#section-levels');
const sectionHints = document.querySelector<HTMLHeadingElement>('#section-hints');
const sectionRecord = document.querySelector<HTMLHeadingElement>('#section-record');
const sectionProgress = document.querySelector<HTMLHeadingElement>('#section-progress');
const sectionActions = document.querySelector<HTMLHeadingElement>('#section-actions');
const sectionRules = document.querySelector<HTMLHeadingElement>('#section-rules');
const ruleArea = document.querySelector<HTMLLIElement>('#rule-area');
const ruleSingle = document.querySelector<HTMLLIElement>('#rule-single');
const ruleCover = document.querySelector<HTMLLIElement>('#rule-cover');
const ruleInput = document.querySelector<HTMLLIElement>('#rule-input');
const levelProgress = document.querySelector<HTMLParagraphElement>('#level-progress');
const levelName = document.querySelector<HTMLHeadingElement>('#level-name');
const boardMeta = document.querySelector<HTMLParagraphElement>('#board-meta');
const levelHint = document.querySelector<HTMLParagraphElement>('#level-hint');
const levelCollectionMeta = document.querySelector<HTMLParagraphElement>('#level-collection-meta');
const levelGrid = document.querySelector<HTMLDivElement>('#level-grid');
const recordSummary = document.querySelector<HTMLParagraphElement>('#record-summary');
const recordDetail = document.querySelector<HTMLParagraphElement>('#record-detail');
const coverageText = document.querySelector<HTMLParagraphElement>('#coverage-text');
const statusText = document.querySelector<HTMLParagraphElement>('#status-text');
const undoButton = document.querySelector<HTMLButtonElement>('#undo-button');
const restartButton = document.querySelector<HTMLButtonElement>('#restart-button');
const hintButton = document.querySelector<HTMLButtonElement>('#hint-button');
const nextButton = document.querySelector<HTMLButtonElement>('#next-button');

if (
  !canvas ||
  !selectionLayer ||
  !appEyebrow ||
  !appTitle ||
  !appHeroCopy ||
  !localeLabel ||
  !localeSelect ||
  !statusChip ||
  !sectionLevels ||
  !sectionHints ||
  !sectionRecord ||
  !sectionProgress ||
  !sectionActions ||
  !sectionRules ||
  !ruleArea ||
  !ruleSingle ||
  !ruleCover ||
  !ruleInput ||
  !levelProgress ||
  !levelName ||
  !boardMeta ||
  !levelHint ||
  !levelCollectionMeta ||
  !levelGrid ||
  !recordSummary ||
  !recordDetail ||
  !coverageText ||
  !statusText ||
  !undoButton ||
  !restartButton ||
  !hintButton ||
  !nextButton
) {
  throw new Error('UI bootstrapping failed');
}

function createImage(url: string, onReady: () => void): HTMLImageElement {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  if (!image.complete) {
    image.addEventListener('load', onReady, { once: true });
  }

  return image;
}

function getCanvasImage(image: HTMLImageElement): CanvasImageSource | null {
  return image.complete && image.naturalWidth > 0 ? image : null;
}

let locale: Locale = loadLocale() ?? detectLocale();
const gameStorage = new BrowserGameStorage(new BrowserLocalStorageAdapter());
const savedGameState = gameStorage.load(levels);
const game = new GameController(levels, {
  initialRecords: savedGameState.records,
  initialProgress: savedGameState.progress,
  onRecordsChange: (records) => {
    gameStorage.saveRecords(records);
  },
  onProgressChange: (progress) => {
    gameStorage.saveProgress(progress);
  },
});
const surface = new BrowserCanvasSurface(canvas);
const renderer = new CanvasRenderer(surface);
const COMBO_VOICE_URLS: Record<string, string> = {
  good: new URL('../assets/wechat/audio/combo/combo_good.mp3', import.meta.url).href,
  great: new URL('../assets/wechat/audio/combo/combo_great.mp3', import.meta.url).href,
  nice: new URL('../assets/wechat/audio/combo/combo_nice.mp3', import.meta.url).href,
  amazing: new URL('../assets/wechat/audio/combo/combo_amazing.mp3', import.meta.url).href,
  prefect: new URL('../assets/wechat/audio/combo/combo_prefect.mp3', import.meta.url).href,
};

const audio = new FeedbackAudio(COMBO_VOICE_URLS);
const pointerInputSource = new BrowserPointerInputSource(canvas);
new PointerController(pointerInputSource, surface, renderer, game);

const visualAssets: VisualAssets = {
  background: createImage(WECHAT_ASSET_URLS.background, () => renderBoard(game.getSnapshot())),
  gameplayBackground: createImage(WECHAT_ASSET_URLS.gameplayBackground, () => renderBoard(game.getSnapshot())),
  selectionStrawberry: createImage(WECHAT_ASSET_URLS.selectionStrawberry, () => renderBoard(game.getSnapshot())),
  selectionHeartPink: createImage(WECHAT_ASSET_URLS.selectionHeartPink, () => renderBoard(game.getSnapshot())),
  selectionStarYellow: createImage(WECHAT_ASSET_URLS.selectionStarYellow, () => renderBoard(game.getSnapshot())),
  selectionSparkleWhite: createImage(WECHAT_ASSET_URLS.selectionSparkleWhite, () => renderBoard(game.getSnapshot())),
  selectionBubblePink: createImage(WECHAT_ASSET_URLS.selectionBubblePink, () => renderBoard(game.getSnapshot())),
  selectionBubbleYellow: createImage(WECHAT_ASSET_URLS.selectionBubbleYellow, () => renderBoard(game.getSnapshot())),
  selectionDripYellow: createImage(WECHAT_ASSET_URLS.selectionDripYellow, () => renderBoard(game.getSnapshot())),
};

document.documentElement.style.setProperty(
  '--wechat-gameplay-background',
  `url("${WECHAT_ASSET_URLS.gameplayBackground}")`,
);

const primeAudio = (): void => {
  audio.prime();
};

let currentSnapshot = game.getSnapshot();
let animationFrameId = 0;
let lastPlacementEffectId = 0;
let lastInvalidEffectId = 0;
let lastCelebrationEffectId = 0;
let lastComboVoice: string | null = null;
let autoAdvanceTimeoutId = 0;
let lastAutoAdvanceCelebrationId = 0;

localeSelect.innerHTML = '';
for (const supportedLocale of getSupportedLocales()) {
  const option = document.createElement('option');
  option.value = supportedLocale;
  option.textContent = t(locale, `locale.name.${supportedLocale}`);
  localeSelect.append(option);
}
localeSelect.value = locale;

const levelButtons = levels.map((level, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'level-tile';
  button.dataset.levelIndex = String(index);

  const number = document.createElement('span');
  number.className = 'level-tile__number';
  number.textContent = String(index + 1);

  const mark = document.createElement('span');
  mark.className = 'level-tile__mark';
  mark.textContent = '';

  button.append(number, mark);
  button.addEventListener('click', () => {
    const snapshot = game.getSnapshot();
    if (snapshot.records[level.id]) {
      game.viewRecordedLevel(index);
      return;
    }

    game.setLevel(index);
  });

  levelGrid.append(button);
  return button;
});

const placeholderCount = Math.max(0, 36 - levels.length);
for (let index = 0; index < placeholderCount; index += 1) {
  const placeholder = document.createElement('div');
  placeholder.className = 'level-tile level-tile--placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  levelGrid.append(placeholder);
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatCompletedAt(isoString: string): string {
  return formatLocaleDate(locale, isoString) ?? t(locale, 'fallback.unknownTime');
}

function renderRecord(record: LevelRecord | null, mode: GameSnapshot['mode']): void {
  const recordSummaryElement = recordSummary!;
  const recordDetailElement = recordDetail!;

  if (!record) {
    recordSummaryElement.textContent = t(locale, 'record.noneSummary');
    recordDetailElement.textContent = t(locale, 'record.noneDetail');
    return;
  }

  recordSummaryElement.textContent = t(locale, 'record.summary', {
    duration: formatDuration(record.durationMs),
  });
  recordDetailElement.textContent = t(
    locale,
    mode === 'record' ? 'record.detailViewing' : 'record.detailSaved',
    {
      count: record.placements.length,
      completedAt: formatCompletedAt(record.completedAt),
    },
  );
}

function renderStaticUi(): void {
  appEyebrow!.textContent = t(locale, 'app.eyebrow');
  appTitle!.textContent = t(locale, 'app.title');
  appHeroCopy!.textContent = t(locale, 'app.heroCopy');
  localeLabel!.textContent = t(locale, 'locale.label');
  sectionLevels!.textContent = t(locale, 'section.levels');
  sectionHints!.textContent = t(locale, 'section.hints');
  sectionRecord!.textContent = t(locale, 'section.record');
  sectionProgress!.textContent = t(locale, 'section.progress');
  sectionActions!.textContent = t(locale, 'section.actions');
  sectionRules!.textContent = t(locale, 'section.rules');
  ruleArea!.textContent = t(locale, 'rule.area');
  ruleSingle!.textContent = t(locale, 'rule.singleClue');
  ruleCover!.textContent = t(locale, 'rule.cover');
  ruleInput!.textContent = t(locale, 'rule.input');

  Array.from(localeSelect!.options).forEach((option) => {
    const supportedLocale = option.value as Locale;
    option.textContent = t(locale, `locale.name.${supportedLocale}`);
  });
}

const renderUi = (snapshot: GameSnapshot): void => {
  renderStaticUi();
  const completedCount = Object.keys(snapshot.records).length;
  levelProgress.textContent = t(locale, 'level.progress', {
    current: snapshot.levelIndex + 1,
    total: levels.length,
  });
  levelName.textContent = formatLevelName(locale, snapshot.level.number, snapshot.level.titleKey);
  boardMeta.textContent = t(locale, 'board.meta', {
    width: snapshot.level.width,
    height: snapshot.level.height,
    clues: snapshot.level.clues.length,
  });
  levelHint.textContent = snapshot.hintMessage ? tm(locale, snapshot.hintMessage) : t(locale, 'hint.placeholder');
  levelCollectionMeta.textContent = t(locale, 'level.collectionMeta', {
    completed: completedCount,
    total: levels.length,
  });
  renderRecord(snapshot.currentRecord, snapshot.mode);

  const covered = getCoveredCellCount(snapshot.level, snapshot.placements);
  const total = snapshot.level.width * snapshot.level.height;
  coverageText.textContent = t(
    locale,
    snapshot.mode === 'record' ? 'coverage.record' : 'coverage.play',
    { covered, total },
  );
  statusText.textContent = tm(locale, snapshot.status);
  statusChip.textContent =
    snapshot.mode === 'record'
      ? t(locale, 'chip.record')
      : snapshot.solved
        ? t(locale, 'chip.solved')
        : snapshot.preview?.validation.ok
          ? t(locale, 'chip.ready')
          : t(locale, 'chip.active');
  statusChip.dataset.state =
    snapshot.mode === 'record'
      ? 'view'
      : snapshot.solved
        ? 'solved'
        : snapshot.preview?.validation.ok
          ? 'ready'
          : 'active';

  undoButton.disabled = !snapshot.canUndo || snapshot.mode === 'record';
  undoButton.textContent = t(locale, 'button.undo');
  restartButton.textContent = t(locale, snapshot.mode === 'record' ? 'button.retry' : 'button.restart');
  hintButton.textContent = t(locale, 'button.hint');
  nextButton.textContent = t(locale, 'button.next');
  hintButton.disabled = snapshot.solved || snapshot.mode === 'record';
  nextButton.disabled = !snapshot.hasNextLevel;

  levelButtons.forEach((button, index) => {
    const level = levels[index];
    const record = snapshot.records[level.id];
    const mark = button.querySelector<HTMLSpanElement>('.level-tile__mark');
    const localizedLevelName = formatLevelName(locale, level.number, level.titleKey);

    button.dataset.current = String(snapshot.levelIndex === index);
    button.dataset.completed = String(Boolean(record));
    button.dataset.viewing = String(snapshot.levelIndex === index && snapshot.mode === 'record');
    button.title = record
      ? t(locale, 'tile.completed', {
          levelName: localizedLevelName,
          duration: formatDuration(record.durationMs),
        })
      : t(locale, 'tile.incomplete', {
          levelName: localizedLevelName,
        });

    if (mark) {
      mark.textContent = record ? '✓' : '';
    }
  });
};

const render = (snapshot: GameSnapshot): void => {
  currentSnapshot = snapshot;
  renderUi(snapshot);
  renderBoard(snapshot);
  syncFeedbackAudio(snapshot);
  scheduleAutoAdvance(snapshot);
  ensureAnimationLoop();
};

function renderBoard(snapshot: GameSnapshot): void {
  selectionLayer!.replaceChildren();
  renderer.render(snapshot, {
    labels: {
      solvedBadge: t(locale, 'renderer.badgeSolved'),
      recordBadge: t(locale, 'renderer.badgeRecord'),
    },
    backdropImage:
      getCanvasImage(visualAssets.gameplayBackground) ?? getCanvasImage(visualAssets.background),
    theme: 'kawaii',
    selectionAssets: {
      strawberry: getCanvasImage(visualAssets.selectionStrawberry),
      heartPink: getCanvasImage(visualAssets.selectionHeartPink),
      starYellow: getCanvasImage(visualAssets.selectionStarYellow),
      sparkleWhite: getCanvasImage(visualAssets.selectionSparkleWhite),
      bubblePink: getCanvasImage(visualAssets.selectionBubblePink),
      bubbleYellow: getCanvasImage(visualAssets.selectionBubbleYellow),
      dripYellow: getCanvasImage(visualAssets.selectionDripYellow),
    },
  });
}

function syncFeedbackAudio(snapshot: GameSnapshot): void {
  const celebrationEffectId = snapshot.effects.celebrationId;
  const celebrationChanged = celebrationEffectId !== lastCelebrationEffectId;
  const suppressPlacement = celebrationChanged && celebrationEffectId > 0;

  const placementEffectId = snapshot.effects.placement?.id ?? 0;
  if (placementEffectId !== lastPlacementEffectId) {
    lastPlacementEffectId = placementEffectId;
    if (placementEffectId > 0 && !suppressPlacement) {
      audio.playPlacement();
    }
  }

  if (snapshot.effects.invalidId !== lastInvalidEffectId) {
    lastInvalidEffectId = snapshot.effects.invalidId;
    if (snapshot.effects.invalidId > 0) {
      audio.playInvalid();
    }
  }

  if (celebrationChanged) {
    lastCelebrationEffectId = celebrationEffectId;
    if (celebrationEffectId > 0) {
      audio.playCelebration();
    }
  }

  const comboVoice = snapshot.effects.comboVoice;
  if (comboVoice && comboVoice !== lastComboVoice) {
    lastComboVoice = comboVoice;
    audio.playComboVoice(comboVoice);
  }

  if (!comboVoice) {
    lastComboVoice = null;
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
    window.clearTimeout(autoAdvanceTimeoutId);
    autoAdvanceTimeoutId = 0;
  }

  lastAutoAdvanceCelebrationId = snapshot.effects.celebrationId;
  autoAdvanceTimeoutId = window.setTimeout(() => {
    autoAdvanceTimeoutId = 0;
    const latest = game.getSnapshot();
    if (latest.mode === 'play' && latest.solved && latest.hasNextLevel) {
      game.nextLevel();
    }
  }, 1200);
}

function ensureAnimationLoop(): void {
  if (animationFrameId !== 0 || !renderer.hasActiveEffects()) {
    return;
  }

  animationFrameId = window.requestAnimationFrame(tickAnimationFrame);
}

function tickAnimationFrame(): void {
  animationFrameId = 0;
  renderBoard(currentSnapshot);

  if (renderer.hasActiveEffects()) {
    animationFrameId = window.requestAnimationFrame(tickAnimationFrame);
  }
}

game.subscribe(render);

undoButton.addEventListener('click', () => {
  primeAudio();
  game.undo();
});

restartButton.addEventListener('click', () => {
  primeAudio();
  game.resetLevel();
});

hintButton.addEventListener('click', () => {
  primeAudio();
  game.requestHint();
});

nextButton.addEventListener('click', () => {
  primeAudio();
  game.nextLevel();
});

canvas.addEventListener('pointerdown', primeAudio, { passive: true });
undoButton.addEventListener('pointerdown', primeAudio, { passive: true });
restartButton.addEventListener('pointerdown', primeAudio, { passive: true });
hintButton.addEventListener('pointerdown', primeAudio, { passive: true });
nextButton.addEventListener('pointerdown', primeAudio, { passive: true });

localeSelect.addEventListener('change', () => {
  const nextLocale = localeSelect.value as Locale;
  locale = nextLocale;
  saveLocale(locale);
  render(currentSnapshot);
});

window.addEventListener('keydown', (event) => {
  primeAudio();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    game.undo();
  }
});

window.addEventListener('resize', () => {
  currentSnapshot = game.getSnapshot();
  renderBoard(currentSnapshot);
  ensureAnimationLoop();
});

if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(() => {
    currentSnapshot = game.getSnapshot();
    renderBoard(currentSnapshot);
    ensureAnimationLoop();
  });
  observer.observe(canvas);
}
