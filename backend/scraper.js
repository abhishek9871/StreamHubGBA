/**
 * MappletTV M3U8 Extractor for FlixNest
 * 
 * This scraper extracts M3U8 streaming URLs from mappletv.uk (mapple.uk)
 * using puppeteer-real-browser for stealth and Turnstile bypass.
 * 
 * Usage:
 *   - GET /api/mappletv/extract?tmdbId=812583&type=movie
 *   - GET /api/mappletv/extract?tmdbId=12345&type=tv&season=1&episode=1
 * 
 * Returns:
 *   {
 *     success: true,
 *     m3u8Url: "https://...",
 *     referer: "https://mapple.uk/",
 *     provider: "mappletv",
 *     qualities: ["1080p", "720p", "480p"],
 *     subtitles: [...]
 *   }
 */

import express from 'express';
import cors from 'cors';
import { connect } from 'puppeteer-real-browser';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());

// Browser Session Management
let browserInstance = null;
let pageInstance = null;

/**
 * Get or create browser instance
 */
async function getBrowser() {
    if (browserInstance && pageInstance && !pageInstance.isClosed()) {
        return { browser: browserInstance, page: pageInstance };
    }

    console.log('[Browser] 🚀 Launching Real Browser (Stealth)...');
    const { browser, page } = await connect({
        headless: false, // Must be visible to bypass bot detection
        turnstile: true, // Handle Cloudflare Turnstile
        fingerprint: true, // Anti-fingerprint detection
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

    // Enable request interception
    await page.setRequestInterception(true);
    page.on('request', req => req.continue());

    // 🛡️ POPUP KILLER - Close popup tabs
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            try {
                const newPage = await target.page();
                if (newPage && newPage !== page) {
                    console.log('[Popup] 🚫 Closing popup');
                    await newPage.close();
                    if (page && !page.isClosed()) await page.bringToFront();
                }
            } catch (e) { }
        }
    });

    return { browser, page };
}

/**
 * Pre-warm the browser by visiting MappletTV homepage
 * This establishes cookies, passes Cloudflare, and caches assets
 */
async function warmBrowser() {
    console.log('[Warmup] 🔥 Pre-warming browser...');
    const warmupStart = Date.now();

    try {
        const { browser, page } = await getBrowser();

        // Navigate to MappletTV homepage to establish session
        console.log('[Warmup] 📍 Navigating to MappletTV homepage...');
        await page.goto('https://mappletv.uk/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        // Check for Cloudflare and handle it
        const title = await page.title();
        if (title.includes('Just a moment') || title.includes('Cloudflare')) {
            console.log('[Warmup] 🛡️ Cloudflare detected, waiting for challenge...');
            // Human-like mouse movements
            await page.mouse.move(100, 100);
            await page.mouse.move(300, 200);
            await page.mouse.move(200, 300);
            await page.mouse.click(300, 300);
            // Wait for Cloudflare to complete
            await new Promise(r => setTimeout(r, 5000));

            // Wait for page to change
            await page.waitForFunction(() => {
                return !document.title.includes('Just a moment') && !document.title.includes('Cloudflare');
            }, { timeout: 30000 }).catch(() => { });
        }

        // Scroll and interact to simulate real user
        await page.evaluate(() => {
            window.scrollTo(0, 300);
        });
        await new Promise(r => setTimeout(r, 1000));

        // Navigate back to blank to be ready for actual requests
        await page.goto('about:blank', { timeout: 5000 }).catch(() => { });

        const warmupTime = Date.now() - warmupStart;
        console.log(`[Warmup] ✅ Browser warmed up in ${warmupTime}ms`);
        console.log('[Warmup] 🍪 Cookies and session established');

        return true;
    } catch (error) {
        console.error('[Warmup] ⚠️ Warmup failed:', error.message);
        console.log('[Warmup] Will warm up on first request instead');
        return false;
    }
}

/**
 * Build MappletTV URL for content
 * Movie: https://mapple.uk/watch/movie/{tmdbId}
 * TV: https://mapple.uk/watch/tv/{tmdbId}-{season}-{episode}
 */
function getMappletTVUrl(tmdbId, type, season, episode) {
    if (type === 'movie') {
        return `https://mappletv.uk/watch/movie/${tmdbId}?autoPlay=true`;
    } else {
        // Correct format: /watch/tv/{tmdbId}-{season}-{episode}
        return `https://mappletv.uk/watch/tv/${tmdbId}-${season}-${episode}?autoPlay=true`;
    }
}

/**
 * Try clicking play button on page
 */
async function tryClickPlay(page) {
    const playSelectors = [
        '#play-button', '.play-button', '.play-btn',
        'button[class*="play"]', 'div[class*="play"]',
        '.jw-display-icon-container', '.plyr__control--overlaid',
        'button.vjs-big-play-button', '.player-overlay button',
        '[data-plyr="play"]', 'video', '.loading', 'main'
    ];

    for (const sel of playSelectors) {
        try {
            const el = await page.$(sel);
            if (el) {
                const box = await el.boundingBox();
                if (box && box.width > 0 && box.height > 0) {
                    await el.click();
                    await new Promise(r => setTimeout(r, 500));
                    return true;
                }
            }
        } catch (e) { }
    }

    // Fallback: Click center of page
    try {
        await page.mouse.click(640, 360);
    } catch (e) { }

    return false;
}

/**
 * Try to switch to a specific server
 * Uses Puppeteer's NATIVE click methods (not page.evaluate) to properly trigger React events
 * Flow: 1. Click "switch server" → 2. Click server button → 3. Click "Confirm" → 4. Wait for load
 * @param {Page} page - Puppeteer page
 * @param {number} serverNum - Server number to select (2, 3, 4, 5)
 */
async function trySwitchServer(page, serverNum) {
    console.log(`[Server] 🔄 Switching to server ${serverNum}...`);

    try {
        // Step 1: Click "switch server" button
        // Selector: //button[contains(., "switch server")]
        console.log('[Server] Step 1: Looking for switch server button...');

        let switchButtonClicked = false;

        // Try precise verified XPath first
        const switchXpaths = [
            "//button[contains(., 'switch server')]",
            "//button[contains(., 'Not working')]",
            "//span[contains(., 'switch server')]/ancestor::button", // If text is in span
            "//div[contains(., 'switch server') and @role='button']"
        ];

        for (const xpath of switchXpaths) {
            try {
                const buttons = await page.$x(xpath);
                for (const btn of buttons) {
                    // double check visibility
                    const box = await btn.boundingBox();
                    if (box && box.width > 30 && box.height > 10) {
                        console.log(`[Server] ✅ Found switch button via XPath: ${xpath}`);
                        await btn.click({ delay: 100 });
                        switchButtonClicked = true;
                        break;
                    }
                }
                if (switchButtonClicked) break;
            } catch (e) { }
        }

        if (!switchButtonClicked) {
            console.log('[Server] ⚠️ Could not find switch server button via XPath, trying text fallback...');
            // Fallback: search all buttons text
            const allButtons = await page.$$('button');
            for (const btn of allButtons) {
                const text = await btn.evaluate(e => e.textContent?.toLowerCase() || '');
                if (text.includes('switch server') && text.includes('not working')) {
                    await btn.click({ delay: 100 });
                    switchButtonClicked = true;
                    console.log('[Server] ✅ Found switch button via text scan');
                    break;
                }
            }
        }

        if (!switchButtonClicked) {
            console.log('[Server] ⚠️ Could not find switch server button');
            return false;
        }

        // Wait for menu to open
        await new Promise(r => setTimeout(r, 2000));

        // Step 2: Click Server X button
        // Selector verified: //button[starts-with(normalize-space(.), "Server X")]
        console.log(`[Server] Step 2: Looking for Server ${serverNum} button...`);

        let serverButtonClicked = false;
        // Logic: "Server 2" should be at start of string to avoid matching "Server 24"
        const serverXpaths = [
            `//button[starts-with(normalize-space(.), "Server ${serverNum}")]`,
            `//button[contains(., "Server ${serverNum}")]` // Fallback
        ];

        for (const xpath of serverXpaths) {
            try {
                const buttons = await page.$x(xpath);
                for (const btn of buttons) {
                    const text = await btn.evaluate(e => e.textContent?.trim() || '');

                    // Verify correct number (avoid Server 24 matching Server 2)
                    // Check if it's "Server 2" exactly or "Server 2 -" or "Server 2 "
                    const regex = new RegExp(`^Server\\s*${serverNum}(\\s|$|-)`, 'i');
                    if (regex.test(text)) {
                        console.log(`[Server] ✅ Found Server ${serverNum} button: "${text.substring(0, 30)}..."`);
                        await btn.click({ delay: 100 });
                        serverButtonClicked = true;
                        break;
                    }
                }
                if (serverButtonClicked) break;
            } catch (e) { }
        }

        if (!serverButtonClicked) {
            console.log('[Server] ⚠️ Server button not found via XPath, trying legacy coordinates...');
            // Server buttons appear at bottom of player area
            const yOffset = 500 + (serverNum - 2) * 45;
            await page.mouse.click(350, yOffset);
        }

        // Wait for any confirm dialog
        await new Promise(r => setTimeout(r, 1500));

        // Step 3: Click Confirm/Try Again if present
        try {
            const confirmXpaths = [
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'confirm')]",
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'try again')]", // For "Verification failed" etc
                "//button[contains(., 'Yes')]"
            ];

            for (const xpath of confirmXpaths) {
                const [btn] = await page.$x(xpath);
                if (btn) {
                    const box = await btn.boundingBox();
                    if (box && box.width > 0 && box.height > 0) {
                        console.log(`[Server] ✅ Found popup/confirm button via XPath: ${xpath}`);
                        await btn.click({ delay: 100 });
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }
        } catch (e) { }

        // Escape to close menu if still open
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 500));

        // Ensure play is clicked again
        await tryClickPlay(page);

        console.log(`[Server] ✅ Switching flow complete for Server ${serverNum}`);
        return true;
    } catch (error) {
        console.error('[Server] ❌ Error switching server:', error.message);
        return false;
    }
}

/**
 * Parse subtitles from M3U8 content
 * @param {string} m3u8Content - The M3U8 manifest content
 * @param {string} baseUrl - The base URL for resolving relative paths
 */
function parseSubtitles(m3u8Content, baseUrl = '') {
    const subtitles = [];
    const lines = m3u8Content.split('\n');

    for (const line of lines) {
        if (line.includes('#EXT-X-MEDIA:TYPE=SUBTITLES')) {
            const nameMatch = line.match(/NAME="([^"]+)"/);
            const langMatch = line.match(/LANGUAGE="([^"]+)"/);
            const uriMatch = line.match(/URI="([^"]+)"/);

            if (nameMatch && uriMatch) {
                let subtitleUrl = uriMatch[1];

                // Resolve relative URLs
                if (!subtitleUrl.startsWith('http')) {
                    try {
                        subtitleUrl = new URL(subtitleUrl, baseUrl).href;
                    } catch (e) {
                        console.log('[Subtitles] Could not resolve URL:', subtitleUrl);
                    }
                }

                subtitles.push({
                    label: nameMatch[1],
                    language: langMatch ? langMatch[1] : 'en',
                    file: subtitleUrl
                });
            }
        }
    }

    console.log(`[Subtitles] Found ${subtitles.length} subtitle tracks`);
    return subtitles;
}

/**
 * Fetch M3U8 content and extract subtitles
 */
async function fetchSubtitles(m3u8Url, referer) {
    try {
        console.log('[Subtitles] Fetching M3U8 for subtitle extraction:', m3u8Url.substring(0, 80) + '...');

        const response = await axios.get(m3u8Url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': referer || 'https://mapple.uk/',
                'Origin': 'https://mapple.uk'
            },
            timeout: 15000
        });

        const content = response.data;
        const subtitles = parseSubtitles(content, m3u8Url);

        return subtitles;
    } catch (error) {
        console.log('[Subtitles] Failed to fetch M3U8 for subtitles:', error.message);
        return [];
    }
}

/**
 * Parse quality options from M3U8 content
 */
function parseQualities(m3u8Content) {
    const qualities = [];
    const lines = m3u8Content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('#EXT-X-STREAM-INF')) {
            const resMatch = lines[i].match(/RESOLUTION=(\d+x\d+)/);
            const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);

            if (resMatch) {
                const height = resMatch[1].split('x')[1];
                qualities.push({
                    resolution: resMatch[1],
                    quality: `${height}p`,
                    bandwidth: bwMatch ? parseInt(bwMatch[1]) : 0,
                    url: lines[i + 1] // Next line is the URL
                });
            }
        }
    }

    return qualities.sort((a, b) => b.bandwidth - a.bandwidth);
}

/**
 * Main extraction endpoint
 */
app.get('/api/mappletv/extract', async (req, res) => {
    const { tmdbId, season, episode, type } = req.query;

    if (!tmdbId || !type) {
        return res.status(400).json({
            success: false,
            error: 'Missing required params: tmdbId, type'
        });
    }

    const contentId = `${type}-${tmdbId}${type === 'tv' ? `-S${season}E${episode}` : ''}`;
    console.log(`\n[Extract] 🎬 Starting extraction for ${contentId}...`);

    let browser, page;
    try {
        ({ browser, page } = await getBrowser());
    } catch (e) {
        return res.status(500).json({
            success: false,
            error: 'Browser launch failed: ' + e.message
        });
    }

    let foundMedia = null;
    let capturedReferer = null;
    const m3u8Urls = [];

    // Network Response Handler
    const responseHandler = async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Capture M3U8 URLs
        if ((url.includes('.m3u8') || contentType.includes('mpegurl')) && !url.includes('sk-')) {
            console.log(`[Target] 🎯 Found M3U8: ${url.substring(0, 80)}...`);
            m3u8Urls.push(url);

            if (!foundMedia || url.includes('master') || url.includes('playlist') || url.includes('index')) {
                foundMedia = url;
                try {
                    capturedReferer = response.request().headers()['referer'] || page.url();
                } catch (e) {
                    capturedReferer = page.url();
                }
            }
        }

        // Also check JSON/text responses for embedded M3U8 URLs
        if (contentType.includes('json') || contentType.includes('text/html')) {
            try {
                const text = await response.text();
                const matches = text.match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi);
                if (matches) {
                    matches.forEach(m => {
                        if (!m3u8Urls.includes(m)) {
                            console.log(`[Target] 🎯 Found M3U8 in response: ${m.substring(0, 60)}...`);
                            m3u8Urls.push(m);
                            if (!foundMedia) foundMedia = m;
                        }
                    });
                }
            } catch (e) { }
        }
    };

    page.on('response', responseHandler);

    const targetUrl = getMappletTVUrl(tmdbId, type, season, episode);
    console.log(`[Extract] 📍 Navigating to: ${targetUrl}`);
    const startTime = Date.now();

    try {
        // CLEANUP: Navigate to blank page first to clear any leftover state
        try {
            await page.goto('about:blank', { timeout: 5000 });
            await new Promise(r => setTimeout(r, 500));
        } catch (e) { /* ignore */ }

        // OPTIMIZATION: Use domcontentloaded and increased timeout
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        console.log(`[Extract] ✅ Page loaded in ${Date.now() - startTime}ms`);

        // Handle Cloudflare if present (only wait if actually blocked)
        const title = await page.title();
        if (title.includes('Just a moment') || title.includes('Cloudflare')) {
            console.log('[Extract] 🛡️ Cloudflare detected, handling...');
            await page.mouse.move(100, 100);
            await page.mouse.move(200, 200);
            await page.mouse.click(200, 200);
            await new Promise(r => setTimeout(r, 3000)); // Reduced from 10s
        }

        // OPTIMIZATION: Minimal wait, just enough for JS to initialize
        await new Promise(r => setTimeout(r, 300));

        // Click play button immediately
        console.log('[Extract] 🎬 Clicking play...');
        await tryClickPlay(page);

        // Multi-server approach: Try primary server first, then fallback servers
        const MAX_SERVERS = 4;  // Try up to 4 servers
        const SERVER_TIMEOUT = 30000;  // 30 seconds per server (increased for slow sites)
        const POLL_INTERVAL = 200;

        for (let serverNum = 1; serverNum <= MAX_SERVERS; serverNum++) {
            console.log(`[Extract] 📡 Trying server ${serverNum}/${MAX_SERVERS}...`);

            let elapsed = 0;

            while (elapsed < SERVER_TIMEOUT) {
                if (foundMedia) {
                    const totalTime = Date.now() - startTime;
                    console.log(`[Extract] 🎉 Found media on server ${serverNum} in ${totalTime}ms`);

                    page.off('response', responseHandler);

                    // Fetch subtitles from the M3U8 content
                    const effectiveReferer = capturedReferer || 'https://mapple.uk/';
                    console.log('[Extract] 📝 Fetching subtitles...');
                    const subtitles = await fetchSubtitles(foundMedia, effectiveReferer);

                    return res.json({
                        success: true,
                        m3u8Url: foundMedia,
                        referer: effectiveReferer,
                        provider: 'mappletv',
                        server: serverNum,
                        extractionTime: totalTime,
                        subtitles: subtitles
                    });
                }

                // Click play every 5 seconds
                if (elapsed > 0 && elapsed % 5000 === 0) {
                    console.log(`[Extract] 💓 Server ${serverNum}: ${(elapsed / 1000).toFixed(0)}s...`);
                    await tryClickPlay(page);
                }

                await new Promise(r => setTimeout(r, POLL_INTERVAL));
                elapsed += POLL_INTERVAL;
            }

            // Server didn't return M3U8 - try switching to next server
            if (serverNum < MAX_SERVERS) {
                console.log(`[Extract] ⚠️ Server ${serverNum} failed, switching to server ${serverNum + 1}...`);
                const switched = await trySwitchServer(page, serverNum + 1);
                if (!switched) {
                    console.log('[Extract] ⚠️ Could not find switch server button, trying fallback clicks...');
                    // Try clicking in the area where server buttons might be
                    await page.mouse.click(640, 550);
                    await new Promise(r => setTimeout(r, 1500));
                }
                await tryClickPlay(page);
            }
        }

        page.off('response', responseHandler);

        // All servers failed
        console.log(`[Extract] ❌ No media found after trying ${MAX_SERVERS} servers`);
        return res.status(500).json({
            success: false,
            error: `Could not extract M3U8 URL after trying ${MAX_SERVERS} servers`,
            debug: {
                finalUrl: page.url(),
                title: await page.title(),
                serversAttempted: MAX_SERVERS
            }
        });

    } catch (error) {
        console.error('[Extract] ❌ Error:', error.message);
        page.off('response', responseHandler);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Proxy endpoint for M3U8 playlists - rewrites internal URLs to proxy
 */
app.get('/api/proxy/m3u8', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('No URL provided');

    const decodedUrl = decodeURIComponent(url);
    const effectiveReferer = referer ? decodeURIComponent(referer) : 'https://mapple.uk/';
    const baseUrl = new URL(decodedUrl);

    console.log('[Proxy] Fetching M3U8:', decodedUrl.substring(0, 80) + '...');

    // Retry logic for reliability
    let response;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            response = await axios.get(decodedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': effectiveReferer,
                    'Origin': new URL(effectiveReferer).origin
                },
                timeout: 60000 // Increased to 60s
            });
            break; // Success, exit retry loop
        } catch (e) {
            lastError = e;
            if (attempt < 3) {
                console.log(`[Proxy] M3U8 retry ${attempt}/3...`);
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    if (!response) {
        console.error('[Proxy] M3U8 Error after 3 attempts:', lastError?.message);
        return res.status(500).send('Proxy Error: ' + (lastError?.message || 'Unknown'));
    }

    try {
        let content = response.data;

        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');

        // Rewrite all URLs in the M3U8 to go through our proxy
        // We need to detect if a URL is for a playlist (.m3u8) or segment (.ts/.mp4/.aac etc)
        // Lines after #EXT-X-STREAM-INF or #EXT-X-MEDIA are playlists

        const lines = content.split('\n');
        const rewrittenLines = [];
        let nextLineIsPlaylist = false;

        // Build dynamic proxy base URL from request (once, outside loop)
        // IMPORTANT: Force HTTPS on Hugging Face (reverse proxy reports http but external access is https)
        const host = req.get('host') || 'localhost:7860';
        const isHuggingFace = host.includes('hf.space');
        const protocol = isHuggingFace ? 'https' : (req.protocol || 'http');
        const proxyBase = `${protocol}://${host}/api/proxy/`;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmed = line.trim();

            // Check if this is a header that indicates next line is a playlist URL
            if (trimmed.startsWith('#EXT-X-STREAM-INF:') || trimmed.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) {
                nextLineIsPlaylist = true;
                rewrittenLines.push(line);
                continue;
            }

            // Check for URI= in EXT-X-KEY lines (encryption keys - CRITICAL for playback!)
            if (trimmed.startsWith('#EXT-X-KEY:')) {
                line = line.replace(/URI="([^"]+)"/g, (match, uri) => {
                    if (uri.includes('/api/proxy/')) return match;
                    const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
                    // Keys go through segment proxy (binary data)
                    const proxyUrl = `${proxyBase}segment?url=${encodeURIComponent(absoluteUri)}&referer=${encodeURIComponent(effectiveReferer)}`;
                    return `URI="${proxyUrl}"`;
                });
                rewrittenLines.push(line);
                continue;
            }

            // Check for URI= in EXT-X-MEDIA lines
            if (trimmed.startsWith('#EXT-X-MEDIA:')) {
                line = line.replace(/URI="([^"]+)"/g, (match, uri) => {
                    if (uri.includes('/api/proxy/')) return match;
                    const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
                    const proxyUrl = `${proxyBase}m3u8?url=${encodeURIComponent(absoluteUri)}&referer=${encodeURIComponent(effectiveReferer)}`;
                    return `URI="${proxyUrl}"`;
                });
                rewrittenLines.push(line);
                continue;
            }

            // Non-URL lines
            if (!trimmed || trimmed.startsWith('#')) {
                rewrittenLines.push(line);
                continue;
            }

            // This is a URL line - determine if playlist or segment
            let absoluteUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;

            // Skip if already proxied
            if (absoluteUrl.includes('/api/proxy/')) {
                rewrittenLines.push(line);
                nextLineIsPlaylist = false;
                continue;
            }

            // Determine proxy type based on context and URL pattern
            const isM3u8 = nextLineIsPlaylist ||
                absoluteUrl.endsWith('.m3u8') ||
                absoluteUrl.includes('.m3u8?') ||
                absoluteUrl.includes('/playlist/') ||
                absoluteUrl.includes('type=video') ||
                absoluteUrl.includes('type=audio');

            if (isM3u8) {
                line = `${proxyBase}m3u8?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(effectiveReferer)}`;
            } else {
                line = `${proxyBase}segment?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(effectiveReferer)}`;
            }

            rewrittenLines.push(line);
            nextLineIsPlaylist = false;
        }

        content = rewrittenLines.join('\n');

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(content);
    } catch (e) {
        console.error('[Proxy] M3U8 Error:', e.message);
        res.status(500).send('Proxy Error: ' + e.message);
    }
});

/**
 * Proxy endpoint for segments/keys
 */
app.get('/api/proxy/segment', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('No URL provided');

    const decodedUrl = decodeURIComponent(url);
    const effectiveReferer = referer ? decodeURIComponent(referer) : 'https://mapple.uk/';

    // Retry logic for reliability
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.get(decodedUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': effectiveReferer,
                    'Origin': new URL(effectiveReferer).origin
                },
                timeout: 60000 // Increased to 60s
            });

            if (response.headers['content-type']) {
                res.setHeader('Content-Type', response.headers['content-type']);
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', '*');
            return res.send(response.data);
        } catch (e) {
            lastError = e;
            if (attempt < 3) {
                console.log(`[Proxy] Segment retry ${attempt}/3 for: ${decodedUrl.substring(0, 50)}...`);
                await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
            }
        }
    }
    console.error('[Proxy] Segment Error after 3 attempts:', lastError.message);
    res.status(500).send('Proxy Error');
});

/**
 * Proxy endpoint for subtitle files (VTT, SRT, etc.)
 */
app.get('/api/proxy/subtitle', async (req, res) => {
    const { url, referer } = req.query;
    if (!url) return res.status(400).send('No URL provided');

    const decodedUrl = decodeURIComponent(url);
    const effectiveReferer = referer ? decodeURIComponent(referer) : 'https://mapple.uk/';

    try {
        const response = await axios.get(decodedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': effectiveReferer,
                'Origin': new URL(effectiveReferer).origin
            },
            timeout: 30000,
            responseType: 'text'
        });

        // Set appropriate content type for subtitles
        const contentType = decodedUrl.includes('.vtt') ? 'text/vtt' :
                           decodedUrl.includes('.srt') ? 'text/plain' :
                           response.headers['content-type'] || 'text/plain';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Content-Type', contentType);
        res.send(response.data);
    } catch (e) {
        console.error('[Proxy] Subtitle Error:', e.message);
        res.status(500).send('Subtitle proxy error');
    }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        provider: 'mappletv'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => console.log(`🎬 MappletTV Scraper on ${PORT}`));
