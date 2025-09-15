import React, { useState, useRef } from 'react';
import { X, Upload, File, Folder, Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface AddAudiobookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFiles: (files: FileList) => Promise<void>;
  onAddFolder: (path: string) => Promise<void>;
}

interface FileValidation {
  file: File;
  valid: boolean;
  error?: string;
}

export const AddAudiobookModal: React.FC<AddAudiobookModalProps> = ({
  isOpen,
  onClose,
  onAddFiles,
  onAddFolder
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationResults, setValidationResults] = useState<FileValidation[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.wma'];
  
  const validateFiles = (files: FileList): FileValidation[] => {
    const results: FileValidation[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!supportedFormats.includes(extension)) {
        results.push({
          file,
          valid: false,
          error: `Unsupported format: ${extension}`
        });
      } else if (file.size > 500 * 1024 * 1024) { // 500MB limit
        results.push({
          file,
          valid: false,
          error: 'File too large (max 500MB)'
        });
      } else {
        results.push({
          file,
          valid: true
        });
      }
    }
    
    return results;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = e.dataTransfer.files;
      const validation = validateFiles(files);
      setValidationResults(validation);
      setShowValidation(true);

      const validFiles = validation.filter(v => v.valid);
      if (validFiles.length > 0) {
        const validFileList = new DataTransfer();
        validFiles.forEach(v => validFileList.items.add(v.file));
        
        setLoading(true);
        try {
          await onAddFiles(validFileList.files);
          onClose();
        } catch (error) {
          console.error('Error adding files:', error);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = e.target.files;
      const validation = validateFiles(files);
      setValidationResults(validation);
      setShowValidation(true);

      const validFiles = validation.filter(v => v.valid);
      if (validFiles.length > 0) {
        const validFileList = new DataTransfer();
        validFiles.forEach(v => validFileList.items.add(v.file));
        
        setLoading(true);
        try {
          await onAddFiles(validFileList.files);
          onClose();
        } catch (error) {
          console.error('Error adding files:', error);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Get the folder path from the first file
      const firstFile = e.target.files[0];
      const folderPath = firstFile.webkitRelativePath.split('/')[0];
      
      setLoading(true);
      try {
        await onAddFolder(folderPath);
        onClose();
      } catch (error) {
        console.error('Error adding folder:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add Audiobooks
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showValidation ? (
            <>
              {/* Drag and Drop Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Drop your audiobooks here
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Or use one of the options below
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    <File size={16} />
                    <span>Select Files</span>
                  </button>
                  
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await onAddFolder('');
                        onClose();
                      } catch (error) {
                        console.error('Error adding folder:', error);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    <Folder size={16} />
                    <span>Select Folder</span>
                  </button>
                </div>
              </div>

              {/* Supported Formats */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Supported Formats
                </h4>
                <div className="flex flex-wrap gap-2">
                  {supportedFormats.map(format => (
                    <span
                      key={format}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded"
                    >
                      {format}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                  Tips for best results:
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                  <li>• Organize files in folders by book title</li>
                  <li>• Include cover art images (cover.jpg, folder.jpg)</li>
                  <li>• Ensure proper ID3 tags for metadata</li>
                  <li>• Maximum file size: 500MB per file</li>
                </ul>
              </div>
            </>
          ) : (
            /* Validation Results */
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                File Validation Results
              </h3>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {validationResults.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 p-3 rounded-lg ${
                      result.valid
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    {result.valid ? (
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        result.valid
                          ? 'text-green-900 dark:text-green-300'
                          : 'text-red-900 dark:text-red-300'
                      }`}>
                        {result.file.name}
                      </p>
                      <p className={`text-xs ${
                        result.valid
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {result.valid 
                          ? `${formatFileSize(result.file.size)} - Ready to import`
                          : result.error
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {validationResults.filter(r => r.valid).length} of {validationResults.length} files valid
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowValidation(false);
                      setValidationResults([]);
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  
                  {validationResults.some(r => r.valid) && (
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={supportedFormats.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {/* Commented out web-based folder picker since we use Tauri native dialogs
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          onChange={handleFolderSelect}
          className="hidden"
        />
        */}

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="text-gray-600 dark:text-gray-400">Processing files...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};