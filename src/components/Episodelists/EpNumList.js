import { buildWatchUrl } from '@/utils/watch';
import React from 'react'
import Link from 'next/link'
import styles from '../../styles/Epimglist.module.css'

function EpNumList({ data, epdata, defaultProvider, subtype, epnum, playbackEnabled = true }) {
    return (
        <div className={styles.epnumlistcontainer}>
            {epdata
                .slice()
                .map((episode) => {
                    const content = (
                        <div className={`${episode.isFiller === true ? 'bg-[#f9a825]/20' : 'bg-[#67686f]/40'} ${styles.epdiv} ${parseInt(epnum) === episode.number ? styles.selectedEpnum : ''} ${!playbackEnabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
                            {data?.format === "MOVIE" && epdata.length === 1 ? "Complete Movie" : episode.number}
                        </div>
                    );

                    if (!playbackEnabled) {
                        return (
                            <div
                                key={episode?.id || episode?.episodeId || episode.number}
                                title="Playback source unavailable"
                            >
                                {content}
                            </div>
                        );
                    }

                    return (
                        <Link
                            href={buildWatchUrl({ titleId: data?.id, episodeNumber: episode.number, episodeId: episode.id || episode.episodeId, provider: defaultProvider, audio: subtype })}
                            key={episode?.id || episode?.episodeId || episode.number}
                        >
                            {content}
                        </Link>
                    );
                })}
        </div>
    )
}

export default EpNumList
