"use server";

import { getReAnimeSources } from "@/providers/reanime";
import { getDirectEmbedSources } from "@/providers/directEmbeds";

function mediaApiBase() {
  return process.env.KAGE_MEDIA_API_URL?.trim()?.replace(/\/$/, "") || null;
}

function mediaApiHeaders() {
  const headers = { Accept: "application/json" };
  const token = process.env.KAGE_MEDIA_API_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function normalizeSources(data) {
  const raw = [
    ...(Array.isArray(data?.sources) ? data.sources : []),
    ...(Array.isArray(data?.streams) ? data.streams : []),
    ...(data?.bestStream ? [data.bestStream] : []),
    ...(data?.stream_url ? [{ url: data.stream_url, type: "hls", quality: "auto" }] : []),
  ];

  const seen = new Set();

  return raw
    .map((source) => {
      const url = source?.url || source?.file;
      if (!url) return null;
      if (seen.has(url)) return null;
      seen.add(url);

      const inferredType =
        source?.type ||
        (url.includes(".m3u8") ? "hls" : url.includes(".mp4") ? "video/mp4" : "file");

      return {
        ...source,
        url,
        type: inferredType,
        quality: source?.quality || source?.label || (inferredType === "hls" ? "auto" : "default"),
      };
    })
    .filter(Boolean);
}

function normalizeTracks(data) {
  const tracks = data?.tracks || data?.subtitles || [];
  if (!Array.isArray(tracks)) return [];

  return tracks
    .map((track) => ({
      ...track,
      file: track?.file || track?.url,
      url: track?.url || track?.file,
      label: track?.label || track?.lang || track?.language || "Subtitle",
      kind: track?.kind || "subtitles",
    }))
    .filter((track) => track.file || track.url);
}

export async function getAnimeSources(id, provider, epid, epnum, subtype) {
  if (provider === "embed") {
    const direct = getDirectEmbedSources(id, epnum, subtype);
    return {
      sources: direct,
      tracks: [],
      subtitles: [],
      download: null,
    };
  }

  if (provider === "reanime") {
    const reanime = await getReAnimeSources(id, epnum, subtype);
    if (reanime?.sources?.length) {
      return {
        ...reanime,
        sources: [...reanime.sources, ...getDirectEmbedSources(id, epnum, subtype)],
      };
    }

    return {
      sources: getDirectEmbedSources(id, epnum, subtype),
      tracks: [],
      subtitles: [],
      download: null,
    };
  }

  const base = mediaApiBase();
  if (!base) {
    return {
      sources: getDirectEmbedSources(id, epnum, subtype),
      tracks: [],
      subtitles: [],
      download: null,
    };
  }

  try {
    const query = new URLSearchParams();
    if (provider) query.set("provider", provider);
    if (epid) query.set("episodeId", epid);

    const response = await fetch(
      `${base}/anime/${id}/${epnum}/${subtype}?${query.toString()}`,
      {
        headers: mediaApiHeaders(),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Media API returned ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.results || payload;
    const sources = normalizeSources(data);

    if (!sources.length) return null;

    const tracks = normalizeTracks(data);

    return {
      sources,
      tracks,
      subtitles: tracks,
      download: data?.download || data?.downloadUrl || null,
    };
  } catch (error) {
    console.error("Media source lookup failed:", error.message);
    return null;
  }
}
