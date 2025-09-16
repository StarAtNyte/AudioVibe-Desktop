import { invoke } from '@tauri-apps/api/core';
import { localBooksDatabase } from '../data/localBooks';
import { CreateAudiobookDto } from '../types';

export const populateLibraryWithSampleData = async (): Promise<void> => {
  try {
    console.log('🔄 Populating library with sample data...');
    
    // Get current audiobooks to avoid duplicates
    const existingBooks = await invoke('get_all_audiobooks') as any[];
    const existingIds = new Set(existingBooks.map(book => book.id));
    
    // Filter out books that already exist
    const booksToAdd = localBooksDatabase.filter(book => !existingIds.has(book.id));
    
    if (booksToAdd.length === 0) {
      console.log('📚 All sample books already exist in library');
      return;
    }
    
    console.log(`📚 Adding ${booksToAdd.length} new sample books to library...`);
    
    // Add each book to the library
    for (const book of booksToAdd) {
      try {
        const dto: CreateAudiobookDto = {
          title: book.title,
          file_path: book.file_path, 
          author: book.author,
          narrator: book.narrator,
          description: book.description,
          genre: book.genre
        };
        
        await invoke('create_audiobook', { dto });
        console.log(`✅ Added: ${book.title} by ${book.author}`);
      } catch (error) {
        console.error(`❌ Failed to add ${book.title}:`, error);
      }
    }
    
    console.log('🎉 Sample library population complete!');
  } catch (error) {
    console.error('❌ Failed to populate library with sample data:', error);
  }
};

export const initializeSampleLibrary = async (): Promise<boolean> => {
  try {
    // Check if we're in Tauri environment
    const { isTauri } = await import('@tauri-apps/api/core');
    const isInTauri = await isTauri();
    
    if (!isInTauri) {
      console.log('📱 Not in Tauri environment, skipping library population');
      return false;
    }
    
    await populateLibraryWithSampleData();
    return true;
  } catch (error) {
    console.error('Failed to initialize sample library:', error);
    return false;
  }
};