
import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FaFilm, FaSearch } from 'react-icons/fa';

const Header: React.FC = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }): string => 
    `text-text-secondary hover:text-text-primary transition-colors duration-200 ${isActive ? 'text-text-primary font-semibold' : ''}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-bg-secondary/80 backdrop-blur-sm shadow-lg">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <FaFilm className="text-accent-primary text-3xl" />
            <h1 className="hidden sm:block text-2xl font-heading font-bold text-text-primary">SteamHub</h1>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/" className={navLinkClass}>Home</NavLink>
            <NavLink to="/search" className={navLinkClass}>Search</NavLink>
            <NavLink to="/watchlist" className={navLinkClass}>Watchlist</NavLink>
            <NavLink to="/settings" className={navLinkClass}>Settings</NavLink>
          </nav>
        </div>
        
        <div className="flex-1 flex justify-end">
           <form onSubmit={handleSearch} className="relative w-full max-w-xs">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-surface rounded-full text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
            <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary" aria-label="Search">
              <FaSearch />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
};

export default Header;
