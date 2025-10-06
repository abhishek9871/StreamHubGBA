
import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FaFilm } from 'react-icons/fa';

const Header: React.FC = () => {
  const navLinkClass = ({ isActive }: { isActive: boolean }): string => 
    `text-text-secondary hover:text-text-primary transition-colors duration-200 ${isActive ? 'text-text-primary font-semibold' : ''}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-bg-secondary/80 backdrop-blur-sm shadow-lg">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <FaFilm className="text-accent-primary text-3xl" />
          <h1 className="text-2xl font-heading font-bold text-text-primary">SteamHub</h1>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" className={navLinkClass}>Home</NavLink>
          <NavLink to="/search" className={navLinkClass}>Search</NavLink>
          <NavLink to="/watchlist" className={navLinkClass}>Watchlist</NavLink>
        </nav>
        {/* Placeholder for future search bar and user profile */}
        <div className="flex items-center gap-4">
          {/* Search Icon or component can go here */}
        </div>
      </div>
    </header>
  );
};

export default Header;
