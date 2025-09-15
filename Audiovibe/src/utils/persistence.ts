import { invoke } from '@tauri-apps/api/core';

export interface PlaybackState {
  audiobookId: string;
  position: number;
  duration: number;
  volume: number;
  playbackSpeed: number;
  chapterId?: string;
  lastPlayed: string;
}

export interface AppPreferences {
  defaultVolume: number;
  defaultPlaybackSpeed: number;
  autoSaveInterval: number;
  sleepTimerDefaults: {
    duration: number;
    fadeOutDuration: number;
  };
}

class PersistenceManager {
  private readonly PLAYBACK_STATE_KEY = 'audiovibe_playback_state';
  private readonly PREFERENCES_KEY = 'audiovibe_preferences';
  private autoSaveTimer?: number;

  constructor() {
    // Initialize auto-save for playback position
    this.startAutoSave();
  }

  // Playback State Management
  async savePlaybackState(state: PlaybackState): Promise<void> {
    try {
      const stateJson = JSON.stringify(state);
      await invoke('save_playback_state', { 
        audiobookId: state.audiobookId,
        state: stateJson 
      });
      
      // Also save to localStorage as backup
      localStorage.setItem(`${this.PLAYBACK_STATE_KEY}_${state.audiobookId}`, stateJson);
    } catch (error) {
      console.error('Failed to save playback state:', error);
      // Fallback to localStorage only
      localStorage.setItem(`${this.PLAYBACK_STATE_KEY}_${state.audiobookId}`, JSON.stringify(state));
    }
  }

  async loadPlaybackState(audiobookId: string): Promise<PlaybackState | null> {
    try {
      // Try to load from database first
      const stateJson = await invoke<string>('load_playback_state', { audiobookId });
      if (stateJson) {
        return JSON.parse(stateJson);
      }
    } catch (error) {
      console.warn('Failed to load playback state from database:', error);
    }

    // Fallback to localStorage
    const localState = localStorage.getItem(`${this.PLAYBACK_STATE_KEY}_${audiobookId}`);
    if (localState) {
      try {
        return JSON.parse(localState);
      } catch (error) {
        console.error('Failed to parse local playback state:', error);
      }
    }

    return null;
  }

  async removePlaybackState(audiobookId: string): Promise<void> {
    try {
      await invoke('remove_playback_state', { audiobookId });
    } catch (error) {
      console.error('Failed to remove playback state from database:', error);
    }
    
    // Remove from localStorage as well
    localStorage.removeItem(`${this.PLAYBACK_STATE_KEY}_${audiobookId}`);
  }

  // App Preferences Management
  async savePreferences(preferences: AppPreferences): Promise<void> {
    try {
      const prefsJson = JSON.stringify(preferences);
      await invoke('save_app_preferences', { preferences: prefsJson });
      localStorage.setItem(this.PREFERENCES_KEY, prefsJson);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(preferences));
    }
  }

  async loadPreferences(): Promise<AppPreferences> {
    const defaultPreferences: AppPreferences = {
      defaultVolume: 0.7,
      defaultPlaybackSpeed: 1.0,
      autoSaveInterval: 30000, // 30 seconds
      sleepTimerDefaults: {
        duration: 30, // 30 minutes
        fadeOutDuration: 300 // 5 minutes
      }
    };

    try {
      const prefsJson = await invoke<string>('load_app_preferences');
      if (prefsJson) {
        return { ...defaultPreferences, ...JSON.parse(prefsJson) };
      }
    } catch (error) {
      console.warn('Failed to load preferences from database:', error);
    }

    // Fallback to localStorage
    const localPrefs = localStorage.getItem(this.PREFERENCES_KEY);
    if (localPrefs) {
      try {
        return { ...defaultPreferences, ...JSON.parse(localPrefs) };
      } catch (error) {
        console.error('Failed to parse local preferences:', error);
      }
    }

    return defaultPreferences;
  }

  // Auto-save functionality
  private startAutoSave(): void {
    // Auto-save every 30 seconds if there's active playback
    this.autoSaveTimer = setInterval(async () => {
      const currentState = this.getCurrentPlaybackState();
      if (currentState && this.shouldAutoSave(currentState)) {
        await this.savePlaybackState(currentState);
      }
    }, 30000);
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  // This would be called by the audio player to set current state
  private currentPlaybackState?: PlaybackState;
  
  setCurrentPlaybackState(state: PlaybackState): void {
    this.currentPlaybackState = state;
  }

  getCurrentPlaybackState(): PlaybackState | null {
    return this.currentPlaybackState || null;
  }

  private shouldAutoSave(state: PlaybackState): boolean {
    // Only auto-save if position has changed significantly (more than 10 seconds)
    const lastSaved = localStorage.getItem(`${this.PLAYBACK_STATE_KEY}_${state.audiobookId}_last_save`);
    if (!lastSaved) return true;

    try {
      const lastState: PlaybackState = JSON.parse(lastSaved);
      const positionDiff = Math.abs(state.position - lastState.position);
      return positionDiff > 10; // 10 seconds threshold
    } catch {
      return true;
    }
  }

  // Session Recovery
  async recoverSession(): Promise<PlaybackState[]> {
    const recoveredStates: PlaybackState[] = [];
    
    try {
      // Get all saved playback states
      const states = await invoke<string[]>('get_all_playback_states');
      for (const stateJson of states) {
        try {
          const state: PlaybackState = JSON.parse(stateJson);
          recoveredStates.push(state);
        } catch (error) {
          console.warn('Failed to parse recovered state:', error);
        }
      }
    } catch (error) {
      console.warn('Failed to recover session from database:', error);
      
      // Fallback to localStorage recovery
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.PLAYBACK_STATE_KEY) && !key.endsWith('_last_save')) {
          try {
            const stateJson = localStorage.getItem(key);
            if (stateJson) {
              const state: PlaybackState = JSON.parse(stateJson);
              recoveredStates.push(state);
            }
          } catch (error) {
            console.warn('Failed to parse local state during recovery:', error);
          }
        }
      }
    }

    // Sort by last played date
    return recoveredStates.sort((a, b) => 
      new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime()
    );
  }

  // Cleanup
  async cleanup(): Promise<void> {
    this.stopAutoSave();
    
    // Remove old playback states (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      await invoke('cleanup_old_playback_states', { 
        cutoffDate: thirtyDaysAgo.toISOString() 
      });
    } catch (error) {
      console.warn('Failed to cleanup old states from database:', error);
    }

    // Cleanup localStorage
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.PLAYBACK_STATE_KEY)) {
        try {
          const stateJson = localStorage.getItem(key);
          if (stateJson) {
            const state: PlaybackState = JSON.parse(stateJson);
            if (new Date(state.lastPlayed) < thirtyDaysAgo) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // Remove corrupted entries
          localStorage.removeItem(key);
        }
      }
    }
  }
}

// Export singleton instance
export const persistenceManager = new PersistenceManager();