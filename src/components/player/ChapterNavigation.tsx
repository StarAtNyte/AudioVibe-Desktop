import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  List, 
  ChevronUp, 
  ChevronDown, 
  Play, 
  Pause,
  Clock,
  Check,
  RefreshCw
} from 'lucide-react';
import { Chapter, ChapterWithProgress } from '../../types/audiobook';
import { useAudioStore } from '../../store';

interface ChapterNavigationProps {
  audiobookId: string;
  currentChapterId?: string;
  currentTime: number;
  isPlaying: boolean;
  onChapterSelect: (chapter: ChapterWithProgress) => void;
  onSeek?: (time: number) => void;
  isCollapsed?: boolean;
  onChaptersLoad?: (chapters: ChapterWithProgress[]) => void;
  onPlay?: () => void;
  onPause?: () => void;
}

export const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  audiobookId,
  currentChapterId,
  currentTime,
  isPlaying,
  onChapterSelect,
  onSeek,
  isCollapsed = false,
  onChaptersLoad,
  onPlay,
  onPause
}) => {
  const [isExpanded, setIsExpanded] = useState(!isCollapsed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getStatus, startProgressUpdates, chapters: storeChapters, loadChaptersForAudiobook, status } = useAudioStore();
  
  // Convert store chapters to ChapterWithProgress format
  const chapters: ChapterWithProgress[] = storeChapters.map(chapter => {
    // For the current chapter, use the actual playing duration from status
    // For other chapters, use database duration or 0
    const isCurrentChapter = chapter.id === currentChapterId;
    const actualDuration = isCurrentChapter && status.duration ? status.duration : (chapter.duration || 0);
    
    console.log('Chapter data:', {
      id: chapter.id,
      title: chapter.title,
      duration: actualDuration,
      isCurrentChapter,
      statusDuration: status.duration,
      dbDuration: chapter.duration,
      chapter_number: chapter.chapter_number
    });
    
    return {
      id: chapter.id,
      title: chapter.title || `Chapter ${chapter.chapter_number}`,
      startTime: 0, // File-based chapters always start at 0
      endTime: actualDuration,
      duration: actualDuration,
      file_path: chapter.file_path,
      chapter_number: chapter.chapter_number,
    };
  });
  
  // Add the missing refreshChapters function using store
  const refreshChapters = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadChaptersForAudiobook(audiobookId);
    } catch (err) {
      console.error('Error refreshing chapters:', err);
      setError('Failed to refresh chapters');
    } finally {
      setLoading(false);
    }
  };

  // Debug logging for props
  useEffect(() => {
    console.log('ChapterNavigation: Props updated:', {
      audiobookId,
      currentChapterId,
      isPlaying,
      chaptersLoaded: chapters.length,
      statusDuration: status.duration,
      chapters: chapters.map(ch => ({ id: ch.id, title: ch.title, duration: ch.duration }))
    });
  }, [audiobookId, currentChapterId, isPlaying, chapters.length, status.duration]);
  
  // Log when currentChapterId specifically changes
  useEffect(() => {
    if (currentChapterId) {
      console.log('ChapterNavigation: Current chapter ID changed to:', currentChapterId);
      const currentChapter = chapters.find(ch => ch.id === currentChapterId);
      if (currentChapter) {
        console.log('ChapterNavigation: Found current chapter:', currentChapter);
      } else {
        console.log('ChapterNavigation: Current chapter not found in chapters list');
      }
    }
  }, [currentChapterId, chapters]);

  // Load chapters when audiobookId changes if not already loaded
  useEffect(() => {
    if (audiobookId && chapters.length === 0) {
      console.log('📚 ChapterNavigation: Triggering chapter load for:', audiobookId);
      loadChaptersForAudiobook(audiobookId);
    }
  }, [audiobookId, loadChaptersForAudiobook]);

  // Set loading state based on store chapters
  useEffect(() => {
    if (chapters.length > 0) {
      console.log('✅ ChapterNavigation: Chapters loaded, hiding spinner');
      setLoading(false);
      setError(null);
    } else if (audiobookId) {
      // Don't stay in loading state forever - set a timeout
      console.log('⏳ ChapterNavigation: Waiting for chapters to load...');
      setLoading(true);
      const timeoutId = setTimeout(() => {
        if (chapters.length === 0) {
          console.warn('⚠️ Chapters taking too long to load, stopping spinner');
          setLoading(false);
          setError('Chapters took too long to load. Try refreshing.');
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeoutId);
    } else {
      setLoading(false);
    }
  }, [chapters.length, audiobookId]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number, chapterId: string): string => {
    if (!seconds || seconds <= 0) {
      // For the current chapter, show it's loading duration
      if (chapterId === currentChapterId) {
        return 'Loading...';
      }
      // For other chapters, show a dash to indicate we don't have the duration yet
      return '--:--';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getCurrentChapter = (): ChapterWithProgress | undefined => {
    // For file-based chapters, the current chapter is determined by the currentChapterId
    return chapters.find(chapter => chapter.id === currentChapterId);
  };

  const getChapterProgress = (chapter: ChapterWithProgress): number => {
    // For file-based chapters, we only show progress for the currently playing chapter
    if (chapter.id !== currentChapterId) return 0;
    
    if (chapter.duration > 0) {
      const progress = (currentTime / chapter.duration) * 100;
      return Math.max(0, Math.min(100, progress));
    }
    return 0;
  };

  const isChapterCompleted = (chapter: ChapterWithProgress): boolean => {
    // A chapter is completed if it's not the current chapter and we've moved past it
    const currentIndex = chapters.findIndex(ch => ch.id === currentChapterId);
    const chapterIndex = chapters.findIndex(ch => ch.id === chapter.id);
    return chapterIndex >= 0 && currentIndex >= 0 && chapterIndex < currentIndex;
  };

  const isChapterCurrent = (chapter: ChapterWithProgress): boolean => {
    return chapter.id === currentChapterId;
  };

  // Handle chapter selection by calling the backend play_chapter command
  const handleChapterSelect = async (chapter: ChapterWithProgress) => {
    try {
      console.log('🎵 Switching to chapter:', chapter.title, 'ID:', chapter.id);
      
      // Notify parent component about the chapter change FIRST
      // This ensures the currentChapterId is updated before we continue
      onChapterSelect(chapter);
      console.log('🔄 Notified parent of chapter change');
      
      const playedChapter = await invoke<Chapter>('play_chapter', { chapterId: chapter.id });
      console.log('✅ Chapter switched successfully:', playedChapter.title);
      
      // Force immediate status update to reflect new file
      console.log('🔄 Forcing status update after chapter switch');
      await new Promise(resolve => setTimeout(resolve, 300)); // Allow backend to stabilize
      await getStatus(); // Force status update
      
      // Restart progress updates to ensure smooth playback tracking
      startProgressUpdates();
      
      console.log('✅ Chapter switch completed with status update');
    } catch (error) {
      console.error('Failed to play chapter:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <List size={24} className="mx-auto mb-2 animate-spin" />
          <p className="text-sm">Loading chapters...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center text-red-500 dark:text-red-400">
          <List size={24} className="mx-auto mb-2" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <List size={24} className="mx-auto mb-2" />
          <p className="text-sm">No chapters available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/40 backdrop-blur-sm rounded-lg shadow-lg border border-gray-800/50 overflow-hidden">
      {/* Compact Header */}
      <div 
        className="flex items-center justify-between p-4 border-b border-gray-800/30 cursor-pointer hover:bg-gray-800/60 backdrop-blur-sm transition-all duration-300"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg flex items-center justify-center shadow-lg">
            <List size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">
              Chapters
            </h3>
            <p className="text-xs text-gray-400">
              {chapters.length} total
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {getCurrentChapter() && (
            <div className="text-right max-w-32">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                {getCurrentChapter()?.title}
              </p>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              refreshChapters();
            }}
            className="w-6 h-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-lg flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border border-white/20 dark:border-gray-700/30"
            title="Refresh chapters"
          >
            <RefreshCw size={14} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button className="w-6 h-6 bg-primary-500 hover:bg-primary-600 rounded-lg flex items-center justify-center shadow-lg transform hover:scale-105 transition-all duration-300">
            {isExpanded ? (
              <ChevronUp size={14} className="text-white" />
            ) : (
              <ChevronDown size={14} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Compact Chapter List */}
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
          {chapters.map((chapter, index) => {
            const isCurrent = isChapterCurrent(chapter);
            const isCompleted = isChapterCompleted(chapter);
            const progress = getChapterProgress(chapter);

            return (
              <div
                key={chapter.id}
                className={`relative border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-all duration-200 ${
                  isCurrent 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div 
                  className={`flex items-center p-3 cursor-pointer ${
                    isCurrent ? 'pl-2' : ''
                  }`}
                  onClick={() => handleChapterSelect(chapter)}
                >
                  {/* Compact Chapter Number/Status */}
                  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mr-3">
                    {isCompleted ? (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    ) : isCurrent ? (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isCurrent) {
                              if (isPlaying && onPause) {
                                onPause();
                              } else if (!isPlaying && onPlay) {
                                onPlay();
                              }
                            } else {
                              handleChapterSelect(chapter);
                            }
                          }}
                          className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg"
                        >
                          {isCurrent && isPlaying ? (
                            <Pause size={10} className="text-white" />
                          ) : (
                            <Play size={10} className="text-white ml-0.5" />
                          )}
                        </button>
                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                      </div>
                    ) : (
                      <span className={`text-xs font-medium ${
                        isCurrent 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {chapter.chapter_number}
                      </span>
                    )}
                  </div>

                  {/* Compact Chapter Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className={`font-medium text-sm truncate ${
                        isCurrent 
                          ? 'text-blue-900 dark:text-blue-200' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {chapter.title}
                      </h4>
                      {isCurrent && (
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Clock size={10} />
                        <span>{formatDuration(chapter.duration, chapter.id)}</span>
                      </div>
                      {isCurrent && (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {formatTime(currentTime)} / {formatTime(chapter.duration)}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {isCurrent && progress > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                          <div
                            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Status Indicator */}
                  <div className="flex-shrink-0 ml-2">
                    {isCurrent && isPlaying ? (
                      <div className="flex items-center space-x-1">
                        <div className="flex space-x-0.5">
                          <div className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    ) : isCurrent ? (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Navigation */}
      {isExpanded && chapters.length > 3 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Quick Jump:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  const firstChapter = chapters[0];
                  if (firstChapter) handleChapterSelect(firstChapter);
                }}
                className="px-2 py-1 text-xs bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                First
              </button>
              <button
                onClick={() => {
                  const currentChapter = getCurrentChapter();
                  if (currentChapter) {
                    const currentIndex = chapters.findIndex(ch => ch.id === currentChapter.id);
                    const prevChapter = chapters[currentIndex - 1];
                    if (prevChapter) handleChapterSelect(prevChapter);
                  }
                }}
                disabled={!getCurrentChapter() || chapters.findIndex(ch => ch.id === getCurrentChapter()?.id) === 0}
                className="px-2 py-1 text-xs bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              <button
                onClick={() => {
                  const currentChapter = getCurrentChapter();
                  if (currentChapter) {
                    const currentIndex = chapters.findIndex(ch => ch.id === currentChapter.id);
                    const nextChapter = chapters[currentIndex + 1];
                    if (nextChapter) handleChapterSelect(nextChapter);
                  }
                }}
                disabled={!getCurrentChapter() || chapters.findIndex(ch => ch.id === getCurrentChapter()?.id) === chapters.length - 1}
                className="px-2 py-1 text-xs bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
              <button
                onClick={() => {
                  const lastChapter = chapters[chapters.length - 1];
                  if (lastChapter) handleChapterSelect(lastChapter);
                }}
                className="px-2 py-1 text-xs bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};