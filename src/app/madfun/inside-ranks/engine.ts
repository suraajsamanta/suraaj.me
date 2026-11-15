export type Player = { id: string; name: string; connected: boolean };
export type Prompt = { id: string; text: string; category?: string };
export type Phase = 'batch_ranking' | 'ranking' | 'hint' | 'guessing' | 'reveal' | 'finished';
export type Result = { playerId: string; optionId: string; points: number };
export type RankingDrag = { id: string; position: number };
export type RankingPreview = { orderedIds: string[]; drag: RankingDrag | null };
type Assignment = {
  ranker: Player;
  correct: Prompt;
  options: Prompt[];
  customPrompt: boolean;
  draftOrder: string[] | null;
  orderedIds: string[] | null;
};
type MatchSettings = { customPrompts?: readonly Prompt[]; simultaneous?: boolean };

export type Match = {
  phase: Phase;
  round: number;
  totalRounds: number;
  simultaneous: boolean;
  customPrompt: boolean;
  remainingCustomPrompts: Prompt[];
  consumedCustomPromptIds: string[];
  excludedBuiltinIds: string[];
  batchAssignments: Assignment[];
  queue: Player[];
  startingRoster: Player[];
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
  simultaneous: boolean;
  batch: { submittedIds: string[]; rankerIds: string[] } | null;
  customPrompt: boolean;
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
  'dark-funeral': 'Picture a funeral that does not go as planned.',
  'dark-bargain': 'Think about a cursed deal and its fine print.',
  'dark-alibi': 'Picture this group trying to explain a very suspicious evening.',
  'dark-receipts': 'Think group chats, screenshots, and evidence nobody meant to share.',
  'dark-exes': 'Think about dating drama that became everyone’s business.',
  'dark-petty': 'Picture a friend doing something small enough to deny and big enough to start a fight.',
  'dark-bigots': 'Picture somebody calling out prejudice in public.',
  'dark-adult': 'Think about the romantic plot this group would never put in the group chat.',
  'dark-chaos': 'Picture the group trying to explain how a ridiculous night got out of hand.',
  'dark-first-impressions': 'Think about how this group comes across to other people.',
  'dark-future': 'Fast-forward a few years and imagine where everyone ends up.',
  'dark-habits': 'Think about the habits this group sees when nobody else is looking.',
  'dark-boys-club': 'Think about what happens when a sexist comment gets an answer back.',
});

export const MANUAL_RANKING_SECONDS = 90;
export const BATCH_RANKING_SECONDS = 60;
export const MAX_CUSTOM_QUESTION_LENGTH = 180;

export function normalizeCustomQuestion(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_CUSTOM_QUESTION_LENGTH * 4) return null;
  const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (normalized.length < 3 || normalized.length > MAX_CUSTOM_QUESTION_LENGTH ||
    /[\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(normalized)) return null;
  return normalized;
}

export function phaseTimer(phase: Phase | undefined) {
  switch (phase) {
    case 'batch_ranking': return { seconds: BATCH_RANKING_SECONDS, action: 'expire_ranking' } as const;
    case 'ranking': return { seconds: 75, action: 'expire_ranking' } as const;
    case 'hint': return { seconds: 20, action: 'show_options' } as const;
    case 'guessing': return { seconds: 25, action: 'reveal' } as const;
    case 'reveal': return { seconds: 8, action: 'next' } as const;
    default: return null;
  }
}

export function roundDeadline(autoRun: boolean, phase: Phase | undefined, rankingStartedAt: number | null, now: number) {
  if (phase === 'batch_ranking') return (rankingStartedAt ?? now) + BATCH_RANKING_SECONDS * 1000;
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

function rosterById(players: readonly Player[]): Map<string, Player> {
  return new Map(players.map(player => [player.id, player]));
}

function eligibleGuessers(startingRoster: readonly Player[], present: readonly Player[], rankerId: string): string[] {
  return [...new Set([...startingRoster, ...present.filter(player => player.connected)].map(player => player.id))]
    .filter(id => id !== rankerId);
}

function readyPrompts(prompts: readonly Prompt[]): Prompt[] {
  return [...new Map(prompts.filter(prompt => prompt.id && prompt.text.trim()).map(prompt => [prompt.id, prompt])).values()];
}

function chooseOptions(prompts: Prompt[], used: string[], rng: () => number, prefer?: readonly string[]) {
  const fresh = prompts.filter(prompt => !used.includes(prompt.id));
  const source = fresh.length >= 4 ? fresh : prompts;
  const preferred = prefer ? source.filter(prompt => prompt.category && prefer.includes(prompt.category)) : [];
  const correct = shuffled(preferred.length ? preferred : source, rng)[0];
  const other = shuffled(source.filter(prompt => prompt.id !== correct.id), rng);
  const related = other.filter(prompt => prompt.category === correct.category);
  const unrelated = other.filter(prompt => prompt.category !== correct.category);
  const options = shuffled([correct, ...related, ...unrelated].slice(0, 4), rng);
  return { correct, options, usedPromptIds: [...new Set([...used, ...options.map(prompt => prompt.id)])] };
}

function optionsFor(correct: Prompt, bank: Prompt[], used: string[], rng: () => number): Prompt[] {
  const others = bank.filter(prompt => prompt.id !== correct.id);
  const fresh = others.filter(prompt => !used.includes(prompt.id));
  const source = fresh.length >= 3 ? fresh : others;
  const ordered = shuffled(source, rng);
  const related = ordered.filter(prompt => prompt.category === correct.category);
  const unrelated = ordered.filter(prompt => prompt.category !== correct.category);
  return shuffled([correct, ...[...related, ...unrelated].slice(0, 3)], rng);
}

function pickRound(bank: Prompt[], custom: Prompt[], used: string[], rng: () => number, prefer?: readonly string[]) {
  const [correct, ...remainingCustomPrompts] = custom;
  if (!correct) {
    return { ...chooseOptions(bank, used, rng, prefer), customPrompt: false, remainingCustomPrompts };
  }
  const options = optionsFor(correct, bank, used, rng);
  return { correct, options, customPrompt: true, remainingCustomPrompts,
    usedPromptIds: [...new Set([...used, ...options.map(prompt => prompt.id)])] };
}

const customQuestionKey = (value: string) => value.toLowerCase().replace(/[?.!]+$/u, '');

function cleanCustomPrompts(prompts: readonly Prompt[], bank: readonly Prompt[]): Prompt[] {
  const ids = new Set(bank.map(prompt => prompt.id));
  const texts = new Set<string>();
  const custom: Prompt[] = [];
  for (const prompt of prompts) {
    const value = normalizeCustomQuestion(prompt.text);
    if (!value || !prompt.id || ids.has(prompt.id) || texts.has(customQuestionKey(value))) continue;
    ids.add(prompt.id);
    texts.add(customQuestionKey(value));
    custom.push({ id: prompt.id, text: value });
  }
  return custom;
}

function prepareBatch(rankers: Player[], bank: Prompt[], custom: Prompt[], rng: () => number, prefer?: readonly string[]) {
  const shuffledBuiltIns = shuffled(bank, rng);
  const firstPreferred = prefer && shuffledBuiltIns.find(prompt => prompt.category && prefer.includes(prompt.category));
  if (firstPreferred) {
    shuffledBuiltIns.splice(shuffledBuiltIns.indexOf(firstPreferred), 1);
    shuffledBuiltIns.unshift(firstPreferred);
  }
  // Select all answers before drawing any decoys. No other assignment's prompt is
  // ever shown as a candidate for the current slide.
  const assigned = [...custom, ...shuffledBuiltIns].slice(0, rankers.length);
  const reserved = new Set(assigned.map(prompt => prompt.id));
  const decoys = bank.filter(prompt => !reserved.has(prompt.id));
  const customCount = Math.min(custom.length, assigned.length);
  let used: string[] = [];
  const batchAssignments = assigned.map((correct, index): Assignment => {
    const options = optionsFor(correct, decoys, used, rng);
    used = [...new Set([...used, ...options.map(prompt => prompt.id)])];
    return { ranker: rankers[index], correct, options, customPrompt: index < customCount, draftOrder: null, orderedIds: null };
  });
  return { batchAssignments, remainingCustomPrompts: custom.slice(customCount) };
}

export function createMatch(players: readonly Player[], prompts: readonly Prompt[], rng = Math.random, openingCategories?: readonly string[], settings: MatchSettings = {}): Match | null {
  const startingRoster = [...rosterById(players).values()].map(player => ({ ...player }));
  const bank = readyPrompts(prompts);
  if (startingRoster.filter(player => player.connected).length < 3 || bank.length < 4) return null;
  const queue = shuffled(startingRoster, rng);
  // A player who already stepped away is still in the game, but doesn't delay the first turn.
  const [ranker] = queue.splice(queue.findIndex(player => player.connected), 1);
  queue.unshift(ranker);
  const custom = cleanCustomPrompts(settings.customPrompts ?? [], bank);
  const customTexts = new Set(custom.map(prompt => customQuestionKey(prompt.text)));
  const excludedBuiltinIds = bank.filter(prompt => customTexts.has(customQuestionKey(prompt.text))).map(prompt => prompt.id);
  const distinctBank = bank.filter(prompt => !excludedBuiltinIds.includes(prompt.id));
  const simultaneous = settings.simultaneous === true;
  const batch = simultaneous ? prepareBatch(queue.filter(player => player.connected), distinctBank, custom, rng, openingCategories) : null;
  const next = batch ? {
    correct: batch.batchAssignments[0].correct,
    options: [],
    usedPromptIds: [],
    customPrompt: false,
    ...batch,
  } : { ...pickRound(distinctBank, custom, [], rng, openingCategories), batchAssignments: [] };
  return {
    phase: simultaneous ? 'batch_ranking' : 'ranking',
    round: 1,
    totalRounds: batch?.batchAssignments.length ?? queue.length,
    simultaneous,
    queue,
    startingRoster,
    ranker,
    rankTargets: startingRoster,
    ranking: [],
    preview: null,
    optionsShown: false,
    ...next,
    consumedCustomPromptIds: [],
    excludedBuiltinIds,
    eligibleGuesserIds: eligibleGuessers(startingRoster, [], ranker.id),
    guesses: {},
    scores: Object.fromEntries(startingRoster.map(player => [player.id, 0])),
    results: [],
  };
}

// Display-only option keys keep the ID prefix of a submitted question from
// spoiling the correct answer for anyone inspecting the guessing payload.
function publicOptionId(match: Match, id: string) {
  return match.customPrompt ? `choice-${match.options.findIndex(option => option.id === id) + 1}` : id;
}
function publicOption(match: Match, option: Prompt): Prompt {
  return match.customPrompt ? { id: publicOptionId(match, option.id), text: option.text } : option;
}

export function publicView(match: Match, rankerConnected = true): PublicView {
  const revealed = match.phase === 'reveal' || (match.phase === 'finished' && match.ranking.length > 0);
  return {
    phase: match.phase,
    round: match.round,
    totalRounds: match.totalRounds,
    simultaneous: match.simultaneous,
    batch: match.phase === 'batch_ranking' ? {
      submittedIds: match.batchAssignments.filter(assignment => assignment.orderedIds).map(assignment => assignment.ranker.id),
      rankerIds: match.batchAssignments.map(assignment => assignment.ranker.id),
    } : null,
    customPrompt: match.phase !== 'batch_ranking' && match.phase !== 'ranking' && match.customPrompt,
    ranker: match.ranker,
    rankTargets: match.rankTargets,
    ranking: match.ranking,
    preview: match.phase === 'ranking' && match.preview
      ? { ...match.preview, drag: rankerConnected ? match.preview.drag : null }
      : null,
    options: match.optionsShown ? match.options.map(option => publicOption(match, option)) : [],
    hint: match.phase === 'hint' && !match.customPrompt
      ? (match.correct.category && Object.hasOwn(hintByCategory, match.correct.category) ? hintByCategory[match.correct.category] : 'Think about the situation this group’s ranking might fit.')
      : null,
    correct: revealed ? publicOption(match, match.correct) : null,
    eligibleGuesserIds: match.eligibleGuesserIds,
    guessedIds: Object.keys(match.guesses),
    scores: match.scores,
    results: revealed ? match.results.map(result => ({ ...result, optionId: publicOptionId(match, result.optionId) })) : [],
  };
}

export function privateView(match: Match, playerId: string): { prompt: Prompt; orderedIds?: string[] } | null {
  if (match.phase === 'batch_ranking') {
    const assignment = match.batchAssignments.find(candidate => candidate.ranker.id === playerId && !candidate.orderedIds);
    return assignment ? {
      prompt: assignment.correct,
      ...(assignment.draftOrder ? { orderedIds: [...assignment.draftOrder] } : {}),
    } : null;
  }
  return match.phase === 'ranking' && match.ranker.id === playerId ? { prompt: match.correct } : null;
}

function validOrder(match: Match, playerId: string, orderedIds: unknown): orderedIds is string[] {
  const canRank = match.phase === 'ranking' && match.ranker.id === playerId ||
    match.phase === 'batch_ranking' && match.batchAssignments.some(assignment => assignment.ranker.id === playerId && !assignment.orderedIds);
  if (!canRank || !Array.isArray(orderedIds)) return false;
  if (orderedIds.length !== match.rankTargets.length || new Set(orderedIds).size !== orderedIds.length) return false;
  const targetIds = new Set(match.rankTargets.map(player => player.id));
  for (const id of orderedIds) if (!targetIds.has(id)) return false;
  return true;
}

export function updateRankingPreview(match: Match, playerId: string, orderedIds: unknown, drag: unknown): Match | null {
  if (!validOrder(match, playerId, orderedIds)) return null;
  if (match.phase === 'batch_ranking') {
    // This order is private to the ranker until review. Do not retain drag
    // coordinates or count a draft as an early lock.
    const assignment = match.batchAssignments.find(current => current.ranker.id === playerId);
    const previous = assignment?.draftOrder ?? match.rankTargets.map(player => player.id);
    if (orderedIds.every((id, index) => previous[index] === id)) return null;
    return {
      ...match,
      batchAssignments: match.batchAssignments.map(current => current === assignment
        ? { ...current, draftOrder: [...orderedIds] } : current),
    };
  }
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

export function submitRanking(match: Match, playerId: string, orderedIds: readonly string[], present: readonly Player[] = match.rankTargets): Match | null {
  if (!validOrder(match, playerId, orderedIds)) return null;
  if (match.phase === 'batch_ranking') {
    const batchAssignments = match.batchAssignments.map(assignment => assignment.ranker.id === playerId
      ? { ...assignment, draftOrder: null, orderedIds: [...orderedIds] }
      : assignment);
    const updated = { ...match, batchAssignments };
    return batchAssignments.every(assignment => assignment.orderedIds) ? showSlide(updated, 0, present) : updated;
  }
  const byId = new Map(match.rankTargets.map(player => [player.id, player]));
  return { ...match, phase: 'hint', ranking: orderedIds.map(id => byId.get(id)!), preview: null,
    consumedCustomPromptIds: match.customPrompt ? [...match.consumedCustomPromptIds, match.correct.id] : match.consumedCustomPromptIds };

}

export function showOptions(match: Match): Match | null {
  if (match.phase !== 'hint') return null;
  return { ...match, phase: 'guessing', optionsShown: true };
}

export function submitGuess(match: Match, playerId: string, optionId: string): Match | null {
  if (match.phase !== 'guessing' || !match.eligibleGuesserIds.includes(playerId) || Object.hasOwn(match.guesses, playerId)) return null;
  const option = match.options.find(candidate => publicOptionId(match, candidate.id) === optionId);
  if (!option) return null;
  return { ...match, guesses: { ...match.guesses, [playerId]: option.id } };
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
  return match.simultaneous ? showSlide(match, match.round, players) : advance(match, players, prompts, rng);
}

export function skipRound(match: Match, players: readonly Player[], prompts: readonly Prompt[], rng = Math.random): Match | null {
  if (match.phase !== 'ranking') return null;
  // Keep an unused question near the front if the assigned ranker misses their turn.
  const remainingCustomPrompts = match.customPrompt ? [match.correct, ...match.remainingCustomPrompts] : match.remainingCustomPrompts;
  return advance({ ...match, remainingCustomPrompts }, players, prompts, rng);
}

export function expireRanking(match: Match, players: readonly Player[]): Match | null {
  if (match.phase !== 'ranking' && match.phase !== 'batch_ranking') return null;
  const defaultOrder = match.rankTargets.map(player => player.id);
  if (match.phase === 'ranking') {
    return submitRanking(match, match.ranker.id, match.preview?.orderedIds ?? defaultOrder, players);
  }
  const batchAssignments = match.batchAssignments.map(assignment => ({
    ...assignment,
    orderedIds: assignment.orderedIds ?? assignment.draftOrder ?? defaultOrder,
    draftOrder: null,
  }));
  return showSlide({ ...match, batchAssignments }, 0, players);
}

function showSlide(match: Match, index: number, present: readonly Player[]): Match {
  const assignment = match.batchAssignments[index];
  if (!assignment?.orderedIds) return { ...match, phase: 'finished' };
  const presentById = rosterById(present);
  const rankTargets = match.startingRoster.map(player => ({
    ...player, connected: presentById.get(player.id)?.connected ?? false,
  }));
  const rankTargetById = rosterById(rankTargets);
  const ranker = rankTargetById.get(assignment.ranker.id) ?? assignment.ranker;
  const guessers = eligibleGuessers(match.startingRoster, present, ranker.id);
  return {
    ...match,
    phase: 'hint',
    round: index + 1,
    ranker,
    rankTargets,
    ranking: assignment.orderedIds.map(id => rankTargetById.get(id)!),
    correct: assignment.correct,
    options: assignment.options,
    customPrompt: assignment.customPrompt,
    consumedCustomPromptIds: assignment.customPrompt
      ? [...match.consumedCustomPromptIds, assignment.correct.id]
      : match.consumedCustomPromptIds,
    usedPromptIds: [...new Set([...match.usedPromptIds, ...assignment.options.map(option => option.id)])],
    optionsShown: false,
    preview: null,
    eligibleGuesserIds: guessers,
    guesses: {},
    scores: extendScores(match.scores, guessers),
    results: [],
  };
}

function extendScores(scores: Record<string, number>, guesserIds: string[]) {
  return Object.fromEntries([...Object.entries(scores), ...guesserIds.filter(id => !Object.hasOwn(scores, id)).map(id => [id, 0])]);
}

function advance(match: Match, players: readonly Player[], prompts: readonly Prompt[], rng: () => number): Match | null {
  const presentById = rosterById(players);
  const nextIndex = match.queue.findIndex((player, i) => i >= match.round && presentById.get(player.id)?.connected);
  if (nextIndex === -1) {
    // A skipped turn never unmasks its unused prompt as an answer.
    return { ...match, phase: 'finished', preview: null };
  }
  const bank = readyPrompts(prompts).filter(prompt => !match.excludedBuiltinIds.includes(prompt.id));
  if (!bank.length && !match.remainingCustomPrompts.length) return { ...match, phase: 'finished', preview: null };
  const ranker = { ...match.queue[nextIndex], connected: true };
  const rankTargets = match.startingRoster.map(player => ({
    ...player, connected: presentById.get(player.id)?.connected ?? false,
  }));
  const eligibleGuesserIds = eligibleGuessers(match.startingRoster, [...presentById.values()], ranker.id);
  return {
    ...match,
    phase: 'ranking',
    round: nextIndex + 1,
    ranker,
    rankTargets,
    ranking: [],
    preview: null,
    optionsShown: false,
    ...pickRound(bank, match.remainingCustomPrompts, match.usedPromptIds, rng),
    eligibleGuesserIds,
    guesses: {},
    scores: extendScores(match.scores, eligibleGuesserIds),
    results: [],
  };
}
