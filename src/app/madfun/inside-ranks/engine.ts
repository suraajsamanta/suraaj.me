export type Player = { id: string; name: string; connected: boolean };
export type Prompt = { id: string; text: string; category?: string };
export type Phase = 'ranking' | 'hint' | 'guessing' | 'reveal' | 'finished';
export type Result = { playerId: string; optionId: string; points: number };
export type RankingDrag = { id: string; position: number };
export type RankingPreview = { orderedIds: string[]; drag: RankingDrag | null };
export type Match = {
  phase: Phase;
  round: number;
  totalRounds: number;
  queue: Player[];
  players: Player[];
  ranker: Player;
  rankTargets: Player[];
  ranking: Player[];
  preview: RankingPreview | null;
  options: Prompt[];
  optionsShown: boolean;
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
  preview: RankingPreview | null;
  options: Prompt[];
  hint: string | null;
  correct: Prompt | null;
  eligibleGuesserIds: string[];
  guessedIds: string[];
  scores: Record<string, number>;
  results: Result[];
};

const hintByCategory: Readonly<Record<string, string>> = Object.freeze({
  party: 'Think about what this crew is like at a party.',
  trip: 'Picture the group traveling somewhere together.',
  chat: 'Think about how everyone acts in the group chat.',
  food: 'Picture the group hanging out over food.',
  games: 'Think about what people do on game night.',
  cabin: 'Picture the group on a cabin weekend.',
  everyday: 'Think about the little things people do in everyday life.',
  spotlight: 'Picture this group in a moment that gets everyone’s attention.',
});

export const MANUAL_RANKING_SECONDS = 90;

export function phaseTimer(phase: Phase | undefined) {
  switch (phase) {
    case 'ranking': return { seconds: 75, action: 'expire_ranking' } as const;
    case 'hint': return { seconds: 20, action: 'show_options' } as const;
    case 'guessing': return { seconds: 25, action: 'reveal' } as const;
    case 'reveal': return { seconds: 8, action: 'next' } as const;
    default: return null;
  }
}

export function roundDeadline(autoRun: boolean, phase: Phase | undefined, rankingStartedAt: number | null, now: number) {
  if (phase === 'ranking') return (rankingStartedAt ?? now) + (autoRun ? (phaseTimer('ranking')?.seconds ?? 75) : MANUAL_RANKING_SECONDS) * 1000;
  const timer = autoRun ? phaseTimer(phase) : null;
  return timer ? now + timer.seconds * 1000 : null;
}

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
    preview: null,
    optionsShown: false,
    ...chooseOptions(bank, [], rng),
    eligibleGuesserIds: rankTargets.map(player => player.id),
    guesses: {},
    scores: Object.fromEntries(current.map(player => [player.id, 0])),
    results: [],
  };
}

export function publicView(match: Match, rankerConnected = true): PublicView {
  const revealed = match.phase === 'reveal' || (match.phase === 'finished' && match.ranking.length > 0);
  return {
    phase: match.phase,
    round: match.round,
    totalRounds: match.totalRounds,
    ranker: match.ranker,
    rankTargets: match.rankTargets,
    ranking: match.ranking,
    preview: match.phase === 'ranking' && match.preview
      ? { ...match.preview, drag: rankerConnected ? match.preview.drag : null }
      : null,
    options: match.optionsShown ? match.options : [],
    hint: match.phase === 'hint'
      ? (match.correct.category && Object.hasOwn(hintByCategory, match.correct.category) ? hintByCategory[match.correct.category] : 'Think about the situation this group’s ranking might fit.')
      : null,
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

function validOrder(match: Match, playerId: string, orderedIds: unknown): orderedIds is string[] {
  if (match.phase !== 'ranking' || match.ranker.id !== playerId || !Array.isArray(orderedIds)) return false;
  if (orderedIds.length !== match.rankTargets.length || new Set(orderedIds).size !== orderedIds.length) return false;
  const targetIds = new Set(match.rankTargets.map(player => player.id));
  for (const id of orderedIds) if (!targetIds.has(id)) return false;
  return true;
}

export function updateRankingPreview(match: Match, playerId: string, orderedIds: unknown, drag: unknown): Match | null {
  if (!validOrder(match, playerId, orderedIds)) return null;
  let cleanDrag: RankingDrag | null = null;
  if (drag !== null) {
    if (!drag || typeof drag !== 'object' || Array.isArray(drag)) return null;
    const { id, position } = drag as Partial<RankingDrag>;
    if (typeof id !== 'string' || !orderedIds.includes(id) || typeof position !== 'number' ||
      !Number.isFinite(position) || position < 0 || position > orderedIds.length - 1) return null;
    // Copy only rendering coordinates, never unknown data provided by a phone.
    cleanDrag = { id, position: Math.round(position * 100) / 100 };
  }
  const previous = match.preview;
  const previousOrder = previous?.orderedIds ?? match.rankTargets.map(player => player.id);
  if (previous?.drag?.id === cleanDrag?.id && previous?.drag?.position === cleanDrag?.position &&
    orderedIds.every((id, index) => previousOrder[index] === id)) return null;
  return { ...match, preview: { orderedIds: [...orderedIds], drag: cleanDrag } };
}

export function submitRanking(match: Match, playerId: string, orderedIds: readonly string[]): Match | null {
  if (!validOrder(match, playerId, orderedIds)) return null;
  const byId = new Map(match.rankTargets.map(player => [player.id, player]));
  return { ...match, phase: 'hint', ranking: orderedIds.map(id => byId.get(id)!), preview: null };
}

export function showOptions(match: Match): Match | null {
  if (match.phase !== 'hint') return null;
  return { ...match, phase: 'guessing', optionsShown: true };
}

export function submitGuess(match: Match, playerId: string, optionId: string): Match | null {
  if (match.phase !== 'guessing' || !match.eligibleGuesserIds.includes(playerId) || Object.hasOwn(match.guesses, playerId)) return null;
  if (!match.options.some(option => option.id === optionId)) return null;
  return { ...match, guesses: { ...match.guesses, [playerId]: optionId } };
}

export function reveal(match: Match): Match | null {
  if (match.phase !== 'guessing' && match.phase !== 'hint') return null;
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
  if (active.length < 2 || nextIndex === -1) {
    // A skipped turn never unmasks its unused prompt as an answer.
    return { ...match, phase: 'finished', preview: null };
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
    preview: null,
    optionsShown: false,
    ...chooseOptions(bank, match.usedPromptIds, rng),
    eligibleGuesserIds: rankTargets.map(player => player.id),
    guesses: {},
    scores: Object.fromEntries([...Object.entries(match.scores), ...active.filter(player => !Object.hasOwn(match.scores, player.id)).map(player => [player.id, 0])]),
    results: [],
  };
}
