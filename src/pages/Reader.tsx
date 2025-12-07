import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReaderStore } from '../store/reader';
import { EbookReader } from '../components/reader/EbookReader';

export const Reader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadEbook, clearReader, currentEbook, isLoading, error } = useReaderStore();

  useEffect(() => {
    if (id) {
      loadEbook(id);
    } else {
      navigate('/ebooks');
    }

    return () => {
      clearReader();
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent mb-4"></div>
          <div className="text-lg text-gray-300">Loading ebook...</div>
        </div>
      </div>
    );
  }

  if (error || !currentEbook) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-lg text-red-400 mb-4">
            {error || 'Ebook not found'}
          </div>
          <button
            onClick={() => navigate('/ebooks')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50">
      <EbookReader />
    </div>
  );
};
