import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Globe, 
  Clock, 
  User, 
  BookOpen, 
  Play, 
  Plus,
  ExternalLink,
  Languages,
  Search,
  X,
  Loader2
} from 'lucide-react';
import { LibriVoxAudiobook, searchService } from '../../services/searchService';
import { BookCover } from '../common/BookCover';

interface LibriVoxBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (audiobook: LibriVoxAudiobook) => Promise<void>;
  initialQuery?: string;
}

export const LibriVoxBrowser: React.FC<LibriVoxBrowserProps> = ({
  isOpen,
  onClose,
  onImport,
  initialQuery = ''
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [searchParams, setSearchParams] = useState({
    author: '',
    title: '',
    genre: '',
    language: 'en'
  });
  const [results, setResults] = useState<LibriVoxAudiobook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [selectedGenre, setSelectedGenre] = useState('');

  const commonGenres = [
    'Fiction', 'Philosophy', 'History', 'Science', 'Religion',
    'Poetry', 'Drama', 'Biography', 'Reference', 'Children',
    'Mystery', 'Adventure', 'Romance', 'Short Stories'
  ];

  // Generate Archive.org thumbnail URL from LibriVox audiobook
  const getLibriVoxThumbnailUrl = (audiobook: LibriVoxAudiobook): string => {
    // Try to extract archive.org identifier from various fields
    let archiveId = '';
    
    // Check if audiobook has archive_id field
    if ((audiobook as any).archive_id) {
      archiveId = (audiobook as any).archive_id;
    } else if ((audiobook.download_links as any)?.zip) {
      // Extract from zip download link: https://archive.org/download/IDENTIFIER/...
      const zipMatch = (audiobook.download_links as any).zip.match(/archive\.org\/download\/([^\/]+)/);
      if (zipMatch) {
        archiveId = zipMatch[1];
      }
    } else if (audiobook.download_links?.mp3) {
      // Extract from mp3 download link
      const mp3Match = audiobook.download_links.mp3.match(/archive\.org\/download\/([^\/]+)/);
      if (mp3Match) {
        archiveId = mp3Match[1];
      }
    }
    
    // If we found an archive ID, use Archive.org's thumbnail service
    if (archiveId) {
      return `https://archive.org/services/get-item-image.php?identifier=${archiveId}`;
    }
    
    // Fallback to empty string (will trigger BookCover's fallback mechanism)
    return '';
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' }
  ];

  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery);
      handleSearch(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const handleSearch = async (searchQuery?: string) => {
    const currentQuery = searchQuery || query;
    if (!currentQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Parse query for different search types
      let searchTerms: any = { limit: 20 };
      
      if (searchParams.author) {
        searchTerms.author = searchParams.author;
      } else if (searchParams.title) {
        searchTerms.title = searchParams.title;
      } else {
        // Try to determine if it's an author or title
        const words = currentQuery.toLowerCase().split(' ');
        if (words.length === 2 && !words.some(w => ['the', 'a', 'an', 'of', 'and'].includes(w))) {
          // Likely an author name
          searchTerms.author = currentQuery;
        } else {
          searchTerms.title = currentQuery;
        }
      }

      if (selectedGenre) {
        searchTerms.genre = selectedGenre;
      }
      
      if (searchParams.language) {
        searchTerms.language = searchParams.language;
      }

      const librivoxResults = await searchService.searchLibriVox(searchTerms);
      setResults(librivoxResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (audiobook: LibriVoxAudiobook) => {
    if (importing.has(audiobook.id)) return;

    setImporting(prev => new Set(prev).add(audiobook.id));
    try {
      await onImport(audiobook);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setImporting(prev => {
        const newSet = new Set(prev);
        newSet.delete(audiobook.id);
        return newSet;
      });
    }
  };

  const formatDuration = (duration: string): string => {
    if (!duration) return 'Unknown';
    
    // LibriVox duration is already formatted
    return duration;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl h-5/6 flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Globe className="text-green-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                LibriVox Public Domain Audiobooks
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Free public domain audiobooks read by volunteers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, author, or keywords..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>Search</span>
            </button>
          </div>

          {/* Advanced Search Options */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Genre:
              </label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Genres</option>
                {commonGenres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Language:
              </label>
              <select
                value={searchParams.language}
                onChange={(e) => setSearchParams(prev => ({ ...prev, language: e.target.value }))}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Specific author..."
                value={searchParams.author}
                onChange={(e) => setSearchParams(prev => ({ ...prev, author: e.target.value }))}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-40"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
                <X size={16} />
                <span className="font-medium">Search Error</span>
              </div>
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
                <Loader2 size={24} className="animate-spin" />
                <span>Searching LibriVox...</span>
              </div>
            </div>
          )}

          {!loading && results.length === 0 && query && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Globe size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No audiobooks found</h3>
              <p>Try adjusting your search terms or filters</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map(audiobook => (
                <div
                  key={audiobook.id}
                  className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4 hover:shadow-md transition-shadow"
                >
                  {/* Cover Image */}
                  <div className="mb-4 flex justify-center">
                    <div className="w-24 h-32">
                      <BookCover
                        title={audiobook.title}
                        coverUrl={getLibriVoxThumbnailUrl(audiobook)}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                      {audiobook.title}
                    </h3>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <User size={14} className="mr-1" />
                      {audiobook.author}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <div className="flex items-center">
                        <Clock size={12} className="mr-1" />
                        {formatDuration(audiobook.runtime)}
                      </div>
                      <div className="flex items-center">
                        <Languages size={12} className="mr-1" />
                        {audiobook.language}
                      </div>
                    </div>
                    {audiobook.genre.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {audiobook.genre.slice(0, 3).map((genre, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}
                    {audiobook.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                        {audiobook.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-2">
                      {audiobook.chapters && audiobook.chapters.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {audiobook.chapters.length} chapters
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {audiobook.download_links.mp3 && (
                        <a
                          href={audiobook.download_links.mp3}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Download MP3"
                        >
                          <Download size={16} />
                        </a>
                      )}
                      <a
                        href={`https://librivox.org/search?primary_key=${audiobook.id.replace('librivox_', '')}&search_category=work`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="View on LibriVox"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        onClick={() => handleImport(audiobook)}
                        disabled={importing.has(audiobook.id)}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded text-sm transition-colors"
                      >
                        {importing.has(audiobook.id) ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Plus size={14} />
                        )}
                        <span>Import</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Globe size={14} className="mr-1" />
              <span>Powered by LibriVox - Public Domain Audiobooks</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {results.length} results
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};