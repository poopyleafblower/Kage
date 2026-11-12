"use client"
import React,{useState,useEffect} from 'react'
import Episodesection from '@/components/Episodesection'
import AnimeDetailsTop from '@/components/details/AnimeDetailsTop'
import AnimeDetailsBottom from '@/components/details/AnimeDetailsBottom'
import Animecards from '@/components/CardComponent/Animecards'
import { buildWatchUrl } from '@/utils/watch';
import { readLocalWatchHistory } from '@/utils/watchProgress';
import { getUserLists } from '@/lib/AnilistUser';
import { useSettings, useSubtype } from '@/lib/store';
import { useStore } from 'zustand';

function DetailsContainer({data, id, session, providers}) {
    const [list,setList] = useState(null);
    const [guestProgress, setGuestProgress] = useState(null);

    useEffect(() => {
        setGuestProgress(session?.user ? null : readLocalWatchHistory().find(
            (record) => String(record.aniId) === String(id) && record.timeWatched > 0 &&
                (!record.duration || record.timeWatched < record.duration),
        ) || null);
    }, [id, session?.user]);
    const settings = useStore(useSettings, (state) => state.settings);
    const storedSubtype = useStore(useSubtype, (state) => state.subtype);
    const subtype = settings?.preferredAudio || storedSubtype || "sub";

    useEffect(() => {
        useSubtype.setState({ subtype });
    }, [subtype]);

    useEffect(() => {
        const fetchlist = async()=>{
            const data = await getUserLists(session?.user?.token, id);
            setList(data);
        }
        fetchlist();
    }, [id, session?.user?.token]);

    const progress = list!==null ? list?.status==='COMPLETED' ? 0 : list?.progress : 0;
    const targetEpisode = guestProgress?.epNum ||
        (data?.format === "MOVIE" ? 1 : Math.max(1, Number(progress || 0) + 1));
    const preferredAudio = guestProgress?.subtype || subtype;
    const playable = providers.filter((provider) => provider.playback);
    const candidates = [preferredAudio, preferredAudio === "sub" ? "dub" : "sub"].flatMap(
        (audio) => playable.flatMap(({ providerId, episodes }) => {
            const list = Array.isArray(episodes) ? episodes : episodes?.[audio];
            const episode = list?.find((item) => Number(item.number) === Number(targetEpisode));
            return episode ? [{ providerId, episode, audio }] : [];
        }),
    );
    const selected = candidates.find(({ providerId, audio }) =>
        providerId === guestProgress?.provider && audio === preferredAudio
    ) || candidates[0];
    const watchUrl = data?.status === "NOT_YET_RELEASED" || !selected ? null : buildWatchUrl({
        titleId: id,
        episodeNumber: targetEpisode,
        episodeId: selected.episode.id || selected.episode.episodeId,
        provider: selected.providerId,
        audio: selected.audio,
    });
    const watchLabel = guestProgress
        ? (data?.format === "MOVIE" ? "Continue" : `Continue · Ep ${targetEpisode}`)
        : (list?.status === "COMPLETED" ? "Rewatch" : "Watch");

  return (
    <>
      <div className='h-[500px] '>
        <AnimeDetailsTop data={data} list={list} session={session} setList={setList} url={watchUrl} watchLabel={watchLabel}/>
      </div>
      <AnimeDetailsBottom data={data} />
      <Episodesection data={data} id={id} progress={progress}/>
      {data?.recommendations?.nodes?.length > 0 && (
        <div className="recommendationglobal">
          <Animecards data={data.recommendations.nodes} cardid={"Recommendations"} />
        </div>
      )}
    </>
  )
}

export default DetailsContainer
