'use client';

import { usePhoneParty, type PhonePartyConfig } from '../shared/usePhoneParty';
import { CODEWORDS } from '@/lib/madfun/wordgame/words';
import { applyAction, assignSeat, canStart, createGame, getBoardView, getRemaining, skipTurn, type Action, type BoardCard, type CardKind, type Game, type Role, type Seat, type Team } from './engine';

type Model = { autoRun: boolean; deadline: number | null; match: number; game: Game | null; seats: Record<string, Pick<Seat, 'team' | 'role'>> };
export type CodewordsPublic = {
  autoRun: boolean; deadline: number | null; match: number; hostId: string; seats: Seat[]; canStart: boolean;
  game: (Omit<Game, 'board'> & { board: BoardCard[]; remaining: Record<Team, number> }) | null;
};
export type CodewordsAction = Action | { type: 'seat'; team: Team; role: Role } | { type: 'start' } | { type: 'rematch' } | { type: 'set_auto'; enabled: boolean } | { type: 'skip_turn' | 'expire_turn' };
const seatsFor = (model: Model, participants: Array<Pick<Seat, 'name' | 'id' | 'connected'>>): Seat[] =>
  participants.map(p => ({ id: p.id, name: p.name, connected: p.connected, ...(model.seats[p.id] ?? { team: null, role: 'guesser' as const }) }));

function phaseDeadline(game: Game | null, autoRun: boolean) {
  return !autoRun || !game || game.phase === 'finished' ? null : Date.now() + (game.phase === 'clue' ? 45_000 : 35_000);
}

export const codewordsPartyConfig: PhonePartyConfig<Model, CodewordsPublic> = {
  protocol: 'madfun.codewords.v1',
  recoverPlayersKey: 'madfun.codewords.player.v1',
  initial: () => ({ autoRun: false, deadline: null, match: 0, game: null, seats: {} }),
  view(model, participants, hostId) {
    const seats = seatsFor(model, participants);
    const game = model.game && { ...model.game, board: getBoardView(model.game), remaining: getRemaining(model.game) };
    return { autoRun: model.autoRun, deadline: model.deadline, match: model.match, seats, hostId, canStart: canStart(seats), game };
  },
  secret(model, id) {
    if (model.game && model.game.phase !== 'finished' && model.seats[id]?.role === 'spymaster') {
      return { match: model.match, key: model.game.board.map(c => c.kind) };
    }
    return null;
  },
  reduce(model, actor, raw, participants, hostId) {
    if (!raw || typeof raw !== 'object') return null;
    const { action, match, turn } = raw as { action?: CodewordsAction; match?: number; turn?: number };
    if (!action || match !== model.match) return null;
    const seats = seatsFor(model, participants);
    if (action.type === 'start' || action.type === 'rematch') {
      if (actor.id !== hostId || (model.game && model.game.phase !== 'finished') || !canStart(seats)) return null;
      if (action.type === 'rematch' && !model.game) return null;
      const prev = new Set(model.game?.board.map(c => c.word) ?? []);
      const game = createGame(CODEWORDS.filter(word => !prev.has(word)));
      return { ...model, match: model.match + 1, game, deadline: phaseDeadline(game, model.autoRun) };
    }
    if (action.type === 'set_auto') {
      if (actor.id !== hostId || typeof action.enabled !== 'boolean' || action.enabled === model.autoRun) return null;
      return { ...model, autoRun: action.enabled, deadline: phaseDeadline(model.game, action.enabled) };
    }
    if (action.type === 'skip_turn' || action.type === 'expire_turn') {
      if (actor.id !== hostId || !model.game || model.game.turnNumber !== turn) return null;
      if (action.type === 'expire_turn' && (!model.autoRun || model.deadline === null || Date.now() < model.deadline)) return null;
      const game = skipTurn(model.game);
      return game ? { ...model, game, deadline: phaseDeadline(game, model.autoRun) } : null;
    }
    // A host cannot claim either team role or supply clues or guesses.
    if (actor.id === hostId) return null;
    if (action.type === 'seat') {
      if (model.game && model.game.phase !== 'finished') return null;
      if (action.team !== 'red' && action.team !== 'blue') return null;
      const eligible = seats.filter(s => s.connected || s.role !== 'spymaster' || s.team !== action.team);
      const reassigned = assignSeat(eligible, actor.id, action.team, action.role);
      return reassigned ? { ...model, seats: Object.fromEntries(reassigned.map(s => [s.id, { team: s.team, role: s.role }])) } : null;
    }
    if (!model.game || model.game.turnNumber !== turn) return null;
    const seat = seats.find(s => s.id === actor.id && s.team);
    if (!seat) return null;
    if (model.autoRun && model.deadline !== null && Date.now() >= model.deadline) return null;
    if (action.type !== 'clue' && action.type !== 'guess' && action.type !== 'pass') return null;
    const next = applyAction(model.game, seat, action);
    return next ? { ...model, game: next,
      deadline: next.phase !== model.game.phase || next.turnNumber !== model.game.turnNumber ? phaseDeadline(next, model.autoRun) : model.deadline } : null;
  }
};

export function useCodewordsSession() {
  const party = usePhoneParty(codewordsPartyConfig);
  const own = party.secret as { match?: number; key?: CardKind[] } | null;
  const seat = party.state?.seats.find(player => player.id === party.participantId);
  const key = !party.host && !party.watching && party.status === 'connected' && party.hostConnected &&
    seat?.connected && seat.role === 'spymaster' && own?.match === party.state?.match && own?.key?.length === 25 ? own.key : null;
  return {
    ...party,
    key,
    dispatch: (action: CodewordsAction) => party.dispatch({ action, match: party.state?.match, turn: party.state?.game?.turnNumber }),
  };
}
