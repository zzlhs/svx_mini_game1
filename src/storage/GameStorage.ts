import type {
  CampaignRunState,
  Level,
  LevelRecordMap,
  SavedProgress,
  WeeklyLeaderboardEntry,
} from '../game/types';

export interface LoadedGameState {
  records: LevelRecordMap;
  progress: SavedProgress | null;
}

export interface GameStorage {
  load(levels: Level[]): LoadedGameState;
  saveRecords(records: LevelRecordMap): void;
  saveProgress(progress: SavedProgress | null): void;
  loadCampaignState(): CampaignRunState | null;
  saveCampaignState(state: CampaignRunState | null): void;
  loadWeeklyLeaderboard(): WeeklyLeaderboardEntry[];
  saveWeeklyLeaderboard(entries: WeeklyLeaderboardEntry[]): void;
  resetGameData(): void;
}
