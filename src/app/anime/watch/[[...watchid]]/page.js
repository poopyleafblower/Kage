import React from "react";
import { AnimeInfoAnilist } from '@/lib/Anilistfunctions'
import NextAiringDate from "@/components/videoplayer/NextAiringDate";
import PlayerAnimeCard from "@/components/videoplayer/PlayerAnimeCard";
import Navbarcomponent from "@/components/navbar/Navbar";
import PlayerComponent from "@/components/videoplayer/PlayerComponent";
import { getEpisodes } from "@/actions/episode";
import { getAuthSession } from "../../../api/auth/[...nextauth]/route";
import { redis } from '@/lib/rediscache';


async function getInfo(id) {
  try {
    let cachedData;
    if (redis) {
      cachedData = await redis.get(`info:${id}`);
      if (!JSON.parse(cachedData)) {
        await redis.del(`info:${id}`);
        cachedData = null;
      }
    }
    if (cachedData) {
      return JSON.parse(cachedData);
    } else {
      const data = await AnimeInfoAnilist(id);
      const cacheTime = data?.nextAiringEpisode?.episode ? 60 * 60 * 2 : 60 * 60 * 24 * 45;
      if (redis && data !== null && data) {
        await redis.set(`info:${id}`, JSON.stringify(data), "EX", cacheTime);
      }
      return data;
    }
  } catch (error) {
    console.error("Error fetching info: ", error);
  }
}

export async function generateMetadata({ params, searchParams }) {
  const id =  searchParams?.id;
  const data = await getInfo(id);
  const epnum = searchParams?.ep;
  const title = (data?.format === "MOVIE" ? "Complete Movie" : "Episode " + epnum)
    + " - " + (data?.title?.english || data?.title?.romaji || "Kage");

  return {
    title,
    description: data?.description?.slice(0,180),
    openGraph: {
      title,
      images: [data?.coverImage?.extraLarge],
      description: data?.description,
    },
    twitter: {
      card: "summary",
      title,
      description: data?.description?.slice(0,180),
    },
  }
}

async function AnimeWatch({ params, searchParams }) {
  const id = searchParams.id;
  const epNum = searchParams.ep;
  const subdub = searchParams.type === "dub" ? "dub" : "sub";
  const [session, data] = await Promise.all([getAuthSession(), getInfo(id)]);
  let provider = searchParams.host;
  let epId = searchParams.epid;

  if (id && epNum && !provider) {
    const providers = await getEpisodes(id, data?.status === "RELEASING");
    for (const candidate of providers.filter((item) => item.playback)) {
      const episodes = Array.isArray(candidate.episodes) ? candidate.episodes : candidate.episodes?.[subdub];
      const episode = episodes?.find((item) => Number(item.number) === Number(epNum));
      if (episode) {
        provider = candidate.providerId;
        epId = episode.id || episode.episodeId || epId;
        break;
      }
    }
  }
  provider ||= "embed";

  return (
    <>
      <Navbarcomponent />
      <main className="mx-auto mt-[70px] w-full px-2 lg:max-w-[98%] xl:max-w-[94%]">
        <PlayerComponent id={id} epId={epId} provider={provider} epNum={epNum} data={data} subdub={subdub} session={session} />
        {data?.status === "RELEASING" && <NextAiringDate nextAiringEpisode={data.nextAiringEpisode} />}
        <div className="hidden max-w-[380px] lg:block">
          <PlayerAnimeCard data={data?.recommendations?.nodes} id="Recommendations" />
        </div>
      </main>
    </>
  );
}

export default AnimeWatch;
