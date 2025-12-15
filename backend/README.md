---
title: FlixNest MappletTV Scraper
emoji: 🎬
colorFrom: red
colorTo: purple
sdk: docker
pinned: false
---

# FlixNest MappletTV Scraper

Backend API for extracting M3U8 streams from MappletTV.

## API Endpoints

- `GET /api/mappletv/extract?tmdbId=XXXXX&type=movie` - Extract movie stream
- `GET /api/mappletv/extract?tmdbId=XXXXX&type=tv&season=1&episode=1` - Extract TV episode
- `GET /health` - Health check
