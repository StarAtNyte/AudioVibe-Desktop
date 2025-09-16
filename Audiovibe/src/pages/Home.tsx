import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlayIcon, 
  PlusIcon,
  ClockIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useLibraryStore, useAudioStore } from '../store';
import { localBooksDatabase } from '../data/localBooks';
import { getBookCover } from '../data/bookCovers';
import { LocalBookService, AddBookProgress } from '../services/localBookService';

export const Home: React.FC = () => {
  const { audiobooks, fetchAudiobooks } = useLibraryStore();
  const { status, isPlayerVisible, loadAudio, setAudiobook, play, currentAudiobookId } = useAudioStore();
  const navigate = useNavigate();

  // Load audiobooks when component mounts
  useEffect(() => {
    fetchAudiobooks();
  }, [fetchAudiobooks]);
  
  // Track download progress for books being added
  const [downloadProgress, setDownloadProgress] = useState<{ [bookId: string]: AddBookProgress }>({});
  const localBookService = LocalBookService.getInstance();
  
  // Create collections for recommendations from local data and user library
  const recommendations = {
    classics: localBooksDatabase.filter(book => book.genre?.toLowerCase().includes('classic') || book.genre?.toLowerCase().includes('literature') || book.genre?.toLowerCase().includes('romance')),
    mystery: localBooksDatabase.filter(book => book.genre?.toLowerCase().includes('mystery') || book.genre?.toLowerCase().includes('detective')),
    adventure: localBooksDatabase.filter(book => book.genre?.toLowerCase().includes('adventure') || book.genre?.toLowerCase().includes('fantasy')),
    scifi: localBooksDatabase.filter(book => book.genre?.toLowerCase().includes('science') || book.genre?.toLowerCase().includes('horror'))
  };

  // Create collections from actual user audiobooks by genre  
  const userCollections = {
    classics: audiobooks.filter(book => book.genre?.toLowerCase().includes('classic') || book.genre?.toLowerCase().includes('literature')),
    mystery: audiobooks.filter(book => book.genre?.toLowerCase().includes('mystery') || book.genre?.toLowerCase().includes('detective')),
    adventure: audiobooks.filter(book => book.genre?.toLowerCase().includes('adventure') || book.genre?.toLowerCase().includes('fantasy')),
    scifi: audiobooks.filter(book => book.genre?.toLowerCase().includes('science') || book.genre?.toLowerCase().includes('horror'))
  };

  const recentBooks = audiobooks.slice(0, 6);

  const handleAddToLibrary = async (book: any) => {
    try {
      console.log('Adding book to library:', book.title);
      
      // Clear any existing progress for this book
      setDownloadProgress(prev => ({ ...prev, [book.id]: undefined }));
      
      // Start the download process with progress tracking
      await localBookService.addBookToLibrary(book.id, (progress: AddBookProgress) => {
        setDownloadProgress(prev => ({ ...prev, [book.id]: progress }));
      });
      
      // Refresh the library after successful addition
      const { fetchAudiobooks } = useLibraryStore.getState();
      await fetchAudiobooks();
      
      // Clear progress after completion
      setTimeout(() => {
        setDownloadProgress(prev => ({ ...prev, [book.id]: undefined }));
      }, 3000);
      
    } catch (error) {
      console.error('Failed to add book to library:', error);
      
      // Clear progress on error
      setDownloadProgress(prev => ({ ...prev, [book.id]: undefined }));
      
      alert(`Failed to add "${book.title}" to library: ${error}`);
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
    const progress = downloadProgress[book.id];
    const isDownloading = progress && progress.stage !== 'completed';
    const isCompleted = progress && progress.stage === 'completed';
    
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
          
          {/* Progress overlay */}
          {isDownloading && (
            <div className="absolute inset-0 bg-black/80 rounded-md flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <p className="text-white text-xs">{progress.message}</p>
                {progress.progress > 0 && (
                  <div className="w-16 h-1 bg-gray-600 rounded mt-1">
                    <div 
                      className="h-full bg-blue-500 rounded transition-all duration-300"
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Success overlay */}
          {isCompleted && (
            <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <CheckIcon className="w-4 h-4 text-white" />
            </div>
          )}
          
          {/* Spotify-style play button */}
          <button
            onClick={onPlay}
            className="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 hover:bg-green-400"
            disabled={isDownloading}
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
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 ${
                isDownloading ? 'bg-gray-600 cursor-not-allowed' :
                isCompleted ? 'bg-green-600' : 
                'bg-transparent hover:bg-gray-700'
              }`}
              title={isCompleted ? 'Added to Library' : 'Add to Library'}
              disabled={isDownloading}
            >
              {isCompleted ? (
                <CheckIcon className="w-3 h-3 text-white" />
              ) : (
                <PlusIcon className="w-3 h-3 text-gray-300 hover:text-white" />
              )}
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

      {/* Classic Literature - Show user books if they have any, otherwise recommendations */}
      <Section 
        title="Classic Literature" 
        subtitle={userCollections.classics.length > 0 ? "Your classic collection" : "Timeless stories from LibriVox"}
        books={userCollections.classics.length > 0 ? userCollections.classics : recommendations.classics} 
      />

      {/* Mystery & Detective - Show user books if they have any, otherwise recommendations */}
      <Section 
        title="Mystery & Detective" 
        subtitle={userCollections.mystery.length > 0 ? "Your mystery collection" : "Solve puzzles with the greatest detectives"}
        books={userCollections.mystery.length > 0 ? userCollections.mystery : recommendations.mystery} 
      />

      {/* Adventure Stories - Show user books if they have any, otherwise recommendations */}
      <Section 
        title="Adventure Stories" 
        subtitle={userCollections.adventure.length > 0 ? "Your adventure collection" : "Thrilling tales of exploration and discovery"}
        books={userCollections.adventure.length > 0 ? userCollections.adventure : recommendations.adventure} 
      />

      {/* Science Fiction - Show user books if they have any, otherwise recommendations */}
      <Section 
        title="Science Fiction" 
        subtitle={userCollections.scifi.length > 0 ? "Your sci-fi collection" : "Pioneering works of speculative fiction"}
        books={userCollections.scifi.length > 0 ? userCollections.scifi : recommendations.scifi} 
      />
    </div>
  );
};