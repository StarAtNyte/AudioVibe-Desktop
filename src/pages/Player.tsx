import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChapterNavigation } from '../components/player';
import { useAudioStore, useLibraryStore } from '../store';
import { Play, Pause } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const Player: React.FC = () => {
  const navigate = useNavigate();
  const {
    status,
    currentAudiobookId,
    play,
    pause,
    seek,
    getStatus,
    stopProgressUpdates,
    chapters,
    currentChapterId: storeCurrentChapterId,
    setCurrentChapterId: setStoreCurrentChapterId,
    loadChaptersForAudiobook
  } = useAudioStore();

  const { audiobooks, fetchAudiobooks } = useLibraryStore();

  const [lastManualChapterSelection, setLastManualChapterSelection] = useState<number>(0);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Extract values from status
  const isPlaying = status.state === 'Playing';
  const currentTime = status.position || 0;
  const duration = status.duration || 0;

  // Cleanup progress updates on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      stopProgressUpdates();
    };
  }, []); // Empty deps - only run on mount/unmount

  // Get current audiobook from library
  const currentAudiobook = currentAudiobookId ? audiobooks.find(book => book.id === currentAudiobookId) : null;

  // Mark initial load as complete once we have audiobooks
  useEffect(() => {
    if (audiobooks.length > 0) {
      setIsInitialLoad(false);
    }
  }, [audiobooks.length]);
  
  // Refetch audiobooks if we have an ID but no matching audiobook
  // Also ensure audiobooks are loaded on mount if we have an ID
  useEffect(() => {
    if (currentAudiobookId) {
      if (!currentAudiobook) {
        console.log('Player: Loading audiobooks because audiobook not found for ID:', currentAudiobookId);
        fetchAudiobooks();
      }
    }
  }, [currentAudiobookId, currentAudiobook, fetchAudiobooks]);

  // Load chapters when audiobook changes (non-blocking)
  useEffect(() => {
    if (currentAudiobookId && chapters.length === 0) {
      setIsLoadingChapters(true);
      // Load chapters in background, don't block UI
      loadChaptersForAudiobook(currentAudiobookId)
        .catch(error => {
          console.warn('Failed to load chapters:', error);
        })
        .finally(() => {
          setIsLoadingChapters(false);
        });
    } else if (chapters.length > 0) {
      setIsLoadingChapters(false);
    }
  }, [currentAudiobookId, loadChaptersForAudiobook, chapters.length]);

  // Chapter initialization is now handled by the audio store

  const formatTime = (seconds: number): string => {
    if (!seconds || seconds === 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handlePlay = async () => {
    try {
      await play();
      console.log('Player: Play started successfully');
    } catch (error) {
      console.error('Player: Play failed:', error);
    }
  };

  const handlePause = async () => {
    try {
      await pause();
      console.log('Player: Paused successfully');
    } catch (error) {
      console.error('Player: Pause failed:', error);
    }
  };

  const handleSeek = async (timeInSeconds: number) => {
    try {
      console.log(`Player: Seeking to ${timeInSeconds} seconds`);
      await seek(timeInSeconds);
      
      // Force status update after seek
      setTimeout(async () => {
        await getStatus();
      }, 100);
    } catch (error) {
      console.error('Player: Seek failed:', error);
    }
  };

  const handleChapterSelect = async (chapter: any) => {
    console.log('🎵 Player: Chapter selected:', chapter.title, 'ID:', chapter.id);
    
    // Mark this as a manual selection with timestamp
    const now = Date.now();
    setLastManualChapterSelection(now);
    
    // Update the current chapter ID immediately
    setStoreCurrentChapterId(chapter.id);
    
    // Force immediate status update to reflect the new chapter file
    try {
      console.log('Player: Forcing status update after chapter selection');
      await getStatus();
      
      // Additional delay and second status check to ensure the new file is loaded
      setTimeout(async () => {
        await getStatus();
        console.log('🎵 Player: Second status update completed');
      }, 500);
    } catch (error) {
      console.warn('Player: Failed to update status after chapter selection:', error);
    }
  };

  // Show loading state in these cases:
  // 1. Initial load and we're still fetching audiobooks
  // 2. We have an audiobook ID but haven't found the audiobook data yet
  // 3. We have both ID and audiobook, but chapters are still loading (and array is empty)
  const shouldShowLoading =
    (currentAudiobookId && isInitialLoad) ||
    (currentAudiobookId && !currentAudiobook) ||
    (currentAudiobookId && currentAudiobook && isLoadingChapters && chapters.length === 0);

  if (shouldShowLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-500 dark:text-gray-400">
        <div className="w-20 h-20 relative mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
          <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
        </div>
        <h3 className="text-xl font-medium mb-2 text-gray-700 dark:text-gray-300">
          {!currentAudiobook ? 'Loading audiobook...' : 'Loading chapters...'}
        </h3>
        <p className="text-center text-gray-500 dark:text-gray-400">
          {!currentAudiobook ? 'Please wait while we load your audiobook' : 'Preparing your listening experience'}
        </p>
      </div>
    );
  }

  // Show no audiobook state if no current audiobook and no ID
  if (!currentAudiobook && !currentAudiobookId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200/50 dark:border-gray-700/50">
            <div className="text-6xl mb-6">🎵</div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              No audiobook selected
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Choose an audiobook from your library to start listening
            </p>
            <button
              onClick={() => navigate('/library')}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-medium transition-colors shadow-lg hover:shadow-xl"
            >
              Browse Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Spotify-like layout with multiple sections
  return (
    <div className="flex flex-col h-full overflow-y-auto pb-4 scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950 px-8 py-8 shadow-xl">
        <div className="flex items-end space-x-8 max-w-none">
          {currentAudiobook && (
            <>
              {currentAudiobook.cover_image_path ? (
                <img
                  src={currentAudiobook.cover_image_path}
                  alt={currentAudiobook.title}
                  className="w-60 h-60 object-cover rounded-lg shadow-2xl"
                />
              ) : (
                <div className="w-60 h-60 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg shadow-2xl flex items-center justify-center">
                  <span className="text-white font-bold text-6xl">
                    {currentAudiobook.title.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              <div className="flex-1 text-white pb-4">
                <p className="text-xs font-medium uppercase tracking-wider mb-3 text-gray-400">Audiobook</p>
                <h1 className="text-4xl font-bold mb-4 leading-tight">
                  {currentAudiobook.title}
                </h1>
                <p className="text-lg text-gray-300 mb-4">
                  by <span className="font-medium">{currentAudiobook.author}</span>
                </p>
                <div className="flex items-center space-x-4 text-sm text-gray-400 mb-6">
                  <span>{chapters.length} chapters</span>
                  <span>•</span>
                  <span>{formatTime(duration)} total</span>
                </div>
                
                {/* Play/Pause Button */}
                <button
                  onClick={isPlaying ? handlePause : handlePlay}
                  className="w-14 h-14 bg-white hover:bg-gray-200 text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 transform transition-all duration-200"
                >
                  {isPlaying ? (
                    <Pause size={24} />
                  ) : (
                    <Play size={24} className="ml-1" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>


      {/* Chapter Navigation - Separated from Hero */}
      <div className="relative bg-gradient-to-br from-gray-800 via-slate-900 to-gray-950 px-8 py-8 shadow-xl mt-4">
        <ChapterNavigation
          audiobookId={currentAudiobook?.id || ''}
          currentChapterId={storeCurrentChapterId || undefined}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onChapterSelect={handleChapterSelect}
          onSeek={handleSeek}
          onPlay={handlePlay}
          onPause={handlePause}
        />
      </div>

      {/* Content Sections */}
      <div className="space-y-8 mt-8">

        {/* Recently Played Section */}
        <div className="px-8">
          <h2 className="text-2xl font-bold text-white mb-6">Recently Played</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {audiobooks.slice(0, 5).map((book) => (
              <div 
                key={book.id}
                className="bg-gray-900/40 p-4 rounded-lg hover:bg-gray-800/60 transition-all duration-200 cursor-pointer group backdrop-blur-sm"
                onClick={() => navigate(`/audiobook/${book.id}`)}
              >
                {book.cover_image_path ? (
                  <img
                    src={book.cover_image_path}
                    alt={book.title}
                    className="w-full aspect-square object-cover rounded-md mb-4 shadow-lg group-hover:shadow-xl transition-shadow"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gradient-to-br from-gray-600 to-gray-800 rounded-md mb-4 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xl">
                      {book.title.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <h3 className="text-white font-medium text-sm mb-1 truncate">{book.title}</h3>
                <p className="text-gray-400 text-xs truncate">{book.author}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Access */}
        <div className="px-8">
          <h2 className="text-2xl font-bold text-white mb-6">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              className="bg-gray-900/40 p-6 rounded-lg hover:bg-gray-800/60 transition-all duration-200 cursor-pointer backdrop-blur-sm"
              onClick={() => navigate('/library')}
            >
              <h3 className="text-white font-semibold text-lg mb-2">Your Library</h3>
              <p className="text-gray-400 text-sm">Browse all your audiobooks</p>
            </div>
            <div 
              className="bg-gray-900/40 p-6 rounded-lg hover:bg-gray-800/60 transition-all duration-200 cursor-pointer backdrop-blur-sm"
              onClick={() => navigate('/downloads')}
            >
              <h3 className="text-white font-semibold text-lg mb-2">Downloads</h3>
              <p className="text-gray-400 text-sm">Manage your downloads</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};