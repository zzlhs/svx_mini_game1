import type { Level, LevelRecordMap, SavedProgress } from '../game/types';

export interface LoadedGameState {
  records: LevelRecordMap;
  progress: SavedProgress | null;
}

export interface GameStorage {
  load(levels: Level[]): LoadedGameState;
  saveRecords(records: LevelRecordMap): void;
  saveProgress(progress: SavedProgress | null): void;
}
