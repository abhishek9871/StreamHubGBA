import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';
import Loader from '../common/Loader';
import { FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import { createClickShield, ClickShield } from '../../utils/clickShield';

/**
 * ULTRA-PROTECTED VIDEO PLAYER
 *
 * Multi-layer ad protection:
 * 1. Global ad blocker (App.tsx) - blocks window.open, suspicious links
 * 2. Click shield (this component) - time-based intelligent click blocking
 * 3. Focus recovery - auto-refocus on popup attempts
 * 4. Mobile optimization - enhanced protection for touch devices
 *
 * NO CUSTOM CONTROLS - Users interact with native vidsrc player
 * The shield intelligently allows/blocks clicks to prevent ad hijacking
 */

const Player: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Click shield state
  const [shieldActive, setShieldActive] = useState(true);
  const [showShieldUI, setShowShieldUI] = useState(true);
  const clickShieldRef = useRef<ClickShield | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Popup detection
  const [popupsBlocked, setPopupsBlocked] = useState(0);
  const [showPopupNotification, setShowPopupNotification] = useState(false);
  const popupNotificationTimeout = useRef<NodeJS.Timeout | null>(null);

  // Mobile detection
  const [isMobile] = useState(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  });

  const season = parseInt(searchParams.get('season') || '1', 10);
  const episode = parseInt(searchParams.get('episode') || '1', 10);

  // Initialize click shield
  useEffect(() => {
    if (!clickShieldRef.current) {
      clickShieldRef.current = createClickShield(isMobile, () => {
        // Popup detected callback
        handlePopupDetected();
      });

      console.log('[Player] 🛡️ Click shield initialized', {
        isMobile,
        mode: isMobile ? 'MOBILE (extra protection)' : 'DESKTOP',
      });
    }
  }, [isMobile]);

  // Handle popup detection from global ad blocker
  const handlePopupDetected = () => {
    console.log('[Player] 🚨 POPUP DETECTED - Resetting protection');

    // Increment counter
    setPopupsBlocked((prev) => prev + 1);

    // Reset click shield (resets trust, re-enables blocking)
    if (clickShieldRef.current) {
      clickShieldRef.current.onPopupDetected();
    }

    // Enable shield
    setShieldActive(true);
    setShowShieldUI(true);

    // Show notification
    setShowPopupNotification(true);
    if (popupNotificationTimeout.current) {
      clearTimeout(popupNotificationTimeout.current);
    }
    popupNotificationTimeout.current = setTimeout(() => {
      setShowPopupNotification(false);
    }, 3000);
  };

  // Load video content
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
          await tmdbService.getMovieDetails(id);
          setStreamUrl(`https://vidsrc.cc/v2/embed/movie/${id}?autoplay=1&autonext=1`);
        } else {
          await tmdbService.getTVShowDetails(id);
          setStreamUrl(
            `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}?autoplay=1&autonext=1`
          );
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

  // Reset shield when video changes
  useEffect(() => {
    if (streamUrl && clickShieldRef.current) {
      console.log('[Player] 📺 New video loaded, resetting shield');
      clickShieldRef.current.onIframeLoad();
      setShieldActive(true);
      setShowShieldUI(true);
    }
  }, [streamUrl]);

  // Auto-hide shield UI after initial grace period (if trust builds)
  useEffect(() => {
    if (!streamUrl) return;

    // Hide shield UI after 10 seconds IF no popups detected
    const timer = setTimeout(() => {
      if (clickShieldRef.current) {
        const stats = clickShieldRef.current.getStats();
        if (stats.trustLevel > 40) {
          setShowShieldUI(false);
          console.log('[Player] 🔓 Shield UI hidden (high trust)');
        }
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [streamUrl]);

  // Handle click on shield
  const handleShieldClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!clickShieldRef.current) return;

    const result = clickShieldRef.current.handleClick();

    console.log('[Player] 🖱️ Shield clicked:', {
      shouldBlock: result.shouldBlock,
      shouldAllowTemporarily: result.shouldAllowTemporarily,
      stats: clickShieldRef.current.getStats(),
    });

    if (result.shouldBlock) {
      // Click blocked - keep shield active
      setShieldActive(true);

      // Show brief feedback
      console.log('[Player] ⛔ Click blocked for protection');
    } else if (result.shouldAllowTemporarily) {
      // Allow interaction - disable shield BRIEFLY
      setShieldActive(false);

      // Re-enable shield after short delay (enough time for video interaction)
      clickShieldRef.current.reenableShieldAfterDelay(1000);

      // Update UI
      setTimeout(() => {
        if (clickShieldRef.current) {
          const state = clickShieldRef.current.getState();
          setShieldActive(state.isShieldActive);
        }
      }, 1100);
    }
  };

  // Focus recovery (catches popup attempts)
  useEffect(() => {
    let lastBlurTime = 0;

    const handleBlur = () => {
      const now = Date.now();
      if (now - lastBlurTime > 200) {
        lastBlurTime = now;
        console.log('[Player] 👁️ Window blur detected - possible popup');

        // Refocus
        setTimeout(() => {
          window.focus();
          handlePopupDetected();
        }, 10);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Player] 👁️ Tab hidden - possible popup');
        setTimeout(() => {
          window.focus();
          handlePopupDetected();
        }, 10);
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (popupNotificationTimeout.current) {
        clearTimeout(popupNotificationTimeout.current);
      }
    };
  }, []);

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
        <button
          onClick={() => navigate(-1)}
          className="bg-accent-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors"
        >
          <FaArrowLeft /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
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
          style={{
            pointerEvents: shieldActive ? 'none' : 'auto',
          }}
        />

        {/* INTELLIGENT CLICK SHIELD - Transparent overlay */}
        {shieldActive && (
          <div
            onClick={handleShieldClick}
            onTouchEnd={handleShieldClick}
            className="absolute top-0 left-0 w-full h-full z-10 cursor-pointer"
            style={{
              background: showShieldUI
                ? 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 100%)'
                : 'transparent',
              pointerEvents: 'auto',
              transition: 'background 0.3s ease',
            }}
            title="Click to start video (protected mode)"
          >
            {/* Shield indicator (only show during initial protection) */}
            {showShieldUI && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="bg-surface/90 backdrop-blur-sm rounded-lg p-6 shadow-2xl">
                  <FaShieldAlt className="text-accent-primary text-4xl mx-auto mb-3 animate-pulse" />
                  <p className="text-white text-lg font-semibold mb-1">
                    Protected Mode
                  </p>
                  <p className="text-text-secondary text-sm">
                    {isMobile ? 'Tap' : 'Click'} to start video
                  </p>
                  <p className="text-text-muted text-xs mt-2">
                    Ad blocker active
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back button - always accessible */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-20 bg-surface/80 hover:bg-surface text-text-primary px-3 py-2 rounded-lg flex items-center gap-2 transition-colors backdrop-blur-sm"
        >
          <FaArrowLeft size={14} />
          <span className="text-sm hidden sm:inline">Back</span>
        </button>

        {/* Popup blocked notification */}
        {showPopupNotification && (
          <div className="absolute top-4 right-4 z-20 bg-error/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <FaShieldAlt className="text-white" />
              <span className="text-sm font-semibold">
                Ad blocked ({popupsBlocked})
              </span>
            </div>
          </div>
        )}

        {/* Debug info (only in development) */}
        {process.env.NODE_ENV === 'development' && clickShieldRef.current && (
          <div className="absolute bottom-4 left-4 z-20 bg-surface/90 backdrop-blur-sm text-text-secondary text-xs p-3 rounded-lg font-mono">
            <div>Clicks: {clickShieldRef.current.getStats().totalClicks}</div>
            <div>Blocked: {clickShieldRef.current.getStats().blockedClicks}</div>
            <div>Trust: {clickShieldRef.current.getStats().trustLevel}%</div>
            <div>Shield: {shieldActive ? 'ACTIVE' : 'DISABLED'}</div>
            <div>Popups: {popupsBlocked}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Player;
