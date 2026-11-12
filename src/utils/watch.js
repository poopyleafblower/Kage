export function playableItemId(episodeNumber) {
  // The catalog episode number stays the same across providers and audio renditions.
  return String(Number(episodeNumber));
}

export function buildWatchUrl({ titleId, episodeNumber, episodeId, provider, audio = "sub" }) {
  const item = playableItemId(episodeNumber);
  const query = new URLSearchParams({
    id: String(titleId),
    ep: item,
    epid: episodeId || `${titleId}/${audio}/${item}`,
    type: audio,
  });
  if (provider) query.set("host", provider);
  return `/anime/watch?${query}`;
}

export function formatWatchTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
