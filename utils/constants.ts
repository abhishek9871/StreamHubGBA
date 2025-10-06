
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// It is highly recommended to use an environment variable for the API key.
// The user request provided a sample key, which is used here as a fallback.
export const TMDB_API_KEY = process.env.REACT_APP_TMDB_API_KEY || '61d95006877f80fb61358dbb78f153c3';

export const VIDSRC_BASE_URL = 'https://vidsrc.cc/v2/embed';
