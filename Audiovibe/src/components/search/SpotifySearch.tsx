import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Clock, 
  User, 
  BookOpen, 
  Download,
  Plus,
  Loader2,
  Globe,
  Home
} from 'lucide-react';
import { SearchFilters, LibriVoxAudiobook, searchService } from '../../services/searchService';
import { BookCover } from '../common/BookCover';
import { useDownloadsStore } from '../../store';

interface SpotifySearchProps {
  onImport: (audiobook: LibriVoxAudiobook) => Promise<void>;
  onPlayLibrary: (audiobook: any) => void;
  libraryBooks: any[];
  className?: string;
  onNavigateToDownloads?: () => void;
  initialQuery?: string;
}

export const SpotifySearch: React.FC<SpotifySearchProps> = ({
  onImport,
  onPlayLibrary,
  libraryBooks,
  className = '',
  onNavigateToDownloads,
  initialQuery = ''
}) => {
  const { addDownload } = useDownloadsStore();
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [libraryResults, setLibraryResults] = useState<any[]>([]);
  const [librivoxResults, setLibrivoxResults] = useState<LibriVoxAudiobook[]>([]);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [importedBooks, setImportedBooks] = useState<Set<string>>(new Set());
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'library' | 'librivox'>('all');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchService.initialize();
    setSearchHistory(searchService.getSearchHistory());
  }, []);

  // Handle initial query from URL parameters
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      console.log('SpotifySearch received initialQuery:', initialQuery);
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Auto-search as user types (debounced) or when initialQuery is set
  useEffect(() => {
    console.log('SpotifySearch useEffect triggered with query:', query, 'initialQuery:', initialQuery);
    const timeoutId = setTimeout(() => {
      if (query.trim().length > 2) {
        console.log('Triggering search for query:', query);
        handleSearch();
      } else if (query.trim() === '') {
        console.log('Clearing search results for empty query');
        setLibraryResults([]);
        setLibrivoxResults([]);
      } else {
        console.log('Query too short:', query, 'length:', query.trim().length);
      }
    }, initialQuery && query === initialQuery ? 0 : 500); // No delay for initial query

    return () => clearTimeout(timeoutId);
  }, [query, libraryBooks, initialQuery]); // Add initialQuery dependency

  const handleSearch = async (searchQuery?: string) => {
    const currentQuery = searchQuery || query;
    console.log('handleSearch called with:', { searchQuery, currentQuery, query });
    
    if (!currentQuery.trim()) {
      console.log('Empty query, clearing results');
      setLibraryResults([]);
      setLibrivoxResults([]);
      return;
    }

    console.log('Starting search for:', currentQuery);
    setIsSearching(true);
    setShowSuggestions(false);
    
    try {
      // Search local library
      let librarySearchResults: any[] = [];
      try {
        librarySearchResults = libraryBooks.filter(book => 
          book.title.toLowerCase().includes(currentQuery.toLowerCase()) ||
          (book.author && book.author.toLowerCase().includes(currentQuery.toLowerCase()))
        );
      } catch (error) {
        console.warn('Library search failed:', error);
      }

      // Search LibriVox simultaneously
      let librivoxSearchResults: LibriVoxAudiobook[] = [];
      try {
        console.log('🔍 FRONTEND: Starting LibriVox search for:', currentQuery);
        librivoxSearchResults = await searchService.searchLibriVox({
          title: currentQuery,
          limit: 20
        });
        console.log('✅ FRONTEND: LibriVox search completed, results:', librivoxSearchResults.length);
        console.log('📚 FRONTEND: First result:', librivoxSearchResults[0]);
      } catch (error) {
        console.error('❌ FRONTEND: LibriVox search failed:', error);
      }

      setLibraryResults(librarySearchResults);
      setLibrivoxResults(librivoxSearchResults);
      
      // Add to search history only if we actually searched for something
      if (currentQuery && currentQuery.trim()) {
        searchService.addToSearchHistory(currentQuery);
        setSearchHistory(searchService.getSearchHistory());
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async (audiobook: LibriVoxAudiobook) => {
    if (importing.has(audiobook.id)) return;

    setImporting(prev => new Set(prev).add(audiobook.id));
    
    // Add to downloads queue immediately with enhanced metadata
    const downloadId = addDownload({
      title: audiobook.title,
      author: audiobook.author,
      coverUrl: audiobook.cover_url,
      downloadUrl: audiobook.download_links.mp3 || audiobook.download_links.m4b || '',
      // Add extra metadata that might help with import
      description: audiobook.description,
      genre: audiobook.genre?.[0] || 'Unknown',
      runtime: audiobook.runtime
    });

    // Navigate to downloads tab to show progress
    if (onNavigateToDownloads) {
      onNavigateToDownloads();
    }

    // Mark as imported immediately since downloads will handle it
    setImportedBooks(prev => new Set(prev).add(audiobook.id));
    setImporting(prev => {
      const newSet = new Set(prev);
      newSet.delete(audiobook.id);
      return newSet;
    });
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    handleSearch(historyQuery);
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    setQuery('');
    setLibraryResults([]);
    setLibrivoxResults([]);
    setShowSuggestions(false);
    setActiveTab('all');
  };

  const hasResults = libraryResults.length > 0 || librivoxResults.length > 0;
  const totalResults = libraryResults.length + librivoxResults.length;

  const filteredLibraryResults = activeTab === 'librivox' ? [] : libraryResults;
  const filteredLibrivoxResults = activeTab === 'library' ? [] : librivoxResults;

  return (
    <div className={`${className} space-y-6`}>
      {/* Spotify-style Search Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 rounded-xl blur opacity-20"></div>
        <div className="relative bg-gradient-to-r from-green-500 via-blue-600 to-purple-700 rounded-xl p-8 text-white">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-2">
              Search Everything
            </h1>
            <p className="text-green-100 mb-6 text-lg">
              Your library + millions of free LibriVox audiobooks
            </p>
            
            {/* Main Search Input */}
            <div className="relative">
              <Search size={24} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-300" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="What do you want to listen to?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  } else if (e.key === 'Escape') {
                    clearSearch();
                  }
                }}
                onFocus={() => {
                  if (searchHistory.length > 0 && !query) {
                    setShowSuggestions(true);
                  }
                }}
                className="w-full pl-14 pr-14 py-4 bg-white text-gray-900 rounded-full text-lg placeholder-gray-500 focus:ring-4 focus:ring-white/20 focus:outline-none transition-all"
              />
              {query && (
                <button
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Search Suggestions */}
            {showSuggestions && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl z-50 max-w-4xl mx-auto">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Recent searches</h3>
                  <div className="space-y-2">
                    {searchHistory.slice(0, 5).map((historyItem, index) => (
                      <button
                        key={index}
                        onClick={() => handleHistoryClick(historyItem)}
                        className="flex items-center space-x-3 w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded"
                      >
                        <Clock size={16} className="text-gray-400" />
                        <span>{historyItem}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Results */}
      {(hasResults || isSearching) && (
        <div className="space-y-6">
          {/* Results Header with Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setActiveTab('all')}
                className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                  activeTab === 'all' 
                    ? 'border-green-500 text-green-500' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                All ({totalResults})
              </button>
              {libraryResults.length > 0 && (
                <button
                  onClick={() => setActiveTab('library')}
                  className={`flex items-center space-x-2 text-sm font-medium pb-2 border-b-2 transition-colors ${
                    activeTab === 'library' 
                      ? 'border-blue-500 text-blue-500' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Home size={16} />
                  <span>Your Library ({libraryResults.length})</span>
                </button>
              )}
              {librivoxResults.length > 0 && (
                <button
                  onClick={() => setActiveTab('librivox')}
                  className={`flex items-center space-x-2 text-sm font-medium pb-2 border-b-2 transition-colors ${
                    activeTab === 'librivox' 
                      ? 'border-green-500 text-green-500' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Globe size={16} />
                  <span>LibriVox ({librivoxResults.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isSearching && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3 text-gray-500">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-lg">Searching everywhere...</span>
              </div>
            </div>
          )}

          {/* Results */}
          {!isSearching && (
            <div className="space-y-8">
              {/* Library Results */}
              {filteredLibraryResults.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                      <Home className="h-5 w-5 mr-2 text-blue-500" />
                      From Your Library
                    </h2>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredLibraryResults.map((book, index) => (
                      <div key={book.id} className="group animate-stagger-fade-in hover-lift">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
                          <div className="aspect-square bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                            {book.cover_image_path ? (
                              <img 
                                src={`file://${book.cover_image_path}`}
                                alt={book.title}
                                className="w-full h-full object-cover rounded-lg"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`${book.cover_image_path ? 'hidden' : ''} flex items-center justify-center w-full h-full`}>
                              <BookOpen className="h-12 w-12 text-white" />
                            </div>
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                              <button
                                onClick={() => onPlayLibrary(book)}
                                className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-200 shadow-lg"
                              >
                                <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent ml-1"></div>
                              </button>
                            </div>
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2 text-sm">
                            {book.title}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 text-xs">
                            {book.author || 'Unknown Author'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LibriVox Results */}
              {filteredLibrivoxResults.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                      <Globe className="h-5 w-5 mr-2 text-green-500" />
                      Discover on LibriVox
                    </h2>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredLibrivoxResults.map((book, index) => (
                      <div key={book.id} className="group animate-stagger-fade-in hover-lift">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 border-l-4 border-green-500">
                          <div className="aspect-square rounded-lg mb-3 relative overflow-hidden">
                            <BookCover 
                              bookId={book.id}
                              title={book.title}
                              coverUrl={book.cover_url}
                              className="w-full h-full object-cover rounded-lg"
                              fallbackClassName="w-full h-full bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center"
                            />
                            <div className="absolute top-2 right-2">
                              <Globe className="h-4 w-4 text-white/80" />
                            </div>
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2 text-sm">
                            {book.title}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">
                            {book.author}
                          </p>
                          <p className="text-green-600 dark:text-green-400 text-xs mb-3">
                            Free • {book.runtime}
                          </p>
                          <button
                            onClick={() => handleImport(book)}
                            disabled={importing.has(book.id) || importedBooks.has(book.id)}
                            className={`w-full flex items-center justify-center space-x-1 px-3 py-2 text-white rounded-lg text-sm transition-colors ${
                              importedBooks.has(book.id) 
                                ? 'bg-gray-500 cursor-default'
                                : importing.has(book.id)
                                  ? 'bg-blue-500'
                                  : 'bg-green-500 hover:bg-green-600'
                            }`}
                          >
                            {importing.has(book.id) ? (
                              <Download size={14} className="animate-pulse" />
                            ) : importedBooks.has(book.id) ? (
                              <span>✓</span>
                            ) : (
                              <Plus size={14} />
                            )}
                            <span>
                              {importing.has(book.id) 
                                ? 'Downloading...' 
                                : importedBooks.has(book.id) 
                                  ? 'Added' 
                                  : 'Add'
                              }
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {!hasResults && query && (
                <div className="text-center py-12">
                  <Search className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No results found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Try a different search term or check your spelling
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close suggestions */}
      {showSuggestions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
};