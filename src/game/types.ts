import type { MessageDescriptor, MessageKey } from '../i18n';

export interface Cell {
  x: number;
  y: number;
}

export interface GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Clue extends Cell {
  value: number;
}

export interface Level {
  id: string;
  number: number;
  titleKey: MessageKey;
  hintKey: MessageKey;
  width: number;
  height: number;
  clues: Clue[];
}

export interface Placement {
  id: string;
  rect: GridRect;
  clue: Clue;
  area: number;
}

export interface HintSuggestion {
  rect: GridRect;
  clue: Clue;
  area: number;
  candidateCount: number;
}

export interface LevelRecord {
  levelId: string;
  completedAt: string;
  durationMs: number;
  placements: Placement[];
}

export interface SavedProgress {
  levelId: string;
  placements: Placement[];
  history: Placement[][];
  placementSequence: number;
  attemptStartedAt: number;
}

export interface CampaignRunState {
  startedAt: number;
  weekKey: string;
}

export interface WeeklyLeaderboardEntry {
  id: string;
  weekKey: string;
  durationMs: number;
  completedAt: string;
}

export interface PlacementEffectEvent {
  id: number;
  placementId: string;
}

export interface GameEffects {
  placement: PlacementEffectEvent | null;
  invalidId: number;
  celebrationId: number;
}

export type LevelRecordMap = Record<string, LevelRecord>;

export type GameMode = 'play' | 'record';

export interface PlacementValidation {
  ok: boolean;
  area: number;
  clue: Clue | null;
  reason: MessageDescriptor | null;
}

export interface PreviewState {
  start: Cell;
  end: Cell;
  rect: GridRect;
  validation: PlacementValidation;
}

export interface GameSnapshot {
  levelIndex: number;
  level: Level;
  placements: Placement[];
  selectedPlacementId: string | null;
  preview: PreviewState | null;
  hintSuggestion: HintSuggestion | null;
  hintMessage: MessageDescriptor | null;
  mode: GameMode;
  currentRecord: LevelRecord | null;
  records: LevelRecordMap;
  effects: GameEffects;
  status: MessageDescriptor;
  solved: boolean;
  canUndo: boolean;
  hasNextLevel: boolean;
}
