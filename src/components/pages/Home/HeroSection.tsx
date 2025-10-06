import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPlay, FaInfoCircle, FaStar, FaTv, FaFilm } from 'react-icons/fa';
import type { ContentItem } from '../../../types';
import { TMDB_IMAGE_BASE_URL } from '../../../utils/constants';
import Loader from '../../common/Loader';

interface HeroSectionProps {
  items: ContentItem[];
}

const HeroSection: React.FC<HeroSectionProps> = ({ items }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [items]);

  if (items.length === 0) {
    return <div className="h-screen bg-bg-secondary flex items-center justify-center"><Loader /></div>;
  }

  const activeItem = items[currentIndex];
  const title = 'title' in activeItem ? activeItem.title : activeItem.name;
  const mediaType = activeItem.media_type || ('title' in activeItem ? 'movie' : 'tv');
  const releaseDate = 'release_date' in activeItem ? activeItem.release_date : activeItem.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';

  return (
    <div className="relative h-screen w-full">
      {items.map((item, index) => (
         <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
         >
            <img
                src={`${TMDB_IMAGE_BASE_URL}/original${item.backdrop_path}`}
                alt={'title' in item ? item.title : item.name}
                className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/70 to-transparent"></div>
         </div>
      ))}
      
      <div className="relative z-10 flex flex-col justify-end h-full container mx-auto px-4 pb-20 md:pb-32">
        <div key={activeItem.id} className="max-w-3xl text-white">
            <h1 className="text-4xl md:text-6xl font-bold font-heading mb-4 animate-fade-in-down">{title}</h1>
            <div className="flex items-center flex-wrap gap-4 mb-4 text-text-secondary animate-fade-in-up">
                <div className="flex items-center gap-1">
                    <FaStar className="text-yellow-400" />
                    <span>{activeItem.vote_average.toFixed(1)}</span>
                </div>
                <span>|</span>
                <span>{year}</span>
                <span>|</span>
                <span className="flex items-center gap-2 border border-text-muted px-2 py-1 rounded-md text-sm">
                    {mediaType === 'tv' ? <FaTv /> : <FaFilm />} 
                    {mediaType.toUpperCase()}
                </span>
            </div>
            <p className="text-text-secondary text-sm md:text-base line-clamp-3 mb-6 animate-fade-in-up animation-delay-200">{activeItem.overview}</p>
            <div className="flex items-center gap-4 animate-fade-in-up animation-delay-400">
                <Link to={`/play/${mediaType}/${activeItem.id}`} className="flex items-center gap-2 px-6 py-3 bg-accent-primary text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-lg">
                    <FaPlay />
                    <span>Play Now</span>
                </Link>
                <Link to={`/${mediaType}/${activeItem.id}`} className="flex items-center gap-2 px-6 py-3 bg-surface/80 backdrop-blur-sm text-white font-semibold rounded-lg hover:bg-surface transition-colors">
                    <FaInfoCircle />
                    <span>More Info</span>
                </Link>
            </div>
        </div>
      </div>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === currentIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroSection;
