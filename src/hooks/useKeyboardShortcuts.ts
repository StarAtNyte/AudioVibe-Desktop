import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcuts {
  onPlay?: () => void;
  onPause?: () => void;
  onTogglePlayPause?: () => void;
  onStop?: () => void;
  onSeekForward?: (seconds: number) => void;
  onSeekBackward?: (seconds: number) => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onMute?: () => void;
  onSpeedUp?: () => void;
  onSpeedDown?: () => void;
  onNextChapter?: () => void;
  onPreviousChapter?: () => void;
  onFocusSearch?: () => void;
}

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  preventDefault?: boolean;
  enabled?: boolean;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts, enabled: boolean = true) => {
  const shortcutsRef = useRef(shortcuts);
  
  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when user is typing in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const { key, ctrlKey, shiftKey, altKey, metaKey } = event;
    const shortcuts = shortcutsRef.current;

    // Define shortcut mappings
    const shortcutMap: { [key: string]: ShortcutConfig & { action: () => void } } = {
      // Play/Pause controls
      ' ': {
        key: ' ',
        preventDefault: true,
        action: () => shortcuts.onTogglePlayPause?.()
      },
      'k': {
        key: 'k',
        preventDefault: true,
        action: () => shortcuts.onTogglePlayPause?.()
      },
      'p': {
        key: 'p',
        ctrlKey: true,
        preventDefault: true,
        action: () => shortcuts.onPlay?.()
      },
      'Escape': {
        key: 'Escape',
        preventDefault: true,
        action: () => shortcuts.onStop?.()
      },

      // Seeking
      'ArrowLeft': {
        key: 'ArrowLeft',
        preventDefault: true,
        action: () => shortcuts.onSeekBackward?.(15) // 15 seconds
      },
      'ArrowRight': {
        key: 'ArrowRight',
        preventDefault: true,
        action: () => shortcuts.onSeekForward?.(30) // 30 seconds
      },
      'j': {
        key: 'j',
        preventDefault: true,
        action: () => shortcuts.onSeekBackward?.(10) // 10 seconds
      },
      'l': {
        key: 'l',
        preventDefault: true,
        action: () => shortcuts.onSeekForward?.(10) // 10 seconds
      },

      // Volume controls
      'ArrowUp': {
        key: 'ArrowUp',
        preventDefault: true,
        action: () => shortcuts.onVolumeUp?.()
      },
      'ArrowDown': {
        key: 'ArrowDown',
        preventDefault: true,
        action: () => shortcuts.onVolumeDown?.()
      },
      'm': {
        key: 'm',
        preventDefault: true,
        action: () => shortcuts.onMute?.()
      },

      // Speed controls
      ',': {
        key: ',',
        preventDefault: true,
        action: () => shortcuts.onSpeedDown?.()
      },
      '.': {
        key: '.',
        preventDefault: true,
        action: () => shortcuts.onSpeedUp?.()
      },

      // Chapter navigation
      'n': {
        key: 'n',
        preventDefault: true,
        action: () => shortcuts.onNextChapter?.()
      },
      'N': {
        key: 'N',
        shiftKey: true,
        preventDefault: true,
        action: () => shortcuts.onPreviousChapter?.()
      },

      // Application shortcuts
      '/': {
        key: '/',
        preventDefault: true,
        action: () => shortcuts.onFocusSearch?.()
      },
      'f': {
        key: 'f',
        ctrlKey: true,
        preventDefault: true,
        action: () => shortcuts.onFocusSearch?.()
      }
    };

    // Find matching shortcut
    for (const shortcut of Object.values(shortcutMap)) {
      if (
        shortcut.key === key &&
        (shortcut.ctrlKey ?? false) === ctrlKey &&
        (shortcut.shiftKey ?? false) === shiftKey &&
        (shortcut.altKey ?? false) === altKey &&
        (shortcut.metaKey ?? false) === metaKey
      ) {
        if (shortcut.preventDefault) {
          event.preventDefault();
        }
        shortcut.action();
        break;
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);

  // Return shortcut help for UI display
  const getShortcutHelp = useCallback(() => {
    return [
      { key: 'Space / K', description: 'Play/Pause' },
      { key: 'Ctrl+P', description: 'Play' },
      { key: 'Escape', description: 'Stop' },
      { key: '← / J', description: 'Seek backward (15s/10s)' },
      { key: '→ / L', description: 'Seek forward (30s/10s)' },
      { key: '↑', description: 'Volume up' },
      { key: '↓', description: 'Volume down' },
      { key: 'M', description: 'Mute/Unmute' },
      { key: ', / .', description: 'Speed down/up' },
      { key: 'N / Shift+N', description: 'Next/Previous chapter' },
      { key: '/ or Ctrl+F', description: 'Focus search' }
    ];
  }, []);

  return { getShortcutHelp };
};