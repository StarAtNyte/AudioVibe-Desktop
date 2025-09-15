import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  RotateCcw,
  RotateCw,
  Settings,
  Timer,
  Maximize2
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackSpeed: number;
  canGoBack: boolean;
  canGoForward: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onSpeedChange: (speed: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onRewind: () => void;
  onFastForward: () => void;
  // New props for audiobook info
  audiobook?: {
    title: string;
    author: string;
    cover_image_path?: string;
  };
  onNavigateToPlayer?: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  playbackSpeed,
  canGoBack,
  canGoForward,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onSpeedChange,
  onSkipBack,
  onSkipForward,
  onRewind,
  onFastForward,
  audiobook,
  onNavigateToPlayer
}) => {
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [localVolume, setLocalVolume] = useState(volume * 100);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(volume * 100);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(30);

  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  
  const { isMobile, isTablet, isSmallDesktop, isDesktop } = useResponsive();

  useEffect(() => {
    if (!isDraggingProgress) {
      setLocalProgress((currentTime / duration) * 100 || 0);
    }
  }, [currentTime, duration, isDraggingProgress]);

  useEffect(() => {
    if (!isDraggingVolume) {
      setLocalVolume(volume * 100); // Convert 0-1 range to 0-100 for display
    }
  }, [volume, isDraggingVolume]);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    setIsDraggingProgress(true);
    handleProgressMove(e);
    
    // Immediate seek on click
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const initialProgress = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const seekTime = (initialProgress / 100) * duration;
    onSeek(seekTime);
    
    let hasDragged = false;
    
    const handleMouseMove = (e: MouseEvent) => {
      hasDragged = true;
      handleProgressMove(e);
    };
    
    const handleMouseUp = () => {
      setIsDraggingProgress(false);
      // Only seek again on release if user actually dragged
      if (hasDragged) {
        onSeek((localProgress / 100) * duration);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleProgressMove = (e: MouseEvent | React.MouseEvent) => {
    if (!progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setLocalProgress(progress);
  };

  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingVolume(true);
    
    // Calculate and apply volume immediately on click
    if (volumeRef.current) {
      const rect = volumeRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const volumePercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setLocalVolume(volumePercent);
      onVolumeChange(volumePercent / 100);
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!volumeRef.current) return;
      const rect = volumeRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const volumePercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setLocalVolume(volumePercent);
      onVolumeChange(volumePercent / 100);
    };
    
    const handleMouseUp = () => {
      setIsDraggingVolume(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleVolumeMove = (e: MouseEvent | React.MouseEvent) => {
    if (!volumeRef.current) return;
    
    const rect = volumeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const volumePercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setLocalVolume(volumePercent);
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      onVolumeChange(previousVolume / 100);
      setLocalVolume(previousVolume);
    } else {
      setIsMuted(true);
      setPreviousVolume(localVolume);
      onVolumeChange(0);
      setLocalVolume(0);
    }
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

  return (
    <div className={`
      bg-gradient-to-r from-slate-950 via-gray-800 to-slate-950 border-t border-gray-600/50 
      ${isMobile ? 'h-16' : 'h-20'} 
      ${isMobile ? 'flex-col p-2 space-y-2' : 'flex items-center px-4'} 
      shadow-2xl backdrop-blur-xl
    `}>
      {isMobile ? (
        /* Mobile Layout - Stacked */
        <>
          {/* Top Row - Progress Bar */}
          <div className="w-full">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400 min-w-0">{formatTime(currentTime)}</span>
              <div
                ref={progressRef}
                className="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer group relative"
                onMouseDown={handleProgressMouseDown}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all duration-200"
                  style={{ width: `${localProgress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 min-w-0">{formatTime(duration)}</span>
            </div>
          </div>
          
          {/* Bottom Row - Track Info + Controls */}
          <div className="flex items-center justify-between w-full">
            {/* Track Info - Compact */}
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {audiobook?.cover_image_path ? (
                <img
                  src={audiobook.cover_image_path}
                  alt={audiobook.title}
                  className="w-10 h-10 object-cover rounded-md shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-md flex items-center justify-center shadow-lg flex-shrink-0">
                  <span className="text-white font-bold text-sm">🎵</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-white text-sm font-medium truncate">
                  {audiobook?.title || 'Now Playing'}
                </div>
                <div className="text-gray-400 text-xs truncate">
                  {audiobook?.author || 'Unknown Artist'}
                </div>
              </div>
            </div>
            
            {/* Essential Controls Only */}
            <div className="flex items-center space-x-3">
              <button
                onClick={onSkipBack}
                disabled={!canGoBack}
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <SkipBack size={16} />
              </button>

              <button
                onClick={isPlaying ? onPause : onPlay}
                className="w-9 h-9 bg-white hover:bg-gray-100 text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 transform transition-all duration-200 flex-shrink-0"
              >
                {isPlaying ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} className="ml-0.5" />
                )}
              </button>

              <button
                onClick={onSkipForward}
                disabled={!canGoForward}
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <SkipForward size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Desktop/Tablet Layout - Original */
        <>
          {/* Left Section - Track Info */}
          <div className={`flex items-center space-x-3 ${isTablet ? 'w-40' : isSmallDesktop ? 'w-56' : 'w-64'} min-w-0`}>
            {audiobook?.cover_image_path ? (
              <img
                src={audiobook.cover_image_path}
                alt={audiobook.title}
                className={`${isTablet ? 'w-10 h-10' : isSmallDesktop ? 'w-12 h-12' : 'w-12 h-12'} object-cover rounded-md shadow-lg flex-shrink-0`}
              />
            ) : (
              <div className={`${isTablet ? 'w-10 h-10' : isSmallDesktop ? 'w-12 h-12' : 'w-12 h-12'} bg-gradient-to-br from-green-500 to-green-600 rounded-md flex items-center justify-center shadow-lg flex-shrink-0`}>
                <span className="text-white font-bold text-lg">🎵</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-medium truncate">
                {audiobook?.title || 'Now Playing'}
              </div>
              <div className="text-gray-400 text-xs truncate">
                {audiobook?.author || `${formatTime(currentTime)} / ${formatTime(duration)}`}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Desktop/Tablet Center Section - Main Controls */}
      {!isMobile && (
        <div className={`${isTablet ? 'max-w-[180px]' : isSmallDesktop ? 'max-w-[250px]' : 'max-w-md'} flex-1 flex flex-col items-center justify-center space-y-2 mx-auto`}>
        {/* Control Buttons */}
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={onRewind}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors hover:scale-105 transform duration-200 flex-shrink-0"
          >
            <RotateCcw size={14} />
          </button>

          <button
            onClick={onSkipBack}
            disabled={!canGoBack}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:scale-105 transform duration-200 flex-shrink-0"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            className="w-9 h-9 bg-white hover:bg-gray-100 text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 transform transition-all duration-200 flex-shrink-0"
          >
            {isPlaying ? (
              <Pause size={16} />
            ) : (
              <Play size={16} className="ml-0.5" />
            )}
          </button>

          <button
            onClick={onSkipForward}
            disabled={!canGoForward}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:scale-105 transform duration-200 flex-shrink-0"
          >
            <SkipForward size={16} />
          </button>

          <button
            onClick={onFastForward}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors hover:scale-105 transform duration-200 flex-shrink-0"
          >
            <RotateCw size={14} />
          </button>
        </div>

        {/* Compact Progress Bar with time displays on left and right */}
        <div className="w-full px-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400 min-w-0 text-right" style={{ width: '36px' }}>{formatTime(currentTime)}</span>
            <div
              ref={progressRef}
              className="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer group relative"
              onMouseDown={handleProgressMouseDown}
            >
              <div
                className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all duration-200"
                style={{ width: `${localProgress}%` }}
              />
              <div
                className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                style={{ left: `calc(${localProgress}% - 6px)` }}
              />
            </div>
            <span className="text-xs text-gray-400 min-w-0 text-left" style={{ width: '36px' }}>{formatTime(duration)}</span>
          </div>
        </div>
        </div>
      )}

      {/* Desktop/Tablet Right Section - Volume & Controls */}
      {!isMobile && (
        <div className={`flex items-center space-x-1 ${isTablet ? 'w-32' : isSmallDesktop ? 'w-48' : 'w-64'} justify-end`}>
        {/* Speed Control - Hidden on tablet to save space */}
        {!isTablet && (
          <select
            value={playbackSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 flex-shrink-0"
          >
            {speedOptions.map(speed => (
              <option key={speed} value={speed} className="bg-gray-800 text-white">
                {speed}x
              </option>
            ))}
          </select>
        )}

        {/* Volume Control */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleMuteToggle}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            {isMuted || localVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          
          {/* Volume slider - Hidden on tablet to save space */}
          {!isTablet && (
            <div className="flex items-center w-16">
              <div
                ref={volumeRef}
                className="w-full h-1 bg-gray-700 rounded-full cursor-pointer relative"
                onMouseDown={handleVolumeMouseDown}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-green-500 rounded-full"
                  style={{ width: `${localVolume}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sleep Timer */}
        <div className="relative">
          <button 
            onClick={() => setShowSleepTimer(!showSleepTimer)}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0"
            title="Sleep Timer"
          >
            <Timer size={14} />
          </button>
        </div>

        {/* Settings Menu */}
        <div className="relative">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0"
            title="Settings"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* Enlarge/Navigate to Now Playing */}
        <button
          onClick={onNavigateToPlayer}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0"
          title="Go to Now Playing"
        >
          <Maximize2 size={14} />
        </button>
        </div>
      )}
    </div>
  );
};