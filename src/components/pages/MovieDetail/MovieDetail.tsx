import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { tmdbService } from '../../../services/tmdb';
import type { MovieDetails } from '../../../types';
import type { ExtractedStream } from '../../../types/stream';
import { TMDB_IMAGE_BASE_URL } from '../../../utils/constants';
import { useWatchlist } from '../../../context/WatchlistContext';
import { streamExtractor } from '../../../services/streamExtractor';
import Loader from '../../common/Loader';
import ContentCarousel from '../Home/ContentCarousel';
import CastCard from './CastCard';
import { NativePlayer } from '../../common/NativePlayer';
import { FaPlay, FaPlus, FaCheck, FaStar, FaTimes } from 'react-icons/fa';

const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const autoplay = searchParams.get('autoplay') === 'true';
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [extractedStream, setExtractedStream] = useState<ExtractedStream | null>(null);
  const [useFallbackIframe, setUseFallbackIframe] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  // Ad blocker is now handled globally in App.tsx

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
          setIsPlaying(true);
        }
      } catch (err) {
        setError('Failed to fetch movie details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovie();
  }, [id, autoplay]);

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
  const streamUrl = `https://vidsrc.cc/v2/embed/movie/${movie.id}?autoplay=1&autonext=1`;

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(movie.id);
    } else {
      addToWatchlist({ ...movie, media_type: 'movie' });
    }
  };

  // Handle play button click - attempt stream extraction
  const handlePlayClick = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      setExtractedStream(null);
      setUseFallbackIframe(false);
      return;
    }

    setIsPlaying(true);
    setExtracting(true);
    setUseFallbackIframe(false);
    setExtractedStream(null);

    try {
      console.log('[MovieDetail] Starting stream extraction for:', movie.id);
      const result = await streamExtractor.extract({
        type: 'movie',
        tmdbId: movie.id.toString(),
      });

      console.log('[MovieDetail] Extraction result:', result);

      if (result.success && result.extractedStream) {
        console.log('[MovieDetail] Using NativePlayer with m3u8:', result.extractedStream.m3u8Url.substring(0, 80));
        setExtractedStream(result.extractedStream);
        setUseFallbackIframe(false);
      } else {
        // Fallback to iframe
        console.log('[MovieDetail] Falling back to iframe');
        setUseFallbackIframe(true);
      }
    } catch (err) {
      console.error('[MovieDetail] Extraction error:', err);
      setUseFallbackIframe(true);
    } finally {
      setExtracting(false);
    }
  };

  // Close player
  const handleClosePlayer = () => {
    setIsPlaying(false);
    setExtractedStream(null);
    setUseFallbackIframe(false);
    setExtracting(false);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Netflix-style Hero Section */}
      <div className="relative w-full" style={{ height: isPlaying ? '56.25vw' : '70vh', maxHeight: isPlaying ? '80vh' : '70vh' }}>
        
        {/* Backdrop Image or Video Player */}
        {isPlaying ? (
          <>
            {/* Loading State */}
            {extracting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-white/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white">Preparing stream...</p>
                </div>
              </div>
            )}

            {/* NativePlayer when stream is extracted */}
            {extractedStream && !useFallbackIframe && (
              <div className="absolute inset-0">
                <NativePlayer
                  extracted={extractedStream}
                  title={movie.title}
                  poster={movie.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/w780${movie.backdrop_path}` : undefined}
                  autoplay={true}
                />
              </div>
            )}

            {/* Fallback iframe when extraction fails */}
            {useFallbackIframe && !extracting && (
              <iframe
                src={streamUrl}
                className="absolute inset-0 w-full h-full"
                title={movie.title}
                frameBorder="0"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="origin"
              />
            )}
            
            {/* Close button overlay */}
            <button
              onClick={handleClosePlayer}
              className="absolute top-4 right-4 z-30 p-3 rounded-full bg-surface/80 hover:bg-surface text-text-primary transition-colors"
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
                      <FaStar className="text-yellow-400" /> {movie.vote_average.toFixed(1)}
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
                      onClick={handlePlayClick}
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