
import React from 'react';
import { Link } from 'react-router-dom';
import { FaPlay } from 'react-icons/fa';
import type { ContentItem } from '../../types';
import { TMDB_IMAGE_BASE_URL } from '../../utils/constants';

interface ContentCardProps {
  item: ContentItem;
}

const ContentCard: React.FC<ContentCardProps> = ({ item }) => {
  // FIX: Use type guard to safely access 'title' property on the ContentItem union type.
  const mediaType = item.media_type || ('title' in item ? 'movie' : 'tv');
  // FIX: Use type guard to safely access 'title' or 'name' on the ContentItem union type.
  const title = 'title' in item ? item.title : item.name;
  const posterUrl = item.poster_path 
    ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}` 
    : 'https://picsum.photos/500/750?grayscale';

  return (
    <Link to={`/${mediaType}/${item.id}`} className="block group relative overflow-hidden rounded-lg shadow-lg bg-surface transition-transform duration-300 ease-in-out transform hover:scale-105 hover:z-10">
      <img
        src={posterUrl}
        alt={title}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
        <FaPlay className="text-white text-4xl opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
        <h3 className="text-white text-sm font-semibold truncate">{title}</h3>
      </div>
    </Link>
  );
};

export default ContentCard;