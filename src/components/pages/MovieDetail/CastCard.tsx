
import React from 'react';
import { TMDB_IMAGE_BASE_URL } from '../../../utils/constants';
import { FaUserCircle } from 'react-icons/fa';
import type { CastMember } from '../../../types';

interface CastCardProps {
  person: CastMember;
}

const CastCard: React.FC<CastCardProps> = ({ person }) => {
  const imageUrl = person.profile_path
    ? `${TMDB_IMAGE_BASE_URL}/w185${person.profile_path}`
    : null;

  return (
    <div className="flex flex-col items-center text-center w-28">
      <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <FaUserCircle className="text-5xl text-text-muted" />
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-text-primary">{person.name}</p>
      <p className="text-xs text-text-secondary line-clamp-2">{person.character}</p>
    </div>
  );
};

export default CastCard;
