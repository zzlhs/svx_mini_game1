import './style.css';

import { FeedbackAudio } from './audio/FeedbackAudio';
import { WebBackgroundMusic } from './audio/WebBackgroundMusic';
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
  type MessageKey,
} from './i18n';
import { BrowserPointerInputSource } from './input/BrowserPointerInputSource';
import { PointerController } from './input/PointerController';
import { BrowserCanvasSurface } from './render/BrowserCanvasSurface';
import { CanvasRenderer } from './render/CanvasRenderer';
import { BrowserGameStorage, getWeeklyBucketKey } from './storage/BrowserGameStorage';
import { BrowserLocalStorageAdapter } from './storage/BrowserLocalStorageAdapter';

interface VisualAssets {
  background: HTMLImageElement;
  gameplayBackground: HTMLImageElement;
  mascotCatCloud: HTMLImageElement;
  sunIcon: HTMLImageElement;
  trophyIcon: HTMLImageElement;
  lightbulbIcon: HTMLImageElement;
  noteIcon: HTMLImageElement;
  flagIcon: HTMLImageElement;
  checklistIcon: HTMLImageElement;
  cloudFaceIcon: HTMLImageElement;
  bottomButtonIcons: HTMLImageElement;
  decorSheet: HTMLImageElement;
  selectionStrawberry: HTMLImageElement;
  selectionHeartPink: HTMLImageElement;
  selectionStarYellow: HTMLImageElement;
  selectionSparkleWhite: HTMLImageElement;
  selectionBubblePink: HTMLImageElement;
  selectionBubbleYellow: HTMLImageElement;
  selectionDripYellow: HTMLImageElement;
  settingsCloudSmileHeart: HTMLImageElement;
  settingsStarPinkBig: HTMLImageElement;
  settingsMusicBadge: HTMLImageElement;
  settingsVibrationBadge: HTMLImageElement;
  settingsCloudClusterLeft: HTMLImageElement;
  settingsHeartCorner: HTMLImageElement;
  settingsHeartSmall: HTMLImageElement;
  settingsSparkleWhite: HTMLImageElement;
  settingsStarYellowSmall: HTMLImageElement;
  levelPanelCloudLeft: HTMLImageElement;
  levelPanelCloudRight: HTMLImageElement;
  levelPanelCloudSmileHeart: HTMLImageElement;
  levelPanelHeartPink: HTMLImageElement;
  levelPanelRibbonPink: HTMLImageElement;
  levelPanelStarBigYellow: HTMLImageElement;
  levelPanelStarBlue: HTMLImageElement;
  levelPanelStarFaceYellow: HTMLImageElement;
  levelPanelStarPink: HTMLImageElement;
  levelPanelSparkleWhite: HTMLImageElement;
  leaderboardRibbonPurple: HTMLImageElement;
  leaderboardBunnyPeekLeft: HTMLImageElement;
  leaderboardRainbowCloud: HTMLImageElement;
  leaderboardEmptyTrophyBunny: HTMLImageElement;
}

type OverlayName = 'levels' | 'settings' | 'leaderboard' | null;
type OpenOverlayName = Exclude<OverlayName, null>;

interface WebUiState {
  activeOverlay: OverlayName;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const ASSET = (path: string): string => new URL(`../assets/wechat/${path}`, import.meta.url).href;

const WECHAT_ASSET_URLS = {
  background: ASSET('bg.jpg'),
  gameplayBackground: ASSET('bg_kawaii.png'),
  mascotCatCloud: ASSET('kawaii/mascot-cat-cloud.png'),
  sunIcon: ASSET('kawaii/icon-sun.png'),
  trophyIcon: ASSET('kawaii/icon-trophy.png'),
  lightbulbIcon: ASSET('kawaii/icon-lightbulb.png'),
  noteIcon: ASSET('kawaii/icon-note.png'),
  flagIcon: ASSET('kawaii/icon-flag.png'),
  checklistIcon: ASSET('kawaii/icon-checklist.png'),
  cloudFaceIcon: ASSET('kawaii/icon-cloud-face.png'),
  bottomButtonIcons: ASSET('kawaii/bottom-btn.png'),
  decorSheet: ASSET('kawaii/icon-star-heart-cloud.png'),
  selectionStrawberry: ASSET('selection/selection_decor_strawberry.png'),
  selectionHeartPink: ASSET('selection/selection_decor_heart_pink.png'),
  selectionStarYellow: ASSET('selection/selection_decor_star_yellow.png'),
  selectionSparkleWhite: ASSET('selection/selection_decor_sparkle_white.png'),
  selectionBubblePink: ASSET('selection/selection_decor_bubble_pink.png'),
  selectionBubbleYellow: ASSET('selection/selection_decor_bubble_yellow.png'),
  selectionDripYellow: ASSET('selection/selection_top_drip_yellow.png'),
  settingsCloudSmileHeart: ASSET('settings/decor_cloud_smile_heart.png'),
  settingsStarPinkBig: ASSET('settings/decor_star_pink_big.png'),
  settingsMusicBadge: ASSET('settings/icon_music_badge.png'),
  settingsVibrationBadge: ASSET('settings/icon_vibration_badge.png'),
  settingsCloudClusterLeft: ASSET('settings/decor_cloud_cluster_left.png'),
  settingsHeartCorner: ASSET('settings/decor_heart_corner.png'),
  settingsHeartSmall: ASSET('settings/decor_heart_small.png'),
  settingsSparkleWhite: ASSET('settings/decor_sparkle_white.png'),
  settingsStarYellowSmall: ASSET('settings/decor_star_yellow_small_transparent.png'),
  levelPanelCloudLeft: ASSET('level-panel/decor_cloud_cluster_left.png'),
  levelPanelCloudRight: ASSET('level-panel/decor_cloud_cluster_right.png'),
  levelPanelCloudSmileHeart: ASSET('level-panel/decor_cloud_smile_heart.png'),
  levelPanelHeartPink: ASSET('level-panel/decor_heart_pink.png'),
  levelPanelRibbonPink: ASSET('level-panel/decor_ribbon_pink.png'),
  levelPanelStarBigYellow: ASSET('level-panel/decor_star_big_yellow.png'),
  levelPanelStarBlue: ASSET('level-panel/decor_star_blue.png'),
  levelPanelStarFaceYellow: ASSET('level-panel/decor_star_face_yellow.png'),
  levelPanelStarPink: ASSET('level-panel/decor_star_pink.png'),
  levelPanelSparkleWhite: ASSET('level-panel/decor_sparkle_white.png'),
  leaderboardRibbonPurple: ASSET('leaderboard/decor_ribbon_leaderboard_purple.svg'),
  leaderboardBunnyPeekLeft: ASSET('leaderboard/decor_bunny_peek_left.svg'),
  leaderboardRainbowCloud: ASSET('leaderboard/decor_rainbow_cloud.svg'),
  leaderboardEmptyTrophyBunny: ASSET('leaderboard/empty_trophy_bunny.svg'),
  comboGood: ASSET('audio/combo/combo_good.mp3'),
  comboGreat: ASSET('audio/combo/combo_great.mp3'),
  comboNice: ASSET('audio/combo/combo_nice.mp3'),
  comboAmazing: ASSET('audio/combo/combo_amazing.mp3'),
  comboPrefect: ASSET('audio/combo/combo_prefect.mp3'),
  backgroundMusic: ASSET('audio/Perfect_Match_Bloom.mp3'),
} as const;

const SETTINGS_STORAGE_KEY = 'patch-grid-web-settings-v1';
const LAZY_ASSET_KEYS = new Set<keyof VisualAssets>([
  'settingsCloudSmileHeart',
  'settingsStarPinkBig',
  'settingsMusicBadge',
  'settingsVibrationBadge',
  'settingsCloudClusterLeft',
  'settingsHeartCorner',
  'settingsHeartSmall',
  'settingsSparkleWhite',
  'settingsStarYellowSmall',
  'levelPanelCloudLeft',
  'levelPanelCloudRight',
  'levelPanelCloudSmileHeart',
  'levelPanelHeartPink',
  'levelPanelRibbonPink',
  'levelPanelStarBigYellow',
  'levelPanelStarBlue',
  'levelPanelStarFaceYellow',
  'levelPanelStarPink',
  'levelPanelSparkleWhite',
  'leaderboardRibbonPurple',
  'leaderboardBunnyPeekLeft',
  'leaderboardRainbowCloud',
  'leaderboardEmptyTrophyBunny',
]);

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <div class="app-shell kawaii-page">
    <div class="game-frame">
      <div class="quick-actions" id="quick-actions" aria-label="Quick actions">
        <button class="icon-button" id="settings-button" type="button" aria-label="Settings">
          <img id="settings-icon" alt="" />
        </button>
        <button class="icon-button" id="leaderboard-button" type="button" aria-label="Leaderboard">
          <img id="leaderboard-icon" alt="" />
        </button>
      </div>

      <main class="game-page">
        <section class="level-hero kawaii-card">
          <img class="hero-mascot" id="mascot-image" alt="" />
          <div class="hero-copy-block">
            <h1 id="app-title"></h1>
            <div class="hero-meta">
              <span id="level-progress"></span>
              <span id="board-meta"></span>
            </div>
            <h2 id="level-name"></h2>
          </div>
          <div class="status-chip" id="status-chip"></div>
        </section>

        <section class="info-card-row" id="game-information" aria-label="Game information">
          <article class="info-card info-card--hint">
            <img class="info-card__icon" id="hint-icon" alt="" />
            <div class="info-card__body">
              <h3 id="section-hints"></h3>
              <p id="level-hint"></p>
            </div>
          </article>
          <article class="info-card info-card--record">
            <img class="info-card__icon" id="record-icon" alt="" />
            <div class="info-card__body">
              <h3 id="section-record"></h3>
              <p id="record-summary"></p>
              <p id="record-detail" class="status-text"></p>
            </div>
          </article>
          <article class="info-card info-card--progress">
            <img class="info-card__icon" id="progress-icon" alt="" />
            <div class="info-card__body">
              <h3 id="section-progress"></h3>
              <p id="coverage-text"></p>
              <p id="status-text" class="status-text"></p>
            </div>
          </article>
        </section>

        <section class="board-panel kawaii-card">
          <div class="canvas-stage">
            <canvas id="game-canvas" aria-label="Fill Grid game board"></canvas>
            <div id="selection-layer" class="selection-layer" aria-hidden="true"></div>
            <img class="board-decor board-decor--cloud" id="cloud-face-image" alt="" aria-hidden="true" />
            <span class="board-decor board-decor--star-one" aria-hidden="true"></span>
            <span class="board-decor board-decor--star-two" aria-hidden="true"></span>
            <span class="board-decor board-decor--heart" aria-hidden="true"></span>
          </div>
        </section>

        <section class="rules-card kawaii-card">
          <img class="rules-card__icon" id="rules-icon" alt="" />
          <div>
            <h3 id="section-rules"></h3>
            <p class="rules-summary" id="rules-summary"></p>
          </div>
          <p class="rules-input" id="rule-input"></p>
        </section>

        <nav class="action-bar" id="game-actions" aria-label="Game actions">
          <button class="action-button action-button--levels" id="levels-button" type="button">
            <span class="action-icon" aria-hidden="true"></span><span class="action-label"></span>
          </button>
          <button class="action-button action-button--undo" id="undo-button" type="button">
            <span class="action-icon" aria-hidden="true"></span><span class="action-label"></span>
          </button>
          <button class="action-button action-button--restart" id="restart-button" type="button">
            <span class="action-icon" aria-hidden="true"></span><span class="action-label"></span>
          </button>
          <button class="action-button action-button--hint" id="hint-button" type="button">
            <span class="action-icon" aria-hidden="true"></span><span class="action-label"></span>
          </button>
          <button class="action-button action-button--next" id="next-button" type="button">
            <span class="action-icon" aria-hidden="true"></span><span class="action-label"></span>
          </button>
        </nav>
      </main>
    </div>

    <div class="overlay-root" id="overlay-root" hidden>
      <section class="overlay-panel overlay-panel--levels" id="levels-dialog" role="dialog" aria-modal="true" aria-labelledby="levels-dialog-title" hidden>
        <button class="overlay-close" type="button" data-close-overlay aria-label="Close">×</button>
        <div class="panel-decoration panel-decoration--level-top" aria-hidden="true"></div>
        <img class="overlay-cloud overlay-cloud--left" id="level-cloud-left" alt="" aria-hidden="true" />
        <img class="overlay-cloud overlay-cloud--right" id="level-cloud-right" alt="" aria-hidden="true" />
        <img class="overlay-level-decor overlay-level-decor--smile" id="level-cloud-smile-heart" alt="" aria-hidden="true" />
        <img class="overlay-level-decor overlay-level-decor--heart" id="level-heart-pink" alt="" aria-hidden="true" />
        <img class="overlay-star overlay-star--yellow" id="level-star-yellow" alt="" aria-hidden="true" />
        <img class="overlay-star overlay-star--pink" id="level-star-pink" alt="" aria-hidden="true" />
        <img class="overlay-level-decor overlay-level-decor--big-star" id="level-star-big-yellow" alt="" aria-hidden="true" />
        <img class="overlay-level-decor overlay-level-decor--blue-star" id="level-star-blue" alt="" aria-hidden="true" />
        <img class="overlay-level-decor overlay-level-decor--sparkle" id="level-sparkle-white" alt="" aria-hidden="true" />
        <header class="overlay-heading">
          <img id="level-ribbon-image" alt="" aria-hidden="true" />
          <h2 id="levels-dialog-title"></h2>
          <p id="level-collection-meta"></p>
        </header>
        <div class="level-grid" id="level-grid"></div>
      </section>

      <section class="overlay-panel overlay-panel--settings" id="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title" hidden>
        <button class="overlay-close" type="button" data-close-overlay aria-label="Close">×</button>
        <img class="settings-decor settings-decor--cloud" id="settings-cloud" alt="" aria-hidden="true" />
        <img class="settings-decor settings-decor--star" id="settings-star" alt="" aria-hidden="true" />
        <img class="settings-decor settings-decor--corner" id="settings-corner" alt="" aria-hidden="true" />
        <img class="settings-decor settings-decor--cluster" id="settings-cluster" alt="" aria-hidden="true" />
        <img class="settings-decor settings-decor--small-heart" id="settings-small-heart" alt="" aria-hidden="true" />
        <img class="settings-decor settings-decor--sparkle" id="settings-sparkle" alt="" aria-hidden="true" />
        <img class="settings-decor settings-decor--yellow-star" id="settings-yellow-star" alt="" aria-hidden="true" />
        <h2 id="settings-dialog-title"></h2>
        <div class="settings-row">
          <img id="settings-sound-icon" alt="" />
          <span id="settings-sound-label"></span>
          <button class="toggle" id="sound-toggle" type="button" role="switch" aria-labelledby="settings-sound-label" aria-checked="true"><span></span></button>
        </div>
        <div class="settings-row">
          <img id="settings-vibration-icon" alt="" />
          <span id="settings-vibration-label"></span>
          <button class="toggle" id="vibration-toggle" type="button" role="switch" aria-labelledby="settings-vibration-label" aria-describedby="settings-vibration-note" aria-checked="true"><span></span></button>
        </div>
        <p class="settings-support-note" id="settings-vibration-note" role="status" hidden></p>
        <label class="settings-locale">
          <span id="locale-label"></span>
          <select id="locale-select"></select>
        </label>
        <div class="settings-actions">
          <button class="secondary-button" type="button" data-close-overlay id="settings-back-button"></button>
          <button class="primary-button" type="button" data-close-overlay id="settings-continue-button"></button>
        </div>
      </section>

      <section class="overlay-panel overlay-panel--leaderboard" id="leaderboard-dialog" role="dialog" aria-modal="true" aria-labelledby="leaderboard-dialog-title" hidden>
        <button class="overlay-close" type="button" data-close-overlay aria-label="Close">×</button>
        <img class="leaderboard-decor leaderboard-decor--bunny" id="leaderboard-bunny" alt="" aria-hidden="true" />
        <img class="leaderboard-decor leaderboard-decor--cloud" id="leaderboard-cloud" alt="" aria-hidden="true" />
        <img class="leaderboard-ribbon" id="leaderboard-ribbon" alt="" aria-hidden="true" />
        <h2 id="leaderboard-dialog-title"></h2>
        <p class="leaderboard-note" id="leaderboard-note"></p>
        <div class="leaderboard-list" id="leaderboard-list"></div>
      </section>
    </div>
  </div>
`;

const query = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }
  return element;
};

const canvas = query<HTMLCanvasElement>('#game-canvas');
const selectionLayer = query<HTMLDivElement>('#selection-layer');
const statusChip = query<HTMLDivElement>('#status-chip');
const appTitle = query<HTMLHeadingElement>('#app-title');
const levelProgress = query<HTMLSpanElement>('#level-progress');
const levelName = query<HTMLHeadingElement>('#level-name');
const boardMeta = query<HTMLSpanElement>('#board-meta');
const levelHint = query<HTMLParagraphElement>('#level-hint');
const levelCollectionMeta = query<HTMLParagraphElement>('#level-collection-meta');
const recordSummary = query<HTMLParagraphElement>('#record-summary');
const recordDetail = query<HTMLParagraphElement>('#record-detail');
const coverageText = query<HTMLParagraphElement>('#coverage-text');
const statusText = query<HTMLParagraphElement>('#status-text');
const sectionHints = query<HTMLHeadingElement>('#section-hints');
const sectionRecord = query<HTMLHeadingElement>('#section-record');
const sectionProgress = query<HTMLHeadingElement>('#section-progress');
const sectionRules = query<HTMLHeadingElement>('#section-rules');
const rulesSummary = query<HTMLParagraphElement>('#rules-summary');
const ruleInput = query<HTMLParagraphElement>('#rule-input');
const levelGrid = query<HTMLDivElement>('#level-grid');
const localeLabel = query<HTMLSpanElement>('#locale-label');
const localeSelect = query<HTMLSelectElement>('#locale-select');
const overlayRoot = query<HTMLDivElement>('#overlay-root');
const levelsDialog = query<HTMLElement>('#levels-dialog');
const settingsDialog = query<HTMLElement>('#settings-dialog');
const leaderboardDialog = query<HTMLElement>('#leaderboard-dialog');
const leaderboardList = query<HTMLDivElement>('#leaderboard-list');
const leaderboardNote = query<HTMLParagraphElement>('#leaderboard-note');
const soundToggle = query<HTMLButtonElement>('#sound-toggle');
const vibrationToggle = query<HTMLButtonElement>('#vibration-toggle');
const settingsVibrationLabel = query<HTMLSpanElement>('#settings-vibration-label');
const settingsBackButton = query<HTMLButtonElement>('#settings-back-button');
const settingsContinueButton = query<HTMLButtonElement>('#settings-continue-button');
const settingsVibrationNote = query<HTMLParagraphElement>('#settings-vibration-note');
const settingsButton = query<HTMLButtonElement>('#settings-button');
const leaderboardButton = query<HTMLButtonElement>('#leaderboard-button');
const levelsButton = query<HTMLButtonElement>('#levels-button');
const undoButton = query<HTMLButtonElement>('#undo-button');
const restartButton = query<HTMLButtonElement>('#restart-button');
const hintButton = query<HTMLButtonElement>('#hint-button');
const nextButton = query<HTMLButtonElement>('#next-button');

function createImage(url: string, onReady: () => void): HTMLImageElement {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  if (!image.complete) {
    image.addEventListener('load', onReady, { once: true });
    image.addEventListener('error', onReady, { once: true });
  }
  return image;
}

function getCanvasImage(image: HTMLImageElement): CanvasImageSource | null {
  return image.complete && image.naturalWidth > 0 ? image : null;
}

function readWebSettings(): Pick<WebUiState, 'soundEnabled' | 'vibrationEnabled'> {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { soundEnabled: true, vibrationEnabled: typeof navigator.vibrate === 'function' };
    }
    const parsed = JSON.parse(raw) as Partial<WebUiState>;
    return {
      soundEnabled: parsed.soundEnabled !== false,
      vibrationEnabled: parsed.vibrationEnabled !== false && typeof navigator.vibrate === 'function',
    };
  } catch {
    return { soundEnabled: true, vibrationEnabled: typeof navigator.vibrate === 'function' };
  }
}

function saveWebSettings(state: Pick<WebUiState, 'soundEnabled' | 'vibrationEnabled'>): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the in-memory setting when storage is unavailable.
  }
}

let locale: Locale = loadLocale() ?? detectLocale();
const gameStorage = new BrowserGameStorage(new BrowserLocalStorageAdapter());
const savedGameState = gameStorage.load(levels);
const game = new GameController(levels, {
  initialRecords: savedGameState.records,
  initialProgress: savedGameState.progress,
  onRecordsChange: (records) => gameStorage.saveRecords(records),
  onProgressChange: (progress) => gameStorage.saveProgress(progress),
});
const surface = new BrowserCanvasSurface(canvas);
const renderer = new CanvasRenderer(surface);
const audio = new FeedbackAudio({
  good: WECHAT_ASSET_URLS.comboGood,
  great: WECHAT_ASSET_URLS.comboGreat,
  nice: WECHAT_ASSET_URLS.comboNice,
  amazing: WECHAT_ASSET_URLS.comboAmazing,
  prefect: WECHAT_ASSET_URLS.comboPrefect,
});
const backgroundMusic = new WebBackgroundMusic(WECHAT_ASSET_URLS.backgroundMusic);
const pointerInputSource = new BrowserPointerInputSource(canvas);
new PointerController(pointerInputSource, surface, renderer, game);

const initialSettings = readWebSettings();
const uiState: WebUiState = {
  activeOverlay: null,
  ...initialSettings,
};
audio.setEnabled(uiState.soundEnabled);
backgroundMusic.setEnabled(uiState.soundEnabled);

function primeAudio(): void {
  audio.prime();
  backgroundMusic.prime();
}

const visualAssets = {} as VisualAssets;
let currentSnapshot = game.getSnapshot();
let animationFrameId = 0;
let lastPlacementEffectId = 0;
let lastInvalidEffectId = 0;
let lastCelebrationEffectId = 0;
let lastComboVoice: string | null = null;
let autoAdvanceTimeoutId = 0;
let lastAutoAdvanceCelebrationId = 0;
let campaignState = gameStorage.loadCampaignState();
let weeklyLeaderboard = gameStorage.loadWeeklyLeaderboard();
let lastCampaignCompletionCelebrationId = 0;
let lastFocusedElement: HTMLElement | null = null;

if (!campaignState && Object.keys(savedGameState.records).length < levels.length) {
  campaignState = { startedAt: Date.now(), weekKey: getWeeklyBucketKey() };
  gameStorage.saveCampaignState(campaignState);
}

function loadAssets(): void {
  (Object.keys(WECHAT_ASSET_URLS) as Array<keyof typeof WECHAT_ASSET_URLS>)
    .filter((key) => key !== 'backgroundMusic' && !key.startsWith('combo') && !LAZY_ASSET_KEYS.has(key as keyof VisualAssets))
    .forEach((key) => {
      visualAssets[key as keyof VisualAssets] = createImage(WECHAT_ASSET_URLS[key], () => renderBoard(game.getSnapshot()));
    });
}

loadAssets();

document.documentElement.style.setProperty(
  '--wechat-gameplay-background',
  `url("${WECHAT_ASSET_URLS.gameplayBackground}")`,
);
document.documentElement.style.setProperty('--kawaii-page-background', `url("${WECHAT_ASSET_URLS.gameplayBackground}")`);

const getAsset = (key: keyof VisualAssets): HTMLImageElement => visualAssets[key];
const setImage = (selector: string, key: keyof VisualAssets, alt = ''): void => {
  const image = query<HTMLImageElement>(selector);
  image.alt = alt;
  image.addEventListener('error', () => { image.hidden = true; }, { once: true });
  image.src = WECHAT_ASSET_URLS[key];
};

setImage('#mascot-image', 'mascotCatCloud');
setImage('#settings-icon', 'sunIcon');
setImage('#leaderboard-icon', 'trophyIcon');
setImage('#hint-icon', 'lightbulbIcon');
setImage('#record-icon', 'noteIcon');
setImage('#progress-icon', 'flagIcon');
setImage('#rules-icon', 'checklistIcon');
setImage('#cloud-face-image', 'cloudFaceIcon');
document.documentElement.style.setProperty('--kawaii-decor-sheet', `url("${WECHAT_ASSET_URLS.decorSheet}")`);

const overlayAssetSelectors: Record<OpenOverlayName, ReadonlyArray<readonly [string, keyof VisualAssets]>> = {
  levels: [
    ['#level-cloud-left', 'levelPanelCloudLeft'],
    ['#level-cloud-right', 'levelPanelCloudRight'],
    ['#level-cloud-smile-heart', 'levelPanelCloudSmileHeart'],
    ['#level-heart-pink', 'levelPanelHeartPink'],
    ['#level-ribbon-image', 'levelPanelRibbonPink'],
    ['#level-star-big-yellow', 'levelPanelStarBigYellow'],
    ['#level-star-blue', 'levelPanelStarBlue'],
    ['#level-star-yellow', 'levelPanelStarFaceYellow'],
    ['#level-star-pink', 'levelPanelStarPink'],
    ['#level-sparkle-white', 'levelPanelSparkleWhite'],
  ],
  settings: [
    ['#settings-cloud', 'settingsCloudSmileHeart'],
    ['#settings-star', 'settingsStarPinkBig'],
    ['#settings-sound-icon', 'settingsMusicBadge'],
    ['#settings-vibration-icon', 'settingsVibrationBadge'],
    ['#settings-cluster', 'settingsCloudClusterLeft'],
    ['#settings-corner', 'settingsHeartCorner'],
    ['#settings-small-heart', 'settingsHeartSmall'],
    ['#settings-sparkle', 'settingsSparkleWhite'],
    ['#settings-yellow-star', 'settingsStarYellowSmall'],
  ],
  leaderboard: [
    ['#leaderboard-bunny', 'leaderboardBunnyPeekLeft'],
    ['#leaderboard-cloud', 'leaderboardRainbowCloud'],
    ['#leaderboard-ribbon', 'leaderboardRibbonPurple'],
  ],
};
const loadedOverlayAssets = new Set<OpenOverlayName>();

function loadOverlayAssets(name: OpenOverlayName): void {
  if (loadedOverlayAssets.has(name)) return;
  overlayAssetSelectors[name].forEach(([selector, key]) => setImage(selector, key));
  loadedOverlayAssets.add(name);
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
  if (!record) {
    recordSummary.textContent = t(locale, 'record.noneSummary');
    recordDetail.textContent = t(locale, 'record.noneDetail');
    return;
  }

  recordSummary.textContent = t(locale, 'record.summary', { duration: formatDuration(record.durationMs) });
  recordDetail.textContent = t(locale, mode === 'record' ? 'record.detailViewing' : 'record.detailSaved', {
    count: record.placements.length,
    completedAt: formatCompletedAt(record.completedAt),
  });
}

function populateLocaleOptions(): void {
  localeSelect.replaceChildren();
  for (const supportedLocale of getSupportedLocales()) {
    const option = document.createElement('option');
    option.value = supportedLocale;
    option.textContent = t(locale, `locale.name.${supportedLocale}`);
    localeSelect.append(option);
  }
  localeSelect.value = locale;
}

function renderStaticUi(): void {
  appTitle.textContent = t(locale, 'app.title');
  sectionHints.textContent = t(locale, 'section.hints');
  sectionRecord.textContent = t(locale, 'section.record');
  sectionProgress.textContent = t(locale, 'section.progress');
  sectionRules.textContent = t(locale, 'section.rules');
  rulesSummary.textContent = `${t(locale, 'rule.area')} · ${t(locale, 'rule.singleClue')} · ${t(locale, 'rule.cover')}`;
  ruleInput.textContent = t(locale, 'rule.input');
  query<HTMLHeadingElement>('#levels-dialog-title').textContent = t(locale, 'section.levels');
  query<HTMLHeadingElement>('#settings-dialog-title').textContent = t(locale, 'settings.title');
  query<HTMLHeadingElement>('#leaderboard-dialog-title').textContent = t(locale, 'landing.weeklyLeaderboard');
  query<HTMLSpanElement>('#settings-sound-label').textContent = t(locale, 'settings.sound');
  settingsVibrationLabel.textContent = t(locale, 'settings.vibration');
  localeLabel.textContent = t(locale, 'locale.label');
  settingsBackButton.textContent = t(locale, 'settings.close');
  settingsContinueButton.textContent = t(locale, 'settings.continue');
  leaderboardNote.textContent = t(locale, 'landing.localWeeklyNote');
  settingsButton.setAttribute('aria-label', t(locale, 'settings.title'));
  leaderboardButton.setAttribute('aria-label', t(locale, 'landing.weeklyLeaderboard'));
  query<HTMLDivElement>('#quick-actions').setAttribute('aria-label', t(locale, 'aria.quickActions'));
  query<HTMLElement>('#game-information').setAttribute('aria-label', t(locale, 'aria.gameInformation'));
  query<HTMLElement>('#game-actions').setAttribute('aria-label', t(locale, 'aria.gameActions'));
  canvas.setAttribute('aria-label', t(locale, 'aria.gameBoard'));
  document.querySelectorAll<HTMLButtonElement>('.overlay-close').forEach((button) => {
    button.setAttribute('aria-label', t(locale, 'aria.closeDialog'));
  });
  populateLocaleOptions();
}

function updateActionButton(button: HTMLButtonElement, key: MessageKey, index: number): void {
  button.querySelector<HTMLSpanElement>('.action-label')!.textContent = t(locale, key);
  const icon = button.querySelector<HTMLSpanElement>('.action-icon')!;
  icon.style.backgroundImage = `url("${WECHAT_ASSET_URLS.bottomButtonIcons}")`;
  icon.style.setProperty('--icon-index', String(index));
}

function renderUi(snapshot: GameSnapshot): void {
  renderStaticUi();
  const completedCount = Object.keys(snapshot.records).length;
  levelProgress.textContent = t(locale, 'level.progress', { current: snapshot.levelIndex + 1, total: levels.length });
  levelName.textContent = formatLevelName(locale, snapshot.level.number, snapshot.level.titleKey);
  boardMeta.textContent = t(locale, 'board.meta', {
    width: snapshot.level.width,
    height: snapshot.level.height,
    clues: snapshot.level.clues.length,
  });
  levelHint.textContent = snapshot.hintMessage ? tm(locale, snapshot.hintMessage) : t(locale, 'hint.placeholder');
  levelCollectionMeta.textContent = t(locale, 'level.collectionMeta', { completed: completedCount, total: levels.length });
  renderRecord(snapshot.currentRecord, snapshot.mode);

  const covered = getCoveredCellCount(snapshot.level, snapshot.placements);
  const total = snapshot.level.width * snapshot.level.height;
  coverageText.textContent = t(locale, snapshot.mode === 'record' ? 'coverage.record' : 'coverage.play', { covered, total });
  statusText.textContent = tm(locale, snapshot.status);
  statusChip.textContent = snapshot.mode === 'record'
    ? t(locale, 'chip.record')
    : snapshot.solved
      ? t(locale, 'chip.solved')
      : snapshot.preview?.validation.ok
        ? t(locale, 'chip.ready')
        : t(locale, 'chip.active');
  statusChip.dataset.state = snapshot.mode === 'record'
    ? 'view'
    : snapshot.solved
      ? 'solved'
      : snapshot.preview?.validation.ok
        ? 'ready'
        : 'active';

  updateActionButton(levelsButton, 'section.levels', 0);
  updateActionButton(undoButton, 'button.undo', 1);
  updateActionButton(restartButton, snapshot.mode === 'record' ? 'button.retry' : 'button.restart', 2);
  updateActionButton(hintButton, 'button.hint', 3);
  updateActionButton(nextButton, 'button.next', 4);
  undoButton.disabled = !snapshot.canUndo || snapshot.mode === 'record';
  hintButton.disabled = snapshot.solved || snapshot.mode === 'record';
  nextButton.disabled = !snapshot.hasNextLevel;
  vibrationToggle.disabled = !canVibrate();
  vibrationToggle.title = canVibrate() ? '' : 'Vibration is not supported in this browser';
  settingsVibrationNote.textContent = t(locale, 'settings.vibrationUnavailable');
  settingsVibrationNote.hidden = canVibrate();
  syncToggle(soundToggle, uiState.soundEnabled);
  syncToggle(vibrationToggle, uiState.vibrationEnabled);
  renderLevelGrid(snapshot);
}

function renderLevelGrid(snapshot: GameSnapshot): void {
  levelGrid.replaceChildren();
  levels.forEach((level, index) => {
    const record = snapshot.records[level.id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-tile';
    button.dataset.current = String(snapshot.levelIndex === index);
    button.dataset.completed = String(Boolean(record));
    button.dataset.viewing = String(snapshot.levelIndex === index && snapshot.mode === 'record');
    const locked = !record && index > Object.keys(snapshot.records).length && snapshot.levelIndex !== index;
    button.dataset.locked = String(locked);
    button.disabled = locked;
    button.innerHTML = `<span class="level-tile__number">${index + 1}</span><span class="level-tile__mark">${record ? '✓' : ''}</span>`;
    const label = locked
      ? t(locale, 'tile.locked', { levelName: formatLevelName(locale, level.number, level.titleKey) })
      : record
      ? t(locale, 'tile.completed', { levelName: formatLevelName(locale, level.number, level.titleKey), duration: formatDuration(record.durationMs) })
      : t(locale, 'tile.incomplete', { levelName: formatLevelName(locale, level.number, level.titleKey) });
    button.title = label;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => {
      if (button.dataset.locked === 'true') return;
      if (record) game.viewRecordedLevel(index);
      else game.setLevel(index);
      closeOverlay();
    });
    levelGrid.append(button);
  });
}

function syncToggle(toggle: HTMLButtonElement, enabled: boolean): void {
  toggle.dataset.enabled = String(enabled);
  toggle.setAttribute('aria-checked', String(enabled));
}

function renderBoard(snapshot: GameSnapshot): void {
  selectionLayer.replaceChildren();
  renderer.render(snapshot, {
    labels: {
      solvedBadge: t(locale, 'renderer.badgeSolved'),
      recordBadge: t(locale, 'renderer.badgeRecord'),
    },
    backdropImage: getCanvasImage(getAsset('gameplayBackground')) ?? getCanvasImage(getAsset('background')),
    theme: 'kawaii',
    selectionAssets: {
      strawberry: getCanvasImage(getAsset('selectionStrawberry')),
      heartPink: getCanvasImage(getAsset('selectionHeartPink')),
      starYellow: getCanvasImage(getAsset('selectionStarYellow')),
      sparkleWhite: getCanvasImage(getAsset('selectionSparkleWhite')),
      bubblePink: getCanvasImage(getAsset('selectionBubblePink')),
      bubbleYellow: getCanvasImage(getAsset('selectionBubbleYellow')),
      dripYellow: getCanvasImage(getAsset('selectionDripYellow')),
    },
  });
}

function canVibrate(): boolean {
  return typeof navigator.vibrate === 'function';
}

function triggerVibration(type: 'light' | 'medium' | 'heavy'): void {
  if (!uiState.vibrationEnabled || !canVibrate()) return;
  const duration = type === 'light' ? 12 : type === 'medium' ? 24 : 40;
  navigator.vibrate(duration);
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
  if (celebrationChanged) {
    lastCelebrationEffectId = celebrationEffectId;
    if (celebrationEffectId > 0) {
      audio.playCelebration();
      triggerVibration('heavy');
    }
  }
  const comboVoice = snapshot.effects.comboVoice;
  if (comboVoice && comboVoice !== lastComboVoice) {
    lastComboVoice = comboVoice;
    audio.playComboVoice(comboVoice);
  }
  if (!comboVoice) lastComboVoice = null;
}

function syncWeeklyLeaderboard(snapshot: GameSnapshot): void {
  if (
    snapshot.mode !== 'play' ||
    !snapshot.solved ||
    snapshot.hasNextLevel ||
    Object.keys(snapshot.records).length !== levels.length ||
    snapshot.effects.celebrationId === 0 ||
    snapshot.effects.celebrationId === lastCampaignCompletionCelebrationId ||
    !campaignState
  ) return;
  lastCampaignCompletionCelebrationId = snapshot.effects.celebrationId;
  const completedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.now() - campaignState.startedAt);
  weeklyLeaderboard = gameStorage.recordWeeklyLeaderboardEntry(durationMs, completedAt);
  campaignState = null;
  gameStorage.saveCampaignState(null);
  renderLeaderboard();
}

function scheduleAutoAdvance(snapshot: GameSnapshot): void {
  if (!snapshot.solved || !snapshot.hasNextLevel || snapshot.effects.celebrationId === 0 || snapshot.effects.celebrationId === lastAutoAdvanceCelebrationId) return;
  if (autoAdvanceTimeoutId !== 0) window.clearTimeout(autoAdvanceTimeoutId);
  lastAutoAdvanceCelebrationId = snapshot.effects.celebrationId;
  autoAdvanceTimeoutId = window.setTimeout(() => {
    autoAdvanceTimeoutId = 0;
    const latest = game.getSnapshot();
    if (latest.mode === 'play' && latest.solved && latest.hasNextLevel) game.nextLevel();
  }, 1200);
}

function ensureAnimationLoop(): void {
  if (animationFrameId !== 0 || !renderer.hasActiveEffects()) return;
  animationFrameId = window.requestAnimationFrame(tickAnimationFrame);
}

function tickAnimationFrame(): void {
  animationFrameId = 0;
  renderBoard(currentSnapshot);
  if (renderer.hasActiveEffects()) animationFrameId = window.requestAnimationFrame(tickAnimationFrame);
}

function renderLeaderboard(): void {
  leaderboardList.replaceChildren();
  weeklyLeaderboard = gameStorage.loadWeeklyLeaderboard();
  if (weeklyLeaderboard.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'leaderboard-empty';
    const image = document.createElement('img');
    image.src = WECHAT_ASSET_URLS.leaderboardEmptyTrophyBunny;
    image.alt = '';
    const text = document.createElement('p');
    text.textContent = t(locale, 'landing.emptyLeaderboard');
    empty.append(image, text);
    leaderboardList.append(empty);
    return;
  }
  weeklyLeaderboard.slice(0, 6).forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = `leaderboard-row leaderboard-row--${index + 1}`;
    row.innerHTML = `<span class="leaderboard-rank">${index + 1}</span><span class="leaderboard-time">${formatDuration(entry.durationMs)}</span><span class="leaderboard-date">${formatCompletedAt(entry.completedAt)}</span>`;
    leaderboardList.append(row);
  });
}

function render(snapshot: GameSnapshot): void {
  currentSnapshot = snapshot;
  renderUi(snapshot);
  renderBoard(snapshot);
  syncFeedbackAudio(snapshot);
  syncWeeklyLeaderboard(snapshot);
  scheduleAutoAdvance(snapshot);
  ensureAnimationLoop();
}

function getDialogForOverlay(name: OverlayName): HTMLElement | null {
  if (name === 'levels') return levelsDialog;
  if (name === 'settings') return settingsDialog;
  if (name === 'leaderboard') return leaderboardDialog;
  return null;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not(:disabled), [href], select:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement): void {
  const focusable = getFocusableElements(dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openOverlay(name: OpenOverlayName): void {
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  loadOverlayAssets(name);
  uiState.activeOverlay = name;
  overlayRoot.hidden = false;
  [levelsDialog, settingsDialog, leaderboardDialog].forEach((dialog) => { dialog.hidden = dialog !== getDialogForOverlay(name); });
  if (name === 'leaderboard') renderLeaderboard();
  const dialog = getDialogForOverlay(name);
  getFocusableElements(dialog ?? overlayRoot)[0]?.focus();
}

function closeOverlay(): void {
  uiState.activeOverlay = null;
  overlayRoot.hidden = true;
  [levelsDialog, settingsDialog, leaderboardDialog].forEach((dialog) => { dialog.hidden = true; });
  lastFocusedElement?.focus();
  lastFocusedElement = null;
}

function toggleSound(): void {
  uiState.soundEnabled = !uiState.soundEnabled;
  audio.setEnabled(uiState.soundEnabled);
  backgroundMusic.setEnabled(uiState.soundEnabled);
  if (uiState.soundEnabled) backgroundMusic.prime();
  saveWebSettings(uiState);
  syncToggle(soundToggle, uiState.soundEnabled);
}

function toggleVibration(): void {
  if (!canVibrate()) return;
  uiState.vibrationEnabled = !uiState.vibrationEnabled;
  saveWebSettings(uiState);
  syncToggle(vibrationToggle, uiState.vibrationEnabled);
  triggerVibration('light');
}

game.subscribe(render);

settingsButton.addEventListener('click', () => { primeAudio(); openOverlay('settings'); });
leaderboardButton.addEventListener('click', () => { primeAudio(); openOverlay('leaderboard'); });
levelsButton.addEventListener('click', () => { primeAudio(); openOverlay('levels'); });
undoButton.addEventListener('click', () => { primeAudio(); game.undo(); });
restartButton.addEventListener('click', () => { primeAudio(); game.resetLevel(); });
hintButton.addEventListener('click', () => { primeAudio(); game.requestHint(); });
nextButton.addEventListener('click', () => { primeAudio(); game.nextLevel(); });
soundToggle.addEventListener('click', toggleSound);
vibrationToggle.addEventListener('click', toggleVibration);
localeSelect.addEventListener('change', () => {
  locale = localeSelect.value as Locale;
  saveLocale(locale);
  render(currentSnapshot);
});
document.querySelectorAll<HTMLButtonElement>('[data-close-overlay]').forEach((button) => button.addEventListener('click', closeOverlay));
overlayRoot.addEventListener('pointerdown', (event) => {
  if (event.target === overlayRoot) closeOverlay();
});

canvas.addEventListener('pointerdown', primeAudio, { passive: true });
[levelsButton, undoButton, restartButton, hintButton, nextButton].forEach((button) => button.addEventListener('pointerdown', primeAudio, { passive: true }));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    backgroundMusic.stop();
  } else {
    backgroundMusic.prime();
  }
});

window.addEventListener('keydown', (event) => {
  if (uiState.activeOverlay) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOverlay();
      return;
    }
    if (event.key === 'Tab') {
      const dialog = getDialogForOverlay(uiState.activeOverlay);
      if (dialog) trapDialogFocus(event, dialog);
      return;
    }
  }
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

renderStaticUi();
