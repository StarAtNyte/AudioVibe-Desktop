import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2,
  Maximize2,
  Minimize2,
  X,
  MoreHorizontal
} from 'lucide-react';

interface MiniPlayerProps {
  audiobook?: {
    id: string;
    title: string;
    author: string;
    coverUrl?: string;
  };
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  progress: number;
  onPlay: () => void;
  onPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (position: number) => void;
  onExpand: () => void;
  onClose: () => void;
  isVisible: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  audiobook,
  isPlaying,
  currentTime,
  duration,
  volume,
  progress,
  onPlay,
  onPause,
  onSkipBack,
  onSkipForward,
  onVolumeChange,
  onSeek,
  onExpand,
  onClose,
  isVisible
}) => {
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 20, y: 20 });

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    const newTime = (percentage / 100) * duration;
    onSeek(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const newDragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setDragOffset(newDragOffset);
    
    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - newDragOffset.x;
      const newY = e.clientY - newDragOffset.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - 320; // mini player width
      const maxY = window.innerHeight - 120; // mini player height
      
      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isVisible || !audiobook) return null;

  return (
    <div
      className={`fixed z-50 bg-white/90 dark:bg-surface-900 backdrop-blur-xl rounded-3xl shadow-glass-lg border border-white/30 dark:border-surface-800/50 transition-all duration-200 ${
        isDragging ? 'scale-105' : ''
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: '320px',
        minHeight: '120px'
      }}
    >
      {/* Header with drag handle */}
      <div 
        className={`flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
            Now Playing
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Expand player"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Close mini player"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 select-none">
        {/* Track Info and Cover */}
        <div className="flex items-center space-x-3 mb-3">
          {audiobook.coverUrl ? (
            <img
              src={audiobook.coverUrl}
              alt={audiobook.title}
              className="w-12 h-12 object-cover rounded-md shadow-sm"
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-slate-500 via-blue-500 to-slate-600 rounded-md flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-base">
                {audiobook.title.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {audiobook.title}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {audiobook.author}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div
            className="relative h-1 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer group"
            onClick={handleProgressClick}
          >
            <div
              className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            <div
              className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 6px)` }}
            />
          </div>
          
          <div className="flex justify-between items-center mt-1 text-xs text-gray-600 dark:text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSkipBack();
            }}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <SkipBack size={15} />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              isPlaying ? onPause() : onPlay();
            }}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-r from-primary-500 to-accent-emerald-500 hover:from-primary-600 hover:to-accent-emerald-600 text-white transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSkipForward();
            }}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <SkipForward size={15} />
          </button>
          
          {/* Volume Control */}
          <div 
            className="relative"
            onMouseEnter={() => setShowVolumeControl(true)}
            onMouseLeave={() => setShowVolumeControl(false)}
          >
            <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Volume2 size={14} />
            </button>
            
            {showVolumeControl && (
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white p-2 rounded shadow-lg">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};