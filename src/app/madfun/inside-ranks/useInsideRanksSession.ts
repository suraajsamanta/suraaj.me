'use client';

import { usePhoneParty, type PhonePartyConfig } from '../shared/usePhoneParty';
import { createMatch, expireRanking, nextRound, roundDeadline, privateView, publicView, normalizeCustomQuestion, reveal, showOptions, skipRound, submitGuess, submitRanking, updateRankingPreview, type RankingDrag, type Match, type Player, type Prompt, type PublicView } from './engine';
import { INSIDE_RANKS_PROMPTS } from './prompts';
import { DARK_OPENING_CATEGORIES, INSIDE_RANKS_DARK_PROMPTS } from './dark-prompts';

type Deck = 'classic' | 'dark';
const promptsFor = (deck: Deck) => deck === 'dark' ? INSIDE_RANKS_DARK_PROMPTS : INSIDE_RANKS_PROMPTS;

export const MAX_PLAYER_QUESTIONS = 1;
type Question = Prompt & { authorId: string };
type Model = { simultaneous: boolean; questions: Question[]; questionSerial: number; deck: Deck; matchId: number; match: Match | null; autoRun: boolean; deadline: number | null; rankingStartedAt: number | null };
type InsideRanksPublic = { simultaneous: boolean; questionCount: number; deck: Deck; matchId: number; hostId: string; players: Player[]; match: PublicView | null; autoRun: boolean; deadline: number | null };
export type InsideRanksAction = { type: 'set_deck'; deck: Deck } | { type: 'set_simultaneous'; enabled: boolean } |
  { type: 'submit_question'; text: string } | { type: 'remove_question'; id: string } | { type: 'set_auto'; enabled: boolean } | { type: 'start' | 'show_options' | 'expire_ranking' | 'reveal' | 'next' | 'skip' | 'rematch' | 'restart' } |
  { type: 'rank'; orderedIds: string[] } | { type: 'guess'; optionId: string } |
  { type: 'rank_preview'; orderedIds: string[]; drag: RankingDrag | null };
const questionKey = (value: string) => value.toLowerCase().replace(/[?!.]+$/u, '');
const roster = (players: Player[]) => players.map(({ id, name, connected }) => ({ id, name, connected }));

export const insideRanksConfig: PhonePartyConfig<Model, InsideRanksPublic> = {
  protocol: 'madfun.insideranks.v1',
  recoverPlayersKey: 'madfun.insideranks.player.v1',
  initial: () => ({ deck: 'classic', simultaneous: false, questions: [], questionSerial: 0, matchId: 0, match: null, autoRun: false, deadline: null, rankingStartedAt: null }),
  reconcilePresence(model, people) {
    const match = model.match;
    if (!match?.preview?.drag || people.some(person => person.id === match.ranker.id && person.connected)) return model;
    return { ...model, match: { ...match, preview: { ...match.preview, drag: null } } };
  },
  view({ deck, simultaneous, questions, matchId, match, autoRun, deadline }, people, hostId) {
    return { deck, simultaneous, questionCount: deck === 'classic' ? questions.length : 0, matchId, hostId, players: roster(people), autoRun, deadline,
      match: match && publicView(match, people.some(person => person.id === match.ranker.id && person.connected)) };
  },
  secret(model, id) {
    const editable = model.deck === 'classic' && (!model.match || model.match.phase === 'finished');
    const questions = editable ? model.questions.filter(q => q.authorId === id).map(({ id, text }) => ({ id, text })) : [];
    const hidden = model.match && privateView(model.match, id);
    return hidden || editable
      ? { prompt: hidden?.prompt ?? null, orderedIds: hidden?.orderedIds, questions, matchId: model.matchId, round: model.match?.round }
      : null;
  },
  shouldPublish(_before, after, incoming) {
    const action = (incoming as { action?: InsideRanksAction })?.action;
    return action?.type !== 'rank_preview' || after.match?.phase !== 'batch_ranking';
  },
  reduce(model, actor, incoming, participants, hostId) {
    if (!incoming || typeof incoming !== 'object') return null;
    const { action, matchId, round } = incoming as { action?: InsideRanksAction; matchId?: number; round?: number };
    if (!action || matchId !== model.matchId || round !== model.match?.round) return null;
    const people = roster(participants);
    const host = actor.id === hostId;
    const editable = !model.match || model.match.phase === 'finished';
    if (action.type === 'set_simultaneous') {
      if (!host || !editable || typeof action.enabled !== 'boolean' || action.enabled === model.simultaneous) return null;
      return { ...model, simultaneous: action.enabled };
    }
    if (action.type === 'submit_question' || action.type === 'remove_question') {
      if (host || !editable || model.deck !== 'classic' || !people.some(p => p.id === actor.id && p.connected)) return null;
      if (action.type === 'remove_question') {
        const questions = model.questions.filter(q => q.authorId !== actor.id || q.id !== action.id);
        return questions.length !== model.questions.length ? { ...model, questions } : null;
      }
      const text = normalizeCustomQuestion(action.text);
      if (!text || model.questions.some(q => questionKey(q.text) === questionKey(text)) ||
        model.questions.filter(q => q.authorId === actor.id).length >= MAX_PLAYER_QUESTIONS) return null;
      const questionSerial = model.questionSerial + 1;
      return { ...model, questionSerial, questions: [...model.questions, { id: `custom-${questionSerial}`, text, authorId: actor.id }] };
    }
    if (action.type === 'set_deck') {
      if (!host || (model.match && model.match.phase !== 'finished') ||
          (action.deck !== 'classic' && action.deck !== 'dark') || action.deck === model.deck) return null;
      return { ...model, deck: action.deck };
    }
    if (action.type === 'set_auto') {
      if (!host || typeof action.enabled !== 'boolean' || action.enabled === model.autoRun) return null;
      return { ...model, autoRun: action.enabled, deadline: roundDeadline(action.enabled, model.match?.phase, model.rankingStartedAt, Date.now()) };
    }
    if (action.type === 'start' || action.type === 'rematch' || action.type === 'restart') {
      if (!host || (action.type === 'restart' ? editable : !editable)) return null;
      // Give Dark Mode a group-beef opener, then let later rounds use the whole deck.
      const match = createMatch(people, promptsFor(model.deck), Math.random,
        model.deck === 'dark' ? DARK_OPENING_CATEGORIES : undefined, {
          customPrompts: model.deck === 'dark' ? [] : model.questions.map(({ id, text }) => ({ id, text })),
          simultaneous: model.simultaneous,
        });
      const now = Date.now();
      if (!match && action.type !== 'restart') return null;
      return { ...model, matchId: model.matchId + 1, match, rankingStartedAt: match ? now : null,
        deadline: roundDeadline(model.autoRun, match?.phase, now, now) };
    }
    if (!model.match) return null;
    const submitted = action.type === 'rank' || action.type === 'guess' || action.type === 'rank_preview';
    const now = Date.now();
    const expired = model.deadline !== null && now >= model.deadline;
    if (submitted && (host || expired)) return null;
    const match = action.type === 'rank_preview' ? updateRankingPreview(model.match, actor.id, action.orderedIds, action.drag) :
      action.type === 'rank' ? submitRanking(model.match, actor.id, action.orderedIds, people) :
      action.type === 'guess' ? submitGuess(model.match, actor.id, action.optionId) :
      !host ? null : action.type === 'show_options' ? showOptions(model.match) :
      action.type === 'reveal' ? reveal(model.match) :
      action.type === 'next' ? nextRound(model.match, people, promptsFor(model.deck)) :
      action.type === 'expire_ranking' && expired ? expireRanking(model.match, people) :
      action.type === 'skip' && model.match.phase === 'ranking' && !people.some(p => p.id === model.match!.ranker.id && p.connected)
        ? skipRound(model.match, people, promptsFor(model.deck)) : null;
    if (!match) return null;
    if (match.phase === model.match.phase && match.round === model.match.round) return { ...model, match };
    const rankingStartedAt = match.phase === 'ranking' ? now : null;
    const questions = match.phase === 'finished' ? model.questions.filter(q => !match.consumedCustomPromptIds.includes(q.id)) : model.questions;
    return { ...model, match, questions, rankingStartedAt, deadline: roundDeadline(model.autoRun, match.phase, rankingStartedAt, now) };
  }
};
export function useInsideRanksSession() {
  const party = usePhoneParty(insideRanksConfig);
  const packet = party.secret as { matchId: number; round?: number; prompt: Prompt | null; questions?: Prompt[]; orderedIds?: string[] } | null;
  const current = packet && packet.matchId === party.state?.matchId && packet.round === party.state.match?.round ? packet : null;
  return { ...party,
    prompt: party.state?.match?.phase === 'ranking' || party.state?.match?.phase === 'batch_ranking' ? current?.prompt ?? null : null,
    questions: current?.questions ?? [],
    draftOrder: current?.orderedIds ?? null,
    dispatch: (action: InsideRanksAction) => party.dispatch({ action, matchId: party.state?.matchId, round: party.state?.match?.round }),
  };
}
