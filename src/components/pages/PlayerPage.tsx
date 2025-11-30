import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';
import Loader from '../common/Loader';
import { FaArrowLeft } from 'react-icons/fa';

const Player: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const season = parseInt(searchParams.get('season') || '1', 10);
  const episode = parseInt(searchParams.get('episode') || '1', 10);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      if (!id || (type !== 'movie' && type !== 'tv')) {
        setError('Invalid content identifier.');
        setLoading(false);
        return;
      }

      try {
        if (type === 'movie') {
          await tmdbService.getMovieDetails(id); // Validate ID before setting stream URL
          setStreamUrl(`https://vidsrc.cc/v2/embed/movie/${id}?autoplay=1&autonext=1`);
        } else { // type is 'tv'
          await tmdbService.getTVShowDetails(id); // Validate ID
          setStreamUrl(`https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}?autoplay=1&autonext=1`);
        }
      } catch (err) {
        console.error('Player error:', err);
        setError('Content not found or failed to load.');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [type, id, season, episode]);

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-bg-primary">
            <Loader />
        </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl text-error mb-4">{error}</h2>
        <button onClick={() => navigate(-1)} className="bg-accent-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors">
          <FaArrowLeft /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="relative w-full aspect-video max-w-screen-2xl">
        <iframe
          src={streamUrl}
          className="absolute top-0 left-0 w-full h-full"
          title="Video Player"
          frameBorder="0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
        />
      </div>
    </div>
  );
};

export default Player;
