import { TrendingAnilist, Top100Anilist, SeasonalAnilist } from '@/lib/Anilistfunctions';

export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const [trendingData, top100Data, seasonalData] = await Promise.all([
    TrendingAnilist().catch(() => []),
    Top100Anilist().catch(() => []),
    SeasonalAnilist().catch(() => []),
  ]);

  const toEntries = (items) =>
    (Array.isArray(items) ? items : []).map((anime) => ({
      url: `https://kage-puce-beta.vercel.app/anime/info/${anime.id}`,
      lastModified: new Date(),
    }));

  return [
    {
      url: 'https://kage-puce-beta.vercel.app',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    ...toEntries(trendingData),
    ...toEntries(top100Data),
    ...toEntries(seasonalData),
  ];
}
