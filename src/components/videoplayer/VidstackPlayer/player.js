"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/default/keyboard.css";
import { MediaPlayer, MediaProvider, Track, TextTrack, isHLSProvider } from "@vidstack/react";
import Hls from "hls.js";
import { DefaultKeyboardDisplay } from "@vidstack/react/player/layouts/default";
import { FastForwardIcon, FastBackwardIcon } from "@vidstack/react/icons";
import { useRouter } from "next/navigation";
import { useStore } from "zustand";
import { updateEp } from "@/lib/EpHistoryfunctions";
import { saveProgress } from "@/lib/AnilistUser";
import { useSettings, useTitle } from "@/lib/store";
import { buildWatchUrl, formatWatchTime, playableItemId } from "@/utils/watch";
import { readItemProgress, writeItemProgress } from "@/utils/watchProgress";
import { VideoLayout } from "./components/layouts/video-layout";
import styles from "./player.module.css";

export default function Player({
  dataInfo, id, epNum, epId, provider, subtype, itemTitle, groupedEp, source,
  session, savedep, transition, subtitles, thumbnails, skiptimes, playerRef,
}) {
  const settings = useStore(useSettings, (state) => state.settings);
  const animetitle = useStore(useTitle, (state) => state.animetitle);
  const router = useRouter();
  const [canPlay, setCanPlay] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const { currentep, nextep } = groupedEp;
  const [resumeTime] = useState(() => {
    if (transition) return 0;
    const saved = savedep?.timeWatched != null ? savedep : readItemProgress(id, playableItemId(epNum));
    const time = Number(saved?.timeWatched);
    return time > 0 && (!saved?.duration || time < saved.duration) ? time : 0;
  });
  const [showResume, setShowResume] = useState(resumeTime > 0);
  const lastPosition = useRef(null);
  const lastWrite = useRef(0);
  const appliedTransition = useRef(false);
  const aniListSaved = useRef(false);

  const saveLocalPosition = useCallback(() => {
    if (lastPosition.current) writeItemProgress(lastPosition.current);
  }, []);

  useEffect(() => {
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveLocalPosition();
    };
    window.addEventListener("pagehide", saveLocalPosition);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("pagehide", saveLocalPosition);
      document.removeEventListener("visibilitychange", saveWhenHidden);
      saveLocalPosition();
    };
  }, [saveLocalPosition]);

  useEffect(() => {
    const player = playerRef.current;
    if (!canPlay || !player || !skiptimes.length) return;

    const track = new TextTrack({ kind: "chapters", default: true, label: "Chapters" });
    for (const cue of skiptimes) {
      track.addCue(new window.VTTCue(cue.startTime, cue.endTime, cue.text));
    }
    player.textTracks.add(track);
    return () => player.textTracks.remove(track);
  }, [canPlay, playerRef, skiptimes]);

  const activeSkip = skiptimes.find((cue) => currentTime > cue.startTime && currentTime < cue.endTime);
  useEffect(() => {
    if (activeSkip && settings?.autoskip && playerRef.current?.state.started) {
      playerRef.current.currentTime = activeSkip.endTime;
    }
  }, [activeSkip, currentTime, playerRef, settings?.autoskip]);

  function recordPosition(time, flush = false) {
    const player = playerRef.current;
    const duration = player?.state.duration;
    if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return;

    lastPosition.current = {
      aniId: String(id),
      aniTitle: dataInfo?.title?.[animetitle] || dataInfo?.title?.romaji || "Anime",
      epTitle: dataInfo?.format === "MOVIE" ? itemTitle : (currentep?.title || itemTitle),
      image: currentep?.img || currentep?.image || dataInfo?.bannerImage || dataInfo?.coverImage?.extraLarge,
      epId,
      epNum: Number(epNum),
      timeWatched: time >= duration ? duration : Math.floor(time),
      duration,
      provider,
      subtype,
      nextepId: nextep?.id || nextep?.episodeId || null,
      nextepNum: nextep?.number || null,
      createdAt: new Date().toISOString(),
    };

    const now = Date.now();
    if (flush || now - lastWrite.current >= 5000) {
      lastWrite.current = now;
      saveLocalPosition();
      if (session?.user) updateEp(lastPosition.current).catch(console.error);
    }
  }

  function onTimeUpdate({ currentTime: time }) {
    setCurrentTime(time);
    if (!showResume && playerRef.current?.state.started) {
      recordPosition(time);
      const length = playerRef.current.state.duration;
      if (session?.user?.token && !aniListSaved.current && length > 0 && time >= length * 0.9) {
        aniListSaved.current = true;
        saveProgress(session.user.token, id, Number(epNum));
      }
    }
  }

  function onPause() {
    const player = playerRef.current;
    if (player?.state.started && !showResume) recordPosition(player.currentTime, true);
  }

  function onCanPlay() {
    setCanPlay(true);
    if (!transition || appliedTransition.current) return;
    appliedTransition.current = true;
    const player = playerRef.current;
    player.currentTime = Math.min(transition.time, player.state.duration);
    if (!transition.paused) player.play().catch(() => {});
  }

  function chooseResume(time) {
    const player = playerRef.current;
    if (!player?.state.canPlay) return;
    const startTime = Math.min(time, player.state.duration);
    player.currentTime = startTime;
    recordPosition(startTime, true);
    setShowResume(false);
    player.play().catch(() => {});
  }

  function onEnded() {
    recordPosition(duration, true);
    if (nextep && settings?.autonext) {
      router.push(buildWatchUrl({
        titleId: id,
        episodeNumber: nextep.number,
        episodeId: nextep.id || nextep.episodeId,
        provider,
        audio: subtype,
      }));
    }
  }

  const mediaType = source.type === "hls" ? "application/x-mpegurl" : source.type;
  return (
    <div className="relative aspect-video">
      <div ref={(element) => { if (element) element.inert = showResume; }}>
        <MediaPlayer
          ref={playerRef}
          playsInline
          aspectRatio={16 / 9}
          load={showResume || transition ? "eager" : (settings?.load || "idle")}
          muted={settings?.audio || false}
          autoPlay={!showResume && !transition && Boolean(settings?.autoplay)}
          title={itemTitle}
          className={`${styles.player} player relative`}
          crossOrigin="anonymous"
          streamType="on-demand"
          keyTarget={playerRef}
          src={{ src: source.url, type: mediaType === "file" ? "?" : mediaType }}
          onCanPlay={onCanPlay}
          onDurationChange={(length) => setDuration(length)}
          onProviderChange={(provider) => {
            if (isHLSProvider(provider)) provider.library = Hls;
          }}
          onEnded={onEnded}
          onPause={onPause}
          onTimeUpdate={onTimeUpdate}
        >
          <MediaProvider>
            {subtitles?.map((track) => <Track {...track} key={track.src} />)}
          </MediaProvider>
          {activeSkip && (
            <button
              type="button"
              className="absolute bottom-[70px] right-4 z-[40] rounded-md bg-white px-3 py-2 text-black sm:bottom-[83px]"
              onClick={() => { playerRef.current.currentTime = activeSkip.endTime; }}
            >
              Skip {activeSkip.text}
            </button>
          )}
          <VideoLayout
            subtitles={subtitles}
            thumbnails={thumbnails?.[0]?.src || ""}
            groupedEp={groupedEp}
            showPlayNext={Boolean(nextep && duration > 8 && currentTime >= duration - 8)}
          />
          <DefaultKeyboardDisplay
            icons={{
              Play: null,
              Pause: null,
              Mute: null,
              VolumeUp: null,
              VolumeDown: null,
              EnterFullscreen: null,
              ExitFullscreen: null,
              EnterPiP: null,
              ExitPiP: null,
              CaptionsOn: null,
              CaptionsOff: null,
              SeekForward: FastForwardIcon,
              SeekBackward: FastBackwardIcon,
            }}
          />
        </MediaPlayer>
      </div>
      {showResume && (
        <div role="group" aria-label="Continue watching?" className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-3 text-center">
          <p className="font-semibold">Continue watching?</p>
          <div className="flex flex-wrap justify-center gap-2 text-sm">
            <button
              type="button"
              disabled={!canPlay}
              onClick={() => chooseResume(resumeTime)}
              className="rounded-full bg-white px-4 py-2 font-semibold text-black disabled:opacity-50"
            >
              Continue from {formatWatchTime(resumeTime)}
            </button>
            <button
              type="button"
              disabled={!canPlay}
              onClick={() => chooseResume(0)}
              className="rounded-full bg-white/15 px-4 py-2 text-white disabled:opacity-50"
            >
              Start from the beginning
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
