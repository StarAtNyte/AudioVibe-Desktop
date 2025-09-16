import { create } from 'zustand';
import { Audiobook, Collection, CreateAudiobookDto, CreateCollectionDto } from '../types';

interface LibraryState {
  // Data
  audiobooks: Audiobook[];
  collections: Collection[];
  
  // UI state
  selectedAudiobooks: string[];
  viewMode: 'grid' | 'list';
  sortBy: 'title' | 'author' | 'added_date' | 'duration';
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
  selectedGenres: string[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setAudiobooks: (audiobooks: Audiobook[]) => void;
  setCollections: (collections: Collection[]) => void;
  setSelectedAudiobooks: (ids: string[]) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: 'title' | 'author' | 'added_date' | 'duration') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setSearchQuery: (query: string) => void;
  setSelectedGenres: (genres: string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // API actions
  fetchAudiobooks: () => Promise<void>;
  searchAudiobooks: (query: string) => Promise<void>;
  createAudiobook: (dto: CreateAudiobookDto) => Promise<void>;
  deleteAudiobook: (id: string) => Promise<void>;
  
  // Collection actions
  fetchCollections: () => Promise<void>;
  createCollection: (dto: CreateCollectionDto) => Promise<void>;
  
  // Utility functions
  getFilteredAudiobooks: () => Audiobook[];
  toggleAudiobookSelection: (id: string) => void;
  clearSelection: () => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  // Initial state - load local data immediately for development
  audiobooks: [],
  collections: [],
  selectedAudiobooks: [],
  viewMode: 'grid',
  sortBy: 'added_date',
  sortOrder: 'desc',
  searchQuery: '',
  selectedGenres: [],
  isLoading: false,
  error: null,
  
  // State setters
  setAudiobooks: (audiobooks) => set({ audiobooks }),
  setCollections: (collections) => set({ collections }),
  setSelectedAudiobooks: (selectedAudiobooks) => set({ selectedAudiobooks }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedGenres: (selectedGenres) => set({ selectedGenres }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  // API actions
  fetchAudiobooks: async () => {
    const { setLoading, setError } = get();
    try {
      setLoading(true);
      setError(null);
      
      let useLocalData = false;
      
      try {
        // Check if we're actually in Tauri environment
        const { isTauri } = await import('@tauri-apps/api/core');
        const isInTauri = await isTauri();
        const hasTauriGlobal = typeof (window as any).__TAURI__ !== 'undefined';
        
        console.log('fetchAudiobooks - isTauri():', isInTauri);
        console.log('fetchAudiobooks - hasTauriGlobal:', hasTauriGlobal);
        
        if (!isInTauri && !hasTauriGlobal) {
          useLocalData = true;
        } else {
          // Try to call Tauri API
          const { invoke } = await import('@tauri-apps/api/core');
          const audiobooks = await invoke('get_all_audiobooks') as Audiobook[];
          
          // Debug: Log all audiobook data to see what we're getting from backend
          console.log('📚 BACKEND DATA - Fetched audiobooks:', audiobooks.length);
          audiobooks.forEach((book, index) => {
            console.log(`📖 Audiobook ${index + 1}:`, {
              id: book.id,
              title: book.title,
              author: book.author,
              duration: book.duration,
              cover_image_path: book.cover_image_path,
              file_path: book.file_path,
              file_size: book.file_size,
              genre: book.genre,
              description: book.description
            });
          });
          
          set({ audiobooks });
          return;
        }
      } catch (tauriError) {
        console.warn('Tauri API failed, falling back to local data:', tauriError);
        useLocalData = true;
      }
      
      if (useLocalData) {
        console.log('Using local mock data for audiobooks');
        const { localBooksDatabase } = await import('../data/localBooks');
        console.log('📚 LOCAL DATA - Loaded audiobooks:', localBooksDatabase.length);
        localBooksDatabase.forEach((book, index) => {
          console.log(`📖 Local Audiobook ${index + 1}:`, {
            id: book.id,
            title: book.title,
            author: book.author,
            genre: book.genre
          });
        });
        set({ audiobooks: localBooksDatabase });
      }
    } catch (error) {
      console.error('Failed to fetch audiobooks:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch audiobooks');
    } finally {
      setLoading(false);
    }
  },
  
  searchAudiobooks: async (query: string) => {
    const { setLoading, setError } = get();
    try {
      setLoading(true);
      setError(null);
      
      const tauriCore = await import('@tauri-apps/api/core');
      const audiobooks = query 
        ? await tauriCore.invoke('search_audiobooks', { query }) as Audiobook[]
        : await tauriCore.invoke('get_all_audiobooks') as Audiobook[];
      
      set({ audiobooks, searchQuery: query });
    } catch (error) {
      console.error('Failed to search audiobooks:', error);
      setError(error instanceof Error ? error.message : 'Failed to search audiobooks');
    } finally {
      setLoading(false);
    }
  },
  
  createAudiobook: async (dto: CreateAudiobookDto) => {
    const { setLoading, setError, fetchAudiobooks } = get();
    try {
      setLoading(true);
      setError(null);
      
      const tauriCore = await import('@tauri-apps/api/core');
      await tauriCore.invoke('create_audiobook', { dto });
      
      // Refresh the list
      await fetchAudiobooks();
    } catch (error) {
      console.error('Failed to create audiobook:', error);
      setError(error instanceof Error ? error.message : 'Failed to create audiobook');
      throw error;
    } finally {
      setLoading(false);
    }
  },
  
  deleteAudiobook: async (id: string) => {
    const { setLoading, setError, fetchAudiobooks } = get();
    try {
      setLoading(true);
      setError(null);
      
      const tauriCore = await import('@tauri-apps/api/core');
      await tauriCore.invoke('delete_audiobook', { id });
      
      // Refresh the list
      await fetchAudiobooks();
    } catch (error) {
      console.error('Failed to delete audiobook:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete audiobook');
      throw error;
    } finally {
      setLoading(false);
    }
  },
  
  // Collection actions
  fetchCollections: async () => {
    // Implementation for collections would go here
    // For now, just set empty array since collections aren't fully implemented yet
    set({ collections: [] });
  },
  
  createCollection: async (dto: CreateCollectionDto) => {
    // Implementation for collections would go here
    console.log('Creating collection:', dto);
  },
  
  // Utility functions
  getFilteredAudiobooks: () => {
    const { audiobooks, searchQuery, selectedGenres, sortBy, sortOrder } = get();
    
    let filtered = audiobooks;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(book => 
        book.title.toLowerCase().includes(query) ||
        book.author?.toLowerCase().includes(query) ||
        book.narrator?.toLowerCase().includes(query) ||
        book.description?.toLowerCase().includes(query)
      );
    }
    
    // Apply genre filter
    if (selectedGenres.length > 0) {
      filtered = filtered.filter(book => 
        book.genre && selectedGenres.includes(book.genre)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'author':
          comparison = (a.author || '').localeCompare(b.author || '');
          break;
        case 'added_date':
          comparison = new Date(a.added_date).getTime() - new Date(b.added_date).getTime();
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  },
  
  toggleAudiobookSelection: (id: string) => {
    const { selectedAudiobooks } = get();
    const newSelection = selectedAudiobooks.includes(id)
      ? selectedAudiobooks.filter(selectedId => selectedId !== id)
      : [...selectedAudiobooks, id];
    
    set({ selectedAudiobooks: newSelection });
  },
  
  clearSelection: () => {
    set({ selectedAudiobooks: [] });
  },
}));

// Note: Store initialization removed - recommendations are now handled separately from library