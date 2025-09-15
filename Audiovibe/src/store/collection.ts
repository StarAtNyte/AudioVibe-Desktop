import { create } from 'zustand';
import type { Collection, CreateCollectionDto, Audiobook } from '../types';

interface CollectionState {
  collections: Collection[];
  selectedCollection: Collection | null;
  collectionAudiobooks: Record<string, Audiobook[]>;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCollections: () => Promise<void>;
  createCollection: (dto: CreateCollectionDto) => Promise<Collection>;
  updateCollection: (id: string, dto: CreateCollectionDto) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  selectCollection: (collection: Collection | null) => void;
  
  // Audiobook management
  fetchCollectionAudiobooks: (collectionId: string) => Promise<void>;
  addAudiobookToCollection: (collectionId: string, audiobookId: string) => Promise<void>;
  removeAudiobookFromCollection: (collectionId: string, audiobookId: string) => Promise<void>;
  reorderCollectionAudiobooks: (collectionId: string, audiobookOrders: Array<[string, number]>) => Promise<void>;

  // Utilities
  clearError: () => void;
  setError: (error: string) => void;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collections: [],
  selectedCollection: null,
  collectionAudiobooks: {},
  isLoading: false,
  error: null,

  fetchCollections: async () => {
    set({ isLoading: true, error: null });
    try {
      const { invoke, isTauri } = await import('@tauri-apps/api/core');
      
      if (!(await isTauri())) {
        console.warn('Not running in Tauri environment - using mock data');
        set({ collections: [], isLoading: false });
        return;
      }
      
      const collections = await invoke<Collection[]>('get_all_collections');
      set({ collections, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch collections',
        isLoading: false 
      });
    }
  },

  createCollection: async (dto: CreateCollectionDto) => {
    set({ isLoading: true, error: null });
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      const newCollection = await tauriCore.invoke<Collection>('create_collection', { dto });
      const { collections } = get();
      set({ 
        collections: [newCollection, ...collections],
        isLoading: false 
      });
      return newCollection;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create collection',
        isLoading: false 
      });
      throw error;
    }
  },

  updateCollection: async (id: string, dto: CreateCollectionDto) => {
    set({ isLoading: true, error: null });
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      await tauriCore.invoke('update_collection', { id, dto });
      const { collections, selectedCollection } = get();
      
      const updatedCollections = collections.map(collection => 
        collection.id === id 
          ? { ...collection, ...dto, updated_at: new Date().toISOString() }
          : collection
      );
      
      set({ 
        collections: updatedCollections,
        selectedCollection: selectedCollection?.id === id 
          ? { ...selectedCollection, ...dto, updated_at: new Date().toISOString() }
          : selectedCollection,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update collection',
        isLoading: false 
      });
      throw error;
    }
  },

  deleteCollection: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      await tauriCore.invoke('delete_collection', { id });
      const { collections, selectedCollection, collectionAudiobooks } = get();
      
      // Remove from collections list
      const filteredCollections = collections.filter(collection => collection.id !== id);
      
      // Clear selected collection if it was deleted
      const newSelectedCollection = selectedCollection?.id === id ? null : selectedCollection;
      
      // Remove audiobooks cache for this collection
      const newCollectionAudiobooks = { ...collectionAudiobooks };
      delete newCollectionAudiobooks[id];
      
      set({ 
        collections: filteredCollections,
        selectedCollection: newSelectedCollection,
        collectionAudiobooks: newCollectionAudiobooks,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete collection',
        isLoading: false 
      });
      throw error;
    }
  },

  selectCollection: (collection: Collection | null) => {
    set({ selectedCollection: collection });
  },

  fetchCollectionAudiobooks: async (collectionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      const audiobooks = await tauriCore.invoke<Audiobook[]>('get_collection_audiobooks', { collectionId });
      const { collectionAudiobooks } = get();
      
      set({ 
        collectionAudiobooks: {
          ...collectionAudiobooks,
          [collectionId]: audiobooks
        },
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch collection audiobooks',
        isLoading: false 
      });
    }
  },

  addAudiobookToCollection: async (collectionId: string, audiobookId: string) => {
    set({ isLoading: true, error: null });
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      await tauriCore.invoke('add_audiobook_to_collection', { collectionId, audiobookId });
      
      // Refresh the collection audiobooks to get the updated list
      await get().fetchCollectionAudiobooks(collectionId);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add audiobook to collection',
        isLoading: false 
      });
      throw error;
    }
  },

  removeAudiobookFromCollection: async (collectionId: string, audiobookId: string) => {
    set({ isLoading: true, error: null });
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      await tauriCore.invoke('remove_audiobook_from_collection', { collectionId, audiobookId });
      
      const { collectionAudiobooks } = get();
      const currentAudiobooks = collectionAudiobooks[collectionId] || [];
      const filteredAudiobooks = currentAudiobooks.filter(book => book.id !== audiobookId);
      
      set({ 
        collectionAudiobooks: {
          ...collectionAudiobooks,
          [collectionId]: filteredAudiobooks
        },
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to remove audiobook from collection',
        isLoading: false 
      });
      throw error;
    }
  },

  reorderCollectionAudiobooks: async (collectionId: string, audiobookOrders: Array<[string, number]>) => {
    set({ isLoading: true, error: null });
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      await tauriCore.invoke('reorder_collection_audiobooks', { collectionId, audiobookOrders });
      
      // Refresh the collection audiobooks to get the updated order
      await get().fetchCollectionAudiobooks(collectionId);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to reorder collection audiobooks',
        isLoading: false 
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  setError: (error: string) => set({ error }),
}));