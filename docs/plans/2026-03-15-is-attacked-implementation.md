# `isAttacked` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Add `game.isAttacked(square, color)` as a public method on `Game`,
matching the semantics of chess.js's `isAttacked`.

**Architecture:** Thin wrapper on the existing internal `isSquareAttackedBy`
function — no new logic. The internal function already has exactly the right
semantics. Add the method to `Game`, export the `Color` type (already exported),
add tests ported from chess.js, update docs and version.

**Tech Stack:** TypeScript 5.9, Vitest 4, pnpm.

---

## Context

All work in `/Users/mormubis/workspace/echecs/game/`.

### Semantics (matching chess.js `isAttacked`)

- Returns `true` if any piece of `color` attacks `square`
- `false` if no piece of `color` attacks `square`
- Attacks own pieces — `isAttacked('e1', 'w')` can be `true` even if a white
  piece is on e1 (white controls that square)
- Same square returns `false` — a piece does not attack its own square
  (`diff === 0`, `ATTACKS[119] === 0` ensures this automatically)
- No X-ray — blocked by any piece in between regardless of color
- Pinned pieces still attack — legality is irrelevant

### Key files

- `src/game.ts` — add the method here
- `src/moves.ts` — `isSquareAttackedBy` (internal, not exported) is the function
  being wrapped
- `src/__tests__/game.spec.ts` — add tests here
- `README.md` — document the new method
- `CHANGELOG.md` — document as minor feature addition
- `package.json` — bump `1.0.0` → `1.1.0`

---

## Task 1: Implement `Game.isAttacked`

**Files:**

- Modify: `src/game.ts`
- Modify: `src/moves.ts` (export `isSquareAttackedBy`)
- Test: `src/__tests__/game.spec.ts`

**Step 1: Write failing tests**

Add this describe block to the end of `src/__tests__/game.spec.ts`:

```typescript
// isAttacked tests ported from chess.js is-attacked.test.ts
// https://github.com/jhlywa/chess.js/blob/master/__tests__/is-attacked.test.ts

describe('isAttacked', () => {
  it('white pawn attacks diagonally', () => {
    const game = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('d3', 'w')).toBe(true);
    expect(game.isAttacked('f3', 'w')).toBe(true);
  });

  it('white pawn does not attack forward squares', () => {
    const game = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('e3', 'w')).toBe(false);
    expect(game.isAttacked('e4', 'w')).toBe(false);
  });

  it('black pawn attacks diagonally', () => {
    const game = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('f6', 'b')).toBe(true);
    expect(game.isAttacked('d6', 'b')).toBe(true);
  });

  it('black pawn does not attack forward squares', () => {
    const game = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('e6', 'b')).toBe(false);
    expect(game.isAttacked('e5', 'b')).toBe(false);
  });

  it('knight attacks', () => {
    const game = Game.fromFen('4k3/4p3/8/8/4N3/8/8/4K3 w - - 0 1');
    const attacked = ['d2', 'f2', 'c3', 'g3', 'd6', 'f6', 'c5', 'g5'] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'w')).toBe(true);
    }
    expect(game.isAttacked('e4', 'w')).toBe(false); // same square
  });

  it('bishop attacks along diagonals', () => {
    const game = Game.fromFen('4k3/4p3/8/8/4b3/8/8/4K3 w - - 0 1');
    const attacked = [
      'b1',
      'c2',
      'd3',
      'f5',
      'g6',
      'h7',
      'a8',
      'b7',
      'c6',
      'd5',
      'f3',
      'g2',
      'h1',
    ] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'b')).toBe(true);
    }
    expect(game.isAttacked('e4', 'b')).toBe(false); // same square
  });

  it('rook attacks along ranks and files (including own pieces)', () => {
    const game = Game.fromFen('4k3/4n3/8/8/8/4R3/8/4K3 w - - 0 1');
    const attacked = [
      'e1',
      'e2',
      'e4',
      'e5',
      'e6',
      'e7',
      'a3',
      'b3',
      'c3',
      'd3',
      'f3',
      'g3',
      'h3',
    ] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'w')).toBe(true);
    }
    expect(game.isAttacked('e3', 'w')).toBe(false); // same square
  });

  it('rook does not x-ray through pieces', () => {
    // Black knight on e7 blocks the rook on e3 from attacking e8
    const game = Game.fromFen('4k3/4n3/8/8/8/4R3/8/4K3 w - - 0 1');
    expect(game.isAttacked('e8', 'w')).toBe(false);
  });

  it('queen attacks in all directions', () => {
    const game = Game.fromFen('4k3/4n3/8/8/8/4q3/4P3/4K3 w - - 0 1');
    const attacked = [
      'e2',
      'e4',
      'e5',
      'e6',
      'e7',
      'a3',
      'b3',
      'c3',
      'd3',
      'f3',
      'g3',
      'h3',
      'c1',
      'd2',
      'f4',
      'g5',
      'h6',
      'g1',
      'f2',
      'd4',
      'c5',
      'b6',
      'a7',
    ] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'b')).toBe(true);
    }
    expect(game.isAttacked('e3', 'b')).toBe(false); // same square
  });

  it('king attacks adjacent squares (including own pieces)', () => {
    const game = Game.fromFen('4k3/4n3/8/8/8/4q3/4P3/4K3 w - - 0 1');
    const attacked = ['e2', 'd1', 'd2', 'f1', 'f2'] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'w')).toBe(true);
    }
    expect(game.isAttacked('e1', 'w')).toBe(false); // same square
  });

  it('pinned piece still attacks', () => {
    // White pawn on e2 is pinned by black rook on e7, but still attacks d3/f3
    const game = Game.fromFen('4k3/4r3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('d3', 'w')).toBe(true);
    expect(game.isAttacked('f3', 'w')).toBe(true);
  });

  it('doc test examples from chess.js', () => {
    const game = new Game();
    expect(game.isAttacked('f3', 'w')).toBe(true);
    expect(game.isAttacked('f6', 'b')).toBe(true);
    expect(game.isAttacked('e2', 'w')).toBe(true);
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm test src/__tests__/game.spec.ts -- --reporter=verbose -t "isAttacked"
```

Run from: `/Users/mormubis/workspace/echecs/game/`

Expected: FAIL — `game.isAttacked is not a function`

**Step 3: Export `isSquareAttackedBy` from `src/moves.ts`**

Find the line:

```typescript
function isSquareAttackedBy(
```

Change `function` to `export function`:

```typescript
export function isSquareAttackedBy(
```

**Step 4: Add `isAttacked` to `src/game.ts`**

First add `isSquareAttackedBy` to the import from `./moves.js`:

```typescript
import {
  applyMoveToState,
  generateMoves,
  isInCheck,
  isSquareAttackedBy,
} from './moves.js';
```

Then add the method to `Game`. Place it after `isCheck()` (alphabetical order is
not required by ESLint for class methods, but grouping with detection methods is
logical):

```typescript
isAttacked(square: Square, color: Color): boolean {
  return isSquareAttackedBy(this.#state.board, squareToIndex(square), color);
}
```

**Step 5: Run tests to confirm they pass**

```bash
pnpm test src/__tests__/game.spec.ts -- --reporter=verbose -t "isAttacked"
```

Expected: all `isAttacked` tests pass.

**Step 6: Run full suite**

```bash
pnpm test
```

Expected: all 120+ tests pass.

**Step 7: Run lint**

```bash
pnpm lint
```

Expected: zero errors. Note: `isSquareAttackedBy` now has `export` — ensure it
still has an explicit return type (it should already).

**Step 8: Commit**

```bash
git -C /Users/mormubis/workspace/echecs/game add src/game.ts src/moves.ts src/__tests__/game.spec.ts
git -C /Users/mormubis/workspace/echecs/game commit -m "feat: add Game.isAttacked(square, color)"
```

---

## Task 2: Update docs and version

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

**Step 1: Add `isAttacked` to `README.md`**

Find the `### State detection` section. Add after `isCheck()`:

````markdown
#### `game.isAttacked(square, color)`

Returns `true` if any piece of `color` attacks `square`. The square does not
need to be empty — it may contain a piece of either color. A piece does not
attack its own square.

```typescript
const game = new Game();
game.isAttacked('f3', 'w'); // true — white pawn on g2 attacks f3
game.isAttacked('f6', 'b'); // true — black pawn on g7 attacks f6
```
````

Pinned pieces still count as attacking. There is no X-ray — a piece blocked by
another piece does not attack through it.

````

**Step 2: Add entry to `CHANGELOG.md`**

Add under `## [Unreleased]`:

```markdown
## [1.1.0] - 2026-03-15

### Added

- `Game.isAttacked(square, color)` — returns `true` if any piece of `color`
  attacks `square`. Matches the semantics of chess.js's `isAttacked`: pinned
  pieces still attack, own pieces count as attacked squares, no X-ray, same
  square returns `false`.
````

**Step 3: Bump version in `package.json`**

```json
"version": "1.1.0"
```

**Step 4: Run format check**

```bash
pnpm format
```

**Step 5: Commit and push**

```bash
git -C /Users/mormubis/workspace/echecs/game add README.md CHANGELOG.md package.json
git -C /Users/mormubis/workspace/echecs/game commit -m "chore: bump to 1.1.0, document isAttacked"
git -C /Users/mormubis/workspace/echecs/game push
```

---

## Final verification

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: all pass. 130+ tests, zero lint errors, clean build.
