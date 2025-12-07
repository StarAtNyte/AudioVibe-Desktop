import { create } from 'zustand';
import { Ebook, ReadingProgress, ReaderSettings, Bookmark, Annotation } from '../types/ebook';

interface ReaderState {
  // Current reading session
  currentEbook: Ebook | null;
  currentPage: number;
  currentCFI: string | null;
  totalPages: number;
  isFullscreen: boolean;

  // Reader settings
  readerSettings: Partial<ReaderSettings>;

  // Side panels
  showTOC: boolean;
  showBookmarks: boolean;
  showAnnotations: boolean;

  // Data
  bookmarks: Bookmark[];
  annotations: Annotation[];
  readingProgress: ReadingProgress | null;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  loadEbook: (ebookId: string) => Promise<void>;
  setCurrentPage: (page: number) => void;
  setCurrentCFI: (cfi: string) => void;
  setTotalPages: (total: number) => void;
  toggleFullscreen: () => void;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  toggleTOC: () => void;
  toggleBookmarks: () => void;
  toggleAnnotations: () => void;
  saveProgress: () => Promise<void>;
  addBookmark: (bookmark: Partial<Bookmark>) => Promise<void>;
  addAnnotation: (annotation: Partial<Annotation>) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  clearReader: () => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  // Initial state
  currentEbook: null,
  currentPage: 1,
  currentCFI: null,
  totalPages: 0,
  isFullscreen: false,
  readerSettings: {
    font_family: 'serif',
    font_size: 18,
    line_height: 1.6,
    theme: 'light',
    flow_mode: 'paginated',
  },
  showTOC: false,
  showBookmarks: false,
  showAnnotations: false,
  bookmarks: [],
  annotations: [],
  readingProgress: null,
  isLoading: false,
  error: null,

  // Load ebook and its data
  loadEbook: async (ebookId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Fetch ebook details
      const ebook = await invoke('get_ebook_by_id', { id: ebookId }) as Ebook | null;
      if (!ebook) {
        throw new Error('Ebook not found');
      }

      // Fetch reading progress
      const progress = await invoke('get_reading_progress', { ebookId }) as ReadingProgress | null;

      // Fetch bookmarks
      const bookmarks = await invoke('get_ebook_bookmarks', { ebookId }) as Bookmark[];

      // Fetch annotations
      const annotations = await invoke('get_ebook_annotations', { ebookId }) as Annotation[];

      // Fetch reader settings
      const settings = await invoke('get_reader_settings', { ebookId }) as ReaderSettings | null;

      set({
        currentEbook: ebook,
        currentPage: progress?.current_page || 1,
        currentCFI: progress?.current_cfi || null,
        readingProgress: progress,
        bookmarks,
        annotations,
        readerSettings: settings || get().readerSettings,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load ebook:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load ebook', isLoading: false });
    }
  },

  setCurrentPage: (page) => {
    set({ currentPage: page });
    // Auto-save progress after page change (debounced in component)
  },

  setCurrentCFI: (cfi) => {
    set({ currentCFI: cfi });
    // Auto-save progress after CFI change (debounced in component)
  },

  setTotalPages: (total) => set({ totalPages: total }),

  toggleFullscreen: () => {
    const { isFullscreen } = get();
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    set({ isFullscreen: !isFullscreen });
  },

  updateSettings: async (settings) => {
    const { currentEbook, readerSettings } = get();
    if (!currentEbook) return;

    const newSettings = { ...readerSettings, ...settings };
    set({ readerSettings: newSettings });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_reader_settings', {
        ebookId: currentEbook.id,
        dto: settings,
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  },

  toggleTOC: () => set((state) => ({ showTOC: !state.showTOC })),
  toggleBookmarks: () => set((state) => ({ showBookmarks: !state.showBookmarks })),
  toggleAnnotations: () => set((state) => ({ showAnnotations: !state.showAnnotations })),

  saveProgress: async () => {
    const { currentEbook, currentPage, currentCFI, totalPages } = get();
    if (!currentEbook) return;

    const percentageComplete = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_reading_progress', {
        ebookId: currentEbook.id,
        dto: {
          current_page: currentPage,
          current_cfi: currentCFI,
          percentage_complete: percentageComplete,
        },
      });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  },

  addBookmark: async (bookmark) => {
    const { currentEbook } = get();
    if (!currentEbook) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const newBookmark = await invoke('create_bookmark', {
        dto: {
          ebook_id: currentEbook.id,
          ...bookmark,
        },
      }) as Bookmark;

      set((state) => ({
        bookmarks: [newBookmark, ...state.bookmarks],
      }));
    } catch (error) {
      console.error('Failed to add bookmark:', error);
      throw error;
    }
  },

  addAnnotation: async (annotation) => {
    const { currentEbook } = get();
    if (!currentEbook) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const newAnnotation = await invoke('create_annotation', {
        dto: {
          ebook_id: currentEbook.id,
          ...annotation,
        },
      }) as Annotation;

      set((state) => ({
        annotations: [newAnnotation, ...state.annotations],
      }));
    } catch (error) {
      console.error('Failed to add annotation:', error);
      throw error;
    }
  },

  deleteBookmark: async (id) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_bookmark', { id });

      set((state) => ({
        bookmarks: state.bookmarks.filter((b) => b.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
      throw error;
    }
  },

  deleteAnnotation: async (id) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_annotation', { id });

      set((state) => ({
        annotations: state.annotations.filter((a) => a.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      throw error;
    }
  },

  clearReader: () => {
    set({
      currentEbook: null,
      currentPage: 1,
      currentCFI: null,
      totalPages: 0,
      isFullscreen: false,
      showTOC: false,
      showBookmarks: false,
      showAnnotations: false,
      bookmarks: [],
      annotations: [],
      readingProgress: null,
    });
  },
}));
