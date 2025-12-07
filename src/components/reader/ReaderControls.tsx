import React from 'react';
import { ChevronLeft, ChevronRight, Book } from 'lucide-react';
import { useReaderStore } from '../../store/reader';

export const ReaderControls: React.FC = () => {
  const { currentEbook, currentPage, totalPages, setCurrentPage, saveProgress } = useReaderStore();

  if (!currentEbook) return null;

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      saveProgress();
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      saveProgress();
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      saveProgress();
    }
  };

  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-t border-gray-700/50 backdrop-blur-sm">
      {/* Progress bar */}
      <div className="h-1 bg-gray-700/50 relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out shadow-lg shadow-blue-500/50"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-6 py-4">
        {/* Previous button */}
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 hover:border-gray-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-800/50 disabled:hover:border-gray-700/50"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
          <span className="text-sm text-gray-300 group-hover:text-blue-400 transition-colors hidden sm:inline">
            Previous
          </span>
        </button>

        {/* Page indicator */}
        <div className="flex items-center gap-3 px-6 py-2 rounded-xl bg-gradient-to-r from-gray-800/80 to-gray-800/60 border border-gray-700/50 backdrop-blur-sm">
          <Book className="w-4 h-4 text-blue-400" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 font-medium">Page</span>
            <input
              type="number"
              value={currentPage || ''}
              onChange={handlePageInput}
              min={1}
              max={totalPages}
              className="w-14 px-2 py-1 text-center border border-gray-600/50 rounded-lg bg-gray-900/50 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-sm text-gray-400 font-medium">of</span>
            <span className="text-sm text-blue-400 font-semibold min-w-[2rem] text-center">
              {totalPages || '—'}
            </span>
          </div>
          {totalPages > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              ({Math.round(progress)}%)
            </span>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={handleNextPage}
          disabled={currentPage >= totalPages}
          className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 hover:border-gray-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-800/50 disabled:hover:border-gray-700/50"
          aria-label="Next page"
        >
          <span className="text-sm text-gray-300 group-hover:text-blue-400 transition-colors hidden sm:inline">
            Next
          </span>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
        </button>
      </div>
    </div>
  );
};
