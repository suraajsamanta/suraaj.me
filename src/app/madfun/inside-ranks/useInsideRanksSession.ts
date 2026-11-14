'use client';

import { usePhoneParty, type PhonePartyConfig } from '../shared/usePhoneParty';
import { createMatch, nextRound, privateView, publicView, reveal, skipRound, submitGuess, submitRanking, type Match, type Player, type Prompt, type PublicView } from './engine';
import { INSIDE_RANKS_PROMPTS } from './prompts';

type Model = { matchId: number; match: Match | null };
type InsideRanksPublic = { matchId: number; hostId: string; players: Player[]; match: PublicView | null };
type Action = { type: 'start' | 'reveal' | 'next' | 'skip' | 'rematch' } |
  { type: 'rank'; orderedIds: string[] } | { type: 'guess'; optionId: string };
const roster = (players: Player[]) => players.map(({ id, name, connected }) => ({ id, name, connected }));

const config: PhonePartyConfig<Model, InsideRanksPublic> = {
  protocol: 'madfun.insideranks.v1',
  initial: () => ({ matchId: 0, match: null }),
  view: (model, people, hostId) => ({ matchId: model.matchId, hostId, players: roster(people), match: model.match && publicView(model.match) }),
  secret(model, id) {
    if (!model.match) return null;
    const hidden = privateView(model.match, id);
    return hidden ? { ...hidden, matchId: model.matchId, round: model.match.round } : null;
  },
  reduce(model, actor, incoming, participants, hostId) {
    if (!incoming || typeof incoming !== 'object') return null;
    const { action, matchId, round } = incoming as { action?: Action; matchId?: number; round?: number };
    if (!action || matchId !== model.matchId || round !== model.match?.round) return null;
    const people = roster(participants);
    const host = actor.id === hostId;
    if (action.type === 'start' || action.type === 'rematch') {
      if (!host || (model.match && model.match.phase !== 'finished')) return null;
      const match = createMatch(people, INSIDE_RANKS_PROMPTS);
      return match ? { matchId: model.matchId + 1, match } : null;
    }
    if (!model.match) return null;
    const match = action.type === 'rank' ? submitRanking(model.match, actor.id, action.orderedIds) :
      action.type === 'guess' ? submitGuess(model.match, actor.id, action.optionId) :
      !host ? null : action.type === 'reveal' ? reveal(model.match) :
      action.type === 'next' ? nextRound(model.match, people, INSIDE_RANKS_PROMPTS) :
      action.type === 'skip' && !people.some(p => p.id === model.match!.ranker.id && p.connected)
        ? skipRound(model.match, people, INSIDE_RANKS_PROMPTS) : null;
    return match ? { ...model, match } : null;
  }
};
export function useInsideRanksSession() {
  const party = usePhoneParty(config);
  const packet = party.secret as { matchId: number; round: number; prompt: Prompt } | null;
  return { ...party,
    prompt: packet && packet.matchId === party.state?.matchId && packet.round === party.state.match?.round ? packet.prompt : null,
    dispatch: (action: Action) => party.dispatch({ action, matchId: party.state?.matchId, round: party.state?.match?.round }),
  };
}
