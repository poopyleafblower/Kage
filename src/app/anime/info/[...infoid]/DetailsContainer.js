"use client"
import React,{useState,useEffect} from 'react'
import Episodesection from '@/components/Episodesection'
import AnimeDetailsTop from '@/components/details/AnimeDetailsTop'
import AnimeDetailsBottom from '@/components/details/AnimeDetailsBottom'
import Animecards from '@/components/CardComponent/Animecards'
import { getUserLists } from '@/lib/AnilistUser';
import { useSubtype } from '@/lib/store';
import { useStore } from 'zustand';

function DetailsContainer({data, id, session}) {
    const [list,setList] = useState(null);
    const subtype = useStore(useSubtype, (state) => state.subtype) || "sub";

    useEffect(() => {
        const fetchlist = async()=>{
            const data = await getUserLists(session?.user?.token, id);
            setList(data);
        }
        fetchlist();
    }, [id, session?.user?.token]);

    const progress = list!==null ? list?.status==='COMPLETED' ? 0 : list?.progress : 0;
    const targetEpisode = Math.max(1, Number(progress || 0) + 1);
    const episodeId = encodeURIComponent(`${id}/${subtype}/${targetEpisode}`);
    const watchUrl = data?.status === "NOT_YET_RELEASED"
      ? null
      : `/anime/watch?id=${id}&host=embed&epid=${episodeId}&ep=${targetEpisode}&type=${subtype}`;

  return (
    <>
      <div className='h-[500px] '>
        <AnimeDetailsTop data={data} list={list} session={session} setList={setList} url={watchUrl}/>
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
