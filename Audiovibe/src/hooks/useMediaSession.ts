import { useEffect, useRef } from 'react';

export interface MediaSessionMetadata {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
}

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  onStop?: () => void;
  onSeekTo?: (time: number) => void;
}

export const useMediaSession = (
  metadata: MediaSessionMetadata | null,
  handlers: MediaSessionHandlers,
  playbackState: 'none' | 'paused' | 'playing' = 'none',
  position: number = 0,
  duration: number = 0
) => {
  const handlersRef = useRef(handlers);

  // Update handlers ref when handlers change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Set up MediaSession
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      console.warn('MediaSession API not supported');
      return;
    }

    const mediaSession = navigator.mediaSession;

    // Set metadata
    if (metadata) {
      mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album || '',
        artwork: metadata.artwork 
          ? [{ src: metadata.artwork, sizes: '512x512', type: 'image/png' }]
          : [
              {
                src: '/icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: '/icons/icon-512.png', 
                sizes: '512x512',
                type: 'image/png'
              }
            ]
      });
    } else {
      mediaSession.metadata = null;
    }

    // Set playback state
    mediaSession.playbackState = playbackState;

    // Set position state
    if (duration > 0) {
      mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(position, duration)
      });
    }

    // Set up action handlers
    const actionHandlers: { [key: string]: MediaSessionActionHandler } = {
      play: () => handlersRef.current.onPlay?.(),
      pause: () => handlersRef.current.onPause?.(),
      stop: () => handlersRef.current.onStop?.(),
      seekbackward: () => handlersRef.current.onSeekBackward?.(),
      seekforward: () => handlersRef.current.onSeekForward?.(),
      previoustrack: () => handlersRef.current.onPreviousTrack?.(),
      nexttrack: () => handlersRef.current.onNextTrack?.(),
      seekto: (details) => {
        if (details.seekTime !== undefined) {
          handlersRef.current.onSeekTo?.(details.seekTime);
        }
      }
    };

    // Register all available action handlers
    for (const [action, handler] of Object.entries(actionHandlers)) {
      try {
        mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch (error) {
        console.warn(`MediaSession action "${action}" not supported:`, error);
      }
    }

    // Cleanup function
    return () => {
      try {
        // Clear all action handlers
        const actions: MediaSessionAction[] = [
          'play', 'pause', 'stop', 
          'seekbackward', 'seekforward', 
          'previoustrack', 'nexttrack',
          'seekto'
        ];

        actions.forEach(action => {
          try {
            mediaSession.setActionHandler(action, null);
          } catch (e) {
            // Ignore errors during cleanup
          }
        });

        mediaSession.metadata = null;
        mediaSession.playbackState = 'none';
      } catch (error) {
        console.warn('Error cleaning up MediaSession:', error);
      }
    };
  }, [metadata, playbackState, position, duration]);

  // Update position periodically when playing
  useEffect(() => {
    if (!('mediaSession' in navigator) || playbackState !== 'playing' || duration <= 0) {
      return;
    }

    const mediaSession = navigator.mediaSession;
    
    // Update position every 10 seconds while playing
    const interval = setInterval(() => {
      try {
        mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(position, duration)
        });
      } catch (error) {
        console.warn('Error updating MediaSession position:', error);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [playbackState, position, duration]);

  // Return utilities for manual control
  return {
    isSupported: 'mediaSession' in navigator,
    updatePosition: (newPosition: number, newDuration?: number) => {
      if ('mediaSession' in navigator && (newDuration || duration) > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: newDuration || duration,
            playbackRate: 1,
            position: Math.min(newPosition, newDuration || duration)
          });
        } catch (error) {
          console.warn('Error manually updating MediaSession position:', error);
        }
      }
    },
    updatePlaybackState: (state: MediaSessionPlaybackState) => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = state;
      }
    }
  };
};