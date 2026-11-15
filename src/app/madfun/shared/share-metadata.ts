import type { Metadata } from 'next';

export const SHARE_SIZE = { width: 1200, height: 630 };

export const SHARE_CARDS = {
  suraaj: { name: 'Suraaj Samanta', title: ['Suraaj', 'Samanta'], copy: 'Learning. Building. Exploring.', meta: 'PERSONAL SITE', color: '#adeace', secondary: '#a6c2fa', ink: '#172540', description: 'Suraaj Samanta’s personal site. Learning, building, exploring.' },
  arcade: { name: 'Madfun', title: ['Phones out.', 'Game on.'], copy: 'The living room is the arcade.', meta: 'PARTY ARCADE', color: '#e3fa77', secondary: '#9df5da', ink: '#101c29', description: 'Nine multiplayer party games. Open a game on a shared screen, scan in on your phone, and play together. No app or account.' },
  beerio: { name: 'Beerio', title: ['Beerio'], copy: 'Power-ups. Wild tracks. Bragging rights.', meta: 'KART RACING', color: '#faca72', secondary: '#fc9f92', ink: '#302019', description: 'Grab your phone and join a 3D split-screen kart race. Drift, dodge power-ups, and race up to ten friends.' },
  'beerio-2': { name: 'Beerio 2', title: ['Beerio 2'], copy: 'Afterhours racing.', meta: '3D STREET RACING', color: '#a1f6e2', secondary: '#f9a2ca', ink: '#162339', description: 'Race Seattle Night or Neon Orbit against AI, the clock, or friends. Every driver gets their own 3D view.' },
  boomerang: { name: 'Ricochet', title: ['Ricochet'], copy: 'Throw. Dodge. Catch.', meta: 'BOOMERANG BRAWLER', color: '#ffac77', secondary: '#ffdf8a', ink: '#311f23', description: 'A boomerang arena for 2–10 players. Last one standing takes the round.' },
  'bump-club': { name: 'Bump Club', title: ['Bump', 'Club'], copy: 'No personal space.', meta: 'BUMPER BRAWLER', color: '#c4f672', secondary: '#87eac6', ink: '#172c29', description: 'Shove, slide, and dash to stay on a shrinking platform. Play with 2–10 friends from your phones.' },
  'floor-is-trouble': { name: 'Floor Is Trouble', title: ['Floor Is', 'Trouble'], copy: 'The floor has other plans.', meta: 'SURVIVAL ARENA', color: '#ffcb75', secondary: '#fe81ac', ink: '#34243e', description: 'Watch the tiles, jump the gaps, and stay standing. A survival arena for 2–10 friends.' },
  simulator: { name: 'The Simulator', title: ['The', 'Simulator'], copy: 'How well do you know them?', meta: 'WRITE & RANK', color: '#91f1e9', secondary: '#8eb8fb', ink: '#122d35', description: 'Answer as the guest of honor. They privately rank the best impressions in ten rounds.' },
  jeopardy: { name: 'Eesha Lore Night', title: ['Eesha', 'Lore Night'], copy: 'No buzzers. Everyone plays.', meta: 'PARTY TRIVIA', color: '#fbb2d4', secondary: '#f6d887', ink: '#362038', description: 'Everyone answers the same questions from their phone. Find out who really knows Eesha in the big reveal.' },
  codewords: { name: 'Codewords', title: ['Codewords'], copy: 'Two teams. One secret board.', meta: 'TEAM WORD GAME', color: '#f5d58f', secondary: '#a5e4f0', ink: '#292620', description: 'Give a clue, find your team’s words, and avoid the trap. Play with four or more friends.' },
  'inside-ranks': { name: 'Inside Ranks', title: ['Inside', 'Ranks'], copy: 'Guess what made the ranking.', meta: 'SOCIAL GUESSING', color: '#f5aad4', secondary: '#c8adf8', ink: '#342044', description: 'One friend ranks the group. Read the hint and guess the secret question behind their order.' },
} as const;

export type ShareGame = keyof typeof SHARE_CARDS;

export function isShareGame(value: string): value is ShareGame {
  return Object.hasOwn(SHARE_CARDS, value);
}

export function madfunMetadata(game: ShareGame): Metadata {
  const { name, description } = SHARE_CARDS[game];
  const title = game === 'suraaj' ? 'Suraaj Samanta — Learning, Building, Exploring' : game === 'arcade' ? 'Madfun · Phones out. Game on.' : `${name} | Madfun`;
  const url = `https://suraaj.me/madfun/share/v1/${game}`;
  const alt = game === 'suraaj' ? 'Suraaj Samanta personal site artwork' : `${name} arcade invite artwork by Madfun`;
  // Don't declare a single og:url for this route. The link that was shared can
  // include an invite query, and should not be replaced with its game landing URL.
  return {
    title, description,
    openGraph: {
      title, description, type: 'website', siteName: game === 'suraaj' ? 'Suraaj Samanta' : 'Madfun',
      images: [{ url, alt, type: 'image/png', ...SHARE_SIZE }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url, alt }] },
  };
}
