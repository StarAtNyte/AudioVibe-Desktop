import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SpotifySearch } from '../components/search/SpotifySearch';
import { useLibraryStore } from '../store';

export const SearchResults: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { audiobooks } = useLibraryStore();
  const [initialQuery, setInitialQuery] = useState('');

  // Extract search query from URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const query = searchParams.get('q') || '';
    console.log('SearchResults: Extracted query from URL:', query);
    setInitialQuery(query);
  }, [location.search]);

  const handleImport = async (audiobook: any) => {
    console.log('Importing audiobook:', audiobook.title);
    // Import functionality would go here
  };

  const handlePlayLibrary = (audiobook: any) => {
    console.log('Playing library audiobook:', audiobook.title);
    // Play functionality would go here
  };

  return (
    <div className="pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Search Results</h1>
        <p className="text-gray-400">
          {initialQuery 
            ? `Results for "${initialQuery}"` 
            : 'Enter a search term to find audiobooks'}
        </p>
      </div>
      
      <SpotifySearch
        onImport={handleImport}
        onPlayLibrary={handlePlayLibrary}
        libraryBooks={audiobooks}
        initialQuery={initialQuery}
        onNavigateToDownloads={() => navigate('/downloads')}
      />
    </div>
  );
};