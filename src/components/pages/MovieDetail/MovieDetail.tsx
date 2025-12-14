import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { tmdbService } from '../../../services/tmdb';
import { mappleTVService, StreamResponse, Subtitle } from '../../../services/mappletv';
import type { MovieDetails } from '../../../types';
import { TMDB_IMAGE_BASE_URL } from '../../../utils/constants';
import { useWatchlist } from '../../../context/WatchlistContext';
import Loader from '../../common/Loader';
import HLSPlayer from '../../common/HLSPlayer';
import ContentCarousel from '../Home/ContentCarousel';
import CastCard from './CastCard';
import { FaPlay, FaPlus, FaCheck, FaStar, FaTimes, FaSpinner } from 'react-icons/fa';

const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const autoplay = searchParams.get('autoplay') === 'true';
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string>('');
  const [hlsReferer, setHlsReferer] = useState<string>('');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  // Fetch movie details
  useEffect(() => {
    const fetchMovie = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await tmdbService.getMovieDetails(id);
        setMovie(data);
        // Start playback after data loads if autoplay is set
        if (autoplay) {
          handlePlay();
        }
      } catch (err) {
        setError('Failed to fetch movie details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovie();
  }, [id]);

  // Handle play button - extract M3U8 from MappletTV
  const handlePlay = useCallback(async () => {
    if (!id) return;

    setIsPlaying(true);
    setStreamLoading(true);
    setStreamError(null);

    console.log('[MovieDetail] 🎬 Starting stream extraction for movie:', id);

    try {
      const streamResponse: StreamResponse = await mappleTVService.getStream(id, 'movie');

      console.log('[MovieDetail] Response:', streamResponse);

      if (streamResponse.success && streamResponse.m3u8Url) {
        console.log('[MovieDetail] ✅ Stream extracted successfully');
        console.log('[MovieDetail] Original M3U8:', streamResponse.m3u8Url);

        // Proxy the M3U8 URL through our backend to avoid CORS issues
        const proxiedUrl = mappleTVService.getProxiedUrl(
          streamResponse.m3u8Url,
          streamResponse.referer || 'https://mapple.uk/'
        );
        console.log('[MovieDetail] Proxied M3U8:', proxiedUrl);

        setHlsUrl(proxiedUrl);
        setHlsReferer(streamResponse.referer || 'https://mapple.uk/');
        setSubtitles(streamResponse.subtitles || []);
        setStreamLoading(false);
      } else {
        console.error('[MovieDetail] ❌ Stream extraction failed:', streamResponse.error);
        setStreamError(streamResponse.error || 'Failed to extract stream');
        setStreamLoading(false);
      }
    } catch (err) {
      console.error('[MovieDetail] Error:', err);
      setStreamError(err instanceof Error ? err.message : 'Failed to connect to scraper');
      setStreamLoading(false);
    }
  }, [id]);

  // Auto-play if URL has autoplay param
  useEffect(() => {
    if (autoplay && movie && !isPlaying) {
      handlePlay();
    }
  }, [autoplay, movie, isPlaying, handlePlay]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center text-error">
        {error || 'Movie not found.'}
      </div>
    );
  }

  const inWatchlist = isInWatchlist(movie.id);
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A';

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(movie.id);
    } else {
      addToWatchlist({ ...movie, media_type: 'movie' });
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Netflix-style Hero Section */}
      <div className="relative w-full" style={{ height: isPlaying ? '56.25vw' : '70vh', maxHeight: isPlaying ? '80vh' : '70vh' }}>

        {/* Backdrop Image or Video Player */}
        {isPlaying ? (
          <>
            {/* Stream Loading State */}
            {streamLoading && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10">
                <div className="text-white text-4xl animate-spin mb-4">
                  <FaSpinner />
                </div>
                <p className="text-white text-lg">Extracting stream...</p>
                <p className="text-text-secondary text-sm mt-2">This may take up to 60 seconds</p>
              </div>
            )}

            {/* Stream Error State */}
            {streamError && !streamLoading && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10">
                <p className="text-red-500 text-lg mb-4">{streamError}</p>
                <div className="flex gap-4">
                  <button
                    onClick={handlePlay}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => setIsPlaying(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* HLS Player */}
            {hlsUrl && !streamLoading && !streamError && (
              <HLSPlayer
                key={hlsUrl}
                src={hlsUrl}
                referer={hlsReferer}
                subtitles={subtitles}
                onBack={() => setIsPlaying(false)}
                autoPlay={true}
                title={movie.title}
              />
            )}

            {/* Close button overlay */}
            <button
              onClick={() => {
                setIsPlaying(false);
                setHlsUrl('');
                setStreamError(null);
              }}
              className="absolute top-4 right-4 z-20 p-3 rounded-full bg-surface/80 hover:bg-surface text-text-primary transition-colors"
            >
              <FaTimes size={18} />
            </button>
          </>
        ) : (
          <>
            {/* Backdrop Image */}
            {movie.backdrop_path && (
              <img
                src={`${TMDB_IMAGE_BASE_URL}/original${movie.backdrop_path}`}
                alt={movie.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
              />
            )}

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-bg-primary via-bg-primary/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-transparent to-bg-primary/30" />

            {/* Content Overlay */}
            <div className="absolute inset-0 flex items-center">
              <div className="container mx-auto px-4 md:px-8 lg:px-16">
                <div className="max-w-2xl space-y-4">
                  {/* Title */}
                  <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-heading text-white drop-shadow-lg">
                    {movie.title}
                  </h1>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-3 text-sm md:text-base text-white/90">
                    <span className="flex items-center gap-1 text-green-400 font-semibold">
                      <span className="text-yellow-400"><FaStar /></span> {movie.vote_average.toFixed(1)}
                    </span>
                    <span className="text-white/60">|</span>
                    <span>{year}</span>
                    <span className="text-white/60">|</span>
                    <span>{runtime}</span>
                    <span className="px-2 py-0.5 border border-white/40 rounded text-xs">HD</span>
                  </div>

                  {/* Genres */}
                  <div className="flex flex-wrap gap-2">
                    {movie.genres.slice(0, 4).map(genre => (
                      <span key={genre.id} className="text-sm text-white/80">
                        {genre.name}
                        {genre !== movie.genres.slice(0, 4).at(-1) && <span className="ml-2">•</span>}
                      </span>
                    ))}
                  </div>

                  {/* Overview */}
                  <p className="text-white/80 text-sm md:text-base line-clamp-3 max-w-xl">
                    {movie.overview}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-4">
                    <button
                      onClick={handlePlay}
                      className="flex items-center gap-2 px-6 md:px-8 py-3 bg-white hover:bg-white/90 text-black font-bold rounded-md transition-colors text-lg"
                    >
                      <FaPlay /> Play
                    </button>
                    <button
                      onClick={handleWatchlistToggle}
                      className="flex items-center gap-2 px-6 md:px-8 py-3 bg-gray-500/70 hover:bg-gray-500/90 text-white font-semibold rounded-md transition-colors"
                    >
                      {inWatchlist ? <FaCheck /> : <FaPlus />}
                      {inWatchlist ? 'Added' : 'My List'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 md:px-8 lg:px-16 py-8">
        {/* About Section */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-4">About {movie.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <p className="text-text-secondary leading-relaxed">{movie.overview}</p>
            </div>
            <div className="space-y-2 text-sm">
              {movie.tagline && (
                <p><span className="text-text-muted">Tagline:</span> <span className="text-white italic">"{movie.tagline}"</span></p>
              )}
              <p><span className="text-text-muted">Genres:</span> <span className="text-white">{movie.genres.map(g => g.name).join(', ')}</span></p>
              <p><span className="text-text-muted">Release:</span> <span className="text-white">{movie.release_date}</span></p>
              <p><span className="text-text-muted">Runtime:</span> <span className="text-white">{runtime}</span></p>
            </div>
          </div>
        </div>

        {/* Cast Section */}
        {movie.credits?.cast && movie.credits.cast.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">Cast</h2>
            <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
              {movie.credits.cast.slice(0, 12).map((person, index) => (
                <CastCard key={`${person.id}-${index}`} person={person} />
              ))}
            </div>
          </div>
        )}

        {/* Similar Movies */}
        {movie.similar?.results && movie.similar.results.length > 0 && (
          <div className="mb-8">
            <ContentCarousel title="More Like This" items={movie.similar.results} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieDetail;