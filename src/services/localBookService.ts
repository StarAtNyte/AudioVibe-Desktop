// Service to handle adding local books to the library with actual downloads

import { LocalBook, getBookById, localBooksDatabase } from '../data/localBooks';
import { getBookCover } from '../data/bookCovers';

export interface AddBookProgress {
  book: LocalBook;
  stage: 'preparing' | 'downloading' | 'extracting' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export class LocalBookService {
  private static instance: LocalBookService;
  
  public static getInstance(): LocalBookService {
    if (!LocalBookService.instance) {
      LocalBookService.instance = new LocalBookService();
    }
    return LocalBookService.instance;
  }
  
  async addBookToLibrary(
    bookId: string, 
    onProgress?: (progress: AddBookProgress) => void
  ): Promise<void> {
    const book = getBookById(bookId);
    if (!book) {
      throw new Error(`Book not found: ${bookId}`);
    }
    
    try {
      // Check if we're in Tauri environment
      const { isTauri } = await import('@tauri-apps/api/core');
      const isInTauri = await isTauri();
      
      if (!isInTauri) {
        // Fallback for development environment
        await this.addBookFallback(book, onProgress);
        return;
      }
      
      // Use Tauri backend for real download and processing
      await this.addBookWithTauri(book, onProgress);
      
    } catch (error) {
      console.error('Failed to add book to library:', error);
      if (onProgress) {
        onProgress({
          book,
          stage: 'error',
          progress: 0,
          message: 'Failed to add book',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      throw error;
    }
  }
  
  private async addBookWithTauri(
    book: LocalBook, 
    onProgress?: (progress: AddBookProgress) => void
  ): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    
    // Stage 1: Preparing
    if (onProgress) {
      onProgress({
        book,
        stage: 'preparing',
        progress: 5,
        message: 'Preparing to download audiobook...'
      });
    }
    
    try {
      // Use the download manager to get the audiobook
      // Extract the Archive.org identifier from the download URL
      const archiveId = this.extractArchiveId((book as any).download_url_zip);
      
      // Stage 2: Downloading
      if (onProgress) {
        onProgress({
          book,
          stage: 'downloading',
          progress: 20,
          message: 'Downloading audiobook files from Archive.org...'
        });
      }
      
      // Call the Rust backend to download the files
      const downloadResult = await invoke('download_librivox_book', {
        archiveId: archiveId,
        zipUrl: (book as any).download_url_zip
      });
      
      // Stage 3: Processing
      if (onProgress) {
        onProgress({
          book,
          stage: 'processing',
          progress: 80,
          message: 'Processing audio files and creating database entry...'
        });
      }
      
      // Create the audiobook entry in the database
      const audiobookData = {
        title: book.title,
        author: book.author,
        narrator: book.narrator,
        description: book.description,
        genre: book.genre,
        file_path: (downloadResult as any).local_path, // Path to the downloaded files
      };
      
      await invoke('create_audiobook', { dto: audiobookData });
      
      // Stage 4: Completed
      if (onProgress) {
        onProgress({
          book,
          stage: 'completed',
          progress: 100,
          message: 'Audiobook successfully added to library!'
        });
      }
      
    } catch (error) {
      console.error('Tauri operation failed:', error);
      throw error;
    }
  }
  
  private async addBookFallback(
    book: LocalBook,
    onProgress?: (progress: AddBookProgress) => void
  ): Promise<void> {
    // Development/web environment fallback
    
    // Stage 1: Preparing
    if (onProgress) {
      onProgress({
        book,
        stage: 'preparing',
        progress: 10,
        message: 'Adding book metadata to library...'
      });
    }
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Stage 2: Processing
    if (onProgress) {
      onProgress({
        book,
        stage: 'processing',
        progress: 60,
        message: 'Creating library entry...'
      });
    }
    
    // Add to localStorage as fallback
    const existingBooks = JSON.parse(localStorage.getItem('library_audiobooks') || '[]');
    const existingIndex = existingBooks.findIndex((saved: any) => saved.id === book.id);
    
    if (existingIndex >= 0) {
      throw new Error(`"${book.title}" is already in your library!`);
    }
    
    const libraryBook = {
      id: book.id,
      title: book.title,
      author: book.author,
      narrator: book.narrator,
      description: book.description,
      genre: book.genre,
      file_path: `librivox://${(book as any).librivox_id}`, // Virtual path for LibriVox books
      cover_image_path: getBookCover(book.id),
      duration: this.parseDuration((book as any).duration),
      added_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      chapters_count: (book as any).chapters,
      publish_date: (book as any).year,
      
      // Additional metadata
      librivox_id: (book as any).librivox_id,
      download_url: (book as any).download_url_zip,
      language: (book as any).language,
      rating: (book as any).rating
    };
    
    existingBooks.push(libraryBook);
    localStorage.setItem('library_audiobooks', JSON.stringify(existingBooks));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Stage 3: Completed
    if (onProgress) {
      onProgress({
        book,
        stage: 'completed',
        progress: 100,
        message: 'Book metadata added to library!'
      });
    }
  }
  
  private extractArchiveId(url: string): string {
    // Extract Archive.org identifier from URL
    // Example: https://archive.org/download/pride_prejudice_librivox/... -> pride_prejudice_librivox
    const match = url.match(/archive\.org\/download\/([^\/]+)/);
    if (match) {
      return match[1];
    }
    
    // Fallback: try to extract from the URL structure
    const parts = url.split('/');
    const downloadIndex = parts.indexOf('download');
    if (downloadIndex !== -1 && downloadIndex + 1 < parts.length) {
      return parts[downloadIndex + 1];
    }
    
    throw new Error('Could not extract Archive.org identifier from URL: ' + url);
  }
  
  private parseDuration(duration: string): number {
    // Convert "11h 35m" to seconds
    let totalSeconds = 0;
    
    const hourMatch = duration.match(/(\d+)h/);
    if (hourMatch) {
      totalSeconds += parseInt(hourMatch[1]) * 3600;
    }
    
    const minuteMatch = duration.match(/(\d+)m/);
    if (minuteMatch) {
      totalSeconds += parseInt(minuteMatch[1]) * 60;
    }
    
    return totalSeconds;
  }
  
  // Get all available local books
  getAllBooks(): LocalBook[] {
    return localBooksDatabase as LocalBook[];
  }
  
  // Get books by category
  getBooksByCategory(category: string): LocalBook[] {
    return localBooksDatabase.filter((book: any) => book.genre?.toLowerCase() === category.toLowerCase()) as LocalBook[];
  }
}