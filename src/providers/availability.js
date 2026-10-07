import { getReAnimeAudioAvailability } from "@/providers/reanime";

const KAGE_ORIGIN = "https://kage-puce-beta.vercel.app";

function hasEpisodes(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

async function checkAniwixi(anilistId) {
  try {
    const response = await fetch(
      `https://aniwixi.xyz/wp-json/aniwixi/v1/anilist/id?id=${encodeURIComponent(anilistId)}`,
      { next: { revalidate: 60 * 30 } },
    );

    if (!response.ok) return false;

    const payload = await response.json();
    const data = payload?.data || payload?.results || payload;

    return (
      hasEpisodes(data?.episodes) ||
      hasEpisodes(data?.episode) ||
      hasEpisodes(data?.anime?.episodes)
    );
  } catch {
    return false;
  }
}

async function checkMegaPlay(anilistId, episode = 1) {
  try {
    const response = await fetch(
      `https://ani.megaplay.su/api/ani/${encodeURIComponent(anilistId)}/${encodeURIComponent(episode)}/sub`,
      {
        headers: {
          Accept: "application/json",
          Origin: KAGE_ORIGIN,
          Referer: `${KAGE_ORIGIN}/`,
        },
        next: { revalidate: 60 * 15 },
      },
    );

    if (!response.ok) return false;

    const payload = await response.json();
    return Boolean(
      payload?.source ||
      payload?.url ||
      payload?.file ||
      (Array.isArray(payload?.sources) && payload.sources.length),
    );
  } catch {
    return false;
  }
}

async function checkReAnime(anilistId, episode = 1) {
  try {
    const availability = await getReAnimeAudioAvailability(anilistId, episode);
    return Boolean(availability?.sub || availability?.dub);
  } catch {
    return false;
  }
}

export async function hasPlayableSource(anilistId, episode = 1) {
  if (!anilistId) return false;

  const results = await Promise.allSettled([
    checkReAnime(anilistId, episode),
    checkAniwixi(anilistId),
    checkMegaPlay(anilistId, episode),
  ]);

  return results.some(
    (result) => result.status === "fulfilled" && result.value === true,
  );
}

export async function filterPlayableMedia(items = [], episode = 1) {
  if (!Array.isArray(items) || !items.length) return [];

  const checks = await Promise.all(
    items.map(async (item) => ({
      item,
      playable: await hasPlayableSource(item?.id, episode),
    })),
  );

  return checks.filter(({ playable }) => playable).map(({ item }) => item);
}
