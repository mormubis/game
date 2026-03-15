import { isInsufficientMaterial, isThreefoldRepetition } from './detection.js';
import { type FenState, STARTING_FEN, parseFen, serialiseFen } from './fen.js';
import { applyMoveToState, generateMoves, isInCheck } from './moves.js';

import type { Color, Move, Piece, Square } from './types.js';

interface HistoryEntry {
  move: Move;
  previousState: FenState;
}

export class Game {
  #cache: { inCheck: boolean; moves: Move[] } | undefined = undefined;
  #future: HistoryEntry[] = [];
  #past: HistoryEntry[] = [];
  #positionHistory: string[] = [];
  #state: FenState;

  constructor() {
    this.#state = parseFen(STARTING_FEN);
    this.#positionHistory = [serialiseFen(this.#state)];
  }

  get #cachedState(): { inCheck: boolean; moves: Move[] } {
    if (this.#cache === undefined) {
      this.#cache = {
        inCheck: isInCheck(this.#state, this.#state.turn),
        moves: generateMoves(this.#state),
      };
    }

    return this.#cache;
  }

  static fromFen(fen: string): Game {
    const game = new Game();
    game.#state = parseFen(fen);
    game.#past = [];
    game.#future = [];
    game.#positionHistory = [serialiseFen(game.#state)];
    game.#cache = undefined;
    return game;
  }

  board(): (Piece | undefined)[][] {
    const result: (Piece | undefined)[][] = [];
    for (let rank = 0; rank < 8; rank++) {
      const row: (Piece | undefined)[] = [];
      for (let file = 0; file < 8; file++) {
        row.push(this.#state.board[rank * 8 + file]);
      }
      result.push(row);
    }
    return result;
  }

  fen(): string {
    return serialiseFen(this.#state);
  }

  get(square: Square): Piece | undefined {
    const file = (square.codePointAt(0) ?? 0) - ('a'.codePointAt(0) ?? 0);
    const rank = Number.parseInt(square[1] ?? '1', 10) - 1;
    return this.#state.board[rank * 8 + file];
  }

  history(): Move[] {
    return this.#past.map((entry) => entry.move);
  }

  isCheck(): boolean {
    return this.#cachedState.inCheck;
  }

  isCheckmate(): boolean {
    return this.#cachedState.inCheck && this.#cachedState.moves.length === 0;
  }

  isDraw(): boolean {
    return (
      this.#state.halfmoveClock >= 100 ||
      isInsufficientMaterial(this.#state) ||
      this.isStalemate() ||
      isThreefoldRepetition(this.#positionHistory)
    );
  }

  isGameOver(): boolean {
    return this.isCheckmate() || this.isDraw();
  }

  isStalemate(): boolean {
    return !this.#cachedState.inCheck && this.#cachedState.moves.length === 0;
  }

  move(move: Move): this {
    const legal = this.#cachedState.moves.filter((m) => m.from === move.from);
    const isLegal = legal.some(
      (m) => m.to === move.to && m.promotion === move.promotion,
    );

    if (!isLegal) {
      throw new Error(`Illegal move: ${move.from} → ${move.to}`);
    }

    this.#cache = undefined;
    const previousState = this.#state;
    this.#state = applyMoveToState(this.#state, move);
    this.#past.push({ move, previousState });
    this.#future = [];
    this.#positionHistory.push(serialiseFen(this.#state));

    return this;
  }

  moves(square?: Square): Move[] {
    if (square === undefined) {
      return this.#cachedState.moves;
    }

    return this.#cachedState.moves.filter((m) => m.from === square);
  }

  redo(): void {
    const entry = this.#future.pop();
    if (entry === undefined) {
      return;
    }

    this.#cache = undefined;
    this.#state = applyMoveToState(entry.previousState, entry.move);
    this.#past.push(entry);
    this.#positionHistory.push(serialiseFen(this.#state));
  }

  turn(): Color {
    return this.#state.turn;
  }

  undo(): void {
    const entry = this.#past.pop();
    if (entry === undefined) {
      return;
    }

    this.#cache = undefined;
    this.#state = entry.previousState;
    this.#future.push(entry);
    this.#positionHistory.pop();
  }
}
