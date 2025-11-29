import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { Audiobook, UpdateAudiobookDto } from '../../types';
import { useLibraryStore } from '../../store';

interface EditAudiobookModalProps {
  isOpen: boolean;
  onClose: () => void;
  audiobook: Audiobook;
}

export const EditAudiobookModal: React.FC<EditAudiobookModalProps> = ({
  isOpen,
  onClose,
  audiobook
}) => {
  const { updateAudiobook } = useLibraryStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState(audiobook.title);
  const [author, setAuthor] = useState(audiobook.author || '');
  const [narrator, setNarrator] = useState(audiobook.narrator || '');
  const [genre, setGenre] = useState(audiobook.genre || '');
  const [description, setDescription] = useState(audiobook.description || '');
  const [coverImagePath, setCoverImagePath] = useState(audiobook.cover_image_path || '');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when audiobook changes
  useEffect(() => {
    setTitle(audiobook.title);
    setAuthor(audiobook.author || '');
    setNarrator(audiobook.narrator || '');
    setGenre(audiobook.genre || '');
    setDescription(audiobook.description || '');
    setCoverImagePath(audiobook.cover_image_path || '');
    setPreviewImage(null);
    setError(null);
  }, [audiobook]);

  const handleImageSelect = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
        }]
      });

      if (selected && typeof selected === 'string') {
        setCoverImagePath(selected);
        // Create preview URL for the selected file
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const previewUrl = convertFileSrc(selected);
        setPreviewImage(previewUrl);
      }
    } catch (err) {
      console.error('Error selecting image:', err);
      setError('Failed to select image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updates: UpdateAudiobookDto = {};

      // Only include changed fields
      if (title !== audiobook.title) updates.title = title;
      if (author !== (audiobook.author || '')) updates.author = author;
      if (narrator !== (audiobook.narrator || '')) updates.narrator = narrator;
      if (genre !== (audiobook.genre || '')) updates.genre = genre;
      if (description !== (audiobook.description || '')) updates.description = description;
      if (coverImagePath !== (audiobook.cover_image_path || '')) updates.cover_image_path = coverImagePath;

      // Only update if there are changes
      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      await updateAudiobook(audiobook.id, updates);
      onClose();
    } catch (err) {
      console.error('Failed to update audiobook:', err);
      setError(err instanceof Error ? err.message : 'Failed to update audiobook');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Audiobook
          </h2>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={loading}
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cover Image
            </label>
            <div className="flex items-start space-x-4">
              {/* Preview */}
              <div className="flex-shrink-0">
                {(previewImage || audiobook.cover_image_path) ? (
                  <img
                    src={previewImage || audiobook.cover_image_path}
                    alt="Cover preview"
                    className="w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center">
                    <ImageIcon size={48} className="text-white/80" />
                  </div>
                )}
              </div>

              {/* Upload button */}
              <div className="flex-1">
                <button
                  type="button"
                  onClick={handleImageSelect}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm text-gray-700 dark:text-gray-300"
                  disabled={loading}
                >
                  <Upload size={16} />
                  <span>Choose Image</span>
                </button>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Supported formats: PNG, JPG, JPEG, WebP, GIF
                </p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
              disabled={loading}
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Author
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={loading}
            />
          </div>

          {/* Narrator */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Narrator
            </label>
            <input
              type="text"
              value={narrator}
              onChange={(e) => setNarrator(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={loading}
            />
          </div>

          {/* Genre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Genre
            </label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Fiction, Non-fiction, Mystery, etc."
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter a description for this audiobook..."
              disabled={loading}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !title.trim()}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
