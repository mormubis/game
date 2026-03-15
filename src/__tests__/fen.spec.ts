import { describe, expect, it } from 'vitest';

import { squareToIndex } from '../board.js';
import { STARTING_FEN, parseFen, serialiseFen } from '../fen.js';

const STARTING_STATE = parseFen(STARTING_FEN);

describe('STARTING_FEN', () => {
  it('is the standard starting position', () => {
    expect(STARTING_FEN).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
  });
});

describe('parseFen', () => {
  it('parses turn correctly', () => {
    expect(STARTING_STATE.turn).toBe('w');
  });

  it('parses castling rights', () => {
    expect(STARTING_STATE.castlingRights).toEqual({
      bK: true,
      bQ: true,
      wK: true,
      wQ: true,
    });
  });

  it('parses en passant as undefined for starting position', () => {
    expect(STARTING_STATE.enPassantSquare).toBeUndefined();
  });

  it('parses halfmove clock', () => {
    expect(STARTING_STATE.halfmoveClock).toBe(0);
  });

  it('parses fullmove number', () => {
    expect(STARTING_STATE.fullmoveNumber).toBe(1);
  });

  it('places white king on e1', () => {
    expect(STARTING_STATE.board[squareToIndex('e1')]).toEqual({
      color: 'w',
      type: 'k',
    });
  });

  it('places black pawn on e7', () => {
    expect(STARTING_STATE.board[squareToIndex('e7')]).toEqual({
      color: 'b',
      type: 'p',
    });
  });

  it('leaves e4 empty', () => {
    expect(STARTING_STATE.board[squareToIndex('e4')]).toBeUndefined();
  });

  it('throws on invalid FEN', () => {
    expect(() => parseFen('not a fen')).toThrow(Error);
  });

  it('parses black turn', () => {
    const state = parseFen(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    );
    expect(state.turn).toBe('b');
    expect(state.enPassantSquare).toBe('e3');
  });
});

describe('serialiseFen', () => {
  it('round-trips the starting position', () => {
    expect(serialiseFen(STARTING_STATE)).toBe(STARTING_FEN);
  });

  it('round-trips after 1.e4', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(serialiseFen(parseFen(fen))).toBe(fen);
  });
});
