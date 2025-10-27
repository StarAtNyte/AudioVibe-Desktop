import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Settings, Loader } from 'lucide-react';
import { ttsService } from '../../services/ttsService';
import { ProcessedDocument, DocumentChapter } from '../../services/rustDocumentProcessor';

interface RealtimeTTSPlayerProps {
  document: ProcessedDocument;
  onClose?: () => void;
}

interface AudioBuffer {
  audioElement: HTMLAudioElement;
  blob: Blob;
  startTime: number;
  duration: number;
}

interface StreamingState {
  isPlaying: boolean;
  isBuffering: boolean;
  currentChapter: number;
  currentPosition: number; // seconds
  bufferProgress: number; // percentage of chapter buffered
  generationSpeed: number; // sentences per second
}

const RealtimeTTSPlayer: React.FC<RealtimeTTSPlayerProps> = ({
  document,
  onClose,
}) => {
  const [state, setState] = useState<StreamingState>({
    isPlaying: false,
    isBuffering: false,
    currentChapter: 0,
    currentPosition: 0,
    bufferProgress: 0,
    generationSpeed: 0,
  });

  const [selectedVoice, setSelectedVoice] = useState('en-Alice_woman');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);

  // Audio buffer management
  const audioBufferRef = useRef<AudioBuffer[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamingRef = useRef<AbortController | null>(null);

  // Current chapter data
  const currentChapter = document.chapters[state.currentChapter];
  
  // Split chapter into sentences for streaming
  const splitIntoSentences = (text: string): string[] => {
    return text.split(/(?<=[.!?])\\s+/).filter(s => s.trim().length > 0);
  };

  const sentences = splitIntoSentences(currentChapter?.text || '');

  // Stream TTS for current chapter
  const streamChapter = async (chapterIndex: number) => {
    if (!document.chapters[chapterIndex]) return;

    setState(prev => ({ ...prev, isBuffering: true, currentChapter: chapterIndex }));
    
    // Cancel any existing streaming
    if (streamingRef.current) {
      streamingRef.current.abort();
    }
    streamingRef.current = new AbortController();

    const chapter = document.chapters[chapterIndex];
    const chapterSentences = splitIntoSentences(chapter.text);
    
    try {
      let audioBuffers: AudioBuffer[] = [];
      let totalDuration = 0;

      // Stream sentences in batches of 3-4 for better performance
      const batchSize = 3;
      for (let i = 0; i < chapterSentences.length; i += batchSize) {
        const batch = chapterSentences.slice(i, i + batchSize);
        const batchText = batch.join(' ');

        console.log(`🎵 Generating batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chapterSentences.length/batchSize)}`);

        // Generate audio for this batch
        const startTime = performance.now();
        const audioResponse = await ttsService.generateAudio({ text: batchText });
        const generationTime = (performance.now() - startTime) / 1000;

        // Convert base64 to blob
        const audioData = atob(audioResponse.audio_data);
        const audioArray = new Uint8Array(audioData.length);
        for (let j = 0; j < audioData.length; j++) {
          audioArray[j] = audioData.charCodeAt(j);
        }
        const audioBlob = new Blob([audioArray], { type: 'audio/wav' });

        // Create audio element
        const audioElement = new Audio(URL.createObjectURL(audioBlob));
        audioElement.playbackRate = playbackSpeed;
        audioElement.volume = volume;

        const audioBuffer: AudioBuffer = {
          audioElement,
          blob: audioBlob,
          startTime: totalDuration,
          duration: audioResponse.duration,
        };

        audioBuffers.push(audioBuffer);
        totalDuration += audioResponse.duration;

        // Update buffer progress
        const progress = ((i + batchSize) / chapterSentences.length) * 100;
        setState(prev => ({ 
          ...prev, 
          bufferProgress: Math.min(progress, 100),
          generationSpeed: batch.length / generationTime,
        }));

        // Start playing as soon as we have the first batch
        if (i === 0 && state.isPlaying) {
          playAudioBuffer(audioBuffer);
        }

        // Check if streaming was cancelled
        if (streamingRef.current?.signal.aborted) {
          break;
        }
      }

      audioBufferRef.current = audioBuffers;
      setState(prev => ({ ...prev, isBuffering: false }));

    } catch (error) {
      console.error('Streaming error:', error);
      setState(prev => ({ ...prev, isBuffering: false }));
    }
  };

  const playAudioBuffer = (buffer: AudioBuffer) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    currentAudioRef.current = buffer.audioElement;
    
    buffer.audioElement.addEventListener('ended', () => {
      // Play next buffer
      const currentIndex = audioBufferRef.current.findIndex(b => b === buffer);
      if (currentIndex < audioBufferRef.current.length - 1) {
        playAudioBuffer(audioBufferRef.current[currentIndex + 1]);
      } else {
        // Chapter ended, play next chapter if available
        if (state.currentChapter < document.chapters.length - 1) {
          playChapter(state.currentChapter + 1);
        } else {
          setState(prev => ({ ...prev, isPlaying: false }));
        }
      }
    });

    buffer.audioElement.addEventListener('timeupdate', () => {
      const currentTime = buffer.startTime + buffer.audioElement.currentTime;
      setState(prev => ({ ...prev, currentPosition: currentTime }));
    });

    buffer.audioElement.play();
  };

  const playChapter = async (chapterIndex: number) => {
    setState(prev => ({ ...prev, isPlaying: true }));
    await streamChapter(chapterIndex);
  };

  const togglePlay = () => {
    if (state.isPlaying) {
      // Pause
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setState(prev => ({ ...prev, isPlaying: false }));
    } else {
      // Resume or start
      if (currentAudioRef.current && currentAudioRef.current.paused) {
        currentAudioRef.current.play();
      } else {
        playChapter(state.currentChapter);
      }
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  };

  const skipToChapter = (chapterIndex: number) => {
    if (chapterIndex >= 0 && chapterIndex < document.chapters.length) {
      playChapter(chapterIndex);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">{document.title}</h2>
          <p className="text-gray-400">{document.author || 'Unknown Author'}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            ✕
          </button>
        )}
      </div>

      {/* Current Chapter Info */}
      <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
        <h3 className="font-semibold mb-2">{currentChapter?.title}</h3>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Chapter {state.currentChapter + 1} of {document.chapters.length}</span>
          <span>•</span>
          <span>{currentChapter?.word_count} words</span>
          {state.isBuffering && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Loader className="h-3 w-3 animate-spin" />
                Buffering {Math.round(state.bufferProgress)}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={() => skipToChapter(state.currentChapter - 1)}
          disabled={state.currentChapter === 0}
          className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 disabled:opacity-50"
        >
          <SkipBack className="h-5 w-5" />
        </button>

        <button
          onClick={togglePlay}
          disabled={state.isBuffering && !currentAudioRef.current}
          className="p-4 bg-green-600 rounded-full hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
        >
          {state.isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
        </button>

        <button
          onClick={() => skipToChapter(state.currentChapter + 1)}
          disabled={state.currentChapter === document.chapters.length - 1}
          className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 disabled:opacity-50"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      {/* Progress and Settings */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Voice</label>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600"
          >
            <option value="en-Alice_woman">Alice (Woman)</option>
            <option value="en-Bob_man">Bob (Man)</option>
            <option value="en-Carol_woman">Carol (Woman)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Speed: {playbackSpeed}x</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Volume: {Math.round(volume * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Chapter List */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="font-semibold mb-3">Chapters</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {document.chapters.map((chapter, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                index === state.currentChapter 
                  ? 'bg-green-900/30 border-l-4 border-green-500' 
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
              onClick={() => skipToChapter(index)}
            >
              <div>
                <div className="font-medium text-sm">{chapter.title}</div>
                <div className="text-xs text-gray-400">{chapter.word_count} words</div>
              </div>
              <button className="p-2 text-green-400 hover:text-green-300">
                <Play className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      {state.generationSpeed > 0 && (
        <div className="mt-4 text-xs text-gray-400 text-center">
          Generation Speed: {state.generationSpeed.toFixed(1)} sentences/sec • 
          Buffer: {Math.round(state.bufferProgress)}%
        </div>
      )}
    </div>
  );
};

export default RealtimeTTSPlayer;