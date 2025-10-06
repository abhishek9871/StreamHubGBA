
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';
import { ContentItem } from '../../types';
import ContentCard from '../common/ContentCard';
import Loader from '../common/Loader';
import { FaSearch } from 'react-icons/fa';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');
  
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    const performSearch = async () => {
      if (debouncedQuery.trim().length > 1) {
        setLoading(true);
        try {
          const response = await tmdbService.searchMulti(debouncedQuery);
          // Filter out people from results as we only have cards for movies/tv
          const validResults = response.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
          setResults(validResults);
        } catch (error) {
          console.error('Search failed:', error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    };

    performSearch();
    
    // Update URL param
    if (debouncedQuery.trim()) {
        setSearchParams({ q: debouncedQuery });
    } else {
        setSearchParams({});
    }

  }, [debouncedQuery, setSearchParams]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }

  const filteredResults = useMemo(() => {
    if (filter === 'all') return results;
    return results.filter(item => item.media_type === filter);
  }, [results, filter]);

  const resultTitle = useMemo(() => {
    if (loading) return `Searching for "${debouncedQuery}"...`;
    if (debouncedQuery && filteredResults.length > 0) return `Results for "${debouncedQuery}"`;
    if (debouncedQuery && !loading && filteredResults.length === 0) return `No results found for "${debouncedQuery}"`;
    return 'Find your next favorite movie or TV show';
  }, [debouncedQuery, filteredResults, loading]);

  const FilterButton: React.FC<{ type: 'all' | 'movie' | 'tv'; label: string }> = ({ type, label }) => (
    <button
      onClick={() => setFilter(type)}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
        filter === type
          ? 'bg-accent-primary text-white'
          : 'bg-surface text-text-secondary hover:bg-surface-hover'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen container mx-auto px-4 py-8 pt-24">
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-heading mb-4">Search</h1>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="e.g. Breaking Bad"
            className="w-full pl-12 pr-4 py-3 bg-surface rounded-lg text-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            aria-label="Search for movies and TV shows"
          />
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-xl" />
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-xl font-semibold">{resultTitle}</h2>
        {results.length > 0 && (
          <div className="flex items-center gap-2">
            <FilterButton type="all" label="All" />
            <FilterButton type="movie" label="Movies" />
            <FilterButton type="tv" label="TV Shows" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
           <Loader />
        </div>
      ) : (
         filteredResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredResults.map(item => (
                    item.poster_path ? <ContentCard key={`${item.id}-${item.media_type}`} item={item} /> : null
                ))}
            </div>
         ) : (
            <div className="text-center py-20">
                <p className="text-xl text-text-secondary">
                    {debouncedQuery ? 'Nothing to show here.' : 'Start typing to see magic happen.'}
                </p>
                <p className="mt-2 text-text-muted">
                    {debouncedQuery ? 'Try a different search term.' : 'Search for movies and TV shows.'}
                </p>
            </div>
         )
      )}
    </div>
  );
};

export default SearchPage;
