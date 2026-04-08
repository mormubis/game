import parse, { stringify } from '@echecs/fen';
import { Position } from '@echecs/position';

import type {
  CastlingRights as FenCastlingRights,
  Color as FenColor,
  Piece as FenPiece,
  PieceType as FenPieceType,
} from '@echecs/fen';
import type {
  CastlingRights,
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

const COLOR_TO_FEN: Record<Color, FenColor> = {
  black: 'b',
  white: 'w',
};

const PIECE_TYPE_FROM_FEN: Record<FenPieceType, PieceType> = {
  b: 'bishop',
  k: 'king',
  n: 'knight',
  p: 'pawn',
  q: 'queen',
  r: 'rook',
};

const PIECE_TYPE_TO_FEN: Record<PieceType, FenPieceType> = {
  bishop: 'b',
  king: 'k',
  knight: 'n',
  pawn: 'p',
  queen: 'q',
  rook: 'r',
};

function positionFromFen(fen: string): Position | undefined {
  const parsed = parse(fen);
  if (!parsed) {
    return undefined;
  }

  const board = new Map<Square, Piece>();
  for (const [square, fenPiece] of parsed.board) {
    board.set(square, {
      color: COLOR_FROM_FEN[fenPiece.color],
      type: PIECE_TYPE_FROM_FEN[fenPiece.type],
    });
  }

  const castlingRights: CastlingRights = {
    black: {
      king: parsed.castlingRights.bK,
      queen: parsed.castlingRights.bQ,
    },
    white: {
      king: parsed.castlingRights.wK,
      queen: parsed.castlingRights.wQ,
    },
  };

  return new Position(board, {
    castlingRights,
    enPassantSquare: parsed.enPassantSquare as EnPassantSquare | undefined,
    fullmoveNumber: parsed.fullmoveNumber,
    halfmoveClock: parsed.halfmoveClock,
    turn: COLOR_FROM_FEN[parsed.turn],
  });
}

function positionToFen(position: Position): string {
  const board = new Map<Square, FenPiece>();
  for (const [square, piece] of position.pieces()) {
    board.set(square, {
      color: COLOR_TO_FEN[piece.color],
      type: PIECE_TYPE_TO_FEN[piece.type],
    });
  }

  const castlingRights: FenCastlingRights = {
    bK: position.castlingRights.black.king,
    bQ: position.castlingRights.black.queen,
    wK: position.castlingRights.white.king,
    wQ: position.castlingRights.white.queen,
  };

  return stringify({
    board,
    castlingRights,
    enPassantSquare: position.enPassantSquare,
    fullmoveNumber: position.fullmoveNumber,
    halfmoveClock: position.halfmoveClock,
    turn: COLOR_TO_FEN[position.turn],
  });
}

export { positionFromFen, positionToFen };
