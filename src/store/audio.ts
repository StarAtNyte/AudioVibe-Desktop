import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { PlaybackStatus, AudioInfo } from '../types';

interface AudioState {
  // Playback state
  status: PlaybackStatus;
  audioInfo: AudioInfo | null;
  currentAudiobookId: string | null;
  currentChapterId: string | null;
  chapters: any[];
  
  // UI state
  isPlayerVisible: boolean;
  volume: number;
  isMuted: boolean;
  
  // Actions
  setStatus: (status: PlaybackStatus) => void;
  setAudioInfo: (info: AudioInfo | null) => void;
  setCurrentAudiobookId: (id: string | null) => void;
  setCurrentChapterId: (id: string | null) => void;
  setChapters: (chapters: any[]) => void;
  setPlayerVisible: (visible: boolean) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  
  // Audio controls
  loadAudio: (filePath: string, audiobookId?: string) => Promise<void>;
  setAudiobook: (audiobookId: string) => void;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (positionSeconds: number) => Promise<void>;
  updateVolume: (volume: number) => Promise<void>;
  updateSpeed: (speed: number) => Promise<void>;
  getStatus: () => Promise<void>;
  startProgressUpdates: () => void;
  stopProgressUpdates: () => void;
  
  // Chapter navigation
  skipToPreviousChapter: () => Promise<void>;
  skipToNextChapter: () => Promise<void>;
  loadChaptersForAudiobook: (audiobookId: string) => Promise<void>;
}

// Progress update interval
let progressInterval: number | null = null;

// Smooth interpolation for position tracking
let lastServerPosition = 0;
let lastServerTimestamp = 0;
let interpolationInterval: number | null = null;

// Debounce mechanism for rapid clicks - use separate flags for different operations
let isPlayInProgress = false;
let isPauseInProgress = false;
let isLoadInProgress = false;
let isStopInProgress = false;

export const useAudioStore = create<AudioState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    status: {
      state: 'Stopped',
      position: 0,
      duration: 0,
      volume: 1.0,
      speed: 1.0,
      current_file: undefined,
    },
    audioInfo: null,
    currentAudiobookId: null,
    currentChapterId: null,
    chapters: [],
    isPlayerVisible: false,
    volume: 1.0,
    isMuted: false,
    
    // State setters
    setStatus: (status) => set({ status }),
    setAudioInfo: (audioInfo) => set({ audioInfo }),
    setCurrentAudiobookId: (currentAudiobookId) => {
      const prevId = get().currentAudiobookId;
      // Only clear chapters if audiobook is actually changing
      if (prevId !== currentAudiobookId) {
        console.log('🔄 Audiobook changed from', prevId, 'to', currentAudiobookId, '- clearing chapters');
        set({ currentAudiobookId, chapters: [], currentChapterId: null });
      } else {
        set({ currentAudiobookId });
      }
    },
    setCurrentChapterId: (currentChapterId) => set({ currentChapterId }),
    setChapters: (chapters) => set({ chapters }),
    setPlayerVisible: (isPlayerVisible) => set({ isPlayerVisible }),
    setVolume: (volume) => set({ volume }),
    setMuted: (isMuted) => set({ isMuted }),
    setAudiobook: (audiobookId) => {
      console.log('🔄 Setting audiobook to:', audiobookId);
      // Clear chapters when changing audiobooks to force a fresh load
      set({ currentAudiobookId: audiobookId, chapters: [], currentChapterId: null });
    },
    
    // Audio control actions
    loadAudio: async (filePath: string, audiobookId?: string) => {
      if (isLoadInProgress) {
        console.log('Load operation already in progress, skipping');
        return;
      }
      
      try {
        isLoadInProgress = true;
        const tauriCore = await import('@tauri-apps/api/core');
        
        // Log current state before loading
        const currentState = get();
        console.log('Audio store: Current state before loading:', {
          currentAudiobookId: currentState.currentAudiobookId,
          filePath,
          audiobookId
        });
        
        // Stop any currently playing audio explicitly
        try {
          console.log('Audio store: Stopping any currently playing audio');
          await tauriCore.invoke('stop_audio');
          console.log('Audio store: Successfully stopped current audio');
          // Reduced delay to ensure stop operation completes
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (stopError) {
          console.warn('Audio store: Failed to stop current audio (may not be playing):', stopError);
        }
        
        // Stop progress updates immediately
        get().stopProgressUpdates();
        
        // Load audio file
        console.log('Audio store: Calling load_audio_file with:', filePath);
        await tauriCore.invoke('load_audio_file', { filePath });
        console.log('Audio store: load_audio_file completed successfully');
        
        // Reduced delay to allow backend to initialize the audio player
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get audio info - handle both files and directories
        let info: AudioInfo;
        try {
          info = await tauriCore.invoke('get_audio_info', { filePath }) as AudioInfo;
          console.log('Audio store: Got audio info:', info);
        } catch (audioInfoError) {
          console.warn('Audio store: get_audio_info failed (likely a directory), using fallback:', audioInfoError);
          // Create fallback audio info for directories (LibriVox books)
          info = {
            title: audiobookId ? `LibriVox Audio` : 'Unknown',
            duration: null, // Will be determined by the audio engine
            file_path: filePath,
            file_size: 0 // Unknown file size for directories
          } as AudioInfo;
        }
        
        // Update state
        console.log('Audio store: Setting currentAudiobookId to:', audiobookId);
        console.log('Audio store: AudioInfo received:', info);
        set({
          audioInfo: info,
          currentAudiobookId: audiobookId || null,
          isPlayerVisible: true,
        });
        
        // Log state after update
        const newState = get();
        console.log('Audio store: State updated successfully:', {
          currentAudiobookId: newState.currentAudiobookId,
          audioInfo: newState.audioInfo,
          isPlayerVisible: newState.isPlayerVisible
        });
        
        // Additional logging to help debug the player issue
        console.log('Audio store: Full loadAudio completed for:', {
          filePath,
          audiobookId,
          duration: info?.duration,
          title: info?.title
        });
        
        // Verify that the audio is actually loaded by getting the status
        try {
          // Get initial status multiple times to ensure accurate position
          // This helps avoid the "stuck at 0:01" issue with M4B files
          await newState.getStatus();
          console.log('Audio store: Initial status updated after loading');

          // Wait a bit for the decoder to stabilize, especially important for M4B
          await new Promise(resolve => setTimeout(resolve, 100));

          // Get status again to verify stable position
          await newState.getStatus();
          console.log('Audio store: Verified status after loading');

          // Start progress updates to ensure time display works immediately
          // This will update the duration and position even if not playing yet
          newState.startProgressUpdates();
          console.log('Audio store: Started progress updates after loading');
        } catch (statusError) {
          console.warn('Failed to get status after loading audio:', statusError);
        }

        // If we have an audiobookId, load chapters and set the first one as current
        if (audiobookId) {
          console.log('Audio store: Loading chapters for audiobook:', audiobookId);
          try {
            await newState.loadChaptersForAudiobook(audiobookId);
            console.log('Audio store: Chapters loaded successfully');

            // Get fresh status to ensure we have the current file
            await newState.getStatus();
            const updatedState = get();
            const currentFilePath = updatedState.status.current_file;

            if (currentFilePath) {
              console.log('Audio store: Current file from status:', currentFilePath);

              // Normalize paths for comparison (convert backslashes to forward slashes)
              const normalizePath = (path: string) => path.replace(/\\/g, '/').toLowerCase();
              const normalizedCurrentPath = normalizePath(currentFilePath);

              // Find the chapter that matches this file path
              const matchingChapter = updatedState.chapters.find(ch => {
                const normalizedChapterPath = normalizePath(ch.file_path);
                return normalizedChapterPath === normalizedCurrentPath ||
                       normalizedCurrentPath.endsWith(normalizedChapterPath.split('/').pop() || '') ||
                       normalizedChapterPath.endsWith(normalizedCurrentPath.split('/').pop() || '');
              });

              if (matchingChapter) {
                console.log('Audio store: Found matching chapter:', matchingChapter.title, matchingChapter.id);
                set({ currentChapterId: matchingChapter.id });
              } else {
                console.warn('Audio store: No matching chapter found for file:', currentFilePath);
                console.log('Audio store: Available chapters:', updatedState.chapters.map(ch => ({ id: ch.id, path: ch.file_path })));
                // Fallback: set first chapter if available
                if (updatedState.chapters.length > 0) {
                  console.log('Audio store: Falling back to first chapter:', updatedState.chapters[0].id);
                  set({ currentChapterId: updatedState.chapters[0].id });
                }
              }
            } else {
              console.warn('Audio store: No current file in status, using first chapter as fallback');
              const updatedState = get();
              if (updatedState.chapters.length > 0) {
                set({ currentChapterId: updatedState.chapters[0].id });
              }
            }
          } catch (chapterError) {
            console.warn('Audio store: Failed to load chapters:', chapterError);
          }
        }

        // Minimal delay to ensure everything is properly initialized
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error('Failed to load audio:', error);
        throw error;
      } finally {
        isLoadInProgress = false;
      }
    },
    
    play: async () => {
      if (isPlayInProgress) {
        console.log('Play operation already in progress, skipping');
        return;
      }
      
      try {
        isPlayInProgress = true;
        console.log('Starting play operation...');
        
        // Check if we have a current audiobook loaded
        const currentState = get();
        console.log('Current state before play:', {
          currentAudiobookId: currentState.currentAudiobookId,
          audioInfo: currentState.audioInfo,
          status: currentState.status
        });
        
        if (!currentState.currentAudiobookId) {
          console.warn('No audiobook loaded, cannot play');
          throw new Error('No audiobook loaded');
        }
        
        // Optimistically assume the audio is loaded to reduce perceived delay
        // Only check audio info if we explicitly need to validate
        const tauriCore = await import('@tauri-apps/api/core');
        
        // Optimistic update - assume success immediately to reduce perceived delay
        set(state => ({
          status: { ...state.status, state: 'Playing' }
        }));

        console.log('Calling play_audio...');
        // Play audio with minimal delay
        await tauriCore.invoke('play_audio');
        console.log('play_audio completed successfully');

        // Start progress updates immediately for smoother M4B playback
        get().startProgressUpdates();

        console.log('Play operation completed successfully');

        // Update status immediately to sync with backend
        try {
          await get().getStatus();
          console.log('Status synchronized after play');
        } catch (error) {
          console.warn('Failed to get status after play:', error);
        }
        
      } catch (error) {
        console.error('Failed to play audio:', error);
        // Revert optimistic update on failure
        set(state => ({
          status: { ...state.status, state: 'Paused' }
        }));
        throw error;
      } finally {
        isPlayInProgress = false;
        console.log('Play operation lock released');
      }
    },
    
    pause: async () => {
      if (isPauseInProgress) {
        console.log('Pause operation already in progress, skipping');
        return;
      }
      
      try {
        isPauseInProgress = true;
        console.log('Starting pause operation...');
        
        // Optimistic update - assume success immediately
        set(state => ({
          status: { ...state.status, state: 'Paused' }
        }));
        
        // Stop progress updates immediately
        get().stopProgressUpdates();
        
        const tauriCore = await import('@tauri-apps/api/core');
        await tauriCore.invoke('pause_audio');
        
        console.log('Pause operation completed successfully');
        
        // Update status in background to confirm
        setTimeout(() => {
          get().getStatus().catch(error => {
            console.warn('Failed to get status after pause:', error);
          });
        }, 100);
        
      } catch (error) {
        console.error('Failed to pause audio:', error);
        // Revert optimistic update on failure
        set(state => ({
          status: { ...state.status, state: 'Playing' }
        }));
        throw error;
      } finally {
        isPauseInProgress = false;
        console.log('Pause operation lock released');
      }
    },
    
    stop: async () => {
      if (isStopInProgress) {
        console.log('Stop operation already in progress, skipping');
        return;
      }

      try {
        isStopInProgress = true;
        const tauriCore = await import('@tauri-apps/api/core');
        await tauriCore.invoke('stop_audio');

        // Reset interpolation tracking
        lastServerPosition = 0;
        lastServerTimestamp = Date.now();

        await get().getStatus();
        get().stopProgressUpdates();
        set({ isPlayerVisible: false });

        // Additional delay to ensure audio is fully stopped
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error('Failed to stop audio:', error);
        throw error;
      } finally {
        isStopInProgress = false;
      }
    },

    seek: async (positionSeconds: number) => {
      try {
        console.log('⏭️ SEEK: Seeking to position:', positionSeconds);
        const tauriCore = await import('@tauri-apps/api/core');
        await tauriCore.invoke('seek_audio', { positionSeconds });

        // Reset interpolation tracking immediately
        lastServerPosition = positionSeconds;
        lastServerTimestamp = Date.now();

        // Wait for backend to stabilize after seek
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log('⏭️ SEEK: Getting status after seek');
        await get().getStatus();
        console.log('⏭️ SEEK: Seek operation completed');
      } catch (error) {
        console.error('Failed to seek audio:', error);
        throw error;
      }
    },
    
    updateVolume: async (volume: number) => {
      try {
        const tauriCore = await import('@tauri-apps/api/core');
        await tauriCore.invoke('set_volume', { volume });
        set({ volume });
        await get().getStatus();
      } catch (error) {
        console.error('Failed to update volume:', error);
        throw error;
      }
    },
    
    updateSpeed: async (speed: number) => {
      try {
        const tauriCore = await import('@tauri-apps/api/core');
        await tauriCore.invoke('set_playback_speed', { speed });
        await get().getStatus();
      } catch (error) {
        console.error('Failed to update speed:', error);
        throw error;
      }
    },
    
    getStatus: async () => {
      try {
        const tauriCore = await import('@tauri-apps/api/core');
        const status = await tauriCore.invoke('get_playback_status') as PlaybackStatus;

        // Update interpolation tracking
        lastServerPosition = status.position;
        lastServerTimestamp = Date.now();

        set({ status });
      } catch (error) {
        console.error('Failed to get status:', error);
      }
    },

    startProgressUpdates: () => {
      // Clear any existing intervals
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (interpolationInterval) {
        clearInterval(interpolationInterval);
      }

      // Fetch actual position from backend more frequently for M4B files
      // 500ms polling provides better responsiveness while still being efficient
      progressInterval = setInterval(async () => {
        try {
          await get().getStatus();
        } catch (error) {
          console.warn('Failed to get audio status:', error);
        }
      }, 500) as unknown as number;

      // Smooth interpolation at 60fps for visual updates
      interpolationInterval = setInterval(() => {
        const state = get();

        // Only interpolate when playing
        if (state.status.state === 'Playing') {
          const now = Date.now();
          const timeSinceLastUpdate = (now - lastServerTimestamp) / 1000; // Convert to seconds
          const speed = state.status.speed || 1.0;

          // Calculate interpolated position
          const interpolatedPosition = lastServerPosition + (timeSinceLastUpdate * speed);

          // More aggressive update threshold for M4B files to show immediate progress
          // Reduced from 0.05s to 0.01s for smoother visual updates
          if (Math.abs(interpolatedPosition - state.status.position) > 0.01) {
            set({
              status: {
                ...state.status,
                position: Math.min(interpolatedPosition, state.status.duration || Infinity)
              }
            });
          }
        }
      }, 16) as unknown as number; // ~60fps for smooth updates
    },

    stopProgressUpdates: () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (interpolationInterval) {
        clearInterval(interpolationInterval);
        interpolationInterval = null;
      }
    },

    // Chapter navigation functions
    loadChaptersForAudiobook: async (audiobookId: string) => {
      try {
        const currentState = get();

        // Skip if we already have chapters for this audiobook
        if (currentState.currentAudiobookId === audiobookId && currentState.chapters.length > 0) {
          console.log('🔄 Chapters already loaded for this audiobook, skipping');
          return;
        }

        console.log('🔄 Loading chapters for audiobook:', audiobookId);
        const tauriCore = await import('@tauri-apps/api/core');
        const chapterList = await tauriCore.invoke<any[]>('get_audiobook_chapters', {
          audiobookId: audiobookId
        });

        console.log('✅ Loaded chapters:', chapterList.length, 'chapters');
        set({ chapters: chapterList });

        console.log(`✅ Loaded ${chapterList.length} chapters for audiobook`);
      } catch (error) {
        console.error('❌ Failed to load chapters for audiobook:', error);
        // Even on error, ensure chapters is set to empty array to prevent infinite loading
        set({ chapters: [] });
      }
    },

    skipToPreviousChapter: async () => {
      const { chapters, currentChapterId } = get();
      
      if (chapters.length === 0) {
        console.log('No chapters available');
        return;
      }
      
      const currentIndex = chapters.findIndex(ch => ch.id === currentChapterId);
      console.log('Skip to previous chapter - current index:', currentIndex);
      
      if (currentIndex > 0) {
        const prevChapter = chapters[currentIndex - 1];
        console.log('Switching to previous chapter:', prevChapter.title);
        
        try {
          const tauriCore = await import('@tauri-apps/api/core');
          await tauriCore.invoke('play_chapter', { chapterId: prevChapter.id });
          set({ currentChapterId: prevChapter.id });
          console.log('Successfully switched to previous chapter');
          
          // Update status after chapter change
          setTimeout(() => {
            get().getStatus();
          }, 300);
        } catch (error) {
          console.error('Failed to skip to previous chapter:', error);
        }
      } else {
        console.log('Already at first chapter');
      }
    },

    skipToNextChapter: async () => {
      const { chapters, currentChapterId } = get();
      
      if (chapters.length === 0) {
        console.log('No chapters available');
        return;
      }
      
      const currentIndex = chapters.findIndex(ch => ch.id === currentChapterId);
      console.log('Skip to next chapter - current index:', currentIndex);
      
      if (currentIndex < chapters.length - 1) {
        const nextChapter = chapters[currentIndex + 1];
        console.log('Switching to next chapter:', nextChapter.title);
        
        try {
          const tauriCore = await import('@tauri-apps/api/core');
          await tauriCore.invoke('play_chapter', { chapterId: nextChapter.id });
          set({ currentChapterId: nextChapter.id });
          console.log('Successfully switched to next chapter');
          
          // Update status after chapter change
          setTimeout(() => {
            get().getStatus();
          }, 300);
        } catch (error) {
          console.error('Failed to skip to next chapter:', error);
        }
      } else {
        console.log('Already at last chapter');
      }
    },
  }))
);