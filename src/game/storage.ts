import type { Level, LevelRecord, LevelRecordMap, Placement } from './types';

const STORAGE_KEY = 'patch-grid-records-v1';

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

export function loadLevelRecords(levels: Level[]): LevelRecordMap {
  const allowedIds = new Set(levels.map((level) => level.id));

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

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

export function saveLevelRecords(records: LevelRecordMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage failures so gameplay can continue.
  }
}
