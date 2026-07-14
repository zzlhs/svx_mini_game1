import {
  findHintSuggestion,
  getCoveredCellCount,
  isBoardSolved,
  normalizeRect,
  validatePlacement,
} from './logic';
import {
  COMBO_AMAZING_THRESHOLD,
  COMBO_GOOD_THRESHOLD,
  COMBO_GREAT_THRESHOLD,
  COMBO_NICE_THRESHOLD,
} from './game-controller.constants';
import type { MessageDescriptor } from '../i18n';
import type {
  Cell,
  GameEffects,
  GameSnapshot,
  HintSuggestion,
  Level,
  LevelRecordMap,
  LevelRecord,
  Placement,
  PreviewState,
  SavedProgress,
} from './types';

type Listener = (snapshot: GameSnapshot) => void;

interface GameControllerOptions {
  initialRecords?: LevelRecordMap;
  initialProgress?: SavedProgress | null;
  onRecordsChange?: (records: LevelRecordMap) => void;
  onProgressChange?: (progress: SavedProgress | null) => void;
}

export class GameController {
  private readonly levels: Level[];

  private readonly listeners = new Set<Listener>();

  private readonly onRecordsChange?: (records: LevelRecordMap) => void;

  private readonly onProgressChange?: (progress: SavedProgress | null) => void;

  private levelIndex = 0;

  private placements: Placement[] = [];

  private selectedPlacementId: string | null = null;

  private history: Placement[][] = [];

  private preview: PreviewState | null = null;

  private hintSuggestion: HintSuggestion | null = null;

  private hintMessage: MessageDescriptor | null = null;

  private dragOrigin: Cell | null = null;

  private records: LevelRecordMap;

  private mode: 'play' | 'record' = 'play';

  private comboCount = 0;

  private effects: GameEffects = {
    placement: null,
    invalidId: 0,
    celebrationId: 0,
    comboVoice: null,
  };

  private status: MessageDescriptor = { key: 'status.baseInstruction' };

  private solved = false;

  private placementSequence = 0;

  private attemptStartedAt = Date.now();

  constructor(levels: Level[], options: GameControllerOptions = {}) {
    this.levels = levels;
    this.records = options.initialRecords ? this.cloneRecords(options.initialRecords) : {};
    this.onRecordsChange = options.onRecordsChange;
    this.onProgressChange = options.onProgressChange;
    this.restoreInitialProgress(options.initialProgress ?? null);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): GameSnapshot {
    return {
      levelIndex: this.levelIndex,
      level: this.level,
      placements: [...this.placements],
      selectedPlacementId: this.selectedPlacementId,
      preview: this.preview,
      hintSuggestion: this.hintSuggestion,
      hintMessage: this.hintMessage,
      mode: this.mode,
      currentRecord: this.records[this.level.id] ?? null,
      records: this.records,
      effects: this.effects,
      comboCount: this.comboCount,
      status: this.status,
      solved: this.solved,
      canUndo: this.history.length > 0,
      hasNextLevel: this.levelIndex < this.levels.length - 1,
    };
  }

  startDrag(cell: Cell): void {
    if (this.mode === 'record') {
      return;
    }

    this.selectedPlacementId = null;
    this.dragOrigin = cell;
    this.clearHintSuggestion();
    this.updateDrag(cell);
  }

  updateDrag(cell: Cell): void {
    if (!this.dragOrigin || this.mode === 'record') {
      return;
    }

    const rect = normalizeRect(this.dragOrigin, cell);
    const validation = validatePlacement(this.level, this.placements, rect);
    this.preview = {
      start: this.dragOrigin,
      end: cell,
      rect,
      validation,
    };

    if (validation.ok) {
      this.status = { key: 'status.previewValid', values: { area: validation.area } };
    } else {
      this.status = validation.reason ?? { key: 'status.invalidGeneric' };
    }

    this.emit();
    this.persistProgress();
  }

  finishDrag(): void {
    if (this.mode === 'record') {
      return;
    }

    if (!this.preview) {
      this.dragOrigin = null;
      return;
    }

    if (this.preview.validation.ok && this.preview.validation.clue) {
      this.history.push(this.clonePlacements(this.placements));
      this.placements = [
        ...this.placements,
        {
          id: `placement-${this.placementSequence}`,
          rect: this.preview.rect,
          clue: this.preview.validation.clue,
          area: this.preview.validation.area,
        },
      ];
      const latestPlacementId = `placement-${this.placementSequence}`;
      this.placementSequence += 1;
      this.comboCount += 1;

      const solved = isBoardSolved(this.level, this.placements);
      if (solved) {
        this.solved = true;
        const record = this.saveCompletionRecord();
        const comboVoice = this.resolveComboVoice(this.comboCount);
        this.effects = {
          placement: {
            id: this.effects.placement ? this.effects.placement.id + 1 : 1,
            placementId: latestPlacementId,
          },
          invalidId: this.effects.invalidId,
          celebrationId: this.effects.celebrationId + 1,
          comboVoice: comboVoice === 'amazing' || comboVoice === 'prefect' ? null : comboVoice,
        };
        this.comboCount = 0;
        this.status = {
          key: 'status.solvedWithDuration',
          values: { duration: this.formatDuration(record.durationMs) },
        };
      } else {
        const comboVoice = this.resolveComboVoice(this.comboCount);
        this.effects = {
          placement: {
            id: this.effects.placement ? this.effects.placement.id + 1 : 1,
            placementId: latestPlacementId,
          },
          invalidId: this.effects.invalidId,
          celebrationId: this.effects.celebrationId,
          comboVoice,
        };
        const covered = getCoveredCellCount(this.level, this.placements);
        this.status = {
          key: 'status.coveredProgress',
          values: { covered, total: this.level.width * this.level.height },
        };
      }
    } else {
      this.comboCount = 0;
      this.effects = {
        ...this.effects,
        invalidId: this.effects.invalidId + 1,
        comboVoice: null,
      };
      this.status = this.preview.validation.reason ?? { key: 'status.invalidGeneric' };
    }

    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.emit();
    this.persistProgress();
  }

  cancelDrag(): void {
    if (this.mode === 'record') {
      return;
    }

    if (!this.dragOrigin && !this.preview) {
      return;
    }

    this.dragOrigin = null;
    this.preview = null;
    this.clearHintSuggestion();
    this.status = this.solved
      ? { key: 'status.solvedBoardCovered' }
      : { key: 'status.baseInstruction' };
    this.emit();
  }

  undo(): void {
    if (this.mode === 'record') {
      return;
    }

    const previous = this.history.pop();
    if (!previous) {
      return;
    }

    this.placements = previous;
    this.selectedPlacementId = null;
    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.comboCount = 0;
    this.solved = isBoardSolved(this.level, this.placements);
    this.status = this.solved ? { key: 'status.solvedBoardCovered' } : { key: 'status.undo' };
    this.emit();
    this.persistProgress();
  }

  resetLevel(): void {
    this.resetInternalState({ key: 'status.reset' });
    this.emit();
    this.persistProgress();
  }

  getPlacementAtCell(cell: Cell): Placement | null {
    for (let index = this.placements.length - 1; index >= 0; index -= 1) {
      const placement = this.placements[index];
      const { rect } = placement;
      if (
        cell.x >= rect.x &&
        cell.x < rect.x + rect.width &&
        cell.y >= rect.y &&
        cell.y < rect.y + rect.height
      ) {
        return placement;
      }
    }

    return null;
  }

  selectPlacement(placementId: string): void {
    if (this.mode === 'record') {
      return;
    }

    if (!this.placements.some((placement) => placement.id === placementId)) {
      return;
    }

    if (this.selectedPlacementId === placementId) {
      return;
    }

    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.selectedPlacementId = placementId;
    this.emit();
  }

  clearSelectedPlacement(): void {
    if (!this.selectedPlacementId) {
      return;
    }

    this.selectedPlacementId = null;
    this.emit();
  }

  removeSelectedPlacement(): void {
    if (this.mode === 'record' || !this.selectedPlacementId) {
      return;
    }

    const selectedIndex = this.placements.findIndex(
      (placement) => placement.id === this.selectedPlacementId,
    );
    if (selectedIndex < 0) {
      this.selectedPlacementId = null;
      return;
    }

    this.history.push(this.clonePlacements(this.placements));
    this.placements = this.placements.filter((placement) => placement.id !== this.selectedPlacementId);
    this.selectedPlacementId = null;
    this.preview = null;
    this.dragOrigin = null;
    this.comboCount = 0;
    this.clearHintSuggestion();
    this.solved = isBoardSolved(this.level, this.placements);
    this.status = { key: 'status.removedPlacement' };
    this.emit();
    this.persistProgress();
  }

  requestHint(): void {
    if (this.solved) {
      this.hintSuggestion = null;
      this.hintMessage = { key: 'hint.solved' };
      this.status = { key: 'status.hintSolved' };
      this.emit();
      return;
    }

    this.preview = null;
    this.dragOrigin = null;
    this.selectedPlacementId = null;

    const suggestion = findHintSuggestion(this.level, this.placements);
    this.hintSuggestion = suggestion;

    if (!suggestion) {
      this.hintMessage = { key: 'hint.noHint' };
      this.status = { key: 'status.noHint' };
      this.emit();
      return;
    }

    this.status =
      suggestion.candidateCount === 1
        ? { key: 'status.hintSingle', values: { value: suggestion.clue.value } }
        : {
            key: 'status.hintTryRect',
            values: {
              value: suggestion.clue.value,
              width: suggestion.rect.width,
              height: suggestion.rect.height,
            },
          };
    this.hintMessage =
      suggestion.candidateCount === 1
        ? {
            key: 'hint.single',
            values: {
              value: suggestion.clue.value,
              rowStart: suggestion.rect.y + 1,
              rowEnd: suggestion.rect.y + suggestion.rect.height,
              colStart: suggestion.rect.x + 1,
              colEnd: suggestion.rect.x + suggestion.rect.width,
            },
          }
        : {
            key: 'hint.tryRect',
            values: {
              value: suggestion.clue.value,
              width: suggestion.rect.width,
              height: suggestion.rect.height,
              rowStart: suggestion.rect.y + 1,
              rowEnd: suggestion.rect.y + suggestion.rect.height,
              colStart: suggestion.rect.x + 1,
              colEnd: suggestion.rect.x + suggestion.rect.width,
            },
          };
    this.emit();
  }

  nextLevel(): void {
    if (this.levelIndex >= this.levels.length - 1) {
      this.status = { key: 'status.lastLevel' };
      this.emit();
      return;
    }

    this.levelIndex += 1;
    this.resetInternalState({ key: 'status.enteredLevel', values: { levelNumber: this.level.number } });
    this.emit();
    this.persistProgress();
  }

  previousLevel(): void {
    if (this.levelIndex <= 0) {
      return;
    }

    this.levelIndex -= 1;
    this.resetInternalState({ key: 'status.enteredLevel', values: { levelNumber: this.level.number } });
    this.emit();
    this.persistProgress();
  }

  setLevel(index: number): void {
    if (index < 0 || index >= this.levels.length) {
      return;
    }

    this.levelIndex = index;
    this.resetInternalState({ key: 'status.enteredLevel', values: { levelNumber: this.level.number } });
    this.emit();
    this.persistProgress();
  }

  viewRecordedLevel(index: number): void {
    if (index < 0 || index >= this.levels.length) {
      return;
    }

    const targetLevel = this.levels[index];
    const record = this.records[targetLevel.id];

    if (!record) {
      this.setLevel(index);
      return;
    }

    this.levelIndex = index;
    this.placements = this.clonePlacements(record.placements);
    this.selectedPlacementId = null;
    this.history = [];
    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.mode = 'record';
    this.comboCount = 0;
    this.solved = true;
    this.effects = {
      ...this.effects,
      comboVoice: null,
    };
    this.status = {
      key: 'status.viewingRecord',
      values: { duration: this.formatDuration(record.durationMs) },
    };
    this.emit();
  }

  resetCampaign(): void {
    this.records = {};
    this.levelIndex = 0;
    this.resetInternalState({
      key: 'status.enteredLevel',
      values: { levelNumber: this.level.number },
    });
    this.onRecordsChange?.({});
    this.emit();
    this.persistProgress();
  }

  isInteractionLocked(): boolean {
    return this.mode === 'record';
  }

  private get level(): Level {
    return this.levels[this.levelIndex];
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private clonePlacements(placements: Placement[]): Placement[] {
    return placements.map((placement) => ({
      id: placement.id,
      rect: { ...placement.rect },
      clue: { ...placement.clue },
      area: placement.area,
    }));
  }

  private cloneRecords(records: LevelRecordMap): LevelRecordMap {
    const cloned: LevelRecordMap = {};

    for (const [levelId, record] of Object.entries(records)) {
      cloned[levelId] = {
        levelId: record.levelId,
        completedAt: record.completedAt,
        durationMs: record.durationMs,
        placements: this.clonePlacements(record.placements),
      };
    }

    return cloned;
  }

  private resetInternalState(status: MessageDescriptor): void {
    this.placements = [];
    this.selectedPlacementId = null;
    this.history = [];
    this.preview = null;
    this.dragOrigin = null;
    this.clearHintSuggestion();
    this.mode = 'play';
    this.solved = false;
    this.placementSequence = 0;
    this.comboCount = 0;
    this.attemptStartedAt = Date.now();
    this.effects = {
      ...this.effects,
      placement: null,
      comboVoice: null,
    };
    this.status = status;
  }

  private clearHintSuggestion(): void {
    this.hintSuggestion = null;
    this.hintMessage = null;
  }

  private saveCompletionRecord(): LevelRecord {
    const record: LevelRecord = {
      levelId: this.level.id,
      completedAt: new Date().toISOString(),
      durationMs: Math.max(0, Date.now() - this.attemptStartedAt),
      placements: this.clonePlacements(this.placements),
    };

    this.records = {
      ...this.records,
      [record.levelId]: record,
    };

    this.onRecordsChange?.(this.cloneRecords(this.records));
    return record;
  }

  private restoreInitialProgress(progress: SavedProgress | null): void {
    if (!progress) {
      return;
    }

    const restoredLevelIndex = this.levels.findIndex((level) => level.id === progress.levelId);
    if (restoredLevelIndex < 0) {
      return;
    }

    this.levelIndex = restoredLevelIndex;
    this.placements = this.clonePlacements(progress.placements);
    this.selectedPlacementId = null;
    this.history = progress.history.map((snapshot) => this.clonePlacements(snapshot));
    this.preview = null;
    this.dragOrigin = null;
    this.hintSuggestion = null;
    this.hintMessage = null;
    this.mode = 'play';
    this.placementSequence = progress.placementSequence;
    this.comboCount = 0;
    this.attemptStartedAt = progress.attemptStartedAt;
    this.solved = isBoardSolved(this.level, this.placements);

    const covered = getCoveredCellCount(this.level, this.placements);
    this.status = this.solved
      ? { key: 'status.solvedBoardCovered' }
      : covered > 0
        ? {
            key: 'status.coveredProgress',
            values: { covered, total: this.level.width * this.level.height },
          }
        : { key: 'status.baseInstruction' };
  }

  private buildSavedProgress(): SavedProgress {
    return {
      levelId: this.level.id,
      placements: this.clonePlacements(this.placements),
      history: this.history.map((snapshot) => this.clonePlacements(snapshot)),
      placementSequence: this.placementSequence,
      attemptStartedAt: this.attemptStartedAt,
    };
  }

  private persistProgress(): void {
    if (this.mode !== 'play') {
      return;
    }

    this.onProgressChange?.(this.buildSavedProgress());
  }

  private formatDuration(durationMs: number): string {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private resolveComboVoice(comboCount: number): string | null {
    if (comboCount === COMBO_GOOD_THRESHOLD) {
      return 'good';
    }

    if (comboCount === COMBO_GREAT_THRESHOLD) {
      return 'great';
    }

    if (comboCount === COMBO_NICE_THRESHOLD) {
      return 'nice';
    }

    if (comboCount === COMBO_AMAZING_THRESHOLD) {
      return Math.random() < 0.5 ? 'amazing' : 'prefect';
    }

    return null;
  }
}
