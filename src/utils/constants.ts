
// TMDB Proxy Worker for bypassing ISP-level blocks in India (Jio/Airtel)
// Proxy routes: /api/* -> api.themoviedb.org/3/* and /img/* -> image.tmdb.org/t/p/*
export const TMDB_PROXY_URL = 'https://tmdb-proxy.sparshrajput088.workers.dev';
export const TMDB_BASE_URL = `${TMDB_PROXY_URL}/api`;
export const TMDB_IMAGE_BASE_URL = `${TMDB_PROXY_URL}/img`;

// It is highly recommended to use an environment variable for the API key.
// The user request provided a sample key, which is used here as a fallback.
export const TMDB_API_KEY = process.env.REACT_APP_TMDB_API_KEY || '61d95006877f80fb61358dbb78f153c3';

export const VIDSRC_BASE_URL = 'https://vidsrc.cc/v2/embed';