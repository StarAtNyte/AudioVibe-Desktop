import React, { useState, useEffect } from 'react';
import { 
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { BookCover } from '../components/common/BookCover';
import { useDownloadsStore, type DownloadItem } from '../store/downloads';

export const Downloads: React.FC = () => {
  const { 
    downloads, 
    getActiveDownloads, 
    getCompletedDownloads, 
    getFailedDownloads,
    removeDownload,
    clearCompleted,
    retryDownload,
    cancelDownload
  } = useDownloadsStore();

  const [filter, setFilter] = useState<'all' | 'downloading' | 'completed' | 'failed'>('all');

  const getStatusIcon = (status: DownloadItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'downloading':
        return <ArrowDownTrayIcon className="w-5 h-5 text-blue-500 animate-bounce" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'cancelled':
        return <PauseIcon className="w-5 h-5 text-yellow-500" />;
      case 'pending':
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: DownloadItem['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'downloading':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      case 'cancelled':
        return 'text-yellow-600';
      case 'pending':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getProgressBarColor = (status: DownloadItem['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'downloading':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const filteredDownloads = downloads.filter(download => {
    if (filter === 'all') return true;
    return download.status === filter;
  });

  const handleRetry = (id: string) => {
    retryDownload(id);
  };

  const handleCancel = (id: string) => {
    cancelDownload(id);
  };

  const handleRemove = (id: string) => {
    removeDownload(id);
  };

  const handleClearCompleted = () => {
    clearCompleted();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const activeDownloads = getActiveDownloads();
  const completedDownloads = getCompletedDownloads();
  const failedDownloads = getFailedDownloads();
  
  const downloadingCount = activeDownloads.length;
  const completedCount = completedDownloads.length;
  const failedCount = failedDownloads.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Downloads
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your audiobook downloads and transfers
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <ArrowDownTrayIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{downloadingCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{completedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                <XCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{failedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{downloads.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs and Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex space-x-1">
                {['all', 'downloading', 'completed', 'failed'].map((filterType) => (
                  <button
                    key={filterType}
                    onClick={() => setFilter(filterType as any)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      filter === filterType
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                    {filterType === 'all' && ` (${downloads.length})`}
                    {filterType === 'downloading' && downloadingCount > 0 && ` (${downloadingCount})`}
                    {filterType === 'completed' && completedCount > 0 && ` (${completedCount})`}
                    {filterType === 'failed' && failedCount > 0 && ` (${failedCount})`}
                  </button>
                ))}
              </div>

              {completedCount > 0 && (
                <button
                  onClick={handleClearCompleted}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Clear Completed
                </button>
              )}
            </div>
          </div>

          {/* Downloads List */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredDownloads.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <ArrowDownTrayIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No downloads found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {filter === 'all' 
                    ? "Your downloads will appear here when you add audiobooks to your library."
                    : `No ${filter} downloads at the moment.`
                  }
                </p>
              </div>
            ) : (
              filteredDownloads.map((download) => (
                <div key={download.id} className="px-6 py-6">
                  <div className="flex items-start space-x-4">
                    {/* Cover Image */}
                    <div className="flex-shrink-0 w-16 h-16">
                      <BookCover 
                        bookId={download.id}
                        title={download.title}
                        coverUrl={download.coverUrl}
                        className="w-full h-full object-cover rounded-lg"
                        fallbackClassName="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center"
                      />
                    </div>

                    {/* Download Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                            {download.title}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {download.author}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {getStatusIcon(download.status)}
                          <span className={`text-sm font-medium ${getStatusColor(download.status)}`}>
                            {download.status.charAt(0).toUpperCase() + download.status.slice(1)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {download.progress > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                            <span>
                              {download.totalBytes > 0
                                ? `${formatBytes(download.downloadedBytes)} of ${formatBytes(download.totalBytes)}`
                                : `${download.progress}%`
                              }
                            </span>
                            {download.downloadSpeed && download.estimatedTimeRemaining && (
                              <span>{formatSpeed(download.downloadSpeed)} • {formatTime(download.estimatedTimeRemaining)} remaining</span>
                            )}
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(download.status)}`}
                              style={{ width: `${download.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {download.error && (
                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-sm text-red-800 dark:text-red-400">{download.error}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {download.status === 'downloading' && (
                        <button
                          onClick={() => handleCancel(download.id)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Cancel download"
                        >
                          <PauseIcon className="w-5 h-5" />
                        </button>
                      )}
                      {download.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(download.id)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Retry download"
                        >
                          <PlayIcon className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(download.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove download"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};