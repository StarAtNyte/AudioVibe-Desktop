import React from 'react';
import { Play, X, Maximize2 } from 'lucide-react';

interface GenerationState {
  isProcessing: boolean;
  progress: {
    currentChapter: number;
    currentChunk: number;
    totalChunks: number;
    status: string;
  } | null;
  documentTitle: string;
  currentChapter: number;
  totalChapters: number;
}

interface GenerationStatusIndicatorProps {
  generationState: GenerationState | null;
  onRestore: () => void;
  onCancel: () => void;
}

const GenerationStatusIndicator: React.FC<GenerationStatusIndicatorProps> = ({
  generationState,
  onRestore,
  onCancel,
}) => {
  if (!generationState || !generationState.isProcessing) {
    return null;
  }

  const progress = generationState.progress;
  const progressPercentage = progress 
    ? Math.round((progress.currentChunk / progress.totalChunks) * 100)
    : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-gray-900 border border-blue-600 rounded-lg p-3 shadow-2xl min-w-[300px] max-w-[400px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span className="text-sm font-medium text-blue-400">Generating Audio</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRestore}
              className="p-1 text-gray-400 hover:text-gray-200 rounded hover:bg-gray-700"
              title="Show generation details"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700"
              title="Cancel generation"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        
        <div className="text-xs text-gray-300 mb-2 truncate">
          {generationState.documentTitle}
        </div>
        
        {progress && (
          <>
            <div className="text-xs text-gray-400 mb-2">
              Chapter {progress.currentChapter} • {progress.currentChunk}/{progress.totalChunks} chunks
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            
            <div className="text-xs text-gray-400">
              {progressPercentage}% complete
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GenerationStatusIndicator;