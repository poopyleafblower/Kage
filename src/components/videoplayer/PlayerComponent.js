"use client"
import React, { useEffect, useState } from 'react'
import { getAnimeSources } from '@/actions/source';
import { createWatchEp, getEpisode } from '@/lib/EpHistoryfunctions';
import PlayerEpisodeList from './PlayerEpisodeList';
import Player from './VidstackPlayer/player';
import { Spinner } from '@vidstack/react';
import { toast } from 'sonner';
import { useTitle, useNowPlaying, useDataInfo } from '../../lib/store';
import { useStore } from "zustand";

function PlayerComponent({ id, epId, provider, epNum, subdub, data, session, savedep }) {
    const animetitle = useStore(useTitle, (state) => state.animetitle);
    const [episodeData, setepisodeData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [groupedEp, setGroupedEp] = useState(null);
    const [src, setSrc] = useState(null);
    const [embedSrc, setEmbedSrc] = useState(null);
    const [playbackSources, setPlaybackSources] = useState([]);
    const [activeServer, setActiveServer] = useState(null);
    const [activeSourceIndex, setActiveSourceIndex] = useState(-1);
    const [subtitles, setSubtitles] = useState(null);
    const [thumbnails, setThumbnails] = useState(null);
    const [skiptimes, setSkipTimes] = useState(null);
    const [error, setError] = useState(false);
    const [historyEpisode, setHistoryEpisode] = useState(savedep || null);

    const applySource = (source, sourceList = playbackSources) => {
        if (!source?.url) return;

        const list = Array.isArray(sourceList) ? sourceList : [];
        const index = list.findIndex((item) => item?.url === source.url);

        setActiveSourceIndex(index);
        setActiveServer(source?.server || source?.provider || source?.quality || "Server");

        if (source.type === "embed") {
            setEmbedSrc(source.url);
            setSrc(null);
        } else {
            setSrc(source.url);
            setEmbedSrc(null);
        }
    };

    const tryNextServer = () => {
        if (!playbackSources?.length) return;

        const currentIndex = activeSourceIndex >= 0
            ? activeSourceIndex
            : playbackSources.findIndex((item) => item?.url === embedSrc || item?.url === src);

        const nextIndex = currentIndex >= 0
            ? (currentIndex + 1) % playbackSources.length
            : 0;

        applySource(playbackSources[nextIndex], playbackSources);
    };

    useEffect(() => {
        let cancelled = false;

        async function syncHistory() {
            if (!session?.user || !id || !epNum) return;

            const metadata = {
                aniTitle: data?.title?.english || data?.title?.romaji || "Anime",
                epTitle: `Episode ${epNum}`,
                image: data?.bannerImage || data?.coverImage?.extraLarge || "",
                epId: epId || `${id}/${subdub || "sub"}/${epNum}`,
                provider: provider || "embed",
                subtype: subdub || "sub",
            };

            createWatchEp(id, epNum, metadata).catch(() => {});

            try {
                const episode = await getEpisode(id, epNum);
                if (!cancelled && episode) setHistoryEpisode(episode);
            } catch {
                // History should never delay or break playback.
            }
        }

        syncHistory();

        return () => {
            cancelled = true;
        };
    }, [session?.user, id, epNum, epId, provider, subdub, data?.title?.english, data?.title?.romaji, data?.bannerImage, data?.coverImage?.extraLarge]);

    useEffect(() => {
        useDataInfo.setState({ dataInfo: data });
        const fetchSources = async () => {
            setError(false);
            setLoading(true);
            setSrc(null);
            setEmbedSrc(null);
            setPlaybackSources([]);
            setActiveServer(null);
            setActiveSourceIndex(-1);
            try {
                const response = await getAnimeSources(id, provider, epId, epNum, subdub);

                // console.log(response)
                if (!response?.sources?.length) {
                    toast.error("No playable source is available for this episode.");
                    setError(true);
                    setLoading(false);
                    return;
                }

                const orderedSources = response.sources;

                const preferredSource =
                    orderedSources.find(i => i.type !== "embed" && (i.quality === "default" || i.quality === "auto"))
                    || orderedSources.find(i => i.type !== "embed" && i.quality === "1080p")
                    || orderedSources.find(i => i.type === "hls")
                    || orderedSources.find(i => i.type !== "embed")
                    || orderedSources.find(i => i.type === "embed")
                    || orderedSources[0];

                if (!preferredSource?.url) {
                    toast.error("No playable source is available for this episode.");
                    setError(true);
                    setLoading(false);
                    return;
                }

                setPlaybackSources(orderedSources);
                applySource(preferredSource, orderedSources);
                const download = response?.download;

                let subtitlesArray = response?.tracks || response?.subtitles || [];
                const reFormSubtitles = subtitlesArray?.map((i) => ({
                    src: i?.file || i?.url,
                    label: i?.label || i?.lang,
                    kind: i?.kind || (i?.lang === "Thumbnails" ? "thumbnails" : "subtitles"),
                    default: i?.default || (i?.lang === "English"),
                }));
                

                setSubtitles(reFormSubtitles?.filter((s) => s.kind !== 'thumbnails'));
                setThumbnails(reFormSubtitles?.filter((s) => s.kind === 'thumbnails'));

                const skipResponse = await fetch(
                    `https://api.aniskip.com/v2/skip-times/${data?.idMal}/${parseInt(epNum)}?types[]=ed&types[]=mixed-ed&types[]=mixed-op&types[]=op&types[]=recap&episodeLength=`
                );

                const skipData = await skipResponse.json();
                const op = skipData?.results?.find((item) => item.skipType === 'op') || null;
                const ed = skipData?.results?.find((item) => item.skipType === 'ed') || null;
                const episodeLength = skipData?.results?.find((item) => item.episodeLength)?.episodeLength || 0;

                const skiptime = [];

                if (op?.interval) {
                    skiptime.push({
                        startTime: op.interval.startTime ?? 0,
                        endTime: op.interval.endTime ?? 0,
                        text: 'Opening',
                    });
                }
                if (ed?.interval) {
                    skiptime.push({
                        startTime: ed.interval.startTime ?? 0,
                        endTime: ed.interval.endTime ?? 0,
                        text: 'Ending',
                    });
                } else {
                    skiptime.push({
                        startTime: op?.interval?.endTime ?? 0,
                        endTime: episodeLength,
                        text: '',
                    });
                }

                const episode = {
                    download: download || null,
                    skiptimes: skiptime || [],
                    epId: epId || null,
                    provider: provider || null,
                    epNum: epNum || null,
                    subtype: subdub || null,
                };

                useNowPlaying.setState({ nowPlaying: episode });
                setSkipTimes(skiptime);
                // console.log(skipData);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                toast.error("Failed to load episode. Please try again later.");
                const episode = {
                    download: null,
                    skiptimes: [],
                    epId: epId || null,
                    provider: provider || null,
                    epNum: epNum || null,
                    subtype: subdub || null,
                };

                useNowPlaying.setState({ nowPlaying: episode });
                setLoading(false);
            }
        };
        fetchSources();
    }, [id, provider, epId, epNum, subdub]);

    useEffect(() => {
        if (episodeData) {
            const previousep = episodeData?.find(
                (i) => i.number === parseInt(epNum) - 1
            );
            const nextep = episodeData?.find(
                (i) => i.number === parseInt(epNum) + 1
            );
            const currentep = episodeData?.find(
                (i) => i.number === parseInt(epNum)
            );
            const epdata = {
                previousep,
                currentep,
                nextep,
            }
            setGroupedEp(epdata);
        }
    }, [episodeData, epId, provider, epNum, subdub]);

    return (
        <div className='xl:w-[99%]'>
            <div>
                <div className='mb-2'>
                    {!loading && !error ? (
                        <div className='h-full w-full aspect-video overflow-hidden'>
                            {embedSrc ? (
                                <iframe
                                    src={embedSrc}
                                    title={`${data?.title?.romaji || "Anime"} Episode ${epNum}`}
                                    className='h-full w-full border-0'
                                    allow='autoplay; fullscreen; picture-in-picture'
                                    allowFullScreen
                                    onError={tryNextServer}
                                />
                            ) : (
                                <Player dataInfo={data} id={id} groupedEp={groupedEp} session={session} savedep={historyEpisode} src={src} subtitles={subtitles} thumbnails={thumbnails} skiptimes={skiptimes} />
                            )}
                        </div>
                    ) : (
                        <div className="h-full w-full rounded-[8px] relative flex items-center text-xl justify-center aspect-video border border-solid border-white border-opacity-10">
                            {!loading && error ? (
                                <div className='text-sm sm:text-base px-2 flex flex-col items-center text-center'>
                                    <p className='mb-2 text-xl'>(╯°□°)╯︵ ɹoɹɹƎ</p>
                                    <p>Failed to load episode. Please try again later.</p>
                                    <p>If the problem persists, consider changing servers.</p>
                                </div>) : (
                                <div className="pointer-events-none absolute inset-0 z-50 flex h-full w-full items-center justify-center">
                                    <Spinner.Root className="text-white animate-spin opacity-100" size={84}>
                                        <Spinner.Track className="opacity-25" width={8} />
                                        <Spinner.TrackFill className="opacity-75" width={8} />
                                    </Spinner.Root>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {!loading && !error && playbackSources?.length > 1 && (
                    <div className='flex flex-wrap items-center gap-2 my-3 mx-2 sm:mx-1'>
                        <span className='text-sm text-[#ffffff99] mr-1'>Servers:</span>
                        {playbackSources.map((source, index) => {
                            const label = source?.server || source?.provider || `Server ${index + 1}`;
                            const selected = activeServer === label;

                            return (
                                <button
                                    key={`${label}-${source?.url || index}`}
                                    type='button'
                                    onClick={() => applySource(source, playbackSources)}
                                    className={`px-3 py-1.5 rounded-md text-sm border transition-all ${selected ? 'bg-[#4D148C] border-[#6b2caf] text-white' : 'bg-[#18181b] border-white/10 text-white/80 hover:bg-[#27272c]'}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}
                {!loading && !error && playbackSources?.length > 1 && (
                    <div className='mx-2 sm:mx-1 mb-3 flex items-center gap-2 text-xs sm:text-sm text-[#ffffff99]'>
                        <span>Source blocked or blank on this device?</span>
                        <button
                            type='button'
                            onClick={tryNextServer}
                            className='px-2.5 py-1 rounded-md border border-white/10 bg-[#18181b] text-white/90 hover:bg-[#27272c]'
                        >
                            Try next server
                        </button>
                    </div>
                )}
                <div className=' my-[9px] mx-2 sm:mx-1 px-1 lg:px-0'>
                    <h2 className='text-[20px]'>{data?.title?.[animetitle] || data?.title?.romaji}</h2>
                    <h2 className='text-[16px] text-[#ffffffb2]'>{` EPISODE ${epNum} `}</h2>
                </div>
            </div>
            <div className='w-[98%] mx-auto lg:w-full'>
                <PlayerEpisodeList id={id} data={data} setwatchepdata={setepisodeData} onprovider={provider} epnum={epNum} />
            </div>
        </div>
    )
}

export default PlayerComponent
