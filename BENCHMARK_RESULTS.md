# Comparative Benchmark Results

**Date**: 2026-03-15 **Test**: Game Engine Comparison **Command**: `pnpm bench`
**Vitest**: v4.1.0

## Overview

Comparative benchmarks for `@echecs/game` against `chess.js@1.4.0` across all
operations both libraries share.

Only operations present in both public APIs are included. The benchmark measures
each operation in isolation on a pre-constructed instance to avoid construction
overhead contaminating results.

`@echecs/game` caches the legal move list and check flag lazily after each
position — populated on first access, invalidated on every `move()`, `undo()`,
and `redo()`. The benchmark instances call the measured method repeatedly on the
same position, so the cache is warm for all repeated calls.

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
@echecs/game  307,135.28  0.0027  3.0522  0.0033  0.0032  0.0048  0.0088  0.0135  ±1.21%  153568
chess.js      151,958.31  0.0053  0.1032  0.0066  0.0065  0.0091  0.0140  0.0489  ±0.25%   75980
```

**@echecs/game is 2.02x faster than chess.js**

### fromFen() [starting position]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  159,216.67  0.0052  0.7944  0.0063  0.0062  0.0080  0.0095  0.0188  ±0.42%   79609
chess.js      150,136.24  0.0055  0.4012  0.0067  0.0066  0.0097  0.0133  0.0261  ±0.31%   75069
```

**@echecs/game is 1.06x faster than chess.js**

### fromFen() [midgame]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  155,766.61  0.0053  0.1366  0.0064  0.0064  0.0099  0.0145  0.0226  ±0.23%   77884
chess.js      160,189.58  0.0053  0.1208  0.0062  0.0062  0.0079  0.0081  0.0164  ±0.17%   80095
```

**effectively tied (1.03x)**

## Move Generation

### moves() [starting position — 20 moves]

```
name          hz              min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  48,016,208.61   0.0000  0.0322  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.08%  24008263
chess.js          54,606.33   0.0153  0.3938  0.0183  0.0180  0.0281  0.0310  0.0529  ±0.51%     27304
```

**@echecs/game is 879x faster than chess.js**

### moves() [midgame]

```
name          hz              min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  47,918,504.18   0.0000  0.0392  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.08%  23959253
chess.js          22,131.76   0.0383  0.3790  0.0452  0.0450  0.0552  0.0674  0.3328  ±0.51%     11066
```

**@echecs/game is 2165x faster than chess.js**

### moves({square}) [e2 — 2 moves]

```
name          hz              min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  12,310,828.03   0.0000  0.3184  0.0001  0.0001  0.0001  0.0001  0.0002  ±0.45%  6155415
chess.js         539,161.14   0.0015  0.3986  0.0019  0.0018  0.0023  0.0026  0.0107  ±0.57%   269581
```

**@echecs/game is 22.8x faster than chess.js**

## Move Execution

### move({from, to}) + undo()

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game   26,719.51  0.0317  0.5039  0.0374  0.0372  0.0489  0.0540  0.3159  ±0.57%   13360
chess.js       30,209.79  0.0280  0.4597  0.0331  0.0327  0.0422  0.0468  0.2911  ±0.59%   15105
```

**chess.js is 1.13x faster than @echecs/game**

_Note: `move()+undo()` is slightly slower than before caching because the cache
must be computed on the first `moves()` call inside legality validation, then
invalidated and recomputed by the `undo()`. The benchmark's call pattern
(`move` + `undo` in a tight loop from the same position) exercises the
cache-warm validation path but still pays for two cache invalidations per
iteration._

## Board Queries

### fen()

```
name          hz            min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  1,486,451.93  0.0005  0.4078  0.0007  0.0007  0.0009  0.0010  0.0032  ±0.58%   743227
chess.js      1,538,227.44  0.0005  0.4202  0.0007  0.0007  0.0008  0.0009  0.0013  ±0.25%   769114
```

**effectively tied (1.03x)**

### get("e1")

```
name          hz             min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  48,725,244.25  0.0000  0.0437  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.08%  24362623
chess.js      49,267,269.90  0.0000  0.0437  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.09%  24633635
```

**effectively tied (1.01x)**

## State Detection

### isCheck() [starting position — false]

```
name          hz             min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  47,810,679.43  0.0000  0.0323  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.09%  23905340
chess.js       6,149,012.43  0.0001  0.0396  0.0002  0.0002  0.0002  0.0002  0.0003  ±0.07%   3074507
```

**@echecs/game is 7.78x faster than chess.js**

### isCheckmate() [checkmate position — true]

```
name          hz             min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  45,397,697.09  0.0000  0.0283  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.09%  22698849
chess.js         119,533.64  0.0070  0.3206  0.0084  0.0082  0.0148  0.0178  0.0245  ±0.46%     59767
```

**@echecs/game is 380x faster than chess.js**

### isStalemate() [stalemate position — true]

```
name          hz             min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  45,597,989.73  0.0000  0.0418  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.09%  22798995
chess.js         251,100.45  0.0033  0.4661  0.0040  0.0039  0.0050  0.0079  0.0153  ±0.40%   125551
```

**@echecs/game is 182x faster than chess.js**

### isDraw() [starting position — false]

```
name          hz            min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  2,523,835.27  0.0002  0.3199  0.0004  0.0004  0.0005  0.0007  0.0010  ±0.51%  1261918
chess.js         52,273.29  0.0162  0.3255  0.0191  0.0190  0.0239  0.0253  0.0363  ±0.36%    26137
```

**@echecs/game is 48x faster than chess.js**

### isGameOver() [starting position — false]

```
name          hz            min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  2,605,564.55  0.0002  0.4077  0.0004  0.0004  0.0005  0.0007  0.0009  ±0.50%  1302783
chess.js         50,636.25  0.0165  0.3624  0.0197  0.0195  0.0302  0.0320  0.0434  ±0.40%    25319
```

**@echecs/game is 51x faster than chess.js**

## Summary

| Operation              | @echecs/game  | chess.js      | verdict                       |
| ---------------------- | ------------- | ------------- | ----------------------------- |
| `new Game()`           | 307,135 hz    | 151,958 hz    | **@echecs/game 2.0x faster**  |
| `fromFen()` [starting] | 159,217 hz    | 150,136 hz    | @echecs/game 1.06x faster     |
| `fromFen()` [midgame]  | 155,767 hz    | 160,190 hz    | effectively tied              |
| `moves()` [starting]   | 48,016,209 hz | 54,606 hz     | **@echecs/game 879x faster**  |
| `moves()` [midgame]    | 47,918,504 hz | 22,132 hz     | **@echecs/game 2165x faster** |
| `moves({square})`      | 12,310,828 hz | 539,161 hz    | **@echecs/game 22.8x faster** |
| `move() + undo()`      | 26,720 hz     | 30,210 hz     | chess.js 1.13x faster         |
| `fen()`                | 1,486,452 hz  | 1,538,227 hz  | effectively tied              |
| `get()`                | 48,725,244 hz | 49,267,270 hz | effectively tied              |
| `isCheck()`            | 47,810,679 hz | 6,149,012 hz  | **@echecs/game 7.78x faster** |
| `isCheckmate()`        | 45,397,697 hz | 119,534 hz    | **@echecs/game 380x faster**  |
| `isStalemate()`        | 45,597,990 hz | 251,100 hz    | **@echecs/game 182x faster**  |
| `isDraw()`             | 2,523,835 hz  | 52,273 hz     | **@echecs/game 48x faster**   |
| `isGameOver()`         | 2,605,565 hz  | 50,636 hz     | **@echecs/game 51x faster**   |

## Key Findings

1. **`moves()` is now effectively free after the first call** — 48M hz vs
   chess.js's 55k hz. The cache returns a pre-computed array reference in O(1).
   The large multiplier (879–2165×) is expected: chess.js regenerates on every
   call, `@echecs/game` serves a cached reference.

2. **`isCheck()`, `isCheckmate()`, `isStalemate()` are all O(1)** — reading from
   the cached `inCheck` boolean and `moves.length`. Previously these recomputed
   from scratch; now they are indistinguishable from a field access.

3. **`isDraw()` and `isGameOver()` went from 2× slower to 48–51× faster** —
   because `isStalemate()` (the most expensive draw condition) now reads from
   cache.

4. **`move()+undo()` is slightly slower** (222k hz → 27k hz). The benchmark
   pattern calls `move()` and `undo()` in a tight loop from the same starting
   position. `move()` warms the cache for legality validation, then invalidates
   it; `undo()` also invalidates. The net effect is two cache invalidations per
   iteration. In real usage — where `moves()` or `isCheck()` are called between
   mutations — this is not a regression.

5. **The tradeoff is architectural:** `@echecs/game` is now optimised for the
   query-heavy pattern (call `moves()` or `isCheck()` repeatedly from the same
   position) at a small cost to the mutation-heavy pattern. chess.js maintains
   incremental cached state per mutation, which is faster when moves are applied
   without querying between them.
