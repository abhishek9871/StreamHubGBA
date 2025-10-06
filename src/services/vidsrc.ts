
import { VIDSRC_BASE_URL } from '../utils/constants';

export const vidsrcService = {
  getMovieStreamUrl: (tmdbId: string): string => {
    return `${VIDSRC_BASE_URL}/movie/${tmdbId}?autoplay=1&autonext=1`;
  },
  getTvStreamUrl: (tmdbId: string, season: number, episode: number): string => {
    return `${VIDSRC_BASE_URL}/tv/${tmdbId}/${season}/${episode}?autoplay=1&autonext=1`;
  },
};