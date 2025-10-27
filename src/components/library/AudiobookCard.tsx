import React, { useState, useRef, useEffect } from 'react';
import { Clock, Play, Pause, MoreVertical, Trash2, Mic } from 'lucide-react';
import { useCollectionStore, useLibraryStore } from '../../store';
import { BookCover } from '../common/BookCover';

interface AudiobookCardProps {
  id: string;
  title: string;
  author: string;
  duration?: number;
  coverUrl?: string;
  progress?: number;
  isPlaying?: boolean;
  onPlay: (id: string) => void;
  onPause: () => void;
  onSelect?: (id: string) => void;
  viewMode: 'grid' | 'list';
  // Bulk selection props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  // Visual distinction props
  genre?: string;
  narrator?: string;
}

export const AudiobookCard: React.FC<AudiobookCardProps> = ({
  id,
  title,
  author,
  duration,
  coverUrl,
  progress = 0,
  isPlaying = false,
  onPlay,
  onPause,
  onSelect,
  viewMode,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  genre,
  narrator
}) => {
  const { collections, addAudiobookToCollection } = useCollectionStore();
  const { deleteAudiobook } = useLibraryStore();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{top?: string, bottom?: string, left?: string, right?: string}>({top: '100%', right: '0'});
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Check if this is a TTS-generated audiobook
  const isTTSGenerated = genre === 'TTS Generated' || narrator === 'Generated via TTS' || author === 'Generated via TTS';

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      onPause();
    } else {
      onPlay(id);
    }
  };

  const handleCardClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(id);
    } else if (onSelect) {
      onSelect(id);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelect) {
      onToggleSelect(id);
    }
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!showContextMenu && buttonRef.current) {
      // Calculate optimal menu position
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const menuHeight = 200; // Approximate menu height
      const menuWidth = 192; // w-48 = 12rem = 192px
      
      let position: {top?: string, bottom?: string, left?: string, right?: string} = {};
      
      // Vertical positioning
      if (buttonRect.bottom + menuHeight > windowHeight - 50) {
        // Open upward
        position.bottom = '100%';
      } else {
        // Open downward  
        position.top = '100%';
      }
      
      // Horizontal positioning - check if menu would go off the left edge
      const menuLeftEdge = buttonRect.right - menuWidth;
      const safetyMargin = 280; // Account for sidebar width + some padding
      
      console.log('Menu positioning:', {
        buttonRight: buttonRect.right,
        menuWidth,
        menuLeftEdge,
        safetyMargin,
        willFitLeft: menuLeftEdge >= safetyMargin
      });
      
      if (menuLeftEdge < safetyMargin) {
        // Too close to left edge/sidebar, open to the right of the button
        position.left = '0';
        position.right = undefined;
        console.log('Opening menu to the RIGHT');
      } else {
        // Normal case, open to the left (align right edge with button)
        position.right = '0';
        position.left = undefined;
        console.log('Opening menu to the LEFT');
      }
      
      setMenuPosition(position);
    }
    
    setShowContextMenu(!showContextMenu);
  };

  const handleAddToCollection = async (collectionId: string) => {
    try {
      await addAudiobookToCollection(collectionId, id);
      setShowContextMenu(false);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to add audiobook to collection:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Close the context menu first to prevent any interference
    setShowContextMenu(false);
    
    // Use setTimeout to ensure the menu is closed and events are settled
    setTimeout(() => {
      if (window.confirm(`Are you sure you want to delete "${title}" from your library?\n\nThis action cannot be undone.`)) {
        try {
          deleteAudiobook(id).then(() => {
            console.log(`✅ Successfully deleted audiobook: ${title}`);
          }).catch((error) => {
            console.error('Failed to delete audiobook:', error);
            alert(`Failed to delete "${title}". Please try again.`);
          });
        } catch (error) {
          console.error('Failed to delete audiobook:', error);
          alert(`Failed to delete "${title}". Please try again.`);
        }
      }
    }, 100);
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('audiobook/id', id);
    e.dataTransfer.setData('audiobook/title', title);
    e.dataTransfer.setData('audiobook/author', author);
    e.dataTransfer.effectAllowed = 'copy';
    
    // Create a custom drag image
    const dragImage = new Image();
    dragImage.src = coverUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iNCIgZmlsbD0iIzM5OEVGNyIvPgo8L3N2Zz4K';
    e.dataTransfer.setDragImage(dragImage, 20, 20);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contextMenuRef.current && 
        !contextMenuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (viewMode === 'list') {
    return (
      <>
        <div 
          className={`flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700 ${isDragging ? 'opacity-50' : ''} ${showContextMenu ? 'relative z-[100]' : ''}`}
          onClick={handleCardClick}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{ overflow: showContextMenu ? 'visible' : 'hidden' }}
        >
        <div className="relative flex-shrink-0 w-16 h-16 mr-4">
          <BookCover 
            bookId={id}
            title={title}
            coverUrl={coverUrl}
            className="w-full h-full object-cover rounded-md"
            fallbackClassName="w-full h-full bg-gradient-to-br from-blue-400 to-purple-600 rounded-md flex items-center justify-center"
          />
          
          {/* TTS Generated Badge - List View */}
          {isTTSGenerated && (
            <div className="absolute -top-1 -right-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 py-0.5 rounded text-xs font-medium flex items-center space-x-0.5 shadow-sm">
              <Mic size={8} />
              <span>TTS</span>
            </div>
          )}
          
          {/* Selection checkbox for list view */}
          {isSelectionMode && (
            <div 
              className="absolute -top-1 -left-1 w-5 h-5 rounded bg-white/90 border-2 border-gray-300 flex items-center justify-center cursor-pointer transition-colors hover:bg-white"
              onClick={handleCheckboxClick}
            >
              {isSelected && (
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
            </div>
          )}
          
          {progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-600 rounded-b-md overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-xs truncate">
            {author}
          </p>
          {duration && (
            <div className="flex items-center mt-1 text-gray-500 dark:text-gray-400 text-xs">
              <Clock size={12} className="mr-1" />
              {formatDuration(duration)}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePlayPause}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white transition-all duration-200 hover:scale-105 shadow-md"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          
          <div className="relative">
            <button 
              ref={buttonRef}
              onClick={handleMoreClick}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            >
              <MoreVertical size={14} />
            </button>
            
            {showContextMenu && (
              <div 
                ref={contextMenuRef}
                className="absolute w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-[9999]"
                style={{ 
                  ...menuPosition, 
                  marginTop: menuPosition.top ? '4px' : undefined, 
                  marginBottom: menuPosition.bottom ? '4px' : undefined,
                  marginLeft: menuPosition.left ? '4px' : undefined,
                  marginRight: menuPosition.right ? '4px' : undefined
                }}
              >
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  Add to Collection
                </div>
                {collections.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    No collections available
                  </div>
                ) : (
                  collections.map(collection => (
                    <button
                      key={collection.id}
                      onClick={() => handleAddToCollection(collection.id)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: collection.color }}
                      />
                      <span>{collection.name}</span>
                    </button>
                  ))
                )}
                
                {/* Delete Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center space-x-2"
                  >
                    <Trash2 size={14} />
                    <span>Delete from Library</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
        
        {/* Backdrop for menu (list view) */}
        {showContextMenu && (
          <div 
            className="fixed inset-0 z-[90]" 
            onClick={() => setShowContextMenu(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700 group ${isDragging ? 'opacity-50' : ''} ${showContextMenu ? 'relative z-[100]' : ''}`}
        onClick={handleCardClick}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{ overflow: showContextMenu ? 'visible' : 'hidden' }}
      >
      <div className="relative aspect-square">
        <BookCover 
          bookId={id}
          title={title}
          coverUrl={coverUrl}
          className="w-full h-full object-cover"
          fallbackClassName="w-full h-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center"
        />
        
        {/* TTS Generated Badge */}
        {isTTSGenerated && (
          <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-md text-xs font-medium flex items-center space-x-1 shadow-md">
            <Mic size={10} />
            <span>TTS</span>
          </div>
        )}
        
        {/* Selection checkbox */}
        {isSelectionMode && (
          <div 
            className={`absolute w-6 h-6 rounded bg-white/90 border-2 border-gray-300 flex items-center justify-center cursor-pointer transition-colors hover:bg-white ${
              isTTSGenerated ? 'top-2 right-12' : 'top-2 left-2'
            }`}
            onClick={handleCheckboxClick}
          >
            {isSelected && (
              <div className="w-3 h-3 bg-blue-500 rounded-sm flex items-center justify-center">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            )}
          </div>
        )}
        
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-600">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <button
          onClick={handlePlayPause}
          className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full bg-green-500/90 backdrop-blur-sm hover:bg-green-500 text-white transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-105 shadow-lg"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 truncate">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 text-xs mb-2 truncate">
          {author}
        </p>
        
        <div className="flex items-center justify-between">
          {duration && (
            <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
              <Clock size={12} className="mr-1" />
              {formatDuration(duration)}
            </div>
          )}
          {!duration && <div></div>} {/* Spacer when no duration */}
          
          <div className="relative">
            <button 
              ref={buttonRef}
              onClick={handleMoreClick}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
              title="More options"
            >
              <MoreVertical size={14} />
            </button>
              
              {showContextMenu && (
                <div 
                  ref={contextMenuRef}
                  className="absolute w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-[9999]"
                  style={{ 
                    ...menuPosition, 
                    marginTop: menuPosition.top ? '4px' : undefined, 
                    marginBottom: menuPosition.bottom ? '4px' : undefined,
                    marginLeft: menuPosition.left ? '4px' : undefined,
                    marginRight: menuPosition.right ? '4px' : undefined
                  }}
                >
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    Add to Collection
                  </div>
                  {collections.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      No collections available
                    </div>
                  ) : (
                    collections.map(collection => (
                      <button
                        key={collection.id}
                        onClick={() => handleAddToCollection(collection.id)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: collection.color }}
                        />
                        <span>{collection.name}</span>
                      </button>
                    ))
                  )}
                  
                  {/* Delete Section */}
                  <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                    <button
                      onClick={handleDelete}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center space-x-2"
                    >
                      <Trash2 size={14} />
                      <span>Delete from Library</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
    
    {/* Backdrop for menu */}
    {showContextMenu && (
      <div 
        className="fixed inset-0 z-[90]" 
        onClick={() => setShowContextMenu(false)}
      />
    )}
  </>
  );
};