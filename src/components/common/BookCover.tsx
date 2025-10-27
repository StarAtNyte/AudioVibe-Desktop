import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import '../../styles/animations.css';

interface BookCoverProps {
  bookId?: string;
  title: string;
  coverUrl?: string;
  className?: string;
  fallbackClassName?: string;
}

export const BookCover: React.FC<BookCoverProps> = ({
  bookId,
  title,
  coverUrl,
  className = "w-full h-full object-cover rounded-lg",
  fallbackClassName = "w-full h-full bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center"
}) => {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(coverUrl || null);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  // Generate potential cover image URLs for LibriVox books (ordered by likelihood of success)
  const generateCoverUrls = (identifier: string): string[] => {
    const cleanId = identifier.replace('librivox_', '');
    
    // For LibriVox books stored in Archive.org, try different patterns
    const urls = [];
    
    // If it looks like an Archive.org identifier (e.g., "dorian_gray_librivox")
    if (cleanId.includes('_') || cleanId.length > 10) {
      const archiveId = cleanId.includes('_librivox') ? cleanId : `${cleanId}_librivox`;
      const baseId = cleanId.replace('_librivox', '');
      
      // Most likely successful patterns first (based on Python script findings)
      urls.push(
        `https://archive.org/download/${archiveId}/picture_${baseId}_1006.jpg`, // Most common
        `https://archive.org/download/${archiveId}/cover.jpg`,                    // Generic cover
        `https://archive.org/download/${archiveId}/folder.jpg`,                   // Folder image
        `https://archive.org/download/${archiveId}/${baseId}_1006.jpg`,           // Variation
        `https://archive.org/download/${archiveId}/${archiveId}.jpg`,             // Full ID
        `https://archive.org/download/${archiveId}/${archiveId}_itemimage.jpg`    // Item image
      );
    }
    
    // If it looks like a numeric LibriVox ID, try their cover endpoint
    if (/^\d+$/.test(cleanId)) {
      urls.unshift( // Add to beginning (higher priority)
        `https://librivox.org/uploads/covers/${cleanId}.jpg`
      );
    }
    
    return urls;
  };

  useEffect(() => {
    if (coverUrl) {
      setCurrentImageUrl(coverUrl);
      setImageError(false);
      setImageLoaded(false);
      setAttemptCount(0);
      
      // Preload the image for faster display
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.onerror = () => handleImageError();
      img.src = coverUrl;
    }
  }, [coverUrl]);

  const handleImageError = () => {
    if (!bookId) {
      setImageError(true);
      return;
    }

    const potentialUrls = generateCoverUrls(bookId);
    
    if (attemptCount < potentialUrls.length - 1) {
      const nextUrl = potentialUrls[attemptCount + 1];
      console.log(`Trying backup cover image ${attemptCount + 1}:`, nextUrl);
      setCurrentImageUrl(nextUrl);
      setAttemptCount(prev => prev + 1);
    } else {
      console.log('All cover image attempts failed for book:', title);
      setImageError(true);
    }
  };

  const handleImageLoad = () => {
    setImageError(false);
    setImageLoaded(true);
  };

  // Always show fallback first, then overlay image when loaded
  return (
    <div className="relative w-full h-full">
      {/* Always visible fallback background */}
      <div className={fallbackClassName}>
        <BookOpen className="h-12 w-12 text-white" />
      </div>
      
      {/* Image overlay that appears when loaded */}
      {currentImageUrl && !imageError && (
        <img 
          src={currentImageUrl}
          alt={title}
          className={`absolute inset-0 image-load-transition ${className} ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onError={handleImageError}
          onLoad={handleImageLoad}
          loading="eager"
          decoding="async"
        />
      )}
    </div>
  );
};