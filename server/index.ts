/**
 * FlixNest Backend Server
 * 
 * Express API for stream extraction from video providers.
 * This runs server-side to bypass CORS restrictions.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { extractVidsrcStream } from './extractors/vidsrc';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * Stream Extraction Endpoint
 * 
 * GET /api/extract-stream?tmdbId=278&type=movie
 * GET /api/extract-stream?tmdbId=1396&type=tv&season=1&episode=1
 * 
 * Returns:
 * {
 *   success: boolean,
 *   m3u8?: string,
 *   streams?: Array<{ url, quality, provider }>,
 *   error?: string
 * }
 */
app.get('/api/extract-stream', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { tmdbId, type, season, episode } = req.query;

    // Validate required params
    if (!tmdbId || !type) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: tmdbId and type',
      });
      return;
    }

    if (type !== 'movie' && type !== 'tv') {
      res.status(400).json({
        success: false,
        error: 'Type must be "movie" or "tv"',
      });
      return;
    }

    // For TV shows, require season and episode
    if (type === 'tv' && (!season || !episode)) {
      res.status(400).json({
        success: false,
        error: 'TV shows require season and episode parameters',
      });
      return;
    }

    console.log(`[Server] Extracting stream: ${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`);

    // Extract stream
    const result = await extractVidsrcStream({
      tmdbId: String(tmdbId),
      type: type as 'movie' | 'tv',
      season: season ? Number(season) : undefined,
      episode: episode ? Number(episode) : undefined,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Server] Extraction completed in ${elapsed}ms:`, result.success ? 'SUCCESS' : 'FAILED');

    if (result.success && result.streams.length > 0) {
      res.json({
        success: true,
        m3u8: result.streams[0].url,
        streams: result.streams,
        extractionTimeMs: elapsed,
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error || 'No streams found',
        extractionTimeMs: elapsed,
      });
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Server] Extraction error:', errMsg);
    
    res.status(500).json({
      success: false,
      error: errMsg,
      extractionTimeMs: elapsed,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  FlixNest Stream Extraction Server         ║
║  Running on http://localhost:${PORT}          ║
║                                            ║
║  Endpoints:                                ║
║  GET /api/health                           ║
║  GET /api/extract-stream?tmdbId=X&type=Y   ║
╚════════════════════════════════════════════╝
  `);
});

export default app;
