import React, { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Subtitle } from '../../services/mappletv';
import {
    FaPlay, FaPause, FaExpand, FaCompress, FaVolumeUp, FaVolumeMute,
    FaClosedCaptioning, FaCog, FaArrowLeft, FaSpinner, FaForward, FaBackward
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
    const seekingRef = useRef(false);

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

    // Initialize HLS.js with OPTIMIZED configuration for fast playback
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) {
            return;
        }

        const initStartTime = performance.now();
        console.log('[HLSPlayer] 🎬 Initializing HLS with optimized config...');
        setIsLoading(true);
        setError(null);
        setHlsLevels([]);
        setCurrentSubtitle(-1);

        let hls: Hls | null = null;

        // Check if HLS.js is supported
        if (Hls.isSupported()) {
            hls = new Hls({
                // === CORE OPTIMIZATION: Fast Start ===
                enableWorker: true,
                lowLatencyMode: false,           // VOD content, not live

                // === BUFFER SETTINGS: Optimized for fast start + smooth playback ===
                maxBufferLength: 15,             // Only buffer 15s ahead (was 60s!) - CRITICAL for fast start
                maxMaxBufferLength: 30,          // Max 30s buffer (was 120s!) - prevents over-buffering
                maxBufferSize: 30 * 1000 * 1000, // 30MB buffer (was 60MB)
                backBufferLength: 15,            // Keep 15s behind for quick back-seeks
                maxBufferHole: 0.5,              // Smaller tolerance for better quality (was 2.0)

                // === ABR (Adaptive Bitrate) Settings ===
                startLevel: -1,                  // Let ABR choose initial quality
                abrEwmaDefaultEstimate: 1000000, // Start with 1Mbps estimate for faster initial load
                abrBandWidthFactor: 0.95,        // Use 95% of measured bandwidth
                abrBandWidthUpFactor: 0.7,       // Be conservative when upgrading quality
                abrMaxWithRealBitrate: true,     // Use actual bitrate for decisions

                // === LOADING SETTINGS: Faster timeouts for quicker recovery ===
                fragLoadingTimeOut: 20000,       // 20s fragment timeout (was 120s!)
                fragLoadingMaxRetry: 4,          // 4 retries (was 15)
                fragLoadingRetryDelay: 1000,     // 1s between retries
                levelLoadingTimeOut: 15000,      // 15s for level (was 60s)
                levelLoadingMaxRetry: 4,
                manifestLoadingTimeOut: 15000,   // 15s for manifest (was 60s)
                manifestLoadingMaxRetry: 4,

                // === SEEKING OPTIMIZATION ===
                startPosition: 0,
                autoStartLoad: true,
                capLevelToPlayerSize: false,     // Allow all qualities
                testBandwidth: true,             // Test bandwidth before first fragment
                progressive: true,               // Enable progressive loading for faster start

                // === ERROR RECOVERY ===
                nudgeMaxRetry: 5,                // Quick nudge retries
                nudgeOffset: 0.1,                // Small nudge offset

                // === KEY/DRM Loading ===
                keyLoadPolicy: {
                    default: {
                        maxTimeToFirstByteMs: 15000,
                        maxLoadTimeMs: 30000,
                        timeoutRetry: { maxNumRetry: 4, retryDelayMs: 1000, maxRetryDelayMs: 4000 },
                        errorRetry: { maxNumRetry: 4, retryDelayMs: 1000, maxRetryDelayMs: 4000 }
                    }
                },

                debug: false,
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

                // ABR mode for optimal start
                if (data.levels.length > 0 && hls) {
                    hls.nextLevel = -1; // ABR mode
                    setCurrentQuality(-1); // Show "Auto" as selected
                    console.log(`[HLS] 🎯 ABR mode enabled, ${data.levels.length} quality levels available`);
                }

                // Check for HLS.js embedded subtitles
                if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
                    console.log(`[HLS] 📝 Found ${hls.subtitleTracks.length} embedded subtitle tracks`);
                }

                setIsLoading(false);

                // Auto-play immediately - don't wait for full buffer
                if (autoPlay && video) {
                    video.play().catch(e => {
                        console.log('[HLS] ⚠️ Autoplay blocked:', e.message);
                        video.muted = true;
                        video.play().catch(() => { });
                    });
                }
            });

            // Event: Fragment loaded - track progress
            hls.on(Hls.Events.FRAG_LOADED, () => {
                // First fragment loaded means we can start playing
                if (isLoading && video.readyState >= 2) {
                    setIsLoading(false);
                }
            });

            // Event: Level switched - update quality indicator
            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                const level = hls?.levels[data.level];
                if (level) {
                    console.log(`[HLS] 📊 Quality switched to ${level.height}p`);
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

    // Video event handlers - optimized for seeking
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => {
            if (!seekingRef.current) {
                setCurrentTime(video.currentTime);
            }
            if (video.buffered.length > 0) {
                // Find the buffer range that contains current time
                for (let i = 0; i < video.buffered.length; i++) {
                    if (video.currentTime >= video.buffered.start(i) && video.currentTime <= video.buffered.end(i)) {
                        setBuffered(video.buffered.end(i));
                        break;
                    }
                }
            }
        };
        const onDurationChange = () => setDuration(video.duration);
        const onVolumeChange = () => {
            setVolume(video.volume);
            setIsMuted(video.muted);
        };

        // Seeking events - show loading only briefly
        const onSeeking = () => {
            seekingRef.current = true;
            setIsLoading(true);
        };
        const onSeeked = () => {
            seekingRef.current = false;
            // Check if we can play immediately
            if (video.readyState >= 3) {
                setIsLoading(false);
            }
        };
        const onWaiting = () => {
            // Only show loading if actually waiting (not just seeking)
            if (!video.seeking) {
                setIsLoading(true);
            }
        };
        const onPlaying = () => {
            seekingRef.current = false;
            setIsLoading(false);
        };
        const onCanPlay = () => {
            if (!seekingRef.current) {
                setIsLoading(false);
            }
        };
        const onCanPlayThrough = () => {
            setIsLoading(false);
        };

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('seeking', onSeeking);
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('canplaythrough', onCanPlayThrough);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('volumechange', onVolumeChange);
            video.removeEventListener('seeking', onSeeking);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('canplaythrough', onCanPlayThrough);
        };
    }, []);

    // Load subtitles into video element
    useEffect(() => {
        const video = videoRef.current;
        if (!video || subtitles.length === 0) return;

        console.log(`[HLSPlayer] 📝 Loading ${subtitles.length} subtitle tracks`);

        // Remove existing tracks
        while (video.textTracks.length > 0) {
            const track = video.querySelector('track');
            if (track) track.remove();
        }

        // Add subtitle tracks
        subtitles.forEach((sub, index) => {
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = sub.label;
            track.srclang = sub.language || 'en';
            track.src = sub.file;
            track.default = false;
            video.appendChild(track);
            console.log(`[HLSPlayer] Added subtitle: ${sub.label} (${sub.file.substring(0, 50)}...)`);
        });

        // Initially hide all tracks
        for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = 'hidden';
        }

        return () => {
            // Cleanup tracks on unmount
            const tracks = video.querySelectorAll('track');
            tracks.forEach(track => track.remove());
        };
    }, [subtitles]);

    // Fullscreen handler
    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if not typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    skipBackward();
                    break;
                case 'arrowright':
                    e.preventDefault();
                    skipForward();
                    break;
                case 'arrowup':
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
                    }
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
                    }
                    break;
                case 'm':
                    toggleMute();
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [duration]);

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

        // Optimized seeking: pause buffering, seek, then resume
        if (hlsRef.current) {
            // This helps HLS.js prioritize the new position
            hlsRef.current.startLoad(time);
        }

        video.currentTime = time;
        setCurrentTime(time);
    };

    // Skip forward/backward 10 seconds
    const skipForward = () => {
        const video = videoRef.current;
        if (!video) return;
        const newTime = Math.min(video.currentTime + 10, duration);
        video.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const skipBackward = () => {
        const video = videoRef.current;
        if (!video) return;
        const newTime = Math.max(video.currentTime - 10, 0);
        video.currentTime = newTime;
        setCurrentTime(newTime);
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
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button onClick={onBack} className="text-white hover:text-gray-300" title="Back">
                                <FaArrowLeft size={18} />
                            </button>
                        )}
                        <button onClick={togglePlay} className="text-white hover:text-gray-300" title="Play/Pause (K)">
                            {isPlaying ? <FaPause size={18} /> : <FaPlay size={18} />}
                        </button>
                        <button onClick={skipBackward} className="text-white hover:text-gray-300" title="Rewind 10s (←)">
                            <FaBackward size={16} />
                        </button>
                        <button onClick={skipForward} className="text-white hover:text-gray-300" title="Forward 10s (→)">
                            <FaForward size={16} />
                        </button>
                        <div className="flex items-center gap-2">
                            <button onClick={toggleMute} className="text-white hover:text-gray-300" title="Mute (M)">
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
