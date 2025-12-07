import { create } from 'zustand';
import { Ebook, CreateEbookDto, UpdateEbookDto } from '../types/ebook';

interface EbookState {
  // Data
  ebooks: Ebook[];

  // UI state
  selectedEbooks: string[];
  viewMode: 'grid' | 'list';
  sortBy: 'title' | 'author' | 'added_date' | 'recently_read';
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
  selectedFormats: ('pdf' | 'epub')[];
  selectedGenres: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setEbooks: (ebooks: Ebook[]) => void;
  setSelectedEbooks: (ids: string[]) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: 'title' | 'author' | 'added_date' | 'recently_read') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setSearchQuery: (query: string) => void;
  setSelectedFormats: (formats: ('pdf' | 'epub')[]) => void;
  setSelectedGenres: (genres: string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // API actions
  fetchEbooks: () => Promise<void>;
  searchEbooks: (query: string) => Promise<void>;
  createEbook: (dto: CreateEbookDto) => Promise<void>;
  updateEbook: (id: string, dto: UpdateEbookDto) => Promise<void>;
  deleteEbook: (id: string) => Promise<void>;

  // Utility functions
  getFilteredEbooks: () => Ebook[];
  toggleEbookSelection: (id: string) => void;
  clearSelection: () => void;
}

export const useEbookStore = create<EbookState>((set, get) => ({
  // Initial state
  ebooks: [],
  selectedEbooks: [],
  viewMode: 'grid',
  sortBy: 'added_date',
  sortOrder: 'desc',
  searchQuery: '',
  selectedFormats: [],
  selectedGenres: [],
  isLoading: false,
  error: null,

  // State setters
  setEbooks: (ebooks) => set({ ebooks }),
  setSelectedEbooks: (selectedEbooks) => set({ selectedEbooks }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedFormats: (selectedFormats) => set({ selectedFormats }),
  setSelectedGenres: (selectedGenres) => set({ selectedGenres }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // API actions
  fetchEbooks: async () => {
    const { setLoading, setError } = get();
    try {
      setLoading(true);
      setError(null);

      const { invoke } = await import('@tauri-apps/api/core');
      const ebooks = await invoke('get_all_ebooks') as Ebook[];

      console.log('📚 EBOOK: Fetched ebooks:', ebooks.length);
      set({ ebooks });
    } catch (error) {
      console.error('Failed to fetch ebooks:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch ebooks');
      set({ ebooks: [] });
    } finally {
      setLoading(false);
    }
  },

  searchEbooks: async (query: string) => {
    const { setLoading, setError } = get();
    if (!query.trim()) {
      // If empty query, fetch all
      return get().fetchEbooks();
    }

    try {
      setLoading(true);
      setError(null);

      const { invoke } = await import('@tauri-apps/api/core');
      const ebooks = await invoke('search_ebooks', { query }) as Ebook[];

      console.log('📚 EBOOK: Search results:', ebooks.length);
      set({ ebooks, searchQuery: query });
    } catch (error) {
      console.error('Failed to search ebooks:', error);
      setError(error instanceof Error ? error.message : 'Failed to search ebooks');
    } finally {
      setLoading(false);
    }
  },

  createEbook: async (dto: CreateEbookDto) => {
    const { setLoading, setError, fetchEbooks } = get();
    try {
      setLoading(true);
      setError(null);

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_ebook', { dto });

      console.log('📚 EBOOK: Created ebook:', dto.title);
      // Refresh the list
      await fetchEbooks();
    } catch (error) {
      console.error('Failed to create ebook:', error);
      setError(error instanceof Error ? error.message : 'Failed to create ebook');
      throw error;
    } finally {
      setLoading(false);
    }
  },

  updateEbook: async (id: string, dto: UpdateEbookDto) => {
    const { setLoading, setError, fetchEbooks } = get();
    try {
      setLoading(true);
      setError(null);

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_ebook', { id, dto });

      console.log('📚 EBOOK: Updated ebook:', id);
      // Refresh the list
      await fetchEbooks();
    } catch (error) {
      console.error('Failed to update ebook:', error);
      setError(error instanceof Error ? error.message : 'Failed to update ebook');
      throw error;
    } finally {
      setLoading(false);
    }
  },

  deleteEbook: async (id: string) => {
    const { setLoading, setError, fetchEbooks } = get();
    try {
      setLoading(true);
      setError(null);

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_ebook', { id });

      console.log('📚 EBOOK: Deleted ebook:', id);
      // Refresh the list
      await fetchEbooks();
    } catch (error) {
      console.error('Failed to delete ebook:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete ebook');
      throw error;
    } finally {
      setLoading(false);
    }
  },

  // Utility functions
  getFilteredEbooks: () => {
    const { ebooks, searchQuery, selectedFormats, selectedGenres, sortBy, sortOrder } = get();

    let filtered = [...ebooks];

    // Filter by search query (client-side, for refined filtering)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((ebook) =>
        ebook.title.toLowerCase().includes(query) ||
        ebook.author?.toLowerCase().includes(query) ||
        ebook.genre?.toLowerCase().includes(query)
      );
    }

    // Filter by format
    if (selectedFormats.length > 0) {
      filtered = filtered.filter((ebook) =>
        selectedFormats.includes(ebook.file_format as 'pdf' | 'epub')
      );
    }

    // Filter by genre
    if (selectedGenres.length > 0) {
      filtered = filtered.filter((ebook) =>
        ebook.genre && selectedGenres.includes(ebook.genre)
      );
    }

    // Sort
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
        case 'recently_read':
          // Would need to integrate with reading progress
          comparison = 0;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  },

  toggleEbookSelection: (id: string) => {
    const { selectedEbooks } = get();
    if (selectedEbooks.includes(id)) {
      set({ selectedEbooks: selectedEbooks.filter((ebookId) => ebookId !== id) });
    } else {
      set({ selectedEbooks: [...selectedEbooks, id] });
    }
  },

  clearSelection: () => set({ selectedEbooks: [] }),
}));
