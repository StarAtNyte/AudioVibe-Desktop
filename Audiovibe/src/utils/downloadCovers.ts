// Utility to download and cache cover images locally
import { localBooksDatabase } from '../data/localBooks';

export const downloadAllCovers = async (): Promise<void> => {
  const books = localBooksDatabase;
  
  for (const book of books) {
    try {
      console.log(`Downloading cover for: ${book.title}`);
      
      // Fetch the image
      const response = await fetch((book as any).cover_image_path || '');
      if (!response.ok) {
        console.warn(`Failed to download cover for ${book.title}: ${response.statusText}`);
        continue;
      }
      
      const blob = await response.blob();
      
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        localStorage.setItem(`cover_${book.id}`, base64);
        console.log(`Saved cover for: ${book.title}`);
      };
      reader.readAsDataURL(blob);
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Error downloading cover for ${book.title}:`, error);
    }
  }
};

export const getCachedCover = (bookId: string): string | null => {
  return localStorage.getItem(`cover_${bookId}`);
};

export const preloadCovers = (): void => {
  // Check if covers are already cached
  const books = localBooksDatabase;
  let cachedCount = 0;
  
  books.forEach((book: any) => {
    if (getCachedCover(book.id)) {
      cachedCount++;
    }
  });
  
  console.log(`Found ${cachedCount}/${books.length} covers cached locally`);
  
  // If less than half are cached, download all
  if (cachedCount < books.length / 2) {
    console.log('Downloading missing covers...');
    downloadAllCovers();
  }
};