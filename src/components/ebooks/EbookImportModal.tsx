import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { useEbookStore } from '../../store/ebook';
import { CreateEbookDto, EbookMetadata } from '../../types/ebook';

interface EbookImportModalProps {
  onClose: () => void;
  onImportSuccess: () => void;
}

export const EbookImportModal: React.FC<EbookImportModalProps> = ({
  onClose,
  onImportSuccess,
}) => {
  const { createEbook } = useEbookStore();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Partial<EbookMetadata>>({});
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    genre: '',
    description: '',
  });

  const handleSelectFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const file = await open({
        multiple: false,
        filters: [{
          name: 'Ebooks',
          extensions: ['pdf', 'epub']
        }]
      });

      if (file && typeof file === 'string') {
        setSelectedFile(file);

        // Extract metadata
        setIsLoading(true);
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const extractedMetadata = await invoke('extract_ebook_metadata', { filePath: file }) as EbookMetadata;

          setMetadata(extractedMetadata);
          setFormData({
            title: extractedMetadata.title || '',
            author: extractedMetadata.author || '',
            genre: '',
            description: extractedMetadata.description || '',
          });
        } catch (error) {
          console.error('Failed to extract metadata:', error);
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Failed to select file:', error);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      const fileFormat = selectedFile.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub';

      // Convert cover_image to data URL if available
      let coverPath: string | undefined = undefined;
      if (metadata.cover_image) {
        coverPath = `data:image/png;base64,${metadata.cover_image}`;
      }

      const dto: CreateEbookDto = {
        title: formData.title || 'Untitled',
        file_path: selectedFile,
        file_format: fileFormat,
        author: formData.author || undefined,
        genre: formData.genre || undefined,
        description: formData.description || undefined,
        language: metadata.language,
        publisher: metadata.publisher,
        publication_date: metadata.publication_date,
        total_pages: metadata.total_pages,
        cover_path: coverPath,
      };

      await createEbook(dto);
      onImportSuccess();
    } catch (error) {
      console.error('Failed to import ebook:', error);
      alert('Failed to import ebook');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Ebook</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* File Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Ebook File
            </label>
            <button
              onClick={handleSelectFile}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors disabled:opacity-50"
            >
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">
                {selectedFile ? selectedFile.split('\\').pop() : 'Click to select PDF or EPUB file'}
              </span>
            </button>
          </div>

          {selectedFile && (
            <>
              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter ebook title"
                />
              </div>

              {/* Author */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Author
                </label>
                <input
                  type="text"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter author name"
                />
              </div>

              {/* Genre */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Genre
                </label>
                <input
                  type="text"
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Fiction, Non-fiction, Mystery"
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Enter book description"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isLoading || !selectedFile || !formData.title}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
