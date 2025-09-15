import React, { useState, useEffect } from 'react';
import { 
  ThumbsUp, 
  ThumbsDown, 
  X, 
  Sparkles, 
  User, 
  BookOpen, 
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Recommendation {
  id: string;
  audiobook_id: string;
  recommendation_type: string;
  recommendation_score: number;
  recommendation_reason: string | null;
  generated_at: string;
  expires_at: string | null;
  is_dismissed: boolean;
  user_feedback: number | null;
}

interface Audiobook {
  id: string;
  title: string;
  author: string | null;
  narrator: string | null;
  duration: number | null;
  cover_image_path: string | null;
  description: string | null;
  genre: string | null;
}

interface RecommendationWithAudiobook {
  recommendation: Recommendation;
  audiobook: Audiobook;
}

interface RecommendationsPanelProps {
  onPlayAudiobook: (audiobook: Audiobook) => void;
  className?: string;
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  onPlayAudiobook,
  className = ''
}) => {
  const [recommendations, setRecommendations] = useState<RecommendationWithAudiobook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const recs = await invoke<RecommendationWithAudiobook[]>('get_current_recommendations', {
        limit: 10
      });
      setRecommendations(recs);
    } catch (err) {
      console.error('Failed to load recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const generateNewRecommendations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const newRecs = await invoke<RecommendationWithAudiobook[]>('generate_recommendations', {
        limit: 10
      });
      setRecommendations(newRecs);
    } catch (err) {
      console.error('Failed to generate recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (recommendationId: string, feedbackType: string, feedbackValue: number) => {
    setFeedbackLoading(prev => new Set(prev).add(recommendationId));
    
    try {
      await invoke('submit_recommendation_feedback', {
        dto: {
          recommendation_id: recommendationId,
          feedback_type: feedbackType,
          feedback_value: feedbackValue,
          feedback_reason: null
        }
      });

      // Update the recommendation in the state
      setRecommendations(prev => 
        prev.map(rec => 
          rec.recommendation.id === recommendationId
            ? {
                ...rec,
                recommendation: {
                  ...rec.recommendation,
                  user_feedback: feedbackValue
                }
              }
            : rec
        )
      );
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setFeedbackLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(recommendationId);
        return newSet;
      });
    }
  };

  const dismissRecommendation = async (recommendationId: string) => {
    await submitFeedback(recommendationId, 'dismiss', 0);
    setRecommendations(prev => prev.filter(rec => rec.recommendation.id !== recommendationId));
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'genre_preference':
        return <BookOpen size={14} className="text-blue-500" />;
      case 'author_preference':
        return <User size={14} className="text-green-500" />;
      case 'similar_to_completed':
        return <Sparkles size={14} className="text-purple-500" />;
      default:
        return <TrendingUp size={14} className="text-orange-500" />;
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'Unknown';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getTypeDisplayName = (type: string): string => {
    switch (type) {
      case 'genre_preference':
        return 'Genre Match';
      case 'author_preference':
        return 'Favorite Author';
      case 'similar_to_completed':
        return 'Similar to Recent';
      default:
        return 'Recommended';
    }
  };

  if (loading && recommendations.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
            <RefreshCw size={20} className="animate-spin" />
            <span>Loading recommendations...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <Sparkles className="text-purple-500" size={20} />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recommended for You
          </h2>
          {recommendations.length > 0 && (
            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-xs rounded-full">
              {recommendations.length}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={generateNewRecommendations}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
              <X size={16} />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && recommendations.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No recommendations yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Listen to a few audiobooks to get personalized recommendations
          </p>
          <button
            onClick={generateNewRecommendations}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
          >
            <Sparkles size={16} />
            <span>Generate Recommendations</span>
          </button>
        </div>
      )}

      {/* Recommendations List */}
      {recommendations.length > 0 && (
        <div className="p-6 space-y-4">
          {recommendations.map(({ recommendation, audiobook }) => (
            <div
              key={recommendation.id}
              className="flex items-start space-x-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {/* Cover Image */}
              <div className="flex-shrink-0">
                {audiobook.cover_image_path ? (
                  <img
                    src={audiobook.cover_image_path}
                    alt={audiobook.title}
                    className="w-16 h-16 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center">
                    <BookOpen size={20} className="text-gray-500" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Recommendation Type */}
                    <div className="flex items-center space-x-2 mb-2">
                      {getRecommendationIcon(recommendation.recommendation_type)}
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {getTypeDisplayName(recommendation.recommendation_type)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {Math.round(recommendation.recommendation_score * 100)}% match
                      </span>
                    </div>

                    {/* Title and Author */}
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {audiobook.title}
                    </h3>
                    {audiobook.author && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        by {audiobook.author}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {audiobook.duration && (
                        <span>{formatDuration(audiobook.duration)}</span>
                      )}
                      {audiobook.genre && (
                        <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">
                          {audiobook.genre}
                        </span>
                      )}
                    </div>

                    {/* Reason */}
                    {recommendation.recommendation_reason && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {recommendation.recommendation_reason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 ml-4">
                    {recommendation.user_feedback === null && (
                      <>
                        <button
                          onClick={() => submitFeedback(recommendation.id, 'like', 1)}
                          disabled={feedbackLoading.has(recommendation.id)}
                          className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                          title="Like this recommendation"
                        >
                          <ThumbsUp size={16} />
                        </button>
                        <button
                          onClick={() => submitFeedback(recommendation.id, 'dislike', -1)}
                          disabled={feedbackLoading.has(recommendation.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Dislike this recommendation"
                        >
                          <ThumbsDown size={16} />
                        </button>
                      </>
                    )}
                    
                    {recommendation.user_feedback === 1 && (
                      <div className="flex items-center space-x-1 text-green-500">
                        <ThumbsUp size={16} />
                        <span className="text-xs">Liked</span>
                      </div>
                    )}
                    
                    {recommendation.user_feedback === -1 && (
                      <div className="flex items-center space-x-1 text-red-500">
                        <ThumbsDown size={16} />
                        <span className="text-xs">Disliked</span>
                      </div>
                    )}

                    <button
                      onClick={() => dismissRecommendation(recommendation.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                      title="Dismiss recommendation"
                    >
                      <EyeOff size={16} />
                    </button>
                  </div>
                </div>

                {/* Play Button */}
                <div className="mt-3">
                  <button
                    onClick={() => onPlayAudiobook(audiobook)}
                    className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                  >
                    <span>Play Now</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};