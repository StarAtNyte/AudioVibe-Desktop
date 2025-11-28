/**
 * Archive.org API Service for fetching LibriVox audiobooks
 * Based on Aradia's implementation approach
 */

export interface ArchiveAudiobook {
  identifier: string;
  title: string;
  creator?: string;
  description?: string;
  subject?: string[];
  runtime?: string;
  avg_rating?: number;
  num_reviews?: number;
  downloads?: number;
  date?: string;
  language?: string[];
  item_size?: number;
  // Computed fields
  zipUrl?: string;
  coverUrl?: string;
}

interface ArchiveSearchParams {
  query?: string;
  genre?: string;
  sort?: 'downloads' | 'week' | 'avg_rating' | 'date';
  page?: number;
  rows?: number;
}

const ARCHIVE_API_BASE = 'https://archive.org/advancedsearch.php';

// Fields we want from Archive.org API
const FIELDS = [
  'identifier',
  'title',
  'creator',
  'description',
  'subject',
  'runtime',
  'avg_rating',
  'num_reviews',
  'downloads',
  'date',
  'language',
  'item_size'
].join(',');

// Excluded generic genres
const EXCLUDED_GENRES = ['librivox', 'audiobooks', 'audiobook', 'audio'];

class ArchiveService {
  /**
   * Search LibriVox audiobooks on Archive.org
   */
  async searchAudiobooks(params: ArchiveSearchParams): Promise<ArchiveAudiobook[]> {
    const { query, genre, sort = 'downloads', page = 1, rows = 15 } = params;

    // Build Archive.org query
    let archiveQuery = 'collection:librivoxaudio';

    if (genre) {
      // Handle OR queries for multiple genres
      if (genre.includes(' OR ')) {
        const genres = genre.split(' OR ').map(g => g.trim().replace(/"/g, ''));
        const genreQueries = genres
          .filter(g => !EXCLUDED_GENRES.includes(g.toLowerCase()))
          .map(g => `subject:"${g}"`)
          .join(' OR ');
        if (genreQueries) {
          archiveQuery += ` AND (${genreQueries})`;
        }
      } else {
        archiveQuery += ` AND subject:"${genre}"`;
      }
    }

    if (query) {
      archiveQuery += ` AND (title:(${query}) OR creator:(${query}))`;
    }

    // Build URL parameters
    const urlParams = new URLSearchParams({
      q: archiveQuery,
      fl: FIELDS,
      output: 'json',
      rows: rows.toString(),
      page: page.toString()
    });

    // Add sort parameter
    if (sort === 'downloads') {
      urlParams.append('sort[]', 'downloads desc');
    } else if (sort === 'week') {
      urlParams.append('sort[]', 'week desc');
    } else if (sort === 'avg_rating') {
      urlParams.append('sort[]', 'avg_rating desc');
    } else if (sort === 'date') {
      urlParams.append('sort[]', 'date desc');
    }

    const url = `${ARCHIVE_API_BASE}?${urlParams.toString()}`;
    console.log('🌐 ARCHIVE.ORG: Fetching audiobooks:', url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Archive.org API error: ${response.status}`);
      }

      const data = await response.json();
      const docs = data.response?.docs || [];

      console.log(`📚 ARCHIVE.ORG: Found ${docs.length} audiobooks`);

      // Deduplicate by identifier and transform to our format
      const seenIds = new Set<string>();
      const audiobooks: ArchiveAudiobook[] = [];

      for (const doc of docs) {
        const identifier = doc.identifier?.trim();
        if (!identifier || seenIds.has(identifier)) continue;
        seenIds.add(identifier);

        audiobooks.push({
          identifier,
          title: doc.title || 'Unknown Title',
          creator: Array.isArray(doc.creator) ? doc.creator[0] : doc.creator,
          description: doc.description,
          subject: Array.isArray(doc.subject) ? doc.subject : doc.subject ? [doc.subject] : [],
          runtime: doc.runtime,
          avg_rating: doc.avg_rating,
          num_reviews: doc.num_reviews,
          downloads: doc.downloads,
          date: doc.date,
          language: Array.isArray(doc.language) ? doc.language : doc.language ? [doc.language] : [],
          item_size: doc.item_size,
          // Generate URLs
          zipUrl: this.getZipUrl(identifier),
          coverUrl: this.getCoverUrl(identifier)
        });
      }

      return audiobooks;
    } catch (error) {
      console.error('❌ ARCHIVE.ORG: Search failed:', error);
      throw error;
    }
  }

  /**
   * Get popular audiobooks
   */
  async getPopular(rows: number = 15): Promise<ArchiveAudiobook[]> {
    return this.searchAudiobooks({ sort: 'downloads', rows });
  }

  /**
   * Get trending audiobooks (popular this week)
   */
  async getTrending(rows: number = 15): Promise<ArchiveAudiobook[]> {
    return this.searchAudiobooks({ sort: 'week', rows });
  }

  /**
   * Get latest audiobooks
   */
  async getLatest(rows: number = 15): Promise<ArchiveAudiobook[]> {
    return this.searchAudiobooks({ sort: 'date', rows });
  }

  /**
   * Get audiobooks by genres (for recommendations)
   */
  async getByGenres(genres: string[], rows: number = 15): Promise<ArchiveAudiobook[]> {
    // Filter out excluded genres
    const validGenres = genres
      .filter(g => !EXCLUDED_GENRES.includes(g.toLowerCase()));

    if (validGenres.length === 0) {
      return this.getPopular(rows);
    }

    // Create OR query for genres
    const genreQuery = validGenres.map(g => `"${g}"`).join(' OR ');

    return this.searchAudiobooks({
      genre: genreQuery,
      sort: 'week', // Use trending for recommendations
      rows
    });
  }

  /**
   * Generate Archive.org ZIP download URL
   */
  private getZipUrl(identifier: string): string {
    return `https://archive.org/compress/${identifier}/formats=64KBPS%20MP3&file=/${identifier}.zip`;
  }

  /**
   * Generate Archive.org cover image URL
   */
  private getCoverUrl(identifier: string): string {
    return `https://archive.org/services/get-item-image.php?identifier=${identifier}`;
  }

  /**
   * Get recommended genres from user's selected genres
   * Similar to Aradia's recommendation logic but simplified
   */
  getRecommendedGenres(selectedGenres: string[]): string[] {
    // Return unique genres, limited to top 10
    return [...new Set(selectedGenres)].slice(0, 10);
  }
}

export const archiveService = new ArchiveService();
