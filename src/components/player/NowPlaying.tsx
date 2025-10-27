import React, { useEffect, useState } from 'react';
import { BookOpen, Heart, Share2, MoreVertical, Clock, Play, Pause } from 'lucide-react';
import { useAudioStore } from '../../store';

interface NowPlayingProps {
  audiobook?: {
    id: string;
    title: string;
    author: string;
    narrator?: string;
    coverUrl?: string;
    genre?: string;
    duration?: number;
    progress?: number;
  };
  currentChapter?: {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
    duration: number;
    chapter_number?: number;
  };
  currentTime?: number;
  isLoading?: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
}

export const NowPlaying: React.FC<NowPlayingProps> = ({
  audiobook,
  currentChapter,
  currentTime = 0,
  isLoading = false,
  isPlaying: propIsPlaying,
  onPlay,
  onPause
}) => {
  const { status } = useAudioStore();
  const [isPlaying, setIsPlaying] = useState(propIsPlaying ?? status.state === 'Playing');

  // Update isPlaying state when status changes or prop changes
  useEffect(() => {
    setIsPlaying(propIsPlaying ?? status.state === 'Playing');
  }, [status.state, propIsPlaying]);

  const formatTime = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 animate-pulse">
        <div className="flex space-x-4">
          <div className="w-32 h-32 bg-gray-300 dark:bg-gray-600 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!audiobook) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-32 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <BookOpen size={48} className="mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-1">No audiobook playing</h3>
            <p className="text-sm">Select an audiobook from your library to start listening</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate progress based on current position and duration
  const currentPosition = status.position || 0;
  const duration = status.duration || audiobook.duration || 0;
  const progress = duration > 0 ? (currentPosition / duration) * 100 : 0;

  return (
    <div className="bg-white/80 dark:bg-surface-800 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-surface-800/50 overflow-hidden relative group">      
      {/* Main Content - More Compact */}
      <div className="p-4 relative z-10">
        <div className="flex items-center space-x-4">
          {/* Smaller Cover Art */}
          <div className="flex-shrink-0 relative group/cover">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-400/20 via-accent-emerald-400/20 to-primary-400/20 rounded-lg opacity-0 group-hover/cover:opacity-100 blur transition-all duration-300" />
            {audiobook.coverUrl ? (
              <div className="relative">
                <img
                  src={audiobook.coverUrl}
                  alt={audiobook.title}
                  className="w-16 h-16 object-cover rounded-lg shadow-lg ring-1 ring-white/10 relative z-10 group-hover/cover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-lg" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 via-accent-emerald-500 to-primary-600 rounded-lg flex items-center justify-center shadow-lg ring-1 ring-white/10 relative z-10 group-hover/cover:scale-105 transition-transform duration-300">
                <span className="text-white font-bold text-lg drop-shadow-lg">
                  {audiobook.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Book Info - More Compact */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate mb-1">
                  {audiobook.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 truncate">
                  by <span className="text-primary-600 dark:text-primary-400 font-medium">{audiobook.author}</span>
                </p>
                
                {/* Inline Metadata */}
                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                  {audiobook.genre && (
                    <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                      {audiobook.genre}
                    </span>
                  )}
                  {duration > 0 && (
                    <div className="flex items-center space-x-1">
                      <Clock size={12} className="text-accent-emerald-500" />
                      <span className="font-medium">{formatTime(duration)}</span>
                    </div>
                  )}
                  {progress > 0 && (
                    <span className="font-bold text-primary-600 dark:text-primary-400">{Math.round(progress)}% complete</span>
                  )}
                </div>

                {/* Mini Progress Bar */}
                {progress > 0 && (
                  <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-accent-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Compact Action Buttons */}
              <div className="flex items-center space-x-2 ml-4">
                {/* Main Play/Pause Button */}
                {(onPlay || onPause) && (
                  <button 
                    onClick={isPlaying ? onPause : onPlay}
                    className="w-10 h-10 bg-gradient-to-r from-primary-500 to-accent-emerald-500 hover:from-primary-600 hover:to-accent-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                    disabled={!onPlay && !onPause}
                  >
                    {isPlaying ? (
                      <Pause size={16} />
                    ) : (
                      <Play size={16} className="ml-0.5" />
                    )}
                  </button>
                )}

                {/* Secondary Actions - Smaller */}
                <button className="w-8 h-8 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-700/80 text-gray-600 dark:text-gray-300 hover:text-accent-rose-600 dark:hover:text-accent-rose-400 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border border-white/20 dark:border-gray-700/50">
                  <Heart size={14} />
                </button>
                <button className="w-8 h-8 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-700/80 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border border-white/20 dark:border-gray-700/50">
                  <MoreVertical size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* More Compact Current Chapter Section */}
        {currentChapter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
                <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                  <span className="font-medium text-gray-900 dark:text-white">Chapter {currentChapter.chapter_number || ''}</span>: {currentChapter.title}
                </p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                  {formatTime(Math.max(0, currentChapter.duration - currentTime))} left
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};