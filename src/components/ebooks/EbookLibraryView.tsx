import React, { useState } from 'react';
import { Plus, Grid3x3, List, Search, Filter, X, CheckSquare, SortAsc, SortDesc, Trash2, FileText } from 'lucide-react';
import { EbookCard } from './EbookCard';
import { useEbookStore } from '../../store/ebook';
import { Ebook } from '../../types/ebook';

interface EbookLibraryViewProps {
  ebooks: Ebook[];
  isLoading: boolean;
  error: string | null;
  onOpenEbook: (id: string) => void;
  onDeleteEbook: (id: string) => void;
  onImportClick: () => void;
}

type SortField = 'title' | 'author' | 'added_date';

export const EbookLibraryView: React.FC<EbookLibraryViewProps> = ({
  ebooks,
  isLoading,
  error,
  onOpenEbook,
  onDeleteEbook,
  onImportClick,
}) => {
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
  } = useEbookStore();

  const [sortField, setSortField] = useState<SortField>('added_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [formatFilter, setFormatFilter] = useState<string>('');
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedBooks(new Set());
    }
  };

  const handleToggleBookSelection = (id: string) => {
    const newSelected = new Set(selectedBooks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedBooks(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedBooks.size === 0) return;

    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    for (const id of selectedBooks) {
      await onDeleteEbook(id);
    }
    setSelectedBooks(new Set());
    setIsSelectionMode(false);
    setShowDeleteConfirm(false);
  };

  const SortButton: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs transition-all ${
        sortField === field
          ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
          : 'border border-transparent text-gray-500 hover:text-gray-400 hover:bg-gray-800/30'
      }`}
    >
      <span>{children}</span>
      {sortField === field && (
        sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />
      )}
    </button>
  );

  const formats = Array.from(new Set(ebooks.map(book => book.file_format).filter(Boolean)));
  const authors = Array.from(new Set(ebooks.map(book => book.author).filter(Boolean)));

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">My Ebooks</h1>
            <p className="text-xs text-gray-400">
              {ebooks.length} {ebooks.length !== 1 ? 'ebooks' : 'ebook'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {ebooks.length > 0 && (
            <button
              onClick={handleToggleSelectionMode}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all text-sm ${
                isSelectionMode
                  ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
                  : 'bg-gray-700/50 border border-gray-600/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {isSelectionMode ? <X size={14} /> : <CheckSquare size={14} />}
              <span>{isSelectionMode ? 'Cancel' : 'Select'}</span>
            </button>
          )}
          <button
            onClick={onImportClick}
            className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 text-sm"
          >
            <Plus size={14} />
            <span>Add Ebook</span>
          </button>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900/40 dark:bg-gray-900/60 backdrop-blur-sm border-b border-gray-700/30">
        <div className="flex items-center space-x-4 flex-1">
          {/* Simple Library Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search your library..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-700/50 rounded-lg bg-gray-800/50 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all text-sm ${
              showFilters
                ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            <Filter size={14} />
            <span>Filters</span>
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-all ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            title="Grid view"
          >
            <Grid3x3 size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-all ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-6 py-3 bg-gray-900/40 dark:bg-gray-900/60 backdrop-blur-sm border-b border-gray-700/30">
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-400">Format:</label>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-700/50 rounded-lg bg-gray-800/50 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              >
                <option value="">All</option>
                {formats.map((format) => (
                  <option key={format} value={format}>
                    {format.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-400">Author:</label>
              <select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-700/50 rounded-lg bg-gray-800/50 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              >
                <option value="">All</option>
                {authors.map((author) => (
                  <option key={author} value={author}>
                    {author}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sort Options */}
      <div className="px-6 py-2 bg-gray-900/30 dark:bg-gray-900/50 backdrop-blur-sm border-b border-gray-700/20">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">Sort:</span>
          <SortButton field="title">Title</SortButton>
          <SortButton field="author">Author</SortButton>
          <SortButton field="added_date">Date Added</SortButton>
        </div>
      </div>

      {/* Selection Mode Actions */}
      {isSelectionMode && selectedBooks.size > 0 && (
        <div className="px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-yellow-400">
              {selectedBooks.size} ebook{selectedBooks.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="flex items-center space-x-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 text-red-400 rounded-lg transition-all text-sm"
            >
              <Trash2 size={14} />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 m-4 bg-white/5 dark:bg-black/20 rounded-2xl backdrop-blur-sm border border-gray-700/30">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-gray-400">Loading ebooks...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500">{error}</div>
          </div>
        ) : ebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              No ebooks found
            </div>
            <button
              onClick={onImportClick}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Import Your First Ebook
            </button>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
                : 'flex flex-col gap-3'
            }
          >
            {ebooks
              .filter((ebook) => {
                const matchesFormat = formatFilter === '' || ebook.file_format === formatFilter;
                const matchesAuthor = authorFilter === '' || ebook.author === authorFilter;
                return matchesFormat && matchesAuthor;
              })
              .sort((a, b) => {
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
                  case 'added_date':
                    aValue = new Date(a.added_date).getTime();
                    bValue = new Date(b.added_date).getTime();
                    break;
                  default:
                    return 0;
                }

                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
                return 0;
              })
              .map((ebook) => (
                <div key={ebook.id} className="relative">
                  {isSelectionMode && (
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedBooks.has(ebook.id)}
                        onChange={() => handleToggleBookSelection(ebook.id)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <EbookCard
                    key={ebook.id}
                    id={ebook.id}
                    title={ebook.title}
                    author={ebook.author}
                    format={ebook.file_format as 'pdf' | 'epub'}
                    coverUrl={ebook.cover_path}
                    totalPages={ebook.total_pages}
                    onOpen={onOpenEbook}
                    onDelete={onDeleteEbook}
                    viewMode={viewMode}
                  />
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Selected Ebooks?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete {selectedBooks.size} ebook{selectedBooks.size !== 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
