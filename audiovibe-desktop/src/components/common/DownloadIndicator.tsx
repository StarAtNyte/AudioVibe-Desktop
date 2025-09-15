import React from 'react';
import { ArrowDownTrayIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useDownloadsStore } from '../../store';

interface DownloadIndicatorProps {
  onNavigateToDownloads?: () => void;
}

export const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({ 
  onNavigateToDownloads 
}) => {
  const { downloads, getActiveDownloads, getTotalProgress } = useDownloadsStore();

  const activeDownloads = getActiveDownloads();
  const hasActiveDownloads = activeDownloads.length > 0;
  const hasAnyDownloads = downloads.length > 0;

  // Don't show if no downloads at all
  if (!hasAnyDownloads) return null;

  const totalProgress = getTotalProgress();
  const completedDownloads = downloads.filter(d => d.status === 'completed').length;
  const failedDownloads = downloads.filter(d => d.status === 'failed').length;

  const getIndicatorContent = () => {
    if (hasActiveDownloads) {
      return (
        <>
          <ArrowDownTrayIcon className="w-4 h-4 animate-bounce" />
          <span className="text-xs font-medium">
            {activeDownloads.length} downloading
          </span>
          {totalProgress > 0 && (
            <div className="w-6 h-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-300" 
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          )}
        </>
      );
    }

    // Show summary when no active downloads
    return (
      <>
        <div className="flex items-center space-x-1">
          {completedDownloads > 0 && (
            <>
              <CheckCircleIcon className="w-3 h-3 text-green-400" />
              <span className="text-xs">{completedDownloads}</span>
            </>
          )}
          {failedDownloads > 0 && (
            <>
              <XCircleIcon className="w-3 h-3 text-red-400" />
              <span className="text-xs">{failedDownloads}</span>
            </>
          )}
        </div>
        <span className="text-xs font-medium">Downloads</span>
      </>
    );
  };

  const getIndicatorColor = () => {
    if (hasActiveDownloads) {
      return 'bg-blue-500 hover:bg-blue-600';
    }
    if (failedDownloads > 0) {
      return 'bg-red-500 hover:bg-red-600';
    }
    return 'bg-green-500 hover:bg-green-600';
  };

  return (
    <button
      onClick={onNavigateToDownloads}
      className={`fixed bottom-4 right-4 z-50 ${getIndicatorColor()} text-white rounded-full px-4 py-2 shadow-lg transition-all duration-200 hover:shadow-xl flex items-center space-x-2 max-w-xs`}
      title="View Downloads"
    >
      {getIndicatorContent()}
    </button>
  );
};