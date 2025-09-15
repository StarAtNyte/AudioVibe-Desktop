import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface DownloadItem {
  id: string;
  title: string;
  author: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  downloadSpeed?: number; // bytes per second
  estimatedTimeRemaining?: number; // seconds
  error?: string;
  startTime?: Date;
  endTime?: Date;
  coverUrl?: string;
  downloadUrl: string;
  filePath?: string;
  // Additional metadata for LibriVox imports
  description?: string;
  genre?: string;
  runtime?: string;
}

interface DownloadsState {
  downloads: DownloadItem[];
  isDownloading: boolean;
  
  // Actions
  addDownload: (item: Omit<DownloadItem, 'id' | 'status' | 'progress' | 'downloadedBytes' | 'totalBytes' | 'startTime'>) => string;
  updateDownload: (id: string, updates: Partial<DownloadItem>) => void;
  removeDownload: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  retryDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  startDownload: (id: string) => void;
  
  // Computed values
  getActiveDownloads: () => DownloadItem[];
  getCompletedDownloads: () => DownloadItem[];
  getFailedDownloads: () => DownloadItem[];
  getTotalProgress: () => number;
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  downloads: [],
  isDownloading: false,

  addDownload: (item) => {
    const id = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newDownload: DownloadItem = {
      ...item,
      id,
      status: 'pending',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      startTime: new Date(),
    };

    set((state) => ({
      downloads: [newDownload, ...state.downloads],
      isDownloading: true,
    }));

    // Start the download
    get().startDownload(id);
    
    return id;
  },

  updateDownload: (id, updates) => {
    set((state) => ({
      downloads: state.downloads.map((download) =>
        download.id === id ? { ...download, ...updates } : download
      ),
      isDownloading: state.downloads.some(d => 
        d.id === id ? (updates.status === 'downloading' || updates.status === 'pending') : 
        (d.status === 'downloading' || d.status === 'pending')
      ),
    }));
  },

  removeDownload: (id) => {
    // Cancel download if it's in progress
    const download = get().downloads.find(d => d.id === id);
    if (download && (download.status === 'downloading' || download.status === 'pending')) {
      get().cancelDownload(id);
    }

    set((state) => ({
      downloads: state.downloads.filter((download) => download.id !== id),
    }));
  },

  clearCompleted: () => {
    set((state) => ({
      downloads: state.downloads.filter((download) => download.status !== 'completed'),
    }));
  },

  clearAll: () => {
    // Cancel all active downloads first
    const activeDownloads = get().getActiveDownloads();
    activeDownloads.forEach(download => get().cancelDownload(download.id));
    
    set({ downloads: [], isDownloading: false });
  },

  retryDownload: (id) => {
    const download = get().downloads.find(d => d.id === id);
    if (download && download.status === 'failed') {
      get().updateDownload(id, {
        status: 'pending',
        progress: 0,
        downloadedBytes: 0,
        error: undefined,
        startTime: new Date(),
        endTime: undefined,
      });
      get().startDownload(id);
    }
  },

  cancelDownload: async (id) => {
    const download = get().downloads.find(d => d.id === id);
    if (!download) return;

    if (download.status === 'downloading' || download.status === 'pending') {
      try {
        // Call Tauri backend to cancel the download
        await invoke('cancel_download', { downloadId: id });
      } catch (error) {
        console.error('Failed to cancel download:', error);
      }

      get().updateDownload(id, {
        status: 'cancelled',
        endTime: new Date(),
      });
    }
  },

  startDownload: async (id: string) => {
    const download = get().downloads.find(d => d.id === id);
    if (!download) return;

    try {
      get().updateDownload(id, { status: 'downloading' });

      console.log(`📥 Starting LibriVox download: "${download.title}" by ${download.author}`);
      console.log(`Download URL: ${download.downloadUrl}`);

      // Use the existing LibriVox import command instead of a separate download command
      const result = await invoke('import_librivox_audiobook', {
        params: {
          title: download.title,
          author: download.author,
          zipUrl: download.downloadUrl,
          description: download.description || `Downloaded from LibriVox: ${download.title} by ${download.author}`,
          genre: download.genre || null,
          runtime: download.runtime,
          coverUrl: download.coverUrl
        }
      });

      console.log('✅ LibriVox download completed:', result);
      console.log('✅ Result type:', typeof result, 'Value:', result);
      
      get().updateDownload(id, {
        status: 'completed',
        progress: 100,
        endTime: new Date(),
        filePath: result as string,
      });

      // Refresh the library to show the new audiobook
      try {
        const { useLibraryStore } = await import('./library');
        console.log('🔄 Refreshing library after download completion...');
        await useLibraryStore.getState().fetchAudiobooks();
        console.log('✅ Library refreshed after download completion');
        
        // Add a small delay and try to find the imported audiobook
        setTimeout(() => {
          const libraryState = useLibraryStore.getState();
          const importedBook = libraryState.audiobooks.find(book => 
            book.title === download.title && book.author === download.author
          );
          if (importedBook) {
            console.log('✅ Found imported audiobook in library:', {
              id: importedBook.id,
              title: importedBook.title,
              author: importedBook.author,
              duration: importedBook.duration,
              cover_image_path: importedBook.cover_image_path
            });
          } else {
            console.warn('⚠️ Could not find imported audiobook in library after refresh');
          }
        }, 1000);
      } catch (error) {
        console.warn('Failed to refresh library after download:', error);
      }

    } catch (error) {
      console.error('❌ LibriVox download failed:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Download failed';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      get().updateDownload(id, {
        status: 'failed',
        error: errorMessage,
        endTime: new Date(),
      });
    }
  },

  getActiveDownloads: () => {
    return get().downloads.filter(d => d.status === 'downloading' || d.status === 'pending');
  },

  getCompletedDownloads: () => {
    return get().downloads.filter(d => d.status === 'completed');
  },

  getFailedDownloads: () => {
    return get().downloads.filter(d => d.status === 'failed');
  },

  getTotalProgress: () => {
    const activeDownloads = get().getActiveDownloads();
    if (activeDownloads.length === 0) return 0;
    
    const totalProgress = activeDownloads.reduce((sum, download) => sum + download.progress, 0);
    return totalProgress / activeDownloads.length;
  },
}));

// Listen for download progress updates from Tauri backend
if (typeof window !== 'undefined' && (window as any).__TAURI__) {
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('download_progress', (event: any) => {
      const { downloadId, progress, downloadedBytes, totalBytes, downloadSpeed } = event.payload;
      const store = useDownloadsStore.getState();
      
      store.updateDownload(downloadId, {
        progress: Math.round(progress * 100),
        downloadedBytes,
        totalBytes,
        downloadSpeed,
        estimatedTimeRemaining: downloadSpeed > 0 ? (totalBytes - downloadedBytes) / downloadSpeed : undefined,
      });
    });

    listen('download_completed', (event: any) => {
      const { downloadId, filePath } = event.payload;
      const store = useDownloadsStore.getState();
      
      store.updateDownload(downloadId, {
        status: 'completed',
        progress: 100,
        endTime: new Date(),
        filePath,
      });
    });

    listen('download_error', (event: any) => {
      const { downloadId, error } = event.payload;
      const store = useDownloadsStore.getState();
      
      store.updateDownload(downloadId, {
        status: 'failed',
        error,
        endTime: new Date(),
      });
    });
  }).catch(console.error);
}