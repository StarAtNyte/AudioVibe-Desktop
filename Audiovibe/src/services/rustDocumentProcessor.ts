/**
 * Rust-based document processing service using Tauri commands
 */

import { invoke } from '@tauri-apps/api/core';

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
  total_chapters: number;
}

class RustDocumentProcessor {
  /**
   * Process a document using the Rust backend
   */
  async processDocument(filePath: string): Promise<ProcessedDocument> {
    try {
      console.log('Processing document with Rust backend:', filePath);
      
      const result = await invoke<ProcessedDocument>('process_document', {
        filePath: filePath
      });
      
      console.log('Document processed successfully:', result);
      return result;
    } catch (error) {
      console.error('Rust document processing failed:', error);
      throw new Error(`Failed to process document: ${error}`);
    }
  }
}

// Export singleton instance
export const rustDocumentProcessor = new RustDocumentProcessor();
export default RustDocumentProcessor;