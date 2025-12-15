import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { Subtitle } from '../../services/mappletv';
import {
    FaPlay, FaPause, FaExpand, FaCompress, FaVolumeUp, FaVolumeMute,
    FaVolumeDown, FaClosedCaptioning, FaCog, FaArrowLeft, FaForward,
    FaBackward, FaTachometerAlt, FaSpinner
} from 'react-icons/fa';
import { MdPictureInPictureAlt, MdFullscreen, MdFullscreenExit } from 'react-icons/md';

interface HLSPlayerProps {
    src: string;
    referer?: string;
    subtitles?: Subtitle[];
    onBack?: () => void;
    autoPlay?: boolean;
    title?: string;
}

interface QualityLevel {
    label: string;
    index: number;
    height: number;
}

const HLSPlayer: React.FC<HLSPlayerProps> = ({
    src,
    subtitles = [],
    onBack,
    autoPlay = true,
    title
}) => {
    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const doubleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekingRef = useRef(false);
    const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [buffered, setBuffered] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [hlsLevels, setHlsLevels] = useState<QualityLevel[]>([]);

    // Menu states
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed' | 'subtitles'>('main');
    const [currentQuality, setCurrentQuality] = useState<number>(-1);
    const [currentSubtitle, setCurrentSubtitle] = useState<number>(-1);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    // Mobile gesture states
    const [seekIndicator, setSeekIndicator] = useState<{ show: boolean; direction: 'forward' | 'backward'; seconds: number }>({ show: false, direction: 'forward', seconds: 0 });
    const [volumeIndicator, setVolumeIndicator] = useState<{ show: boolean; value: number }>({ show: false, value: 0 });
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Initialize HLS.js with optimized configuration
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        const initStartTime = performance.now();
        console.log('[HLSPlayer] Initializing HLS with optimized config...');
        setIsLoading(true);
        setError(null);
        setHlsLevels([]);
        setCurrentSubtitle(-1);

        let hls: Hls | null = null;

        if (Hls.isSupported()) {
            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                // ULTRA-FAST START: Minimal initial buffering
                maxBufferLength: 5,              // Only 5s ahead (was 15s) - start playing ASAP
                maxMaxBufferLength: 15,          // Max 15s (was 30s)
                maxBufferSize: 15 * 1000 * 1000, // 15MB (was 30MB)
                backBufferLength: 10,            // 10s behind
                maxBufferHole: 0.3,              // Smaller gaps ok
                // ABR Settings for fast start
                startLevel: 0,                   // Start with LOWEST quality for instant start
                abrEwmaDefaultEstimate: 500000,  // 500kbps initial estimate (conservative)
                abrBandWidthFactor: 0.9,
                abrBandWidthUpFactor: 0.5,       // Slow to upgrade quality
                abrMaxWithRealBitrate: true,
                // Fast loading
                fragLoadingTimeOut: 10000,       // 10s timeout (was 20s)
                fragLoadingMaxRetry: 3,
                fragLoadingRetryDelay: 500,      // 500ms retry delay
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 3,
                manifestLoadingTimeOut: 10000,
                manifestLoadingMaxRetry: 3,
                // Immediate start
                startPosition: 0,
                autoStartLoad: true,
                capLevelToPlayerSize: false,
                testBandwidth: false,            // Skip bandwidth test - start immediately
                progressive: true,
                // Recovery
                nudgeMaxRetry: 3,
                nudgeOffset: 0.1,
                debug: false,
                xhrSetup: (xhr) => { xhr.withCredentials = false; }
            });

            hlsRef.current = hls;

            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                console.log(`[HLS] Media attached (${(performance.now() - initStartTime).toFixed(0)}ms)`);
            });

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                console.log(`[HLS] Manifest parsed in ${(performance.now() - initStartTime).toFixed(0)}ms, levels: ${data.levels.length}`);

                const levels = data.levels.map((level, index) => ({
                    label: `${level.height}p`,
                    index,
                    height: level.height
                })).sort((a, b) => b.height - a.height);
                setHlsLevels(levels);

                // Start with lowest quality for instant playback, then switch to ABR
                if (data.levels.length > 0 && hls) {
                    // Find lowest quality level
                    const lowestLevel = levels[levels.length - 1]?.index || 0;
                    hls.startLevel = lowestLevel;
                    hls.currentLevel = lowestLevel;
                    setCurrentQuality(-1); // Show "Auto" in UI

                    // After 3 seconds, switch to ABR for quality upgrade
                    setTimeout(() => {
                        if (hlsRef.current) {
                            hlsRef.current.nextLevel = -1; // Enable ABR
                            console.log('[HLS] Switched to ABR mode for quality upgrade');
                        }
                    }, 3000);
                }

                setIsLoading(false);

                if (autoPlay && video) {
                    video.play().catch(e => {
                        console.log('[HLS] Autoplay blocked:', e.message);
                        video.muted = true;
                        video.play().catch(() => { });
                    });
                }
            });

            hls.on(Hls.Events.FRAG_LOADED, () => {
                if (isLoading && video.readyState >= 2) {
                    setIsLoading(false);
                }
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                const level = hls?.levels[data.level];
                if (level) {
                    console.log(`[HLS] Quality: ${level.height}p`);
                }
            });

            let networkRetries = 0;
            const MAX_RETRIES = 4;

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (!data.fatal) {
                    if (!['bufferStalledError', 'bufferSeekOverHole', 'bufferAppendError', 'bufferNudgeOnStall'].includes(data.details)) {
                        console.log('[HLS] Non-fatal:', data.details);
                    }
                    return;
                }

                console.error('[HLS] Fatal error:', data.type, data.details);

                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        if (networkRetries < MAX_RETRIES) {
                            networkRetries++;
                            console.log(`[HLS] Network retry ${networkRetries}/${MAX_RETRIES}...`);
                            setTimeout(() => hls?.startLoad(), 1000);
                        } else {
                            setError('Network error - please retry');
                            setIsLoading(false);
                        }
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls?.recoverMediaError();
                        break;
                    default:
                        hls?.recoverMediaError();
                        setTimeout(() => {
                            if (!videoRef.current?.paused) return;
                            setError(`Playback error: ${data.details}`);
                            setIsLoading(false);
                        }, 3000);
                        break;
                }
            });

            hls.attachMedia(video);
            hls.loadSource(src);

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
            video.addEventListener('loadedmetadata', () => {
                setIsLoading(false);
                if (autoPlay) video.play().catch(() => { });
            });
            video.addEventListener('error', () => {
                setError('Failed to load video');
                setIsLoading(false);
            });
        } else {
            setError('HLS playback not supported');
            setIsLoading(false);
        }

        return () => {
            if (hls) hls.destroy();
            hlsRef.current = null;
        };
    }, [src, autoPlay]);

    // Video event handlers
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlers = {
            play: () => setIsPlaying(true),
            pause: () => setIsPlaying(false),
            timeupdate: () => {
                if (!seekingRef.current) {
                    setCurrentTime(video.currentTime);
                }
                if (video.buffered.length > 0) {
                    for (let i = 0; i < video.buffered.length; i++) {
                        if (video.currentTime >= video.buffered.start(i) && video.currentTime <= video.buffered.end(i)) {
                            setBuffered(video.buffered.end(i));
                            break;
                        }
                    }
                }
            },
            durationchange: () => setDuration(video.duration),
            volumechange: () => {
                setVolume(video.volume);
                setIsMuted(video.muted);
            },
            seeking: () => {
                seekingRef.current = true;
                setIsBuffering(true);
            },
            seeked: () => {
                seekingRef.current = false;
                if (video.readyState >= 3) setIsBuffering(false);
            },
            waiting: () => {
                if (!video.seeking) setIsBuffering(true);
            },
            playing: () => {
                seekingRef.current = false;
                setIsBuffering(false);
                setIsLoading(false);
            },
            canplay: () => {
                if (!seekingRef.current) setIsBuffering(false);
            },
            canplaythrough: () => setIsBuffering(false),
            ratechange: () => setPlaybackSpeed(video.playbackRate)
        };

        Object.entries(handlers).forEach(([event, handler]) => {
            video.addEventListener(event, handler as EventListener);
        });

        return () => {
            Object.entries(handlers).forEach(([event, handler]) => {
                video.removeEventListener(event, handler as EventListener);
            });
        };
    }, []);

    // Load subtitles - fetch and create blob URLs to bypass CORS
    useEffect(() => {
        const video = videoRef.current;
        if (!video || subtitles.length === 0) return;

        console.log(`[HLSPlayer] Loading ${subtitles.length} subtitle tracks`);

        // Remove existing tracks
        const existingTracks = video.querySelectorAll('track');
        existingTracks.forEach(track => track.remove());

        const blobUrls: string[] = [];

        // Fetch each subtitle and create blob URL
        const loadSubtitles = async () => {
            for (let i = 0; i < subtitles.length; i++) {
                const sub = subtitles[i];
                try {
                    console.log(`[HLSPlayer] Fetching subtitle: ${sub.label}`);
                    const response = await fetch(sub.file);
                    if (!response.ok) {
                        console.log(`[HLSPlayer] Failed to fetch subtitle ${sub.label}: ${response.status}`);
                        continue;
                    }

                    const text = await response.text();

                    // Check if it's valid VTT content, if not try to convert
                    let vttContent = text;
                    if (!text.startsWith('WEBVTT')) {
                        // Try to convert SRT to VTT
                        if (text.match(/^\d+\r?\n\d{2}:\d{2}:\d{2},\d{3}/m)) {
                            vttContent = 'WEBVTT\n\n' + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
                        } else {
                            // Assume it's VTT without header
                            vttContent = 'WEBVTT\n\n' + text;
                        }
                    }

                    const blob = new Blob([vttContent], { type: 'text/vtt' });
                    const blobUrl = URL.createObjectURL(blob);
                    blobUrls.push(blobUrl);

                    const track = document.createElement('track');
                    track.kind = 'subtitles';
                    track.label = sub.label;
                    track.srclang = sub.language || 'en';
                    track.src = blobUrl;
                    track.default = false;
                    video.appendChild(track);
                    console.log(`[HLSPlayer] Added subtitle: ${sub.label}`);
                } catch (e) {
                    console.log(`[HLSPlayer] Error loading subtitle ${sub.label}:`, e);
                }
            }

            // Hide all initially
            for (let i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = 'hidden';
            }
        };

        loadSubtitles();

        return () => {
            const tracks = video.querySelectorAll('track');
            tracks.forEach(track => track.remove());
            // Revoke blob URLs
            blobUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [subtitles]);

    // Fullscreen handler
    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    // Click outside handler for settings menu
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setShowSettings(false);
                setSettingsTab('main');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside as any);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside as any);
        };
    }, [showSettings]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const video = videoRef.current;
            if (!video) return;

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'arrowleft':
                case 'j':
                    e.preventDefault();
                    skip(-10);
                    break;
                case 'arrowright':
                case 'l':
                    e.preventDefault();
                    skip(10);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.1);
                    showVolumeIndicator(video.volume);
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.1);
                    showVolumeIndicator(video.volume);
                    break;
                case 'm':
                    toggleMute();
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                case 'c':
                    toggleSubtitles();
                    break;
                case '0': case '1': case '2': case '3': case '4':
                case '5': case '6': case '7': case '8': case '9':
                    e.preventDefault();
                    video.currentTime = duration * (parseInt(e.key) / 10);
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [duration]);

    // Auto-hide controls - don't hide when settings menu is open
    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (isPlaying && !showSettings) {
            controlsTimeoutRef.current = setTimeout(() => {
                if (!showSettings) setShowControls(false);
            }, 3000);
        }
    }, [isPlaying, showSettings]);

    // Player actions
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.paused ? video.play() : video.pause();
    }, []);

    const skip = useCallback((seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        const newTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
        if (hlsRef.current) hlsRef.current.startLoad(newTime);
        video.currentTime = newTime;
        setCurrentTime(newTime);

        // Show indicator
        setSeekIndicator({
            show: true,
            direction: seconds > 0 ? 'forward' : 'backward',
            seconds: Math.abs(seconds)
        });
        setTimeout(() => setSeekIndicator(prev => ({ ...prev, show: false })), 800);
    }, [duration]);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const video = videoRef.current;
        const progress = progressRef.current;
        if (!video || !progress) return;

        const rect = progress.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const newTime = pos * duration;

        if (hlsRef.current) hlsRef.current.startLoad(newTime);
        video.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
    }, []);

    const toggleFullscreen = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }, []);

    const toggleSubtitles = useCallback(() => {
        const video = videoRef.current;
        if (!video || subtitles.length === 0) return;

        if (currentSubtitle >= 0) {
            // Turn off
            for (let i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = 'hidden';
            }
            setCurrentSubtitle(-1);
        } else {
            // Turn on first subtitle
            if (video.textTracks.length > 0) {
                video.textTracks[0].mode = 'showing';
                setCurrentSubtitle(0);
            }
        }
    }, [currentSubtitle, subtitles]);

    const selectQuality = useCallback((level: number) => {
        if (hlsRef.current) {
            hlsRef.current.nextLevel = level;
            hlsRef.current.currentLevel = level;
            setCurrentQuality(level);
        }
        setShowSettings(false);
    }, []);

    const selectSubtitle = useCallback((index: number) => {
        const video = videoRef.current;
        if (!video) return;
        for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = i === index ? 'showing' : 'hidden';
        }
        setCurrentSubtitle(index);
        setShowSettings(false);
    }, []);

    const setSpeed = useCallback((speed: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = speed;
        setPlaybackSpeed(speed);
        setShowSettings(false);
    }, []);

    const showVolumeIndicator = useCallback((value: number) => {
        setVolumeIndicator({ show: true, value });
        setTimeout(() => setVolumeIndicator(prev => ({ ...prev, show: false })), 800);
    }, []);

    const togglePiP = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (e) {
            console.log('PiP not supported');
        }
    }, []);

    // Mobile touch handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const now = Date.now();
        const timeDiff = now - lastTapRef.current.time;
        const xDiff = Math.abs(touch.clientX - lastTapRef.current.x);

        // Double tap detection
        if (timeDiff < 300 && xDiff < 50) {
            const containerWidth = containerRef.current?.clientWidth || 0;
            const tapX = touch.clientX;

            if (tapX < containerWidth / 3) {
                skip(-10);
            } else if (tapX > containerWidth * 2 / 3) {
                skip(10);
            } else {
                togglePlay();
            }

            lastTapRef.current = { time: 0, x: 0 };
        } else {
            lastTapRef.current = { time: now, x: touch.clientX };
            if (doubleTapTimeoutRef.current) clearTimeout(doubleTapTimeoutRef.current);
            doubleTapTimeoutRef.current = setTimeout(() => {
                showControlsTemporarily();
            }, 300);
        }
    }, [skip, togglePlay, showControlsTemporarily]);

    // Format time
    const formatTime = useCallback((seconds: number): string => {
        if (isNaN(seconds)) return '0:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, []);

    // Progress percentage
    const progressPercent = useMemo(() => duration > 0 ? (currentTime / duration) * 100 : 0, [currentTime, duration]);
    const bufferedPercent = useMemo(() => duration > 0 ? (buffered / duration) * 100 : 0, [buffered, duration]);

    // Quality label
    const currentQualityLabel = useMemo(() => {
        if (currentQuality === -1) return 'Auto';
        const level = hlsLevels.find(l => l.index === currentQuality);
        return level?.label || 'Auto';
    }, [currentQuality, hlsLevels]);

    // Speed options
    const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    if (error) {
        return (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white p-4">
                <div className="text-red-500 text-lg mb-4 text-center">{error}</div>
                <div className="flex gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                    >
                        Retry
                    </button>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                        >
                            Go Back
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black select-none overflow-hidden group"
            onMouseMove={!isMobile ? showControlsTemporarily : undefined}
            onMouseLeave={() => !isMobile && isPlaying && setShowControls(false)}
            onTouchStart={isMobile ? handleTouchStart : undefined}
        >
            {/* Video Element */}
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                onClick={!isMobile ? togglePlay : undefined}
                style={{
                    // Custom subtitle styling
                    WebkitTextStroke: '1px black'
                }}
            />

            {/* Custom Subtitle Styling */}
            <style>{`
                video::cue {
                    background: rgba(0, 0, 0, 0.75);
                    color: #fff;
                    font-family: 'Netflix Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                    font-size: ${isMobile ? '3.5vw' : '1.8vw'};
                    font-weight: 600;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9);
                    padding: 0.2em 0.5em;
                    border-radius: 4px;
                    line-height: 1.4;
                }
                video::-webkit-media-text-track-container {
                    transform: translateY(${isFullscreen ? '-10%' : '-5%'});
                }
            `}</style>

            {/* Loading Spinner */}
            {(isLoading || isBuffering) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-white/20 border-t-red-600 rounded-full animate-spin" />
                    </div>
                </div>
            )}

            {/* Seek Indicator (Double-tap) */}
            {seekIndicator.show && (
                <div className={`absolute top-1/2 -translate-y-1/2 ${seekIndicator.direction === 'forward' ? 'right-1/4' : 'left-1/4'} pointer-events-none z-20`}>
                    <div className="flex flex-col items-center animate-pulse">
                        <div className="text-white text-4xl mb-1">
                            {seekIndicator.direction === 'forward' ? <FaForward /> : <FaBackward />}
                        </div>
                        <span className="text-white text-sm font-medium">{seekIndicator.seconds}s</span>
                    </div>
                </div>
            )}

            {/* Volume Indicator */}
            {volumeIndicator.show && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
                    <div className="bg-black/80 rounded-lg px-6 py-4 flex flex-col items-center">
                        <FaVolumeUp className="text-white text-2xl mb-2" />
                        <div className="w-24 h-1 bg-white/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all"
                                style={{ width: `${volumeIndicator.value * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Center Play Button (when paused) */}
            {!isPlaying && !isLoading && !isBuffering && (
                <button
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-red-600/90 hover:bg-red-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110 z-10"
                    onClick={togglePlay}
                >
                    <FaPlay className="text-white text-2xl ml-1" />
                </button>
            )}

            {/* Top Gradient */}
            <div className={`absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`} />

            {/* Title Bar */}
            <div className={`absolute top-0 inset-x-0 p-4 flex items-center gap-3 transition-opacity duration-300 z-20 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                    >
                        <FaArrowLeft size={20} />
                    </button>
                )}
                {title && (
                    <h2 className="text-white font-medium text-lg truncate flex-1">{title}</h2>
                )}
            </div>

            {/* Bottom Controls */}
            <div className={`absolute bottom-0 inset-x-0 transition-opacity duration-300 z-20 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

                <div className="relative px-4 pb-4 pt-8">
                    {/* Progress Bar */}
                    <div
                        ref={progressRef}
                        className="relative h-1 group/progress cursor-pointer mb-4"
                        onClick={handleSeek}
                    >
                        <div className="absolute inset-0 bg-white/30 rounded-full" />
                        <div
                            className="absolute inset-y-0 left-0 bg-white/50 rounded-full"
                            style={{ width: `${bufferedPercent}%` }}
                        />
                        <div
                            className="absolute inset-y-0 left-0 bg-red-600 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                        />
                        {/* Hover preview & scrubber */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full shadow-lg transform scale-0 group-hover/progress:scale-100 transition-transform"
                            style={{ left: `calc(${progressPercent}% - 8px)` }}
                        />
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-between gap-2">
                        {/* Left Controls */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            <button
                                onClick={togglePlay}
                                className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-white transition-colors"
                            >
                                {isPlaying ? <FaPause size={isMobile ? 18 : 20} /> : <FaPlay size={isMobile ? 18 : 20} />}
                            </button>

                            <button
                                onClick={() => skip(-10)}
                                className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-white transition-colors hidden sm:block"
                            >
                                <FaBackward size={16} />
                            </button>

                            <button
                                onClick={() => skip(10)}
                                className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-white transition-colors hidden sm:block"
                            >
                                <FaForward size={16} />
                            </button>

                            {/* Volume */}
                            <div className="hidden sm:flex items-center gap-1 group/volume">
                                <button
                                    onClick={toggleMute}
                                    className="p-2.5 rounded-full hover:bg-white/10 text-white transition-colors"
                                >
                                    {isMuted || volume === 0 ? <FaVolumeMute size={18} /> :
                                        volume < 0.5 ? <FaVolumeDown size={18} /> : <FaVolumeUp size={18} />}
                                </button>
                                <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-200">
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={isMuted ? 0 : volume}
                                        onChange={(e) => {
                                            const video = videoRef.current;
                                            if (!video) return;
                                            const vol = parseFloat(e.target.value);
                                            video.volume = vol;
                                            video.muted = vol === 0;
                                        }}
                                        className="w-full h-1 accent-red-600 cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Time */}
                            <span className="text-white text-xs sm:text-sm font-medium ml-1 whitespace-nowrap">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                        </div>

                        {/* Right Controls */}
                        <div className="flex items-center gap-1">
                            {/* Subtitles Quick Toggle */}
                            {subtitles.length > 0 && (
                                <button
                                    onClick={toggleSubtitles}
                                    className={`p-2 sm:p-2.5 rounded-full hover:bg-white/10 transition-colors ${currentSubtitle >= 0 ? 'text-red-500' : 'text-white'}`}
                                >
                                    <FaClosedCaptioning size={isMobile ? 18 : 20} />
                                </button>
                            )}

                            {/* Settings */}
                            <div className="relative" ref={settingsRef}>
                                <button
                                    onClick={() => {
                                        setShowSettings(!showSettings);
                                        if (!showSettings) setSettingsTab('main');
                                    }}
                                    className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-white transition-colors"
                                >
                                    <FaCog size={isMobile ? 18 : 20} />
                                </button>

                                {/* Settings Menu */}
                                {showSettings && (
                                    <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-sm rounded-lg overflow-hidden shadow-xl min-w-[200px] border border-white/10">
                                        {settingsTab === 'main' && (
                                            <div className="py-1">
                                                {hlsLevels.length > 1 && (
                                                    <button
                                                        onClick={() => setSettingsTab('quality')}
                                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 text-white"
                                                    >
                                                        <span className="flex items-center gap-3">
                                                            <FaCog size={14} />
                                                            <span>Quality</span>
                                                        </span>
                                                        <span className="text-white/60 text-sm">{currentQualityLabel}</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSettingsTab('speed')}
                                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 text-white"
                                                >
                                                    <span className="flex items-center gap-3">
                                                        <FaTachometerAlt size={14} />
                                                        <span>Speed</span>
                                                    </span>
                                                    <span className="text-white/60 text-sm">{playbackSpeed}x</span>
                                                </button>
                                                {subtitles.length > 0 && (
                                                    <button
                                                        onClick={() => setSettingsTab('subtitles')}
                                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 text-white"
                                                    >
                                                        <span className="flex items-center gap-3">
                                                            <FaClosedCaptioning size={14} />
                                                            <span>Subtitles</span>
                                                        </span>
                                                        <span className="text-white/60 text-sm">
                                                            {currentSubtitle >= 0 ? subtitles[currentSubtitle]?.label : 'Off'}
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {settingsTab === 'quality' && (
                                            <div className="py-1">
                                                <button
                                                    onClick={() => setSettingsTab('main')}
                                                    className="w-full px-4 py-2 flex items-center gap-2 text-white/60 hover:bg-white/10 border-b border-white/10"
                                                >
                                                    <FaArrowLeft size={12} />
                                                    <span>Quality</span>
                                                </button>
                                                <button
                                                    onClick={() => selectQuality(-1)}
                                                    className={`w-full px-4 py-2.5 text-left hover:bg-white/10 ${currentQuality === -1 ? 'text-red-500' : 'text-white'}`}
                                                >
                                                    Auto
                                                </button>
                                                {hlsLevels.map(level => (
                                                    <button
                                                        key={level.index}
                                                        onClick={() => selectQuality(level.index)}
                                                        className={`w-full px-4 py-2.5 text-left hover:bg-white/10 ${currentQuality === level.index ? 'text-red-500' : 'text-white'}`}
                                                    >
                                                        {level.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {settingsTab === 'speed' && (
                                            <div className="py-1">
                                                <button
                                                    onClick={() => setSettingsTab('main')}
                                                    className="w-full px-4 py-2 flex items-center gap-2 text-white/60 hover:bg-white/10 border-b border-white/10"
                                                >
                                                    <FaArrowLeft size={12} />
                                                    <span>Speed</span>
                                                </button>
                                                {speedOptions.map(speed => (
                                                    <button
                                                        key={speed}
                                                        onClick={() => setSpeed(speed)}
                                                        className={`w-full px-4 py-2.5 text-left hover:bg-white/10 ${playbackSpeed === speed ? 'text-red-500' : 'text-white'}`}
                                                    >
                                                        {speed === 1 ? 'Normal' : `${speed}x`}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {settingsTab === 'subtitles' && (
                                            <div className="py-1">
                                                <button
                                                    onClick={() => setSettingsTab('main')}
                                                    className="w-full px-4 py-2 flex items-center gap-2 text-white/60 hover:bg-white/10 border-b border-white/10"
                                                >
                                                    <FaArrowLeft size={12} />
                                                    <span>Subtitles</span>
                                                </button>
                                                <button
                                                    onClick={() => selectSubtitle(-1)}
                                                    className={`w-full px-4 py-2.5 text-left hover:bg-white/10 ${currentSubtitle === -1 ? 'text-red-500' : 'text-white'}`}
                                                >
                                                    Off
                                                </button>
                                                {subtitles.map((sub, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => selectSubtitle(index)}
                                                        className={`w-full px-4 py-2.5 text-left hover:bg-white/10 ${currentSubtitle === index ? 'text-red-500' : 'text-white'}`}
                                                    >
                                                        {sub.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* PiP */}
                            <button
                                onClick={togglePiP}
                                className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-white transition-colors hidden sm:block"
                            >
                                <MdPictureInPictureAlt size={20} />
                            </button>

                            {/* Fullscreen */}
                            <button
                                onClick={toggleFullscreen}
                                className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-white transition-colors"
                            >
                                {isFullscreen ?
                                    <MdFullscreenExit size={isMobile ? 22 : 24} /> :
                                    <MdFullscreen size={isMobile ? 22 : 24} />
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Touch Areas (invisible) */}
            {isMobile && (
                <>
                    <div className="absolute top-0 left-0 w-1/3 h-full" />
                    <div className="absolute top-0 right-0 w-1/3 h-full" />
                </>
            )}
        </div>
    );
};

export default HLSPlayer;
