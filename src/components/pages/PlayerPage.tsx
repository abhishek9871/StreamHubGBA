import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';
import Loader from '../common/Loader';
import { FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';

const Player: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adsBlocked, setAdsBlocked] = useState(0);
  const [showAdBlockNotice, setShowAdBlockNotice] = useState(false);
  const lastBlurTime = useRef<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const season = parseInt(searchParams.get('season') || '1', 10);
  const episode = parseInt(searchParams.get('episode') || '1', 10);

  // Popup/Ad detection: When window loses focus (popup opened), refocus immediately
  useEffect(() => {
    const handleBlur = () => {
      const now = Date.now();
      // Debounce: only count as ad if blur happens within interaction context
      if (now - lastBlurTime.current > 500) {
        lastBlurTime.current = now;
        
        // Immediately try to refocus our window
        setTimeout(() => {
          window.focus();
          setAdsBlocked(prev => {
            const newCount = prev + 1;
            // Show notice briefly on first few blocks
            if (newCount <= 3) {
              setShowAdBlockNotice(true);
              setTimeout(() => setShowAdBlockNotice(false), 2000);
            }
            return newCount;
          });
        }, 100);
      }
    };

    const handleVisibilityChange = () => {
      // If tab becomes hidden due to popup, try to regain focus
      if (document.hidden) {
        setTimeout(() => window.focus(), 100);
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
        {/* Video iframe - no overlay, full interactivity */}
        <iframe
          ref={iframeRef}
          src={streamUrl}
          className="absolute top-0 left-0 w-full h-full"
          title="Video Player"
          frameBorder="0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
        />
        
        {/* Subtle notification when popup ad is blocked */}
        {showAdBlockNotice && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-surface/95 text-text-primary px-4 py-2 rounded-lg shadow-lg animate-fade-in-down">
            <FaShieldAlt className="text-accent-primary" />
            <span className="text-sm">Ad blocked ({adsBlocked})</span>
          </div>
        )}
        
        {/* Back button overlay - always visible in corner */}
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-4 left-4 z-20 bg-surface/80 hover:bg-surface text-text-primary px-3 py-2 rounded-lg flex items-center gap-2 transition-colors backdrop-blur-sm"
        >
          <FaArrowLeft size={14} />
          <span className="text-sm hidden sm:inline">Back</span>
        </button>
      </div>
    </div>
  );
};

export default Player;
