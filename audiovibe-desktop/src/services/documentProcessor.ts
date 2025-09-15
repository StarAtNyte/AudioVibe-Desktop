/**
 * Browser-based document processing for PDF, EPUB, and text files
 */

export interface DocumentChapter {
  title: string;
  text: string;
  word_count: number;
  page_start?: number;
  page_end?: number;
}

export interface ProcessedDocument {
  title: string;
  author?: string;
  chapters: DocumentChapter[];
  format: string;
  total_pages?: number;
}

class DocumentProcessor {
  /**
   * Process PDF files using local Python API
   */
  async processPDF(file: File): Promise<ProcessedDocument> {
    try {
      // Try to use local PDF processing API first
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:5555/process-document', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          return {
            title: result.title,
            author: result.author,
            chapters: result.chapters,
            format: result.format,
            total_pages: result.total_pages,
          };
        }
      }
      
      // Fallback if local API isn't running
      throw new Error('PDF processing API not available');
      
    } catch (error) {
      console.warn('PDF processing API not available, using fallback');
      
      const title = file.name.replace(/\.pdf$/i, '');
      
      // Create helpful fallback message
      const chapters: DocumentChapter[] = [{
        title: `${title} - Processing Instructions`,
        text: `To process this PDF file, please:

1. Start the PDF processor: Run "python pdf_processor_api.py" in the AudioVibe directory
2. Or convert to text: Copy text from the PDF and save as a .txt file
3. Or use online tools: Convert PDF to text using online converters

The PDF processing API provides proper chapter detection and text extraction for PDF files. Without it, you'll need to manually convert PDFs to text format for best results.

File size: ${(file.size / 1024).toFixed(1)} KB`,
        word_count: 80,
      }];
      
      return {
        title,
        chapters,
        format: 'pdf',
        total_pages: 1,
      };
    }
  }

  /**
   * Process EPUB files
   */
  async processEPUB(file: File): Promise<ProcessedDocument> {
    try {
      // Import epub.js dynamically
      const ePub = await import('epubjs');
      
      const arrayBuffer = await file.arrayBuffer();
      const book = ePub.default(arrayBuffer);
      
      await book.ready;
      
      const title = book.packaging.metadata.title || file.name.replace(/\.epub$/i, '');
      const author = book.packaging.metadata.creator || 'Unknown';
      
      const chapters: DocumentChapter[] = [];
      
      // Get spine items (chapters)
      const spine = book.spine.spineItems;
      
      for (let i = 0; i < spine.length; i++) {
        const spineItem = spine[i];
        const doc = await spineItem.load(book.load.bind(book));
        
        // Extract text content
        const textContent = this.extractTextFromHTML(doc.documentElement.innerHTML);
        
        if (textContent.trim().length > 100) { // Skip very short sections
          // Try to find chapter title
          const chapterTitle = this.extractChapterTitle(textContent) || `Chapter ${chapters.length + 1}`;
          
          chapters.push({
            title: chapterTitle,
            text: textContent.trim(),
            word_count: textContent.split(/\s+/).length,
          });
        }
      }
      
      return {
        title,
        author,
        chapters: chapters.length > 0 ? chapters : [{
          title: 'Full Book',
          text: chapters.map(c => c.text).join('\n\n'),
          word_count: chapters.reduce((sum, c) => sum + c.word_count, 0),
        }],
        format: 'epub',
      };
    } catch (error) {
      console.error('Error processing EPUB:', error);
      throw new Error('Failed to process EPUB file. The file might be corrupted or use an unsupported format.');
    }
  }

  /**
   * Process plain text files
   */
  async processText(file: File): Promise<ProcessedDocument> {
    const text = await file.text();
    const title = file.name.replace(/\.(txt|text)$/i, '');
    
    // Try to detect chapters
    const chapters = this.detectTextChapters(text);
    
    return {
      title,
      chapters: chapters.length > 1 ? chapters : [{
        title: title,
        text: text.trim(),
        word_count: text.split(/\s+/).length,
      }],
      format: 'txt',
    };
  }

  /**
   * Detect chapters from full text and pages
   */
  private detectChapters(fullText: string, pages: { pageNum: number; text: string }[]): DocumentChapter[] {
    const chapterPatterns = [
      /^(Chapter\s+\d+|CHAPTER\s+\d+)[\s\S]*?$/gmi,
      /^(Part\s+\d+|PART\s+\d+)[\s\S]*?$/gmi,
      /^(\d+\.\s+[A-Z][A-Za-z\s]+)$/gmi,
    ];
    
    const chapters: DocumentChapter[] = [];
    
    for (const pattern of chapterPatterns) {
      const matches = Array.from(fullText.matchAll(pattern));
      
      if (matches.length > 1) {
        matches.forEach((match, index) => {
          const startIndex = match.index!;
          const endIndex = index < matches.length - 1 ? matches[index + 1].index! : fullText.length;
          const chapterText = fullText.slice(startIndex, endIndex).trim();
          
          if (chapterText.length > 200) { // Skip very short chapters
            const title = this.extractChapterTitle(chapterText) || `Chapter ${index + 1}`;
            
            chapters.push({
              title,
              text: chapterText,
              word_count: chapterText.split(/\s+/).length,
            });
          }
        });
        
        if (chapters.length > 1) break; // Use first successful pattern
      }
    }
    
    return chapters;
  }

  /**
   * Split pages into chunks
   */
  private splitByPages(pages: { pageNum: number; text: string }[], pagesPerChunk: number): DocumentChapter[] {
    const chapters: DocumentChapter[] = [];
    
    for (let i = 0; i < pages.length; i += pagesPerChunk) {
      const chunk = pages.slice(i, i + pagesPerChunk);
      const startPage = chunk[0].pageNum;
      const endPage = chunk[chunk.length - 1].pageNum;
      
      const text = chunk.map(p => p.text).join('\n\n').trim();
      
      if (text.length > 100) {
        chapters.push({
          title: `Pages ${startPage}-${endPage}`,
          text,
          word_count: text.split(/\s+/).length,
          page_start: startPage,
          page_end: endPage,
        });
      }
    }
    
    return chapters;
  }

  /**
   * Detect chapters in plain text
   */
  private detectTextChapters(text: string): DocumentChapter[] {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const chapters: DocumentChapter[] = [];
    let currentChapter: { title: string; lines: string[] } | null = null;
    
    for (const line of lines) {
      // Check if line looks like a chapter header
      if (this.isChapterHeader(line)) {
        // Save previous chapter
        if (currentChapter && currentChapter.lines.length > 5) {
          const text = currentChapter.lines.join('\n').trim();
          chapters.push({
            title: currentChapter.title,
            text,
            word_count: text.split(/\s+/).length,
          });
        }
        
        // Start new chapter
        currentChapter = { title: line, lines: [] };
      } else if (currentChapter) {
        currentChapter.lines.push(line);
      } else {
        // No chapter detected yet, start with first chapter
        currentChapter = { title: 'Chapter 1', lines: [line] };
      }
    }
    
    // Add final chapter
    if (currentChapter && currentChapter.lines.length > 5) {
      const text = currentChapter.lines.join('\n').trim();
      chapters.push({
        title: currentChapter.title,
        text,
        word_count: text.split(/\s+/).length,
      });
    }
    
    return chapters;
  }

  /**
   * Check if a line looks like a chapter header
   */
  private isChapterHeader(line: string): boolean {
    return /^(Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|PART\s+\d+|\d+\.\s+[A-Z])/i.test(line) &&
           line.length < 100;
  }

  /**
   * Extract text from HTML content
   */
  private extractTextFromHTML(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove script and style elements
    const scripts = doc.querySelectorAll('script, style');
    scripts.forEach(el => el.remove());
    
    return doc.body?.textContent || doc.textContent || '';
  }

  /**
   * Extract chapter title from text
   */
  private extractChapterTitle(text: string): string | null {
    const lines = text.split('\n').slice(0, 5); // Look in first 5 lines
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Chapter patterns
      if (/^(Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|PART\s+\d+)/i.test(trimmed)) {
        return trimmed.length > 50 ? trimmed.slice(0, 50) + '...' : trimmed;
      }
      
      // Numbered sections
      if (/^\d+\.\s+[A-Z]/.test(trimmed) && trimmed.length < 100) {
        return trimmed;
      }
      
      // All caps titles (likely headers)
      if (/^[A-Z\s]{5,50}$/.test(trimmed) && !/^\d+$/.test(trimmed)) {
        return trimmed;
      }
    }
    
    return null;
  }

  /**
   * Main processing method
   */
  async processDocument(file: File): Promise<ProcessedDocument> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return await this.processPDF(file);
      case 'epub':
        return await this.processEPUB(file);
      case 'txt':
      case 'text':
        return await this.processText(file);
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();
export default DocumentProcessor;