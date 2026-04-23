import type {
  Cell,
  Clue,
  GridRect,
  HintSuggestion,
  Level,
  Placement,
  PlacementValidation,
} from './types';
import type { MessageDescriptor } from '../i18n';

export function normalizeRect(start: Cell, end: Cell): GridRect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

export function rectArea(rect: GridRect): number {
  return rect.width * rect.height;
}

export function rectContainsCell(rect: GridRect, cell: Cell): boolean {
  return (
    cell.x >= rect.x &&
    cell.x < rect.x + rect.width &&
    cell.y >= rect.y &&
    cell.y < rect.y + rect.height
  );
}

export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function findCluesInRect(level: Level, rect: GridRect): Clue[] {
  return level.clues.filter((clue) => rectContainsCell(rect, clue));
}

function isRectInBounds(level: Level, rect: GridRect): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= level.width &&
    rect.y + rect.height <= level.height
  );
}

function reason(key: MessageDescriptor['key'], values?: MessageDescriptor['values']): MessageDescriptor {
  return { key, values };
}

export function validatePlacement(
  level: Level,
  placements: Placement[],
  rect: GridRect,
): PlacementValidation {
  if (!isRectInBounds(level, rect)) {
    return {
      ok: false,
      area: rectArea(rect),
      clue: null,
      reason: reason('logic.validationOutOfBounds'),
    };
  }

  const overlappingPlacement = placements.find((placement) => rectsOverlap(placement.rect, rect));
  if (overlappingPlacement) {
    return {
      ok: false,
      area: rectArea(rect),
      clue: null,
      reason: reason('logic.validationOverlap'),
    };
  }

  const containedClues = findCluesInRect(level, rect);
  if (containedClues.length !== 1) {
    return {
      ok: false,
      area: rectArea(rect),
      clue: null,
      reason: reason('logic.validationSingleClue'),
    };
  }

  const [clue] = containedClues;
  const area = rectArea(rect);
  if (clue.value !== area) {
    return {
      ok: false,
      area,
      clue,
      reason: reason('logic.validationArea', { value: clue.value }),
    };
  }

  return {
    ok: true,
    area,
    clue,
    reason: null,
  };
}

export function getCoveredCellCount(level: Level, placements: Placement[]): number {
  const covered = Array.from({ length: level.height }, () => Array<boolean>(level.width).fill(false));

  for (const placement of placements) {
    for (let dy = 0; dy < placement.rect.height; dy += 1) {
      for (let dx = 0; dx < placement.rect.width; dx += 1) {
        covered[placement.rect.y + dy][placement.rect.x + dx] = true;
      }
    }
  }

  let count = 0;
  for (const row of covered) {
    for (const cell of row) {
      if (cell) {
        count += 1;
      }
    }
  }

  return count;
}

function clueKey(clue: Clue): string {
  return `${clue.x},${clue.y}`;
}

function getUnusedClues(level: Level, placements: Placement[]): Clue[] {
  const usedClueKeys = new Set(placements.map((placement) => clueKey(placement.clue)));
  return level.clues.filter((clue) => !usedClueKeys.has(clueKey(clue)));
}

function getRectKey(rect: GridRect): string {
  return `${rect.x},${rect.y},${rect.width},${rect.height}`;
}

function getFactorPairs(area: number): Array<{ width: number; height: number }> {
  const pairs: Array<{ width: number; height: number }> = [];

  for (let width = 1; width <= Math.sqrt(area); width += 1) {
    if (area % width !== 0) {
      continue;
    }

    const height = area / width;
    pairs.push({ width, height });

    if (width !== height) {
      pairs.push({ width: height, height: width });
    }
  }

  return pairs;
}

export function getLegalPlacementsForClue(
  level: Level,
  placements: Placement[],
  clue: Clue,
): HintSuggestion[] {
  const candidates: HintSuggestion[] = [];
  const seen = new Set<string>();

  for (const { width, height } of getFactorPairs(clue.value)) {
    const startX = clue.x - width + 1;
    const endX = clue.x;
    const startY = clue.y - height + 1;
    const endY = clue.y;

    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        const rect = { x, y, width, height };
        const key = getRectKey(rect);
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);

        const validation = validatePlacement(level, placements, rect);
        if (!validation.ok || !validation.clue) {
          continue;
        }

        candidates.push({
          rect,
          clue: validation.clue,
          area: validation.area,
          candidateCount: 0,
        });
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.rect.y !== b.rect.y) {
      return a.rect.y - b.rect.y;
    }
    if (a.rect.x !== b.rect.x) {
      return a.rect.x - b.rect.x;
    }
    if (a.rect.height !== b.rect.height) {
      return a.rect.height - b.rect.height;
    }
    return a.rect.width - b.rect.width;
  });

  return candidates;
}

export function findHintSuggestion(level: Level, placements: Placement[]): HintSuggestion | null {
  const unusedClues = getUnusedClues(level, placements);
  let bestSuggestion: HintSuggestion | null = null;

  for (const clue of unusedClues) {
    const candidates = getLegalPlacementsForClue(level, placements, clue);

    if (candidates.length === 0) {
      continue;
    }

    const [firstCandidate] = candidates;
    const suggestion: HintSuggestion = {
      ...firstCandidate,
      candidateCount: candidates.length,
    };

    if (!bestSuggestion || suggestion.candidateCount < bestSuggestion.candidateCount) {
      bestSuggestion = suggestion;
      continue;
    }

    if (
      bestSuggestion &&
      suggestion.candidateCount === bestSuggestion.candidateCount &&
      clue.value < bestSuggestion.clue.value
    ) {
      bestSuggestion = suggestion;
    }
  }

  return bestSuggestion;
}

export function isBoardSolved(level: Level, placements: Placement[]): boolean {
  if (placements.length === 0) {
    return false;
  }

  const covered = Array.from({ length: level.height }, () => Array<boolean>(level.width).fill(false));
  const clueHits = new Map<string, number>();

  for (const clue of level.clues) {
    clueHits.set(`${clue.x},${clue.y}`, 0);
  }

  for (const placement of placements) {
    const validation = validatePlacement(
      level,
      placements.filter((candidate) => candidate.id !== placement.id),
      placement.rect,
    );

    if (!validation.ok) {
      return false;
    }

    for (let dy = 0; dy < placement.rect.height; dy += 1) {
      for (let dx = 0; dx < placement.rect.width; dx += 1) {
        const x = placement.rect.x + dx;
        const y = placement.rect.y + dy;
        if (covered[y][x]) {
          return false;
        }
        covered[y][x] = true;
      }
    }

    const clueKey = `${placement.clue.x},${placement.clue.y}`;
    clueHits.set(clueKey, (clueHits.get(clueKey) ?? 0) + 1);
  }

  for (const row of covered) {
    for (const cell of row) {
      if (!cell) {
        return false;
      }
    }
  }

  for (const hits of clueHits.values()) {
    if (hits !== 1) {
      return false;
    }
  }

  return true;
}
