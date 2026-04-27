import type { Level, LevelRecord, LevelRecordMap, Placement, SavedProgress } from '../game/types';
import type { GameStorage, LoadedGameState } from './GameStorage';
import type { StorageAdapter } from './StorageAdapter';

const RECORDS_KEY = 'patch-grid-records-v2';
const PROGRESS_KEY = 'patch-grid-progress-v2';

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
