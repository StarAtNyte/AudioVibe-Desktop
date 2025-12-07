import React, { useState } from 'react';
import { Play, Pause, Square, Volume2 } from 'lucide-react';
import { mockTtsService } from '../../services/mockTtsService';

interface TTSControlsProps {
  text: string;
  onSentenceHighlight?: (index: number) => void;
}

export const TTSControls: React.FC<TTSControlsProps> = ({ text, onSentenceHighlight }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);

  const handlePlay = async () => {
    if (isPaused) {
      mockTtsService.resume();
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      setIsPlaying(true);
      await mockTtsService.startReading(
        text,
        { voice: 'default', speed, volume },
        onSentenceHighlight
      );
      setIsPlaying(false);
    }
  };

  const handlePause = () => {
    mockTtsService.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    mockTtsService.stop();
    setIsPlaying(false);
    setIsPaused(false);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
            aria-label="Play"
          >
            <Play className="w-5 h-5" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
            aria-label="Pause"
          >
            <Pause className="w-5 h-5" fill="currentColor" />
          </button>
        )}

        <button
          onClick={handleStop}
          disabled={!isPlaying && !isPaused}
          className="p-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Stop"
        >
          <Square className="w-5 h-5" fill="currentColor" />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-1">
        <span className="text-sm text-gray-600 dark:text-gray-400">Speed: {speed.toFixed(1)}x</span>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="flex-1 max-w-32"
        />
      </div>

      <div className="flex items-center gap-2">
        <Volume2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-24"
        />
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        Mock TTS (Replace with real implementation)
      </div>
    </div>
  );
};
