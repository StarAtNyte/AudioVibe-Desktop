import React, { useState } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { SmartCriteria, SmartRule, AudiobookField, ComparisonOperator } from '../../types/collection';

interface SmartCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; color: string; smart_criteria: SmartCriteria }) => Promise<void>;
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

const FIELD_LABELS: Record<AudiobookField, string> = {
  title: 'Title',
  author: 'Author',
  narrator: 'Narrator',
  genre: 'Genre',
  duration: 'Duration (minutes)',
  publish_date: 'Publish Date',
  added_date: 'Added Date',
  file_size: 'File Size (MB)',
  chapters_count: 'Chapter Count',
};

const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  equals: 'equals',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  greater_than: 'greater than',
  less_than: 'less than',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

const getValidOperators = (field: AudiobookField): ComparisonOperator[] => {
  switch (field) {
    case 'duration':
    case 'file_size':
    case 'chapters_count':
      return ['equals', 'greater_than', 'less_than'];
    case 'publish_date':
    case 'added_date':
      return ['equals', 'greater_than', 'less_than'];
    default:
      return ['equals', 'contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'];
  }
};

export const SmartCollectionModal: React.FC<SmartCollectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: PRESET_COLORS[0],
  });

  const [smartCriteria, setSmartCriteria] = useState<SmartCriteria>({
    rules: [{ field: 'title' as AudiobookField, operator: 'contains' as ComparisonOperator, value: '' }],
    operator: 'AND' as 'AND' | 'OR',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const addRule = () => {
    setSmartCriteria(prev => ({
      ...prev,
      rules: [...prev.rules, { field: 'title', operator: 'contains', value: '' }],
    }));
  };

  const removeRule = (index: number) => {
    if (smartCriteria.rules.length > 1) {
      setSmartCriteria(prev => ({
        ...prev,
        rules: prev.rules.filter((_, i) => i !== index),
      }));
    }
  };

  const updateRule = (index: number, updates: Partial<SmartRule>) => {
    setSmartCriteria(prev => ({
      ...prev,
      rules: prev.rules.map((rule, i) => 
        i === index 
          ? { ...rule, ...updates }
          : rule
      ),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Collection name is required';
    }

    const hasEmptyRules = smartCriteria.rules.some(rule => 
      !rule.value.trim() && !['is_empty', 'is_not_empty'].includes(rule.operator)
    );
    if (hasEmptyRules) {
      newErrors.rules = 'All rules must have a value (except "is empty" and "is not empty")';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        ...formData,
        smart_criteria: smartCriteria,
      });
      
      // Reset form
      setFormData({ name: '', description: '', color: PRESET_COLORS[0] });
      setSmartCriteria({
        rules: [{ field: 'title', operator: 'contains', value: '' }],
        operator: 'AND',
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to create smart collection:', error);
      setErrors({ submit: 'Failed to create smart collection. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Create Smart Collection
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {errors.submit && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-800 dark:text-red-200">{errors.submit}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Collection Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Collection Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter collection name"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Optional description"
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <div className="flex space-x-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color ? 'border-gray-900 dark:border-white' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Smart Criteria */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Smart Collection Rules *
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Match</span>
                      <select
                        value={smartCriteria.operator}
                        onChange={(e) => setSmartCriteria(prev => ({ ...prev, operator: e.target.value as 'AND' | 'OR' }))}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white"
                      >
                        <option value="AND">ALL</option>
                        <option value="OR">ANY</option>
                      </select>
                      <span className="text-sm text-gray-500 dark:text-gray-400">rules</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {smartCriteria.rules.map((rule, index) => (
                      <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <select
                          value={rule.field}
                          onChange={(e) => {
                            const newField = e.target.value as AudiobookField;
                            const validOps = getValidOperators(newField);
                            updateRule(index, { 
                              field: newField,
                              operator: validOps.includes(rule.operator) ? rule.operator : validOps[0]
                            });
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white"
                        >
                          {Object.entries(FIELD_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>

                        <select
                          value={rule.operator}
                          onChange={(e) => updateRule(index, { operator: e.target.value as ComparisonOperator })}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white"
                        >
                          {getValidOperators(rule.field).map(op => (
                            <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                          ))}
                        </select>

                        {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                          <input
                            type="text"
                            value={rule.value}
                            onChange={(e) => updateRule(index, { value: e.target.value })}
                            placeholder="Value"
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => removeRule(index)}
                          disabled={smartCriteria.rules.length <= 1}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addRule}
                    className="mt-2 inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Rule
                  </button>

                  {errors.rules && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.rules}</p>}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
              >
                {isLoading ? 'Creating...' : 'Create Smart Collection'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:focus:ring-offset-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};