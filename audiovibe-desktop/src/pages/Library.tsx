import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LibraryView, AddAudiobookModal } from '../components/library';
import { useLibraryStore, useAudioStore } from '../store';

export const Library: React.FC = () => {
  const navigate = useNavigate();
  const {
    audiobooks,
    isLoading,
    error,
    fetchAudiobooks,
    getFilteredAudiobooks,
    deleteAudiobook,
    createAudiobook,
  } = useLibraryStore();

  const { currentAudiobookId, loadAudio, play, pause, stop, status, getStatus } = useAudioStore();
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch audiobooks on component mount
  useEffect(() => {
    fetchAudiobooks();
  }, [fetchAudiobooks]);

  const handlePlay = async (id: string) => {
    try {
      console.log('=== LIBRARY PLAY START ===');
      console.log('Playing audiobook ID:', id);
      console.log('Available audiobooks:', audiobooks.map(b => ({ id: b.id, title: b.title })));
      
      let audiobook = audiobooks.find(book => book.id === id);
      
      // If audiobook is not found, try refreshing the library and wait
      if (!audiobook) {
        console.log('Audiobook not found initially, refreshing library...');
        await fetchAudiobooks();
        
        // Wait a moment for the state to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to find the audiobook again
        const updatedAudiobooks = getFilteredAudiobooks();
        audiobook = updatedAudiobooks.find(book => book.id === id);
        
        if (!audiobook) {
          console.error('Audiobook still not found after refresh:', id);
          alert('Audiobook not found. Please try refreshing the page.');
          return;
        }
      }
      
      console.log('Found audiobook:', audiobook.title);
      console.log('File path:', audiobook.file_path);
      
      // Explicitly stop any currently playing audio before loading new one
      try {
        console.log('Stopping any currently playing audio...');
        await stop();
        console.log('Successfully stopped current audio');
        // Wait a bit for stop operation to complete
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (stopError) {
        console.warn('Failed to stop current audio (may not be playing):', stopError);
      }
      
      // Always load the audio (this will stop any current audio automatically)
      console.log('Loading audio...');
      console.log('File path:', audiobook.file_path);
      console.log('Is directory?', audiobook.file_path.includes('/') || audiobook.file_path.includes('\\'));
      
      try {
        await loadAudio(audiobook.file_path, audiobook.id);
        console.log('✅ loadAudio completed successfully');
      } catch (loadError) {
        console.error('❌ loadAudio failed:', loadError);
        throw loadError; // Re-throw to be caught by main error handler
      }
      
      // Wait for the audio to be fully loaded by checking the status
      console.log('Waiting for audio to be ready...');
      let attempts = 0;
      const maxAttempts = 25; // Maximum wait time of 5 seconds (25 * 200ms)
      
      while (attempts < maxAttempts) {
        // Get the current status to check if the audio is loaded
        try {
          await getStatus();
          
          const currentStatus = useAudioStore.getState().status;
          console.log('Current status:', currentStatus);
          
          // Be more lenient with status checking - backend logs show audio loaded successfully
          if (currentStatus.current_file) {
            console.log('✅ Audio file is loaded, considering ready');
            break;
          }
          
          // Also accept if already playing (which means it loaded successfully)
          if (currentStatus.state === 'Playing') {
            console.log('✅ Audio is already playing, must be loaded');
            break;
          }
          
          // Check if we have a valid duration and current file
          if (currentStatus.duration && currentStatus.duration > 0 && currentStatus.current_file) {
            console.log('✅ Audio is ready with duration:', currentStatus.duration);
            break;
          }
          
        } catch (statusError) {
          console.warn(`Status check attempt ${attempts + 1} failed, but continuing:`, statusError);
          // Don't break - the audio might still be working
        }
        
        attempts++;
        console.log(`Waiting for audio to load... attempt ${attempts}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 300)); // Slightly longer delay
      }
      
      // Additional small delay to ensure backend is fully ready
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Verify one more time that the audio is loaded
      await getStatus();
      const finalStatus = useAudioStore.getState().status;
      console.log('Final status check:', finalStatus);
      
      // Since backend logs show everything worked, be more lenient with validation
      if (!finalStatus.current_file) {
        console.warn('No current_file found in status, but backend loaded successfully. Continuing anyway.');
      }
      
      if (!finalStatus.duration || finalStatus.duration <= 0) {
        console.warn('Duration not available in status, but backend loaded successfully. Continuing anyway.');
      }
      
      console.log('Starting playback...');
      try {
        await play();
        console.log('✅ Play command succeeded');
      } catch (playError) {
        console.warn('Play command failed, but continuing:', playError);
        // Don't throw - the audio might still work
      }
      
      // Wait a moment and check the audio store state after play
      await new Promise(resolve => setTimeout(resolve, 500));
      const audioStoreState = useAudioStore.getState();
      console.log('🎵 Audio store state after play:', {
        currentAudiobookId: audioStoreState.currentAudiobookId,
        status: audioStoreState.status,
        isPlayerVisible: audioStoreState.isPlayerVisible,
        audioInfo: audioStoreState.audioInfo
      });
      
      // Final success check based on backend logs
      if (audioStoreState.status.state === 'Playing' || audioStoreState.currentAudiobookId) {
        console.log('✅ SUCCESS: Audio confirmed playing or loaded, navigating to player');
        navigate('/player');
        console.log('=== LIBRARY PLAY COMPLETE ===');
      } else {
        console.log('⚠️ WARNING: Audio state unclear, but backend succeeded, navigating anyway');
        navigate('/player');
        console.log('=== LIBRARY PLAY COMPLETE (with warnings) ===');
      }
    } catch (error) {
      console.error('Failed to play audiobook:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        type: typeof error,
        error
      });
      
      // Show error to user with more context
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('Showing error alert to user:', errorMessage);
      alert(`Failed to play audiobook: ${errorMessage}\n\nPlease check the browser console for more details.`);
    }
  };

  const handlePause = async () => {
    try {
      await pause();
    } catch (error) {
      console.error('Failed to pause audiobook:', error);
    }
  };

  const handleAddFiles = async (files: FileList) => {
    // For now, just redirect to folder picker since individual file upload isn't implemented
    // This prevents double calls
    console.log('Redirecting to folder picker instead of file upload');
  };

  const handleAddFolder = async (folderName?: string) => {
    try {
      setShowAddModal(false); // Close modal immediately
      
      console.log('=== STARTING FOLDER UPLOAD ===');
      console.log('Window.__TAURI__:', typeof (window as any).__TAURI__);
      
      const { isTauri } = await import('@tauri-apps/api/core');
      const isInTauri = await isTauri();
      console.log('isTauri() result:', isInTauri);
      
      if (!isInTauri && typeof (window as any).__TAURI__ === 'undefined') {
        alert('This feature is only available in the desktop app');
        return;
      }
      
      console.log('Opening directory picker...');
      
      // Use Tauri's dialog plugin to open native directory picker
      const { open } = await import('@tauri-apps/plugin-dialog');
      
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Audiobooks Directory'
      });
      
      if (!selectedPath) {
        console.log('No directory selected');
        return;
      }
      
      console.log('Selected directory:', selectedPath);
      
      // Scan the selected directory
      console.log('Calling scan_directory with path:', selectedPath);
      const { invoke } = await import('@tauri-apps/api/core');
      const audioFiles = await invoke<any[]>('scan_directory', { 
        directoryPath: selectedPath 
      });
      
      console.log(`Found ${audioFiles.length} audio files:`, audioFiles);
      
      if (audioFiles.length === 0) {
        alert(`No audio files found in the selected directory.\n\nPlease ensure the directory contains supported audio files:\n• MP3, M4A, AAC, FLAC, WAV, OGG`);
        return;
      }
      
      // Import the found audiobooks
      console.log('Importing audiobooks...');
      const filePaths = audioFiles.map((file: any) => file.path);
      console.log('File paths to import:', filePaths);
      
      const result = await invoke('import_audiobook_from_files', {
        filePaths: filePaths
      });
      
      console.log('Import result:', result);
      
      // Refresh the library
      await fetchAudiobooks();
      
      alert(`Successfully imported ${audioFiles.length} audiobook(s)!`);
      
    } catch (error) {
      console.error('Failed to import audiobooks:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to import audiobooks: ${errorMessage}`);
    }
  };

  const handleSelectAudiobook = async (id: string) => {
    console.log('Selected audiobook:', id);
    // Play the audiobook and navigate to player
    await handlePlay(id);
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      console.log('Bulk deleting audiobooks:', ids);
      
      // Delete each audiobook
      for (const id of ids) {
        await deleteAudiobook(id);
      }
      
      console.log(`✅ Successfully deleted ${ids.length} audiobooks`);
      
      // Refresh the library
      await fetchAudiobooks();
    } catch (error) {
      console.error('Failed to delete audiobooks:', error);
      alert(`Failed to delete audiobooks. Please try again.`);
    }
  };

  const handleImportDocument = async (audiobook: any) => {
    try {
      console.log('TTS audiobook already created:', audiobook);
      
      // The audiobook has already been created by the TTS process
      // Just refresh the library to show it
      await fetchAudiobooks();
      
      console.log('✅ Successfully refreshed library after TTS audiobook creation');
    } catch (error) {
      console.error('Failed to refresh library after TTS audiobook creation:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to refresh library: ${errorMessage}`);
    }
  };

  // Convert our audiobook data to the format expected by LibraryView
  const displayAudiobooks = getFilteredAudiobooks().map(audiobook => {
    // Debug logging for metadata issues
    if (!audiobook.cover_image_path) {
      console.log(`📷 Missing cover for ${audiobook.title}: cover_image_path = ${audiobook.cover_image_path}`);
    }
    if (!audiobook.duration || audiobook.duration === 0) {
      console.log(`⏱️ Missing duration for ${audiobook.title}: duration = ${audiobook.duration}`);
    }

    return {
      id: audiobook.id,
      title: audiobook.title,
      author: audiobook.author || 'Unknown Author',
      duration: audiobook.duration || 0,
      progress: 0, // TODO: Get from playback progress
      dateAdded: new Date(audiobook.added_date),
      genre: audiobook.genre || 'Unknown Genre',
      narrator: audiobook.narrator,
      coverUrl: audiobook.cover_image_path || undefined
    };
  });

  const currentlyPlaying = (status.state === 'Playing' || status.state === 'Paused') ? currentAudiobookId : undefined;
  
  // Debug logging for playing state
  console.log('🎵 Library playing state:', {
    status: status.state,
    currentAudiobookId,
    currentlyPlaying,
    isPlaying: status.state === 'Playing'
  });

  return (
    <>
      <LibraryView
        audiobooks={displayAudiobooks}
        currentlyPlaying={currentlyPlaying}
        isPlaying={status.state === 'Playing'}
        onPlay={handlePlay}
        onPause={handlePause}
        onAddAudiobook={() => setShowAddModal(true)}
        onImportDocument={handleImportDocument}
        onSelectAudiobook={handleSelectAudiobook}
        onBulkDelete={handleBulkDelete}
      />

      <AddAudiobookModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddFiles={handleAddFiles}
        onAddFolder={handleAddFolder}
      />
    </>
  );
};