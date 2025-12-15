import React, { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Subtitle } from '../../services/mappletv';
import {
    FaPlay, FaPause, FaExpand, FaCompress, FaVolumeUp, FaVolumeMute,
    FaClosedCaptioning, FaCog, FaArrowLeft, FaSpinner
} from 'react-icons/fa';

interface HLSPlayerProps {
    src: string;
    referer?: string;
    subtitles?: Subtitle[];
    onBack?: () => void;
    autoPlay?: boolean;
    title?: string;
}

const HLSPlayer: React.FC<HLSPlayerProps> = ({
    src,
    subtitles = [],
    onBack,
    autoPlay = true,
    title
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [buffered, setBuffered] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [hlsLevels, setHlsLevels] = useState<{ label: string; index: number }[]>([]);

    // Quality and subtitle menus
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
    const [currentQuality, setCurrentQuality] = useState<number>(-1);
    const [currentSubtitle, setCurrentSubtitle] = useState<number>(-1);

    // Initialize HLS.js
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) {
            return;
        }

        const initStartTime = performance.now();
        console.log('[HLSPlayer] 🎬 Initializing HLS...');
        setIsLoading(true);
        setError(null);
        setHlsLevels([]);

        let hls: Hls | null = null;

        // Check if HLS.js is supported
        if (Hls.isSupported()) {
            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,           // Disable for smoother playback
                backBufferLength: 30,            // Reduced: Keep 30s of back buffer
                maxBufferLength: 30,             // Reduced: Buffer 30s ahead (faster start)
                maxMaxBufferLength: 60,          // Reduced: Max 1 minute buffer
                maxBufferSize: 30 * 1000 * 1000, // Reduced: 30MB buffer
                maxBufferHole: 1.0,              // Increased: Allow 1s hole (more tolerant)
                startLevel: -1,                  // Will set to highest in MANIFEST_PARSED
                autoStartLoad: true,
                startPosition: 0,
                capLevelToPlayerSize: false,     // Don't limit quality
                debug: false,
                // More tolerant fragment loading
                fragLoadingTimeOut: 60000,       // 60s timeout for fragments
                fragLoadingMaxRetry: 10,         // Increased: Retry 10 times
                fragLoadingRetryDelay: 1000,     // Increased: 1s between retries
                levelLoadingTimeOut: 30000,      // 30s for level loading
                levelLoadingMaxRetry: 6,         // Increased retries
                manifestLoadingTimeOut: 30000,   // 30s for manifest
                manifestLoadingMaxRetry: 6,
                // Buffer stall recovery
                nudgeMaxRetry: 10,               // More retries for buffer nudge
                xhrSetup: (xhr) => {
                    xhr.withCredentials = false;
                }
            });

            hlsRef.current = hls;

            // Event: Media attached to video element
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                console.log(`[HLS] 🔗 Media attached (${(performance.now() - initStartTime).toFixed(0)}ms)`);
            });

            // Event: Manifest parsed - ready to play
            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                console.log(`[HLS] ✅ Manifest parsed in ${(performance.now() - initStartTime).toFixed(0)}ms, levels: ${data.levels.length}`);

                // Store quality levels (sorted by height, highest first)
                const levels = data.levels.map((level, index) => ({
                    label: `${level.height}p`,
                    index,
                    height: level.height
                })).sort((a, b) => b.height - a.height);
                setHlsLevels(levels);

                // SET HIGHEST QUALITY: Find the highest resolution level
                if (data.levels.length > 0 && hls) {
                    const highestLevel = data.levels.reduce((maxIdx, level, idx, arr) =>
                        level.height > arr[maxIdx].height ? idx : maxIdx, 0);
                    hls.currentLevel = highestLevel;
                    hls.nextLevel = highestLevel;
                    setCurrentQuality(highestLevel);
                    console.log(`[HLS] 🎯 Starting at highest quality: ${data.levels[highestLevel].height}p (level ${highestLevel})`);
                }

                setIsLoading(false);

                // Auto-play immediately
                if (autoPlay && video) {
                    video.play().catch(e => {
                        console.log('[HLS] ⚠️ Autoplay blocked:', e.message);
                        video.muted = true;
                        video.play().catch(() => { });
                    });
                }
            });

            // Event: Error handling with retry limit
            let networkRetries = 0;
            const MAX_RETRIES = 6;

            hls.on(Hls.Events.ERROR, (_, data) => {
                // Non-fatal errors - just log, don't show to user
                if (!data.fatal) {
                    // Buffer stall is common during quality changes, ignore it
                    if (data.details !== 'bufferStalledError' &&
                        data.details !== 'bufferSeekOverHole' &&
                        data.details !== 'bufferAppendError' &&
                        data.details !== 'bufferNudgeOnStall') {
                        console.log('[HLS] ⚠️ Non-fatal:', data.details);
                    }
                    return;
                }

                console.error('[HLS] ❌ Fatal error:', data.type, data.details);

                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        if (networkRetries < MAX_RETRIES) {
                            networkRetries++;
                            console.log(`[HLS] Network error, retry ${networkRetries}/${MAX_RETRIES}...`);
                            setTimeout(() => hls?.startLoad(), 2000); // Increased delay
                        } else {
                            setError('Network error - please check connection and retry');
                            setIsLoading(false);
                        }
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('[HLS] Media error, recovering...');
                        hls?.recoverMediaError();
                        break;
                    default:
                        // For other errors, try recovery first
                        console.log('[HLS] Unknown error, attempting recovery...');
                        hls?.recoverMediaError();
                        setTimeout(() => {
                            if (!videoRef.current?.paused) return; // Already playing
                            setError(`Playback error: ${data.details}`);
                            setIsLoading(false);
                        }, 3000);
                        break;
                }
            });

            // CRITICAL: Attach media FIRST, then load source
            hls.attachMedia(video);
            hls.loadSource(src);

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            console.log('[HLSPlayer] Using native HLS (Safari)');
            video.src = src;

            video.addEventListener('loadedmetadata', () => {
                setIsLoading(false);
                if (autoPlay) {
                    video.play().catch(e => console.log('[Native HLS] Autoplay blocked:', e));
                }
            });

            video.addEventListener('error', () => {
                setError('Failed to load video');
                setIsLoading(false);
            });
        } else {
            setError('HLS playback not supported in this browser');
            setIsLoading(false);
        }

        // Cleanup
        return () => {
            console.log('[HLSPlayer] 🧹 Cleanup');
            if (hls) {
                hls.destroy();
            }
            hlsRef.current = null;
        };
    }, [src, autoPlay]);

    // Video event handlers
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (video.buffered.length > 0) {
                setBuffered(video.buffered.end(video.buffered.length - 1));
            }
        };
        const onDurationChange = () => setDuration(video.duration);
        const onVolumeChange = () => {
            setVolume(video.volume);
            setIsMuted(video.muted);
        };
        const onWaiting = () => setIsLoading(true);
        const onPlaying = () => setIsLoading(false);
        const onCanPlay = () => setIsLoading(false);

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('canplay', onCanPlay);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('volumechange', onVolumeChange);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('canplay', onCanPlay);
        };
    }, []);

    // Fullscreen handler
    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    // Auto-hide controls
    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
        }
    }, [isPlaying]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        video.paused ? video.play() : video.pause();
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;
        const time = parseFloat(e.target.value);
        video.currentTime = time;
        setCurrentTime(time);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;
        const vol = parseFloat(e.target.value);
        video.volume = vol;
        video.muted = vol === 0;
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const selectQuality = (level: number) => {
        if (hlsRef.current) {
            // Use nextLevel for smooth switching without interrupting current playback
            hlsRef.current.nextLevel = level;
            // Also set currentLevel to force immediate switch if needed
            hlsRef.current.currentLevel = level;
            setCurrentQuality(level);
            console.log(`[HLS] 🔄 Quality changed to level ${level}`);
        }
        setShowQualityMenu(false);
    };

    const selectSubtitle = (index: number) => {
        const video = videoRef.current;
        if (!video) return;
        for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = i === index ? 'showing' : 'hidden';
        }
        setCurrentSubtitle(index);
        setShowSubtitleMenu(false);
    };

    const formatTime = (seconds: number): string => {
        if (isNaN(seconds)) return '0:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (error) {
        return (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white">
                <p className="text-red-500 mb-4">{error}</p>
                {onBack && (
                    <button onClick={onBack} className="bg-red-600 px-4 py-2 rounded flex items-center gap-2">
                        <FaArrowLeft /> Go Back
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black"
            onMouseMove={showControlsTemporarily}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={showControlsTemporarily}
        >
            <video
                ref={videoRef}
                className="w-full h-full"
                playsInline
                onClick={togglePlay}
            />

            {/* Loading Spinner */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-white text-4xl animate-spin"><FaSpinner /></span>
                </div>
            )}

            {/* Center Play Button */}
            {!isPlaying && !isLoading && (
                <button
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full p-6 hover:bg-red-700 transition-colors"
                    onClick={togglePlay}
                >
                    <span className="text-white text-3xl ml-1"><FaPlay /></span>
                </button>
            )}

            {/* Controls */}
            <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {title && <div className="text-white text-sm mb-2 truncate">{title}</div>}

                {/* Progress Bar */}
                <div className="relative h-1 bg-gray-600 rounded mb-3 group">
                    <div className="absolute h-full bg-gray-400 rounded" style={{ width: `${(buffered / duration) * 100 || 0}%` }} />
                    <div className="absolute h-full bg-red-600 rounded" style={{ width: `${(currentTime / duration) * 100 || 0}%` }} />
                    <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute w-full h-full opacity-0 cursor-pointer"
                    />
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button onClick={onBack} className="text-white hover:text-gray-300">
                                <FaArrowLeft size={18} />
                            </button>
                        )}
                        <button onClick={togglePlay} className="text-white hover:text-gray-300">
                            {isPlaying ? <FaPause size={18} /> : <FaPlay size={18} />}
                        </button>
                        <div className="flex items-center gap-2">
                            <button onClick={toggleMute} className="text-white hover:text-gray-300">
                                {isMuted || volume === 0 ? <FaVolumeMute size={18} /> : <FaVolumeUp size={18} />}
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.1}
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-20 h-1 accent-red-600"
                            />
                        </div>
                        <span className="text-white text-sm">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Subtitles */}
                        {subtitles.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                                    className={`text-white hover:text-gray-300 ${currentSubtitle >= 0 ? 'text-red-500' : ''}`}
                                >
                                    <FaClosedCaptioning size={18} />
                                </button>
                                {showSubtitleMenu && (
                                    <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded p-2 min-w-32">
                                        <button
                                            onClick={() => selectSubtitle(-1)}
                                            className={`block w-full text-left px-2 py-1 text-sm rounded ${currentSubtitle === -1 ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                        >
                                            Off
                                        </button>
                                        {subtitles.map((sub, index) => (
                                            <button
                                                key={index}
                                                onClick={() => selectSubtitle(index)}
                                                className={`block w-full text-left px-2 py-1 text-sm rounded ${currentSubtitle === index ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                            >
                                                {sub.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quality */}
                        {hlsLevels.length > 1 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                                    className="text-white hover:text-gray-300"
                                >
                                    <FaCog size={18} />
                                </button>
                                {showQualityMenu && (
                                    <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded p-2 min-w-32">
                                        <button
                                            onClick={() => selectQuality(-1)}
                                            className={`block w-full text-left px-2 py-1 text-sm rounded ${currentQuality === -1 ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                        >
                                            Auto
                                        </button>
                                        {hlsLevels.map(level => (
                                            <button
                                                key={level.index}
                                                onClick={() => selectQuality(level.index)}
                                                className={`block w-full text-left px-2 py-1 text-sm rounded ${currentQuality === level.index ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                            >
                                                {level.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button onClick={toggleFullscreen} className="text-white hover:text-gray-300">
                            {isFullscreen ? <FaCompress size={18} /> : <FaExpand size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HLSPlayer;
