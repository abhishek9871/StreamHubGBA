import React from 'react';

const SkeletonCard: React.FC = () => {
  return (
    <div className="flex-shrink-0 w-40 md:w-48">
      <div className="aspect-[2/3] bg-surface-hover rounded-lg animate-pulse"></div>
    </div>
  );
};

export default SkeletonCard;
