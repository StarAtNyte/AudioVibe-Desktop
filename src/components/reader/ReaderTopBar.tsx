import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Settings, Maximize, Minimize, BookmarkPlus, List } from 'lucide-react';
import { useReaderStore } from '../../store/reader';
import { ReaderSettings } from './ReaderSettings';

export const ReaderTopBar: React.FC = () => {
  const navigate = useNavigate();
  const { currentEbook, isFullscreen, toggleFullscreen, toggleTOC, toggleBookmarks } = useReaderStore();
  const [showSettings, setShowSettings] = useState(false);

  const handleClose = () => {
    if (isFullscreen) {
      toggleFullscreen();
    }
    navigate('/ebooks');
  };

  if (!currentEbook) return null;

  return (
    <>
      <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close reader"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>

          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-md">
              {currentEbook.title}
            </h1>
            {currentEbook.author && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentEbook.author}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTOC}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Table of contents"
          >
            <List className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>

          <button
            onClick={toggleBookmarks}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Bookmarks"
          >
            <BookmarkPlus className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            ) : (
              <Maximize className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            )}
          </button>
        </div>
      </div>

      {showSettings && <ReaderSettings onClose={() => setShowSettings(false)} />}
    </>
  );
};
