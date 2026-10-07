const ANILIST_URL = "https://graphql.anilist.co";
const DEFAULT_REANIME_BASE = "https://reanime.to";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function baseUrl() {
  return process.env.REANIME_BASE_URL?.trim()?.replace(/\/$/, "") || DEFAULT_REANIME_BASE;
}

function headers() {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json, */*",
  };
}

async function getAniListMedia(anilistId) {
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: `
        query KageReAnimeMedia($id: Int!) {
          Media(id: $id, type: ANIME) {
            id
            idMal
            title {
              romaji
              english
              native
            }
          }
        }
      `,
      variables: { id: Number(anilistId) },
    }),
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.data?.Media || null;
}

export async function resolveReAnimeAnime(anilistId) {
  try {
    const media = await getAniListMedia(anilistId);
    if (!media) return null;

    const title = media.title?.english || media.title?.romaji || media.title?.native;
    if (!title) return null;

    const response = await fetch(
      `${baseUrl()}/api/search?${new URLSearchParams({ q: title, limit: "10" })}`,
      {
        headers: headers(),
        cache: "no-store",
      },
    );

    if (!response.ok) return null;

    const payload = await response.json();
    const results = Array.isArray(payload)
      ? payload
      : payload?.results || payload?.data || [];

    if (!Array.isArray(results) || !results.length) return null;

    const exact =
      results.find((item) => Number(item?.anilist_id) === Number(anilistId)) ||
      results.find((item) => Number(item?.anilistId) === Number(anilistId)) ||
      results[0];

    const slug = exact?.anime_id ?? exact?.slug ?? exact?.id;
    if (!slug) return null;

    return {
      slug: String(slug),
      title,
      anilistId: Number(anilistId),
      malId: media.idMal || null,
    };
  } catch (error) {
    console.error("ReAnime lookup failed:", error.message);
    return null;
  }
}

export async function getReAnimeSources(anilistId, episode, audio = "sub") {
  const anime = await resolveReAnimeAnime(anilistId);
  if (!anime) return null;

  try {
    const response = await fetch(
      `${baseUrl()}/api/watch/${encodeURIComponent(anime.slug)}/${encodeURIComponent(episode)}`,
      {
        headers: headers(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`ReAnime watch endpoint returned ${response.status}`);
    }

    const payload = await response.json();
    const links = Array.isArray(payload?.episode_links)
      ? payload.episode_links
      : Array.isArray(payload?.servers)
        ? payload.servers
        : [];

    const acceptedTypes = audio === "dub" ? ["dub", "s-dub"] : ["sub", "s-sub"];
    const filtered = links.filter((item) => {
      const type = item?.dataType || item?.type || item?.audio;
      return !type || acceptedTypes.includes(type);
    });

    const sources = filtered
      .map((item) => {
        const url = item?.dataLink || item?.url || item?.file;
        if (!url) return null;

        const type =
          item?.type ||
          (url.includes(".m3u8")
            ? "hls"
            : url.includes(".mp4")
              ? "video/mp4"
              : "embed");

        return {
          url,
          type,
          server: item?.serverName || item?.name || "ReAnime",
          quality: item?.quality || (type === "hls" ? "auto" : "embed"),
        };
      })
      .filter(Boolean);

    if (!sources.length) return null;

    return {
      sources,
      tracks: [],
      subtitles: [],
      download: null,
      provider: "reanime",
      slug: anime.slug,
    };
  } catch (error) {
    console.error("ReAnime source lookup failed:", error.message);
    return null;
  }
}
