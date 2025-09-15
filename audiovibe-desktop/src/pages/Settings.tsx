import React, { useState } from 'react';
import {
  SunIcon,
  MoonIcon,
  SpeakerWaveIcon,
  FolderIcon,
  CloudIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { useAppStore } from '../store';
import clsx from 'clsx';

export const Settings: React.FC = () => {
  const { 
    theme, setTheme,
    defaultVolume, setDefaultVolume,
    defaultPlaybackSpeed, setDefaultPlaybackSpeed,
    autoPlayNextChapter, setAutoPlayNextChapter,
    defaultLibraryPath, setDefaultLibraryPath,
    autoScanForAudiobooks, setAutoScanForAudiobooks,
    extractMetadataAutomatically, setExtractMetadataAutomatically,
    localBackupPath, setLocalBackupPath,
    autoBackupEnabled, setAutoBackupEnabled,
    shareAnalytics, setShareAnalytics,
    sendCrashReports, setSendCrashReports,
    clearAppData
  } = useAppStore();
  
  const [isClearing, setIsClearing] = useState(false);

  const themeOptions = [
    { value: 'light', label: 'Light', icon: SunIcon },
    { value: 'dark', label: 'Dark', icon: MoonIcon },
  ] as const;

  return (
    <div className="space-y-6 md:space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
        Settings
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 md:gap-8">
        {/* Appearance */}
        <div className="card p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 md:mb-6 flex items-center">
            <SunIcon className="h-5 w-5 mr-2" />
            Appearance
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Theme
              </label>
              <div className="grid grid-cols-2 gap-3">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme({ mode: option.value })}
                    className={clsx(
                      'p-4 rounded-xl border-2 transition-all duration-200',
                      'flex flex-col items-center space-y-2',
                      theme.mode === option.value
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                    )}
                  >
                    <option.icon className={clsx(
                      'h-6 w-6',
                      theme.mode === option.value
                        ? 'text-primary-600'
                        : 'text-gray-400'
                    )} />
                    <span className={clsx(
                      'text-sm font-medium',
                      theme.mode === option.value
                        ? 'text-primary-600'
                        : 'text-gray-600 dark:text-gray-400'
                    )}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Audio */}
        <div className="card p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 md:mb-6 flex items-center">
            <SpeakerWaveIcon className="h-5 w-5 mr-2" />
            Audio
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Volume
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={defaultVolume}
                onChange={(e) => setDefaultVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-dark-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>{Math.round(defaultVolume * 100)}%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Playback Speed
              </label>
              <select 
                className="input-base"
                value={defaultPlaybackSpeed}
                onChange={(e) => setDefaultPlaybackSpeed(parseFloat(e.target.value))}
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x (Normal)</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoPlay"
                checked={autoPlayNextChapter}
                onChange={(e) => setAutoPlayNextChapter(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="autoPlay" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Auto-play next chapter
              </label>
            </div>
          </div>
        </div>

        {/* Library */}
        <div className="card p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 md:mb-6 flex items-center">
            <FolderIcon className="h-5 w-5 mr-2" />
            Library
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Library Path
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="/path/to/audiobooks"
                  value={defaultLibraryPath}
                  onChange={(e) => setDefaultLibraryPath(e.target.value)}
                  className="input-base flex-1"
                />
                <button 
                  className="btn-secondary"
                  onClick={async () => {
                    try {
                      const { open } = await import('@tauri-apps/plugin-dialog');
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        title: 'Select Library Path'
                      });
                      if (selected && typeof selected === 'string') {
                        setDefaultLibraryPath(selected);
                      }
                    } catch (error) {
                      console.error('Failed to open directory dialog:', error);
                    }
                  }}
                >
                  Browse
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoScan"
                checked={autoScanForAudiobooks}
                onChange={(e) => setAutoScanForAudiobooks(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="autoScan" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Automatically scan for new audiobooks
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="extractMetadata"
                checked={extractMetadataAutomatically}
                onChange={(e) => setExtractMetadataAutomatically(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="extractMetadata" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Extract metadata automatically
              </label>
            </div>
          </div>
        </div>

        {/* Sync & Backup */}
        <div className="card p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 md:mb-6 flex items-center">
            <CloudIcon className="h-5 w-5 mr-2" />
            Sync & Backup
          </h2>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Cloud sync is not yet available. Stay tuned for future updates!
              </p>
              <button className="btn-secondary" disabled>
                Connect Cloud Service
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Local Backup Path
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="/path/to/backup"
                  value={localBackupPath}
                  onChange={(e) => setLocalBackupPath(e.target.value)}
                  className="input-base flex-1"
                />
                <button 
                  className="btn-secondary"
                  onClick={async () => {
                    try {
                      const { open } = await import('@tauri-apps/plugin-dialog');
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        title: 'Select Backup Path'
                      });
                      if (selected && typeof selected === 'string') {
                        setLocalBackupPath(selected);
                      }
                    } catch (error) {
                      console.error('Failed to open directory dialog:', error);
                    }
                  }}
                >
                  Browse
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoBackup"
                checked={autoBackupEnabled}
                onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="autoBackup" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Enable automatic backups
              </label>
            </div>
          </div>
        </div>

        {/* Privacy & Security */}
        <div className="card p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 md:mb-6 flex items-center">
            <ShieldCheckIcon className="h-5 w-5 mr-2" />
            Privacy & Security
          </h2>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="analytics"
                checked={shareAnalytics}
                onChange={(e) => setShareAnalytics(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="analytics" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Share anonymous usage data to help improve AudioVibe
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="crashReports"
                checked={sendCrashReports}
                onChange={(e) => setSendCrashReports(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="crashReports" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Send crash reports automatically
              </label>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-dark-600">
              <button 
                className="btn-secondary"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to clear all app data? This cannot be undone.')) {
                    setIsClearing(true);
                    try {
                      await clearAppData();
                      alert('App data cleared successfully.');
                    } catch (error) {
                      alert('Failed to clear app data: ' + (error as Error).message);
                    } finally {
                      setIsClearing(false);
                    }
                  }
                }}
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear App Data'}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                This will reset all settings and clear your library. Your audio files will not be deleted.
              </p>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="card p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 md:mb-6">
            About AudioVibe
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Version</span>
              <span className="text-gray-900 dark:text-gray-100">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Build</span>
              <span className="text-gray-900 dark:text-gray-100">2024.01.01</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Platform</span>
              <span className="text-gray-900 dark:text-gray-100">Desktop</span>
            </div>
          </div>

          <div className="pt-4 mt-6 border-t border-gray-200 dark:border-dark-600">
            <button className="btn-primary w-full">
              Check for Updates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};