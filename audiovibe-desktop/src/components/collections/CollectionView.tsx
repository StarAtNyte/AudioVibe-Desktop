import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore, useAudioStore } from '../../store';
import { Collection } from '../../types';
import { Play, Pause, Clock } from 'lucide-react';
import { PlusIcon, PencilIcon, TrashIcon, FolderIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CreateCollectionModal, EditCollectionModal, SmartCollectionModal, AddFromLibraryModal } from './';

interface CollectionViewProps {
  className?: string;
}

export const CollectionView: React.FC<CollectionViewProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const {
    collections,
    selectedCollection,
    collectionAudiobooks,
    isLoading,
    error,
    fetchCollections,
    selectCollection,
    deleteCollection,
    fetchCollectionAudiobooks,
    addAudiobookToCollection,
    removeAudiobookFromCollection,
    clearError
  } = useCollectionStore();

  const { currentAudiobookId, loadAudio, play, pause, stop, status } = useAudioStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSmartModal, setShowSmartModal] = useState(false);
  const [showAddFromLibraryModal, setShowAddFromLibraryModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [dragOverCollection, setDragOverCollection] = useState<string | null>(null);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Preload audiobook counts for all collections
  useEffect(() => {
    const loadCollectionCounts = async () => {
      for (const collection of collections) {
        if (!collectionAudiobooks[collection.id]) {
          try {
            await fetchCollectionAudiobooks(collection.id);
          } catch (error) {
            console.warn(`Failed to load audiobooks for collection ${collection.name}:`, error);
          }
        }
      }
    };

    if (collections.length > 0) {
      loadCollectionCounts();
    }
  }, [collections, fetchCollectionAudiobooks, collectionAudiobooks]);

  useEffect(() => {
    if (selectedCollection) {
      fetchCollectionAudiobooks(selectedCollection.id);
    }
  }, [selectedCollection, fetchCollectionAudiobooks]);

  const handleDeleteCollection = async (collection: Collection) => {
    if (window.confirm(`Are you sure you want to delete "${collection.name}"? This will remove all audiobooks from this collection.`)) {
      try {
        await deleteCollection(collection.id);
      } catch (error) {
        console.error('Failed to delete collection:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getAudiobookCount = (collectionId: string) => {
    return collectionAudiobooks[collectionId]?.length || 0;
  };

  const handleDragOver = (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverCollection(collectionId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCollection(null);
  };

  const handleDrop = async (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    setDragOverCollection(null);
    
    const audiobookId = e.dataTransfer.getData('audiobook/id');
    const audiobookTitle = e.dataTransfer.getData('audiobook/title');
    
    if (audiobookId) {
      try {
        await addAudiobookToCollection(collectionId, audiobookId);
        // You could add a toast notification here
        console.log(`Added "${audiobookTitle}" to collection`);
      } catch (error) {
        console.error('Failed to add audiobook to collection:', error);
      }
    }
  };

  const handleCreateSmartCollection = async (data: { name: string; description?: string; color: string; smart_criteria: any }) => {
    try {
      // For now, just log the smart collection data
      // This would need backend support for smart collections
      console.log('Smart collection would be created:', data);
      // TODO: Implement smart collection creation once backend supports it
      alert(`Smart collection "${data.name}" would be created with ${data.smart_criteria.rules.length} rules. Backend implementation needed.`);
    } catch (error) {
      console.error('Failed to create smart collection:', error);
      throw error;
    }
  };

  const handlePlayAudiobook = async (audiobook: any) => {
    try {
      console.log('=== COLLECTION PLAY START ===');
      console.log('Playing audiobook:', audiobook.title);
      console.log('File path:', audiobook.file_path);
      
      // Stop any currently playing audio first
      try {
        await stop();
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (stopError) {
        console.warn('Failed to stop current audio:', stopError);
      }
      
      // Load audio with file path and audiobook ID
      await loadAudio(audiobook.file_path, audiobook.id);
      
      // Wait a bit for loading, then play
      await new Promise(resolve => setTimeout(resolve, 200));
      await play();
      
      // Navigate to player page when starting playbook
      navigate('/player');
      
      console.log('=== COLLECTION PLAY SUCCESS ===');
    } catch (error) {
      console.error('Failed to play audiobook:', error);
    }
  };

  const handlePauseAudiobook = async () => {
    try {
      await pause();
    } catch (error) {
      console.error('Failed to pause audiobook:', error);
    }
  };

  const handleRemoveFromCollection = async (audiobookId: string, audiobookTitle: string) => {
    if (!selectedCollection) return;
    
    if (window.confirm(`Remove "${audiobookTitle}" from "${selectedCollection.name}"?`)) {
      try {
        await removeAudiobookFromCollection(selectedCollection.id, audiobookId);
      } catch (error) {
        console.error('Failed to remove audiobook from collection:', error);
      }
    }
  };

  const handleAudiobookClick = (audiobook: any) => {
    // If this audiobook is currently loaded, navigate to player
    if (currentAudiobookId === audiobook.id) {
      navigate('/player');
    } else {
      // Otherwise, start playing it
      handlePlayAudiobook(audiobook);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (isLoading && collections.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
              <button
                onClick={clearError}
                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Collections
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Organize your audiobooks into custom collections
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Collection
          </button>
          <button
            onClick={() => setShowSmartModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-gray-900"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Smart Collection
          </button>
        </div>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-12">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No collections
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating your first collection.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Collection
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className={`bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 ${
                dragOverCollection === collection.id 
                  ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-xl scale-105' 
                  : ''
              }`}
              onClick={() => selectCollection(collection)}
              onDragOver={(e) => handleDragOver(e, collection.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, collection.id)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center mb-2">
                      <div
                        className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
                        style={{ backgroundColor: collection.color }}
                      />
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                          {collection.name}
                        </h3>
                        {collection.is_smart && (
                          <SparklesIcon className="w-4 h-4 ml-2 text-purple-500" title="Smart Collection" />
                        )}
                      </div>
                    </div>
                    {collection.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                        {collection.description}
                      </p>
                    )}
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        {getAudiobookCount(collection.id)} audiobook
                        {getAudiobookCount(collection.id) !== 1 ? 's' : ''}
                      </span>
                      <span className="mx-2">•</span>
                      <span>Created {formatDate(collection.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCollection(collection);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Edit collection"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCollection(collection);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete collection"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              {selectedCollection?.id === collection.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    Selected Collection
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Collection Details Panel */}
      {selectedCollection && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div
                  className="w-6 h-6 rounded-full mr-3"
                  style={{ backgroundColor: selectedCollection.color }}
                />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedCollection.name}
                </h2>
              </div>
              <button
                onClick={() => selectCollection(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>
            
            {selectedCollection.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {selectedCollection.description}
              </p>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Audiobooks ({getAudiobookCount(selectedCollection.id)})
                </h3>
                <button
                  onClick={() => setShowAddFromLibraryModal(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add from Library
                </button>
              </div>
              
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : collectionAudiobooks[selectedCollection.id]?.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    No audiobooks in this collection yet.
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Click "Add from Library" to browse and add audiobooks.
                  </p>
                  <button
                    onClick={() => setShowAddFromLibraryModal(true)}
                    className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add from Library
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {collectionAudiobooks[selectedCollection.id]?.map((audiobook) => {
                    const isCurrentAudiobook = currentAudiobookId === audiobook.id;
                    const isCurrentlyPlaying = isCurrentAudiobook && status?.state === 'Playing';
                    
                    return (
                      <div
                        key={audiobook.id}
                        className={`flex items-center p-4 rounded-lg border transition-all duration-200 ${
                          isCurrentAudiobook 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {/* Cover Image */}
                        <div className="relative flex-shrink-0 w-12 h-12 mr-4">
                          {audiobook.cover_image_path ? (
                            <img 
                              src={audiobook.cover_image_path} 
                              alt={audiobook.title}
                              className="w-full h-full object-cover rounded-md"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-600 rounded-md flex items-center justify-center">
                              <span className="text-white font-semibold text-xs">
                                {audiobook.title.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          
                          {/* Progress Bar - will need to be fetched separately */}
                          {isCurrentAudiobook && status?.position && status?.duration && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-600 rounded-b-md overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${(status.position / status.duration) * 100}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h4 
                            className="text-sm font-medium text-gray-900 dark:text-white truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            onClick={() => handleAudiobookClick(audiobook)}
                          >
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
                          {audiobook.duration && (
                            <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <Clock size={10} className="mr-1" />
                              {formatDuration(audiobook.duration)}
                              {isCurrentAudiobook && status?.position && status?.duration && (
                                <span className="ml-2 text-blue-600 dark:text-blue-400">
                                  {Math.round((status.position / status.duration) * 100)}% complete
                                </span>
                              )}
                            </div>
                          )}
                          {audiobook.genre && (
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                {audiobook.genre}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCurrentlyPlaying) {
                                handlePauseAudiobook();
                              } else {
                                handlePlayAudiobook(audiobook);
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                          >
                            {isCurrentlyPlaying ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromCollection(audiobook.id, audiobook.title);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                            title="Remove from collection"
                          >
                            <XMarkIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Collection Modal */}
      <CreateCollectionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Edit Collection Modal */}
      <EditCollectionModal
        isOpen={!!editingCollection}
        onClose={() => setEditingCollection(null)}
        collection={editingCollection}
      />

      {/* Smart Collection Modal */}
      <SmartCollectionModal
        isOpen={showSmartModal}
        onClose={() => setShowSmartModal(false)}
        onSubmit={handleCreateSmartCollection}
      />

      {/* Add from Library Modal */}
      {selectedCollection && (
        <AddFromLibraryModal
          isOpen={showAddFromLibraryModal}
          onClose={() => setShowAddFromLibraryModal(false)}
          collectionId={selectedCollection.id}
          collectionName={selectedCollection.name}
        />
      )}
    </div>
  );
};