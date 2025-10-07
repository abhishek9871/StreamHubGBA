
import React from 'react';
import { useWatchlist } from '../../../context/WatchlistContext';
import { useWatchedEpisodes } from '../../../context/WatchedEpisodesContext';
import Button from '../../common/Button';
import { FaTrash, FaInfoCircle } from 'react-icons/fa';

const SettingsPage: React.FC = () => {
  const { watchlist, clearWatchlist } = useWatchlist();
  const { watchedEpisodes, clearWatchedHistory } = useWatchedEpisodes();

  const isWatchlistEmpty = watchlist.length === 0;
  const isHistoryEmpty = Object.keys(watchedEpisodes).length === 0;

  const handleClearWatchlist = () => {
    if (window.confirm('Are you sure you want to clear your entire watchlist? This action cannot be undone.')) {
      clearWatchlist();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your watch history? This action cannot be undone.')) {
      clearWatchedHistory();
    }
  };

  return (
    <div className="min-h-screen container mx-auto px-4 py-8 pt-24">
      <h1 className="text-4xl font-bold font-heading mb-8">Settings</h1>
      <div className="max-w-2xl mx-auto space-y-12">
        {/* Data Management Section */}
        <section>
          <h2 className="text-2xl font-semibold font-heading border-b-2 border-surface pb-2 mb-4">Data Management</h2>
          <div className="space-y-4">
            <div className="bg-surface p-4 rounded-lg flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text-primary">Clear Watchlist</h3>
                <p className="text-sm text-text-secondary">Permanently delete all items from your watchlist.</p>
              </div>
              <Button variant="outline" onClick={handleClearWatchlist} icon={FaTrash} disabled={isWatchlistEmpty}>
                Clear
              </Button>
            </div>
            <div className="bg-surface p-4 rounded-lg flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text-primary">Clear Watch History</h3>
                <p className="text-sm text-text-secondary">Permanently delete all of your watched episode history.</p>
              </div>
              <Button variant="outline" onClick={handleClearHistory} icon={FaTrash} disabled={isHistoryEmpty}>
                Clear
              </Button>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section>
          <h2 className="text-2xl font-semibold font-heading border-b-2 border-surface pb-2 mb-4">About FlixNest</h2>
          <div className="bg-surface p-4 rounded-lg">
            <div className="flex items-start gap-4">
              <span className="text-accent-secondary text-2xl mt-1 flex-shrink-0">
                <FaInfoCircle size={24} />
              </span>
              <div>
                <h3 className="font-semibold text-text-primary">Disclaimer</h3>
                <p className="text-sm text-text-secondary mt-2">
                  FlixNest is a personal project and is not affiliated with TMDB or any streaming providers. All content is provided by third-party services. We do not host any content on our servers. This application is for educational and demonstration purposes only.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
