export type Team = 'red' | 'blue';
export type Role = 'spymaster' | 'guesser';
export type CardKind = Team | 'neutral' | 'assassin';

export type Seat = {
  id: string;
  name: string;
  team: Team | null;
  role: Role;
  connected: boolean;
};

export type Card = { word: string; kind: CardKind; revealed: boolean };
export type BoardCard = Omit<Card, 'kind'> & { kind: CardKind | null };

export type Game = {
  board: Card[];
  turn: Team;
  phase: 'clue' | 'guess' | 'finished';
  clue: { word: string; count: number } | null;
  guessesRemaining: number;
  turnNumber: number;
  winner: Team | null;
  lastGuess: { index: number; kind: CardKind; team: Team } | null;
};

export type Action =
  | { type: 'clue'; word: string; count: number }
  | { type: 'guess'; index: number }
  | { type: 'pass' };

export const otherTeam = (team: Team): Team => team === 'red' ? 'blue' : 'red';

function shuffled<T>(input: readonly T[], rng: () => number): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createGame(words: readonly string[], rng = Math.random): Game {
  const unique = [...new Set(words.map(word => word.trim().toLowerCase()).filter(Boolean))];
  if (unique.length < 25) throw new RangeError('Codewords needs at least 25 unique words.');
  const turn: Team = rng() < 0.5 ? 'red' : 'blue';
  const kinds = shuffled<CardKind>([
    ...Array<CardKind>(9).fill(turn),
    ...Array<CardKind>(8).fill(otherTeam(turn)),
    ...Array<CardKind>(7).fill('neutral'),
    'assassin',
  ], rng);
  return {
    board: shuffled(unique, rng).slice(0, 25).map((word, i) => ({ word, kind: kinds[i], revealed: false })),
    turn,
    phase: 'clue',
    clue: null,
    guessesRemaining: 0,
    turnNumber: 1,
    winner: null,
    lastGuess: null,
  };
}

export function getBoardView(game: Game, showKey = false): BoardCard[] {
  return game.board.map(({ word, kind, revealed }) => ({
    word, revealed, kind: showKey || revealed || game.phase === 'finished' ? kind : null,
  }));
}

export function getRemaining(game: Game): Record<Team, number> {
  const remaining = { red: 0, blue: 0 };
  for (const card of game.board) {
    if (!card.revealed && (card.kind === 'red' || card.kind === 'blue')) remaining[card.kind]++;
  }
  return remaining;
}

export function assignSeat(seats: readonly Seat[], seatId: string, team: Team | null, role: Role): Seat[] | null {
  if (!seats.some(seat => seat.id === seatId && seat.connected)) return null;
  if (team !== null && team !== 'red' && team !== 'blue') return null;
  if (role !== 'guesser' && role !== 'spymaster') return null;
  if (role === 'spymaster' && (!team || seats.some(seat => seat.id !== seatId && seat.team === team && seat.role === 'spymaster'))) return null;
  return seats.map(seat => seat.id === seatId ? { ...seat, team, role } : seat);
}

export function canStart(seats: readonly Seat[]): boolean {
  return (['red', 'blue'] as const).every(team => {
    const active = seats.filter(seat => seat.team === team && seat.connected);
    return active.filter(seat => seat.role === 'spymaster').length === 1 && active.some(seat => seat.role === 'guesser');
  });
}

export function clueError(board: readonly BoardCard[], word: unknown, count: unknown): string | null {
  if (typeof word !== 'string' || !/^\p{L}[\p{L}\p{M}]{0,23}$/u.test(word.trim())) {
    return 'Use one word with no spaces, numbers or punctuation.';
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 9) {
    return 'Choose a number from 1 to 9.';
  }
  const canonical = (value: string) => value.normalize('NFC').toLowerCase();
  if (board.some(card => !card.revealed && canonical(card.word) === canonical(word.trim()))) {
    return 'Your clue cannot be an unrevealed word on the board.';
  }
  return null;
}

function advance(game: Game): Game {
  return { ...game, turn: otherTeam(game.turn), phase: 'clue', clue: null, guessesRemaining: 0, turnNumber: game.turnNumber + 1 };
}

function finish(game: Game, winner: Team): Game {
  return { ...game, phase: 'finished', winner, guessesRemaining: 0 };
}

export function applyAction(game: Game, seat: Seat, action: Action): Game | null {
  if (!seat.connected || seat.team !== game.turn || game.phase === 'finished' || !action) return null;
  if (action.type === 'clue') {
    if (game.phase !== 'clue' || seat.role !== 'spymaster' || clueError(game.board, action.word, action.count)) return null;
    return {
      ...game,
      phase: 'guess',
      clue: { word: action.word.trim(), count: action.count },
      guessesRemaining: action.count + 1,
      lastGuess: null,
    };
  }
  if (game.phase !== 'guess' || seat.role !== 'guesser') return null;
  if (action.type === 'pass') return advance(game);
  if (action.type !== 'guess' || !Number.isInteger(action.index)) return null;
  const card = game.board[action.index];
  if (!card || card.revealed) return null;

  const next: Game = {
    ...game,
    board: game.board.map((entry, index) => index === action.index ? { ...entry, revealed: true } : entry),
    guessesRemaining: game.guessesRemaining - 1,
    lastGuess: { index: action.index, kind: card.kind, team: game.turn },
  };
  if (card.kind === 'assassin') return finish(next, otherTeam(game.turn));
  if ((card.kind === 'red' || card.kind === 'blue') && getRemaining(next)[card.kind] === 0) return finish(next, card.kind);
  if (card.kind !== game.turn || next.guessesRemaining === 0) return advance(next);
  return next;
}
