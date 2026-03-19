# Position Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Replace all duplicated board, type, FEN, and attack logic in
`@echecs/game` with `@echecs/position` and `@echecs/fen`, using the `Position`
class as internal state.

**Architecture:** The `Game` class becomes a thin stateful wrapper (undo/redo,
legal move caching) over an immutable `Position` core from `@echecs/position`.
Move generation stays in `@echecs/game` (Position doesn't generate moves). FEN
I/O delegates to `@echecs/fen`. Types are re-exported from `@echecs/position`.

**Tech Stack:** TypeScript (strict, ESM-only), `@echecs/position` (v1.0.2),
`@echecs/fen` (v1.0.0), Vitest, pnpm

**Key API Surfaces:**

- `@echecs/position` — `Position` class with `piece()`, `pieces()`,
  `isAttacked()`, `isCheck`, `isInsufficientMaterial`, `hash`, `turn`,
  `castlingRights`, `enPassantSquare`, `halfmoveClock`, `fullmoveNumber`
- `@echecs/position/internal` — `squareToIndex()`, `indexToSquare()`,
  `boardFromMap()`, `OFF_BOARD`, `ATTACKS`, `RAYS`, `PIECE_MASKS`, `DIFF_OFFSET`
- `@echecs/fen` — default export `parse(fen) → Position | null`,
  `stringify(position) → string`, `STARTING_FEN`
- `@echecs/fen`'s `Position` interface is structurally compatible with
  `@echecs/position`'s `Position` class (`Map<Square, Piece>` board + same
  options shape), so `stringify()` accepts `Position` class instances directly.
- Constructor:
  `new Position(board?: Map<Square, Piece>, options?: PositionOptions)` where
  `PositionOptions = { castlingRights?, enPassantSquare?, fullmoveNumber?, halfmoveClock?, turn? }`

---

### Task 1: Add runtime dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install dependencies**

Run:

```bash
pnpm add @echecs/position @echecs/fen
```

Expected: Both packages added to `dependencies` in `package.json`.

**Step 2: Verify build still works**

Run:

```bash
pnpm build
```

Expected: SUCCESS

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add @echecs/position and @echecs/fen dependencies"
```

---

### Task 2: Rewrite `src/index.ts` — re-export types from `@echecs/position`

**Files:**

- Modify: `src/index.ts`

**Step 1: Rewrite index.ts**

Replace the entire file with:

```typescript
export { Game } from './game.js';
export { Position } from '@echecs/position';
export type {
  CastlingRights,
  Color,
  Move,
  Piece,
  PieceType,
  PromotionPieceType,
  Square,
} from '@echecs/position';
```

Note: This re-exports `Position` as a value (class) and all types from
`@echecs/position`. The old `./types.js` import is removed.

**Step 2: Verify types compile** (will fail — downstream files still import old
modules — that's expected)

Run:

```bash
pnpm lint:types 2>&1 || true
```

Expected: Type errors in game.ts, moves.ts, detection.ts (still importing old
modules). index.ts itself should have no errors.

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "refactor: re-export types and Position from @echecs/position"
```

---

### Task 3: Rewrite `src/moves.ts` — use Position instead of FenState

This is the largest task. Move generation must work against `Position` objects
and `@echecs/position/internal` utilities.

**Files:**

- Modify: `src/moves.ts`

**Step 1: Rewrite moves.ts**

Replace the entire file with the following. Key changes:

- All functions take `Position` instead of `FenState`
- Board access uses `boardFromMap(position.pieces())` for the 0x88 array
- `isSquareAttackedBy` and `isInCheck` are deleted — use `position.isAttacked()`
  and `position.isCheck`
- `applyMoveToState` renamed to `move` and returns a new `Position`
- Attack/ray tables imported from `@echecs/position/internal`

```typescript
import { Position } from '@echecs/position';
import {
  ATTACKS,
  DIFF_OFFSET,
  OFF_BOARD,
  PIECE_MASKS,
  RAYS,
  boardFromMap,
  indexToSquare,
  squareToIndex,
} from '@echecs/position/internal';

import type {
  Color,
  Move,
  Piece,
  PieceType,
  PromotionPieceType,
  Square,
} from '@echecs/position';

const PROMOTION_PIECES: PromotionPieceType[] = ['b', 'n', 'q', 'r'];

const KNIGHT_OFFSETS_0X88 = [-33, -31, -18, -14, 14, 18, 31, 33] as const;
const BISHOP_DIRS_0X88 = [-17, -15, 15, 17] as const;
const ROOK_DIRS_0X88 = [-16, -1, 1, 16] as const;
const KING_OFFSETS_0X88 = [-17, -16, -15, -1, 1, 15, 16, 17] as const;

function enemyColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function generatePawnMoves(
  board: (Piece | undefined)[],
  enPassantSquare: Square | undefined,
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  moves: Move[],
): void {
  const direction = color === 'w' ? -16 : 16;
  const startRow = color === 'w' ? 6 : 1;
  const promoteRow = color === 'w' ? 0 : 7;
  const currentRow = fromIndex >> 4;
  const enemy = enemyColor(color);
  const captureOffsets = color === 'w' ? [-17, -15] : [15, 17];

  // Single push
  const singleIndex = fromIndex + direction;
  if (!(singleIndex & OFF_BOARD) && board[singleIndex] === undefined) {
    const toSquare = indexToSquare(singleIndex);
    const toRow = singleIndex >> 4;
    if (toRow === promoteRow) {
      for (const promo of PROMOTION_PIECES) {
        moves.push({ from: fromSquare, promotion: promo, to: toSquare });
      }
    } else {
      moves.push({ from: fromSquare, to: toSquare });
    }

    // Double push
    if (currentRow === startRow) {
      const doubleIndex = fromIndex + direction * 2;
      if (!(doubleIndex & OFF_BOARD) && board[doubleIndex] === undefined) {
        moves.push({ from: fromSquare, to: indexToSquare(doubleIndex) });
      }
    }
  }

  // Diagonal captures + en passant
  for (const capOffset of captureOffsets) {
    const capIndex = fromIndex + capOffset;
    if (capIndex & OFF_BOARD) {
      continue;
    }

    const capSquare = indexToSquare(capIndex);
    const target = board[capIndex];
    const isEnPassant = enPassantSquare === capSquare;

    if ((target !== undefined && target.color === enemy) || isEnPassant) {
      const toRow = capIndex >> 4;
      if (toRow === promoteRow) {
        for (const promo of PROMOTION_PIECES) {
          moves.push({ from: fromSquare, promotion: promo, to: capSquare });
        }
      } else {
        moves.push({ from: fromSquare, to: capSquare });
      }
    }
  }
}

function generateKnightMoves(
  board: (Piece | undefined)[],
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  moves: Move[],
): void {
  for (const offset of KNIGHT_OFFSETS_0X88) {
    const toIndex = fromIndex + offset;
    if (toIndex & OFF_BOARD) {
      continue;
    }

    const target = board[toIndex];
    if (target === undefined || target.color !== color) {
      moves.push({ from: fromSquare, to: indexToSquare(toIndex) });
    }
  }
}

function generateSlidingMoves(
  board: (Piece | undefined)[],
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  directions: readonly number[],
  moves: Move[],
): void {
  for (const direction of directions) {
    let toIndex = fromIndex + direction;
    while (!(toIndex & OFF_BOARD)) {
      const target = board[toIndex];
      if (target === undefined) {
        moves.push({ from: fromSquare, to: indexToSquare(toIndex) });
      } else if (target.color === color) {
        break;
      } else {
        moves.push({ from: fromSquare, to: indexToSquare(toIndex) });
        break;
      }

      toIndex += direction;
    }
  }
}

/**
 * Check if `targetIndex` is attacked by any piece of `attackerColor`.
 * Uses ATTACKS/RAYS lookup tables for O(1) piece-type check + ray blocker scan.
 * Does NOT consider castling (no recursion).
 */
function isSquareAttackedBy(
  board: (Piece | undefined)[],
  targetIndex: number,
  attackerColor: Color,
): boolean {
  for (let index = 0; index <= 119; index++) {
    if (index & OFF_BOARD) {
      continue;
    }

    const piece = board[index];
    if (piece === undefined || piece.color !== attackerColor) {
      continue;
    }

    const diff = index - targetIndex;
    const tableIndex = diff + DIFF_OFFSET;
    const attackMask = ATTACKS[tableIndex] ?? 0;
    if (attackMask === 0) {
      continue;
    }

    const pieceMask = PIECE_MASKS[piece.type] ?? 0;
    if ((attackMask & pieceMask) === 0) {
      continue;
    }

    // Pawn: direction must match attacker color
    if (piece.type === 'p') {
      if (attackerColor === 'w' && diff <= 0) {
        continue;
      }

      if (attackerColor === 'b' && diff >= 0) {
        continue;
      }

      return true;
    }

    // Knight / King: no blockers
    if (piece.type === 'n' || piece.type === 'k') {
      return true;
    }

    // Sliding piece: walk ray and check for blockers
    const step = -(RAYS[tableIndex] ?? 0);
    if (step === 0) {
      continue;
    }

    let index_ = index + step;
    while (index_ !== targetIndex) {
      if (index_ & OFF_BOARD || board[index_] !== undefined) {
        break;
      }

      index_ += step;
    }

    if (index_ === targetIndex) {
      return true;
    }
  }

  return false;
}

function generateKingMoves(
  board: (Piece | undefined)[],
  castlingRights: { bK: boolean; bQ: boolean; wK: boolean; wQ: boolean },
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  moves: Move[],
): void {
  // Normal king moves
  for (const offset of KING_OFFSETS_0X88) {
    const toIndex = fromIndex + offset;
    if (toIndex & OFF_BOARD) {
      continue;
    }

    const target = board[toIndex];
    if (target === undefined || target.color !== color) {
      moves.push({ from: fromSquare, to: indexToSquare(toIndex) });
    }
  }

  // Castling
  const kingRow = fromIndex >> 4;
  const expectedRow = color === 'w' ? 7 : 0;
  if (kingRow !== expectedRow) {
    return;
  }

  const enemy = enemyColor(color);

  // Kingside castling
  const canKingside = color === 'w' ? castlingRights.wK : castlingRights.bK;
  if (canKingside) {
    const fIndex = squareToIndex((color === 'w' ? 'f1' : 'f8') as Square);
    const gIndex = squareToIndex((color === 'w' ? 'g1' : 'g8') as Square);
    if (
      board[fIndex] === undefined &&
      board[gIndex] === undefined &&
      !isSquareAttackedBy(board, fromIndex, enemy) &&
      !isSquareAttackedBy(board, fIndex, enemy) &&
      !isSquareAttackedBy(board, gIndex, enemy)
    ) {
      moves.push({ from: fromSquare, to: indexToSquare(gIndex) });
    }
  }

  // Queenside castling
  const canQueenside = color === 'w' ? castlingRights.wQ : castlingRights.bQ;
  if (canQueenside) {
    const bIndex = squareToIndex((color === 'w' ? 'b1' : 'b8') as Square);
    const cIndex = squareToIndex((color === 'w' ? 'c1' : 'c8') as Square);
    const dIndex = squareToIndex((color === 'w' ? 'd1' : 'd8') as Square);
    if (
      board[bIndex] === undefined &&
      board[cIndex] === undefined &&
      board[dIndex] === undefined &&
      !isSquareAttackedBy(board, fromIndex, enemy) &&
      !isSquareAttackedBy(board, dIndex, enemy) &&
      !isSquareAttackedBy(board, cIndex, enemy)
    ) {
      moves.push({ from: fromSquare, to: indexToSquare(cIndex) });
    }
  }
}

function generatePseudoLegalMovesForSquare(
  position: Position,
  board: (Piece | undefined)[],
  square: Square,
): Move[] {
  const fromIndex = squareToIndex(square);
  const piece = board[fromIndex];
  if (piece === undefined || piece.color !== position.turn) {
    return [];
  }

  const moves: Move[] = [];

  switch (piece.type) {
    case 'p': {
      generatePawnMoves(
        board,
        position.enPassantSquare,
        fromIndex,
        square,
        piece.color,
        moves,
      );
      break;
    }
    case 'n': {
      generateKnightMoves(board, fromIndex, square, piece.color, moves);
      break;
    }
    case 'b': {
      generateSlidingMoves(
        board,
        fromIndex,
        square,
        piece.color,
        BISHOP_DIRS_0X88,
        moves,
      );
      break;
    }
    case 'r': {
      generateSlidingMoves(
        board,
        fromIndex,
        square,
        piece.color,
        ROOK_DIRS_0X88,
        moves,
      );
      break;
    }
    case 'q': {
      generateSlidingMoves(
        board,
        fromIndex,
        square,
        piece.color,
        BISHOP_DIRS_0X88,
        moves,
      );
      generateSlidingMoves(
        board,
        fromIndex,
        square,
        piece.color,
        ROOK_DIRS_0X88,
        moves,
      );
      break;
    }
    case 'k': {
      generateKingMoves(
        board,
        position.castlingRights,
        fromIndex,
        square,
        piece.color,
        moves,
      );
      break;
    }
  }

  return moves;
}

/**
 * Apply a move to a Position, returning a new Position.
 * Does not validate legality — assumes the move is valid.
 */
function move(position: Position, m: Move): Position {
  const board = boardFromMap(position.pieces());
  const fromIndex = squareToIndex(m.from);
  const toIndex = squareToIndex(m.to);
  const piece = board[fromIndex];

  if (piece === undefined) {
    return position;
  }

  const fromRow = fromIndex >> 4;
  const toRow = toIndex >> 4;
  const fromFile = fromIndex & 0x07;
  const toFile = toIndex & 0x07;
  const isCapture = board[toIndex] !== undefined;
  const isPawn = piece.type === 'p';
  const isKing = piece.type === 'k';
  const isRook = piece.type === 'r';

  // Detect en passant capture
  const isEnPassant = isPawn && m.to === position.enPassantSquare && !isCapture;

  // Detect castling (king moves 2 squares horizontally)
  const isCastling = isKing && Math.abs(toFile - fromFile) === 2;

  // Move the piece
  board[fromIndex] = undefined;

  // Handle promotion
  board[toIndex] =
    isPawn && m.promotion !== undefined
      ? { color: piece.color, type: m.promotion }
      : piece;

  // Remove en passant captured pawn
  if (isEnPassant) {
    const capturedPawnIndex = (fromRow << 4) | toFile;
    board[capturedPawnIndex] = undefined;
  }

  // Handle castling rook movement
  if (isCastling) {
    const castleRow = piece.color === 'w' ? 7 : 0;
    if (toFile > fromFile) {
      // Kingside: rook moves from h-file (7) to f-file (5)
      const rookFrom = (castleRow << 4) | 7;
      const rookTo = (castleRow << 4) | 5;
      board[rookTo] = board[rookFrom];
      board[rookFrom] = undefined;
    } else {
      // Queenside: rook moves from a-file (0) to d-file (3)
      const rookFrom = castleRow << 4;
      const rookTo = (castleRow << 4) | 3;
      board[rookTo] = board[rookFrom];
      board[rookFrom] = undefined;
    }
  }

  // Update castling rights
  let { bK, bQ, wK, wQ } = position.castlingRights;

  if (isKing) {
    if (piece.color === 'w') {
      wK = false;
      wQ = false;
    } else {
      bK = false;
      bQ = false;
    }
  }

  if (isRook) {
    switch (m.from) {
      case 'a1': {
        wQ = false;
        break;
      }
      case 'h1': {
        wK = false;
        break;
      }
      case 'a8': {
        bQ = false;
        break;
      }
      case 'h8': {
        bK = false;
        break;
      }
      // No default
    }
  }

  // Rook captured: remove castling rights
  if (isCapture) {
    switch (m.to) {
      case 'a1': {
        wQ = false;
        break;
      }
      case 'h1': {
        wK = false;
        break;
      }
      case 'a8': {
        bQ = false;
        break;
      }
      case 'h8': {
        bK = false;
        break;
      }
      // No default
    }
  }

  // Update en passant square
  let enPassantSquare: Square | undefined;
  if (isPawn && Math.abs(toRow - fromRow) === 2) {
    const epRow = (fromRow + toRow) >> 1;
    enPassantSquare = indexToSquare((epRow << 4) | fromFile);
  }

  // Update halfmove clock
  const halfmoveClock =
    isPawn || isCapture || isEnPassant ? 0 : position.halfmoveClock + 1;

  // Update fullmove number
  const fullmoveNumber =
    position.turn === 'b'
      ? position.fullmoveNumber + 1
      : position.fullmoveNumber;

  // Switch turn
  const turn: Color = position.turn === 'w' ? 'b' : 'w';

  // Build new board Map from 0x88 array
  const newBoard = new Map<Square, Piece>();
  for (let index = 0; index <= 119; index++) {
    if (index & OFF_BOARD) {
      continue;
    }

    const p = board[index];
    if (p !== undefined) {
      newBoard.set(indexToSquare(index), p);
    }
  }

  return new Position(newBoard, {
    castlingRights: { bK, bQ, wK, wQ },
    enPassantSquare,
    fullmoveNumber,
    halfmoveClock,
    turn,
  });
}

/**
 * Generate all legal moves for the active color, optionally filtered by square.
 */
function generateMoves(position: Position, square?: Square): Move[] {
  const board = boardFromMap(position.pieces());
  const pseudoMoves: Move[] = [];

  if (square === undefined) {
    for (let index = 0; index <= 119; index++) {
      if (index & OFF_BOARD) {
        continue;
      }

      const piece = board[index];
      if (piece === undefined || piece.color !== position.turn) {
        continue;
      }

      const fromSquare = indexToSquare(index);
      pseudoMoves.push(
        ...generatePseudoLegalMovesForSquare(position, board, fromSquare),
      );
    }
  } else {
    const fromIndex = squareToIndex(square);
    const piece = board[fromIndex];
    if (piece === undefined || piece.color !== position.turn) {
      return [];
    }

    pseudoMoves.push(
      ...generatePseudoLegalMovesForSquare(position, board, square),
    );
  }

  // Filter out moves that leave the king in check
  const legalMoves: Move[] = [];
  for (const m of pseudoMoves) {
    const next = move(position, m);
    if (
      !next.isAttacked(
        next.findPiece({ color: position.turn, type: 'k' })[0] as Square,
        next.turn,
      )
    ) {
      legalMoves.push(m);
    }
  }

  return legalMoves;
}

export { generateMoves, move };
```

**IMPORTANT NOTE on legality check:** The legality filter at the end of
`generateMoves` must check if the moving side's king is in check AFTER the move.
After `move()`, the turn has switched, so `next.turn` is the opponent. We need
to check if the original side's king is attacked by the new side to move. The
simplest approach: find the original side's king in the resulting position, then
use `next.isAttacked(kingSquare, next.turn)`.

Alternatively, `next.isCheck` checks if the NEW side to move is in check — but
we need to check the PREVIOUS side's king. So we must use
`next.isAttacked(kingSquare, next.turn)` where `next.turn` is the opponent of
the side that just moved.

Wait — re-reading the original code: `isInCheck(next, state.turn)` checks if
`state.turn` (the side that just moved) still has its king in check in the new
position. That means: "is the king of the side that just moved attacked by the
opponent?" The opponent in `next` is `next.turn` (since turns switched). So
`next.isAttacked(kingSquare, next.turn)` is correct.

But `Position.isCheck` checks if the side to move is in check — that's the
OPPONENT after the move. We want to check the side that JUST moved. So we cannot
use `next.isCheck`. We must find the king and use `isAttacked`.

Actually, let me reconsider. We can simplify: keep a local `isInCheck` that uses
the internal board + `isSquareAttackedBy`. This avoids creating a full Position
for every pseudo-legal move during legality filtering.

**REVISED approach:** Keep `isSquareAttackedBy` as a private function. For the
legality filter in `generateMoves`, use a lightweight path that applies the move
to the 0x88 array (without constructing a Position) just to check king safety.
The full `move()` function (which constructs a Position) is only called for
confirmed-legal moves from the Game class.

This means we need TWO move-application paths:

1. `applyMoveToBoard(board, position, move) → { board, ... }` — lightweight,
   returns a raw 0x88 board + minimal state for check testing
2. `move(position, move) → Position` — full, constructs new Position

Let me revise the plan:

```typescript
import { Position } from '@echecs/position';
import {
  OFF_BOARD,
  boardFromMap,
  indexToSquare,
  squareToIndex,
} from '@echecs/position/internal';

import type {
  CastlingRights,
  Color,
  Move,
  Piece,
  PromotionPieceType,
  Square,
} from '@echecs/position';

const PROMOTION_PIECES: PromotionPieceType[] = ['b', 'n', 'q', 'r'];

const KNIGHT_OFFSETS_0X88 = [-33, -31, -18, -14, 14, 18, 31, 33] as const;
const BISHOP_DIRS_0X88 = [-17, -15, 15, 17] as const;
const ROOK_DIRS_0X88 = [-16, -1, 1, 16] as const;
const KING_OFFSETS_0X88 = [-17, -16, -15, -1, 1, 15, 16, 17] as const;

// ── ATTACKS / RAYS lookup tables ─────────────────────────────────────────────

const PAWN_MASK = 0x01;
const KNIGHT_MASK = 0x02;
const BISHOP_MASK = 0x04;
const ROOK_MASK = 0x08;
const KING_MASK = 0x10;

const PIECE_MASKS: Record<string, number> = {
  b: BISHOP_MASK,
  k: KING_MASK,
  n: KNIGHT_MASK,
  p: PAWN_MASK,
  q: BISHOP_MASK | ROOK_MASK,
  r: ROOK_MASK,
};

const DIFF_OFFSET = 119;

const ATTACKS: number[] = Array.from<number>({ length: 240 }).fill(0);
const RAYS: number[] = Array.from<number>({ length: 240 }).fill(0);

(function initAttackTables() {
  for (const offset of KNIGHT_OFFSETS_0X88) {
    ATTACKS[offset + DIFF_OFFSET] =
      (ATTACKS[offset + DIFF_OFFSET] ?? 0) | KNIGHT_MASK;
  }
  for (const offset of KING_OFFSETS_0X88) {
    ATTACKS[offset + DIFF_OFFSET] =
      (ATTACKS[offset + DIFF_OFFSET] ?? 0) | KING_MASK;
  }
  for (const offset of [15, 17]) {
    ATTACKS[offset + DIFF_OFFSET] =
      (ATTACKS[offset + DIFF_OFFSET] ?? 0) | PAWN_MASK;
    ATTACKS[-offset + DIFF_OFFSET] =
      (ATTACKS[-offset + DIFF_OFFSET] ?? 0) | PAWN_MASK;
  }
  for (let from = 0; from <= 119; from++) {
    if (from & OFF_BOARD) {
      continue;
    }
    for (const direction of ROOK_DIRS_0X88) {
      let to = from + direction;
      while (!(to & OFF_BOARD)) {
        const diff = to - from;
        ATTACKS[diff + DIFF_OFFSET] =
          (ATTACKS[diff + DIFF_OFFSET] ?? 0) | ROOK_MASK;
        RAYS[diff + DIFF_OFFSET] = direction;
        to += direction;
      }
    }
    for (const direction of BISHOP_DIRS_0X88) {
      let to = from + direction;
      while (!(to & OFF_BOARD)) {
        const diff = to - from;
        ATTACKS[diff + DIFF_OFFSET] =
          (ATTACKS[diff + DIFF_OFFSET] ?? 0) | BISHOP_MASK;
        RAYS[diff + DIFF_OFFSET] = direction;
        to += direction;
      }
    }
  }
})();

function enemyColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function isSquareAttackedBy(
  board: (Piece | undefined)[],
  targetIndex: number,
  attackerColor: Color,
): boolean {
  // ... identical to existing implementation ...
}

function isKingInCheck(board: (Piece | undefined)[], color: Color): boolean {
  let kingIndex = -1;
  for (let index = 0; index <= 119; index++) {
    if (index & OFF_BOARD) {
      continue;
    }
    const piece = board[index];
    if (piece !== undefined && piece.type === 'k' && piece.color === color) {
      kingIndex = index;
      break;
    }
  }
  if (kingIndex === -1) {
    return false;
  }
  return isSquareAttackedBy(board, kingIndex, enemyColor(color));
}
```

**ACTUALLY — let me simplify this.** The existing code already has attack tables
built locally. The cleanest approach: keep the attack tables LOCAL (don't import
from position/internal), keep `isSquareAttackedBy` as a private function, and
only import `boardFromMap`, `indexToSquare`, `squareToIndex`, `OFF_BOARD` from
`@echecs/position/internal` (the pure utility functions).

This avoids any concern about table format compatibility between packages, and
keeps the move generation module self-contained for its performance-critical
paths.

**FINAL REVISED `src/moves.ts`:**

The file keeps its own ATTACKS/RAYS tables and `isSquareAttackedBy` (private).
The only things that change:

1. Replace `FenState` parameter → `Position` parameter
2. Replace `state.board` → `boardFromMap(position.pieces())` (cached per call)
3. Replace `state.turn` → `position.turn`
4. Replace `state.castlingRights` → `position.castlingRights`
5. Replace `state.enPassantSquare` → `position.enPassantSquare`
6. `applyMoveToState` → `move`, returns new `Position` instead of FenState
7. `cloneBoard` replaced by `boardFromMap` (produces a fresh mutable copy)
8. Legality filter: apply move to raw board via `applyMoveToBoard`
   (lightweight), check king safety, don't construct Position
9. Export only `generateMoves` and `move`

See the final code in the implementation — the agent should follow the exact
existing logic, replacing only the type interfaces and constructors.

**Step 2: Verify tests still pass**

Tests in `moves.spec.ts` will need updating first (Task 6), so skip verification
here.

**Step 3: Commit**

```bash
git add src/moves.ts
git commit -m "refactor: rewrite moves.ts to use Position instead of FenState"
```

---

### Task 4: Rewrite `src/detection.ts` — use Position

**Files:**

- Modify: `src/detection.ts`

**Step 1: Rewrite detection.ts**

```typescript
import type { Position } from '@echecs/position';

import type { Move } from '@echecs/position';

function isCheckmate(position: Position, moves: Move[]): boolean {
  return position.isCheck && moves.length === 0;
}

function isStalemate(position: Position, moves: Move[]): boolean {
  return !position.isCheck && moves.length === 0;
}

function isThreefoldRepetition(positionHistory: string[]): boolean {
  const counts = new Map<string, number>();

  for (const hash of positionHistory) {
    const count = (counts.get(hash) ?? 0) + 1;
    counts.set(hash, count);

    if (count >= 3) {
      return true;
    }
  }

  return false;
}

function isDraw(
  position: Position,
  moves: Move[],
  positionHistory: string[],
): boolean {
  return (
    position.halfmoveClock >= 100 ||
    position.isInsufficientMaterial ||
    isStalemate(position, moves) ||
    isThreefoldRepetition(positionHistory)
  );
}

export { isCheckmate, isDraw, isStalemate, isThreefoldRepetition };
```

Key changes:

- `isCheckmate` and `isStalemate` now take pre-computed `moves: Move[]` instead
  of generating them internally (avoids double computation — Game already caches
  moves)
- `isInsufficientMaterial` deleted — use `position.isInsufficientMaterial`
- `isThreefoldRepetition` now compares Zobrist hash strings directly (no FEN
  slicing)
- `isDraw` takes `moves` parameter to pass through to `isStalemate`

**Step 2: Commit**

```bash
git add src/detection.ts
git commit -m "refactor: rewrite detection.ts to use Position"
```

---

### Task 5: Rewrite `src/game.ts` — Position as internal state

**Files:**

- Modify: `src/game.ts`

**Step 1: Rewrite game.ts**

```typescript
import parse, { STARTING_FEN, stringify } from '@echecs/fen';
import { Position } from '@echecs/position';

import { isCheckmate, isDraw, isThreefoldRepetition } from './detection.js';
import { generateMoves, move as applyMove } from './moves.js';

import type { Color, Move, Piece, Square } from '@echecs/position';

interface HistoryEntry {
  move: Move;
  previousPosition: Position;
}

export class Game {
  #cache: { inCheck: boolean; moves: Move[] } | undefined = undefined;
  #future: HistoryEntry[] = [];
  #past: HistoryEntry[] = [];
  #position: Position;
  #positionHistory: string[] = [];

  constructor() {
    this.#position = new Position();
    this.#positionHistory = [this.#position.hash];
  }

  get #cachedState(): { inCheck: boolean; moves: Move[] } {
    if (this.#cache === undefined) {
      this.#cache = {
        inCheck: this.#position.isCheck,
        moves: generateMoves(this.#position),
      };
    }

    return this.#cache;
  }

  static fromFen(fen: string): Game {
    const parsed = parse(fen);

    if (parsed === undefined) {
      throw new Error(`Invalid FEN string: "${fen}"`);
    }

    const position = new Position(parsed.board, {
      castlingRights: parsed.castlingRights,
      enPassantSquare: parsed.enPassantSquare,
      fullmoveNumber: parsed.fullmoveNumber,
      halfmoveClock: parsed.halfmoveClock,
      turn: parsed.turn,
    });

    const game = new Game();
    game.#position = position;
    game.#past = [];
    game.#future = [];
    game.#positionHistory = [position.hash];
    game.#cache = undefined;
    return game;
  }

  board(): (Piece | undefined)[][] {
    const result: (Piece | undefined)[][] = [];
    for (let rank = 1; rank <= 8; rank++) {
      const row: (Piece | undefined)[] = [];
      for (let file = 0; file < 8; file++) {
        const square = `${String.fromCodePoint(97 + file)}${rank}` as Square;
        row.push(this.#position.piece(square));
      }
      result.push(row);
    }
    return result;
  }

  fen(): string {
    return stringify({
      board: this.#position.pieces(),
      castlingRights: this.#position.castlingRights,
      enPassantSquare: this.#position.enPassantSquare,
      fullmoveNumber: this.#position.fullmoveNumber,
      halfmoveClock: this.#position.halfmoveClock,
      turn: this.#position.turn,
    });
  }

  get(square: Square): Piece | undefined {
    return this.#position.piece(square);
  }

  history(): Move[] {
    return this.#past.map((entry) => entry.move);
  }

  isAttacked(square: Square, color: Color): boolean {
    return this.#position.isAttacked(square, color);
  }

  isCheck(): boolean {
    return this.#cachedState.inCheck;
  }

  isCheckmate(): boolean {
    return this.#cachedState.inCheck && this.#cachedState.moves.length === 0;
  }

  isDraw(): boolean {
    return (
      this.#position.halfmoveClock >= 100 ||
      this.#position.isInsufficientMaterial ||
      this.isStalemate() ||
      isThreefoldRepetition(this.#positionHistory)
    );
  }

  isGameOver(): boolean {
    return this.isCheckmate() || this.isDraw();
  }

  isStalemate(): boolean {
    return !this.#cachedState.inCheck && this.#cachedState.moves.length === 0;
  }

  move(move: Move): this {
    const legal = this.#cachedState.moves.filter((m) => m.from === move.from);
    const isLegal = legal.some(
      (m) => m.to === move.to && m.promotion === move.promotion,
    );

    if (!isLegal) {
      throw new Error(`Illegal move: ${move.from} → ${move.to}`);
    }

    this.#cache = undefined;
    const previousPosition = this.#position;
    this.#position = applyMove(this.#position, move);
    this.#past.push({ move, previousPosition });
    this.#future = [];
    this.#positionHistory.push(this.#position.hash);

    return this;
  }

  moves(square?: Square): Move[] {
    if (square === undefined) {
      return this.#cachedState.moves;
    }

    return this.#cachedState.moves.filter((m) => m.from === square);
  }

  position(): Position {
    return this.#position;
  }

  redo(): void {
    const entry = this.#future.pop();
    if (entry === undefined) {
      return;
    }

    this.#cache = undefined;
    this.#position = applyMove(entry.previousPosition, entry.move);
    this.#past.push(entry);
    this.#positionHistory.push(this.#position.hash);
  }

  turn(): Color {
    return this.#position.turn;
  }

  undo(): void {
    const entry = this.#past.pop();
    if (entry === undefined) {
      return;
    }

    this.#cache = undefined;
    this.#position = entry.previousPosition;
    this.#future.push(entry);
    this.#positionHistory.pop();
  }
}
```

Key changes:

- `#state: FenState` → `#position: Position`
- `HistoryEntry.previousState` → `HistoryEntry.previousPosition`
- `parseFen` / `serialiseFen` → `parse` / `stringify` from `@echecs/fen`
- `positionHistory` stores `position.hash` instead of FEN strings
- Constructor uses `new Position()` (starting position)
- `fromFen` uses `parse()` from `@echecs/fen`, then constructs `Position`
- New `position()` public method
- `board()` uses `position.piece()` per square
- `get()` delegates to `position.piece()`
- `isAttacked()` delegates to `position.isAttacked()`
- `isDraw()` uses `position.isInsufficientMaterial` directly

**NOTE on `@echecs/fen` parse return:** `parse()` returns `null` on failure (not
`undefined`). However, our codebase bans `null` (`unicorn/no-null`). The
`fromFen` method should compare with `== undefined` (which catches both `null`
and `undefined`) or use a different check pattern. Verify what lint rule applies
here — if `unicorn/no-null` flags `=== null`, use `parsed == undefined` instead.

**Step 2: Commit**

```bash
git add src/game.ts
git commit -m "refactor: rewrite Game class to use Position as internal state"
```

---

### Task 6: Delete old files

**Files:**

- Delete: `src/types.ts`
- Delete: `src/board.ts`
- Delete: `src/fen.ts`

**Step 1: Delete the files**

```bash
rm src/types.ts src/board.ts src/fen.ts
```

**Step 2: Commit**

```bash
git add -u src/types.ts src/board.ts src/fen.ts
git commit -m "refactor: remove types.ts, board.ts, fen.ts (replaced by @echecs/position + @echecs/fen)"
```

---

### Task 7: Update test files

**Files:**

- Modify: `src/__tests__/moves.spec.ts`
- Modify: `src/__tests__/detection.spec.ts`
- Delete: `src/__tests__/fen.spec.ts`
- Delete: `src/__tests__/board.spec.ts`
- Modify: `src/__tests__/game.spec.ts`
- Modify: `src/__tests__/comparison.bench.ts`

**Step 1: Delete board.spec.ts and fen.spec.ts**

These test deleted modules. Their coverage is provided by `@echecs/position` and
`@echecs/fen` test suites.

```bash
rm src/__tests__/board.spec.ts src/__tests__/fen.spec.ts
```

**Step 2: Rewrite moves.spec.ts**

Replace FenState/parseFen imports with Position and `@echecs/fen`:

```typescript
import parse from '@echecs/fen';
import { Position } from '@echecs/position';
import { describe, expect, it } from 'vitest';

import { generateMoves, move } from '../moves.js';

function fromFen(fen: string): Position {
  const parsed = parse(fen);
  if (parsed == undefined) {
    throw new Error(`Invalid FEN: ${fen}`);
  }
  return new Position(parsed.board, {
    castlingRights: parsed.castlingRights,
    enPassantSquare: parsed.enPassantSquare,
    fullmoveNumber: parsed.fullmoveNumber,
    halfmoveClock: parsed.halfmoveClock,
    turn: parsed.turn,
  });
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('generateMoves — starting position', () => {
  const position = new Position();

  it('generates 20 legal moves', () => {
    expect(generateMoves(position)).toHaveLength(20);
  });

  it('includes e2-e4', () => {
    expect(generateMoves(position)).toContainEqual({ from: 'e2', to: 'e4' });
  });

  it('includes e2-e3', () => {
    expect(generateMoves(position)).toContainEqual({ from: 'e2', to: 'e3' });
  });

  it('includes Nb1-a3', () => {
    expect(generateMoves(position)).toContainEqual({ from: 'b1', to: 'a3' });
  });
});

// ... rest of tests adapted similarly, replacing parseFen(fen) with fromFen(fen)
// ... perft function uses `move()` instead of `applyMoveToState()`
// ... isInCheck tests removed (delegated to Position.isCheck)
```

The perft function becomes:

```typescript
function perft(position: Position, depth: number): number {
  if (depth === 0) {
    return 1;
  }

  const moves = generateMoves(position);
  if (depth === 1) {
    return moves.length;
  }

  let count = 0;
  for (const m of moves) {
    count += perft(move(position, m), depth - 1);
  }

  return count;
}
```

**Step 3: Rewrite detection.spec.ts**

Replace `parseFen` with the same `fromFen` helper. Detection functions now take
`(position, moves)` instead of just `(state)`:

```typescript
import parse from '@echecs/fen';
import { Position } from '@echecs/position';
import { describe, expect, it } from 'vitest';

import {
  isCheckmate,
  isDraw,
  isStalemate,
  isThreefoldRepetition,
} from '../detection.js';
import { generateMoves } from '../moves.js';

function fromFen(fen: string): Position {
  const parsed = parse(fen);
  if (parsed == undefined) {
    throw new Error(`Invalid FEN: ${fen}`);
  }
  return new Position(parsed.board, {
    castlingRights: parsed.castlingRights,
    enPassantSquare: parsed.enPassantSquare,
    fullmoveNumber: parsed.fullmoveNumber,
    halfmoveClock: parsed.halfmoveClock,
    turn: parsed.turn,
  });
}

describe('isCheckmate', () => {
  it("detects fool's mate", () => {
    const position = fromFen(
      'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    );
    const moves = generateMoves(position);
    expect(isCheckmate(position, moves)).toBe(true);
  });

  // ... other tests adapted similarly
});
```

Note: `isInsufficientMaterial` tests should be removed (tested in
`@echecs/position`'s suite) or converted to test
`position.isInsufficientMaterial` directly in game.spec.ts.

**Step 4: Update game.spec.ts**

Minimal changes — the Game public API is unchanged. Add a test for the new
`position()` getter:

```typescript
describe('position()', () => {
  it('returns a Position instance', () => {
    const game = new Game();
    expect(game.position()).toBeInstanceOf(Position);
  });

  it('has the same turn as game.turn()', () => {
    const game = new Game();
    expect(game.position().turn).toBe(game.turn());
  });
});
```

Import `Position` from `@echecs/position` in the test file.

**Step 5: Update comparison.bench.ts**

Replace `parseFen`/`applyMoveToState`/`FenState` imports:

```typescript
import parse from '@echecs/fen';
import { Position } from '@echecs/position';
import { Chess } from 'chess.js';
import { bench, describe } from 'vitest';

import { Game } from '../game.js';
import { generateMoves, move } from '../moves.js';

function fromFen(fen: string): Position {
  // ... same helper as above
}

// Replace rawPerftState(state, depth) with rawPerft(position, depth):
function rawPerft(position: Position, depth: number): number {
  if (depth === 0) {
    return 1;
  }

  const moves = generateMoves(position);
  if (depth === 1) {
    return moves.length;
  }

  let count = 0;
  for (const m of moves) {
    count += rawPerft(move(position, m), depth - 1);
  }

  return count;
}
```

**Step 6: Commit**

```bash
git add -A src/__tests__/
git commit -m "test: update all tests for Position-based internals"
```

---

### Task 8: Lint, test, and build

**Step 1: Run lint**

```bash
pnpm lint
```

Fix any lint errors (likely import ordering, unused imports, null-related issues
from `@echecs/fen` parse returning `null`).

**Step 2: Run tests**

```bash
pnpm test
```

All 132+ tests must pass. Perft values must match exactly.

**Step 3: Run build**

```bash
pnpm build
```

Must succeed.

**Step 4: Commit any lint fixes**

```bash
git add -A && git commit -m "style: lint fixes for Position integration"
```

---

### Task 9: Update AGENTS.md and documentation

**Files:**

- Modify: `AGENTS.md`

**Step 1: Update AGENTS.md**

Key changes:

- Update the key source files table (remove board.ts, types.ts, fen.ts)
- Add `@echecs/position` and `@echecs/fen` to dependencies section
- Update Architecture Notes to reflect Position as internal state
- Update FenState section → Position
- Remove `FenState` references
- Update Game class private fields table

**Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for Position integration"
```

---

### Task 10: Version bump

**Step 1: Bump minor version**

```bash
npm version minor --no-git-tag-version
```

This bumps to 1.2.0.

**Step 2: Update CHANGELOG.md**

Add entry under `## [1.2.0] - YYYY-MM-DD`:

```markdown
### Added

- `game.position()` getter returning the current `Position` from
  `@echecs/position`.

### Changed

- Internal state replaced with `Position` from `@echecs/position`.
- FEN parsing and serialization now delegates to `@echecs/fen`.
- Types (`Color`, `Piece`, `Move`, `Square`, `CastlingRights`, `PieceType`,
  `PromotionPieceType`) are now re-exported from `@echecs/position`.
- Threefold repetition detection uses Zobrist hashes instead of FEN strings.
- `@echecs/position` and `@echecs/fen` are now runtime dependencies.
```

**Step 3: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "release: @echecs/game@1.2.0"
```
