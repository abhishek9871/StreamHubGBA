import React, { useRef } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import type { IconType } from 'react-icons';
import type { ContentItem } from '../../../types';
import ContentCard from '../../common/ContentCard';
import SkeletonCard from '../../common/SkeletonCard';

interface ContentCarouselProps {
  title: string;
  items: ContentItem[];
  loading?: boolean;
  icon?: IconType;
}

const ContentCarousel: React.FC<ContentCarouselProps> = ({ title, items, loading = false, icon: Icon }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
      scrollContainerRef.current.scrollTo({
        left: scrollTo,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-4 px-4 md:px-0">
        {Icon && <Icon className="text-accent-primary text-2xl" />}
        <h2 className="text-2xl font-bold font-heading">{title}</h2>
      </div>
      <div className="relative">
        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4 scrollbar-hide peer"
        >
          {loading ? (
            Array.from({ length: 10 }).map((_, index) => <SkeletonCard key={index} />)
          ) : (
            items.map(item => (
                <div key={`${item.id}-${item.media_type}`} className="flex-shrink-0 w-40 md:w-48">
                    <ContentCard item={item} />
                </div>
            ))
          )}
        </div>
        {!loading && items.length > 5 && (
            <>
                <button
                    onClick={() => scroll('left')}
                    className="absolute top-1/2 left-0 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full opacity-0 peer-hover:opacity-100 hover:opacity-100 transition-opacity duration-300 hidden md:block"
                    aria-label="Scroll left"
                >
                    <FaChevronLeft size={20} />
                </button>
                <button
                    onClick={() => scroll('right')}
                    className="absolute top-1/2 right-0 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full opacity-0 peer-hover:opacity-100 hover:opacity-100 transition-opacity duration-300 hidden md:block"
                    aria-label="Scroll right"
                >
                    <FaChevronRight size={20} />
                </button>
            </>
        )}
      </div>
    </section>
  );
};

export default ContentCarousel;