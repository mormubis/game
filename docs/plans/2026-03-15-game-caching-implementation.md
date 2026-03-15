# Game Caching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Cache legal moves and check flag inside `Game` to eliminate redundant
recomputation and close the performance gap vs chess.js.

**Architecture:** Add a single `#cache` private field to `Game` holding
`{ inCheck: boolean; moves: Move[] } | undefined`. A lazy private getter
populates it on first access; `move()`, `undo()`, and `redo()` invalidate it by
setting it to `undefined`. Pure functions in `moves.ts` and `detection.ts` are
untouched.

**Tech Stack:** TypeScript 5.9, Vitest 4, pnpm.

---

## Context

All work is in `/Users/mormubis/workspace/echecs/game/`.

The only file that changes is `src/game.ts`. The existing 89 tests are the
correctness gate — they must all pass after the change. No new source files.

Current `src/game.ts` content for reference — read it before starting:
`/Users/mormubis/workspace/echecs/game/src/game.ts`

---

## Task 1: Implement caching in `Game`

**Files:**

- Modify: `src/game.ts`

**Step 1: Add cache field and private getter**

Read `src/game.ts` first to understand the current structure. Then make the
following changes:

1. Add the cache field after the existing private fields:

```typescript
#cache: { inCheck: boolean; moves: Move[] } | undefined = undefined;
```

2. Add the private getter after the constructor (before `static fromFen`):

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

**Step 2: Invalidate on mutation**

In `move()`, add `this.#cache = undefined;` as the first line of the method body
(before any other logic).

In `undo()`, add `this.#cache = undefined;` as the first line of the method
body.

In `redo()`, add `this.#cache = undefined;` as the first line of the method
body.

Also reset the cache in `fromFen()` — add `game.#cache = undefined;` after
`game.#positionHistory = [...]`.

**Step 3: Update public methods to use the cache**

Replace the bodies of the following methods:

`isCheck()`:

```typescript
isCheck(): boolean {
  return this.#cachedState.inCheck;
}
```

`isCheckmate()`:

```typescript
isCheckmate(): boolean {
  return this.#cachedState.inCheck && this.#cachedState.moves.length === 0;
}
```

`isStalemate()`:

```typescript
isStalemate(): boolean {
  return !this.#cachedState.inCheck && this.#cachedState.moves.length === 0;
}
```

`moves()` — also changes filtering behaviour (no longer calls `generateMoves`
with a square argument; filters from full cached list instead):

```typescript
moves(square?: Square): Move[] {
  if (square === undefined) {
    return this.#cachedState.moves;
  }

  return this.#cachedState.moves.filter((m) => m.from === square);
}
```

**Step 4: Run the full test suite**

```bash
pnpm test
```

Run from: `/Users/mormubis/workspace/echecs/game/`

Expected: **89 tests pass, 0 fail.** If any test fails, the cache is being
populated or invalidated incorrectly — check that `#cache` is set to `undefined`
at the start of `move()`, `undo()`, and `redo()` before any state changes.

**Step 5: Run lint**

```bash
pnpm lint
```

Run from: `/Users/mormubis/workspace/echecs/game/`

Expected: zero errors, zero warnings.

Note: the private getter syntax (`get #cachedState()`) is valid TypeScript/JS.
If ESLint complains about `sort-keys` on the cache object literal, ensure the
keys are in alphabetical order: `inCheck` before `moves`.

**Step 6: Commit**

```bash
git -C /Users/mormubis/workspace/echecs/game add src/game.ts
git -C /Users/mormubis/workspace/echecs/game commit -m "perf: cache legal moves and check flag in Game"
```

---

## Task 2: Run benchmarks and update results

**Files:**

- Modify: `BENCHMARK_RESULTS.md`

**Step 1: Build the package**

```bash
pnpm build
```

Run from: `/Users/mormubis/workspace/echecs/game/`

Expected: compiles without errors.

**Step 2: Run the benchmark suite**

```bash
pnpm bench 2>&1
```

Run from: `/Users/mormubis/workspace/echecs/game/`

Expected improvements vs the recorded results in `BENCHMARK_RESULTS.md`:

- `isCheck()`: from ~634k hz to ~6M+ hz
- `moves()` starting: from ~29k hz to ~55k+ hz
- `moves()` midgame: from ~10k hz to ~23k+ hz
- `isCheckmate()`: from ~81k hz to ~120k+ hz
- `isDraw()`: from ~25k hz to ~51k+ hz
- `isGameOver()`: from ~25k hz to ~51k+ hz
- `move()+undo()`: slight regression (expected, acceptable)

**Step 3: Update `BENCHMARK_RESULTS.md`**

Read the current `BENCHMARK_RESULTS.md`, then overwrite it with the new
benchmark output. Follow the exact same format as the existing file:

- Date header updated to today
- Raw vitest bench output per section
- Summary table updated with new hz values and verdicts
- Key Findings section updated to reflect the new results

**Step 4: Commit**

```bash
git -C /Users/mormubis/workspace/echecs/game add BENCHMARK_RESULTS.md
git -C /Users/mormubis/workspace/echecs/game commit -m "docs: update benchmark results after caching"
```

---

## Task 3: Update AGENTS.md

**Files:**

- Modify: `AGENTS.md`

**Step 1: Update the detection section in AGENTS.md**

Read `AGENTS.md`. Find the section under "Architecture Notes > Detection
(`src/detection.ts`)" that currently says:

> All detection functions take `FenState` and recompute from scratch on every
> call — there is no caching.

Replace it to reflect the new reality: detection functions are still pure and
uncached, but `Game` now caches the results.

Updated text:

> All detection functions in `src/detection.ts` take `FenState` and remain pure
> — no caching inside them. Caching is handled by the `Game` class, which stores
> legal moves and the check flag after each position change and invalidates on
> every `move()`, `undo()`, and `redo()`. Repeated calls to `isCheck()`,
> `isCheckmate()`, `isStalemate()`, `isDraw()`, and `moves()` from the same
> position are O(1) after the first call.

Also update the `Game` class private fields table to include the new field:

Add a row:

```
| `#cache` | `{ inCheck: boolean; moves: Move[] } \| undefined` | Cached legal moves and check flag; cleared on mutation |
```

**Step 2: Run format check**

```bash
pnpm format:ci
```

Run from: `/Users/mormubis/workspace/echecs/game/`

If it fails, run `pnpm format` to fix, then re-run `pnpm format:ci`.

**Step 3: Commit**

```bash
git -C /Users/mormubis/workspace/echecs/game add AGENTS.md
git -C /Users/mormubis/workspace/echecs/game commit -m "docs: update AGENTS.md to reflect caching"
```

---

## Final verification

```bash
pnpm lint && pnpm test && pnpm build
```

Run from: `/Users/mormubis/workspace/echecs/game/`

Expected: all pass. 89 tests, zero lint errors, clean build.
