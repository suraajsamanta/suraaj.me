export type Player = { id: string; name: string; connected: boolean };
export type Prompt = { id: string; text: string; category?: string };
export type Phase = 'ranking' | 'guessing' | 'reveal' | 'finished';
export type Result = { playerId: string; optionId: string; points: number };
export type Match = {
  phase: Phase;
  round: number;
  totalRounds: number;
  queue: Player[];
  players: Player[];
  ranker: Player;
  rankTargets: Player[];
  ranking: Player[];
  options: Prompt[];
  correct: Prompt;
  usedPromptIds: string[];
  eligibleGuesserIds: string[];
  guesses: Record<string, string>;
  scores: Record<string, number>;
  results: Result[];
};

export type PublicView = {
  phase: Phase;
  round: number;
  totalRounds: number;
  ranker: Player;
  rankTargets: Player[];
  ranking: Player[];
  options: Prompt[];
  correct: Prompt | null;
  eligibleGuesserIds: string[];
  guessedIds: string[];
  scores: Record<string, number>;
  results: Result[];
};

function shuffled<T>(entries: readonly T[], rng: () => number): T[] {
  const list = [...entries];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function connected(players: readonly Player[]): Player[] {
  return [...new Map(players.filter(player => player.connected).map(player => [player.id, player])).values()];
}

function readyPrompts(prompts: readonly Prompt[]): Prompt[] {
  return [...new Map(prompts.filter(prompt => prompt.id && prompt.text.trim()).map(prompt => [prompt.id, prompt])).values()];
}

function chooseOptions(prompts: Prompt[], used: string[], rng: () => number) {
  const fresh = prompts.filter(prompt => !used.includes(prompt.id));
  const source = fresh.length >= 4 ? fresh : prompts;
  const correct = shuffled(source, rng)[0];
  const other = shuffled(source.filter(prompt => prompt.id !== correct.id), rng);
  const related = other.filter(prompt => prompt.category === correct.category);
  const unrelated = other.filter(prompt => prompt.category !== correct.category);
  const options = shuffled([correct, ...related, ...unrelated].slice(0, 4), rng);
  return { correct, options, usedPromptIds: [...new Set([...used, ...options.map(prompt => prompt.id)])] };
}

export function createMatch(players: readonly Player[], prompts: readonly Prompt[], rng = Math.random): Match | null {
  const current = connected(players);
  const bank = readyPrompts(prompts);
  if (current.length < 3 || bank.length < 4) return null;
  const queue = shuffled(current, rng);
  const ranker = queue[0];
  const rankTargets = current.filter(player => player.id !== ranker.id);
  return {
    phase: 'ranking',
    round: 1,
    totalRounds: queue.length,
    queue,
    players: current,
    ranker,
    rankTargets,
    ranking: [],
    ...chooseOptions(bank, [], rng),
    eligibleGuesserIds: rankTargets.map(player => player.id),
    guesses: {},
    scores: Object.fromEntries(current.map(player => [player.id, 0])),
    results: [],
  };
}

export function publicView(match: Match): PublicView {
  const revealed = match.phase === 'reveal' || (match.phase === 'finished' && match.ranking.length > 0);
  return {
    phase: match.phase,
    round: match.round,
    totalRounds: match.totalRounds,
    ranker: match.ranker,
    rankTargets: match.rankTargets,
    ranking: match.ranking,
    options: match.ranking.length > 0 ? match.options : [],
    correct: revealed ? match.correct : null,
    eligibleGuesserIds: match.eligibleGuesserIds,
    guessedIds: Object.keys(match.guesses),
    scores: match.scores,
    results: revealed ? match.results : [],
  };
}

export function privateView(match: Match, playerId: string): { prompt: Prompt } | null {
  return match.phase === 'ranking' && match.ranker.id === playerId ? { prompt: match.correct } : null;
}

export function submitRanking(match: Match, playerId: string, orderedIds: readonly string[]): Match | null {
  if (match.phase !== 'ranking' || match.ranker.id !== playerId || !Array.isArray(orderedIds)) return null;
  if (orderedIds.length !== match.rankTargets.length || new Set(orderedIds).size !== orderedIds.length) return null;
  const byId = new Map(match.rankTargets.map(player => [player.id, player]));
  if (!orderedIds.every(id => byId.has(id))) return null;
  return { ...match, phase: 'guessing', ranking: orderedIds.map(id => byId.get(id)!) };
}

export function submitGuess(match: Match, playerId: string, optionId: string): Match | null {
  if (match.phase !== 'guessing' || !match.eligibleGuesserIds.includes(playerId) || Object.hasOwn(match.guesses, playerId)) return null;
  if (!match.options.some(option => option.id === optionId)) return null;
  return { ...match, guesses: { ...match.guesses, [playerId]: optionId } };
}

export function reveal(match: Match): Match | null {
  if (match.phase !== 'guessing') return null;
  const scores = { ...match.scores };
  const results = Object.entries(match.guesses).map(([playerId, optionId]) => {
    const points = Number(optionId === match.correct.id);
    scores[playerId] = (scores[playerId] ?? 0) + points;
    return { playerId, optionId, points };
  });
  return { ...match, phase: 'reveal', scores, results };
}

export function nextRound(match: Match, players: readonly Player[], prompts: readonly Prompt[], rng = Math.random): Match | null {
  if (match.phase !== 'reveal') return null;
  return advance(match, players, prompts, rng);
}

export function skipRound(match: Match, players: readonly Player[], prompts: readonly Prompt[], rng = Math.random): Match | null {
  if (match.phase !== 'ranking') return null;
  return advance(match, players, prompts, rng);
}

function advance(match: Match, players: readonly Player[], prompts: readonly Prompt[], rng: () => number): Match | null {
  const active = connected(players);
  const activeById = new Map(active.map(player => [player.id, player]));
  const nextIndex = match.queue.findIndex((player, i) => i >= match.round && activeById.has(player.id));
  if (active.length < 3 || nextIndex === -1) {
    // A skipped turn never unmasks its unused prompt as an answer.
    return { ...match, phase: 'finished' };
  }
  const bank = readyPrompts(prompts);
  if (bank.length < 4) return null;
  const ranker = activeById.get(match.queue[nextIndex].id)!;
  const rankTargets = active.filter(player => player.id !== ranker.id);
  return {
    ...match,
    phase: 'ranking',
    round: nextIndex + 1,
    players: active,
    ranker,
    rankTargets,
    ranking: [],
    ...chooseOptions(bank, match.usedPromptIds, rng),
    eligibleGuesserIds: rankTargets.map(player => player.id),
    guesses: {},
    scores: Object.fromEntries([...Object.entries(match.scores), ...active.filter(player => !Object.hasOwn(match.scores, player.id)).map(player => [player.id, 0])]),
    results: [],
  };
}
