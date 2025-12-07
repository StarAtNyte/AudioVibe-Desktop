import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, MoreVertical, Trash2, FileText, Edit } from 'lucide-react';
import { BookCover } from '../common/BookCover';

interface EbookCardProps {
  id: string;
  title: string;
  author?: string;
  format: 'pdf' | 'epub';
  coverUrl?: string;
  progress?: number;
  totalPages?: number;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  viewMode: 'grid' | 'list';
}

export const EbookCard: React.FC<EbookCardProps> = ({
  id,
  title,
  author,
  format,
  coverUrl,
  progress = 0,
  totalPages,
  onOpen,
  onDelete,
  onEdit,
  viewMode,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{top?: string, bottom?: string, left?: string, right?: string}>({top: '100%', right: '0'});
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleCardClick = () => {
    onOpen(id);
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!showContextMenu && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const menuHeight = 80;
      const menuWidth = 144; // w-36 = 9rem = 144px

      let position: {top?: string, bottom?: string, left?: string, right?: string} = {};

      // Calculate vertical position
      if (buttonRect.bottom + menuHeight > windowHeight - 20) {
        // Position above the button
        position.bottom = `${windowHeight - buttonRect.top + 8}px`;
      } else {
        // Position below the button
        position.top = `${buttonRect.bottom + 8}px`;
      }

      // Calculate horizontal position
      if (buttonRect.right - menuWidth < 20) {
        // Align to left edge of button
        position.left = `${buttonRect.left}px`;
      } else {
        // Align to right edge of button
        position.left = `${buttonRect.right - menuWidth}px`;
      }

      setMenuPosition(position);
    }

    setShowContextMenu(!showContextMenu);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(id);
    }
    setShowContextMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
    setShowContextMenu(false);
  };

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  if (viewMode === 'list') {
    return (
      <div
        onClick={handleCardClick}
        className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all shadow-sm hover:shadow-md"
      >
        <div className="relative flex-shrink-0">
          <BookCover
            title={title}
            coverUrl={coverUrl}
            className="w-16 h-24 object-cover rounded"
          />
          {progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-600">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
          {author && <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{author}</p>}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-500 uppercase font-medium">
              {format}
            </span>
            {totalPages && (
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {totalPages} pages
              </span>
            )}
            {progress > 0 && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {Math.round(progress)}% read
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(id);
            }}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Open ebook"
          >
            <BookOpen className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>

          <div className="relative">
            <button
              ref={buttonRef}
              onClick={handleMoreClick}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="More options"
            >
              <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            {showContextMenu && createPortal(
              <div
                ref={contextMenuRef}
                className="fixed w-36 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-0.5 z-[9999]"
                style={menuPosition}
              >
                {onEdit && (
                  <button
                    onClick={handleEdit}
                    className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
                  >
                    <Edit className="w-3 h-3" />
                    Edit Details
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="relative">
      <div
        onClick={handleCardClick}
        className="group bg-white dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-lg border border-gray-200 dark:border-gray-700"
      >
        <div className="relative aspect-square">
        <BookCover
          title={title}
          coverUrl={coverUrl}
          className="w-full h-full object-cover"
        />

        {/* Format badge */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs font-medium text-white uppercase">
          {format}
        </div>

        {/* Progress bar */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200/50">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(id);
            }}
            className="p-3 bg-white/90 rounded-full hover:bg-white transition-colors"
            aria-label="Open ebook"
          >
            <BookOpen className="w-6 h-6 text-gray-900" />
          </button>
        </div>

        {/* More options button */}
        <div className="absolute top-2 right-2">
          <button
            ref={buttonRef}
            onClick={handleMoreClick}
            className="p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full transition-colors opacity-0 group-hover:opacity-100"
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4 text-white" />
          </button>
        </div>
        </div>

        <div className="p-3">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={title}>
          {title}
        </h3>
        {author && (
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1" title={author}>
            {author}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {totalPages && (
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {totalPages} pages
            </span>
          )}
          {progress > 0 && (
            <span className="text-xs text-blue-600 dark:text-blue-400">
              {Math.round(progress)}%
            </span>
          )}
        </div>
        </div>
      </div>

      {/* Context menu rendered via portal to ensure it's always on top */}
      {showContextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed w-36 bg-gray-800 rounded-md shadow-xl border border-gray-700 overflow-hidden z-[9999]"
          style={menuPosition}
        >
          <div className="py-0.5">
            {onEdit && (
              <button
                onClick={handleEdit}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-200 hover:bg-blue-500/20 transition-colors flex items-center gap-1.5"
              >
                <Edit className="w-3 h-3 text-blue-400" />
                <span>Edit Details</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-200 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
