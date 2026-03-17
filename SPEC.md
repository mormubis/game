# Specification: Chess Rules

Implements standard chess rules as defined in the
[FIDE Laws of Chess](https://handbook.fide.com/chapter/E012023)
(effective January 2023).

---

## Piece Movement

### Pawn
- Moves one square forward (toward opponent's back rank).
- Initial double push: may move two squares forward from starting rank (rank 2 for white, rank 7 for black).
- Captures diagonally one square forward.
- **En passant**: may capture a pawn that just made a double push, moving to the square behind it.
- **Promotion**: upon reaching the back rank, must promote to queen, rook, bishop, or knight.

### Knight
- Moves in an L-shape: two squares in one direction, one square perpendicular.
- Only piece that can jump over other pieces.
- 8 possible destinations (some off-board at edges).

### Bishop
- Moves any number of squares diagonally.
- Blocked by intervening pieces.

### Rook
- Moves any number of squares horizontally or vertically.
- Blocked by intervening pieces.

### Queen
- Combines bishop and rook movement.

### King
- Moves one square in any direction.
- May not move to an attacked square.
- **Castling**: see below.

---

## Castling

Conditions (must all be met):

1. Neither the king nor the rook involved has previously moved.
2. No pieces stand between the king and the rook.
3. The king is not in check, does not pass through an attacked square, and does not land on an attacked square.

| Type | King moves | Rook moves |
|------|-----------|------------|
| Kingside (short) | e1→g1 (white) / e8→g8 (black) | h1→f1 / h8→f8 |
| Queenside (long) | e1→c1 (white) / e8→c8 (black) | a1→d1 / a8→d8 |

---

## En Passant

Available only on the move immediately following a double pawn push.
The capturing pawn moves diagonally to the square behind the just-moved pawn,
and the just-moved pawn is removed.

---

## Check and Checkmate

- **Check**: the king is attacked by at least one opponent piece.
- **Checkmate**: the king is in check and no legal move escapes check. The side in checkmate loses.
- A player may not make a move that leaves their own king in check.

---

## Draw Conditions

| Condition | Rule |
|-----------|------|
| Stalemate | Side to move has no legal moves and is not in check |
| Fifty-move rule | 50 consecutive moves by both sides without a pawn move or capture |
| Threefold repetition | Same position occurs three times (same player to move, same castling rights, same en passant target) |
| Insufficient material | Neither side has enough material to checkmate |
| Agreement | Both players agree to a draw |

### Insufficient Material

Draw is declared when neither side can deliver checkmate with any sequence of legal moves:
- King vs King
- King + Bishop vs King
- King + Knight vs King
- King + Bishop vs King + Bishop (same colored squares)

---

## Implementation Notes

- Uses 0x88 board representation internally (see `@echecs/position` SPEC.md)
- `Game` class is mutable — maintains undo/redo stacks
- `game.moves()` generates only fully legal moves (pseudo-legal candidates filtered by check detection)
- `isInsufficientMaterial()` covers the FIDE-defined cases listed above
- FEN strings accepted as constructor argument: `new Game(fen)`
- No SAN support — moves are specified as `{ from, to, promotion? }` objects

## Sources

- [FIDE Laws of Chess](https://handbook.fide.com/chapter/E012023)
- [Chess Programming Wiki — Perft](https://www.chessprogramming.org/Perft_Results)
