# Refactor @echecs/game onto @echecs/position + @echecs/fen

**Date:** 2026-03-19 **Status:** Approved **Semver:** Minor (new
`game.position()` getter, no breaking changes)

---

## Goal

Replace all duplicated board representation, types, attack detection, and FEN
logic in `@echecs/game` with `@echecs/position` and `@echecs/fen`. The `Game`
class becomes a thin stateful wrapper — undo/redo, legal move generation, and
game-state detection — over an immutable `Position` core.

---

## New Dependencies

| Package            | Purpose                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `@echecs/position` | Types, `Position` class, `@echecs/position/internal` for 0x88 board utilities and attack tables |
| `@echecs/fen`      | `parse()`, `stringify()`, `STARTING_FEN`                                                        |

---

## Files to Delete

| File           | Replaced by                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `src/types.ts` | Types re-exported from `@echecs/position`                                                           |
| `src/board.ts` | `squareToIndex`, `indexToSquare`, `ATTACKS`, `RAYS`, `PIECE_MASKS` from `@echecs/position/internal` |
| `src/fen.ts`   | `FenState` eliminated; FEN I/O handled by `@echecs/fen`                                             |

---

## Files to Rewrite

### `src/moves.ts`

Move generation rewritten against `Position`:

- `generateMoves(position: Position, square?: Square): Move[]` — uses
  `position.piece()`, `position.pieces()`, `position.isAttacked()` for public
  queries, and `@echecs/position/internal` for 0x88 board access and attack
  tables during ray walking.
- `move(position: Position, move: Move): Position` — applies a move and returns
  a new `Position`. Constructs a new `Map<Square, Piece>` with the resulting
  board state plus updated options (castling rights, en passant, clocks).
- **Delete `isInCheck`** — use `position.isCheck` directly.
- **Delete `isSquareAttackedBy`** — use `position.isAttacked()` directly.

### `src/detection.ts`

Simplified — delegates to `Position` where possible:

- `isCheckmate(position, moves)` — `position.isCheck && moves.length === 0`.
- `isStalemate(position, moves)` — `!position.isCheck && moves.length === 0`.
- `isDraw(position, moves, positionHistory)` — stalemate OR 50-move OR
  insufficient material OR threefold repetition.
- **Delete `isInsufficientMaterial`** — use `position.isInsufficientMaterial`
  directly.
- `isThreefoldRepetition` — compares `position.hash` (Zobrist) values instead of
  FEN snapshots.

### `src/game.ts`

Internal state model changes:

| Field              | Before                              | After                                              |
| ------------------ | ----------------------------------- | -------------------------------------------------- |
| `#state`           | `FenState`                          | `Position`                                         |
| `#positionHistory` | FEN strings                         | Zobrist hash strings (`position.hash`)             |
| `HistoryEntry`     | `{ move, previousState: FenState }` | `{ move, previousPosition: Position }`             |
| `#cache`           | Unchanged                           | Unchanged (Position does not generate legal moves) |

New and changed public methods:

- **`position(): Position`** — new getter, returns the current `Position`.
- **`fromFen(fen)`** — uses `@echecs/fen` `parse()` to produce a `Position`.
- **`fen()`** — uses `@echecs/fen` `stringify()` with data from `Position`.
- **`get(square)`** — delegates to `position.piece(square)`.
- **`board()`** — built from `position.pieces()`.
- **`turn()`** — returns `position.turn`.
- **`isCheck()`** — returns `position.isCheck`.
- **`isAttacked(square, color)`** — delegates to `position.isAttacked()`.

### `src/index.ts`

Re-exports types from `@echecs/position`:

```typescript
export { Game } from './game.js';
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

---

## Public API Changes

| Method               | Change                               | Breaking? |
| -------------------- | ------------------------------------ | --------- |
| `game.position()`    | **New** — returns current `Position` | No        |
| All existing methods | Same signatures and return types     | No        |

---

## Position History and Threefold Repetition

Before: FEN string snapshots stored in `#positionHistory`.

After: `position.hash` (Zobrist, 16-char hex) stored instead. The hash encodes
turn, castling rights, en passant file, and piece placement — exactly the fields
required for threefold repetition per FIDE rules. Faster to compare and more
memory-efficient.

---

## Performance Considerations

- **Move generation hot path**: Uses `@echecs/position/internal` for direct 0x88
  board array access and attack table lookups — same raw operations as before,
  no `Map` overhead in the inner loop.
- **`move()` function**: Constructs a new `Position` per move (new `Map` +
  options). Slightly more allocation than the current clone-array approach, but
  the `Position` constructor is lightweight (Map storage + lazy Zobrist hash).
- **Threefold comparison**: Hash string equality (`===`) replaces full FEN
  string comparison — faster.

---

## Out of Scope

- **SAN support** (`@echecs/san`): Not included in this refactor. Can be added
  as a follow-up (e.g., `game.move('Nf3')` overload, SAN-based history).
- **Deprecating proxy methods**: `get()`, `isCheck()`, `isAttacked()`, `turn()`
  remain as convenience methods. No deprecation planned.
