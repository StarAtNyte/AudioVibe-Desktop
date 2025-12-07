import React from 'react';
import { X } from 'lucide-react';
import { useReaderStore } from '../../store/reader';

interface ReaderSettingsProps {
  onClose: () => void;
}

export const ReaderSettings: React.FC<ReaderSettingsProps> = ({ onClose }) => {
  const { readerSettings, updateSettings } = useReaderStore();

  const fontFamilies = [
    { value: 'serif', label: 'Serif' },
    { value: 'sans-serif', label: 'Sans-Serif' },
    { value: 'monospace', label: 'Monospace' },
  ];

  const themes = [
    { value: 'light', label: 'Light', bg: '#ffffff', text: '#1f2937' },
    { value: 'dark', label: 'Dark', bg: '#1f2937', text: '#e5e7eb' },
    { value: 'sepia', label: 'Sepia', bg: '#f5f5dc', text: '#5c4a3a' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reader Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Font Family
            </label>
            <div className="flex gap-2">
              {fontFamilies.map((font) => (
                <button
                  key={font.value}
                  onClick={() => updateSettings({ font_family: font.value })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    readerSettings.font_family === font.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                  style={{ fontFamily: font.value }}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Font Size: {readerSettings.font_size || 18}px
            </label>
            <input
              type="range"
              min="12"
              max="32"
              value={readerSettings.font_size || 18}
              onChange={(e) => updateSettings({ font_size: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Line Height */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Line Height: {readerSettings.line_height || 1.6}
            </label>
            <input
              type="range"
              min="1.2"
              max="2.0"
              step="0.1"
              value={readerSettings.line_height || 1.6}
              onChange={(e) => updateSettings({ line_height: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {themes.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => updateSettings({ theme: theme.value as any })}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    readerSettings.theme === theme.value
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: theme.bg, color: theme.text }}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
