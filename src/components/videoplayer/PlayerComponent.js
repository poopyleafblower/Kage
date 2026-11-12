"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@vidstack/react";
import { useStore } from "zustand";
import { toast } from "sonner";
import { getAnimeSources } from "@/actions/source";
import { createWatchEp, getEpisode } from "@/lib/EpHistoryfunctions";
import { useTitle, useNowPlaying, useDataInfo } from "@/lib/store";
import { playableItemId } from "@/utils/watch";
import PlayerEpisodeList from "./PlayerEpisodeList";
import Player from "./VidstackPlayer/player";

// Audio changes navigate through the watch route, which can remount the player.
let pendingAudioSwitch;

export default function PlayerComponent(props) {
    return <WatchItem key={JSON.stringify([props.id, playableItemId(props.epNum)])} {...props} />;
}

function WatchItem({ id, epId, provider, epNum, subdub, data, session }) {
    const animetitle = useStore(useTitle, (state) => state.animetitle);
    const playerRef = useRef(null);
    const [episodeData, setEpisodeData] = useState([]);
    const [resolvedPlayback, setResolvedPlayback] = useState(null);
    const [historyEpisode, setHistoryEpisode] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(Boolean(session?.user));
    const [skiptimes, setSkipTimes] = useState([]);
    const requestKey = playbackRequestKey(id, epNum, provider, epId, subdub);

    const playback = resolvedPlayback?.requestKey === requestKey ? resolvedPlayback : null;
    const playbackSources = playback?.sources || [];
    const activeSourceIndex = playback?.index ?? 0;
    const source = playbackSources[activeSourceIndex];
    const embedSrc = source?.type === "embed" ? source.url : null;
    const loading = !playback || (historyLoading && !embedSrc && Boolean(source));
    const error = Boolean(playback && !source);
    const transition = playback?.transition;
    const currentep = episodeData.find((episode) => Number(episode.number) === Number(epNum));
    const isMovie = data?.format === "MOVIE" && (data?.episodes || episodeData.length || 1) === 1;
    const itemTitle = isMovie ? "Complete Movie" : `Episode ${epNum}`;
    const groupedEp = {
        currentep,
        previousep: isMovie ? undefined : episodeData.find((episode) => Number(episode.number) === Number(epNum) - 1),
        nextep: isMovie ? undefined : episodeData.find((episode) => Number(episode.number) === Number(epNum) + 1),
    };

    function capturePosition() {
        const player = playerRef.current;
        if (!player?.state.canPlay || !source || embedSrc) return null;
        if (!player.state.started && player.currentTime === 0) return null;
        return {
            source,
            time: player.currentTime,
            paused: player.paused,
        };
    }

    function prepareAudioSwitch(nextProvider, nextEpisodeId, audio) {
        pendingAudioSwitch = {
            requestKey: playbackRequestKey(id, epNum, nextProvider, nextEpisodeId, audio),
            position: capturePosition(),
            expiresAt: Date.now() + 30_000,
        };
    }

    function selectSource(index) {
        if (index === activeSourceIndex) return;
        setResolvedPlayback({
            ...playback,
            index,
            transition: getTransition(capturePosition(), playbackSources[index]),
        });
    }

    function tryNextServer() {
        if (playbackSources.length > 1) {
            selectSource((activeSourceIndex + 1) % playbackSources.length);
        }
    }

    useEffect(() => {
        if (!session?.user) return;
        let cancelled = false;
        async function loadHistory() {
            try {
                const episode = await getEpisode(id, epNum);
                if (!cancelled) setHistoryEpisode(episode?.[0] || null);
            } finally {
                if (!cancelled) setHistoryLoading(false);
            }
        }
        loadHistory().catch(() => {});
        createWatchEp(id, epNum, {
            aniTitle: data?.title?.english || data?.title?.romaji || "Anime",
            epTitle: itemTitle,
            image: data?.bannerImage || data?.coverImage?.extraLarge || "",
            epId,
            provider,
            subtype: subdub,
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [session?.user, id, epNum, epId, provider, subdub, itemTitle, data]);

    useEffect(() => {
        let cancelled = false;
        useDataInfo.setState({ dataInfo: data });
        async function loadPlayback() {
            let response;
            try {
                response = await getAnimeSources(id, provider, epId, epNum, subdub);
            } catch (error) {
                console.error("Error fetching playback:", error);
            }
            if (cancelled) return;

            const sources = response?.sources || [];
            const preferred = sources.find((item) => item.type !== "embed" && ["default", "auto"].includes(item.quality))
                || sources.find((item) => item.type !== "embed" && item.quality === "1080p")
                || sources.find((item) => item.type !== "embed")
                || sources[0];
            if (!preferred) toast.error("No playable source is available for this item.");

            const tracks = (response?.tracks || response?.subtitles || []).map((track) => ({
                src: track.file || track.url,
                label: track.label || track.lang,
                kind: track.kind || (track.lang === "Thumbnails" ? "thumbnails" : "subtitles"),
                default: track.default || track.lang === "English",
            }));
            useNowPlaying.setState({
                nowPlaying: { download: response?.download || null, epId, provider, epNum, subtype: subdub },
            });
            const audioSwitch = pendingAudioSwitch?.requestKey === requestKey ? pendingAudioSwitch : null;
            if (audioSwitch) pendingAudioSwitch = undefined;
            setResolvedPlayback({
                requestKey,
                sources,
                index: sources.indexOf(preferred),
                transition: getTransition(audioSwitch?.expiresAt >= Date.now() ? audioSwitch.position : null, preferred),
                subtitles: tracks.filter((track) => track.kind !== "thumbnails"),
                thumbnails: tracks.filter((track) => track.kind === "thumbnails"),
            });
        }
        loadPlayback();
        return () => { cancelled = true; };
    }, [data, epId, epNum, id, provider, requestKey, subdub]);

    useEffect(() => {
        if (!data?.idMal) return;
        const controller = new AbortController();
        async function loadSkipTimes() {
            const response = await fetch(
                `https://api.aniskip.com/v2/skip-times/${data.idMal}/${epNum}?types[]=op&types[]=ed&episodeLength=`,
                { signal: controller.signal },
            );
            if (!response.ok) return;
            const result = await response.json();
            setSkipTimes((result.results || []).filter((item) => item.interval).map((item) => ({
                startTime: item.interval.startTime,
                endTime: item.interval.endTime,
                text: item.skipType === "op" ? "Opening" : "Ending",
            })));
        }
        loadSkipTimes().catch(() => {});
        return () => controller.abort();
    }, [data?.idMal, epNum]);

    return (
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,30%)]'>
            <div className='min-w-0'>
                <div className='mb-2'>
                    {!loading && !error ? (
                        <div className='h-full w-full aspect-video overflow-hidden'>
                            {embedSrc ? (
                                <iframe
                                    src={embedSrc}
                                    title={`${data?.title?.romaji || "Anime"} ${itemTitle}`}
                                    className='h-full w-full border-0'
                                    allow='autoplay; fullscreen; picture-in-picture'
                                    allowFullScreen
                                    onError={tryNextServer}
                                />
                            ) : (
                                <Player
                                    key={JSON.stringify([requestKey, source.url])}
                                    playerRef={playerRef}
                                    dataInfo={data}
                                    id={id}
                                    epNum={epNum}
                                    epId={epId}
                                    provider={provider}
                                    subtype={subdub}
                                    itemTitle={itemTitle}
                                    groupedEp={groupedEp}
                                    session={session}
                                    savedep={historyEpisode}
                                    source={source}
                                    transition={transition}
                                    subtitles={playback.subtitles}
                                    thumbnails={playback.thumbnails}
                                    skiptimes={skiptimes}
                                />
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
                            const selected = activeSourceIndex === index;

                            return (
                                <button
                                    key={`${label}-${source?.url || index}`}
                                    type='button'
                                    aria-pressed={selected}
                                    onClick={() => selectSource(index)}
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
                    <h2 className='text-[16px] text-[#ffffffb2]'>{itemTitle}</h2>
                </div>
            </div>
            <aside aria-label='Episode picker' className='min-w-0 lg:max-h-[80vh] lg:overflow-y-auto'>
                <PlayerEpisodeList id={id} data={data} setwatchepdata={setEpisodeData} onprovider={provider} onSubtype={subdub} epnum={epNum} itemTitle={itemTitle} onBeforeSourceChange={prepareAudioSwitch} />
            </aside>
        </div>
    )
}

function playbackRequestKey(id, epNum, provider, episodeId, audio) {
    return JSON.stringify([String(id), playableItemId(epNum), provider, episodeId, audio]);
}

function getTransition(position, source) {
    if (!position || !source || source.type === "embed") return null;
    const sameTimeline = position.source.url === source.url ||
        (source.timelineId && position.source.timelineId === source.timelineId);
    return { time: sameTimeline ? position.time : 0, paused: position.paused };
}
