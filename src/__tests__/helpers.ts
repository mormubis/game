import parse from '@echecs/fen';
import { Position } from '@echecs/position';

import type { Color as FenColor, PieceType as FenPieceType } from '@echecs/fen';
import type {
  Color,
  EnPassantSquare,
  Piece,
  PieceType,
  Square,
} from '@echecs/position';

const COLOR_FROM_FEN: Record<FenColor, Color> = {
  b: 'black',
  w: 'white',
};

const PIECE_TYPE_FROM_FEN: Record<FenPieceType, PieceType> = {
  b: 'bishop',
  k: 'king',
  n: 'knight',
  p: 'pawn',
  q: 'queen',
  r: 'rook',
};

function fromFen(fen: string): Position {
  const parsed = parse(fen);
  if (!parsed) {
    throw new Error(`Invalid FEN in test: ${fen}`);
  }

  const board = new Map<Square, Piece>();
  for (const [square, fenPiece] of parsed.board) {
    board.set(square, {
      color: COLOR_FROM_FEN[fenPiece.color],
      type: PIECE_TYPE_FROM_FEN[fenPiece.type],
    });
  }

  return new Position(board, {
    castlingRights: {
      black: {
        king: parsed.castlingRights.bK,
        queen: parsed.castlingRights.bQ,
      },
      white: {
        king: parsed.castlingRights.wK,
        queen: parsed.castlingRights.wQ,
      },
    },
    enPassantSquare: parsed.enPassantSquare as EnPassantSquare | undefined,
    fullmoveNumber: parsed.fullmoveNumber,
    halfmoveClock: parsed.halfmoveClock,
    turn: COLOR_FROM_FEN[parsed.turn],
  });
}

export { fromFen };
