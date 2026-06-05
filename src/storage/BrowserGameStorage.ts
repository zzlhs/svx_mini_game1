import type {
  CampaignRunState,
  Level,
  LevelRecord,
  LevelRecordMap,
  Placement,
  SavedProgress,
  WeeklyLeaderboardEntry,
} from '../game/types';
import type { GameStorage, LoadedGameState } from './GameStorage';
import type { StorageAdapter } from './StorageAdapter';

const RECORDS_KEY = 'patch-grid-records-v2';
const PROGRESS_KEY = 'patch-grid-progress-v2';
const CAMPAIGN_KEY = 'patch-grid-campaign-v1';
const WEEKLY_LEADERBOARD_KEY = 'patch-grid-weekly-leaderboard-v1';

export function getWeeklyBucketKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const weekday = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() - weekday);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isPlacementLike(value: unknown): value is Placement {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Placement;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.area === 'number' &&
    typeof candidate.rect?.x === 'number' &&
    typeof candidate.rect?.y === 'number' &&
    typeof candidate.rect?.width === 'number' &&
    typeof candidate.rect?.height === 'number' &&
    typeof candidate.clue?.x === 'number' &&
    typeof candidate.clue?.y === 'number' &&
    typeof candidate.clue?.value === 'number'
  );
}

function isPlacementHistoryLike(value: unknown): value is Placement[][] {
  return Array.isArray(value) && value.every((item) => Array.isArray(item) && item.every(isPlacementLike));
}

function isLevelRecordLike(value: unknown): value is LevelRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as LevelRecord;
  return (
    typeof candidate.levelId === 'string' &&
    typeof candidate.completedAt === 'string' &&
    typeof candidate.durationMs === 'number' &&
    Array.isArray(candidate.placements) &&
    candidate.placements.every(isPlacementLike)
  );
}

function isSavedProgressLike(value: unknown): value is SavedProgress {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as SavedProgress;
  return (
    typeof candidate.levelId === 'string' &&
    Array.isArray(candidate.placements) &&
    candidate.placements.every(isPlacementLike) &&
    isPlacementHistoryLike(candidate.history) &&
    typeof candidate.placementSequence === 'number' &&
    typeof candidate.attemptStartedAt === 'number'
  );
}

function isCampaignRunStateLike(value: unknown): value is CampaignRunState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as CampaignRunState;
  return typeof candidate.startedAt === 'number' && typeof candidate.weekKey === 'string';
}

function isWeeklyLeaderboardEntryLike(value: unknown): value is WeeklyLeaderboardEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as WeeklyLeaderboardEntry;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.weekKey === 'string' &&
    typeof candidate.durationMs === 'number' &&
    typeof candidate.completedAt === 'string'
  );
}

export class BrowserGameStorage implements GameStorage {
  constructor(private readonly adapter: StorageAdapter) {}

  load(levels: Level[]): LoadedGameState {
    const allowedIds = new Set(levels.map((level) => level.id));

    return {
      records: this.loadRecords(allowedIds),
      progress: this.loadProgress(allowedIds),
    };
  }

  saveRecords(records: LevelRecordMap): void {
    this.adapter.setItem(RECORDS_KEY, JSON.stringify(records));
  }

  saveProgress(progress: SavedProgress | null): void {
    if (!progress) {
      this.adapter.removeItem(PROGRESS_KEY);
      return;
    }

    this.adapter.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  loadCampaignState(): CampaignRunState | null {
    const raw = this.adapter.getItem(CAMPAIGN_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isCampaignRunStateLike(parsed)) {
        return null;
      }

      return parsed.weekKey === getWeeklyBucketKey() ? parsed : null;
    } catch {
      return null;
    }
  }

  saveCampaignState(state: CampaignRunState | null): void {
    if (!state) {
      this.adapter.removeItem(CAMPAIGN_KEY);
      return;
    }

    this.adapter.setItem(CAMPAIGN_KEY, JSON.stringify(state));
  }

  loadWeeklyLeaderboard(): WeeklyLeaderboardEntry[] {
    const raw = this.adapter.getItem(WEEKLY_LEADERBOARD_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      const currentWeekKey = getWeeklyBucketKey();
      return parsed
        .filter(isWeeklyLeaderboardEntryLike)
        .filter((entry) => entry.weekKey === currentWeekKey)
        .sort((left, right) => left.durationMs - right.durationMs)
        .slice(0, 20);
    } catch {
      return [];
    }
  }

  saveWeeklyLeaderboard(entries: WeeklyLeaderboardEntry[]): void {
    this.adapter.setItem(WEEKLY_LEADERBOARD_KEY, JSON.stringify(entries));
  }

  resetGameData(): void {
    this.adapter.removeItem(RECORDS_KEY);
    this.adapter.removeItem(PROGRESS_KEY);
    this.adapter.removeItem(CAMPAIGN_KEY);
  }

  recordWeeklyLeaderboardEntry(durationMs: number, completedAt: string): WeeklyLeaderboardEntry[] {
    const weekKey = getWeeklyBucketKey(Date.parse(completedAt));
    const entries = this.loadWeeklyLeaderboard();
    const nextEntries = [
      ...entries.filter((entry) => entry.weekKey === weekKey),
      {
        id: `${weekKey}-${completedAt}-${Math.round(durationMs)}`,
        weekKey,
        durationMs,
        completedAt,
      },
    ]
      .sort((left, right) => left.durationMs - right.durationMs)
      .slice(0, 20);

    this.saveWeeklyLeaderboard(nextEntries);
    return nextEntries;
  }

  private loadRecords(allowedIds: Set<string>): LevelRecordMap {
    const raw = this.adapter.getItem(RECORDS_KEY);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const records: LevelRecordMap = {};

      for (const [levelId, value] of Object.entries(parsed)) {
        if (!allowedIds.has(levelId) || !isLevelRecordLike(value)) {
          continue;
        }

        records[levelId] = value;
      }

      return records;
    } catch {
      return {};
    }
  }

  private loadProgress(allowedIds: Set<string>): SavedProgress | null {
    const raw = this.adapter.getItem(PROGRESS_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isSavedProgressLike(parsed) || !allowedIds.has(parsed.levelId)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }
}
