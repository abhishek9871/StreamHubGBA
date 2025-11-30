
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { vidsrcService } from '../../services/vidsrc';
import { tmdbService } from '../../services/tmdb';
import type { MovieDetails, TVShowDetails } from '../../types';
import Loader from '../common/Loader';
import { FaArrowLeft } from 'react-icons/fa';

const PlayerPage: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<MovieDetails | TVShowDetails | null>(null);
  
  const season = parseInt(searchParams.get('season') || '1', 10);
  const episode = parseInt(searchParams.get('episode') || '1', 10);

  useEffect(() => {
    const loadStream = async () => {
      setLoading(true);
      setError(null);
      if (!id || !type) {
          setError('Invalid content identifier.');
          setLoading(false);
          return;
      }

      try {
        if (type === 'movie') {
          const data = await tmdbService.getMovieDetails(id);
          setContent(data);
          setStreamUrl(vidsrcService.getMovieStreamUrl(id));
        } else if (type === 'tv') {
          const data = await tmdbService.getTVShowDetails(id);
          setContent(data);
          setStreamUrl(vidsrcService.getTvStreamUrl(id, season, episode));
        } else {
            setError('Unsupported content type.');
        }
      } catch (err) {
        console.error('Failed to load content:', err);
        setError('Could not load content. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadStream();
  }, [type, id, season, episode]);

  if (loading) {
    return (
      <div className="h-screen bg-bg-primary flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-bg-primary flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl text-error mb-4">{error}</h2>
        <button onClick={() => navigate(-1)} className="bg-accent-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors">
          <FaArrowLeft /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col">
       <div className="p-4 bg-bg-secondary flex items-center justify-between z-10">
            <div>
                {/* FIX: Use type guard to safely access 'title' or 'name' on the union type. */}
                <h1 className="text-xl font-bold">{content && ('title' in content ? content.title : content.name)}</h1>
                {type === 'tv' && <p className="text-sm text-text-muted">Season {season}, Episode {episode}</p>}
            </div>
            <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-text-primary transition-colors">
                <FaArrowLeft className="mr-2 inline" /> Back
            </button>
        </div>
      <div className="w-full flex-grow flex items-center justify-center">
        <div className="relative w-full aspect-video max-h-full">
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
    </div>
  );
};

export default PlayerPage;