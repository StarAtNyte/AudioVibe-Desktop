import React, { useState, useMemo } from 'react';
import { Grid, List, Search, Plus, SortAsc, SortDesc, Filter, Trash2, X, CheckSquare, Square, FileText } from 'lucide-react';
import { AudiobookCard } from './AudiobookCard';
import { DocumentImportModal } from './index';

interface Audiobook {
  id: string;
  title: string;
  author: string;
  duration?: number;
  coverUrl?: string;
  progress?: number;
  dateAdded: Date;
  genre?: string;
}

interface LibraryViewProps {
  audiobooks: Audiobook[];
  currentlyPlaying?: string;
  isPlaying: boolean;
  onPlay: (id: string) => void;
  onPause: () => void;
  onAddAudiobook: () => void;
  onImportDocument?: (audiobook: Audiobook) => void;
  onSelectAudiobook?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
}

type SortField = 'title' | 'author' | 'duration' | 'dateAdded' | 'progress';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

export const LibraryView: React.FC<LibraryViewProps> = ({
  audiobooks,
  currentlyPlaying,
  isPlaying,
  onPlay,
  onPause,
  onAddAudiobook,
  onImportDocument,
  onSelectAudiobook,
  onBulkDelete
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('dateAdded');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string>('');
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const genres = useMemo(() => {
    const uniqueGenres = new Set(audiobooks.map(book => book.genre).filter(Boolean));
    return Array.from(uniqueGenres);
  }, [audiobooks]);

  const authors = useMemo(() => {
    const uniqueAuthors = new Set(audiobooks.map(book => book.author).filter(Boolean));
    return Array.from(uniqueAuthors);
  }, [audiobooks]);

  const filteredAndSortedAudiobooks = useMemo(() => {
    let filtered = audiobooks.filter(book => {
      const matchesSearch = searchQuery === '' || 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesGenre = genreFilter === '' || book.genre === genreFilter;
      const matchesAuthor = authorFilter === '' || book.author === authorFilter;
      
      return matchesSearch && matchesGenre && matchesAuthor;
    });

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'author':
          aValue = (a.author || '').toLowerCase();
          bValue = (b.author || '').toLowerCase();
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        case 'dateAdded':
          aValue = a.dateAdded?.getTime() || 0;
          bValue = b.dateAdded?.getTime() || 0;
          break;
        case 'progress':
          aValue = a.progress || 0;
          bValue = b.progress || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [audiobooks, searchQuery, genreFilter, authorFilter, sortField, sortOrder]);

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedBooks(new Set());
  };

  const handleToggleSelect = (id: string) => {
    setSelectedBooks(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    if (selectedBooks.size === filteredAndSortedAudiobooks.length) {
      setSelectedBooks(new Set());
    } else {
      setSelectedBooks(new Set(filteredAndSortedAudiobooks.map(book => book.id)));
    }
  };

  const handleBulkDelete = () => {
    // Check if user has opted out of confirmation
    const skipConfirmation = localStorage.getItem('audiobooks_skip_delete_confirm') === 'true';
    
    if (skipConfirmation) {
      executeBulkDelete();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleImportDocument = (audiobook: Audiobook) => {
    onImportDocument?.(audiobook);
    setShowImportModal(false);
  };

  const executeBulkDelete = () => {
    if (onBulkDelete && selectedBooks.size > 0) {
      onBulkDelete(Array.from(selectedBooks));
      setSelectedBooks(new Set());
      setIsSelectionMode(false);
    }
    setShowDeleteConfirm(false);
  };

  const handleConfirmDelete = () => {
    if (dontAskAgain) {
      localStorage.setItem('audiobooks_skip_delete_confirm', 'true');
    }
    executeBulkDelete();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortButton: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center space-x-1 px-3 py-1 rounded text-sm transition-colors ${
        sortField === field 
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
      }`}
    >
      <span>{children}</span>
      {sortField === field && (
        sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Library</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {filteredAndSortedAudiobooks.length} audiobook{filteredAndSortedAudiobooks.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {filteredAndSortedAudiobooks.length > 0 && (
            <button
              onClick={handleToggleSelectionMode}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                isSelectionMode
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-gray-500 hover:bg-gray-600 text-white'
              }`}
            >
              {isSelectionMode ? <X size={16} /> : <CheckSquare size={16} />}
              <span>{isSelectionMode ? 'Cancel' : 'Select'}</span>
            </button>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
          >
            <FileText size={16} />
            <span>Import Document</span>
          </button>
          <button
            onClick={onAddAudiobook}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span>Add Audiobook</span>
          </button>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center space-x-4 flex-1">
          {/* Simple Library Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
              showFilters || genreFilter || authorFilter
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Filter size={16} />
            <span>Filters</span>
          </button>

          {/* Bulk Actions */}
          {isSelectionMode && (
            <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-gray-300 dark:border-gray-600">
              <button
                onClick={handleSelectAll}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-lg transition-colors"
              >
                {selectedBooks.size === filteredAndSortedAudiobooks.length ? <Square size={16} /> : <CheckSquare size={16} />}
                <span>
                  {selectedBooks.size === filteredAndSortedAudiobooks.length ? 'Deselect All' : 'Select All'}
                </span>
              </button>
              
              {selectedBooks.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                  <span>Delete ({selectedBooks.size})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center space-x-2 ml-4">
          <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Selection Status */}
      {isSelectionMode && selectedBooks.size > 0 && (
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {selectedBooks.size} of {filteredAndSortedAudiobooks.length} audiobooks selected
          </p>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Author:</label>
              <select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Authors</option>
                {authors.map(author => (
                  <option key={author} value={author}>{author}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Genre:</label>
              <select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Genres</option>
                {genres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </div>
            
            {(genreFilter || authorFilter) && (
              <button
                onClick={() => {
                  setGenreFilter('');
                  setAuthorFilter('');
                }}
                className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
          <SortButton field="title">Title</SortButton>
          <SortButton field="author">Author</SortButton>
          <SortButton field="duration">Duration</SortButton>
          <SortButton field="dateAdded">Date Added</SortButton>
          <SortButton field="progress">Progress</SortButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {filteredAndSortedAudiobooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Search size={24} />
            </div>
            <h3 className="text-lg font-medium mb-2">No audiobooks found</h3>
            <p className="text-center">
              {searchQuery || genreFilter || authorFilter ? 'Try adjusting your search or filters' : 'Add your first audiobook to get started'}
            </p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
              : 'space-y-3'
          }>
            {filteredAndSortedAudiobooks.map(audiobook => (
              <div key={audiobook.id} className="relative">
                <AudiobookCard
                  {...audiobook}
                  isPlaying={currentlyPlaying === audiobook.id && isPlaying}
                  onPlay={onPlay}
                  onPause={onPause}
                  onSelect={onSelectAudiobook}
                  viewMode={viewMode}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedBooks.has(audiobook.id)}
                  onToggleSelect={handleToggleSelect}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Audiobooks
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete {selectedBooks.size} audiobook{selectedBooks.size !== 1 ? 's' : ''} from your library? This action cannot be undone.
            </p>
            
            {/* Don't ask again checkbox */}
            <div className="flex items-center space-x-2 mb-6">
              <input
                type="checkbox"
                id="dont-ask-again"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="dont-ask-again" className="text-sm text-gray-600 dark:text-gray-400">
                Don't ask again for bulk deletions
              </label>
            </div>
            
            {/* Actions */}
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Import Modal */}
      <DocumentImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportDocument}
      />
    </div>
  );
};