import type { MessageKey } from '../i18n';
import type { Clue, Level } from './types';

interface TemplatePiece {
  x: number;
  y: number;
  width: number;
  height: number;
  clueX: number;
  clueY: number;
}

interface LevelTemplate {
  titleKey: MessageKey;
  hintKey: MessageKey;
  width: number;
  height: number;
  pieces: TemplatePiece[];
}

type Transform = 'identity' | 'mirrorX' | 'mirrorY';

const variantTransforms: Transform[] = ['identity', 'mirrorX', 'mirrorY'];

const templates: LevelTemplate[] = [
  {
    titleKey: 'level.title.warmup',
    hintKey: 'level.hint.warmup',
    width: 4,
    height: 4,
    pieces: [
      { x: 0, y: 0, width: 2, height: 2, clueX: 0, clueY: 0 },
      { x: 2, y: 0, width: 2, height: 1, clueX: 2, clueY: 0 },
      { x: 2, y: 1, width: 2, height: 1, clueX: 3, clueY: 1 },
      { x: 0, y: 2, width: 1, height: 2, clueX: 0, clueY: 2 },
      { x: 1, y: 2, width: 3, height: 2, clueX: 2, clueY: 2 },
    ],
  },
  {
    titleKey: 'level.title.cross',
    hintKey: 'level.hint.cross',
    width: 5,
    height: 5,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 0 },
      { x: 3, y: 0, width: 2, height: 3, clueX: 4, clueY: 1 },
      { x: 2, y: 2, width: 1, height: 1, clueX: 2, clueY: 2 },
      { x: 0, y: 2, width: 2, height: 3, clueX: 0, clueY: 3 },
      { x: 2, y: 3, width: 3, height: 2, clueX: 3, clueY: 4 },
    ],
  },
  {
    titleKey: 'level.title.stairs',
    hintKey: 'level.hint.stairs',
    width: 6,
    height: 5,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 0, clueY: 1 },
      { x: 3, y: 0, width: 3, height: 2, clueX: 3, clueY: 0 },
      { x: 3, y: 2, width: 2, height: 2, clueX: 4, clueY: 3 },
      { x: 5, y: 2, width: 1, height: 2, clueX: 5, clueY: 2 },
      { x: 0, y: 2, width: 2, height: 2, clueX: 1, clueY: 3 },
      { x: 0, y: 4, width: 6, height: 1, clueX: 2, clueY: 4 },
      { x: 2, y: 2, width: 1, height: 2, clueX: 2, clueY: 3 },
    ],
  },
  {
    titleKey: 'level.title.switchback',
    hintKey: 'level.hint.switchback',
    width: 6,
    height: 6,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 0 },
      { x: 3, y: 0, width: 3, height: 1, clueX: 4, clueY: 0 },
      { x: 3, y: 1, width: 2, height: 3, clueX: 3, clueY: 2 },
      { x: 5, y: 1, width: 1, height: 3, clueX: 5, clueY: 2 },
      { x: 0, y: 2, width: 3, height: 2, clueX: 2, clueY: 3 },
      { x: 0, y: 4, width: 2, height: 2, clueX: 1, clueY: 4 },
      { x: 2, y: 4, width: 4, height: 2, clueX: 4, clueY: 5 },
    ],
  },
  {
    titleKey: 'level.title.corridor',
    hintKey: 'level.hint.corridor',
    width: 7,
    height: 6,
    pieces: [
      { x: 0, y: 0, width: 2, height: 3, clueX: 0, clueY: 1 },
      { x: 2, y: 0, width: 3, height: 2, clueX: 3, clueY: 0 },
      { x: 5, y: 0, width: 2, height: 1, clueX: 6, clueY: 0 },
      { x: 5, y: 1, width: 2, height: 3, clueX: 5, clueY: 2 },
      { x: 2, y: 2, width: 3, height: 2, clueX: 4, clueY: 3 },
      { x: 0, y: 3, width: 2, height: 3, clueX: 1, clueY: 4 },
      { x: 2, y: 4, width: 3, height: 2, clueX: 2, clueY: 5 },
      { x: 5, y: 4, width: 2, height: 2, clueX: 6, clueY: 5 },
    ],
  },
  {
    titleKey: 'level.title.courtyard',
    hintKey: 'level.hint.courtyard',
    width: 7,
    height: 7,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 1 },
      { x: 3, y: 0, width: 2, height: 1, clueX: 4, clueY: 0 },
      { x: 5, y: 0, width: 2, height: 3, clueX: 6, clueY: 1 },
      { x: 3, y: 1, width: 2, height: 2, clueX: 3, clueY: 2 },
      { x: 0, y: 2, width: 3, height: 3, clueX: 2, clueY: 3 },
      { x: 3, y: 3, width: 4, height: 2, clueX: 5, clueY: 4 },
      { x: 0, y: 5, width: 2, height: 2, clueX: 0, clueY: 5 },
      { x: 2, y: 5, width: 3, height: 2, clueX: 3, clueY: 6 },
      { x: 5, y: 5, width: 2, height: 2, clueX: 6, clueY: 5 },
    ],
  },
  {
    titleKey: 'level.title.bridge',
    hintKey: 'level.hint.bridge',
    width: 8,
    height: 6,
    pieces: [
      { x: 0, y: 0, width: 2, height: 2, clueX: 0, clueY: 0 },
      { x: 2, y: 0, width: 3, height: 2, clueX: 3, clueY: 1 },
      { x: 5, y: 0, width: 3, height: 1, clueX: 6, clueY: 0 },
      { x: 5, y: 1, width: 3, height: 2, clueX: 5, clueY: 2 },
      { x: 0, y: 2, width: 2, height: 4, clueX: 1, clueY: 3 },
      { x: 2, y: 2, width: 2, height: 2, clueX: 3, clueY: 2 },
      { x: 4, y: 2, width: 1, height: 4, clueX: 4, clueY: 4 },
      { x: 5, y: 3, width: 3, height: 3, clueX: 7, clueY: 4 },
      { x: 2, y: 4, width: 2, height: 2, clueX: 2, clueY: 5 },
    ],
  },
  {
    titleKey: 'level.title.offset',
    hintKey: 'level.hint.offset',
    width: 8,
    height: 7,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 0 },
      { x: 3, y: 0, width: 3, height: 1, clueX: 5, clueY: 0 },
      { x: 6, y: 0, width: 2, height: 3, clueX: 6, clueY: 1 },
      { x: 3, y: 1, width: 3, height: 2, clueX: 4, clueY: 2 },
      { x: 0, y: 2, width: 3, height: 3, clueX: 2, clueY: 3 },
      { x: 3, y: 3, width: 2, height: 2, clueX: 3, clueY: 4 },
      { x: 5, y: 3, width: 3, height: 2, clueX: 6, clueY: 4 },
      { x: 0, y: 5, width: 2, height: 2, clueX: 0, clueY: 6 },
      { x: 2, y: 5, width: 4, height: 2, clueX: 4, clueY: 5 },
      { x: 6, y: 5, width: 2, height: 2, clueX: 7, clueY: 6 },
    ],
  },
  {
    titleKey: 'level.title.ring',
    hintKey: 'level.hint.ring',
    width: 8,
    height: 8,
    pieces: [
      { x: 0, y: 0, width: 2, height: 3, clueX: 1, clueY: 1 },
      { x: 2, y: 0, width: 3, height: 2, clueX: 3, clueY: 0 },
      { x: 5, y: 0, width: 3, height: 1, clueX: 7, clueY: 0 },
      { x: 5, y: 1, width: 3, height: 3, clueX: 6, clueY: 2 },
      { x: 2, y: 2, width: 3, height: 2, clueX: 4, clueY: 3 },
      { x: 0, y: 3, width: 2, height: 3, clueX: 0, clueY: 5 },
      { x: 2, y: 4, width: 2, height: 4, clueX: 3, clueY: 6 },
      { x: 4, y: 4, width: 4, height: 2, clueX: 6, clueY: 5 },
      { x: 0, y: 6, width: 2, height: 2, clueX: 1, clueY: 6 },
      { x: 4, y: 6, width: 3, height: 2, clueX: 5, clueY: 7 },
      { x: 7, y: 6, width: 1, height: 2, clueX: 7, clueY: 7 },
    ],
  },
  {
    titleKey: 'level.title.endgame',
    hintKey: 'level.hint.endgame',
    width: 9,
    height: 8,
    pieces: [
      { x: 0, y: 0, width: 3, height: 2, clueX: 1, clueY: 0 },
      { x: 3, y: 0, width: 2, height: 3, clueX: 4, clueY: 1 },
      { x: 5, y: 0, width: 4, height: 1, clueX: 7, clueY: 0 },
      { x: 5, y: 1, width: 2, height: 2, clueX: 5, clueY: 2 },
      { x: 7, y: 1, width: 2, height: 2, clueX: 8, clueY: 2 },
      { x: 0, y: 2, width: 3, height: 3, clueX: 2, clueY: 3 },
      { x: 3, y: 3, width: 2, height: 2, clueX: 3, clueY: 4 },
      { x: 5, y: 3, width: 4, height: 2, clueX: 6, clueY: 4 },
      { x: 0, y: 5, width: 2, height: 3, clueX: 1, clueY: 6 },
      { x: 2, y: 5, width: 3, height: 3, clueX: 4, clueY: 6 },
      { x: 5, y: 5, width: 2, height: 3, clueX: 6, clueY: 7 },
      { x: 7, y: 5, width: 2, height: 3, clueX: 8, clueY: 6 },
    ],
  },
];

function transformPiece(piece: TemplatePiece, width: number, height: number, transform: Transform): TemplatePiece {
  if (transform === 'mirrorX') {
    return {
      ...piece,
      x: width - piece.x - piece.width,
      clueX: width - piece.clueX - 1,
    };
  }

  if (transform === 'mirrorY') {
    return {
      ...piece,
      y: height - piece.y - piece.height,
      clueY: height - piece.clueY - 1,
    };
  }

  return { ...piece };
}

function buildClues(pieces: TemplatePiece[]): Clue[] {
  return pieces.map((piece) => ({
    x: piece.clueX,
    y: piece.clueY,
    value: piece.width * piece.height,
  }));
}

function assertValidTemplate(template: LevelTemplate): void {
  const occupied = Array.from({ length: template.height }, () => Array<number>(template.width).fill(0));

  for (const piece of template.pieces) {
    if (
      piece.x < 0 ||
      piece.y < 0 ||
      piece.x + piece.width > template.width ||
      piece.y + piece.height > template.height
    ) {
      throw new Error(`Template "${template.titleKey}" has an out-of-bounds rectangle.`);
    }

    if (
      piece.clueX < piece.x ||
      piece.clueX >= piece.x + piece.width ||
      piece.clueY < piece.y ||
      piece.clueY >= piece.y + piece.height
    ) {
      throw new Error(`Template "${template.titleKey}" has a clue outside its rectangle.`);
    }

    for (let dy = 0; dy < piece.height; dy += 1) {
      for (let dx = 0; dx < piece.width; dx += 1) {
        occupied[piece.y + dy][piece.x + dx] += 1;
      }
    }
  }

  for (const row of occupied) {
    for (const cell of row) {
      if (cell !== 1) {
        throw new Error(`Template "${template.titleKey}" does not cover the board exactly once.`);
      }
    }
  }
}

templates.forEach(assertValidTemplate);

export const levels: Level[] = templates.flatMap((template, templateIndex) =>
  variantTransforms.map((transform, variantIndex) => {
    const pieces = template.pieces.map((piece) =>
      transformPiece(piece, template.width, template.height, transform),
    );
    const number = templateIndex * 3 + variantIndex + 1;

    return {
      id: `level-${String(number).padStart(2, '0')}`,
      number,
      titleKey: template.titleKey,
      hintKey: template.hintKey,
      width: template.width,
      height: template.height,
      clues: buildClues(pieces),
    };
  }),
);
