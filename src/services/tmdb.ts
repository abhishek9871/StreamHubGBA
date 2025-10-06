
import axios from 'axios';
import { TMDB_API_KEY, TMDB_BASE_URL } from '../utils/constants';
import type { PaginatedResponse, Movie, TVShow, MovieDetails, TVShowDetails, SeasonDetails, ContentItem } from '../types';

const apiClient = axios.create({
  baseURL: TMDB_BASE_URL,
  params: {
    api_key: TMDB_API_KEY,
  },
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API call error:', error);
    return Promise.reject(error);
  }
);

export const tmdbService = {
  getTrending: (mediaType: 'movie' | 'tv', timeWindow: 'day' | 'week' = 'week'): Promise<PaginatedResponse<ContentItem>> => {
    return apiClient.get(`/trending/${mediaType}/${timeWindow}`);
  },
  getTrendingAll: (timeWindow: 'day' | 'week' = 'week'): Promise<PaginatedResponse<ContentItem>> => {
    return apiClient.get(`/trending/all/${timeWindow}`);
  },
  getPopularMovies: (): Promise<PaginatedResponse<Movie>> => {
    return apiClient.get('/movie/popular');
  },
  getTopRatedMovies: (): Promise<PaginatedResponse<Movie>> => {
    return apiClient.get('/movie/top_rated');
  },
  getPopularTVShows: (): Promise<PaginatedResponse<TVShow>> => {
    return apiClient.get('/tv/popular');
  },
  getTopRatedTVShows: (): Promise<PaginatedResponse<TVShow>> => {
    return apiClient.get('/tv/top_rated');
  },
  getMovieDetails: (id: string): Promise<MovieDetails> => {
    return apiClient.get(`/movie/${id}`);
  },
  getTVShowDetails: (id: string): Promise<TVShowDetails> => {
    return apiClient.get(`/tv/${id}`);
  },
  getSeasonDetails: (tvId: string, seasonNumber: number): Promise<SeasonDetails> => {
    return apiClient.get(`/tv/${tvId}/season/${seasonNumber}`);
  },
  searchMulti: (query: string): Promise<PaginatedResponse<ContentItem>> => {
    return apiClient.get('/search/multi', { params: { query } });
  },
};