/**
 * FlixNest Backend Scraper
 * 
 * Playwright-based m3u8 extraction service.
 * This runs a headless browser to extract stream URLs from vidsrc.cc.
 * 
 * Why this works:
 * - Playwright runs a REAL browser (not subject to origin restrictions)
 * - Network interception happens in CDP (Chrome DevTools Protocol)
 * - vidsrc.cc has no way to reject it (it's a legitimate browser)
 * 
 * Usage:
 *   npm install
 *   npm start
 *   
 * API:
 *   GET /api/extract?tmdbId=278&type=movie
 *   GET /api/extract?tmdbId=1396&type=tv&season=1&episode=1
 */

const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Cache for m3u8 URLs (avoid re-scraping)
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cache: cache.size });
});

// Main extraction endpoint
app.get('/api/extract', async (req, res) => {
  const { tmdbId, type, season, episode } = req.query;

  // Validate inputs
  if (!tmdbId || !type) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameters: tmdbId and type' 
    });
  }

  if (!['movie', 'tv'].includes(type)) {
    return res.status(400).json({ 
      success: false,
      error: 'Type must be "movie" or "tv"' 
    });
  }

  if (type === 'tv' && (!season || !episode)) {
    return res.status(400).json({ 
      success: false,
      error: 'TV shows require season and episode parameters' 
    });
  }

  // Check cache
  const cacheKey = `${type}-${tmdbId}-${season || 'n/a'}-${episode || 'n/a'}`;
  if (cache.has(cacheKey)) {
    console.log(`[Cache] ✅ Returning cached m3u8 for: ${cacheKey}`);
    return res.json(cache.get(cacheKey));
  }

  let browser = null;

  try {
    console.log(`[Scraper] 🔍 Extracting m3u8 for: ${cacheKey}`);
    const startTime = Date.now();

    // Launch browser
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Store captured data
    let m3u8Url = null;
    let subtitles = [];
    let serverName = 'unknown';

    // Intercept network responses
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      // Look for /api/source/{hash} responses (contains m3u8 URL)
      if (url.includes('/api/source/') && status === 200) {
        console.log(`[Interceptor] 📡 Found /api/source/ response: ${url.substring(0, 80)}...`);
        try {
          const data = await response.json();
          if (data.data && data.data.source) {
            m3u8Url = data.data.source;
            subtitles = data.data.subtitles || [];
            console.log(`[Interceptor] ✅ Extracted m3u8: ${m3u8Url.substring(0, 80)}...`);
            console.log(`[Interceptor] 📝 Subtitles: ${subtitles.length} track(s)`);
          }
        } catch (e) {
          console.error(`[Interceptor] ❌ Failed to parse response:`, e.message);
        }
      }

      // Also look for /api/{id}/servers to get server names
      if (url.includes('/api/') && url.includes('/servers') && status === 200) {
        try {
          const data = await response.json();
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            serverName = data.data[0].name || 'VidPlay';
            console.log(`[Interceptor] 🖥️ Server: ${serverName}`);
          }
        } catch (e) {
          // Ignore parsing errors for servers
        }
      }
    });

    // Build vidsrc.cc URL
    let vidsrcUrl;
    if (type === 'movie') {
      vidsrcUrl = `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;
    } else {
      vidsrcUrl = `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`;
    }

    console.log(`[Scraper] 🌐 Navigating to: ${vidsrcUrl}`);

    // Navigate to vidsrc.cc
    await page.goto(vidsrcUrl, { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });

    // Wait for m3u8 to be captured (poll every 500ms, max 30 attempts = 15 seconds)
    let retries = 0;
    const maxRetries = 30;
    while (!m3u8Url && retries < maxRetries) {
      await page.waitForTimeout(500);
      retries++;
      
      // Log progress every 5 retries
      if (retries % 5 === 0) {
        console.log(`[Scraper] ⏳ Waiting for m3u8... (${retries * 0.5}s)`);
      }
    }

    // Close browser
    await browser.close();
    browser = null;

    const extractionTime = Date.now() - startTime;

    if (!m3u8Url) {
      console.error(`[Scraper] ❌ Failed to extract m3u8 for: ${cacheKey} (${extractionTime}ms)`);
      return res.status(404).json({ 
        success: false,
        error: 'Could not extract m3u8 URL. The video may not be available.',
        extractionTime
      });
    }

    // Build result
    const result = { 
      success: true,
      m3u8Url, 
      subtitles, 
      serverName,
      extractionTime,
      cached: false
    };

    // Cache result
    cache.set(cacheKey, { ...result, cached: true });
    setTimeout(() => cache.delete(cacheKey), CACHE_TTL);

    console.log(`[Scraper] ✅ Success! (${extractionTime}ms) m3u8: ${m3u8Url.substring(0, 60)}...`);
    res.json(result);

  } catch (error) {
    console.error(`[Scraper] 💥 Error:`, error.message);
    
    // Ensure browser is closed on error
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ============================================================
// M3U8 PROXY ENDPOINT (bypass CORS for HLS streams)
// ============================================================

app.get('/api/proxy/m3u8', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    console.log(`[Proxy] Fetching m3u8: ${url.substring(0, 80)}...`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://vidsrc.cc/',
        'Origin': 'https://vidsrc.cc',
      },
    });

    if (!response.ok) {
      console.error(`[Proxy] Fetch failed: ${response.status}`);
      return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    let content = await response.text();

    // If this is a master playlist, rewrite variant playlist URLs to also go through proxy
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    
    // Rewrite relative URLs to absolute, then proxy them
    content = content.replace(/^(?!#)(?!https?:\/\/)(.+\.m3u8.*)$/gm, (match, path) => {
      const absoluteUrl = path.startsWith('/') ? new URL(path, url).href : baseUrl + path;
      return `/api/proxy/m3u8?url=${encodeURIComponent(absoluteUrl)}`;
    });

    // Rewrite .ts segment URLs
    content = content.replace(/^(?!#)(?!https?:\/\/)(.+\.ts.*)$/gm, (match, path) => {
      const absoluteUrl = path.startsWith('/') ? new URL(path, url).href : baseUrl + path;
      return `/api/proxy/segment?url=${encodeURIComponent(absoluteUrl)}`;
    });

    // Also handle absolute URLs (rewrite them to go through proxy)
    content = content.replace(/^(https?:\/\/.+\.m3u8.*)$/gm, (match, absUrl) => {
      return `/api/proxy/m3u8?url=${encodeURIComponent(absUrl)}`;
    });

    content = content.replace(/^(https?:\/\/.+\.ts.*)$/gm, (match, absUrl) => {
      return `/api/proxy/segment?url=${encodeURIComponent(absUrl)}`;
    });

    // Set CORS headers
    res.set({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    res.send(content);

  } catch (error) {
    console.error(`[Proxy] Error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy for .ts segments (binary passthrough)
app.get('/api/proxy/segment', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://vidsrc.cc/',
        'Origin': 'https://vidsrc.cc',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'video/mp2t';
    
    // Set CORS headers
    res.set({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    // Stream the response body
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error(`[Proxy] Segment error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Clear cache endpoint (for debugging)
app.post('/api/cache/clear', (req, res) => {
  const size = cache.size;
  cache.clear();
  console.log(`[Cache] 🗑️ Cleared ${size} entries`);
  res.json({ success: true, cleared: size });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('');
  console.log('🎬 ═══════════════════════════════════════════════════════');
  console.log(`🎬 FlixNest Scraper running on http://localhost:${PORT}`);
  console.log('🎬 ═══════════════════════════════════════════════════════');
  console.log('');
  console.log('📡 Endpoints:');
  console.log(`   GET  /api/extract?tmdbId=278&type=movie`);
  console.log(`   GET  /api/extract?tmdbId=1396&type=tv&season=1&episode=1`);
  console.log(`   GET  /health`);
  console.log(`   POST /api/cache/clear`);
  console.log('');
});
