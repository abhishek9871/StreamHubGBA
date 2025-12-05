import React, { useState, useEffect, useRef } from 'react';
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
  const [showClickShield, setShowClickShield] = useState(true);
  const [clickCount, setClickCount] = useState(0);
  const lastBlurTime = useRef<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const clickShieldTimeout = useRef<NodeJS.Timeout | null>(null);

  const season = parseInt(searchParams.get('season') || '1', 10);
  const episode = parseInt(searchParams.get('episode') || '1', 10);

  // CRITICAL: Iframe click shield to prevent ads from detecting clicks
  // This transparent overlay captures clicks BEFORE they reach the iframe
  useEffect(() => {
    // Show shield for first 3 seconds after load (prevents initial ad popups)
    const initialShieldTimer = setTimeout(() => {
      setShowClickShield(false);
    }, 3000);

    return () => clearTimeout(initialShieldTimer);
  }, [streamUrl]);

  // Handle clicks on the click shield
  const handleShieldClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setClickCount(prev => prev + 1);

    console.log('[VideoProtection] Click intercepted on shield, count:', clickCount + 1);

    // On first 2 clicks, allow interaction to reach iframe (for play/fullscreen)
    // But only briefly, then block again
    if (clickCount < 2) {
      setShowClickShield(false);

      // Re-enable shield after 500ms (after video control interaction completes)
      if (clickShieldTimeout.current) {
        clearTimeout(clickShieldTimeout.current);
      }

      clickShieldTimeout.current = setTimeout(() => {
        setShowClickShield(true);
        console.log('[VideoProtection] Click shield re-enabled');
      }, 500);
    } else {
      // After 2 clicks, always keep shield up (video is already playing)
      console.log('[VideoProtection] Blocked click - video already active');
    }
  };

  // Popup/Ad detection: When window loses focus (popup opened), refocus immediately
  useEffect(() => {
    const handleBlur = () => {
      const now = Date.now();
      if (now - lastBlurTime.current > 200) {
        lastBlurTime.current = now;
        console.log('[VideoProtection] Window blur detected - refocusing');
        setTimeout(() => window.focus(), 10);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[VideoProtection] Tab hidden - refocusing');
        setTimeout(() => window.focus(), 10);
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (clickShieldTimeout.current) {
        clearTimeout(clickShieldTimeout.current);
      }
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
        {/* Video iframe */}
        <iframe
          ref={iframeRef}
          src={streamUrl}
          className="absolute top-0 left-0 w-full h-full"
          title="Video Player"
          frameBorder="0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
          style={{ pointerEvents: showClickShield ? 'none' : 'auto' }}
        />

        {/* CRITICAL: Click shield overlay - prevents iframe ads from detecting clicks */}
        {showClickShield && (
          <div
            onClick={handleShieldClick}
            onTouchEnd={handleShieldClick}
            className="absolute top-0 left-0 w-full h-full z-10 cursor-pointer"
            style={{
              background: 'transparent',
              pointerEvents: 'auto',
            }}
            title="Click to play video"
          />
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
