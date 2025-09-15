import { invoke } from '@tauri-apps/api/core';

export interface SearchFilters {
  query?: string;
  author?: string;
  genre?: string;
  narrator?: string;
  min_duration?: number;
  max_duration?: number;
  added_after?: string;
  added_before?: string;
}

export interface SearchSuggestion {
  type: 'author' | 'genre' | 'narrator' | 'title';
  value: string;
  count?: number;
}

export interface LibriVoxAudiobook {
  id: string;
  title: string;
  author: string;
  description?: string;
  language: string;
  genre: string[];
  runtime: string;
  cover_url?: string;
  download_links: {
    mp3: string;
    m4b?: string;
  };
  chapters?: Array<{
    title: string;
    url: string;
    duration: number;
  }>;
}

export class SearchService {
  private searchHistory: string[] = [];
  private savedSearches: { name: string; filters: SearchFilters }[] = [];
  private recentSuggestions: SearchSuggestion[] = [];

  // Basic search with enhanced relevance scoring
  async searchAudiobooks(query: string) {
    try {
      return await invoke<any[]>('search_audiobooks', { query });
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  // Advanced search with filters
  async searchWithFilters(filters: SearchFilters) {
    try {
      return await invoke<any[]>('search_audiobooks_with_filters', { filters });
    } catch (error) {
      console.error('Filtered search failed:', error);
      throw error;
    }
  }

  // Get distinct values for autocomplete
  async getDistinctAuthors(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_distinct_authors');
    } catch (error) {
      console.error('Failed to get authors:', error);
      return [];
    }
  }

  async getDistinctGenres(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_distinct_genres');
    } catch (error) {
      console.error('Failed to get genres:', error);
      return [];
    }
  }

  async getDistinctNarrators(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_distinct_narrators');
    } catch (error) {
      console.error('Failed to get narrators:', error);
      return [];
    }
  }

  // Search suggestions and autocomplete
  async getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
    if (query.length < 2) {
      return this.recentSuggestions.slice(0, 5);
    }

    const [authors, genres, narrators] = await Promise.all([
      this.getDistinctAuthors(),
      this.getDistinctGenres(),
      this.getDistinctNarrators()
    ]);

    const suggestions: SearchSuggestion[] = [];
    const lowerQuery = query.toLowerCase();

    // Add matching authors
    authors
      .filter(author => author.toLowerCase().includes(lowerQuery))
      .slice(0, 3)
      .forEach(author => suggestions.push({ type: 'author', value: author }));

    // Add matching genres
    genres
      .filter(genre => genre.toLowerCase().includes(lowerQuery))
      .slice(0, 3)
      .forEach(genre => suggestions.push({ type: 'genre', value: genre }));

    // Add matching narrators
    narrators
      .filter(narrator => narrator.toLowerCase().includes(lowerQuery))
      .slice(0, 3)
      .forEach(narrator => suggestions.push({ type: 'narrator', value: narrator }));

    return suggestions.slice(0, 8);
  }

  // Search history management
  addToSearchHistory(query: string) {
    if (query && query.trim()) {
      this.searchHistory = [
        query,
        ...this.searchHistory.filter(q => q !== query)
      ].slice(0, 10);
      
      this.updateRecentSuggestions(query);
      this.saveSearchHistory();
    }
  }

  getSearchHistory(): string[] {
    return this.searchHistory;
  }

  clearSearchHistory() {
    this.searchHistory = [];
    this.saveSearchHistory();
  }

  // Saved searches
  saveSearch(name: string, filters: SearchFilters) {
    this.savedSearches = [
      { name, filters },
      ...this.savedSearches.filter(s => s.name !== name)
    ].slice(0, 20);
    this.saveSavedSearches();
  }

  getSavedSearches() {
    return this.savedSearches;
  }

  deleteSavedSearch(name: string) {
    this.savedSearches = this.savedSearches.filter(s => s.name !== name);
    this.saveSavedSearches();
  }

  // LibriVox API integration using Tauri backend command
  async searchLibriVox(params: {
    author?: string;
    title?: string;
    genre?: string;
    language?: string;
    limit?: number;
  }): Promise<LibriVoxAudiobook[]> {
    try {
      console.log('🔍 SERVICE: Calling search_librivox with params:', params);
      const { invoke } = await import('@tauri-apps/api/core');
      const data = await invoke<any>('search_librivox', { params });
      console.log('✅ SERVICE: Got response from backend:', data);
      console.log('📚 SERVICE: Books array:', data.books);
      const normalizedResults = await this.normalizeLibriVoxResults(data.books || []);
      console.log('🔧 SERVICE: Normalized results:', normalizedResults.length, 'books');
      return normalizedResults;
    } catch (error) {
      console.error('❌ SERVICE: LibriVox search failed:', error);
      throw error;
    }
  }

  private async normalizeLibriVoxResults(books: any[]): Promise<LibriVoxAudiobook[]> {
    const results = [];
    for (const book of books) {
      // Debug log to see what LibriVox actually returns (limit to important fields)
      console.log('LibriVox book data for', book.title, ':', {
        id: book.id,
        title: book.title,
        url_librivox: book.url_librivox,
        url_other: book.url_other,
        url_text_source: book.url_text_source
      });
      
      // Extract Archive.org identifier for better cover image handling
      let archiveIdentifier = null;
      if (book.url_iarchive) {
        const match = book.url_iarchive.match(/archive\.org\/details\/([^/?]+)/);
        if (match) {
          archiveIdentifier = match[1];
        }
      }
      
      const result = {
        id: archiveIdentifier || `librivox_${book.id}`,
        title: book.title || 'Unknown Title',
        author: book.authors?.[0]?.last_name ? 
          `${book.authors[0].first_name || ''} ${book.authors[0].last_name}`.trim() :
          'Unknown Author',
        description: book.description,
        language: book.language || 'English',
        genre: book.genres?.map((g: any) => g.name) || [],
        runtime: this.formatDuration(book.totaltimesecs),
        cover_url: await this.extractThumbnailWithPython(book),
        download_links: {
          mp3: book.url_zip_file,
          m4b: book.url_m4b
        },
        chapters: book.sections?.map((section: any) => ({
          title: section.title,
          url: section.listen_url,
          duration: section.playtime || 0
        })) || []
      };
      results.push(result);
    }
    return results;
  }

  // Extract thumbnail using Archive.org thumbnail service
  private async extractThumbnailWithPython(book: any): Promise<string | undefined> {
    try {
      // Extract Archive.org identifier from url_iarchive
      let archiveIdentifier = null;
      if (book.url_iarchive) {
        const match = book.url_iarchive.match(/archive\.org\/details\/([^/?]+)/);
        if (match) {
          archiveIdentifier = match[1];
        }
      }
      
      if (!archiveIdentifier) {
        return this.extractCoverUrl(book);
      }
      
      // Use Archive.org's thumbnail service (same as Aradia app)
      const thumbnailUrl = `https://archive.org/services/get-item-image.php?identifier=${archiveIdentifier}`;
      console.log('Using Archive.org thumbnail service:', thumbnailUrl);
      
      return thumbnailUrl;
    } catch (error) {
      console.error('Thumbnail extraction failed:', error);
      return this.extractCoverUrl(book);
    }
  }

  private extractCoverUrl(book: any): string | undefined {
    console.log('Extracting cover for book:', book.title, 'ID:', book.id);
    console.log('Book data:', { 
      url_iarchive: book.url_iarchive, 
      url_librivox: book.url_librivox,
      url_other: book.url_other 
    });
    
    // First try: Extract Archive.org identifier from url_iarchive
    let archiveIdentifier = null;
    if (book.url_iarchive) {
      const match = book.url_iarchive.match(/archive\.org\/details\/([^/?]+)/);
      if (match) {
        archiveIdentifier = match[1];
        console.log('Found Archive.org identifier:', archiveIdentifier);
        
        // Try multiple patterns for Archive.org covers
        const baseId = archiveIdentifier.replace(/_librivox$/, '');
        const patterns = [
          `https://archive.org/download/${archiveIdentifier}/picture_${baseId}_1006.jpg`,
          `https://archive.org/download/${archiveIdentifier}/cover.jpg`,
          `https://archive.org/download/${archiveIdentifier}/folder.jpg`,
          `https://archive.org/download/${archiveIdentifier}/${baseId}_1006.jpg`,
          `https://archive.org/download/${archiveIdentifier}/${archiveIdentifier}.jpg`
        ];
        
        // Return the first pattern - BookCover component will handle fallbacks
        console.log('Generated primary cover URL:', patterns[0]);
        return patterns[0];
      }
    }
    
    // Second try: Look for other URL patterns
    if (book.url_librivox) {
      const librivoxMatch = book.url_librivox.match(/librivox\.org\/[^\/]*\/([^\/]+)/);
      if (librivoxMatch) {
        const slug = librivoxMatch[1];
        console.log('Found LibriVox slug:', slug);
        // This will be handled by BookCover component's pattern matching
        return `https://archive.org/download/${slug}_librivox/picture_${slug}_1006.jpg`;
      }
    }
    
    // Third try: Numeric LibriVox ID (should be handled by BookCover component)
    if (book.id && /^\d+$/.test(book.id.toString())) {
      const librivoxCoverUrl = `https://librivox.org/uploads/covers/${book.id}.jpg`;
      console.log('Using LibriVox numeric cover endpoint:', librivoxCoverUrl);
      return librivoxCoverUrl;
    }
    
    console.log('No cover URL patterns matched for book:', book.title);
    return undefined;
  }

  private formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:00`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }

  private updateRecentSuggestions(query: string) {
    // Add query as a suggestion for future searches
    this.recentSuggestions = [
      { type: 'title', value: query },
      ...this.recentSuggestions.filter(s => s.value !== query)
    ].slice(0, 10);
  }

  private saveSearchHistory() {
    localStorage.setItem('audiovibe_search_history', JSON.stringify(this.searchHistory));
  }

  private loadSearchHistory() {
    try {
      const saved = localStorage.getItem('audiovibe_search_history');
      if (saved) {
        this.searchHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }

  private saveSavedSearches() {
    localStorage.setItem('audiovibe_saved_searches', JSON.stringify(this.savedSearches));
  }

  private loadSavedSearches() {
    try {
      const saved = localStorage.getItem('audiovibe_saved_searches');
      if (saved) {
        this.savedSearches = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load saved searches:', error);
    }
  }

  // Initialize service
  initialize() {
    this.loadSearchHistory();
    this.loadSavedSearches();
  }
}

// Export singleton instance
export const searchService = new SearchService();