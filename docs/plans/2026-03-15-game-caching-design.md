# `@echecs/game` Caching Design

**Date:** 2026-03-15
**Status:** Approved

---

## Problem

Benchmarks against `chess.js@1.4.0` revealed three performance gaps caused by
recomputing from scratch on every call:

| Operation          | @echecs/game | chess.js  | gap         |
| ------------------ | ------------ | --------- | ----------- |
| `isCheck()`        | 634k hz      | 6,116k hz | 9.6× slower |
| `moves()` starting | 29k hz       | 56k hz    | 2.0× slower |
| `moves()` midgame  | 10k hz       | 23k hz    | 2.3× slower |
| `isDraw()`         | 25k hz       | 51k hz    | 2.0× slower |
| `isGameOver()`     | 25k hz       | 51k hz    | 2.1× slower |

chess.js maintains incremental cached state after each mutation. `@echecs/game`
recomputes attack detection and legal move generation on every call.

---

## Decision

Cache **both** the legal move list and the check flag inside the `Game` class.
The check flag is free to capture at the same time as move generation, so there
is no reason to do them separately.

---

## Approach

**Option A — cache inside `Game` class** (chosen).

Cache lives in `Game` as a single private field. Pure functions in `moves.ts`
and `detection.ts` are untouched. Only `game.ts` changes.

Rejected alternatives:

- **Cache inside `FenState`** — mixes data and behaviour; all intermediate
  perft states would allocate a cache object unnecessarily.
- **Memoise by FEN key** — FEN serialisation on every call negates the gain;
  unbounded map growth.

---

## Design

### Cache field

```typescript
#cache: { inCheck: boolean; moves: Move[] } | undefined = undefined;
```

### Population — lazy private getter

```typescript
get #cachedState(): { inCheck: boolean; moves: Move[] } {
  if (this.#cache === undefined) {
    this.#cache = {
      inCheck: isInCheck(this.#state, this.#state.turn),
      moves: generateMoves(this.#state),
    };
  }
  return this.#cache;
}
```

`generateMoves` and `isInCheck` are called once per position, on first access.

### Invalidation

`#cache = undefined` at the start of `move()`, `undo()`, and `redo()` — before
the state changes. Any mutation clears the cache.

### Public methods

```typescript
isCheck(): boolean {
  return this.#cachedState.inCheck;
}

isCheckmate(): boolean {
  return this.#cachedState.inCheck && this.#cachedState.moves.length === 0;
}

isStalemate(): boolean {
  return !this.#cachedState.inCheck && this.#cachedState.moves.length === 0;
}

moves(square?: Square): Move[] {
  if (square === undefined) {
    return this.#cachedState.moves;
  }
  return this.#cachedState.moves.filter((m) => m.from === square);
}
```

`moves(square)` now filters the already-computed full move list rather than
calling `generateMoves` with a square argument — cheaper and consistent.

`isDraw()` and `isGameOver()` call `isStalemate()` internally, so they benefit
automatically without changes.

---

## Unchanged

- `src/moves.ts` — pure functions, untouched
- `src/detection.ts` — untouched
- `src/fen.ts`, `src/board.ts`, `src/types.ts` — untouched
- Public API surface — no visible changes to callers

---

## Testing

No new tests needed. The existing 89 tests cover all affected methods and serve
as the correctness gate. All must pass unchanged after the refactor.

One behaviour change worth noting: `moves(square)` previously called
`generateMoves(state, square)` directly; it now filters from the full cached
list. The results are identical by definition (same legal moves, order not
guaranteed by spec).

---

## Expected benchmark impact

| Operation          | Before  | Expected after                         |
| ------------------ | ------- | -------------------------------------- |
| `isCheck()`        | 634k hz | ~6M+ hz (reads a boolean)              |
| `moves()` starting | 29k hz  | ~55k+ hz                               |
| `moves()` midgame  | 10k hz  | ~23k+ hz                               |
| `isCheckmate()`    | 81k hz  | ~120k+ hz                              |
| `isDraw()`         | 25k hz  | ~50k+ hz                               |
| `isGameOver()`     | 25k hz  | ~50k+ hz                               |
| `move()+undo()`    | 222k hz | negligible regression (one assignment) |

After implementation, run `pnpm bench` and update `BENCHMARK_RESULTS.md`.
