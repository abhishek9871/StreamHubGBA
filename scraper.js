import express from 'express';
import cors from 'cors';
import { connect } from 'puppeteer-real-browser';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());

// Providers List - Priority Order
const PROVIDERS = [
    {
        name: 'vidsrc-embed.ru',
        getUrl: (id, type, s, e) => type === 'movie'
            ? `https://vidsrc-embed.ru/embed/movie?tmdb=${id}`
            : `https://vidsrc-embed.ru/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
    },
    {
        name: 'vidsrc.cc',
        getUrl: (id, type, s, e) => type === 'movie'
            ? `https://vidsrc.cc/v2/embed/movie/${id}`
            : `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`
    }
];

// Browser Session Helper
let browserInstance = null;
let pageInstance = null;

async function getBrowser() {
    if (browserInstance && pageInstance && !pageInstance.isClosed()) {
        return { browser: browserInstance, page: pageInstance };
    }

    console.log('[Browser] 🚀 Launching Real Browser (Stealth)...');
    const { browser, page } = await connect({
        headless: false,
        turnstile: true,
        fingerprint: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,720',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });

    browserInstance = browser;
    pageInstance = page;

    await page.setRequestInterception(true);
    page.on('request', req => req.continue());

    // 🛡️ POPUP KILLER
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            try {
                const newPage = await target.page();
                if (newPage && newPage !== page) {
                    await newPage.close();
                    if (page && !page.isClosed()) await page.bringToFront();
                }
            } catch (e) { }
        }
    });

    return { browser, page };
}

app.get('/api/extract', async (req, res) => {
    const { tmdbId, season, episode, type } = req.query;

    if (!tmdbId || !type) {
        return res.status(400).json({ success: false, error: 'Missing params' });
    }

    const contentId = `${type}-${tmdbId}`;
    console.log(`[Extract] Starting for ${contentId}...`);

    let browser, page;
    try {
        ({ browser, page } = await getBrowser());
    } catch (e) {
        return res.status(500).json({ error: 'Browser launch failed: ' + e.message });
    }

    let foundMedia = null;
    let foundSubtitles = [];
    let usedProvider = null;
    let capturedReferer = null;

    // Helper to label subtitles
    const getSubtitleLabel = (url) => {
        const lower = url.toLowerCase();
        if (lower.includes('eng') || lower.includes('en.')) return 'English';
        return null;
    };

    // Frame Scanner
    const scanFramesForSubtitles = async (page) => {
        const frames = page.frames();
        const frameSubs = [];
        for (const frame of frames) {
            try {
                const result = await frame.evaluate(() => {
                    const found = [];

                    // 1. JW Player
                    if (window.jwplayer) {
                        try {
                            const playlist = window.jwplayer().getPlaylist();
                            if (playlist && playlist[0] && playlist[0].tracks) {
                                playlist[0].tracks.forEach(t => {
                                    if (t.kind === 'captions' || t.kind === 'subtitles') {
                                        found.push({ label: t.label, file: t.file });
                                    }
                                });
                            }
                        } catch (e) { }
                    }

                    // 2. PlayerJS (pljssglobal) - Common in vidsrc embeds
                    if (window.pljssglobal) {
                        try {
                            const config = window.pljssglobal;
                            if (config.subs && Array.isArray(config.subs)) {
                                config.subs.forEach(sub => {
                                    if (sub.label && sub.file) {
                                        found.push({ label: sub.label, file: sub.file });
                                    }
                                });
                            }
                        } catch (e) { }
                    }

                    // 3. DOM Tracks
                    document.querySelectorAll('track').forEach(t => {
                        if (t.kind === 'subtitles' || t.kind === 'captions') {
                            found.push({ label: t.label, file: t.src });
                        }
                    });

                    return found;
                });
                if (result && result.length > 0) frameSubs.push(...result);
            } catch (e) { }
        }
        return frameSubs;
    };

    // 🧠 REVERSE ENGINEERED API EXTRACTOR
    const extractSubtitlesViaAPI = async (page, reqSeason, reqEpisode) => {
        try {
            // Find the player frame - prefer prorcp (player) over rcp frames
            // prorcp frame has correct data-i, data-s, data-e attributes
            let playerFrame = page.frames().find(f => f.url().includes('prorcp'));
            if (!playerFrame) {
                playerFrame = page.frames().find(f => f.url().includes('cloudnestra') || f.url().includes('hash='));
            }
            if (!playerFrame) return [];

            // Pass season/episode into the browser context
            return await playerFrame.evaluate(async (s, e) => {
                const found = [];
                try {
                    let id = document.body.getAttribute('data-i');
                    if (!id) return [];

                    // Clean IMDB ID - remove any suffix like "_1x1"
                    id = id.split('_')[0];

                    // Use passed season/episode if available, otherwise try data attributes
                    const season = s || document.body.getAttribute('data-s');
                    const episode = e || document.body.getAttribute('data-e');

                    // Construct API URL - include season/episode for TV series
                    let apiUrl;
                    if (season && episode) {
                        apiUrl = `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${id}/season-${season}/sublanguageid-eng`;
                        console.log('[Subtitles] TV Mode: S' + season + 'E' + episode);
                    } else {
                        apiUrl = `https://rest.opensubtitles.org/search/imdbid-${id}/sublanguageid-eng`;
                        console.log('[Subtitles] Movie Mode');
                    }

                    const response = await fetch(apiUrl, {
                        headers: { 'X-User-Agent': 'trailers.to-UA' }
                    });
                    const data = await response.json();

                    if (Array.isArray(data)) {
                        // Increased limit to 15 for more subtitle options
                        const limitedData = data.filter(s => s.SubFormat === 'srt' || s.SubFormat === 'vtt').slice(0, 15);

                        for (const sub of limitedData) {
                            try {
                                // Fetch subtitle content directly in browser context
                                const subResponse = await fetch(sub.SubDownloadLink, {
                                    headers: { 'X-User-Agent': 'trailers.to-UA' }
                                });

                                if (subResponse.ok) {
                                    let text;

                                    // Handle gzip compressed files
                                    if (sub.SubDownloadLink.includes('.gz')) {
                                        // Use DecompressionStream to decompress gzip
                                        const ds = new DecompressionStream('gzip');
                                        const decompressedStream = subResponse.body.pipeThrough(ds);
                                        const reader = decompressedStream.getReader();
                                        const chunks = [];

                                        while (true) {
                                            const { done, value } = await reader.read();
                                            if (done) break;
                                            chunks.push(value);
                                        }

                                        // Combine chunks and decode as text
                                        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                                        const combined = new Uint8Array(totalLength);
                                        let offset = 0;
                                        for (const chunk of chunks) {
                                            combined.set(chunk, offset);
                                            offset += chunk.length;
                                        }
                                        text = new TextDecoder('utf-8').decode(combined);
                                    } else {
                                        text = await subResponse.text();
                                    }

                                    // Convert SRT to VTT format (required for HTML5 <track> elements)
                                    if (sub.SubFormat === 'srt' || sub.SubDownloadLink.includes('.srt') || !text.startsWith('WEBVTT')) {
                                        // Add VTT header
                                        text = 'WEBVTT\n\n' + text
                                            // Convert SRT timestamps (00:00:00,000) to VTT format (00:00:00.000)
                                            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
                                            // Remove SRT numeric cue identifiers (lines with just a number)
                                            .replace(/^\d+\s*$/gm, '');
                                    }

                                    // Create data URL with VTT MIME type - use simple base64 encoding
                                    const base64 = btoa(unescape(encodeURIComponent(text)));
                                    const dataUrl = 'data:text/vtt;base64,' + base64;

                                    let label = sub.LanguageName || 'English';
                                    if (sub.MovieReleaseName) {
                                        label += ` (${sub.MovieReleaseName})`;
                                    } else if (sub.SubFileName) {
                                        label += ` (${sub.SubFileName})`;
                                    }

                                    found.push({
                                        label: label,
                                        file: dataUrl
                                    });
                                }
                            } catch (e) {
                                // Skip failed downloads
                                console.log('Sub download error:', e.message);
                            }
                        }
                    }
                } catch (e) { }
                return found;
            }, reqSeason, reqEpisode);
        } catch (e) {
            return [];
        }
    };

    // Network Response Handler
    const responseHandler = (response) => {
        const url = response.url();

        // Capture M3U8 / MP4
        if ((url.includes('.m3u8') || url.includes('.mp4')) && !url.includes('sk-')) {
            const isMaster = url.includes('master.m3u8') || url.includes('playlist.m3u8');
            const hasExisting = !!foundMedia;
            const existingIsMaster = hasExisting && (foundMedia.includes('master.m3u8') || foundMedia.includes('playlist.m3u8'));

            if (!hasExisting || (isMaster && !existingIsMaster)) {
                console.log(`[Target] 🎯 Found Media (Master: ${isMaster}): ${url}`);
                foundMedia = url;
                try {
                    const request = response.request();
                    capturedReferer = request.headers()['referer'] || page.url();
                    console.log(`[Target] 📎 Captured Referer: ${capturedReferer}`);
                } catch (e) {
                    capturedReferer = page.url();
                }
            }
        }

        // Capture Network Subtitles
        if (url.includes('.vtt') || url.includes('.srt')) {
            const label = getSubtitleLabel(url);
            if (label && !foundSubtitles.some(s => s.file === url)) {
                console.log(`[Target] 📜 Found Network Subtitle (${label}): ${url}`);
                foundSubtitles.push({ file: url, label: label });
            }
        }
    };
    page.on('response', responseHandler);

    // Extraction Loop
    for (const provider of PROVIDERS) {
        if (foundMedia && (foundMedia.includes('master.m3u8') || foundMedia.includes('playlist.m3u8'))) break;

        const targetUrl = provider.getUrl(tmdbId, type, season, episode);
        console.log(`[Extract] Trying source: ${provider.name} -> ${targetUrl}`);

        try {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
            await handlePageInteraction(page, provider.name);

            let attempts = 0;
            const MAX_ATTEMPTS = 60;
            let subtitleWait = 0;
            const SUBTITLE_WAIT_BUFFER = 4;

            while (attempts < MAX_ATTEMPTS) {
                if (foundMedia) {
                    // Wait for buffer
                    if (subtitleWait < SUBTITLE_WAIT_BUFFER) {
                        await new Promise(r => setTimeout(r, 1000));
                        subtitleWait++;
                        attempts++;
                        continue;
                    }

                    // 1. Frame Scan
                    console.log('[Extract] 🕵️ Scanning frames for hidden subtitles...');
                    const frameSubs = await scanFramesForSubtitles(page);
                    for (const sub of frameSubs) {
                        if (sub.label && (sub.label.toLowerCase().includes('english') || sub.label.toLowerCase().includes('eng'))) {
                            if (!foundSubtitles.some(s => s.file === sub.file)) {
                                console.log(`[Target] 📜 Found Frame Subtitle: ${sub.label}`);
                                foundSubtitles.push(sub);
                            }
                        }
                    }

                    // 2. API Extraction (Reverse Engineered)
                    const apiSubs = await extractSubtitlesViaAPI(page, season, episode);
                    for (const sub of apiSubs) {
                        if (!foundSubtitles.some(s => s.file === sub.file)) {
                            console.log(`[Target] 📜 Found API Subtitle: ${sub.label}`);
                            foundSubtitles.push(sub);
                        }
                    }

                    if (foundMedia.includes('master.m3u8') || foundMedia.includes('playlist.m3u8')) {
                        console.log('[Extract] 🌟 Secured Master Playlist & Subs. Done.');
                        break;
                    }

                    let buffer = 0;
                    while (buffer < 5 && !foundMedia.includes('master.m3u8') && attempts < MAX_ATTEMPTS) {
                        await new Promise(r => setTimeout(r, 1000));
                        buffer++;
                        attempts++;
                    }
                    console.log('[Extract] ⚠️ Settling for available playlist.');
                    break;
                }

                // Pulse Click
                if (attempts > 0 && attempts % 5 === 0) {
                    console.log(`[Extract] 💓 Pulse ${attempts}s: Re-clicking Play...`);
                    await tryClickPlay(page);
                }

                await new Promise(r => setTimeout(r, 1000));
                attempts++;
            }

            if (foundMedia) {
                usedProvider = provider.name;
                break;
            } else {
                console.log(`[Extract] ❌ No media found on ${provider.name} after ${attempts}s, trying next...`);
            }
        } catch (e) {
            console.log(`[Extract] ⚠️ Error on ${provider.name}: ${e.message}`);
        }
    }

    page.off('response', responseHandler);

    if (foundMedia) {
        const pageReferer = capturedReferer || page.url();
        console.log('[Extract] ✅ Success!');
        console.log(`[Extract] 🎬 Media: ${foundMedia}`);
        console.log(`[Extract] 📜 Subtitles: ${foundSubtitles.length}`);

        const proxyBase = `https://${req.get('host')}`;
        const proxiedSubtitles = foundSubtitles.map(sub => {
            // Data URLs are already self-contained, no proxy needed
            if (sub.file.startsWith('data:')) {
                return { label: sub.label, file: sub.file };
            }
            // For regular URLs, proxy them
            return {
                label: sub.label,
                file: `${proxyBase}/api/proxy/segment?url=${encodeURIComponent(sub.file)}&referer=${encodeURIComponent(pageReferer)}`
            };
        });

        res.json({
            success: true,
            m3u8Url: foundMedia,
            subtitles: proxiedSubtitles,
            provider: usedProvider,
            referer: pageReferer
        });
    } else {
        const title = await page.title();
        console.log('[Extract] 💥 Failed. Last Title:', title);
        res.status(500).json({ success: false, error: 'Extraction failed', debug: title });
    }
});

async function tryClickPlay(page) {
    try {
        const playSelectors = [
            '#player_code', '.play-btn', '#play-button', 'div[class*="play"]',
            'button[class*="play"]', '.jw-display-icon-container', 'video'
        ];
        for (const sel of playSelectors) {
            try {
                const el = await page.$(sel);
                if (el && await el.isVisible()) {
                    await el.click();
                    return;
                }
            } catch (e) { }
        }
        await page.mouse.click(640, 360);
    } catch (e) { }
}

async function handlePageInteraction(page, providerName) {
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Cloudflare') || title.includes('Attention')) {
        console.log('[Clicker] 🛡️ Cloudflare detected. Jiggling...');
        try {
            await page.mouse.move(100, 100);
            await page.mouse.move(200, 200);
            await page.mouse.click(200, 200);
            const frames = page.frames();
            for (const f of frames) {
                if (f.url().includes('turnstile') || f.url().includes('challenge')) {
                    const box = await f.boundingBox('body');
                    if (box) await page.mouse.click(box.x + 10, box.y + 10);
                }
            }
        } catch (e) { }
        await new Promise(r => setTimeout(r, 4000));
    }
    console.log('[Clicker] Initial Play Button hunt...');
    await tryClickPlay(page);
}

app.get('/api/proxy/m3u8', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('No URL');
    const decodedUrl = decodeURIComponent(url);
    const decodedReferer = referer ? decodeURIComponent(referer) : null;

    try {
        const urlObj = new URL(decodedUrl);
        const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);
        const effectiveReferer = decodedReferer || 'https://vidsrc-embed.ru/';

        const response = await axios({
            method: 'get',
            url: decodedUrl,
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': effectiveReferer,
                'Origin': new URL(effectiveReferer).origin,
                'Accept': '*/*'
            }
        });

        let content = response.data;
        const proxyBase = `https://${req.get('host')}`;
        const refererParam = effectiveReferer ? `&referer=${encodeURIComponent(effectiveReferer)}` : '';

        const lines = content.split('\n');
        const rewrittenLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                if (trimmed.includes('URI="')) {
                    return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                        const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
                        return `URI="${proxyBase}/api/proxy/segment?url=${encodeURIComponent(absoluteUri)}${refererParam}"`;
                    });
                }
                return line;
            }
            let absoluteUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
            if (absoluteUrl.includes('.m3u8') || absoluteUrl.includes('.M3U8')) {
                return `${proxyBase}/api/proxy/m3u8?url=${encodeURIComponent(absoluteUrl)}${refererParam}`;
            } else {
                return `${proxyBase}/api/proxy/segment?url=${encodeURIComponent(absoluteUrl)}${refererParam}`;
            }
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenLines.join('\n'));
    } catch (e) {
        console.error('[Proxy] M3U8 Error:', e.message);
        res.status(500).send('Proxy Error');
    }
});

app.get('/api/proxy/segment', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('No URL');
    const decodedUrl = decodeURIComponent(url);
    const decodedReferer = referer ? decodeURIComponent(referer) : '';

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };

        // OpenSubtitles requires the X-User-Agent header for downloads
        if (decodedUrl.includes('opensubtitles')) {
            headers['X-User-Agent'] = 'trailers.to-UA';
        } else if (decodedReferer) {
            headers['Referer'] = decodedReferer;
            try {
                headers['Origin'] = new URL(decodedReferer).origin;
            } catch (e) { }
        }

        const response = await axios({
            method: 'get',
            url: decodedUrl,
            responseType: 'arraybuffer', // Changed to arraybuffer to handle gzip
            headers: headers,
            timeout: 30000,
            decompress: true // Axios will auto-decompress gzip
        });

        // For subtitle files, set appropriate content type
        if (decodedUrl.includes('.srt') || decodedUrl.includes('opensubtitles')) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        } else if (decodedUrl.includes('.vtt')) {
            res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        } else if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(response.data);
    } catch (e) {
        console.error('[Segment] Error:', e.message, 'URL:', decodedUrl);
        res.status(500).send('Segment Proxy Error');
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🎬 Multi-Source Scraper on ${PORT}`));
