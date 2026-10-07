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
      url: `https://anixo.buzz/embed/ani/${id}/${ep}?track=${lang}&autoSkipIntro=1&autoSkipOutro=1`,
      type: "embed",
      server: "AniXo",
      quality: "embed",
    },
    {
      url: `https://megavid.buzz/ani/${id}/${ep}/${lang}?color=%23CA1313&autoplay=true`,
      type: "embed",
      server: "Megavid",
      quality: "embed",
    },
    {
      url: `https://ani.megaplay.su/ani/${id}/${ep}/${lang}?color=%23CA1313&autoplay=true`,
      type: "embed",
      server: "Anime Player",
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
