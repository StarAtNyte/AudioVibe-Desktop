import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  Clock, 
  Calendar, 
  User, 
  BookOpen, 
  Mic,
  Save,
  History,
  ChevronDown,
  Plus
} from 'lucide-react';
import { SearchFilters, SearchSuggestion, searchService } from '../../services/searchService';

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  onLibriVoxSearch?: (query: string) => void;
  className?: string;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  onLibriVoxSearch,
  className = ''
}) => {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<{ name: string; filters: SearchFilters }[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  
  const [authors, setAuthors] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [narrators, setNarrators] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchService.initialize();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [authorsData, genresData, narratorsData] = await Promise.all([
        searchService.getDistinctAuthors(),
        searchService.getDistinctGenres(),
        searchService.getDistinctNarrators()
      ]);
      
      setAuthors(authorsData);
      setGenres(genresData);
      setNarrators(narratorsData);
      setSearchHistory(searchService.getSearchHistory());
      setSavedSearches(searchService.getSavedSearches());
    } catch (error) {
      console.error('Failed to load search data:', error);
    }
  };

  const handleSearchInput = async (value: string) => {
    setFilters(prev => ({ ...prev, query: value }));
    
    if (value.length >= 2) {
      try {
        const newSuggestions = await searchService.getSearchSuggestions(value);
        setSuggestions(newSuggestions);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Failed to get suggestions:', error);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSearch = () => {
    if (filters.query) {
      searchService.addToSearchHistory(filters.query);
      setSearchHistory(searchService.getSearchHistory());
    }
    
    onSearch(filters);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    let updatedFilters = { ...filters };
    
    switch (suggestion.type) {
      case 'author':
        updatedFilters.author = suggestion.value;
        break;
      case 'genre':
        updatedFilters.genre = suggestion.value;
        break;
      case 'narrator':
        updatedFilters.narrator = suggestion.value;
        break;
      case 'title':
        updatedFilters.query = suggestion.value;
        break;
    }
    
    setFilters(updatedFilters);
    onSearch(updatedFilters);
    setShowSuggestions(false);
  };

  const handleHistoryClick = (query: string) => {
    const updatedFilters = { ...filters, query };
    setFilters(updatedFilters);
    onSearch(updatedFilters);
    setShowSuggestions(false);
  };

  const handleSavedSearchClick = (savedFilters: SearchFilters) => {
    setFilters(savedFilters);
    onSearch(savedFilters);
    setShowAdvanced(true);
  };

  const handleSaveSearch = () => {
    if (saveSearchName.trim()) {
      searchService.saveSearch(saveSearchName.trim(), filters);
      setSavedSearches(searchService.getSavedSearches());
      setSaveSearchName('');
      setShowSaveDialog(false);
    }
  };

  const clearFilters = () => {
    const emptyFilters = {};
    setFilters(emptyFilters);
    onSearch(emptyFilters);
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== null && value !== ''
  );

  return (
    <div className={`relative ${className}`}>
      {/* Main Search Bar */}
      <div className="relative">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search audiobooks, authors, genres..."
            value={filters.query || ''}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            onFocus={() => {
              if (filters.query && filters.query.length >= 2) {
                setShowSuggestions(true);
              }
            }}
            className="w-full pl-11 pr-20 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
            {onLibriVoxSearch && (
              <button
                onClick={() => filters.query && onLibriVoxSearch(filters.query)}
                className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                title="Search LibriVox"
              >
                LibriVox
              </button>
            )}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-2 rounded ${
                showAdvanced || hasActiveFilters
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400'
              }`}
            >
              <Filter size={16} />
            </button>
          </div>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (
          <div 
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
          >
            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="p-3 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  <History size={14} className="mr-1" />
                  Recent Searches
                </div>
                <div className="space-y-1">
                  {searchHistory.slice(0, 3).map((query, index) => (
                    <button
                      key={index}
                      onClick={() => handleHistoryClick(query)}
                      className="w-full text-left px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-3">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Suggestions
                </div>
                <div className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                    >
                      {suggestion.type === 'author' && <User size={14} className="mr-2 text-gray-400" />}
                      {suggestion.type === 'genre' && <BookOpen size={14} className="mr-2 text-gray-400" />}
                      {suggestion.type === 'narrator' && <Mic size={14} className="mr-2 text-gray-400" />}
                      {suggestion.type === 'title' && <Search size={14} className="mr-2 text-gray-400" />}
                      <span>{suggestion.value}</span>
                      <span className="ml-auto text-xs text-gray-400 capitalize">
                        {suggestion.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Saved Searches */}
            {savedSearches.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-600">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Saved Searches
                </div>
                <div className="space-y-1">
                  {savedSearches.slice(0, 3).map((saved, index) => (
                    <button
                      key={index}
                      onClick={() => handleSavedSearchClick(saved.filters)}
                      className="w-full text-left px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                    >
                      {saved.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Advanced Filters</h3>
            <div className="flex items-center space-x-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center space-x-1 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Save size={14} />
                <span>Save</span>
              </button>
              <button
                onClick={() => setShowAdvanced(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Author Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Author
              </label>
              <select
                value={filters.author || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Authors</option>
                {authors.map(author => (
                  <option key={author} value={author}>{author}</option>
                ))}
              </select>
            </div>

            {/* Genre Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Genre
              </label>
              <select
                value={filters.genre || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Genres</option>
                {genres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </div>

            {/* Narrator Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Narrator
              </label>
              <select
                value={filters.narrator || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, narrator: e.target.value || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Narrators</option>
                {narrators.map(narrator => (
                  <option key={narrator} value={narrator}>{narrator}</option>
                ))}
              </select>
            </div>

            {/* Duration Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Duration (hours)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={filters.min_duration ? Math.floor(filters.min_duration / 3600) : ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  min_duration: e.target.value ? parseInt(e.target.value) * 3600 : undefined 
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Duration (hours)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={filters.max_duration ? Math.floor(filters.max_duration / 3600) : ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  max_duration: e.target.value ? parseInt(e.target.value) * 3600 : undefined 
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="∞"
              />
            </div>

            {/* Date Added Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Added After
              </label>
              <input
                type="date"
                value={filters.added_after || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, added_after: e.target.value || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSearch}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Search size={16} />
              <span>Search</span>
            </button>
          </div>
        </div>
      )}

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Save Search</h3>
            <input
              type="text"
              placeholder="Search name..."
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveSearch()}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
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