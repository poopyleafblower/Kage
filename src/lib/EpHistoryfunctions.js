'use server'
import { getAuthSession } from "@/app/api/auth/[...nextauth]/route";
import { connectMongo } from "@/mongodb/db";
import Watch from "@/mongodb/models/watch";
import { revalidatePath } from "next/cache";


export const getWatchHistory = async () => {
  try {
    await connectMongo();
    const session = await getAuthSession();
    if (!session) {
      return;
    }
    const history = await Watch.find({ userName: session.user.name });

    if (!history) {
      return [];
    }
    return JSON.parse(JSON.stringify(history));
  } catch (error) {
    console.error("Error fetching watch history", error);
  }
  revalidatePath("/");
};

export const createWatchEp = async (aniId, epNum, metadata = {}) => {
  try {
    await connectMongo();
    const session = await getAuthSession();

    if (!session?.user?.name || !aniId || !epNum) {
      return;
    }

    const update = {
      userName: session.user.name,
      aniId: String(aniId),
      epNum: Number(epNum),
      createdAt: new Date(),
    };

    if (metadata.aniTitle) update.aniTitle = metadata.aniTitle;
    if (metadata.epTitle) update.epTitle = metadata.epTitle;
    if (metadata.image) update.image = metadata.image;
    if (metadata.epId) update.epId = metadata.epId;
    if (metadata.provider) update.provider = metadata.provider;
    if (metadata.subtype) update.subtype = metadata.subtype;
    if (metadata.nextepId) update.nextepId = metadata.nextepId;
    if (metadata.nextepNum) update.nextepNum = Number(metadata.nextepNum);

    const watch = await Watch.findOneAndUpdate(
      {
        userName: session.user.name,
        aniId: String(aniId),
        epNum: Number(epNum),
      },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return JSON.parse(JSON.stringify(watch));
  } catch (error) {
    console.error("Oops! Something went wrong while creating the episode tracking:", error);
    return;
  }
};

export const getAniListCurrent = async () => {
  try {
    const session = await getAuthSession();
    const token = session?.user?.token;
    const userId = Number(session?.user?.id || session?.user?.sub);

    if (!token || !Number.isFinite(userId)) return [];

    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `
          query KageCurrentAnime($userId: Int!) {
            MediaListCollection(
              userId: $userId
              type: ANIME
              status: CURRENT
              sort: UPDATED_TIME_DESC
            ) {
              lists {
                entries {
                  id
                  mediaId
                  progress
                  updatedAt
                  media {
                    id
                    status
                    episodes
                    title {
                      english
                      romaji
                    }
                    bannerImage
                    coverImage {
                      extraLarge
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { userId },
      }),
      cache: "no-store",
    });

    if (!response.ok) return [];

    const payload = await response.json();
    if (payload?.errors?.length) return [];

    const entries = payload?.data?.MediaListCollection?.lists
      ?.flatMap((list) => list?.entries || []) || [];

    return entries
      .filter((entry) => entry?.media?.id)
      .map((entry) => {
        const currentProgress = Number(entry?.progress || 0);
        const nextEpisode = Math.max(1, currentProgress + 1);
        const media = entry.media;

        return {
          id: `anilist-${entry.id || media.id}`,
          aniId: String(media.id),
          aniTitle: media.title?.english || media.title?.romaji || "Anime",
          image: media.bannerImage || media.coverImage?.extraLarge || "",
          epId: `${media.id}/sub/${nextEpisode}`,
          epNum: nextEpisode,
          provider: "embed",
          subtype: "sub",
          timeWatched: 0,
          duration: 0,
          createdAt: entry?.updatedAt
            ? new Date(entry.updatedAt * 1000).toISOString()
            : new Date().toISOString(),
          fromAniList: true,
          aniListProgress: currentProgress,
        };
      });
  } catch (error) {
    console.error("Error fetching AniList current anime:", error);
    return [];
  }
};


export const getEpisode = async (aniId, epNum) => {
  try {
    await connectMongo();
    const session = await getAuthSession();
    if (!session) {
      return;
    }

    if (aniId && epNum) {
      const episode = await Watch.find({
        userName: session.user.name,
        aniId: aniId,
        epNum: epNum,
      });
      if (episode && episode.length > 0) {
        return JSON.parse(JSON.stringify(episode));
      }
    }
  } catch (error) {
    console.error("Error:", error);
    return;
  }
};

export const updateEp = async ({aniId, aniTitle, epTitle, image, epId, epNum, timeWatched, duration, provider, nextepId, nextepNum, subtype}) => {
  try {
    await connectMongo();
    const session = await getAuthSession();

    if (!session) {
      return;
    }

    const updatedWatch = await Watch.findOneAndUpdate(
      {
        userName: session?.user.name,
        aniId: aniId,
        epNum: epNum,
      },
      {
        $set: {
          aniId: aniId || null,
          aniTitle: aniTitle || null,
          epTitle: epTitle || null,
          image: image || null,
          epId: epId || null,
          epNum: epNum || null,
          timeWatched: timeWatched || null,
          duration: duration || null,
          provider: provider || null,
          nextepId: nextepId || null,
          nextepNum: nextepNum || null,
          subtype: subtype || "sub",
        },
      },
      { new: true } // Return the updated document
    );

    if (!updatedWatch) {
      return;
    }

    return;
  } catch (error) {
    console.log('Error updating episode:', error);
    return;
  }
}

export const deleteEpisodes = async (data) => {
  try {
    await connectMongo();
    const session = await getAuthSession();

    if (!session) {
      return;
    }

    let deletedData;

    if (data.epId) {
      // Delete a specific document based on watchId
      deletedData = await Watch.findOneAndDelete({
        userName: session?.user.name,
        epId: data.epId
      });
    } else if (data.aniId) {
      // Delete all documents with a specific aniId
      deletedData = await Watch.deleteMany({
        userName: session?.user.name,
        aniId: data.aniId,
      });
    } else {
      return { message: "Invalid request, provide watchId or aniId" };
    }

    if (!deletedData) {
      return { message: "Data not found for deletion" };
    }

    // Fetch remaining data after deletion
    // const data = await Watch.find({ userName: session?.user.name });
    const remainingData = JSON.parse(JSON.stringify(await Watch.find({ userName: session?.user.name })))

    return { message: `Removed anime from history`, remainingData, deletedData }
  } catch (error) {
    console.log(error);
    return;
  }
}