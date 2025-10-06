import React, { useState, useEffect } from 'react';
import { tmdbService } from '../../../services/tmdb';
import type { ContentItem } from '../../../types';
import HeroSection from './HeroSection';
import ContentCarousel from './ContentCarousel';
import { FaFire, FaPoll, FaStar, FaTv } from 'react-icons/fa';

interface HomeContent {
  trending: ContentItem[];
  popularMovies: ContentItem[];
  topRatedMovies: ContentItem[];
  popularTV: ContentItem[];
  topRatedTV: ContentItem[];
}

const Home: React.FC = () => {
  const [content, setContent] = useState<HomeContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const [
          trendingRes,
          popularMoviesRes,
          topRatedMoviesRes,
          popularTVRes,
          topRatedTVRes
        ] = await Promise.all([
          tmdbService.getTrendingAll('week'),
          tmdbService.getPopularMovies(),
          tmdbService.getTopRatedMovies(),
          tmdbService.getPopularTVShows(),
          tmdbService.getTopRatedTVShows(),
        ]);

        setContent({
          trending: trendingRes.results,
          popularMovies: popularMoviesRes.results,
          topRatedMovies: topRatedMoviesRes.results,
          popularTV: popularTVRes.results,
          topRatedTV: topRatedTVRes.results,
        });
      } catch (err) {
        console.error("Failed to fetch home page content:", err);
        setError("Could not load content. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchAllContent();
  }, []);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-center text-error p-4">
        <p>{error}</p>
      </div>
    );
  }

  const heroItems = content?.trending?.filter(item => item.backdrop_path).slice(0, 5) || [];

  return (
    <div className="bg-bg-primary min-h-screen">
      <HeroSection items={heroItems} />
      <main className="container mx-auto px-4 -mt-20 md:-mt-32 relative z-10 py-8">
        <ContentCarousel 
            title="Trending Now" 
            items={content?.trending || []} 
            loading={loading}
            icon={FaFire}
        />
        <ContentCarousel 
            title="Popular Movies" 
            items={content?.popularMovies || []} 
            loading={loading}
            icon={FaPoll}
        />
        <ContentCarousel 
            title="Top Rated Movies" 
            items={content?.topRatedMovies || []} 
            loading={loading}
            icon={FaStar}
        />
        <ContentCarousel 
            title="Popular TV Shows" 
            items={content?.popularTV || []} 
            loading={loading}
            icon={FaTv}
        />
        <ContentCarousel 
            title="Top Rated TV Shows" 
            items={content?.topRatedTV || []} 
            loading={loading}
            icon={FaStar}
        />
      </main>
    </div>
  );
};

export default Home;
