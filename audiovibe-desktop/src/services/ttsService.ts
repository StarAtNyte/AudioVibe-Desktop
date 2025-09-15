/**
 * Text-to-Speech service using VibeVoice API on Modal Labs
 */

export interface TTSRequest {
  text: string;
  speaker_voice?: string;
  cfg_scale?: number;
  format?: 'wav' | 'mp3';
}

export interface TTSResponse {
  success: boolean;
  audio_data?: string; // base64 encoded audio
  duration?: number;
  sample_rate?: number;
  format?: string;
  error?: string;
}

export interface VoiceInfo {
  name: string;
  description: string;
}

export interface DocumentChapter {
  title: string;
  text: string;
  word_count?: number;
}

export interface DocumentInfo {
  title: string;
  author?: string;
  chapters: DocumentChapter[];
  format: string;
}

class TTSService {
  private apiBaseUrl: string;

  constructor(apiBaseUrl?: string) {
    // Default to the new optimized Modal endpoint
    this.apiBaseUrl = apiBaseUrl || 'https://whitestjohn0--vibevoice-tts-api-fastapi-app.modal.run';
  }

  /**
   * Set the API base URL
   */
  setApiUrl(url: string): void {
    this.apiBaseUrl = url;
  }

  /**
   * Get the current API base URL
   */
  getApiUrl(): string {
    return this.apiBaseUrl;
  }

  /**
   * Check if the TTS service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      console.log('🏥 Checking API health (this may take 10-15 seconds on cold start)...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
      
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error('❌ Health check HTTP error:', response.status, response.statusText);
        return false;
      }
      
      const data = await response.json();
      console.log('✅ Health check response:', data);
      return data.status === 'healthy';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ Health check timeout (Modal function may be cold starting)');
      } else {
        console.error('❌ TTS health check failed:', error);
      }
      return false;
    }
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<VoiceInfo[]> {
    try {
      console.log('🎙️ Fetching voices (may take time if API is cold starting)...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout for cold start
      
      const response = await fetch(`${this.apiBaseUrl}/voices`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('🎙️ Voices API response:', data);
      
      // Handle different response formats
      if (data.voices && Array.isArray(data.voices)) {
        return data.voices;
      } else if (Array.isArray(data)) {
        return data;
      } else {
        console.warn('⚠️ Unexpected voices response format:', data);
        return [];
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ Voices request timeout (Modal function may be cold starting)');
        throw new Error('Request timeout - API may be starting up, please retry in a moment');
      } else {
        console.error('❌ Failed to fetch voices:', error);
        throw error;
      }
    }
  }

  /**
   * Generate audio from text
   */
  async generateAudio(request: TTSRequest): Promise<TTSResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/generate-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: request.text,
          speaker_voice: request.speaker_voice || 'en-Alice_woman',
          cfg_scale: request.cfg_scale || 1.3,
          format: request.format || 'wav',
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('TTS generation failed:', error);
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Convert base64 audio data to blob
   */
  base64ToBlob(base64Data: string, mimeType: string = 'audio/wav'): Blob {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Create downloadable URL from base64 audio
   */
  createAudioUrl(base64Data: string, mimeType: string = 'audio/wav'): string {
    const blob = this.base64ToBlob(base64Data, mimeType);
    return URL.createObjectURL(blob);
  }

  /**
   * Split long text into chunks suitable for TTS
   */
  splitTextForTTS(text: string, maxLength: number = 1000): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if (currentChunk.length + trimmedSentence.length + 2 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = trimmedSentence;
        } else {
          // Single sentence is too long, split by words
          const words = trimmedSentence.split(' ');
          let tempChunk = '';
          
          for (const word of words) {
            if (tempChunk.length + word.length + 1 > maxLength) {
              if (tempChunk) {
                chunks.push(tempChunk.trim());
              }
              tempChunk = word;
            } else {
              tempChunk += (tempChunk ? ' ' : '') + word;
            }
          }
          currentChunk = tempChunk;
        }
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Estimate audio duration based on text length
   */
  estimateAudioDuration(text: string, wordsPerMinute: number = 150): number {
    const wordCount = text.split(/\s+/).length;
    return (wordCount / wordsPerMinute) * 60; // return seconds
  }

  /**
   * Generate audiobook from document chapters
   */
  async generateAudiobook(
    chapters: DocumentChapter[],
    voice: string = 'en-Alice_woman',
    onProgress?: (chapter: number, chunk: number, total: number) => void,
    audiobookId?: string,
    saveToFiles: boolean = true
  ): Promise<{ success: boolean; audioFiles: string[]; errors: string[]; audiobookId?: string }> {
    const audioFiles: string[] = [];
    const errors: string[] = [];
    let firstAudioFilePath: string | null = null;

    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
      const chapter = chapters[chapterIndex];
      const textChunks = this.splitTextForTTS(chapter.text, 800);
      const chapterFiles: string[] = [];

      for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
        const chunk = textChunks[chunkIndex];
        
        try {
          onProgress?.(chapterIndex + 1, chunkIndex + 1, textChunks.length);
          
          const result = await this.generateAudio({
            text: chunk,
            speaker_voice: voice,
            cfg_scale: 1.3,
            format: 'wav',
          });

          if (result.success && result.audio_data) {
            if (saveToFiles && audiobookId) {
              // Save to file using Tauri command
              const filename = `chapter_${chapterIndex + 1}_chunk_${chunkIndex + 1}.wav`;
              try {
                // Import invoke function
                const { invoke } = await import('@tauri-apps/api/core');
                const filePath = await invoke('save_audio_file', {
                  base64Data: result.audio_data,
                  filename: filename,
                  audiobookId: audiobookId
                });
                chapterFiles.push(filePath as string);
                
                // Store the first audio file path to update the audiobook record
                if (!firstAudioFilePath) {
                  firstAudioFilePath = filePath as string;
                }
                
                // Update chapter file path (for the first chunk of each chapter)
                if (chunkIndex === 0) {
                  try {
                    await invoke('update_chapter_file_path', {
                      audiobookId: audiobookId,
                      chapterNumber: chapterIndex + 1,
                      filePath: filePath as string
                    });
                    console.log(`✅ Updated chapter ${chapterIndex + 1} file path`);
                  } catch (updateError) {
                    console.error(`Failed to update chapter ${chapterIndex + 1} file path:`, updateError);
                  }
                }
              } catch (saveError) {
                console.error('Failed to save audio file:', saveError);
                errors.push(`Chapter ${chapterIndex + 1}, Chunk ${chunkIndex + 1}: Failed to save file - ${saveError}`);
                // Fallback to blob URL
                const audioUrl = this.createAudioUrl(result.audio_data);
                chapterFiles.push(audioUrl);
              }
            } else {
              // Create blob URL for immediate playback
              const audioUrl = this.createAudioUrl(result.audio_data);
              chapterFiles.push(audioUrl);
            }
          } else {
            errors.push(`Chapter ${chapterIndex + 1}, Chunk ${chunkIndex + 1}: ${result.error}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Chapter ${chapterIndex + 1}, Chunk ${chunkIndex + 1}: ${errorMsg}`);
        }

        // Add small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // For now, we'll just add the first chunk of each chapter as the chapter audio file
      // In a full implementation, you might want to concatenate all chunks for a chapter
      if (chapterFiles.length > 0) {
        audioFiles.push(chapterFiles[0]);
      }
    }

    // Update the audiobook's file_path to point to the first audio file for playback
    if (firstAudioFilePath && audiobookId && saveToFiles) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('update_audiobook_file_path', {
          audiobookId: audiobookId,
          filePath: firstAudioFilePath
        });
        console.log('✅ Updated audiobook file path to first audio file:', firstAudioFilePath);
      } catch (updateError) {
        console.error('Failed to update audiobook file path:', updateError);
        errors.push(`Failed to update audiobook file path: ${updateError}`);
      }
    }

    return {
      success: errors.length === 0,
      audioFiles,
      errors,
      audiobookId,
    };
  }
}

// Export singleton instance
export const ttsService = new TTSService();
export default TTSService;