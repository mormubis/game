import type { Piece, Square } from './types.js';

// 0x88 index layout:
// index = (8 - rank) * 16 + (file - 1)   rank: 1-based, file: a=0..h=7
// a8=0, b8=1, …, h8=7, a7=16, …, a1=112, h1=119
// Off-board check: index & 0x88 !== 0
// Array size: 128 (64 valid squares + 64 padding)

export const OFF_BOARD = 0x88;

export function squareToIndex(square: Square): number {
  const file = (square.codePointAt(0) ?? 0) - ('a'.codePointAt(0) ?? 0);
  const rank = Number.parseInt(square[1] ?? '1', 10);
  return (8 - rank) * 16 + file;
}

export function indexToSquare(index: number): Square {
  const rank = 8 - Math.floor(index / 16);
  const file = index % 16;
  return `${String.fromCodePoint(('a'.codePointAt(0) ?? 0) + file)}${rank}` as Square;
}

export function rankOf(square: Square): number {
  return Number.parseInt(square[1] ?? '1', 10);
}

export function fileOf(square: Square): number {
  return (square.codePointAt(0) ?? 0) - ('a'.codePointAt(0) ?? 0) + 1;
}

const BACK_RANK: Piece['type'][] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

export const INITIAL_BOARD: readonly (Piece | undefined)[] = (() => {
  const board: (Piece | undefined)[] = Array.from({ length: 128 });
  for (let file = 0; file < 8; file++) {
    const type = BACK_RANK[file] ?? 'r';
    board[112 + file] = { color: 'w', type }; // rank 1 = row 7
    board[96 + file] = { color: 'w', type: 'p' }; // rank 2 = row 6
    board[16 + file] = { color: 'b', type: 'p' }; // rank 7 = row 1
    board[file] = { color: 'b', type }; // rank 8 = row 0
  }

  return board;
})();

export function cloneBoard(
  board: readonly (Piece | undefined)[],
): (Piece | undefined)[] {
  return [...board];
}
