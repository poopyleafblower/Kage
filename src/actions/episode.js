"use server";

import { redis } from "@/lib/rediscache";

const ANIZIP_URL = "https://api.ani.zip/mappings";
const ANILIST_URL = "https://graphql.anilist.co";

function mediaApiBase() {
  return process.env.KAGE_MEDIA_API_URL?.trim()?.replace(/\/$/, "") || null;
}

function mediaApiHeaders() {
  const headers = { Accept: "application/json" };
  const token = process.env.KAGE_MEDIA_API_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function normalizeEpisode(raw, fallbackNumber, audio = "sub", animeId = "") {
  const number = Number(raw?.number ?? raw?.episode ?? raw?.ep ?? fallbackNumber);
  if (!Number.isFinite(number) || number <= 0) return null;

  const rawTitle = raw?.title;
  const title =
    (typeof rawTitle === "string" ? rawTitle : rawTitle?.en || rawTitle?.english || rawTitle?.["x-jat"]) ||
    `Episode ${number}`;

  return {
    ...raw,
    id: raw?.id || raw?.episodeId || `${animeId}/${audio}/${number}`,
    number,
    title,
    img: raw?.img || raw?.image || null,
    image: raw?.image || raw?.img || null,
    description: raw?.description || raw?.overview || raw?.summary || null,
    duration: raw?.duration || (raw?.runtime ? Number(raw.runtime) * 60 : null),
    airDate: raw?.airDate || raw?.airdate || raw?.aired || null,
    isFiller: raw?.isFiller ?? raw?.filler ?? false,
    audio,
  };
}

function normalizeEpisodeArray(list, audio, animeId) {
  if (!Array.isArray(list)) return [];
  return list
    .map((episode, index) => normalizeEpisode(episode, index + 1, audio, animeId))
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);
}

async function fetchMediaApiEpisodes(id) {
  const base = mediaApiBase();
  if (!base) return null;

  try {
    const response = await fetch(`${base}/anime/${id}/episodes`, {
      headers: mediaApiHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Media API returned ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.results || payload;
    const episodeData = data?.episodes;

    if (!episodeData) return null;

    const sub = normalizeEpisodeArray(
      Array.isArray(episodeData) ? episodeData : episodeData?.sub,
      "sub",
      id,
    );
    const dub = normalizeEpisodeArray(
      Array.isArray(episodeData) ? [] : episodeData?.dub,
      "dub",
      id,
    );

    if (!sub.length && !dub.length) return null;

    return [
      {
        providerId: "media",
        displayName: "Media",
        playback: true,
        episodes: { sub, dub },
      },
    ];
  } catch (error) {
    console.error("Media API episode lookup failed:", error.message);
    return null;
  }
}

async function fetchAniZipEpisodes(id) {
  try {
    const response = await fetch(`${ANIZIP_URL}?anilist_id=${id}`, {
      next: { revalidate: 60 * 60 * 6 },
    });

    if (!response.ok) {
      throw new Error(`AniZip returned ${response.status}`);
    }

    const data = await response.json();
    const entries = Object.entries(data?.episodes || {});

    return entries
      .map(([episodeNumber, meta]) =>
        normalizeEpisode(meta, Number(episodeNumber), "sub", id),
      )
      .filter(Boolean)
      .sort((a, b) => a.number - b.number);
  } catch (error) {
    console.error("AniZip episode lookup failed:", error.message);
    return [];
  }
}

async function fetchAniListFallbackEpisodes(id) {
  try {
    const response = await fetch(ANILIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `
          query KageEpisodeFallback($id: Int!) {
            Media(id: $id, type: ANIME) {
              status
              episodes
              nextAiringEpisode {
                episode
              }
            }
          }
        `,
        variables: { id: Number(id) },
      }),
      next: { revalidate: 60 * 30 },
    });

    if (!response.ok) return [];

    const payload = await response.json();
    const media = payload?.data?.Media;
    if (!media) return [];

    let count = 0;
    if (media.status === "FINISHED") {
      count = Number(media.episodes || 0);
    } else if (media?.nextAiringEpisode?.episode) {
      count = Math.max(0, Number(media.nextAiringEpisode.episode) - 1);
    }

    return Array.from({ length: count }, (_, index) =>
      normalizeEpisode({}, index + 1, "sub", id),
    ).filter(Boolean);
  } catch (error) {
    console.error("AniList episode fallback failed:", error.message);
    return [];
  }
}

async function fetchCatalogEpisodes(id) {
  const aniZipEpisodes = await fetchAniZipEpisodes(id);
  if (aniZipEpisodes.length) return aniZipEpisodes;
  return fetchAniListFallbackEpisodes(id);
}

export const getEpisodes = async (id, status, refresh = false) => {
  if (!id) return [];

  const cacheTime = status ? 60 * 60 * 3 : 60 * 60 * 24 * 7;
  const providerMode = mediaApiBase() ? "media" : "embed";
  const cacheKey = `episode:v5:${providerMode}:${id}`;

  if (redis && !refresh) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (error) {
      console.error("Episode cache read failed:", error.message);
    }
  }

  let data = await fetchMediaApiEpisodes(id);

  if (!data?.length) {
    const episodes = await fetchCatalogEpisodes(id);

    const dubEpisodes = episodes.map((episode) => ({
      ...episode,
      id: `${id}/dub/${episode.number}`,
      audio: "dub",
    }));

    data = episodes.length
      ? [
          {
            providerId: "embed",
            displayName: "Web",
            playback: true,
            episodes: { sub: episodes, dub: dubEpisodes },
          },
        ]
      : [];
  }

  if (redis && data.length) {
    try {
      await redis.setex(cacheKey, cacheTime, JSON.stringify(data));
    } catch (error) {
      console.error("Episode cache write failed:", error.message);
    }
  }

  return data;
};
