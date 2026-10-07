"use server"
import { redis } from "@/lib/rediscache";

const RECENT_EPISODES_QUERY = `
query RecentEpisodes($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    airingSchedules(sort: TIME_DESC, notYetAired: false) {
      episode
      airingAt
      media {
        id
        status
        format
        episodes
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
          medium
          color
        }
      }
    }
  }
}
`;

export async function getRecentEpisodes() {
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: RECENT_EPISODES_QUERY,
        variables: {
          page: 1,
          perPage: 20,
        },
      }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`AniList request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const schedules = payload?.data?.Page?.airingSchedules || [];

    // AniList can return multiple recently-aired episodes for the same show.
    // Keep only the most recent entry for each anime so the homepage does not
    // fill up with duplicates.
    const seen = new Set();
    const recent = [];

    for (const schedule of schedules) {
      const media = schedule?.media;
      if (!media?.id || seen.has(media.id)) continue;

      seen.add(media.id);
      recent.push({
        id: media.id,
        // A provider-specific episode id is intentionally not fabricated here.
        // RecentEpisodes will link to the anime details page when this is blank.
        latestEpisode: "",
        title: media.title,
        status: media.status,
        format: media.format,
        totalEpisodes: media.episodes,
        currentEpisode: schedule.episode,
        coverImage: media.coverImage,
        airingAt: schedule.airingAt,
      });

      if (recent.length >= 15) break;
    }

    return recent;
  } catch (error) {
    console.error("Error fetching Recent Episodes from AniList:", error);
    return [];
  }
}

export const GET = async () => {
  let cached;

  if (redis) {
    try {
      cached = await redis.get("recent");
    } catch (error) {
      console.error("Error reading recent episodes cache:", error);
    }
  }

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.error("Error parsing recent episodes cache:", error);
    }
  }

  const data = await getRecentEpisodes();

  if (data?.length > 0 && redis) {
    try {
      await redis.set("recent", JSON.stringify(data), "EX", 60 * 5);
    } catch (error) {
      console.error("Error writing recent episodes cache:", error);
    }
  }

  return data;
};
