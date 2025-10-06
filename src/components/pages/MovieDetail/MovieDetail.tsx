
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tmdbService } from '../../../services/tmdb';
import type { MovieDetails } from '../../../types';
import { TMDB_IMAGE_BASE_URL } from '../../../utils/constants';
import { useWatchlist } from '../../../context/WatchlistContext';
import Loader from '../../common/Loader';
import Button from '../../common/Button';
import ContentCarousel from '../Home/ContentCarousel';
import CastCard from './CastCard';
import { FaPlay, FaHeart, FaRegHeart, FaStar, FaClock, FaCalendarAlt } from 'react-icons/fa';

const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  useEffect(() => {
    const fetchMovie = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await tmdbService.getMovieDetails(id);
        setMovie(data);
      } catch (err) {
        setError('Failed to fetch movie details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovie();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader /></div>;
  }

  if (error || !movie) {
    return <div className="min-h-screen flex items-center justify-center text-error">{error || 'Movie not found.'}</div>;
  }

  const inWatchlist = isInWatchlist(movie.id);

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(movie.id);
    } else {
      addToWatchlist({ ...movie, media_type: 'movie' });
    }
  };

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A';

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Hero Section */}
      <div className="relative h-[50vh] md:h-[70vh]">
        {movie.backdrop_path && (
            <img
            src={`${TMDB_IMAGE_BASE_URL}/original${movie.backdrop_path}`}
            alt={movie.title}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/80 to-transparent"></div>
        <div className="relative z-10 container mx-auto px-4 h-full flex flex-col md:flex-row items-end pb-8 gap-8">
          <div className="w-48 md:w-64 flex-shrink-0 -mb-16 md:mb-0">
             {movie.poster_path && (
                <img
                    src={`${TMDB_IMAGE_BASE_URL}/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="rounded-lg shadow-2xl"
                />
             )}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-5xl font-bold font-heading">{movie.title}</h1>
            {movie.tagline && <p className="text-text-muted italic">"{movie.tagline}"</p>}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-text-secondary">
              <div className="flex items-center gap-1"><FaStar className="text-yellow-400" /> {movie.vote_average.toFixed(1)}</div>
              <div className="flex items-center gap-1"><FaCalendarAlt /> {year}</div>
              <div className="flex items-center gap-1"><FaClock /> {runtime}</div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {movie.genres.map(genre => (
                <span key={genre.id} className="text-xs bg-surface px-2 py-1 rounded">{genre.name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold font-heading mb-4">Overview</h2>
            <p className="text-text-secondary leading-relaxed">{movie.overview}</p>
            
            {movie.credits?.cast && movie.credits.cast.length > 0 && (
              <div className="mt-12">
                 <h2 className="text-2xl font-bold font-heading mb-4">Cast</h2>
                 <div className="flex overflow-x-auto space-x-4 pb-4 scrollbar-thin">
                   {movie.credits.cast.slice(0, 15).map(person => (
                     <CastCard key={person.id} person={person} />
                   ))}
                 </div>
              </div>
            )}
          </div>
          
          <div className="md:col-span-1">
             <div className="flex flex-col gap-4">
                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    icon={FaPlay}
                    onClick={() => navigate(`/play/movie/${movie.id}`)}
                >
                    Play Now
                </Button>
                <Button
                    variant="outline"
                    size="lg"
                    fullWidth
                    icon={inWatchlist ? FaHeart : FaRegHeart}
                    onClick={handleWatchlistToggle}
                >
                    {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                </Button>
             </div>
          </div>
        </div>
         
         {movie.similar?.results && movie.similar.results.length > 0 && (
            <div className="mt-12">
                <ContentCarousel title="Similar Movies" items={movie.similar.results} />
            </div>
         )}
      </div>
    </div>
  );
};

export default MovieDetail;
