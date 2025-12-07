import React from 'react';
import { BookmarkPlus, Trash2 } from 'lucide-react';
import { useReaderStore } from '../../store/reader';

export const BookmarkPanel: React.FC = () => {
  const { bookmarks, currentPage, currentCFI, addBookmark, deleteBookmark, setCurrentPage, setCurrentCFI } = useReaderStore();

  const handleAddBookmark = async () => {
    try {
      await addBookmark({
        page_number: currentPage,
        cfi: currentCFI || undefined,
        note: '',
      });
    } catch (error) {
      console.error('Failed to add bookmark:', error);
    }
  };

  const handleGoToBookmark = (bookmark: any) => {
    if (bookmark.page_number) {
      setCurrentPage(bookmark.page_number);
    }
    if (bookmark.cfi) {
      setCurrentCFI(bookmark.cfi);
    }
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Bookmarks</h3>
          <button
            onClick={handleAddBookmark}
            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            aria-label="Add bookmark"
          >
            <BookmarkPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {bookmarks.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No bookmarks yet</p>
        ) : (
          bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              onClick={() => handleGoToBookmark(bookmark)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Page {bookmark.page_number || 'N/A'}
                  </div>
                  {bookmark.chapter_title && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {bookmark.chapter_title}
                    </div>
                  )}
                  {bookmark.note && (
                    <div className="text-xs text-gray-700 dark:text-gray-300 mt-2">
                      {bookmark.note}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBookmark(bookmark.id);
                  }}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                  aria-label="Delete bookmark"
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
