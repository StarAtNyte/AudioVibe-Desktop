import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Theme } from '../types';
import { useLibraryStore } from './library';

interface AppState {
  // Theme management
  theme: Theme;
  setTheme: (theme: Theme) => void;
  
  // App initialization
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  setInitialized: (initialized: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // UI state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Responsive UI state
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  isMobile: boolean;
  isTablet: boolean;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setIsMobile: (mobile: boolean) => void;
  setIsTablet: (tablet: boolean) => void;
  
  // Audio Settings
  defaultVolume: number;
  defaultPlaybackSpeed: number;
  autoPlayNextChapter: boolean;
  setDefaultVolume: (volume: number) => void;
  setDefaultPlaybackSpeed: (speed: number) => void;
  setAutoPlayNextChapter: (enabled: boolean) => void;
  
  // Library Settings
  defaultLibraryPath: string;
  autoScanForAudiobooks: boolean;
  extractMetadataAutomatically: boolean;
  setDefaultLibraryPath: (path: string) => void;
  setAutoScanForAudiobooks: (enabled: boolean) => void;
  setExtractMetadataAutomatically: (enabled: boolean) => void;
  
  // Backup Settings
  localBackupPath: string;
  autoBackupEnabled: boolean;
  setLocalBackupPath: (path: string) => void;
  setAutoBackupEnabled: (enabled: boolean) => void;
  
  // Privacy Settings
  shareAnalytics: boolean;
  sendCrashReports: boolean;
  setShareAnalytics: (enabled: boolean) => void;
  setSendCrashReports: (enabled: boolean) => void;
  
  // Actions
  clearAppData: () => Promise<void>;
  
  // Initialize app
  initialize: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: { mode: 'dark' },
      isInitialized: false,
      isLoading: false,
      error: null,
      sidebarCollapsed: false,
      
      // Responsive UI state
      leftSidebarOpen: true,
      rightPanelOpen: true,
      isMobile: false,
      isTablet: false,
      
      // Audio Settings
      defaultVolume: 1,
      defaultPlaybackSpeed: 1,
      autoPlayNextChapter: false,
      
      // Library Settings
      defaultLibraryPath: '',
      autoScanForAudiobooks: false,
      extractMetadataAutomatically: true,
      
      // Backup Settings
      localBackupPath: '',
      autoBackupEnabled: false,
      
      // Privacy Settings
      shareAnalytics: false,
      sendCrashReports: true,
      
      // Actions
      setTheme: (theme) => set({ theme }),
      setInitialized: (isInitialized) => set({ isInitialized }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      
      // Responsive UI Actions
      setLeftSidebarOpen: (leftSidebarOpen) => set({ leftSidebarOpen }),
      setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
      setIsMobile: (isMobile) => set({ isMobile }),
      setIsTablet: (isTablet) => set({ isTablet }),
      
      // Audio Settings Actions
      setDefaultVolume: (defaultVolume) => set({ defaultVolume }),
      setDefaultPlaybackSpeed: (defaultPlaybackSpeed) => set({ defaultPlaybackSpeed }),
      setAutoPlayNextChapter: (autoPlayNextChapter) => set({ autoPlayNextChapter }),
      
      // Library Settings Actions
      setDefaultLibraryPath: (defaultLibraryPath) => set({ defaultLibraryPath }),
      setAutoScanForAudiobooks: (autoScanForAudiobooks) => set({ autoScanForAudiobooks }),
      setExtractMetadataAutomatically: (extractMetadataAutomatically) => set({ extractMetadataAutomatically }),
      
      // Backup Settings Actions
      setLocalBackupPath: (localBackupPath) => set({ localBackupPath }),
      setAutoBackupEnabled: (autoBackupEnabled) => set({ autoBackupEnabled }),
      
      // Privacy Settings Actions
      setShareAnalytics: (shareAnalytics) => set({ shareAnalytics }),
      setSendCrashReports: (sendCrashReports) => set({ sendCrashReports }),
      
      // Clear App Data
      clearAppData: async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('clear_app_data');
          
          // Reset all settings to defaults
          set({
            theme: { mode: 'dark' },
            defaultVolume: 1,
            defaultPlaybackSpeed: 1,
            autoPlayNextChapter: false,
            defaultLibraryPath: '',
            autoScanForAudiobooks: false,
            extractMetadataAutomatically: true,
            localBackupPath: '',
            autoBackupEnabled: false,
            shareAnalytics: false,
            sendCrashReports: true,
          });
        } catch (error) {
          console.error('Failed to clear app data:', error);
          throw error;
        }
      },
      
      // Initialize app
      initialize: async () => {
        const { setLoading, setError, setInitialized } = get();
        
        try {
          setLoading(true);
          setError(null);
          
          // Check if we're actually in Tauri environment with multiple methods
          console.log('Window object:', typeof window);
          console.log('Window.__TAURI__:', typeof (window as any).__TAURI__);
          console.log('Location protocol:', window?.location?.protocol);
          
          const { isTauri } = await import('@tauri-apps/api/core');
          const isInTauri = await isTauri();
          console.log('isTauri() result:', isInTauri);
          
          // Force Tauri mode if we detect __TAURI__ object
          const hasTauriGlobal = typeof (window as any).__TAURI__ !== 'undefined';
          console.log('Has __TAURI__ global:', hasTauriGlobal);
          
          if (!isInTauri && !hasTauriGlobal) {
            console.warn('Not running in Tauri environment - skipping initialization');
            setInitialized(true);
            return;
          }
          
          console.log('Running in Tauri environment - initializing...');
          
          // Wait for Tauri to be ready
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          console.log('About to import invoke function...');
          const { invoke } = await import('@tauri-apps/api/core');
          console.log('Invoke function imported:', typeof invoke);
          
          console.log('Calling initialize_app...');
          const initResult = await invoke('initialize_app');
          console.log('App initialized successfully:', initResult);
          
          // Fetch audiobooks after app initialization
          console.log('Fetching audiobooks...');
          const { fetchAudiobooks } = useLibraryStore.getState();
          await fetchAudiobooks();
          
          setInitialized(true);
        } catch (error) {
          console.error('Failed to initialize app:', error);
          setError(error instanceof Error ? error.message : 'Failed to initialize app');
        } finally {
          setLoading(false);
        }
      },
    }),
    {
      name: 'audiovibe-app-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        leftSidebarOpen: state.leftSidebarOpen,
        rightPanelOpen: state.rightPanelOpen,
        defaultVolume: state.defaultVolume,
        defaultPlaybackSpeed: state.defaultPlaybackSpeed,
        autoPlayNextChapter: state.autoPlayNextChapter,
        defaultLibraryPath: state.defaultLibraryPath,
        autoScanForAudiobooks: state.autoScanForAudiobooks,
        extractMetadataAutomatically: state.extractMetadataAutomatically,
        localBackupPath: state.localBackupPath,
        autoBackupEnabled: state.autoBackupEnabled,
        shareAnalytics: state.shareAnalytics,
        sendCrashReports: state.sendCrashReports,
      }),
    }
  )
);