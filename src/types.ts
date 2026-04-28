import type { Piece, Square } from '@echecs/position';

interface MoveResult {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: {
    square: Square;
    piece: Piece;
  };
  promotion?: Piece;
  castling?: {
    from: Square;
    to: Square;
    piece: Piece;
  };
}

export type { MoveResult };
