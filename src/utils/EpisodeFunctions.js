export async function CombineEpisodeMeta(episodeData, imageData) {
  const episodeImages = {};

  imageData.forEach((image) => {
    episodeImages[image.number || image.episode] = image;
  });

  for (const providerEpisodes of episodeData) {
    const episodesArray = Array.isArray(providerEpisodes.episodes)
      ? providerEpisodes.episodes
      : [...(providerEpisodes.episodes.sub || []), ...(providerEpisodes.episodes.dub || [])];

    for (const episode of episodesArray) {
      const episodeNum = episode.number;
      if (episodeImages[episodeNum]) {
        const img = episodeImages[episodeNum].img || episodeImages[episodeNum].image;
        let title;
        if (typeof episodeImages[episodeNum]?.title === 'object') {
          const en = episodeImages[episodeNum]?.title?.en;
          const xJat = episodeImages[episodeNum]?.title?.['x-jat'];
          title = en || xJat || `EPISODE ${episodeNum}`;
        } else {
          title = episodeImages[episodeNum]?.title || '';
        }

        const description = episodeImages[episodeNum].description || episodeImages[episodeNum].overview || episodeImages[episodeNum].summary;
        Object.assign(episode, { img, title, description });
      }
    }
  }

  return episodeData;
}

export function ProvidersMap(episodeData, defaultProvider = null, setDefaultProvider = () => {}) {
  const providers = Array.isArray(episodeData) ? episodeData : [];
  const preferred =
    providers.find((provider) => provider?.playback === true) ||
    providers.find((provider) => provider?.episodes) ||
    null;

  const sub = Array.isArray(preferred?.episodes?.sub) ? preferred.episodes.sub : [];
  const dub = Array.isArray(preferred?.episodes?.dub) ? preferred.episodes.dub : [];

  const suboptions = [];
  if (sub.length) suboptions.push("sub");
  if (dub.length) suboptions.push("dub");
  if (!suboptions.length) suboptions.push("sub");

  const dubLength = dub.reduce(
    (max, episode) => Math.max(max, Number(episode?.number || 0)),
    0,
  );

  if (!defaultProvider && preferred?.providerId) {
    setDefaultProvider(preferred.providerId);
  }

  return { suboptions, dubLength };
}
