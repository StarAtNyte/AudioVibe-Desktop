import { invoke } from '@tauri-apps/api/core';
import { localBooksDatabase } from '../data/localBooks';

export const removeSampleBooksFromLibrary = async (): Promise<void> => {
  try {
    console.log('🧹 Removing sample books from library...');
    
    // Get the IDs of all sample books
    const sampleBookIds = localBooksDatabase.map(book => book.id);
    console.log('Sample book IDs to remove:', sampleBookIds);
    
    // Get current audiobooks to see what exists
    const existingBooks = await invoke('get_all_audiobooks') as any[];
    console.log('Current books in library:', existingBooks.length);
    
    // Find which sample books are actually in the library
    const booksToRemove = existingBooks.filter(book => sampleBookIds.includes(book.id));
    console.log('Sample books found in library:', booksToRemove.map(b => b.title));
    
    if (booksToRemove.length === 0) {
      console.log('✅ No sample books found in library to remove');
      return;
    }
    
    // Remove each sample book from the library
    for (const book of booksToRemove) {
      try {
        await invoke('delete_audiobook', { id: book.id });
        console.log(`🗑️ Removed: ${book.title}`);
      } catch (error) {
        console.error(`❌ Failed to remove ${book.title}:`, error);
      }
    }
    
    console.log('🎉 Sample book cleanup complete!');
  } catch (error) {
    console.error('❌ Failed to cleanup sample books:', error);
  }
};

export const cleanupSampleLibrary = async (): Promise<boolean> => {
  try {
    // Check if we're in Tauri environment
    const { isTauri } = await import('@tauri-apps/api/core');
    const isInTauri = await isTauri();
    
    if (!isInTauri) {
      console.log('📱 Not in Tauri environment, skipping cleanup');
      return false;
    }
    
    await removeSampleBooksFromLibrary();
    return true;
  } catch (error) {
    console.error('Failed to cleanup sample library:', error);
    return false;
  }
};