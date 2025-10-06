
import React from 'react';
import { useWatchlist } from '../../context/WatchlistContext';
import ContentCard from '../common/ContentCard';
import { Link } from 'react-router-dom';

const WatchlistPage: React.FC = () => {
  const { watchlist } = useWatchlist();

  return (
    <div className="min-h-screen container mx-auto px-4 py-24">
      <h1 className="text-4xl font-bold font-heading mb-8">My Watchlist</h1>
      {watchlist.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {watchlist.map(item => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-xl text-text-secondary">Your watchlist is empty.</p>
          <p className="mt-2 text-text-muted">Add movies and TV shows to see them here.</p>
          <Link to="/" className="mt-6 inline-block bg-accent-primary text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
            Browse Content
          </Link>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;