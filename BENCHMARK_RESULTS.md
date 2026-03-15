# Comparative Benchmark Results

**Date**: 2026-03-15 **Test**: Game Engine Comparison **Command**: `pnpm bench`
**Vitest**: v4.1.0

## Overview

Comparative benchmarks for `@echecs/game` against `chess.js@1.4.0` across all
operations both libraries share, plus a raw perft benchmark that exercises move
generation without caching or FEN round-trips.

`@echecs/game` uses a 0x88 `[128]` board representation with precomputed ATTACKS
and RAYS lookup tables for attack detection. The `Game` class caches legal moves
and the check flag lazily per position.

## Fixtures

| Fixture           | FEN                                                                | Description                            |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------- |
| starting position | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`         | Standard opening position              |
| midgame           | `r1bqk2r/pp2bppp/2nppn2/8/3NP3/2N1B3/PPP1BPPP/R2QK2R w KQkq - 0 8` | Varied mid-game position               |
| checkmate         | `rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3`    | Fool's mate — white in checkmate       |
| stalemate         | `k7/8/1QK5/8/8/8/8/8 b - - 0 1`                                    | Classic stalemate — black has no moves |

## Construction

### new Game() [starting position]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  224,830.25  0.0037  0.1724  0.0044  0.0045  0.0062  0.0114  0.0244  ±0.20%  112416
chess.js      157,300.55  0.0054  2.5370  0.0064  0.0063  0.0113  0.0133  0.0374  ±1.01%   78651
```

**@echecs/game is 1.43x faster than chess.js**

### fromFen() [starting position]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  110,860.46  0.0074  3.0992  0.0090  0.0087  0.0188  0.0222  0.0340  ±1.24%   55431
chess.js      158,514.40  0.0053  0.1330  0.0063  0.0063  0.0082  0.0125  0.0216  ±0.20%   79258
```

**chess.js is 1.43x faster than @echecs/game**

_Note: The 0x88 `[128]` board allocates more memory than the flat `[64]` board,
making FEN parsing slightly slower. This is a known tradeoff for the off-board
check and ATTACKS lookup benefits._

### fromFen() [midgame]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  115,291.96  0.0074  0.1322  0.0087  0.0088  0.0111  0.0115  0.0170  ±0.15%   57646
chess.js      163,057.74  0.0052  0.1474  0.0061  0.0061  0.0104  0.0147  0.0245  ±0.24%   81529
```

**chess.js is 1.41x faster than @echecs/game**

## Move Generation

### moves() [starting position — 20 moves]

```
name          hz              min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  48,422,126.71   0.0000  0.0342  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.09%  24211065
chess.js          55,467.00   0.0153  0.3715  0.0180  0.0179  0.0225  0.0235  0.0530  ±0.44%     27734
```

**@echecs/game is 873x faster than chess.js**

### moves() [midgame]

```
name          hz              min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  48,247,595.20   0.0000  0.0401  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.07%  24123799
chess.js          22,429.54   0.0379  0.3670  0.0446  0.0440  0.0595  0.0675  0.2976  ±0.46%     11215
```

**@echecs/game is 2151x faster than chess.js**

### moves({square}) [e2 — 2 moves]

```
name          hz              min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  12,645,621.80   0.0000  0.2960  0.0001  0.0001  0.0001  0.0001  0.0002  ±0.38%  6322811
chess.js         557,349.21   0.0015  0.3125  0.0018  0.0018  0.0023  0.0023  0.0026  ±0.40%   278675
```

**@echecs/game is 22.7x faster than chess.js**

## Move Execution

### move({from, to}) + undo()

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game   25,218.25  0.0337  0.4728  0.0397  0.0402  0.0509  0.0553  0.0722  ±0.38%   12610
chess.js       30,533.02  0.0279  0.4101  0.0328  0.0322  0.0455  0.0514  0.2673  ±0.55%   15267
```

**chess.js is 1.21x faster than @echecs/game**

_Note: `move()+undo()` is slower because `applyMoveToState` allocates a new
`FenState` with a cloned `[128]` board on every call. chess.js's `_makeMove`/
`_undoMove` mutates a single board in place. In real usage, the cache means
`moves()` and `isCheck()` calls between mutations are essentially free._

## Board Queries

### fen()

```
name          hz            min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  1,557,641.61  0.0005  0.3395  0.0006  0.0006  0.0008  0.0010  0.0012  ±0.45%   778821
chess.js      1,572,778.37  0.0005  0.4135  0.0006  0.0006  0.0008  0.0010  0.0013  ±0.52%   786390
```

**effectively tied (1.01x)**

### get("e1")

```
name          hz             min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  44,011,981.21  0.0000  0.0548  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.09%  22005991
chess.js      49,685,195.32  0.0000  0.0421  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.09%  24842599
```

**effectively tied (1.13x)**

## State Detection

### isCheck() [starting position — false]

```
name          hz             min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  47,936,739.52  0.0000  0.0401  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.08%  23968370
chess.js       6,027,119.49  0.0001  0.0343  0.0002  0.0002  0.0002  0.0002  0.0003  ±0.07%   3013560
```

**@echecs/game is 7.95x faster than chess.js**

### isCheckmate() [checkmate position — true]

```
name          hz             min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  45,751,217.36  0.0000  0.0235  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.09%  22875609
chess.js         119,372.07  0.0070  0.3057  0.0084  0.0082  0.0133  0.0167  0.0249  ±0.45%     59687
```

**@echecs/game is 383x faster than chess.js**

### isStalemate() [stalemate position — true]

```
name          hz             min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  45,911,204.81  0.0000  0.0265  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.07%  22955603
chess.js         249,009.86  0.0031  30.302  0.0040  0.0036  0.0099  0.0108  0.0150  ±11.88%  124505
```

**@echecs/game is 184x faster than chess.js**

### isDraw() [starting position — false]

```
name          hz            min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  2,273,407.22  0.0003  0.1836  0.0004  0.0005  0.0006  0.0007  0.0009  ±0.21%  1136704
chess.js         51,206.14  0.0164  5.1587  0.0195  0.0189  0.0283  0.0287  0.0350  ±2.03%    25604
```

**@echecs/game is 44x faster than chess.js**

### isGameOver() [starting position — false]

```
name          hz            min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  2,237,893.90  0.0003  0.2134  0.0004  0.0005  0.0006  0.0007  0.0010  ±0.27%  1118947
chess.js          50,250.49  0.0168  0.2242  0.0199  0.0196  0.0302  0.0328  0.0450  ±0.44%    25126
```

**@echecs/game is 45x faster than chess.js**

## Raw Perft (no cache, no FEN round-trips)

This benchmark exercises pure move generation — `applyMoveToState` passing
`FenState` objects directly, no caching, no FEN serialisation. It is the closest
fair comparison to chess.js's native `perft()` method which uses
`_makeMove`/`_undoMove` on a single mutable board.

### raw perft(3) [no cache, no FEN round-trips — pure move generation]

```
name                 hz       min      max      mean     p75      p99      p995     p999     rme     samples
@echecs/game         56.7393  17.3623  17.9910  17.6245  17.7795  17.9910  17.9910  17.9910  ±0.38%       29
chess.js native      120.94    7.9528   8.7315   8.2682   8.4028   8.7315   8.7315   8.7315  ±0.64%       61
```

**chess.js native perft is 2.13x faster than @echecs/game**

The remaining gap is explained by allocation strategy: `applyMoveToState`
creates a new `FenState` with a cloned `[128]` board array on every call — 8,902
allocations at depth 3. chess.js's native `perft()` uses `_makeMove`/`_undoMove`
which mutate a single board in place and push/pop an undo stack — zero
allocations per move. This is a known tradeoff: our immutable `applyMoveToState`
is simpler and safer for the public API, but pays an allocation cost that a
mutating approach avoids.

## Summary

| Operation              | @echecs/game  | chess.js      | verdict                       |
| ---------------------- | ------------- | ------------- | ----------------------------- |
| `new Game()`           | 224,830 hz    | 157,301 hz    | **@echecs/game 1.43x faster** |
| `fromFen()` [starting] | 110,860 hz    | 158,514 hz    | chess.js 1.43x faster         |
| `fromFen()` [midgame]  | 115,292 hz    | 163,058 hz    | chess.js 1.41x faster         |
| `moves()` [starting]   | 48,422,127 hz | 55,467 hz     | **@echecs/game 873x faster**  |
| `moves()` [midgame]    | 48,247,595 hz | 22,430 hz     | **@echecs/game 2151x faster** |
| `moves({square})`      | 12,645,622 hz | 557,349 hz    | **@echecs/game 22.7x faster** |
| `move() + undo()`      | 25,218 hz     | 30,533 hz     | chess.js 1.21x faster         |
| `fen()`                | 1,557,642 hz  | 1,572,778 hz  | effectively tied              |
| `get()`                | 44,011,981 hz | 49,685,195 hz | effectively tied              |
| `isCheck()`            | 47,936,740 hz | 6,027,119 hz  | **@echecs/game 7.95x faster** |
| `isCheckmate()`        | 45,751,217 hz | 119,372 hz    | **@echecs/game 383x faster**  |
| `isStalemate()`        | 45,911,205 hz | 249,010 hz    | **@echecs/game 184x faster**  |
| `isDraw()`             | 2,273,407 hz  | 51,206 hz     | **@echecs/game 44x faster**   |
| `isGameOver()`         | 2,237,894 hz  | 50,250 hz     | **@echecs/game 45x faster**   |
| raw perft(3)           | 56.7 hz       | 120.9 hz      | chess.js 2.13x faster         |

## Key Findings

1. **`moves()`, `isCheck()`, and all detection methods are dominated by
   caching.** The `Game` class lazily computes and caches the legal move list
   and check flag per position. Repeated calls from the same position are O(1)
   array/boolean reads — hence the 44–2151× advantages over chess.js which
   recomputes some of these on every call.

2. **`fromFen()` regressed slightly** (1.43× slower than chess.js). The 0x88
   `[128]` board allocates 2× more slots than the previous flat `[64]` board,
   making FEN parsing marginally more expensive. This is the main tradeoff of
   the 0x88 migration.

3. **Raw perft(3): chess.js is 2.13× faster.** The root cause is allocation
   strategy. `applyMoveToState` clones a `[128]` array on every call; chess.js
   mutates in place. The 0x88 ATTACKS lookup table speeds up
   `isSquareAttackedBy` (the hot path inside legality filtering), but the gain
   is offset by allocation cost. A mutating `makeMove`/`undoMove` approach would
   close this gap but would fundamentally change the architecture.

4. **`move()+undo()` also regressed slightly** (1.21× slower). Same root cause:
   each `move()` clones the board. In real usage where `moves()` or `isCheck()`
   are called between mutations, the cache dominates and the overall pattern is
   faster than chess.js.

5. **The architectural tradeoff is clear:** `@echecs/game` is optimised for the
   query-heavy pattern (many calls to `moves()`, `isCheck()`, `isDraw()` from a
   position, few mutations). chess.js is optimised for the mutation-heavy
   pattern (many `move()`/`undo()` calls with incremental state updates). Which
   is faster in practice depends on the calling code.
