function normalizeAudio(audio) {
  return audio === "dub" ? "dub" : "sub";
}

export function getDirectEmbedSources(anilistId, episode, audio = "sub") {
  const lang = normalizeAudio(audio);
  const id = encodeURIComponent(anilistId);
  const ep = encodeURIComponent(episode);

  return [
    {
      url: `https://megaplay.buzz/stream/ani/${id}/${ep}/${lang}?autoplay=1`,
      type: "embed",
      server: "MegaPlay",
      quality: "embed",
    },
    {
      url: `https://tryembed.us.cc/embed/anime/${id}/${ep}/${lang}?autoSkip=true&autoPlay=true&autoNext=true`,
      type: "embed",
      server: "TryEmbed",
      quality: "embed",
    },
  ];
}
