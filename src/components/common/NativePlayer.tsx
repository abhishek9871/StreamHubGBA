import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { ExtractedStream } from '../../types/stream';
import './NativePlayer.css';

interface NativePlayerProps {
  extracted: ExtractedStream;
  title?: string;
  poster?: string;
  autoplay?: boolean;
}

export const NativePlayer: React.FC<NativePlayerProps> = ({
  extracted,
  title = 'Video Player',
  poster,
  autoplay = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [quality, setQuality] = useState<number>(-1); // -1 = auto
  const [qualities, setQualities] = useState<Array<{ index: number; height: number; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current || !extracted.m3u8Url) return;

    const video = videoRef.current;
    setLoading(true);
    setError(null);

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    try {
      // Prefer hls.js when supported (Chrome, Firefox, Edge)
      // Only use native HLS on Safari/iOS where hls.js doesn't work
      if (Hls.isSupported()) {
        console.log('[NativePlayer] Initializing hls.js with URL:', extracted.m3u8Url.substring(0, 80));
        initHls(video);
        return;
      }
      
      // Fallback: Check if browser has native HLS support (Safari, iOS)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('[NativePlayer] Using native Safari HLS support');
        video.src = extracted.m3u8Url;
        video.play().catch(err => console.error('Play error:', err));
        setLoading(false);
        return;
      }

      // No HLS support at all
      setError('HLS streaming not supported in your browser');
      setLoading(false);
      return;
    } catch (err) {
      console.error('[NativePlayer] Setup error:', err);
      setError(String(err));
      setLoading(false);
    }

    function initHls(video: HTMLVideoElement) {

      console.log('[NativePlayer] Initializing hls.js with URL:', extracted.m3u8Url.substring(0, 80));

      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        maxLoadingDelay: 4,
        minAutoBitrate: 0,
        xhrSetup: (xhr, url) => {
          // Add required headers for m3u8 requests
          if (extracted.headers?.Referer) {
            // Note: Some headers may be blocked by browser CORS policy
            // The worker proxy handles this server-side
          }
        },
      });

      // Attach to video
      hls.attachMedia(video);

      // Listen for manifest parsed
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        console.log('[NativePlayer] Manifest parsed, levels:', data.levels.length);

        // Build quality list
        const qualityList = data.levels.map((level, index) => ({
          index,
          height: level.height || 0,
          label: level.height ? `${level.height}p` : `Level ${index}`
        }));

        setQualities(qualityList);
        setQuality(-1); // Start with auto
        setLoading(false);

        // Auto-play
        if (autoplay) {
          video.play().catch(err => console.error('Play error:', err));
        }
      });

      // Error handling
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[NativePlayer] HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('[NativePlayer] Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[NativePlayer] Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              setError(`Playback error: ${data.type}`);
              hls.destroy();
              break;
          }
        }
      });

      // Load source
      hls.loadSource(extracted.m3u8Url);
      hlsRef.current = hls;
    }

    // Cleanup
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [extracted.m3u8Url, autoplay]);

  // Handle quality change
  useEffect(() => {
    if (!hlsRef.current) return;

    if (quality === -1) {
      hlsRef.current.currentLevel = -1;
      console.log('[NativePlayer] Switched to AUTO quality');
    } else {
      hlsRef.current.currentLevel = quality;
      console.log(`[NativePlayer] Switched to quality level ${quality}`);
    }
  }, [quality]);

  if (error) {
    return (
      <div className="native-player native-player--error">
        <div className="native-player__error-message">
          <span className="native-player__error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="native-player">
      <div className="native-player__container">
        {loading && (
          <div className="native-player__loading">
            <div className="native-player__spinner"></div>
            <span>Loading stream...</span>
          </div>
        )}

        <video
          ref={videoRef}
          className="native-player__video"
          controls
          poster={poster}
          title={title}
          crossOrigin="anonymous"
          playsInline
        />

        {/* Quality Selector */}
        {qualities.length > 1 && !loading && (
          <div className="native-player__quality-selector">
            <label htmlFor="quality-select">Quality:</label>
            <select
              id="quality-select"
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value))}
              className="native-player__quality-select"
            >
              <option value={-1}>Auto</option>
              {qualities.map(q => (
                <option key={q.index} value={q.index}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Subtitles Indicator */}
        {extracted.subtitles && extracted.subtitles.length > 0 && (
          <div className="native-player__subtitles-info">
            📝 {extracted.subtitles.length} subtitle(s) available
          </div>
        )}

        {/* Server Info */}
        <div className="native-player__info">
          <small>
            Provider: {extracted.provider} ({extracted.serverName})
          </small>
        </div>
      </div>
    </div>
  );
};

export default NativePlayer;
