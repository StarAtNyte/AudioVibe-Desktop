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
    setCurrentAudiobookId: (currentAudiobookId) => set({ currentAudiobookId }),
    setCurrentChapterId: (currentChapterId) => set({ currentChapterId }),
    setChapters: (chapters) => set({ chapters }),
    setPlayerVisible: (isPlayerVisible) => set({ isPlayerVisible }),
    setVolume: (volume) => set({ volume }),
    setMuted: (isMuted) => set({ isMuted }),
    setAudiobook: (audiobookId) => set({ currentAudiobookId: audiobookId }),
    
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
          await newState.getStatus();
          console.log('Audio store: Status updated after loading');
        } catch (statusError) {
          console.warn('Failed to get status after loading audio:', statusError);
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
        
        // Start progress updates immediately
        get().startProgressUpdates();
        
        console.log('Play operation completed successfully');
        
        // Update status in background to confirm
        setTimeout(() => {
          get().getStatus().catch(error => {
            console.warn('Failed to get status after play:', error);
          });
        }, 50);
        
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
        set({ status });
      } catch (error) {
        console.error('Failed to get status:', error);
      }
    },

    startProgressUpdates: () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      progressInterval = setInterval(async () => {
        const currentStatus = get().status;
        if (currentStatus.state === 'Playing') {
          try {
            await get().getStatus();
          } catch (error) {
            console.warn('Failed to get audio status:', error);
          }
        }
      }, 1000); // Update every 1 second for smoother progress updates
    },

    stopProgressUpdates: () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    },

    // Chapter navigation functions
    loadChaptersForAudiobook: async (audiobookId: string) => {
      try {
        const tauriCore = await import('@tauri-apps/api/core');
        const chapterList = await tauriCore.invoke<any[]>('get_audiobook_chapters', {
          audiobookId: audiobookId
        });
        
        console.log('Loaded chapters:', chapterList);
        set({ chapters: chapterList });
        
        // If no current chapter is set and we have chapters, set the first one
        const { currentChapterId } = get();
        if (chapterList.length > 0 && !currentChapterId) {
          const firstChapterId = chapterList[0].id;
          console.log('Setting first chapter as current:', firstChapterId);
          set({ currentChapterId: firstChapterId });
          
          // Also play the first chapter to ensure it's loaded in the player
          try {
            await tauriCore.invoke('play_chapter', { chapterId: firstChapterId });
            console.log('First chapter loaded in player successfully');
          } catch (playError) {
            console.error('Failed to load first chapter in player:', playError);
          }
        }
        
        console.log(`Loaded ${chapterList.length} chapters for audiobook, current chapter: ${get().currentChapterId}`);
      } catch (error) {
        console.error('Failed to load chapters for audiobook:', error);
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