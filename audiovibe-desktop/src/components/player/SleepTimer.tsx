import React, { useState, useEffect, useRef } from 'react';
import { Clock, Moon, X, Plus, Minus } from 'lucide-react';

interface SleepTimerProps {
  isActive: boolean;
  onTimerComplete: () => void;
  onVolumeChange: (volume: number) => void;
  currentVolume: number;
}

interface TimerPreset {
  label: string;
  minutes: number;
}

const timerPresets: TimerPreset[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '90 min', minutes: 90 },
  { label: '2 hours', minutes: 120 }
];

export const SleepTimer: React.FC<SleepTimerProps> = ({
  isActive,
  onTimerComplete,
  onVolumeChange,
  currentVolume
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [fadeOutDuration, setFadeOutDuration] = useState(300); // seconds for fade out
  const [isFading, setIsFading] = useState(false);
  const [originalVolume, setOriginalVolume] = useState(currentVolume);

  const timerRef = useRef<number>();
  const fadeIntervalRef = useRef<number>();

  // Timer countdown effect
  useEffect(() => {
    if (isTimerRunning && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          
          // Start fade out when reaching fade duration
          if (newTime <= fadeOutDuration && !isFading) {
            setIsFading(true);
            setOriginalVolume(currentVolume);
            startFadeOut();
          }
          
          // Timer complete
          if (newTime <= 0) {
            setIsTimerRunning(false);
            setIsFading(false);
            onTimerComplete();
          }
          
          return Math.max(0, newTime);
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isTimerRunning, timeRemaining, fadeOutDuration, isFading, currentVolume, onTimerComplete]);

  const startFadeOut = () => {
    const fadeSteps = 30; // Number of volume steps
    const stepInterval = (fadeOutDuration * 1000) / fadeSteps;
    const volumeDecrement = originalVolume / fadeSteps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = Math.max(0, originalVolume - (volumeDecrement * currentStep));
      onVolumeChange(newVolume);

      if (currentStep >= fadeSteps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
        }
      }
    }, stepInterval);
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = (minutes: number) => {
    setTimeRemaining(minutes * 60);
    setIsTimerRunning(true);
    setIsFading(false);
    setIsOpen(false);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    setTimeRemaining(0);
    setIsFading(false);
    
    // Clear intervals
    if (timerRef.current) clearTimeout(timerRef.current);
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    
    // Restore original volume if we were fading
    if (isFading) {
      onVolumeChange(originalVolume);
    }
  };

  const addTime = (minutes: number) => {
    setTimeRemaining(prev => prev + (minutes * 60));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  return (
    <>
      {/* Timer Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
            isTimerRunning
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
          title="Sleep Timer"
        >
          {isTimerRunning ? <Moon size={18} /> : <Clock size={18} />}
        </button>

        {/* Timer Status */}
        {isTimerRunning && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {Math.ceil(timeRemaining / 60)}
          </div>
        )}
      </div>

      {/* Timer Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <Moon size={20} className="text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sleep Timer
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {!isTimerRunning ? (
                <>
                  {/* Preset Times */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Quick Select
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {timerPresets.map((preset) => (
                        <button
                          key={preset.minutes}
                          onClick={() => startTimer(preset.minutes)}
                          className="p-3 text-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">
                            {preset.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Time */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Custom Time
                    </h4>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setCustomMinutes(Math.max(1, customMinutes - 15))}
                        className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      
                      <div className="flex-1 text-center">
                        <input
                          type="number"
                          value={customMinutes}
                          onChange={(e) => setCustomMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 text-center text-lg font-medium bg-transparent border-none focus:outline-none text-gray-900 dark:text-white"
                        />
                        <div className="text-sm text-gray-600 dark:text-gray-400">minutes</div>
                      </div>
                      
                      <button
                        onClick={() => setCustomMinutes(customMinutes + 15)}
                        className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => startTimer(customMinutes)}
                      className="w-full mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      Start Timer
                    </button>
                  </div>

                  {/* Fade Settings */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Fade Out Duration
                    </h4>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="60"
                        max="600"
                        step="30"
                        value={fadeOutDuration}
                        onChange={(e) => setFadeOutDuration(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[4rem] text-right">
                        {Math.floor(fadeOutDuration / 60)}:{(fadeOutDuration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* Timer Active View */
                <div className="text-center">
                  <div className="mb-6">
                    <div className="text-4xl font-mono font-bold text-blue-600 dark:text-blue-400 mb-2">
                      {formatTime(timeRemaining)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {isFading ? 'Fading out...' : 'Time remaining'}
                    </div>
                  </div>

                  {/* Quick Add Time Buttons */}
                  <div className="flex justify-center space-x-2 mb-6">
                    <button
                      onClick={() => addTime(15)}
                      className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      +15m
                    </button>
                    <button
                      onClick={() => addTime(30)}
                      className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      +30m
                    </button>
                  </div>

                  <button
                    onClick={stopTimer}
                    className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    Stop Timer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Timer Display */}
      {isTimerRunning && !isOpen && (
        <div className="fixed bottom-20 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700 z-40">
          <div className="flex items-center space-x-3">
            <Moon size={16} className="text-blue-500" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatTime(timeRemaining)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {isFading ? 'Fading...' : 'Sleep timer'}
              </div>
            </div>
            <button
              onClick={stopTimer}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};