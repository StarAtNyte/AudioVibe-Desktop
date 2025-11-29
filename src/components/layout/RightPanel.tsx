import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudioStore, useLibraryStore } from '../../store';
import { 
  HeartIcon,
  ShareIcon,
  EllipsisHorizontalIcon,
  FaceSmileIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid
} from '@heroicons/react/24/solid';
import clsx from 'clsx';

export const RightPanel: React.FC = () => {
  const navigate = useNavigate();
  const { currentAudiobookId, status, chapters } = useAudioStore();
  const { audiobooks } = useLibraryStore();
  const [newComment, setNewComment] = useState('');

  const currentAudiobook = currentAudiobookId ?
    audiobooks.find(book => book.id === currentAudiobookId) : null;

  // Calculate total time from all chapters, or use audiobook duration as fallback
  const totalTimeFromChapters = chapters.reduce((acc, chapter) => acc + (chapter.duration || 0), 0);
  // Use audiobook duration if available and chapters don't have duration, otherwise use chapters total
  const totalTime = totalTimeFromChapters > 0
    ? totalTimeFromChapters
    : (currentAudiobook?.duration || 0);

  // Mock comments data - empty by default, can be populated per audiobook
  const comments: any[] = [];

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      // Add comment logic here
      setNewComment('');
    }
  };

  if (!currentAudiobook) {
    return (
      <div className="w-64 text-white flex flex-col h-full">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-2">Comments</h2>
          <p className="text-sm text-gray-400">Select an audiobook to see comments</p>
        </div>
        
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">🎧</span>
            </div>
            <p className="text-sm text-gray-400">Choose an audiobook to view and add comments</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 text-white flex flex-col h-full">
      {/* Header with Cover */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex flex-col items-center space-y-4 mb-6">
          {currentAudiobook.cover_image_path ? (
            <img
              src={currentAudiobook.cover_image_path}
              alt={currentAudiobook.title}
              className="w-48 h-48 object-cover rounded-lg shadow-xl"
            />
          ) : (
            <div className="w-48 h-48 bg-gradient-to-br from-primary-500 via-accent-emerald-500 to-primary-600 rounded-lg flex items-center justify-center shadow-xl">
              <span className="text-white font-bold text-2xl">
                {currentAudiobook.title.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="text-center">
            <h3 className="text-white font-semibold text-lg mb-1">{currentAudiobook.title}</h3>
            <p className="text-gray-400 text-sm mb-2">{currentAudiobook.author}</p>

            {/* Chapter and Time Info */}
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
              <span>{chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}</span>
              <span>•</span>
              <span>{formatDuration(totalTime)} total</span>
            </div>
          </div>
        </div>

      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
        <div className="flex flex-col h-full">
          {/* Comments List */}
          <div className="flex-1 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold text-sm">Comments ({comments.length})</h4>
              <button className="text-gray-400 hover:text-white">
                <EllipsisHorizontalIcon className="w-5 h-5" />
              </button>
            </div>

            {comments.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-3 mx-auto">
                  <span className="text-2xl">💬</span>
                </div>
                <p className="text-sm text-gray-400">No comments yet</p>
                <p className="text-xs text-gray-500 mt-1">Be the first to share your thoughts!</p>
              </div>
            ) : (
              comments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs">
                    {comment.user.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium text-sm">{comment.user.name}</span>
                      <span className="text-gray-500 text-xs">{comment.user.time}</span>
                    </div>
                    <p className="text-gray-300 text-sm mt-1 leading-relaxed">{comment.text}</p>
                    
                    <div className="flex items-center space-x-4 mt-2">
                      <button className={clsx(
                        'flex items-center space-x-1 text-xs transition-colors',
                        comment.isLiked ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
                      )}>
                        {comment.isLiked ? (
                          <HeartIconSolid className="w-4 h-4" />
                        ) : (
                          <HeartIcon className="w-4 h-4" />
                        )}
                        <span>{comment.likes}</span>
                      </button>
                      <button className="text-gray-500 hover:text-white text-xs transition-colors">
                        Reply
                      </button>
                      <button className="text-gray-500 hover:text-white transition-colors">
                        <ShareIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              ))
            )}
          </div>

          {/* Comment Input */}
          <div className="p-4 border-t border-gray-800">
            <form onSubmit={handleCommentSubmit} className="space-y-3">
              <div className="flex space-x-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs">
                  🎧
                </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-green-500 transition-colors"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button type="button" className="text-gray-400 hover:text-white transition-colors">
                    <FaceSmileIcon className="w-5 h-5" />
                  </button>
                </div>
                
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className={clsx(
                    'flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
                    newComment.trim()
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  )}
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                  <span>Post</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};