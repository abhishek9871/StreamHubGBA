
import React, { useState, useEffect } from 'react';
import { tmdbService } from '../../services/tmdb';
import type { ContentItem } from '../../types';
import ContentCard from '../common/ContentCard';
import Loader from '../common/Loader';
import { TMDB_IMAGE_BASE_URL } from '../../utils/constants';

const ContentCarousel: React.FC<{ title: string; items: ContentItem[] }> = ({ title, items }) => (
  <section className="mb-12">
    <h2 className="text-2xl font-bold font-heading mb-4 px-4 md:px-0">{title}</h2>
    <div className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4 scrollbar-thin scrollbar-thumb-surface-hover scrollbar-track-surface">
      {items.map(item => (
        <div key={item.id} className="flex-shrink-0 w-40 md:w-48">
          <ContentCard item={item} />
        </div>
      ))}
    </div>
  </section>
);

const HomePage: React.FC = () => {
  const [trendingMovies, setTrendingMovies] = useState<ContentItem[]>([]);
  const [trendingTV, setTrendingTV] = useState<ContentItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroContent, setHeroContent] = useState<ContentItem | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trendingMoviesRes, trendingTVRes, popularMoviesRes] = await Promise.all([
          tmdbService.getTrending('movie'),
          tmdbService.getTrending('tv'),
          tmdbService.getPopularMovies(),
        ]);
        setTrendingMovies(trendingMoviesRes.results);
        setTrendingTV(trendingTVRes.results);
        setPopularMovies(popularMoviesRes.results);
        if (trendingMoviesRes.results.length > 0) {
          setHeroContent(trendingMoviesRes.results[0]);
        }
      } catch (error) {
        console.error("Failed to fetch home page data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
       {heroContent && (
        <div className="relative h-[60vh] md:h-[80vh] w-full mb-8">
          <div className="absolute inset-0 bg-black">
            <img 
              src={`${TMDB_IMAGE_BASE_URL}/original${heroContent.backdrop_path}`}
              // FIX: Use type guard to safely access 'title' or 'name' on the ContentItem union type.
              alt={'title' in heroContent ? heroContent.title : heroContent.name}
              className="w-full h-full object-cover opacity-40"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/50 to-transparent"></div>
          <div className="relative z-10 flex flex-col justify-end h-full container mx-auto px-4 pb-16">
            {/* FIX: Use type guard to safely access 'title' or 'name' on the ContentItem union type. */}
            <h1 className="text-4xl md:text-6xl font-bold font-heading mb-4">{'title' in heroContent ? heroContent.title : heroContent.name}</h1>
            <p className="text-text-secondary max-w-2xl text-sm md:text-base line-clamp-3">{heroContent.overview}</p>
          </div>
        </div>
       )}
      <main className="container mx-auto px-4">
        <ContentCarousel title="Trending Movies" items={trendingMovies} />
        <ContentCarousel title="Trending TV Shows" items={trendingTV} />
        <ContentCarousel title="Popular Movies" items={popularMovies} />
      </main>
    </div>
  );
};

export default HomePage;
