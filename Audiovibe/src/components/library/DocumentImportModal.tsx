import React, { useState, useRef } from 'react';
import { X, Upload, Book, Mic, Settings, Play, Download, AlertCircle, Minimize2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { ttsService, type VoiceInfo } from '../../services/ttsService';
import { rustDocumentProcessor, type DocumentChapter, type ProcessedDocument } from '../../services/rustDocumentProcessor';

interface DocumentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport?: (audiobook: any) => void;
  onMinimize?: (generationState: {
    isProcessing: boolean;
    progress: ProcessingProgress | null;
    documentTitle: string;
    currentChapter: number;
    totalChapters: number;
  }) => void;
}

interface ProcessingProgress {
  currentChapter: number;
  currentChunk: number;
  totalChunks: number;
  status: string;
}

const DocumentImportModal: React.FC<DocumentImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onMinimize,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [documentInfo, setDocumentInfo] = useState<ProcessedDocument | null>(null);
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('en-Alice_woman');
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(false);
  const [voiceLoadError, setVoiceLoadError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isParsingDocument, setIsParsingDocument] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [generatedAudioFiles, setGeneratedAudioFiles] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      loadVoices();
    }
  }, [isOpen]);

  const loadVoices = async (retryCount = 0) => {
    setIsLoadingVoices(true);
    setVoiceLoadError('');
    
    try {
      console.log(`🎙️ Loading voices from optimized VibeVoice API (attempt ${retryCount + 1})...`);
      console.log('API URL:', ttsService.getApiUrl ? ttsService.getApiUrl() : 'Unknown');
      
      // Modal functions can take 30-60 seconds to cold start with model loading
      console.log('⏩ Loading voices directly (this may take up to 60s on first load)...');
      
      const voices = await ttsService.getVoices();
      console.log('✅ Raw voices response:', voices);
      console.log('✅ Voices type:', typeof voices);
      console.log('✅ Voices length:', voices?.length);
      console.log('✅ First voice:', voices?.[0]);
      
      if (!voices || !Array.isArray(voices) || voices.length === 0) {
        console.error('❌ Invalid voices response:', { voices, isArray: Array.isArray(voices), length: voices?.length });
        throw new Error(`No valid voices returned from API. Got: ${typeof voices} with ${voices?.length || 0} items`);
      }
      
      setAvailableVoices(voices);
      
      // If the default selected voice is not available, select the first voice
      if (voices.length > 0 && !voices.find(v => v.name === selectedVoice)) {
        setSelectedVoice(voices[0].name);
        console.log(`🎙️ Auto-selected voice: ${voices[0].name}`);
      }
      
      console.log(`✅ Loaded ${voices.length} voices successfully`);
    } catch (error) {
      console.error('❌ Failed to load voices:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Auto-retry up to 2 times for timeout errors
      if (retryCount < 2 && errorMessage.includes('timeout')) {
        console.log(`🔄 Retrying in 5 seconds (attempt ${retryCount + 2}/3)...`);
        setTimeout(() => loadVoices(retryCount + 1), 5000);
        setVoiceLoadError(`Connection timeout. Retrying in 5 seconds... (attempt ${retryCount + 2}/3)`);
        return;
      }
      
      setVoiceLoadError(`Failed to connect to VibeVoice API: ${errorMessage}`);
    } finally {
      if (retryCount === 0 || isLoadingVoices) { // Only stop loading if final attempt
        setIsLoadingVoices(false);
      }
    }
  };

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Documents',
            extensions: ['pdf', 'epub', 'txt']
          }
        ]
      });
      
      if (selected && typeof selected === 'string') {
        setSelectedFile(selected);
        // Extract filename from path
        const fileName = selected.split(/[\\\/]/).pop() || 'Unknown';
        setSelectedFileName(fileName);
        processDocument(selected);
      }
    } catch (error) {
      console.error('File selection failed:', error);
      setParseError('Failed to select file');
    }
  };

  const processDocument = async (filePath: string) => {
    setIsParsingDocument(true);
    setParseError('');
    setDocumentInfo(null);
    
    try {
      console.log('Processing document:', filePath);
      const processed = await rustDocumentProcessor.processDocument(filePath);
      setDocumentInfo(processed);
      console.log('Document processed:', processed);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setParseError(`Failed to process document: ${errorMessage}`);
      console.error('Document processing error:', error);
    } finally {
      setIsParsingDocument(false);
    }
  };


  const generateAudiobook = async () => {
    if (!documentInfo || !documentInfo.chapters) return;

    setIsProcessing(true);
    setGeneratedAudioFiles([]);
    setErrors([]);

    try {
      // Import invoke function
      const { invoke } = await import('@tauri-apps/api/core');

      // First create the audiobook record in the database
      const audiobook = await invoke('create_tts_audiobook', {
        title: documentInfo.title,
        author: documentInfo.author || 'Unknown Author',
        chapters: documentInfo.chapters
      }) as any;

      console.log('Created audiobook record:', audiobook);

      // Generate audio files with the audiobook ID
      const result = await ttsService.generateAudiobook(
        documentInfo.chapters,
        selectedVoice,
        (chapter, chunk, total) => {
          setProgress({
            currentChapter: chapter,
            currentChunk: chunk,
            totalChunks: total,
            status: `Processing Chapter ${chapter}, Chunk ${chunk}/${total}...`,
          });
        },
        audiobook.id, // Pass the audiobook ID
        true // Save to files
      );

      setGeneratedAudioFiles(result.audioFiles);
      setErrors(result.errors);

      if (result.success) {
        // Notify the parent component that the audiobook was created
        onImport?.(audiobook);
      } else {
        setErrors([...result.errors, 'Some audio files failed to generate']);
      }
    } catch (error) {
      console.error('Failed to generate audiobook:', error);
      setErrors([`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setSelectedFileName('');
    setDocumentInfo(null);
    setGeneratedAudioFiles([]);
    setErrors([]);
    setProgress(null);
    setIsProcessing(false);
    setParseError('');
    setVoiceLoadError('');
    // Keep voices loaded for better UX
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-gray-100 rounded-lg p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Book className="h-6 w-6" />
            Import Document as Audiobook
          </h2>
          <div className="flex items-center gap-2">
            {isProcessing && onMinimize && (
              <button
                onClick={() => {
                  onMinimize({
                    isProcessing,
                    progress,
                    documentTitle: documentInfo?.title || 'Unknown Document',
                    currentChapter: progress?.currentChapter || 0,
                    totalChapters: documentInfo?.chapters?.length || 0,
                  });
                  // Don't close the modal completely, just minimize it
                }}
                className="text-gray-400 hover:text-gray-200 p-1 rounded hover:bg-gray-700"
                title="Minimize - Continue generation in background"
              >
                <Minimize2 className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-200"
              title={isProcessing ? "Close (generation will continue in background)" : "Close"}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* API Status */}
        <div className={`mb-6 p-4 border rounded-lg ${
          isLoadingVoices 
            ? 'border-blue-600 bg-blue-900/20' 
            : voiceLoadError 
            ? 'border-red-600 bg-red-900/20' 
            : availableVoices.length > 0 
            ? 'border-green-600 bg-green-900/20' 
            : 'border-yellow-600 bg-yellow-900/20'
        }`}>
          <h3 className={`font-semibold mb-2 flex items-center gap-2 ${
            isLoadingVoices 
              ? 'text-blue-400' 
              : voiceLoadError 
              ? 'text-red-400' 
              : availableVoices.length > 0 
              ? 'text-green-400' 
              : 'text-yellow-400'
          }`}>
            <Settings className="h-4 w-4" />
            VibeVoice TTS Status
            {isLoadingVoices && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 ml-2"></div>
            )}
          </h3>
          <p className={`text-sm ${
            isLoadingVoices 
              ? 'text-blue-300' 
              : voiceLoadError 
              ? 'text-red-300' 
              : availableVoices.length > 0 
              ? 'text-green-300' 
              : 'text-yellow-300'
          }`}>
            {isLoadingVoices 
              ? 'Connecting to VibeVoice API... (First load may take 30-60 seconds as Modal loads the AI model on GPU)' 
              : voiceLoadError 
              ? voiceLoadError
              : availableVoices.length > 0 
              ? `Connected to VibeVoice API with ${availableVoices.length} available voices. Ready to convert documents to audiobooks!` 
              : 'Waiting for voice data...'
            }
          </p>
        </div>

        {/* Step 1: File Upload */}
        <div className="space-y-6">
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center bg-gray-800/50">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select Document</h3>
            <p className="text-gray-400 mb-4">
              Upload PDF, EPUB, or TXT files to convert to audiobook
            </p>
            <button
              onClick={handleFileSelect}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isParsingDocument}
            >
              {isParsingDocument ? 'Processing...' : 'Choose File'}
            </button>
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-400">
                Selected: {selectedFileName}
              </p>
            )}
            {isParsingDocument && (
              <div className="mt-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-sm text-gray-400 mt-2">Extracting text from document...</p>
              </div>
            )}
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="border border-red-600 rounded-lg p-4 bg-red-900/20">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="font-semibold">Document Processing Error</span>
              </div>
              <p className="text-sm text-red-300 mt-1">{parseError}</p>
            </div>
          )}

          {/* Step 2: Document Preview */}
          {documentInfo && (
            <div className="border border-gray-600 rounded-lg p-4 bg-gray-800/50">
              <h3 className="font-semibold mb-3">Document Preview</h3>
              
              {/* Title - Full Width */}
              <div className="mb-3 p-3 bg-gray-700/50 rounded-lg">
                <div className="text-sm font-medium text-gray-300 mb-1">Title:</div>
                <div className="text-gray-100 break-words">{documentInfo.title}</div>
              </div>
              
              {/* Format and Chapters - Side by Side */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="font-medium text-gray-300 mb-1">Format:</div>
                  <div className="text-gray-100">{documentInfo.format?.toUpperCase()}</div>
                </div>
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="font-medium text-gray-300 mb-1">Chapters:</div>
                  <div className="text-gray-100">{documentInfo.chapters?.length || 0}</div>
                </div>
              </div>
              
              {/* Author if available */}
              {documentInfo.author && (
                <div className="mb-4 p-3 bg-gray-700/50 rounded-lg text-sm">
                  <div className="font-medium text-gray-300 mb-1">Author:</div>
                  <div className="text-gray-100">{documentInfo.author}</div>
                </div>
              )}

              <div className="space-y-2 max-h-32 overflow-y-auto">
                {documentInfo.chapters?.slice(0, 3).map((chapter: DocumentChapter, index: number) => (
                  <div key={index} className="p-2 border border-gray-600 rounded bg-gray-700/50">
                    <div className="font-medium text-gray-100 text-sm">{chapter.title}</div>
                    <div className="text-xs text-gray-400">
                      {chapter.word_count} words • ~{Math.ceil(ttsService.estimateAudioDuration(chapter.text) / 60)} min
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {chapter.text.substring(0, 100)}...
                    </div>
                  </div>
                ))}
                {documentInfo.chapters && documentInfo.chapters.length > 3 && (
                  <div className="text-xs text-gray-400 text-center p-2">
                    ... and {documentInfo.chapters.length - 3} more chapters
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Voice Selection */}
          {documentInfo && (
            <div className="border border-gray-600 rounded-lg p-4 bg-gray-800/50">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Voice Selection
                {isLoadingVoices && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 ml-2"></div>
                )}
              </h3>
              
              {isLoadingVoices ? (
                <div className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-400">
                  Loading voices...
                </div>
              ) : voiceLoadError ? (
                <div className="space-y-2">
                  <div className="w-full px-3 py-2 border border-red-600 rounded-md bg-red-900/20 text-red-300">
                    {voiceLoadError}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadVoices()}
                      className="text-sm text-blue-400 hover:text-blue-300 underline"
                    >
                      Retry loading voices
                    </button>
                    <button
                      onClick={async () => {
                        console.log('🔧 Testing API connection...');
                        try {
                          console.log('Testing /health...');
                          const healthRes = await fetch(ttsService.getApiUrl() + '/health');
                          const healthData = await healthRes.json();
                          console.log('✅ Health Response:', healthData);
                          
                          console.log('Testing /voices...');
                          const voicesRes = await fetch(ttsService.getApiUrl() + '/voices');
                          const voicesData = await voicesRes.json();
                          console.log('✅ Voices Response:', voicesData);
                          console.log('✅ Voices Data Type:', typeof voicesData);
                          console.log('✅ Voices Keys:', Object.keys(voicesData || {}));
                          
                        } catch (err) {
                          console.error('❌ API Test Error:', err);
                        }
                      }}
                      className="text-xs text-gray-400 hover:text-gray-300 underline"
                    >
                      Debug API
                    </button>
                  </div>
                </div>
              ) : availableVoices.length === 0 ? (
                <div className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-400">
                  No voices available
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-100"
                    disabled={isProcessing}
                  >
                    {availableVoices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} - {voice.description}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-400">
                    {availableVoices.length} voice{availableVoices.length !== 1 ? 's' : ''} available from VibeVoice API
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Generation Controls */}
          {documentInfo && (
            <div className="flex gap-3">
              <button
                onClick={generateAudiobook}
                disabled={isProcessing}
                className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="h-4 w-4" />
                {isProcessing ? 'Generating...' : 'Generate Audiobook'}
              </button>
              {isProcessing && (
                <button
                  onClick={() => {
                    setIsProcessing(false);
                    setProgress(null);
                    setErrors([...errors, 'Generation cancelled by user']);
                  }}
                  className="px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  title="Cancel Generation"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="border border-blue-600 rounded-lg p-4 bg-blue-900/20">
              <h3 className="font-semibold mb-2 text-blue-400 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                Generation Progress
              </h3>
              <div className="text-sm text-blue-300 mb-3">{progress.status}</div>
              <div className="w-full bg-gray-700 rounded-full h-3 mt-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                  style={{
                    width: `${(progress.currentChunk / progress.totalChunks) * 100}%`,
                  }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-2 text-right">
                {progress.currentChunk} of {progress.totalChunks} chunks
              </div>
            </div>
          )}

          {/* Results */}
          {generatedAudioFiles.length > 0 && (
            <div className="border border-green-600 rounded-lg p-4 bg-green-900/20">
              <h3 className="font-semibold mb-2 text-green-400 flex items-center gap-2">
                <Play className="h-4 w-4" />
                Generated Audio Files
              </h3>
              <p className="text-sm text-green-300 mb-3">
                Successfully generated {generatedAudioFiles.length} audio file{generatedAudioFiles.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-3">
                {generatedAudioFiles.map((audioUrl, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-600">
                    <div className="flex-shrink-0 text-sm text-gray-400 font-mono">
                      Ch.{index + 1}
                    </div>
                    <audio controls className="flex-1 h-8">
                      <source src={audioUrl} type="audio/wav" />
                    </audio>
                    <a
                      href={audioUrl}
                      download={`chapter_${index + 1}.wav`}
                      className="p-1 text-green-400 hover:text-green-300 transition-colors rounded hover:bg-green-900/30"
                      title={`Download Chapter ${index + 1}`}
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="border border-red-600 rounded-lg p-4 bg-red-900/20">
              <h3 className="font-semibold mb-2 text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Generation Errors ({errors.length})
              </h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {errors.map((error, index) => (
                  <div key={index} className="p-2 bg-gray-800/50 rounded border-l-4 border-red-500">
                    <div className="text-sm text-red-300">{error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentImportModal;