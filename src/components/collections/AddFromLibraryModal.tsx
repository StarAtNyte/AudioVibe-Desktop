import React, { useState, useEffect } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useLibraryStore, useCollectionStore } from '../../store';

interface AddFromLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionName: string;
}

export const AddFromLibraryModal: React.FC<AddFromLibraryModalProps> = ({
  isOpen,
  onClose,
  collectionId,
  collectionName,
}) => {
  const { audiobooks, fetchAudiobooks } = useLibraryStore();
  const { addAudiobookToCollection, collectionAudiobooks } = useCollectionStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAudiobooks, setSelectedAudiobooks] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAudiobooks();
      setSearchQuery('');
      setSelectedAudiobooks(new Set());
    }
  }, [isOpen, fetchAudiobooks]);

  // Filter audiobooks based on search and exclude already added ones
  const filteredAudiobooks = audiobooks.filter(audiobook => {
    const inCollection = collectionAudiobooks[collectionId]?.some(ca => ca.id === audiobook.id);
    if (inCollection) return false;

    const query = searchQuery.toLowerCase();
    return (
      audiobook.title.toLowerCase().includes(query) ||
      audiobook.author?.toLowerCase().includes(query) ||
      audiobook.narrator?.toLowerCase().includes(query) ||
      audiobook.genre?.toLowerCase().includes(query)
    );
  });

  const handleToggleSelection = (audiobookId: string) => {
    setSelectedAudiobooks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(audiobookId)) {
        newSet.delete(audiobookId);
      } else {
        newSet.add(audiobookId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedAudiobooks.size === filteredAudiobooks.length) {
      setSelectedAudiobooks(new Set());
    } else {
      setSelectedAudiobooks(new Set(filteredAudiobooks.map(ab => ab.id)));
    }
  };

  const handleAddSelected = async () => {
    if (selectedAudiobooks.size === 0) return;

    setIsLoading(true);
    try {
      const promises = Array.from(selectedAudiobooks).map(audiobookId =>
        addAudiobookToCollection(collectionId, audiobookId)
      );
      
      await Promise.all(promises);
      
      // Reset and close
      setSelectedAudiobooks(new Set());
      setSearchQuery('');
      onClose();
    } catch (error) {
      console.error('Failed to add audiobooks to collection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Add Audiobooks to "{collectionName}"
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select audiobooks from your library to add to this collection
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search audiobooks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Selection Controls */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {selectedAudiobooks.size === filteredAudiobooks.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedAudiobooks.size} of {filteredAudiobooks.length} selected
                </span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredAudiobooks.length} audiobooks available
              </span>
            </div>

            {/* Audiobook List */}
            <div className="max-h-96 overflow-y-auto">
              {filteredAudiobooks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No audiobooks match your search.' : 'No audiobooks available to add.'}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAudiobooks.map((audiobook) => (
                    <div
                      key={audiobook.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedAudiobooks.has(audiobook.id)
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => handleToggleSelection(audiobook.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAudiobooks.has(audiobook.id)}
                        onChange={() => handleToggleSelection(audiobook.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {audiobook.title}
                            </h4>
                            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                              {audiobook.author && <span>by {audiobook.author}</span>}
                              {audiobook.narrator && (
                                <>
                                  <span>•</span>
                                  <span>read by {audiobook.narrator}</span>
                                </>
                              )}
                            </div>
                            {audiobook.genre && (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                  {audiobook.genre}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                            {formatDuration(audiobook.duration)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={handleAddSelected}
              disabled={selectedAudiobooks.size === 0 || isLoading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
            >
              {isLoading 
                ? 'Adding...' 
                : `Add ${selectedAudiobooks.size} Audiobook${selectedAudiobooks.size !== 1 ? 's' : ''}`
              }
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};