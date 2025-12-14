import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';
import { mappleTVService, StreamResponse, Subtitle } from '../../services/mappletv';
import HLSPlayer from '../common/HLSPlayer';
import Loader from '../common/Loader';
import { FaArrowLeft, FaExclamationTriangle, FaSync } from 'react-icons/fa';

type PlayerMode = 'loading' | 'hls' | 'error';

const Player: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // State
  const [mode, setMode] = useState<PlayerMode>('loading');
  const [hlsUrl, setHlsUrl] = useState<string>('');
  const [hlsReferer, setHlsReferer] = useState<string>('');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading stream...');

  const extractionStartTime = useRef<number>(0);

  const season = parseInt(searchParams.get('season') || '1', 10);
  const episode = parseInt(searchParams.get('episode') || '1', 10);

  // Main content loader
  const loadContent = useCallback(async () => {
    if (!id || (type !== 'movie' && type !== 'tv')) {
      setError('Invalid content identifier.');
      setMode('error');
      return;
    }

    setMode('loading');
    setError(null);
    setLoadingMessage('Fetching content details...');
    extractionStartTime.current = Date.now();

    try {
      // Get content details for title
      if (type === 'movie') {
        const details = await tmdbService.getMovieDetails(id);
        setTitle(details.title || 'Movie');
      } else {
        const details = await tmdbService.getTVShowDetails(id);
        setTitle(`${details.name || 'TV Show'} - S${season}E${episode}`);
      }

      // MappletTV HLS extraction
      setLoadingMessage('Extracting stream (this may take up to 60 seconds)...');
      console.log('[Player] 🎬 Attempting HLS extraction via MappletTV...');
      console.log('[Player] TMDB ID:', id, 'Type:', type);

      const streamResponse: StreamResponse = await mappleTVService.getStream(
        id,
        type,
        type === 'tv' ? season : undefined,
        type === 'tv' ? episode : undefined
      );

      const extractionTime = Date.now() - extractionStartTime.current;
      console.log(`[Player] Extraction completed in ${extractionTime}ms`);
      console.log('[Player] Response:', JSON.stringify(streamResponse, null, 2));

      if (streamResponse.success && streamResponse.m3u8Url) {
        console.log('[Player] ✅ HLS stream extracted successfully');
        console.log('[Player] M3U8 URL:', streamResponse.m3u8Url);
        console.log('[Player] Qualities:', streamResponse.qualities);
        console.log('[Player] Subtitles:', streamResponse.subtitles?.length || 0);

        setHlsUrl(streamResponse.m3u8Url);
        setHlsReferer(streamResponse.referer || 'https://mapple.uk/');
        setSubtitles(streamResponse.subtitles || []);
        setMode('hls');
      } else {
        // Show error - no iframe fallback
        console.error('[Player] ❌ HLS extraction failed:', streamResponse.error);
        setError(streamResponse.error || 'Failed to extract stream. Please try again.');
        setMode('error');
      }

    } catch (err) {
      console.error('[Player] Error during extraction:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setMode('error');
    }
  }, [id, type, season, episode]);

  // Retry extraction
  const handleRetry = () => {
    loadContent();
  };

  // Initial load
  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Render loading state
  if (mode === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary text-white">
        <Loader />
        <p className="mt-4 text-text-secondary">{loadingMessage}</p>
        <p className="mt-2 text-text-muted text-sm">Extracting highest quality source from MappletTV</p>

        {/* Back button during loading */}
        <button
          onClick={() => navigate(-1)}
          className="mt-8 bg-surface text-text-secondary px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <FaArrowLeft size={14} /> Cancel
        </button>
      </div>
    );
  }

  // Render error state
  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center text-center p-4">
        <div className="text-error text-5xl mb-4">
          <FaExclamationTriangle />
        </div>
        <h2 className="text-2xl text-error mb-2">Stream Extraction Failed</h2>
        <p className="text-text-secondary mb-6 max-w-md">{error || 'Failed to extract the video stream. The backend scraper might be unavailable.'}</p>
        <div className="flex gap-4">
          <button
            onClick={handleRetry}
            className="bg-accent-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors"
          >
            <FaSync /> Retry
          </button>
          <button
            onClick={() => navigate(-1)}
            className="bg-surface text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-surface-hover transition-colors"
          >
            <FaArrowLeft /> Go Back
          </button>
        </div>
      </div>
    );
  }

  // Render HLS player
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="relative w-full aspect-video max-w-screen-2xl">
        <HLSPlayer
          src={hlsUrl}
          referer={hlsReferer}
          subtitles={subtitles}
          onBack={() => navigate(-1)}
          autoPlay={true}
          title={title}
        />
      </div>
    </div>
  );
};

export default Player;
