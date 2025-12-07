import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLibraryStore, useAudioStore, useAppStore } from '../../store';
import { useEbookStore } from '../../store/ebook';
import { useOnboardingStore } from '../../store/onboarding';
import { useResponsive } from '../../hooks/useResponsive';
import { archiveService, ArchiveAudiobook } from '../../services/archiveService';
import { BookCover } from '../common/BookCover';
import {
  BookOpenIcon,
  PlayIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  QueueListIcon,
  HeartIcon,
  ArrowDownTrayIcon,
  FolderIcon,
  ClockIcon,
  SparklesIcon,
  MusicalNoteIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import {
  PlayIcon as PlayIconSolid
} from '@heroicons/react/24/solid';
import clsx from 'clsx';

export const LeftSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { audiobooks, fetchAudiobooks } = useLibraryStore();
  const { ebooks, fetchEbooks } = useEbookStore();
  const { currentAudiobookId, loadAudio, setAudiobook, play } = useAudioStore();
  const { setLeftSidebarOpen } = useAppStore();
  const { selectedGenres } = useOnboardingStore();
  const { isMobile, isTablet, isSmallDesktop } = useResponsive();

  // Load audiobooks and ebooks when component mounts
  useEffect(() => {
    fetchAudiobooks();
    fetchEbooks();
  }, [fetchAudiobooks, fetchEbooks]);
  const [libraryType, setLibraryType] = useState<'audiobooks' | 'ebooks'>('audiobooks');
  const [sortBy, setSortBy] = useState('Recently Added');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [recommendedBooks, setRecommendedBooks] = useState<ArchiveAudiobook[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load recommended books from Archive.org based on user preferences
  useEffect(() => {
    const loadRecommendations = async () => {
      if (audiobooks.length >= 6) return; // Don't show recommendations if library is full

      setLoadingRecommendations(true);
      try {
        const books = selectedGenres.length > 0
          ? await archiveService.getByGenres(selectedGenres, 10)
          : await archiveService.getPopular(10);

        setRecommendedBooks(books);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
      } finally {
        setLoadingRecommendations(false);
      }
    };

    loadRecommendations();
  }, [audiobooks.length, selectedGenres]);

  const showRecommendations = audiobooks.length < 6 && recommendedBooks.length > 0;
  
  // Filter and sort audiobooks
  const filteredAndSortedAudiobooks = useMemo(() => {
    let result = [...audiobooks];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(book =>
        book.title.toLowerCase().includes(query) ||
        (book.author && book.author.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    if (sortBy === 'A-Z') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'Recently Added') {
      // Assuming books have a timestamp or are already sorted by recent addition
      // For now, we'll keep the default order which might be by recent addition
      // You might want to implement actual timestamp-based sorting here
    }

    return result;
  }, [audiobooks, searchQuery, sortBy]);

  // Filter and sort ebooks
  const filteredAndSortedEbooks = useMemo(() => {
    let result = [...ebooks];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(book =>
        book.title.toLowerCase().includes(query) ||
        (book.author && book.author.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    if (sortBy === 'A-Z') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'Recently Added') {
      // Sort by added_date
      result.sort((a, b) => new Date(b.added_date).getTime() - new Date(a.added_date).getTime());
    }

    return result;
  }, [ebooks, searchQuery, sortBy]);
  
  const handleAudiobookClick = async (audiobook: any) => {
    // Always navigate to player page when clicking on an audiobook
    try {
      // Load the audiobook (but don't play it) and set it as current
      const currentState = useAudioStore.getState();
      if (currentState.currentAudiobookId !== audiobook.id) {
        await loadAudio(audiobook.file_path, audiobook.id);
      } else {
        // Even if it's the same audiobook, ensure it's properly loaded
        setAudiobook(audiobook.id);
      }
      // Navigate to player regardless
      navigate('/player');
      // Close sidebar on mobile after navigation
      if (isMobile) {
        setLeftSidebarOpen(false);
      }
    } catch (error) {
      console.error('Failed to load audiobook:', error);
    }
  };

  const handlePlayClick = async (audiobook: any, e: React.MouseEvent) => {
    // Prevent the card click event from firing
    e.stopPropagation();

    // Load and play the audiobook, then navigate to player
    try {
      // If it's not the current audiobook, load it
      if (currentAudiobookId !== audiobook.id) {
        await loadAudio(audiobook.file_path, audiobook.id);
      }
      // Navigate to player
      navigate('/player');
      // Close sidebar on mobile after navigation
      if (isMobile) {
        setLeftSidebarOpen(false);
      }
      // Start playing
      await play();
    } catch (error) {
      console.error('Failed to load and play audiobook:', error);
    }
  };

  const handleRecommendedBookClick = (book: ArchiveAudiobook) => {
    // Navigate to home page where they can see more details and add the book
    navigate('/home');
    // Close sidebar on mobile
    if (isMobile) {
      setLeftSidebarOpen(false);
    }
  };

  const handleEbookClick = (ebookId: string) => {
    // Navigate to ebook reader
    navigate(`/reader/${ebookId}`);
    // Close sidebar on mobile
    if (isMobile) {
      setLeftSidebarOpen(false);
    }
  };
  

  return (
    <div className={`${isMobile ? 'w-full' : isTablet ? 'w-60' : isSmallDesktop ? 'w-72' : 'w-80'} text-gray-900 dark:text-white flex flex-col h-full relative`}>
      {/* Header */}
      <div className={`${isMobile ? 'p-3' : isTablet ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-300">
            <BookOpenIcon className="w-6 h-6" />
            <h2 className="text-sm font-semibold truncate">Your Library</h2>
          </div>
          <div className="flex items-center space-x-1">
            <button
              ref={menuRef}
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors relative"
              title="Menu"
            >
              <Bars3Icon className="w-5 h-5" />
              {showMenu && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        navigate('/downloads');
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Downloads
                    </button>
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Settings
                    </button>
                  </div>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search in Your Library"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100/50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>

        {/* Library Type Tabs */}
        <div className="flex items-center space-x-2 mb-3">
          <button
            onClick={() => setLibraryType('audiobooks')}
            className={clsx(
              'flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors',
              libraryType === 'audiobooks'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <MusicalNoteIcon className="w-4 h-4" />
            <span>Audiobooks</span>
          </button>
          <button
            onClick={() => setLibraryType('ebooks')}
            className={clsx(
              'flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-medium transition-colors',
              libraryType === 'ebooks'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <DocumentTextIcon className="w-4 h-4" />
            <span>Ebooks</span>
          </button>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setSortBy('Recently Added')}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                sortBy === 'Recently Added' 
                  ? 'bg-green-500 text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              Recent
            </button>
            <button 
              onClick={() => setSortBy('A-Z')}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                sortBy === 'A-Z' 
                  ? 'bg-green-500 text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              A-Z
            </button>
          </div>
        </div>
      </div>

      {/* Library Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
        <div className={`${isMobile ? 'px-3' : 'px-4'} space-y-1`}>
          {/* Audiobooks Section */}
          {libraryType === 'audiobooks' && (
            <div className="mb-6">
              <h3 className="text-gray-600 dark:text-gray-300 text-xs font-medium px-2 mb-3 flex items-center justify-between">
                <span>Your Audiobooks</span>
                <span className="text-xs text-gray-500">({filteredAndSortedAudiobooks.length})</span>
              </h3>

              {filteredAndSortedAudiobooks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-xs">
                  {searchQuery ? 'No audiobooks found' : 'No audiobooks yet'}
                </div>
              ) : (
                filteredAndSortedAudiobooks.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => handleAudiobookClick(book)}
                    className={clsx(
                      'flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group transition-colors',
                      currentAudiobookId === book.id && 'bg-gray-200/70 dark:bg-gray-800/70'
                    )}
                  >
                    {book.cover_image_path ? (
                      <img
                        src={book.cover_image_path}
                        alt={book.title}
                        className="w-10 h-10 object-cover rounded shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded flex items-center justify-center shadow-sm">
                        <span className="text-white font-bold text-xs">
                          {book.title.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={clsx(
                        'font-medium text-xs truncate',
                        currentAudiobookId === book.id ? 'text-green-400' : 'text-gray-900 dark:text-white'
                      )}>
                        {book.title}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                        {book.author || 'Unknown Author'}
                      </p>
                    </div>
                    {currentAudiobookId === book.id ? (
                      <div className="flex items-center space-x-1">
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                        <MusicalNoteIcon className="w-4 h-4 text-green-500" />
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handlePlayClick(book, e)}
                        className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <PlayIconSolid className="w-3 h-3 text-black" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Ebooks Section */}
          {libraryType === 'ebooks' && (
            <div className="mb-6">
              <h3 className="text-gray-600 dark:text-gray-300 text-xs font-medium px-2 mb-3 flex items-center justify-between">
                <span>Your Ebooks</span>
                <span className="text-xs text-gray-500">({filteredAndSortedEbooks.length})</span>
              </h3>

              {filteredAndSortedEbooks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-xs">
                  {searchQuery ? 'No ebooks found' : 'No ebooks yet'}
                </div>
              ) : (
                filteredAndSortedEbooks.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => handleEbookClick(book.id)}
                    className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group transition-colors"
                  >
                    {book.cover_path ? (
                      <img
                        src={book.cover_path}
                        alt={book.title}
                        className="w-10 h-10 object-cover rounded shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded flex items-center justify-center shadow-sm">
                        <DocumentTextIcon className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate text-gray-900 dark:text-white">
                        {book.title}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                        {book.author || 'Unknown Author'}
                      </p>
                    </div>
                    <div className="text-gray-400 text-xs uppercase">
                      {book.file_format}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Recommended - Show if library has fewer than 6 books and viewing audiobooks */}
          {libraryType === 'audiobooks' && showRecommendations && (
            <div>
              <h3 className="text-gray-300 text-xs font-medium px-2 mb-3 flex items-center space-x-2">
                <SparklesIcon className="w-4 h-4 text-yellow-400" />
                <span>{audiobooks.length === 0 ? 'Recommended for you' : 'Discover more'}</span>
              </h3>

              {loadingRecommendations ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
                </div>
              ) : (
                recommendedBooks.slice(0, Math.max(6 - audiobooks.length, 3)).map((book) => (
                  <div
                    key={book.identifier}
                    onClick={() => handleRecommendedBookClick(book)}
                    className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-800 cursor-pointer group transition-colors"
                  >
                    <div className="w-10 h-10 rounded shadow-sm overflow-hidden">
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-emerald-500 flex items-center justify-center">
                          <span className="text-white font-bold text-xs">
                            {book.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-xs truncate">
                        {book.title}
                      </p>
                      <div className="flex items-center space-x-2">
                        <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                          {book.creator || 'Unknown Author'}
                        </p>
                        {book.avg_rating && book.avg_rating > 0 && (
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400 text-xs">{book.avg_rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <PlusIcon className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                  </div>
                ))
              )}
              
              {audiobooks.length === 0 && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400 text-xs font-medium mb-1">Get Started</p>
                  <p className="text-gray-300 text-xs mb-2">Add audiobooks to your library</p>
                  <button
                    onClick={() => navigate('/library')}
                    className="w-full px-3 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 transition-colors"
                  >
                    Browse Library
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bottom padding for scroll */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
};