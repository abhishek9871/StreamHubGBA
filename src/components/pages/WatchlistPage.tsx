
import React, { useState, useMemo } from 'react';
import { useWatchlist } from '../../context/WatchlistContext';
import ContentCard from '../common/ContentCard';
import { Link } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';

const WatchlistPage: React.FC = () => {
  const { watchlist, removeFromWatchlist } = useWatchlist();
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');

  const filteredItems = useMemo(() => {
    if (filter === 'all') {
      return watchlist;
    }
    return watchlist.filter(item => {
      // Use media_type if available, otherwise infer from title/name properties
      const mediaType = item.media_type || ('title' in item ? 'movie' : 'tv');
      return mediaType === filter;
    });
  }, [watchlist, filter]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-4xl font-bold font-heading">My Watchlist</h1>
        <div className="flex items-center gap-2">
          <FilterButton type="all" label="All" />
          <FilterButton type="movie" label="Movies" />
          <FilterButton type="tv" label="TV Shows" />
        </div>
      </div>
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredItems.map(item => (
            <div key={item.id} className="relative group">
              <ContentCard item={item} />
              <button
                onClick={() => removeFromWatchlist(item.id)}
                className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-black/60 rounded-full text-white hover:bg-accent-primary transition-all duration-300 opacity-0 group-hover:opacity-100"
                aria-label="Remove from watchlist"
              >
                <FaTimes />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-xl text-text-secondary">
            {watchlist.length > 0 ? `No ${filter}s in your watchlist.` : 'Your watchlist is empty.'}
          </p>
          <p className="mt-2 text-text-muted">
             {watchlist.length === 0 && 'Add movies and TV shows to see them here.'}
          </p>
          <Link to="/" className="mt-6 inline-block bg-accent-primary text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
            Browse Content
          </Link>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
