
import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FaFilm, FaSearch, FaBars, FaTimes, FaHome, FaBookmark, FaCog } from 'react-icons/fa';

const Header: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
      closeMenu();
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }): string => 
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium tracking-wide transition-all duration-200 ${
      isActive 
        ? 'text-white bg-white/10' 
        : 'text-gray-300 hover:text-white hover:bg-white/5'
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }): string => 
    `text-3xl font-semibold transition-colors duration-200 ${isActive ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`;

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup function to reset overflow when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);
  
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-bg-secondary/80 backdrop-blur-sm shadow-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Left Side: Logo & Desktop Nav */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-accent-primary text-3xl">
                <FaFilm size={30} />
              </span>
              <h1 className="hidden sm:block text-2xl font-heading font-bold text-text-primary">FlixNest</h1>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/" className={navLinkClass}>
                <FaHome size={14} />
                <span>Home</span>
              </NavLink>
              <NavLink to="/search" className={navLinkClass}>
                <FaSearch size={14} />
                <span>Search</span>
              </NavLink>
              <NavLink to="/watchlist" className={navLinkClass}>
                <FaBookmark size={14} />
                <span>Watchlist</span>
              </NavLink>
              <NavLink to="/settings" className={navLinkClass}>
                <FaCog size={14} />
                <span>Settings</span>
              </NavLink>
            </nav>
          </div>
          
          {/* Right Side: Search & Mobile Menu Trigger */}
          <div className="flex items-center gap-2">
            <div className="flex-1 justify-end hidden sm:flex">
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
            <button
              className="md:hidden text-2xl text-text-primary p-2"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open menu"
            >
              <FaBars />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div 
        className={`fixed inset-0 bg-bg-primary z-[100] flex flex-col transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" onClick={closeMenu} className="flex items-center gap-2">
            <span className="text-accent-primary text-3xl">
              <FaFilm size={30} />
            </span>
            <h1 className="text-2xl font-heading font-bold text-text-primary">FlixNest</h1>
          </Link>
          <button 
            className="text-3xl text-text-primary p-2"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <FaTimes />
          </button>
        </div>
        
        {/* Mobile Search */}
        <div className="px-4 mt-8 sm:hidden">
          <form onSubmit={handleSearch} className="relative w-full">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies & TV shows..."
              className="w-full pl-10 pr-4 py-3 bg-surface rounded-full text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
            <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary" aria-label="Search">
              <FaSearch />
            </button>
          </form>
        </div>

        <nav className="flex flex-col items-center justify-center flex-1 gap-8">
          <NavLink to="/" className={mobileNavLinkClass} onClick={closeMenu}>Home</NavLink>
          <NavLink to="/search" className={mobileNavLinkClass} onClick={closeMenu}>Search</NavLink>
          <NavLink to="/watchlist" className={mobileNavLinkClass} onClick={closeMenu}>Watchlist</NavLink>
          <NavLink to="/settings" className={mobileNavLinkClass} onClick={closeMenu}>Settings</NavLink>
        </nav>
      </div>
    </>
  );
};

export default Header;
