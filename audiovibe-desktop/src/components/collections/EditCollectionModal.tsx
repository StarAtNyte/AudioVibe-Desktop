import React, { useState, useEffect } from 'react';
import { useCollectionStore } from '../../store';
import { Collection, CreateCollectionDto } from '../../types';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface EditCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection | null;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#84CC16', // Lime
  '#6B7280', // Gray
];

export const EditCollectionModal: React.FC<EditCollectionModalProps> = ({
  isOpen,
  onClose,
  collection,
}) => {
  const { updateCollection, isLoading } = useCollectionStore();
  const [formData, setFormData] = useState<CreateCollectionDto>({
    name: '',
    description: '',
    color: PRESET_COLORS[0],
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Initialize form data when collection changes
  useEffect(() => {
    if (collection) {
      setFormData({
        name: collection.name,
        description: collection.description || '',
        color: collection.color,
      });
      setErrors({});
    }
  }, [collection]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Collection name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Collection name must be at least 2 characters';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Collection name must be less than 100 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!collection || !validateForm()) {
      return;
    }

    try {
      const cleanedData: CreateCollectionDto = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        color: formData.color,
      };

      await updateCollection(collection.id, cleanedData);
      
      // Reset errors and close modal
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to update collection:', error);
    }
  };

  const handleInputChange = (field: keyof CreateCollectionDto, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setErrors({});
      onClose();
    }
  };

  const hasChanges = collection && (
    formData.name.trim() !== collection.name ||
    (formData.description?.trim() || '') !== (collection.description || '') ||
    formData.color !== collection.color
  );

  if (!isOpen || !collection) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Collection
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Collection Name */}
          <div>
            <label
              htmlFor="edit-collection-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Collection Name *
            </label>
            <input
              id="edit-collection-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter collection name"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                errors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={isLoading}
              maxLength={100}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="edit-collection-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Description (Optional)
            </label>
            <textarea
              id="edit-collection-description"
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Add a description for this collection"
              rows={3}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                errors.description
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={isLoading}
              maxLength={500}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.description}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.description?.length || 0}/500
            </p>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collection Color
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleInputChange('color', color)}
                  disabled={isLoading}
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                    formData.color === color
                      ? 'border-gray-900 dark:border-white scale-110'
                      : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                  } disabled:opacity-50`}
                  style={{ backgroundColor: color }}
                  title={`Select ${color}`}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: formData.color }}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Selected: {formData.color}
              </span>
            </div>
          </div>

          {/* Collection Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>Created: {new Date(collection.created_at).toLocaleDateString()}</div>
              <div>Last modified: {new Date(collection.updated_at).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.name.trim() || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Updating...
                </div>
              ) : (
                'Update Collection'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};