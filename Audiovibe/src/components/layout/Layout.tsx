import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { DownloadIndicator } from '../common/DownloadIndicator';
import { LeftSidebar } from './LeftSidebar';
import { RightPanel } from './RightPanel';
import { TopBar } from './TopBar';
import { PlayerControls } from '../player/PlayerControls';
import { useAppStore, useAudioStore } from '../../store';
import { useLibraryStore } from '../../store';
import { useResponsive } from '../../hooks/useResponsive';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { invoke } from '@tauri-apps/api/core';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    theme,
    initialize,
    isInitialized,
    isLoading,
    leftSidebarOpen,
    rightPanelOpen 
  } = useAppStore();
  
  // Initialize responsive breakpoints
  const { isMobile, isTablet, isSmallDesktop, isDesktop } = useResponsive();
  const { 
    currentAudiobookId, 
    status, 
    play, 
    pause, 
    seek,
    updateVolume,
    updateSpeed,
    volume: storeVolume,
    chapters,
    currentChapterId: storeCurrentChapterId,
    skipToPreviousChapter,
    skipToNextChapter,
    loadChaptersForAudiobook
  } = useAudioStore();
  const { audiobooks } = useLibraryStore();
  const currentAudiobook = currentAudiobookId ? 
    audiobooks.find(book => book.id === currentAudiobookId) : null;

  const isPlaying = status?.state === 'Playing';
  const currentPosition = status?.position || 0;
  const duration = status?.duration || 0;
  const progress = duration > 0 ? (currentPosition / duration) * 100 : 0;
  const playbackSpeed = status?.speed || 1.0;

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onTogglePlayPause: () => {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    },
    onPlay: () => play(),
    onPause: () => pause(),
    onSeekForward: (seconds: number) => {
      const newTime = Math.min(duration, currentPosition + seconds);
      seek(newTime);
    },
    onSeekBackward: (seconds: number) => {
      const newTime = Math.max(0, currentPosition - seconds);
      seek(newTime);
    },
    onVolumeUp: () => {
      const newVolume = Math.min(1, storeVolume + 0.1);
      updateVolume(newVolume);
    },
    onVolumeDown: () => {
      const newVolume = Math.max(0, storeVolume - 0.1);
      updateVolume(newVolume);
    },
    onMute: () => {
      updateVolume(storeVolume > 0 ? 0 : 0.5);
    },
    onSpeedUp: () => {
      const newSpeed = Math.min(3, playbackSpeed + 0.25);
      updateSpeed(newSpeed);
    },
    onSpeedDown: () => {
      const newSpeed = Math.max(0.5, playbackSpeed - 0.25);
      updateSpeed(newSpeed);
    },
    onNextChapter: () => skipToNextChapter(),
    onPreviousChapter: () => skipToPreviousChapter(),
    onFocusSearch: () => {
      // Focus the search input in TopBar
      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }
  }, true); // Enable shortcuts

  // Initialize volume when component mounts
  useEffect(() => {
    if (updateVolume && storeVolume > 0) {
      updateVolume(storeVolume);
    }
  }, [updateVolume]);

  // Handler functions for PlayerControls
  const handlePlay = async () => {
    try {
      // Ensure volume is set before playing
      if (storeVolume <= 0) {
        console.log('Layout: Volume is 0, setting to 1.0');
        await updateVolume(1.0);
      }
      await play();
    } catch (error) {
      console.error('Layout: Play failed:', error);
    }
  };

  const handlePause = async () => {
    try {
      await pause();
    } catch (error) {
      console.error('Layout: Pause failed:', error);
    }
  };

  const handleSeek = async (timeInSeconds: number) => {
    try {
      await seek(timeInSeconds);
    } catch (error) {
      console.error('Layout: Seek failed:', error);
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    try {
      await updateVolume(newVolume);
    } catch (error) {
      console.error('Layout: Failed to update volume:', error);
    }
  };

  const handleSpeedChange = async (newSpeed: number) => {
    try {
      await updateSpeed(newSpeed);
    } catch (error) {
      console.error('Layout: Failed to update speed:', error);
    }
  };

  const handleSkipBack = async () => {
    await skipToPreviousChapter();
  };

  const handleSkipForward = async () => {
    await skipToNextChapter();
  };

  const handleRewind = async () => {
    console.log('Rewind clicked - rewinding 15 seconds');
    
    try {
      const currentTime = status?.position || 0;
      const newTime = Math.max(0, currentTime - 15); // Skip back 15 seconds, don't go below 0
      
      console.log(`Skipping from ${currentTime}s to ${newTime}s`);
      await seek(newTime);
      console.log('Successfully skipped back 15 seconds');
    } catch (error) {
      console.error('Failed to skip back 15 seconds:', error);
    }
  };

  const handleFastForward = async () => {
    console.log('Fast forward clicked - advancing 30 seconds');
    
    try {
      const currentTime = status?.position || 0;
      const duration = status?.duration || 0;
      const newTime = Math.min(duration, currentTime + 30); // Skip forward 30 seconds, don't exceed duration
      
      console.log(`Skipping from ${currentTime}s to ${newTime}s`);
      await seek(newTime);
      console.log('Successfully skipped forward 30 seconds');
    } catch (error) {
      console.error('Failed to skip forward 30 seconds:', error);
    }
  };

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

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme.mode]);

  // Load chapters when audiobook changes
  useEffect(() => {
    if (currentAudiobookId) {
      loadChaptersForAudiobook(currentAudiobookId);
    }
  }, [currentAudiobookId, loadChaptersForAudiobook]);

  // This effect is no longer needed as the store handles chapter initialization

  // Initialize app on mount
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize();
    }
  }, [isInitialized, isLoading, initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 dark:from-gray-950 dark:via-slate-900 dark:to-gray-900">
        {/* Top Navigation Bar */}
        <TopBar />
        
        {/* Loading Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400">Initializing AudioVibe...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50/80 to-blue-50/40 dark:from-gray-950 dark:via-slate-900 dark:to-gray-900 transition-all duration-300 relative">
      {/* Top Navigation Bar */}
      <TopBar />
      {/* Enhanced Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-64 w-96 h-96 bg-gradient-to-br from-primary-200/8 to-accent-emerald-200/8 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-64 w-128 h-128 bg-gradient-to-br from-accent-emerald-200/8 to-primary-200/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Responsive Layout - Adaptive 3-Panel to Mobile Stack */}
      <div className={`
        ${isMobile ? 'flex flex-col' : 'flex'} 
        h-screen relative z-10 
        ${isMobile ? 'gap-0' : 'gap-2'} 
        ${isMobile ? 'p-0' : 'p-2'}
      `} style={{ 
        paddingTop: isMobile ? '65px' : '65px', 
        paddingBottom: currentAudiobook ? (isMobile ? '86px' : '86px') : (isMobile ? '0px' : '6px') 
      }}>
        
        {/* Left Sidebar - Responsive: Overlay on mobile, side panel on tablet+, hidden when closed */}
        {leftSidebarOpen && (
          <>
            {isMobile && (
              <div 
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => useAppStore.getState().setLeftSidebarOpen(false)}
              />
            )}
            <div className={`
              ${isMobile 
                ? 'fixed top-16 left-0 bottom-0 z-50 w-80 transform transition-transform duration-300' 
                : isTablet 
                  ? 'w-60 flex-shrink-0' 
                  : isSmallDesktop
                    ? 'w-72 flex-shrink-0'
                    : 'w-80 flex-shrink-0'
              }
              bg-white/95 dark:bg-slate-900/90 backdrop-blur-md 
              ${isMobile ? 'rounded-r-xl' : 'rounded-xl'} 
              shadow-2xl border border-gray-200/60 dark:border-gray-600/40 overflow-hidden
            `}>
              <LeftSidebar />
            </div>
          </>
        )}
        
        {/* Main Content - Always visible, responsive padding and sizing */}
        <div className={`
          flex-1 flex flex-col overflow-hidden 
          bg-white/95 dark:bg-slate-900/90 backdrop-blur-md 
          ${isMobile ? 'rounded-none' : 'rounded-xl'} 
          shadow-2xl border border-gray-200/60 dark:border-gray-600/40
          ${isMobile && currentAudiobook ? 'mb-2' : ''}
        `}>
          <main className={`
            flex-1 overflow-auto 
            ${isMobile ? 'p-4' : isTablet ? 'p-4' : isSmallDesktop ? 'p-5' : 'p-6'} 
            scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent hover:scrollbar-thumb-gray-500
          `}>
            <div className="max-w-none">
              <Outlet />
            </div>
          </main>
        </div>
        
        {/* Right Panel - Hidden on mobile/tablet, side panel on desktop */}
        {rightPanelOpen && (isDesktop || isSmallDesktop) && (
          <div className={`${isSmallDesktop ? 'w-72' : 'w-80'} flex-shrink-0 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/60 dark:border-gray-600/40 overflow-hidden`}>
            <RightPanel />
          </div>
        )}
      </div>

      {/* Enhanced Bottom Player Bar - Full Player Controls */}
      {(currentAudiobookId || currentAudiobook) && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <PlayerControls
            isPlaying={isPlaying}
            currentTime={currentPosition}
            duration={duration}
            volume={storeVolume}
            playbackSpeed={playbackSpeed}
            canGoBack={chapters.length > 0 && chapters.findIndex(ch => ch.id === storeCurrentChapterId) > 0}
            canGoForward={chapters.length > 0 && chapters.findIndex(ch => ch.id === storeCurrentChapterId) < chapters.length - 1}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onSpeedChange={handleSpeedChange}
            onSkipBack={handleSkipBack}
            onSkipForward={handleSkipForward}
            onRewind={handleRewind}
            onFastForward={handleFastForward}
            audiobook={currentAudiobook ? {
              title: currentAudiobook.title,
              author: currentAudiobook.author || 'Unknown Author',
              cover_image_path: currentAudiobook.cover_image_path
            } : undefined}
            onNavigateToPlayer={() => navigate('/player')}
          />
        </div>
      )}

      {/* Download Indicator */}
      <DownloadIndicator 
        onNavigateToDownloads={() => navigate('/downloads')}
      />
    </div>
  );
};