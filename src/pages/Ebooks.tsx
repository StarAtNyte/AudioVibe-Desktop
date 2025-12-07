import React, { useState, useEffect } from 'react';
import { EbookLibraryView, EbookImportModal } from '../components/ebooks';
import { useEbookStore } from '../store/ebook';
import { Ebook } from '../types/ebook';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const Ebooks: React.FC = () => {
  const {
    ebooks,
    isLoading,
    error,
    fetchEbooks,
    getFilteredEbooks,
    deleteEbook,
  } = useEbookStore();

  const [showImportModal, setShowImportModal] = useState(false);

  // Fetch ebooks on component mount
  useEffect(() => {
    fetchEbooks();
  }, [fetchEbooks]);

  const handleOpenEbook = async (id: string) => {
    console.log('Opening ebook in new window:', id);

    // Find the ebook to get its title
    const ebook = ebooks.find(e => e.id === id);
    const windowLabel = `reader-${id}`;

    try {
      // Check if window already exists
      const existingWindow = await WebviewWindow.getByLabel(windowLabel);
      if (existingWindow) {
        await existingWindow.setFocus();
        return;
      }

      // Create new window for the reader
      const readerWindow = new WebviewWindow(windowLabel, {
        url: `/reader/${id}`,
        title: ebook?.title || 'Reader',
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        center: true,
        resizable: true,
        decorations: false,
        fullscreen: false,
      });

      // Wait for window to be ready
      await readerWindow.once('tauri://created', () => {
        console.log('Reader window created');
      });

      await readerWindow.once('tauri://error', (e) => {
        console.error('Failed to create reader window:', e);
      });
    } catch (error) {
      console.error('Error opening reader window:', error);
    }
  };

  const handleDeleteEbook = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this ebook?')) {
      try {
        await deleteEbook(id);
      } catch (error) {
        console.error('Failed to delete ebook:', error);
        alert('Failed to delete ebook');
      }
    }
  };

  const filteredEbooks = getFilteredEbooks();

  return (
    <div className="flex flex-col h-full">
      <EbookLibraryView
        ebooks={filteredEbooks}
        isLoading={isLoading}
        error={error}
        onOpenEbook={handleOpenEbook}
        onDeleteEbook={handleDeleteEbook}
        onImportClick={() => setShowImportModal(true)}
      />

      {showImportModal && (
        <EbookImportModal
          onClose={() => setShowImportModal(false)}
          onImportSuccess={() => {
            setShowImportModal(false);
            fetchEbooks();
          }}
        />
      )}
    </div>
  );
};
