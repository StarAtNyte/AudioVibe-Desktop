import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayIcon,
  PlusIcon,
  ClockIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useLibraryStore, useAudioStore, useDownloadsStore } from '../store';
import { useOnboardingStore } from '../store/onboarding';
import { getBookCover } from '../data/bookCovers';
import { searchService } from '../services/searchService';
import { archiveService, ArchiveAudiobook } from '../services/archiveService';
import { GenreOnboarding } from '../components/onboarding/GenreOnboarding';

export const Home: React.FC = () => {
  const { audiobooks, fetchAudiobooks } = useLibraryStore();
  const { status, isPlayerVisible, loadAudio, setAudiobook, play, currentAudiobookId } = useAudioStore();
  const { addDownload } = useDownloadsStore();
  const { hasCompletedOnboarding, selectedGenres, completeOnboarding } = useOnboardingStore();
  const navigate = useNavigate();

  const [recommendedBooks, setRecommendedBooks] = useState<ArchiveAudiobook[]>([]);
  const [popularBooks, setPopularBooks] = useState<ArchiveAudiobook[]>([]);
  const [trendingBooks, setTrendingBooks] = useState<ArchiveAudiobook[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Load audiobooks when component mounts
  useEffect(() => {
    fetchAudiobooks();
  }, [fetchAudiobooks]);

  // Load recommendations when user completes onboarding or page loads
  useEffect(() => {
    if (hasCompletedOnboarding) {
      loadRecommendations();
    }
  }, [hasCompletedOnboarding, selectedGenres]);

  const loadRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      // Load different sections in parallel
      const [recommended, popular, trending] = await Promise.all([
        selectedGenres.length > 0
          ? archiveService.getByGenres(selectedGenres, 15)
          : archiveService.getPopular(15),
        archiveService.getPopular(15),
        archiveService.getTrending(15)
      ]);

      setRecommendedBooks(recommended);
      setPopularBooks(popular);
      setTrendingBooks(trending);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleOnboardingComplete = (genres: string[]) => {
    completeOnboarding(genres);
  };

  // Show onboarding if not completed
  if (!hasCompletedOnboarding) {
    return <GenreOnboarding onComplete={handleOnboardingComplete} />;
  }
  
  // No longer need download progress tracking since we use downloads tab

  const recentBooks = audiobooks.slice(0, 6);

  const handleAddArchiveBook = async (book: ArchiveAudiobook) => {
    try {
      console.log('Adding Archive.org book to library:', book.title);

      // Add to downloads queue
      const downloadId = addDownload({
        title: book.title,
        author: book.creator || 'Unknown Author',
        coverUrl: book.coverUrl,
        downloadUrl: book.zipUrl || '',
        description: book.description || `${book.title} by ${book.creator}`,
        genre: book.subject?.[0] || 'Unknown',
        runtime: book.runtime
      });

      // Navigate to downloads tab to show progress
      navigate('/downloads');
    } catch (error) {
      console.error('Failed to add Archive.org book:', error);
      alert(`Failed to add "${book.title}": ${error}`);
    }
  };

  const handleAddToLibrary = async (book: any) => {
    try {
      // Check if it's an Archive.org book (has identifier field)
      if ((book as any).identifier) {
        return handleAddArchiveBook(book as ArchiveAudiobook);
      }

      console.log('Searching LibriVox for:', book.title, 'by', book.author);

      // Search LibriVox for this book to get real download data
      const searchResults = await searchService.searchLibriVox({
        title: book.title,
        author: book.author,
        limit: 1
      });

      if (searchResults.length === 0) {
        alert(`Could not find "${book.title}" on LibriVox. Please try searching manually.`);
        return;
      }

      const librivoxBook = searchResults[0];
      console.log('Found LibriVox book:', librivoxBook.title);

      // Add to downloads queue just like search results do
      const downloadId = addDownload({
        title: librivoxBook.title,
        author: librivoxBook.author,
        coverUrl: librivoxBook.cover_url,
        downloadUrl: librivoxBook.download_links.mp3 || librivoxBook.download_links.m4b || '',
        description: librivoxBook.description,
        genre: librivoxBook.genre?.[0] || book.genre || 'Unknown',
        runtime: librivoxBook.runtime
      });

      // Navigate to downloads tab to show progress
      navigate('/downloads');

    } catch (error) {
      console.error('Failed to find book on LibriVox:', error);
      alert(`Failed to find "${book.title}" on LibriVox: ${error}`);
    }
  };

  const handlePlayBook = async (book: any) => {
    console.log('Playing book:', book.title);
    try {
      // Load the audiobook and navigate to player
      await loadAudio(book.file_path, book.id);
      navigate('/player');
      // Start playing
      await play();
    } catch (error) {
      console.error('Failed to load audiobook:', error);
    }
  };

  const handleBookClick = async (book: any) => {
    // Check if this book is in the user's library (has a real file_path)
    const isInLibrary = audiobooks.some(userBook => userBook.id === book.id);
    
    if (isInLibrary) {
      // Book is in library, play it
      console.log('Playing book from library:', book.title);
      await handlePlayBook(book);
    } else {
      // Book is a recommendation, add to library
      console.log('Adding recommendation to library:', book.title);
      await handleAddToLibrary(book);
    }
  };

  const handleRecommendationClick = async (book: any) => {
    console.log('Navigating to book:', book.title);
    try {
      // Load the audiobook (but don't play it) and set it as current
      const currentState = useAudioStore.getState();
      if (currentState.currentAudiobookId !== book.id) {
        await loadAudio(book.file_path, book.id);
      } else {
        // Even if it's the same audiobook, ensure it's properly loaded
        setAudiobook(book.id);
      }
      // Navigate to player regardless
      navigate('/player');
    } catch (error) {
      console.error('Failed to load audiobook:', error);
    }
  };

  const BookCard = ({ book, onAdd, onPlay }: { book: any, onAdd: () => void, onPlay: () => void }) => {
    // Determine the cover image source
    const coverImageSrc = book.cover_image_path || getBookCover(book.id);
    
    return (
      <div 
        className="bg-gray-900/40 hover:bg-gray-800/60 rounded-lg p-3 transition-all duration-200 group cursor-pointer border border-transparent hover:border-gray-700/50"
        onClick={() => handleBookClick(book)}
      >
        <div className="relative mb-3">
          <div className="w-full aspect-square bg-gradient-to-br from-gray-700 to-gray-800 rounded-md overflow-hidden shadow-lg">
            <img
              src={coverImageSrc}
              alt={book.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to generated cover if image fails
                const target = e.currentTarget as HTMLImageElement;
                target.src = getBookCover(book.id);
              }}
            />
          </div>
          
          
          {/* Spotify-style play button */}
          <button
            onClick={onPlay}
            className="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 hover:bg-green-400"
          >
            <PlayIcon className="w-5 h-5 text-black ml-0.5" />
          </button>
        </div>
        
        {/* Spotify-style text layout */}
        <div className="space-y-1">
          <h3 className="text-white font-medium text-sm truncate" title={book.title}>
            {book.title}
          </h3>
          <p className="text-gray-400 text-xs truncate">
            {book.author} • {book.year}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <ClockIcon className="w-3 h-3" />
              <span>{book.duration}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 bg-transparent hover:bg-gray-700"
              title="Add to Library"
            >
              <PlusIcon className="w-3 h-3 text-gray-300 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ title, books, subtitle }: { title: string, books?: any[], subtitle?: string }) => {
    if (!books || books.length === 0) {
      return null;
    }
    
    return (
      <div className="mb-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1 hover:underline cursor-pointer">{title}</h2>
            {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
          </div>
          <button className="text-gray-400 hover:text-white text-sm font-medium transition-colors hover:underline">
            Show all
          </button>
        </div>
        {/* Horizontal scrolling container like Spotify */}
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            <style>{`
              .scrollbar-hide {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {books.map((book) => (
              <div key={book.id} className="flex-none w-44">
                <BookCard
                  book={book}
                  onAdd={() => handleAddToLibrary(book)}
                  onPlay={() => handlePlayBook(book)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Message */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
        </h1>
        <p className="text-gray-400">Discover your next great listen</p>
      </div>
      
      {/* Quick Access Grid - Spotify style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {audiobooks.slice(0, 6).map((book) => (
          <div
            key={`quick-${book.id}`}
            className="bg-gray-800/60 hover:bg-gray-700/70 rounded-md flex items-center group cursor-pointer transition-all duration-200 overflow-hidden"
            onClick={() => handleBookClick(book)}
          >
            <img
              src={book.cover_image_path || getBookCover(book.id)}
              alt={book.title}
              className="w-16 h-16 object-cover"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.src = getBookCover(book.id);
              }}
            />
            <div className="flex-1 px-4 truncate">
              <p className="text-white font-medium text-sm truncate">{book.title}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBookClick(book);
              }}
              className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105"
            >
              <PlayIcon className="w-5 h-5 text-black ml-0.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Your Recent Listens */}
      {recentBooks.length > 0 && (
        <Section
          title="Recently played"
          books={recentBooks.map(book => ({
            id: book.id,
            title: book.title,
            author: book.author || 'Unknown Author',
            duration: book.duration ? `${Math.floor(book.duration / 3600)}h ${Math.floor((book.duration % 3600) / 60)}m` : 'Unknown',
            year: book.publish_date ? new Date(book.publish_date).getFullYear() : 'Unknown',
            genre: book.genre || 'Audiobook',
            description: book.description || 'No description available',
            rating: 4.0,
            cover_image_path: book.cover_image_path || getBookCover(book.id),
            file_path: book.file_path // Add this line to preserve the file_path
          }))}
        />
      )}

      {/* Recommended for You - Based on selected genres */}
      {selectedGenres.length > 0 && recommendedBooks.length > 0 && (
        <Section
          title="Recommended for You"
          subtitle={`Based on your interests: ${selectedGenres.slice(0, 3).join(', ')}${selectedGenres.length > 3 ? '...' : ''}`}
          books={recommendedBooks.map(book => ({
            id: book.identifier,
            identifier: book.identifier,
            title: book.title,
            author: book.creator || 'Unknown Author',
            duration: book.runtime || 'Unknown',
            year: book.date ? new Date(book.date).getFullYear() : 'Unknown',
            genre: book.subject?.[0] || 'Audiobook',
            description: book.description || 'No description available',
            rating: book.avg_rating || 0,
            cover_image_path: book.coverUrl,
            zipUrl: book.zipUrl,
            coverUrl: book.coverUrl
          }))}
        />
      )}

      {/* Popular All Time - From Archive.org */}
      {popularBooks.length > 0 && (
        <Section
          title="Popular All Time"
          subtitle="Most downloaded audiobooks from LibriVox"
          books={popularBooks.map(book => ({
            id: book.identifier,
            identifier: book.identifier,
            title: book.title,
            author: book.creator || 'Unknown Author',
            duration: book.runtime || 'Unknown',
            year: book.date ? new Date(book.date).getFullYear() : 'Unknown',
            genre: book.subject?.[0] || 'Audiobook',
            description: book.description || 'No description available',
            rating: book.avg_rating || 0,
            cover_image_path: book.coverUrl,
            zipUrl: book.zipUrl,
            coverUrl: book.coverUrl
          }))}
        />
      )}

      {/* Trending This Week - From Archive.org */}
      {trendingBooks.length > 0 && (
        <Section
          title="Trending This Week"
          subtitle="Popular audiobooks this week"
          books={trendingBooks.map(book => ({
            id: book.identifier,
            identifier: book.identifier,
            title: book.title,
            author: book.creator || 'Unknown Author',
            duration: book.runtime || 'Unknown',
            year: book.date ? new Date(book.date).getFullYear() : 'Unknown',
            genre: book.subject?.[0] || 'Audiobook',
            description: book.description || 'No description available',
            rating: book.avg_rating || 0,
            cover_image_path: book.coverUrl,
            zipUrl: book.zipUrl,
            coverUrl: book.coverUrl
          }))}
        />
      )}
    </div>
  );
};