import { ImageResponse } from 'next/og';
import { createShareCard } from './art';
import { isShareGame, SHARE_CARDS, SHARE_SIZE } from '../../../shared/share-metadata';

export function generateStaticParams() {
  return Object.keys(SHARE_CARDS).map(game => ({ game }));
}

export async function GET(_: Request, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!isShareGame(game)) return new Response('Not found', { status: 404 });
  return new ImageResponse(createShareCard(game), {
    ...SHARE_SIZE,
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400' },
  });
}
