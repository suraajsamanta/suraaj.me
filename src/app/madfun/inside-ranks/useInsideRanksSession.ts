'use client';

import { usePhoneParty, type PhonePartyConfig } from '../shared/usePhoneParty';
import { createMatch, nextRound, phaseTimer, privateView, publicView, reveal, showOptions, skipRound, submitGuess, submitRanking, type Match, type Player, type Prompt, type PublicView } from './engine';
import { INSIDE_RANKS_PROMPTS } from './prompts';

type Model = { matchId: number; match: Match | null; autoRun: boolean; deadline: number | null };
type InsideRanksPublic = { matchId: number; hostId: string; players: Player[]; match: PublicView | null; autoRun: boolean; deadline: number | null };
export type InsideRanksAction = { type: 'set_auto'; enabled: boolean } | { type: 'start' | 'show_options' | 'expire_ranking' | 'reveal' | 'next' | 'skip' | 'rematch' } |
  { type: 'rank'; orderedIds: string[] } | { type: 'guess'; optionId: string };
const deadlineFor = (enabled: boolean, match: Match | null) => {
  const timer = enabled && phaseTimer(match?.phase);
  return timer ? Date.now() + timer.seconds * 1000 : null;
};
const roster = (players: Player[]) => players.map(({ id, name, connected }) => ({ id, name, connected }));

const config: PhonePartyConfig<Model, InsideRanksPublic> = {
  protocol: 'madfun.insideranks.v1',
  initial: () => ({ matchId: 0, match: null, autoRun: false, deadline: null }),
  view: (model, people, hostId) => ({ matchId: model.matchId, hostId, players: roster(people), match: model.match && publicView(model.match), autoRun: model.autoRun, deadline: model.deadline }),
  secret(model, id) {
    if (!model.match) return null;
    const hidden = privateView(model.match, id);
    return hidden ? { ...hidden, matchId: model.matchId, round: model.match.round } : null;
  },
  reduce(model, actor, incoming, participants, hostId) {
    if (!incoming || typeof incoming !== 'object') return null;
    const { action, matchId, round } = incoming as { action?: InsideRanksAction; matchId?: number; round?: number };
    if (!action || matchId !== model.matchId || round !== model.match?.round) return null;
    const people = roster(participants);
    const host = actor.id === hostId;
    if (action.type === 'set_auto') {
      if (!host || typeof action.enabled !== 'boolean' || action.enabled === model.autoRun) return null;
      return { ...model, autoRun: action.enabled, deadline: deadlineFor(action.enabled, model.match) };
    }
    if (action.type === 'start' || action.type === 'rematch') {
      if (!host || (model.match && model.match.phase !== 'finished')) return null;
      const match = createMatch(people, INSIDE_RANKS_PROMPTS);
      return match ? { ...model, matchId: model.matchId + 1, match, deadline: deadlineFor(model.autoRun, match) } : null;
    }
    if (!model.match) return null;
    const submitted = action.type === 'rank' || action.type === 'guess';
    const expired = model.autoRun && model.deadline != null && Date.now() >= model.deadline;
    if (submitted && (host || expired)) return null;
    const match = action.type === 'rank' ? submitRanking(model.match, actor.id, action.orderedIds) :
      action.type === 'guess' ? submitGuess(model.match, actor.id, action.optionId) :
      !host ? null : action.type === 'show_options' ? showOptions(model.match) :
      action.type === 'reveal' ? reveal(model.match) :
      action.type === 'next' ? nextRound(model.match, people, INSIDE_RANKS_PROMPTS) :
      (action.type === 'skip' && !people.some(p => p.id === model.match!.ranker.id && p.connected) ||
        action.type === 'expire_ranking' && expired)
        ? skipRound(model.match, people, INSIDE_RANKS_PROMPTS) : null;
    return match ? { ...model, match, deadline: match.phase !== model.match.phase || match.round !== model.match.round ? deadlineFor(model.autoRun, match) : model.deadline } : null;
  }
};
export function useInsideRanksSession() {
  const party = usePhoneParty(config);
  const packet = party.secret as { matchId: number; round: number; prompt: Prompt } | null;
  return { ...party,
    prompt: packet && packet.matchId === party.state?.matchId && packet.round === party.state.match?.round ? packet.prompt : null,
    dispatch: (action: InsideRanksAction) => party.dispatch({ action, matchId: party.state?.matchId, round: party.state?.match?.round }),
  };
}
